import "server-only";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { catches, friendships, players, saves, users } from "@/db/schema";
import { isClean } from "@/lib/auth";
import { PORT_BY_ID, SPOT_BY_ID, WEATHER_INFO } from "@/game/world";
import {
  FRIEND_LIMIT, INCOMING_LIMIT, PENDING_OUT_LIMIT, SEARCH_RESULTS, isValidUserId, locOf, normalizeQuery, pairOf,
  type FriendCatch, type FriendProfile, type FriendRequestRow, type FriendSummary, type FriendWhere,
  type FriendsOverview, type SearchResult,
} from "@/game/friends";
import type { LocId, PortId, WeatherId } from "@/game/types";

/**
 * Всё, что система друзей делает с базой.
 *
 * Правила доступа:
 *  - список и заявки видит только сам владелец;
 *  - профиль и уловы друга — только принятая дружба (иначе 403);
 *  - снимок мира (локация, место, лодка, погода) не отдаётся, если игрок
 *    включил «скрыть местоположение»;
 *  - поиск выдаёт лишь то, что и так публично в рейтинге: имя, уровень, кодекс.
 */

const iso = (d: Date | string | null | undefined) => (d ? (typeof d === "string" ? d : d.toISOString()) : null);
const safeName = (n: string) => (isClean(n) ? n : "Рыбак");

/** Экранирование символов-джокеров: имя пользователя не должно работать как LIKE-запрос. */
const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

interface Row {
  status: string;
  requestedBy: string;
  createdAt: Date;
  acceptedAt: Date | null;
  userId: string;
  username: string;
  playerId: string | null;
  lastSeenAt: Date | null;
  hideLocation: boolean | null;
  level: number | null;
  codexCount: number | null;
  totalCaught: number | null;
  money: number | null;
  achievements: number | null;
  playSeconds: number | null;
  location: string | null;
  spot: string | null;
  port: string | null;
  atPort: boolean | null;
  weather: string | null;
  boat: number | null;
  gameDay: number | null;
  saveUpdatedAt: Date | null;
}

/** Общий SELECT: одна строка на связь, «второй» пользователь подставляется через CASE. */
const OTHER_JOIN = (me: string) =>
  sql`${users.id} = case when ${friendships.aUserId} = ${me} then ${friendships.bUserId} else ${friendships.aUserId} end`;

function whereOf(r: Row): FriendWhere | null {
  const hidden = !!r.hideLocation;
  // Скрывший местоположение должен выглядеть скрывшимся, даже если ещё ни разу не сохранялся:
  // иначе друг видел «ещё не выходил в море» вместо «скрыл местоположение».
  if (!r.location && !r.port && !hidden) return null;
  return {
    location: hidden ? null : (locOf(r.location)?.id as LocId | null) ?? null,
    locationName: hidden ? null : locOf(r.location)?.name ?? null,
    spotName: hidden ? null : spotName(r.spot),
    port: hidden ? null : ((r.port as PortId | null) ?? null),
    portName: hidden ? null : portName(r.port),
    atPort: !hidden && !!r.atPort,
    weather: hidden ? null : ((r.weather as WeatherId | null) ?? null),
    weatherName: hidden ? null : weatherName(r.weather),
    boat: hidden ? null : (typeof r.boat === "number" ? r.boat : null),
    gameDay: hidden ? null : (typeof r.gameDay === "number" ? r.gameDay : null),
    hidden,
    updatedAt: iso(r.saveUpdatedAt),
  };
}

// Названия берутся из справочников мира, а не из базы: в базе лежит только идентификатор.
const spotName = (id: string | null) => (id ? SPOT_BY_ID[id]?.name ?? null : null);
const portName = (id: string | null) => (id && id in PORT_BY_ID ? PORT_BY_ID[id as PortId].name : null);
const weatherName = (id: string | null) => (id && id in WEATHER_INFO ? WEATHER_INFO[id as WeatherId].name : null);

