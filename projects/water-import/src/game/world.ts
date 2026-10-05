import { FISH } from "./fish";
import type { BaitDef, BaitId, BoatDef, GearLevel, LocId, LocationDef, PortDef, PortId, Season, SpotDef, WeatherId } from "./types";

export const LOCATIONS: LocationDef[] = [
  { id: "bay", name: "Тихая бухта", desc: "Родная гавань: маяк на холме, посёлок и запах водорослей. Здесь всё начинается.", boatTier: 0, maxDepth: 18, travelHours: 0.5, land: "bay", climate: "temperate", seabed: "sand", clarity: 0.6, waveMult: 0.6, water: { surface: "#5fb3b8", shallow: "#2f8f9a", mid: "#1c5f78", deep: "#0f3450" }, bed: "#b8a57a" },
  { id: "estuary", name: "Лиман", desc: "Устье степной реки: камыш до горизонта, рыбачьи мостки и мутная солоноватая вода.", boatTier: 0, maxDepth: 12, travelHours: 1, land: "estuary", climate: "temperate", seabed: "silt", clarity: 0.28, waveMult: 0.4, water: { surface: "#7a9a78", shallow: "#5a7a58", mid: "#3a5440", deep: "#1e2e22" }, bed: "#6a5e44" },
  { id: "cape", name: "Скалистый мыс", desc: "Отвесные скалы, старый маяк и течения, что приносят крупную рыбу.", boatTier: 1, maxDepth: 45, travelHours: 1.5, land: "cliffs", climate: "temperate", seabed: "rock", clarity: 0.55, waveMult: 1.0, water: { surface: "#4a98a8", shallow: "#237888", mid: "#154e6a", deep: "#0a2a42" }, bed: "#6a6258" },
  { id: "skerries", name: "Шхеры", desc: "Тысячи гранитных островков, сосны и красные домики. Солоноватое северное море.", boatTier: 1, maxDepth: 70, travelHours: 2, land: "skerries", climate: "north", seabed: "granite", clarity: 0.5, waveMult: 0.55, water: { surface: "#4e7e8c", shallow: "#2e5e6c", mid: "#1a3e4e", deep: "#0a1e2a" }, bed: "#7a6e66" },
  { id: "fjord", name: "Северный фьорд", desc: "Холодная тёмная вода между гор. Глубины хранят великанов севера.", boatTier: 2, maxDepth: 160, travelHours: 3, land: "fjord", climate: "north", seabed: "kelp", clarity: 0.45, waveMult: 0.7, water: { surface: "#3e7a8a", shallow: "#1e5a6e", mid: "#10384e", deep: "#061a2a" }, bed: "#4a4a44" },
  { id: "kelp", name: "Туманный берег", desc: "Скалы в кипарисах, вечный туман и подводный лес гигантских водорослей над каньоном.", boatTier: 2, maxDepth: 140, travelHours: 3.5, land: "kelpcoast", climate: "misty", seabed: "kelpforest", clarity: 0.62, waveMult: 1.1, water: { surface: "#3e8a86", shallow: "#1e6a68", mid: "#12404c", deep: "#06202c" }, bed: "#5a5040" },
  { id: "reef", name: "Коралловый риф", desc: "Бирюзовая лагуна у пальмового острова. Каждая рыба — как драгоценность.", boatTier: 2, maxDepth: 60, travelHours: 4, land: "reef", climate: "tropic", seabed: "coral", clarity: 1, waveMult: 0.8, water: { surface: "#48d0d0", shallow: "#1ab0c0", mid: "#1070a0", deep: "#083a68" }, bed: "#e8d8b0" },
  { id: "mangrove", name: "Мангровые протоки", desc: "Тёплые протоки среди деревьев на корнях-ходулях. Жара, цапли и рыба, которая ходит по илу.", boatTier: 2, maxDepth: 16, travelHours: 4.5, land: "mangrove", climate: "tropic", seabed: "roots", clarity: 0.4, waveMult: 0.35, water: { surface: "#5a9a88", shallow: "#3a7a68", mid: "#28584a", deep: "#12302a" }, bed: "#7a6a4a" },
  { id: "ocean", name: "Открытое море", desc: "Ни берега, ни ориентиров. Только горизонт и гиганты под килем.", boatTier: 3, maxDepth: 420, travelHours: 6, land: "open", climate: "ocean", seabed: "mud", clarity: 0.85, waveMult: 1.6, water: { surface: "#2a78b0", shallow: "#1a5a98", mid: "#0e3670", deep: "#041640" }, bed: "#3a3a40" },
  { id: "volcano", name: "Вулканический архипелаг", desc: "Дымящийся конус над чёрными пляжами. Склоны уходят в синеву на сотни метров.", boatTier: 3, maxDepth: 520, travelHours: 7, land: "volcano", climate: "tropic", seabed: "basalt", clarity: 0.9, waveMult: 1.3, water: { surface: "#2a86b8", shallow: "#1a66a0", mid: "#0c3c74", deep: "#031a44" }, bed: "#2a2626" },
  { id: "abyss", name: "Бездна", desc: "Над Марианским жёлобом небо кажется ниже. Внизу — два километра тьмы.", boatTier: 4, maxDepth: 2000, travelHours: 9, land: "abyss", climate: "ocean", seabed: "vents", clarity: 0.7, waveMult: 1.4, water: { surface: "#1e5a88", shallow: "#10406e", mid: "#082448", deep: "#01060e" }, bed: "#1a1618" },
  { id: "antarctic", name: "Ледяной шельф", desc: "Стена древнего льда, айсберги и полярное сияние. Рыба с прозрачной кровью живёт подо льдом.", boatTier: 4, maxDepth: 1200, travelHours: 11, land: "ice", climate: "polar", seabed: "polar", clarity: 0.95, waveMult: 0.9, water: { surface: "#3e7e96", shallow: "#1e5e7a", mid: "#0e3a56", deep: "#031626" }, bed: "#5a5a5e" },
];

export const LOC_BY_ID = Object.fromEntries(LOCATIONS.map((l) => [l.id, l])) as Record<LocId, LocationDef>;

