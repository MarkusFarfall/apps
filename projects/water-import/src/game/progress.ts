import { FISH, FISH_TOTAL } from "./fish";
import { BOATS } from "./world";
import type { LocId, SaveData } from "./types";

// ───────────── НАВЫКИ ─────────────
export interface PerkDef { id: string; name: string; icon: string; max: number; group: "craft" | "body" | "sea" | "trade"; desc: (l: number) => string }
export const PERKS: PerkDef[] = [
  { id: "hands", name: "Чуткие руки", icon: "✋", max: 5, group: "craft", desc: (l) => `Окно подсечки +${l * 8}%` },
  { id: "grip", name: "Крепкая хватка", icon: "💪", max: 5, group: "body", desc: (l) => `Удилище выдерживает на ${l * 5}% больше` },
  { id: "patience", name: "Терпение", icon: "⏳", max: 5, group: "craft", desc: (l) => `Поклёвка на ${l * 6}% быстрее` },
  { id: "stamina", name: "Выносливость", icon: "🫀", max: 5, group: "body", desc: (l) => `Рыба устаёт на ${l * 6}% быстрее` },
  { id: "luck", name: "Морская удача", icon: "🍀", max: 5, group: "sea", desc: (l) => `Редкие виды +${l * 7}%, вариации +${l * 10}%` },
  { id: "trader", name: "Торговец", icon: "⚖", max: 5, group: "trade", desc: (l) => `Цена продажи +${l * 4}%` },
  { id: "scout", name: "Кладоискатель", icon: "🧭", max: 4, group: "sea", desc: (l) => `Находки на ${l * 25}% чаще` },
  { id: "cooler", name: "Большой садок", icon: "🧺", max: 3, group: "trade", desc: (l) => `+${l * 2} места в садке` },
  { id: "navigator", name: "Штурман", icon: "", max: 3, group: "sea", desc: (l) => `Переходы быстрее на ${l * 10}%` },
  { id: "weather", name: "Чтение погоды", icon: "", max: 3, group: "sea", desc: (l) => l >= 3 ? "Точный прогноз на две смены погоды вперёд, шторм не усиливает рыбу" : l === 2 ? "Шторм усиливает рыбу вдвое меньше" : "Прогноз погоды точнее" },
];
export const PERK_GROUPS: Record<PerkDef["group"], string> = { craft: "Мастерство", body: "Сила", sea: "Море", trade: "Промысел" };

export const MAX_LEVEL = 60;
/** Суммарный опыт, нужный для перехода с уровня lvl на lvl+1 */
export const xpForLevel = (lvl: number) => Math.round(45 * Math.pow(lvl, 2.25) + 110 * lvl);
export function levelFromXp(xp: number) {
  let l = 1;
  while (l < MAX_LEVEL && xp >= xpForLevel(l)) l++;
  return l;
}
/** Стоимость ранга: n-й ранг стоит n очков */
export const rankCost = (rank: number) => rank;
/** Минимальный уровень игрока для ранга */
export const RANK_LEVEL = [0, 2, 8, 16, 27, 40];
/** Очки навыков: 1 за каждый уровень + 2 за каждый десятый */
export const pointsForLevel = (lvl: number) => (lvl - 1) + Math.floor(lvl / 10) * 2;
export const spentPoints = (perks: Record<string, number>) =>
  Object.values(perks).reduce((a, r) => a + (r * (r + 1)) / 2, 0);
export const perkPoints = (s: SaveData) => Math.max(0, pointsForLevel(levelFromXp(s.xp)) - spentPoints(s.perks));
export const TOTAL_PERK_COST = PERKS.reduce((a, p) => a + (p.max * (p.max + 1)) / 2, 0);

/** Звание по уровню */
export const LEVEL_TITLES: [number, string][] = [
  [1, "Новичок"], [5, "Рыбак"], [10, "Опытный рыбак"], [15, "Промысловик"], [20, "Мастер"], [28, "Мастер снастей"],
  [35, "Старый моряк"], [42, "Морской волк"], [50, "Легенда побережья"], [60, "Хозяин знакомой воды"],
];
export const levelTitle = (lvl: number) => [...LEVEL_TITLES].reverse().find(([l]) => lvl >= l)?.[1] ?? "Новичок";

/** Награда за достижение уровня */
export const levelReward = (lvl: number) => (lvl % 10 === 0 ? lvl * 100 : lvl % 5 === 0 ? lvl * 40 : lvl * 12);

