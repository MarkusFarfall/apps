import { getMorph, type Morph, type TailType } from './morph';
import type { FishDef, Variant } from './types';

/**
 * Отрисовка рыб — v2.
 *
 * Совместимо со старым API (projects/water-import/src/game/fishDraw.ts):
 *   drawFish(ctx, fish, x, y, L, dir, opts) · drawFishGlow · glowDot · fishScreenLen · mixHex
 * Рыба рисуется носом вправо, центр в (x, y), длина L.
 *
 * Что нового:
 *  • тело изгибается волной (opts.wag — фаза), голова почти неподвижна, хвост работает;
 *  • противотень: тёмная спина → цвет тела → светлое брюхо, блик на спине, тень под брюхом;
 *  • чешуя рядами, мелкая у тунцов, точечная кожа у акул, костные пластины у кузовков;
 *  • полупрозрачные плавники с лучами и каймой, колючие спинные с зубчатой перепонкой;
 *  • узоры по форме тела: полосы следуют изгибу, «сёдла» сужаются к брюху, пятна живые;
 *  • перламутровая полоса у серебристых рыб, жаберная крышка, губы, усики, ноздри;
 *  • глаз: тень глазницы, радужка, зрачок, два блика;
 *  • отдельные формы: акулы (молот, лисица, пила, домовой, китовая), марлины и парусники,
 *    скаты и манты (вид сверху), удильщики, кальмары, осьминоги, дамбо, рыба-ёж, кузовок,
 *    капля, пинагор, луна-рыба, конёк, целакант с лопастными плавниками, угри, химеры;
 *  • варианты: альбинос, золотая (металл и блёстки), меланист, трофейная, со шрамами.
 */

export interface FishDrawOpts {
  alpha?: number;
  silhouette?: string | null;
  variant?: Variant | null;
  /** фаза анимации */
  wag?: number;
  /** 0..1 затемнение глубиной */
  darken?: number;
  glowBoost?: number;
  /** детализация: 0 — без чешуи и мелочей, 1 — обычно, 2 — витрина. По умолчанию — по размеру */
  detail?: 0 | 1 | 2;
  /** не изгибать тело */
  still?: boolean;
}

type RGB = [number, number, number];
type Pt = [number, number];

