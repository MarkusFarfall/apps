import type { ThemeId } from './types';
import { DAY, HOUR, SEC, WEEK, addMonths } from './time';

export interface Rank {
  min: number;
  name: string;
  desc: string;
}

export const RANKS: Rank[] = [
  { min: 0, name: 'Запах', desc: 'Только прибыл. Ещё пахнешь домашними пирожками.' },
  { min: 0.03, name: 'Дух', desc: 'Присягу принял, портянки мотать научился.' },
  { min: 0.25, name: 'Слон', desc: 'Четверть позади. Уже знаешь, где раздают тушёнку.' },
  { min: 0.5, name: 'Черпак', desc: 'Экватор пройден! Черпак — уважаемый человек.' },
  { min: 0.75, name: 'Дед', desc: 'Три четверти за спиной. Дембель уже виден в бинокль.' },
  { min: 1, name: 'Дембель', desc: 'Свободен! Альбом собран, аксельбант блестит.' },
];

export function rankOf(pct: number) {
  const list = RANKS;
  let idx = 0;
  list.forEach((r, i) => {
    if (pct >= r.min) idx = i;
  });
  return { idx, rank: list[idx], next: list[idx + 1] as Rank | undefined, list };
}

export const THEMES: { id: ThemeId; name: string; a: string; b: string; bg: string }[] = [
  { id: 'khaki', name: 'Хаки', a: '#b5c96a', b: '#e0bf6e', bg: '#0d100a' },
  { id: 'vdv', name: 'ВДВ', a: '#5ab8ff', b: '#e8f4ff', bg: '#06101a' },
  { id: 'navy', name: 'Флот', a: '#6d8dff', b: '#ffd36b', bg: '#050a18' },
  { id: 'border', name: 'Погранцы', a: '#3ddc84', b: '#ff5c5c', bg: '#04110a' },
  { id: 'night', name: 'Ночной наряд', a: '#ff9f1c', b: '#ff4d4d', bg: '#080808' },
  { id: 'vks', name: 'ВКС', a: '#a78bfa', b: '#22d3ee', bg: '#0a0716' },
];

export const QUOTES = [
  'Солдат спит — служба идёт.',
  'Дембель неизбежен, как восход солнца.',
  'Тяжело в учении — легко в бою. © Суворов',
  'Сам погибай, а товарища выручай. © Суворов',
  'Кто не был — тот будет, кто был — не забудет.',
  'Круглое носим, квадратное катаем.',
  'Копать от забора и до обеда.',
  'Каждый подъём — на шаг ближе к дому.',
  'Дембель — это не дата, это состояние души.',
  'Никто, кроме нас.',
  'Отслужил день — вычеркни и гордись.',
  'Любая служба заканчивается приказом. Твой уже в пути.',
  'Весна придёт — дембель будет.',
  'Хочешь рассмешить сержанта — расскажи ему о своих планах на выходные.',
  'Лучше перебдеть, чем недобдеть.',
  'Солдат без юмора — как сапог без гуталина.',
  'Время идёт одинаково — и в наряде, и в увольнении. Просто в наряде оно это скрывает.',
  'Кто в армии служил, тот в цирке не смеётся.',
  'Не спеши выполнять приказ — его могут отменить.',
  'Мама, я скоро! Готовь пельмени.',
];


export const ROUTINE = [
  { h: 6, m: 0, name: 'Подъём', icon: '⏰' },
  { h: 6, m: 10, name: 'Зарядка', icon: '🏃' },
  { h: 6, m: 40, name: 'Утренний туалет', icon: '🪥' },
  { h: 7, m: 0, name: 'Завтрак', icon: '🍳' },
  { h: 8, m: 0, name: 'Развод на занятия', icon: '🎖️' },
  { h: 9, m: 0, name: 'Занятия', icon: '📚' },
  { h: 13, m: 30, name: 'Обед', icon: '🍲' },
  { h: 14, m: 30, name: 'Послеобеденное время', icon: '😌' },
  { h: 15, m: 0, name: 'Занятия / работы', icon: '🛠️' },
  { h: 18, m: 0, name: 'Личное время', icon: '📱' },
  { h: 19, m: 0, name: 'Ужин', icon: '🍽️' },
  { h: 19, m: 30, name: 'Просмотр новостей', icon: '📺' },
  { h: 21, m: 0, name: 'Вечерняя прогулка', icon: '🚶' },
  { h: 21, m: 30, name: 'Вечерняя поверка', icon: '📋' },
  { h: 22, m: 0, name: 'Отбой', icon: '🌙' },
];