/** Сжатие крупных наград: мелкие почти не меняются, крупные — в разы меньше */
export const compressReward = (r: number) => {
  const v = Math.pow(r, 0.72) * 1.3;
  const step = v < 500 ? 10 : v < 5000 ? 50 : 500;
  return Math.max(50, Math.round(v / step) * step);
};

// ───────────── НАХОДКИ ─────────────
export interface FindDef { id: string; name: string; icon: string; value: number; loc: LocId[]; minDepth: number; weight: number; desc: string }
export const FINDS: FindDef[] = [
  { id: "boot", name: "Старый сапог", icon: "🥾", value: 5, loc: ["bay", "estuary", "cape", "fjord", "skerries"], minDepth: 0, weight: 10, desc: "Левый. Правый, говорят, у соседа." },
  { id: "bottle_rum", name: "Бутылка рома", icon: "🍾", value: 120, loc: ["bay", "reef", "cape"], minDepth: 0, weight: 6, desc: "Запечатана сургучом с якорем. Ром 1890-х." },
  { id: "anchor", name: "Ржавый якорь", icon: "⚓", value: 180, loc: ["bay", "cape", "fjord"], minDepth: 5, weight: 5, desc: "Небольшой якорь рыбацкой шхуны." },
  { id: "compass", name: "Компас капитана", icon: "🧭", value: 450, loc: ["cape", "fjord", "ocean", "kelp", "antarctic"], minDepth: 10, weight: 3, desc: "Латунь позеленела, но стрелка всё ещё ищет север." },
  { id: "amphora", name: "Амфора", icon: "🏺", value: 900, loc: ["bay", "reef"], minDepth: 10, weight: 2.5, desc: "Греческая амфора для вина. Ей больше двух тысяч лет." },
  { id: "amber", name: "Кусок янтаря", icon: "🟠", value: 600, loc: ["skerries", "fjord", "bay"], minDepth: 0, weight: 3, desc: "Внутри — застывший комар из эпохи динозавров." },
  { id: "pearl", name: "Чёрная жемчужина", icon: "⚫", value: 1800, loc: ["reef", "mangrove"], minDepth: 5, weight: 1.5, desc: "Идеально круглая, с зелёным отливом." },
  { id: "doubloon", name: "Дублон", icon: "🪙", value: 1500, loc: ["reef", "ocean"], minDepth: 15, weight: 2, desc: "Испанское золото с «Санта-Люсии»." },
  { id: "locket", name: "Медальон", icon: "📿", value: 1100, loc: ["cape", "fjord", "bay"], minDepth: 8, weight: 1.5, desc: "Внутри выцветший портрет и надпись: «Вернись»." },
  { id: "watch", name: "Карманные часы", icon: "⌚", value: 1300, loc: ["ocean", "fjord"], minDepth: 30, weight: 1.5, desc: "Остановились в 4:17. Кто-то ждал рассвета." },
  { id: "nautilus", name: "Раковина наутилуса", icon: "🐚", value: 2400, loc: ["ocean", "abyss", "reef"], minDepth: 100, weight: 1.2, desc: "Золотое сечение, выточенное морем." },
  { id: "meteorite", name: "Метеорит", icon: "☄", value: 7000, loc: ["abyss"], minDepth: 800, weight: 0.8, desc: "Железо-никелевый. Упал в океан задолго до людей." },
  { id: "chest", name: "Сундук контрабандиста", icon: "🧰", value: 5000, loc: ["reef", "ocean", "cape"], minDepth: 20, weight: 0.7, desc: "Внутри — серебро и карта, которую уже не прочесть." },
  { id: "coin_cossack", name: "Казацкая монета", icon: "", value: 800, loc: ["estuary"], minDepth: 3, weight: 2, desc: "Серебряный полтинник XVIII века. Лиман помнит чумацкие обозы и казачьи чайки." },
  { id: "obsidian", name: "Обсидиановое лезвие", icon: "", value: 2200, loc: ["volcano"], minDepth: 20, weight: 1.5, desc: "Вулканическое стекло, сколотое древней рукой. Острее хирургической стали." },
  { id: "whale_bone", name: "Китовый ус", icon: "", value: 1600, loc: ["antarctic", "kelp"], minDepth: 50, weight: 1.2, desc: "Пластина китового уса с резьбой — работа китобоя, коротавшего полярную ночь." },
  { id: "sextant", name: "Секстант", icon: "", value: 3200, loc: ["antarctic", "skerries", "ocean"], minDepth: 40, weight: 0.8, desc: "Латунный секстант с гравировкой экспедиционного судна. Зеркала целы." },
  { id: "idol", name: "Идол глубин", icon: "🗿", value: 12000, loc: ["abyss"], minDepth: 1500, weight: 0.4, desc: "Камень, которого нет ни в одном каталоге. Тёплый на ощупь." },
  { id: "star_stone", name: "Звёздный камень", icon: "✨", value: 0, loc: ["bay", "estuary", "cape", "skerries", "fjord", "kelp", "reef", "mangrove", "ocean", "volcano", "abyss", "antarctic"], minDepth: 0, weight: 0, desc: "Тёплый камень, мерцающий изнутри. Похоже, он упал с неба." },
  { id: "old_compass", name: "Старинный компас", icon: "🧭", value: 0, loc: ["bay", "estuary", "cape", "skerries", "fjord", "kelp", "reef", "mangrove", "ocean", "volcano", "abyss", "antarctic"], minDepth: 0, weight: 0, desc: "Латунный компас с потемневшей стрелкой и судовым журналом." },
];
export const FIND_BY_ID = Object.fromEntries(FINDS.map((f) => [f.id, f])) as Record<string, FindDef>;

