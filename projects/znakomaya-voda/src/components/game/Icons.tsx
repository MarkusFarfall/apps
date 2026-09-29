import type { ReactNode, SVGProps } from "react";
import type { WeatherId } from "@/game/types";

type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 16, children, ...rest }: P & { children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...rest}>
      {children}
    </svg>
  );
}

const PATHS: Record<string, ReactNode> = {
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" /></>,
  cloud: <path d="M7 18h10.5a4 4 0 0 0 .4-7.98A6 6 0 0 0 6.3 9.6 4.2 4.2 0 0 0 7 18Z" />,
  rain: <><path d="M7 14h10.5a3.6 3.6 0 0 0 .4-7.2A5.5 5.5 0 0 0 7.2 5.6 3.8 3.8 0 0 0 7 14Z" /><path d="M8 17l-1 3M12 17l-1 3M16 17l-1 3" /></>,
  storm: <><path d="M7 13h10.5a3.6 3.6 0 0 0 .4-7.2A5.5 5.5 0 0 0 7.2 4.6 3.8 3.8 0 0 0 7 13Z" /><path d="M12.5 13l-2.5 4h3l-2 4" /></>,
  fog: <><path d="M3 9h18M5 13h14M3 17h18M7 21h10" /></>,
  snow: <><path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9" /><path d="M10 4.5l2 1.5 2-1.5M10 19.5l2-1.5 2 1.5" /></>,
  book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Z" /><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5" /><path d="M9 8h7M9 11h5" /></>,
  journal: <><path d="M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6z" /><path d="M9 3v18M12 8h4M12 11h4" /></>,
  anchor: <><circle cx="12" cy="5" r="2" /><path d="M12 7v14M8 10h8M5 14a7 7 0 0 0 14 0" /><path d="M3.5 14H6.5M17.5 14h3" /></>,
  forward: <><path d="M4 6l7 6-7 6zM13 6l7 6-7 6z" /></>,
  speaker: <><path d="M4 9h3l5-4v14l-5-4H4z" /><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" /></>,
  mute: <><path d="M4 9h3l5-4v14l-5-4H4z" /><path d="M16 9.5l5 5M21 9.5l-5 5" /></>,
  music: <><path d="M9 18V5l11-2v13" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="17.5" cy="16" r="2.5" /></>,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  fish: <><path d="M3 12c3-5 9-6 13-3l5-3v12l-5-3c-4 3-10 2-13-3Z" /><circle cx="7.5" cy="11" r="0.8" fill="currentColor" /></>,
  basket: <><path d="M3 9h18l-2 11H5z" /><path d="M8 9l4-6 4 6M9 13v4M15 13v4M12 13v4" /></>,
  coin: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5v9M9.5 10h4a1.8 1.8 0 0 1 0 3.6h-3" /></>,
  compass: <><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5l-2 5-5 2 2-5z" /></>,
  map: <><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z" /><path d="M9 4v14M15 6v14" /></>,
  rod: <><path d="M4 20L19 3" /><path d="M19 3c1 6 0 11-3 14" /><circle cx="7" cy="17" r="1.8" /></>,
  boat: <><path d="M3 15h18l-3 5H6z" /><path d="M12 15V4l6 9H12" /></>,
  hook: <><path d="M12 2v11a4 4 0 1 1-8 0v-1" /><path d="M4 12l2-2" /></>,
  bed: <><path d="M3 18V7M3 12h18v6M21 18v2M3 18v2" /><circle cx="7.5" cy="10" r="1.5" /></>,
  scroll: <><path d="M7 4h11a2 2 0 0 1 2 2v1h-4" /><path d="M16 7v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1h10" /><path d="M7 4a2 2 0 0 0-2 2v11M9 9h4M9 12h4" /></>,
  medal: <><circle cx="12" cy="15" r="5" /><path d="M8.5 11L6 3h4l2 5 2-5h4l-2.5 8" /><path d="M12 13v4" /></>,
  star: <path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z" />,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" /></>,
  chart: <><path d="M4 20V4M4 20h16" /><path d="M8 16v-4M12 16V8M16 16v-7" /></>,
  target: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="0.8" fill="currentColor" /></>,
  lock: <><rect x="5" y="11" width="14" height="9" rx="1" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  check: <path d="M5 12.5l4.5 4.5L19 7" />,
  sparkle: <path d="M12 3v5M12 16v5M3 12h5M16 12h5M6 6l3 3M15 15l3 3M18 6l-3 3M9 15l-3 3" />,
  order: <><rect x="5" y="4" width="14" height="17" rx="1" /><path d="M9 4V3h6v1M8.5 10h7M8.5 14h7M8.5 18h4" /></>,
  wave: <path d="M2 10c2.5-3 5-3 7.5 0s5 3 7.5 0 3.5-2 5 0M2 16c2.5-3 5-3 7.5 0s5 3 7.5 0 3.5-2 5 0" />,
  bird: <path d="M2 10c3-1 6 0 10 4 4-4 7-5 10-4" />,
  whale: <><path d="M2 14c0-4 5-6 11-6 4 0 6 2 7 4l2-3v7l-2-2c-2 3-6 4-10 4-5 0-8-2-8-4Z" /><path d="M9 5c0-1.5 1-2.5 2-2.5M9 5c0-1.5-1-2.5-2-2.5" /></>,
  ship: <><path d="M3 17h18l-2 3H5z" /><path d="M8 17V4M16 17V6M8 5c3 2 3 7 0 10M16 7c2.5 2 2.5 6 0 8" /></>,
  meteor: <><circle cx="16" cy="16" r="3" /><path d="M13.5 13.5L4 4M12 16L6 10M16 12L10 6" /></>,
  line: <path d="M3 12h18" />,
  bottle: <><path d="M10 2h4v4l2 3v12a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V9l2-3z" /><path d="M8 13h8" /></>,
  fin: <path d="M3 17c4 0 7-2 9-10 1 5 4 9 9 10" />,
  rainbow: <><path d="M3 18a9 9 0 0 1 18 0" /><path d="M6.5 18a5.5 5.5 0 0 1 11 0" /></>,
  boot: <path d="M8 3h6v9l6 3v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-5l3-2z" />,
  amphora: <><path d="M10 2h4M10.5 2v3c-4 2-5 6-4 10l3 7h5l3-7c1-4 0-8-4-10V2" /><path d="M10.5 6c-3 0-4 2-4 4M13.5 6c3 0 4 2 4 4" /></>,
  pearl: <><circle cx="12" cy="13" r="6" /><circle cx="10" cy="11" r="1.5" /></>,
  locket: <><path d="M12 2v5" /><path d="M12 7c-4 0-6 3-6 7s3 7 6 7 6-3 6-7-2-7-6-7Z" /><path d="M9 14h6" /></>,
  watch: <><circle cx="12" cy="13" r="7" /><path d="M12 13V9.5M12 13l2.5 1.5M10 3h4M12 3v3" /></>,
  shell: <path d="M12 21a9 9 0 1 1 8.5-12A6 6 0 1 1 12 15a3 3 0 1 1 3-3" />,
  chest: <><rect x="3" y="9" width="18" height="11" rx="1" /><path d="M3 9a9 5 0 0 1 18 0M3 13h18" /><rect x="10.5" y="12" width="3" height="3" /></>,
  idol: <><path d="M8 21V9a4 4 0 0 1 8 0v12z" /><path d="M10 10h1M13 10h1M10 15h4M8 21h8" /></>,
  amber: <path d="M7 4l10 1 3 8-6 8-9-2-2-8z" />,
  leaf: <><path d="M5 19C5 10 11 5 20 4c-1 9-6 15-15 15Z" /><path d="M5 19l8-8" /></>,
  hand: <><path d="M7 11V6a1.5 1.5 0 0 1 3 0v4M10 10V4.5a1.5 1.5 0 0 1 3 0V10M13 10V5.5a1.5 1.5 0 0 1 3 0V11M16 11V8a1.5 1.5 0 0 1 3 0v6a7 7 0 0 1-7 7h-1a6 6 0 0 1-5-3l-2.5-4.5a1.5 1.5 0 0 1 2.5-1.5L7 14" /></>,
  heart: <path d="M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11Z" />,
  scale: <><path d="M12 3v18M6 21h12M4 7h16" /><path d="M4 7l-2 6a3 3 0 0 0 4 0zM20 7l-2 6a3 3 0 0 0 4 0z" /></>,
  hourglass: <><path d="M6 3h12M6 21h12M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9" /></>,
  arm: <><path d="M4 16c2-6 5-9 9-9 2 0 3 1 3 3l4-1v4c-3 2-7 5-12 5z" /></>,
  clover: <><circle cx="9" cy="9" r="3.2" /><circle cx="15" cy="9" r="3.2" /><circle cx="9" cy="15" r="3.2" /><circle cx="15" cy="15" r="3.2" /><path d="M15 15l5 6" /></>,
  sonar: <><path d="M12 20V11" /><path d="M8 14a4 4 0 0 1 8 0M5 12a7 7 0 0 1 14 0M2 10a10 10 0 0 1 20 0" /></>,
  arrowL: <path d="M15 5l-7 7 7 7" />,
  arrowR: <path d="M9 5l7 7-7 7" />,
  thermo: <><path d="M10 14V4a2 2 0 0 1 4 0v10a4 4 0 1 1-4 0Z" /><path d="M12 9v7" /></>,
  wind: <path d="M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h8" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  pin: <><path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12Z" /><circle cx="12" cy="9" r="2.5" /></>,
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, ...rest }: P & { name: string }) {
  return <Svg {...rest}>{PATHS[name] ?? PATHS.sparkle}</Svg>;
}

