"use client";

import type { CSSProperties } from "react";

/**
 * Сцена входа в игру. Это небольшой векторный «живой экран», а не иллюстрация:
 * несколько планов двигаются с разной скоростью, а лодка, рыба, волны и свет
 * создают ощущение настоящего игрового мира. Картинок и внешних библиотек нет.
 */
export function AuthScene({ mode = "login" }: { mode?: "login" | "register" }) {
  const home = mode === "login";
  const palette = home
    ? {
        top: "#070b1a",
        mid: "#1b2742",
        horizon: "#714955",
        glow: "#f0a05f",
        waterTop: "#20344d",
        waterBottom: "#07111d",
        land: "#101b25",
        boat: "#6f4c32",
        trim: "#d1a76b",
        fish: "#527d92",
      }
    : {
        top: "#071221",
        mid: "#17405b",
        horizon: "#b87859",
        glow: "#ffd38e",
        waterTop: "#1b5268",
        waterBottom: "#06131e",
        land: "#172b2b",
        boat: "#7b5233",
        trim: "#e0bd78",
        fish: "#609c8d",
      };
  const boatStyle = { "--zv-auth-boat-dir": home ? -1 : 1 } as CSSProperties;

  return (
    <svg
      className="zv-scene"
      viewBox="0 0 640 460"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="zv-auth-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={palette.top} />
          <stop offset="0.52" stopColor={palette.mid} />
          <stop offset="0.82" stopColor={palette.horizon} />
          <stop offset="1" stopColor="#d18a5d" />
        </linearGradient>
        <linearGradient id="zv-auth-water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={palette.waterTop} />
          <stop offset="0.45" stopColor="#102b3e" />
          <stop offset="1" stopColor={palette.waterBottom} />
        </linearGradient>
        <linearGradient id="zv-auth-hull" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={palette.boat} />
          <stop offset="0.7" stopColor="#3c281f" />
          <stop offset="1" stopColor="#161118" />
        </linearGradient>
        <linearGradient id="zv-auth-cabin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d3b57f" />
          <stop offset="1" stopColor="#806042" />
        </linearGradient>
        <linearGradient id="zv-auth-cloud" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b7c4d6" stopOpacity="0.28" />
          <stop offset="1" stopColor="#56667d" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="zv-auth-sun-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#fff7dc" stopOpacity="0.98" />
          <stop offset="0.22" stopColor={palette.glow} stopOpacity="0.82" />
          <stop offset="1" stopColor={palette.glow} stopOpacity="0" />
        </radialGradient>
        <linearGradient id="zv-auth-light-road" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={palette.glow} stopOpacity="0.46" />
          <stop offset="1" stopColor={palette.glow} stopOpacity="0" />
        </linearGradient>
        <linearGradient id="zv-auth-glass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#d7f0ed" stopOpacity="0.75" />
          <stop offset="1" stopColor="#60949c" stopOpacity="0.35" />
        </linearGradient>
        <filter id="zv-auth-soft-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
      </defs>

      {/* Небо и дальний свет */}
      <rect width="640" height="286" fill="url(#zv-auth-sky)" />
      <g className="zv-auth-orb">
        <circle cx="500" cy={home ? 98 : 188} r="66" fill="url(#zv-auth-sun-glow)" filter="url(#zv-auth-soft-glow)" />
        <circle cx="500" cy={home ? 98 : 188} r={home ? 22 : 27} fill="#fff5d9" opacity="0.96" />
        {home && <circle cx="493" cy="91" r="3" fill="#d5bcaa" opacity="0.45" />}
        {home && <circle cx="510" cy="106" r="2" fill="#d5bcaa" opacity="0.35" />}
      </g>

      {/* Звёздная карта: на рассвете они почти исчезают */}
      <g fill="#fff5dc" opacity={home ? 0.82 : 0.22}>
        {[
          [38, 44, 1.4], [87, 82, 1], [136, 31, 1.2], [185, 68, 0.8], [238, 38, 1.1],
          [286, 94, 0.8], [342, 54, 1.3], [404, 30, 0.8], [452, 74, 1], [556, 45, 1.1],
          [605, 116, 0.8], [75, 142, 0.7], [260, 132, 0.65], [384, 122, 0.75],
        ].map(([cx, cy, r], i) => (
          <circle key={i} cx={cx} cy={cy} r={r} className="zv-auth-star" style={{ animationDelay: `${(i * 0.37).toFixed(2)}s` }} />
        ))}
      </g>

      {/* Облака создают глубину и медленно проходят перед светом */}
      <g className="zv-auth-cloud zv-auth-cloud-back" opacity={home ? 0.28 : 0.2}>
        <path d="M-80 145c55-30 88-13 119-28 36-18 69-3 73 15 48-12 82 2 91 25H-80z" fill="url(#zv-auth-cloud)" />
      </g>
      <g className="zv-auth-cloud zv-auth-cloud-front" opacity={home ? 0.2 : 0.3}>
        <path d="M300 178c38-25 66-9 88-21 32-17 62-2 69 17 35-10 83 3 99 25H268z" fill="url(#zv-auth-cloud)" />
      </g>

      {/* Дальний берег, маяк и горы */}
      <path d="M0 246 70 217l32 15 45-32 57 34 52-23 52 24 54-18 61 29 56-20 57 20 66-30 38 24v58H0z" fill="#182536" opacity="0.72" />
      <path d="M0 255c62-17 111-15 163 1 44 13 83-2 126 4 58 8 95-13 147-2 66 14 125-7 204 2v34H0z" fill={palette.land} opacity="0.92" />
      <g className="zv-auth-lighthouse" transform="translate(104 202)">
        <path d="M-9 54 0-2 9 54z" fill="#24333d" />
        <rect x="-6" y="11" width="12" height="6" fill="#d9d5c5" opacity="0.82" />
        <rect x="-7" y="-8" width="14" height="7" rx="1" fill="#d7d0bd" />
        <path d="M-11-9h22" stroke="#241b1c" strokeWidth="2" />
        <circle cx="0" cy="-5" r="3" fill={palette.glow} className="zv-auth-lantern" />
        <path d="M0-5 63-24M0-5 53 16" stroke={palette.glow} strokeOpacity="0.12" strokeWidth="7" />
      </g>
      <g fill="#0b121d" opacity="0.55">
        <path d="M170 232q13-16 27 0v8h-27z" />
        <path d="M185 226q10-12 20 0v7h-20z" />
        <path d="M550 231q14-15 28 0v8h-28z" />
      </g>

      {/* Слой воды */}
      <rect y="270" width="640" height="190" fill="url(#zv-auth-water)" />
      <path d="M0 271q34-10 68 0t68 0 68 0 68 0 68 0 68 0 68 0 68 0 68 0 68 0 68 0v36H0z" fill="#31566a" opacity="0.48" className="zv-auth-wave zv-auth-wave-far" />
      <path d="M-80 292q37-13 74 0t74 0 74 0 74 0 74 0 74 0 74 0 74 0 74 0 74 0 74 0 74 0v52H-80z" fill="#15384d" opacity="0.8" className="zv-auth-wave zv-auth-wave-mid" />
      <path d="M-120 326q32-14 64 0t64 0 64 0 64 0 64 0 64 0 64 0 64 0 64 0 64 0 64 0 64 0v70h-640z" fill="#0b1c2b" className="zv-auth-wave zv-auth-wave-near" />

      {/* Световая дорожка */}
      <path d="M455 271h92c-8 60-15 116-43 189h-47c-9-75-7-129-2-189z" fill="url(#zv-auth-light-road)" opacity="0.5" />
      <g className="zv-auth-reflection" fill="#ffe0a0">
        {[
          [460, 282, 46], [507, 296, 31], [446, 313, 63], [493, 334, 38], [452, 358, 52],
          [506, 382, 28], [463, 412, 45], [518, 438, 22],
        ].map(([x, y, w], i) => <rect key={i} x={x} y={y} width={w} height={2 + (i % 2)} rx="1" style={{ animationDelay: `${i * 0.27}s` }} />)}
      </g>

      {/* Птицы */}
      <g className="zv-auth-birds" style={{ animationDuration: home ? "34s" : "27s" }}>
        {[0, 38, 74].map((dx, i) => (
          <g key={i} transform={`translate(${232 + dx} ${142 + (i % 2) * 13})`} opacity={0.6 - i * 0.1}>
            <path d="M-12 1q12-9 24 0" fill="none" stroke="#172133" strokeWidth="2" strokeLinecap="round" className="zv-auth-wing" style={{ animationDelay: `${i * 0.17}s` }} />
            <path d="M12 1q12-9 24 0" fill="none" stroke="#172133" strokeWidth="2" strokeLinecap="round" className="zv-auth-wing" style={{ animationDelay: `${i * 0.17 + 0.09}s` }} />
          </g>
        ))}
      </g>

      {/* Подводный мир: водоросли, пузырьки и рыба */}
      <g opacity="0.5" stroke="#4d8d82" strokeWidth="2" fill="none" className="zv-auth-kelp">
        <path d="M44 460q-8-50 8-91t-4-55M66 460q12-58-2-94t16-64M604 460q-10-62 6-104t-7-60M580 460q8-46-5-83t11-60" />
      </g>
      <g fill="#a8d9d3">
        {[[78, 425, 3], [124, 388, 2], [160, 440, 2.4], [244, 416, 2], [558, 404, 3], [612, 368, 2.4]].map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} className="zv-auth-bubble" style={{ animationDelay: `${i * 0.62}s`, animationDuration: `${6 + (i % 3)}s` }} />
        ))}
      </g>
      <g transform="translate(0 386)" opacity="0.92">
        <g className="zv-auth-fish">
          <g className="zv-auth-fish-inner">
            <path d="M-42 0-64-14v28z" fill={palette.fish} />
            <path d="M-42 0c17-17 48-17 69-1-20 17-49 16-69 1z" fill={palette.fish} />
            <path d="M-26-7q18-11 35-1" fill="none" stroke="#abd3c8" strokeOpacity="0.5" strokeWidth="3" />
            <circle cx="20" cy="-4" r="3" fill="#07131d" />
            <path d="M-4-13q8-13 18-2" fill="none" stroke="#427466" strokeWidth="3" />
          </g>
        </g>
      </g>

      {/* Блики у поверхности */}
      <g fill="none" stroke="#d9eff0" strokeLinecap="round" opacity="0.38" className="zv-auth-surface-glints">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <path key={i} d={`M${20 + i * 118} ${278 + (i % 2) * 9}h${38 + (i % 3) * 13}`} />
        ))}
      </g>

      {/* Лодка рыбака — центральный игровой акцент */}
      <g transform="translate(326 296)" style={boatStyle}>
        <g className={`zv-auth-boat-motion ${home ? "zv-auth-boat-return" : "zv-auth-boat-out"}`}>
          <g className="zv-auth-boat-bob">
            <ellipse cx="0" cy="36" rx="92" ry="10" fill="#020910" opacity="0.48" />
            <path d="M-80-2q10 30 78 34 66-4 82-34l-8 27q-21 25-74 27-55-2-71-27z" fill="url(#zv-auth-hull)" stroke="#1c1718" strokeWidth="2" />
            <path d="M-78-2q29 8 78 8t78-8" fill="none" stroke={palette.trim} strokeWidth="3" />
            <path d="M-65 11q28 10 65 11t65-11" fill="none" stroke="#9f6b43" strokeOpacity="0.7" strokeWidth="2" />
            <path d="M-36-5h62l10-31h-47z" fill="url(#zv-auth-cabin)" stroke="#31251e" strokeWidth="2" />
            <path d="M-18-8h17v-18h-17zM6-8h18v-18H6z" fill="url(#zv-auth-glass)" stroke="#302a26" strokeWidth="2" />
            <path d="M-42-37h76" stroke="#e1c58b" strokeWidth="3" strokeLinecap="round" />
            <path d="M-6-38v-91" stroke="#2b2421" strokeWidth="4" strokeLinecap="round" />
            <path d="M-5-124q22 8 33 0v12q-16 6-33 0z" fill={home ? "#c97855" : "#79b49c"} />
            {/* рыбак и удилище */}
            <circle cx="-53" cy="-25" r="8" fill="#10161e" />
            <path d="M-61-17q9 6 16 21h-19q-3-10 3-21z" fill="#151b23" />
            <path d="M-47-20-4-78" stroke="#141922" strokeWidth="3" strokeLinecap="round" />
            <path d="M-4-78q24 75 32 125" fill="none" stroke="#dce5e1" strokeOpacity="0.65" strokeWidth="1" />
            <circle cx="29" cy="34" r="4" fill={palette.glow} className="zv-auth-float" />
            {/* бортовой фонарь */}
            <circle cx="-34" cy="-40" r="22" fill={palette.glow} opacity="0.22" className="zv-auth-lantern" />
            <circle cx="-34" cy="-40" r="5" fill="#fff0bd" className="zv-auth-lantern" />
            <path d="M-41-49h14" stroke="#fff4d6" strokeOpacity="0.75" strokeWidth="2" />
          </g>
        </g>
      </g>

      {/* Кильватер лодки и передний слой волн */}
      <g className={`zv-auth-wake ${home ? "zv-auth-wake-return" : "zv-auth-wake-out"}`} fill="none" stroke="#d7eef0" strokeLinecap="round">
        <path d="M236 329q-42 10-93 0t-94 7" strokeWidth="3" opacity="0.6" />
        <path d="M238 337q-52 22-103 11t-85 8" strokeWidth="1.5" opacity="0.42" />
        <path d="M412 329q48 13 104 3t95 8" strokeWidth="2" opacity="0.34" />
      </g>
      <path d="M0 397q36-16 72 0t72 0 72 0 72 0 72 0 72 0 72 0 72 0 72 0 72 0v63H0z" fill="#06121e" opacity="0.82" className="zv-auth-wave zv-auth-wave-front" />
      <g fill="none" stroke="#6fa8ae" strokeLinecap="round" opacity="0.32">
        <path d="M20 416h85m28-12h64m64 24h93m42-17h76m30 14h75" />
        <path d="M56 443h110m46-11h70m52 19h118" />
      </g>
    </svg>
  );
}
