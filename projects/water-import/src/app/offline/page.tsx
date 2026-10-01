"use client";

/** Открывается из кэша, когда сети нет: игра доступна офлайн, а эта страница — для новых адресов. */
export default function OfflinePage() {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-5 px-8 text-center">
      <div className="label-brass">Знакомая вода</div>
      <h1 className="font-serif text-[34px] font-medium leading-tight text-[#f1ebdd]">Нет связи</h1>
      <p className="max-w-[380px] text-[13px] leading-relaxed muted">
        Если вы уже входили на этом устройстве, перезагрузите страницу — игра продолжится из локального сохранения.
        Первый вход требует сети; облачный прогресс синхронизируется после восстановления соединения.
      </p>
      <button onClick={() => location.reload()} className="btn btn-solid h-11 px-6">Попробовать снова</button>
    </main>
  );
}
