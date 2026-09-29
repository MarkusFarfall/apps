"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { changePassword, deleteAccount, login, register, type AccountStats, type AccountUser } from "@/game/persist";
import { Icon } from "./Icons";
import { fmt } from "./Panels";

export interface AccountState {
  user: AccountUser | null;
  stats: AccountStats | null;
  offline: boolean;
}

function Field({ label, hint, ...p }: { label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="label mb-1.5 block">{label}</span>
      <input {...p} className="field !text-left" />
      {hint && <span className="mt-1 block text-[11px] dim">{hint}</span>}
    </label>
  );
}

function Shell({ children, onClose, label, title }: { children: ReactNode; onClose: () => void; label: string; title: string }) {
  return (
    <div className="fade-in absolute inset-0 z-[60] flex items-stretch justify-center bg-[#02050a]/78 backdrop-blur-[3px] sm:items-center sm:p-4" onPointerDown={(e) => e.stopPropagation()}>
      <div className="sheet reveal safe-pad flex h-full max-h-[100dvh] w-full max-w-[460px] flex-col overflow-y-auto !rounded-none sm:h-auto sm:max-h-[94vh] sm:!rounded-[3px]">
        <div className="flex items-end justify-between px-6 pt-6 sm:px-8 sm:pt-7">
          <div>
            <div className="label-brass">{label}</div>
            <h2 className="font-serif mt-1 text-[30px] font-medium leading-none text-[#f1ebdd]">{title}</h2>
          </div>
          <button onClick={onClose} className="iconbtn" aria-label="Закрыть"><Icon name="close" size={16} /></button>
        </div>
        <div className="rule mx-6 mt-5 sm:mx-8" />
        <div className="px-6 pb-7 pt-5 sm:px-8">{children}</div>
      </div>
    </div>
  );
}

