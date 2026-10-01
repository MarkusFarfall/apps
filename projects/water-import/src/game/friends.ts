import { BOATS, DAYS_PER_SEASON, LOC_BY_ID, PORT_BY_ID, SEASONS, SPOT_BY_ID, WEATHER_INFO } from "./world";
import type { BoatDef, LocId, PortId, WeatherId } from "./types";

/**
 * Друзья: общие типы и чистая логика.
 *
 * Модуль намеренно не содержит ни запросов к базе, ни `server-only` — его
 * импортируют и клиентские компоненты, и API-маршруты, и тесты. Всё, что
 * работает с базой, живёт в `src/lib/friends.ts`.
 */

// ─────────── пределы и окна ───────────
export const FRIEND_LIMIT = 50;
export const PENDING_OUT_LIMIT = 20;
/** «В игре сейчас» — если профиль сохранялся не дольше этого окна назад. */
export const ONLINE_WINDOW_MS = 5 * 60_000;
export const SEARCH_MIN = 2;
export const SEARCH_RESULTS = 8;

export type FriendAction = "request" | "accept" | "decline" | "cancel" | "remove" | "privacy";

/** Последняя известная точка друга: снимок мира из таблицы saves. */
export interface FriendWhere {
  location: LocId | null;
  locationName: string | null;
  spotName: string | null;
  port: PortId | null;
  portName: string | null;
  atPort: boolean;
  weather: WeatherId | null;
  weatherName: string | null;
  boat: number | null;
  gameDay: number | null;
  /** Игрок сам скрыл, где он: показываем только факт, без деталей. */
  hidden: boolean;
  /** Когда снимок обновлён (последнее сохранение). */
  updatedAt: string | null;
}

export interface FriendSummary {
  userId: string;
  username: string;
  level: number;
  codexCount: number;
  totalCaught: number;
  money: number;
  achievements: number;
  playSeconds: number;
  lastSeenAt: string | null;
  /** С какого момента вы друзья. */
  friendsSince: string | null;
  where: FriendWhere | null;
}

export interface FriendRequestRow {
  userId: string;
  username: string;
  level: number;
  codexCount: number;
  createdAt: string;
  direction: "incoming" | "outgoing";
}

export interface FriendCatch {
  fishId: string;
  weight: number;
  variant: string | null;
  locationId: string;
  gameDay: number;
  createdAt: string;
}

export interface FriendProfile extends FriendSummary {
  accountSince: string;
  best: FriendCatch[];
  recent: FriendCatch[];
  favoriteLocation: { id: string; name: string; count: number } | null;
  /** Сколько мировых рекордов веса держит этот игрок. */
  recordsHeld: number;
  boatsOwned: number;
  ordersDone: number;
  biggest: { fishId: string; weight: number } | null;
}

export interface FriendsOverview {
  friends: FriendSummary[];
  incoming: FriendRequestRow[];
  outgoing: FriendRequestRow[];
  hideLocation: boolean;
  limit: number;
}

export interface SearchResult {
  userId: string;
  username: string;
  level: number;
  codexCount: number;
  relation: "none" | "self" | "friend" | "incoming" | "outgoing";
}

// ─────────── пары и идентификаторы ───────────

/**
 * Нормализованная пара: всегда в одном порядке, чтобы дружба была симметричной,
 * а уникальный индекс по паре не давал завести две строки на одних и тех же людей.
 */
export const pairOf = (a: string, b: string): [string, string] => (a < b ? [a, b] : [b, a]);

export const isValidUserId = (v: unknown): v is string => typeof v === "string" && /^usr_[a-f0-9]{32}$/.test(v);

/** Строка поиска: минимум `SEARCH_MIN` символа, только допустимые в именах. */
export function normalizeQuery(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const q = raw.normalize("NFKC").replace(/\s+/g, " ").trim();
  if (q.length < SEARCH_MIN || q.length > 24) return null;
  if (!/^[\p{L}\p{N}_.\- ]+$/u.test(q)) return null;
  return q;
}

// ─────────── справочники мира ───────────

export const boatOf = (i: number | null | undefined): BoatDef | null =>
  typeof i === "number" && Number.isInteger(i) && i >= 0 && i < BOATS.length ? BOATS[i] : null;

export const locOf = (id: string | null | undefined) =>
  typeof id === "string" && id in LOC_BY_ID ? LOC_BY_ID[id as LocId] : null;

export const spotOf = (id: string | null | undefined) => (typeof id === "string" ? SPOT_BY_ID[id] ?? null : null);

export const portOf = (id: string | null | undefined) =>
  typeof id === "string" && id in PORT_BY_ID ? PORT_BY_ID[id as PortId] : null;

export const weatherOf = (id: string | null | undefined) =>
  typeof id === "string" && id in WEATHER_INFO ? WEATHER_INFO[id as WeatherId] : null;

// ─────────── подписи ───────────

export const isOnline = (iso: string | null | undefined, now = Date.now()) =>
  !!iso && now - new Date(iso).getTime() < ONLINE_WINDOW_MS && now - new Date(iso).getTime() > -ONLINE_WINDOW_MS;

/** «в игре сейчас», «7 мин назад», «3 ч назад», «вчера», «12 мая». */
export function lastSeenLabel(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "не заходил";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "не заходил";
  const diff = now - t;
  if (diff < -60_000) return "только что";
  if (diff < 60_000) return "только что";
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins} мин назад`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "вчера";
  if (days < 7) return `${days} дн назад`;
  return new Date(t).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

export const playTimeLabel = (secs: number) => {
  const s = Math.max(0, Math.floor(secs || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h >= 1) return `${h} ч ${String(m).padStart(2, "0")} мин`;
  if (m >= 1) return `${m} мин`;
  return `${s} с`;
};

/** Игровой календарь: тот же расчёт, что в движке (`engine.season`, `engine.dayOfSeason`). */
export function dayLabel(gameDay: number | null | undefined): string | null {
  if (!gameDay || !Number.isFinite(gameDay) || gameDay < 1) return null;
  const day = Math.floor(gameDay);
  const season = SEASONS[Math.floor((day - 1) / DAYS_PER_SEASON) % 4];
  const ofSeason = ((day - 1) % DAYS_PER_SEASON) + 1;
  const year = Math.floor((day - 1) / (DAYS_PER_SEASON * 4)) + 1;
  // Неразрывные пробелы вокруг точек: при переносе строки точка не повиснет в её начале.
  return `${season}, день\u00A0${ofSeason}/7${year > 1 ? `\u00A0·\u00A0год\u00A0${year}` : ""}`;
}

export const initialsOf = (name: string) => {
  const clean = (name || "?").trim();
  if (!clean) return "?";
  const parts = clean.split(/[\s_.\-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return clean.slice(0, 2).toUpperCase();
};

/** Детерминированный оттенок аватара: у одного игрока он всегда один. */
export function avatarHue(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return h;
}

/** Одна строка о том, где друг: локация и место, либо порт, либо «скрыл». */
export function whereLabel(w: FriendWhere | null): string {
  if (!w) return "ещё не выходил в море";
  if (w.hidden) return "скрыл своё местоположение";
  if (w.atPort && w.portName) return `в порту · ${w.portName}`;
  const loc = w.locationName ?? "неизвестные воды";
  return w.spotName ? `${loc} · ${w.spotName}` : loc;
}
