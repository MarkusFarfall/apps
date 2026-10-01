import { migrateSave } from "./engine";
import type { FriendAction, FriendProfile, FriendsOverview, SearchResult } from "./friends";
import type { CaughtFish, SaveData } from "./types";

/** Локальный кэш сохранений: ключ — профиль игрока из аккаунта. Гостевого режима нет. */
const saveKey = (pid: string) => `zv_save:${pid}`;
const rememberedAccountKey = "zv_last_account:v1";

export interface AccountUser {
  id: string;
  username: string;
  createdAt: string;
}

interface RememberedAccount {
  playerId: string;
  user: AccountUser;
}

/** Только идентификатор профиля и имя — никаких паролей или токенов. Нужен для офлайн-старта. */
export function rememberAccount(playerId: string, user: AccountUser) {
  try {
    localStorage.setItem(rememberedAccountKey, JSON.stringify({ playerId, user } satisfies RememberedAccount));
  } catch {
    /* local storage недоступен */
  }
}

export function loadRememberedAccount(): RememberedAccount | null {
  try {
    const raw = localStorage.getItem(rememberedAccountKey);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<RememberedAccount>;
    const user = value.user;
    if (
      typeof value.playerId !== "string" || !/^[a-zA-Z0-9-]{8,64}$/.test(value.playerId) ||
      !user || typeof user.id !== "string" || typeof user.username !== "string" ||
      typeof user.createdAt !== "string" || user.username.length > 24
    ) return null;
    return { playerId: value.playerId, user };
  } catch {
    return null;
  }
}

export function forgetRememberedAccount() {
  try {
    localStorage.removeItem(rememberedAccountKey);
  } catch {
    /* local storage недоступен */
  }
}

export interface AccountStats {
  level: number;
  codexCount: number;
  totalCaught: number;
  playSeconds: number;
  updatedAt: string;
}

export function loadLocal(pid: string): SaveData | null {
  try {
    const raw = localStorage.getItem(saveKey(pid));
    return raw ? migrateSave(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function saveLocal(pid: string, s: SaveData) {
  try {
    localStorage.setItem(saveKey(pid), JSON.stringify(s));
  } catch {
    /* квота */
  }
}

export function clearLocal(pid: string) {
  localStorage.removeItem(saveKey(pid));
}

async function req<T>(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: T & { error?: string } }> {
  try {
    const r = await fetch(url, { cache: "no-store", credentials: "same-origin", ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
    const data = (await r.json().catch(() => ({}))) as T & { error?: string };
    return { ok: r.ok, status: r.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: "Нет связи с сервером" } as T & { error?: string } };
  }
}

/** undefined — сервер недоступен, null — сохранения нет */
export async function loadRemote(pid: string): Promise<SaveData | null | undefined> {
  const r = await req<{ save: unknown }>(`/api/save?playerId=${encodeURIComponent(pid)}`);
  if (!r.ok) return undefined;
  return r.data.save ? migrateSave(r.data.save) : null;
}

export type SaveResult = { ok: true } | { ok: false; conflict?: SaveData; offline?: boolean; unauthorized?: boolean };

export async function saveRemote(pid: string, s: SaveData, force = false): Promise<SaveResult> {
  const r = await req<{ conflict?: boolean; save?: unknown }>("/api/save", { method: "PUT", body: JSON.stringify({ playerId: pid, name: s.name, data: s, force }), keepalive: true });
  if (r.ok) return { ok: true };
  if (r.status === 409 && r.data.save) return { ok: false, conflict: migrateSave(r.data.save) ?? undefined };
  if (r.status === 401 || r.status === 403) return { ok: false, unauthorized: true };
  return { ok: false, offline: true };
}

export async function deleteRemote(pid: string) {
  await req(`/api/save?playerId=${encodeURIComponent(pid)}`, { method: "DELETE" });
}

export function logCatch(pid: string, c: CaughtFish) {
  void req("/api/catches", { method: "POST", body: JSON.stringify({ playerId: pid, fishId: c.fishId, weight: c.weight, variant: c.variant, locationId: c.loc, gameDay: c.day }) });
}

export function pickNewest(a: SaveData | null | undefined, b: SaveData | null | undefined): SaveData | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return (a.stats.playSeconds ?? 0) >= (b.stats.playSeconds ?? 0) ? a : b;
}

// ─────────── аккаунт ───────────
export async function fetchMe() {
  const r = await req<{ user: AccountUser | null; playerId?: string; stats?: AccountStats | null }>("/api/auth/me");
  if (!r.ok) return { offline: true as const };
  return { user: r.data.user, playerId: r.data.playerId ?? null, stats: r.data.stats ?? null };
}

export async function register(username: string, password: string) {
  return req<{ user: AccountUser; playerId: string }>("/api/auth/register", { method: "POST", body: JSON.stringify({ username, password }) });
}

export async function login(loginName: string, password: string) {
  return req<{ user: AccountUser; playerId: string }>("/api/auth/login", { method: "POST", body: JSON.stringify({ login: loginName, password }) });
}

export async function logout() {
  return req("/api/auth/logout", { method: "POST" });
}

export async function changePassword(current: string, next: string) {
  return req("/api/auth/password", { method: "POST", body: JSON.stringify({ current, next }) });
}

export async function deleteAccount(password: string) {
  return req("/api/auth/me", { method: "DELETE", body: JSON.stringify({ password }) });
}

// ─────────── друзья ───────────
/** Список друзей, заявки и настройка приватности. `null` — сервер недоступен. */
export async function fetchFriends(): Promise<FriendsOverview | null> {
  const r = await req<FriendsOverview>("/api/friends");
  return r.ok ? r.data : null;
}

/** Одно действие: заявка, принять, отклонить, отозвать, удалить, приватность. */
export async function friendAction(action: FriendAction, payload: { username?: string; userId?: string; hideLocation?: boolean } = {}) {
  return req<{ ok?: boolean; message?: string }>("/api/friends", { method: "POST", body: JSON.stringify({ action, ...payload }) });
}

/** Профиль друга: статистика, снимок мира, уловы, рекорды. */
export async function fetchFriendProfile(userId: string) {
  return req<{ profile?: FriendProfile }>(`/api/friends/${encodeURIComponent(userId)}`);
}

/** Поиск игроков по имени — только то, что и так видно в рейтинге. */
export async function searchPlayers(q: string) {
  return req<{ results?: SearchResult[]; hint?: string }>(`/api/users?q=${encodeURIComponent(q)}`);
}
