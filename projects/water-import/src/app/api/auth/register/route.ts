import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, hashPassword, newUserId, playerForUser, rateLimit, toPublic, validateEmail, validatePassword, validateUsername } from "@/lib/auth";
import { body, dbError, fail, json, sameOrigin } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail("forbidden", 403);
  if (!(await rateLimit("register", 6, 15 * 60_000))) return fail("Слишком много попыток. Попробуйте позже", 429);
  const b = await body<{ username?: string; email?: string; password?: string; guestId?: string }>(req);
  if (!b) return fail("Некорректный запрос");
  const username = validateUsername(b.username);
  if (typeof username !== "string") return fail(username.error);
  const email = validateEmail(b.email);
  if (email && typeof email !== "string") return fail(email.error);
  const password = validatePassword(b.password);
  if (typeof password !== "string") return fail(password.error);
  try {
    const lower = username.toLowerCase();
    const taken = await db.select({ id: users.id }).from(users).where(eq(users.usernameLower, lower)).limit(1);
    if (taken[0]) return fail("Это имя уже занято", 409);
    if (email) {
      const et = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
      if (et[0]) return fail("Эта почта уже зарегистрирована", 409);
    }
    const id = newUserId();
    const [u] = await db
      .insert(users)
      .values({ id, username, usernameLower: lower, email: email ?? null, passwordHash: await hashPassword(password), lastLoginAt: new Date() })
      .returning();
    const playerId = await playerForUser(id, b.guestId, username);
    await createSession(id);
    return json({ user: toPublic(u), playerId }, 201);
  } catch (e) {
    const msg = String((e as { message?: string })?.message ?? "");
    if (msg.includes("users_username_lower_uq")) return fail("Это имя уже занято", 409);
    if (msg.includes("users_email_uq")) return fail("Эта почта уже зарегистрирована", 409);
    return dbError(e);
  }
}