export function AuthModal({ onClose, onAuthed, guestId, guestHasProgress, initial = "login" }: {
  onClose: () => void;
  onAuthed: (user: AccountUser, playerId: string, mode: "login" | "register") => void;
  guestId: string;
  guestHasProgress: boolean;
  initial?: "login" | "register";
}) {
  const [mode, setMode] = useState<"login" | "register">(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({ login: "", username: "", email: "", password: "", password2: "" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (mode === "register" && f.password !== f.password2) return setErr("Пароли не совпадают");
    setBusy(true);
    const r = mode === "login" ? await login(f.login, f.password) : await register(f.username, f.email, f.password, guestId);
    setBusy(false);
    if (!r.ok || !r.data.user) return setErr(r.data.error ?? "Не удалось выполнить запрос");
    onAuthed(r.data.user, r.data.playerId, mode);
  };

  return (
    <Shell onClose={onClose} label="Учётная запись" title={mode === "login" ? "Вход" : "Регистрация"}>
      <div className="seg mb-6 w-full">
        <button type="button" className={`flex-1 ${mode === "login" ? "on" : ""}`} onClick={() => { setMode("login"); setErr(null); }}>Вход</button>
        <button type="button" className={`flex-1 ${mode === "register" ? "on" : ""}`} onClick={() => { setMode("register"); setErr(null); }}>Регистрация</button>
      </div>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {mode === "login" ? (
          <>
            <Field label="Имя пользователя или почта" autoComplete="username" value={f.login} onChange={set("login")} autoFocus />
            <Field label="Пароль" type="password" autoComplete="current-password" value={f.password} onChange={set("password")} />
          </>
        ) : (
          <>
            <Field label="Имя пользователя" autoComplete="username" value={f.username} onChange={set("username")} hint="От 3 до 24 символов: буквы, цифры, точка, дефис" autoFocus />
            <Field label="Почта · необязательно" type="email" autoComplete="email" value={f.email} onChange={set("email")} hint="Для входа по почте" />
            <Field label="Пароль" type="password" autoComplete="new-password" value={f.password} onChange={set("password")} hint="Не короче 8 символов, буквы и цифры" />
            <Field label="Повторите пароль" type="password" autoComplete="new-password" value={f.password2} onChange={set("password2")} />
            {guestHasProgress && (
              <div className="flex gap-3 border-l-2 border-[var(--brass)] bg-[var(--brass-soft)] px-3 py-2.5 text-[12px] leading-relaxed text-[#e6dcc4]">
                Текущий гостевой прогресс будет перенесён в новую учётную запись.
              </div>
            )}
          </>
        )}
        {err && <div className="border-l-2 border-[var(--color-bad)] bg-[rgba(201,115,92,0.08)] px-3 py-2 text-[12px] text-[#f0c8bc]">{err}</div>}
        <button type="submit" className="btn btn-solid h-11 w-full" disabled={busy}>{busy ? "Подождите…" : mode === "login" ? "Войти" : "Создать учётную запись"}</button>
        {mode === "login" && guestHasProgress && (
          <p className="text-[11px] leading-relaxed dim">После входа загрузится прогресс учётной записи. Гостевое сохранение останется на этом устройстве.</p>
        )}
      </form>
    </Shell>
  );
}

export function ProfileModal({ account, onClose, onLogout, onDeleted, sync }: { account: AccountState; onClose: () => void; onLogout: () => void; onDeleted: () => void; sync: string }) {
  const u = account.user!;
  const [view, setView] = useState<"main" | "password" | "delete">("main");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pw, setPw] = useState({ current: "", next: "", next2: "", del: "" });
  const st = account.stats;
  const since = new Date(u.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });

  const doPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (pw.next !== pw.next2) return setMsg({ ok: false, text: "Пароли не совпадают" });
    setBusy(true);
    const r = await changePassword(pw.current, pw.next);
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.data.error ?? "Ошибка" });
    setMsg({ ok: true, text: "Пароль изменён. Остальные устройства вышли из аккаунта." });
    setPw({ current: "", next: "", next2: "", del: "" });
    setView("main");
  };
  const doDelete = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = await deleteAccount(pw.del);
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.data.error ?? "Ошибка" });
    onDeleted();
  };

  return (
    <Shell onClose={onClose} label="Учётная запись" title={u.username}>
      <dl className="text-[13px]">
        {[
          ["Почта", u.email ?? "не указана"],
          ["С нами с", since],
          ["Уровень", st ? String(st.level) : "—"],
          ["Видов в кодексе", st ? String(st.codexCount) : "—"],
          ["Поймано рыб", st ? fmt(st.totalCaught) : "—"],
          ["Синхронизация", sync],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between border-b border-[var(--line)] py-2"><dt className="muted">{k}</dt><dd className="text-[#ece6d8]">{v}</dd></div>
        ))}
      </dl>
      {msg && <div className={`mt-4 border-l-2 px-3 py-2 text-[12px] ${msg.ok ? "border-[var(--color-ok)] text-[#cfe3d4]" : "border-[var(--color-bad)] text-[#f0c8bc]"}`}>{msg.text}</div>}

      {view === "main" && (
        <div className="mt-6 grid gap-2">
          <button className="btn btn-quiet w-full" onClick={() => { setMsg(null); setView("password"); }}>Сменить пароль</button>
          <button className="btn w-full" onClick={onLogout}>Выйти</button>
          <button className="mt-3 text-[11px] text-[var(--color-bad)] opacity-70 hover:opacity-100" onClick={() => { setMsg(null); setView("delete"); }}>Удалить учётную запись</button>
        </div>
      )}
      {view === "password" && (
        <form onSubmit={doPassword} className="mt-6 space-y-4">
          <Field label="Текущий пароль" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
          <Field label="Новый пароль" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} hint="Не короче 8 символов, буквы и цифры" />
          <Field label="Повторите новый пароль" type="password" autoComplete="new-password" value={pw.next2} onChange={(e) => setPw({ ...pw, next2: e.target.value })} />
          <div className="flex gap-2">
            <button type="button" className="btn btn-quiet flex-1" onClick={() => setView("main")}>Назад</button>
            <button type="submit" className="btn btn-solid flex-1" disabled={busy}>Сохранить</button>
          </div>
        </form>
      )}
      {view === "delete" && (
        <form onSubmit={doDelete} className="mt-6 space-y-4">
          <p className="text-[12px] leading-relaxed text-[#f0c8bc]">Учётная запись, сохранение и все уловы в рейтинге будут удалены безвозвратно.</p>
          <Field label="Пароль для подтверждения" type="password" autoComplete="current-password" value={pw.del} onChange={(e) => setPw({ ...pw, del: e.target.value })} />
          <div className="flex gap-2">
            <button type="button" className="btn btn-quiet flex-1" onClick={() => setView("main")}>Отмена</button>
            <button type="submit" className="btn btn-danger flex-1" disabled={busy || !pw.del}>Удалить</button>
          </div>
        </form>
      )}
    </Shell>
  );
}

/** Компактная плашка аккаунта */
export function AccountBadge({ account, onClick, compact }: { account: AccountState; onClick: () => void; compact?: boolean }) {
  const u = account.user;
  return (
    <button onClick={onClick} className={`iconbtn ${u ? "on" : ""}`} title={u ? `Учётная запись: ${u.username}` : "Войти"}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg>
      {!compact && <span className="max-w-[110px] truncate normal-case tracking-normal">{u ? u.username : "Войти"}</span>}
      {account.offline && <span className="dot !bg-[var(--color-bad)] !shadow-none" />}
    </button>
  );
}