const PI = Math.PI;
const TAU = PI * 2;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const hex2 = (h: string): RGB => {
  const n = parseInt(h.slice(1, 7), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const mixR = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const luma = (c: RGB) => c[0] * 0.299 + c[1] * 0.587 + c[2] * 0.114;
const satR = (c: RGB, k: number): RGB => {
  const l = luma(c);
  return [clamp(l + (c[0] - l) * k, 0, 255), clamp(l + (c[1] - l) * k, 0, 255), clamp(l + (c[2] - l) * k, 0, 255)];
};
const toHex = (c: RGB) => '#' + c.map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
const WHITE: RGB = [255, 255, 255];
const BLACK: RGB = [0, 0, 0];
const DEEP: RGB = [2, 6, 12];

export function mixHex(a: string, b: string, t: number) {
  return toHex(mixR(hex2(a), hex2(b), t));
}

const genus = (f: FishDef) => f.latin.split(' ')[0];
const inG = (f: FishDef, ...g: string[]) => g.includes(genus(f));

function seeded(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function bez(p0: Pt, p1: Pt, p2: Pt, p3: Pt, n = 28): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push([
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ]);
  }
  return out;
}
function yAt(s: Pt[], x: number) {
  for (let i = 0; i < s.length - 1; i++) {
    const [x0, y0] = s[i];
    const [x1, y1] = s[i + 1];
    if ((x <= x0 && x >= x1) || (x >= x0 && x <= x1)) return x1 === x0 ? y0 : y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return Math.abs(x - s[0][0]) < Math.abs(x - s[s.length - 1][0]) ? s[0][1] : s[s.length - 1][1];
}

interface Pal {
  back: RGB;
  body: RGB;
  belly: RGB;
  fin: RGB;
  accent: RGB;
  hasAccent: boolean;
  pat: RGB;
  iris: RGB;
  pupil: RGB;
}

const RED_EYE = ['Tinca', 'Scardinius', 'Rutilus', 'Lates', 'Myripristis', 'Sargocentron', 'Pterois'];
const GREEN_EYE = ['Centrophorus', 'Hexanchus', 'Notorynchus', 'Macropinna'];

function makePal(f: FishDef, v: Variant | null | undefined): Pal {
  let body = hex2(f.colors.body);
  let belly = hex2(f.colors.belly);
  let fin = hex2(f.colors.fin);
  let accent: RGB | null = f.colors.accent ? hex2(f.colors.accent) : null;
  let iris: RGB = inG(f, ...RED_EYE) ? [196, 44, 36] : inG(f, ...GREEN_EYE) ? [90, 220, 140] : mixR(body, [222, 188, 100], 0.62);
  let pupil: RGB = [6, 7, 10];
  if (v === 'albino') {
    body = [244, 236, 230];
    belly = [255, 252, 248];
    fin = [244, 210, 208];
    accent = accent ? mixR(accent, WHITE, 0.72) : null;
    iris = [236, 160, 160];
    pupil = [160, 26, 40];
  } else if (v === 'golden') {
    body = [222, 164, 30];
    belly = [255, 238, 168];
    fin = [210, 142, 24];
    accent = accent ? [255, 226, 140] : null;
    iris = [255, 214, 110];
  } else if (v === 'melanist') {
    body = [30, 30, 38];
    belly = [62, 62, 74];
    fin = [18, 18, 26];
    accent = accent ? mixR(accent, [20, 20, 28], 0.75) : null;
  } else if (v === 'trophy') {
    body = satR(body, 1.3);
    belly = satR(belly, 1.1);
    fin = satR(fin, 1.35);
    accent = accent ? satR(accent, 1.35) : null;
  }
  const back = mixR(body, BLACK, v === 'melanist' ? 0.45 : 0.32);
  const pat = accent ?? (luma(body) < 60 ? mixR(body, WHITE, 0.42) : mixR(body, BLACK, 0.45));
  return { back, body, belly, fin, accent: accent ?? fin, hasAccent: !!accent, pat, iris, pupil };
}

type YFn = (x: number) => number;
type SkinKind = 'cycloid' | 'fine' | 'dermal' | 'none';

class Painter {
  readonly c: CanvasRenderingContext2D;
  readonly f: FishDef;
  readonly L: number;
  readonly M: Morph;
  readonly P: Pal;
  readonly sil: string | null;
  readonly dk: number;
  readonly wag: number;
  readonly amp: number;
  readonly det: 0 | 1 | 2;
  readonly v: Variant | null;
  readonly boost: number;
  rnd: () => number;
  /** длина волны изгиба */
  private wave = 3.4;

  constructor(c: CanvasRenderingContext2D, f: FishDef, L: number, o: FishDrawOpts) {
    this.c = c;
    this.f = f;
    this.L = L;
    this.M = getMorph(f);
    this.v = o.variant ?? null;
    this.P = makePal(f, this.v);
    this.sil = o.silhouette ?? null;
    this.dk = clamp(o.darken ?? 0, 0, 1);
    this.wag = o.wag ?? 0.6;
    this.boost = o.glowBoost ?? 1;
    const s = f.shape;
    const ampK = s === 'eel' ? 0.075 : s === 'long' ? 0.05 : s === 'shark' ? 0.04 : s === 'deep' || s === 'flat' || s === 'puffer' || s === 'blob' || s === 'angler' ? 0.022 : 0.036;
    if (s === 'eel') this.wave = 6;
    this.amp = o.still || s === 'ray' || s === 'squid' ? 0 : L * ampK;
    this.det = o.detail ?? (L < 34 ? 0 : L < 110 ? 1 : 2);
    this.rnd = seeded(f.id);
  }

  /* ─────────── цвет и путь ─────────── */

  col(c: RGB, a = 1): string {
    if (this.sil) return this.sil;
    const r = this.dk > 0 ? mixR(c, DEEP, this.dk) : c;
    return `rgba(${r[0] | 0},${r[1] | 0},${r[2] | 0},${a})`;
  }

  /** Смещение по Y от изгиба тела в точке x */
  by(x: number) {
    if (!this.amp) return 0;
    const t = (this.L * 0.3 - x) / (this.L * 0.84);
    if (t <= 0) return 0;
    const tt = Math.min(1.3, t);
    return this.amp * Math.sin(this.wag - tt * this.wave) * tt * tt;
  }
  m(x: number, y: number) {
    this.c.moveTo(x, y + this.by(x));
  }
  l(x: number, y: number) {
    this.c.lineTo(x, y + this.by(x));
  }
  q(cx: number, cy: number, x: number, y: number) {
    this.c.quadraticCurveTo(cx, cy + this.by(cx), x, y + this.by(x));
  }
  b(p1: Pt, p2: Pt, p3: Pt) {
    this.c.bezierCurveTo(p1[0], p1[1] + this.by(p1[0]), p2[0], p2[1] + this.by(p2[0]), p3[0], p3[1] + this.by(p3[0]));
  }
  poly(pts: Pt[], close = true) {
    this.c.beginPath();
    pts.forEach(([x, y], i) => (i ? this.l(x, y) : this.m(x, y)));
    if (close) this.c.closePath();
  }

  /* ─────────── общие детали ─────────── */

  aura(col: RGB, a: number, r = 0.62) {
    if (this.sil) return;
    const c = this.c;
    const R = this.L * r;
    const g = c.createRadialGradient(0, 0, 0, 0, 0, R);
    g.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},${a})`);
    g.addColorStop(1, `rgba(${col[0]},${col[1]},${col[2]},0)`);
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = g;
    c.fillRect(-R, -R, R * 2, R * 2);
    c.restore();
  }

  /** Перепонка плавника: градиент от основания к краю, лучи, кайма */
  membrane(path: () => void, from: Pt, to: Pt, rays: [Pt, Pt][] | null, a0 = 0.94, a1 = 0.58, color?: RGB, edgeColor?: RGB | null) {
    const c = this.c;
    const col = color ?? this.P.fin;
    path();
    if (this.sil) {
      c.fillStyle = this.sil;
      c.fill();
      return;
    }
    const g = c.createLinearGradient(from[0], from[1] + this.by(from[0]), to[0], to[1] + this.by(to[0]));
    g.addColorStop(0, this.col(mixR(col, this.P.body, 0.3), a0));
    g.addColorStop(0.55, this.col(col, (a0 + a1) / 2));
    g.addColorStop(1, this.col(mixR(col, WHITE, 0.22), a1));
    c.fillStyle = g;
    c.fill();
    if (rays && this.det >= 1) {
      c.save();
      path();
      c.clip();
      c.strokeStyle = this.col(mixR(col, BLACK, 0.5), 0.32);
      c.lineWidth = Math.max(0.4, this.L * 0.0035);
      c.beginPath();
      for (const [p, q] of rays) {
        this.m(p[0], p[1]);
        this.l(q[0], q[1]);
      }
      c.stroke();
      c.restore();
    }
    path();
    const edge = edgeColor !== undefined ? edgeColor : this.M.finEdge ? hex2(this.M.finEdge) : null;
    c.strokeStyle = edge ? this.col(edge, 0.9) : this.col(mixR(col, BLACK, 0.5), 0.35);
    c.lineWidth = Math.max(0.5, this.L * (edge ? 0.0075 : 0.004));
    c.stroke();
  }

  /** Плавник вдоль кромки тела (спинной — sgn −1, анальный — +1) */
  finAlong(yFn: YFn, x0: number, x1: number, H: number, sgn: -1 | 1, kind: 'round' | 'pointed' | 'sail' | 'spiny', h: number, spines = 0, color?: RGB) {
    const L = this.L;
    const n = spines ? spines * 5 : 16;
    const base: Pt[] = [];
    const edge: Pt[] = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = x1 - (x1 - x0) * t;
      let p: number;
      if (kind === 'pointed') p = t < 0.2 ? 0.3 + (0.7 * t) / 0.2 : 1 - (0.78 * (t - 0.2)) / 0.8;
      else if (kind === 'sail') p = 0.45 + 0.55 * Math.pow(Math.sin(PI * Math.min(1, t * 1.08)), 0.55);
      else if (kind === 'spiny') p = 1 - 0.38 * t;
      else p = Math.pow(Math.sin(PI * (0.03 + t * 0.94)), 0.7);
      if (kind === 'spiny' && spines) {
        const ph = t * spines;
        const d = Math.abs(ph - Math.round(ph));
        p *= 1 - 0.27 * Math.pow(2 * d, 0.55);
      }
      const fl = 1 + 0.05 * Math.sin(this.wag * 1.7 - t * 5);
      const rake = L * 0.032 * p * (kind === 'sail' ? 0.5 : 1);
      base.push([x, yFn(x) - sgn * h * 0.04]);
      edge.push([x - rake, yFn(x) + sgn * H * p * fl]);
    }
    const path = () => {
      this.c.beginPath();
      this.m(base[0][0], base[0][1]);
      for (const [x, y] of edge) this.l(x, y);
      for (let i = n; i >= 0; i--) this.l(base[i][0], base[i][1]);
      this.c.closePath();
    };
    const rays: [Pt, Pt][] = [];
    const step = spines ? 5 : 2;
    for (let i = spines ? 0 : 1; i <= n; i += step) rays.push([base[i], edge[i]]);
    const mid = Math.floor(n / 2);
    this.membrane(path, base[mid], edge[mid], rays, 0.92, kind === 'spiny' ? 0.5 : 0.6, color);
    if (spines && !this.sil && this.det >= 1) {
      const c = this.c;
      c.strokeStyle = this.col(mixR(color ?? this.P.fin, BLACK, 0.4), 0.75);
      c.lineWidth = Math.max(0.5, L * 0.006);
      c.beginPath();
      for (let i = 0; i <= n; i += 5) {
        this.m(base[i][0], base[i][1]);
        this.l(edge[i][0], edge[i][1]);
      }
      c.stroke();
    }
  }

  /** Хвостовой плавник по типу */
  caudal(tx: number, h: number, type: TailType, size = 1, color?: RGB) {
    const L = this.L;
    const len = L * 0.17 * size;
    const span = h * 0.62 * size;
    const y0 = Math.max(L * 0.01, h * 0.08);
    const path = () => {
      const c = this.c;
      c.beginPath();
      this.m(tx + L * 0.03, -y0);
      switch (type) {
        case 'deepfork':
          this.q(tx - len * 0.45, -span * 0.35, tx - len * 1.15, -span * 1.05);
          this.q(tx - len * 0.5, -span * 0.2, tx - len * 0.28, 0);
          this.q(tx - len * 0.5, span * 0.2, tx - len * 1.15, span * 1.05);
          this.q(tx - len * 0.45, span * 0.35, tx + L * 0.03, y0);
          break;
        case 'lunate':
          this.l(tx - len * 0.2, -y0 * 0.7);
          this.q(tx - len * 0.55, -span * 0.7, tx - len * 1.08, -span * 1.18);
          this.q(tx - len * 0.6, -span * 0.25, tx - len * 0.52, 0);
          this.q(tx - len * 0.6, span * 0.25, tx - len * 1.08, span * 1.18);
          this.q(tx - len * 0.55, span * 0.7, tx - len * 0.2, y0 * 0.7);
          this.l(tx + L * 0.03, y0);
          break;
        case 'round':
          this.b([tx - len * 0.4, -span * 0.95], [tx - len * 1.12, -span * 0.75], [tx - len * 1.06, 0]);
          this.b([tx - len * 1.12, span * 0.75], [tx - len * 0.4, span * 0.95], [tx + L * 0.03, y0]);
          break;
        case 'truncate':
          this.l(tx - len * 0.86, -span * 0.86);
          this.q(tx - len * 1.02, 0, tx - len * 0.86, span * 0.86);
          this.l(tx + L * 0.03, y0);
          break;
        case 'emarg':
          this.l(tx - len * 0.96, -span * 0.92);
          this.q(tx - len * 0.7, 0, tx - len * 0.96, span * 0.92);
          this.l(tx + L * 0.03, y0);
          break;
        case 'pointed':
          this.q(tx - len * 0.6, -span * 0.42, tx - len * 1.3, 0);
          this.q(tx - len * 0.6, span * 0.42, tx + L * 0.03, y0);
          break;
        default:
          this.q(tx - len * 0.5, -span * 0.35, tx - len, -span * 0.96);
          this.q(tx - len * 0.58, 0, tx - len, span * 0.96);
          this.q(tx - len * 0.5, span * 0.35, tx + L * 0.03, y0);
      }
      c.closePath();
    };
    const rays: [Pt, Pt][] = [];
    for (let i = -6; i <= 6; i++) rays.push([[tx + L * 0.02, (i / 6) * y0], [tx - len * 1.3, (i / 6) * span * 1.3]]);
    this.membrane(path, [tx, 0], [tx - len, 0], rays, 0.95, 0.68, color);
  }

  pectoral(x: number, y: number, size: number, opts: { wing?: boolean; color?: RGB; lionfish?: boolean } = {}) {
    const L = this.L;
    const fl = Math.sin(this.wag * 1.3) * 0.12;
    const s = size * (opts.wing ? 2.1 : opts.lionfish ? 2.4 : 1);
    const a = opts.wing ? -0.15 : 0.18;
    const tip1: Pt = [x - L * 0.15 * s, y - L * 0.04 * s + a * L * 0.05 + fl * L * 0.03];
    const tip2: Pt = [x - L * 0.12 * s, y + L * 0.065 * s + fl * L * 0.04];
    const path = () => {
      this.c.beginPath();
      this.m(x, y - L * 0.012);
      this.q(x - L * 0.06 * s, y - L * 0.04 * s, tip1[0], tip1[1]);
      if (opts.lionfish || opts.wing) {
        const n = opts.lionfish ? 9 : 6;
        for (let i = 1; i <= n; i++) {
          const t = i / n;
          const px = tip1[0] + (tip2[0] - tip1[0]) * t - Math.sin(t * PI) * L * 0.035 * s;
          const py = tip1[1] + (tip2[1] - tip1[1]) * t;
          const vx = tip1[0] + (tip2[0] - tip1[0]) * (t - 0.5 / n) - Math.sin(t * PI) * L * 0.02 * s;
          this.q(vx + L * 0.02 * s, py - L * 0.012 * s, px, py);
        }
      } else this.q(x - L * 0.16 * s, y + L * 0.02 * s, tip2[0], tip2[1]);
      this.q(x - L * 0.04 * s, y + L * 0.04 * s, x, y + L * 0.012);
      this.c.closePath();
    };
    const rays: [Pt, Pt][] = [];
    for (let i = 0; i <= 7; i++) {
      const t = i / 7;
      rays.push([[x, y], [tip1[0] + (tip2[0] - tip1[0]) * t - L * 0.02 * s, tip1[1] + (tip2[1] - tip1[1]) * t]]);
    }
    const col = opts.color ?? this.P.fin;
    this.membrane(path, [x, y], [(tip1[0] + tip2[0]) / 2, (tip1[1] + tip2[1]) / 2], rays, 0.85, opts.wing ? 0.7 : 0.5, col, opts.wing && this.P.hasAccent ? this.P.accent : undefined);
    if ((opts.wing || opts.lionfish) && !this.sil && this.det >= 1) {
      // пятна и полосы на «крыльях»
      const c = this.c;
      c.save();
      path();
      c.clip();
      c.fillStyle = this.col(this.P.hasAccent ? this.P.accent : mixR(col, BLACK, 0.4), opts.lionfish ? 0.55 : 0.45);
      for (let i = 0; i < (opts.lionfish ? 12 : 7); i++) {
        const t = this.rnd();
        const px = x - L * (0.03 + t * 0.12) * s;
        const py = y + (this.rnd() - 0.4) * L * 0.08 * s;
        c.beginPath();
        c.arc(px, py + this.by(px), L * 0.009 * s, 0, TAU);
        c.fill();
      }
      c.restore();
    }
  }

  pelvic(x: number, y: number, size = 1) {
    const L = this.L;
    const s = size;
    const path = () => {
      this.c.beginPath();
      this.m(x + L * 0.02 * s, y);
      this.q(x - L * 0.02 * s, y + L * 0.05 * s, x - L * 0.07 * s, y + L * 0.06 * s);
      this.q(x - L * 0.04 * s, y + L * 0.015 * s, x - L * 0.03 * s, y);
      this.c.closePath();
    };
    this.membrane(path, [x, y], [x - L * 0.05 * s, y + L * 0.05 * s], [[[x, y], [x - L * 0.06 * s, y + L * 0.055 * s]]], 0.85, 0.55);
  }

  eye(x: number, y: number, r: number, opts: { tube?: boolean } = {}) {
    if (this.sil || r < 0.7) return;
    const c = this.c;
    const yy = y + this.by(x);
    const P = this.P;
    // тень глазницы
    const sh = c.createRadialGradient(x, yy, r * 0.85, x, yy, r * 1.7);
    sh.addColorStop(0, 'rgba(0,0,0,0.3)');
    sh.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = sh;
    c.beginPath();
    c.arc(x, yy, r * 1.7, 0, TAU);
    c.fill();
    if (opts.tube) {
      c.fillStyle = this.col([90, 230, 140], 0.95);
      c.beginPath();
      c.ellipse(x, yy - r * 0.9, r * 0.9, r * 1.4, 0, 0, TAU);
      c.fill();
    }
    // радужка
    const ig = c.createRadialGradient(x - r * 0.25, yy - r * 0.3, r * 0.1, x, yy, r);
    ig.addColorStop(0, this.col(mixR(P.iris, WHITE, 0.4)));
    ig.addColorStop(0.55, this.col(P.iris));
    ig.addColorStop(1, this.col(mixR(P.iris, BLACK, 0.45)));
    c.fillStyle = ig;
    c.beginPath();
    c.arc(x, yy, r, 0, TAU);
    c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.45)';
    c.lineWidth = Math.max(0.5, r * 0.12);
    c.stroke();
    // зрачок
    c.fillStyle = this.col(P.pupil);
    c.beginPath();
    c.arc(x + r * 0.08, yy + r * 0.02, r * 0.6, 0, TAU);
    c.fill();
    // блики
    c.fillStyle = 'rgba(255,255,255,0.9)';
    c.beginPath();
    c.arc(x + r * 0.3, yy - r * 0.32, r * 0.22, 0, TAU);
    c.fill();
    c.fillStyle = 'rgba(255,255,255,0.4)';
    c.beginPath();
    c.arc(x - r * 0.24, yy + r * 0.26, r * 0.1, 0, TAU);
    c.fill();
  }

  /** Тело: противотень, узор, чешуя, свет, контур */
  skin(body: () => void, h: number, o: { topY: YFn; botY: YFn; head: number; kind: SkinKind; silver?: boolean; front?: number; rear?: number }) {
    const c = this.c;
    const P = this.P;
    const L = this.L;
    body();
    if (this.sil) {
      c.fillStyle = this.sil;
      c.fill();
      return;
    }
    const g = c.createLinearGradient(0, -h * 0.66, 0, h * 0.62);
    g.addColorStop(0, this.col(P.back));
    g.addColorStop(0.36, this.col(P.body));
    g.addColorStop(0.6, this.col(mixR(P.body, P.belly, 0.65)));
    g.addColorStop(1, this.col(P.belly));
    c.fillStyle = g;
    c.fill();
    c.save();
    body();
    c.clip();
    const front = o.front ?? L * 0.42;
    const rear = o.rear ?? -L * 0.42;
    if (o.silver) this.iridescence(h);
    this.pattern(o.topY, o.botY, h, front, rear);
    if (this.det >= 1) this.scales(o.topY, o.botY, h, o.head, rear, o.kind);
    this.light(o.topY, h, front, rear);
    c.restore();
    body();
    c.strokeStyle = this.col(mixR(P.back, BLACK, 0.5), 0.55);
    c.lineWidth = Math.max(0.6, L * 0.0065);
    c.stroke();
  }

  iridescence(h: number) {
    const c = this.c;
    const L = this.L;
    const g = c.createLinearGradient(L * 0.35, 0, -L * 0.42, 0);
    g.addColorStop(0, 'rgba(150,225,255,0)');
    g.addColorStop(0.2, 'rgba(150,225,255,0.16)');
    g.addColorStop(0.45, 'rgba(255,175,230,0.13)');
    g.addColorStop(0.72, 'rgba(255,232,150,0.13)');
    g.addColorStop(1, 'rgba(150,225,255,0)');
    c.fillStyle = g;
    for (let i = 0; i < 3; i++) {
      c.globalAlpha = 0.55 + i * 0.25;
      c.fillRect(-L, -h * (0.14 - i * 0.05), L * 2, h * (0.42 - i * 0.12));
    }
    c.globalAlpha = 1;
  }

  pattern(topY: YFn, botY: YFn, h: number, front: number, rear: number) {
    const f = this.f;
    const p = f.pattern;
    if (!p || p === 'none') return;
    const c = this.c;
    const L = this.L;
    const M = this.M;
    const P = this.P;
    const r = this.rnd;
    const span = front - rear;
    if (p === 'spots') {
      const small = f.shape === 'shark' || f.shape === 'billfish' ? 0.5 : f.shape === 'ray' ? 0.7 : 1;
      const n = Math.round(26 * M.patDensity * (this.det === 2 ? 1.25 : 1));
      const salmonid = inG(f, 'Salmo', 'Salvelinus', 'Oncorhynchus', 'Thymallus') && P.hasAccent;
      for (let i = 0; i < n; i++) {
        const x = rear + span * (0.06 + r() * 0.86);
        const yf = Math.pow(r(), 0.85) * 0.78;
        const t = topY(x);
        const y = t + (botY(x) - t) * (0.08 + yf) + this.by(x);
        const rr = L * (0.008 + r() * 0.017) * small * M.patScale;
        const col = salmonid && i % 3 === 0 ? P.accent : salmonid ? mixR(P.body, BLACK, 0.5) : P.pat;
        c.fillStyle = this.col(col, 0.16);
        c.beginPath();
        c.ellipse(x, y, rr * 1.8, rr * 1.5, r() * PI, 0, TAU);
        c.fill();
        if (salmonid && i % 3 === 0) {
          c.fillStyle = this.col(mixR(P.belly, WHITE, 0.4), 0.55);
          c.beginPath();
          c.arc(x, y, rr * 1.35, 0, TAU);
          c.fill();
        }
        c.fillStyle = this.col(col, 0.68);
        c.beginPath();
        c.ellipse(x, y, rr * (0.8 + r() * 0.5), rr * (0.7 + r() * 0.4), r() * PI, 0, TAU);
        c.fill();
      }
    } else if (p === 'bars') {
      const n = M.patDensity > 1.1 ? 6 : 5;
      for (let i = 0; i < n; i++) {
        const x = front - span * (0.16 + (i / (n - 1)) * 0.72);
        const w = L * 0.03 * M.patScale;
        const t = topY(x);
        const bt = t + (botY(x) - t) * 0.82;
        for (const [k, a] of [
          [1.9, 0.16],
          [1, 0.5],
        ] as const) {
          c.fillStyle = this.col(P.pat, a);
          c.beginPath();
          this.m(x - w * k, t - h * 0.1);
          this.l(x + w * k, t - h * 0.1);
          this.q(x + w * k * 0.7, (t + bt) / 2, x + w * 0.3, bt);
          this.l(x - w * 0.3, bt);
          this.q(x - w * k * 0.8, (t + bt) / 2, x - w * k, t - h * 0.1);
          c.fill();
        }
      }
    } else if (p === 'stripes') {
      const fr = M.patDensity > 1.05 ? [0.18, 0.34, 0.5, 0.66] : [0.24, 0.44, 0.64];
      c.lineCap = 'round';
      for (const k of fr) {
        c.strokeStyle = this.col(P.pat, 0.5);
        c.lineWidth = h * 0.06 * M.patScale;
        c.beginPath();
        for (let i = 0; i <= 24; i++) {
          const x = front - span * (0.12 + (i / 24) * 0.84);
          const t = topY(x);
          const y = t + (botY(x) - t) * k;
          if (i) this.l(x, y);
          else this.m(x, y);
        }
        c.stroke();
      }
    } else if (p === 'gradient') {
      // металлическая спина с волнистой кромкой (тунцы, сельдь)
      c.fillStyle = this.col(mixR(P.back, P.body, 0.3), 0.55);
      c.beginPath();
      this.m(front, topY(front) - h);
      for (let i = 0; i <= 24; i++) {
        const x = front - span * (i / 24);
        const t = topY(x);
        const y = t + (botY(x) - t) * (0.3 + Math.sin(i * 1.3) * 0.03);
        this.l(x, y);
      }
      this.l(rear, -h * 2);
      c.closePath();
      c.fill();
      this.iridescence(h);
    }
  }

  scales(topY: YFn, botY: YFn, h: number, head: number, rear: number, kind: SkinKind) {
    const c = this.c;
    const L = this.L;
    if (kind === 'none') return;
    if (kind === 'dermal') {
      if (this.det < 2) return;
      c.fillStyle = 'rgba(0,0,0,0.06)';
      const r = this.rnd;
      for (let i = 0; i < 220; i++) {
        const x = rear + (head - rear) * r();
        const t = topY(x);
        const y = t + (botY(x) - t) * r() + this.by(x);
        c.fillRect(x, y, L * 0.004, L * 0.004);
      }
      return;
    }
    const sz = kind === 'fine' ? Math.max(1.8, L * 0.024) : Math.max(2.6, L * 0.042) * (this.f.shape === 'deep' ? 1.1 : 1);
    if (sz < 2) return;
    let row = 0;
    for (let y = -h * 0.75; y < h * 0.7; y += sz * 0.62, row++) {
      const fade = Math.pow(clamp(1 - Math.abs(y) / (h * 0.8), 0, 1), 0.6);
      if (fade < 0.05) continue;
      const dark = new Path2D();
      const lite = new Path2D();
      for (let x = head; x > rear + sz * 0.5; x -= sz) {
        const xx = x - (row % 2) * sz * 0.5;
        const t = topY(xx);
        if (y < t + sz * 0.3 || y > botY(xx) - sz * 0.3) continue;
        const yy = y + this.by(xx);
        const rr = sz * 0.62;
        dark.moveTo(xx + Math.cos(PI * 0.55) * rr, yy + Math.sin(PI * 0.55) * rr);
        dark.arc(xx, yy, rr, PI * 0.55, PI * 1.45);
        lite.moveTo(xx + sz * 0.14 + Math.cos(PI * 0.62) * rr * 0.86, yy + Math.sin(PI * 0.62) * rr * 0.86);
        lite.arc(xx + sz * 0.14, yy, rr * 0.86, PI * 0.62, PI * 1.38);
      }
      c.strokeStyle = `rgba(0,0,0,${0.15 * fade})`;
      c.lineWidth = Math.max(0.45, L * 0.0042);
      c.stroke(dark);
      c.strokeStyle = `rgba(255,255,255,${0.1 * fade})`;
      c.lineWidth = Math.max(0.35, L * 0.003);
      c.stroke(lite);
    }
  }

  light(topY: YFn, h: number, front: number, rear: number) {
    const c = this.c;
    const L = this.L;
    const g = c.createLinearGradient(0, -h * 0.7, 0, h * 0.7);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.16, 'rgba(255,255,255,0.17)');
    g.addColorStop(0.32, 'rgba(255,255,255,0)');
    g.addColorStop(0.8, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.26)');
    c.fillStyle = g;
    c.fillRect(-L, -h, L * 2, h * 2);
    // блик на спине
    const sx = front - (front - rear) * 0.42;
    const sy = topY(sx) * 0.55 + this.by(sx);
    c.save();
    c.translate(sx, sy);
    c.scale(1, 0.16);
    const sg = c.createRadialGradient(0, 0, 0, 0, 0, (front - rear) * 0.36);
    sg.addColorStop(0, 'rgba(255,255,255,0.32)');
    sg.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = sg;
    c.beginPath();
    c.arc(0, 0, (front - rear) * 0.36, 0, TAU);
    c.fill();
    c.restore();
    // хвостовая часть в тени
    const tg = c.createLinearGradient(rear + L * 0.24, 0, rear, 0);
    tg.addColorStop(0, 'rgba(0,0,0,0)');
    tg.addColorStop(1, 'rgba(0,0,0,0.16)');
    c.fillStyle = tg;
    c.fillRect(-L, -h, L * 2, h * 2);
  }

  lateralLine(topY: YFn, x0: number, x1: number, scutes: boolean) {
    if (this.sil || this.det < 1) return;
    const c = this.c;
    const L = this.L;
    const pts: Pt[] = [];
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      const x = x0 - (x0 - x1) * t;
      pts.push([x, topY(x) * (0.46 - 0.4 * t * t)]);
    }
    c.beginPath();
    pts.forEach(([x, y], i) => (i ? this.l(x, y) : this.m(x, y)));
    c.strokeStyle = 'rgba(255,255,255,0.22)';
    c.lineWidth = Math.max(0.5, L * 0.005);
    c.stroke();
    c.strokeStyle = 'rgba(0,0,0,0.18)';
    c.lineWidth = Math.max(0.4, L * 0.0028);
    c.setLineDash([L * 0.006, L * 0.01]);
    c.stroke();
    c.setLineDash([]);
    if (scutes) {
      c.fillStyle = this.col(mixR(this.P.body, BLACK, 0.3), 0.8);
      for (let i = 12; i < 20; i++) {
        const [x, y] = pts[i];
        const yy = y + this.by(x);
        c.beginPath();
        c.moveTo(x + L * 0.012, yy);
        c.lineTo(x - L * 0.006, yy - L * 0.009);
        c.lineTo(x - L * 0.012, yy);
        c.lineTo(x - L * 0.006, yy + L * 0.009);
        c.closePath();
        c.fill();
      }
    }
  }

  barbels(x: number, y: number, kind: number, h: number) {
    if (!kind || this.sil) return;
    const c = this.c;
    const L = this.L;
    c.strokeStyle = this.col(mixR(this.P.belly, this.P.body, 0.45), 0.9);
    c.lineCap = 'round';
    const sw = Math.sin(this.wag * 1.2);
    if (kind === 1) {
      c.lineWidth = Math.max(0.6, L * 0.006);
      c.beginPath();
      this.m(x - L * 0.04, y + h * 0.12);
      this.q(x - L * 0.04, y + h * 0.3, x - L * 0.05 + sw * L * 0.006, y + h * 0.38);
      c.stroke();
    } else if (kind === 2) {
      c.lineWidth = Math.max(0.6, L * 0.0055);
      for (let i = 0; i < 2; i++) {
        c.beginPath();
        this.m(x - L * (0.01 + i * 0.015), y + h * 0.06);
        this.q(x - L * 0.01, y + h * 0.3, x - L * (0.03 + i * 0.02) + sw * L * 0.006, y + h * 0.42);
        c.stroke();
      }
    } else {
      c.lineWidth = Math.max(0.7, L * 0.007);
      c.beginPath();
      this.m(x - L * 0.015, y);
      this.q(x - L * 0.05, y - h * 0.2, x - L * 0.2 + sw * L * 0.02, y + h * 0.2);
      c.stroke();
      c.lineWidth = Math.max(0.5, L * 0.004);
      for (let i = 0; i < 2; i++) {
        c.beginPath();
        this.m(x - L * 0.03, y + h * 0.12);
        this.q(x - L * 0.04, y + h * 0.35, x - L * (0.07 + i * 0.03), y + h * 0.42);
        c.stroke();
      }
    }
  }

  teeth(x0: number, x1: number, yFn: YFn, size: number, up: boolean) {
    if (this.sil || this.det < 1) return;
    const c = this.c;
    c.fillStyle = 'rgba(240,236,224,0.95)';
    const n = Math.max(3, Math.round(Math.abs(x0 - x1) / (size * 1.6)));
    for (let i = 0; i < n; i++) {
      const x = x0 + ((x1 - x0) * (i + 0.5)) / n;
      const y = yFn(x) + this.by(x);
      const s = size * (0.6 + this.rnd() * 0.6);
      c.beginPath();
      c.moveTo(x - s * 0.35, y);
      c.lineTo(x, y + (up ? -s : s));
      c.lineTo(x + s * 0.35, y);
      c.closePath();
      c.fill();
    }
  }

  scars(topY: YFn, botY: YFn, x0: number, x1: number) {
    if (this.v !== 'scarred' || this.sil) return;
    const c = this.c;
    const L = this.L;
    const r = seeded(this.f.id + ':scar');
    for (let k = 0; k < 3; k++) {
      const x = x0 + (x1 - x0) * (0.2 + r() * 0.6);
      const t = topY(x);
      const y = t + (botY(x) - t) * (0.2 + r() * 0.4);
      const len = L * (0.08 + r() * 0.08);
      const a = -0.7 + r() * 0.5;
      const ex = x - Math.cos(a) * len;
      const ey = y - Math.sin(a) * len;
      c.lineCap = 'round';
      c.strokeStyle = 'rgba(60,30,30,0.45)';
      c.lineWidth = Math.max(1, L * 0.012);
      c.beginPath();
      this.m(x, y);
      this.q((x + ex) / 2, (y + ey) / 2 - L * 0.01, ex, ey);
      c.stroke();
      c.strokeStyle = 'rgba(240,220,210,0.8)';
      c.lineWidth = Math.max(0.5, L * 0.005);
      c.stroke();
    }
  }

  glints() {
    if (this.v !== 'golden' || this.sil || this.det < 1) return;
    const c = this.c;
    const L = this.L;
    const r = seeded(this.f.id + ':glint');
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) {
      const tw = 0.5 + 0.5 * Math.sin(this.wag * 1.7 + i * 2.1);
      const x = (r() - 0.55) * L * 0.7;
      const y = (r() - 0.6) * L * 0.18 + this.by(x);
      const s = L * 0.03 * tw;
      c.fillStyle = `rgba(255,244,200,${0.75 * tw})`;
      c.beginPath();
      c.moveTo(x, y - s);
      c.lineTo(x + s * 0.18, y);
      c.lineTo(x, y + s);
      c.lineTo(x - s * 0.18, y);
      c.closePath();
      c.moveTo(x - s, y);
      c.lineTo(x, y + s * 0.18);
      c.lineTo(x + s, y);
      c.lineTo(x, y - s * 0.18);
      c.closePath();
      c.fill();
    }
    c.restore();
  }

  photophores(botY: YFn, x0: number, x1: number, n = 7) {
    if (!this.f.glow || this.sil) return;
    const col = this.f.glow;
    for (let i = 0; i < n; i++) {
      const x = x0 - ((x0 - x1) * i) / (n - 1);
      glowDot(this.c, x, botY(x) * 0.78 + this.by(x), this.L * 0.022 * this.boost, col);
    }
  }

  lobe(x: number, y: number, len: number, ang: number, w: number) {
    // мясистая лопасть (целакант)
    const L = this.L;
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    const tip: Pt = [x + ca * len, y + sa * len];
    const path = () => {
      this.c.beginPath();
      this.m(x - sa * w, y + ca * w);
      this.q(x + ca * len * 0.5 - sa * w * 1.4, y + sa * len * 0.5 + ca * w * 1.4, tip[0], tip[1]);
      this.q(x + ca * len * 0.5 + sa * w * 1.4, y + sa * len * 0.5 - ca * w * 1.4, x + sa * w, y - ca * w);
      this.c.closePath();
    };
    this.membrane(path, [x, y], tip, [[[x, y], tip]], 0.95, 0.75, mixR(this.P.body, this.P.fin, 0.5));
    void L;
  }

  /* ─────────── формы ─────────── */

  draw() {
    const f = this.f;
    const g = genus(f);
    if (this.v === 'golden') this.aura([255, 200, 70], 0.3);
    if (f.glow && !this.sil) this.aura(hex2(f.glow), 0.12 * this.boost, 0.5);
    if (g === 'Hippocampus') this.seahorse();
    else if (g === 'Mola') this.mola();
    else if (g === 'Enteroctopus' || g === 'Grimpoteuthis') this.octopus(g === 'Grimpoteuthis');
    else if (g === 'Ostracion') this.boxfish();
    else if (g === 'Squatina') this.ray();
    else
      switch (f.shape) {
        case 'fusiform':
          this.standard(false);
          break;
        case 'deep':
          this.standard(true);
          break;
        case 'flat':
          this.flat();
          break;
        case 'eel':
        case 'long':
          this.elongated();
          break;
        case 'shark':
          this.shark();
          break;
        case 'billfish':
          this.billfish();
          break;
        case 'ray':
          this.ray();
          break;
        case 'angler':
          this.angler();
          break;
        case 'squid':
          this.squid();
          break;
        case 'puffer':
          this.puffer();
          break;
        case 'blob':
          this.blob();
          break;
      }
    this.glints();
  }

  /** Обычная костистая рыба: веретено (fusiform) или высокое тело (deep) */
  standard(deep: boolean) {
    const { L, M, f } = this;
    const g = genus(f);
    const h = L * (deep ? 0.56 : 0.3) * M.depth;
    const sn = M.snout;
    const noseY = M.jaw === 'up' ? -h * 0.08 : M.jaw === 'down' ? h * 0.07 : 0;
    const hx = L * M.hump;
    const ped = Math.max(L * 0.014, h * M.ped * (deep ? 1.2 : 1.7));
    const xp = -L * 0.36;
    const xb = -L * 0.41;
    const T: [Pt, Pt, Pt, Pt] = [
      [L * 0.5, noseY],
      [L * (0.48 - sn * 0.14), -h * (0.62 - sn * 0.3) + noseY * 0.4],
      [hx - L * 0.1, -h * 0.66],
      [xp, -ped],
    ];
    const B: [Pt, Pt, Pt, Pt] = [
      [xp, ped],
      [hx - L * 0.14, h * 0.6 * M.belly],
      [L * (0.46 - sn * 0.12), h * (0.48 - sn * 0.18) * M.belly],
      [L * 0.5, noseY],
    ];
    const ts = bez(...T);
    const bs = bez(...B);
    const topY: YFn = (x) => yAt(ts, x);
    const botY: YFn = (x) => yAt(bs, x);
    const body = () => {
      this.c.beginPath();
      this.m(T[0][0], T[0][1]);
      this.b(T[1], T[2], T[3]);
      this.l(xb, -ped * 0.8);
      this.l(xb, ped * 0.8);
      this.l(B[0][0], B[0][1]);
      this.b(B[1], B[2], B[3]);
      this.c.closePath();
    };
    const coel = g === 'Latimeria';
    const lion = g === 'Pterois';
    const flyer = g === 'Exocoetus';
    const barreleye = g === 'Macropinna';

    // задний план: хвост, спинные, анальный
    if (coel) {
      // дифицеркальный хвост с центральной лопастью
      this.caudal(xb + L * 0.01, h * 1.05, 'round', 1.05);
      this.lobe(xb - L * 0.08, 0, L * 0.12, PI, L * 0.022);
    } else this.caudal(xb + L * 0.01, h, M.tail, M.tailSize);
    if (coel) {
      this.finAlong(topY, L * 0.02, L * 0.14, h * 0.42, -1, 'spiny', h, 6);
      this.lobe(-L * 0.2, topY(-L * 0.2), L * 0.11, -PI * 0.82, L * 0.02);
      this.lobe(-L * 0.2, botY(-L * 0.2), L * 0.11, PI * 0.82, L * 0.02);
    } else {
      this.dorsals(topY, h);
      this.finAlong(botY, -L * 0.28, -L * 0.06, h * 0.3 * M.analH, 1, 'pointed', h);
    }
    if (M.finlets) this.finlets(topY, botY, h);

    const silver = f.pattern === 'gradient' || inG(f, 'Clupea', 'Sardina', 'Engraulis', 'Atherina', 'Megalops', 'Albula', 'Argyropelecus', 'Mugil', 'Chelon', 'Coregonus', 'Osmerus', 'Sprattus');
    const xo = L * (0.24 + sn * 0.03);
    this.skin(body, h, { topY, botY, head: xo - L * 0.02, kind: inG(f, 'Thunnus', 'Katsuwonus', 'Auxis', 'Scomber', 'Sarda', 'Gymnosarda') ? 'fine' : 'cycloid', silver });

    if (!this.sil) {
      const c = this.c;
      // голова: скула и жаберная крышка
      c.save();
      body();
      c.clip();
      const cg = c.createRadialGradient(L * 0.36, h * 0.05, 0, L * 0.36, h * 0.05, L * 0.16);
      cg.addColorStop(0, 'rgba(255,255,255,0.12)');
      cg.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = cg;
      c.fillRect(L * 0.1, -h, L * 0.5, h * 2);
      const gl = c.createRadialGradient(xo - L * 0.01, h * 0.08, 0, xo - L * 0.01, h * 0.08, h * 0.38);
      gl.addColorStop(0, 'rgba(190,60,60,0.12)');
      gl.addColorStop(1, 'rgba(190,60,60,0)');
      c.fillStyle = gl;
      c.fillRect(xo - L * 0.2, -h, L * 0.3, h * 2);
      c.restore();
      c.beginPath();
      this.m(xo + L * 0.012, topY(xo) * 0.78);
      this.q(xo - L * 0.035, h * 0.02, xo + L * 0.016, botY(xo) * 0.82);
      c.strokeStyle = 'rgba(0,0,0,0.32)';
      c.lineWidth = Math.max(0.6, L * 0.008);
      c.stroke();
      c.beginPath();
      this.m(xo + L * 0.02, topY(xo) * 0.74);
      this.q(xo - L * 0.027, h * 0.02, xo + L * 0.024, botY(xo) * 0.78);
      c.strokeStyle = 'rgba(255,255,255,0.15)';
      c.lineWidth = Math.max(0.5, L * 0.005);
      c.stroke();
      // рот
      const big = inG(f, 'Epinephelus', 'Stereolepis', 'Lates', 'Sander', 'Esox', 'Sphyraena', 'Polyprion', 'Dicentrarchus', 'Megalops', 'Latimeria') ? 1.6 : 1;
      const ml = L * 0.065 * big;
      c.beginPath();
      this.m(L * 0.5, noseY);
      this.q(L * 0.5 - ml * 0.5, noseY + h * 0.06, L * 0.5 - ml, noseY + h * 0.03);
      c.strokeStyle = 'rgba(0,0,0,0.5)';
      c.lineWidth = Math.max(0.6, L * 0.008);
      c.stroke();
      if (M.lips) {
        c.strokeStyle = this.col(mixR(this.P.body, WHITE, 0.25), 0.7);
        c.lineWidth = Math.max(0.8, L * 0.012);
        c.beginPath();
        this.m(L * 0.5, noseY - L * 0.004);
        this.q(L * 0.48, noseY - h * 0.03, L * 0.5 - ml * 0.7, noseY - h * 0.005);
        c.stroke();
      }
      if (M.jaw === 'beak') {
        c.fillStyle = this.col(mixR(this.P.belly, WHITE, 0.4), 0.95);
        c.beginPath();
        this.m(L * 0.5, noseY - h * 0.06);
        this.q(L * 0.53, noseY, L * 0.5, noseY + h * 0.06);
        this.l(L * 0.47, noseY);
        c.closePath();
        c.fill();
      }
      // ноздря
      c.fillStyle = 'rgba(0,0,0,0.4)';
      c.beginPath();
      const nx = L * 0.45;
      c.arc(nx, topY(nx) * 0.52 + this.by(nx), Math.max(0.5, L * 0.005), 0, TAU);
      c.fill();
    }
    if (M.headBump) {
      const c = this.c;
      c.beginPath();
      const hx2 = L * 0.33;
      c.ellipse(hx2, topY(hx2) + h * 0.06 + this.by(hx2), L * 0.1, h * 0.18, -0.3, PI, TAU);
      c.fillStyle = this.sil ?? this.col(mixR(this.P.body, this.P.back, 0.25));
      c.fill();
      if (!this.sil) {
        c.strokeStyle = 'rgba(255,255,255,0.18)';
        c.lineWidth = Math.max(0.5, L * 0.005);
        c.stroke();
      }
    }
    if (M.lateral || M.lateralScutes) this.lateralLine(topY, L * 0.26, -L * 0.4, M.lateralScutes);
    this.barbels(L * 0.48, noseY, M.barbels, h);
    this.scars(topY, botY, L * 0.2, -L * 0.3);
    if (barreleye && !this.sil) {
      // прозрачный купол головы
      const c = this.c;
      c.beginPath();
      c.ellipse(L * 0.3, topY(L * 0.3) + h * 0.05 + this.by(L * 0.3), L * 0.14, h * 0.32, 0, PI, TAU);
      c.fillStyle = 'rgba(200,240,255,0.18)';
      c.fill();
      c.strokeStyle = 'rgba(220,250,255,0.5)';
      c.lineWidth = Math.max(0.6, L * 0.006);
      c.stroke();
    }
    // передний план: брюшной и грудной плавники, глаз
    if (!coel) this.pelvic(L * 0.12, botY(L * 0.12) - h * 0.04, 0.8 + M.pectoral * 0.2);
    else this.lobe(L * 0.06, botY(L * 0.06) * 0.6, L * 0.1, PI * 0.8, L * 0.02);
    if (coel) this.lobe(L * 0.18, h * 0.12, L * 0.13, PI * 0.88, L * 0.024);
    else this.pectoral(xo - L * 0.03, h * 0.1, M.pectoral * (deep ? 0.9 : 1), { wing: M.pectoralWing || flyer, lionfish: lion });
    const ex = L * (0.37 + sn * 0.04);
    const ey = topY(ex) * 0.42 + noseY * 0.3;
    this.eye(ex, barreleye ? ey + h * 0.12 : ey, Math.max(L * 0.016, Math.min(h * 0.11, L * 0.052) * M.eye), { tube: barreleye });
    if (f.glow) this.photophores(botY, L * 0.3, -L * 0.3);
  }

  dorsals(topY: YFn, h: number) {
    const { L, M } = this;
    const H = h * M.dorsalH;
    switch (M.dorsal) {
      case 'double':
        this.finAlong(topY, L * 0.02, L * 0.18, H * 0.42, -1, 'spiny', h, 6);
        this.finAlong(topY, -L * 0.3, -L * 0.07, H * 0.32, -1, 'pointed', h);
        break;
      case 'triple':
        this.finAlong(topY, L * 0.07, L * 0.2, H * 0.32, -1, 'round', h);
        this.finAlong(topY, -L * 0.11, L * 0.04, H * 0.28, -1, 'round', h);
        this.finAlong(topY, -L * 0.31, -L * 0.14, H * 0.25, -1, 'round', h);
        break;
      case 'long':
        this.finAlong(topY, -L * 0.33, L * 0.2, H * 0.27, -1, 'round', h);
        break;
      case 'low':
        this.finAlong(topY, -L * 0.24, L * 0.02, H * 0.18, -1, 'round', h);
        break;
      case 'sail':
        this.finAlong(topY, -L * 0.3, L * 0.22, H * 0.62, -1, 'sail', h, 0, this.P.hasAccent ? mixR(this.P.fin, this.P.accent, 0.35) : undefined);
        break;
      case 'filament': {
        this.finAlong(topY, -L * 0.12, L * 0.17, H * 0.42, -1, 'pointed', h);
        if (!this.sil) {
          const c = this.c;
          c.strokeStyle = this.col(this.M.finEdge ? hex2(this.M.finEdge) : mixR(this.P.fin, WHITE, 0.25), 0.9);
          c.lineWidth = Math.max(0.8, L * 0.011);
          c.lineCap = 'round';
          c.beginPath();
          this.m(L * 0.13, topY(L * 0.13) - H * 0.38);
          this.q(-L * 0.05, topY(0) - H * 1.25 + Math.sin(this.wag) * H * 0.1, -L * 0.42, topY(-L * 0.3) - H * 0.9 + Math.sin(this.wag * 1.3) * H * 0.2);
          c.stroke();
        }
        break;
      }
      case 'spiny':
        this.finAlong(topY, -L * 0.02, L * 0.21, H * 0.48, -1, 'spiny', h, 8);
        this.finAlong(topY, -L * 0.28, -L * 0.01, H * 0.36, -1, 'round', h);
        break;
      default:
        this.finAlong(topY, -L * 0.2, L * 0.13, H * 0.42, -1, 'round', h);
    }
    if (M.adipose) {
      const ax = -L * 0.3;
      const path = () => {
        this.c.beginPath();
        this.m(ax + L * 0.04, topY(ax + L * 0.04) + h * 0.02);
        this.q(ax, topY(ax) - h * 0.14, ax - L * 0.035, topY(ax - L * 0.035) + h * 0.02);
        this.c.closePath();
      };
      this.membrane(path, [ax, topY(ax)], [ax, topY(ax) - h * 0.1], null, 0.95, 0.85);
    }
  }

  finlets(topY: YFn, botY: YFn, h: number) {
    const { L, c } = this;
    c.fillStyle = this.sil ?? this.col(this.M.finEdge ? hex2(this.M.finEdge) : this.P.hasAccent ? this.P.accent : this.P.fin, 0.95);
    for (let i = 0; i < 6; i++) {
      const fx = -L * (0.3 + i * 0.019);
      for (const sgn of [-1, 1]) {
        const fy = sgn < 0 ? topY(fx) : botY(fx);
        c.beginPath();
        this.m(fx + L * 0.008, fy);
        this.l(fx - L * 0.01, fy + sgn * h * 0.08);
        this.l(fx - L * 0.012, fy);
        c.closePath();
        c.fill();
      }
    }
  }

  /** Камбалы: вид на глазную сторону */
  flat() {
    const { L, M, f, c } = this;
    const elong = inG(f, 'Solea', 'Microstomus') ? 0.62 : inG(f, 'Scophthalmus') ? 1.08 : inG(f, 'Hippoglossus', 'Reinhardtius', 'Paralichthys') ? 0.78 : 0.85 * M.depth;
    const h = L * 0.62 * elong;
    const rx = L * (inG(f, 'Solea') ? 0.44 : 0.4);
    const T: [Pt, Pt, Pt, Pt] = [
      [L * 0.42, h * 0.02],
      [L * 0.42, -h * 0.5],
      [-rx * 0.6, -h * 0.55],
      [-rx, -h * 0.06],
    ];
    const B: [Pt, Pt, Pt, Pt] = [
      [-rx, h * 0.06],
      [-rx * 0.6, h * 0.55],
      [L * 0.38, h * 0.48],
      [L * 0.42, h * 0.02],
    ];
    const ts = bez(...T);
    const bs = bez(...B);
    const topY: YFn = (x) => yAt(ts, x);
    const botY: YFn = (x) => yAt(bs, x);
    const body = () => {
      c.beginPath();
      this.m(...T[0]);
      this.b(T[1], T[2], T[3]);
      this.l(...B[0]);
      this.b(B[1], B[2], B[3]);
      c.closePath();
    };
    this.caudal(-rx + L * 0.02, h * 0.55, inG(f, 'Hippoglossus', 'Reinhardtius') ? 'emarg' : 'round', 0.9);
    // кайма плавников вокруг тела
    this.finAlong(topY, -rx * 0.9, L * 0.34, h * 0.13, -1, 'round', h * 0.3);
    this.finAlong(botY, -rx * 0.9, L * 0.24, h * 0.12, 1, 'round', h * 0.3);
    this.skin(body, h, { topY, botY, head: L * 0.3, kind: 'cycloid', front: L * 0.42, rear: -rx });
    if (!this.sil) {
      // бугорки у калкана
      if (inG(f, 'Scophthalmus')) {
        c.fillStyle = this.col(mixR(this.P.body, BLACK, 0.3), 0.8);
        const r = seeded(f.id + ':tub');
        for (let i = 0; i < 26; i++) {
          const x = -rx * 0.8 + r() * (rx * 0.8 + L * 0.3);
          const y = (r() - 0.5) * h * 0.7;
          c.beginPath();
          c.arc(x, y + this.by(x), L * 0.009, 0, TAU);
          c.fill();
        }
      }
      c.beginPath();
      this.m(L * 0.3, -h * 0.02);
      this.q(0, -h * 0.07, -rx, 0);
      c.strokeStyle = 'rgba(255,255,255,0.22)';
      c.lineWidth = Math.max(0.6, L * 0.006);
      c.stroke();
      c.beginPath();
      this.m(L * 0.42, h * 0.02);
      this.q(L * 0.38, h * 0.1, L * 0.33, h * 0.07);
      c.strokeStyle = 'rgba(0,0,0,0.5)';
      c.lineWidth = Math.max(0.6, L * 0.008);
      c.stroke();
    }
    this.pectoral(L * 0.22, h * 0.02, 0.8);
    this.scars(topY, botY, L * 0.2, -rx * 0.8);
    const ey = inG(f, 'Scophthalmus') ? -h * 0.18 : -h * 0.12;
    this.eye(L * 0.3, ey, h * 0.075 * M.eye);
    this.eye(L * 0.24, ey + h * 0.13, h * 0.07 * M.eye);
  }

  /** Угри и вытянутые рыбы */
  elongated() {
    const { L, M, f, c } = this;
    const g = genus(f);
    const eel = f.shape === 'eel';
    const moray = inG(f, 'Gymnothorax', 'Enchelycore');
    const sturgeon = inG(f, 'Acipenser', 'Huso');
    const rat = M.ratTail;
    const hag = g === 'Myxine';
    const oar = g === 'Regalecus';
    const viper = g === 'Chauliodus';
    const gulper = inG(f, 'Eurypharynx', 'Saccopharynx');
    const wolf = inG(f, 'Anarhichas', 'Anarrhichthys');
    const cat = g === 'Silurus';
    const beak = inG(f, 'Belone', 'Hemiramphus', 'Nemichthys', 'Syngnathus', 'Oxycirrhites');
    const pike = inG(f, 'Esox', 'Atractosteus');
    const ice = inG(f, 'Chaenocephalus', 'Cryodraco', 'Channichthys', 'Gymnodraco', 'Bathydraco');
    const h = L * (eel ? (moray || wolf || cat ? 0.12 : oar ? 0.1 : 0.085) : rat ? 0.17 : sturgeon ? 0.15 : 0.13) * M.depth;
    const snout = sturgeon ? M.snoutLen : 0;
    const w = (t: number): number => {
      if (rat) return t < 0.12 ? 0.35 + t * 3 : Math.max(0.025, 0.72 * Math.pow(1 - (t - 0.12) / 0.88, 1.6));
      if (gulper) return t < 0.18 ? 0.55 + (0.18 - t) * 2.5 : Math.max(0.02, 0.4 * Math.pow(1 - (t - 0.18) / 0.82, 1.3));
      if (eel) {
        const head = wolf || cat ? 0.5 : 0.3;
        if (t < 0.08) return head + (t / 0.08) * (0.5 - head);
        if (t < 0.68) return 0.5 - (t - 0.08) * 0.12;
        return Math.max(0.02, 0.43 * Math.pow(1 - (t - 0.68) / 0.32, 1.1));
      }
      if (t < 0.2) return 0.14 + 0.36 * Math.sin(((t / 0.2) * PI) / 2);
      return Math.max(0.1, 0.5 - 0.5 * Math.pow((t - 0.2) / 0.72, 1.25));
    };
    const N = 40;
    const tOf = (x: number) => clamp((L * 0.5 - x) / L, 0, 1);
    const topY: YFn = (x) => -w(tOf(x)) * h;
    const botY: YFn = (x) => w(tOf(x)) * h * (eel ? 1 : 0.95);
    const tailX = eel || rat || gulper ? -L * 0.5 : -L * 0.42;
    const body = () => {
      c.beginPath();
      this.m(L * (0.5 + snout), sturgeon ? h * 0.12 : 0);
      for (let i = 0; i <= N; i++) {
        const x = L * 0.5 - (i / N) * (L * 0.5 - tailX);
        this.l(x, topY(x));
      }
      for (let i = N; i >= 0; i--) {
        const x = L * 0.5 - (i / N) * (L * 0.5 - tailX);
        this.l(x, botY(x));
      }
      c.closePath();
    };
    // плавники на заднем плане
    if (eel && !hag) {
      const d0 = moray ? L * 0.42 : wolf || oar ? L * 0.4 : cat ? -L * 0.05 : L * 0.12;
      const fh = h * (oar ? 0.55 : moray ? 0.32 : 0.28);
      this.finAlong(topY, -L * 0.49, d0, fh, -1, 'round', h, 0, oar ? [220, 50, 60] : undefined);
      this.finAlong(botY, -L * 0.49, moray ? L * 0.1 : cat ? L * 0.15 : -L * 0.02, fh * (cat ? 1.1 : 0.9), 1, 'round', h);
      if (oar && !this.sil) {
        // гребень на голове
        c.strokeStyle = this.col([220, 50, 60], 0.95);
        c.lineWidth = Math.max(0.7, L * 0.008);
        c.lineCap = 'round';
        for (let i = 0; i < 6; i++) {
          const x = L * (0.44 - i * 0.012);
          c.beginPath();
          this.m(x, topY(x));
          this.q(x - L * 0.02, topY(x) - h * (1.3 + i * 0.1), x - L * (0.05 + i * 0.012), topY(x) - h * (2.2 - i * 0.15) + Math.sin(this.wag + i) * h * 0.2);
          c.stroke();
        }
      }
    } else if (rat) {
      this.finAlong(topY, L * 0.14, L * 0.26, h * 0.95, -1, 'pointed', h);
      this.finAlong(topY, -L * 0.48, L * 0.08, h * 0.16, -1, 'round', h);
      this.finAlong(botY, -L * 0.48, L * 0.0, h * 0.18, 1, 'round', h);
    } else if (!eel) {
      const tail: TailType = sturgeon ? 'fork' : pike ? 'emarg' : ice ? 'truncate' : g === 'Acanthocybium' ? 'lunate' : M.tail === 'round' ? 'round' : M.tail;
      if (sturgeon) this.heteroTail(tailX, h);
      else this.caudal(tailX + L * 0.01, h * 1.4, tail, 0.85);
      if (pike) {
        this.finAlong(topY, -L * 0.33, -L * 0.18, h * 0.55, -1, 'round', h);
        this.finAlong(botY, -L * 0.33, -L * 0.2, h * 0.5, 1, 'round', h);
      } else if (g === 'Alepisaurus') {
        this.finAlong(topY, -L * 0.2, L * 0.34, h * 1.5, -1, 'sail', h, 0, mixR(this.P.fin, this.P.accent, 0.3));
      } else if (sturgeon) {
        this.finAlong(topY, -L * 0.34, -L * 0.24, h * 0.4, -1, 'pointed', h);
        this.finAlong(botY, -L * 0.34, -L * 0.26, h * 0.35, 1, 'pointed', h);
      } else if (inG(f, 'Molva', 'Brosme', 'Ophiodon', 'Coris', 'Aphanopus', 'Pelecus')) {
        this.finAlong(topY, -L * 0.36, L * 0.22, h * 0.3, -1, 'round', h);
        this.finAlong(botY, -L * 0.36, -L * 0.02, h * 0.28, 1, 'round', h);
      } else if (beak) {
        this.finAlong(topY, -L * 0.36, -L * 0.18, h * 0.45, -1, 'round', h);
        this.finAlong(botY, -L * 0.34, -L * 0.18, h * 0.42, 1, 'round', h);
      } else {
        this.finAlong(topY, L * 0.02, L * 0.16, h * 0.55, -1, 'spiny', h, 5);
        this.finAlong(topY, -L * 0.28, -L * 0.1, h * 0.45, -1, 'pointed', h);
        this.finAlong(botY, -L * 0.28, -L * 0.12, h * 0.4, 1, 'pointed', h);
      }
    }
    this.skin(body, h, {
      topY,
      botY,
      head: L * 0.38,
      kind: eel || sturgeon || rat || hag || ice ? 'none' : g === 'Atractosteus' ? 'cycloid' : 'fine',
      silver: inG(f, 'Belone', 'Sphyraena', 'Pelecus', 'Hemiramphus', 'Aphanopus'),
      front: L * 0.5,
      rear: tailX,
    });
    if (!this.sil) {
      // жаберная щель / крышка
      const gx = L * (eel ? 0.4 : 0.36);
      c.beginPath();
      this.m(gx + L * 0.008, topY(gx) * 0.6);
      this.q(gx - L * 0.012, 0, gx + L * 0.008, botY(gx) * 0.65);
      c.strokeStyle = 'rgba(0,0,0,0.35)';
      c.lineWidth = Math.max(0.5, L * 0.006);
      c.stroke();
      // кольца у иглы-рыбы, щитки у осетра
      if (g === 'Syngnathus' || sturgeon) {
        c.fillStyle = this.col(mixR(this.P.belly, WHITE, 0.25), 0.9);
        for (let i = 3; i < N - 4; i += 2) {
          const x = L * 0.5 - (i / N) * (L * 0.5 - tailX);
          for (const yy of [topY(x) * 0.85, 0, botY(x) * 0.7]) {
            const s = L * 0.011;
            const y = yy + this.by(x);
            c.beginPath();
            c.moveTo(x, y - s);
            c.lineTo(x + s, y);
            c.lineTo(x, y + s);
            c.lineTo(x - s, y);
            c.closePath();
            c.fill();
          }
        }
      }
      // рот и зубы
      const mouthY = sturgeon ? h * 0.3 : h * 0.06;
      const mx0 = L * (0.5 + snout);
      const ml = L * (gulper ? 0.22 : moray || wolf || viper || g === 'Alepisaurus' || g === 'Atractosteus' ? 0.1 : cat ? 0.09 : 0.05);
      c.beginPath();
      if (sturgeon) {
        this.m(L * 0.42, mouthY);
        this.q(L * 0.4, mouthY + h * 0.08, L * 0.38, mouthY);
      } else {
        this.m(mx0, mouthY);
        this.q(mx0 - ml * 0.5, mouthY + h * (gulper ? 0.8 : 0.12), mx0 - ml, mouthY + h * 0.05);
      }
      c.strokeStyle = 'rgba(0,0,0,0.55)';
      c.lineWidth = Math.max(0.6, L * 0.007);
      c.stroke();
      if (moray || wolf || viper || g === 'Alepisaurus' || g === 'Atractosteus' || g === 'Sphyraena' || g === 'Aphanopus') {
        const ts = viper ? h * 0.5 : wolf ? h * 0.22 : h * 0.16;
        this.teeth(mx0 - ml * 0.9, mx0 - L * 0.006, () => mouthY + h * 0.02, ts, true);
        if (viper) this.teeth(mx0 - ml * 0.8, mx0 - L * 0.01, () => mouthY, ts * 1.1, false);
      }
      if (gulper) {
        c.fillStyle = this.col(this.P.belly, 0.9);
        c.beginPath();
        this.m(mx0, mouthY);
        this.q(L * 0.36, h * 2.4, L * 0.2, h * 0.5);
        this.l(L * 0.3, mouthY);
        c.closePath();
        c.fill();
      }
    }
    // клюв (сарган, полурыл, бекас, игла)
    if (beak) {
      const bl = L * (g === 'Hemiramphus' ? 0.16 : M.snoutLen || 0.12);
      const pth = () => {
        c.beginPath();
        this.m(L * 0.48, -h * 0.06);
        this.l(L * 0.48 + bl * (g === 'Hemiramphus' ? 0.25 : 1), -h * 0.01);
        this.l(L * 0.48, h * 0.02);
        this.l(L * 0.48 + bl, h * 0.05);
        this.l(L * 0.48, h * 0.1);
        c.closePath();
      };
      pth();
      c.fillStyle = this.sil ?? this.col(g === 'Hemiramphus' && this.P.hasAccent ? this.P.accent : mixR(this.P.body, this.P.belly, 0.4));
      c.fill();
    }
    if (sturgeon) {
      // рыло
      c.beginPath();
      this.m(L * 0.46, -h * 0.25);
      this.q(L * (0.5 + snout), -h * 0.1, L * (0.5 + snout), h * 0.12);
      this.q(L * 0.47, h * 0.2, L * 0.44, h * 0.3);
      c.closePath();
      c.fillStyle = this.sil ?? this.col(mixR(this.P.body, this.P.belly, 0.25));
      c.fill();
      this.barbels(L * (0.46 + snout * 0.5), h * 0.18, 2, h);
    }
    if (cat) this.barbels(L * 0.5, h * 0.04, 3, h);
    else if (hag) this.barbels(L * 0.5, 0, 2, h);
    else if (M.barbels && !sturgeon) this.barbels(L * 0.48, h * 0.04, M.barbels, h);
    if (!moray && !hag && !gulper) this.pectoral(L * (eel ? 0.38 : 0.34), h * 0.15, (eel ? 0.55 : 0.75) * M.pectoral);
    if (g === 'Bathypterois' && !this.sil) {
      // «тренога»: длинные лучи брюшных и хвостового
      c.strokeStyle = this.col(this.P.fin, 0.9);
      c.lineWidth = Math.max(0.6, L * 0.005);
      c.beginPath();
      this.m(L * 0.12, botY(L * 0.12));
      this.l(L * 0.05, h * 3.2);
      this.m(-L * 0.4, 0);
      this.l(-L * 0.5, h * 3.2);
      c.stroke();
    }
    this.scars(topY, botY, L * 0.3, -L * 0.2);
    const er = Math.max(L * 0.012, h * (rat ? 0.3 : moray || eel ? 0.13 : 0.2) * M.eye);
    if (!hag) this.eye(L * (eel ? 0.44 : 0.42), topY(L * 0.43) * 0.42, er);
    if (f.glow && !this.sil) {
      if (eel || gulper) glowDot(c, tailX + L * 0.01, this.by(tailX), h * 0.7 * this.boost, f.glow);
      else this.photophores(botY, L * 0.36, -L * 0.3, 9);
    }
  }

  heteroTail(tx: number, h: number) {
    const L = this.L;
    const path = () => {
      this.c.beginPath();
      this.m(tx + L * 0.03, -h * 0.12);
      this.q(tx - L * 0.06, -h * 0.4, tx - L * 0.18, -h * 1.15);
      this.q(tx - L * 0.12, -h * 0.25, tx - L * 0.07, h * 0.12);
      this.q(tx - L * 0.06, h * 0.55, tx - L * 0.1, h * 0.72);
      this.q(tx - L * 0.02, h * 0.4, tx + L * 0.03, h * 0.1);
      this.c.closePath();
    };
    const rays: [Pt, Pt][] = [];
    for (let i = -5; i <= 4; i++) rays.push([[tx + L * 0.02, 0], [tx - L * 0.18, (i / 5) * h * 1.1]]);
    this.membrane(path, [tx, 0], [tx - L * 0.14, -h * 0.4], rays, 0.95, 0.7);
  }

  seahorse() {
    const { L, c } = this;
    const s = L / 100;
    const sw = Math.sin(this.wag) * 2 * s;
    const P = this.P;
    // спинной плавник
    const fin = () => {
      c.beginPath();
      c.moveTo(-14 * s, -2 * s);
      for (let i = 0; i <= 8; i++) c.lineTo(-14 * s - 9 * s - Math.sin(this.wag * 3 + i) * 1.5 * s, -2 * s + i * 2.4 * s);
      c.lineTo(-13 * s, 18 * s);
      c.closePath();
    };
    fin();
    c.fillStyle = this.sil ?? this.col(P.fin, 0.6);
    c.fill();
    // тело-«S»
    const body = () => {
      c.beginPath();
      c.moveTo(8 * s, -40 * s);
      c.bezierCurveTo(22 * s, -40 * s, 18 * s, -26 * s, 10 * s, -22 * s);
      c.bezierCurveTo(16 * s, -8 * s, 14 * s, 10 * s, 6 * s, 20 * s);
      c.bezierCurveTo(2 * s, 30 * s, 6 * s + sw, 40 * s, 16 * s + sw, 42 * s);
      c.bezierCurveTo(22 * s + sw, 44 * s, 22 * s + sw, 52 * s, 14 * s + sw, 52 * s);
      c.bezierCurveTo(4 * s + sw, 52 * s, -6 * s, 40 * s, -6 * s, 26 * s);
      c.bezierCurveTo(-6 * s, 14 * s, -14 * s, 4 * s, -12 * s, -12 * s);
      c.bezierCurveTo(-11 * s, -26 * s, -6 * s, -40 * s, 8 * s, -40 * s);
      c.closePath();
    };
    body();
    if (this.sil) {
      c.fillStyle = this.sil;
      c.fill();
    } else {
      const g = c.createLinearGradient(-14 * s, 0, 16 * s, 0);
      g.addColorStop(0, this.col(P.back));
      g.addColorStop(0.6, this.col(P.body));
      g.addColorStop(1, this.col(P.belly));
      c.fillStyle = g;
      c.fill();
      c.save();
      body();
      c.clip();
      c.strokeStyle = 'rgba(0,0,0,0.22)';
      c.lineWidth = Math.max(0.5, 0.9 * s);
      for (let y = -26; y < 46; y += 4.5) {
        c.beginPath();
        c.moveTo(-20 * s, y * s);
        c.quadraticCurveTo(0, (y + 2) * s, 26 * s, (y - 1) * s);
        c.stroke();
      }
      c.fillStyle = this.col(P.pat, 0.55);
      for (let i = 0; i < 24; i++) {
        c.beginPath();
        c.arc((this.rnd() - 0.4) * 22 * s, (this.rnd() - 0.4) * 70 * s, (0.7 + this.rnd()) * s, 0, TAU);
        c.fill();
      }
      c.restore();
      body();
      c.strokeStyle = 'rgba(0,0,0,0.4)';
      c.lineWidth = Math.max(0.6, 0.8 * s);
      c.stroke();
    }
    // рыло-трубочка и корона
    c.beginPath();
    c.moveTo(14 * s, -36 * s);
    c.lineTo(34 * s, -32 * s);
    c.lineTo(34 * s, -28 * s);
    c.lineTo(14 * s, -28 * s);
    c.closePath();
    c.fillStyle = this.sil ?? this.col(mixR(P.body, P.belly, 0.3));
    c.fill();
    c.beginPath();
    c.moveTo(0, -40 * s);
    c.lineTo(3 * s, -48 * s);
    c.lineTo(6 * s, -41 * s);
    c.lineTo(9 * s, -47 * s);
    c.lineTo(11 * s, -39 * s);
    c.fill();
    this.eye(10 * s, -33 * s, 3 * s);
  }

  mola() {
    const { L, c } = this;
    const h = L * 0.62 * this.M.depth;
    const body = () => {
      c.beginPath();
      this.m(L * 0.42, -h * 0.05);
      this.b([L * 0.4, -h * 0.55], [-L * 0.2, -h * 0.6], [-L * 0.34, -h * 0.3]);
      // «клавус» — зубчатый задний край
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        const y = -h * 0.3 + t * h * 0.6;
        this.l(-L * 0.34 - Math.sin(t * PI) * L * 0.06 - (i % 2) * L * 0.015, y);
      }
      this.b([-L * 0.2, h * 0.6], [L * 0.4, h * 0.55], [L * 0.42, h * 0.08]);
      c.closePath();
    };
    const topY: YFn = (x) => -h * 0.55 * Math.sqrt(clamp(1 - Math.pow((x - L * 0.03) / (L * 0.4), 2), 0, 1));
    const botY: YFn = (x) => -topY(x);
    // высокие спинной и анальный плавники
    for (const sgn of [-1, 1] as const) {
      const sw = Math.sin(this.wag * 1.2) * L * 0.04 * sgn;
      const path = () => {
        c.beginPath();
        this.m(-L * 0.12, sgn * h * 0.4);
        this.q(-L * 0.2 + sw, sgn * h * 1.0, -L * 0.3 + sw, sgn * h * 1.08);
        this.q(-L * 0.28, sgn * h * 0.6, -L * 0.3, sgn * h * 0.3);
        c.closePath();
      };
      this.membrane(path, [-L * 0.2, sgn * h * 0.4], [-L * 0.3, sgn * h], [[[-L * 0.2, sgn * h * 0.4], [-L * 0.28 + sw, sgn * h]]], 0.95, 0.75);
    }
    this.skin(body, h, { topY, botY, head: L * 0.3, kind: 'dermal', front: L * 0.42, rear: -L * 0.38 });
    this.pectoral(L * 0.18, -h * 0.02, 0.7);
    if (!this.sil) {
      c.beginPath();
      c.arc(L * 0.42, h * 0.02, L * 0.018, 0, TAU);
      c.fillStyle = 'rgba(0,0,0,0.5)';
      c.fill();
    }
    this.eye(L * 0.3, -h * 0.14, h * 0.07);
  }

  shark() {
    const { L, M, f, c } = this;
    const g = genus(f);
    const h = L * 0.2 * M.depth;
    const whale = g === 'Rhincodon';
    const saw = g === 'Pristis';
    const goblin = g === 'Mitsukurina';
    const sk = 1 - M.snout;
    const nose = L * (0.5 + (goblin ? 0 : M.snoutLen));
    const T: [Pt, Pt, Pt, Pt] = [
      [nose, h * (whale ? 0 : 0.05)],
      [L * (0.46 - sk * 0.02), -h * (whale ? 0.45 : 0.3 + sk * 0.25)],
      [L * 0.18, -h * 0.55],
      [-L * 0.08, -h * 0.5],
    ];
    const T2: [Pt, Pt, Pt, Pt] = [T[3], [-L * 0.24, -h * 0.42], [-L * 0.36, -h * 0.16], [-L * 0.42, -h * 0.07]];
    const B: [Pt, Pt, Pt, Pt] = [
      [-L * 0.42, h * 0.07],
      [-L * 0.3, h * 0.22],
      [-L * 0.08, h * 0.48],
      [L * 0.12, h * 0.44],
    ];
    const B2: [Pt, Pt, Pt, Pt] = [B[3], [L * 0.32, h * 0.4], [L * 0.45, h * 0.22], T[0]];
    const ts = [...bez(...T), ...bez(...T2)];
    const bs = [...bez(...B), ...bez(...B2)];
    const topY: YFn = (x) => yAt(ts, x);
    const botY: YFn = (x) => yAt(bs, x);
    const body = () => {
      c.beginPath();
      this.m(...T[0]);
      this.b(T[1], T[2], T[3]);
      this.b(T2[1], T2[2], T2[3]);
      this.l(...B[0]);
      this.b(B[1], B[2], B[3]);
      this.b(B2[1], B2[2], B2[3]);
      c.closePath();
    };
    // хвост
    const tx = -L * 0.42;
    const tail = () => {
      c.beginPath();
      this.m(tx + L * 0.03, -h * 0.1);
      if (M.thresher) {
        this.q(tx - L * 0.25, -h * 0.5, tx - L * 0.58, -h * 1.3);
        this.q(tx - L * 0.3, -h * 0.3, tx - L * 0.06, h * 0.05);
        this.l(tx - L * 0.1, h * 0.45);
      } else if (M.tail === 'lunate') {
        this.q(tx - L * 0.06, -h * 0.5, tx - L * 0.13, -h * 1.05);
        this.q(tx - L * 0.06, 0, tx - L * 0.12, h * 0.95);
      } else if (M.tail === 'pointed') {
        this.q(tx - L * 0.08, -h * 0.4, tx - L * 0.16, -h * 0.6);
        this.q(tx - L * 0.07, 0, tx - L * 0.07, h * 0.32);
      } else {
        this.q(tx - L * 0.06, -h * 0.45, tx - L * 0.14, -h * 1.0);
        this.q(tx - L * 0.07, -h * 0.25, tx - L * 0.06, 0);
        this.q(tx - L * 0.08, h * 0.25, tx - L * 0.1, h * 0.52);
      }
      this.l(tx + L * 0.03, h * 0.1);
      c.closePath();
    };
    this.membrane(tail, [tx, 0], [tx - L * 0.12, -h * 0.6], null, 1, 0.92, mixR(this.P.fin, this.P.body, 0.2), null);
    // спинные и анальный
    const dh = (whale ? 0.9 : 1.25) * M.dorsalH;
    const dorsal = () => {
      c.beginPath();
      this.m(L * 0.08, topY(L * 0.08) + h * 0.05);
      this.q(L * 0.02, topY(0) - h * dh * 0.6, -L * 0.04 - sk * L * 0.03, topY(-L * 0.04) - h * dh * 0.7);
      this.q(-L * 0.05, topY(-L * 0.08) - h * 0.15, -L * 0.11, topY(-L * 0.11) + h * 0.05);
      c.closePath();
    };
    this.membrane(dorsal, [0, topY(0)], [-L * 0.03, topY(0) - h * dh * 0.6], null, 1, 0.95, this.P.fin, null);
    const small = (x: number, yFn: YFn, sgn: number, k: number) => () => {
      c.beginPath();
      this.m(x + L * 0.03, yFn(x + L * 0.03) - sgn * h * 0.03);
      this.l(x - L * 0.02, yFn(x) + sgn * h * k);
      this.q(x - L * 0.025, yFn(x - L * 0.02) + sgn * h * 0.06, x - L * 0.045, yFn(x - L * 0.045) - sgn * h * 0.03);
      c.closePath();
    };
    this.membrane(small(-L * 0.25, topY, -1, 0.35 * M.dorsalH), [-L * 0.25, 0], [-L * 0.25, -h], null, 1, 0.95, this.P.fin, null);
    this.membrane(small(-L * 0.28, botY, 1, 0.3), [-L * 0.28, 0], [-L * 0.28, h], null, 1, 0.95, this.P.fin, null);
    this.membrane(small(-L * 0.14, botY, 1, 0.32), [-L * 0.14, 0], [-L * 0.14, h], null, 1, 0.95, this.P.fin, null);

    this.skin(body, h, { topY, botY, head: L * 0.36, kind: 'dermal', front: nose, rear: -L * 0.42 });
    if (!this.sil) {
      // резкая граница противотени
      c.save();
      body();
      c.clip();
      c.fillStyle = this.col(this.P.belly, 0.55);
      c.beginPath();
      this.m(L * 0.48, h * 0.14);
      for (let i = 0; i <= 16; i++) {
        const x = L * 0.46 - (i / 16) * L * 0.86;
        this.l(x, h * (0.12 + Math.sin(i * 1.7) * 0.03));
      }
      this.l(-L * 0.42, h * 2);
      this.l(L * 0.5, h * 2);
      c.closePath();
      c.fill();
      if (whale) {
        // белые точки и продольные гребни
        c.fillStyle = this.col(this.P.hasAccent ? this.P.accent : WHITE, 0.75);
        for (let row = 0; row < 6; row++)
          for (let i = 0; i < 16; i++) {
            const x = L * 0.4 - i * L * 0.052 - (row % 2) * L * 0.026;
            const y = topY(x) + (botY(x) - topY(x)) * (0.08 + row * 0.08);
            c.beginPath();
            c.arc(x, y + this.by(x), L * 0.007, 0, TAU);
            c.fill();
          }
        c.strokeStyle = 'rgba(255,255,255,0.18)';
        c.lineWidth = Math.max(0.6, L * 0.005);
        for (const k of [0.15, 0.3]) {
          c.beginPath();
          for (let i = 0; i <= 16; i++) {
            const x = L * 0.35 - (i / 16) * L * 0.72;
            const y = topY(x) + (botY(x) - topY(x)) * k;
            if (i) this.l(x, y);
            else this.m(x, y);
          }
          c.stroke();
        }
      }
      c.restore();
      // жаберные щели
      c.strokeStyle = 'rgba(0,0,0,0.35)';
      c.lineWidth = Math.max(0.5, L * 0.005);
      for (let i = 0; i < M.gills; i++) {
        const x = L * (0.29 - i * 0.018);
        c.beginPath();
        this.m(x + L * 0.004, -h * 0.18);
        this.q(x - L * 0.006, 0, x, h * 0.2);
        c.stroke();
      }
      // пасть
      c.beginPath();
      if (whale) {
        this.m(nose, h * 0.02);
        this.q(L * 0.46, h * 0.1, L * 0.38, h * 0.08);
      } else {
        this.m(L * 0.42, h * 0.24);
        this.q(L * 0.36, h * 0.32, L * 0.29, h * 0.24);
      }
      c.strokeStyle = 'rgba(0,0,0,0.55)';
      c.lineWidth = Math.max(0.6, L * 0.007);
      c.stroke();
      if (!whale && this.det >= 1 && inG(f, 'Carcharodon', 'Isurus', 'Galeocerdo', 'Carcharhinus', 'Hexanchus', 'Notorynchus', 'Mitsukurina'))
        this.teeth(L * 0.3, L * 0.41, (x) => h * 0.24 + (L * 0.42 - x) * 0.4 * (h / L), L * 0.009, false);
      // ноздря
      c.fillStyle = 'rgba(0,0,0,0.45)';
      c.beginPath();
      c.ellipse(L * 0.45, h * 0.08 + this.by(L * 0.45), L * 0.008, L * 0.004, 0.3, 0, TAU);
      c.fill();
      if (g === 'Isistius') {
        c.fillStyle = this.col(mixR(this.P.body, BLACK, 0.55), 0.85);
        c.fillRect(L * 0.2, -h * 0.45, L * 0.05, h * 0.9);
      }
    }
    if (M.hammer) {
      c.beginPath();
      c.ellipse(L * 0.47, -h * 0.02 + this.by(L * 0.47), L * 0.04, h * 0.75, 0, 0, TAU);
      c.fillStyle = this.sil ?? this.col(this.P.body);
      c.fill();
      if (!this.sil) {
        c.strokeStyle = 'rgba(0,0,0,0.35)';
        c.lineWidth = Math.max(0.6, L * 0.006);
        c.stroke();
      }
    }
    if (goblin) {
      c.beginPath();
      this.m(L * 0.44, -h * 0.2);
      this.l(L * 0.66, -h * 0.08);
      this.l(L * 0.66, 0);
      this.l(L * 0.44, h * 0.05);
      c.closePath();
      c.fillStyle = this.sil ?? this.col(mixR(this.P.body, this.P.belly, 0.2));
      c.fill();
      this.teeth(L * 0.34, L * 0.44, () => h * 0.28, L * 0.012, true);
    }
    if (saw) {
      const sl = L * 0.32;
      c.beginPath();
      this.m(nose - L * 0.02, -h * 0.05);
      this.l(nose + sl, -h * 0.03);
      this.l(nose + sl, h * 0.06);
      this.l(nose - L * 0.02, h * 0.12);
      c.closePath();
      c.fillStyle = this.sil ?? this.col(mixR(this.P.body, this.P.belly, 0.2));
      c.fill();
      if (!this.sil) {
        c.fillStyle = 'rgba(240,236,224,0.95)';
        for (let i = 0; i < 14; i++) {
          const x = nose + (i / 13) * sl;
          for (const [y, d] of [
            [-h * 0.04, -1],
            [h * 0.08, 1],
          ] as const) {
            c.beginPath();
            c.moveTo(x - L * 0.004, y + this.by(x));
            c.lineTo(x, y + d * L * 0.018 + this.by(x));
            c.lineTo(x + L * 0.004, y + this.by(x));
            c.fill();
          }
        }
      }
    }
    // грудной
    const pec = () => {
      const fl = Math.sin(this.wag * 1.2) * h * 0.08;
      c.beginPath();
      this.m(L * 0.2, h * 0.28);
      this.q(L * 0.12, h * 0.7, L * 0.0, h * (whale ? 0.9 : 1.08) + fl);
      this.q(L * 0.06, h * 0.55, L * 0.08, h * 0.3);
      c.closePath();
    };
    this.membrane(pec, [L * 0.14, h * 0.3], [L * 0.02, h], null, 1, 0.92, g === 'Carcharhinus' && f.colors.fin === '#f0f0ec' ? [240, 240, 236] : this.P.fin, null);
    this.scars(topY, botY, L * 0.25, -L * 0.25);
    this.eye(M.hammer ? L * 0.47 : L * 0.39, M.hammer ? -h * 0.7 : -h * 0.1, Math.max(L * 0.01, h * (whale ? 0.05 : 0.085)));
    if (f.glow && !this.sil) this.photophores(botY, L * 0.25, -L * 0.25, 6);
  }

  billfish() {
    const { L, M, f, c } = this;
    const g = genus(f);
    const h = L * 0.19 * M.depth;
    const sword = g === 'Xiphias';
    const sail = g === 'Istiophorus';
    const T: [Pt, Pt, Pt, Pt] = [
      [L * 0.38, 0],
      [L * 0.32, -h * 0.55],
      [0, -h * 0.6],
      [-L * 0.36, -h * 0.08],
    ];
    const B: [Pt, Pt, Pt, Pt] = [
      [-L * 0.36, h * 0.08],
      [0, h * 0.56],
      [L * 0.3, h * 0.46],
      [L * 0.38, 0],
    ];
    const ts = bez(...T);
    const bs = bez(...B);
    const topY: YFn = (x) => yAt(ts, x);
    const botY: YFn = (x) => yAt(bs, x);
    const body = () => {
      c.beginPath();
      this.m(...T[0]);
      this.b(T[1], T[2], T[3]);
      this.l(-L * 0.4, -h * 0.06);
      this.l(-L * 0.4, h * 0.06);
      this.l(...B[0]);
      this.b(B[1], B[2], B[3]);
      c.closePath();
    };
    this.caudal(-L * 0.4, h * 1.6, 'lunate', 1.15);
    if (sail) this.finAlong(topY, -L * 0.18, L * 0.28, h * 2.5, -1, 'sail', h, 0, this.P.hasAccent ? mixR(this.P.fin, this.P.accent, 0.3) : undefined);
    else if (sword) this.finAlong(topY, L * 0.12, L * 0.24, h * 1.3, -1, 'pointed', h);
    else this.finAlong(topY, -L * 0.2, L * 0.26, h * 1.35, -1, 'pointed', h, 0, this.P.hasAccent ? mixR(this.P.fin, this.P.accent, 0.25) : undefined);
    this.finAlong(botY, -L * 0.22, -L * 0.06, h * 0.7, 1, 'pointed', h);
    this.skin(body, h, { topY, botY, head: L * 0.25, kind: 'fine', silver: true, front: L * 0.38, rear: -L * 0.4 });
    // клюв / меч
    const bl = L * (sword ? 0.34 : 0.26);
    c.beginPath();
    this.m(L * 0.36, -h * (sword ? 0.16 : 0.1));
    this.l(L * 0.36 + bl, -h * 0.01);
    this.l(L * 0.36 + bl * (sword ? 1 : 0.92), h * 0.02);
    this.l(L * 0.36, h * (sword ? 0.08 : 0.05));
    c.closePath();
    c.fillStyle = this.sil ?? this.col(mixR(this.P.back, this.P.body, 0.4));
    c.fill();
    if (!this.sil) {
      c.strokeStyle = 'rgba(255,255,255,0.25)';
      c.lineWidth = Math.max(0.5, L * 0.004);
      c.beginPath();
      this.m(L * 0.38, -h * 0.06);
      this.l(L * 0.36 + bl * 0.9, -h * 0.01);
      c.stroke();
      // киль
      c.fillStyle = this.col(this.P.back, 0.9);
      c.beginPath();
      this.m(-L * 0.32, -h * 0.03);
      this.l(-L * 0.38, 0);
      this.l(-L * 0.32, h * 0.03);
      c.closePath();
      c.fill();
    }
    // грудной серп и брюшные нити
    const pec = () => {
      c.beginPath();
      this.m(L * 0.24, h * 0.1);
      this.q(L * 0.1, h * 0.35, -L * 0.06, h * (g === 'Istiompax' ? 0.7 : 0.55));
      this.q(L * 0.12, h * 0.22, L * 0.2, h * 0.16);
      c.closePath();
    };
    this.membrane(pec, [L * 0.2, h * 0.1], [0, h * 0.5], null, 0.95, 0.8);
    if (!sword && !this.sil) {
      c.strokeStyle = this.col(this.P.fin, 0.9);
      c.lineWidth = Math.max(0.6, L * 0.005);
      c.beginPath();
      this.m(L * 0.18, botY(L * 0.18));
      this.q(L * 0.1, h * 0.9, L * 0.02, h * 1.1);
      c.stroke();
    }
    this.scars(topY, botY, L * 0.2, -L * 0.25);
    this.eye(L * 0.31, -h * 0.1, Math.max(L * 0.012, h * 0.12));
  }

  /** Скаты, манты, морской ангел — вид сверху */
  ray() {
    const { L, f, c } = this;
    const g = genus(f);
    const manta = g === 'Mobula';
    const eagle = g === 'Aetobatus';
    const angel = g === 'Squatina';
    const flap = Math.sin(this.wag * 0.9) * 0.18;
    const W = L * (manta ? 0.95 : eagle ? 0.85 : angel ? 0.5 : 0.62);
    const P = this.P;
    const wy = (k: number) => W * 0.5 * (1 - flap * k);
    // хвост
    const tl = L * (eagle ? 0.95 : manta ? 0.35 : angel ? 0.42 : 0.5);
    c.strokeStyle = this.sil ?? this.col(P.fin);
    c.lineCap = 'round';
    c.lineWidth = Math.max(0.8, L * (angel ? 0.05 : 0.018));
    c.beginPath();
    c.moveTo(-L * 0.12, 0);
    const tsw = Math.sin(this.wag * 1.1) * L * 0.04;
    c.quadraticCurveTo(-L * 0.12 - tl * 0.5, tsw * 0.5, -L * 0.12 - tl, tsw);
    c.stroke();
    if (!eagle && !manta && !this.sil) {
      // два маленьких спинных у ската
      c.fillStyle = this.col(P.fin);
      for (let i = 0; i < 2; i++) {
        const x = -L * 0.12 - tl * (0.62 + i * 0.16);
        c.beginPath();
        c.ellipse(x, tsw * (0.62 + i * 0.16), L * 0.025, L * 0.012, 0, 0, TAU);
        c.fill();
      }
    }
    if (angel) {
      c.fillStyle = this.sil ?? this.col(P.fin);
      c.beginPath();
      c.moveTo(-L * 0.12 - tl, tsw);
      c.lineTo(-L * 0.12 - tl - L * 0.08, tsw - L * 0.06);
      c.lineTo(-L * 0.12 - tl - L * 0.06, tsw + L * 0.05);
      c.closePath();
      c.fill();
    }
    // диск
    const disc = () => {
      c.beginPath();
      if (manta) {
        c.moveTo(L * 0.3, -L * 0.08);
        c.quadraticCurveTo(L * 0.12, -wy(1) * 0.6, -L * 0.02, -wy(1));
        c.quadraticCurveTo(-L * 0.12, -wy(1) * 0.4, -L * 0.18, 0);
        c.quadraticCurveTo(-L * 0.12, wy(-1) * 0.4, -L * 0.02, wy(-1));
        c.quadraticCurveTo(L * 0.12, wy(-1) * 0.6, L * 0.3, L * 0.08);
        c.closePath();
      } else if (angel) {
        c.moveTo(L * 0.36, 0);
        c.quadraticCurveTo(L * 0.36, -L * 0.12, L * 0.2, -L * 0.12);
        c.quadraticCurveTo(L * 0.1, -wy(1), -L * 0.04, -wy(1) * 0.95);
        c.quadraticCurveTo(-L * 0.06, -L * 0.1, -L * 0.14, -L * 0.06);
        c.lineTo(-L * 0.14, L * 0.06);
        c.quadraticCurveTo(-L * 0.06, L * 0.1, -L * 0.04, wy(-1) * 0.95);
        c.quadraticCurveTo(L * 0.1, wy(-1), L * 0.2, L * 0.12);
        c.quadraticCurveTo(L * 0.36, L * 0.12, L * 0.36, 0);
        c.closePath();
      } else {
        const tip = eagle ? 0.02 : 0.08;
        c.moveTo(L * (eagle ? 0.34 : 0.42), 0);
        c.quadraticCurveTo(L * 0.22, -wy(1) * 0.35, -L * tip, -wy(1));
        c.quadraticCurveTo(-L * 0.08, -wy(1) * (eagle ? 0.25 : 0.55), -L * 0.16, 0);
        c.quadraticCurveTo(-L * 0.08, wy(-1) * (eagle ? 0.25 : 0.55), -L * tip, wy(-1));
        c.quadraticCurveTo(L * 0.22, wy(-1) * 0.35, L * (eagle ? 0.34 : 0.42), 0);
        c.closePath();
      }
    };
    disc();
    if (this.sil) {
      c.fillStyle = this.sil;
      c.fill();
      return;
    }
    const rg = c.createRadialGradient(L * 0.08, -W * 0.08, 0, L * 0.05, 0, W * 0.6);
    rg.addColorStop(0, this.col(mixR(P.body, WHITE, 0.12)));
    rg.addColorStop(0.65, this.col(P.body));
    rg.addColorStop(1, this.col(P.back));
    c.fillStyle = rg;
    c.fill();
    c.save();
    disc();
    c.clip();
    // узор
    if (f.pattern === 'spots') {
      const n = Math.round(30 * this.M.patDensity);
      for (let i = 0; i < n; i++) {
        const x = -L * 0.12 + this.rnd() * L * 0.42;
        const y = (this.rnd() - 0.5) * W * 0.85;
        const r = L * (eagle ? 0.012 : manta ? 0.02 : 0.008) * (0.6 + this.rnd());
        c.fillStyle = this.col(P.hasAccent ? P.accent : mixR(P.body, BLACK, 0.4), 0.7);
        c.beginPath();
        c.arc(x, y, r, 0, TAU);
        c.fill();
      }
      if (g === 'Leucoraja') {
        // «глазки» на крыльях
        for (const sgn of [-1, 1]) {
          c.fillStyle = this.col([240, 200, 60], 0.85);
          c.beginPath();
          c.arc(L * 0.04, sgn * W * 0.24, L * 0.035, 0, TAU);
          c.fill();
          c.fillStyle = this.col([20, 20, 20], 0.9);
          c.beginPath();
          c.arc(L * 0.04, sgn * W * 0.24, L * 0.02, 0, TAU);
          c.fill();
        }
      }
    }
    if (manta) {
      c.fillStyle = this.col(P.hasAccent ? P.accent : WHITE, 0.55);
      for (const sgn of [-1, 1]) {
        c.beginPath();
        c.ellipse(L * 0.08, sgn * W * 0.16, L * 0.08, W * 0.1, sgn * 0.5, 0, TAU);
        c.fill();
      }
    }
    // объём: блик по центру и тень у краёв крыльев
    const lg = c.createLinearGradient(0, -W * 0.5, 0, W * 0.5);
    lg.addColorStop(0, 'rgba(0,0,0,0.22)');
    lg.addColorStop(0.45, 'rgba(255,255,255,0.1)');
    lg.addColorStop(0.55, 'rgba(255,255,255,0.1)');
    lg.addColorStop(1, 'rgba(0,0,0,0.22)');
    c.fillStyle = lg;
    c.fillRect(-L, -W, L * 2, W * 2);
    c.restore();
    disc();
    c.strokeStyle = this.col(mixR(P.back, BLACK, 0.4), 0.6);
    c.lineWidth = Math.max(0.6, L * 0.006);
    c.stroke();
    // шипы по хребту
    if (inG(f, 'Raja', 'Amblyraja', 'Bathyraja', 'Leucoraja')) {
      c.fillStyle = this.col(P.hasAccent ? P.accent : mixR(P.body, WHITE, 0.4), 0.9);
      for (let i = 0; i < 12; i++) {
        const x = L * 0.2 - i * L * 0.05;
        const y = i > 6 ? tsw * ((i - 6) / 6) * 0.3 : 0;
        c.beginPath();
        c.moveTo(x + L * 0.012, y);
        c.lineTo(x - L * 0.006, y - L * 0.008);
        c.lineTo(x - L * 0.006, y + L * 0.008);
        c.closePath();
        c.fill();
      }
    }
    if (manta) {
      // головные лопасти
      c.fillStyle = this.col(P.back);
      for (const sgn of [-1, 1]) {
        c.beginPath();
        c.ellipse(L * 0.34, sgn * L * 0.07, L * 0.06, L * 0.018, sgn * 0.3, 0, TAU);
        c.fill();
      }
    }
    if (eagle) {
      c.fillStyle = this.col(P.body);
      c.beginPath();
      c.ellipse(L * 0.36, 0, L * 0.07, L * 0.05, 0, 0, TAU);
      c.fill();
    }
    // глаза и брызгальца
    const ex = manta ? L * 0.28 : eagle ? L * 0.3 : angel ? L * 0.26 : L * 0.22;
    const ey = manta ? L * 0.1 : L * 0.05;
    for (const sgn of [-1, 1]) {
      this.eye(ex, sgn * ey, L * 0.018);
      c.fillStyle = 'rgba(0,0,0,0.35)';
      c.beginPath();
      c.ellipse(ex - L * 0.04, sgn * ey, L * 0.012, L * 0.007, 0, 0, TAU);
      c.fill();
    }
  }

  angler() {
    const { L, f, c } = this;
    const g = genus(f);
    const lophius = g === 'Lophius';
    const deepA = inG(f, 'Melanocetus', 'Linophryne', 'Leviathan');
    const lure = lophius || deepA || g === 'Pogonophryne';
    const star = g === 'Uranoscopus';
    const h = L * (deepA ? 0.7 : lophius ? 0.45 : 0.5);
    const T: [Pt, Pt, Pt, Pt] = [
      [L * 0.48, -h * 0.02],
      [L * 0.42, -h * 0.75],
      [-L * 0.1, -h * 0.6],
      [-L * 0.38, -h * 0.06],
    ];
    const B: [Pt, Pt, Pt, Pt] = [
      [-L * 0.38, h * 0.06],
      [-L * 0.15, h * 0.5],
      [L * 0.42, h * 0.62],
      [L * 0.5, h * 0.16],
    ];
    const ts = bez(...T);
    const bs = bez(...B);
    const topY: YFn = (x) => yAt(ts, x);
    const botY: YFn = (x) => yAt(bs, x);
    const body = () => {
      c.beginPath();
      this.m(...T[0]);
      this.b(T[1], T[2], T[3]);
      this.l(-L * 0.4, -h * 0.05);
      this.l(-L * 0.4, h * 0.05);
      this.l(...B[0]);
      this.b(B[1], B[2], B[3]);
      c.closePath();
    };
    this.caudal(-L * 0.4, h * 0.55, 'round', 0.85);
    this.finAlong(topY, -L * 0.3, -L * 0.08, h * 0.25, -1, 'round', h);
    if (!deepA) this.finAlong(topY, L * 0.0, L * 0.16, h * 0.22, -1, 'spiny', h, 4);
    this.finAlong(botY, -L * 0.3, -L * 0.12, h * 0.22, 1, 'round', h);
    this.skin(body, h, { topY, botY, head: L * 0.2, kind: 'none', front: L * 0.5, rear: -L * 0.4 });
    if (!this.sil) {
      // пасть и зубы
      const my = (x: number) => h * (0.06 + Math.sin(((L * 0.5 - x) / (L * 0.38)) * PI) * 0.1);
      c.beginPath();
      this.m(L * 0.5, h * 0.05);
      this.q(L * 0.3, h * 0.24, L * 0.12, h * 0.08);
      c.strokeStyle = 'rgba(0,0,0,0.75)';
      c.lineWidth = Math.max(1, L * 0.018);
      c.stroke();
      if (!star) {
        this.teeth(L * 0.14, L * 0.48, my, h * (deepA ? 0.16 : 0.09), false);
        this.teeth(L * 0.16, L * 0.47, (x) => my(x) + h * 0.04, h * (deepA ? 0.12 : 0.07), true);
      }
      if (lophius || g === 'Scorpaenichthys') {
        // кожные лоскуты по краю челюсти
        c.fillStyle = this.col(mixR(this.P.body, this.P.belly, 0.3), 0.9);
        for (let i = 0; i < 9; i++) {
          const x = L * (0.46 - i * 0.045);
          const y = botY(x) * 0.6 + this.by(x);
          c.beginPath();
          c.moveTo(x - L * 0.012, y);
          c.quadraticCurveTo(x, y + h * 0.12, x + L * 0.012, y);
          c.fill();
        }
      }
    }
    if (!deepA) this.pectoral(L * 0.12, h * 0.15, 1.3);
    // удочка
    if (lure && g !== 'Pogonophryne') {
      const lx = L * 0.58 + Math.sin(this.wag) * L * 0.03;
      const ly = -h * (deepA ? 0.95 : 0.8);
      c.strokeStyle = this.sil ?? this.col(this.P.fin);
      c.lineWidth = Math.max(0.8, L * 0.012);
      c.beginPath();
      this.m(L * 0.25, topY(L * 0.25));
      c.quadraticCurveTo(L * 0.38, -h * 1.1, lx, ly);
      c.stroke();
      if (f.glow && !this.sil) glowDot(c, lx, ly, L * 0.055 * this.boost, f.glow);
      else {
        c.fillStyle = this.sil ?? this.col(this.P.accent);
        c.beginPath();
        c.arc(lx, ly, L * 0.025, 0, TAU);
        c.fill();
      }
    }
    if ((g === 'Linophryne' || g === 'Pogonophryne') && !this.sil) {
      // «борода» под подбородком
      c.strokeStyle = this.col(g === 'Pogonophryne' ? this.P.accent : mixR(this.P.body, WHITE, 0.2), 0.9);
      c.lineWidth = Math.max(0.6, L * 0.007);
      for (let i = 0; i < 4; i++) {
        c.beginPath();
        this.m(L * 0.36, botY(L * 0.36));
        this.q(L * (0.34 - i * 0.03), h * 0.8, L * (0.3 - i * 0.05), h * (1 + i * 0.1));
        c.stroke();
        if (f.glow) glowDot(c, L * (0.3 - i * 0.05), h * (1 + i * 0.1), L * 0.018 * this.boost, f.glow);
      }
    }
    this.scars(topY, botY, L * 0.2, -L * 0.2);
    this.eye(star ? L * 0.26 : L * 0.24, star ? topY(L * 0.26) + h * 0.06 : -h * 0.28, h * (deepA ? 0.05 : 0.07));
  }

  squid() {
    const { L, f, c } = this;
    const h = L * 0.2;
    const P = this.P;
    const ph = this.wag;
    // щупальца
    c.lineCap = 'round';
    for (let i = 0; i < 10; i++) {
      const long = i < 2;
      const len = long ? 0.62 : 0.4;
      const pts: Pt[] = [];
      for (let k = 0; k <= 10; k++) {
        const t = k / 10;
        pts.push([-L * 0.04 - t * L * len, (i - 4.5) * h * 0.07 + Math.sin(ph * 1.3 + t * 5 + i) * h * 0.32 * t]);
      }
      c.strokeStyle = this.sil ?? this.col(mixR(P.belly, P.body, 0.4));
      for (let k = 1; k < pts.length; k++) {
        c.lineWidth = Math.max(0.6, h * (long ? 0.07 : 0.13) * (1 - (k / pts.length) * 0.75));
        c.beginPath();
        c.moveTo(pts[k - 1][0], pts[k - 1][1]);
        c.lineTo(pts[k][0], pts[k][1]);
        c.stroke();
      }
      if (long && !this.sil) {
        const [x, y] = pts[pts.length - 1];
        c.fillStyle = this.col(P.body);
        c.beginPath();
        c.ellipse(x, y, L * 0.03, h * 0.08, 0, 0, TAU);
        c.fill();
      }
      if (!long && !this.sil && this.det >= 2) {
        c.fillStyle = 'rgba(255,240,230,0.5)';
        for (let k = 2; k < 9; k += 2) {
          c.beginPath();
          c.arc(pts[k][0], pts[k][1] + h * 0.03, h * 0.025, 0, TAU);
          c.fill();
        }
      }
    }
    // мантия
    const mantle = () => {
      c.beginPath();
      c.moveTo(L * 0.5, 0);
      c.bezierCurveTo(L * 0.3, -h * 0.9, -L * 0.04, -h * 0.62, -L * 0.07, 0);
      c.bezierCurveTo(-L * 0.04, h * 0.62, L * 0.3, h * 0.9, L * 0.5, 0);
      c.closePath();
    };
    // плавники
    const finP = () => {
      c.beginPath();
      c.moveTo(L * 0.5, 0);
      c.quadraticCurveTo(L * 0.42, -h * 0.9, L * 0.3, -h * 0.55);
      c.lineTo(L * 0.3, h * 0.55);
      c.quadraticCurveTo(L * 0.42, h * 0.9, L * 0.5, 0);
      c.closePath();
    };
    this.membrane(finP, [L * 0.4, 0], [L * 0.4, -h], null, 0.9, 0.7);
    this.skin(mantle, h, { topY: (x) => -h * 0.6 * Math.sin(clamp((x + L * 0.07) / (L * 0.57), 0, 1) * PI), botY: (x) => h * 0.6 * Math.sin(clamp((x + L * 0.07) / (L * 0.57), 0, 1) * PI), head: 0, kind: 'none', front: L * 0.5, rear: -L * 0.07 });
    if (!this.sil) {
      // хроматофоры
      c.save();
      mantle();
      c.clip();
      for (let i = 0; i < 40; i++) {
        const tw = 0.4 + 0.6 * Math.abs(Math.sin(ph * 0.7 + i));
        c.fillStyle = this.col(mixR(P.body, BLACK, 0.3), 0.35 * tw);
        c.beginPath();
        c.arc(-L * 0.05 + this.rnd() * L * 0.52, (this.rnd() - 0.5) * h * 1.1, L * 0.008 * (0.5 + tw), 0, TAU);
        c.fill();
      }
      c.restore();
    }
    this.eye(-L * 0.01, -h * 0.12, h * 0.2);
    if (f.glow && !this.sil) this.photophores(() => h * 0.5, L * 0.3, 0, 5);
  }

  octopus(dumbo: boolean) {
    const { L, c } = this;
    const s = L / 100;
    const P = this.P;
    const ph = this.wag;
    c.save();
    c.rotate(PI / 2 - 0.25);
    c.lineCap = 'round';
    for (let i = 0; i < 8; i++) {
      const baseA = -0.9 + (i / 7) * 1.8;
      let px = Math.sin(baseA) * 10 * s;
      let py = 8 * s;
      const pts: Pt[] = [[px, py]];
      for (let k = 1; k <= 12; k++) {
        const q = k / 12;
        px += Math.sin(baseA * 1.4 + Math.sin(ph * 1.3 + i + q * 4) * 0.6) * (dumbo ? 2.6 : 3.8) * s;
        py += (dumbo ? 2.6 : 3.6) * s;
        pts.push([px, py]);
      }
      c.strokeStyle = this.sil ?? this.col(i % 2 ? P.body : mixR(P.body, P.back, 0.25));
      for (let k = 1; k < pts.length; k++) {
        c.lineWidth = (6 - (k / pts.length) * 5) * s;
        c.beginPath();
        c.moveTo(pts[k - 1][0], pts[k - 1][1]);
        c.lineTo(pts[k][0], pts[k][1]);
        c.stroke();
      }
      if (!this.sil && !dumbo && this.det >= 1) {
        c.fillStyle = this.col(mixR(P.belly, WHITE, 0.3), 0.8);
        for (let k = 2; k < pts.length - 2; k += 2) {
          c.beginPath();
          c.arc(pts[k][0] + 1.6 * s, pts[k][1], 0.9 * s * (1 - k / pts.length), 0, TAU);
          c.fill();
        }
      }
    }
    if (dumbo) {
      // зонтик-перепонка
      c.fillStyle = this.sil ?? this.col(P.body, 0.75);
      c.beginPath();
      c.moveTo(-14 * s, 8 * s);
      c.quadraticCurveTo(0, 46 * s + Math.sin(ph) * 4 * s, 14 * s, 8 * s);
      c.closePath();
      c.fill();
    }
    const mantle = () => {
      c.beginPath();
      c.ellipse(0, -8 * s, 16 * s, dumbo ? 17 * s : 21 * s, 0, 0, TAU);
    };
    mantle();
    if (this.sil) {
      c.fillStyle = this.sil;
      c.fill();
    } else {
      const g = c.createRadialGradient(-5 * s, -18 * s, 2 * s, 0, -8 * s, 22 * s);
      g.addColorStop(0, this.col(mixR(P.body, WHITE, 0.3)));
      g.addColorStop(0.6, this.col(P.body));
      g.addColorStop(1, this.col(P.back));
      c.fillStyle = g;
      c.fill();
      c.save();
      mantle();
      c.clip();
      c.fillStyle = this.col(P.pat, 0.4);
      for (let i = 0; i < 26; i++) {
        c.beginPath();
        c.arc((this.rnd() - 0.5) * 30 * s, -8 * s + (this.rnd() - 0.5) * 40 * s, (0.8 + this.rnd() * 1.6) * s, 0, TAU);
        c.fill();
      }
      c.restore();
    }
    if (dumbo) {
      for (const sgn of [-1, 1]) {
        const path = () => {
          c.beginPath();
          c.ellipse(sgn * 17 * s, -16 * s, 8 * s, 4.5 * s, sgn * (0.6 - Math.sin(ph * 1.5) * 0.35), 0, TAU);
        };
        path();
        c.fillStyle = this.sil ?? this.col(P.fin, 0.9);
        c.fill();
      }
    }
    c.restore();
    // глаза — в мировых координатах, чтобы блики не вращались
    const rot = PI / 2 - 0.25;
    for (const sgn of [-1, 1]) {
      const lx = sgn * 7 * s;
      const ly = 4 * s;
      const x = lx * Math.cos(rot) - ly * Math.sin(rot);
      const y = lx * Math.sin(rot) + ly * Math.cos(rot);
      this.eye(x, y, 3.2 * s);
    }
  }

  puffer() {
    const { L, c } = this;
    const r = L * 0.34;
    const P = this.P;
    this.caudal(-r * 1.05, r * 0.75, 'round', 0.9);
    this.finAlong((x) => -Math.sqrt(Math.max(0, r * r - x * x)), -r * 0.95, -r * 0.55, r * 0.35, -1, 'round', r);
    this.finAlong((x) => Math.sqrt(Math.max(0, r * r - x * x)), -r * 0.95, -r * 0.6, r * 0.3, 1, 'round', r);
    // иглы (рыба-ёж)
    if (!this.sil) {
      c.strokeStyle = this.col(mixR(P.fin, P.belly, 0.3));
      c.lineWidth = Math.max(0.6, L * 0.01);
      c.lineCap = 'round';
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * TAU + 0.1;
        c.beginPath();
        c.moveTo(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9);
        c.lineTo(Math.cos(a - 0.35) * r * 1.22, Math.sin(a - 0.35) * r * 1.22);
        c.stroke();
      }
    }
    const body = () => {
      c.beginPath();
      c.ellipse(0, 0, r, r * 0.92, 0, 0, TAU);
    };
    this.skin(body, r * 1.84, {
      topY: (x) => -Math.sqrt(Math.max(0, r * r - x * x)) * 0.92,
      botY: (x) => Math.sqrt(Math.max(0, r * r - x * x)) * 0.92,
      head: r * 0.5,
      kind: 'none',
      front: r,
      rear: -r,
    });
    this.pectoral(r * 0.35, r * 0.05, 0.8);
    if (!this.sil) {
      c.strokeStyle = 'rgba(0,0,0,0.5)';
      c.lineWidth = Math.max(0.6, L * 0.01);
      c.beginPath();
      c.arc(r * 0.98, r * 0.1, r * 0.08, PI * 0.6, PI * 1.4);
      c.stroke();
    }
    this.eye(r * 0.55, -r * 0.28, r * 0.2);
  }

  boxfish() {
    const { L, c } = this;
    const h = L * 0.5;
    const P = this.P;
    this.caudal(-L * 0.37, h * 0.5, 'round', 0.9);
    const box = () => {
      c.beginPath();
      this.m(L * 0.4, -h * 0.25);
      this.l(L * 0.3, -h * 0.5);
      this.l(-L * 0.28, -h * 0.5);
      this.l(-L * 0.37, -h * 0.15);
      this.l(-L * 0.37, h * 0.15);
      this.l(-L * 0.28, h * 0.5);
      this.l(L * 0.3, h * 0.5);
      this.l(L * 0.42, h * 0.22);
      c.closePath();
    };
    this.skin(box, h, { topY: () => -h * 0.5, botY: () => h * 0.5, head: L * 0.3, kind: 'none', front: L * 0.42, rear: -L * 0.37 });
    if (!this.sil) {
      c.save();
      box();
      c.clip();
      c.strokeStyle = this.col(mixR(P.body, BLACK, 0.35), 0.45);
      c.lineWidth = Math.max(0.6, L * 0.007);
      const cs = L * 0.1;
      for (let xx = -L * 0.4; xx < L * 0.45; xx += cs)
        for (let yy = -h * 0.6; yy < h * 0.6; yy += cs * 0.86) {
          const ox = (Math.round(yy / (cs * 0.86)) % 2) * cs * 0.5;
          c.beginPath();
          for (let k = 0; k < 6; k++) {
            const a = (k / 6) * TAU;
            const px = xx + ox + Math.cos(a) * cs * 0.5;
            const py = yy + Math.sin(a) * cs * 0.5;
            if (k) c.lineTo(px, py + this.by(px));
            else c.moveTo(px, py + this.by(px));
          }
          c.closePath();
          c.stroke();
        }
      c.restore();
    }
    this.pectoral(L * 0.1, h * 0.12, 0.7);
    this.eye(L * 0.26, -h * 0.18, h * 0.12);
  }

  blob() {
    const { L, f, c } = this;
    const g = genus(f);
    const lump = g === 'Cyclopterus';
    const snail = g === 'Pseudoliparis';
    const h = L * (lump ? 0.62 : snail ? 0.34 : 0.6);
    const T: [Pt, Pt, Pt, Pt] = snail
      ? [
          [L * 0.46, 0],
          [L * 0.44, -h * 0.7],
          [L * 0.0, -h * 0.55],
          [-L * 0.46, -h * 0.05],
        ]
      : [
          [L * 0.45, h * 0.04],
          [L * 0.5, -h * 0.72],
          [-L * 0.3, -h * 0.52],
          [-L * 0.4, -h * 0.02],
        ];
    const B: [Pt, Pt, Pt, Pt] = snail
      ? [
          [-L * 0.46, h * 0.05],
          [L * 0.0, h * 0.5],
          [L * 0.44, h * 0.6],
          [L * 0.46, 0],
        ]
      : [
          [-L * 0.4, h * 0.02],
          [-L * 0.3, h * 0.46],
          [L * 0.4, h * 0.56],
          [L * 0.45, h * 0.04],
        ];
    const ts = bez(...T);
    const bs = bez(...B);
    const topY: YFn = (x) => yAt(ts, x);
    const botY: YFn = (x) => yAt(bs, x);
    const body = () => {
      c.beginPath();
      this.m(...T[0]);
      this.b(T[1], T[2], T[3]);
      this.l(...B[0]);
      this.b(B[1], B[2], B[3]);
      c.closePath();
    };
    if (!snail) this.caudal(-L * 0.38, h * 0.45, 'round', 0.8);
    if (lump) this.finAlong(topY, -L * 0.3, -L * 0.05, h * 0.2, -1, 'round', h);
    if (snail) this.finAlong(topY, -L * 0.46, L * 0.05, h * 0.18, -1, 'round', h);
    this.skin(body, h, { topY, botY, head: L * 0.2, kind: 'none', front: L * 0.48, rear: -L * 0.46 });
    if (!this.sil) {
      if (lump) {
        // ряды бугорков
        c.fillStyle = this.col(mixR(this.P.body, BLACK, 0.3), 0.85);
        for (const k of [0.15, 0.4, 0.62]) {
          for (let i = 0; i < 9; i++) {
            const x = L * 0.32 - i * L * 0.075;
            const y = topY(x) + (botY(x) - topY(x)) * k + this.by(x);
            c.beginPath();
            c.arc(x, y, L * 0.016, 0, TAU);
            c.fill();
          }
        }
      } else if (snail) {
        c.save();
        body();
        c.clip();
        c.fillStyle = 'rgba(160,60,80,0.18)';
        c.beginPath();
        c.ellipse(L * 0.1, h * 0.1, L * 0.12, h * 0.25, 0, 0, TAU);
        c.fill();
        c.restore();
      } else {
        // нос капли и грустный рот
        c.beginPath();
        c.ellipse(L * 0.42, h * 0.02, L * 0.08, h * 0.12, 0.3, 0, TAU);
        c.fillStyle = this.col(mixR(this.P.body, [190, 90, 90], 0.4));
        c.fill();
        c.beginPath();
        c.arc(L * 0.3, h * 0.3, L * 0.1, PI * 1.1, PI * 1.9);
        c.strokeStyle = 'rgba(70,20,20,0.6)';
        c.lineWidth = Math.max(0.8, L * 0.014);
        c.stroke();
      }
    }
    this.pectoral(L * 0.18, h * 0.08, 1);
    this.eye(L * 0.28, -h * 0.13, h * (lump ? 0.07 : 0.05));
  }
}

/** Рыба носом вправо (dir = 1) или влево (−1), центр в (x, y), длина L */
export function drawFish(ctx: CanvasRenderingContext2D, f: FishDef, x: number, y: number, L: number, dir: 1 | -1, o: FishDrawOpts = {}) {
  if (L < 2) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  ctx.globalAlpha *= o.alpha ?? 1;
  new Painter(ctx, f, L, o).draw();
  ctx.restore();
}

export function glowDot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.15, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r * 3, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** Приблизительная «экранная» длина по весу (для анимации в сцене) */
export function fishScreenLen(f: FishDef, weight: number, scale = 1) {
  const base = Math.cbrt(Math.max(0.01, weight)) * 34;
  const shapeMul = f.shape === 'eel' || f.shape === 'long' ? 1.8 : f.shape === 'billfish' ? 1.5 : f.shape === 'ray' ? 1.1 : 1;
  return Math.min(260, Math.max(14, base * shapeMul)) * scale;
}

/** Только свечение (рисуется поверх затемнения глубиной) */
export function drawFishGlow(ctx: CanvasRenderingContext2D, f: FishDef, x: number, y: number, L: number, dir: 1 | -1, wag = 0, boost = 1) {
  if (!f.glow) return;
  const pts: [number, number, number][] = [];
  if (f.shape === 'angler') pts.push([L * 0.58 + Math.sin(wag) * L * 0.03, -L * 0.6, L * 0.055]);
  else if (f.shape === 'eel' || f.shape === 'long') pts.push([-L * 0.5, 0, L * 0.06]);
  else for (let i = 0; i < 6; i++) pts.push([L * (0.3 - i * 0.12), L * 0.1, L * 0.03]);
  for (const [px, py, r] of pts) glowDot(ctx, x + px * dir, y + py, r * boost, f.glow);
}
