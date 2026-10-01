import assert from "node:assert/strict";
import test from "node:test";
import {
  avatarHue, boatOf, dayLabel, initialsOf, isOnline, isValidUserId, lastSeenLabel, locOf, normalizeQuery,
  pairOf, playTimeLabel, portOf, spotOf, weatherOf, whereLabel,
  FRIEND_LIMIT, INCOMING_LIMIT, ONLINE_WINDOW_MS, PENDING_OUT_LIMIT,
  type FriendWhere,
} from "../src/game/friends";
import { BOATS, DAYS_PER_SEASON, LOCATIONS, SEASONS } from "../src/game/world";

const MIN = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

test("пара друзей нормализована и симметрична", () => {
  const [a, b] = pairOf("usr_b", "usr_a");
  assert.deepEqual([a, b], ["usr_a", "usr_b"]);
  // порядок аргументов не важен — иначе на одну пару завелись бы две строки
  assert.deepEqual(pairOf("usr_a", "usr_b"), pairOf("usr_b", "usr_a"));
  assert.deepEqual(pairOf("x", "x"), ["x", "x"]);
});

test("идентификатор игрока проверяется по формату", () => {
  assert.ok(isValidUserId(`usr_${"a".repeat(32)}`));
  assert.ok(!isValidUserId("usr_short"));
  assert.ok(!isValidUserId(`usr_${"z".repeat(32)}`), "не шестнадцатеричный");
  assert.ok(!isValidUserId("'; drop table users; --"));
  assert.ok(!isValidUserId(undefined) && !isValidUserId(42) && !isValidUserId(null));
});

test("строка поиска: минимум два символа и только допустимые", () => {
  assert.equal(normalizeQuery("  Марк  "), "Марк");
  assert.equal(normalizeQuery("ab"), "ab");
  assert.equal(normalizeQuery("a"), null, "один символ — не запрос");
  assert.equal(normalizeQuery(""), null);
  assert.equal(normalizeQuery("ры*бак"), null, "символы-джокеры LIKE не пропускаем");
  assert.equal(normalizeQuery("100%"), null);
  assert.equal(normalizeQuery("a".repeat(25), ), null, "слишком длинно");
  assert.equal(normalizeQuery(42), null);
  assert.equal(normalizeQuery("имя_с.точкой-дефис"), "имя_с.точкой-дефис");
});

test("пределы дружбы разумны", () => {
  assert.ok(FRIEND_LIMIT >= 10 && FRIEND_LIMIT <= 500);
  assert.ok(PENDING_OUT_LIMIT > 0 && PENDING_OUT_LIMIT <= FRIEND_LIMIT);
  assert.ok(ONLINE_WINDOW_MS >= MIN && ONLINE_WINDOW_MS <= 30 * MIN);
});

test("«был в сети»: только что, минуты, часы, вчера, дни, дата", () => {
  const now = Date.parse("2026-10-01T15:00:00Z");
  const iso = (ms: number) => new Date(now - ms).toISOString();
  assert.equal(lastSeenLabel(iso(5_000), now), "только что");
  assert.equal(lastSeenLabel(iso(59 * MIN), now), "59 мин назад");
  assert.equal(lastSeenLabel(iso(61 * MIN), now), "1 ч назад");
  assert.equal(lastSeenLabel(iso(23 * HOUR), now), "23 ч назад");
  assert.equal(lastSeenLabel(iso(25 * HOUR), now), "вчера");
  assert.equal(lastSeenLabel(iso(3 * DAY), now), "3 дн назад");
  // \w в JS без флага u не покрывает кириллицу — проверяем юникод-классом
  assert.match(lastSeenLabel(iso(30 * DAY), now), /^\d{1,2} \p{L}+$/u);
  assert.equal(lastSeenLabel(null, now), "не заходил");
  assert.equal(lastSeenLabel("не дата", now), "не заходил");
  // часы на устройстве спешат — не показываем «минус пять минут»
  assert.equal(lastSeenLabel(iso(-10 * MIN), now), "только что");
});

test("«в игре сейчас» — окно в пять минут и защита от спешащих часов", () => {
  const now = Date.parse("2026-10-01T15:00:00Z");
  assert.ok(isOnline(new Date(now - 2 * MIN).toISOString(), now));
  assert.ok(!isOnline(new Date(now - 6 * MIN).toISOString(), now));
  assert.ok(!isOnline(null, now));
  assert.ok(isOnline(new Date(now + 2 * MIN).toISOString(), now), "небольшой сдвиг часов не считается офлайном");
  assert.ok(!isOnline(new Date(now + 60 * MIN).toISOString(), now), "сильно «будущее» время — не онлайн");
});

