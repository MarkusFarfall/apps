import "server-only";
import { createHash, randomBytes, randomUUID, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { db } from "@/db";
import { players, sessions, users } from "@/db/schema";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: { N: number; r: number; p: number; maxmem: number }) => Promise<Buffer>;

export const SESSION_COOKIE = "zv_session";
const SESSION_DAYS = 30;
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export interface PublicUser {
  id: string;
  username: string;
  createdAt: string;
}

// ─────────── пароли ───────────
export async function hashPassword(pw: string) {
  const salt = randomBytes(16);
  const key = await scrypt(pw.normalize("NFKC"), salt, 64, SCRYPT);
  return `scrypt$${SCRYPT.N}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifyPassword(pw: string, stored: string) {
  const [alg, n, saltB64, keyB64] = stored.split("$");
  if (alg !== "scrypt" || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, "base64url");
  const key = await scrypt(pw.normalize("NFKC"), Buffer.from(saltB64, "base64url"), expected.length, { ...SCRYPT, N: Number(n) || SCRYPT.N });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

// ─────────── валидация ───────────
const BAD_WORDS = /(ху[йяеёию]|пизд|[её]б[ауеилнт]|бля|пид[оа]р|педр|муда[кч]|залуп|гандон|шлю[хш]|сука|сучк|дроч|fuck|shit|bitch|nigg|cunt|dick|whore|huy|hui|xuy|pizd|blya|blyat|pid[oa]r|mudak|zalup|gandon|suka|eblan|eb[ao]l|ebat|ebu|pizdec|hu[ey]l)/i;
// латинские буквы, похожие на кириллицу, и «цифровые» подмены
const LOOKALIKE: Record<string, string> = { a: "а", o: "о", e: "е", p: "р", c: "с", x: "х", y: "у", k: "к", m: "м", t: "т", h: "н", b: "в", "0": "о", "3": "з", "4": "ч", "6": "б", "@": "а" };
const squash = (s: string) => s.toLowerCase().replace(/ё/g, "е").replace(/[\s_.\-]/g, "");

export const isClean = (raw: string) => {
  const s = squash(raw);
  const cyr = s.replace(/[a-z0-9@]/g, (ch) => LOOKALIKE[ch] ?? ch);
  const lat = s.replace(/[013 4@$]/g, (ch) => ({ "0": "o", "1": "i", "3": "e", "4": "a", "@": "a", $: "s" })[ch] ?? ch);
  return !BAD_WORDS.test(s) && !BAD_WORDS.test(cyr) && !BAD_WORDS.test(lat) && !BAD_WORDS.test(s.replace(/[0-9]/g, ""));
};

export function cleanName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.normalize("NFKC").replace(/\s+/g, " ").trim();
  if (s.length < 2 || s.length > 24) return null;
  if (!/^[\p{L}\p{N} _.\-]+$/u.test(s)) return null;
  if (!isClean(s)) return null;
  return s;
}

export function validateUsername(raw: unknown): string | { error: string } {
  if (typeof raw !== "string") return { error: "Укажите имя пользователя" };
  const s = raw.trim();
  if (s.length < 3 || s.length > 24) return { error: "Имя пользователя — от 3 до 24 символов" };
  if (!/^[\p{L}\p{N}_.\-]+$/u.test(s)) return { error: "Допустимы буквы, цифры, точка, дефис и подчёркивание" };
  if (!isClean(s)) return { error: "Выберите другое имя" };
  return s;
}

export function validatePassword(raw: unknown): string | { error: string } {
  if (typeof raw !== "string") return { error: "Укажите пароль" };
  if (raw.length < 8) return { error: "Пароль — не короче 8 символов" };
  if (raw.length > 128) return { error: "Слишком длинный пароль" };
  if (!/[^\d]/.test(raw) || !/\d/.test(raw)) return { error: "Пароль должен содержать буквы и цифры" };
  return raw;
}

// ─────────── ограничение частоты ───────────
// Счётчики живут в базе: раньше они лежали в памяти инстанса и обнулялись на каждом
// холодном старте, а между параллельными лямбдами вообще не разделялись — то есть
// защита от перебора работала лишь частично. Теперь окно общее для всего прода.
export async function rateLimit(scope: string, limit: number, windowMs: number) {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "local";
  const key = `${scope}:${ip}`.slice(0, 190);
  try {
    const res = await db.execute(sql`
      insert into rate_limits (key, count, reset_at)
      values (${key}, 1, now() + ${Math.max(1000, Math.floor(windowMs))} * interval '1 millisecond')
      on conflict (key) do update set
        count = case when rate_limits.reset_at < now() then 1 else rate_limits.count + 1 end,
        reset_at = case when rate_limits.reset_at < now() then excluded.reset_at else rate_limits.reset_at end
      returning count, reset_at
    `);
    const row = (res.rows as { count: number; reset_at: Date }[])[0];
    // редкая уборка, чтобы таблица не росла бесконечно
    if (Math.random() < 0.02) {
      db.execute(sql`delete from rate_limits where reset_at < now() - interval '1 day'`).catch(() => {});
    }
    return (row?.count ?? 1) <= limit;
  } catch (e) {
    // При сбое хранилища возвращаем отдельный статус для 503: не пропускаем запрос
    // мимо защиты от перебора, но и не называем отказ базы «слишком частыми попытками».
    console.error("[rate-limit]", e);
    return null;
  }
}

// ─────────── сессии ───────────
const tokenHash = (t: string) => createHash("sha256").update(t).digest("hex");

async function secureCookie() {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "";
  const host = h.get("host") ?? "";
  return proto === "https" || (process.env.NODE_ENV === "production" && !host.startsWith("localhost") && !host.startsWith("127.0.0.1"));
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
  const ua = ((await headers()).get("user-agent") ?? "").slice(0, 200);
  await db.insert(sessions).values({ id: tokenHash(token), userId, expiresAt: expires, userAgent: ua });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: await secureCookie(), path: "/", expires });
  // уборка просроченных
  db.delete(sessions).where(lt(sessions.expiresAt, new Date())).catch(() => {});
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.id, tokenHash(token))).catch(() => {});
  jar.delete(SESSION_COOKIE);
}

export async function destroyOtherSessions(userId: string) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const keep = token ? tokenHash(token) : "";
  await db.delete(sessions).where(and(eq(sessions.userId, userId), sql`${sessions.id} <> ${keep}`));
}

export async function currentUser(): Promise<(PublicUser & { passwordHash: string }) | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const rows = await db
    .select({ id: users.id, username: users.username, createdAt: users.createdAt, passwordHash: users.passwordHash, expiresAt: sessions.expiresAt })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, tokenHash(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  const r = rows[0];
  if (!r) return null;
  // продление скользящей сессии
  if (r.expiresAt.getTime() - Date.now() < (SESSION_DAYS / 2) * 864e5) {
    const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
    db.update(sessions).set({ expiresAt: expires }).where(eq(sessions.id, tokenHash(token))).catch(() => {});
  }
  return { id: r.id, username: r.username, createdAt: r.createdAt.toISOString(), passwordHash: r.passwordHash };
}

export const toPublic = (u: { id: string; username: string; createdAt: string | Date }): PublicUser => ({
  id: u.id,
  username: u.username,
  createdAt: typeof u.createdAt === "string" ? u.createdAt : u.createdAt.toISOString(),
});

/** Игровой профиль пользователя; при отсутствии создаётся */
export async function playerForUser(userId: string, name?: string): Promise<string> {
  const own = await db.select({ id: players.id }).from(players).where(eq(players.userId, userId)).limit(1);
  if (own[0]) return own[0].id;
  const id = `u-${randomUUID()}`;
  await db.insert(players).values({ id, userId, name: name ?? "Рыбак" });
  return id;
}

export const newUserId = () => `usr_${randomUUID().replace(/-/g, "")}`;

export type PlayerAccess = { ok: true; exists: true } | { ok: false; status: number; error: string };

/** Можно ли текущему запросу читать/писать данные игрока.
 *  Гостевого режима нет: профиль принадлежит аккаунту, и трогать его может только он. */
export async function checkPlayerAccess(playerId: string): Promise<PlayerAccess> {
  if (!/^[a-zA-Z0-9-]{8,64}$/.test(playerId)) return { ok: false, status: 400, error: "bad id" };
  const rows = await db.select({ userId: players.userId }).from(players).where(eq(players.id, playerId)).limit(1);
  const p = rows[0];
  if (!p || !p.userId) return { ok: false, status: 403, error: "forbidden" };
  const u = await currentUser();
  if (!u || u.id !== p.userId) return { ok: false, status: 401, error: "Требуется вход в аккаунт" };
  return { ok: true, exists: true };
}
