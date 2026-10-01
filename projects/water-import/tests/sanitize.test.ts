import assert from "node:assert/strict";
import test from "node:test";
import { newSave } from "../src/game/engine";
import { FISH } from "../src/game/fish";
import { sanitizeSave } from "../src/lib/sanitize";
import type { SaveData } from "../src/game/types";

/**
 * Серверная проверка сейва. Раньше здесь проверялись только потолки на отдельные
 * поля — «записать 301 вид и два миллиона опыта» стоило одной правки localStorage.
 */

const HOUR = 3_600;

/** Честное сохранение: 120 видов, 800 уловов, 60 часов игры. */
function honestSave(): Record<string, unknown> {
  const s = newSave() as unknown as Record<string, unknown>;
  const codex: Record<string, unknown> = {};
  for (const f of FISH.slice(0, 120)) codex[f.id] = { count: 3, maxWeight: f.weight[1], firstDay: 2, variants: [] };
  s.codex = codex;
  s.money = 45_000;
  s.xp = 12_000;
  s.ordersDone = 12;
  s.stats = { totalCaught: 800, totalEarned: 120_000, playSeconds: 60 * HOUR, nightCatches: 90, stormCatches: 12, maxDepthCaught: 320 };
  return s;
}

test("честное сохранение не трогается", () => {
  const clean = sanitizeSave(honestSave(), { accountAgeSeconds: 400 * HOUR });
  assert.equal(clean.species, 120);
  assert.equal(clean.codexCount, 120);
  assert.equal(clean.clamped.length, 0);
  assert.equal(clean.unknownSpecies, 0);
  assert.equal((clean.data.stats as { totalCaught: number }).totalCaught, 800);
  assert.equal((clean.data.stats as { playSeconds: number }).playSeconds, 60 * HOUR);
  // Достижения пересчитаны по правилам игры, а не взяты из запроса.
  assert.ok(clean.achievements > 0);
  assert.ok((clean.data.achievements as string[]).includes("first"));
  assert.ok((clean.data.achievements as string[]).includes("c500"));
});

test("несуществующие виды выброшены, честные остались", () => {
  const s = honestSave();
  (s.codex as Record<string, unknown>).ne_suschestvuet = { count: 99, maxWeight: 5, firstDay: 1, variants: [] };
  const clean = sanitizeSave(s, { accountAgeSeconds: 400 * HOUR });
  assert.equal(clean.unknownSpecies, 1);
  assert.equal(clean.species, 120);
  assert.equal(clean.codexCount, 120);
});

test("потолки отдельных полей по-прежнему работают", () => {
  const s = honestSave();
  s.money = 999_999_999_999;
  s.xp = 999_999_999;
  (s.stats as Record<string, unknown>).playSeconds = 999_999_999;
  (s.stats as Record<string, unknown>).totalCaught = 9_999_999;
  const clean = sanitizeSave(s, { accountAgeSeconds: 10 * 365 * 24 * HOUR });
  assert.equal(clean.data.money, 100_000_000);
  assert.equal(clean.data.xp, 2_000_000);
  assert.equal((clean.data.stats as { totalCaught: number }).totalCaught, 1_000_000);
});

test("наигранное время не может превышать возраст аккаунта", () => {
  const s = honestSave();
  // Свежая учётная запись заявила 60 часов игры и 50 тысяч уловов.
  (s.stats as Record<string, unknown>).playSeconds = 60 * HOUR;
  (s.stats as Record<string, unknown>).totalCaught = 50_000;
  const clean = sanitizeSave(s, { accountAgeSeconds: 0 });
  // Доступный предел для нового аккаунта — час на расхождение часов.
  assert.equal((clean.data.stats as { playSeconds: number }).playSeconds, 3_600);
  assert.ok(clean.clamped.includes("stats.playSeconds"));
  // И всё, что от времени зависит, съехало вслед за ним.
  assert.equal((clean.data.stats as { totalCaught: number }).totalCaught, 3_600);
  assert.ok(clean.clamped.includes("stats.totalCaught"));
  assert.equal(clean.codexCount, 120, "виды не режем, но и в рейтинг не засчитываем");
});

test("уловов не может быть больше, чем наигранных секунд", () => {
  const s = honestSave();
  (s.stats as Record<string, unknown>).playSeconds = 500;
  (s.stats as unknown as { totalCaught: number }).totalCaught = 9_000;
  const clean = sanitizeSave(s, { accountAgeSeconds: 400 * HOUR });
  assert.equal((clean.data.stats as { totalCaught: number }).totalCaught, 500);
  assert.ok(clean.clamped.includes("stats.totalCaught"));
});

test("видов в рейтинге не больше, чем уловов", () => {
  const s = honestSave();
  (s.stats as Record<string, unknown>).totalCaught = 10;
  const clean = sanitizeSave(s, { accountAgeSeconds: 400 * HOUR });
  assert.equal(clean.species, 120);
  assert.equal(clean.codexCount, 10);
});

