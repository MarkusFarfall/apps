import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { currentUser, destroyOtherSessions, hashPassword, rateLimit, validatePassword, verifyPassword } from "@/lib/auth";
import { body, dbError, fail, json, sameOrigin } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail("forbidden", 403);
  const limited = await rateLimit("password", 6, 15 * 60_000);
  if (limited === null) return fail("Сервер временно недоступен", 503);
  if (!limited) return fail("Слишком много попыток", 429);
  const b = await body<{ current?: string; next?: string }>(req);
  try {
    const u = await currentUser();
    if (!u) return fail("Требуется вход", 401);
    if (!(await verifyPassword(String(b?.current ?? ""), u.passwordHash))) return fail("Текущий пароль неверен", 401);
    const next = validatePassword(b?.next);
    if (typeof next !== "string") return fail(next.error);
    await db.update(users).set({ passwordHash: await hashPassword(next) }).where(eq(users.id, u.id));
    await destroyOtherSessions(u.id);
    return json({ ok: true });
  } catch (e) {
    return dbError(e);
  }
}
