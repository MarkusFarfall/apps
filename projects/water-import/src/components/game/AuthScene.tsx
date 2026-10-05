"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { SeaEngine } from './scene/seaEngine';
import type { SeaSfx } from '../../game/authAudio';

/**
 * Новая сцена входа. Вместо статичного SVG — живой Canvas:
 * подъём со дна → море с лодкой → реакции на форму → погружение после входа.
 */
export interface AuthSceneHandle {
  /** Пользователь печатает — рыба трогает наживку */
  nibble(): void;
  /** Отправка формы — рыба взяла, поплавок пляшет */
  bite(): void;
  /** Запрос закончился без результата — отпускаем */
  release(): void;
  /** Ошибка — рыба сорвалась */
  fail(): void;
  /** Успех — подсечка, рыба летит в лодку, затем погружение */
  success(): void;
  skipIntro(): void;
}

interface Props {
  mode: 'login' | 'register';
  onIntroDone?: () => void;
  onDiveDone?: () => void;
  /** звуковые хуки сцены */
  sfx?: SeaSfx;
  /** вернуть false, чтобы тап не дошёл до сцены (например, первый тап включает звук) */
  onBeforeTap?: () => boolean;
}

export const AuthScene = forwardRef<AuthSceneHandle, Props>(function AuthScene(
  { mode, onIntroDone, onDiveDone, sfx, onBeforeTap },
  ref,
) {
  const sfxRef = useRef(sfx);
  sfxRef.current = sfx;
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const engine = useRef<SeaEngine | null>(null);
  const cbs = useRef({ onIntroDone, onDiveDone });
  cbs.current = { onIntroDone, onDiveDone };
  const firstMode = useRef(mode);

  useEffect(() => {
    const cv = canvas.current!;
    const ctx = cv.getContext('2d', { alpha: false })!;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const e = new SeaEngine(
      ctx,
      {
        onIntroDone: () => cbs.current.onIntroDone?.(),
        onDiveDone: () => cbs.current.onDiveDone?.(),
      },
      reduced,
    );
    e.setMode(firstMode.current, true);
    e.setSfx(sfxRef.current ?? null);
    engine.current = e;

    /*
     * Адаптивное качество. Главный пожиратель FPS на телефонах — количество пикселей
     * (retina ×3 = 9 пикселей на точку). Ограничиваем бюджет пикселей холста и при
     * просадке FPS опускаемся на уровень ниже: меньше пикселей + меньше эффектов.
     */
    const BUDGET = [0.75e6, 1.35e6, 2.6e6];
    const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    const cores = navigator.hardwareConcurrency || 4;
    let level: 0 | 1 | 2 = coarse || cores <= 4 ? 1 : 2;

    let lastW = 0;
    let lastH = 0;
    const resize = () => {
      const r = wrap.current!.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      lastW = r.width;
      lastH = r.height;
      const dev = window.devicePixelRatio || 1;
      const dpr = Math.max(0.6, Math.min(dev, 2, Math.sqrt(BUDGET[level] / (r.width * r.height))));
      cv.width = Math.round(r.width * dpr);
      cv.height = Math.round(r.height * dpr);
      cv.style.width = `${r.width}px`;
      cv.style.height = `${r.height}px`;
      e.setQuality(level);
      e.resize(r.width, r.height, dpr);
    };
    let resizeTimer = 0;
    const ro = new ResizeObserver(() => {
      const r = wrap.current!.getBoundingClientRect();
      if (Math.abs(r.width - lastW) < 1 && Math.abs(r.height - lastH) < 1) return;
      // запекание слоёв не дёшево — не делаем его на каждый пиксель перетаскивания окна
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(resize, lastW ? 120 : 0);
    });
    ro.observe(wrap.current!);
    resize();

    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let frames = 0;
    let slow = 0;
    let warm = 0;
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      e.update(dt);
      e.render();
      // монитор FPS: два подряд медленных окна (<45 к/с) — понижаем качество
      if (dt > 0 && dt < 0.25) {
        warm += dt;
        if (warm > 1.2) {
          acc += dt;
          frames++;
          if (frames >= 50) {
            const avg = acc / frames;
            acc = 0;
            frames = 0;
            if (avg > 1 / 45 && level > 0) {
              if (++slow >= 2) {
                level = (level - 1) as 0 | 1;
                slow = 0;
                resize();
              }
            } else slow = 0;
          }
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const onMove = (ev: PointerEvent) => e.setPointer((ev.clientX / window.innerWidth) * 2 - 1);
    window.addEventListener('pointermove', onMove);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(resizeTimer);
      ro.disconnect();
      window.removeEventListener('pointermove', onMove);
    };
  }, []);

  useEffect(() => {
    engine.current?.setMode(mode);
  }, [mode]);

  useImperativeHandle(ref, () => ({
    nibble: () => engine.current?.nibble(),
    bite: () => engine.current?.bite(),
    release: () => engine.current?.release(),
    fail: () => engine.current?.fail(),
    success: () => engine.current?.success(),
    skipIntro: () => engine.current?.skipIntro(),
  }));

  return (
    <div ref={wrap} className="absolute inset-0 overflow-hidden bg-[#03080e]" aria-hidden="true">
      <canvas
        ref={canvas}
        className="block"
        onPointerDown={(ev) => {
          if (onBeforeTap && !onBeforeTap()) return;
          const r = canvas.current!.getBoundingClientRect();
          engine.current?.tap(ev.clientX - r.left, ev.clientY - r.top);
        }}
      />
    </div>
  );
});
