import { currentUser, rateLimit } from "@/lib/auth";
import { body, dbError, fail, json, sameOrigin } from "@/lib/http";
import { acceptFriend, friendsOverview, removeRelation, requestFriend, setHideLocation } from "@/lib/friends";
import type { FriendAction } from "@/game/friends";

export const dynamic = "force-dynamic";

/** Друзья, входящие и исходящие заявки, настройка приватности. */
export async function GET() {
  try {
    const me = await currentUser();
    if (!me) return fail("Требуется вход в аккаунт", 401);
    return json(await friendsOverview(me.id));
  } catch (e) {
    return dbError(e);
  }
}

/**
 * Все действия с друзьями одним маршрутом:
 * `request` (по имени), `accept`, `decline`, `cancel`, `remove` (по идентификатору),
 * `privacy` (скрыть/показать своё местоположение).
 */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail("forbidden", 403);
  const limited = await rateLimit("friends", 40, 60_000);
  if (limited === null) return fail("Сервер временно недоступен", 503);
  if (!limited) return fail("Слишком часто: подождите минуту", 429);
  try {
    const me = await currentUser();
    if (!me) return fail("Требуется вход в аккаунт", 401);
    const b = await body<{ action?: string; username?: string; userId?: string; hideLocation?: boolean }>(req);
    if (!b) return fail("Некорректный запрос");
    const action = b.action as FriendAction | undefined;

    switch (action) {
      case "request": {
        const r = await requestFriend(me.id, b.username);
        return r.ok ? json({ ok: true, message: r.message }) : fail(r.error, r.status);
      }
      case "accept": {
        const r = await acceptFriend(me.id, b.userId);
        return r.ok ? json({ ok: true, message: r.message }) : fail(r.error, r.status);
      }
      case "decline":
      case "cancel":
      case "remove": {
        const r = await removeRelation(me.id, b.userId);
        return r.ok ? json({ ok: true }) : fail(r.error, r.status);
      }
      case "privacy": {
        const r = await setHideLocation(me.id, !!b.hideLocation);
        return r.ok ? json({ ok: true, hideLocation: !!b.hideLocation }) : fail(r.error, r.status);
      }
      default:
        return fail("Неизвестное действие");
    }
  } catch (e) {
    return dbError(e);
  }
}
