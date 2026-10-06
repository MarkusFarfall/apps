'use client';

import { useEffect, useRef } from 'react';
import { drawFish } from '@/game/fishDraw';
import type { FishDef, Variant } from '@/game/types';
import { LOC_WATER } from '@/game/codexData';
import { fishFrame } from './FishIcon';

const hex = (h: string) => {
  const n = parseInt(h.slice(1, 7), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
};
const mix = (a: readonly number[], b: readonly number[], t: number) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;

/**
 * Витрина вида: вода родной акватории, лучи света, морской снег, дно на мелководье.
 * depth 0..1 — где в диапазоне глубин вида мы смотрим (влияет на свет и цвет воды).
 */
export function Aquarium({
  fish,
  variant,
  silhouette,
  depth,
  animate = true,
  className = '',
}: {
  fish: FishDef;
  variant: Variant | null;
  silhouette: boolean;
  depth: number;
  animate?: boolean;
  className?: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const props = useRef({ fish, variant, silhouette, depth, animate });
  useEffect(() => {
    props.current = { fish, variant, silhouette, depth, animate };
  });

  useEffect(() => {
    const cv = canvas.current!;
    const ctx = cv.getContext('2d')!;
    let W = 1;
    let H = 1;
    let dpr = 1;
    const resize = () => {
      const r = wrap.current!.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = Math.max(1, r.width);
      H = Math.max(1, r.height);
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      cv.style.width = `${W}px`;
      cv.style.height = `${H}px`;
    };
    const ro = new ResizeObserver(resize);
    ro.observe(wrap.current!);
    resize();
    let raf = 0;
    const t0 = performance.now();
    let last = t0;
    let wag = 0.6;
    const loop = (now: number) => {
      const { fish: f, variant: v, silhouette: sil, depth: dk, animate: an } = props.current;
      const t = (now - t0) / 1000;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (an) wag += dt * (f.shape === 'eel' ? 3 : f.shape === 'ray' || f.shape === 'squid' ? 2.4 : 4.2);
      const [d0, d1] = f.depth;
      const meters = d0 + (d1 - d0) * dk;
      const dark = Math.min(0.92, Math.pow(Math.min(1, meters / 900), 0.55));
      const [top, bottom] = LOC_WATER[f.loc[0]];
      const tc = hex(top);
      const bc = hex(bottom);
      const abyss = [2, 5, 10];
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // вода
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, mix(tc, abyss, dark * 0.85));
      g.addColorStop(1, mix(bc, abyss, Math.min(1, dark * 0.9 + 0.1)));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      // лучи
      const rays = 1 - dark;
      if (rays > 0.03) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 5; i++) {
          const x = ((i + 0.5) / 5) * W + Math.sin(t * 0.2 + i * 1.7) * W * 0.05;
          const w = W * (0.05 + (i % 3) * 0.03);
          const rg = ctx.createLinearGradient(0, 0, 0, H);
          rg.addColorStop(0, `rgba(220,240,255,${0.12 * rays * (0.6 + 0.4 * Math.sin(t * 0.5 + i))})`);
          rg.addColorStop(1, 'rgba(220,240,255,0)');
          ctx.fillStyle = rg;
          ctx.beginPath();
          ctx.moveTo(x - w / 2, 0);
          ctx.lineTo(x + w / 2, 0);
          ctx.lineTo(x + w * 1.6 + W * 0.12, H);
          ctx.lineTo(x - w * 1.6 + W * 0.12, H);
          ctx.fill();
        }
        // каустика у поверхности
        ctx.strokeStyle = `rgba(230,250,255,${0.1 * rays})`;
        ctx.lineWidth = 1;
        for (let l = 0; l < 3; l++) {
          ctx.beginPath();
          for (let x = 0; x <= W; x += 8) {
            const y = 8 + l * 9 + Math.sin(x * 0.04 + t * (1.4 + l * 0.3) + l) * 3;
            if (x) ctx.lineTo(x, y);
            else ctx.moveTo(x, y);
          }
          ctx.stroke();
        }
        ctx.restore();
      }
      // дно на мелководье
      if (meters < 80) {
        const k = 1 - meters / 80;
        ctx.fillStyle = mix(hex('#8a7a5a'), abyss, 0.55 + dark * 0.3);
        ctx.globalAlpha = 0.55 * k + 0.2;
        ctx.beginPath();
        ctx.moveTo(0, H);
        for (let x = 0; x <= W; x += 12) ctx.lineTo(x, H - 14 - Math.sin(x * 0.02) * 6 - Math.sin(x * 0.07) * 3);
        ctx.lineTo(W, H);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      // морской снег
      ctx.fillStyle = `rgba(220,235,245,${0.25 + dark * 0.2})`;
      for (let i = 0; i < 40; i++) {
        const seed = Math.sin(i * 91.3) * 43758.5;
        const fr = seed - Math.floor(seed);
        const x = (fr * W + Math.sin(t * 0.3 + i) * 12 + W) % W;
        const y = (((i * 37.7) % H) + t * (6 + (i % 5) * 3)) % H;
        ctx.fillRect(x, y, 1.3, 1.3);
      }
      // рыба
      const { L, cx, cy } = fishFrame(f, W, H * 0.86);
      const bob = an ? Math.sin(t * 0.8) * H * 0.025 : 0;
      const drift = an ? Math.sin(t * 0.33) * W * 0.02 : 0;
      // мягкая тень под рыбой на мелководье
      if (meters < 80 && !sil) {
        ctx.save();
        ctx.globalAlpha = 0.18 * (1 - meters / 80);
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(cx + drift, H - 12, L * 0.38, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      drawFish(ctx, f, cx + drift, cy + H * 0.07 + bob, L, 1, {
        wag,
        variant: v,
        silhouette: sil ? 'rgba(150,180,200,0.16)' : null,
        darken: dark * 0.55,
        glowBoost: 1 + dark,
        detail: 2,
      });
      // виньетка
      const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.45)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <div ref={wrap} className={`relative overflow-hidden ${className}`}>
      <canvas ref={canvas} className="block" aria-hidden="true" />
    </div>
  );
}
