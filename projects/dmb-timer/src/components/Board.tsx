import { useEffect, useState } from 'react';
import { X, Maximize } from 'lucide-react';
import type { Ctx } from '../lib/types';
import { calc, split, HOUR } from '../lib/time';
import { pad, plural, W, num } from '../lib/format';
import { labels } from '../lib/data';
import { useRafNow } from '../lib/hooks';

type WakeLockSentinelLike = { release: () => Promise<void> };

export function Board({ ctx, onClose }: { ctx: Ctx; onClose: () => void }) {
  const now = useRafNow(true, 30);
  const [style, setStyle] = useState(0);
  const c = calc(ctx.s, ctx.e, now);
  const t = split(c.notStarted ? ctx.s - now : c.left);
  const L = labels(ctx.profile.mode);

  useEffect(() => {
    let lock: WakeLockSentinelLike | null = null;
    const nav = navigator as unknown as { wakeLock?: { request: (t: string) => Promise<WakeLockSentinelLike> } };
    nav.wakeLock
      ?.request('screen')
      .then((l) => (lock = l))
      .catch(() => {});
    return () => {
      lock?.release().catch(() => {});
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, []);

  const fs = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen().catch(() => {});
  };

  return (
    <div className="fade fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black text-white select-none" onClick={() => setStyle((style + 1) % 3)}>
      <div className="absolute right-4 top-4 flex gap-2 safe-top" onClick={(e) => e.stopPropagation()}>
        <button onClick={fs} className="grid h-11 w-11 place-items-center rounded-full bg-white/10">
          <Maximize size={18} />
        </button>
        <button onClick={onClose} className="grid h-11 w-11 place-items-center rounded-full bg-white/10">
          <X size={20} />
        </button>
      </div>

      <div className="mb-4 text-xs font-bold uppercase tracking-[0.4em] text-white/40">{c.done ? L.doneTitle : L.until}</div>

      {style === 0 && (
        <>
          <div className="font-display text-[28vw] font-black leading-none tabular text-grad sm:text-[18vw]">{t.days}</div>
          <div className="mt-2 text-xl font-bold text-white/50">{plural(t.days, W.day)}</div>
          <div className="mt-6 font-mono text-[11vw] font-extrabold leading-none tabular sm:text-[7vw]">
            {pad(t.hours)}:{pad(t.minutes)}:{pad(t.seconds)}
            <span className="text-[5vw] text-white/40 sm:text-[3vw]">.{pad(Math.floor(t.millis / 10))}</span>
          </div>
        </>
      )}
      {style === 1 && (
        <>
          <div className="font-mono text-[16vw] font-extrabold leading-none tabular text-grad sm:text-[11vw]">{num(c.left / HOUR)}</div>
          <div className="mt-2 text-xl font-bold text-white/50">{plural(c.left / HOUR, W.hour)}</div>
          <div className="mt-6 font-mono text-[9vw] font-extrabold tabular sm:text-[6vw]">
            {pad(t.minutes)}:{pad(t.seconds)}.{pad(Math.floor(t.millis / 10))}
          </div>
        </>
      )}
      {style === 2 && (
        <>
          <div className="font-mono text-[20vw] font-extrabold leading-none tabular text-grad sm:text-[13vw]">{(c.pct * 100).toFixed(4)}%</div>
          <div className="mt-6 h-4 w-[80vw] overflow-hidden rounded-full bg-white/10">
            <div className="bg-grad h-full" style={{ width: `${c.pct * 100}%` }} />
          </div>
        </>
      )}

      <div className="absolute bottom-8 text-xs text-white/25 safe-bottom">нажми на экран — сменить вид · экран не погаснет</div>
    </div>
  );
}
