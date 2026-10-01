import { eq } from "drizzle-orm";
import { db } from "@/db";
import { players, saves, users } from "@/db/schema";
import { currentUser, destroySession, playerForUser, rateLimit, toPublic, verifyPassword } from "@/lib/auth";
import { body, dbError, fail, json, sameOrigin } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const u = await currentUser();
    if (!u) return json({ user: null });
    const playerId = await playerForUser(u.id, u.username);
    const st = await db.select({ level: saves.level, codexCount: saves.codexCount, totalCaught: saves.totalCaught, playSeconds: saves.playSeconds, updatedAt: saves.updatedAt }).from(saves).where(eq(saves.playerId, playerId)).limit(1);
    return json({ user: toPublic(u), playerId, stats: st[0] ?? null });
  } catch (e) {
    return dbError(e);
  }
}

/** Удаление аккаунта (с подтверждением паролем) */
export async function DELETE(req: Request) {
  if (!sameOrigin(req)) return fail("forbidden", 403);
  if (!(await rateLimit("delete", 5, 15 * 60_000))) return fail("Слишком много попыток", 429);
  const b = await body<{ password?: string }>(req);
  try {
    const u = await currentUser();
    if (!u) return fail("Требуется вход", 401);
    if (!(await verifyPassword(String(b?.password ?? ""), u.passwordHash))) return fail("Неверный пароль", 401);
    await db.delete(players).where(eq(players.userId, u.id));
    await db.delete(users).where(eq(users.id, u.id));
    await destroySession();
    return json({ ok: true });
  } catch (e) {
    return dbError(e);
  }
}
