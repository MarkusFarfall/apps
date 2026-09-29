import { destroySession } from "@/lib/auth";
import { fail, json, sameOrigin } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail("forbidden", 403);
  await destroySession();
  return json({ ok: true });
}