const toSummary = (r: Row): FriendSummary => ({
  userId: r.userId,
  username: safeName(r.username),
  level: r.level ?? 1,
  codexCount: r.codexCount ?? 0,
  totalCaught: r.totalCaught ?? 0,
  money: r.money ?? 0,
  achievements: r.achievements ?? 0,
  playSeconds: r.playSeconds ?? 0,
  lastSeenAt: iso(r.lastSeenAt),
  friendsSince: iso(r.acceptedAt),
  where: whereOf(r),
});

const toRequest = (r: Row, me: string): FriendRequestRow => ({
  userId: r.userId,
  username: safeName(r.username),
  level: r.level ?? 1,
  codexCount: r.codexCount ?? 0,
  createdAt: iso(r.createdAt) ?? new Date().toISOString(),
  direction: r.requestedBy === me ? "outgoing" : "incoming",
});

// ─────────── список ───────────

export async function friendsOverview(me: string): Promise<FriendsOverview> {
  const rows = await db
    .select({
      status: friendships.status,
      requestedBy: friendships.requestedBy,
      createdAt: friendships.createdAt,
      acceptedAt: friendships.acceptedAt,
      userId: users.id,
      username: users.username,
      playerId: players.id,
      lastSeenAt: players.lastSeenAt,
      hideLocation: players.hideLocation,
      level: saves.level,
      codexCount: saves.codexCount,
      totalCaught: saves.totalCaught,
      money: saves.money,
      achievements: saves.achievements,
      playSeconds: saves.playSeconds,
      location: saves.location,
      spot: saves.spot,
      port: saves.port,
      atPort: saves.atPort,
      weather: saves.weather,
      boat: saves.boat,
      gameDay: saves.gameDay,
      saveUpdatedAt: saves.updatedAt,
    })
    .from(friendships)
    .innerJoin(users, OTHER_JOIN(me))
    .leftJoin(players, eq(players.userId, users.id))
    .leftJoin(saves, eq(saves.playerId, players.id))
    .where(or(eq(friendships.aUserId, me), eq(friendships.bUserId, me)))
    .orderBy(desc(friendships.acceptedAt), friendships.updatedAt)
    .limit(400);

  const list = rows as unknown as Row[];
  const friends = list.filter((r) => r.status === "accepted").map(toSummary);
  const incoming = list.filter((r) => r.status === "pending" && r.requestedBy !== me).map((r) => toRequest(r, me));
  const outgoing = list.filter((r) => r.status === "pending" && r.requestedBy === me).map((r) => toRequest(r, me));

  const mine = await db.select({ hideLocation: players.hideLocation }).from(players).where(eq(players.userId, me)).limit(1);
  return {
    friends,
    incoming: incoming.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    outgoing,
    hideLocation: !!mine[0]?.hideLocation,
    limit: FRIEND_LIMIT,
  };
}

// ─────────── действия ───────────

export type FriendResult = { ok: true; message?: string } | { ok: false; status: number; error: string };

const findPair = async (me: string, other: string) => {
  const [a, b] = pairOf(me, other);
  const rows = await db
    .select({ id: friendships.id, status: friendships.status, requestedBy: friendships.requestedBy })
    .from(friendships)
    .where(and(eq(friendships.aUserId, a), eq(friendships.bUserId, b)))
    .limit(1);
  return rows[0] ?? null;
};

const countByStatus = async (me: string, status: string, asRequester?: boolean) => {
  const conds = [or(eq(friendships.aUserId, me), eq(friendships.bUserId, me)), eq(friendships.status, status)];
  if (asRequester === true) conds.push(eq(friendships.requestedBy, me));
  if (asRequester === false) conds.push(sql`${friendships.requestedBy} <> ${me}`);
  const r = await db.select({ n: sql<number>`count(*)::int` }).from(friendships).where(and(...conds));
  return r[0]?.n ?? 0;
};

