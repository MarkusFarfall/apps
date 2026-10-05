import { FISH_BY_ID } from "@/game/fish";
import { EventDirector } from "@/game/events";
import type { DirectorSave } from "@/game/events/types";
import { GAME_EVENT_BY_ID, GAME_EVENTS } from "@/game/events/gameCatalog";
import { ACHIEVEMENTS, FIND_BY_ID } from "@/game/progress";
import { BOATS, LOCATIONS, LOC_BY_ID, PORT_BY_ID, SONARS, SPOT_BY_ID, WEATHER_INFO, spotsOf } from "@/game/world";
import type { LocId, SaveData, WeatherId } from "@/game/types";

/**
 * Приведение клиентского сохранения к разумному виду.
 *
 * Прогресс приходит с клиента, поэтому сервер не верит ему на слово: чистит кодекс
 * от несуществующих видов, срезает невозможные суммы и счётчики, убирает мусор из
 * достижений. Ограничения намеренно щедрые — обычный игрок до них не дотянется,
 * а накрутка рейтинга перестаёт работать.
 *
 * Кроме потолков на отдельные поля проверяются связи между ними: виды не могут
 * превышать число уловов, уловы — наигранное время, а наигранное время — возраст
 * аккаунта. Без этого «записать 301 вид и два миллиона опыта» стоило одной правки
 * localStorage. Достижения не фильтруются, а пересчитываются по правилам игры:
 * сервер сам решает, что заработано, поэтому чужие строки в список не попадают.
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
  nameLength: 48,
  flags: 300,
  minutes: 100_000_000,
};

/** Самая большая глубина среди акваторий — «Бездна», 2000 м. */
const MAX_DEPTH = Math.max(...LOCATIONS.map((l) => l.maxDepth));
/** Максимум опыта за одну поклёвку: легендарная × трофей × класс судна 4 + новый вид. */
const XP_PER_CATCH_MAX = 3_100;
/** Опыт из квестов, находок и писем — он не привязан к числу уловов. */
const XP_SLACK = 100_000;

/**
 * Насколько наигранное время может превышать возраст аккаунта.
 * Двукратный запас снимает вопросы про расхождение часов и про то, что один
 * аккаунт могли открыть на двух устройствах.
 */
const PLAY_SECONDS_SLACK = 2;
const PLAY_SECONDS_FLOOR = 3_600;

export interface SanitizeOptions {
  /**
   * Возраст аккаунта в секундах — потолок, выше которого наигранного времени быть
   * не может. Сервер знает `users.created_at`, поэтому передаёт его сюда.
   */
  accountAgeSeconds?: number;
}

export interface SanitizedSave {
  /** Очищенное сохранение — именно оно уходит в базу. */
  data: Record<string, unknown>;
  /** Сколько видов в кодексе после чистки. */
  species: number;
  /**
   * Сколько видов зачесть для рейтинга: не больше числа уловов.
   * Сам кодекс при этом не режется — терять честно добытые виды нельзя.
   */
  codexCount: number;
  /** Сколько «видов» пришлось выбросить — их нет в игре. */
  unknownSpecies: number;
  /** Какие поля пришлось ограничить. */
  clamped: string[];
  achievements: number;
}

const clamp = (v: unknown, max: number) => {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.floor(v) : 0;
  return Math.max(0, Math.min(n, max));
};

/** Только строки: массив мусора в jsonb не нужен. */
const strings = (v: unknown, maxLen: number, cap: number): string[] | null =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && x.length <= maxLen))].slice(0, cap) : null;