// ───────────── ДОСТИЖЕНИЯ ─────────────
const LEGENDS = FISH.filter((f) => f.rarity === "legendary").map((f) => f.id);
const locFish = (l: LocId) => FISH.filter((f) => f.loc[0] === l).map((f) => f.id);
const has = (s: SaveData, ids: string[]) => ids.every((id) => s.codex[id]);
const variants = (s: SaveData) => new Set(Object.values(s.codex).flatMap((c) => c.variants));

export interface AchDef { id: string; name: string; icon: string; desc: string; reward: number; check: (s: SaveData) => boolean }
export const ACHIEVEMENTS: AchDef[] = [
  { id: "first", name: "Первая рыба", icon: "🐟", desc: "Поймать первую рыбу", reward: 50, check: (s) => s.stats.totalCaught >= 1 },
  { id: "c100", name: "Сотня", icon: "💯", desc: "Поймать 100 рыб", reward: 1000, check: (s) => s.stats.totalCaught >= 100 },
  { id: "c500", name: "Промысловик", icon: "🎣", desc: "Поймать 500 рыб", reward: 6000, check: (s) => s.stats.totalCaught >= 500 },
  { id: "c2000", name: "Морской волк", icon: "🐺", desc: "Поймать 2000 рыб", reward: 30000, check: (s) => s.stats.totalCaught >= 2000 },
  { id: "all_bay", name: "Сын бухты", icon: "🏠", desc: "Все виды Тихой бухты", reward: 1500, check: (s) => has(s, locFish("bay")) },
  { id: "all_cape", name: "Смотритель маяка", icon: "🗼", desc: "Все виды Скалистого мыса", reward: 4000, check: (s) => has(s, locFish("cape")) },
  { id: "all_fjord", name: "Викинг", icon: "🪓", desc: "Все виды Северного фьорда", reward: 9000, check: (s) => has(s, locFish("fjord")) },
  { id: "all_reef", name: "Друг кораллов", icon: "🪸", desc: "Все виды Кораллового рифа", reward: 9000, check: (s) => has(s, locFish("reef")) },
  { id: "all_ocean", name: "Старик и море", icon: "🌊", desc: "Все виды Открытого моря", reward: 20000, check: (s) => has(s, locFish("ocean")) },
  { id: "all_abyss", name: "Взгляд в бездну", icon: "🕳", desc: "Все виды Бездны", reward: 40000, check: (s) => has(s, locFish("abyss")) },
  { id: "all_estuary", name: "Степняк", icon: "", desc: "Все виды Лимана", reward: 2500, check: (s) => has(s, locFish("estuary")) },
  { id: "all_skerries", name: "Островитянин", icon: "", desc: "Все виды Шхер", reward: 5000, check: (s) => has(s, locFish("skerries")) },
  { id: "all_kelp", name: "Лесник", icon: "", desc: "Все виды Туманного берега", reward: 10000, check: (s) => has(s, locFish("kelp")) },
  { id: "all_mangrove", name: "Следопыт проток", icon: "", desc: "Все виды Мангровых проток", reward: 10000, check: (s) => has(s, locFish("mangrove")) },
  { id: "all_volcano", name: "Дитя огня", icon: "", desc: "Все виды Вулканического архипелага", reward: 22000, check: (s) => has(s, locFish("volcano")) },
  { id: "all_antarctic", name: "Полярник", icon: "", desc: "Все виды Ледяного шельфа", reward: 45000, check: (s) => has(s, locFish("antarctic")) },
  { id: "explorer", name: "Все моря", icon: "", desc: "Побывать во всех 12 акваториях", reward: 20000, check: (s) => ["bay", "estuary", "cape", "skerries", "fjord", "kelp", "reef", "mangrove", "ocean", "volcano", "abyss", "antarctic"].every((l) => s.flags.includes(`visit_${l}`)) },
  { id: "legend1", name: "Легенда", icon: "⭐", desc: "Поймать легендарную рыбу", reward: 2000, check: (s) => LEGENDS.some((id) => s.codex[id]) },
  { id: "legends", name: "Собиратель легенд", icon: "🌟", desc: `Поймать все ${LEGENDS.length} легенд`, reward: 60000, check: (s) => has(s, LEGENDS) },
  { id: "golden", name: "Золотая рыбка", icon: "✨", desc: "Поймать золотую вариацию", reward: 3000, check: (s) => variants(s).has("golden") },
  { id: "albino", name: "Белая ворона", icon: "🤍", desc: "Поймать альбиноса", reward: 1500, check: (s) => variants(s).has("albino") },
  { id: "allvar", name: "Коллекционер", icon: "🎨", desc: "Все 5 вариаций", reward: 12000, check: (s) => variants(s).size >= 5 },
  { id: "perfect", name: "Снайпер", icon: "🎯", desc: "25 идеальных подсечек", reward: 2500, check: (s) => s.stats.perfectHooks >= 25 },
  { id: "storm", name: "Буревестник", icon: "⛈", desc: "Поймать 10 рыб в шторм", reward: 2000, check: (s) => s.stats.stormCatches >= 10 },
  { id: "night", name: "Ночная смена", icon: "🌙", desc: "Поймать 50 рыб ночью", reward: 2500, check: (s) => s.stats.nightCatches >= 50 },
  { id: "jumps", name: "Акробат", icon: "🤸", desc: "Удержать 30 прыжков", reward: 2500, check: (s) => s.stats.jumps >= 30 },
  { id: "release", name: "Милосердие", icon: "🕊", desc: "Отпустить 25 рыб", reward: 1500, check: (s) => s.stats.releases >= 25 },
  { id: "rich", name: "Капиталист", icon: "💰", desc: "Заработать 100 000 ₽", reward: 5000, check: (s) => s.stats.totalEarned >= 100000 },
  { id: "million", name: "Миллионер", icon: "🏦", desc: "Заработать 1 000 000 ₽", reward: 50000, check: (s) => s.stats.totalEarned >= 1000000 },
  { id: "orders10", name: "Надёжный поставщик", icon: "📋", desc: "Выполнить 10 заказов", reward: 3000, check: (s) => s.ordersDone >= 10 },
  { id: "orders50", name: "Рыбная монополия", icon: "🏭", desc: "Выполнить 50 заказов", reward: 20000, check: (s) => s.ordersDone >= 50 },
  { id: "finds", name: "Кладоискатель", icon: "🗝", desc: "Собрать все находки", reward: 25000, check: (s) => FINDS.every((f) => s.finds[f.id]) },
  { id: "deep", name: "Километр под килем", icon: "📏", desc: "Поймать рыбу глубже 1000 м", reward: 8000, check: (s) => s.stats.maxDepthCaught >= 1000 },
  { id: "heavy", name: "Тяжеловес", icon: "🏋", desc: "Рыба тяжелее 300 кг", reward: 10000, check: (s) => (s.stats.biggest?.weight ?? 0) >= 300 },
  { id: "lvl20", name: "Мастер", icon: "🎖", desc: "Достичь 20 уровня", reward: 15000, check: (s) => levelFromXp(s.xp) >= 20 },
  { id: "lvl40", name: "Морской волк", icon: "", desc: "Достичь 40 уровня", reward: 60000, check: (s) => levelFromXp(s.xp) >= 40 },
  { id: "lvl60", name: "Хозяин знакомой воды", icon: "", desc: "Достичь 60 уровня", reward: 250000, check: (s) => levelFromXp(s.xp) >= 60 },
  { id: "ports", name: "Во всех портах", icon: "", desc: "Открыть все пять портов", reward: 6000, check: (s) => (s.portsKnown?.length ?? 1) >= 5 },
  { id: "c250", name: "Натуралист", icon: "", desc: "Открыть 200 видов", reward: 12000, check: (s) => Object.keys(s.codex).length >= 200 },
  { id: "rare30", name: "Охотник за редкостями", icon: "", desc: "Поймать 30 редких видов и выше", reward: 4000, check: (s) => Object.keys(s.codex).filter((id) => { const r = FISH.find((f) => f.id === id)?.rarity; return r === "rare" || r === "epic" || r === "legendary"; }).length >= 30 },
  { id: "epic15", name: "Исключительный улов", icon: "", desc: "Поймать 15 исключительных видов", reward: 6000, check: (s) => Object.keys(s.codex).filter((id) => FISH.find((f) => f.id === id)?.rarity === "epic").length >= 15 },
  { id: "unlock_all", name: "Картограф", icon: "", desc: "Разведать все 12 акваторий", reward: 8000, check: (s) => (s.unlocked?.length ?? 1) >= 12 },
  { id: "fleet", name: "Флотилия", icon: "", desc: "Владеть пятью судами", reward: 20000, check: (s) => (s.boatsOwned?.length ?? 1) >= 5 },
  { id: "allboats", name: "Адмиралтейство", icon: "", desc: "Владеть всеми судами", reward: 120000, check: (s) => (s.boatsOwned?.length ?? 1) >= 9 },
];