/** Заявка в друзья по имени пользователя. Встречная заявка принимается сразу. */
export async function requestFriend(me: string, rawUsername: unknown): Promise<FriendResult> {
  const name = typeof rawUsername === "string" ? rawUsername.trim() : "";
  if (name.length < 3 || name.length > 24) return { ok: false, status: 400, error: "Имя пользователя — от 3 до 24 символов" };
  const target = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.usernameLower, name.toLowerCase()))
    .limit(1);
  if (!target[0]) return { ok: false, status: 404, error: "Игрок с таким именем не найден" };
  const other = target[0].id;
  if (other === me) return { ok: false, status: 400, error: "Себя добавить нельзя" };

  // У получателя тоже есть предел: иначе заявки с чужих аккаунтов заваливали ему список.
  const incoming = await countByStatus(other, "pending", false);
  if (incoming >= INCOMING_LIMIT) {
    return { ok: false, status: 409, error: "У игрока слишком много неотвеченных заявок — попробуйте позже" };
  }

  const existing = await findPair(me, other);
  if (existing) {
    if (existing.status === "accepted") return { ok: false, status: 409, error: "Вы уже друзья" };
    if (existing.requestedBy === me) return { ok: false, status: 409, error: "Заявка уже отправлена" };
    // Встречная заявка: принимать её вручную не заставляем.
    const accepted = await acceptPair(me, other, existing.id);
    return accepted.ok ? { ok: true, message: "Взаимно — вы теперь друзья" } : accepted;
  }

  const friends = await countByStatus(me, "accepted");
  if (friends >= FRIEND_LIMIT) return { ok: false, status: 409, error: `Предел: ${FRIEND_LIMIT} друзей` };
  const pending = await countByStatus(me, "pending", true);
  if (pending >= PENDING_OUT_LIMIT) return { ok: false, status: 409, error: `Слишком много неотвеченных заявок (${PENDING_OUT_LIMIT})` };

  const [a, b] = pairOf(me, other);
  await db
    .insert(friendships)
    .values({ aUserId: a, bUserId: b, requestedBy: me, status: "pending" })
    .onConflictDoNothing();
  return { ok: true, message: "Заявка отправлена" };
}

async function acceptPair(me: string, other: string, rowId: number): Promise<FriendResult> {
  const friends = await countByStatus(me, "accepted");
  if (friends >= FRIEND_LIMIT) return { ok: false, status: 409, error: `Предел: ${FRIEND_LIMIT} друзей` };
  const otherFriends = await countByStatus(other, "accepted");
  if (otherFriends >= FRIEND_LIMIT) return { ok: false, status: 409, error: "У этого игрока уже максимум друзей" };
  await db
    .update(friendships)
    .set({ status: "accepted", acceptedAt: sql`now()`, updatedAt: sql`now()` })
    .where(and(eq(friendships.id, rowId), or(eq(friendships.aUserId, me), eq(friendships.bUserId, me))));
  return { ok: true, message: "Заявка принята" };
}

/** Принять входящую заявку. */
export async function acceptFriend(me: string, otherId: unknown): Promise<FriendResult> {
  if (!isValidUserId(otherId)) return { ok: false, status: 400, error: "Неверный идентификатор" };
  const row = await findPair(me, otherId);
  if (!row) return { ok: false, status: 404, error: "Заявка не найдена" };
  if (row.status === "accepted") return { ok: false, status: 409, error: "Вы уже друзья" };
  if (row.requestedBy === me) return { ok: false, status: 400, error: "Это ваша заявка — ждём ответа" };
  return acceptPair(me, otherId, row.id);
}

/** Отклонить входящую, отозвать исходящую или удалить из друзей — строка убирается. */
export async function removeRelation(me: string, otherId: unknown): Promise<FriendResult> {
  if (!isValidUserId(otherId)) return { ok: false, status: 400, error: "Неверный идентификатор" };
  const [a, b] = pairOf(me, otherId);
  // Пара нормализована через pairOf, поэтому один из двух идентификаторов всегда «я».
  const res = await db
    .delete(friendships)
    .where(and(eq(friendships.aUserId, a), eq(friendships.bUserId, b)))
    .returning({ id: friendships.id });
  if (!res.length) return { ok: false, status: 404, error: "Связь не найдена" };
  return { ok: true };
}

