import type { Atmosphere } from '../atmosphere';
import type { CtxInput } from './director';

export * from './types';
export { EVENTS, TIER_INFO, effectChips } from './catalog';
export { EventDirector, type CtxInput, type ActiveInfo, type DirectorOptions } from './director';

/** Контекст событий из состояния атмосферы (+ данные игры, если есть) */
export function ctxFromAtmosphere(atm: Atmosphere, extra: { loc?: string | null; deep?: boolean } = {}): CtxInput {
  const s = atm.state;
  return {
    day: s.day,
    hour: s.hour,
    season: s.season,
    climate: atm.climate,
    kind: s.kind,
    weather: atm.weatherId,
    daylight: s.daylight,
    night: s.night,
    golden: s.golden,
    sunElev: s.sunElev,
    temp: s.temp,
    wind: s.wind,
    fog: s.fog,
    rain: s.rain,
    snow: s.snow,
    cover: s.cover,
    dark: s.dark,
    waves: s.waves,
    moonPhase: s.moonPhase,
    moonIllum: s.moonIllum,
    starVis: s.starVis,
    aurora: s.aurora,
    wetness: s.wetness,
    loc: extra.loc ?? null,
    deep: extra.deep ?? false,
  };
}