export const BOATS: BoatDef[] = [
  { id: "rowboat", name: "Плоскодонка «Утро»", tier: 0, style: "row", price: 0, cooler: 10, stormSafe: false, travelMult: 1.4, stability: 0.2, quiet: 1.05, rareBonus: 0, baitWell: 0, fuel: 0, desc: "Отцовская деревянная лодка. Вёсла скрипят, но держат.", special: "Семейная реликвия", hull: "#7a5230", trim: "#d8c090" },
  { id: "kayak", name: "Каяк «Тишина»", tier: 0, style: "kayak", price: 1200, cooler: 7, stormSafe: false, travelMult: 1.25, stability: 0.1, quiet: 1.3, rareBonus: 0.05, baitWell: 0, fuel: 0, desc: "Узкий морской каяк. Бесшумно подходит к самой пугливой рыбе.", special: "Без топлива, поклёвка на 30% быстрее", hull: "#c8742e", trim: "#2a2a2a" },
  { id: "dinghy", name: "Моторка «Чайка»", tier: 1, style: "dinghy", price: 2500, cooler: 16, stormSafe: false, travelMult: 1.0, stability: 0.3, quiet: 0.95, rareBonus: 0, baitWell: 0, fuel: 30, desc: "Лёгкая шлюпка с подвесным мотором. Доберётся до мыса и шхер.", special: "Быстрая и дешёвая", hull: "#e8e4dc", trim: "#c84030" },
  { id: "barkas", name: "Баркас «Помор»", tier: 1, style: "barkas", price: 9000, cooler: 26, stormSafe: false, travelMult: 1.15, stability: 0.55, quiet: 1.0, rareBonus: 0, baitWell: 1, fuel: 55, desc: "Широкий поморский баркас с каютой-кубриком и живорыбным колодцем.", special: "Колодец: живец расходуется вдвое реже", hull: "#5a4a3a", trim: "#b8a078" },
  { id: "cutter", name: "Катер «Норд»", tier: 2, style: "cutter", price: 22000, cooler: 24, stormSafe: false, travelMult: 0.8, stability: 0.5, quiet: 0.95, rareBonus: 0, baitWell: 0, fuel: 110, desc: "Закрытая рубка и печка. Фьорды, туманный берег и тропики теперь рядом.", special: "Надёжная рабочая лошадка", hull: "#2a5a7a", trim: "#f0ece0" },
  { id: "yacht", name: "Яхта «Альбатрос»", tier: 2, style: "yacht", price: 58000, cooler: 18, stormSafe: false, travelMult: 0.62, stability: 0.6, quiet: 1.2, rareBonus: 0.08, baitWell: 0, fuel: 10, desc: "Парусная яхта. Идёт под ветром без шума мотора, быстрее всех своего класса.", special: "Под парусом: почти без топлива, +8% к редким", hull: "#f2f0ea", trim: "#1a3a6a" },
  { id: "trawler", name: "Сейнер «Старик»", tier: 3, style: "seiner", price: 120000, cooler: 40, stormSafe: true, travelMult: 0.7, stability: 0.85, quiet: 0.9, rareBonus: 0, baitWell: 1, fuel: 210, desc: "Настоящее рыболовное судно. Не боится шторма и открытого моря.", special: "Штормовое, с живорыбным колодцем", hull: "#3a3a3a", trim: "#d8a030" },
  { id: "polar", name: "Траулер «Полярник»", tier: 3, style: "trawler", price: 240000, cooler: 64, stormSafe: true, travelMult: 0.78, stability: 0.95, quiet: 0.85, rareBonus: 0.03, baitWell: 2, fuel: 300, desc: "Ледового класса, с А-рамой и огромным трюмом. Для долгих экспедиций.", special: "Крупнейший трюм, почти не качает", hull: "#b8322a", trim: "#f0ece4" },
  { id: "deepsea", name: "НИС «Глубинник»", tier: 4, style: "research", price: 450000, cooler: 52, stormSafe: true, travelMult: 0.6, stability: 0.9, quiet: 1.0, rareBonus: 0.12, baitWell: 2, fuel: 420, desc: "Исследовательское судно с глубоководной лебёдкой. Бездна и ледяной шельф ждут.", special: "Лаборатория: +12% к редким видам", hull: "#e87a20", trim: "#f4f4f4" },
];
export const BOAT_BY_ID = Object.fromEntries(BOATS.map((b) => [b.id, b])) as Record<string, BoatDef>;
/** Индексы судов прежних версий сохранений */
export const LEGACY_BOAT_IDS = ["rowboat", "dinghy", "cutter", "trawler", "deepsea"];
export const minBoatOfTier = (tier: number) => BOATS.findIndex((b) => b.tier === tier);

export const RODS: GearLevel[] = [
  { name: "Бамбуковое удилище", price: 0, value: 10, desc: "Выдерживает рыбу до ~10 кг рывка" },
  { name: "Стеклопластик «Бриз»", price: 600, value: 18, desc: "Надёжное удилище на окуня и треску" },
  { name: "Карбон «Прибой»", price: 3500, value: 30, desc: "Лёгкий и сильный бланк" },
  { name: "Морской «Шторм»", price: 15000, value: 48, desc: "Для палтуса и групера" },
  { name: "Троллинг «Посейдон»", price: 55000, value: 75, desc: "Против марлина и акул" },
  { name: "Титан «Левиафан»", price: 160000, value: 120, desc: "Для того, что внизу" },
];

export const REELS: GearLevel[] = [
  { name: "Инерционная катушка", price: 0, value: 1, desc: "Медленная подмотка" },
  { name: "Безынерционная 3000", price: 450, value: 1.4, desc: "Плавный ход" },
  { name: "Мультипликатор «Кит»", price: 2800, value: 1.9, desc: "Мощная подмотка" },
  { name: "Морская 8000", price: 12000, value: 2.5, desc: "Фрикцион держит тунца" },
  { name: "Электрокатушка «Прилив»", price: 45000, value: 3.3, desc: "Мотор помогает в бою" },
  { name: "Лебёдка «Бездна»", price: 130000, value: 4.4, desc: "Поднимет с двух километров" },
];

export const LINES: GearLevel[] = [
  { name: "Леска 20 м", price: 0, value: 20, desc: "Хватит для бухты" },
  { name: "Леска 50 м", price: 700, value: 50, desc: "До дна у мыса" },
  { name: "Шнур 160 м", price: 4500, value: 160, desc: "Глубины фьорда" },
  { name: "Шнур 420 м", price: 19000, value: 420, desc: "Сумерки океана" },
  { name: "Трос 1000 м", price: 65000, value: 1000, desc: "Полуночная зона" },
  { name: "Кевлар 2000 м", price: 180000, value: 2000, desc: "До самого дна Бездны" },
];

