import { db } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const t0 = Date.now();
  try {
    await db.execute(sql`select 1`);
    return Response.json({ ok: true, db: "up", latencyMs: Date.now() - t0 }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false, db: "down" }, { status: 500 });
  }
}
