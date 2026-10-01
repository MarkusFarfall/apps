import { desc, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { players, saves, users } from "@/db/schema";
import { isClean } from "@/lib/auth";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Рейтинг: играют только аккаунты, поэтому список всегда по учётным записям. */
export async function GET() {
  try {
    const rows = await db
      .select({
        name: users.username,
        codexCount: saves.codexCount,
        totalCaught: saves.totalCaught,
        money: saves.money,
        level: saves.level,
        achievements: saves.achievements,
      })
      .from(saves)
      .innerJoin(players, eq(players.id, saves.playerId))
      .innerJoin(users, eq(users.id, players.userId))
      .where(isNotNull(players.userId))
      .orderBy(desc(saves.codexCount), desc(saves.level), desc(saves.totalCaught))
      .limit(25);
    return json({ leaders: rows.map((r) => ({ ...r, name: isClean(r.name) ? r.name : "Рыбак" })) });
  } catch {
    return json({ leaders: [] }, 503);
  }
}
