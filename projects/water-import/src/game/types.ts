import type { DirectorSave } from "./events/types";

export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";
export type TimeReq = "any" | "day" | "night" | "twilight";
export type WeatherId = "clear" | "cloudy" | "rain" | "storm" | "fog" | "snow";
export type Season = 0 | 1 | 2 | 3;
export type Shape =
  | "fusiform"
  | "deep"
  | "flat"
  | "eel"
  | "shark"
  | "angler"
  | "squid"
  | "puffer"
  | "billfish"
  | "ray"
  | "blob"
  | "long";
export type Pattern = "none" | "stripes" | "spots" | "bars" | "gradient";
export type BaitId = "worm" | "mussel" | "shrimp" | "spoon" | "livebait" | "cutbait" | "wobbler" | "jig" | "squid" | "glow";
export type PortId = "home" | "nordhavn" | "mirador" | "coral" | "southcross";
export type LocId = "bay" | "estuary" | "cape" | "skerries" | "fjord" | "kelp" | "reef" | "mangrove" | "ocean" | "volcano" | "abyss" | "antarctic";
export type Variant = "albino" | "golden" | "trophy" | "scarred" | "melanist";

export interface FishDef {
  id: string;
  name: string;
  latin: string;
  loc: LocId[];
  depth: [number, number];
  rarity: Rarity;
  time: TimeReq;
  weather?: WeatherId[];
  season?: Season[];
  moon?: "full" | "new";
  weight: [number, number];
  price: number; // монет за кг
  strength: number; // 1..10
  shape: Shape;
  colors: { body: string; belly: string; fin: string; accent?: string };
  pattern?: Pattern;
  glow?: string;
  bait?: BaitId[];
  desc: string;
}

export interface LocationDef {
  id: LocId;
  name: string;
  desc: string;
  boatTier: number;
  maxDepth: number;
  travelHours: number;
  land: "bay" | "cliffs" | "fjord" | "reef" | "open" | "abyss" | "estuary" | "skerries" | "kelpcoast" | "mangrove" | "volcano" | "ice";
  climate: "temperate" | "north" | "tropic" | "ocean" | "polar" | "misty";
  seabed: "sand" | "rock" | "kelp" | "coral" | "mud" | "vents" | "silt" | "granite" | "kelpforest" | "roots" | "basalt" | "polar";
  /** прозрачность воды 0..1 */
  clarity: number;
  waveMult: number;
  water: { surface: string; shallow: string; mid: string; deep: string };
  bed: string;
}

export type BedProfile = "flat" | "shelf" | "drop" | "seamount" | "trench" | "pier" | "wreck";
export type SpotFeature =
  | "pier" | "sandbar" | "ridge"
  | "arch" | "current" | "wall"
  | "waterfall" | "icebay" | "deep"
  | "lagoon" | "reefwall" | "wreck"
  | "sargassum" | "seamount" | "blue"
  | "twilight" | "vents" | "trench"
  | "reeds" | "channel" | "stilts"
  | "sound" | "cottage" | "trough"
  | "kelpforest" | "otters" | "canyon"
  | "roots" | "flats" | "creek"
  | "blacksand" | "lava" | "caldera"
  | "iceedge" | "icebergs" | "polynya";

export interface SpotDef {
  id: string;
  loc: LocId;
  name: string;
  desc: string;
  maxDepth: number;
  profile: BedProfile;
  feature: SpotFeature;
  bias: string[];
  seed: number;
  swell?: number;
}

export interface Order {
  id: string;
  fishId: string;
  count: number;
  minWeight: number;
  reward: number;
  expiresDay: number;
  client: string;
}

export type BoatStyle = "row" | "kayak" | "dinghy" | "barkas" | "cutter" | "yacht" | "seiner" | "trawler" | "research";
export interface BoatDef {
  id: string;
  name: string;
  /** класс судна 0..4 — открывает акватории */
  tier: number;
  style: BoatStyle;
  price: number;
  cooler: number;
  stormSafe: boolean;
  travelMult: number;
  /** остойчивость 0..1: снижает качку и штормовой бонус рыбы */
  stability: number;
  /** бесшумность: множитель скорости поклёвки */
  quiet: number;
  /** бонус к шансу редких видов */
  rareBonus: number;
  /** доп. слоты под живую наживку: живец и кальмар расходуются реже */
  baitWell: number;
  /** расход топлива, ₽ за час хода (0 — вёсла или паруса) */
  fuel: number;
  desc: string;
  special: string;
  hull: string;
  trim: string;
}

