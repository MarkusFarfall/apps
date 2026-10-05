import { useEffect, useRef, useState } from 'react';
import { TIER_INFO, effectChips, type DirectorMessage, type EventDirector, type Outcome } from '@/game/events';

const ITEM_NAMES: Record<string, string> = {
  star_stone: 'Звёздный камень',
  old_compass: 'Старинный компас',
};
const BAIT_NAMES: Record<string, string> = { glow: 'Светящаяся приманка' };

interface Toast {
  key: number;
  msg: DirectorMessage;
  at: number;
  first?: boolean;
}

/** Цветная плашка эффекта */
function Chip({ label, good }: { label: string; good: boolean }) {
  return (
    <span
      className={`num rounded-[2px] border px-1.5 py-[1px] text-[10px] ${good ? 'border-[rgba(134,180,148,0.35)] text-[var(--color-ok)]' : 'border-[rgba(201,115,92,0.35)] text-[var(--color-bad)]'}`}
    >
      {label}
    </span>
  );
}

export function rewardChips(o: Outcome) {
  const out: { label: string; good: boolean }[] = [];
  const r = o.reward;
  if (r?.money) out.push({ label: `${r.money > 0 ? '+' : '−'}${Math.abs(r.money)} ₽`, good: r.money > 0 });
  if (r?.xp) out.push({ label: `+${r.xp} опыта`, good: true });
  if (r?.item) out.push({ label: `Находка: ${ITEM_NAMES[r.item] ?? r.item}`, good: true });
  if (r?.bait) out.push({ label: `${BAIT_NAMES[r.bait.id] ?? r.bait.id} ×${r.bait.count}`, good: true });
  if (o.buff) out.push(...effectChips(o.buff.effects).map((c) => ({ ...c, label: `${o.buff!.label}: ${c.label}` })));
  return out;
}

/**
 * Лента событий: предвестия, начало (с эффектами и прогрессом), выбор в находках, исходы.
 * Подписывается на EventDirector; onCue — для звука.
 */