/** Скрыть/показать своё местоположение от друзей. */
export async function setHideLocation(me: string, hide: boolean): Promise<FriendResult> {
  const res = await db.update(players).set({ hideLocation: hide }).where(eq(players.userId, me)).returning({ id: players.id });
  if (!res.length) {
    const p = await db.select({ id: players.id }).from(players).where(eq(players.userId, me)).limit(1);
    if (!p[0]) return { ok: false, status: 404, error: "Профиль не найден" };
  }
  return { ok: true };
}

/** Отклонить все входящие заявки разом. */
export async function clearIncoming(me: string): Promise<FriendResult> {
  const res = await db
    .delete(friendships)
    .where(and(
      or(eq(friendships.aUserId, me), eq(friendships.bUserId, me)),
      eq(friendships.status, "pending"),
      sql`${friendships.requestedBy} <> ${me}`,
    ))
    .returning({ id: friendships.id });
  return res.length ? { ok: true, message: `Отклонено заявок: ${res.length}` } : { ok: true };
}

// ─────────── поиск ───────────

export async function searchPlayers(me: string, rawQuery: unknown): Promise<SearchResult[]> {
  const q = normalizeQuery(rawQuery);
  if (!q) return [];
  const lower = likeEscape(q.toLowerCase());
  const exact = `${lower}`;
  const prefix = `${lower}%`;
  const any = `%${lower}%`;
  const rows = await db.execute(sql`
    select u.id as "userId", u.username,
           coalesce(s.level, 1)::int as level,
           coalesce(s.codex_count, 0)::int as "codexCount"
      from users u
      left join players p on p.user_id = u.id
      left join saves s on s.player_id = p.id
     where u.username_lower like ${prefix} or u.username_lower like ${any}
     order by case when u.username_lower = ${exact} then 0 when u.username_lower like ${prefix} then 1 else 2 end,
              coalesce(s.codex_count, 0) desc, u.username
     limit ${SEARCH_RESULTS}
  `);
  const found = (rows.rows as { userId: string; username: string; level: number; codexCount: number }[]).map((r) => ({
    ...r,
    username: safeName(r.username),
    relation: "none" as SearchResult["relation"],
  }));
  if (!found.length) return [];

  // Отношение к найденным: я / друзья / входящая / исходящая заявка.
  const ids = found.map((f) => f.userId);
  const rel = await db
    .select({ a: friendships.aUserId, b: friendships.bUserId, by: friendships.requestedBy, status: friendships.status })
    .from(friendships)
    .where(and(
      or(eq(friendships.aUserId, me), eq(friendships.bUserId, me)),
      or(inArray(friendships.aUserId, ids), inArray(friendships.bUserId, ids)),
    ));
  const map = new Map<string, SearchResult["relation"]>();
  for (const r of rel) {
    const other = r.a === me ? r.b : r.a;
    if (other === me) continue;
    map.set(other, r.status === "accepted" ? "friend" : r.by === me ? "outgoing" : "incoming");
  }
  return found.map((f) => ({ ...f, relation: f.userId === me ? "self" : map.get(f.userId) ?? "none" }));
}

// ─────────── профиль друга ───────────

