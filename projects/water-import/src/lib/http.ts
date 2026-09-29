import "server-only";

export const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
export const fail = (error: string, status = 400) => json({ error }, status);

export async function body<T = Record<string, unknown>>(req: Request): Promise<T | null> {
  try {
    const len = Number(req.headers.get("content-length") ?? 0);
    if (len > 600_000) return null;
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

/** Запросы, меняющие состояние, принимаем только со своего источника */
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    const o = new URL(origin).host;
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    return o === host;
  } catch {
    return false;
  }
}

export function dbError(e: unknown) {
  console.error("[db]", e);
  return fail("Сервер временно недоступен", 503);
}
