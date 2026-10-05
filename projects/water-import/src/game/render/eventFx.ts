import type { AtmosphereState, Palette, RGB } from '../atmosphere/types';
import type { FxId, FxSpec, VisibleEvent } from '../events/types';

/**
 * Визуальные эффекты событий. Всё процедурное: положение частиц — функция от индекса,
 * времени и seed события, поэтому нет ни массивов, ни сборки мусора.
 * Каждый эффект рисуется в своём слое сцены.
 */

export type Layer = 'sky' | 'horizon' | 'under' | 'surface' | 'front';

export interface FxScene {
  c: CanvasRenderingContext2D;
  t: number;
  W: number;
  H: number;
  s: number;
  q: 0 | 1 | 2;
  horizon: number;
  surface: number;
  seabed: number;
  visW: number;
  cam: number;
  windPx: number;
  sAt(x: number): number;
  glow(x: number, y: number, r: number, col: RGB, a: number): void;
  sun: { x: number; y: number };
  moon: { x: number; y: number };
  /** камни у мыса: [x, верх] */
  rocks: [number, number][];
  capeX: number;
  capeTop: number;
  rodTip: readonly [number, number];
  mast: readonly [number, number];
  lantern: readonly [number, number];
  boatX: number;
  A: AtmosphereState;
  pal: Palette;
}

export interface FxCall {
  e: VisibleEvent;
  spec: FxSpec;
  /** секунды реального времени с начала события */
  age: number;
}

type Draw = (S: FxScene, f: FxCall) => void;

