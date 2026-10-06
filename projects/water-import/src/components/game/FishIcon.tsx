'use client';

// Те же пропсы, что у src/components/game/FishIcon.tsx оригинала — заменяется один в один
import { useEffect, useRef } from 'react';
import { drawFish } from '@/game/fishDraw';
import type { FishDef, Variant } from '@/game/types';

const TALL = ['Hippocampus', 'Enteroctopus', 'Grimpoteuthis'];
const ROUND: FishDef['shape'][] = ['deep', 'flat', 'angler', 'blob', 'puffer'];

/** Размер и центр рыбы в рамке (общая логика для иконок и аквариума) */
export function fishFrame(fish: FishDef, w: number, h: number) {
  const genus = fish.latin.split(' ')[0];
  const shapeMul = fish.shape === 'billfish' ? 0.6 : fish.shape === 'squid' ? 0.58 : fish.shape === 'ray' ? 0.62 : fish.shape === 'eel' || fish.shape === 'long' ? 0.84 : 0.78;
  let L = Math.min(w * shapeMul, h * (ROUND.includes(fish.shape) ? 1.2 : fish.shape === 'ray' ? 1.0 : 2.4));
  if (genus === 'Mola') L = Math.min(w * 0.62, h * 0.95);
  if (genus === 'Alopias') L = Math.min(w * 0.6, h * 1.6);
  if (genus === 'Pristis' || genus === 'Mitsukurina') L = Math.min(w * 0.66, h * 2.2);
  const tall = TALL.includes(genus);
  const cx = tall ? w / 2 : fish.shape === 'billfish' ? w * 0.42 : fish.shape === 'squid' ? w * 0.62 : fish.shape === 'ray' ? w * 0.6 : genus === 'Alopias' ? w * 0.62 : genus === 'Pristis' ? w * 0.4 : w / 2;
  const cy = h / 2 + (fish.shape === 'angler' ? h * 0.1 : 0);
  return { L: tall ? h * 0.95 : L, cx, cy };
}

export function FishIcon({
  fish,
  size = 96,
  height,
  known = true,
  variant = null,
  animate = false,
}: {
  fish: FishDef;
  size?: number;
  height?: number;
  known?: boolean;
  variant?: Variant | null;
  animate?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const h = height ?? Math.round(size * 0.62);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = size * dpr;
    c.height = h * dpr;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    const start = performance.now();
    const { L, cx, cy } = fishFrame(fish, size, h);
    const draw = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, h);
      const t = (performance.now() - start) / 1000;
      drawFish(ctx, fish, cx, cy, L, 1, {
        wag: animate ? t * 4 : 0.6,
        silhouette: known ? null : 'rgba(150,180,200,0.14)',
        variant,
      });
      if (animate) raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [fish, size, h, known, variant, animate]);
  return <canvas ref={ref} style={{ width: size, height: h }} className="block" aria-hidden="true" />;
}
