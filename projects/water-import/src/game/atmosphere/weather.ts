import type { Climate, Season, WeatherId, WeatherKind, WeatherTargets } from './types';

export interface KindInfo extends WeatherTargets {
  name: string;
  icon: string;
  nightIcon?: string;
  /** «ступень» тяжести — переходы идут в основном на соседние ступени */
  lvl: number;
  /** длительность, игровые часы [мин, макс] */
  dur: [number, number];
  /** чем этот оттенок считается в старой игре */
  id: WeatherId;
}

export const KINDS: Record<WeatherKind, KindInfo> = {
  clear: { name: 'Ясно', icon: '☀️', nightIcon: '🌙', lvl: 0, dur: [4, 10], id: 'clear', cover: 0.04, dark: 0, precip: 0, fog: 0, wind: 2, lightning: 0, waves: 0.55 },
  fair: { name: 'Малооблачно', icon: '🌤️', nightIcon: '🌙', lvl: 1, dur: [3, 8], id: 'clear', cover: 0.3, dark: 0.02, precip: 0, fog: 0, wind: 3.5, lightning: 0, waves: 0.68 },
  cloudy: { name: 'Облачно', icon: '⛅', lvl: 2, dur: [3, 8], id: 'cloudy', cover: 0.6, dark: 0.15, precip: 0, fog: 0.04, wind: 5, lightning: 0, waves: 0.82 },
  overcast: { name: 'Пасмурно', icon: '☁️', lvl: 3, dur: [3, 9], id: 'cloudy', cover: 0.93, dark: 0.36, precip: 0, fog: 0.1, wind: 6, lightning: 0, waves: 0.9 },
  fog: { name: 'Туман', icon: '🌫️', lvl: 2, dur: [2, 6], id: 'fog', cover: 0.5, dark: 0.18, precip: 0, fog: 0.88, wind: 1.2, lightning: 0, waves: 0.4 },
  drizzle: { name: 'Морось', icon: '🌦️', lvl: 4, dur: [2, 6], id: 'rain', cover: 0.88, dark: 0.4, precip: 0.28, fog: 0.3, wind: 4, lightning: 0, waves: 0.85 },
  rain: { name: 'Дождь', icon: '🌧️', lvl: 5, dur: [2, 5], id: 'rain', cover: 0.96, dark: 0.56, precip: 0.62, fog: 0.18, wind: 8, lightning: 0, waves: 1.1 },
  downpour: { name: 'Ливень', icon: '🌧️', lvl: 6, dur: [0.7, 2], id: 'rain', cover: 1, dark: 0.72, precip: 1, fog: 0.28, wind: 10, lightning: 0.12, waves: 1.35 },
  storm: { name: 'Гроза', icon: '⛈️', lvl: 7, dur: [1, 3], id: 'storm', cover: 1, dark: 0.92, precip: 0.85, fog: 0.12, wind: 15, lightning: 1, waves: 2.1 },
  gale: { name: 'Шторм', icon: '🌬️', lvl: 6, dur: [2, 6], id: 'storm', cover: 0.82, dark: 0.62, precip: 0.22, fog: 0.05, wind: 21, lightning: 0, waves: 2.6 },
  snow: { name: 'Снег', icon: '🌨️', lvl: 4, dur: [2, 8], id: 'snow', cover: 0.93, dark: 0.32, precip: 0.55, fog: 0.3, wind: 4, lightning: 0, waves: 0.7 },
  blizzard: { name: 'Метель', icon: '❄️', lvl: 6, dur: [1, 4], id: 'storm', cover: 1, dark: 0.55, precip: 1, fog: 0.55, wind: 17, lightning: 0, waves: 1.6 },
};

export const KIND_LIST = Object.keys(KINDS) as WeatherKind[];

/** Климатология: насколько вид погоды типичен для сезона (0 весна … 3 зима) */
const CLIM: Record<Season, Partial<Record<WeatherKind, number>>> = {
  0: { clear: 3, fair: 4, cloudy: 4, overcast: 2, fog: 2, drizzle: 2.5, rain: 2, downpour: 0.6, storm: 0.5, gale: 0.6, snow: 0.5, blizzard: 0.1 },
  1: { clear: 6, fair: 5, cloudy: 3, overcast: 1, fog: 1, drizzle: 1, rain: 1.5, downpour: 1, storm: 1.6, gale: 0.3 },
  2: { clear: 2, fair: 2.5, cloudy: 4, overcast: 4, fog: 3, drizzle: 3, rain: 3, downpour: 1.2, storm: 0.8, gale: 1.5, snow: 0.4, blizzard: 0.1 },
  3: { clear: 3, fair: 2, cloudy: 3, overcast: 4, fog: 1.5, drizzle: 0.5, rain: 0.5, downpour: 0.1, storm: 0.1, gale: 1, snow: 4, blizzard: 1.2 },
};

