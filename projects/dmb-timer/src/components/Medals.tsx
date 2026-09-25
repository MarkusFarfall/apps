import { useMemo } from 'react';
import confetti from 'canvas-confetti';
import { Lock } from 'lucide-react';
import type { Ctx } from '../lib/types';
import { achievementsFor } from '../lib/data';
import { fmtDate, fmtDur } from '../lib/format';
import { Card } from './ui';
import { cn } from '../utils/cn';
import { buzz } from '../lib/hooks';

export function Medals({ ctx }: { ctx: Ctx }) {
  const list = useMemo(() => achievementsFor(ctx.s, ctx.e), [ctx.s, ctx.e]);
  const got = list.filter((a) => a.ts <= ctx.now);
  const next = list.find((a) => a.ts > ctx.now);
  const prev = got[got.length - 1];
  const segPct = next ? (ctx.now - (prev?.ts ?? ctx.s)) / (next.ts - (prev?.ts ?? ctx.s)) : 1;

  const celebrate = (x: number, y: number) => {
    buzz([15, 30, 15]);
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    const accent2 = getComputedStyle(document.documentElement).getPropertyValue('--accent2').trim();
    confetti({ particleCount: 80, spread: 70, origin: { x, y }, colors: [accent, accent2, '#ffffff'] });
  };

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center gap-4">
          <div className="font-display text-5xl font-black">
            <span className="text-grad">{got.length}</span>
            <span className="text-2xl text-white/30">/{list.length}</span>
          </div>
          <div className="text-sm text-white/55">медалей получено. Все выдаются автоматически — просто держись.</div>
        </div>
        {next && (
          <div className="mt-4 rounded-2xl bg-white/5 p-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{next.icon}</span>
              <div className="flex-1">
                <div className="text-[11px] font-bold uppercase tracking-wider text-white/40">Следующая</div>
                <div className="font-bold">{next.title}</div>
              </div>
              <div className="font-mono text-sm font-bold text-accent">{fmtDur(next.ts - ctx.now)}</div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="bg-grad h-full rounded-full" style={{ width: `${Math.min(100, segPct * 100)}%` }} />
            </div>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-3">
        {list.map((a, i) => {
          const ok = a.ts <= ctx.now;
          return (
            <button
              key={a.id}
              onClick={(ev) => {
                if (!ok) return buzz(4);
                const r = (ev.currentTarget as HTMLElement).getBoundingClientRect();
                celebrate((r.left + r.width / 2) / window.innerWidth, (r.top + r.height / 2) / window.innerHeight);
              }}
              style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}
              className={cn('glass pop-in relative rounded-3xl p-4 text-left transition active:scale-95', !ok && 'opacity-55')}
            >
              <div
                className={cn(
                  'mb-3 grid h-14 w-14 place-items-center rounded-2xl text-3xl',
                  ok ? 'bg-grad shadow-[0_0_24px_-4px_var(--accent)]' : 'bg-white/5 grayscale'
                )}
              >
                {a.icon}
              </div>
              {!ok && <Lock size={14} className="absolute right-4 top-4 text-white/40" />}
              <div className="font-bold leading-tight">{a.title}</div>
              <div className="mt-0.5 text-[11px] leading-snug text-white/50">{a.desc}</div>
              <div className={cn('mt-2 text-[10px] font-bold', ok ? 'text-accent' : 'text-white/40')}>
                {ok ? `✓ ${fmtDate(a.ts, false)}` : `через ${fmtDur(a.ts - ctx.now)}`}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
