import { dayLength, moonIllumination, moonPosition, realMoonPhase, sunPosition, SYNODIC_DAYS } from './astro';
import { paletteFor, smooth } from './palette';
import type { AtmosphereState, AtmosphereSummary, Climate, LightningStrike, Season, WeatherId, WeatherKind, WeatherTargets } from './types';
import { KINDS, kindFromWeatherId, nextKind, temperature } from './weather';

export * from './types';
export { KINDS, KIND_LIST } from './weather';
export { paletteFor } from './palette';

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const pad = (n: number) => String(n).padStart(2, '0');

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

export const SEASON_NAMES = ['Весна', 'Лето', 'Осень', 'Зима'] as const;
const MOON_NAMES = ['Новолуние', 'Растущий серп', 'Первая четверть', 'Растущая луна', 'Полнолуние', 'Убывающая луна', 'Последняя четверть', 'Старый серп'];
const MOON_ICONS = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'];
const AURORA_CHANCE: Record<Season, number> = { 0: 0.3, 1: 0, 2: 0.4, 3: 0.55 };
/** 1 марта — нулевой день года атмосферы (начало весны, как сезон 0 в игре) */
const MARCH1 = 59;

export interface AtmosphereOptions {
  /** широта, градусы. 58° — белые ночи летом и короткие дни зимой */
  latitude?: number;
  climate?: Climate;
  seed?: number;
  /** стартовое время: реальное (по умолчанию) */
  date?: Date;
}

/** Срез игрового состояния старой игры для адаптера */
export interface GameSnapshot {
  /** минута суток 0..1439 */
  minute: number;
  /** номер игрового дня */
  day: number;
  season: Season;
  weather: WeatherId;
  climate?: Climate;
  /** фаза луны 0..1, если игра считает её сама */
  moonPhase?: number;
  /** дней в сезоне (DAYS_PER_SEASON) */
  daysPerSeason?: number;
}

/**
 * Живая атмосфера: время суток, сезон, погода, явления, палитра.
 *
 *   const atm = new Atmosphere({ climate: 'temperate' });
 *   // каждый кадр
 *   atm.update(dtSeconds);
 *   const A = atm.state; // A.palette, A.sunElev, A.rain, A.wind …
 *
 * Два режима:
 *   auto — сама ведёт часы (реальное время × timeScale) и погоду (марковская цепь);
 *   game — время и погода приходят из старой игры через syncFromGame(), атмосфера лишь
 *          плавно перетекает между состояниями и раскладывает WeatherId на оттенки.
 */
export class Atmosphere {
  readonly state: AtmosphereState;
  latitude: number;
  climate: Climate;
  /** игровых секунд за реальную секунду (1 — реальное время) */
  timeScale = 1;
  /** ускорение погоды в авто-режиме — чтобы сцена жила, даже когда часы идут вровень с реальными */
  weatherScale = 90;
  /** добавки от событий — выставляет EventDirector каждый кадр */
  mods: import('./types').AtmoMods = {};

  private source: 'auto' | 'game' = 'auto';
  private override: WeatherKind | null = null;
  private target: WeatherKind = 'fair';
  private remain = 0;
  private rnd: () => number;
  private moonOffset = 0;
  private moonOverride: number | null = null;
  private gameWeather: WeatherId | null = null;
  private fastBlend = 0;
  private windDirTarget = 1;
  private real = 0;
  private lightningAcc = 0;
  private listeners = new Set<(s: LightningStrike) => void>();
  private cur: WeatherTargets;