export function EventFeed({ director, onCue, onChoose, hidden, compact = false, land = false, port = false }: {
  director: EventDirector;
  onCue?: (m: DirectorMessage) => void;
  onChoose: (uid: number, choiceId: string) => void;
  hidden?: boolean;
  compact?: boolean;
  land?: boolean;
  port?: boolean;
}) {
  const [items, setItems] = useState<Toast[]>([]);
  const [, setTick] = useState(0);
  const key = useRef(1);
  const cue = useRef(onCue);
  useEffect(() => { cue.current = onCue; }, [onCue]);

  useEffect(
    () =>
      director.on((m) => {
        cue.current?.(m);
        const uid = m.live.uid;
        if (m.type === 'discover') {
          setItems((l) => l.map((t) => (t.msg.live.uid === uid && t.msg.type === 'start' ? { ...t, first: true, at: Date.now() } : t)));
          return;
        }
        if (m.type === 'end') {
          setItems((l) => l.filter((t) => !(t.msg.live.uid === uid && (t.msg.type === 'start' || t.msg.type === 'omen'))));
          if (!m.def.outro || m.live.choice) return;
        }
        if (m.type === 'start' || m.type === 'outcome') setItems((l) => l.filter((t) => !(t.msg.live.uid === uid && (t.msg.type === 'omen' || t.msg.type === 'start'))));
        const t: Toast = { key: key.current++, msg: m, at: Date.now() };
        setItems((l) => [t, ...l].slice(0, 4));
      }),
    [director],
  );

  useEffect(() => {
    const id = window.setInterval(() => {
      const now = Date.now();
      setTick((x) => x + 1);
      setItems((l) => {
        const next = l.filter((t) => {
          const pending = t.msg.type === 'start' && t.msg.def.choices && !t.msg.live.choice;
          const life = pending ? Number.POSITIVE_INFINITY : t.first ? 11000 : t.msg.type === 'outcome' ? 9000 : 7500;
          return now - t.at < life;
        });
        return next.length === l.length ? l : next;
      });
    }, 500);
    return () => window.clearInterval(id);
  }, []);

  const close = (k: number) => setItems((l) => l.filter((t) => t.key !== k));
  const active = director.activeList();

  return (
    <div
      className={`zv-feed pointer-events-none absolute z-30 flex flex-col gap-2 transition-opacity duration-500 left-3 right-3 top-[calc(max(0.75rem,env(safe-area-inset-top))+3.1rem)] min-[820px]:left-[clamp(2rem,5vw,5rem)] min-[820px]:right-auto min-[820px]:top-auto min-[820px]:bottom-8 min-[820px]:w-[340px] min-[820px]:flex-col-reverse ${
        hidden ? 'invisible pointer-events-none opacity-0' : 'visible opacity-100'
      }`}
      style={compact
        ? { top: "auto", bottom: `calc(env(safe-area-inset-bottom) + ${port || !land ? "13rem" : "5.5rem"})` }
        : port ? { top: "auto", bottom: "150px" } : undefined}
      aria-live="polite"
      aria-hidden={hidden || undefined}
    >
      {items.map((t) => {
        const { msg } = t;
        const def = msg.def;
        const tier = TIER_INFO[def.tier];
        const info = active.find((a) => a.live.uid === msg.live.uid);
        const pending = msg.type === 'start' && def.choices && !msg.live.choice;
        let label = tier.name;
        let title = def.name;
        let text = def.desc;
        let icon = def.icon;
        if (msg.type === 'omen') {
          label = 'Предзнаменование';
          title = 'Что-то назревает…';
          text = def.omen?.text ?? '';
          icon = '❔';
        } else if (msg.type === 'end') {
          label = 'Завершилось';
          text = def.outro ?? '';
        } else if (msg.type === 'outcome') {
          label = 'Исход';
          text = msg.outcome.text;
        }
        const chips = msg.type === 'start' ? effectChips(def.effects) : msg.type === 'outcome' ? rewardChips(msg.outcome) : [];
        const color = msg.type === 'omen' ? '#8fa3b8' : tier.color;
        return (
          <div
            key={t.key}
            className={`zv-toast pointer-events-auto relative overflow-hidden rounded-[3px] border border-[var(--line)] bg-[rgba(6,12,20,0.82)] pl-3 pr-8 py-2.5 backdrop-blur-md ${t.first ? 'zv-toast-first' : ''}`}
            style={{ borderLeft: `2px solid ${color}`, ['--tier' as string]: color }}
          >
            {t.first && <div className="zv-toast-shine pointer-events-none absolute inset-0" />}
            {!pending && <button onClick={() => close(t.key)} className="dim absolute right-1.5 top-1 px-1.5 text-base leading-none hover:text-white" aria-label="Скрыть">×</button>}
            <div className="flex items-start gap-2.5">
              <span className={`mt-0.5 text-xl leading-none ${msg.type === 'omen' ? 'pulse-soft' : ''}`}>{icon}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[9.5px] font-medium uppercase tracking-[0.2em]" style={{ color }}>
                  {t.first ? `Новое явление · ${tier.name}` : label}
                </p>
                <p className="font-serif text-[17px] leading-tight text-[#f1ead9]">{title}</p>
                {text && <p className="mt-0.5 text-[12px] leading-snug muted">{text}</p>}
                {chips.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {chips.map((c) => (
                      <Chip key={c.label} {...c} />
                    ))}
                  </div>
                )}
                {pending && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {def.choices!.map((ch) => (
                      <button key={ch.id} onClick={() => onChoose(msg.live.uid, ch.id)} className="btn btn-sm !h-auto !py-1.5 !normal-case !tracking-normal flex-col !items-start !gap-0 text-left">
                        <span className="text-[11px] font-semibold">{ch.label}</span>
                        {ch.hint && <span className="text-[9.5px] font-normal opacity-70">{ch.hint}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {msg.type === 'start' && info && (
              <div className="absolute inset-x-0 bottom-0 h-[2px] bg-[var(--line)]">
                <div className="h-full transition-[width] duration-500 ease-linear" style={{ width: `${(1 - info.p) * 100}%`, background: color }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