export const BAITS: BaitDef[] = [
  { id: "worm", name: "Червь", price: 0, pack: 0, kind: "natural", size: -0.6, bite: 1, durable: 0, depth: [0, 60], rarity: 0.9, desc: "Бесконечный запас из банки. Мирная и донная рыба мелководья.", color: "#c87a6a" },
  { id: "mussel", name: "Мидия", price: 45, pack: 10, kind: "natural", size: -0.2, bite: 1.1, durable: 0.15, depth: [0, 140], rarity: 1, mimics: ["worm", "shrimp"], desc: "Раскрытая мидия пахнет на всю округу. Спары, губаны, треска.", color: "#3a3e58" },
  { id: "shrimp", name: "Креветка", price: 60, pack: 10, kind: "natural", size: -0.3, bite: 1.15, durable: 0.1, depth: [0, 500], rarity: 1, desc: "Универсальная морская наживка. Берут почти все.", color: "#f0a080" },
  { id: "spoon", name: "Блесна", price: 180, pack: 5, kind: "lure", size: 0.1, bite: 0.95, durable: 0.85, depth: [0, 40], rarity: 1, desc: "Колеблющаяся блесна. Служит долго, теряется при обрыве. Быстрые хищники верхних слоёв.", color: "#d8d8e0" },
  { id: "livebait", name: "Живец", price: 240, pack: 10, kind: "natural", size: 0.5, bite: 1, durable: 0.05, depth: [0, 300], rarity: 1.1, desc: "Живая рыбка для крупных хищников. Отсекает мелочь.", color: "#80a0b0" },
  { id: "cutbait", name: "Нарезка сельди", price: 300, pack: 10, kind: "natural", size: 0.6, bite: 1.25, durable: 0.1, depth: [20, 900], rarity: 1, mimics: ["livebait", "squid"], desc: "Жирная нарезка оставляет пахучий след. Акулы, треска, глубинные хищники.", color: "#b8a8a0" },
  { id: "wobbler", name: "Воблер", price: 650, pack: 3, kind: "lure", size: 0.4, bite: 0.9, durable: 0.78, depth: [0, 30], rarity: 1.1, desc: "Троллинговый воблер с лопаткой. Тунцы, лососи, марлины у поверхности.", color: "#f0c040" },
  { id: "jig", name: "Джиг", price: 480, pack: 4, kind: "lure", size: 0.2, bite: 1, durable: 0.8, depth: [30, 1300], rarity: 1, mimics: ["spoon", "shrimp"], desc: "Тяжёлая джиг-головка с силиконом. Для ловли у дна на глубине.", color: "#6a9a5a" },
  { id: "squid", name: "Кальмар", price: 700, pack: 10, kind: "natural", size: 0.8, bite: 1, durable: 0.05, depth: [20, 2000], rarity: 1.2, desc: "Для глубоководных гигантов и акул. Только крупная рыба.", color: "#e8c8d8" },
  { id: "glow", name: "Светящаяся приманка", price: 1600, pack: 6, kind: "special", size: 0.3, bite: 1.1, durable: 0.6, depth: [150, 2000], rarity: 1.3, desc: "Хемолюминесцентная капсула. В полной темноте незаменима.", color: "#60ffd0" },
];

export const BAIT_BY_ID = Object.fromEntries(BAITS.map((b) => [b.id, b])) as Record<BaitId, BaitDef>;

export const SEASONS = ["Весна", "Лето", "Осень", "Зима"] as const;
export const DAYS_PER_SEASON = 7;
export const MIN_PER_DAY = 1440;

export const WEATHER_INFO: Record<WeatherId, { name: string; icon: string; bite: number; wave: number; desc: string }> = {
  clear: { name: "Ясно", icon: "☀", bite: 0.9, wave: 0.6, desc: "Прозрачная вода, рыба осторожна" },
  cloudy: { name: "Облачно", icon: "☁", bite: 1.1, wave: 0.8, desc: "Рыба смелее в полутени" },
  rain: { name: "Дождь", icon: "🌧", bite: 1.35, wave: 1.1, desc: "Дождь сбивает кислород — клёв оживает" },
  storm: { name: "Шторм", icon: "⛈", bite: 1.6, wave: 2.4, desc: "Опасно! Рыба бешеная, снасти страдают" },
  fog: { name: "Туман", icon: "🌫", bite: 1.2, wave: 0.4, desc: "Из тумана приходят странные рыбы" },
  snow: { name: "Снег", icon: "❄", bite: 1.0, wave: 0.7, desc: "Холодная тишина севера" },
};

type Row = Partial<Record<WeatherId, number>>;
// Марковская матрица переходов погоды по сезонам
const BASE: Record<Season, Record<WeatherId, Row>> = {
  0: {
    clear: { clear: 4, cloudy: 3, fog: 2, rain: 1 },
    cloudy: { clear: 2, cloudy: 3, rain: 3, fog: 1, storm: 0.5 },
    rain: { cloudy: 3, rain: 2, storm: 0.8, clear: 1 },
    storm: { rain: 3, cloudy: 2 },
    fog: { clear: 2, cloudy: 2, fog: 2 },
    snow: { cloudy: 3, rain: 2 },
  },
  1: {
    clear: { clear: 6, cloudy: 2, storm: 0.3 },
    cloudy: { clear: 3, cloudy: 2, rain: 2, storm: 0.8 },
    rain: { clear: 2, cloudy: 2, rain: 1, storm: 1 },
    storm: { rain: 2, cloudy: 2, clear: 1 },
    fog: { clear: 3, cloudy: 1 },
    snow: { clear: 3 },
  },
  2: {
    clear: { clear: 3, cloudy: 3, fog: 2 },
    cloudy: { cloudy: 3, rain: 3, fog: 2, storm: 1 },
    rain: { rain: 3, cloudy: 2, storm: 1.5 },
    storm: { rain: 3, storm: 1, cloudy: 1 },
    fog: { fog: 3, cloudy: 2, rain: 1 },
    snow: { cloudy: 2, rain: 2 },
  },
  3: {
    clear: { clear: 3, cloudy: 3, snow: 2, fog: 1 },
    cloudy: { cloudy: 3, snow: 3, clear: 1, fog: 1 },
    rain: { cloudy: 2, snow: 2 },
    storm: { snow: 2, cloudy: 2 },
    fog: { fog: 2, cloudy: 2, snow: 1 },
    snow: { snow: 3, cloudy: 2, storm: 0.7, clear: 1 },
  },
};

