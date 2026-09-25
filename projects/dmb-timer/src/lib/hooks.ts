import { useEffect, useState } from 'react';

export function useStored<T>(key: string, initial: T) {
  const [v, setV] = useState<T>(() => {
    try {
      const s = localStorage.getItem(key);
      return s ? (JSON.parse(s) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(v));
    } catch {
      /* ignore */
    }
  }, [key, v]);
  return [v, setV] as const;
}

export function useNow(interval = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(id);
  }, [interval]);
  return now;
}

/** requestAnimationFrame-driven clock, throttled */
export function useRafNow(enabled = true, fps = 30) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) {
      const id = setInterval(() => setNow(Date.now()), 1000);
      return () => clearInterval(id);
    }
    let raf = 0;
    let last = 0;
    const step = 1000 / fps;
    const loop = (t: number) => {
      if (t - last >= step) {
        last = t;
        setNow(Date.now());
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [enabled, fps]);
  return now;
}

let hapticsOn = true;
export const setHaptics = (v: boolean) => {
  hapticsOn = v;
};
export const buzz = (p: number | number[] = 8) => {
  if (!hapticsOn) return;
  try {
    navigator.vibrate?.(p);
  } catch {
    /* ignore */
  }
};