export const WEATHER_ICON: Record<WeatherId, string> = { clear: "sun", cloudy: "cloud", rain: "rain", storm: "storm", fog: "fog", snow: "snow" };
export const EVENT_ICON: Record<string, string> = {
  shoal: "fish", gulls: "bird", plankton: "sparkle", whale: "whale", ghost_ship: "ship", meteor: "meteor",
  current: "wave", calm: "line", bottle: "bottle", dolphins: "fin", rainbow: "rainbow",
  calving: "snow", eruption: "meteor", spawnrun: "fish", tide: "wave",
};
export const FIND_ICON: Record<string, string> = {
  boot: "boot", bottle_rum: "bottle", anchor: "anchor", compass: "compass", amphora: "amphora", amber: "amber", pearl: "pearl",
  doubloon: "coin", locket: "locket", watch: "watch", nautilus: "shell", meteorite: "meteor", chest: "chest", idol: "idol",
  coin_cossack: "coin", obsidian: "amber", whale_bone: "fin", sextant: "compass",
};
export const PERK_ICON: Record<string, string> = {
  hands: "hand", grip: "arm", patience: "hourglass", stamina: "heart", luck: "clover", trader: "scale", scout: "compass", cooler: "basket", navigator: "map", weather: "cloud",
};

/** Фаза луны 0..7 — точная SVG-отрисовка */
export function MoonIcon({ phase, size = 16 }: { phase: number; size?: number }) {
  const p = phase / 8;
  const k = Math.cos(p * Math.PI * 2);
  const waxing = p <= 0.5;
  const r = 8;
  const rx = Math.abs(k) * r;
  const lit = phase === 0 ? "" : phase === 4 ? `M12 4a8 8 0 1 1 0 16a8 8 0 1 1 0-16Z` : `M12 4 A8 8 0 0 ${waxing ? 1 : 0} 12 20 A${rx} 8 0 0 ${waxing ? (k > 0 ? 0 : 1) : k > 0 ? 1 : 0} 12 4Z`;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r={r} fill="rgba(230,225,214,0.08)" stroke="rgba(230,225,214,0.45)" strokeWidth="1" />
      {lit && <path d={lit} fill="rgba(236,230,212,0.92)" />}
    </svg>
  );
}

