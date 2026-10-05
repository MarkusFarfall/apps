import type { AtmoMods, Climate, RGB, Season, WeatherId, WeatherKind } from '../atmosphere/types';

export type { AtmoMods };

/**
 * Модуль случайных событий. Как и атмосфера — чистый TS без React и DOM.
 *
 * Совместимость со «Знакомой водой»:
 *   SaveData.events: { id, endsAt }[] и SaveData.nextEventAt — см. EventDirector.toLegacy()/fromLegacy();
 *   множители bite / rare / legendary — те же, что в старом EventDef;
 *   id старых событий (shoal, gulls, plankton, whale, ghost_ship, meteor, current) сохранены.
 */

export type EventTier = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
export type EventCategory = 'fish' | 'life' | 'sky' | 'mystic' | 'hazard' | 'find' | 'people';

/** Контекст для условий: состояние атмосферы + игра */
export interface EventCtx {
  /** абсолютные игровые минуты */
  T: number;
  day: number;
  hour: number;
  season: Season;
  climate: Climate;
  kind: WeatherKind;
  weather: WeatherId;
  daylight: number;
  night: number;
  golden: number;
  sunElev: number;
  temp: number;
  wind: number;
  fog: number;
  rain: number;
  snow: number;
  cover: number;
  dark: number;
  waves: number;
  moonPhase: number;
  moonIllum: number;
  starVis: number;
  aurora: number;
  wetness: number;
  /** LocId старой игры (если известна) */
  loc: string | null;
  /** глубокая акватория (maxDepth > 100 м) */
  deep: boolean;
  /** сколько раз событие уже встречалось */
  seen(id: string): number;
  active(id: string): boolean;
  /** игровых минут с конца последнего такого события (Infinity — не было) */
  since(id: string): number;
}

/** Множители к игровой механике. Отсутствующее поле = 1 (для gearRisk/luck — 0) */
export interface EventEffects {
  /** скорость поклёвки */
  bite?: number;
  /** шанс редких видов */
  rare?: number;
  /** шанс легендарных */
  legendary?: number;
  /** цена продажи */
  price?: number;
  /** опыт */
  xp?: number;
  /** доп. риск обрыва и износа снастей 0..1 */
  gearRisk?: number;
  /** удача: шанс вариантов (золотая, альбинос…) */
  luck?: number;
}

export interface Reward {
  money?: number;
  xp?: number;
  /** находка (как SaveData.finds) */
  item?: string;
  bait?: { id: string; count: number };
}

export interface Outcome {
  text: string;
  tone: 'good' | 'bad' | 'neutral';
  reward?: Reward;
  /** временный эффект после выбора */
  buff?: { label: string; effects: EventEffects; minutes: number };
  /** запустить событие-продолжение */
  follow?: string;
}

export interface EventChoice {
  id: string;
  label: string;
  hint?: string;
  resolve: (rnd: () => number, c: EventCtx) => Outcome;
}

export interface FollowUp {
  id: string;
  chance: number;
  /** задержка, игровые минуты */
  delay: [number, number];
}

/** Визуальные эффекты сцены (их рисует scene/eventFx.ts) */
export type FxId =
  | 'boil'
  | 'birds'
  | 'dolphins'
  | 'whale'
  | 'orcas'
  | 'fins'
  | 'seals'
  | 'turtle'
  | 'jellies'
  | 'bioglow'
  | 'tint'
  | 'spawn'
  | 'meteors'
  | 'halo'
  | 'greenflash'
  | 'moonbow'
  | 'eclipse'
  | 'mirage'
  | 'waterspout'
  | 'stelmo'
  | 'ghostship'
  | 'deeplights'
  | 'fallenstar'
  | 'leviathan'
  | 'shelf'
  | 'flare'
  | 'fireworks'
  | 'sails'
  | 'boat'
  | 'bottle'
  | 'crate'
  | 'net'
  | 'squid'
  | 'flyingfish'
  | 'jumpers'
  | 'eels'
  | 'hail'
  | 'petrels'
  | 'current'
  | 'wisps';

export interface FxSpec {
  id: FxId;
  color?: RGB;
  /** плотность / количество */
  n?: number;
  variant?: string;
}

export interface EventDef {
  id: string;
  name: string;
  icon: string;
  tier: EventTier;
  cat: EventCategory;
  desc: string;
  /** длительность, игровые минуты [мин, макс] */
  duration: [number, number];
  /**
   * Пригодность в текущих условиях: 0 — невозможно, 1 — обычно, >1 — особенно вероятно.
   * Расширение старого requires(ctx) → boolean.
   */
  when: (c: EventCtx) => number;
  effects: EventEffects;
  /** предвестник: текст и время до начала, игровые минуты */
  omen?: { text: string; lead: [number, number] };
  /** текст по завершении */
  outro?: string;
  weight?: number;
  /** минимальная пауза до повтора, игровые минуты */
  cooldown?: number;
  /** занимает «главный» слот — одновременно может идти только одно major-событие */
  major?: boolean;
  /** только как продолжение цепочки или по выбору игрока */
  chainOnly?: boolean;
  atmo?: AtmoMods;
  fx?: FxSpec[];
  follow?: FollowUp[];
  choices?: EventChoice[];
}

export type Phase = 'omen' | 'active';

export interface LiveEvent {
  uid: number;
  id: string;
  phase: Phase;
  omenAt: number;
  start: number;
  end: number;
  seed: number;
  /** id события-родителя в цепочке */
  from?: string;
  choice?: string;
  outcome?: Outcome;
}

export interface Buff {
  id: string;
  label: string;
  effects: EventEffects;
  until: number;
}

export interface DirectorSave {
  v: 1;
  T: number;
  next: number;
  live: LiveEvent[];
  queue: { id: string; at: number; from?: string; seed: number }[];
  cd: Record<string, number>;
  seen: Record<string, { n: number; first: number; last: number }>;
  buffs: Buff[];
  rng: number;
  tension: number;
  drought: number;
  uid: number;
  auto: boolean;
}

export type DirectorMessage =
  | { type: 'omen' | 'start' | 'end' | 'discover'; live: LiveEvent; def: EventDef }
  | { type: 'outcome'; live: LiveEvent; def: EventDef; outcome: Outcome };

/** То, что нужно сцене для отрисовки */
export interface VisibleEvent {
  uid: number;
  id: string;
  def: EventDef;
  /** интенсивность 0..1 (нарастание → пик → спад) */
  k: number;
  /** предвестие 0..1 (до начала) */
  omen: number;
  /** прогресс 0..1 */
  p: number;
  seed: number;
  /** выбор уже сделан (находку подобрали) */
  done: boolean;
}