export function nextWeather(cur: WeatherId, season: Season, climate: LocationDef["climate"], rnd: () => number): WeatherId {
  const row: Row = { ...BASE[season][cur] };
  if (climate === "tropic") {
    if (row.snow) { row.rain = (row.rain ?? 0) + row.snow; delete row.snow; }
    row.clear = (row.clear ?? 0) + 2;
    delete row.fog;
  } else if (climate === "north") {
    row.fog = (row.fog ?? 0) + 1;
    if (season === 2 || season === 0) row.snow = (row.snow ?? 0) + 0.8;
  } else if (climate === "polar") {
    if (row.rain) { row.snow = (row.snow ?? 0) + row.rain; delete row.rain; }
    row.snow = (row.snow ?? 0) + 1.5;
    row.fog = (row.fog ?? 0) + 0.8;
    if (row.storm) row.storm *= 0.7;
  } else if (climate === "misty") {
    row.fog = (row.fog ?? 0) + 3;
    if (row.snow) { row.rain = (row.rain ?? 0) + row.snow; delete row.snow; }
  } else if (climate === "ocean") {
    row.storm = (row.storm ?? 0) + 0.6;
    if (row.snow) { row.rain = (row.rain ?? 0) + row.snow; delete row.snow; }
  } else if (row.snow && season !== 3) {
    delete row.snow;
  }
  const entries = Object.entries(row) as [WeatherId, number][];
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rnd() * total;
  for (const [w, p] of entries) {
    r -= p;
    if (r <= 0) return w;
  }
  return entries[0][0];
}

/** Условия открытия акватории: соседняя разведанная + кодекс + уровень (класс судна проверяется отдельно) */
export interface Unlock { from: LocId[]; codex: number; level: number; hint: string }
export const UNLOCKS: Partial<Record<LocId, Unlock>> = {
  estuary: { from: ["bay"], codex: 4, level: 2, hint: "Рыбаки у пирса говорят, в устье реки ходит тарань" },
  cape: { from: ["bay"], codex: 8, level: 3, hint: "Смотритель маяка звал заглянуть к скалам" },
  skerries: { from: ["cape", "estuary"], codex: 16, level: 6, hint: "За мысом, на севере, тысячи островов" },
  fjord: { from: ["skerries"], codex: 26, level: 9, hint: "Шкиперы из Нордхавна хвалят глубины фьорда" },
  kelp: { from: ["cape"], codex: 30, level: 11, hint: "На западе туман скрывает подводный лес" },
  reef: { from: ["cape", "kelp"], codex: 36, level: 13, hint: "Южный ветер приносит запах тропиков" },
  mangrove: { from: ["reef"], codex: 46, level: 16, hint: "За рифом — протоки, где рыба ходит по илу" },
  ocean: { from: ["kelp", "reef"], codex: 58, level: 20, hint: "Настоящие гиганты ждут за горизонтом" },
  volcano: { from: ["ocean", "reef"], codex: 72, level: 24, hint: "Моряки видели дым над водой в открытом море" },
  abyss: { from: ["ocean"], codex: 95, level: 30, hint: "Над жёлобом, говорят, пропадают звёзды" },
  antarctic: { from: ["abyss", "ocean"], codex: 115, level: 34, hint: "Учёные ищут шкипера для экспедиции на юг" },
};

export const BOAT_CLASS_NAMES = ["Малые лодки", "Моторные", "Катера и яхты", "Промысловые суда", "Исследовательские"];

export const MILESTONES = [
  { count: 5, reward: 150, title: "Юнга" },
  { count: 15, reward: 400, title: "Матрос" },
  { count: 40, reward: 1200, title: "Боцман" },
  { count: 75, reward: 2500, title: "Шкипер" },
  { count: 115, reward: 4500, title: "Капитан" },
  { count: 160, reward: 7000, title: "Флагман" },
  { count: 210, reward: 10000, title: "Адмирал" },
  { count: FISH.length, reward: 16000, title: "Хранитель знакомой воды" },
]


