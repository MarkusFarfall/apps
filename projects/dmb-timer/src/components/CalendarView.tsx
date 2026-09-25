import { useEffect, useMemo, useRef, useState } from 'react';
import { NotebookPen } from 'lucide-react';
import type { Ctx } from '../lib/types';
import { DAY, dayKey, startOfDay } from '../lib/time';
import { num, fmtDate } from '../lib/format';
import { Card, Sheet } from './ui';
import { cn } from '../utils/cn';
import { buzz } from '../lib/hooks';

const WD = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export function CalendarView({ ctx, notes, setNotes }: { ctx: Ctx; notes: Record<string, string>; setNotes: (n: Record<string, string>) => void }) {
  const { s, e, now } = ctx;
  const todayRef = useRef<HTMLDivElement>(null);
  const [sel, setSel] = useState<number | null>(null);
  const todayStart = startOfDay(now);
  const dayKeyNow = Math.floor(now / DAY);

  const months = useMemo(() => {
    const out: { y: number; m: number }[] = [];
    const d = new Date(s);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    let guard = 0;
    while (d.getTime() <= e && guard < 80) {
      out.push({ y: d.getFullYear(), m: d.getMonth() });
      d.setMonth(d.getMonth() + 1);
      guard++;
    }
    return out;
  }, [s, e]);

  useEffect(() => {
    const t = setTimeout(() => todayRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 250);
    return () => clearTimeout(t);
  }, []);

  const sStart = startOfDay(s);
  const eStart = startOfDay(e);
  const totalDays = Math.round((eStart - sStart) / DAY) + 1;
  const crossed = Math.max(0, Math.min(totalDays, Math.round((todayStart - sStart) / DAY)));
  const noteCount = Object.values(notes).filter(Boolean).length;

  const grid = useMemo(
    () =>
      months.map(({ y, m }) => {
        const first = new Date(y, m, 1);
        const offset = (first.getDay() + 6) % 7;
        const daysIn = new Date(y, m + 1, 0).getDate();
        const cells: (number | null)[] = Array(offset).fill(null);
        for (let i = 1; i <= daysIn; i++) cells.push(new Date(y, m, i).getTime());
        return { y, m, cells, title: first.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }) };
      }),
    [months]
  );

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <div className="font-display text-3xl font-black">
              <span className="text-grad">{num(crossed)}</span>
              <span className="text-white/30"> / {num(totalDays)}</span>
            </div>
            <div className="text-sm text-white/50">дней вычеркнуто</div>
          </div>
          <div className="text-right">
            <div className="flex items-center justify-end gap-1.5 font-mono text-xl font-bold">
              <NotebookPen size={16} className="text-accent" /> {noteCount}
            </div>
            <div className="text-xs text-white/40">записей в дневнике</div>
          </div>
        </div>
        <p className="mt-3 text-xs text-white/40">Нажми на день, чтобы оставить запись в дембельском дневнике.</p>
      </Card>

      {grid.map((mo, mi) => (
        <Card key={`${mo.y}-${mo.m}`} delay={Math.min(mi, 6) * 40}>
          <div className="mb-3 font-display text-base font-bold capitalize">{mo.title}</div>
          <div className="grid grid-cols-7 gap-1.5 text-center">
            {WD.map((w) => (
              <div key={w} className="text-[10px] font-bold uppercase text-white/30">
                {w}
              </div>
            ))}
            {mo.cells.map((ts, i) => {
              if (ts === null) return <div key={i} />;
              const inRange = ts >= sStart && ts <= eStart;
              const isToday = ts === todayStart;
              const past = ts < todayStart;
              const hasNote = !!notes[dayKey(ts)];
              const isEnd = ts === eStart;
              const isStart = ts === sStart;
              return (
                <div
                  key={i}
                  ref={isToday ? todayRef : undefined}
                  onClick={() => {
                    if (!inRange) return;
                    buzz();
                    setSel(ts);
                  }}
                  className={cn(
                    'relative grid aspect-square place-items-center rounded-xl text-sm font-bold transition',
                    !inRange && 'text-white/15',
                    inRange && past && 'crossed bg-accent text-black/70',
                    inRange && !past && !isToday && 'cursor-pointer bg-white/5 text-white/80 hover:bg-white/10',
                    inRange && past && 'cursor-pointer',
                    isToday && 'pulse-ring cursor-pointer bg-white text-black',
                    isEnd && !past && 'bg-grad text-black'
                  )}
                >
                  {isEnd ? '🏁' : isStart && !past ? '🎖️' : new Date(ts).getDate()}
                  {hasNote && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-accent2 ring-1 ring-black/40" />}
                </div>
              );
            })}
          </div>
        </Card>
      ))}

      <DaySheet ctx={ctx} ts={sel} onClose={() => setSel(null)} notes={notes} setNotes={setNotes} key={sel ?? 0} tick={dayKeyNow} />
    </div>
  );
}

function DaySheet({
  ctx,
  ts,
  onClose,
  notes,
  setNotes,
}: {
  ctx: Ctx;
  ts: number | null;
  onClose: () => void;
  notes: Record<string, string>;
  setNotes: (n: Record<string, string>) => void;
  tick: number;
}) {
  const k = ts ? dayKey(ts) : '';
  const [text, setText] = useState(notes[k] ?? '');
  if (!ts) return null;
  const dayN = Math.round((ts - startOfDay(ctx.s)) / DAY) + 1;
  const leftD = Math.round((startOfDay(ctx.e) - ts) / DAY);
  const save = () => {
    const n = { ...notes };
    if (text.trim()) n[k] = text.trim();
    else delete n[k];
    setNotes(n);
    buzz([10, 40, 10]);
    onClose();
  };
  return (
    <Sheet open={!!ts} onClose={onClose} title={fmtDate(ts, false)}>
      <div className="mb-4 grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-white/5 p-3">
          <div className="font-mono text-2xl font-extrabold text-grad">{dayN}</div>
          <div className="text-[11px] font-bold uppercase text-white/40">день по счёту</div>
        </div>
        <div className="rounded-2xl bg-white/5 p-3">
          <div className="font-mono text-2xl font-extrabold">{leftD}</div>
          <div className="text-[11px] font-bold uppercase text-white/40">дней до конца</div>
        </div>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        placeholder="Что было в этот день? Наряд, письмо из дома, звонок, смешной случай…"
        className="w-full resize-none rounded-2xl border border-white/10 bg-white/5 p-4 text-sm outline-none focus:border-accent"
      />
      <button onClick={save} className="bg-grad mt-3 h-12 w-full rounded-2xl font-display font-bold text-black">
        Сохранить в дневник
      </button>
    </Sheet>
  );
}