// ───────────── СЮЖЕТ: ПИСЬМА ОТЦА ─────────────
export interface QuestDef {
  id: string;
  title: string;
  goal: string;
  letter: string;
  reward: number;
  progress: (s: SaveData) => [number, number];
}
const cnt = (s: SaveData) => Object.keys(s.codex).length;
const hasBoat = (s: SaveData, id: string) => (s.boatsOwned ?? [s.boat]).some((i) => BOATS[i]?.id === id);
const b = (v: boolean): [number, number] => [v ? 1 : 0, 1];
const visited = (s: SaveData, l: string) => s.flags.includes(`visit_${l}`);

export const QUESTS: QuestDef[] = [
  { id: "q1", title: "Первый заброс", goal: "Поймай 3 рыбы", reward: 100, progress: (s) => [Math.min(3, s.stats.totalCaught), 3],
    letter: "Сынок. Если ты читаешь это — значит, лодка теперь твоя. Не торопись. Начни у старого пирса: бычки там глупые, а ставрида честная. Поймай несколько — и руки вспомнят." },
  { id: "q2", title: "Знакомая вода", goal: "Открой 5 видов в кодексе", reward: 150, progress: (s) => [Math.min(5, cnt(s)), 5],
    letter: "Я вёл кодекс сорок лет и так и не заполнил. Каждая рыба приходит в своё время — в свою погоду, на свою глубину. Меняй глубину. Меняй наживку. Смотри на небо." },
  { id: "q3", title: "Серебро отмели", goal: "Поймай ставриду", reward: 200, progress: (s) => b(!!s.codex.horse_mackerel),
    letter: "На Песчаной отмели днём ходит ставрида. Креветка — её слабость. Твоя мама жарила её с лимоном, помнишь?" },
  { id: "q4", title: "Первые деньги", goal: "Заработай на рынке 500 ₽", reward: 150, progress: (s) => [Math.min(500, s.stats.totalEarned), 500],
    letter: "Рыба кормит, но только если её продать вовремя. Следи за «рыбой дня» — Матвей на рынке платит за неё вдвое." },
  { id: "q5", title: "Мотор", goal: "Купи моторку «Чайка»", reward: 300, progress: (s) => b(hasBoat(s, "dinghy")),
    letter: "Вёсла — это хорошо для души, но плохо для спины. На верфи стоит «Чайка». Я присматривал её для тебя." },
  { id: "q6", title: "Под маяком", goal: "Доберись до Скалистого мыса", reward: 250, progress: (s) => b(visited(s, "cape")),
    letter: "За мысом течения приносят крупную рыбу. Смотритель маяка — мой старый друг. Передай ему привет... если он ещё там." },
  { id: "q7", title: "Алый окунь", goal: "Поймай морского окуня", reward: 400, progress: (s) => b(!!s.codex.sea_bass),
    letter: "Морской окунь живёт больше ста лет. Может, тот, что клюнет у тебя, помнит и меня." },
  { id: "q8", title: "Люди ждут", goal: "Выполни 3 заказа", reward: 500, progress: (s) => [Math.min(3, s.ordersDone), 3],
    letter: "В порту всегда кто-то ищет особую рыбу. Заказы платят лучше рынка — и люди запоминают, кто их не подвёл." },
  { id: "q9", title: "Глаза под водой", goal: "Купи эхолот", reward: 300, progress: (s) => b(s.sonar >= 1),
    letter: "Я не верил в эти коробочки. Зря. Эхолот видит то, что я чувствовал только на третьем десятке лет." },
  { id: "q10", title: "«Норд»", goal: "Купи катер «Норд»", reward: 1200, progress: (s) => b(hasBoat(s, "cutter")),
    letter: "Катер с печкой. На нём можно дойти и до фьордов, и до тёплых островов. Там — другое море." },
  { id: "q11", title: "Север и юг", goal: "Побывай во фьорде и на рифе", reward: 1500, progress: (s) => [(visited(s, "fjord") ? 1 : 0) + (visited(s, "reef") ? 1 : 0), 2],
    letter: "Во фьорде вода чёрная и тихая, на рифе — как стекло. Я был там молодым. Посмотри на оба моря." },
  { id: "q12", title: "Двадцать имён", goal: "Открой 20 видов", reward: 2000, progress: (s) => [Math.min(20, cnt(s)), 20],
    letter: "Двадцать видов. Я в твои годы знал меньше. Горжусь." },
  { id: "q13", title: "Хозяин бухты", goal: "Поймай Хозяина бухты", reward: 3500, progress: (s) => b(!!s.codex.bay_master),
    letter: "Я видел его трижды. Лобан со шрамом через всю спину. Дождь, сумерки, живец у каменной гряды. Он ждёт тебя." },
  { id: "q14", title: "Настоящее судно", goal: "Купи сейнер «Старик»", reward: 4000, progress: (s) => b(hasBoat(s, "trawler")),
    letter: "Сейнер не боится шторма. А в шторм, сынок, выходит то, что в штиль прячется на дне." },
  { id: "q15", title: "Синяя вода", goal: "Поймай желтопёрого тунца", reward: 4000, progress: (s) => b(!!s.codex.yellowfin),
    letter: "В открытом море нет берега. Только ты и горизонт. Тунцы кружат над подводной горой — ищи чаек." },
  { id: "q16", title: "Половина пути", goal: "Открой 125 видов", reward: 12000, progress: (s) => [Math.min(125, cnt(s)), 125],
    letter: "Сто двадцать пять видов — половина всего, что водится в этих морях. Мой кодекс остановился на сорока двух. Дальше пиши сам." },
  { id: "q17", title: "Глубинник", goal: "Купи НИС «Глубинник»", reward: 10000, progress: (s) => b(hasBoat(s, "deepsea")),
    letter: "Есть место, куда я так и не дошёл. Над жёлобом. Говорят, там небо кажется ниже." },
  { id: "q18", title: "Километр", goal: "Поймай рыбу глубже 1000 м", reward: 12000, progress: (s) => [Math.min(1000, Math.round(s.stats.maxDepthCaught)), 1000],
    letter: "На такой глубине света нет вовсе. Рыбы делают его сами. Возьми светящуюся приманку." },
  { id: "q19", title: "Тот, что внизу", goal: "Поймай того, что внизу", reward: 50000, progress: (s) => b(!!s.codex.leviathan),
    letter: "Штормовая ночь. Самая глубокая точка. Самая яркая приманка. Я не знаю, что там. Но если кто и узнает — то ты." },
  { id: "q20", title: "Хранитель", goal: `Заполни кодекс: ${FISH_TOTAL} видов`, reward: 150000, progress: (s) => [cnt(s), FISH_TOTAL],
    letter: "Последнее письмо. Кодекс полон — и это не конец. Море никогда не повторяется. Возвращайся к знакомой воде. Твой отец." },
];

for (const a of ACHIEVEMENTS) a.reward = compressReward(a.reward);
for (const q of QUESTS) q.reward = compressReward(q.reward);
