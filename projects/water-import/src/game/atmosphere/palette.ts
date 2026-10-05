import type { Climate, Palette, RGB, Season } from './types';

/**
 * Палитра мира. Опорные кадры — по высоте солнца (астрономическая ночь → сумерки →
 * рассвет → золотой час → день), поверх — погода, сезон и климат.
 */

interface Key extends Omit<Palette, 'sun' | 'fog'> {
  e: number;
}

const KEYS: Key[] = [
  {
    e: -18,
    skyTop: [3, 5, 16],
    skyMid: [8, 14, 36],
    skyHor: [20, 28, 54],
    glow: [60, 70, 120],
    seaFar: [14, 22, 42],
    seaNear: [8, 18, 34],
    deep: [4, 12, 24],
    abyss: [1, 3, 8],
    land1: [5, 8, 15],
    land2: [14, 20, 38],
    cloud: [36, 42, 66],
  },
  {
    e: -10,
    skyTop: [5, 10, 30],
    skyMid: [16, 28, 70],
    skyHor: [56, 56, 104],
    glow: [130, 100, 150],
    seaFar: [22, 34, 64],
    seaNear: [12, 26, 46],
    deep: [5, 16, 30],
    abyss: [1, 4, 10],
    land1: [6, 10, 18],
    land2: [20, 28, 52],
    cloud: [56, 62, 98],
  },
  {
    e: -4,
    skyTop: [12, 24, 60],
    skyMid: [56, 66, 128],
    skyHor: [214, 128, 118],
    glow: [255, 150, 110],
    seaFar: [52, 62, 104],
    seaNear: [18, 40, 66],
    deep: [6, 24, 42],
    abyss: [2, 6, 14],
    land1: [16, 18, 32],
    land2: [52, 52, 84],
    cloud: [196, 128, 138],
  },
  {
    e: 1,
    skyTop: [24, 48, 96],
    skyMid: [104, 116, 168],
    skyHor: [255, 166, 110],
    glow: [255, 184, 118],
    seaFar: [96, 104, 140],
    seaNear: [24, 66, 96],
    deep: [8, 36, 58],
    abyss: [2, 9, 18],
    land1: [30, 34, 50],
    land2: [74, 78, 104],
    cloud: [255, 188, 158],
  },
  {
    e: 8,
    skyTop: [38, 86, 156],
    skyMid: [118, 158, 210],
    skyHor: [255, 210, 168],
    glow: [255, 216, 160],
    seaFar: [90, 130, 160],
    seaNear: [26, 86, 114],
    deep: [9, 44, 68],
    abyss: [2, 11, 22],
    land1: [36, 46, 58],
    land2: [92, 108, 126],
    cloud: [255, 232, 214],
  },
  {
    e: 25,
    skyTop: [36, 98, 188],
    skyMid: [104, 166, 228],
    skyHor: [196, 224, 246],
    glow: [255, 246, 222],
    seaFar: [86, 150, 190],
    seaNear: [24, 104, 140],
    deep: [10, 52, 80],
    abyss: [2, 12, 26],
    land1: [44, 58, 66],
    land2: [110, 132, 150],
    cloud: [248, 250, 255],
  },
];

const FIELDS = ['skyTop', 'skyMid', 'skyHor', 'glow', 'seaFar', 'seaNear', 'deep', 'abyss', 'land1', 'land2', 'cloud'] as const;

export const mixC = (a: RGB, b: RGB, k: number): RGB => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const smooth = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
const desat = (c: RGB, k: number): RGB => {
  const l = c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11;
  return mixC(c, [l, l, l], k);
};
const mul = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];

export interface PaletteInput {
  elev: number;
  season: Season;
  climate: Climate;
  cover?: number;
  dark?: number;
  fog?: number;
  precip?: number;
  moonIllum?: number;
  /** луна над горизонтом 0..1 */
  moonUp?: number;
}