const PI = Math.PI;
const TAU = PI * 2;
const h = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const css = (c: RGB, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const mix = (a: RGB, b: RGB, k: number): RGB => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const wrap = (v: number, m: number) => ((v % m) + m) % m;
const sd = (e: VisibleEvent, n = 0) => h((e.seed % 9973) * 0.137 + n);
const farY = (S: FxScene, p: number) => S.horizon + (S.surface - S.horizon) * p * p;
const zAt = (S: FxScene, p: number) => S.s * (0.18 + 0.82 * p);
const anchor = (S: FxScene, e: VisibleEvent, lo = 0.3, hi = 0.85) => S.visW * (lo + (hi - lo) * sd(e));

function tinyFish(c: CanvasRenderingContext2D, x: number, y: number, len: number, ang: number) {
  c.save();
  c.translate(x, y);
  c.rotate(ang);
  c.beginPath();
  c.ellipse(0, 0, len * 0.5, len * 0.17, 0, 0, TAU);
  c.moveTo(-len * 0.42, 0);
  c.lineTo(-len * 0.68, -len * 0.2);
  c.lineTo(-len * 0.68, len * 0.2);
  c.closePath();
  c.fill();
  c.restore();
}

function dolphin(c: CanvasRenderingContext2D, x: number, y: number, L: number, ang: number) {
  c.save();
  c.translate(x, y);
  c.rotate(ang);
  c.beginPath();
  c.moveTo(L * 0.5, 0);
  c.quadraticCurveTo(L * 0.3, -L * 0.16, -L * 0.1, -L * 0.14);
  c.quadraticCurveTo(-L * 0.35, -L * 0.1, -L * 0.45, -L * 0.02);
  c.lineTo(-L * 0.6, -L * 0.12);
  c.lineTo(-L * 0.55, 0);
  c.lineTo(-L * 0.6, L * 0.12);
  c.lineTo(-L * 0.45, L * 0.02);
  c.quadraticCurveTo(-L * 0.2, L * 0.12, L * 0.25, L * 0.08);
  c.quadraticCurveTo(L * 0.42, L * 0.05, L * 0.5, 0);
  c.moveTo(-L * 0.02, -L * 0.14);
  c.quadraticCurveTo(-L * 0.08, -L * 0.3, -L * 0.2, -L * 0.32);
  c.lineTo(-L * 0.16, -L * 0.12);
  c.fill();
  c.restore();
}

function ring(c: CanvasRenderingContext2D, x: number, y: number, rx: number, a: number) {
  c.globalAlpha = a;
  c.beginPath();
  c.ellipse(x, y, rx, rx * 0.18, 0, 0, TAU);
  c.stroke();
}

/* ─────────────── эффекты ─────────────── */

const FX: Record<FxId, Partial<Record<Layer, Draw>>> = {
  boil: {
    horizon: (S, { e, spec }) => {
      const { c, t } = S;
      const n = spec.n ?? 1;
      const cx = anchor(S, e);
      const p = 0.32 + 0.25 * sd(e, 1);
      const y = farY(S, p);
      const z = zAt(S, p);
      const w = 60 * z * (0.8 + n * 0.4);
      c.fillStyle = '#eef6ff';
      for (let i = 0; i < 14 * n; i++) {
        const ph = (t * (1.4 + h(i) * 0.8) + h(i + 3)) % 1;
        const x = cx + (h(i + 1) - 0.5) * w * 2;
        const ww = (2 + ph * 7) * z;
        c.globalAlpha = e.k * (1 - ph) * 0.7;
        c.fillRect(x - ww / 2, y - ph * 4 * z, ww, Math.max(1, 1.4 * z));
      }
      c.strokeStyle = '#eef6ff';
      c.lineWidth = 1;
      for (let i = 0; i < 5; i++) {
        const ph = (t * 0.6 + i / 5) % 1;
        ring(S.c, cx + (h(i + 9) - 0.5) * w, y + 1, (6 + ph * 30) * z, e.k * (1 - ph) * 0.35);
      }
      c.fillStyle = css(mix(S.pal.land1, [205, 215, 225], 0.35 + 0.45 * S.A.daylight));
      for (let i = 0; i < 5 * n; i++) {
        const per = 0.9 + h(i + 20) * 0.8;
        const ph = ((t + h(i + 21) * 5) / per) % 1;
        if (ph > 0.55) continue;
        const q = ph / 0.55;
        const dir = h(i + 23) < 0.5 ? -1 : 1;
        c.globalAlpha = e.k;
        tinyFish(c, cx + (h(i + 22) - 0.5) * w * 1.6 + (q - 0.5) * 16 * z * dir, y - Math.sin(q * PI) * 16 * z, 7 * z, (q - 0.5) * 2.4 * dir);
      }
      c.globalAlpha = 1;
    },
  },

  birds: {
    horizon: (S, { e, spec }) => {
      const { c, t, s } = S;
      const n = Math.round(8 * (spec.n ?? 1));
      const cx = anchor(S, e);
      const baseY = S.horizon - 26 * s;
      const R = 60 * s;
      const col: RGB = mix([235, 238, 242], [40, 44, 52], clamp(S.A.daylight * 1.4 - 0.2, 0, 1));
      c.strokeStyle = css(col, e.k * 0.85);
      c.lineWidth = 1.3 * s;
      c.lineCap = 'round';
      c.beginPath();
      for (let i = 0; i < n; i++) {
        const a = t * (0.5 + h(i) * 0.4) + (i * TAU) / n;
        const x = cx + Math.cos(a) * R * (0.6 + h(i + 1) * 0.6);
        let y = baseY + Math.sin(a) * R * 0.22 - h(i + 2) * 40 * s;
        const dv = (t * 0.35 + h(i + 3)) % 1;
        if (i % 3 === 0 && dv < 0.2) {
          const q = dv / 0.2;
          y += Math.sin(q * PI) * (farY(S, 0.35) - y);
          c.moveTo(x - 3 * s, y - 4 * s);
          c.lineTo(x, y);
          c.lineTo(x + 3 * s, y - 4 * s);
          continue;
        }
        const fl = Math.sin(t * 8 + i) * 3 * s;
        const w = 7 * s;
        c.moveTo(x - w, y - fl * 0.4);
        c.quadraticCurveTo(x - w * 0.5, y - 3 * s - fl, x, y);
        c.quadraticCurveTo(x + w * 0.5, y - 3 * s - fl, x + w, y - fl * 0.4);
      }
      c.stroke();
    },
  },

  dolphins: {
    horizon: (S, { e }) => {
      const { c, t } = S;
      const p = 0.58;
      const y = farY(S, p);
      const z = zAt(S, p);
      const span = S.visW + 300;
      const bx = wrap(t * 38 * z + sd(e) * span, span) - 150;
      c.fillStyle = css(mix([62, 76, 92], S.pal.land1, 0.35));
      c.strokeStyle = '#eef6ff';
      c.lineWidth = 1;
      for (let j = 0; j < 4; j++) {
        const ph = (t * 0.55 + j * 0.27) % 1;
        const x = bx - j * 34 * z;
        if (ph < 0.42) {
          const q = ph / 0.42;
          c.globalAlpha = e.k;
          dolphin(c, x + (q - 0.5) * 30 * z, y - Math.sin(q * PI) * 20 * z, 30 * z, -Math.cos(q * PI) * 0.85);
        } else if (ph < 0.6) ring(c, x + 15 * z, y + 1, (ph - 0.42) * 120 * z, e.k * 0.45);
      }
      c.globalAlpha = 1;
    },
  },

  whale: {
    horizon: (S, { e }) => {
      const { c, t } = S;
      const p = 0.24;
      const y = farY(S, p);
      const z = zAt(S, p) * 1.5;
      const cx = anchor(S, e, 0.4, 0.85);
      const cyc = (t / 13 + sd(e, 2)) % 1;
      const dark = css(mix(S.pal.land1, [18, 24, 32], 0.5));
      if (cyc < 0.24) {
        const q = cyc / 0.24;
        for (let i = 0; i < 6; i++) S.glow(cx + (h(i) - 0.5) * 8 * z * q, y - q * 34 * z * (0.35 + i / 7), (5 + q * 10) * z, [236, 242, 248], e.k * (1 - q) * 0.55);
      }
      c.fillStyle = dark;
      if (cyc > 0.12 && cyc < 0.56) {
        const q = (cyc - 0.12) / 0.44;
        const rise = Math.sin(q * PI);
        c.globalAlpha = e.k;
        c.beginPath();
        c.ellipse(cx + (q - 0.5) * 30 * z, y + 2 * z, 34 * z, Math.max(0.1, rise * 7 * z), 0, PI, TAU);
        c.fill();
        if (q > 0.45) {
          const fx = cx + (q - 0.5) * 30 * z - 12 * z;
          c.beginPath();
          c.moveTo(fx - 3 * z, y + 2 * z - rise * 5 * z);
          c.lineTo(fx + 2 * z, y + 2 * z - rise * 9 * z);
          c.lineTo(fx + 4 * z, y + 2 * z - rise * 5 * z);
          c.fill();
        }
      }
      if (cyc > 0.58 && cyc < 0.76) {
        const q = (cyc - 0.58) / 0.18;
        const rise = Math.sin(q * PI);
        const tx = cx + 22 * z;
        const ty = y - rise * 18 * z;
        c.globalAlpha = e.k;
        c.beginPath();
        c.moveTo(tx, y + 2 * z);
        c.lineTo(tx - 1.5 * z, ty + 3 * z);
        c.quadraticCurveTo(tx - 14 * z, ty - 2 * z, tx - 16 * z, ty - 6 * z);
        c.quadraticCurveTo(tx - 6 * z, ty - 1 * z, tx, ty + 1 * z);
        c.quadraticCurveTo(tx + 6 * z, ty - 1 * z, tx + 16 * z, ty - 6 * z);
        c.quadraticCurveTo(tx + 14 * z, ty - 2 * z, tx + 1.5 * z, ty + 3 * z);
        c.closePath();
        c.fill();
        c.fillStyle = '#eef6ff';
        for (let i = 0; i < 6; i++) c.fillRect(tx + (h(i + 40) - 0.5) * 26 * z, ty + q * 14 * z * h(i + 41), 1.2, 1.2 + q * 3);
      }
      c.globalAlpha = 1;
    },
  },

  orcas: {
    horizon: (S, { e }) => {
      const { c, t } = S;
      const p = 0.5;
      const y = farY(S, p);
      const z = zAt(S, p);
      const span = S.visW + 300;
      const bx = wrap(-t * 30 * z + sd(e) * span, span) - 150;
      for (let j = 0; j < 3; j++) {
        const up = Math.max(0, Math.sin(t * 0.9 + j * 1.3));
        if (up <= 0.02) continue;
        const x = bx + j * 30 * z;
        const hh = (j === 0 ? 18 : 12) * z * up;
        c.globalAlpha = e.k;
        c.fillStyle = '#0b0e12';
        c.beginPath();
        c.moveTo(x - 4 * z, y + 1);
        c.quadraticCurveTo(x - 1 * z, y - hh * 0.6, x + 1.5 * z, y - hh);
        c.quadraticCurveTo(x + 2.5 * z, y - hh * 0.4, x + 5 * z, y + 1);
        c.fill();
        c.fillStyle = 'rgba(230,235,240,0.8)';
        c.beginPath();
        c.ellipse(x + 8 * z, y, 4 * z, 1 * z * up, 0, PI, TAU);
        c.fill();
        c.strokeStyle = '#eef6ff';
        c.lineWidth = 1;
        c.globalAlpha = e.k * 0.4 * up;
        c.beginPath();
        c.moveTo(x - 4 * z, y + 1);
        c.lineTo(x - 18 * z, y + 3 * z);
        c.moveTo(x + 5 * z, y + 1);
        c.lineTo(x + 18 * z, y + 3 * z);
        c.stroke();
      }
      c.globalAlpha = 1;
    },
  },

  fins: {
    horizon: (S, { e }) => {
      const { c, t } = S;
      const p = 0.78;
      const cx = anchor(S, e, 0.45, 0.75);
      const z = zAt(S, p);
      for (let j = 0; j < 3; j++) {
        const a = t * 0.38 + (j * TAU) / 3;
        const x = cx + Math.cos(a) * 110 * z;
        const y = farY(S, p) + Math.sin(a) * 10 * z;
        const dir = -Math.sin(a) > 0 ? 1 : -1;
        c.globalAlpha = e.k;
        c.fillStyle = css(mix([70, 80, 90], S.pal.land1, 0.3));
        c.beginPath();
        c.moveTo(x - 5 * z * dir, y + 1);
        c.quadraticCurveTo(x - 1 * z * dir, y - 6 * z, x + 2 * z * dir, y - 11 * z);
        c.quadraticCurveTo(x + 3 * z * dir, y - 4 * z, x + 6 * z * dir, y + 1);
        c.fill();
        c.strokeStyle = '#eef6ff';
        c.lineWidth = 1;
        c.globalAlpha = e.k * 0.35;
        c.beginPath();
        c.moveTo(x - 5 * z * dir, y + 1);
        c.lineTo(x - 24 * z * dir, y - 2 * z);
        c.moveTo(x - 5 * z * dir, y + 1);
        c.lineTo(x - 24 * z * dir, y + 5 * z);
        c.stroke();
      }
      c.globalAlpha = 1;
    },
  },

  seals: {
    horizon: (S, { e }) => {
      const { c, t, s } = S;
      c.fillStyle = css(mix([60, 62, 66], S.pal.land1, 0.4));
      S.rocks.forEach(([x, y], i) => {
        if (i > 2) return;
        const lift = Math.max(0, Math.sin(t * 0.6 + i * 2)) * 2 * s;
        c.globalAlpha = e.k;
        c.beginPath();
        c.ellipse(x, y - 1.8 * s, 6.5 * s, 2.4 * s, 0.05, 0, TAU);
        c.ellipse(x + 5.5 * s, y - 3.2 * s - lift, 2.2 * s, 1.8 * s, 0, 0, TAU);
        c.fill();
      });
      for (let i = 0; i < 2; i++) {
        const x = S.capeX + (150 + i * 40 + Math.sin(t * 0.2 + i) * 10) * s;
        const y = S.horizon + (5 + i * 4) * s + Math.sin(t * 1.2 + i) * 0.8 * s;
        c.globalAlpha = e.k * (0.6 + 0.4 * Math.sin(t * 0.5 + i * 3));
        c.beginPath();
        c.ellipse(x, y, 2 * s, 1.7 * s, 0, 0, TAU);
        c.fill();
      }
      c.globalAlpha = 1;
    },
  },

  turtle: {
    under: (S, { e }) => {
      const { c, t, s } = S;
      const x = S.boatX - 150 * s + Math.sin(t * 0.12) * 40 * s;
      const y = S.surface + 46 * s + Math.sin(t * 0.4) * 6 * s;
      const fl = Math.sin(t * 2.2) * 0.5;
      c.globalAlpha = e.k * 0.85;
      c.fillStyle = css(mix([70, 96, 70], S.pal.deep, 0.35));
      c.save();
      c.translate(x, y);
      c.rotate(fl * 0.4);
      c.beginPath();
      c.ellipse(-14 * s, 6 * s, 10 * s, 3 * s, 0.6, 0, TAU);
      c.restore();
      c.fill();
      c.save();
      c.translate(x, y);
      c.rotate(-fl * 0.4);
      c.beginPath();
      c.ellipse(-14 * s, -6 * s, 10 * s, 3 * s, -0.6, 0, TAU);
      c.restore();
      c.fill();
      c.fillStyle = css(mix([96, 80, 50], S.pal.deep, 0.3));
      c.beginPath();
      c.ellipse(x, y, 18 * s, 11 * s, 0, 0, TAU);
      c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.25)';
      c.lineWidth = 1;
      c.beginPath();
      c.ellipse(x, y, 10 * s, 6 * s, 0, 0, TAU);
      c.stroke();
      c.globalAlpha = 1;
    },
    surface: (S, { e }) => {
      const { c, t, s } = S;
      if ((t / 6) % 1 > 0.35) return;
      const x = S.boatX - 132 * s + Math.sin(t * 0.12) * 40 * s;
      const y = S.sAt(x);
      c.globalAlpha = e.k;
      c.fillStyle = css(mix([80, 104, 76], S.pal.land1, 0.3));
      c.beginPath();
      c.ellipse(x, y - 2 * s, 4 * s, 3 * s, 0, PI, TAU);
      c.fill();
      c.strokeStyle = '#eef6ff';
      ring(c, x, y + 1, 9 * s, e.k * 0.4);
      c.globalAlpha = 1;
    },
  },

  jellies: {
    under: (S, { e, spec }) => {
      const { c, t, s } = S;
      const n = Math.round(12 * (spec.n ?? 1) * (S.q === 0 ? 0.5 : 1));
      for (let i = 0; i < n; i++) {
        const x = h(i + 60) * S.W + Math.sin(t * 0.1 + i) * 30 * s;
        const y = S.surface + (0.06 + h(i + 61) * 0.75) * S.H + Math.sin(t * 0.3 + i) * 12 * s;
        if (y < S.cam - 40 || y > S.cam + S.H + 40) continue;
        const r = (5 + h(i + 62) * 7) * s;
        const pulse = (Math.sin(t * 1.8 + i) + 1) / 2;
        const col: RGB = i % 3 ? [235, 150, 220] : [160, 200, 255];
        S.glow(x, y, r * 3.2, col, e.k * (0.12 + 0.3 * S.A.night));
        c.globalAlpha = e.k * (0.35 + 0.3 * S.A.night);
        c.fillStyle = css(col);
        c.beginPath();
        c.ellipse(x, y, r * (1 + pulse * 0.15), r * (0.7 - pulse * 0.15), 0, PI, TAU);
        c.fill();
      }
      c.globalAlpha = 1;
    },
  },

  bioglow: {
    horizon: (S, { e, spec }) => {
      const { c, t, s } = S;
      const a = e.k * (spec.n ?? 1) * (0.2 + 0.8 * S.A.night);
      if (a < 0.02) return;
      c.fillStyle = 'rgb(110,240,230)';
      for (let j = 0; j < 14; j++) {
        const pj = j / 14;
        const y = farY(S, pj) + 1;
        for (let i = 0; i < 5; i++) {
          const x = wrap(h(j * 7 + i) * (S.W + 200) + t * (8 + pj * 20) * s, S.W + 200) - 100;
          c.globalAlpha = a * (0.25 + 0.6 * Math.max(0, Math.sin(t * 2 + i + j * 1.3)));
          c.fillRect(x, y, (6 + pj * 50) * s, Math.max(0.8, pj * 1.8 * s));
        }
      }
      c.globalAlpha = 1;
    },
    surface: (S, { e, spec }) => {
      const { c, t, s } = S;
      const a = e.k * (spec.n ?? 1) * (0.2 + 0.8 * S.A.night);
      if (a < 0.02) return;
      c.strokeStyle = 'rgb(120,255,235)';
      c.lineWidth = 2.2 * s;
      c.globalAlpha = a * (0.45 + 0.25 * Math.sin(t * 3));
      c.beginPath();
      for (let x = 0; x <= S.W; x += 10) {
        const y = S.sAt(x) + 1;
        if (x === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.stroke();
      c.fillStyle = 'rgb(160,255,240)';
      for (let i = 0; i < 40; i++) {
        const x = h(i + 80) * S.W;
        const tw = Math.max(0, Math.sin(t * (2 + h(i) * 3) + i * 2));
        c.globalAlpha = a * tw;
        c.fillRect(x, S.sAt(x) + (2 + h(i + 81) * 20) * s, 1.6 * s, 1.6 * s);
      }
      c.globalAlpha = 1;
    },
  },

  tint: {
    horizon: (S, { e, spec }) => {
      if (!spec.color) return;
      S.c.globalAlpha = e.k * 0.26;
      S.c.fillStyle = css(spec.color);
      S.c.fillRect(-20, S.horizon, S.W + 40, S.surface - S.horizon + 40);
      S.c.globalAlpha = 1;
    },
    under: (S, { e, spec }) => {
      if (!spec.color) return;
      S.c.globalAlpha = e.k * 0.2;
      S.c.fillStyle = css(spec.color);
      S.c.fillRect(-20, S.surface, S.W + 40, S.H * 1.3);
      S.c.globalAlpha = 1;
    },
  },

  spawn: {
    under: (S, { e }) => {
      const { c, t, s } = S;
      const n = S.q === 0 ? 40 : 80;
      const range = S.H * 0.95;
      for (let i = 0; i < n; i++) {
        const x = h(i + 100) * S.W + Math.sin(t * 0.6 + i) * 8 * s;
        const y = S.surface + range - wrap(t * (10 + h(i + 101) * 10) * s + h(i + 102) * range, range);
        if (y < S.cam - 10 || y > S.cam + S.H + 10) continue;
        c.globalAlpha = e.k * (0.5 + 0.4 * Math.sin(t * 3 + i));
        c.fillStyle = i % 3 ? '#ffc6d6' : '#fff2e8';
        c.fillRect(x, y, 1.8 * s, 1.8 * s);
      }
      c.globalAlpha = 1;
    },
  },

  meteors: {
    sky: (S, { e }) => {
      const { c, t, s } = S;
      const dark = (1 - S.A.daylight) * (1 - S.A.cover * 0.8);
      if (dark < 0.05) return;
      c.lineCap = 'round';
      for (let i = 0; i < 6; i++) {
        const per = 1.2 + h(i) * 1.8;
        const tt = t + h(i + 1) * 9;
        const cyc = Math.floor(tt / per);
        const ph = (tt / per) % 1;
        if (ph > 0.32) continue;
        const q = ph / 0.32;
        const k2 = i * 31 + cyc * 7.13;
        const x0 = h(k2) * S.visW * 1.1;
        const y0 = h(k2 + 1) * S.horizon * 0.5;
        const len = (60 + h(k2 + 2) * 130) * s;
        const ang = 0.55 + (h(k2 + 3) - 0.5) * 0.35;
        const x = x0 + Math.cos(ang) * len * q * 2;
        const y = y0 + Math.sin(ang) * len * q * 2;
        const g = c.createLinearGradient(x, y, x - Math.cos(ang) * len, y - Math.sin(ang) * len);
        g.addColorStop(0, `rgba(255,250,235,${e.k * dark * Math.sin(q * PI)})`);
        g.addColorStop(1, 'rgba(255,250,235,0)');
        c.strokeStyle = g;
        c.lineWidth = 1.5;
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x - Math.cos(ang) * len, y - Math.sin(ang) * len);
        c.stroke();
      }
    },
  },

  halo: {
    sky: (S, { e }) => {
      const { c, s } = S;
      const a = e.k * 0.32 * S.A.daylight * (1 - S.A.fog);
      if (a < 0.01) return;
      const R = S.horizon * 0.42;
      const { x, y } = S.sun;
      c.lineWidth = 5 * s;
      [
        [-3, '255,120,90'],
        [0, '255,236,210'],
        [3, '150,190,255'],
      ].forEach(([d, col]) => {
        c.strokeStyle = `rgba(${col},${a * 0.7})`;
        c.beginPath();
        c.arc(x, y, R + (d as number) * s, 0, TAU);
        c.stroke();
      });
      for (const sx of [-1, 1]) {
        S.glow(x + sx * R, y, 22 * s, [255, 240, 220], a * 1.6);
        S.glow(x + sx * (R - 5 * s), y, 9 * s, [255, 130, 90], a);
      }
    },
  },

  greenflash: {
    sky: (S, { e }) => {
      const { c, t, s } = S;
      const fl = 0.6 + 0.4 * Math.sin(t * 22);
      const x = S.sun.x;
      const y = S.sun.y - 27 * s;
      S.glow(x, y, 34 * s, [90, 255, 150], e.k * fl * 0.9);
      c.globalAlpha = e.k * fl;
      c.fillStyle = 'rgb(140,255,170)';
      c.beginPath();
      c.ellipse(x, y + 2 * s, 15 * s, 3.2 * s, 0, PI, TAU);
      c.fill();
      c.globalAlpha = 1;
    },
  },

  moonbow: {
    sky: (S, { e }) => {
      const { c } = S;
      const a = e.k * 0.24 * (0.3 + 0.7 * S.A.night);
      const cx = S.visW - S.moon.x + S.visW * 0.05;
      const cy = S.horizon + (S.horizon - S.moon.y) * 0.4;
      const R = S.horizon * 0.82;
      c.lineWidth = R * 0.028;
      ['255,235,235', '240,248,255', '225,235,255'].forEach((col, i) => {
        c.strokeStyle = `rgba(${col},${a * (i === 1 ? 1 : 0.6)})`;
        c.beginPath();
        c.arc(cx, cy, R - i * R * 0.025, PI * 1.03, PI * 1.97);
        c.stroke();
      });
    },
  },

  eclipse: {
    sky: (S, { e }) => {
      const { c, t, s } = S;
      const k = e.k;
      c.fillStyle = `rgba(4,6,18,${k * 0.62})`;
      c.fillRect(-20, -S.H, S.W + 40, S.horizon + S.H);
      c.fillStyle = '#fff8ea';
      for (let i = 0; i < 60; i++) {
        c.globalAlpha = k * (0.4 + 0.5 * h(i + 7)) * (0.6 + 0.4 * Math.sin(t * 2 + i));
        c.fillRect(h(i + 3) * S.W, h(i + 4) * S.horizon * 0.85, 1.3, 1.3);
      }
      const { x, y } = S.sun;
      c.globalCompositeOperation = 'lighter';
      S.glow(x, y, 120 * s, [215, 225, 255], k * 0.55);
      c.strokeStyle = `rgba(230,236,255,${k * 0.35})`;
      c.lineWidth = 1;
      c.beginPath();
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU + Math.sin(t * 0.2 + i) * 0.1;
        const l = (45 + h(i + 20) * 50) * s;
        c.moveTo(x + Math.cos(a) * 30 * s, y + Math.sin(a) * 30 * s);
        c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      }
      c.stroke();
      if (k > 0.82 && k < 0.97) S.glow(x + 24 * s, y - 14 * s, 16 * s, [255, 255, 255], (1 - Math.abs(k - 0.9) / 0.08) * 0.9);
      c.globalCompositeOperation = 'source-over';
      c.globalAlpha = 1;
      c.fillStyle = '#05070c';
      c.beginPath();
      c.arc(x + (1 - k) * 34 * s, y, 29 * s, 0, TAU);
      c.fill();
    },
    front: (S, { e }) => {
      S.c.fillStyle = `rgba(4,6,16,${e.k * 0.42})`;
      S.c.fillRect(0, S.cam - 10, S.W, S.H + 20);
    },
  },

  mirage: {
    horizon: (S, { e }) => {
      const { c, t, s } = S;
      const col = css(mix(S.pal.land2, S.pal.skyHor, 0.35), e.k * 0.55);
      const cx = anchor(S, e, 0.5, 0.85);
      const w = 130 * s;
      c.fillStyle = col;
      // настоящий остров и его перевёрнутое, вытянутое отражение
      for (const flip of [0, 1]) {
        c.beginPath();
        const base = flip ? S.horizon - 24 * s : S.horizon;
        c.moveTo(cx - w / 2, base);
        for (let i = 0; i <= 24; i++) {
          const q = i / 24;
          const hh = Math.pow(Math.sin(q * PI), 0.7) * 11 * s * (1 + 0.3 * Math.sin(i * 1.3));
          const wob = flip ? 1.8 * (1 + 0.18 * Math.sin(t * 2.4 + i * 0.7)) : 1;
          c.lineTo(cx - w / 2 + w * q, flip ? base - hh * wob : base - hh);
        }
        c.lineTo(cx + w / 2, base);
        c.fill();
      }
      c.fillRect(cx - w / 2, S.horizon - 24 * s, w, 2 * s * (1 + Math.sin(t * 3) * 0.3));
      const sx = cx - 170 * s;
      const sy = S.horizon - 30 * s + Math.sin(t * 1.7) * 1.5 * s;
      c.beginPath();
      c.moveTo(sx - 16 * s, sy);
      c.lineTo(sx + 16 * s, sy);
      c.lineTo(sx + 12 * s, sy - 4 * s);
      c.lineTo(sx - 12 * s, sy - 4 * s);
      c.fill();
      c.fillRect(sx - 6 * s, sy, 9 * s, 5 * s);
      c.fillRect(sx + 1 * s, sy, 1 * s, 12 * s);
    },
  },

  waterspout: {
    horizon: (S, { e }) => {
      const { c, t, s } = S;
      const cx = anchor(S, e, 0.45, 0.85);
      const base = farY(S, 0.3);
      const top = S.horizon * 0.3;
      const sway = Math.sin(t * 0.7) * 22 * s;
      const col = mix(S.pal.cloud, [60, 66, 74], 0.6);
      c.globalAlpha = e.k * 0.6;
      c.fillStyle = css(col);
      c.beginPath();
      c.moveTo(cx - 26 * s, top);
      c.quadraticCurveTo(cx + sway * 1.4 - 8 * s, (top + base) / 2, cx + sway * 0.4 - 3 * s, base);
      c.lineTo(cx + sway * 0.4 + 3 * s, base);
      c.quadraticCurveTo(cx + sway * 1.4 + 8 * s, (top + base) / 2, cx + 26 * s, top);
      c.fill();
      c.beginPath();
      c.ellipse(cx, top, 70 * s, 14 * s, 0, 0, TAU);
      c.fill();
      c.strokeStyle = css(mix(col, [255, 255, 255], 0.35));
      c.lineWidth = 1;
      c.globalAlpha = e.k * 0.35;
      c.beginPath();
      for (let i = 0; i < 6; i++) {
        const q = ((t * 0.8 + i / 6) % 1) * 0.9 + 0.05;
        const y = top + (base - top) * q;
        const ww = 26 * s * (1 - q) + 3 * s;
        const xc = cx + sway * (1.4 * 2 * q * (1 - q) + 0.4 * q * q);
        c.moveTo(xc - ww, y);
        c.quadraticCurveTo(xc, y + 4 * s, xc + ww, y - 2 * s);
      }
      c.stroke();
      S.glow(cx + sway * 0.4, base, 34 * s, mix(S.pal.fog, [255, 255, 255], 0.3), e.k * 0.5);
      c.globalAlpha = 1;
    },
  },

  stelmo: {
    front: (S, { e }) => {
      const { c, t, s } = S;
      for (const [i, pt] of [S.rodTip, S.mast].entries()) {
        const fl = 0.7 + 0.3 * Math.sin(t * 17 + i * 3) * Math.sin(t * 5.3 + i);
        c.globalCompositeOperation = 'lighter';
        S.glow(pt[0], pt[1], 20 * s * fl, [140, 175, 255], e.k * 0.9);
        S.glow(pt[0], pt[1], 6 * s, [225, 235, 255], e.k);
        c.strokeStyle = `rgba(190,210,255,${e.k * 0.6})`;
        c.lineWidth = 0.8;
        c.beginPath();
        for (let j = 0; j < 5; j++) {
          const a = t * 6 + j * 1.3 + i;
          c.moveTo(pt[0], pt[1]);
          c.lineTo(pt[0] + Math.cos(a) * 8 * s * fl, pt[1] + Math.sin(a) * 8 * s * fl);
        }
        c.stroke();
        c.globalCompositeOperation = 'source-over';
      }
      c.globalAlpha = 1;
    },
  },

  ghostship: {
    horizon: (S, { e }) => {
      const { c, t } = S;
      const p = 0.2;
      const z = zAt(S, p) * 1.7;
      const span = S.visW + 400;
      const x = wrap(t * 3 * z + sd(e) * span, span) - 200;
      const y = farY(S, p);
      const a = e.k * (0.28 + S.A.fog * 0.5) * (0.75 + 0.25 * Math.sin(t * 1.3));
      const col = css([150, 186, 180], a);
      c.fillStyle = col;
      c.strokeStyle = col;
      c.lineWidth = Math.max(0.8, 0.6 * z);
      c.beginPath();
      c.moveTo(x - 34 * z, y - 7 * z);
      c.lineTo(x + 30 * z, y - 5 * z);
      c.lineTo(x + 22 * z, y + 1);
      c.lineTo(x - 28 * z, y + 1);
      c.closePath();
      c.fill();
      c.fillRect(x - 36 * z, y - 12 * z, 9 * z, 6 * z);
      for (const [mx, mh] of [
        [-16, 40],
        [2, 48],
        [18, 34],
      ]) {
        c.beginPath();
        c.moveTo(x + mx * z, y - 6 * z);
        c.lineTo(x + mx * z, y - mh * z);
        c.stroke();
        for (let r = 0; r < 2; r++) {
          const top = y - mh * z + 4 * z + r * mh * 0.4 * z;
          const hgt = mh * 0.32 * z;
          c.beginPath();
          c.moveTo(x + mx * z - 9 * z, top);
          c.lineTo(x + mx * z + 9 * z, top);
          for (let k = 0; k <= 4; k++) c.lineTo(x + mx * z + 9 * z - k * 4.5 * z, top + hgt - (k % 2) * 4 * z + Math.sin(t * 2 + k + r) * z);
          c.closePath();
          c.globalAlpha = 0.7;
          c.fill();
          c.globalAlpha = 1;
        }
      }
      c.globalCompositeOperation = 'lighter';
      S.glow(x - 32 * z, y - 14 * z, 10 * z, [140, 255, 200], a * 1.2 * (0.6 + 0.4 * Math.sin(t * 4)));
      S.glow(x + 26 * z, y - 8 * z, 8 * z, [140, 255, 200], a);
      c.globalCompositeOperation = 'source-over';
      c.globalAlpha = 1;
    },
  },

  deeplights: {
    under: (S, { e, spec }) => {
      const { c, t, s } = S;
      const n = Math.max(2, Math.round(12 * (spec.n ?? 1)));
      for (let i = 0; i < n; i++) {
        const per = 9 + h(i) * 6;
        const ph = ((t + h(i + 1) * 20) / per) % 1;
        const x = h(i + 2) * S.W + Math.sin(t * 0.3 + i) * 20 * s;
        const y = S.surface + S.H * 0.95 - ph * S.H * 0.85;
        if (y < S.cam - 40 || y > S.cam + S.H + 40) continue;
        const col = spec.color ?? (i % 3 ? [110, 220, 255] : [150, 255, 200]);
        const a = e.k * Math.sin(ph * PI) * (0.4 + 0.6 * S.A.night);
        c.globalCompositeOperation = 'lighter';
        S.glow(x, y, (12 + 5 * Math.sin(t * 2 + i)) * s, col, a);
        c.globalCompositeOperation = 'source-over';
        c.globalAlpha = a;
        c.fillStyle = '#fff';
        c.fillRect(x - s, y - s, 2 * s, 2 * s);
      }
      c.globalAlpha = 1;
    },
  },

  fallenstar: {
    sky: (S, { e, age }) => {
      const { c, s } = S;
      const lx = anchor(S, e, 0.5, 0.82);
      const ly = farY(S, 0.42);
      const fall = 3;
      if (age < fall) {
        const q = age / fall;
        const qq = q * q;
        const x = lx - 320 * s * (1 - qq);
        const y = -20 + (ly + 20) * qq;
        const g = c.createLinearGradient(x, y, x - 140 * s, y - 70 * s);
        g.addColorStop(0, `rgba(255,236,190,${e.omen})`);
        g.addColorStop(1, 'rgba(255,200,140,0)');
        c.strokeStyle = g;
        c.lineWidth = 2.5 * s;
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x - 140 * s, y - 70 * s);
        c.stroke();
        c.globalCompositeOperation = 'lighter';
        S.glow(x, y, 30 * s, [255, 230, 180], 1);
        c.globalCompositeOperation = 'source-over';
      } else if (age < fall + 1.2) {
        c.globalCompositeOperation = 'lighter';
        S.glow(lx, ly, 160 * s, [255, 240, 210], (1 - (age - fall) / 1.2) * 0.9);
        c.globalCompositeOperation = 'source-over';
      }
      c.globalAlpha = 1;
    },
    under: (S, { e, age }) => {
      if (age < 3) return;
      const { c, t, s } = S;
      const lx = anchor(S, e, 0.5, 0.82);
      const y = S.surface + Math.min(age - 3, 25) * 5 * s + 20 * s;
      const a = e.k * (e.done ? 0.4 : 1) * (0.8 + 0.2 * Math.sin(t * 5));
      c.globalCompositeOperation = 'lighter';
      S.glow(lx, y, 60 * s, [255, 220, 150], a * 0.6);
      S.glow(lx, y, 14 * s, [255, 250, 230], a);
      c.globalCompositeOperation = 'source-over';
      c.globalAlpha = 1;
    },
  },

  leviathan: {
    under: (S, { e }) => {
      const { c, t, s } = S;
      const L = S.W * 0.8;
      const x = S.W * 1.4 - e.p * (S.W * 1.9);
      const y = S.surface + S.H * 0.27 + Math.sin(t * 0.5) * 10 * s;
      c.globalAlpha = e.k * 0.55;
      c.fillStyle = 'rgb(0,5,9)';
      c.beginPath();
      c.ellipse(x, y, L * 0.42, 30 * s, 0, 0, TAU);
      c.moveTo(x + L * 0.38, y);
      c.lineTo(x + L * 0.62, y - 22 * s + Math.sin(t * 1.4) * 10 * s);
      c.lineTo(x + L * 0.6, y + 24 * s + Math.sin(t * 1.4) * 10 * s);
      c.closePath();
      c.moveTo(x - L * 0.05, y + 20 * s);
      c.lineTo(x + L * 0.08, y + 58 * s);
      c.lineTo(x + L * 0.12, y + 18 * s);
      c.fill();
      c.globalAlpha = 1;
      const blink = Math.sin(t * 0.7) > -0.9 ? 1 : 0;
      S.glow(x - L * 0.36, y - 8 * s, 8 * s, [255, 214, 130], e.k * 0.7 * blink);
    },
  },

  shelf: {
    sky: (S, { e }) => {
      const { c, t, s } = S;
      const a = Math.max(e.k, e.omen * 0.85);
      if (a < 0.02) return;
      const col = css(mix(S.pal.cloud, [12, 14, 18], 0.78), a * 0.9);
      c.fillStyle = col;
      c.beginPath();
      c.moveTo(-20, S.horizon + 1);
      for (let x = -20; x <= S.W + 20; x += 16) c.lineTo(x, S.horizon - S.H * (0.06 + 0.035 * Math.sin(x * 0.012 + t * 0.05) + 0.015 * Math.sin(x * 0.05)) * (0.4 + a * 0.6));
      c.lineTo(S.W + 20, S.horizon + 1);
      c.fill();
      c.strokeStyle = css(mix(S.pal.cloud, [12, 14, 18], 0.6), a * 0.25);
      c.lineWidth = 1;
      c.beginPath();
      for (let i = 0; i < 40; i++) {
        const x = h(i + 200) * S.W;
        c.moveTo(x, S.horizon - S.H * 0.05);
        c.lineTo(x + S.windPx * 0.04, S.horizon);
      }
      c.stroke();
      c.globalAlpha = 1;
      void s;
    },
  },

  flare: {
    sky: (S, { e, age }) => {
      const { c, s } = S;
      const per = 24;
      const ph = (age / per) % 1;
      const lx = anchor(S, e, 0.55, 0.9);
      const base = farY(S, 0.3);
      const peak = base - S.horizon * 0.62;
      let x = lx;
      let y: number;
      let a: number;
      if (ph < 0.1) {
        const q = ph / 0.1;
        y = base - (1 - (1 - q) * (1 - q)) * (base - peak);
        a = 0.8;
        c.strokeStyle = `rgba(200,200,200,${e.k * 0.25})`;
        c.lineWidth = 1.5 * s;
        c.beginPath();
        c.moveTo(lx, base);
        c.lineTo(x, y);
        c.stroke();
      } else {
        const q = (ph - 0.1) / 0.9;
        y = peak + q * S.horizon * 0.5;
        x = lx + q * 40 * s * Math.sign(S.windPx || 1);
        a = 1 - q * 0.7;
      }
      c.globalCompositeOperation = 'lighter';
      S.glow(x, y, 50 * s, [255, 70, 50], e.k * a);
      S.glow(x, y, 8 * s, [255, 220, 200], e.k * a);
      S.glow(x, S.horizon + 8 * s, 160 * s, [255, 60, 40], e.k * a * 0.14);
      c.globalCompositeOperation = 'source-over';
      c.globalAlpha = 1;
    },
  },

  fireworks: {
    sky: (S, { e, age }) => {
      const { c, s } = S;
      const pal: RGB[] = [
        [255, 120, 90],
        [255, 220, 120],
        [140, 200, 255],
        [210, 150, 255],
        [140, 255, 180],
      ];
      c.globalCompositeOperation = 'lighter';
      for (let j = 0; j < 3; j++) {
        const per = 2.4;
        const tt = age + j * 0.8;
        const cyc = Math.floor(tt / per);
        const ph = (tt / per) % 1;
        const k2 = j * 13 + cyc * 7.7;
        const bx = S.capeX + (h(k2) - 0.35) * 240 * s;
        const by = S.capeTop - (70 + h(k2 + 1) * 90) * s;
        const col = pal[Math.floor(h(k2 + 2) * pal.length)];
        if (ph < 0.22) {
          const q = ph / 0.22;
          S.glow(bx, S.capeTop - (S.capeTop - by) * q, 5 * s, [255, 230, 200], e.k);
          continue;
        }
        const q = (ph - 0.22) / 0.78;
        const r = (1 - (1 - q) * (1 - q)) * 46 * s;
        if (q < 0.3) S.glow(bx, by, 70 * s, col, e.k * (0.3 - q) * 1.4);
        c.fillStyle = css(col);
        c.globalAlpha = e.k * (1 - q);
        for (let i = 0; i < 24; i++) {
          const a = (i / 24) * TAU + h(k2 + 3);
          c.fillRect(bx + Math.cos(a) * r - s, by + Math.sin(a) * r + q * q * 26 * s - s, 2 * s, 2 * s);
        }
      }
      c.globalCompositeOperation = 'source-over';
      c.globalAlpha = 1;
    },
  },

  sails: {
    horizon: (S, { e }) => {
      const { c, t } = S;
      const dir = Math.sign(S.windPx || 1);
      const sail = css(mix([90, 100, 120], [245, 244, 238], S.A.daylight));
      const hull = css(mix(S.pal.land1, [40, 40, 46], 0.4));
      for (let i = 0; i < 6; i++) {
        const span = S.visW + 200;
        const p = 0.04 + h(i + 300) * 0.16;
        const z = zAt(S, p) * 1.6;
        const x = wrap(h(i + 301) * span + t * (4 + h(i + 302) * 3) * z * dir, span) - 100;
        const y = farY(S, p);
        c.globalAlpha = e.k;
        c.fillStyle = hull;
        c.fillRect(x - 6 * z, y - 1.5 * z, 12 * z, 1.5 * z);
        c.fillStyle = sail;
        c.beginPath();
        c.moveTo(x, y - 2 * z);
        c.lineTo(x + 1.5 * z * dir, y - 18 * z);
        c.lineTo(x + 8 * z * dir, y - 2 * z);
        c.closePath();
        c.moveTo(x - 0.5 * z * dir, y - 2 * z);
        c.lineTo(x - 0.5 * z * dir, y - 14 * z);
        c.lineTo(x - 5 * z * dir, y - 2 * z);
        c.fill();
      }
      c.globalAlpha = 1;
    },
  },

  boat: {
    horizon: (S, { e, spec }) => {
      const { c, t } = S;
      const p = 0.5;
      const z = zAt(S, p) * 1.3;
      const x = anchor(S, e, 0.58, 0.82) + Math.sin(t * 0.05) * 30 * z;
      const y = farY(S, p) + Math.sin(t * 1.3) * 1.2 * z;
      const trader = spec.variant === 'trader';
      c.globalAlpha = e.k;
      c.fillStyle = css(mix([100, 70, 44], S.pal.land1, 0.5 - S.A.daylight * 0.3));
      c.beginPath();
      c.moveTo(x - 22 * z, y - 5 * z);
      c.quadraticCurveTo(x, y - 3 * z, x + 24 * z, y - 7 * z);
      c.lineTo(x + 18 * z, y + 2 * z);
      c.lineTo(x - 18 * z, y + 2 * z);
      c.closePath();
      c.fill();
      c.fillStyle = css(mix([30, 32, 38], S.pal.land1, 0.3));
      c.fillRect(x - 6 * z, y - 15 * z, 5 * z, 10 * z);
      c.beginPath();
      c.arc(x - 3.5 * z, y - 17 * z, 2.6 * z, 0, TAU);
      c.fill();
      if (trader) {
        for (let i = 0; i < 6; i++) {
          c.fillStyle = i % 2 ? css(mix([240, 236, 226], S.pal.land1, 0.3)) : css(mix([190, 60, 50], S.pal.land1, 0.3));
          c.fillRect(x + (2 + i * 3.4) * z, y - 16 * z, 3.4 * z, 4 * z);
        }
        c.fillRect(x + 2 * z, y - 12 * z, 0.8 * z, 7 * z);
        c.fillRect(x + 21.6 * z, y - 12 * z, 0.8 * z, 7 * z);
      } else {
        c.strokeStyle = css(mix([40, 34, 28], S.pal.land1, 0.3));
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(x, y - 12 * z);
        c.lineTo(x + 26 * z, y - 30 * z);
        c.stroke();
      }
      if (S.A.lights > 0.05) {
        c.globalCompositeOperation = 'lighter';
        S.glow(x + (trader ? 12 : -16) * z, y - (trader ? 18 : 10) * z, 14 * z, [255, 196, 120], e.k * S.A.lights * 0.7);
        c.globalCompositeOperation = 'source-over';
      }
      c.globalAlpha = 1;
    },
  },

  bottle: {
    surface: (S, { e }) => {
      const { c, t, s } = S;
      const x = S.boatX + (95 + sd(e) * 70) * s;
      const y = S.sAt(x);
      const slope = (S.sAt(x + 6) - S.sAt(x - 6)) / 12;
      c.save();
      c.translate(x, y - 1.5 * s);
      c.rotate(Math.atan(slope) + 0.35 + Math.sin(t * 1.3) * 0.3);
      c.globalAlpha = e.k * (e.done ? 0.5 : 1);
      c.fillStyle = 'rgba(90,150,110,0.85)';
      c.beginPath();
      c.ellipse(0, 0, 7 * s, 2.8 * s, 0, 0, TAU);
      c.fill();
      c.fillRect(6 * s, -1.2 * s, 4 * s, 2.4 * s);
      c.fillStyle = '#a07a52';
      c.fillRect(9.5 * s, -1.3 * s, 2 * s, 2.6 * s);
      c.fillStyle = 'rgba(240,230,200,0.8)';
      c.fillRect(-4 * s, -0.8 * s, 6 * s, 1.6 * s);
      c.restore();
      if ((t * 0.45 + sd(e)) % 1 < 0.08) S.glow(x + 3 * s, y - 4 * s, 9 * s, [255, 250, 230], e.k * 0.9);
      c.globalAlpha = 1;
    },
  },

  crate: {
    surface: (S, { e }) => {
      const { c, t, s } = S;
      const x = S.boatX + (110 + sd(e) * 60) * s;
      const y = S.sAt(x);
      const slope = (S.sAt(x + 10) - S.sAt(x - 10)) / 20;
      c.globalAlpha = e.k * (e.done ? 0.4 : 1);
      c.fillStyle = css(mix([120, 86, 50], S.pal.land1, 0.45 - S.A.daylight * 0.25));
      c.save();
      c.translate(x, y);
      c.rotate(Math.atan(slope) + Math.sin(t * 0.9) * 0.08);
      c.fillRect(-7 * s, -8 * s, 14 * s, 10 * s);
      c.strokeStyle = 'rgba(0,0,0,0.35)';
      c.lineWidth = 1;
      c.strokeRect(-7 * s, -8 * s, 14 * s, 10 * s);
      c.beginPath();
      c.moveTo(-7 * s, -8 * s);
      c.lineTo(7 * s, 2 * s);
      c.stroke();
      c.restore();
      for (let i = 0; i < 3; i++) {
        const px = x + (i - 1) * 24 * s + Math.sin(t * 0.3 + i) * 6 * s;
        c.save();
        c.translate(px, S.sAt(px));
        c.rotate(Math.atan((S.sAt(px + 8) - S.sAt(px - 8)) / 16) + i);
        c.fillRect(-9 * s, -1.2 * s, 18 * s, 2.4 * s);
        c.restore();
      }
      c.globalAlpha = 1;
    },
  },

  net: {
    surface: (S, { e }) => {
      const { c, s } = S;
      const x0 = S.boatX + 70 * s + sd(e) * 40 * s;
      c.globalAlpha = e.k;
      c.fillStyle = '#e8743a';
      for (let i = 0; i < 7; i++) {
        const x = x0 + i * 14 * s;
        c.beginPath();
        c.arc(x, S.sAt(x) - 1, 2.2 * s, 0, TAU);
        c.fill();
      }
      c.globalAlpha = 1;
    },
    under: (S, { e }) => {
      const { c, t, s } = S;
      const x0 = S.boatX + 70 * s + sd(e) * 40 * s;
      c.globalAlpha = e.k * 0.45;
      c.strokeStyle = 'rgb(200,210,200)';
      c.lineWidth = 0.7;
      c.beginPath();
      for (let i = 0; i < 7; i++) {
        const x = x0 + i * 14 * s;
        const y0 = S.sAt(x);
        c.moveTo(x, y0);
        c.lineTo(x + Math.sin(t + i) * 4 * s, y0 + 44 * s);
      }
      for (let r = 1; r <= 4; r++) {
        c.moveTo(x0, S.sAt(x0) + r * 11 * s);
        for (let i = 1; i < 7; i++) {
          const x = x0 + i * 14 * s;
          c.lineTo(x + Math.sin(t + i) * r, S.sAt(x) + r * 11 * s + Math.sin(t * 1.3 + i) * 2 * s);
        }
      }
      c.stroke();
      if (!e.done) {
        c.globalAlpha = e.k * 0.9;
        c.fillStyle = css(mix([110, 140, 150], S.pal.deep, 0.3));
        for (let i = 0; i < 3; i++) tinyFish(c, x0 + (20 + i * 26) * s + Math.sin(t * 6 + i) * 2 * s, S.surface + (16 + i * 9) * s, 14 * s, Math.sin(t * 8 + i) * 0.4);
      }
      c.globalAlpha = 1;
    },
  },

  squid: {
    under: (S, { e }) => {
      const { c, t, s } = S;
      const lx = S.lantern[0];
      const a = e.k * (0.4 + 0.6 * S.A.night);
      for (let i = 0; i < 7; i++) {
        const x = lx + Math.cos(t * (0.6 + h(i) * 0.5) + i * 1.7) * 70 * s;
        const y = S.surface + 34 * s + Math.sin(t * 0.9 + i * 1.7) * 26 * s;
        const ang = Math.cos(t * (0.6 + h(i) * 0.5) + i * 1.7) > 0 ? PI : 0;
        c.globalCompositeOperation = 'lighter';
        S.glow(x, y, 16 * s, [255, 150, 190], a * 0.45);
        c.globalCompositeOperation = 'source-over';
        c.save();
        c.translate(x, y);
        c.rotate(ang);
        c.globalAlpha = a;
        c.fillStyle = 'rgb(240,170,190)';
        c.beginPath();
        c.ellipse(0, 0, 8 * s, 2.6 * s, 0, 0, TAU);
        c.fill();
        c.strokeStyle = 'rgb(240,170,190)';
        c.lineWidth = 0.8;
        c.beginPath();
        for (let k = -1; k <= 1; k++) {
          c.moveTo(-7 * s, k * s);
          c.quadraticCurveTo(-12 * s, k * 2 * s + Math.sin(t * 6 + i + k) * 2 * s, -16 * s, k * 3 * s);
        }
        c.stroke();
        c.restore();
      }
      c.globalAlpha = 1;
    },
  },

  flyingfish: {
    horizon: (S, { e }) => {
      const { c, t } = S;
      c.fillStyle = css(mix([120, 140, 160], [220, 230, 240], S.A.daylight));
      for (let i = 0; i < 6; i++) {
        const per = 2.2 + h(i + 400);
        const ph = ((t + h(i + 401) * 7) / per) % 1;
        if (ph > 0.7) continue;
        const q = ph / 0.7;
        const p = 0.55 + h(i + 402) * 0.35;
        const z = zAt(S, p);
        const x = h(i + 403) * S.visW + q * 120 * z;
        const y = farY(S, p) - Math.sin(q * PI) * 9 * z - 4 * z * Math.min(1, q * 8, (1 - q) * 8);
        c.globalAlpha = e.k;
        tinyFish(c, x, y, 10 * z, 0);
        c.beginPath();
        c.moveTo(x + 1 * z, y);
        c.lineTo(x - 4 * z, y - 6 * z * (0.6 + 0.4 * Math.sin(t * 20 + i)));
        c.lineTo(x - 2 * z, y);
        c.fill();
      }
      c.globalAlpha = 1;
    },
  },

  jumpers: {
    horizon: (S, { e, spec }) => {
      const { c, t } = S;
      const n = Math.round(8 * (spec.n ?? 1));
      c.fillStyle = css(mix([110, 120, 130], [215, 222, 230], S.A.daylight));
      c.strokeStyle = '#eef6ff';
      c.lineWidth = 1;
      for (let i = 0; i < n; i++) {
        const per = 1.6 + h(i + 500) * 1.6;
        const tt = t + h(i + 501) * 9;
        const ph = (tt / per) % 1;
        const cyc = Math.floor(tt / per);
        const p = 0.25 + h(i + 502 + cyc) * 0.6;
        const z = zAt(S, p);
        const x = h(i + 503 + cyc * 3.1) * S.visW;
        const y = farY(S, p);
        if (ph < 0.42) {
          const q = ph / 0.42;
          c.globalAlpha = e.k;
          tinyFish(c, x + (q - 0.5) * 18 * z, y - Math.sin(q * PI) * 18 * z, 14 * z, (q - 0.5) * 2.2);
        } else if (ph < 0.75) ring(c, x + 9 * z, y + 1, (ph - 0.42) * 50 * z, e.k * (0.75 - ph) * 1.2);
      }
      c.globalAlpha = 1;
    },
  },

  eels: {
    under: (S, { e }) => {
      const { c, t, s } = S;
      c.strokeStyle = 'rgb(8,14,18)';
      c.lineWidth = 3 * s;
      c.lineCap = 'round';
      for (let i = 0; i < 7; i++) {
        const y = S.surface + (0.15 + h(i + 600) * 0.5) * S.H;
        if (y < S.cam - 30 || y > S.cam + S.H + 30) continue;
        const span = S.W + 300;
        const x = wrap(t * 22 * s * (0.6 + h(i + 601)) + h(i + 602) * span, span) - 150;
        c.globalAlpha = e.k * 0.65;
        c.beginPath();
        for (let k = 0; k < 14; k++) {
          const px = x - k * 6 * s;
          const py = y + Math.sin(t * 4 - k * 0.7 + i) * 5 * s;
          if (k === 0) c.moveTo(px, py);
          else c.lineTo(px, py);
        }
        c.stroke();
      }
      c.globalAlpha = 1;
    },
  },

  hail: {
    front: (S, { e }) => {
      const { c, t, s } = S;
      const n = Math.round((S.q === 0 ? 60 : 120) * e.k);
      const range = S.surface - S.cam + 40 * s;
      c.fillStyle = 'rgba(240,248,255,0.85)';
      for (let i = 0; i < n; i++) {
        const y = S.cam - 20 + wrap(h(i + 700) * range + t * 820 * s * (0.8 + h(i + 701) * 0.4), range);
        const x = wrap(h(i + 702) * (S.W + 100) + t * S.windPx * 0.5, S.W + 100) - 50;
        if (y > S.sAt(x)) continue;
        c.fillRect(x, y, 2 * s, 2.6 * s);
      }
      for (let i = 0; i < 30 * e.k; i++) {
        const ph = (t * 3 + h(i + 710)) % 1;
        const x = h(i + 711 + Math.floor(t * 3 + h(i + 710))) * S.W;
        c.globalAlpha = 1 - ph;
        c.fillRect(x, S.sAt(x) - ph * 6 * s, 1.5 * s, 1.5 * s);
      }
      c.globalAlpha = 1;
    },
  },

  petrels: {
    horizon: (S, { e }) => {
      const { c, t } = S;
      c.strokeStyle = css(mix([30, 32, 38], S.pal.land1, 0.3), e.k * 0.9);
      c.lineCap = 'round';
      c.beginPath();
      for (let i = 0; i < 8; i++) {
        const span = S.W + 100;
        const p = 0.5 + h(i + 800) * 0.45;
        const z = zAt(S, p);
        const x = wrap(t * (60 + h(i + 801) * 40) * z + h(i + 802) * span, span) - 50;
        const y = farY(S, p) - (3 + Math.abs(Math.sin(t * 3 + i)) * 6) * z * 2 + Math.sin(t * 9 + i) * z;
        const w = 4 * z;
        const fl = Math.sin(t * 14 + i) * 2 * z;
        c.lineWidth = Math.max(0.8, 1.1 * z);
        c.moveTo(x - w, y - fl);
        c.lineTo(x, y);
        c.lineTo(x + w, y - fl);
      }
      c.stroke();
    },
  },

  current: {
    horizon: (S, { e }) => {
      const { c, t, s } = S;
      c.fillStyle = 'rgb(200,235,245)';
      for (let j = 0; j < 12; j++) {
        const pj = 0.1 + (j / 12) * 0.9;
        const y = farY(S, pj);
        for (let i = 0; i < 3; i++) {
          const span = S.W + 300;
          const x = wrap(t * (30 + pj * 90) * s + h(j * 5 + i + 900) * span, span) - 150;
          c.globalAlpha = e.k * 0.2;
          c.fillRect(x, y, (20 + pj * 140) * s, Math.max(0.8, pj * 1.4 * s));
        }
      }
      c.globalAlpha = 1;
    },
    under: (S, { e }) => {
      const { c, t, s } = S;
      c.fillStyle = 'rgb(190,230,245)';
      for (let i = 0; i < 40; i++) {
        const y = S.surface + h(i + 950) * S.H * 0.8;
        if (y < S.cam - 10 || y > S.cam + S.H + 10) continue;
        const x = wrap(t * (80 + h(i + 951) * 60) * s + h(i + 952) * S.W, S.W + 40) - 20;
        c.globalAlpha = e.k * 0.22;
        c.fillRect(x, y, 22 * s, 1);
      }
      c.globalAlpha = 1;
    },
  },

  wisps: {
    horizon: (S, { e, spec }) => {
      const { t } = S;
      const n = Math.max(2, Math.round(9 * (spec.n ?? 1)));
      S.c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < n; i++) {
        const p = 0.2 + h(i + 1000) * 0.7;
        const z = zAt(S, p) * 2;
        const x = h(i + 1001) * S.visW + Math.sin(t * 0.3 + i) * 40 * z;
        const y = farY(S, p) - (10 + Math.sin(t * 0.8 + i * 1.3) * 8) * z;
        S.glow(x, y, (10 + 4 * Math.sin(t * 2 + i)) * z, [190, 240, 225], e.k * 0.6 * (0.5 + 0.5 * Math.sin(t * 1.5 + i)));
      }
      S.c.globalCompositeOperation = 'source-over';
      S.c.globalAlpha = 1;
    },
  },
};

/** Нарисовать все эффекты активных событий для слоя */
export function drawEventFx(S: FxScene, layer: Layer, calls: FxCall[]) {
  for (const f of calls) {
    if (f.e.k <= 0.003 && !(f.spec.id === 'shelf' && f.e.omen > 0) && !(f.spec.id === 'fallenstar' && f.age < 4.5 && f.age > 0)) continue;
    const d = FX[f.spec.id]?.[layer];
    if (!d) continue;
    S.c.save();
    d(S, f);
    S.c.restore();
  }
}
