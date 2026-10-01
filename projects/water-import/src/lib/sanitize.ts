import { FISH_BY_ID } from "@/game/fish";
import { BOATS, LOC_BY_ID, SPOT_BY_ID, WEATHER_INFO, spotsOf } from "@/game/world";
import type { LocId, WeatherId } from "@/game/types";

/**
 * Приведение клиентского сохранения к разумному виду.
 *
 * Прогресс приходит с клиента, поэтому сервер не верит ему на слово: чистит кодекс
 * от несуществующих видов, срезает невозможные суммы и счётчики, убирает мусор из
 * достижений. Ограничения намеренно щедрые — обычный игрок до них не дотянется,
 * а накрутка рейтинга перестаёт работать.
 */

const MAX = {
  money: 100_000_000, // самая дорогая лодка — 240 000
  xp: 2_000_000, // 60-й уровень — около 458 000
  playSeconds: 100_000_000, // ~3 года непрерывной игры
  totalCaught: 1_000_000,
  totalEarned: 1_000_000_000,
  achievements: 400,
  speciesCount: 100_000,
  firstDay: 100_000,
  nameLength: 40,
};

const clamp = (v: unknown, max: number) => {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.floor(v) : 0;
  return Math.max(0, Math.min(n, max));
};

export interface SanitizedSave {
  /** Очищенное сохранение — именно оно уходит в базу. */
  data: Record<string, unknown>;
  /** Сколько видов в кодексе после чистки. */
  species: number;
  /** Сколько «видов» пришлось выбросить — их нет в игре. */
  unknownSpecies: number;
  /** Какие поля пришлось ограничить. */
  clamped: string[];
  achievements: number;
}

export function sanitizeSave(data: Record<string, unknown>): SanitizedSave {
  const out: Record<string, unknown> = { ...data };
  const clamped: string[] = [];
  const put = (key: string, max: number) => {
    const before = out[key];
    const after = clamp(before, max);
    if (before !== undefined && before !== after) clamped.push(key);
    out[key] = after;
  };

  put("money", MAX.money);
  put("xp", MAX.xp);

  // ── мир: неизвестные идентификаторы не должны уезжать в базу ──
  // Клиент нормализует их в migrateSave(), но защита на сервере дешевле, чем
  // разбор «пропал звук»: движок звука читает location/weather/boat каждый кадр.
  if (out.location !== undefined && !LOC_BY_ID[out.location as LocId]) { out.location = "bay"; clamped.push("location"); }
  if (out.weather !== undefined && !WEATHER_INFO[out.weather as WeatherId]) { out.weather = "clear"; clamped.push("weather"); }
  if (out.weatherQueued !== undefined && !WEATHER_INFO[out.weatherQueued as WeatherId]) { out.weatherQueued = "cloudy"; clamped.push("weatherQueued"); }
  if (out.boat !== undefined && (!Number.isInteger(out.boat) || !BOATS[out.boat as number])) { out.boat = 0; clamped.push("boat"); }
  const spotLoc = (LOC_BY_ID[out.location as LocId] ? out.location : "bay") as LocId;
  if (out.spot !== undefined && (!SPOT_BY_ID[out.spot as string] || SPOT_BY_ID[out.spot as string].loc !== spotLoc)) {
    out.spot = spotsOf(spotLoc)[0].id;
    clamped.push("spot");
  }
  if (out.wind !== undefined && (typeof out.wind !== "number" || !Number.isFinite(out.wind))) { out.wind = 0.3; clamped.push("wind"); }

  // ── кодекс: только существующие виды, вес не выше максимума вида ──
  const codexRaw = data.codex && typeof data.codex === "object" && !Array.isArray(data.codex) ? (data.codex as Record<string, unknown>) : {};
  const codex: Record<string, unknown> = {};
  let species = 0;
  let unknownSpecies = 0;
  for (const [id, value] of Object.entries(codexRaw)) {
    const fish = FISH_BY_ID[id];
    if (!fish) {
      unknownSpecies++;
      continue;
    }
    species++;
    const entry = value && typeof value === "object" && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {};
    entry.count = clamp(entry.count, MAX.speciesCount);
    const weight = typeof entry.maxWeight === "number" && Number.isFinite(entry.maxWeight) ? entry.maxWeight : 0;
    entry.maxWeight = Math.min(weight, fish.weight[1] * 1.05);
    entry.firstDay = clamp(entry.firstDay, MAX.firstDay);
    entry.variants = Array.isArray(entry.variants) ? entry.variants.filter((v) => typeof v === "string" && v.length <= 24).slice(0, 16) : [];
    codex[id] = entry;
  }
  out.codex = codex;

  // ── достижения: строки без дублей и мусора ──
  const achRaw = Array.isArray(data.achievements) ? data.achievements : [];
  const seen = new Set<string>();
  const achievements: string[] = [];
  for (const item of achRaw) {
    if (typeof item !== "string" || !item || item.length > MAX.nameLength || seen.has(item)) continue;
    seen.add(item);
    achievements.push(item);
    if (achievements.length >= MAX.achievements) break;
  }
  out.achievements = achievements;

  // ── статистика ──
  const statsRaw = data.stats && typeof data.stats === "object" && !Array.isArray(data.stats) ? (data.stats as Record<string, unknown>) : {};
  const stats: Record<string, unknown> = { ...statsRaw };
  const stat = (key: string, max: number) => {
    const before = stats[key];
    const after = clamp(before, max);
    if (before !== undefined && before !== after) clamped.push(`stats.${key}`);
    stats[key] = after;
  };
  stat("playSeconds", MAX.playSeconds);
  stat("totalCaught", MAX.totalCaught);
  stat("totalEarned", MAX.totalEarned);

  // самый крупный улов должен быть реально возможным для своего вида
  const biggest = stats.biggest as { fishId?: unknown; weight?: unknown } | null | undefined;
  if (biggest && typeof biggest === "object") {
    const fish = typeof biggest.fishId === "string" ? FISH_BY_ID[biggest.fishId] : undefined;
    const weight = typeof biggest.weight === "number" ? biggest.weight : 0;
    if (!fish || !(weight > 0) || weight > fish.weight[1] * 1.05) {
      stats.biggest = null;
      clamped.push("stats.biggest");
    }
  }
  out.stats = stats;

  return { data: out, species, unknownSpecies, clamped, achievements: achievements.length };
}