export function paletteFor(o: PaletteInput): Palette {
  const cover = o.cover ?? 0;
  const dark = o.dark ?? 0;
  const fog = o.fog ?? 0;
  const precip = o.precip ?? 0;

  // 1. опорные кадры по высоте солнца
  let i = 0;
  while (i < KEYS.length - 2 && o.elev > KEYS[i + 1].e) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const t = smooth(0, 1, clamp((o.elev - a.e) / (b.e - a.e), 0, 1));
  const p = {} as Palette;
  for (const f of FIELDS) p[f] = mixC(a[f], b[f], t);
  const daylight = smooth(-7, 7, o.elev);

  // 2. лунный свет ночью
  const moon = (o.moonIllum ?? 0) * (o.moonUp ?? 0) * (1 - daylight) * (1 - cover * 0.8);
  if (moon > 0) {
    p.skyMid = mixC(p.skyMid, [44, 58, 104], moon * 0.35);
    p.skyHor = mixC(p.skyHor, [60, 72, 118], moon * 0.3);
    p.seaFar = mixC(p.seaFar, [40, 54, 92], moon * 0.3);
  }

  // 3. сезон
  if (o.season === 3) {
    for (const f of ['seaFar', 'seaNear', 'deep'] as const) p[f] = mixC(p[f], desat(p[f], 0.6), 0.45);
    p.skyHor = desat(p.skyHor, 0.18);
    p.land2 = mixC(p.land2, [150, 160, 180], 0.25 * daylight);
  } else if (o.season === 1) {
    p.seaNear = mixC(p.seaNear, [16, 112, 126], 0.2 * daylight);
    p.seaFar = mixC(p.seaFar, [60, 150, 170], 0.12 * daylight);
  } else if (o.season === 2) {
    p.glow = mixC(p.glow, [255, 140, 80], 0.15);
    p.skyHor = mixC(p.skyHor, [255, 170, 120], 0.08 * daylight);
    p.seaNear = mixC(p.seaNear, [20, 62, 72], 0.18);
  } else {
    p.skyMid = mixC(p.skyMid, [126, 176, 226], 0.06 * daylight);
  }

  // 4. климат
  if (o.climate === 'tropic') {
    p.seaNear = mixC(p.seaNear, [18, 150, 160], 0.35 * daylight + 0.1);
    p.seaFar = mixC(p.seaFar, [70, 190, 200], 0.3 * daylight);
  } else if (o.climate === 'polar' || o.climate === 'north') {
    const k = o.climate === 'polar' ? 0.35 : 0.15;
    for (const f of ['seaFar', 'seaNear', 'deep'] as const) p[f] = mixC(p[f], desat(p[f], 0.7), k);
  }

  // 5. облачность и «тяжесть» туч
  const grey = smooth(0.3, 1, cover) * 0.75 + dark * 0.25;
  if (grey > 0.001) {
    const dk = 1 - grey * 0.3 - dark * 0.28 - precip * 0.12;
    for (const f of FIELDS) {
      if (f === 'abyss') continue;
      p[f] = mul(desat(p[f], grey * 0.85), dk);
    }
    if (dark > 0.6) {
      const g = (dark - 0.6) * 0.7;
      for (const f of ['skyTop', 'skyMid', 'skyHor', 'seaFar', 'seaNear'] as const) p[f] = mixC(p[f], [38, 50, 50], g);
    }
  }

  // 6. туман
  const fogCol = mixC(mixC([38, 44, 56], [198, 204, 210], daylight), p.glow, smooth(-6, 2, o.elev) * (1 - smooth(6, 16, o.elev)) * 0.25);
  if (fog > 0.001) {
    const k: Partial<Record<keyof Palette, number>> = {
      skyHor: 0.88,
      skyMid: 0.68,
      skyTop: 0.42,
      seaFar: 0.82,
      seaNear: 0.45,
      land2: 0.8,
      land1: 0.55,
      cloud: 0.6,
      glow: 0.5,
    };
    for (const [f, w] of Object.entries(k) as [keyof Palette, number][]) p[f] = mixC(p[f], fogCol, fog * w);
  }
  p.fog = fogCol;

  // 7. солнечный диск: низко — красный, высоко — почти белый
  p.sun = mixC(mixC([255, 110, 64], [255, 214, 160], smooth(-1, 9, o.elev)), [255, 250, 236], smooth(12, 30, o.elev));
  return p;
}
