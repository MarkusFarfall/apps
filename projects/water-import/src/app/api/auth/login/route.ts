import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, playerForUser, rateLimit, toPublic, verifyPassword } from "@/lib/auth";
import { body, dbError, fail, json, sameOrigin } from "@/lib/http";

export const dynamic = "force-dynamic";

const DUMMY = "scrypt$16384$AAAAAAAAAAAAAAAAAAAAAA$" + "A".repeat(86);

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail("forbidden", 403);
  if (!(await rateLimit("login", 20, 10 * 60_000))) return fail("Слишком много попыток. Попробуйте через несколько минут", 429);
  const b = await body<{ login?: string; password?: string }>(req);
  const login = typeof b?.login === "string" ? b.login.trim().toLowerCase() : "";
  const password = typeof b?.password === "string" ? b.password : "";
  if (!login || !password || password.length > 128) return fail("Введите логин и пароль");
  try {
    const rows = await db.select().from(users).where(eq(users.usernameLower, login)).limit(1);
    const u = rows[0];
    // одинаковое время ответа для существующих и несуществующих логинов
    const ok = await verifyPassword(password, u?.passwordHash ?? DUMMY);
    if (!u || !ok) return fail("Неверный логин или пароль", 401);
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, u.id));
    const playerId = await playerForUser(u.id, u.username);
    await createSession(u.id);
    return json({ user: toPublic(u), playerId });
  } catch (e) {
    return dbError(e);
  }
}