export async function friendProfile(me: string, otherId: string): Promise<FriendProfile | { error: string; status: number }> {
  const row = await findPair(me, otherId);
  if (!row) return { error: "Профиль доступен только друзьям", status: 403 };
  if (row.status !== "accepted") return { error: "Профиль доступен только друзьям", status: 403 };

  const rows = await db
    .select({
      status: friendships.status,
      requestedBy: friendships.requestedBy,
      createdAt: friendships.createdAt,
      acceptedAt: friendships.acceptedAt,
      userId: users.id,
      username: users.username,
      accountSince: users.createdAt,
      playerId: players.id,
      lastSeenAt: players.lastSeenAt,
      hideLocation: players.hideLocation,
      level: saves.level,
      codexCount: saves.codexCount,
      totalCaught: saves.totalCaught,
      money: saves.money,
      achievements: saves.achievements,
      playSeconds: saves.playSeconds,
      location: saves.location,
      spot: saves.spot,
      port: saves.port,
      atPort: saves.atPort,
      weather: saves.weather,
      boat: saves.boat,
      gameDay: saves.gameDay,
      saveUpdatedAt: saves.updatedAt,
      data: saves.data,
    })
    .from(friendships)
    .innerJoin(users, OTHER_JOIN(me))
    .leftJoin(players, eq(players.userId, users.id))
    .leftJoin(saves, eq(saves.playerId, players.id))
    .where(and(or(eq(friendships.aUserId, me), eq(friendships.bUserId, me)), eq(users.id, otherId), eq(friendships.status, "accepted")))
    .limit(1);
  const r = rows[0] as unknown as (Row & { accountSince: Date; data: unknown }) | undefined;
  if (!r) return { error: "Профиль не найден", status: 404 };

  const base = toSummary(r);
  const data = (r.data ?? {}) as Record<string, unknown>;
  const stats = (data.stats ?? {}) as Record<string, unknown>;
  const biggestRaw = stats.biggest as { fishId?: string; weight?: number } | null;
  const boatsOwned = Array.isArray(data.boatsOwned) ? data.boatsOwned.length : 1;

  const playerId = r.playerId;
  let best: FriendCatch[] = [];
  let recent: FriendCatch[] = [];
  let favorite: FriendProfile["favoriteLocation"] = null;
  let recordsHeld = 0;
  if (playerId) {
    const mapCatch = (x: { fishId: string; weight: number; variant: string | null; locationId: string; gameDay: number; createdAt: Date }): FriendCatch => ({
      fishId: x.fishId, weight: Number(x.weight) || 0, variant: x.variant, locationId: x.locationId, gameDay: x.gameDay, createdAt: iso(x.createdAt) ?? "",
    });
    const b = await db
      .select({ fishId: catches.fishId, weight: catches.weight, variant: catches.variant, locationId: catches.locationId, gameDay: catches.gameDay, createdAt: catches.createdAt })
      .from(catches).where(eq(catches.playerId, playerId)).orderBy(desc(catches.weight), desc(catches.createdAt)).limit(5);
    best = b.map(mapCatch);
    const rc = await db
      .select({ fishId: catches.fishId, weight: catches.weight, variant: catches.variant, locationId: catches.locationId, gameDay: catches.gameDay, createdAt: catches.createdAt })
      .from(catches).where(eq(catches.playerId, playerId)).orderBy(desc(catches.createdAt), desc(catches.id)).limit(8);
    recent = rc.map(mapCatch);
    const fav = await db.execute(sql`
      select c.location_id as id, count(*)::int as n
        from catches c where c.player_id = ${playerId}
       group by c.location_id order by n desc, c.location_id limit 1
    `);
    const f = (fav.rows as { id: string; n: number }[])[0];
    if (f) favorite = { id: f.id, name: locOf(f.id)?.name ?? "Неизвестные воды", count: f.n };
    const rec = await db.execute(sql`
      select count(*)::int as n from (
        select distinct on (c.fish_id) c.fish_id, c.player_id
          from catches c order by c.fish_id, c.weight desc
      ) r where r.player_id = ${playerId}
    `);
    recordsHeld = (rec.rows as { n: number }[])[0]?.n ?? 0;
  }

  return {
    ...base,
    accountSince: iso(r.accountSince) ?? "",
    best,
    recent,
    favoriteLocation: r.hideLocation ? null : favorite,
    recordsHeld,
    boatsOwned: Math.max(1, Math.min(boatsOwned, 9)),
    ordersDone: Number.isFinite(Number(data.ordersDone)) ? Math.max(0, Math.min(99999, Number(data.ordersDone))) : 0,
    biggest: biggestRaw && typeof biggestRaw.fishId === "string" && Number.isFinite(Number(biggestRaw.weight))
      ? { fishId: biggestRaw.fishId, weight: Number(biggestRaw.weight) }
      : null,
  };
}
