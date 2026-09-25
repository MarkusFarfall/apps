import { DAY, HOUR, MIN, SEC } from './time';

export type Forms = readonly [string, string, string];

export const pad = (n: number, l = 2) => String(Math.max(0, Math.floor(n))).padStart(l, '0');

export function plural(n: number, f: Forms) {
  const a = Math.abs(Math.floor(n)) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return f[2];
  if (b > 1 && b < 5) return f[1];
  if (b === 1) return f[0];
  return f[2];
}

export const W = {
  day: ['день', 'дня', 'дней'],
  hour: ['час', 'часа', 'часов'],
  min: ['минута', 'минуты', 'минут'],
  sec: ['секунда', 'секунды', 'секунд'],
  week: ['неделя', 'недели', 'недель'],
  month: ['месяц', 'месяца', 'месяцев'],
  times: ['раз', 'раза', 'раз'],
} as const satisfies Record<string, Forms>;

export const num = (n: number) => Math.floor(n).toLocaleString('ru-RU');

export function fmtDate(ts: number, withTime = true) {
  return new Date(ts).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

export function fmtShortDate(ts: number) {
  return new Date(ts).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function fmtDur(ms: number) {
  ms = Math.max(0, ms);
  const d = Math.floor(ms / DAY);
  const h = Math.floor((ms % DAY) / HOUR);
  const m = Math.floor((ms % HOUR) / MIN);
  const s = Math.floor((ms % MIN) / SEC);
  if (d > 0) return `${d} д ${h} ч`;
  if (h > 0) return `${h} ч ${m} мин`;
  if (m > 0) return `${m} мин ${s} с`;
  return `${s} с`;
}
