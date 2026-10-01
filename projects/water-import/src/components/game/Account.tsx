"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { changePassword, deleteAccount, type AccountStats, type AccountUser } from "@/game/persist";
import { Icon } from "./Icons";
import { fmt } from "./Panels";
import { Field, PasswordField } from "./AuthFields";

export interface AccountState {
  user: AccountUser | null;
  stats: AccountStats | null;
  offline: boolean;
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
          ["Имя пользователя", u.username],
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
          <button className="btn w-full justify-center gap-2" onClick={onLogout}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
              <path d="M10 17l-5-5 5-5" />
              <path d="M5 12h9" />
            </svg>
            Выйти из аккаунта
          </button>
          <button className="mt-3 text-[11px] text-[var(--color-bad)] opacity-70 hover:opacity-100" onClick={() => { setMsg(null); setView("delete"); }}>Удалить учётную запись</button>
        </div>
      )}
      {view === "password" && (
        <form onSubmit={doPassword} className="mt-6 space-y-4">
          <PasswordField label="Текущий пароль" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
          <PasswordField label="Новый пароль" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} hint="Не короче 8 символов, буквы и цифры" />
          <PasswordField label="Повторите новый пароль" autoComplete="new-password" value={pw.next2} onChange={(e) => setPw({ ...pw, next2: e.target.value })} />
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
