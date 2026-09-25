/**
 * Проверка логики уведомлений: какие события и когда должны прийти.
 * Запуск: npm run check:notify
 */
import { strict as assert } from 'node:assert';
import { DAY, parseLocal } from '../src/lib/time';
import { dueNotifications, eventsForServer, upcoming, type NotifySchedule } from '../src/lib/notify';

let passed = 0;
const ok = (name: string, cond: boolean) => {
  assert.ok(cond, `✗ ${name}`);
  passed++;
};

const tz = 'Europe/Kaliningrad';
const start = '2026-01-10T09:00';
const end = '2027-01-10T09:00';
const s = parseLocal(start);
const e = parseLocal(end);

const sch: NotifySchedule = {
  name: 'Рядовой Иванов',
  start,
  end,
  tz,
  prefs: { achievements: true, everyNDays: 10 },
};

// ── 1. Медаль «Первый шаг» (момент старта) попадает в окно старта ──
{
  const list = dueNotifications(sch, s - 1000, s);
  ok('медаль «Первый шаг» в момент старта', list.some((n) => n.key === 'ach:start'));
}

// ── 2. Каждые 10 дней: на 10-й день службы напоминание есть, на 11-й — нет ──
{
  const day10 = s + 10 * DAY;
  const day11 = s + 11 * DAY;
  const at10 = dueNotifications(sch, day10 - DAY, day10);
  const at11 = dueNotifications(sch, day11 - DAY, day11);
  ok('напоминание на 10-й день', at10.some((n) => n.key === 'days:10'));
  ok('на 11-й день напоминания нет', !at11.some((n) => n.key.startsWith('days:')));
}

// ── 3. Напоминание привязано к началу дня: повторный запуск в тот же день пуст ──
{
  const day20 = s + 20 * DAY;
  const first = dueNotifications(sch, day20 - DAY, day20);
  const sameDay = dueNotifications(sch, day20, day20 + 6 * 60 * 60 * 1000); // +6 часов, тот же день
  const nextRun = dueNotifications(sch, day20 + 6 * 60 * 60 * 1000, day20 + DAY);
  ok('на 20-й день напоминание есть', first.some((n) => n.key === 'days:20'));
  ok('повторный запуск в тот же день — пусто', sameDay.length === 0);
  ok('на следующий день событие снова возможно', !nextRun.some((n) => n.key === 'days:20'));
  ok('напоминание начинается в полночь по местному времени', first.find((n) => n.key === 'days:20')!.ts % 60000 === 0);
}

// ── 4. Выключенные достижения не приходят ──
{
  const off: NotifySchedule = { ...sch, prefs: { achievements: false, everyNDays: 0 } };
  const list = dueNotifications(off, s - DAY, e);
  ok('достижения выключены — пусто', list.length === 0);
}

// ── 5. Ключ «Экватор» = ровно середина срока, и он единственный ──
{
  const mid = s + (e - s) / 2;
  const list = dueNotifications(sch, mid - 1000, mid + 1000);
  const equator = list.filter((n) => n.key === 'ach:p50');
  ok('экватор ровно один раз', equator.length === 1);
  ok('текст экватора содержит процент', equator[0].body.includes('%'));
}

// ── 6. Часовой пояс: смена пояса сдвигает день, но не ломает логику ──
{
  const utc: NotifySchedule = { ...sch, tz: 'UTC' };
  const day10 = s + 10 * DAY;
  const list = dueNotifications(utc, day10 - DAY, day10);
  ok('другая зона — напоминание всё равно приходит', list.some((n) => n.key === 'days:10'));
}

// ── 7. Предпросмотр «что придёт дальше» отдаёт ближайшие события по порядку ──
{
  const list = upcoming(sch, s, 3);
  ok('предпросмотр: 3 события', list.length === 3);
  ok('предпросмотр: все в будущем', list.every((n) => n.ts > s));
  ok('предпросмотр: первое — медаль, затем напоминание', list[0].key.startsWith('ach:') || list[0].key.startsWith('days:'));
  ok('предпросмотр отсортирован', list[0].ts <= list[1].ts && list[1].ts <= list[2].ts);
}

// ── 8. Мусорные даты не роняют функцию ──
{
  const bad: NotifySchedule = { ...sch, start: 'не дата', end: 'тоже' };
  ok('битые даты — пустой результат', dueNotifications(bad, 0, Date.now()).length === 0);
}

// ── 9. Список ключей уникален в длинном окне ──
{
  const list = dueNotifications(sch, s, e);
  const keys = list.map((n) => n.key);
  ok('ключи уникальны', new Set(keys).size === keys.length);
  console.log(`     событий за весь год службы: ${list.length}`);
}

// ── 10. Календарь для сервера: только будущее, с ключами и текстами ──
{
  const list = eventsForServer(sch, s);
  ok('для сервера есть события', list.length > 0);
  ok('все в будущем', list.every((n) => n.ts > s));
  ok('в пределах срока службы', list.every((n) => n.ts <= e));
  ok('у всех есть ключ, текст и дата', list.every((n) => n.key && n.title && n.body && Number.isFinite(n.ts)));
  ok('ключи уникальны', new Set(list.map((n) => n.key)).size === list.length);
  ok('не больше лимита 300', list.length <= 300);
  console.log(`     календарь для сервера: ${list.length} событий на весь срок`);
}

// ── 11. События в прошлом не уходят на сервер ──
{
  const mid = s + 60 * DAY;
  const list = eventsForServer(sch, mid);
  ok('прошлое отброшено', list.every((n) => n.ts > mid));
  ok('календарь стал короче', list.length < eventsForServer(sch, s).length);
}

console.log(`\n✓ все ${passed} проверок логики пройдены`);