// ───────────── ТОЧКИ ЛОВЛИ ─────────────
export const SPOTS: SpotDef[] = [
  { id: "bay_pier", loc: "bay", name: "Старый пирс", desc: "Просмолённые сваи в ракушках. Мелко, спокойно, всегда клюёт.", maxDepth: 9, profile: "pier", feature: "pier", bias: ["goby", "wrasse", "mullet", "garfish", "atherina", "blenny", "golden_mullet", "black_goby", "sprat", "rainbow_wrasse", "pipefish"], seed: 1.3 },
  { id: "bay_sand", loc: "bay", name: "Песчаная отмель", desc: "Рябь на песке и тёплая вода. Здесь роется барабуля.", maxDepth: 13, profile: "shelf", feature: "sandbar", bias: ["red_mullet", "horse_mackerel", "salema", "turbot", "anchovy", "picarel", "saddled_bream", "flounder", "bonito", "sea_horse", "sea_bream_bay", "gilthead"], seed: 4.1 },
  { id: "bay_ridge", loc: "bay", name: "Каменная гряда", desc: "Подводные валуны на выходе из бухты. Ночью здесь неуютно.", maxDepth: 18, profile: "drop", feature: "ridge", bias: ["scorpionfish", "croaker", "turbot", "bay_master", "stargazer", "weever", "sturgeon", "bluefish", "bay_turbot_giant", "black_goby", "shi_drum"], seed: 7.7 },

  { id: "cape_arch", loc: "cape", name: "Каменная арка", desc: "Волны бьют сквозь арку. В расщелинах живут губаны.", maxDepth: 22, profile: "shelf", feature: "arch", bias: ["ballan", "sea_bass", "rockling", "wolffish", "sargo", "triggerfish", "cuckoo_wrasse", "comber", "black_seabream"], seed: 2.2 },
  { id: "cape_current", loc: "cape", name: "Приливное течение", desc: "Сулой у мыса: вода кипит, стаи идут одна за другой.", maxDepth: 32, profile: "flat", feature: "current", bias: ["pollock", "mackerel", "garfish", "horse_mackerel", "whiting", "seabass_lavrak", "bonito", "bluefish", "pandora", "pollack_yellow", "spurdog_giant", "tub_gurnard"], seed: 5.5, swell: 1.3 },
  { id: "cape_wall", loc: "cape", name: "Подводная стена", desc: "Под маяком скала обрывается в тёмную глубину.", maxDepth: 45, profile: "drop", feature: "wall", bias: ["conger", "monkfish", "cod", "stone_patriarch", "gurnard", "sole", "dentex", "dogfish", "thornback", "john_dory", "wreckfish", "red_scorpion", "pollack_yellow", "cuckoo_ray", "angel_shark"], seed: 9.1 },

  { id: "fjord_falls", loc: "fjord", name: "Водопад Сигне", desc: "Пресная вода падает в море. Лосось поднимается к реке.", maxDepth: 40, profile: "shelf", feature: "waterfall", bias: ["sea_trout", "salmon", "char", "herring", "pink_salmon", "lumpfish"], seed: 3.3 },
  { id: "fjord_ice", loc: "fjord", name: "Ледяная бухта", desc: "Язык ледника и дрейфующие льдины. Холодная, прозрачная вода.", maxDepth: 120, profile: "flat", feature: "icebay", bias: ["plaice", "capelin", "haddock", "herring", "polar_cod", "plaice_eu", "blue_whiting", "lumpfish", "arctic_skate", "sprat_nor", "lemon_sole"], seed: 6.6 },
  { id: "fjord_deep", loc: "fjord", name: "Горловина", desc: "Стены фьорда сходятся, дно уходит вниз на полторы сотни метров.", maxDepth: 160, profile: "trench", feature: "deep", bias: ["halibut", "chimaera", "spotted_wolffish", "nordvik_halibut", "ling", "tusk", "beaked_redfish", "argentine", "porbeagle", "greenland_shark", "lofoten_cod", "dogfish", "saithe_black", "norway_haddock", "rabbit_chimaera", "halibut_green", "norway_pout", "black_scabbard"], seed: 8.4 },

  { id: "reef_lagoon", loc: "reef", name: "Лагуна", desc: "Тёплая бирюзовая мель у бунгало. Актинии и рыбы-клоуны.", maxDepth: 15, profile: "shelf", feature: "lagoon", bias: ["clownfish", "surgeonfish", "parrotfish", "angelfish", "butterflyfish", "sergeant", "rabbitfish", "boxfish", "bonefish", "blacktip", "damselfish", "goatfish_yellow", "mandarin", "flame_angel"], seed: 1.9 },
  { id: "reef_wreck", loc: "reef", name: "Галеон «Санта-Люсия»", desc: "Испанский галеон 1715 года. Идеальное укрытие для хищников.", maxDepth: 40, profile: "wreck", feature: "wreck", bias: ["lionfish", "moray", "pufferfish", "barracuda", "red_snapper", "clown_trigger", "moorish_idol", "unicornfish", "hawkfish", "coral_trout", "squirrelfish", "harlequin_tusk"], seed: 4.8 },
  { id: "reef_wall", loc: "reef", name: "Коралловая стена", desc: "Край рифа, за ним синева. Здесь патрулируют гиганты.", maxDepth: 60, profile: "drop", feature: "reefwall", bias: ["grouper", "napoleon", "eagle_ray", "golden_moray", "giant_trevally", "tiger_shark", "bluefin_jack", "manta", "dogtooth"], seed: 7.2 },

  { id: "ocean_sargasso", loc: "ocean", name: "Саргассовы поля", desc: "Плавучие острова водорослей — дом для мальков и охотников на них.", maxDepth: 110, profile: "flat", feature: "sargassum", bias: ["mahi", "flying_fish", "wahoo", "barracuda", "sardine", "skipjack", "cobia", "bullet_tuna", "dolphinfish_pompano", "bluefin_jack", "pilot_fish", "tripletail"], seed: 2.7 },
  { id: "ocean_seamount", loc: "ocean", name: "Подводная гора", desc: "Вершина вулкана в 90 метрах от поверхности. Тунцы кружат над ней.", maxDepth: 250, profile: "seamount", feature: "seamount", bias: ["yellowfin", "sailfish", "blue_marlin", "santiago", "albacore", "bluefin", "striped_marlin", "oceanic_whitetip", "shortfin_mako_giant", "whale_shark"], seed: 5.9 },
  { id: "ocean_blue", loc: "ocean", name: "Синяя вода", desc: "Абсолютная синева на сотни метров вниз. Большая зыбь.", maxDepth: 420, profile: "flat", feature: "blue", bias: ["swordfish", "mako", "blue_shark", "opah", "escolar", "hammerhead", "sunfish", "great_white", "pompano_black", "lancetfish", "oilfish"], seed: 8.8, swell: 1.4 },

  { id: "abyss_twilight", loc: "abyss", name: "Сумеречная зона", desc: "Свет кончается на двухстах метрах. Ниже — только огоньки.", maxDepth: 1000, profile: "flat", feature: "twilight", bias: ["hatchetfish", "oarfish", "giant_squid", "lanternfish", "viperfish", "barreleye", "coelacanth", "sixgill", "bristlemouth", "snipe_eel", "cookiecutter", "hagfish", "gulper_shark"], seed: 3.7 },
  { id: "abyss_vents", loc: "abyss", name: "Чёрные курильщики", desc: "Гидротермальные источники: кипяток, сера и странная жизнь.", maxDepth: 1800, profile: "seamount", feature: "vents", bias: ["blobfish", "gulper", "deep_angler", "orange_roughy", "black_swallower", "anglerfish_beard", "fangtooth", "dragonfish_black", "loosejaw"], seed: 6.1 },
  { id: "abyss_trench", loc: "abyss", name: "Жёлоб", desc: "Край Марианской впадины. Скелет кита на уступе. Тишина.", maxDepth: 2000, profile: "trench", feature: "trench", bias: ["goblin_shark", "ghost_chimaera", "leviathan", "grenadier", "tripodfish", "pelican_eel", "abyss_octopus", "abyss_snail"], seed: 9.6 },
  { id: "estuary_reeds", loc: "estuary", name: "Камышовый берег", desc: "Стена камыша у самой воды. Тихо, только плещется тарань.", maxDepth: 5, profile: "shelf", feature: "reeds", bias: ["taran", "atherina", "golden_mullet", "sazan", "rudd", "roach", "sprat", "chekhon", "tench", "crucian", "gudgeon"], seed: 2.4 },
  { id: "estuary_stilts", loc: "estuary", name: "Рыбачьи мостки", desc: "Хижины на сваях и сохнущие сети. Под настилом держится судак.", maxDepth: 8, profile: "pier", feature: "stilts", bias: ["zander", "flounder", "pilengas", "shemaya", "bream", "asp"], seed: 5.2 },
  { id: "estuary_channel", loc: "estuary", name: "Фарватер", desc: "Углублённый канал между бакенами. Здесь ходят сомы и осётры.", maxDepth: 12, profile: "trench", feature: "channel", bias: ["catfish", "sturgeon", "beluga", "zander", "starry_sturgeon", "bream", "sterlet"], seed: 8.1 },

  { id: "skerries_cottage", loc: "skerries", name: "Остров с красным домиком", desc: "Гранитная спина острова, сосны и лодочный сарай. Щука стоит у тростника.", maxDepth: 12, profile: "shelf", feature: "cottage", bias: ["pike", "perch", "smelt", "pike_legend", "ide", "garfish_baltic", "sea_eagle_trout", "roach_baltic", "silver_bream"], seed: 1.7 },
  { id: "skerries_sound", loc: "skerries", name: "Пролив", desc: "Узкий пролив между островами. Течение гонит салаку и кумжу.", maxDepth: 30, profile: "flat", feature: "sound", bias: ["herring", "sea_trout", "whitefish", "salmon", "pollock", "vendace", "wels_skerry", "sea_eagle_trout", "grayling"], seed: 4.4 },
  { id: "skerries_trough", loc: "skerries", name: "Глубокая ложбина", desc: "Ледниковая борозда в граните. Холодная вода, угорь и треска.", maxDepth: 70, profile: "drop", feature: "trough", bias: ["eel", "cod", "plaice_eu", "atl_sturgeon", "lumpfish", "whiting", "burbot", "zander_baltic"], seed: 7.3 },

  { id: "kelp_otters", loc: "kelp", name: "Бухта каланов", desc: "Каланы спят на спине, завернувшись в водоросли. Мелко и спокойно.", maxDepth: 14, profile: "shelf", feature: "otters", bias: ["garibaldi", "kelp_bass", "sheephead", "surfperch", "ballan", "opaleye", "cabezon", "kelp_greenling"], seed: 2.9 },
  { id: "kelp_forest", loc: "kelp", name: "Ламинариевый лес", desc: "Стволы водорослей тянутся со дна к поверхности, как колонны собора.", maxDepth: 32, profile: "flat", feature: "kelpforest", bias: ["kelp_bass", "lingcod", "white_seabass", "giant_seabass", "leopard_shark", "wolffish", "rockfish_blue", "halibut_cali", "kelp_leviathan", "treefish", "pacific_bonito"], seed: 5.8 },
  { id: "kelp_canyon", loc: "kelp", name: "Подводный каньон", desc: "У самого берега дно обрывается в каньон. Из тумана приходит белая акула.", maxDepth: 140, profile: "drop", feature: "canyon", bias: ["octopus", "great_white", "lingcod", "dogfish", "chimaera", "thornback", "wolf_eel", "sevengill", "white_sturgeon"], seed: 8.6 },

  { id: "mangrove_flats", loc: "mangrove", name: "Солёные отмели", desc: "Прогретая мель, где вода по колено. Хвосты альбулы режут поверхность.", maxDepth: 4, profile: "flat", feature: "flats", bias: ["bonefish", "mudskipper", "lemon_shark", "blacktip", "mojarra", "red_drum", "gar_tropical", "halfbeak"], seed: 1.4 },
  { id: "mangrove_roots", loc: "mangrove", name: "Корни мангров", desc: "Лабиринт корней-ходулей. Брызгуны сбивают насекомых струёй воды.", maxDepth: 7, profile: "shelf", feature: "roots", bias: ["archerfish", "mangrove_snapper", "snook", "goliath", "sergeant", "pufferfish", "sheepshead", "scat", "barramundi"], seed: 4.9 },
  { id: "mangrove_creek", loc: "mangrove", name: "Глубокая протока", desc: "Тёмная протока, где стоят тарпоны. Говорят, здесь живёт старая пила-рыба.", maxDepth: 16, profile: "trench", feature: "creek", bias: ["tarpon", "jack_crevalle", "sawfish", "snook", "cubera", "bull_shark"], seed: 7.6 },

  { id: "volcano_blacksand", loc: "volcano", name: "Чёрный пляж", desc: "Песок из застывшей лавы. Над ним скользят летучие рыбы.", maxDepth: 30, profile: "shelf", feature: "blacksand", bias: ["soldierfish", "convict_tang", "flying_fish", "bluefin_trevally", "triggerfish", "unicornfish", "moorish_tang", "bigeye_scad", "picasso_trigger"], seed: 3.1 },
  { id: "volcano_lava", loc: "volcano", name: "Лавовый язык", desc: "Лава стекает в море, вода шипит паром. Хищники ждут оглушённую рыбу.", maxDepth: 90, profile: "drop", feature: "lava", bias: ["amberjack", "opakapaka", "wahoo", "galapagos_shark", "dentex", "lava_moray", "kampachi", "pele_marlin", "bluestripe_snapper"], seed: 6.2 },
  { id: "volcano_caldera", loc: "volcano", name: "Подводная кальдера", desc: "Затопленный кратер глубиной в полкилометра. Здесь нашли целаканта.", maxDepth: 520, profile: "seamount", feature: "caldera", bias: ["onaga", "black_marlin", "coelacanth", "opakapaka", "deepwater_snapper", "deep_bigeye"], seed: 9.3 },

  { id: "ice_edge", loc: "antarctic", name: "Кромка шельфа", desc: "У подножия ледяной стены. С неё с грохотом откалываются глыбы.", maxDepth: 220, profile: "drop", feature: "iceedge", bias: ["silverfish", "marbled_rockcod", "antarctic_skate", "bald_notothen", "emerald_rockcod", "spiny_plunderfish", "crocodile_icefish", "ice_pout"], seed: 2.2 },
  { id: "ice_bergs", loc: "antarctic", name: "Поле айсбергов", desc: "Айсберги размером с дома. Под водой их в десять раз больше.", maxDepth: 480, profile: "flat", feature: "icebergs", bias: ["icefish", "dragonfish", "toothfish", "blue_whiting_giant", "antarctic_eelpout", "unicorn_icefish", "southern_right_mola"], seed: 5.5 },
  { id: "ice_polynya", loc: "antarctic", name: "Полынья", desc: "Окно открытой воды в сплошном льду над глубоким жёлобом.", maxDepth: 1200, profile: "trench", feature: "polynya", bias: ["toothfish", "sleeper_shark", "colossal_squid", "grenadier", "macrourus", "bathydraco", "marbled_plunderfish", "white_icefish_king"], seed: 8.8 },
];

