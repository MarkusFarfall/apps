import { currentUser, rateLimit } from "@/lib/auth";
import { dbError, fail, json } from "@/lib/http";
import { searchPlayers } from "@/lib/friends";
import { normalizeQuery } from "@/game/friends";

export const dynamic = "force-dynamic";

/**
 * Поиск игроков, чтобы добавить в друзья.
 *
 * Отдаёт только то, что и так видно в рейтинге: имя, уровень, число видов в
 * кодексе и отношение к текущему игроку (друг / заявка входящая или исходящая /
 * это вы). Местоположение и уловы в поиске не раскрываются.
 */
export async function GET(req: Request) {
  const limited = await rateLimit("user-search", 30, 60_000);
  if (limited === null) return fail("Сервер временно недоступен", 503);
  if (!limited) return fail("Слишком часто: подождите минуту", 429);
  try {
    const me = await currentUser();
    if (!me) return fail("Требуется вход в аккаунт", 401);
    const q = new URL(req.url).searchParams.get("q") ?? "";
    if (!normalizeQuery(q)) return json({ results: [], hint: "Минимум 2 символа: буквы, цифры, точка, дефис, подчёркивание" });
    return json({ results: await searchPlayers(me.id, q) });
  } catch (e) {
    return dbError(e);
  }
}