  constructor(o: AtmosphereOptions = {}) {
    this.latitude = o.latitude ?? 58;
    this.climate = o.climate ?? 'temperate';
    this.rnd = mulberry32(o.seed ?? (Date.now() & 0xffffffff));
    const date = o.date ?? new Date();
    const T = Atmosphere.minutesFromDate(date);
    const day = Math.floor(T / 1440);
    this.moonOffset = realMoonPhase(date) - ((day / SYNODIC_DAYS) % 1);

    // стартовая погода — по климатологии текущего сезона
    const season = Math.floor((((day % 365) + 365) % 365) / 365 * 4) as Season;
    const hour = (T % 1440) / 60;
    const t0 = temperature(this.climate, ((day % 365) + 365) % 365 / 365, hour, 0.5, 0, 4);
    let k: WeatherKind = 'fair';
    for (let i = 0; i < 4; i++) k = nextKind(k, season, this.climate, hour, t0, this.rnd);
    this.target = k;
    this.remain = this.durationOf(k);
    this.cur = { ...KINDS[k] };

    this.state = {
      T,
      day,
      minutes: 0,
      hour: 0,
      yearPhase: 0,
      season,
      seasonProgress: 0,
      sunElev: 0,
      sunAz: 180,
      moonElev: 0,
      moonAz: 180,
      moonPhase: 0,
      moonIllum: 0,
      dayLength: 12,
      daylight: 0,
      night: 0,
      golden: 0,
      lights: 0,
      sunVis: 0,
      moonVis: 0,
      starVis: 0,
      kind: k,
      cover: 0,
      dark: 0,
      precip: 0,
      rain: 0,
      snow: 0,
      fog: 0,
      wind: 0,
      windDir: 1,
      lightning: 0,
      waves: 1,
      temp: t0,
      wetness: 0,
      rainbow: 0,
      aurora: 0,
      snowCover: season === 3 && t0 < 1 ? 0.9 : 0,
      ice: 0,
      leaves: 0,
      petals: 0,
      palette: paletteFor({ elev: 0, season, climate: this.climate }),
    };
    this.update(0);
  }

  static minutesFromDate(d: Date) {
    const start = new Date(d.getFullYear(), 0, 1);
    const doy = Math.floor((d.getTime() - start.getTime()) / 86400000);
    const day = (doy - MARCH1 + 365) % 365;
    return day * 1440 + d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
  }

  /* ─────────────── управление ─────────────── */

  /** Вернуться к реальному времени и автоматической погоде */
  resetToNow() {
    this.source = 'auto';
    this.override = null;
    this.timeScale = 1;
    this.state.T = Atmosphere.minutesFromDate(new Date());
    this.fastBlend = 1;
  }

  setHour(h: number) {
    const s = this.state;
    s.T = Math.floor(s.T / 1440) * 1440 + clamp(h, 0, 23.999) * 60;
  }

  setSeason(season: Season) {
    const s = this.state;
    const day = Math.floor(((season + 0.45) / 4) * 365);
    s.T = day * 1440 + (s.T % 1440);
    const temp = temperature(this.climate, (season + 0.45) / 4, s.hour, s.cover, s.precip, s.wind);
    s.snowCover = season === 3 && temp < 1 ? 0.9 : 0;
    if (!this.override) this.pickNext(true);
    this.fastBlend = 1;
  }

  /** Принудительная погода ('auto' — снова сама) */
  setWeather(kind: WeatherKind | 'auto', instant = false) {
    if (kind === 'auto') {
      this.override = null;
      this.remain = this.durationOf(this.target);
      return;
    }
    this.override = kind;
    this.target = kind;
    this.fastBlend = 1;
    if (instant) this.cur = { ...KINDS[kind] };
  }

  setTimeScale(x: number) {
    this.timeScale = Math.max(0, x);
  }

  setClimate(c: Climate) {
    this.climate = c;
  }

