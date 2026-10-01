import { currentUser, rateLimit } from "@/lib/auth";
import { dbError, fail, json } from "@/lib/http";
import { friendProfile } from "@/lib/friends";
import { isValidUserId } from "@/game/friends";

export const dynamic = "force-dynamic";

/**
 * Профиль друга: статистика, снимок мира (локация, место, порт, погода, лодка),
 * лучшие и последние уловы, излюбленная акватория, число мировых рекордов.
 * Отдаётся только принятым друзьям — иначе 403.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ userId: string }> }) {
  const limited = await rateLimit("friend-profile", 120, 60_000);
  if (limited === null) return fail("Сервер временно недоступен", 503);
  if (!limited) return fail("Слишком часто: подождите минуту", 429);
  try {
    const me = await currentUser();
    if (!me) return fail("Требуется вход в аккаунт", 401);
    const { userId } = await ctx.params;
    if (!isValidUserId(userId)) return fail("Неверный идентификатор", 400);
    const p = await friendProfile(me.id, userId);
    if ("error" in p) return fail(p.error, p.status);
    return json({ profile: p });
  } catch (e) {
    return dbError(e);
  }
}