export function sanitizeSave(data: Record<string, unknown>, options: SanitizeOptions = {}): SanitizedSave {
  const out: Record<string, unknown> = { ...data };
  const clamped: string[] = [];
  const put = (key: string, max: number) => {
    const before = out[key];
    const after = clamp(before, max);
    if (before !== undefined && before !== after) clamped.push(key);
    out[key] = after;
  };

  put("money", MAX.money);
  put("minutes", MAX.minutes);
  if (typeof out.name !== "string" || out.name.length > MAX.nameLength) {
    out.name = typeof out.name === "string" ? out.name.slice(0, MAX.nameLength) : "Рыбак";
  }

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

  // ── списки мира: только то, что есть в игре ──
  // Достижения считаются по этим полям, поэтому выдуманные «visit_*» или девять
  // судов за один вечер иначе превращались бы в честно заработанные награды.
  if (Array.isArray(out.flags)) {
    const flags = strings(out.flags, 64, MAX.flags);
    if (flags && flags.length !== out.flags.length) clamped.push("flags");
    out.flags = flags ?? [];
  }
  if (Array.isArray(out.unlocked)) {
    const unlocked = strings(out.unlocked, 32, LOCATIONS.length)?.filter((l) => LOC_BY_ID[l as LocId]);
    if (unlocked && unlocked.length !== out.unlocked.length) clamped.push("unlocked");
    if (unlocked) out.unlocked = unlocked;
  }
  if (Array.isArray(out.portsKnown)) {
    const ports = strings(out.portsKnown, 32, Object.keys(PORT_BY_ID).length)?.filter((p) => p in PORT_BY_ID);
    if (ports && ports.length !== out.portsKnown.length) clamped.push("portsKnown");
    if (ports) out.portsKnown = ports;
  }
  if (Array.isArray(out.boatsOwned)) {
    const boats = [...new Set(out.boatsOwned.filter((i): i is number => Number.isInteger(i) && i >= 0 && i < BOATS.length))].slice(0, BOATS.length);
    if (boats.length !== out.boatsOwned.length) clamped.push("boatsOwned");
    out.boatsOwned = boats.length ? boats : [0];
    if (!BOATS[out.boat as number] || !(out.boatsOwned as number[]).includes(out.boat as number)) {
      out.boat = (out.boatsOwned as number[]).at(-1) ?? 0;
      clamped.push("boat");
    }
  }
  if (out.finds && typeof out.finds === "object" && !Array.isArray(out.finds)) {
    const finds: Record<string, number> = {};
    for (const [id, n] of Object.entries(out.finds as Record<string, unknown>)) {
      if (!FIND_BY_ID[id]) { clamped.push("finds"); continue; }
      finds[id] = clamp(n, MAX.speciesCount);
    }
    out.finds = finds;
  }
  put("ordersDone", 99_999);
  if (out.sonar !== undefined) put("sonar", SONARS.length - 1);

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

  // ── холодильник, заказы, события: только существующие в игре записи ──
  const knownList = (v: unknown, idOf: (x: Record<string, unknown>) => unknown, known: Record<string, unknown>, cap: number) => {
    if (!Array.isArray(v)) return null;
    const list = v.filter((x): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x) && typeof idOf(x) === "string" && !!known[idOf(x) as string]).slice(0, cap);
    return list.length === v.length ? v : list;
  };
  const cooler = knownList(out.cooler, (x) => x.fishId, FISH_BY_ID, 200);
  if (cooler !== null && cooler !== out.cooler) clamped.push("cooler");
  if (cooler !== null) out.cooler = cooler;
  const orders = knownList(out.orders, (x) => x.fishId, FISH_BY_ID, 50);
  if (orders !== null && orders !== out.orders) clamped.push("orders");
  if (orders !== null) out.orders = orders;
  const events = knownList(out.events, (x) => x.id, GAME_EVENT_BY_ID, 50);
  if (events !== null && events !== out.events) clamped.push("events");
  if (events !== null) out.events = events;

  // EventDirector is versioned JSON inside the existing save column, so it does
  // not require a schema migration. Normalize its nested state before persisting.
  if (out.eventDirector !== undefined) {
    const rawDirector = out.eventDirector;
    const directorVersion = rawDirector && typeof rawDirector === "object" && !Array.isArray(rawDirector)
      ? (rawDirector as Record<string, unknown>).v
      : undefined;
    if (directorVersion === 1 || directorVersion === 2) {
      const eventT = clamp(out.minutes, MAX.minutes);
      const location = typeof out.location === "string" ? out.location : "bay";
      const seed = ((eventT | 0) ^ (location.length * 0x45d9f3b) ^ 0x9e3779b9) | 0;
      const director = new EventDirector({ seed, catalog: GAME_EVENTS, startT: eventT });
      director.load(rawDirector as DirectorSave);
      const normalized = director.save();
      if (JSON.stringify(rawDirector) !== JSON.stringify(normalized)) clamped.push("eventDirector");
      out.eventDirector = normalized;
    } else {
      delete out.eventDirector;
      clamped.push("eventDirector");
    }
  }

  // ── статистика ──
  const statsRaw = data.stats && typeof data.stats === "object" && !Array.isArray(data.stats) ? (data.stats as Record<string, unknown>) : {};
  const stats: Record<string, unknown> = { ...statsRaw };
  const stat = (key: string, max: number) => {
    const before = stats[key];
    const after = clamp(before, max);
    if (before !== undefined && before !== after) clamped.push(`stats.${key}`);
    stats[key] = after;
  };

  // 1. Наигранное время — от него зависят все остальные пределы.
  const ageCeiling =
    options.accountAgeSeconds === undefined
      ? MAX.playSeconds
      : Math.max(PLAY_SECONDS_FLOOR, Math.floor(options.accountAgeSeconds * PLAY_SECONDS_SLACK) + PLAY_SECONDS_FLOOR);
  stat("playSeconds", Math.min(MAX.playSeconds, ageCeiling));
  const playSeconds = stats.playSeconds as number;

  // 2. Уловы: быстрее одной поклёвки в секунду не бывает — заброс, поклёвка, вываживание.
  stat("totalCaught", MAX.totalCaught);
  if ((stats.totalCaught as number) > playSeconds) {
    stats.totalCaught = playSeconds;
    clamped.push("stats.totalCaught");
  }
  const totalCaught = stats.totalCaught as number;

  // 3. Производные счётчики: ночные и штормовые уловы не могут превышать все уловы.
  stat("nightCatches", totalCaught);
  stat("stormCatches", totalCaught);
  stat("perfectHooks", MAX.totalCaught);
  stat("jumps", MAX.totalCaught);
  stat("releases", MAX.totalCaught);
  stat("linesSnapped", MAX.totalCaught);
  stat("escaped", MAX.totalCaught);
  stat("totalEarned", MAX.totalEarned);
  // Глубже самой глубокой акватории не ловят.
  stat("maxDepthCaught", MAX_DEPTH);

  // 4. Опыт лежит на верхнем уровне сохранения, а не в stats: за поклёвку его
  // ограниченное количество, плюс запас на квесты и находки.
  const xpCeiling = Math.min(MAX.xp, totalCaught * XP_PER_CATCH_MAX + XP_SLACK);
  if (out.xp !== undefined && clamp(out.xp, xpCeiling) !== out.xp) clamped.push("xp");
  out.xp = clamp(out.xp, xpCeiling);

  // самый крупный улов должен быть реально возможен для своего вида
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

  // 5. Достижения пересчитываем по очищенным данным, а не берём из запроса.
  const achievements = earnedAchievements(out as unknown as SaveData);
  out.achievements = achievements;
  // Признаём ограничением только случай, когда заявленное достижение не подтвердилось:
  // пустой список для нового игрока — не ограничение, а норма.
  const claimed = Array.isArray(data.achievements) ? data.achievements.filter((x): x is string => typeof x === "string") : [];
  if (claimed.length && claimed.some((id) => !achievements.includes(id))) clamped.push("achievements");

  return {
    data: out,
    species,
    // Видов не может быть больше, чем уловов: каждый стоит хотя бы одной поклёвки.
    codexCount: Math.min(species, totalCaught),
    unknownSpecies,
    clamped,
    achievements: achievements.length,
  };
}

/** Достижения, которые правда открыты по этому сохранению. */
function earnedAchievements(save: SaveData): string[] {
  const out: string[] = [];
  for (const a of ACHIEVEMENTS) {
    try {
      if (a.check(save)) out.push(a.id);
    } catch {
      // Неполное сохранение не должно ронять запись: считаем достижение незаработанным.
    }
    if (out.length >= MAX.achievements) break;
  }
  return out;
}