// ───────────── снасти ─────────────
const GEAR_PATHS: Record<string, ReactNode> = {
  rod: (
    <>
      <path d="M3.5 20.5L18.5 3.5" />
      <path d="M18.5 3.5c1.2 5.5.4 10.5-2.6 14.3" strokeDasharray="1.6 1.4" />
      <circle cx="7.2" cy="16.4" r="2.1" />
      <path d="M4.2 18.4l2.4-2.3" strokeWidth="2.2" />
      <path d="M11 12.6l.9.9M13.8 9.4l.9.9M16.3 6.6l.8.8" />
    </>
  ),
  reel: (
    <>
      <circle cx="11" cy="12.5" r="6.5" />
      <circle cx="11" cy="12.5" r="2.2" />
      <path d="M11 6v-2.5h3.5M17.5 12.5H21M19.5 10.5v4" />
      <path d="M7.2 8.7l1.6 1.6M14.8 16.3l-1.6-1.6" />
    </>
  ),
  line: (
    <>
      <ellipse cx="12" cy="6" rx="7" ry="2.5" />
      <path d="M5 6v11c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6" />
      <path d="M5 9.5c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5M5 13c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5" strokeOpacity="0.55" />
    </>
  ),
  hook: (
    <>
      <circle cx="12" cy="3.6" r="1.4" />
      <path d="M12 5v10.5a4 4 0 1 1-8 0v-1.2" />
      <path d="M4 14.3l2.6-2.1" />
      <path d="M15 8.5l3-1.5M15 11l3.2-.8" strokeOpacity="0.5" />
    </>
  ),
  sonar: (
    <>
      <rect x="4" y="3.5" width="16" height="12" rx="1" />
      <path d="M6.5 12.5c2-1 3-3 5.5-3s3.5 2 5.5 3" />
      <path d="M8 7.2h.01M13 6.4h.01M16 8.2h.01" strokeWidth="2.4" />
      <path d="M12 15.5v3M8 20.5h8" />
    </>
  ),
};
export function GearIcon({ kind, size = 20, className }: { kind: "rod" | "reel" | "line" | "hook" | "sonar"; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {GEAR_PATHS[kind]}
    </svg>
  );
}