const ADJ = [1, 0.85, 0.45, 0.15, 0.05, 0.02, 0.01, 0.01];

/** Следующая погода: климатология × близость ступеней × климат × время суток × температура */
export function nextKind(cur: WeatherKind, season: Season, climate: Climate, hour: number, temp: number, rnd: () => number): WeatherKind {
  const w: Partial<Record<WeatherKind, number>> = {};
  for (const k of KIND_LIST) {
    let v = (CLIM[season][k] ?? 0) * ADJ[Math.abs(KINDS[k].lvl - KINDS[cur].lvl)];
    if (k === cur) v *= 0.55;
    // климат (по мотивам nextWeather из world.ts)
    if (climate === 'tropic') {
      if (k === 'snow' || k === 'blizzard') v = 0;
      if (k === 'clear' || k === 'fair') v *= 1.6;
      if (k === 'fog') v *= 0.3;
      if (k === 'storm' || k === 'downpour') v *= 1.4;
    } else if (climate === 'north') {
      if (k === 'fog') v *= 1.5;
      if (k === 'snow' && season !== 1) v += 0.4;
    } else if (climate === 'polar') {
      if (k === 'rain' || k === 'drizzle' || k === 'downpour' || k === 'storm') v *= 0.25;
      if (k === 'snow') v = v * 2.5 + 0.5;
      if (k === 'blizzard') v = v * 2 + 0.2;
      if (k === 'fog') v *= 1.4;
    } else if (climate === 'misty') {
      if (k === 'fog') v = v * 3 + 1;
      if (k === 'snow' || k === 'blizzard') v *= 0.1;
    } else if (climate === 'ocean') {
      if (k === 'storm') v *= 1.6;
      if (k === 'gale') v = v * 2 + 0.3;
    }
    // туман чаще по утрам, грозы — после полудня
    if (k === 'fog') v *= hour >= 3 && hour <= 9 ? 2 : 0.6;
    if (k === 'storm') v *= hour >= 13 && hour <= 20 ? 1.6 : 0.7;
    // снег только в холод, ливни — не в мороз
    if ((k === 'snow' || k === 'blizzard') && temp > 2) v *= 0.02;
    if ((k === 'rain' || k === 'downpour' || k === 'storm') && temp < -2) v *= 0.15;
    if (v > 0) w[k] = v;
  }
  const entries = Object.entries(w) as [WeatherKind, number][];
  const total = entries.reduce((s, [, v]) => s + v, 0);
  if (total <= 0) return 'cloudy';
  let r = rnd() * total;
  for (const [k, v] of entries) {
    r -= v;
    if (r <= 0) return k;
  }
  return entries[entries.length - 1][0];
}

const TEMP: Record<Climate, [number, number]> = {
  temperate: [7, 12],
  north: [3, 13],
  tropic: [27, 2],
  polar: [-14, 9],
  misty: [13, 4],
  ocean: [15, 5],
};

/** Температура: сезон (пик 18 июля) + суточный ход (пик 15:00) + погода */
export function temperature(climate: Climate, yearPhase: number, hour: number, cover: number, precip: number, wind: number) {
  const [mean, amp] = TEMP[climate];
  const seasonal = mean + amp * Math.cos(2 * Math.PI * (yearPhase - 0.38));
  const diurnal = 4 * Math.cos(((hour - 15) / 24) * 2 * Math.PI) * (1 - cover * 0.6);
  return seasonal + diurnal - precip * 2.2 - Math.max(0, wind - 8) * 0.15;
}

/** Старый WeatherId → оттенок атмосферы (детерминированно по дню, чтобы не мигало) */
export function kindFromWeatherId(id: WeatherId, day: number, season: Season, temp: number): WeatherKind {
  const h = Math.abs(Math.sin(day * 12.9898 + id.length * 78.233) * 43758.5453) % 1;
  switch (id) {
    case 'clear':
      return h < 0.55 ? 'clear' : 'fair';
    case 'cloudy':
      return h < 0.5 ? 'cloudy' : 'overcast';
    case 'rain':
      return h < 0.3 ? 'drizzle' : h < 0.82 ? 'rain' : 'downpour';
    case 'storm':
      if (season === 3 || temp < 0) return 'blizzard';
      return h < 0.62 ? 'storm' : 'gale';
    case 'fog':
      return 'fog';
    case 'snow':
      return h < 0.85 ? 'snow' : 'blizzard';
  }
}
