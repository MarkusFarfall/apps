import { useEffect, useMemo, useState } from 'react';
import confetti from 'canvas-confetti';
import { Timer, BarChart3, CalendarDays, Scissors, Medal, Settings as Gear, Share2, MonitorPlay } from 'lucide-react';
import type { Ctx, Prefs, Profile, Tab } from './lib/types';
import { useNow, useStored, setHaptics, buzz } from './lib/hooks';
import { parseLocal, calc } from './lib/time';
import { achievementsFor, labels, rankOf, THEMES } from './lib/data';
import { Onboarding } from './components/Onboarding';
import { Home } from './components/Home';
import { Stats } from './components/Stats';
import { CalendarView } from './components/CalendarView';
import { Tape } from './components/Tape';
import { Medals } from './components/Medals';
import { Board } from './components/Board';
import { ShareSheet } from './components/ShareSheet';
import { Settings } from './components/Settings';
import { cn } from './utils/cn';

const TABS: { id: Tab; label: string; icon: typeof Timer }[] = [
  { id: 'home', label: 'Таймер', icon: Timer },
  { id: 'stats', label: 'Стата', icon: BarChart3 },
  { id: 'calendar', label: 'Календарь', icon: CalendarDays },
  { id: 'tape', label: 'Сантиметр', icon: Scissors },
  { id: 'medals', label: 'Медали', icon: Medal },
];

const DEFAULT_PREFS: Prefs = { showMs: true, unitMode: 0, haptics: true };

