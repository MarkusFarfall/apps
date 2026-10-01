"use client";

import { useState, type FormEvent } from "react";
import { login, register, type AccountUser } from "@/game/persist";
import { AuthScene } from "./AuthScene";
import { Field, PasswordField } from "./AuthFields";

/**
 * Вход и регистрация. Гостевого режима нет: без аккаунта игра не начинается,
 * поэтому этот экран показывается сразу и закрыть его нельзя.
 */
export function AuthScreen({ onReady, offline = false }: { onReady: (user: AccountUser, playerId: string, mode: "login" | "register") => void; offline?: boolean }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<AccountUser | null>(null);
  const [f, setF] = useState({ username: "", password: "", password2: "" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((prev) => ({ ...prev, [k]: e.target.value }));

  const swap = (next: "login" | "register") => {
    if (busy || done || next === mode) return;
    setMode(next);
    setErr(null);
    setF((prev) => ({ ...prev, password: "", password2: "" }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (mode === "register") {
      if (f.password.length < 8) return setErr("Пароль — не короче 8 символов");
      if (f.password !== f.password2) return setErr("Пароли не совпадают");
    }
    setBusy(true);
    const r = mode === "login" ? await login(f.username, f.password) : await register(f.username, f.password);
    setBusy(false);
    if (!r.ok || !r.data.user) return setErr(r.data.error ?? "Не удалось выполнить запрос");
    setDone(r.data.user);
    // короткая пауза, чтобы человек увидел подтверждение, и только потом — титульный экран
    window.setTimeout(() => onReady(r.data.user, r.data.playerId, mode), 900);
  };

  const mismatched = mode === "register" && f.password2.length > 0 && f.password !== f.password2;

  return (
    <div className="fixed inset-0 z-[70] flex items-stretch justify-center overflow-hidden bg-[#02050a] sm:items-center sm:p-6">
      <div className="reveal relative flex h-full min-h-0 w-full max-w-[1000px] flex-col overflow-hidden border border-[var(--line-2)] bg-[#050c14] sm:h-auto sm:max-h-[94vh] sm:rounded-[4px] md:flex-row">
        {/* ── сцена ── */}
        <div className="auth-scene-panel relative w-full shrink-0 overflow-hidden md:w-[46%]">
          <AuthScene key={mode} mode={mode} />
          <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(3,7,12,0.85)_0%,rgba(3,7,12,0)_55%)]" />
          <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
            <div className="label-brass">Знакомая вода</div>
            <p className="font-serif mt-1 max-w-[320px] text-[19px] italic leading-snug text-[#ece3d0] sm:text-[21px]">
              {mode === "login" ? "С возвращением на воду. Лодка ждёт." : "Снасть собрана. Осталось отойти от берега."}
            </p>
          </div>
          {done && (
            <div className="fade-in absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#030711]/70 backdrop-blur-[2px]">
              <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
                <circle cx="32" cy="32" r="27" fill="none" stroke="#c8a35a" strokeWidth="1.5" opacity="0.45" />
                <path className="zv-check" d="M20 33l8.5 8.5L45 24" fill="none" stroke="#e8cf96" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div className="font-serif text-[22px] text-[#f4eee0]">Добро пожаловать, {done.username}</div>
              <div className="label">Выходим на воду</div>
            </div>
          )}
        </div>

        {/* ── форма ── */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-10 sm:py-10">
          <div className="label-brass">{mode === "login" ? "Вход в аккаунт" : "Новая учётная запись"}</div>
          <h1 className="font-serif mt-1.5 text-[32px] font-medium leading-none text-[#f1ebdd] sm:text-[38px]">
            {mode === "login" ? "Вход" : "Регистрация"}
          </h1>

          {offline && (
            <div role="status" className="mt-4 border-l-2 border-[var(--color-bad)] bg-[rgba(201,115,92,0.08)] px-3 py-2 text-[12px] leading-relaxed text-[#f0c8bc]">
              Нет связи. Войти или зарегистрироваться можно будет после восстановления соединения.
            </div>
          )}

          <div className="seg mt-5 w-full sm:mt-7" role="group" aria-label="Способ входа">
            <button type="button" className={`flex-1 ${mode === "login" ? "on" : ""}`} onClick={() => swap("login")} disabled={busy || !!done} aria-pressed={mode === "login"}>Вход</button>
            <button type="button" className={`flex-1 ${mode === "register" ? "on" : ""}`} onClick={() => swap("register")} disabled={busy || !!done} aria-pressed={mode === "register"}>Регистрация</button>
          </div>

          <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
            <Field
              label="Имя пользователя"
              autoComplete="username"
              value={f.username}
              onChange={set("username")}
              autoFocus
              disabled={busy || !!done}
              hint={mode === "register" ? "От 3 до 24 символов: буквы, цифры, точка, дефис" : undefined}
            />
            <PasswordField
              label="Пароль"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={f.password}
              onChange={set("password")}
              disabled={busy || !!done}
              hint={mode === "register" ? "Не короче 8 символов, буквы и цифры" : undefined}
            />
            {mode === "register" && (
              <PasswordField
                label="Повторите пароль"
                autoComplete="new-password"
                value={f.password2}
                onChange={set("password2")}
                disabled={busy || !!done}
                hint={mismatched ? "Пароли пока не совпадают" : "Так же, как выше — чтобы не ошибиться"}
              />
            )}

            {err && <div className="fade-in border-l-2 border-[var(--color-bad)] bg-[rgba(201,115,92,0.08)] px-3 py-2 text-[12px] text-[#f0c8bc]">{err}</div>}

            <button type="submit" className="btn btn-solid h-12 w-full" disabled={busy || !!done || !f.username || !f.password}>
              {busy ? "Подождите…" : mode === "login" ? "Войти" : "Создать учётную запись"}
            </button>
          </form>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 border-t border-[var(--line)] pt-4 text-center text-[12px]">
            <span className="muted">{mode === "register" ? "Уже есть аккаунт?" : "Впервые на воде?"}</span>
            <button
              type="button"
              className="font-medium text-[#e3c996] underline decoration-[#c8a46a]/50 underline-offset-4 hover:text-white disabled:opacity-40"
              onClick={() => swap(mode === "register" ? "login" : "register")}
              disabled={busy || !!done}
            >
              {mode === "register" ? "Вернуться ко входу" : "Создать аккаунт"}
            </button>
          </div>

          <p className="mt-4 text-[11px] leading-relaxed dim">
            Почты нет: вход по имени пользователя и паролю. Пароль можно посмотреть — глазок справа в поле.
            Прогресс хранится в облаке и доступен с любого устройства.
          </p>
        </div>
      </div>
    </div>
  );
}
