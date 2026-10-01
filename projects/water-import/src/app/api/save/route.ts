import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { players, saves } from "@/db/schema";
import { levelFromXp } from "@/game/progress";
import { checkPlayerAccess, cleanName, rateLimit } from "@/lib/auth";
import { body, dbError, fail, json, sameOrigin } from "@/lib/http";
import { sanitizeSave } from "@/lib/sanitize";

export const dynamic = "force-dynamic";

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
  const name = cleanName(b.name) ?? "Рыбак";
  // прогресс приходит с клиента — приводим его к разумному виду, прежде чем считать рейтинг
  const clean = sanitizeSave(data);
  const save = clean.data;
  const stats = (save.stats ?? {}) as Record<string, unknown>;

  try {
    const acc = await checkPlayerAccess(playerId);
    if (!acc.ok) return fail(acc.error, acc.status);
    // защита от перезаписи более свежего прогресса с другого устройства
    if (!b.force) {
      const cur = await db.select({ playSeconds: saves.playSeconds, data: saves.data }).from(saves).where(eq(saves.playerId, playerId)).limit(1);
      if (cur[0] && cur[0].playSeconds > num(stats.playSeconds) + 120) return json({ conflict: true, save: cur[0].data }, 409);
    }
    await db
      .insert(players)
      .values({ id: playerId, name })
      .onConflictDoUpdate({ target: players.id, set: { lastSeenAt: sql`now()`, name } });
    const values = {
      playerId,
      data: save,
      version: num(save.version) || 1,
      money: num(save.money),
      codexCount: clean.species,
      totalCaught: num(stats.totalCaught),
      playSeconds: num(stats.playSeconds),
      level: levelFromXp(num(save.xp)),
      achievements: clean.achievements,
    };
    await db.insert(saves).values(values).onConflictDoUpdate({ target: saves.playerId, set: { ...values, updatedAt: sql`now()` } });
    return json({ ok: true });
  } catch (e) {
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