// ───────────── наживки (цветные) ─────────────
export function BaitIcon({ id, size = 20, className }: { id: string; size?: number; className?: string }) {
  const s = { width: size, height: size, viewBox: "0 0 24 24", className, "aria-hidden": true } as const;
  const hook = <path d="M12 2.5v6" stroke="#b8bcc2" strokeWidth="1.1" fill="none" strokeLinecap="round" />;
  switch (id) {
    case "worm":
      return (
        <svg {...s}>
          <path d="M4 16c2-5 5 3 8-2s5-6 8-1" stroke="#c8766a" strokeWidth="3.2" fill="none" strokeLinecap="round" />
          <path d="M4 16c2-5 5 3 8-2s5-6 8-1" stroke="#e8a898" strokeWidth="1" fill="none" strokeLinecap="round" strokeDasharray="0.6 2.2" />
          <circle cx="20" cy="13" r="1.1" fill="#b85a4e" />
        </svg>
      );
    case "mussel":
      return (
        <svg {...s}>
          <path d="M5 18C4 12 8 5 13 4c4-.8 6.5 2 6 5-.8 5-7 10-14 9Z" fill="#2c3048" />
          <path d="M7 16c2-4 5-8 10-9" stroke="#5a6088" strokeWidth="0.9" fill="none" />
          <path d="M9 17c1.5-3 4-6 8-7.5" stroke="#5a6088" strokeWidth="0.7" fill="none" />
          <path d="M12 9c1.8-1 3.5-.8 4 .6.6 1.8-1.8 3.5-4 3.8-2 .3-1.6-3.3 0-4.4Z" fill="#e8a070" />
        </svg>
      );
    case "shrimp":
      return (
        <svg {...s}>
          <path d="M18 6c-6-2-12 2-12 8 0 3 2 5 4 5" stroke="#f0a080" strokeWidth="3.4" fill="none" strokeLinecap="round" />
          <path d="M16 7.2l-.8 2.6M12.5 7.2l.2 2.7M9.5 9l1 2.4M7.6 12l1.8 1.6" stroke="#c87050" strokeWidth="0.9" />
          <path d="M10 19l-2 2.5M10 19l2.5 1.8M18.5 5.5l3-2.5M18.2 6.5l3.5 0" stroke="#e8906a" strokeWidth="0.8" strokeLinecap="round" />
          <circle cx="17.2" cy="6.4" r="0.8" fill="#201010" />
        </svg>
      );
    case "spoon":
      return (
        <svg {...s}>
          {hook}
          <circle cx="12" cy="9" r="1" fill="none" stroke="#b8bcc2" strokeWidth="0.9" />
          <path d="M12 10c3.6 0 5 3.2 4.4 6.3-.6 3-2.6 4.8-4.4 4.8S8.2 19.3 7.6 16.3C7 13.2 8.4 10 12 10Z" fill="#d6d9e0" />
          <path d="M10 13c1-1 3-1.2 4.4 0" stroke="#ffffff" strokeWidth="1" fill="none" opacity="0.8" />
          <path d="M12 21v1.8M10.8 22.4l1.2-1 1.2 1" stroke="#b8bcc2" strokeWidth="0.9" fill="none" />
        </svg>
      );
    case "livebait":
      return (
        <svg {...s}>
          <path d="M3.5 12c3-4 9-4.5 13-1.8l4-2.7v9l-4-2.7c-4 2.7-10 2.2-13-1.8Z" fill="#8aa6b6" />
          <path d="M3.5 12c3 4 9 4.5 13 1.8" stroke="#e8f0f4" strokeWidth="1" fill="none" />
          <circle cx="7" cy="11" r="0.9" fill="#101418" />
          <path d="M10 12.5c1 1.5 3 1.8 4.5 1" stroke="#b8bcc2" strokeWidth="0.9" fill="none" />
        </svg>
      );
    case "cutbait":
      return (
        <svg {...s}>
          <path d="M4 15l6-8h8l-4 9H6Z" fill="#c8b0a4" />
          <path d="M10 7l-2.5 8.5M14 7l-2 9" stroke="#8a6a60" strokeWidth="0.8" />
          <path d="M4 15l6-8" stroke="#6a7a90" strokeWidth="1.6" />
          <path d="M8 18c2 1.5 6 1.5 8 .5" stroke="#b8a098" strokeWidth="0.9" fill="none" strokeDasharray="0.8 1.6" />
        </svg>
      );
    case "wobbler":
      return (
        <svg {...s}>
          <path d="M3 12c2-3.2 6-4.2 10-3.4 3.4.7 5.2 2 5.2 3.4s-1.8 2.7-5.2 3.4C9 16.2 5 15.2 3 12Z" fill="#f0c040" />
          <path d="M11 8.6c2 .2 4 1 5 2.2" stroke="#2a6a3a" strokeWidth="2.2" fill="none" />
          <path d="M3 12l-1.5 3.6 3.5-2" fill="#d8dce0" />
          <circle cx="15.2" cy="11.4" r="1" fill="#101418" />
          <path d="M9 15.4l-.6 2.2M9 15.4l1 2M16 14.6l-.4 2.2M16 14.6l1 1.9" stroke="#b8bcc2" strokeWidth="0.8" fill="none" />
          <path d="M18.2 12h2.6" stroke="#b8bcc2" strokeWidth="0.9" />
        </svg>
      );
    case "jig":
      return (
        <svg {...s}>
          <circle cx="7.5" cy="10" r="3.4" fill="#5a5e66" />
          <circle cx="6.6" cy="9.2" r="0.9" fill="#f0d040" />
          <path d="M10.5 11c3 0 5 .5 6.5 2l3.5-1.6-1.8 3 2 2.4-3.7-.9c-2 1.4-4.5 1.2-6.5.4" fill="#6a9a5a" />
          <path d="M7.5 6.6V3" stroke="#b8bcc2" strokeWidth="0.9" />
          <path d="M9 13.2c.4 2.6-.6 4.4-2.4 4.6" stroke="#b8bcc2" strokeWidth="1" fill="none" />
        </svg>
      );
    case "squid":
      return (
        <svg {...s}>
          <path d="M12 2.5c3 2 3.6 5 3.2 8.5H8.8C8.4 7.5 9 4.5 12 2.5Z" fill="#e0c0d0" />
          <path d="M8.8 11l-2 2 2-0.6M15.2 11l2 2-2-0.6" fill="#e0c0d0" />
          <path d="M9.5 11c-.6 4-.8 7-2.2 10M11 11c0 4-.4 7-.9 10.5M13 11c0 4 .4 7 .9 10.5M14.5 11c.6 4 .8 7 2.2 10" stroke="#d8b0c4" strokeWidth="1.2" fill="none" strokeLinecap="round" />
          <circle cx="10.6" cy="8.6" r="0.9" fill="#301020" />
          <circle cx="13.4" cy="8.6" r="0.9" fill="#301020" />
          <path d="M10 5.5c1.3-.8 2.7-.8 4 0" stroke="#b890a8" strokeWidth="0.6" fill="none" />
        </svg>
      );
    case "glow":
      return (
        <svg {...s}>
          <defs>
            <radialGradient id={`glowg${size}`} cx="50%" cy="50%" r="50%">
              <stop offset="0" stopColor="#e8fff6" />
              <stop offset="0.4" stopColor="#60ffd0" />
              <stop offset="1" stopColor="#60ffd0" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="12" cy="13" r="9" fill={`url(#glowg${size})`} opacity="0.55" />
          <rect x="9" y="7" width="6" height="12" rx="3" fill="#2a3a36" stroke="#60ffd0" strokeWidth="0.8" />
          <rect x="10.2" y="8.6" width="3.6" height="8.8" rx="1.8" fill="#80ffe0" />
          <path d="M12 7V3" stroke="#b8bcc2" strokeWidth="0.9" />
        </svg>
      );
    default:
      return <Icon name="hook" size={size} className={className} />;
  }
}

