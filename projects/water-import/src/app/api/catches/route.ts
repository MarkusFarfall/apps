import { sql } from "drizzle-orm";
import { db } from "@/db";
import { catches, players } from "@/db/schema";
import { FISH_BY_ID } from "@/game/fish";
import { checkPlayerAccess, isClean, rateLimit } from "@/lib/auth";
import { body, dbError, fail, json, sameOrigin } from "@/lib/http";

export const dynamic = "force-dynamic";
const LOCS = new Set(["bay", "estuary", "cape", "skerries", "fjord", "kelp", "reef", "mangrove", "ocean", "volcano", "abyss", "antarctic"]);

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail("forbidden", 403);
  const limited = await rateLimit("catch", 40, 60_000);
  if (limited === null) return fail("Сервер временно недоступен", 503);
  if (!limited) return fail("slow down", 429);
  const b = await body<{ playerId?: string; fishId?: string; weight?: number; variant?: string | null; locationId?: string; gameDay?: number }>(req);
  if (!b?.playerId || !b.fishId || typeof b.weight !== "number" || !b.locationId) return fail("bad payload");
  const f = FISH_BY_ID[b.fishId];
  // вес не может превышать максимум вида (с запасом на трофеи)
  if (!f || !LOCS.has(b.locationId) || !(b.weight > 0) || b.weight > f.weight[1] * 1.05) return fail("bad catch");
  try {
    const acc = await checkPlayerAccess(b.playerId);
    if (!acc.ok) return fail(acc.error, acc.status);
    await db.insert(players).values({ id: b.playerId }).onConflictDoNothing();
    await db.insert(catches).values({
      playerId: b.playerId,
      fishId: f.id,
      weight: b.weight,
      variant: b.variant ? String(b.variant).slice(0, 24) : null,
      locationId: b.locationId,
      gameDay: Math.max(1, Math.floor(b.gameDay ?? 1)),
    });
    return json({ ok: true });
  } catch (e) {
    return dbError(e);
  }
}

// Мировые рекорды веса по каждому виду
export async function GET() {
  try {
    const rows = await db.execute(sql`
      select distinct on (c.fish_id) c.fish_id as "fishId", c.weight, c.variant, p.name, (p.user_id is not null) as "verified"
      from ${catches} c join ${players} p on p.id = c.player_id
      order by c.fish_id, c.weight desc
    `);
    const records = (rows.rows as { name: string }[]).map((r) => ({ ...r, name: isClean(r.name) ? r.name : "Рыбак" }));
    return json({ records });
  } catch {
    return json({ records: [] }, 503);
  }
}
