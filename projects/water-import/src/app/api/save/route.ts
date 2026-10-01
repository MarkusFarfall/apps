import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { players, saves } from "@/db/schema";
import { levelFromXp } from "@/game/progress";
import { MIN_PER_DAY } from "@/game/world";
import { checkPlayerAccess, cleanName, rateLimit } from "@/lib/auth";
import { body, dbError, fail, json, sameOrigin } from "@/lib/http";
import { sanitizeSave } from "@/lib/sanitize";

export const dynamic = "force-dynamic";

/** На сервере прогресс ушёл дальше — отдаём актуальное сохранение и 409. */
class ConflictError extends Error {
  constructor(readonly save: unknown) {
    super("conflict");
  }
}

/** Профиль перестал принадлежать текущему пользователю (например, аккаунт удалён). */
class ForbiddenError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export async function GET(req: Request) {
  const playerId = new URL(req.url).searchParams.get("playerId") ?? "";
  try {
    const acc = await checkPlayerAccess(playerId);
    if (!acc.ok) return fail(acc.error, acc.status);
    const rows = await db.select().from(saves).where(eq(saves.playerId, playerId)).limit(1);
    if (!rows.length) return json({ save: null });
    return json({ save: rows[0].data, updatedAt: rows[0].updatedAt });
  } catch (e) {
    return dbError(e);
  }
}

export async function PUT(req: Request) {
  if (!sameOrigin(req)) return fail("forbidden", 403);
  const limited = await rateLimit("save", 120, 60_000);
  if (limited === null) return fail("Сервер временно недоступен", 503);
  if (!limited) return fail("Слишком часто: подождите минуту", 429);
  const b = await body<{ playerId?: string; name?: string; data?: Record<string, unknown>; force?: boolean }>(req);
  if (!b) return fail("Некорректный запрос");
  const playerId = b.playerId ?? "";
  const data = b.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) return fail("bad payload");
  if (JSON.stringify(data).length > 500_000) return fail("too large", 413);

  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0);
  const str = (v: unknown, max: number) => (typeof v === "string" && v.length > 0 && v.length <= max ? v : null);
  const name = cleanName(b.name) ?? "Рыбак";

  try {
    const acc = await checkPlayerAccess(playerId);
    if (!acc.ok) return fail(acc.error, acc.status);

    // Наигранное время не может превышать возраст аккаунта: сервер знает дату
    // регистрации, поэтому «три года игры за вечер» отсекаются ещё до рейтинга.
    const accountAgeSeconds = Math.max(0, (Date.now() - Date.parse(acc.createdAt)) / 1000);
    // прогресс приходит с клиента — приводим его к разумному виду, прежде чем считать рейтинг
    const clean = sanitizeSave(data, { accountAgeSeconds });
    const save = clean.data;
    const stats = (save.stats ?? {}) as Record<string, unknown>;
    const values = {
      playerId,
      data: save,
      version: num(save.version) || 1,
      money: num(save.money),
      codexCount: clean.codexCount,
      totalCaught: num(stats.totalCaught),
      playSeconds: num(stats.playSeconds),
      level: levelFromXp(num(save.xp)),
      achievements: clean.achievements,
      // Снимок мира: по нему друзья видят, где сейчас лодка и на чём он ходит.
      // Идентификаторы уже приведены к валидным в sanitizeSave().
      location: str(save.location, 32),
      spot: str(save.spot, 48),
      port: str(save.port, 32),
      atPort: save.atPort === true,
      weather: str(save.weather, 24),
      boat: num(save.boat),
      gameDay: Math.max(1, Math.floor(num(save.minutes) / MIN_PER_DAY) + 1),
    };

    await db.transaction(async (tx) => {
      // Блокируем строку профиля: два устройства, сохранившихся одновременно,
      // раньше проходили проверку конфликта оба и побеждал последний запись.
      const own = await tx.select({ userId: players.userId }).from(players).where(eq(players.id, playerId)).limit(1).for("update");
      if (!own[0] || own[0].userId !== acc.userId) throw new ForbiddenError(403, "forbidden");

      // защита от перезаписи более свежего прогресса с другого устройства
      if (!b.force) {
        const cur = await tx.select({ playSeconds: saves.playSeconds, data: saves.data }).from(saves).where(eq(saves.playerId, playerId)).limit(1);
        if (cur[0] && cur[0].playSeconds > num(stats.playSeconds) + 120) throw new ConflictError(cur[0].data);
      }

      await tx
        .insert(players)
        .values({ id: playerId, name })
        .onConflictDoUpdate({ target: players.id, set: { lastSeenAt: sql`now()`, name } });
      await tx.insert(saves).values(values).onConflictDoUpdate({ target: saves.playerId, set: { ...values, updatedAt: sql`now()` } });
    });
    return json({ ok: true });
  } catch (e) {
    if (e instanceof ConflictError) return json({ conflict: true, save: e.save }, 409);
    if (e instanceof ForbiddenError) return fail(e.message, e.status);
    return dbError(e);
  }
}

export async function DELETE(req: Request) {
  if (!sameOrigin(req)) return fail("forbidden", 403);
  const playerId = new URL(req.url).searchParams.get("playerId") ?? "";
  try {
    const acc = await checkPlayerAccess(playerId);
    if (!acc.ok) return fail(acc.error, acc.status);
    await db.delete(saves).where(eq(saves.playerId, playerId));
    return json({ ok: true });
  } catch (e) {
    return dbError(e);
  }
}
