"use client";

import { useEffect, useRef, useState } from "react";
import { Engine, type TravelMode, type Trip } from "@/game/engine";
import { Scene } from "@/game/render/scene";
import { LOC_BY_ID, PORT_BY_ID, SPOT_BY_ID } from "@/game/world";
import { Icon, MiscIcon } from "./Icons";
import { fmt } from "./Panels";

export const tripName = (t: Trip) => (t.kind === "port" ? PORT_BY_ID[t.port].name : LOC_BY_ID[t.loc].name);
const fmtDur = (min: number) => (min >= 60 ? `${Math.floor(min / 60)} ч ${String(Math.round(min % 60)).padStart(2, "0")} мин` : `${Math.round(min)} мин`);

/** Длительность анимации, секунды */
export const animSeconds = (e: Engine, t: Trip, mode: TravelMode) => {
  const h = e.tripQuote(t, mode).hours;
  if (mode === "motor" && e.canMotor) return Math.min(6, 3.5 + h * 0.6);
  return Math.max(16, Math.min(34, 12 + h * 7));
};

export function TravelChoice({ engine, trip, onCancel, onGo }: { engine: Engine; trip: Trip; onCancel: () => void; onGo: (mode: TravelMode) => void }) {
  const b = engine.boat;
  const opts: { mode: TravelMode; title: string; sub: string; icon: "wave" | "fuel" }[] = engine.canMotor
    ? [
        { mode: "sail", title: b.style === "yacht" ? "Под парусом" : "Малым ходом", sub: "Экономно, без топлива, но долго", icon: "wave" },
        { mode: "motor", title: "Полным ходом", sub: "Быстро, топливо за счёт команды", icon: "fuel" },
      ]
    : [{ mode: "sail", title: b.style === "yacht" ? "Под парусом" : "На вёслах", sub: "Судно без мотора — только своим ходом", icon: "wave" }];
  const cooler = engine.s.cooler.length;
  return (
    <div className="fade-in absolute inset-0 z-[55] flex items-end justify-center bg-[#02050a]/70 backdrop-blur-[3px] sm:items-center sm:p-4" onPointerDown={(e) => e.stopPropagation()}>
      <div className="sheet reveal safe-pad w-full max-w-[560px] !rounded-none p-6 sm:!rounded-[3px] sm:p-8">
        <div className="flex items-start justify-between">
          <div>
            <div className="label-brass">{trip.kind === "port" ? "Курс в порт" : "Выход в море"}</div>
            <h2 className="font-serif mt-1 text-[32px] font-medium leading-none text-[#f1ebdd]">{tripName(trip)}</h2>
            <div className="mt-1 text-[12px] muted">{b.name}{cooler ? ` · в трюме ${cooler} рыб` : ""}</div>
          </div>
          <button className="iconbtn" onClick={onCancel} aria-label="Отмена"><Icon name="close" size={16} /></button>
        </div>
        <div className="mt-6 grid gap-3">
          {opts.map((o) => {
            const q = engine.tripQuote(trip, o.mode);
            const block = engine.tripBlock(trip, o.mode);
            const secs = Math.round(animSeconds(engine, trip, o.mode));
            return (
              <button key={o.mode} disabled={!!block} onClick={() => onGo(o.mode)} className="cell cell-hover group flex items-center gap-4 p-4 text-left disabled:cursor-not-allowed disabled:opacity-45">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center border border-[var(--line-2)] text-[var(--brass)] group-hover:border-[var(--brass)]">
                  {o.icon === "fuel" ? <MiscIcon name="fuel" size={24} /> : <Icon name="wave" size={24} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-serif text-[20px] leading-tight text-[#f1ebdd]">{o.title}</span>
                  <span className="block text-[12px] dim">{block ?? o.sub}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className={`num block text-[16px] ${q.fuel ? "text-[var(--brass-2,#e3c996)]" : "text-[var(--color-ok)]"}`}>{q.fuel ? `${fmt(q.fuel)} ₽` : "бесплатно"}</span>
                  <span className="num block text-[11px] muted">{fmtDur(q.minutes)} в пути</span>
                  <span className="num block text-[10px] dim">≈ {secs} с</span>
                </span>
              </button>
            );
          })}
        </div>
        {trip.kind === "port" && cooler > 0 && <p className="mt-4 text-[11px] leading-relaxed dim">Долгий переход — улов теряет свежесть. Лёд на промысловых судах замедляет порчу.</p>}
      </div>
    </div>
  );
}

export function TravelOverlay({ engine, trip, mode, onDone, quality = 1 }: { engine: Engine; trip: Trip; mode: TravelMode; onDone: () => void; quality?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [p, setP] = useState(0);
  const doneRef = useRef(false);
  const q = engine.tripQuote(trip, mode);
  const dur = animSeconds(engine, trip, mode);
  const motor = mode === "motor" && engine.canMotor;
  const boat = engine.boat;
  const fromName = engine.s.atPort ? PORT_BY_ID[engine.s.port].name : LOC_BY_ID[engine.s.location].name;
  const fromPt = engine.here;
  const toPt = engine.tripPoint(trip);
  const startMin = engine.s.minutes;
  const modeName = motor ? "Полным ходом" : boat.style === "yacht" ? "Под парусом" : engine.canMotor ? "Малым ходом" : boat.style === "kayak" ? "На весле" : "На вёслах";

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    // копия мира для кадра перехода: открытое море, то же судно и погода
    const snap = JSON.parse(JSON.stringify(engine.s)) as typeof engine.s;
    const dest = trip.kind === "loc" ? LOC_BY_ID[trip.loc] : null;
    const polar = dest?.climate === "polar" || (trip.kind === "port" && trip.port === "southcross");
    snap.location = "ocean";
    snap.spot = "ocean_blue";
    snap.atPort = false;
    snap.events = [];
    snap.sonar = 0;
    if (polar && snap.weather === "rain") snap.weather = "snow";
    const ve = new Engine(snap);
    ve.paused = true;
    ve.phase = "idle";
    const scene = new Scene();
    scene.quality = Math.min(quality, 1);
    scene.camMode = "surface";
    const dpr = Math.min(quality >= 2 ? 2 : 1.5, window.devicePixelRatio || 1);
    let W = 0, H = 0;
    const resize = () => {
      W = c.clientWidth;
      H = c.clientHeight;
      c.width = Math.floor(W * dpr);
      c.height = Math.floor(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);
    // первый кадр сразу, чтобы не было чёрного экрана
    scene.voyage = 40;
    for (let i = 0; i < 3; i++) scene.render(ctx, ve, W, H, 1 / 30);
    const t0 = performance.now();
    let last = t0;
    let raf = 0;
    const cruise = motor ? 230 : 60;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const el = (now - t0) / 1000;
      const k = Math.min(1, el / dur);
      // разгон и торможение
      const ease = Math.min(1, 0.35 + el / 1.2) * Math.min(1, (dur - el) / 1.2 + 0.35);
      scene.voyage = cruise * Math.max(0.15, ease);
      ve.s.minutes = startMin + q.minutes * k;
      ve.update(dt);
      scene.render(ctx, ve, W, H, dt);
      setP(k);
      if (k >= 1) {
        if (!doneRef.current) {
          doneRef.current = true;
          setTimeout(onDone, 450);
        }
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const el = p * dur;
  const leftSec = Math.max(0, Math.ceil(dur - el));
  const gameMin = q.minutes * p;
  const clock = ((startMin + gameMin) % 1440 + 1440) % 1440;
  const fadeIn = Math.max(0, 1 - el / 0.35) * 0.6;
  const fadeOut = Math.max(0, (el - (dur - 0.4)) / 0.4) * 0.85;
  // маршрут на мини-карте: дуга
  const [x1, y1] = fromPt, [x2, y2] = toPt;
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 - Math.hypot(x2 - x1, y2 - y1) * 0.18;
  const bz = (t: number) => [(1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * mx + t * t * x2, (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * my + t * t * y2];
  const [sx, sy] = bz(p);
  const [nx, ny] = bz(Math.min(1, p + 0.02));
  const heading = (Math.atan2((ny - sy) * 0.625, nx - sx) * 180) / Math.PI;
  const titles: Record<string, string> = { home: "родной порт", nordhavn: "северный порт", mirador: "туманная гавань", coral: "тропический остров", southcross: "полярная станция" };
  const sub = trip.kind === "port" ? titles[trip.port] : trip.spot ? `точка «${SPOT_NAME(trip.spot)}»` : "акватория";

  return (
    <div className="fade-in absolute inset-0 z-[70] overflow-hidden bg-[#0a1a28]" onPointerDown={(e) => e.stopPropagation()}>
      <canvas ref={ref} className="absolute inset-0 h-full w-full" />
      {/* кинематографичные полосы */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[22vh] bg-gradient-to-b from-[#030609]/75 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[24vh] bg-gradient-to-t from-[#030609]/85 via-[#030609]/55 to-transparent" />
      {/* заголовок */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center pt-[max(5vh,env(safe-area-inset-top))] text-center" style={{ opacity: Math.min(1, el / 1.2) * (1 - fadeOut) }}>
        <div className="label-brass [text-shadow:0_1px_10px_rgba(0,0,0,0.8)]">{modeName} · {boat.name}</div>
        <div className="font-serif mt-2 text-[clamp(34px,5.5vw,64px)] font-light leading-none text-[#f4eee0] [text-shadow:0_2px_30px_rgba(0,0,0,0.65)]">{tripName(trip)}</div>
        <div className="font-serif mt-2 text-[17px] italic text-[#e3d8c0] [text-shadow:0_1px_12px_rgba(0,0,0,0.8)]">{sub}</div>
      </div>
      {/* нижняя панель */}
      <div className="absolute inset-x-0 bottom-0 flex min-h-[92px] items-center gap-4 px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-3 sm:gap-8 sm:px-10">
        <svg viewBox="0 0 100 62.5" className="hidden h-[78px] w-auto shrink-0 border border-[var(--line)] bg-[#081420]/85 sm:block">
          <path d="M0 62.5 L0 0 L19 0 C18 3 12 4 13 7 C14 9 19 8 20 11 C21 14 17 15 19 18 C22 21 26 19 27 23 C27 26 22 26 21 29 C20 33 24 34 22 38 C20 42 16 40 14 43 C12 46 16 48 13 51 C11 53 7 51 5 54 L4 56 C6 58 9 57 10 60 L10 62.5 Z" fill="#17231d" />
          <path d={`M${x1} ${y1 * 0.625} Q${mx} ${my * 0.625} ${x2} ${y2 * 0.625}`} fill="none" stroke="rgba(200,164,106,0.35)" strokeWidth="0.5" strokeDasharray="1.2 1.2" />
          <path d={`M${x1} ${y1 * 0.625} Q${mx} ${my * 0.625} ${x2} ${y2 * 0.625}`} fill="none" stroke="#c8a46a" strokeWidth="0.7" pathLength={1} strokeDasharray={`${p} 1`} />
          <circle cx={x1} cy={y1 * 0.625} r="1" fill="#8fb3c8" />
          <circle cx={x2} cy={y2 * 0.625} r="1.4" fill="none" stroke="#e3c996" strokeWidth="0.5" />
          <g transform={`translate(${sx} ${sy * 0.625}) rotate(${heading})`}>
            <path d="M2.2 0 L-1.6 -1.3 L-1 0 L-1.6 1.3 Z" fill="#f4eee0" />
          </g>
        </svg>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between text-[12px]">
            <span className="truncate muted">{fromName}</span>
            <span className="num text-[13px] text-[#f1ebdd]">{String(Math.floor(clock / 60)).padStart(2, "0")}:{String(Math.floor(clock % 60)).padStart(2, "0")}</span>
            <span className="truncate text-right text-[#f1ebdd]">{tripName(trip)}</span>
          </div>
          <div className="relative mt-2.5 h-px bg-white/15">
            <div className="absolute inset-y-0 left-0 bg-[var(--brass)]" style={{ width: `${p * 100}%` }} />
            <div className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border border-[var(--brass)] bg-[#030609]" style={{ left: `${p * 100}%` }} />
          </div>
          <div className="mt-2.5 flex items-baseline justify-between text-[11px]">
            <span className="num dim">в пути {fmtDur(gameMin)} из {fmtDur(q.minutes)}</span>
            {q.fuel > 0 && <span className="num hidden dim sm:inline">топливо {fmt(q.fuel)} ₽</span>}
            <span className="num text-[#ddd7ca]">прибытие через {leftSec} с</span>
          </div>
        </div>
      </div>
      {/* затемнения */}
      <div className="pointer-events-none absolute inset-0 bg-[#02050a]" style={{ opacity: Math.max(fadeIn, fadeOut) }} />
    </div>
  );
}

const SPOT_NAME = (id: string) => SPOT_BY_ID[id]?.name ?? id;
