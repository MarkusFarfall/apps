/**
 * Логика уведомлений — чистые функции без DOM и без сети.
 * Используется и в приложении (предпросмотр, точный момент), и в серверной функции
 * планировщика (api/cron.ts), поэтому правила совпадения событий живут в одном месте.
 */
import { ACHIEVEMENTS, rankOf } from './data';
import type { Prefs, Profile } from './types';
import { DAY, HOUR, calc, parseLocal } from './time';
import { num, plural, W } from './format';

export interface NotifyPrefs {
  /** присылать медали и круглые отметки срока */
  achievements: boolean;
  /** напоминание каждые N дней службы; 0 — выключено */
  everyNDays: number;
}

export interface NotifySchedule {
  /** имя бойца — попадает в текст уведомления */
  name: string;
  /** локальные даты в формате 'YYYY-MM-DDTHH:mm' */
  start: string;
  end: string;
  /** часовой пояс IANA, например Europe/Kaliningrad */
  tz: string;
  prefs: NotifyPrefs;
}

export interface DueNotification {
  /** ключ дедупликации: одно событие — одно уведомление */
  key: string;
  title: string;
  body: string;
  tag: string;
  ts: number;
}

export const EVERY_N_OPTIONS = [0, 5, 10, 30] as const;

/** Локальная дата (YYYY-MM-DD) в заданном поясе */
function localDate(ts: number, tz: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(ts));
  } catch {
    return new Date(ts).toISOString().slice(0, 10);
  }
}

/** Номер календарного дня в поясе пользователя — устойчиво к смене часов */
export function localDayIndex(ts: number, tz: string): number {
  const [y, m, d] = localDate(ts, tz).split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / DAY);
}

/**
 * Момент начала календарного дня (по поясу пользователя) в UTC-миллисекундах.
 * Ищем бинарным поиском — так корректно учитываются любые сдвиги и переходы часов.
 */
export function localMidnightUtc(dayIndex: number, tz: string): number {
  let lo = dayIndex * DAY - 14 * HOUR;
  let hi = dayIndex * DAY + 14 * HOUR;
  while (hi - lo > 60_000) {
    const mid = Math.floor((lo + hi) / 2);
    if (localDayIndex(mid, tz) < dayIndex) lo = mid;
    else hi = mid;
  }
  return Math.ceil(hi / 60_000) * 60_000;
}

/**
 * Какие уведомления положены подписчику в интервале (from, to].
 * Планировщик вызывает это с окном «с прошлого запуска», клиент — для предпросмотра.
 */
export function dueNotifications(sch: NotifySchedule, from: number, to: number): DueNotification[] {
  const s0 = parseLocal(sch.start);
  const e0 = parseLocal(sch.end);
  if (!Number.isFinite(s0) || !Number.isFinite(e0) || e0 <= s0) return [];

  const out: DueNotification[] = [];
  const who = sch.name?.trim() || 'Боец';

  /** текст на конкретный момент времени */
  const state = (ts: number) => {
    const c = calc(s0, e0, ts);
    const daysLeft = Math.max(0, Math.ceil((e0 - ts) / DAY));
    return {
      pct: (c.pct * 100).toFixed(2),
      leftTxt: `${num(daysLeft)} ${plural(daysLeft, W.day)}`,
    };
  };

  // ── достижения: точные моменты, вычисляемые из дат службы ──
  if (sch.prefs?.achievements) {
    for (const a of ACHIEVEMENTS) {
      const ts = a.at(s0, e0);
      if (ts > from && ts <= to && ts >= s0 && ts <= e0) {
        const st = state(ts);
        out.push({
          key: `ach:${a.id}`,
          title: `${a.icon} ${a.title}`,
          body: `${a.desc} · пройдено ${st.pct}%, до дембеля ${st.leftTxt}`,
          tag: `ach-${a.id}`,
          ts,
        });
      }
    }
  }

  // ── каждые N дней службы: срабатывает в начале соответствующего дня ──
  const n = Math.floor(sch.prefs?.everyNDays || 0);
  if (n >= 1 && n <= 365) {
    const startDay = localDayIndex(s0, sch.tz);
    const fromDay = localDayIndex(from, sch.tz);
    const toDay = Math.min(localDayIndex(to, sch.tz), fromDay + 800);
    for (let d = fromDay; d <= toDay; d++) {
      const passed = d - startDay;
      if (passed <= 0 || passed % n !== 0) continue;
      const ts = localMidnightUtc(d, sch.tz);
      if (ts <= from || ts > to) continue;
      const st = state(ts);
      out.push({
        key: `days:${passed}`,
        title: `🎯 ${num(passed)} ${plural(passed, W.day)} службы`,
        body: `${who}, пройдено ${st.pct}% · осталось ${st.leftTxt} · звание «${rankOf(calc(s0, e0, ts).pct).rank.name}»`,
        tag: 'dmb-days',
        ts,
      });
    }
  }

  return out.sort((a, b) => a.ts - b.ts);
}

/**
 * Календарь всех будущих уведомлений целиком — его получает сервер и просто
 * рассылает по наступлении момента. Так на серверной стороне нет доменной логики:
 * правила вычисляются один раз здесь и потом везде одинаковы.
 */
export function eventsForServer(sch: NotifySchedule, now: number, limit = 300) {
  const s0 = parseLocal(sch.start);
  const e0 = parseLocal(sch.end);
  if (!Number.isFinite(s0) || !Number.isFinite(e0) || e0 <= s0) return [];
  return dueNotifications(sch, s0 - 1, e0)
    .filter((n) => n.ts > now)
    .slice(0, limit);
}

/** Ближайшие будущие уведомления — для предпросмотра в настройках */
export function upcoming(sch: NotifySchedule, now: number, count = 3): DueNotification[] {
  const horizon = 400 * DAY;
  return dueNotifications(sch, now, now + horizon).slice(0, count);
}

/** Собрать расписание для сервера из профиля и настроек */
export function scheduleFrom(profile: Profile, prefs: Prefs, tz: string): NotifySchedule {
  return {
    name: profile.name,
    start: profile.start,
    end: profile.end,
    tz,
    prefs: { achievements: prefs.pushAch, everyNDays: prefs.pushDays },
  };
}