// ───────────── прочее ─────────────
export function MiscIcon({ name, size = 16, className }: { name: "fuel" | "fresh" | "port" | "bed" | "rumor" | "demand"; size?: number; className?: string }) {
  const p: Record<string, ReactNode> = {
    fuel: <><path d="M5 20V5a1.5 1.5 0 0 1 1.5-1.5h6A1.5 1.5 0 0 1 14 5v15M3.5 20h12" /><path d="M7 7.5h5v3.5H7z" /><path d="M14 9h2a1.5 1.5 0 0 1 1.5 1.5v6a1.5 1.5 0 0 0 3 0V8l-2.5-2.5" /></>,
    fresh: <><path d="M12 3v18M4.5 7.5l15 9M4.5 16.5l15-9" /><path d="M10 4.5l2 1.5 2-1.5M10 19.5l2-1.5 2 1.5" /></>,
    port: <><circle cx="12" cy="5" r="2" /><path d="M12 7v13M7.5 10h9M5 14a7 7 0 0 0 14 0" /><path d="M3.5 14h3M17.5 14h3" /><path d="M2 21.5c2-1 4-1 6 0s4 1 6 0 4-1 6 0" strokeOpacity="0.6" /></>,
    bed: <><path d="M3 18V7M3 13h18v5M21 18v2M3 18v2" /><circle cx="7.5" cy="10.5" r="1.5" /><path d="M11 13v-2.5h7a3 3 0 0 1 3 3" /></>,
    rumor: <><path d="M4 5h16v10H9l-5 4z" /><path d="M8 9h8M8 12h5" /></>,
    demand: <><path d="M4 18l5-6 4 3 7-9" /><path d="M15 6h5v5" /></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {p[name]}
    </svg>
  );
}