test("опыт ограничен числом уловов, а не одной лишь цифрой", () => {
  const s = honestSave();
  s.xp = 1_900_000;
  (s.stats as Record<string, unknown>).totalCaught = 5;
  const clean = sanitizeSave(s, { accountAgeSeconds: 400 * HOUR });
  // 5 уловов × 3100 + запас на квесты — это потолок, а не два миллиона.
  assert.equal(clean.data.xp, 5 * 3_100 + 100_000);
  assert.ok(clean.clamped.includes("xp"));
});

test("ночные и штормовые уловы не больше всех уловов", () => {
  const s = honestSave();
  (s.stats as Record<string, unknown>).totalCaught = 20;
  (s.stats as Record<string, unknown>).nightCatches = 5_000;
  (s.stats as Record<string, unknown>).stormCatches = 5_000;
  const clean = sanitizeSave(s, { accountAgeSeconds: 400 * HOUR });
  assert.equal((clean.data.stats as { nightCatches: number }).nightCatches, 20);
  assert.equal((clean.data.stats as { stormCatches: number }).stormCatches, 20);
});

test("глубина улова ограничена самой глубокой акваторией", () => {
  const s = honestSave();
  (s.stats as Record<string, unknown>).maxDepthCaught = 9_999;
  const clean = sanitizeSave(s, { accountAgeSeconds: 400 * HOUR });
  assert.equal((clean.data.stats as { maxDepthCaught: number }).maxDepthCaught, 2_000);
});

test("чужие достижения не засчитываются — они пересчитываются", () => {
  const s = honestSave();
  s.achievements = ["hacker_one", "hacker_two", "всё_сразу"];
  const clean = sanitizeSave(s, { accountAgeSeconds: 400 * HOUR });
  const list = clean.data.achievements as string[];
  assert.ok(!list.includes("hacker_one"));
  assert.equal(list.length, clean.achievements);
  // 800 уловов и 120 видов кое-что открывают по-настоящему.
  assert.ok(list.includes("c500"));
  assert.ok(!list.includes("c250"), "200 видов ещё не открыты");
});

test("неизвестные суда, акватории и порты не уезжают в базу", () => {
  const s = honestSave();
  s.boat = 42;
  s.location = "atlantis";
  s.weather = "meteor";
  s.unlocked = ["bay", "atlantis", "moon"];
  s.portsKnown = ["home", "atlantis"];
  s.boatsOwned = [0, 99, -3];
  const clean = sanitizeSave(s, { accountAgeSeconds: 400 * HOUR });
  assert.equal(clean.data.boat, 0);
  assert.equal(clean.data.location, "bay");
  assert.equal(clean.data.weather, "clear");
  assert.deepEqual(clean.data.unlocked, ["bay"]);
  assert.deepEqual(clean.data.portsKnown, ["home"]);
  assert.deepEqual(clean.data.boatsOwned, [0]);
});

test("выдуманные находки выкидываются, честные остаются", () => {
  const s = honestSave();
  s.finds = { boot: 2, nesuschestvuet: 5, pearl: 1 };
  const clean = sanitizeSave(s, { accountAgeSeconds: 400 * HOUR });
  assert.deepEqual(clean.data.finds, { boot: 2, pearl: 1 });
});

test("холодильник и заказы чистятся от несуществующей рыбы", () => {
  const s = honestSave();
  s.cooler = [{ uid: "a", fishId: "goby", weight: 0.2, variant: null, value: 40, day: 1, loc: "bay", at: 300 }, { uid: "b", fishId: "drakon", weight: 9, variant: null, value: 9, day: 1, loc: "bay", at: 300 }];
  const clean = sanitizeSave(s, { accountAgeSeconds: 400 * HOUR });
  assert.equal((clean.data.cooler as unknown[]).length, 1);
  assert.ok(clean.clamped.includes("cooler"));
});

test("пересчёт достижений не падает на неполном сохранении", () => {
  const clean = sanitizeSave({ codex: {}, stats: {}, xp: 0 }, { accountAgeSeconds: 0 });
  assert.equal(clean.achievements, 0);
  assert.deepEqual(clean.data.achievements, []);
});

test("без возраста аккаунта потолок времени остаётся прежним", () => {
  const s = honestSave();
  (s.stats as Record<string, unknown>).playSeconds = 90_000_000;
  const clean = sanitizeSave(s);
  assert.equal((clean.data.stats as { playSeconds: number }).playSeconds, 90_000_000);
  const huge = sanitizeSave(honestSave());
  assert.equal((huge.data.stats as { playSeconds: number }).playSeconds, 60 * HOUR);
});

test("сохранение после чистки остаётся пригодным для движка", () => {
  const clean = sanitizeSave(honestSave(), { accountAgeSeconds: 400 * HOUR });
  // движок должен переварить результат без потерь
  const s = clean.data as unknown as SaveData;
  assert.equal(s.location, "bay");
  assert.equal(s.weather, "fog");
  assert.equal(typeof s.codex.turbot, "object");
  assert.equal(s.boatsOwned[0], 0);
});
