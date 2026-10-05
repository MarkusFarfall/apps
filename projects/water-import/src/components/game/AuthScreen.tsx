"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AuthScene, type AuthSceneHandle } from "./AuthScene";
import { Field, PasswordField } from "./AuthFields";
import { authAudio } from "@/game/authAudio";
import { login, register, type AccountUser } from "@/game/persist";
import { passwordStrength, validatePassword, validateUsername } from "@/game/authValidation";

type Mode = "login" | "register";
type Stage = "intro" | "ready" | "leaving";
type AuthOutcome = { user: AccountUser; playerId: string; mode: Mode };

const TITLE = "Знакомая вода";

const subscribeAuthAudio = (notify: () => void) => authAudio.subscribe(() => notify());
const getSoundEnabled = () => authAudio.isEnabled;
const getSoundEnabledServer = () => true;
const getAudioRunning = () => authAudio.isRunning;
const getAudioRunningServer = () => false;
const subscribeConnectivity = (notify: () => void) => {
  window.addEventListener("online", notify);
  window.addEventListener("offline", notify);
  return () => {
    window.removeEventListener("online", notify);
    window.removeEventListener("offline", notify);
  };
};
const getIsOnline = () => typeof navigator === "undefined" || navigator.onLine;
const getIsOnlineServer = () => true;

interface AuthScreenProps {
  onReady: (user: AccountUser, playerId: string, mode: Mode) => void;
  /** Ошибка загрузки сессии/сервера из начальной проверки. */
  offline?: boolean;
}

