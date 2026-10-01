export const dynamic = "force-dynamic";

/**
 * Какая сборка сейчас в проде.
 *
 * Нужен, чтобы автоматические проверки не ходили по старому деплою: Vercel
 * выкладывает новую версию не мгновенно после пуша, а предыдущая тоже отвечает
 * «здоров». Сверяя коммит, шаг проверок дожидается именно своей сборки.
 */
export async function GET() {
  return Response.json(
    {
      commit: process.env.VERCEL_GIT_COMMIT_SHA ?? "local",
      env: process.env.VERCEL_ENV ?? "development",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
