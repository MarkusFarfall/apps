"use client";

import { useEffect, useRef } from "react";
import { drawFish } from "@/game/fishDraw";
import type { FishDef, Variant } from "@/game/types";

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
    const ctx = c.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    const start = performance.now();
    const shapeMul = fish.shape === "billfish" ? 0.62 : fish.shape === "squid" ? 0.6 : fish.shape === "ray" ? 0.62 : fish.shape === "eel" || fish.shape === "long" ? 0.86 : 0.78;
    const draw = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, h);
      const t = (performance.now() - start) / 1000;
      const L = Math.min(size * shapeMul, h * (fish.shape === "deep" || fish.shape === "flat" || fish.shape === "angler" || fish.shape === "blob" || fish.shape === "puffer" ? 1.2 : fish.shape === "ray" ? 1.0 : 2.4));
      const tall = ["Hippocampus", "Enteroctopus", "Grimpoteuthis"].includes(fish.latin.split(" ")[0]);
      const Lf = tall ? h * 1.0 : L;
      const cx = fish.shape === "billfish" ? size * 0.44 : fish.shape === "squid" ? size * 0.62 : fish.shape === "ray" ? size * 0.6 : size / 2;
      drawFish(ctx, fish, tall ? size / 2 : cx, h / 2 + (fish.shape === "angler" ? h * 0.08 : 0), Lf, 1, {
        wag: animate ? t * 4 : 0.6,
        silhouette: known ? null : "rgba(150,180,200,0.14)",
        variant,
      });
      if (animate) raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [fish, size, h, known, variant, animate]);
  return <canvas ref={ref} style={{ width: size, maxWidth: "100%", height: "auto", aspectRatio: `${size} / ${h}` }} className="block" />;
}
