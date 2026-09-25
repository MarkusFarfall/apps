import { Scissors } from 'lucide-react';
import type { Ctx } from '../lib/types';
import { calc, DAY } from '../lib/time';
import { fmtDate, fmtDur, num, plural, W } from '../lib/format';
import { Card, SectionTitle } from './ui';
import { cn } from '../utils/cn';

export function Tape({ ctx }: { ctx: Ctx }) {
  const c = calc(ctx.s, ctx.e, ctx.now);
  const leftDays = c.left / DAY;
  const cm = c.done ? 0 : Math.min(100, leftDays);
  const cutting = leftDays <= 100 && !c.done;
  const startCut = ctx.e - 100 * DAY;
  const whole = Math.floor(cm);
  const frac = cm - whole;
  const nextCutIn = cutting ? (frac > 0 ? frac : 1) * DAY : 0;

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle>Дембельский сантиметр</SectionTitle>
        <div className="flex items-end justify-between">
          <div>
            <div className="font-display text-5xl font-black tabular">
              <span className="text-grad">{cm.toFixed(2)}</span>
              <span className="ml-1 text-xl text-white/40">см</span>
            </div>
            <div className="text-sm text-white/50">осталось ленты</div>
          </div>
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-[#f2cf4a] text-black shadow-lg">
            <Scissors size={30} />
          </div>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-white/60">
          Армейская традиция: за 100 дней до дембеля берут портновский сантиметр и каждый день отрезают по одному делению. Здесь лента режется
          плавно — <b className="text-white">с учётом часов и минут</b>.
        </p>
        {!cutting && !c.done && (
          <div className="mt-4 rounded-2xl bg-accent/10 p-4 text-sm">
            <div className="font-bold text-accent">Сантиметр пока целый 📏</div>
            <div className="mt-1 text-white/70">
              Начнёшь резать через <b>{num(Math.ceil((startCut - ctx.now) / DAY))} {plural(Math.ceil((startCut - ctx.now) / DAY), W.day)}</b> — {fmtDate(startCut)}
            </div>
          </div>
        )}
        {cutting && (
          <div className="mt-4 rounded-2xl bg-accent/10 p-4 text-sm">
            <div className="font-bold text-accent">Режем! ✂️</div>
            <div className="mt-1 text-white/70">
              {whole + (frac > 0 ? 1 : 0)}-й сантиметр отвалится через <b className="font-mono">{fmtDur(nextCutIn)}</b>
            </div>
          </div>
        )}
      </Card>

      <Card delay={80} className="p-3 sm:p-4">
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, row) => (
            <div key={row} className="grid grid-cols-10 gap-[3px]">
              {Array.from({ length: 10 }).map((_, col) => {
                const n = row * 10 + col + 1;
                const fullyThere = n <= whole;
                const partial = n === whole + 1 && frac > 0;
                return (
                  <div
                    key={n}
                    className={cn(
                      'relative h-12 overflow-hidden rounded-[4px] transition-all duration-700',
                      !fullyThere && !partial && 'border border-dashed border-white/15 bg-transparent'
                    )}
                  >
                    {(fullyThere || partial) && (
                      <div className="tape absolute inset-y-0 left-0 shadow-[inset_0_-2px_0_rgba(0,0,0,.2)]" style={{ width: partial ? `${frac * 100}%` : '100%' }} />
                    )}
                    <span
                      className={cn(
                        'absolute bottom-1 left-0 right-0 text-center font-mono text-[10px] font-extrabold',
                        fullyThere ? 'text-black/80' : partial ? 'text-black/70' : 'text-white/20'
                      )}
                    >
                      {n}
                    </span>
                    {partial && <div className="absolute inset-y-0 w-0.5 bg-red-500 shadow-[0_0_6px_red]" style={{ left: `${frac * 100}%` }} />}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between px-1 text-[11px] font-semibold text-white/40">
          <span>■ жёлтое — осталось</span>
          <span>▢ пунктир — отрезано</span>
        </div>
      </Card>
    </div>
  );
}