// Убираем из «любимых» тех, кто не водится в этой акватории
for (const sp of SPOTS) sp.bias = sp.bias.filter((id) => FISH.some((f) => f.id === id && f.loc.includes(sp.loc)));

export const SPOT_BY_ID = Object.fromEntries(SPOTS.map((s) => [s.id, s])) as Record<string, SpotDef>;
export const spotsOf = (loc: LocId) => SPOTS.filter((s) => s.loc === loc);

const ss = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Профиль дна: доля от maxDepth в точке nx (0 — левый край экрана, 1 — правый) */
export function bedFrac(spot: SpotDef, nx: number): number {
  const s = spot.seed;
  const n = Math.sin(nx * 19 + s) * 0.5 + Math.sin(nx * 47 + s * 1.7) * 0.3 + Math.sin(nx * 113 + s * 3.1) * 0.2;
  let v: number;
  switch (spot.profile) {
    case "flat": v = 0.95 + n * 0.035; break;
    case "shelf": v = 0.42 + 0.56 * ss(0.02, 0.95, nx) + n * 0.04; break;
    case "pier": v = 0.3 + 0.66 * ss(0.0, 0.85, nx) + n * 0.03; break;
    case "drop": {
      const k = ss(0.5, 0.63, nx);
      v = 0.24 + n * 0.05 * (1 - k) + k * (0.74 + n * 0.02);
      break;
    }
    case "seamount": v = 0.98 - 0.62 * Math.exp(-(((nx - 0.6) / 0.13) ** 2)) + n * 0.025; break;
    case "trench": v = 0.52 + 0.47 * ss(0.44, 0.55, nx) * (1 - ss(0.88, 0.99, nx)) + n * 0.025; break;
    case "wreck": v = 0.9 + n * 0.05; break;
  }
  return Math.max(0.08, Math.min(1, v));
}

