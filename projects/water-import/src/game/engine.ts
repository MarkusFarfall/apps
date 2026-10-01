import { FISH, FISH_BY_ID, RARITY_INFO, VARIANT_INFO } from "./fish";
import { ACHIEVEMENTS, FINDS, FIND_BY_ID, levelFromXp, levelReward, levelTitle, PERKS, perkPoints, QUESTS, RANK_LEVEL, rankCost, spentPoints, type FindDef } from "./progress";
import type { GearKind } from "./world";
import { applyDaily, dailyChestReward, newDaily, rollDaily, streakBonus, todayKey, makeTasks, type DailyEvent, type DailyState } from "./daily";
import type { ActiveEvent, BaitId, CaughtFish, FishDef, LocId, Order, PortId, Rarity, SaveData, Season, Variant } from "./types";
import {
  BAIT_BY_ID,
  BOATS,
  UNLOCKS,
  LOCATIONS,
  HOOKS,
  MODS,
  MOD_BY_ID,
  MOD_COST_STEP,
  LOC_POS,
  PORTS,
  PORT_BY_ID,
  portOf,
  travelHoursBetween,
  LEGACY_BOAT_IDS,
  DAYS_PER_SEASON,
  EVENTS,
  EVENT_BY_ID,
  LINES,
  LOC_BY_ID,
  MILESTONES,
  MIN_PER_DAY,
  ORDER_CLIENTS,
  REELS,
  RODS,
  SONARS,
  SPOT_BY_ID,
  WEATHER_INFO,
  bedFrac,
  hotFish,
  nextWeather,
  priceMult,
  spotsOf,
} from "./world";

export const SAVE_VERSION = 3;
export type TravelMode = "sail" | "motor";
export const gearList = (k: GearKind) => (k === "rod" ? RODS : k === "reel" ? REELS : k === "line" ? LINES : k === "hook" ? HOOKS : SONARS);
export type Trip = { kind: "port"; port: PortId } | { kind: "loc"; loc: LocId; spot?: string };
export const TIME_SCALE = 5 / 11; // примерно 1 игровая минута за 2,2 реальной секунды

export type Phase = "idle" | "charging" | "casting" | "sinking" | "waiting" | "bite" | "fight" | "caught";
export type Sfx =
  | "cast" | "splash" | "bite" | "hook" | "snap" | "escape" | "catch" | "legend" | "newSpecies"
  | "coins" | "thunder" | "event" | "buy" | "jump" | "bottom" | "reelIn" | "travel" | "levelUp" | "quest" | "perfect" | "find";

export interface Hooked {
  fish: FishDef;
  weight: number;
  variant: Variant | null;
  power: number;
  stamina: number;
  line: number;
  startLine: number;
  startDepth: number;
  tension: number;
  intensity: number;
  targetIntensity: number;
  modeTimer: number;
  running: boolean;
  overload: number;
  slack: number;
  sway: number;
  swayV: number;
  countering: boolean;
  jumper: boolean;
  jump: number; // >0 — рыба в воздухе
  jumpCD: number;
}

export interface Toast {
  id: number;
  text: string;
  sub?: string;
  kind: "info" | "good" | "bad" | "event" | "legend" | "tip";
  t: number;
}

const BANNER_TIME = 5;
const LOG_TIME = 7;
const TIP_TIME = 9;

export interface CatchResult {
  item: CaughtFish;
  isNew: boolean;
  isRecord: boolean;
  bonus: number;
  xp: number;
  perfect: boolean;
}

export interface SonarBand {
  depth: number;
  count: number;
  fresh: number;
  best: Rarity | null;
  legend: boolean;
}

export const JUMP_TIME = 1.25;
const JUMPERS = new Set([
  "mullet", "garfish", "salmon", "sea_trout", "mackerel", "mahi", "barracuda", "wahoo", "yellowfin",
  "eagle_ray", "char", "bay_master", "flying_fish", "salema", "pollock",
  "bonito", "bluefish", "seabass_lavrak", "pink_salmon", "bonefish", "giant_trevally", "skipjack", "albacore", "cobia", "blacktip",
  "tarpon", "snook", "jack_crevalle", "barramundi", "pacific_bonito", "dogtooth", "halfbeak", "grayling", "asp", "pollack_yellow", "garfish_baltic", "sea_eagle_trout", "bluefin_jack", "red_drum", "bullet_tuna", "dolphinfish_pompano", "kampachi", "coral_trout", "bluefin_trevally", "amberjack", "white_seabass", "pilengas", "shemaya",
]);

export const isJumper = (f: FishDef) => JUMPERS.has(f.id) || f.shape === "billfish" || f.id === "mako";

export function newSave(name = "Рыбак"): SaveData {
  const start = 5 * 60 + 20;
  return {
    version: SAVE_VERSION,
    name,
    money: 60,
    minutes: start,
    location: "bay",
    spot: "bay_pier",
    boat: 0,
    boatsOwned: [0],
    market: { day: 1, sold: {} },
    port: "home",
    portsKnown: ["home"],
    unlocked: ["bay"],
    daily: newDaily(),
    lastRest: -99999,
    sonar: 0,
    rod: 0,
    reel: 0,
    line: 0,
    hook: 0,
    mods: {},
    baits: { shrimp: 5 },
    currentBait: "worm",
    targetDepth: 5,
    weather: "fog",
    weatherQueued: "clear",
    weatherNext: start + 150,
    wind: 0.2,
    codex: {},
    cooler: [],
    hints: [],
    events: [],
    nextEventAt: start + 700,
    milestones: [],
    orders: [],
    ordersDone: 0,
    flags: ["visit_bay"],
    xp: 0,
    perks: {},
    achievements: [],
    quest: 0,
    finds: {},
    stats: { totalCaught: 0, totalEarned: 0, linesSnapped: 0, escaped: 0, playSeconds: 0, biggest: null, perfectHooks: 0, nightCatches: 0, stormCatches: 0, releases: 0, jumps: 0, maxDepthCaught: 0 },
    atPort: false,
  };
}

export function migrateSave(raw: unknown): SaveData | null {
  if (!raw || typeof raw !== "object") return null;
  const base = newSave();
  const r = raw as Partial<SaveData>;
  const s: SaveData = { ...base, ...r, stats: { ...base.stats, ...(r.stats ?? {}) } } as SaveData;
  if (!LOC_BY_ID[s.location]) s.location = "bay";
  if (!SPOT_BY_ID[s.spot] || SPOT_BY_ID[s.spot].loc !== s.location) s.spot = spotsOf(s.location)[0].id;
  if (!WEATHER_INFO[s.weather]) s.weather = "clear";
  if (!WEATHER_INFO[s.weatherQueued]) s.weatherQueued = "cloudy";
  s.cooler = Array.isArray(s.cooler) ? s.cooler.filter((c) => FISH_BY_ID[c.fishId]) : [];
  s.events = Array.isArray(s.events) ? s.events.filter((e) => EVENT_BY_ID[e.id]) : [];
  s.orders = Array.isArray(s.orders) ? s.orders.filter((o) => FISH_BY_ID[o.fishId]) : [];
  s.flags = Array.isArray(s.flags) ? s.flags : [];
  s.hints = Array.isArray(s.hints) ? s.hints : [];
  s.milestones = Array.isArray(s.milestones) ? s.milestones : [];
  s.sonar = Math.max(0, Math.min(SONARS.length - 1, s.sonar | 0));
  // флот: миграция со старой линейки из пяти судов
  const ver = typeof r.version === "number" ? r.version : 1;
  if (ver < 3) {
    const old = Math.max(0, Math.min(LEGACY_BOAT_IDS.length - 1, (r.boat as number) | 0));
    s.boatsOwned = LEGACY_BOAT_IDS.slice(0, old + 1).map((id) => BOATS.findIndex((b) => b.id === id));
    s.boat = s.boatsOwned[s.boatsOwned.length - 1];
  }
  if (!Array.isArray(s.boatsOwned) || !s.boatsOwned.length) s.boatsOwned = [0];
  if (!s.market || typeof s.market !== "object" || typeof s.market.sold !== "object") s.market = { day: 1, sold: {}, byPort: {} };
  if (!PORT_BY_ID[s.port]) s.port = "home";
  // До версии с отдельным насыщением портов в сохранении был только один
  // счётчик. Сохраняем его за текущим портом и дальше ведём корзины отдельно.
  if (!s.market.byPort || typeof s.market.byPort !== "object") s.market.byPort = {};
  if (!s.market.byPort[s.port]) s.market.byPort[s.port] = s.market.sold;
  const known = new Set<PortId>(Array.isArray(s.portsKnown) ? s.portsKnown.filter((p) => PORT_BY_ID[p]) : []);
  known.add("home");
  for (const p of PORTS) if (p.serves.some((l) => s.flags.includes(`visit_${l}`))) known.add(p.id);
  s.portsKnown = [...known];
  if (typeof s.lastRest !== "number") s.lastRest = -99999;
  // уже посещённые акватории остаются открытыми
  const un = new Set<LocId>(Array.isArray(s.unlocked) ? s.unlocked.filter((l) => LOC_BY_ID[l]) : []);
  un.add("bay");
  for (const l of LOCATIONS) if (s.flags.includes(`visit_${l.id}`)) un.add(l.id);
  un.add(s.location);
  s.unlocked = [...un];
  if (!s.daily || typeof s.daily !== "object" || !Array.isArray(s.daily.tasks)) s.daily = newDaily();
  for (const c of s.cooler) if (typeof c.at !== "number") c.at = s.minutes;
  s.boatsOwned = [...new Set(s.boatsOwned.filter((i) => i >= 0 && i < BOATS.length))];
  if (!s.boatsOwned.includes(0)) s.boatsOwned.unshift(0);
  if (!BOATS[s.boat] || !s.boatsOwned.includes(s.boat)) s.boat = s.boatsOwned[s.boatsOwned.length - 1];
  s.perks = s.perks && typeof s.perks === "object" ? s.perks : {};
  s.finds = s.finds && typeof s.finds === "object" ? s.finds : {};
  s.achievements = Array.isArray(s.achievements) ? s.achievements : [];
  s.xp = Number.isFinite(s.xp) ? s.xp : 0;
  s.quest = Number.isFinite(s.quest) ? s.quest : 0;
  if (!s.flags.includes("visit_bay")) s.flags.push("visit_bay");
  if (!s.flags.includes(`visit_${s.location}`)) s.flags.push(`visit_${s.location}`);
  s.version = SAVE_VERSION;
  s.atPort = !!r.atPort && !!PORT_BY_ID[s.port];
  s.hook = Math.max(0, Math.min(HOOKS.length - 1, (s.hook as number) | 0));
  s.mods = s.mods && typeof s.mods === "object" ? s.mods : {};
  return s;
}

