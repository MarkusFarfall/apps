/**
 * Проверка экономики улова. Запуск: npx tsx scripts/check-prices.ts
 *
 * Смысл в том, чтобы цена за мелкую рыбу не проседала: раньше она считалась как
 * «вес × цена за килограмм» и бычок на 50 граммов уходил за пару рублей. Теперь
 * у вида есть ставка по редкости, и ниже неё не опускает ни рынок, ни насыщение.
 */
import { Engine } from "../src/game/engine";
import { FISH, FISH_BY_ID, RARITY_INFO } from "../src/game/fish";
import { PORTS } from "../src/game/world";
import type { CaughtFish } from "../src/game/types";

let fails = 0;
const bad = (msg: string) => {
  fails++;
  console.log(`  ✗ ${msg}`);
};
const value = (fishId: string, weight: number, mult = 1) => {
  const f = FISH.find((x) => x.id === fishId)!;
  return Math.round((RARITY_INFO[f.rarity].base + weight * f.price) * mult);
};
const caught = (engine: Engine, fishId: string, weight: number, at: number): CaughtFish => ({
  uid: "test",
  fishId,
  weight,
  variant: null,
  value: value(fishId, weight),
  day: engine.day,
  loc: "bay",
  at,
});

const e = new Engine();

// ── 1. цена при поимке не ниже ставки за вид ──
let minCommon = Infinity;
let minAny = Infinity;
let maxAll = 0;
for (const f of FISH) {
  const base = RARITY_INFO[f.rarity].base;
  for (const w of [f.weight[0], f.weight[1]]) {
    const v = value(f.id, w);
    minAny = Math.min(minAny, v);
    maxAll = Math.max(maxAll, v);
    if (v < base) bad(`${f.name}: ${v} ₽ ниже ставки ${base} ₽`);
    if (f.rarity === "common") minCommon = Math.min(minCommon, v);
  }
}
if (minCommon < 30) bad(`самая дешёвая обычная рыба стоит ${minCommon} ₽ — меньше 30`);
console.log(`  ✓ ${FISH.length} видов: минимум у обычной рыбы ${minCommon} ₽, по всем видам от ${minAny} до ${maxAll.toLocaleString("ru")} ₽`);

// ── 2. обвал рынка (500 продаж вида сегодня, улов двухдневной давности) ──
const key = e.day * 10 + PORTS.indexOf(e.port);
let worst = Infinity;
let worstName = "";
for (const f of FISH) {
  const base = RARITY_INFO[f.rarity].base;
  e.s.market = { day: key, sold: { [f.id]: 500 } };
  const mv = e.marketValue(caught(e, f.id, f.weight[0], e.s.minutes - 60 * 48));
  if (mv < base) bad(`${f.name}: рынок дал ${mv} ₽ при ставке ${base} ₽`);
  if (mv < worst) {
    worst = mv;
    worstName = f.name;
  }
}
console.log(`  ✓ даже на обвале рынка минимум ${worst} ₽ (${worstName})`);

// ── 3. вариации умножают всю цену ──
e.s.market = { day: key, sold: {} };
const goby = FISH.find((f) => f.id === "goby")!;
const golden = value("goby", goby.weight[0], 6);
if (golden < RARITY_INFO.common.base * 6) bad("золотая вариация потеряла множитель");
console.log(`  ✓ бычок 50 г: ${value("goby", goby.weight[0])} ₽, золотой — ${golden} ₽`);

// ── 4. собранный заказ всегда выгоднее отдельной продажи тех же рыб ──
const shop = new Engine();
let minReward = Infinity;
let minRewardCount = 0;
let checkedOrders = 0;
for (let i = 0; i < 400; i++) {
  const o = (shop as unknown as { makeOrder(): { id: string; fishId: string; reward: number; count: number; minWeight: number; expiresDay: number; client: string } | null }).makeOrder();
  if (!o) continue;
  if (o.reward < 100) bad(`заказ на ${o.count} шт. показывает базовую оплату ${o.reward} ₽`);

  const f = FISH_BY_ID[o.fishId];
  const weight = Math.max(f.weight[0], o.minWeight);
  shop.s.market = { day: shop.day * 10 + PORTS.indexOf(shop.port), sold: { [o.fishId]: 500 } };
  shop.s.cooler = Array.from({ length: o.count }, (_, j) => ({
    uid: `order-${i}-${j}`,
    fishId: o.fishId,
    weight,
    variant: null,
    value: value(o.fishId, weight),
    day: shop.day,
    loc: f.loc[0],
    at: shop.s.minutes,
  }));
  const separateSale = [...shop.coolerQuote().values()].reduce((sum, amount) => sum + amount, 0);
  const payout = shop.orderReward(o);
  const minBonus = Math.max(20, Math.ceil(separateSale * 0.15));
  if (payout < separateSale + minBonus) bad(`${f.name}: заказ ${payout} ₽, отдельная продажа ${separateSale} ₽`);
  checkedOrders++;
  if (payout < minReward) {
    minReward = payout;
    minRewardCount = o.count;
  }
}
console.log(`  ✓ ${checkedOrders} собранных заказов, минимальная выплата ${minReward} ₽ (${minRewardCount} шт.; рынок насыщен)`);

console.log(fails ? `\n  ПРОВАЛОВ: ${fails}` : "\n  Все проверки цен пройдены");
process.exit(fails ? 1 : 0);