export const HOOKS: GearLevel[] = [
  { name: "Кованый крючок №8", price: 0, value: 0, desc: "Простой и мягкий, быстро тупится" },
  { name: "Химически заточенный", price: 900, value: 1, desc: "Острее: рыба реже сходит при слабине" },
  { name: "Офсетный «Кайдзю»", price: 5500, value: 2, desc: "Держит в пасти при рывках и прыжках" },
  { name: "Круглый «Circle»", price: 24000, value: 3, desc: "Засекается сам, почти не сходит" },
  { name: "Титановый «Гарпун»", price: 90000, value: 4, desc: "Не ломается и не разгибается никогда" },
];

export type GearKind = "rod" | "reel" | "line" | "hook" | "sonar";
export interface ModDef { id: string; gear: Exclude<GearKind, "sonar">; name: string; max: number; base: number; desc: (l: number) => string }
/** Доработки снаряжения: уровень мода не выше класса самой снасти */
export const MODS: ModDef[] = [
  { id: "rod_blank", gear: "rod", name: "Карбоновый бланк", max: 3, base: 1400, desc: (l) => `Предел натяжения +${l * 5}%` },
  { id: "rod_guides", gear: "rod", name: "Кольца SiC", max: 3, base: 1100, desc: (l) => `Резкие рывки слабее на ${l * 8}%` },
  { id: "rod_grip", gear: "rod", name: "Рукоять EVA", max: 3, base: 900, desc: (l) => `Контра рывку эффективнее на ${l * 6}%` },
  { id: "reel_drag", gear: "reel", name: "Карбоновый фрикцион", max: 3, base: 1500, desc: (l) => `Запас перегруза до обрыва +${l * 18}%` },
  { id: "reel_bearings", gear: "reel", name: "Подшипники", max: 3, base: 1000, desc: (l) => `Скорость подмотки +${l * 8}%` },
  { id: "reel_ratio", gear: "reel", name: "Силовая передача", max: 3, base: 1300, desc: (l) => `Подмотка во время рывка +${l * 10}%` },
  { id: "line_fluoro", gear: "line", name: "Флюорокарбон", max: 3, base: 800, desc: (l) => `Поклёвка быстрее на ${l * 5}%` },
  { id: "line_braid", gear: "line", name: "Плетёный шнур", max: 3, base: 1000, desc: (l) => `Окно подсечки +${l * 6}%` },
  { id: "line_leader", gear: "line", name: "Стальной поводок", max: 3, base: 700, desc: (l) => `Потеря оснастки −${l * 20}%` },
  { id: "hook_sharpen", gear: "hook", name: "Заточка жала", max: 3, base: 600, desc: (l) => `Окно точной подсечки +${l * 12}%` },
  { id: "hook_stealth", gear: "hook", name: "Матовое покрытие", max: 3, base: 1200, desc: (l) => `Редкие виды +${l * 3}%` },
];
export const MOD_BY_ID = Object.fromEntries(MODS.map((m) => [m.id, m])) as Record<string, ModDef>;
export const MOD_COST_STEP = [0, 1, 3.4, 9.5];

export const SONARS: GearLevel[] = [
  { name: "Без эхолота", price: 0, value: 0, desc: "Только чутьё и опыт" },
  { name: "Эхолот «Лоцман»", price: 1500, value: 1, desc: "Рельеф дна и отметки рыбы по глубинам" },
  { name: "Цветной эхолот", price: 12000, value: 2, desc: "Показывает редкость и ещё не пойманные виды" },
  { name: "Сонар «Глубина»", price: 70000, value: 3, desc: "Чувствует присутствие легенд" },
];

