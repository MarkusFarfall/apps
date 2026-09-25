import { useMemo, useState } from 'react';
import { CheckCircle2, Clock } from 'lucide-react';
import type { Ctx } from '../lib/types';
import { calc, countDaily, countWeekday, monthsBetween, DAY, HOUR, MIN, WEEK, SEC, parseLocal, toLocalInput } from '../lib/time';
import { num, fmtDate, fmtDur, plural, W } from '../lib/format';
import { labels, rankOf } from '../lib/data';
import { Card, SectionTitle } from './ui';
import { inputCls } from './ProfileForm';
import { cn } from '../utils/cn';

function UnitsTable({ ctx }: { ctx: Ctx }) {
  const c = calc(ctx.s, ctx.e, ctx.now);
  const L = labels(ctx.profile.mode);
  const mp = monthsBetween(ctx.s, Math.min(ctx.now, ctx.e));
  const ml = monthsBetween(Math.max(ctx.now, ctx.s), ctx.e);
  const rows = [
    { u: 'Месяцев', a: mp.months, b: ml.months },
    { u: 'Недель', a: c.passed / WEEK, b: c.left / WEEK },
    { u: 'Дней', a: c.passed / DAY, b: c.left / DAY },
    { u: 'Часов', a: c.passed / HOUR, b: c.left / HOUR },
    { u: 'Минут', a: c.passed / MIN, b: c.left / MIN },
    { u: 'Секунд', a: c.passed / SEC, b: c.left / SEC },
  ];
  return (
    <Card>
      <SectionTitle>В цифрах</SectionTitle>
      <div className="grid grid-cols-[auto_1fr_1fr] gap-x-3 gap-y-2.5 text-sm">
        <div />
        <div className="text-right text-[11px] font-bold uppercase tracking-wider text-accent">{L.passed}</div>
        <div className="text-right text-[11px] font-bold uppercase tracking-wider text-white/50">{L.left}</div>
        {rows.map((r) => (
          <div key={r.u} className="contents">
            <div className="font-semibold text-white/60">{r.u}</div>
            <div className="text-right font-mono font-bold tabular">{num(r.a)}</div>
            <div className="text-right font-mono font-bold tabular text-white/80">{num(r.b)}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function FunStats({ ctx }: { ctx: Ctx }) {
  const minuteKey = Math.floor(ctx.now / MIN);
  const data = useMemo(() => {
    const from = Math.max(ctx.now, ctx.s);
    const to = ctx.e;
    const pFrom = ctx.s;
    const pTo = Math.min(ctx.now, ctx.e);
    const left = Math.max(0, to - from);
    const breakfasts = countDaily(from, to, 7);
    const lunches = countDaily(from, to, 13, 30);
    const dinners = countDaily(from, to, 19);
    const eaten = countDaily(pFrom, pTo, 7) + countDaily(pFrom, pTo, 13, 30) + countDaily(pFrom, pTo, 19);
    return ctx.profile.mode === 'serve'
      ? [
          { i: '🍳', t: 'Завтраков', v: breakfasts },
          { i: '🍲', t: 'Обедов', v: lunches },
          { i: '🍽️', t: 'Ужинов', v: dinners },
          { i: '⏰', t: 'Подъёмов', v: countDaily(from, to, 6) },
          { i: '🌙', t: 'Отбоев', v: countDaily(from, to, 22) },
          { i: '🧹', t: 'ПХД (суббот)', v: countWeekday(from, to, 6) },
          { i: '😴', t: 'Воскресений', v: countWeekday(from, to, 0) },
          { i: '😩', t: 'Понедельников', v: countWeekday(from, to, 1) },
          { i: '🪒', t: 'Бритьё', v: Math.ceil(left / DAY) },
          { i: '🪡', t: 'Подшив воротничка', v: Math.ceil(left / DAY) },
          { i: '🥣', t: 'Уже съедено в столовой', v: eaten, passed: true },
          { i: '❤️', t: 'Ударов сердца', v: (left / MIN) * 72 },
        ]
      : [
          { i: '🌅', t: 'Утр без него', v: countDaily(from, to, 8) },
          { i: '🌙', t: 'Вечеров', v: countDaily(from, to, 21) },
          { i: '📞', t: 'Воскресных звонков', v: countWeekday(from, to, 0) },
          { i: '💌', t: 'Писем (если раз в неделю)', v: Math.ceil(left / WEEK) },
          { i: '🗓️', t: 'Выходных', v: countWeekday(from, to, 6) + countWeekday(from, to, 0) },
          { i: '😩', t: 'Понедельников', v: countWeekday(from, to, 1) },
          { i: '💪', t: 'Уже пройдено дней', v: (pTo - pFrom) / DAY, passed: true },
          { i: '❤️', t: 'Ударов сердца', v: (left / MIN) * 72 },
        ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minuteKey, ctx.s, ctx.e, ctx.profile.mode]);

  return (
    <Card delay={60}>
      <SectionTitle>{ctx.profile.mode === 'serve' ? 'Дембельская арифметика' : 'Арифметика ожидания'}</SectionTitle>
      <p className="-mt-1 mb-3 text-xs text-white/40">Сколько ещё осталось — с учётом текущего часа</p>
      <div className="grid grid-cols-2 gap-2">
        {data.map((d) => (
          <div key={d.t} className={cn('rounded-2xl p-3', d.passed ? 'bg-accent/10' : 'bg-white/5')}>
            <div className="flex items-center justify-between">
              <span className="text-xl">{d.i}</span>
              <span className={cn('font-mono text-lg font-extrabold tabular', d.passed && 'text-accent')}>{num(d.v)}</span>
            </div>
            <div className="mt-1 text-[11px] font-semibold leading-tight text-white/50">{d.t}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

const MILESTONES = [10, 20, 25, 100 / 3, 50, 200 / 3, 75, 80, 90, 95, 99, 99.9];

function Milestones({ ctx }: { ctx: Ctx }) {
  const T = ctx.e - ctx.s;
  return (
    <Card delay={120}>
      <SectionTitle>Когда будет X%</SectionTitle>
      <div className="space-y-1.5">
        {MILESTONES.map((m) => {
          const ts = ctx.s + (T * m) / 100;
          const done = ts <= ctx.now;
          return (
            <div key={m} className={cn('flex items-center gap-3 rounded-xl px-3 py-2', done ? 'bg-accent/10' : 'bg-white/[0.03]')}>
              <div className={cn('w-14 font-mono text-sm font-extrabold', done ? 'text-accent' : 'text-white')}>
                {Number.isInteger(m) ? m : m.toFixed(1)}%
              </div>
              <div className="flex-1 text-xs text-white/60">{fmtDate(ts)}</div>
              {done ? <CheckCircle2 size={16} className="text-accent" /> : <span className="font-mono text-[11px] font-bold text-white/50">{fmtDur(ts - ctx.now)}</span>}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function TimeMachine({ ctx }: { ctx: Ctx }) {
  const [v, setV] = useState(() => toLocalInput(ctx.now + 30 * DAY));
  const ts = parseLocal(v);
  const ok = !isNaN(ts);
  const c = calc(ctx.s, ctx.e, ok ? ts : ctx.now);
  const L = labels(ctx.profile.mode);
  const presets = [
    { l: 'Новый год', ts: new Date(new Date(ctx.now).getFullYear() + 1, 0, 1).getTime() },
    { l: '+1 неделя', ts: ctx.now + WEEK },
    { l: '+1 месяц', ts: ctx.now + 30 * DAY },
    { l: '+100 дней', ts: ctx.now + 100 * DAY },
  ];
  return (
    <Card delay={180}>
      <SectionTitle>
        <span className="flex items-center gap-1.5">
          <Clock size={12} /> Машина времени
        </span>
      </SectionTitle>
      <p className="-mt-1 mb-3 text-xs text-white/40">Выбери любой момент — узнаешь, как будет обстоять дело</p>
      <input type="datetime-local" value={v} onChange={(e) => setV(e.target.value)} className={inputCls} />
      <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto">
        {presets.map((p) => (
          <button key={p.l} onClick={() => setV(toLocalInput(p.ts))} className="shrink-0 rounded-full bg-white/5 px-3 py-1.5 text-xs font-bold text-white/70">
            {p.l}
          </button>
        ))}
      </div>
      {ok && (
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-white/5 p-3">
            <div className="font-mono text-xl font-extrabold text-grad">{(c.pct * 100).toFixed(1)}%</div>
            <div className="text-[10px] font-bold uppercase text-white/40">{L.passed}</div>
          </div>
          <div className="rounded-2xl bg-white/5 p-3">
            <div className="font-mono text-xl font-extrabold">{num(c.left / DAY)}</div>
            <div className="text-[10px] font-bold uppercase text-white/40">{plural(c.left / DAY, W.day)} ост.</div>
          </div>
          <div className="rounded-2xl bg-white/5 p-3">
            <div className="truncate font-display text-sm font-extrabold text-accent">{rankOf(c.pct, ctx.profile.mode).rank.name}</div>
            <div className="text-[10px] font-bold uppercase text-white/40">звание</div>
          </div>
        </div>
      )}
    </Card>
  );
}

export function Stats({ ctx }: { ctx: Ctx }) {
  return (
    <div className="space-y-4">
      <UnitsTable ctx={ctx} />
      <FunStats ctx={ctx} />
      <Milestones ctx={ctx} />
      <TimeMachine ctx={ctx} />
    </div>
  );
}