test("наигранное время читается по-русски", () => {
  assert.equal(playTimeLabel(0), "0 с");
  assert.equal(playTimeLabel(45), "45 с");
  assert.equal(playTimeLabel(125), "2 мин");
  assert.equal(playTimeLabel(3_599), "59 мин");
  assert.equal(playTimeLabel(3_600), "1 ч 00 мин");
  assert.equal(playTimeLabel(4_530), "1 ч 15 мин");
  assert.equal(playTimeLabel(Number.NaN), "0 с");
  assert.equal(playTimeLabel(-5), "0 с");
});

test("игровой календарь друга совпадает с расчётом движка", () => {
  assert.equal(dayLabel(1), `${SEASONS[0]}, день\u00A01/7`);
  assert.equal(dayLabel(DAYS_PER_SEASON), `${SEASONS[0]}, день\u00A0${DAYS_PER_SEASON}/7`);
  assert.equal(dayLabel(DAYS_PER_SEASON + 1), `${SEASONS[1]}, день\u00A01/7`);
  assert.equal(dayLabel(DAYS_PER_SEASON * 4 + 1), `${SEASONS[0]}, день\u00A01/7\u00A0·\u00A0год\u00A02`);
  assert.equal(dayLabel(null), null);
  assert.equal(dayLabel(0), null);
});

test("инициалы для аватара", () => {
  assert.equal(initialsOf("Марк"), "МА");
  assert.equal(initialsOf("старый_помор"), "СП", "разделители — пробел, точка, дефис, подчёркивание");
  assert.equal(initialsOf("Иван Петров"), "ИП");
  assert.equal(initialsOf("  "), "?");
  assert.equal(initialsOf(""), "?");
});

test("оттенок аватара детерминирован и в диапазоне", () => {
  const id = `usr_${"a".repeat(32)}`;
  assert.equal(avatarHue(id), avatarHue(id));
  for (const x of ["usr_1", "usr_2", "usr_abc"]) {
    const h = avatarHue(x);
    assert.ok(Number.isInteger(h) && h >= 0 && h < 360, `оттенок вне диапазона: ${h}`);
  }
  assert.notEqual(avatarHue("usr_aaa"), avatarHue("usr_bbb"));
});

test("справочники мира не пропускают чужие идентификаторы", () => {
  assert.equal(boatOf(0), BOATS[0]);
  assert.equal(boatOf(BOATS.length - 1), BOATS[BOATS.length - 1]);
  assert.equal(boatOf(BOATS.length), null);
  assert.equal(boatOf(-1), null);
  assert.equal(boatOf(1.5), null);
  assert.equal(boatOf(null), null);
  assert.equal(boatOf(undefined), null);

  assert.equal(locOf(LOCATIONS[0].id)?.id, LOCATIONS[0].id);
  assert.equal(locOf("atlantis"), null);
  assert.equal(locOf(null), null);
  assert.equal(spotOf("bay_pier")?.loc, "bay");
  assert.equal(spotOf("нет_такого"), null);
  assert.equal(portOf("home")?.id, "home");
  assert.equal(portOf("atlantis"), null);
  assert.equal(weatherOf("storm")?.name, "Шторм");
  assert.equal(weatherOf("blizzard"), null);
});

test("подпись места: лодка, порт, скрытое местоположение, пустое сохранение", () => {
  const base: FriendWhere = {
    location: "bay", locationName: "Тихая бухта", spotName: "Старый пирс",
    port: "home", portName: "Знакомая вода", atPort: false, weather: "clear",
    weatherName: "Ясно", boat: 0, gameDay: 3, hidden: false, updatedAt: null,
  };
  assert.equal(whereLabel(base), "Тихая бухта · Старый пирс");
  assert.equal(whereLabel({ ...base, spotName: null }), "Тихая бухта");
  assert.equal(whereLabel({ ...base, atPort: true }), "в порту · Знакомая вода");
  assert.equal(whereLabel({ ...base, hidden: true }), "скрыл своё местоположение");
  assert.equal(whereLabel({ ...base, location: null, locationName: null, spotName: null }), "неизвестные воды");
  assert.equal(whereLabel(null), "ещё не выходил в море");
  // приватность важнее деталей: при hidden не остаётся ни локации, ни порта
  assert.equal(whereLabel({ ...base, hidden: true, atPort: true }), "скрыл своё местоположение");
});

test("предел входящих заявок есть и он больше исходящих", () => {
  // Без него аккаунт с десятком «пустышек» заваливал чужой список друзей.
  assert.ok(INCOMING_LIMIT >= PENDING_OUT_LIMIT);
  assert.ok(INCOMING_LIMIT <= 200, "список должен оставаться читаемым");
  assert.equal(typeof INCOMING_LIMIT, "number");
});