export function AuthScreen({ onReady, offline = false }: AuthScreenProps) {
  const scene = useRef<AuthSceneHandle>(null);
  const panel = useRef<HTMLDivElement>(null);
  const userInput = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>('login');
  const [stage, setStage] = useState<Stage>('intro');
  const [f, setF] = useState({ username: '', password: '', password2: '' });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<AuthOutcome | null>(null);
  const isOnline = useSyncExternalStore(subscribeConnectivity, getIsOnline, getIsOnlineServer);
  const doneRef = useRef<AuthOutcome | null>(null);
  const lastNibble = useRef(0);
  const stageRef = useRef(stage);
  const connectionUnavailable = offline || !isOnline;

  /* ── звук ── */
  // useSyncExternalStore сохраняет одинаковый SSR-снимок и синхронизирует localStorage после гидрации.
  const soundOn = useSyncExternalStore(subscribeAuthAudio, getSoundEnabled, getSoundEnabledServer);
  const audioStarted = useSyncExternalStore(subscribeAuthAudio, getAudioRunning, getAudioRunningServer);
  /** играл ли звук в момент начала текущего жеста */
  const wasRunning = useRef(false);
  const introTapUsed = useRef(false);

  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);

  useEffect(() => {
    authAudio.reset();
    return () => authAudio.fadeOut();
  }, []);

  useEffect(() => {
    authAudio.setMode(mode === 'register' ? 1 : 0);
  }, [mode]);

  useEffect(() => {
    // Будим звук на каждом жесте, пока не заиграет: на телефонах «разрешающий» жест — это
    // pointerup / touchend / click, а не pointerdown.
    const gesture = (e: Event) => {
      if (e.type === 'pointerdown' || e.type === 'keydown') wasRunning.current = authAudio.isRunning;
      if (!authAudio.isRunning) authAudio.unlock();
    };
    const types = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'];
    types.forEach((t) => window.addEventListener(t, gesture, { capture: true, passive: true }));
    const key = (e: KeyboardEvent) => {
      if (stageRef.current !== 'intro') return;
      if (!(e.key === 'Enter' || e.key === ' ' || e.key === 'Escape')) return;
      if (wasRunning.current || !authAudio.isEnabled || introTapUsed.current) scene.current?.skipIntro();
      introTapUsed.current = true;
    };
    window.addEventListener('keydown', key);
    return () => {
      types.forEach((t) => window.removeEventListener(t, gesture, { capture: true }));
      window.removeEventListener('keydown', key);
    };
  }, []);

  /** Первый тап на заставке включает звук, второй — пропускает её */
  const allowSceneTap = () => {
    if (stageRef.current !== 'intro') return true;
    if (wasRunning.current || !authAudio.isEnabled || introTapUsed.current) return true;
    introTapUsed.current = true;
    return false;
  };

  const toggleSound = () => {
    if (soundOn && !wasRunning.current) return; // этот клик только что разбудил звук — не выключаем
    authAudio.setEnabled(!soundOn);
  };

  useEffect(() => {
    if (stage === 'ready') {
      const id = setTimeout(() => userInput.current?.focus({ preventScroll: true }), 900);
      return () => clearTimeout(id);
    }
  }, [stage]);



  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setF((p) => ({ ...p, [k]: v }));
    if (err) setErr(null);
    authAudio.key();
    const now = performance.now();
    if (now - lastNibble.current > 160) {
      lastNibble.current = now;
      scene.current?.nibble();
    }
  };

  const shake = () => {
    const el = panel.current;
    if (!el) return;
    el.classList.remove('zv-shake');
    void el.offsetWidth;
    el.classList.add('zv-shake');
  };

  const switchMode = (m: Mode) => {
    if (busy || done || m === mode) return;
    authAudio.switchTab(m === 'register');
    setMode(m);
    setErr(null);
    setF((p) => ({ ...p, password: '', password2: '' }));
  };

  const mismatched = mode === 'register' && f.password2.length > 0 && f.password !== f.password2;
  const strength = passwordStrength(f.password);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || done) return;
    const name = f.username.trim();
    let validationError: string | null = null;
    if (!name || !f.password) validationError = "Введите имя пользователя и пароль";
    else if (mode === "register") {
      validationError =
        validateUsername(name) ||
        validatePassword(f.password) ||
        (f.password !== f.password2 ? "Пароли не совпадают" : null);
    }
    if (!validationError && !isOnline) validationError = "Нет связи с сервером";
    if (validationError) {
      setErr(validationError);
      scene.current?.fail();
      authAudio.error();
      shake();
      return;
    }

    setErr(null);
    setBusy(true);
    authAudio.cast();
    scene.current?.bite();
    try {
      const response = mode === "login" ? await login(name, f.password) : await register(name, f.password);
      if (!response.ok) throw new Error(response.data.error || "Не удалось выполнить вход");
      const { user, playerId } = response.data;
      if (!user || typeof playerId !== "string" || !playerId) {
        throw new Error("Сервер вернул неполный ответ. Попробуйте ещё раз.");
      }
      const outcome: AuthOutcome = { user, playerId, mode };
      doneRef.current = outcome;
      setDone(outcome);
      authAudio.success();
      scene.current?.success();
      setTimeout(() => setStage("leaving"), 1500);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Сервер не ответил. Попробуйте ещё раз.");
      scene.current?.fail();
      authAudio.error();
      shake();
    } finally {
      setBusy(false);
    }
  };

  const showUi = stage !== 'intro';
  const leaving = stage === 'leaving';

  return (
    <div className="fixed inset-0 z-[70] overflow-hidden bg-[#03080e] text-[var(--color-ink)]">
      <AuthScene
        ref={scene}
        mode={mode}
        onIntroDone={() => setStage((s) => (s === 'intro' ? 'ready' : s))}
        onDiveDone={() => {
          const outcome = doneRef.current;
          if (outcome) onReady(outcome.user, outcome.playerId, outcome.mode);
        }}
        sfx={authAudio}
        onBeforeTap={allowSceneTap}
      />

      <SoundToggle on={soundOn} live={audioStarted} onClick={toggleSound} />

      {stage === 'intro' && soundOn && !audioStarted && (
        <div
          className="zv-fade-up pointer-events-none absolute left-1/2 top-[38%] z-20 flex -translate-x-1/2 items-center gap-3 whitespace-nowrap rounded-full border border-[var(--line-2)] bg-[rgba(4,10,18,0.55)] px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-[var(--brass-2)] backdrop-blur"
          style={{ animationDelay: '0.8s' }}
        >
          <span className="zv-eq">
            <span />
            <span />
            <span />
            <span />
          </span>
          Коснитесь экрана — включится звук
        </div>
      )}

      {/* бренд */}
      {showUi && (
        <div
          className={`pointer-events-none absolute left-0 right-0 top-0 px-6 pt-[max(1.25rem,env(safe-area-inset-top))] text-center min-[820px]:left-[clamp(2rem,5vw,5rem)] min-[820px]:right-auto min-[820px]:pt-[9vh] min-[820px]:text-left ${
            leaving ? 'zv-brand-out' : ''
          }`}
        >
          <div className="label-brass zv-fade-up" style={{ animationDelay: '0.05s' }}>
            Симулятор морской рыбалки
          </div>
          <h1 className="font-serif mt-2 text-[2.4rem] leading-[0.95] font-medium text-[#f1ead9] min-[820px]:text-[clamp(3.4rem,6.4vw,6.2rem)] zv-title-shadow">
            {TITLE.split('').map((ch, i) => (
              <span key={i} className="zv-letter" style={{ animationDelay: `${0.15 + i * 0.055}s` }}>
                {ch === ' ' ? '\u00A0' : ch}
              </span>
            ))}
          </h1>
          <div className="relative mt-3 hidden h-5 min-[820px]:block">
            <p
              className={`absolute left-0 text-sm muted transition-all duration-700 ${mode === 'login' ? 'opacity-100' : 'translate-y-2 opacity-0'}`}
            >
              Ночь у маяка · 12 акваторий · 301 вид рыб
            </p>
            <p
              className={`absolute left-0 text-sm muted transition-all duration-700 ${mode === 'register' ? 'opacity-100' : '-translate-y-2 opacity-0'}`}
            >
              Рассвет в бухте · ваш первый заброс впереди
            </p>
          </div>
          <div className="zv-rule-grow mt-5 hidden h-px w-40 bg-gradient-to-r from-[var(--brass)] to-transparent min-[820px]:block" />
        </div>
      )}

      {/* подсказка пропуска заставки */}
      {stage === 'intro' && (
        <button
          onClick={() => scene.current?.skipIntro()}
          className="zv-fade-up absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-[0.3em] text-[var(--muted)] transition-colors hover:text-[var(--brass-2)]"
          style={{ animationDelay: '1.2s' }}
        >
          <span className="pulse-soft">Нажмите, чтобы пропустить ›</span>
        </button>
      )}

      {/* панель */}
      {showUi && (
        <div
          className={`absolute inset-x-0 bottom-0 flex max-h-[62vh] min-[820px]:inset-x-auto min-[820px]:bottom-auto min-[820px]:right-[clamp(1rem,3vw,3rem)] min-[820px]:top-1/2 min-[820px]:max-h-[calc(100vh-2rem)] min-[820px]:w-[min(420px,40vw)] min-[820px]:-translate-y-1/2 ${
            leaving ? 'zv-panel-out' : 'zv-panel-in'
          }`}
        >
          <div ref={panel} className="sheet zv-sheet relative flex min-h-0 w-full flex-col overflow-hidden rounded-t-[14px] min-[820px]:rounded-[4px]">
            {/* световая кромка */}
            <div className="zv-edge pointer-events-none absolute inset-x-0 top-0 h-px" />
            {/* вкладки */}
            <div className="relative grid grid-cols-2 border-b border-[var(--line)] zv-stagger" style={{ ['--i' as string]: 0 }}>
              {(['login', 'register'] as Mode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => switchMode(m)}
                  disabled={busy || !!done}
                  className={`tab !py-4 text-center ${mode === m ? 'on' : ''}`}
                >
                  {m === 'login' ? 'Вход' : 'Регистрация'}
                </button>
              ))}
              <span
                className="absolute bottom-[-1px] h-px w-1/2 bg-[var(--brass)] shadow-[0_0_12px_var(--brass)] transition-transform duration-500 ease-[cubic-bezier(.2,.8,.2,1)]"
                style={{ transform: `translateX(${mode === 'login' ? 0 : 100}%)` }}
              />
            </div>

            <div className="zv-auth-content min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-9 sm:py-8">
              {done ? (
                <Caught user={done.user} isNew={done.mode === "register"} />
              ) : (
                <>
                  <div key={mode} className="zv-mode-in">
                    <p className="label-brass">{mode === 'login' ? 'Вход в аккаунт' : 'Новая учётная запись'}</p>
                    <h2 className="zv-auth-heading font-serif mt-1 text-[2rem] leading-tight text-[#f1ead9]">
                      {mode === 'login' ? 'С возвращением на воду' : 'Первый выход в море'}
                    </h2>
                  </div>

                  {connectionUnavailable && (
                    <p role="status" className="mt-4 border-l-2 border-[var(--color-bad)] bg-[rgba(201,115,92,0.08)] px-3 py-2 text-xs text-[var(--color-bad)]">
                      Не удалось связаться с сервером. Проверьте соединение и попробуйте ещё раз.
                    </p>
                  )}

                  <form onSubmit={submit} className="zv-auth-form mt-6 space-y-4" noValidate>
                    <div className="zv-stagger" style={{ ['--i' as string]: 1 }}>
                      <Field
                        ref={userInput}
                        label="Имя пользователя"
                        autoComplete="username"
                        value={f.username}
                        onChange={set('username')}
                        disabled={busy}
                        maxLength={24}
                        hint={mode === 'register' ? 'От 3 до 24 символов: буквы, цифры, точка, дефис' : undefined}
                      />
                    </div>
                    <div className="zv-stagger" style={{ ['--i' as string]: 2 }}>
                      <PasswordField
                        label="Пароль"
                        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                        value={f.password}
                        onChange={set('password')}
                        disabled={busy}
                        hint={mode === 'register' ? 'Не короче 8 символов, буквы и цифры' : undefined}
                      >
                        {mode === 'register' && (
                          <span className="mt-2 flex items-center gap-1.5" aria-hidden="true">
                            {[1, 2, 3].map((n) => (
                              <span
                                key={n}
                                className="h-[3px] flex-1 overflow-hidden rounded-full bg-[var(--line)]"
                              >
                                <span
                                  className="block h-full origin-left transition-transform duration-500"
                                  style={{
                                    transform: `scaleX(${strength >= n ? 1 : 0})`,
                                    background: strength === 1 ? 'var(--color-bad)' : strength === 2 ? 'var(--brass)' : 'var(--color-ok)',
                                  }}
                                />
                              </span>
                            ))}
                            <span className="ml-1 w-16 text-right text-[10px] uppercase tracking-[0.14em] dim">
                              {['', 'слабый', 'средний', 'крепкий'][strength]}
                            </span>
                          </span>
                        )}
                      </PasswordField>
                    </div>

                    <div
                      className={`grid transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(.2,.8,.2,1)] ${
                        mode === 'register' ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                      }`}
                    >
                      <div className="overflow-hidden">
                        <PasswordField
                          label="Повторите пароль"
                          autoComplete="new-password"
                          value={f.password2}
                          onChange={set('password2')}
                          disabled={busy || mode !== 'register'}
                          tabIndex={mode === 'register' ? 0 : -1}
                          hint={mismatched ? 'Пароли пока не совпадают' : 'Так же, как выше — чтобы не ошибиться'}
                          hintTone={mismatched ? 'bad' : f.password2 && !mismatched ? 'ok' : 'dim'}
                        />
                      </div>
                    </div>

                    {err && (
                      <p key={err} role="alert" className="zv-err border-l-2 border-[var(--color-bad)] pl-3 text-xs leading-relaxed text-[var(--color-bad)]">
                        {err}
                      </p>
                    )}

                    <div className="zv-stagger pt-1" style={{ ['--i' as string]: 3 }}>
                      <button type="submit" disabled={busy} className="btn btn-solid zv-cta relative h-12 w-full overflow-hidden !text-[12px]">
                        {busy ? (
                          <span className="flex items-center gap-3">
                            <Bobber />
                            Клюёт… подсекаем
                          </span>
                        ) : (
                          <span>{mode === 'login' ? 'Выйти в море' : 'Создать аккаунт'}</span>
                        )}
                      </button>
                    </div>
                  </form>

                  <p className="zv-stagger mt-5 text-center text-sm" style={{ ['--i' as string]: 4 }}>
                    <span className="muted">{mode === 'register' ? 'Уже есть аккаунт?' : 'Впервые на воде?'}</span>{' '}
                    <button
                      type="button"
                      onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
                      className="text-[var(--brass-2)] underline decoration-[rgba(200,164,106,0.4)] underline-offset-4 transition-colors hover:text-white"
                    >
                      {mode === 'register' ? 'Войти' : 'Зарегистрироваться'}
                    </button>
                  </p>

                  <p className="zv-stagger mt-4 text-[11px] leading-relaxed dim" style={{ ['--i' as string]: 5 }}>
                    Почты нет: вход по имени пользователя и паролю. Пароль можно посмотреть — глазок справа в поле.
                    Прогресс хранится в облаке и доступен с любого устройства.
                  </p>

                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SoundToggle({ on, live, onClick }: { on: boolean; live: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`iconbtn zv-sound-toggle zv-fade-up !absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-30 min-[820px]:right-6 min-[820px]:top-6 ${on ? 'on' : ''}`}
      style={{ animationDelay: '0.4s' }}
      aria-label={on ? 'Выключить звук' : 'Включить звук'}
      title={on ? 'Выключить звук' : 'Включить звук'}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
        {on ? (
          <>
            <path d="M15.5 9a4 4 0 0 1 0 6" />
            <path d="M18 6.5a7.5 7.5 0 0 1 0 11" />
          </>
        ) : (
          <path d="M16 9.5l5 5M21 9.5l-5 5" />
        )}
      </svg>
      <span className={`zv-eq ${on && live ? '' : 'off'}`} aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </span>
      <span className="hidden min-[820px]:inline">{on ? 'Звук' : 'Тишина'}</span>
    </button>
  );
}

function Bobber() {
  return (
    <svg width="12" height="22" viewBox="0 0 12 22" className="zv-bob" aria-hidden="true">
      <line x1="6" y1="0" x2="6" y2="6" stroke="#17110a" strokeWidth="1.2" />
      <path d="M1 12 A5 6 0 0 1 11 12 Z" fill="#a8322a" />
      <path d="M1 12 A5 7 0 0 0 11 12 Z" fill="#f4efe4" />
    </svg>
  );
}

function Caught({ user, isNew }: { user: AccountUser; isNew: boolean }) {
  return (
    <div className="flex flex-col items-center py-6 text-center">
      <svg width="120" height="64" viewBox="0 0 120 64" className="zv-caught-fish" aria-hidden="true">
        <path
          d="M14 32 C30 8, 76 6, 98 32 C76 58, 30 56, 14 32 Z M98 32 L114 16 Q108 32 114 48 Z"
          fill="none"
          stroke="#e3c996"
          strokeWidth="1.6"
          strokeLinejoin="round"
          className="zv-draw"
        />
        <circle cx="30" cy="28" r="2.2" fill="#e3c996" className="zv-pop" />
        <path d="M44 22 Q50 32 44 42" fill="none" stroke="#e3c996" strokeWidth="1.2" className="zv-draw" style={{ animationDelay: '.35s' }} />
      </svg>
      <p className="label-brass mt-5 zv-fade-up" style={{ animationDelay: '.3s' }}>
        Есть поклёвка!
      </p>
      <h2 className="font-serif mt-2 text-3xl text-[#f1ead9] zv-fade-up" style={{ animationDelay: '.45s' }}>
        {isNew ? 'Добро пожаловать' : 'С возвращением'}, {user.username}
      </h2>
      <p className="mt-3 text-sm muted zv-fade-up" style={{ animationDelay: '.6s' }}>
        {isNew ? 'Аккаунт создан. Готовим лодку…' : 'Подтягиваем сохранение из облака…'}
      </p>
      <div className="mt-6 h-px w-40 overflow-hidden bg-[var(--line)]">
        <div className="zv-load h-full bg-[var(--brass)]" />
      </div>
    </div>
  );
}