function fire() {
  const cs = getComputedStyle(document.documentElement);
  const colors = [cs.getPropertyValue('--accent').trim(), cs.getPropertyValue('--accent2').trim(), '#ffffff'];
  const end = Date.now() + 1500;
  (function frame() {
    confetti({ particleCount: 4, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, colors });
    confetti({ particleCount: 4, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, colors });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}

export default function App() {
  const [profile, setProfile] = useStored<Profile | null>('dmb.profile', null);
  const [prefsRaw, setPrefs] = useStored<Prefs>('dmb.prefs', DEFAULT_PREFS);
  const [notes, setNotes] = useStored<Record<string, string>>('dmb.notes', {});
  const [seen, setSeen] = useStored<number>('dmb.seenMedals', -1);
  const [tab, setTab] = useState<Tab>('home');
  const [settings, setSettings] = useState(false);
  const [board, setBoard] = useState(false);
  const [share, setShare] = useState(false);
  const [toast, setToast] = useState<{ icon: string; title: string } | null>(null);
  const now = useNow(1000);
  const prefs = { ...DEFAULT_PREFS, ...prefsRaw };

  useEffect(() => setHaptics(prefs.haptics), [prefs.haptics]);

  const theme = profile?.theme ?? 'khaki';
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    const t = THEMES.find((x) => x.id === theme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t?.bg ?? '#0d100a');
  }, [theme]);

  const s = profile ? parseLocal(profile.start) : 0;
  const e = profile ? parseLocal(profile.end) : 0;
  const medals = useMemo(() => (profile ? achievementsFor(s, e) : []), [profile, s, e]);
  const gotCount = medals.filter((m) => m.ts <= now).length;

  // new medal detection
  useEffect(() => {
    if (!profile) return;
    if (seen === -1) {
      setSeen(gotCount);
      return;
    }
    if (gotCount > seen) {
      const m = medals[gotCount - 1];
      setToast({ icon: m.icon, title: m.title });
      buzz([20, 60, 20, 60, 40]);
      fire();
      setSeen(gotCount);
      const t = setTimeout(() => setToast(null), 4200);
      return () => clearTimeout(t);
    }
    if (gotCount < seen) setSeen(gotCount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gotCount, profile]);

  // celebrate done on open
  const done = profile ? now >= e : false;
  useEffect(() => {
    if (done) fire();
  }, [done]);

  // document title live
  useEffect(() => {
    if (!profile) return;
    const c = calc(s, e, now);
    const d = Math.floor(c.left / 86400000);
    document.title = c.done ? 'ДМБ! 🏆' : `${d} дн · ${(c.pct * 100).toFixed(2)}% — ДМБ Таймер`;
  }, [now, profile, s, e]);

  if (!profile) {
    return (
      <Onboarding
        onDone={(p) => {
          setSeen(-1);
          setProfile(p);
          setTimeout(fire, 200);
        }}
      />
    );
  }

  const ctx: Ctx = { profile, s, e, now };
  const L = labels(profile.mode);
  const c = calc(s, e, now);
  const { rank } = rankOf(c.pct, profile.mode);
  const hour = new Date(now).getHours();
  const greet = hour < 6 ? 'Доброй ночи' : hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер';

  return (
    <div className="camo-bg min-h-dvh">
      <header className="sticky top-0 z-30 safe-top">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 pb-3">
          <div className="bg-grad grid h-10 w-10 shrink-0 place-items-center rounded-xl font-display text-[11px] font-black text-black shadow-lg">ДМБ</div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[11px] font-semibold text-white/45">
              {greet}
              {profile.mode === 'serve' ? ',' : ' · ждём'}
            </div>
            <div className="truncate font-display text-sm font-bold">
              {profile.name || L.who} <span className="text-accent">· {rank.name}</span>
            </div>
          </div>
          <button
            onClick={() => {
              buzz();
              setBoard(true);
            }}
            className="glass grid h-10 w-10 place-items-center rounded-xl"
            aria-label="Табло"
          >
            <MonitorPlay size={18} />
          </button>
          <button
            onClick={() => {
              buzz();
              setShare(true);
            }}
            className="glass grid h-10 w-10 place-items-center rounded-xl"
            aria-label="Поделиться"
          >
            <Share2 size={18} />
          </button>
          <button
            onClick={() => {
              buzz();
              setSettings(true);
            }}
            className="glass grid h-10 w-10 place-items-center rounded-xl"
            aria-label="Настройки"
          >
            <Gear size={18} />
          </button>
        </div>
      </header>

      <main key={tab} className="mx-auto max-w-lg px-4 pb-32">
        {tab === 'home' && <Home ctx={ctx} prefs={prefs} setPrefs={setPrefs} openMedals={() => setTab('medals')} />}
        {tab === 'stats' && <Stats ctx={ctx} />}
        {tab === 'calendar' && <CalendarView ctx={ctx} notes={notes} setNotes={setNotes} />}
        {tab === 'tape' && <Tape ctx={ctx} />}
        {tab === 'medals' && <Medals ctx={ctx} />}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 px-3 safe-bottom">
        <div className="glass mx-auto mb-2 flex max-w-lg items-stretch justify-between rounded-[1.6rem] p-1.5">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => {
                  buzz(6);
                  setTab(t.id);
                  window.scrollTo({ top: 0 });
                }}
                className={cn(
                  'relative flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-2 text-[10px] font-bold transition-all',
                  active ? 'bg-accent/15 text-accent' : 'text-white/45'
                )}
              >
                <t.icon size={21} strokeWidth={active ? 2.5 : 2} />
                {t.label}
                {t.id === 'medals' && gotCount > 0 && (
                  <span className="absolute right-2 top-1 min-w-4 rounded-full bg-accent2 px-1 text-[9px] leading-4 text-black">{gotCount}</span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {toast && (
        <div className="pop-in fixed inset-x-0 top-4 z-[70] flex justify-center px-4 safe-top">
          <div className="glass glow flex items-center gap-3 rounded-2xl px-4 py-3" onClick={() => setToast(null)}>
            <span className="text-3xl">{toast.icon}</span>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-accent">Новая медаль!</div>
              <div className="font-display font-bold">{toast.title}</div>
            </div>
          </div>
        </div>
      )}

      {board && <Board ctx={ctx} onClose={() => setBoard(false)} />}
      <ShareSheet ctx={ctx} open={share} onClose={() => setShare(false)} />
      {settings && (
        <Settings
          open={settings}
          onClose={() => setSettings(false)}
          profile={profile}
          setProfile={setProfile}
          prefs={prefs}
          setPrefs={setPrefs}
          notes={notes}
          setNotes={setNotes}
          reset={() => {
            setSettings(false);
            setNotes({});
            setPrefs(DEFAULT_PREFS);
            setSeen(-1);
            setProfile(null);
            setTab('home');
          }}
        />
      )}
    </div>
  );
}
