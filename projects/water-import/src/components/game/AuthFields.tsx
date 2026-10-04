"use client";

import { forwardRef, useId, useState } from "react";

type P = { label: string; hint?: string; hintTone?: 'dim' | 'bad' | 'ok' } & React.InputHTMLAttributes<HTMLInputElement>;

const tone = (t?: P['hintTone']) => (t === 'bad' ? 'text-[var(--color-bad)]' : t === 'ok' ? 'text-[var(--color-ok)]' : 'dim');

/** Текстовое поле формы входа. */
export const Field = forwardRef<HTMLInputElement, P>(function Field({ label, hint, hintTone, ...p }, ref) {
  return (
    <label className="block">
      <span className="label mb-1.5 block">{label}</span>
      <input ref={ref} {...p} className="field !text-left" />
      {hint && <span className={`mt-1 block text-[11px] ${tone(hintTone)}`}>{hint}</span>}
    </label>
  );
});

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {off ? (
        <>
          <path d="M3 3l18 18" />
          <path d="M10.6 6.3A10 10 0 0 1 12 6.2c5 0 9 3.9 9 5.8 0 .9-.7 2-1.9 3.1" />
          <path d="M6.3 7.9C4.4 9.1 3 11 3 12c0 1.9 4 5.8 9 5.8 1.3 0 2.5-.3 3.6-.7" />
        </>
      ) : (
        <>
          <path d="M3 12c0-1.9 4-5.8 9-5.8s9 3.9 9 5.8-4 5.8-9 5.8S3 13.9 3 12Z" />
          <circle cx="12" cy="12" r="2.6" />
        </>
      )}
    </svg>
  );
}

/** Поле пароля: введённое можно посмотреть — нажмите на глазок. */
export function PasswordField({ label, hint, hintTone, children, ...p }: P & { children?: React.ReactNode }) {
  const [show, setShow] = useState(false);
  const id = useId();
  return (
    <div className="block">
      <label htmlFor={id} className="label mb-1.5 block">{label}</label>
      <span className="relative block">
        <input {...p} id={id} type={show ? "text" : "password"} className="field !text-left !pr-12" />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="dim absolute right-0 top-0 flex h-full w-11 cursor-pointer items-center justify-center transition-colors hover:text-[#ece6d8]"
          aria-label={show ? "Скрыть пароль" : "Показать пароль"}
          aria-pressed={show}
          title={show ? "Скрыть пароль" : "Показать пароль"}
        >
          <EyeIcon off={show} />
        </button>
      </span>
      {children}
      {hint && <span className={`mt-1 block text-[11px] ${tone(hintTone)}`}>{hint}</span>}
    </div>
  );
}
