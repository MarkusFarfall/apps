/**
 * Сколько стоит пойманная рыба. Запуск: npx tsx scripts/show-prices.ts
 *
 * Цена = ставка за вид по редкости + вес × цена за килограмм. Дальше на рынке
 * работают множители порта, спроса дня и свежести, но ниже ставки цена не падает.
 */
import { FISH, RARITY_INFO } from "../src/game/fish";

const RUB = (n: number) => n.toLocaleString("ru");

const byRarity = (Object.keys(RARITY_INFO) as (keyof typeof RARITY_INFO)[]).map((r) => {
  const ids = FISH.filter((f) => f.rarity === r);
  const prices = ids.flatMap((f) => [f.weight[0] * f.price + RARITY_INFO[r].base, f.weight[1] * f.price + RARITY_INFO[r].base]);
  return { r, ids, lo: Math.round(Math.min(...prices)), hi: Math.round(Math.max(...prices)) };
});

console.log("\nРыба в игре — сколько даёт одна штука (до множителей рынка)\n");
console.log("РЕДКОСТЬ        СТАВКА   ОТ      ДО     ВИДОВ");
for (const { r, ids, lo, hi } of byRarity) {
  const info = RARITY_INFO[r];
  console.log(`${info.name.padEnd(15)} ${String(info.base).padStart(5)} ₽ ${RUB(lo).padStart(6)}  ${RUB(hi).padStart(7)}  ${String(ids.length).padStart(6)}`);
}

console.log("\nПримеры (мелкая и самая крупная особь вида):\n");
console.log("ВИД                        РЕДКОСТЬ        СТАВКА   МЕЛКАЯ    КРУПНАЯ");
const sample = ["goby", "wrasse", "red_mullet", "mullet", "turbot", "cod", "sea_bass", "monkfish", "bay_master"];
for (const id of sample) {
  const f = FISH.find((x) => x.id === id);
  if (!f) continue;
  const info = RARITY_INFO[f.rarity];
  const small = Math.round(info.base + f.weight[0] * f.price);
  const big = Math.round(info.base + f.weight[1] * f.price);
  console.log(`${f.name.padEnd(26)} ${info.name.padEnd(15)} ${String(info.base).padStart(5)} ₽ ${RUB(small).padStart(7)}  ${RUB(big).padStart(8)}`);
}
console.log();
