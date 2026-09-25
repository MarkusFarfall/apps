export const SEC = 1000;
export const MIN = 60 * SEC;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;
export const WEEK = 7 * DAY;

export const parseLocal = (s: string) => new Date(s).getTime();

export function toLocalInput(ts: number) {
  const d = new Date(ts);
  const off = d.getTimezoneOffset();
  return new Date(ts - off * 60000).toISOString().slice(0, 16);
}

export function split(ms: number) {
  ms = Math.max(0, ms);
  const days = Math.floor(ms / DAY);
  const hours = Math.floor((ms % DAY) / HOUR);
  const minutes = Math.floor((ms % HOUR) / MIN);
  const seconds = Math.floor((ms % MIN) / SEC);
  const millis = Math.floor(ms % SEC);
  return { days, hours, minutes, seconds, millis };
}

export function addMonths(ts: number, n: number) {
  const d = new Date(ts);
  const day = d.getDate();
  d.setMonth(d.getMonth() + n);
  if (d.getDate() !== day) d.setDate(0);
  return d.getTime();
}

export function monthsBetween(a: number, b: number) {
  if (b <= a) return { months: 0, rest: 0 };
  let m = 0;
  while (addMonths(a, m + 1) <= b) m++;
  return { months: m, rest: b - addMonths(a, m) };
}

export function calc(s: number, e: number, now: number) {
  const total = Math.max(1, e - s);
  const passed = Math.min(Math.max(now - s, 0), total);
  const left = total - passed;
  return {
    total,
    passed,
    left,
    pct: passed / total,
    done: now >= e,
    notStarted: now < s,
  };
}

/** occurrences of HH:MM daily in (from, to] */
export function countDaily(from: number, to: number, h: number, m = 0) {
  if (to <= from) return 0;
  const d = new Date(from);
  d.setHours(h, m, 0, 0);
  if (d.getTime() <= from) d.setDate(d.getDate() + 1);
  const first = d.getTime();
  if (first > to) return 0;
  return Math.floor((to - first) / DAY) + 1;
}

/** count of given weekday dates between from (incl today) and to */
export function countWeekday(from: number, to: number, wd: number) {
  if (to <= from) return 0;
  let c = 0;
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  let guard = 0;
  while (d.getTime() < to && guard < 5000) {
    if (d.getDay() === wd) c++;
    d.setDate(d.getDate() + 1);
    guard++;
  }
  return c;
}

export function startOfDay(ts: number) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function dayKey(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