export function routineNow(now: number) {
  const d = new Date(now);
  const mins = d.getHours() * 60 + d.getMinutes();
  let cur = ROUTINE.length - 1;
  ROUTINE.forEach((r, i) => {
    if (r.h * 60 + r.m <= mins) cur = i;
  });
  const nextIdx = (cur + 1) % ROUTINE.length;
  const next = ROUTINE[nextIdx];
  const nd = new Date(now);
  nd.setHours(next.h, next.m, 0, 0);
  if (nd.getTime() <= now) nd.setDate(nd.getDate() + 1);
  const isSleep = mins >= 22 * 60 || mins < 6 * 60;
  return { cur: ROUTINE[cur], next, nextAt: nd.getTime(), isSleep };
}

export interface Ach {
  id: string;
  icon: string;
  title: string;
  desc: string;
  at: (s: number, e: number) => number;
}

export const ACHIEVEMENTS: Ach[] = [
  { id: 'start', icon: '🎖️', title: 'Первый шаг', desc: 'Служба началась', at: (s) => s },
  { id: 'day1', icon: '⏱️', title: 'Первые сутки', desc: '24 часа в строю', at: (s) => s + DAY },
  { id: 'week', icon: '📅', title: 'Первая неделя', desc: '7 дней позади', at: (s) => s + WEEK },
  { id: 'msec', icon: '⚡', title: 'Миллион секунд', desc: '1 000 000 секунд отслужено', at: (s) => s + 1e6 * SEC },
  { id: 'h500', icon: '🔥', title: '500 часов', desc: 'Полтысячи часов службы', at: (s) => s + 500 * HOUR },
  { id: 'month', icon: '🗓️', title: 'Первый месяц', desc: 'Календарный месяц позади', at: (s) => addMonths(s, 1) },
  { id: 'h1000', icon: '💪', title: '1000 часов', desc: 'Тысяча часов — это серьёзно', at: (s) => s + 1000 * HOUR },
  { id: 'p10', icon: '🔟', title: '10 процентов', desc: 'Первая десятая часть', at: (s, e) => s + (e - s) * 0.1 },
  { id: 'p25', icon: '🥉', title: 'Четверть', desc: '25% срока позади', at: (s, e) => s + (e - s) * 0.25 },
  { id: 'd100', icon: '💯', title: '100 дней в строю', desc: 'Сотня дней отслужена', at: (s) => s + 100 * DAY },
  { id: 'm10', icon: '🚀', title: '10 млн секунд', desc: '10 000 000 секунд — космос', at: (s) => s + 1e7 * SEC },
  { id: 'p50', icon: '⚖️', title: 'Экватор', desc: 'Ровно половина. Дальше — под горку', at: (s, e) => s + (e - s) * 0.5 },
  { id: 'h5000', icon: '🏋️', title: '5000 часов', desc: 'Пять тысяч часов стойкости', at: (s) => s + 5000 * HOUR },
  { id: 'p75', icon: '🥈', title: 'Три четверти', desc: '75% — ты почти дед', at: (s, e) => s + (e - s) * 0.75 },
  { id: 'l100', icon: '✂️', title: '100 дней до ДМБ', desc: 'Пора резать сантиметр!', at: (_s, e) => e - 100 * DAY },
  { id: 'p90', icon: '🥇', title: '90 процентов', desc: 'Финишная прямая', at: (s, e) => s + (e - s) * 0.9 },
  { id: 'l30', icon: '🎒', title: 'Месяц до дома', desc: 'Готовь парадку', at: (_s, e) => e - 30 * DAY },
  { id: 'l7', icon: '🧳', title: 'Неделя до ДМБ', desc: 'Чемодан — вокзал — дом', at: (_s, e) => e - WEEK },
  { id: 'l1', icon: '🌅', title: 'Последние сутки', desc: 'Завтра ты дома', at: (_s, e) => e - DAY },
  { id: 'l1h', icon: '⏰', title: 'Последний час', desc: '60 минут до свободы', at: (_s, e) => e - HOUR },
  { id: 'dmb', icon: '🏆', title: 'ДМБ!', desc: 'Служба окончена. Ты — легенда', at: (_s, e) => e },
];

export function achievementsFor(s: number, e: number) {
  return ACHIEVEMENTS.map((a) => ({ ...a, ts: a.at(s, e) }))
    .filter((a) => a.ts >= s && a.ts <= e)
    .sort((x, y) => x.ts - y.ts);
}

// Единственный набор подписей: приложение считает срок службы солдата.
export const LABELS = {
  until: 'до дембеля',
  passed: 'Отслужено',
  left: 'Осталось',
  who: 'Боец',
  finish: 'ДМБ',
  doneTitle: 'ДЕМБЕЛЬ!',
  doneSub: 'Служба окончена. Ты свободен!',
};