  onLightning(cb: (s: LightningStrike) => void) {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  /* ─────────────── адаптер «Знакомой воды» ─────────────── */

  /**
   * Время и погода из игры. Вызывать каждый кадр (дёшево) или при изменении.
   * Сезон игры (7 дней) растягивается на четверть астрономического года,
   * поэтому долгота дня, высота солнца и снег на берегу соответствуют сезону.
   */
  syncFromGame(g: GameSnapshot) {
    this.source = 'game';
    this.override = null;
    const dps = g.daysPerSeason ?? 7;
    const prog = ((((g.day % dps) + dps) % dps) + g.minute / 1440) / dps;
    const yp = (g.season + prog) / 4;
    this.state.T = Math.floor(yp * 365) * 1440 + g.minute;
    if (g.climate) this.climate = g.climate;
    this.moonOverride = g.moonPhase ?? null;
    if (g.weather !== this.gameWeather) {
      const first = this.gameWeather === null;
      this.gameWeather = g.weather;
      this.target = kindFromWeatherId(g.weather, g.day, g.season, this.state.temp);
      this.fastBlend = 1;
      if (first) this.cur = { ...KINDS[this.target] };
    }
  }

  /** Текущая погода в терминах старой игры (для WEATHER_INFO: клёв, волны) */
  get weatherId(): WeatherId {
    const s = this.state;
    const id = KINDS[s.kind].id;
    if (id === 'rain' && s.snow > s.rain) return 'snow';
    return id;
  }

  /* ─────────────── симуляция ─────────────── */

  private durationOf(k: WeatherKind) {
    const [a, b] = KINDS[k].dur;
    return (a + this.rnd() * (b - a)) * 60;
  }

  private pickNext(force = false) {
    const s = this.state;
    const k = nextKind(force ? this.target : s.kind, s.season, this.climate, s.hour, s.temp, this.rnd);
    this.target = k;
    this.remain = this.durationOf(k);
    this.windDirTarget = this.rnd() < 0.72 ? 1 : -1;
  }

  update(dt: number) {
    const s = this.state;
    this.real += dt;
    if (this.source === 'auto') s.T += (dt * this.timeScale) / 60;

    // время
    const day = Math.floor(s.T / 1440);
    s.day = day;
    s.minutes = ((s.T % 1440) + 1440) % 1440;
    s.hour = s.minutes / 60;
    const dayOfYear = ((day % 365) + 365) % 365;
    s.yearPhase = (dayOfYear + s.minutes / 1440) / 365;
    s.season = Math.min(3, Math.floor(s.yearPhase * 4)) as Season;
    s.seasonProgress = s.yearPhase * 4 - s.season;
    const doy = (dayOfYear + MARCH1) % 365;

    // астрономия
    const sun = sunPosition(this.latitude, doy, s.hour);
    s.sunElev = sun.elev;
    s.sunAz = sun.az;
    s.moonPhase = this.moonOverride ?? ((((s.T / 1440 / SYNODIC_DAYS + this.moonOffset) % 1) + 1) % 1);
    s.moonIllum = moonIllumination(s.moonPhase);
    const moon = moonPosition(this.latitude, doy, s.hour, s.moonPhase);
    s.moonElev = moon.elev;
    s.moonAz = moon.az;
    s.dayLength = dayLength(this.latitude, doy);

    // погода: смена состояний (только авто)
    const wSpeed = Math.max(this.timeScale, this.weatherScale);
    if (this.source === 'auto' && !this.override) {
      this.remain -= (dt * wSpeed) / 60;
      if (this.remain <= 0) this.pickNext();
    }
    // плавный переход к цели: ~30 игровых минут, но не дольше 8 с реального времени
    const tau = this.fastBlend > 0 ? 3.5 : Math.min(8, 1800 / wSpeed);
    this.fastBlend = Math.max(0, this.fastBlend - dt / 6);
    const kb = 1 - Math.exp(-dt / tau);
    const tg = KINDS[this.target];
    for (const key of ['cover', 'dark', 'precip', 'fog', 'wind', 'lightning', 'waves'] as const) this.cur[key] += (tg[key] - this.cur[key]) * kb;
    s.kind = this.target;

    // порывы ветра
    const r = this.real;
    const gust = Math.sin(r * 0.37) * 0.5 + Math.sin(r * 1.13 + 1) * 0.3 + Math.sin(r * 2.9 + 2) * 0.2;
    s.wind = Math.max(0, this.cur.wind * (1 + 0.24 * gust * Math.min(1, this.cur.wind / 6)));
    s.windDir += (this.windDirTarget - s.windDir) * (1 - Math.exp(-dt / 20));

    s.cover = clamp(this.cur.cover + Math.sin(r * 0.05) * 0.03, 0, 1);
    s.dark = this.cur.dark;
    s.fog = clamp(this.cur.fog, 0, 1);
    s.precip = clamp(this.cur.precip, 0, 1);
    s.lightning = this.cur.lightning;
    s.waves = this.cur.waves * (this.climate === 'ocean' ? 1.2 : 1);
    // добавки от активных событий
    const m = this.mods;
    if (m.cover) s.cover = clamp(s.cover + m.cover, 0, 1);
    if (m.dark) s.dark = clamp(s.dark + m.dark, 0, 1);
    if (m.fog) s.fog = clamp(s.fog + m.fog, 0, 1);
    if (m.precip) s.precip = clamp(s.precip + m.precip, 0, 1);
    if (m.wind) s.wind = Math.max(0, s.wind + m.wind);
    if (m.waves) s.waves = Math.max(0.2, s.waves + m.waves);

    // температура и вид осадков
    const tempTarget = temperature(this.climate, s.yearPhase, s.hour, s.cover, s.precip, s.wind);
    s.temp += (tempTarget - s.temp) * (1 - Math.exp(-dt / 3));
    let snowFrac = smooth(2, -1, s.temp);
    if (s.kind === 'snow' || s.kind === 'blizzard') snowFrac = 1;
    s.snow = s.precip * snowFrac;
    s.rain = s.precip * (1 - snowFrac);

    // свет
    s.daylight = smooth(-7, 7, s.sunElev);
    s.night = smooth(-4, -14, s.sunElev);
    s.golden = smooth(-5, 1, s.sunElev) * (1 - smooth(6, 15, s.sunElev));
    const veil = (1 - s.cover * s.cover * 0.92) * (1 - s.fog * 0.7);
    s.sunVis = smooth(-1.5, 1, s.sunElev) * veil;
    const moonUp = smooth(-1, 3, s.moonElev);
    s.moonVis = moonUp * Math.pow(s.moonIllum, 0.6) * veil * (1 - s.daylight * 0.75);
    s.starVis = s.night * Math.pow(1 - s.cover, 1.6) * (1 - s.fog) * (1 - s.moonIllum * moonUp * 0.4);
    s.lights = clamp(smooth(5, -2, s.sunElev) + s.fog * 0.8 + smooth(0.65, 0.9, s.dark) * 0.6, 0, 1);

    // явления (в «погодном» времени, чтобы радуга и снег не ждали часами)
    const wdt = (dt * wSpeed) / 60; // игровые минуты
    const wet = s.rain > 0.12 ? 1 : 0;
    s.wetness += (wet - s.wetness) * (1 - Math.exp(-wdt / (wet ? 25 : 110)));
    s.rainbow =
      clamp((s.wetness - s.precip * 3) * 1.4, 0, 1) *
      smooth(1, 6, s.sunElev) *
      (1 - smooth(36, 44, s.sunElev)) *
      Math.pow(clamp(1 - s.cover, 0, 1), 1.2) *
      (1 - s.fog) *
      (1 - snowFrac);
    const auroraNight = hash(day + 0.5) < AURORA_CHANCE[s.season] * (this.climate === 'tropic' ? 0 : this.climate === 'polar' ? 1.8 : 1);
    s.aurora = auroraNight ? s.night * Math.pow(1 - s.cover, 2) * (1 - s.fog) * (this.latitude > 50 ? 1 : 0.35) : 0;
    if (s.temp < 0.5 && s.snow > 0.08) s.snowCover = Math.min(1, s.snowCover + wdt * s.snow * 0.004);
    else if (s.temp > 1.5) s.snowCover = Math.max(0, s.snowCover - wdt * 0.0008 * s.temp);
    s.ice = this.climate === 'tropic' ? 0 : smooth(-3, -10, s.temp) * (this.climate === 'polar' ? 1 : 0.7);
    if (m.aurora) s.aurora = clamp(s.aurora + m.aurora * s.night * (1 - s.cover * 0.8), 0, 1);
    if (m.ice) s.ice = clamp(s.ice + m.ice, 0, 1);
    s.leaves = s.season === 2 ? clamp(0.35 + s.wind / 16, 0, 1) * (1 - s.snow) : 0;
    s.petals = s.season === 0 && s.seasonProgress > 0.25 && s.seasonProgress < 0.75 ? 0.55 * (1 - s.precip) : 0;

    // молнии (в реальном времени — при ускорении не превращаются в стробоскоп)
    if (s.lightning > 0.05 && dt > 0) {
      this.lightningAcc += dt * s.lightning * 0.14;
      if (this.lightningAcc > this.rnd() * 1.6 + 0.2) {
        this.lightningAcc = 0;
        const strike: LightningStrike = { x: 0.08 + this.rnd() * 0.84, dist: Math.pow(this.rnd(), 0.8), power: 0.5 + this.rnd() * 0.5, seed: Math.floor(this.rnd() * 1e9) };
        this.listeners.forEach((f) => f(strike));
      }
    }

    s.palette = paletteFor({
      elev: s.sunElev,
      season: s.season,
      climate: this.climate,
      cover: s.cover,
      dark: s.dark,
      fog: s.fog,
      precip: s.precip,
      moonIllum: s.moonIllum,
      moonUp,
    });
  }

  /* ─────────────── для интерфейса ─────────────── */

  phaseName() {
    const s = this.state;
    const morning = s.sunAz < 180;
    if (s.sunElev > 6) return s.hour < 11 ? 'Утро' : s.hour < 16.5 ? 'День' : 'Вечер';
    if (s.sunElev > -1) return morning ? 'Рассвет' : 'Закат';
    if (s.sunElev > -7) return morning ? 'Утренние сумерки' : 'Вечерние сумерки';
    // летом на 58° солнце не опускается ниже −9° — белые ночи
    const minElev = sunPosition(this.latitude, ((s.day % 365) + MARCH1) % 365, 0).elev;
    if (minElev > -10) return 'Белая ночь';
    return 'Ночь';
  }

  summary(): AtmosphereSummary {
    const s = this.state;
    const info = KINDS[s.kind];
    const h = Math.floor(s.hour);
    const m = Math.floor(s.minutes % 60);
    const mi = Math.round(s.moonPhase * 8) % 8;
    let name = info.name;
    const isRain = s.kind === 'drizzle' || s.kind === 'rain' || s.kind === 'downpour';
    if (isRain && s.snow > s.rain * 1.5) name = 'Снегопад';
    else if (isRain && s.snow > s.rain * 0.4) name = 'Мокрый снег';
    const dl = s.dayLength;
    return {
      time: `${pad(h)}:${pad(m)}`,
      hour: s.hour,
      season: s.season,
      seasonName: SEASON_NAMES[s.season],
      phaseName: this.phaseName(),
      kind: s.kind,
      weatherId: this.weatherId,
      weatherName: name,
      icon: s.daylight < 0.3 && info.nightIcon ? info.nightIcon : info.icon,
      temp: Math.round(s.temp),
      wind: Math.round(s.wind),
      cover: Math.round(s.cover * 100),
      moonName: MOON_NAMES[mi],
      moonIcon: MOON_ICONS[mi],
      dayLength: `${Math.floor(dl)} ч ${pad(Math.round((dl % 1) * 60) % 60)} мин`,
      timeScale: this.timeScale,
      override: this.override,
      source: this.source,
      climate: this.climate,
    };
  }
}
