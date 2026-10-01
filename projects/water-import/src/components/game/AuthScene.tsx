"use client";

/**
 * Сцена входа: знакомая вода на закате (вход) или на рассвете (регистрация).
 *
 * Всё нарисовано вектором прямо здесь — ни картинок, ни внешних библиотек.
 * Двигаются только transform и opacity, поэтому анимация не грузит процессор
 * даже на телефоне. При системной настройке «меньше движения» она замирает
 * (см. .zv-scene в globals.css).
 */
export function AuthScene({ mode = "login" }: { mode?: "login" | "register" }) {
  const home = mode === "login"; // вход — лодка возвращается домой, регистрация — уходит в море
  const sky = home ? "url(#zv-sky-home)" : "url(#zv-sky-out)";
  const glow = home ? "#ffb066" : "#ffd79a";
  const boat = home ? "translate(196 252) scale(-1 1)" : "translate(196 252)";

  return (
    <svg className="zv-scene" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="zv-sky-home" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#070d1c" />
          <stop offset="46%" stopColor="#1b2740" />
          <stop offset="78%" stopColor="#5c3f45" />
          <stop offset="100%" stopColor="#b9713f" />
        </linearGradient>
        <linearGradient id="zv-sky-out" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#050b18" />
          <stop offset="44%" stopColor="#152a44" />
          <stop offset="76%" stopColor="#3f5566" />
          <stop offset="100%" stopColor="#c78a54" />
        </linearGradient>
        <radialGradient id="zv-sun" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff4dd" stopOpacity="0.98" />
          <stop offset="45%" stopColor={glow} stopOpacity="0.75" />
          <stop offset="100%" stopColor={glow} stopOpacity="0" />
        </radialGradient>
        <linearGradient id="zv-water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={home ? "#243349" : "#1c2c40"} />
          <stop offset="55%" stopColor="#0d1725" />
          <stop offset="100%" stopColor="#050a12" />
        </linearGradient>
        <linearGradient id="zv-wash" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={glow} stopOpacity="0.5" />
          <stop offset="100%" stopColor={glow} stopOpacity="0" />
        </linearGradient>
        <linearGradient id="zv-hull" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2f2a26" />
          <stop offset="100%" stopColor="#120f0d" />
        </linearGradient>
        <linearGradient id="zv-sail" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f4ead6" />
          <stop offset="100%" stopColor="#cbb894" />
        </linearGradient>
        <linearGradient id="zv-sail-back" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ded0b4" />
          <stop offset="100%" stopColor="#a38f6d" />
        </linearGradient>
      </defs>

      {/* небо */}
      <rect x="0" y="0" width="400" height="252" fill={sky} />

      {/* звёзды */}
      <g fill="#fdf6e6">
        {[
          [34, 34, 1.1], [72, 62, 0.8], [118, 26, 1], [166, 74, 0.7], [206, 38, 0.9],
          [252, 66, 0.75], [296, 28, 1.05], [338, 58, 0.8], [372, 96, 0.7], [46, 116, 0.75],
          [150, 128, 0.6], [268, 118, 0.65],
        ].map(([cx, cy, r], i) => (
          <circle key={i} cx={cx} cy={cy} r={r} className="zv-star" style={{ animationDelay: `${(i * 0.53).toFixed(2)}s` }} />
        ))}
      </g>

      {/* солнце и его дорожка на воде */}
      <g className="zv-sun">
        <circle cx="300" cy="228" r="66" fill="url(#zv-sun)" />
        <circle cx="300" cy="228" r="17" fill="#fff6e4" opacity="0.92" />
      </g>
      <rect x="252" y="254" width="96" height="86" fill="url(#zv-wash)" opacity="0.5" />

      {/* птицы */}
      <g className="zv-bird" style={{ animationDuration: home ? "30s" : "24s" }}>
        {[0, 34].map((dx, i) => (
          <g key={i} transform={`translate(${96 + dx} ${102 + i * 12})`}>
            <path d="M-9 0q9-6 18 0" fill="none" stroke="#1b2536" strokeWidth="1.7" strokeLinecap="round" className="zv-wing" style={{ animationDelay: `${i * 0.22}s` }} />
            <path d="M9 0q9-6 18 0" fill="none" stroke="#1b2536" strokeWidth="1.7" strokeLinecap="round" className="zv-wing" style={{ animationDelay: `${i * 0.22 + 0.08}s` }} />
          </g>
        ))}
      </g>

      {/* вода: три слоя волн с разной скоростью */}
      <rect x="0" y="248" width="400" height="152" fill="url(#zv-water)" />
      <g opacity="0.55">
        <path className="zv-wave zv-wave-far" fill="#2b3d55" d="M-100 252q25-7 50 0t50 0t50 0t50 0t50 0t50 0t50 0t50 0t50 0t50 0t50 0t50 0t50 0t50 0t50 0t50 0t50 0t50 0t50 0V400H-100Z" />
      </g>
      <path className="zv-wave zv-wave-mid" fill="#1a2739" d="M-100 272q25-9 50 0t50 0t50 0t50 0t50 0t50 0t50 0t50 0t50 0t50 0t50 0t50 0t50 0t50 0t50 0t50 0t50 0t50 0t50 0V400H-100Z" />
      <path className="zv-wave zv-wave-near" fill="#0b1420" d="M-100 300q25-11 50 0t50 0t50 0t50 0t50 0t50 0t50 0t50 0t50 0t50 0t50 0t50 0t50 0t50 0t50 0t50 0t50 0t50 0t50 0V400H-100Z" />

      {/* дорожка солнечного света: короткие блики движутся по воде */}
      <g fill="#ffd9a0">
        {[[268, 262, 26], [286, 276, 18], [258, 290, 22], [292, 306, 14], [272, 322, 20]].map(([x, y, w], i) => (
          <rect key={i} x={x} y={y} width={w} height="1.8" rx="0.9" className="zv-shimmer" style={{ animationDelay: `${i * 0.42}s` }} />
        ))}
      </g>
      <g fill="none" stroke="#fff0d1" strokeLinecap="round" strokeWidth="1.2">
        {[
          [281, 268, 23], [275, 284, 15], [292, 300, 19], [263, 315, 13],
        ].map(([x, y, w], i) => (
          <path key={i} d={`M${x} ${y}h${w}`} className="zv-light-ripple" style={{ animationDelay: `${i * 0.8}s` }} />
        ))}
      </g>

      {/* пузырьки */}
      <g fill="#bcd8e6">
        {[[84, 3.2, 0], [126, 2.2, 1.9], [196, 2.8, 3.4], [242, 2, 0.7], [316, 3.6, 2.6], [352, 2.4, 4.4]].map(([x, r, delay], i) => (
          <circle key={i} cx={x} cy="398" r={r} className="zv-bubble" style={{ animationDelay: `${delay}s`, animationDuration: `${7 + (i % 3)}s` }} opacity="0" />
        ))}
      </g>

      {/* рыба идёт под водой */}
      <g transform="translate(0 336)">
        <g className="zv-fish">
          <g className="zv-fish-inner">
            <path className="zv-tail" d="M-28 0l-13-9v18z" fill="#5f8f7d" />
            <path d="M-28 0c10-10 28-11 40-1-12 10-30 9-40 1z" fill="#8dbaa6" />
            <path d="M-10-4c8-4 18-3 24 2-8 3-18 3-24-2z" fill="#a9d0bd" opacity="0.55" />
            <circle cx="16" cy="-2.5" r="1.9" fill="#08121b" />
            <path d="M-2-7q6-7 12-1" fill="none" stroke="#6f9d8a" strokeWidth="1.6" />
          </g>
        </g>
      </g>

      {/* рыба выпрыгивает из воды */}
      <g transform="translate(326 300)">
        <circle cx="0" cy="0" r="7" fill="#cfe6f0" opacity="0.35" className="zv-splash" />
        <g className="zv-jump">
          <path className="zv-tail" d="M-16 0l-9-6v12z" fill="#6d9f8b" />
          <path d="M-16 0c7-7 19-8 27-1-8 7-20 7-27 1z" fill="#9cc9b4" />
          <circle cx="7" cy="-2" r="1.5" fill="#08121b" />
        </g>
      </g>

      {/* лодка: лёгкий дрейф в сторону выхода или возвращения */}
      <g transform={boat}>
        <g className="zv-boat-drift" style={{ animationDirection: home ? "reverse" : "normal" }}>
          <g className="zv-boat">
            <ellipse cx="0" cy="18" rx="52" ry="7" fill="#050a12" opacity="0.45" />
            <path d="M-46 0q7 17 46 17t46-17z" fill="url(#zv-hull)" />
            <path d="M-46 0h92" stroke="#6b5a44" strokeWidth="1.6" opacity="0.8" />
            <path d="M-2 0V-84" stroke="#241f1b" strokeWidth="3.2" strokeLinecap="round" />
            <path d="M1-80l44 70H1z" fill="url(#zv-sail)" opacity="0.96" />
            <path d="M-3-72l-34 64h34z" fill="url(#zv-sail-back)" opacity="0.85" />
            {/* рыбак на корме */}
            <circle cx="-26" cy="-16" r="6.2" fill="#0b0f16" />
            <path d="M-26-9q5 7 4 14h-9q-1-7 5-14z" fill="#0b0f16" />
            <path d="M-21-17l44-30" stroke="#161c27" strokeWidth="1.9" strokeLinecap="round" />
            <path d="M23-47q10 44 3 78" fill="none" stroke="#cdd9e4" strokeWidth="0.9" opacity="0.45" />
            <circle cx="26" cy="31" r="2.4" fill="#f0c98a" className="zv-float" />
            {/* фонарь на мачте */}
            <circle cx="0" cy="-42" r="13" fill={glow} opacity="0.22" className="zv-lantern" />
            <circle cx="0" cy="-42" r="3.1" fill="#ffe6b8" className="zv-lantern" />
          </g>
        </g>
      </g>
    </svg>
  );
}