export interface GearLevel {
  name: string;
  price: number;
  value: number;
  desc: string;
}

export interface BaitDef {
  id: BaitId;
  name: string;
  price: number; // за пачку
  pack: number;
  desc: string;
  color: string;
  /** natural — съедается при поклёвке; lure — искусственная, служит долго */
  kind: "natural" | "lure" | "special";
  /** размер: −1 мелкая … +1 крупная; крупная отсекает мелочь и тянет вес вверх */
  size: number;
  /** скорость поклёвки */
  bite: number;
  /** шанс, что приманка переживёт пойманную рыбу */
  durable: number;
  /** рабочий диапазон глубин; вне его приманка работает хуже */
  depth: [number, number];
  /** множитель к редким видам */
  rarity: number;
  /** считается «почти как» эти наживки для видов, которые их любят */
  mimics?: BaitId[];
}

export interface PortDef {
  id: PortId;
  name: string;
  place: string;
  desc: string;
  pos: [number, number];
  serves: LocId[];
  style: "home" | "nord" | "fog" | "coral" | "polar";
  /** цена рыбы по акватории происхождения */
  demand: Partial<Record<LocId, number>>;
  /** надбавка к исключительным и легендарным */
  rareDemand: number;
  baits: BaitId[];
  gearMax: { rod: number; reel: number; line: number; hook: number; sonar: number };
  shipyard: string[];
  priceMult: number;
  innFee: number;
  clients: string[];
}

export interface CodexEntry {
  count: number;
  maxWeight: number;
  firstDay: number;
  variants: Variant[];
}

export interface CaughtFish {
  uid: string;
  fishId: string;
  weight: number;
  variant: Variant | null;
  value: number;
  day: number;
  loc: LocId;
  /** игровая минута поимки — для свежести */
  at?: number;
}

export interface ActiveEvent {
  id: string;
  endsAt: number; // абсолютные игровые минуты
}

export interface SaveData {
  version: number;
  name: string;
  money: number;
  minutes: number; // абсолютные игровые минуты с начала
  location: LocId;
  spot: string;
  boat: number;
  boatsOwned: number[];
  /** текущий (или последний) порт */
  port: PortId;
  portsKnown: PortId[];
  /** разведанные (открытые) акватории */
  unlocked: LocId[];
  daily?: import("./daily").DailyState;
  /** время последнего ночлега, игровые минуты */
  lastRest: number;
  /** проданное сегодня по видам и портам — насыщение рынка */
  market: { day: number; sold: Record<string, number>; byPort?: Partial<Record<PortId, Record<string, number>>> };
  sonar: number;
  orders: Order[];
  ordersDone: number;
  weatherQueued: WeatherId;
  flags: string[];
  xp: number;
  perks: Record<string, number>;
  achievements: string[];
  quest: number;
  finds: Record<string, number>;
  rod: number;
  reel: number;
  line: number;
  hook: number;
  /** доработки снаряжения: id → уровень */
  mods: Record<string, number>;
  baits: Partial<Record<BaitId, number>>;
  currentBait: BaitId;
  targetDepth: number;
  weather: WeatherId;
  weatherNext: number;
  wind: number;
  codex: Record<string, CodexEntry>;
  cooler: CaughtFish[];
  hints: string[];
  events: ActiveEvent[];
  /** Подробное состояние новых событий; `events` оставлено для старых сохранений. */
  eventDirector?: DirectorSave;
  nextEventAt: number;
  milestones: number[];
  stats: {
    totalCaught: number;
    totalEarned: number;
    linesSnapped: number;
    escaped: number;
    playSeconds: number;
    biggest: { fishId: string; weight: number } | null;
    perfectHooks: number;
    nightCatches: number;
    stormCatches: number;
    releases: number;
    jumps: number;
    maxDepthCaught: number;
    fuelSpent?: number;
    gearLost?: number;
  };
  atPort: boolean;
}