function hashStr(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  h ^= h >>> 13;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Спрос на рынке: 0.7 – 1.35 от базовой цены, меняется каждый день */
export function priceMult(fishId: string, day: number) {
  return 0.7 + hashStr(`${fishId}:${day}`) * 0.65;
}

/** Две «рыбы дня» — продаются вдвое дороже */
export function hotFish(day: number): string[] {
  const pool = FISH.filter((f) => f.rarity !== "legendary");
  const a = Math.floor(hashStr(`hot1:${day}`) * pool.length);
  let b = Math.floor(hashStr(`hot2:${day}`) * pool.length);
  if (b === a) b = (b + 7) % pool.length;
  return [pool[a].id, pool[b].id];
}

export const ORDER_CLIENTS = [
  "Ресторан «Лагуна»",
  "Трактир «Старый якорь»",
  "Шеф Пьер Дюваль",
  "Аквариум Нордвика",
  "Музей природы",
  "Биолог Ирина Лебедь",
  "Рыбный рынок",
  "Коптильня деда Матвея",
  "Суши-бар «Кит»",
];


// ───────────── КАРТА И ПОРТЫ ─────────────
/** Положение на карте, % ширины / высоты */
export const LOC_POS: Record<LocId, [number, number]> = {
  bay: [15, 64], estuary: [6, 84], cape: [26, 46], skerries: [30, 24], fjord: [16, 9], kelp: [42, 66],
  reef: [60, 80], mangrove: [48, 92], ocean: [58, 44], volcano: [74, 60], abyss: [86, 24], antarctic: [88, 90],
};

export const PORTS: PortDef[] = [
  {
    id: "home", name: "Знакомая вода", place: "родной посёлок", pos: [10, 60], style: "home", serves: ["bay", "estuary", "cape"],
    desc: "Деревянные причалы, маяк на холме и рынок, где все знают твоего отца. Здесь дешевле всего снасти для начала.",
    demand: { bay: 0.85, estuary: 0.9, cape: 0.95, skerries: 1.15, fjord: 1.25, kelp: 1.3, reef: 1.5, mangrove: 1.45, ocean: 1.3, volcano: 1.5, abyss: 1.7, antarctic: 1.6 },
    rareDemand: 1, baits: ["worm", "mussel", "shrimp", "spoon", "livebait"], gearMax: { rod: 2, reel: 2, line: 2, hook: 1, sonar: 1 },
    shipyard: ["kayak", "dinghy", "barkas", "cutter"], priceMult: 1, innFee: 60,
    clients: ["Трактир «Старый якорь»", "Коптильня деда Матвея", "Рыбный рынок", "Ресторан «Лагуна»"],
  },
  {
    id: "nordhavn", name: "Нордхавн", place: "северный порт", pos: [24, 17], style: "nord", serves: ["skerries", "fjord"],
    desc: "Красные пакгаузы на сваях, портовые краны и горы над гаванью. Лучшая верфь промысловых судов.",
    demand: { skerries: 0.85, fjord: 0.85, bay: 1.15, estuary: 1.2, cape: 1.05, kelp: 1.2, reef: 1.75, mangrove: 1.7, ocean: 1.25, volcano: 1.6, abyss: 1.4, antarctic: 1.1 },
    rareDemand: 1.05, baits: ["worm", "mussel", "shrimp", "spoon", "livebait", "cutbait", "jig", "wobbler"], gearMax: { rod: 3, reel: 3, line: 3, hook: 2, sonar: 2 },
    shipyard: ["barkas", "cutter", "trawler", "polar"], priceMult: 1.1, innFee: 180,
    clients: ["Аквариум Нордвика", "Консервный завод «Фьорд»", "Шеф Эрик Хальвор", "Рыбный рынок Нордхавна"],
  },
  {
    id: "mirador", name: "Мирадор", place: "туманная гавань", pos: [37, 56], style: "fog", serves: ["kelp", "ocean"],
    desc: "Викторианский пирс, консервные заводы и рестораны на сваях. Гурманы платят за северную и тропическую рыбу.",
    demand: { kelp: 0.85, ocean: 0.95, bay: 1.2, estuary: 1.35, cape: 1.1, skerries: 1.3, fjord: 1.35, reef: 1.3, mangrove: 1.35, volcano: 1.25, abyss: 1.35, antarctic: 1.45 },
    rareDemand: 1.1, baits: ["worm", "shrimp", "livebait", "cutbait", "wobbler", "jig", "squid"], gearMax: { rod: 4, reel: 4, line: 3, hook: 3, sonar: 2 },
    shipyard: ["cutter", "yacht", "deepsea"], priceMult: 1.2, innFee: 250,
    clients: ["Суши-бар «Кит»", "Шеф Пьер Дюваль", "Консервный ряд", "Клуб спортивной рыбалки"],
  },
  {
    id: "coral", name: "Порт-Корал", place: "тропический остров", pos: [66, 88], style: "coral", serves: ["reef", "mangrove", "volcano"],
    desc: "Разноцветные домики на сваях, пальмы и базар под навесами. Холодноводная рыба здесь — диковина.",
    demand: { reef: 0.85, mangrove: 0.85, volcano: 0.9, bay: 1.4, estuary: 1.45, cape: 1.45, skerries: 1.7, fjord: 1.8, kelp: 1.5, ocean: 1.1, abyss: 1.35, antarctic: 1.9 },
    rareDemand: 1.05, baits: ["shrimp", "spoon", "livebait", "wobbler", "jig", "squid"], gearMax: { rod: 4, reel: 4, line: 4, hook: 3, sonar: 3 },
    shipyard: ["kayak", "yacht", "trawler"], priceMult: 1.15, innFee: 220,
    clients: ["Отель «Лагуна Азул»", "Музей природы", "Рыбный базар", "Ресторан «Пальма»"],
  },
  {
    id: "southcross", name: "Южный Крест", place: "полярная станция", pos: [93, 78], style: "polar", serves: ["antarctic", "abyss"],
    desc: "Купола станции, радиомачты и ледовый причал. Учёные платят любую цену за редкие виды.",
    demand: { antarctic: 0.9, abyss: 0.95, bay: 1.1, estuary: 1.1, cape: 1.1, skerries: 1.15, fjord: 1.15, kelp: 1.2, reef: 1.25, mangrove: 1.25, ocean: 1.15, volcano: 1.25 },
    rareDemand: 1.5, baits: ["shrimp", "cutbait", "jig", "squid", "glow"], gearMax: { rod: 5, reel: 5, line: 5, hook: 4, sonar: 3 },
    shipyard: ["polar", "deepsea"], priceMult: 1.4, innFee: 400,
    clients: ["Биолог Ирина Лебедь", "Институт океанологии", "Криолаборатория", "Экспедиция «Восток»"],
  },
];
export const PORT_BY_ID = Object.fromEntries(PORTS.map((p) => [p.id, p])) as Record<PortId, PortDef>;
export const portOf = (loc: LocId) => PORTS.find((p) => p.serves.includes(loc))!;

const dist = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], (a[1] - b[1]) * 0.625);
/** Часы хода между точками карты (до поправки на судно) */
export const travelHoursBetween = (a: [number, number], b: [number, number]) => Math.max(0.4, dist(a, b) * 0.1);
