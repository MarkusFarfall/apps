/**
 * Астрономия без зависимостей: высота и азимут солнца и луны, долгота дня, фаза луны.
 * Точности «на глаз» хватает с запасом: ошибка — доли градуса.
 */

const RAD = Math.PI / 180;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

/** Склонение солнца, градусы. doy — день года от 1 января (0..364) */
export function solarDeclination(doy: number) {
  return 23.44 * Math.sin((2 * Math.PI * (284 + doy)) / 365);
}

/** Высота и азимут по широте, склонению и часовому углу */
export function altAz(lat: number, decl: number, hourAngleDeg: number) {
  const phi = lat * RAD;
  const d = decl * RAD;
  const H = hourAngleDeg * RAD;
  const sinAlt = Math.sin(phi) * Math.sin(d) + Math.cos(phi) * Math.cos(d) * Math.cos(H);
  const alt = Math.asin(clamp(sinAlt, -1, 1));
  const cosAz = (Math.sin(d) - Math.sin(alt) * Math.sin(phi)) / Math.max(1e-6, Math.cos(alt) * Math.cos(phi));
  let az = Math.acos(clamp(cosAz, -1, 1)) / RAD;
  if (Math.sin(H) > 0) az = 360 - az;
  return { elev: alt / RAD, az };
}

/** hour — местное солнечное время 0..24 */
export function sunPosition(lat: number, doy: number, hour: number) {
  return altAz(lat, solarDeclination(doy), 15 * (hour - 12));
}

/**
 * Луна: отстаёт от солнца на фазу × 24 ч (в полнолуние кульминирует в полночь),
 * склонение — «противоположно» солнцу в полнолуние (зимой полная луна стоит высоко).
 */
export function moonPosition(lat: number, doy: number, hour: number, phase: number) {
  const decl = solarDeclination(doy) * Math.cos(2 * Math.PI * phase) + 5.1 * Math.sin((2 * Math.PI * doy) / 27.32);
  return altAz(lat, decl, 15 * (hour - 12 - phase * 24));
}

export function dayLength(lat: number, doy: number) {
  const c = -Math.tan(lat * RAD) * Math.tan(solarDeclination(doy) * RAD);
  if (c <= -1) return 24;
  if (c >= 1) return 0;
  return (2 * Math.acos(c)) / RAD / 15;
}

const SYNODIC = 29.530588853;

/** Реальная фаза луны для даты 0..1 */
export function realMoonPhase(date: Date) {
  const jd = date.getTime() / 86400000 + 2440587.5;
  return ((((jd - 2451550.1) / SYNODIC) % 1) + 1) % 1;
}

export const moonIllumination = (phase: number) => (1 - Math.cos(2 * Math.PI * phase)) / 2;
export const SYNODIC_DAYS = SYNODIC;
