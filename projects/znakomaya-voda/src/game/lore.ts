import type { Engine } from "./engine";
import { FISH_BY_ID } from "./fish";
import type { FishDef } from "./types";
import { BAIT_BY_ID, LINES, LOC_BY_ID, RODS, SEASONS, SPOTS, WEATHER_INFO } from "./world";

const LEN_K: Record<string, number> = { fusiform: 0.011, deep: 0.024, flat: 0.02, eel: 0.0016, long: 0.0032, billfish: 0.006, shark: 0.008, angler: 0.03, ray: 0.04, squid: 0.004, blob: 0.04, puffer: 0.05 };
export const fishLengthCm = (f: FishDef, w: number) => Math.cbrt((w * 1000) / (LEN_K[f.shape] ?? 0.011));
const fmtLen = (cm: number) => (cm >= 100 ? `${(cm / 100).toFixed(1).replace(".", ",")} м` : `${Math.round(cm)} см`);
const fmtW = (w: number) => (w < 1 ? `${Math.round(w * 1000)} г` : `${w < 10 ? w.toFixed(1).replace(".", ",") : Math.round(w)} кг`);
const list = (a: string[]) => (a.length <= 1 ? a.join("") : `${a.slice(0, -1).join(", ")} и ${a[a.length - 1]}`);

const TIME_PHRASE = {
  any: "Активна в любое время суток",
  day: "Кормится днём, при хорошем освещении",
  night: "Выходит на охоту только ночью",
  twilight: "Клюёт на рассвете и на закате, в короткие часы полумрака",
} as const;

const STRENGTH_PHRASE = [
  "",
  "Сопротивляется вяло — справится любая снасть.",
  "Сопротивляется вяло — справится любая снасть.",
  "Бойкая, но лёгкое удилище её выдержит.",
  "Бойкая, но лёгкое удилище её выдержит.",
  "Упирается всерьёз; нужна надёжная снасть и терпение.",
  "Упирается всерьёз; нужна надёжная снасть и терпение.",
  "Мощные затяжные рывки — без морского удилища не обойтись.",
  "Мощные затяжные рывки — без морского удилища не обойтись.",
  "Один из сильнейших противников в море: снасть должна быть высшего класса.",
  "Один из сильнейших противников в море: снасть должна быть высшего класса.",
];

/** Мощность рывка — та же формула, что в движке (средний экземпляр) */
export function fishPower(f: FishDef) {
  let p = 1.2 * Math.pow(f.strength, 1.6);
  if (f.rarity === "legendary") p *= 1.25;
  else if (f.rarity === "epic") p *= 1.1;
  return p;
}

export function recommendedRod(f: FishDef) {
  const need = fishPower(f) / 0.85;
  const i = RODS.findIndex((r) => r.value >= need);
  return i < 0 ? RODS.length - 1 : i;
}

export function recommendedLine(f: FishDef) {
  const i = LINES.findIndex((l) => l.value >= f.depth[0] + 1);
  return i < 0 ? LINES.length - 1 : i;
}

export function bestSpots(f: FishDef) {
  return SPOTS.filter((s) => s.bias.includes(f.id));
}