export const depthToU = (d: number) => Math.log(1 + d / 8);
export const uToDepth = (u: number) => (Math.exp(u) - 1) * 8;
const rid = () => Math.random().toString(36).slice(2, 10);
const ri = (n: number) => Math.floor(Math.random() * n);

export class Engine {
  s: SaveData;
  phase: Phase = "idle";
  paused = true;
  time = 0;
  power = 0;
  powerDir = 1;
  castDist = 0.5;
  castT = 0;
  hookDepth = 0;
  biteTimer = 0;
  biteWindow = 0;
  pendingFish: { fish: FishDef; weight: number; variant: Variant | null } | null = null;
  pendingFind: FindDef | null = null;
  lastFind: { def: FindDef; isNew: boolean } | null = null;
  letter: number | null = null;
  biteWindowMax = 1;
  private lastDay = -1;
  hooked: Hooked | null = null;
  reeling = false;
  pullDir: -1 | 0 | 1 = 0;
  keyDir: -1 | 0 | 1 = 0;
  lastCatch: CatchResult | null = null;
  /** лента мелких сообщений */
  toasts: Toast[] = [];
  /** крупное сообщение (одно за раз) */
  banner: Toast | null = null;
  private bannerQueue: Toast[] = [];
  tipNow: Toast | null = null;
  private tipQueue: Toast[] = [];
  hasLetter = false;
  sfx: Sfx[] = [];
  fade = 0;
  lightning = 0;
  splash = 0;
  shake = 0;
  bottomHit = false;
  noFishTimer = 0;
  dirty = false;
  onCatchLogged?: (c: CaughtFish) => void;
  private toastId = 1;
  private listeners = new Set<() => void>();

  constructor(save?: SaveData) {
    this.s = save ?? newSave();
  }

  // ─────────── derived ───────────
  get day() { return Math.floor(this.s.minutes / MIN_PER_DAY) + 1; }
  get hour() { return (this.s.minutes % MIN_PER_DAY) / 60; }
  get season(): Season { return (Math.floor((this.day - 1) / DAYS_PER_SEASON) % 4) as Season; }
  get dayOfSeason() { return ((this.day - 1) % DAYS_PER_SEASON) + 1; }
  get year() { return Math.floor((this.day - 1) / (DAYS_PER_SEASON * 4)) + 1; }
  get moonIndex() { return (this.day - 1) % 8; }
  get loc() { return LOC_BY_ID[this.s.location]; }
  get spot() { return SPOT_BY_ID[this.s.spot] ?? spotsOf(this.s.location)[0]; }
  get boat() { return BOATS[this.s.boat] ?? BOATS[0]; }
  /** Высший класс среди судов во владении */
  get fleetTier() { return Math.max(...this.s.boatsOwned.map((i) => BOATS[i]?.tier ?? 0)); }
  get rod() { return RODS[this.s.rod]; }
  get reel() { return REELS[this.s.reel]; }
  get line() { return LINES[this.s.line]; }
  get sonar() { return SONARS[this.s.sonar]; }
  get maxDepth() { return Math.min(this.spot.maxDepth, this.line.value); }
  get timeOfDay(): "night" | "twilight" | "day" {
    const h = this.hour;
    if (h < 4.8 || h >= 20.8) return "night";
    if (h < 7.5 || h >= 18.3) return "twilight";
    return "day";
  }
  get isNight() { return this.timeOfDay === "night"; }
  get temperature() {
    const base = { temperate: [12, 24, 13, 2], north: [4, 14, 5, -8], tropic: [27, 31, 28, 25], ocean: [16, 24, 17, 10], polar: [-6, 1, -8, -22], misty: [13, 17, 15, 10] }[this.loc.climate][this.season];
    const diurnal = Math.sin(((this.hour - 9) / 24) * Math.PI * 2) * 4;
    const w = { clear: 1, cloudy: -1, rain: -3, storm: -4, fog: -2, snow: -4 }[this.s.weather];
    return Math.round(base + diurnal + w);
  }
  get activeEvents() { return this.s.events.filter((e) => e.endsAt > this.s.minutes); }
  eventMult(key: "bite" | "rare" | "legendary") {
    let m = 1;
    for (const e of this.activeEvents) m *= EVENT_BY_ID[e.id]?.[key] ?? 1;
    return m;
  }
  perk(id: string) { return this.s.perks[id] ?? 0; }
  get level() { return levelFromXp(this.s.xp); }
  get perkPoints() { return perkPoints(this.s); }
  get coolerCap() { return this.boat.cooler + this.perk("cooler") * 2; }
  get coolerFull() { return this.s.cooler.length >= this.coolerCap; }
  mod(id: string) { return this.s.mods[id] ?? 0; }
  get hookGear() { return HOOKS[this.s.hook] ?? HOOKS[0]; }
  get rodPower() { return this.rod.value * (1 + this.perk("grip") * 0.05 + this.mod("rod_blank") * 0.05); }
  get title() { return levelTitle(this.level); }
  /** Штормовой бонус силы рыбы с учётом судна и навыка */
  get stormPenalty() {
    if (this.s.weather !== "storm") return 1;
    const base = this.boat.stormSafe ? 0.08 : 0.3;
    const w = this.perk("weather");
    return 1 + base * (1 - this.boat.stability * 0.6) * (w >= 3 ? 0 : w >= 2 ? 0.5 : 1);
  }
  get forecast() { return { w: this.s.weatherQueued, inMin: Math.max(0, this.s.weatherNext - this.s.minutes) }; }

