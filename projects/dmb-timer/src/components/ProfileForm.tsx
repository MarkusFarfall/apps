import type { Profile } from '../lib/types';
import { THEMES } from '../lib/data';
import { addMonths, parseLocal, toLocalInput, DAY } from '../lib/time';
import { cn } from '../utils/cn';
import { buzz } from '../lib/hooks';
import { fmtDur } from '../lib/format';

const TERMS = [
  { label: '6 мес', m: 6 },
  { label: '1 год', m: 12 },
  { label: '1.5 года', m: 18 },
  { label: '2 года', m: 24 },
  { label: '3 года', m: 36 },
];

const inputCls =
  'w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-base font-semibold outline-none transition focus:border-accent focus:bg-white/[0.07]';

export function DatesFields({ p, set }: { p: Profile; set: (p: Profile) => void }) {
  const s = parseLocal(p.start);
  const e = parseLocal(p.end);
  const valid = !isNaN(s) && !isNaN(e) && e > s;
  return (
    <div className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-white/50">
          {p.mode === 'serve' ? 'Дата и время призыва' : 'Когда проводила'}
        </span>
        <input
          type="datetime-local"
          value={p.start}
          onChange={(ev) => {
            const ns = ev.target.value;
            const old = parseLocal(p.start);
            const diffMonths = Math.round((e - old) / (30.44 * DAY));
            const term = TERMS.find((t) => t.m === diffMonths);
            set({ ...p, start: ns, end: term && ns ? toLocalInput(addMonths(parseLocal(ns), term.m)) : p.end });
          }}
          className={inputCls}
        />
      </label>
      <div>
        <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-white/50">Срок службы</span>
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
          {TERMS.map((t) => {
            const active = !isNaN(s) && toLocalInput(addMonths(s, t.m)) === p.end;
            return (
              <button
                key={t.m}
                onClick={() => {
                  buzz();
                  if (!isNaN(s)) set({ ...p, end: toLocalInput(addMonths(s, t.m)) });
                }}
                className={cn(
                  'shrink-0 rounded-full px-4 py-2 text-sm font-bold transition',
                  active ? 'bg-accent text-black' : 'bg-white/5 text-white/70 hover:bg-white/10'
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>
      <label className="block">
        <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-white/50">
          {p.mode === 'serve' ? 'Дата и время дембеля' : 'Когда вернётся'}
        </span>
        <input type="datetime-local" value={p.end} onChange={(ev) => set({ ...p, end: ev.target.value })} className={inputCls} />
      </label>
      <div className={cn('rounded-2xl px-4 py-3 text-sm', valid ? 'bg-accent/10 text-accent' : 'bg-red-500/10 text-red-300')}>
        {valid ? <>Общий срок: <b>{fmtDur(e - s)}</b> ({Math.round((e - s) / 3600000).toLocaleString('ru-RU')} часов)</> : 'Дата окончания должна быть позже начала'}
      </div>
    </div>
  );
}

export function ThemePicker({ value, onChange }: { value: string; onChange: (id: Profile['theme']) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {THEMES.map((t) => (
        <button
          key={t.id}
          onClick={() => {
            buzz();
            onChange(t.id);
          }}
          className={cn(
            'relative overflow-hidden rounded-2xl border p-3 text-left transition',
            value === t.id ? 'border-white/60 scale-[1.02]' : 'border-white/10'
          )}
          style={{ background: t.bg }}
        >
          <div className="mb-2 flex gap-1">
            <span className="h-4 w-4 rounded-full" style={{ background: t.a }} />
            <span className="h-4 w-4 rounded-full" style={{ background: t.b }} />
          </div>
          <span className="text-xs font-bold text-white/90">{t.name}</span>
        </button>
      ))}
    </div>
  );
}

export { inputCls };