/** Развёрнутые заметки рыбака о виде */
export function fishNotes(f: FishDef, jumper: boolean): { title: string; text: string }[] {
  const locs = f.loc.map((l) => LOC_BY_ID[l].name);
  const spots = bestSpots(f).map((s) => `«${s.name}»`);
  const out: { title: string; text: string }[] = [];

  let where = `Встречается ${locs.length > 1 ? "в акваториях" : "в акватории"} ${list(locs.map((l) => `«${l}»`))} на глубине от ${f.depth[0]} до ${f.depth[1]} м.`;
  if (spots.length) where += ` Охотнее всего держится у ${spots.length > 1 ? "точек" : "точки"} ${list(spots)}.`;
  out.push({ title: "Где искать", text: where });

  const when: string[] = [TIME_PHRASE[f.time] + "."];
  if (f.weather) when.push(`Появляется только в погоду: ${list(f.weather.map((w) => WEATHER_INFO[w].name.toLowerCase()))}.`);
  if (f.season) when.push(`Сезон: ${list(f.season.map((s) => SEASONS[s].toLowerCase()))}.`);
  else when.push("Ловится круглый год.");
  if (f.moon) when.push(f.moon === "full" ? "Поднимается лишь в полнолуние." : "Поднимается лишь в безлунные ночи новолуния.");
  out.push({ title: "Когда", text: when.join(" ") });

  const how: string[] = [];
  if (f.bait?.length) how.push(`Лучшая наживка — ${list(f.bait.map((b) => BAIT_BY_ID[b].name.toLowerCase()))}.`);
  if (f.glow && f.depth[0] > 150) how.push("В полной темноте реагирует на светящуюся приманку.");
  how.push(STRENGTH_PHRASE[f.strength]);
  if (jumper) how.push("На вываживании выпрыгивает из воды — в этот момент нельзя подматывать.");
  const rod = RODS[recommendedRod(f)];
  const line = LINES[recommendedLine(f)];
  how.push(`Рекомендуется удилище не слабее «${rod.name}» и ${line.name.toLowerCase()}.`);
  out.push({ title: "Как ловить", text: how.join(" ") });

  const avgW = f.weight[0] + (f.weight[1] - f.weight[0]) * 0.35;
  const avgPrice = Math.round(avgW * f.price);
  out.push({
    title: "Размеры и цена",
    text: `Обычно весит от ${fmtW(f.weight[0])} до ${fmtW(f.weight[1])} при длине ${fmtLen(fishLengthCm(f, f.weight[0]))} – ${fmtLen(fishLengthCm(f, f.weight[1]))}. Средний экземпляр на рынке стоит около ${avgPrice.toLocaleString("ru-RU")} ₽; трофейные и редкие вариации — в разы дороже.`,
  });
  return out;
}

export interface ConditionCheck {
  label: string;
  ok: boolean;
  hint: string;
}

/** Совпадают ли условия прямо сейчас */
export function conditionsNow(e: Engine, id: string): ConditionCheck[] {
  const f = FISH_BY_ID[id];
  const tod = e.timeOfDay;
  const res: ConditionCheck[] = [];
  res.push({ label: "Акватория", ok: f.loc.includes(e.s.location), hint: f.loc.map((l) => LOC_BY_ID[l].name).join(", ") });
  res.push({ label: "Время суток", ok: f.time === "any" || f.time === tod, hint: { any: "любое", day: "день", night: "ночь", twilight: "сумерки" }[f.time] });
  if (f.weather) res.push({ label: "Погода", ok: f.weather.includes(e.s.weather), hint: f.weather.map((w) => WEATHER_INFO[w].name.toLowerCase()).join(", ") });
  if (f.season) res.push({ label: "Сезон", ok: f.season.includes(e.season), hint: f.season.map((s) => SEASONS[s].toLowerCase()).join(", ") });
  if (f.moon) res.push({ label: "Луна", ok: f.moon === "full" ? e.moonIndex === 4 : e.moonIndex === 0, hint: f.moon === "full" ? "полнолуние" : "новолуние" });
  res.push({ label: "Длина лески", ok: e.line.value >= f.depth[0], hint: `от ${f.depth[0]} м` });
  return res;
}

/** Все условия, кроме места, выполнены (для фильтра «доступны сейчас») */
export function availableNow(e: Engine, f: FishDef) {
  const tod = e.timeOfDay;
  if (f.time !== "any" && f.time !== tod) return false;
  if (f.weather && !f.weather.includes(e.s.weather)) return false;
  if (f.season && !f.season.includes(e.season)) return false;
  if (f.moon === "full" && e.moonIndex !== 4) return false;
  if (f.moon === "new" && e.moonIndex !== 0) return false;
  return true;
}
