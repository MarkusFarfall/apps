import { desc, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { players, saves, users } from "@/db/schema";
import { isClean } from "@/lib/auth";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const scope = new URL(req.url).searchParams.get("scope") === "all" ? "all" : "accounts";
  try {
    const q = db
      .select({
        name: sql<string>`coalesce(${users.username}, ${players.name})`,
        codexCount: saves.codexCount,
        totalCaught: saves.totalCaught,
        money: saves.money,
        level: saves.level,
        achievements: saves.achievements,
        verified: sql<boolean>`${players.userId} is not null`,
      })
      .from(saves)
      .innerJoin(players, eq(players.id, saves.playerId))
      .leftJoin(users, eq(users.id, players.userId));
    const rows = await (scope === "accounts" ? q.where(isNotNull(players.userId)) : q)
      .orderBy(desc(saves.codexCount), desc(saves.level), desc(saves.totalCaught))
      .limit(25);
    return json({ leaders: rows.map((r) => ({ ...r, name: isClean(r.name) ? r.name : "Рыбак" })), scope });
  } catch {
    return json({ leaders: [] }, 503);
  }
}