  /** нормализованная X-координата поплавка (0..1 ширины экрана) */
  castNX(d = this.castDist) { return 0.34 + d * 0.42; }
  bedAt(nx: number) { return this.spot.maxDepth * bedFrac(this.spot, nx); }

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }
  emit() { this.listeners.forEach((f) => f()); }
  markDirty() { this.dirty = true; this.emit(); }

  toast(text: string, kind: Toast["kind"] = "info", sub?: string) {
    const n: Toast = { id: this.toastId++, text, sub, kind, t: this.time };
    if (kind === "legend") {
      if (!this.bannerQueue.some((b) => b.text === text)) this.bannerQueue.push(n);
    } else if (kind === "tip") {
      this.tipQueue.push(n);
    } else {
      if (this.toasts.some((x) => x.text === text && this.time - x.t < 4)) return;
      this.toasts.push(n);
      if (this.toasts.length > 3) this.toasts.shift();
    }
    this.emit();
  }

  get calm() {
    return !this.paused && (this.phase === "idle" || this.phase === "waiting" || this.phase === "sinking");
  }

  private tickNotices() {
    let changed = false;
    const before = this.toasts.length;
    this.toasts = this.toasts.filter((t) => this.time - t.t < LOG_TIME);
    if (before !== this.toasts.length) changed = true;
    if (this.banner && this.time - this.banner.t > BANNER_TIME) { this.banner = null; changed = true; }
    if (!this.banner && this.bannerQueue.length && this.calm) {
      this.banner = { ...this.bannerQueue.shift()!, t: this.time };
      changed = true;
    }
    if (this.tipNow && this.time - this.tipNow.t > TIP_TIME) { this.tipNow = null; changed = true; }
    if (!this.tipNow && this.tipQueue.length && !this.paused && this.phase !== "bite" && !this.banner) {
      this.tipNow = { ...this.tipQueue.shift()!, t: this.time };
      changed = true;
    }
    if (changed) this.emit();
  }

  dismissTip() { this.tipNow = null; this.emit(); }

  tip(flag: string, text: string) {
    if (this.s.flags.includes(flag)) return;
    this.s.flags.push(flag);
    this.toast(text, "tip");
    this.dirty = true;
  }

  // ─────────── main loop ───────────
  update(dt: number) {
    this.time += dt;
    this.fade = Math.max(0, this.fade - dt * 0.8);
    this.lightning = Math.max(0, this.lightning - dt * 2.5);
    this.splash = Math.max(0, this.splash - dt * 1.5);
    this.shake = Math.max(0, this.shake - dt * 2);
    this.tickNotices();
    if (this.paused) return;

    const wdt = dt;

    this.s.stats.playSeconds += dt;
    if (this.day !== this.lastDay) {
      if (this.lastDay > 0) {
        const newSeason = this.dayOfSeason === 1;
        if (newSeason) this.toast(`Наступила ${["весна", "лето", "осень", "зима"][this.season]}`, "event", "Меняются привычки рыбы и погода");
      }
      this.lastDay = this.day;
    }
    const prevHour = Math.floor(this.hour);
    this.s.minutes += wdt * TIME_SCALE;
    if (Math.floor(this.hour) !== prevHour) {
      this.dirty = true;
      this.emit();
    }
    this.tickWorld();

    if (this.s.weather === "storm" && Math.random() < wdt * 0.12) {
      this.lightning = 1;
      this.shake = Math.max(this.shake, 0.1);
      this.sfx.push("thunder");
    }

    switch (this.phase) {
      case "charging":
        this.power += this.powerDir * dt * 1.15;
        if (this.power >= 1) { this.power = 1; this.powerDir = -1; }
        if (this.power <= 0) { this.power = 0; this.powerDir = 1; }
        break;
      case "casting":
        this.castT += dt / 0.75;
        if (this.castT >= 1) {
          this.castT = 1;
          this.phase = "sinking";
          this.splash = 1;
          this.hookDepth = 0;
          this.bottomHit = false;
          this.sfx.push("splash");
        }
        break;
      case "sinking": {
        const bed = this.bedAt(this.castNX()) - 0.3;
        const target = Math.min(this.s.targetDepth, this.maxDepth, bed);
        const u = depthToU(this.hookDepth) + dt * 1.3;
        this.hookDepth = Math.min(target, uToDepth(u));
        if (this.hookDepth >= target - 0.01) {
          if (this.s.targetDepth > bed && !this.bottomHit) {
            this.bottomHit = true;
            this.sfx.push("bottom");
            this.toast(`Грузило на дне — ${bed.toFixed(bed < 10 ? 1 : 0)} м`, "info");
            if (this.spot.profile !== "flat" && this.spot.profile !== "wreck") this.tip("tip_bottom", "Дно здесь неровное: чем дальше заброс, тем глубже (или мельче — смотри рельеф).");
          }
          this.startWaiting();
        }
        break;
      }
      case "waiting":
        this.biteTimer -= wdt;
        if (this.biteTimer <= 0) this.tryBite();
        break;
      case "bite":
        this.biteWindow -= dt;
        if (this.biteWindow <= 0) {
          this.consumeBait("miss");
          this.toast(this.pendingFind ? "Что-то зацепилось и соскользнуло" : "Поздняя подсечка — наживка сорвана", "bad");
          this.pendingFish = null;
          this.pendingFind = null;
          this.startWaiting();
        }
        break;
      case "fight":
        this.updateFight(dt);
        break;
    }
  }

  private tickWorld() {
    const s = this.s;
    if (s.minutes >= s.weatherNext) {
      const prev = s.weather;
      s.weather = s.weatherQueued;
      s.weatherQueued = nextWeather(s.weather, this.season, this.loc.climate, Math.random);
      s.weatherNext = s.minutes + 120 + Math.random() * 240;
      s.wind = Math.min(1, Math.max(0, WEATHER_INFO[s.weather].wave * 0.35 + (Math.random() - 0.5) * 0.3));
      const noEvent = !this.activeEvents.some((e) => e.id !== "bottle");
      if (noEvent && Math.random() < 0.35 && (prev === "rain" || prev === "storm") && (s.weather === "clear" || s.weather === "cloudy") && this.timeOfDay === "day" && this.loc.id !== "abyss") {
        s.events.push({ id: "rainbow", endsAt: s.minutes + 90 });
        this.toast("Радуга над водой", "event", "Редкие виды клюют охотнее");
      }
      if (prev !== s.weather && (s.weather === "storm" || s.weather === "fog" || prev === "storm")) {
        if (s.weather === "storm") this.toast("Надвигается шторм", "bad", this.boat.stormSafe ? "Судно выдержит. Рыба активна" : "Лёгкую лодку качает — рыба рвёт сильнее");
        else if (s.weather === "fog") this.toast("Опускается туман", "info");
        else this.toast("Шторм стихает", "info");
      }
      this.markDirty();
    }
    if (s.minutes >= s.nextEventAt) {
      s.nextEventAt = s.minutes + 520 + Math.random() * 640;
      const busyEvent = this.activeEvents.some((e) => e.id !== "bottle");
      if (!s.atPort && !busyEvent && Math.random() < 0.75) this.rollEvent();
    }
    s.events = s.events.filter((e) => e.endsAt > s.minutes);
  }

  rollEvent() {
    const ctx = { night: this.isNight, weather: this.s.weather, loc: this.s.location, season: this.season };
    const pool = EVENTS.filter((e) => !e.requires || e.requires(ctx)).filter((e) => !this.s.events.some((a) => a.id === e.id));
    if (!pool.length) return;
    const ev = pool[ri(pool.length)];
    this.sfx.push("event");
    if (ev.id === "bottle") {
      const uncaught = FISH.filter((f) => !this.s.codex[f.id] && !this.s.hints.includes(f.id));
      if (uncaught.length && Math.random() < 0.6) {
        const f = uncaught[ri(uncaught.length)];
        this.s.hints.push(f.id);
        this.toast("Бутылка с запиской", "event", `Заметки о виде «${f.name}» — в кодексе`);
      } else {
        const coins = Math.round((40 + Math.random() * 160) * (1 + this.loc.boatTier * 1.5));
        this.s.money += coins;
        this.toast("Бутылка у борта", "event", `Внутри старинные монеты: +${coins} ₽`);
      }
    } else {
      this.s.events.push({ id: ev.id, endsAt: this.s.minutes + ev.duration } as ActiveEvent);
      this.toast(ev.name, "event", ev.desc);
    }
    this.markDirty();
  }

  // ─────────── input ───────────
  pointerDown() {
    if (this.paused) return;
    switch (this.phase) {
      case "idle":
        if (this.coolerFull) {
          this.toast("Садок полон", "bad", "Вернитесь в порт [P]");
          return;
        }
        this.phase = "charging";
        this.power = 0;
        this.powerDir = 1;
        break;
      case "sinking":
      case "waiting":
        this.phase = "idle";
        this.hookDepth = 0;
        this.sfx.push("reelIn");
        break;
      case "bite":
        this.hook();
        break;
      case "fight":
        this.reeling = true;
        break;
    }
  }

  setPointerDir(d: -1 | 0 | 1) {
    this.pullDir = this.keyDir || d;
  }

  pointerUp() {
    if (this.phase === "charging") {
      this.castDist = 0.15 + this.power * 0.85;
      this.castT = 0;
      this.phase = "casting";
      this.sfx.push("cast");
      this.tip("tip_depth", "Глубина задаётся колесом мыши или клавишами W / S. Каждый вид держится своего горизонта.");
    }
    this.reeling = false;
    this.pullDir = this.keyDir;
  }

  setDepth(d: number) {
    this.s.targetDepth = Math.max(1, Math.min(this.maxDepth, Math.round(d)));
    this.emit();
  }

  setBait(b: BaitId) {
    if (b !== "worm" && !(this.s.baits[b] ?? 0)) return;
    this.s.currentBait = b;
    this.markDirty();
  }


  // ─────────── fishing ───────────
  private startWaiting() {
    this.phase = "waiting";
    const timeMult = { twilight: 1.35, night: 1.0, day: 0.9 }[this.timeOfDay];
    const bd = this.bait;
    const inRange = this.hookDepth >= bd.depth[0] && this.hookDepth <= bd.depth[1];
    const bite = WEATHER_INFO[this.s.weather].bite * this.eventMult("bite") * timeMult * bd.bite * (inRange ? 1 : 0.6);
    this.biteTimer = (3 + Math.random() * 9) / bite / (1 + this.perk("patience") * 0.06 + this.mod("line_fluoro") * 0.05) / this.boat.quiet;
  }

  candidates(depth = this.hookDepth): { fish: FishDef; w: number }[] {
    const s = this.s;
    const tod = this.timeOfDay;
    const currentEv = this.activeEvents.some((e) => e.id === "current");
    const bait = s.currentBait;
    const spot = this.spot;
    const res: { fish: FishDef; w: number }[] = [];
    const bd = BAIT_BY_ID[bait];
    for (const f of FISH) {
      if (!f.loc.includes(s.location)) continue;
      const minD = currentEv ? f.depth[0] * 0.6 : f.depth[0];
      if (depth < minD - 0.5 || depth > f.depth[1] + 0.5) continue;
      if (f.time !== "any" && f.time !== tod) continue;
      if (f.weather && !f.weather.includes(s.weather)) continue;
      if (f.season && !f.season.includes(this.season)) continue;
      if (f.moon === "full" && this.moonIndex !== 4) continue;
      if (f.moon === "new" && this.moonIndex !== 0) continue;
      let w: number = RARITY_INFO[f.rarity].weight;
      if (spot.bias.includes(f.id)) w *= f.rarity === "legendary" ? 3 : 2.5;
      if (f.rarity !== "common" && f.rarity !== "uncommon") w *= 1 + this.perk("luck") * 0.07 + this.boat.rareBonus + this.mod("hook_stealth") * 0.03;
      if (f.rarity === "rare" || f.rarity === "epic") w *= this.eventMult("rare");
      if (f.rarity === "legendary") {
        w *= this.eventMult("legendary") * this.eventMult("rare");
        if (this.baitMatch(f, bait) < 2) w *= 0.15;
      }
      w *= this.baitMatch(f, bait);
      if (f.rarity !== "common" && f.rarity !== "uncommon") w *= bd.rarity;
      // крупная наживка отсекает мелочь, мелкая — не интересна гигантам
      const sz = Math.max(0, Math.min(1, (Math.log10((f.weight[0] + f.weight[1]) / 2) + 2) / 4.5));
      w *= Math.max(0.15, 1 + bd.size * (sz - 0.45) * 1.8);
      if (depth < bd.depth[0] || depth > bd.depth[1]) w *= 0.7;
      if (depth > 200) {
        if (bait === "glow" && f.glow) w *= 2.5;
        if (bait !== "glow" && f.glow) w *= 0.3;
      }
      const entry = s.codex[f.id];
      if (!entry) w *= 1.35;
      else if (f.rarity === "common") w /= 1 + entry.count * 0.03;
      res.push({ fish: f, w });
    }
    // Нормировка: большая стая обычных видов не должна вытеснять редких
    const tierCount: Record<string, number> = {};
    for (const r of res) tierCount[r.fish.rarity] = (tierCount[r.fish.rarity] ?? 0) + 1;
    for (const r of res) r.w /= Math.sqrt(tierCount[r.fish.rarity]);
    return res;
  }

  get bait() { return BAIT_BY_ID[this.s.currentBait] ?? BAIT_BY_ID.worm; }

  /** Насколько наживка подходит виду: 3.2 — любимая, 2.2 — похожая, 1 — любая */
  baitMatch(f: FishDef, bait: BaitId) {
    if (!f.bait?.length) return 1.4;
    if (f.bait.includes(bait)) return 3.2;
    const m = BAIT_BY_ID[bait]?.mimics;
    if (m && m.some((x) => f.bait!.includes(x))) return 2.2;
    return 1;
  }

  sonarScan(bands = 18): SonarBand[] {
    const out: SonarBand[] = [];
    const maxU = depthToU(this.spot.maxDepth);
    const order: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];
    for (let i = 0; i < bands; i++) {
      const d = uToDepth((maxU * (i + 0.5)) / bands);
      const c = this.candidates(d);
      let best: Rarity | null = null;
      let fresh = 0;
      let legend = false;
      for (const x of c) {
        if (!this.s.codex[x.fish.id]) fresh++;
        if (x.fish.rarity === "legendary") legend = true;
        else if (!best || order.indexOf(x.fish.rarity) > order.indexOf(best)) best = x.fish.rarity;
      }
      out.push({ depth: d, count: c.length, fresh, best, legend });
    }
    return out;
  }

  private tryBite() {
    const findChance = 0.035 * (1 + this.perk("scout") * 0.25);
    if (Math.random() < findChance) {
      const pool = FINDS.filter((f) => f.loc.includes(this.s.location) && this.hookDepth >= f.minDepth);
      if (pool.length) {
        const tot = pool.reduce((a, f) => a + f.weight * (this.s.finds[f.id] ? 1 : 1.6), 0);
        let r = Math.random() * tot;
        let pick = pool[0];
        for (const f of pool) { r -= f.weight * (this.s.finds[f.id] ? 1 : 1.6); if (r <= 0) { pick = f; break; } }
        this.pendingFind = pick;
        this.pendingFish = null;
        this.phase = "bite";
        this.biteWindow = this.biteWindowMax = 1.3 * (1 + this.perk("hands") * 0.08 + this.mod("line_braid") * 0.06);
        this.splash = 0.35;
        this.sfx.push("bite");
        this.emit();
        return;
      }
    }
    const c = this.candidates();
    if (!c.length) {
      this.noFishTimer++;
      if (this.noFishTimer === 2) this.toast("Здесь сейчас тихо", "info", "Смените глубину, наживку или точку");
      this.biteTimer = 6 + Math.random() * 6;
      return;
    }
    this.noFishTimer = 0;
    const total = c.reduce((a, b) => a + b.w, 0);
    let r = Math.random() * total;
    let pick = c[0].fish;
    for (const x of c) {
      r -= x.w;
      if (r <= 0) { pick = x.fish; break; }
    }
    const rr = Math.random();
    const weight = +(pick.weight[0] + (pick.weight[1] - pick.weight[0]) * Math.pow(rr, 1.7 - this.bait.size * 0.45)).toFixed(pick.weight[1] < 1 ? 3 : 2);
    let variant: Variant | null = null;
    const v = Math.random() / (1 + this.perk("luck") * 0.1);
    if (v < 0.004) variant = "golden";
    else if (v < 0.016) variant = "albino";
    else if (v < 0.026) variant = "melanist";
    else if (v < 0.056) variant = "scarred";
    else if (rr > 0.93) variant = "trophy";
    this.pendingFish = { fish: pick, weight, variant };
    this.phase = "bite";
    this.biteWindow = this.biteWindowMax = { common: 1.3, uncommon: 1.15, rare: 1.0, epic: 0.9, legendary: 0.8 }[pick.rarity] * (1 + this.perk("hands") * 0.08 + this.mod("line_braid") * 0.06);
    this.splash = 0.5;
    this.sfx.push("bite");

    this.emit();
  }

  /** Расход наживки: miss — сорвали, hook — рыба поймана на крючок, snap — обрыв */
  private consumeBait(reason: "miss" | "hook" | "snap" = "hook") {
    const b = this.s.currentBait;
    if (b === "worm") return;
    const bd = BAIT_BY_ID[b];
    if (reason !== "snap") {
      if (bd.kind !== "natural" && reason === "miss") return;
      if (Math.random() < bd.durable) return;
    }
    // живорыбный колодец бережёт живую наживку
    if ((b === "livebait" || b === "squid") && this.boat.baitWell > 0 && Math.random() < this.boat.baitWell * 0.25 + 0.25) return;
    const n = (this.s.baits[b] ?? 0) - 1;
    this.s.baits[b] = Math.max(0, n);
    if (n <= 0) {
      this.s.currentBait = "worm";
      this.toast(`${BAIT_BY_ID[b].name}: запас исчерпан`, "info", "Насажен червь");
    }
    this.dirty = true;
  }

  perfectHook = false;
  get biteProgress() { return 1 - this.biteWindow / this.biteWindowMax; }

  private hook() {
    if (this.pendingFind) return this.registerFind(this.pendingFind);
    const p = this.pendingFish;
    if (!p) return;
    this.consumeBait();
    this.perfectHook = this.biteProgress < 0.42 * (1 + this.mod("hook_sharpen") * 0.12) + this.s.hook * 0.02;
    const f = p.fish;
    const wNorm = (p.weight - f.weight[0]) / Math.max(0.0001, f.weight[1] - f.weight[0]);
    let power = 1.2 * Math.pow(f.strength, 1.6) * (0.7 + 0.6 * wNorm);
    if (f.rarity === "legendary") power *= 1.25;
    else if (f.rarity === "epic") power *= 1.1;
    if (p.variant === "trophy") power *= 1.15;
    power *= this.stormPenalty;
    const startLine = this.hookDepth + 6 + this.castDist * 14;
    this.hooked = {
      fish: f,
      weight: p.weight,
      variant: p.variant,
      power,
      stamina: this.perfectHook ? 78 : 100,
      line: startLine,
      startLine,
      startDepth: this.hookDepth,
      tension: 0.3,
      intensity: 0.3,
      targetIntensity: 0.2,
      modeTimer: 0.9 + Math.random() * 0.5,
      running: false,
      overload: 0,
      slack: 0,
      sway: 0,
      swayV: Math.random() < 0.5 ? -1 : 1,
      countering: false,
      jumper: isJumper(f),
      jump: 0,
      jumpCD: 3,
    };
    this.pendingFish = null;
    this.phase = "fight";
    this.splash = 0.8;
    this.shake = Math.max(this.shake, 0.08 + f.strength * 0.015);
    this.sfx.push("hook");
    if (this.perfectHook) {
      this.s.stats.perfectHooks++;
      this.sfx.push("perfect");
    } else this.tip("tip_perfect", "Подсечка в первые мгновения поклёвки — пока кольцо у поплавка светлое — сразу утомляет рыбу.");
    this.tip("tip_fight", "Удерживайте кнопку, чтобы подматывать; отпустите, чтобы стравить. Не держите натяжение в красной зоне.");
    this.emit();
  }

  private updateFight(dt: number) {
    const h = this.hooked;
    if (!h) return;
    h.modeTimer -= dt;
    h.jumpCD -= dt;
    if (h.modeTimer <= 0) {
      h.running = !h.running;
      const tired = h.stamina / 100;
      if (h.running) {
        h.targetIntensity = (0.65 + Math.random() * 0.35) * (0.35 + 0.65 * tired);
        h.modeTimer = 0.6 + Math.random() * 1.6 * (0.5 + tired);
        h.swayV = (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.5);
        this.tip("tip_counter", "При рывке уводите удилище в противоположную сторону: A / D или курсор к краю экрана.");
      } else {
        h.targetIntensity = 0.08 + Math.random() * 0.2;
        h.modeTimer = 0.8 + Math.random() * 1.8 * (1.4 - tired);
      }
    }
    h.intensity += (h.targetIntensity - h.intensity) * Math.min(1, dt * (h.running ? 11 : 5));
    const rare = h.fish.rarity === "legendary" ? 2 : h.fish.rarity === "epic" ? 1.5 : 1;
    if (h.running && Math.random() < dt * 1.2 * rare) {
      h.intensity = Math.min(1.25, h.intensity + (0.3 + Math.random() * 0.25) * (1 - this.mod("rod_guides") * 0.08));
      if (h.fish.strength >= 7) this.shake = Math.max(this.shake, 0.08);
    }
    h.sway += (h.swayV - h.sway) * dt * 2;

    // прыжок
    if (h.jump > 0) {
      h.jump -= dt;
      if (h.jump <= 0) {
        this.splash = 1;
        this.sfx.push("splash");
        this.s.stats.jumps++;
        this.dailyEvent({ k: "jump" });
      }
    } else if (h.jumper && h.running && h.jumpCD <= 0 && this.hookDepth < 14 && h.stamina > 15 && Math.random() < dt * 0.6) {
      h.jump = JUMP_TIME;
      h.jumpCD = 5 + Math.random() * 6;
      this.splash = 1;
      this.shake = Math.max(this.shake, 0.12);
      this.sfx.push("jump");
      this.tip("tip_jump", "Пока рыба в воздухе, не подматывайте — иначе крючок вырвет.");
    }
    const jumping = h.jump > 0;

    const rod = this.rodPower;
    const staminaF = 0.35 + 0.65 * (h.stamina / 100);
    const pull = h.power * (0.25 + 0.75 * h.intensity) * staminaF * (this.reeling ? 1.0 : 0.5);
    const side = h.running ? Math.sign(h.swayV) : 0;
    let dirMod = 1;
    if (side !== 0) dirMod = this.pullDir === -side ? 0.75 - this.mod("rod_grip") * 0.045 : this.pullDir === side ? 1.3 : 1.1;
    h.countering = side !== 0 && this.pullDir === -side;
    const jumpMod = jumping ? (this.reeling ? 2.1 * (1 - this.s.hook * 0.12) : 0.25) : 1;
    const targetT = (pull / rod) * dirMod * jumpMod + (this.reeling ? 0.12 : 0);
    h.tension += (targetT - h.tension) * Math.min(1, dt * 9);

    if (h.tension > 1) {
      h.overload += dt;
      if (h.overload > 0.38 * (1 + this.mod("reel_drag") * 0.18)) return this.endFight("snap");
    } else {
      h.overload = Math.max(0, h.overload - dt * 0.8);
    }

    const reelSpeed = this.reel.value * (2.6 + h.line * 0.05) * (1 + this.mod("reel_bearings") * 0.08);
    if (this.reeling && !jumping) h.line -= reelSpeed * (1 - h.intensity * 0.75 * (1 - this.mod("reel_ratio") * 0.1)) * dt;
    if (h.intensity > 0.45 && !jumping) h.line += (h.intensity - 0.45) * 2 * (h.power / rod) * (2.5 + h.line * 0.04) * dt;

    const drain = (4 + 26 * Math.min(1.2, h.tension)) * (14 / (h.fish.strength + 4)) * (h.fish.rarity === "legendary" ? 0.7 : 1);
    h.stamina = Math.max(0, h.stamina - drain * dt * 0.55 * (h.countering ? 1.5 : 1) * (1 + this.perk("stamina") * 0.06) - (jumping && !this.reeling ? dt * 7 : 0));

    if (!this.reeling && !jumping && h.tension < 0.14) {
      h.slack += dt;
      if (h.slack > 3.2 + this.s.hook * 0.55) return this.endFight("escape");
    } else h.slack = Math.max(0, h.slack - dt * 2);

    if (h.line > h.startLine * 1.6 + 15) return this.endFight("escape");
    this.hookDepth = Math.max(0, h.startDepth * Math.min(1, h.line / h.startLine));
    if (h.line <= 1.2 && !jumping) this.endFight("caught");
  }

  private endFight(result: "snap" | "escape" | "caught") {
    const h = this.hooked;
    this.hooked = null;
    this.reeling = false;
    this.hookDepth = 0;
    if (!h) return;
    if (result === "snap") {
      this.s.stats.linesSnapped++;
      this.dailyEvent({ k: "snap" });
      this.consumeBait("snap");
      this.phase = "idle";
      this.sfx.push("snap");
      this.shake = 0.18;
      const rig = this.rigCost;
      const paid = Math.min(rig, this.s.money);
      this.s.money -= paid;
      this.s.stats.gearLost = (this.s.stats.gearLost ?? 0) + paid;
      this.toast("Обрыв лески", "bad", `${h.fish.rarity === "legendary" || h.fish.rarity === "epic" ? "Что-то очень крупное ушло на глубину" : "Слишком сильное натяжение"} · оснастка −${paid} ₽`);
    } else if (result === "escape") {
      this.s.stats.escaped++;
      this.dailyEvent({ k: "escape" });
      this.phase = "idle";
      this.sfx.push("escape");
      this.toast("Сход", "bad", "Леска ослабла — рыба освободилась");
    } else {
      this.registerCatch(h);
    }
    this.markDirty();
  }

  private registerCatch(h: Hooked) {
    const f = h.fish;
    const mult = h.variant ? VARIANT_INFO[h.variant].mult : 1;
    // Ставка за рыбу плюс вес по цене вида: даже мелкий бычок стоит своих денег.
    const value = Math.max(1, Math.round((RARITY_INFO[f.rarity].base + h.weight * f.price) * mult));
    const item: CaughtFish = { uid: rid(), fishId: f.id, weight: h.weight, variant: h.variant, value, day: this.day, loc: this.s.location, at: this.s.minutes };
    const entry = this.s.codex[f.id];
    const isNew = !entry;
    const isRecord = !!entry && h.weight > entry.maxWeight;
    let bonus = 0;
    if (isNew) {
      bonus = RARITY_INFO[f.rarity].bonus;
      this.s.codex[f.id] = { count: 1, maxWeight: h.weight, firstDay: this.day, variants: h.variant ? [h.variant] : [] };
      this.s.money += bonus;
      this.s.hints = this.s.hints.filter((x) => x !== f.id);
    } else {
      entry.count++;
      entry.maxWeight = Math.max(entry.maxWeight, h.weight);
      if (h.variant && !entry.variants.includes(h.variant)) entry.variants.push(h.variant);
    }
    this.s.stats.totalCaught++;
    if (this.isNight) this.s.stats.nightCatches++;
    if (this.s.weather === "storm") this.s.stats.stormCatches++;
    this.s.stats.maxDepthCaught = Math.max(this.s.stats.maxDepthCaught, h.startDepth);
    const wN = (h.weight - f.weight[0]) / Math.max(0.001, f.weight[1] - f.weight[0]);
    const xp = Math.round({ common: 10, uncommon: 22, rare: 55, epic: 140, legendary: 450 }[f.rarity] * (1 + wN * 0.6) * (h.variant ? 1.5 : 1) + (isNew ? 40 : 0) + (this.perfectHook ? 5 : 0)) * (1 + this.loc.boatTier * 0.45) | 0;
    this.addXp(xp);
    const big = this.s.stats.biggest;
    if (!big || h.weight > big.weight) this.s.stats.biggest = { fishId: f.id, weight: h.weight };
    this.lastCatch = { item, isNew, isRecord, bonus, xp, perfect: this.perfectHook };
    this.dailyEvent({ k: "catch", fish: f.id, rarity: f.rarity, weight: h.weight, loc: this.s.location, variant: !!h.variant, perfect: this.perfectHook, night: this.isNight, weather: this.s.weather, depth: h.startDepth, isNew, bait: this.s.currentBait, spot: this.s.spot, hour: this.hour, record: isRecord, shape: f.shape, value, season: this.season });
    if (this.perfectHook) this.s.stats.perfectHooks += 0;
    this.phase = "caught";
    this.splash = 1;
    this.sfx.push(f.rarity === "legendary" ? "legend" : isNew ? "newSpecies" : "catch");

    this.checkMilestones();
    this.checkProgress();
    this.onCatchLogged?.(item);
    if (this.s.stats.totalCaught === 1) this.tip("tip_codex", "Новые виды заносятся в кодекс [C] вместе с условиями, при которых они были пойманы.");
  }

  private checkMilestones() {
    const n = Object.keys(this.s.codex).length;
    for (const m of MILESTONES) {
      if (n >= m.count && !this.s.milestones.includes(m.count)) {
        this.s.milestones.push(m.count);
        this.s.money += m.reward;
        this.toast(`Звание «${m.title}»`, "legend", `Кодекс: ${n} видов · +${m.reward.toLocaleString("ru")} ₽`);
      }
    }
  }

  addXp(n: number) {
    const before = this.level;
    this.s.xp += n;
    const after = this.level;
    if (after > before) {
      let reward = 0;
      for (let l = before + 1; l <= after; l++) reward += levelReward(l);
      this.s.money += reward;
      this.sfx.push("levelUp");
      const newTitle = levelTitle(after) !== levelTitle(before);
      this.toast(newTitle ? `Уровень ${after} · «${levelTitle(after)}»` : `Уровень ${after}`, "legend", `+${reward.toLocaleString("ru")} ₽${this.perkPoints > 0 ? " · очки навыков в журнале" : ""}`);
    }
  }

  private registerFind(def: FindDef) {
    this.pendingFind = null;
    const isNew = !this.s.finds[def.id];
    this.s.finds[def.id] = (this.s.finds[def.id] ?? 0) + 1;
    this.lastFind = { def, isNew };
    this.phase = "caught";
    this.splash = 0.6;
    this.sfx.push("find");
    this.addXp(isNew ? 60 : 15);
    this.markDirty();
  }

  takeFind() {
    const f = this.lastFind;
    if (!f) return;
    const v = Math.round(f.def.value * (1 + this.perk("trader") * 0.04));
    this.dailyEvent({ k: "find" });
    this.s.money += v;
    this.s.stats.totalEarned += v;
    this.lastFind = null;
    this.phase = "idle";
    this.sfx.push("coins");
    this.checkProgress();
    this.markDirty();
  }

  /** Почему нельзя изучить следующий ранг (или null) */
  perkBlock(id: string): string | null {
    const p = PERKS.find((x) => x.id === id);
    if (!p) return "—";
    const r = this.perk(id) + 1;
    if (r > p.max) return "Освоено";
    if (this.level < RANK_LEVEL[r]) return `Нужен ${RANK_LEVEL[r]} уровень`;
    if (this.perkPoints < rankCost(r)) return `Нужно очков: ${rankCost(r)}`;
    return null;
  }

  buyPerk(id: string) {
    if (this.perkBlock(id)) return false;
    this.s.perks[id] = this.perk(id) + 1;
    this.sfx.push("buy");
    this.markDirty();
    return true;
  }

  /** Потеря поводка, крючка и грузила при обрыве */
  get rigCost() { return Math.round((8 + Math.pow(this.s.line + this.s.rod + this.s.hook * 0.5 + 1, 2) * 9) * (1 - this.mod("line_leader") * 0.2)); }

  get respecCost() { return Math.round(500 + spentPoints(this.s.perks) * 350 + this.level * 200); }

  respec() {
    const c = this.respecCost;
    if (!Object.keys(this.s.perks).length || this.s.money < c) return false;
    this.s.money -= c;
    this.s.perks = {};
    this.sfx.push("buy");
    this.markDirty();
    return true;
  }

  checkProgress() {
    const s = this.s;
    this.checkUnlocks();
    for (const a of ACHIEVEMENTS) {
      if (!s.achievements.includes(a.id) && a.check(s)) {
        s.achievements.push(a.id);
        s.money += a.reward;
        this.toast(a.name, "legend", `Достижение · +${a.reward.toLocaleString("ru")} ₽`);
        this.sfx.push("quest");
      }
    }
    let guard = 0;
    while (s.quest < QUESTS.length && guard++ < 3) {
      const q = QUESTS[s.quest];
      const [a, b] = q.progress(s);
      if (a < b) break;
      s.money += q.reward;
      this.addXp(50 + s.quest * 25);
      this.toast(`«${q.title}»`, "legend", `Письмо выполнено · +${q.reward.toLocaleString("ru")} ₽ · новое письмо в журнале`);
      this.sfx.push("quest");
      s.quest++;
      if (s.quest < QUESTS.length) this.hasLetter = true;
    }
    this.dirty = true;
  }

  keepCatch() {
    if (!this.lastCatch) return;
    if (this.coolerFull) {
      this.toast("Садок полон", "bad", "Отпустите рыбу или продайте улов");
      return;
    }
    this.s.cooler.push(this.lastCatch.item);
    this.lastCatch = null;
    this.phase = "idle";
    const order = this.s.orders.find((o) => o.fishId === this.s.cooler[this.s.cooler.length - 1].fishId);
    if (order && this.orderMatches(order).length >= order.count) this.toast("Заказ собран", "good", `${order.client} — сдать в порту`);
    this.markDirty();
  }

  releaseCatch() {
    if (!this.lastCatch) return;
    this.s.stats.releases++;
    this.dailyEvent({ k: "release" });
    this.addXp(Math.round(this.lastCatch.xp * 0.25));
    this.checkProgress();
    this.lastCatch = null;
    this.phase = "idle";
    this.toast("Рыба отпущена", "info");
    this.markDirty();
  }

  // ─────────── travel ───────────
  travelMinutes(to: LocId) {
    return this.travelMinutesTo(LOC_POS[to]);
  }

  /** Текущая точка на карте */
  get here(): [number, number] {
    return this.s.atPort ? PORT_BY_ID[this.s.port].pos : LOC_POS[this.s.location];
  }
  travelMinutesTo(pt: [number, number], from = this.here) {
    return Math.round(travelHoursBetween(from, pt) * this.boat.travelMult * (1 - this.perk("navigator") * 0.1) * 60);
  }
  /** Стоимость топлива на переход */
  fuelCost(to: LocId) {
    return Math.round((this.travelMinutes(to) / 60) * this.boat.fuel);
  }
  fuelTo(pt: [number, number], from = this.here) {
    return Math.round((this.travelMinutesTo(pt, from) / 60) * this.boat.fuel);
  }
  get port() { return PORT_BY_ID[this.s.port] ?? PORTS[0]; }
  /** Ближайший известный порт к текущей акватории */
  nearestPort(): PortId {
    const own = portOf(this.s.location);
    if (own && this.s.portsKnown.includes(own.id)) return own.id;
    const here = LOC_POS[this.s.location];
    let best: PortId = "home", bd = Infinity;
    for (const id of this.s.portsKnown) {
      const d = travelHoursBetween(here, PORT_BY_ID[id].pos);
      if (d < bd) { bd = d; best = id; }
    }
    return best;
  }

  private payFuel(cost: number) {
    if (cost <= 0) return;
    const paid = Math.min(cost, this.s.money);
    this.s.money -= paid;
    this.s.stats.fuelSpent = (this.s.stats.fuelSpent ?? 0) + paid;
  }

  // ─────────── ежедневные задания (реальные сутки) ───────────
  get daily(): DailyState {
    if (!this.s.daily) this.s.daily = newDaily();
    return this.s.daily;
  }
  /** Обновить задания при смене реального дня */
  refreshDaily() {
    if (rollDaily(this.daily, this.s, this.level)) {
      this.toast("Новые задания дня", "event", this.daily.streak ? `Серия: ${this.daily.streak} дн. · бонус +${Math.round((streakBonus(this.daily.streak) - 1) * 100)}%` : "Загляните в журнал");
      this.markDirty();
    }
  }
  dailyEvent(e: DailyEvent) {
    if (this.daily.date !== todayKey()) this.refreshDaily();
    const done = applyDaily(this.daily, e);
    for (const t of done) {
      this.toast(`Задание выполнено`, "good", `${t.title} · заберите награду в журнале`);
      this.sfx.push("quest");
    }
    if (done.length) this.dirty = true;
  }
  claimDaily(id: string) {
    const t = this.daily.tasks.find((x) => x.id === id);
    if (!t || !t.done || t.claimed) return false;
    t.claimed = true;
    const k = streakBonus(this.daily.streak);
    const money = Math.round(t.reward * k);
    this.s.money += money;
    this.addXp(Math.round(t.xp * k));
    this.sfx.push("coins");
    if (this.daily.tasks.every((x) => x.claimed)) {
      const today = todayKey();
      if (this.daily.lastComplete !== today) {
        this.daily.streak += 1;
        this.daily.lastComplete = today;
      }
    }
    this.markDirty();
    return money;
  }
  get dailyChest() { return dailyChestReward(this.level, this.daily.streak); }
  claimDailyChest() {
    const d = this.daily;
    if (d.bonusClaimed || !d.tasks.length || !d.tasks.every((t) => t.claimed)) return false;
    d.bonusClaimed = true;
    const m = this.dailyChest;
    this.s.money += m;
    // сундук дня: немного редкой наживки
    const pool: BaitId[] = this.level >= 25 ? ["squid", "glow", "jig"] : this.level >= 10 ? ["livebait", "cutbait", "jig"] : ["shrimp", "mussel", "livebait"];
    const b = pool[ri(pool.length)];
    const n = b === "glow" ? 2 : b === "jig" ? 2 : 5;
    this.s.baits[b] = (this.s.baits[b] ?? 0) + n;
    this.sfx.push("find");
    this.toast("Сундук дня", "legend", `+${m.toLocaleString("ru")} ₽ · ${BAIT_BY_ID[b].name} ×${n}`);
    this.markDirty();
    return true;
  }
  /** Заменить одно невыполненное задание (раз в день) */
  rerollDaily(id: string) {
    const d = this.daily;
    const i = d.tasks.findIndex((t) => t.id === id);
    if (i < 0 || d.rerolls <= 0 || d.tasks[i].done) return false;
    const fresh = makeTasks(this.s, this.level, d.date, 7 + d.tasks.length + Math.floor(Math.random() * 1000)).find((t) => !d.tasks.some((x) => x.tpl === t.tpl));
    if (!fresh) return false;
    fresh.id = `${d.date}-r-${fresh.tpl}`;
    d.tasks[i] = fresh;
    d.rerolls--;
    this.markDirty();
    return true;
  }

  setName(name: string) {
    const n = name.normalize("NFKC").replace(/\s+/g, " ").trim().slice(0, 24);
    this.s.name = n || "Рыбак";
    this.markDirty();
  }

  isUnlocked(l: LocId) { return this.s.unlocked.includes(l); }
  /** Прогресс открытия акватории */
  unlockState(l: LocId) {
    const u = UNLOCKS[l];
    const codex = Object.keys(this.s.codex).length;
    if (!u) return { ok: true, u: null, reqs: [] as { label: string; ok: boolean; have: string }[] };
    const near = u.from.some((x) => this.isUnlocked(x));
    const reqs = [
      { label: `Разведать: ${u.from.map((x) => LOC_BY_ID[x].name).join(" или ")}`, ok: near, have: near ? "✓" : "—" },
      { label: `Кодекс: ${u.codex} видов`, ok: codex >= u.codex, have: `${Math.min(codex, u.codex)}/${u.codex}` },
      { label: `Уровень ${u.level}`, ok: this.level >= u.level, have: `${Math.min(this.level, u.level)}/${u.level}` },
    ];
    return { ok: reqs.every((r) => r.ok), u, reqs };
  }
  /** Проверить, не открылись ли новые акватории */
  checkUnlocks() {
    for (const l of LOCATIONS) {
      if (this.isUnlocked(l.id)) continue;
      if (!this.unlockState(l.id).ok) continue;
      this.s.unlocked.push(l.id);
      const need = l.boatTier > this.fleetTier;
      this.toast(`Разведано: ${l.name}`, "legend", need ? `Нужно судно класса ${l.boatTier + 1}` : "Отмечено на карте");
      this.sfx.push("event");
    }
  }

  /** Точка назначения поездки */
  tripPoint(t: Trip): [number, number] {
    return t.kind === "port" ? PORT_BY_ID[t.port].pos : LOC_POS[t.loc];
  }
  get canMotor() { return this.boat.fuel > 0; }
  /** Время и стоимость поездки. Своим ходом — бесплатно, но в 2,2 раза дольше */
  tripQuote(t: Trip, mode: TravelMode) {
    const pt = this.tripPoint(t);
    const base = this.travelMinutesTo(pt);
    const motor = mode === "motor" && this.canMotor;
    return { minutes: Math.round(motor || !this.canMotor ? base : base * 2.2), fuel: motor ? this.fuelTo(pt) : 0, hours: base / 60 };
  }
  tripBlock(t: Trip, mode: TravelMode): string | null {
    if (this.phase === "fight" || this.phase === "caught" || this.phase === "bite") return "Сначала закончите с рыбой";
    if (t.kind === "loc" && !this.isUnlocked(t.loc)) return "Акватория ещё не разведана";
    if (t.kind === "loc" && LOC_BY_ID[t.loc].boatTier > this.boat.tier) return "Нужно судно старшего класса";
    if (t.kind === "port" && !this.s.portsKnown.includes(t.port)) return "Порт ещё не открыт";
    if (mode === "motor") {
      if (!this.canMotor) return "На этом судне нет мотора";
      const q = this.tripQuote(t, mode);
      if (q.fuel > this.s.money) return `Не хватает на топливо: ${q.fuel.toLocaleString("ru")} ₽`;
    }
    return null;
  }
  /** Совершить поездку (вызывается по окончании анимации) */
  travel(t: Trip, mode: TravelMode) {
    if (this.tripBlock(t, mode)) return false;
    const q = this.tripQuote(t, mode);
    this.payFuel(q.fuel);
    this.s.minutes += q.minutes;
    this.dailyEvent({ k: "travel", sail: mode === "sail" && this.canMotor, to: t.kind === "port" ? t.port : t.loc });
    this.phase = "idle";
    this.hookDepth = 0;
    this.pendingFish = null;
    if (t.kind === "port") {
      this.s.port = t.port;
      this.s.atPort = true;
      this.refreshOrders();
    } else {
      this.arriveAt(t.loc, t.spot);
    }
    this.fade = 0.6;
    this.markDirty();
    return true;
  }

  goToPort(target?: PortId, mode: TravelMode = "motor") {
    const id = target && this.s.portsKnown.includes(target) ? target : this.nearestPort();
    return this.travel({ kind: "port", port: id }, this.canMotor ? mode : "sail");
  }


  /** Переход между портами (продать улов там, где за него дают больше) */
  sailToPort(id: PortId, mode: TravelMode = "motor") {
    if (!this.s.atPort || id === this.s.port) return false;
    return this.travel({ kind: "port", port: id }, this.canMotor ? mode : "sail");
  }


  /** Ночлег: только вечером и ночью, не чаще раза в 16 игровых часов, за плату */
  get restBlock(): string | null {
    if (!this.s.atPort) return "Только в порту";
    const h = this.hour;
    if (h >= 4 && h < 19) return "Комнаты сдают с 19:00";
    const left = this.s.lastRest + 16 * 60 - this.s.minutes;
    if (left > 0) return `Отдых доступен через ${Math.ceil(left / 60)} ч`;
    if (this.s.money < this.port.innFee) return `Ночлег стоит ${this.port.innFee} ₽`;
    return null;
  }

  get rumorPrice() { return Math.round((250 + Object.keys(this.s.codex).length * 12) * this.port.priceMult / 10) * 10; }

  /** Купить слух в таверне: условия клёва неизвестного вида местных вод */
  buyRumor() {
    const pool = FISH.filter((f) => !this.s.codex[f.id] && !this.s.hints.includes(f.id));
    const local = pool.filter((f) => this.port.serves.includes(f.loc[0]));
    const src = local.length ? local : pool;
    if (!src.length || this.s.money < this.rumorPrice) return null;
    this.s.money -= this.rumorPrice;
    const f = src[ri(src.length)];
    this.s.hints.push(f.id);
    this.sfx.push("quest");
    this.markDirty();
    return f;
  }

  private fixWeatherForClimate() {
    const c = this.loc.climate;
    const w = this.s.weather;
    if ((c === "tropic" || c === "ocean" || c === "misty") && w === "snow") this.s.weather = "rain";
    if (c === "tropic" && w === "fog") this.s.weather = "cloudy";
    if (c === "polar" && w === "rain") this.s.weather = "snow";
    if (c === "temperate" && w === "snow" && this.season !== 3) this.s.weather = "cloudy";
    this.s.weatherQueued = nextWeather(this.s.weather, this.season, c, Math.random);
  }

  depart(to: LocId, spotId?: string, mode: TravelMode = "motor") {
    return this.travel({ kind: "loc", loc: to, spot: spotId }, this.canMotor ? mode : "sail");
  }

  private arriveAt(to: LocId, spotId?: string) {
    const l = LOC_BY_ID[to];
    const changed = to !== this.s.location;
    this.s.location = to;
    const sp = spotId && SPOT_BY_ID[spotId]?.loc === to ? spotId : changed || SPOT_BY_ID[this.s.spot]?.loc !== to ? spotsOf(to)[0].id : this.s.spot;
    this.s.spot = sp;
    this.s.atPort = false;
    this.s.targetDepth = Math.min(this.s.targetDepth, this.maxDepth);
    if (changed) this.fixWeatherForClimate();
    if (!this.s.flags.includes(`visit_${to}`)) this.s.flags.push(`visit_${to}`);
    const np = portOf(to);
    if (np && !this.s.portsKnown.includes(np.id)) {
      this.s.portsKnown.push(np.id);
      this.toast(`Открыт порт ${np.name}`, "legend", `${np.place} · рынок, снасти${np.shipyard.length ? ", верфь" : ""}`);
    }
    this.checkProgress();
    this.toast(l.name, "info", this.spot.name);
  }


  moveSpot(id: string) {
    const sp = SPOT_BY_ID[id];
    if (!sp || sp.loc !== this.s.location || id === this.s.spot) return false;
    if (this.phase === "fight" || this.phase === "caught" || this.phase === "bite") return false;
    this.phase = "idle";
    this.hookDepth = 0;
    this.s.minutes += 20;
    this.payFuel(Math.round(this.boat.fuel / 3));
    this.s.spot = id;
    this.s.targetDepth = Math.min(this.s.targetDepth, this.maxDepth);
    this.fade = 0.9;
    this.sfx.push("travel");
    this.toast(sp.name, "info", `${sp.maxDepth} м`);
    this.markDirty();
    return true;
  }

  // ─────────── market ───────────
  get hot() { return hotFish(this.day + PORTS.indexOf(this.port) * 131); }
  /** Спрос порта на вид: местная рыба дешевле, привозная дороже */
  demand(fishId: string) {
    const f = FISH_BY_ID[fishId];
    if (!f) return 1;
    let d = this.port.demand[f.loc[0]] ?? 1;
    if (f.rarity === "epic" || f.rarity === "legendary") d *= this.port.rareDemand;
    return d;
  }
  /** Свежесть улова: −10% в сутки, в судах со льдом медленнее, не ниже 50% */
  get spoilRate() {
    const b = this.boat;
    return b.id === "polar" ? 0.3 : b.id === "deepsea" ? 0.35 : b.tier >= 3 ? 0.45 : b.baitWell > 0 ? 0.8 : 1;
  }
  freshness(c: CaughtFish) {
    const hours = Math.max(0, (this.s.minutes - (c.at ?? this.s.minutes)) / 60);
    return Math.max(0.5, 1 - (hours / 24) * 0.1 * this.spoilRate);
  }
  private marketDay() {
    const key = this.day * 10 + PORTS.indexOf(this.port);
    if (this.s.market.day !== key) this.s.market = { day: key, sold: {} };
    return this.s.market.sold;
  }
  /** Насыщение: каждая проданная сегодня рыба вида снижает цену следующей */
  saturation(fishId: string, extra = 0) {
    const n = (this.marketDay()[fishId] ?? 0) + extra;
    const r = FISH_BY_ID[fishId]?.rarity;
    const step = r === "legendary" ? 0.25 : r === "epic" ? 0.12 : r === "rare" ? 0.08 : r === "uncommon" ? 0.06 : 0.045;
    return Math.max(0.4, 1 - n * step);
  }
  /** Ярмарка по реальным выходным: +10% к ценам (кроме полярной станции) */
  get fairBonus() { const d = new Date().getDay(); return (d === 0 || d === 6) && this.s.port !== "southcross" ? 1.1 : 1; }
  marketMult(fishId: string, extra = 0) { return this.fairBonus * priceMult(fishId, this.day) * (this.hot.includes(fishId) ? 1.8 : 1) * this.saturation(fishId, extra) * this.demand(fishId); }
  /** Ставка за одну рыбу вида: ниже неё рынок не опускается никогда. */
  baseValue(fishId: string) { const f = FISH_BY_ID[fishId]; return f ? RARITY_INFO[f.rarity].base : 1; }
  marketValue(c: CaughtFish, extra = 0) {
    const raw = c.value * this.marketMult(c.fishId, extra) * this.freshness(c) * (1 + this.perk("trader") * 0.04);
    // Перегруженный рынок и лежалый улов сбивают цену, но не ниже ставки за вид.
    return Math.max(this.baseValue(c.fishId), Math.round(raw));
  }
  /** Цены всего садка с учётом того, что каждая следующая рыба вида дешевле */
  coolerQuote() {
    const cnt: Record<string, number> = {};
    const sorted = [...this.s.cooler].sort((a, b) => b.value - a.value);
    const map = new Map<string, number>();
    for (const c of sorted) {
      const k = cnt[c.fishId] ?? 0;
      map.set(c.uid, this.marketValue(c, k));
      cnt[c.fishId] = k + 1;
    }
    return map;
  }
  private recordSale(fishId: string) {
    const d = this.marketDay();
    d[fishId] = (d[fishId] ?? 0) + 1;
  }

  sellAll() {
    const q = this.coolerQuote();
    const total = [...q.values()].reduce((a, b) => a + b, 0);
    if (!total) return 0;
    for (const c of this.s.cooler) this.recordSale(c.fishId);
    this.dailyEvent({ k: "sell", amount: total, count: this.s.cooler.length, port: this.s.port });
    this.s.money += total;
    this.s.stats.totalEarned += total;
    this.s.cooler = [];
    this.sfx.push("coins");
    this.checkProgress();
    this.markDirty();
    return total;
  }

  sellOne(uid: string) {
    const i = this.s.cooler.findIndex((c) => c.uid === uid);
    if (i < 0) return;
    // Одиночная продажа должна использовать ту же котировку, что и таблица
    // рынка и «Продать всё». Иначе можно было продавать один и тот же вид
    // по полной цене и обходить дневное насыщение рынка.
    const quote = this.coolerQuote();
    const v = quote.get(uid) ?? this.marketValue(this.s.cooler[i]);
    this.recordSale(this.s.cooler[i].fishId);
    this.dailyEvent({ k: "sell", amount: v, count: 1, port: this.s.port });
    this.s.money += v;
    this.s.stats.totalEarned += v;
    this.s.cooler.splice(i, 1);
    this.sfx.push("coins");
    this.markDirty();
  }

  // ─────────── orders ───────────
  refreshOrders() {
    const day = this.day;
    const expired = this.s.orders.filter((o) => o.expiresDay < day);
    if (expired.length) this.toast(`Заказов просрочено: ${expired.length}`, "bad");
    this.s.orders = this.s.orders.filter((o) => o.expiresDay >= day);
    let guard = 0;
    while (this.s.orders.length < 3 && guard++ < 30) {
      const o = this.makeOrder();
      if (o && !this.s.orders.some((x) => x.fishId === o.fishId)) this.s.orders.push(o);
    }
  }

  private makeOrder(): Order | null {
    const tier = this.boat.tier;
    const pool = FISH.filter((f) => f.rarity !== "legendary" && f.loc.some((l) => LOC_BY_ID[l].boatTier <= tier) && f.depth[0] <= this.line.value);
    if (!pool.length) return null;
    const known = pool.filter((f) => this.s.codex[f.id]);
    const src = known.length && Math.random() < 0.75 ? known : pool;
    const f = src[ri(src.length)];
    const count = f.rarity === "common" ? 2 + ri(3) : f.rarity === "uncommon" ? 1 + ri(2) : 1;
    const minWeight = Math.random() < 0.4 ? +(f.weight[0] + (f.weight[1] - f.weight[0]) * (0.25 + Math.random() * 0.3)).toFixed(2) : 0;
    const avgW = minWeight ? minWeight * 1.2 : ((f.weight[0] + f.weight[1]) / 2) * 0.7;
    const mult = { common: 2.2, uncommon: 2.5, rare: 3, epic: 3.5, legendary: 4 }[f.rarity];
    const reward = Math.max(50, Math.round(((RARITY_INFO[f.rarity].base + avgW * f.price) * count * mult + 40) / 10) * 10);
    return { id: rid(), fishId: f.id, count, minWeight, reward, expiresDay: this.day + 2 + ri(3), client: this.port.clients[ri(this.port.clients.length)] ?? ORDER_CLIENTS[ri(ORDER_CLIENTS.length)] };
  }

  orderMatches(o: Order) {
    return this.s.cooler.filter((c) => c.fishId === o.fishId && c.weight >= o.minWeight).sort((a, b) => a.weight - b.weight);
  }

  fulfillOrder(id: string) {
    const o = this.s.orders.find((x) => x.id === id);
    if (!o) return false;
    const m = this.orderMatches(o);
    if (m.length < o.count) return false;
    const use = new Set(m.slice(0, o.count).map((c) => c.uid));
    this.s.cooler = this.s.cooler.filter((c) => !use.has(c.uid));
    this.s.orders = this.s.orders.filter((x) => x.id !== id);
    this.s.money += o.reward;
    this.s.stats.totalEarned += o.reward;
    this.s.ordersDone++;
    this.dailyEvent({ k: "order" });
    this.addXp(30 + Math.round(o.reward / 50));
    this.sfx.push("coins");
    this.checkProgress();
    this.markDirty();
    return true;
  }

  // ─────────── shop ───────────
  /** Доработки */
  modPrice(id: string) {
    const m = MOD_BY_ID[id];
    const next = this.mod(id) + 1;
    return m ? Math.round((m.base * MOD_COST_STEP[Math.min(3, next)] * this.port.priceMult) / 10) * 10 : 0;
  }
  modBlock(id: string): string | null {
    const m = MOD_BY_ID[id];
    if (!m) return "—";
    const next = this.mod(id) + 1;
    if (next > m.max) return "Максимум";
    if (!this.s.atPort) return "Только в порту";
    if (this.s[m.gear] < next) return `Нужна снасть класса ${next + 1}`;
    if (this.port.gearMax[m.gear] < next) {
      const where = PORTS.filter((p) => p.gearMax[m.gear] >= next).map((p) => p.name).join(", ");
      return `Мастерская: ${where}`;
    }
    if (this.s.money < this.modPrice(id)) return "Недостаточно средств";
    return null;
  }
  buyMod(id: string) {
    if (this.modBlock(id)) return false;
    this.dailyEvent({ k: "buy", amount: this.modPrice(id) });
    this.s.money -= this.modPrice(id);
    this.s.mods[id] = this.mod(id) + 1;
    this.sfx.push("buy");
    this.markDirty();
    return true;
  }
  modsOf(g: GearKind) { return MODS.filter((m) => m.gear === g); }

  gearPrice(kind: GearKind) {
    const list = gearList(kind);
    const next = list[this.s[kind] + 1];
    return next ? Math.round((next.price * this.port.priceMult) / 10) * 10 : 0;
  }
  gearBlock(kind: GearKind): string | null {
    const list = gearList(kind);
    const lvl = this.s[kind] + 1;
    if (!list[lvl]) return "Лучшее из доступного";
    if (!this.s.atPort) return "Только в порту";
    if (this.port.gearMax[kind] < lvl) {
      const where = PORTS.filter((p) => p.gearMax[kind] >= lvl).map((p) => p.name).join(", ");
      return `Продаётся: ${where}`;
    }
    if (this.s.money < this.gearPrice(kind)) return "Недостаточно средств";
    return null;
  }

  buyGear(kind: GearKind) {
    if (this.gearBlock(kind)) return false;
    this.dailyEvent({ k: "buy", amount: this.gearPrice(kind) });
    this.s.money -= this.gearPrice(kind);
    this.s[kind]++;
    this.sfx.push("buy");
    this.checkProgress();
    this.markDirty();
    return true;
  }

  /** Можно ли купить судно: нужен корабль предыдущего класса */
  boatBlock(i: number): string | null {
    const b = BOATS[i];
    if (!b) return "—";
    if (this.s.boatsOwned.includes(i)) return "Во владении";
    if (!this.port.shipyard.includes(b.id)) {
      const where = PORTS.filter((p) => p.shipyard.includes(b.id)).map((p) => p.name).join(", ");
      return `Строится: ${where}`;
    }
    if (b.tier > this.fleetTier + 1) return "Нужно судно предыдущего класса";
    if (this.s.money < b.price) return "Недостаточно средств";
    return null;
  }

  buyBoat(i: number) {
    if (this.boatBlock(i)) return false;
    this.s.money -= BOATS[i].price;
    this.s.boatsOwned.push(i);
    this.s.boat = i;
    this.sfx.push("buy");
    this.checkProgress();
    this.markDirty();
    return true;
  }

  /** Выйти в море на другом судне своего флота */
  setBoat(i: number) {
    if (!this.s.boatsOwned.includes(i) || this.s.boat === i) return false;
    if (this.s.cooler.length > BOATS[i].cooler + this.perk("cooler") * 2) return false;
    this.s.boat = i;
    this.sfx.push("travel");
    this.markDirty();
    return true;
  }


  baitPrice(id: BaitId) { return Math.round((BAIT_BY_ID[id].price * this.port.priceMult) / 5) * 5; }
  baitSold(id: BaitId) { return this.port.baits.includes(id); }

  buyBait(id: BaitId) {
    const b = BAIT_BY_ID[id];
    if (!b.price || !this.baitSold(id) || this.s.money < this.baitPrice(id)) return false;
    this.dailyEvent({ k: "buy", amount: this.baitPrice(id) });
    this.s.money -= this.baitPrice(id);
    this.s.baits[id] = (this.s.baits[id] ?? 0) + b.pack;
    this.sfx.push("buy");
    this.markDirty();
    return true;
  }

  restUntilDawn() {
    if (this.restBlock) return false;
    this.s.money -= this.port.innFee;
    const m = this.s.minutes % MIN_PER_DAY;
    const dawn = 5 * 60;
    const add = m < dawn ? dawn - m : MIN_PER_DAY - m + dawn;
    this.s.minutes += add;
    this.s.weatherNext = this.s.minutes;
    this.s.lastRest = this.s.minutes;
    this.fade = 1;
    this.refreshOrders();
    this.markDirty();
    return true;
  }
}
