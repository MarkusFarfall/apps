/**
 * Типы модуля атмосферы. Модуль не зависит ни от React, ни от рендера —
 * его можно подключить к любому canvas-рендеру (сцена входа, игровая сцена, карта).
 *
 * Совместимость со «Знакомой водой» (src/game/types.ts, src/game/world.ts):
 *   Season    — тот же индекс 0..3, что и SEASONS = ["Весна","Лето","Осень","Зима"]
 *   WeatherId — те же 6 ключей, что и WEATHER_INFO
 *   Climate   — те же значения, что и LocationDef["climate"]
 */

export type Season = 0 | 1 | 2 | 3;
export type Climate = 'temperate' | 'north' | 'tropic' | 'polar' | 'misty' | 'ocean';
/** Погода старой игры */
export type WeatherId = 'clear' | 'cloudy' | 'rain' | 'storm' | 'fog' | 'snow';
/** Расширенная погода атмосферы: каждый WeatherId раскладывается на 1–3 оттенка */
export type WeatherKind =
  | 'clear'
  | 'fair'
  | 'cloudy'
  | 'overcast'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'downpour'
  | 'storm'
  | 'gale'
  | 'snow'
  | 'blizzard';

export type RGB = [number, number, number];

/** Добавки к погоде от событий (шквал, стена тумана, пляска сияния…). Складываются с погодой. */
export interface AtmoMods {
  fog?: number;
  cover?: number;
  dark?: number;
  /** м/с */
  wind?: number;
  precip?: number;
  waves?: number;
  aurora?: number;
  ice?: number;
}

export interface Palette {
  skyTop: RGB;
  skyMid: RGB;
  skyHor: RGB;
  /** свечение у светила / горизонта */
  glow: RGB;
  /** цвет солнечного диска */
  sun: RGB;
  seaFar: RGB;
  seaNear: RGB;
  deep: RGB;
  abyss: RGB;
  land1: RGB;
  land2: RGB;
  cloud: RGB;
  fog: RGB;
}

/** Целевые параметры погоды (к ним плавно стремится состояние) */
export interface WeatherTargets {
  /** облачность 0..1 */
  cover: number;
  /** «тяжесть» облаков 0..1 */
  dark: number;
  /** осадки 0..1 */
  precip: number;
  /** туман 0..1 */
  fog: number;
  /** ветер, м/с */
  wind: number;
  /** грозовая активность 0..1 */
  lightning: number;
  /** множитель волн (как WEATHER_INFO.wave в старой игре) */
  waves: number;
}

export interface AtmosphereState {
  /* ── время ── */
  /** абсолютное игровое время, минуты */
  T: number;
  day: number;
  /** минуты от полуночи 0..1440 */
  minutes: number;
  hour: number;
  /** доля года от 1 марта 0..1 */
  yearPhase: number;
  season: Season;
  /** прогресс внутри сезона 0..1 */
  seasonProgress: number;

  /* ── небо ── */
  /** высота солнца над горизонтом, градусы */
  sunElev: number;
  /** азимут солнца, градусы (90 — восток, 180 — юг, 270 — запад) */
  sunAz: number;
  moonElev: number;
  moonAz: number;
  /** фаза луны 0..1 (0 — новолуние, 0.5 — полнолуние) */
  moonPhase: number;
  /** освещённая доля диска 0..1 */
  moonIllum: number;
  /** долгота дня, часы */
  dayLength: number;

  /* ── свет (производные, 0..1) ── */
  daylight: number;
  night: number;
  /** «золотой час» */
  golden: number;
  /** пора зажигать фонари/окна/маяк */
  lights: number;
  sunVis: number;
  moonVis: number;
  starVis: number;

  /* ── погода ── */
  kind: WeatherKind;
  cover: number;
  dark: number;
  precip: number;
  /** доля осадков в виде дождя */
  rain: number;
  /** доля осадков в виде снега */
  snow: number;
  fog: number;
  /** ветер с порывами, м/с */
  wind: number;
  /** направление ветра −1..1 (плавно) */
  windDir: number;
  lightning: number;
  waves: number;
  /** температура воздуха, °C */
  temp: number;

  /* ── явления ── */
  /** влажность после дождя (нужна радуге) */
  wetness: number;
  rainbow: number;
  aurora: number;
  /** снег на земле 0..1 */
  snowCover: number;
  /** льдины на воде 0..1 */
  ice: number;
  /** листопад 0..1 */
  leaves: number;
  /** цветение 0..1 */
  petals: number;

  palette: Palette;
}

export interface LightningStrike {
  /** доля ширины сцены 0..1 */
  x: number;
  /** удалённость 0 (рядом) .. 1 (у горизонта) */
  dist: number;
  power: number;
  seed: number;
}

/** Срез состояния для интерфейса: строки уже на русском */
export interface AtmosphereSummary {
  time: string;
  hour: number;
  season: Season;
  seasonName: string;
  phaseName: string;
  kind: WeatherKind;
  weatherId: WeatherId;
  weatherName: string;
  icon: string;
  temp: number;
  wind: number;
  cover: number;
  moonName: string;
  moonIcon: string;
  dayLength: string;
  timeScale: number;
  override: WeatherKind | null;
  source: 'auto' | 'game';
  climate: Climate;
}
