import { useEffect, useMemo, useState } from 'react';
import { BellRing, Send, ShieldCheck } from 'lucide-react';
import type { Prefs, Profile } from '../lib/types';
import { SectionTitle, Toggle } from './ui';
import {
  currentSubscription,
  disablePush,
  enablePush,
  isIOS,
  isStandalone,
  pushSupported,
  sendTestPush,
  TZ_NAME,
} from '../lib/push';
import { EVERY_N_OPTIONS, scheduleFrom, upcoming } from '../lib/notify';
import { fmtShortDate } from '../lib/format';
import { cn } from '../utils/cn';

type State = 'loading' | 'unsupported' | 'ios' | 'denied' | 'off' | 'on';

export function NotifySettings({
  profile,
  prefs,
  setPrefs,
}: {
  profile: Profile;
  prefs: Prefs;
  setPrefs: (p: Prefs) => void;
}) {
  const [state, setState] = useState<State>('loading');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [tested, setTested] = useState<string | null>(null);

  const schedule = useMemo(() => scheduleFrom(profile, prefs, TZ_NAME), [profile, prefs]);

  const detect = async () => {
    if (!pushSupported()) return setState('unsupported');
    if (isIOS() && !isStandalone()) return setState('ios');
    if (Notification.permission === 'denied') return setState('denied');
    const sub = await currentSubscription();
    setState(sub ? 'on' : 'off');
    // подписки нет, а в настройках стоит «включено» — приводим в порядок
    if (!sub && prefs.push) setPrefs({ ...prefs, push: false });
  };

  useEffect(() => {
    void detect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.start, profile.end, profile.name]);

  const preview = useMemo(
    () => (state === 'on' && prefs.push ? upcoming(schedule, Date.now(), 3) : []),
    [state, prefs.push, schedule]
  );

  const turnOn = async () => {
    setBusy(true);
    setNote(null);
    const res = await enablePush(schedule);
    setBusy(false);
    if (res.ok) {
      setPrefs({ ...prefs, push: true });
      setState('on');
      setNote('Готово. Уведомления будут приходить, даже когда приложение закрыто.');
    } else if (res.reason === 'denied') {
      setState('denied');
      setNote('Браузер не дал разрешение. Разреши уведомления для этого сайта в настройках браузера.');
    } else if (res.reason === 'ios-install') {
      setState('ios');
    } else if (res.reason === 'unsupported') {
      setState('unsupported');
    } else {
      setNote(`Не получилось: ${res.message ?? 'ошибка подписки'}`);
    }
  };

  const turnOff = async () => {
    setBusy(true);
    await disablePush();
    setPrefs({ ...prefs, push: false });
    setState('off');
    setNote('Уведомления выключены, подписка удалена с сервера.');
    setBusy(false);
  };

  const test = async () => {
    setBusy(true);
    setTested(null);
    const res = await sendTestPush();
    setBusy(false);
    setTested(res.ok ? 'Отправлено — проверь шторку уведомлений.' : `Не вышло: ${res.message ?? 'ошибка'}`);
  };

  return (
    <div className="space-y-2">
      <SectionTitle>Уведомления</SectionTitle>

      {state === 'loading' && <div className="rounded-2xl bg-white/5 px-4 py-3 text-sm text-white/50">Проверяю поддержку…</div>}

      {state === 'unsupported' && (
        <div className="rounded-2xl bg-white/5 px-4 py-3 text-sm text-white/60">
          Этот браузер не умеет push-уведомления. Нужен HTTPS и современный браузер (Chrome, Edge, Firefox, Safari 16.4+).
        </div>
      )}

      {state === 'ios' && (
        <div className="rounded-2xl bg-accent/10 px-4 py-3 text-sm text-white/70">
          На iPhone уведомления работают только у приложения с экрана «Домой»: открой Safari → «Поделиться» → «На экран «Домой»»,
          запусти приложение оттуда и включи уведомления здесь.
        </div>
      )}

      {state === 'denied' && (
        <div className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-200">
          Уведомления запрещены в браузере. Открой настройки сайта (замок в адресной строке) → «Уведомления» → «Разрешить».
          <button onClick={() => void detect()} className="mt-2 block rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white">
            Проверить снова
          </button>
        </div>
      )}

      {(state === 'off' || state === 'on') && (
        <>
          <Toggle
            on={state === 'on' && prefs.push}
            onChange={(v) => void (v ? turnOn() : turnOff())}
            label={busy ? 'Секунду…' : 'Push-уведомления'}
            hint={state === 'on' && prefs.push ? 'Работают, пока приложение закрыто' : 'Медали, круглые даты и напоминания'}
          />

          {state === 'on' && prefs.push && (
            <>
              <Toggle
                on={prefs.pushAch}
                onChange={(v) => setPrefs({ ...prefs, pushAch: v })}
                label="Достижения и медали"
                hint="«Экватор», «100 дней в строю», «Неделя до ДМБ» и остальные"
              />

              <div className="rounded-2xl bg-white/5 px-4 py-3">
                <div className="text-sm font-semibold">Напоминать каждые</div>
                <div className="mt-0.5 text-xs text-white/45">Сколько дней службы позади — и небольшой отчёт</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {EVERY_N_OPTIONS.map((n) => (
                    <button
                      key={n}
                      onClick={() => setPrefs({ ...prefs, pushDays: n })}
                      className={cn(
                        'rounded-full px-3.5 py-1.5 text-xs font-bold transition',
                        prefs.pushDays === n ? 'bg-accent text-black' : 'bg-white/5 text-white/70 hover:bg-white/10'
                      )}
                    >
                      {n === 0 ? 'Выкл' : `${n} дн`}
                    </button>
                  ))}
                </div>
              </div>

              {preview.length > 0 && (
                <div className="rounded-2xl bg-white/5 px-4 py-3">
                  <div className="mb-2 text-xs font-bold uppercase tracking-wider text-white/45">Что придёт дальше</div>
                  <div className="space-y-2">
                    {preview.map((n) => (
                      <div key={n.key} className="flex items-start gap-2 text-sm">
                        <span className="mt-0.5 text-xs text-accent">{fmtShortDate(n.ts)}</span>
                        <span className="min-w-0 flex-1 truncate text-white/75">{n.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => void test()}
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white/5 py-3 text-sm font-bold disabled:opacity-50"
              >
                <Send size={16} /> {busy ? 'Отправляю…' : 'Проверить уведомление'}
              </button>
              {tested && <div className="px-1 text-xs text-white/60">{tested}</div>}
            </>
          )}
        </>
      )}

      {note && (
        <div className="flex items-start gap-2 rounded-2xl bg-white/5 px-4 py-3 text-xs text-white/60">
          <BellRing size={14} className="mt-0.5 shrink-0" /> {note}
        </div>
      )}

      {state === 'on' && prefs.push && (
        <div className="flex items-start gap-2 rounded-2xl bg-white/5 px-4 py-3 text-xs text-white/50">
          <ShieldCheck size={14} className="mt-0.5 shrink-0" />
          На сервер уходят только имя, даты службы и подписка твоего устройства — этого достаточно, чтобы отправить напоминание.
          Хранится в приватном хранилище Vercel, выключение уведомлений удаляет запись.
        </div>
      )}
    </div>
  );
}
