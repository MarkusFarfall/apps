import { FISH, FISH_BY_ID, RARITY_INFO } from "./fish";
import type { LocId, SaveData } from "./types";
import { LOC_BY_ID, PORT_BY_ID } from "./world";

/** События, которые засчитываются в ежедневные задания */
export type DailyEvent =
  | { k: "catch"; fish: string; rarity: string; weight: number; loc: LocId; variant: boolean; perfect: boolean; night: boolean; weather: string; depth: number; isNew: boolean; bait: string; spot: string; hour: number; record: boolean; shape: string; value: number; season: number }
  | { k: "sell"; amount: number; count: number; port: string }
  | { k: "order" }
  | { k: "find" }
  | { k: "release" }
  | { k: "jump" }
  | { k: "travel"; sail: boolean; to: string }
  | { k: "buy"; amount: number }
  | { k: "bait"; bait: string }
  | { k: "snap" }
  | { k: "escape" };

export interface DailyTask {
  id: string;
  tpl: string;
  title: string;
  goal: number;
  progress: number;
  reward: number;
  xp: number;
  done: boolean;
  claimed: boolean;
  /** параметры шаблона */
  p?: Record<string, string | number>;
}

export interface DailyState {
  date: string;
  tasks: DailyTask[];
  streak: number;
  lastComplete: string;
  bonusClaimed: boolean;
  rerolls: number;
}

interface Ctx {
  s: SaveData;
  level: number;
  rnd: () => number;
  pick: <T>(a: T[]) => T;
}
interface Tpl {
  id: string;
  weight: number;
  minLevel?: number;
  make: (c: Ctx) => { title: string; goal: number; reward: number; xp: number; p?: Record<string, string | number> } | null;
  match: (t: DailyTask, e: DailyEvent) => number;
}

const unlockedLocs = (s: SaveData) => (s.unlocked?.length ? s.unlocked : ["bay"]) as LocId[];
const scale = (lvl: number) => 1 + lvl * 0.09;

const TEMPLATES: Tpl[] = [
  {
    id: "catch_any", weight: 3,
    make: ({ level, rnd }) => { const g = 8 + Math.floor(rnd() * 8) + Math.floor(level / 5) * 2; return { title: `Поймать ${g} рыб`, goal: g, reward: Math.round(g * 22 * scale(level)), xp: g * 6 }; },
    match: (_t, e) => (e.k === "catch" ? 1 : 0),
  },
  {
    id: "catch_loc", weight: 3,
    make: ({ s, level, rnd, pick }) => { const l = pick(unlockedLocs(s)); const g = 5 + Math.floor(rnd() * 5); return { title: `Поймать ${g} рыб: ${LOC_BY_ID[l].name}`, goal: g, reward: Math.round(g * 30 * scale(level)), xp: g * 8, p: { loc: l } }; },
    match: (t, e) => (e.k === "catch" && e.loc === t.p?.loc ? 1 : 0),
  },
  {
    id: "catch_species", weight: 3,
    make: ({ s, level, pick }) => {
      const locs = unlockedLocs(s);
      const pool = FISH.filter((f) => (f.rarity === "common" || f.rarity === "uncommon") && locs.includes(f.loc[0]) && f.depth[0] <= [20, 50, 160, 420, 1000, 2000][s.line] && !f.weather && !f.moon);
      if (!pool.length) return null;
      const f = pick(pool);
      const g = f.rarity === "common" ? 3 : 2;
      return { title: `Поймать «${s.codex[f.id] ? f.name : "неизвестный вид"}» ×${g}`, goal: g, reward: Math.round((f.rarity === "common" ? 180 : 320) * scale(level)), xp: 60, p: { fish: f.id } };
    },
    match: (t, e) => (e.k === "catch" && e.fish === t.p?.fish ? 1 : 0),
  },
  {
    id: "catch_rare", weight: 2, minLevel: 3,
    make: ({ level, rnd }) => { const g = 1 + Math.floor(rnd() * 2) + (level > 15 ? 1 : 0); return { title: `Поймать ${g} редких (или реже) рыб`, goal: g, reward: Math.round(g * 260 * scale(level)), xp: g * 70 }; },
    match: (_t, e) => (e.k === "catch" && (e.rarity === "rare" || e.rarity === "epic" || e.rarity === "legendary") ? 1 : 0),
  },
  {
    id: "catch_new", weight: 2,
    make: ({ s, level }) => (Object.keys(s.codex).length >= FISH.length ? null : { title: "Открыть новый вид для кодекса", goal: 1, reward: Math.round(350 * scale(level)), xp: 90 }),
    match: (_t, e) => (e.k === "catch" && e.isNew ? 1 : 0),
  },
  {
    id: "catch_weight", weight: 2,
    make: ({ level, rnd }) => { const g = Math.round((20 + rnd() * 30) * scale(level)); return { title: `Выловить ${g} кг рыбы`, goal: g, reward: Math.round(g * 9 * scale(level) * 0.6), xp: Math.round(g * 2) }; },
    match: (_t, e) => (e.k === "catch" ? e.weight : 0),
  },
  {
    id: "catch_big", weight: 2, minLevel: 4,
    make: ({ level }) => { const g = Math.round(5 + level * 1.4); return { title: `Поймать рыбу тяжелее ${g} кг`, goal: 1, reward: Math.round(320 * scale(level)), xp: 80, p: { min: g } }; },
    match: (t, e) => (e.k === "catch" && e.weight >= Number(t.p?.min ?? 0) ? 1 : 0),
  },
  {
    id: "catch_night", weight: 2,
    make: ({ level, rnd }) => { const g = 3 + Math.floor(rnd() * 4); return { title: `Поймать ${g} рыб ночью`, goal: g, reward: Math.round(g * 45 * scale(level)), xp: g * 10 }; },
    match: (_t, e) => (e.k === "catch" && e.night ? 1 : 0),
  },
  {
    id: "catch_deep", weight: 2, minLevel: 5,
    make: ({ s, level }) => { const d = Math.min([20, 50, 160, 420, 1000, 2000][s.line] * 0.6, 30 + level * 8) | 0; return { title: `Поймать 3 рыбы глубже ${d} м`, goal: 3, reward: Math.round(380 * scale(level)), xp: 70, p: { d } }; },
    match: (t, e) => (e.k === "catch" && e.depth >= Number(t.p?.d ?? 0) ? 1 : 0),
  },
  {
    id: "catch_weather", weight: 1,
    make: ({ level, pick }) => { const w = pick(["rain", "fog", "cloudy"]); const nm = { rain: "в дождь", fog: "в туман", cloudy: "в пасмурную погоду" }[w]; return { title: `Поймать 3 рыбы ${nm}`, goal: 3, reward: Math.round(300 * scale(level)), xp: 60, p: { w } }; },
    match: (t, e) => (e.k === "catch" && e.weather === t.p?.w ? 1 : 0),
  },
  {
    id: "perfect", weight: 2,
    make: ({ level, rnd }) => { const g = 3 + Math.floor(rnd() * 4); return { title: `Сделать ${g} точных подсечек`, goal: g, reward: Math.round(g * 55 * scale(level)), xp: g * 12 }; },
    match: (_t, e) => (e.k === "catch" && e.perfect ? 1 : 0),
  },
  {
    id: "variant", weight: 1, minLevel: 6,
    make: ({ level }) => ({ title: "Поймать рыбу редкой вариации", goal: 1, reward: Math.round(500 * scale(level)), xp: 110 }),
    match: (_t, e) => (e.k === "catch" && e.variant ? 1 : 0),
  },
  {
    id: "sell", weight: 3,
    make: ({ level }) => { const g = Math.round((1200 + level * 450) / 100) * 100; return { title: `Продать улова на ${g.toLocaleString("ru")} ₽`, goal: g, reward: Math.round(g * 0.15), xp: 50 }; },
    match: (_t, e) => (e.k === "sell" ? e.amount : 0),
  },
  {
    id: "sell_away", weight: 1, minLevel: 6,
    make: ({ s, level, pick }) => { const ps = s.portsKnown.filter((p) => p !== "home"); if (!ps.length) return null; const p = pick(ps); return { title: `Продать 5 рыб в порту ${PORT_BY_ID[p].name}`, goal: 5, reward: Math.round(600 * scale(level)), xp: 90, p: { port: p } }; },
    match: (t, e) => (e.k === "sell" && e.port === t.p?.port ? e.count : 0),
  },
  {
    id: "order", weight: 2,
    make: ({ level, rnd }) => { const g = 1 + Math.floor(rnd() * 2); return { title: `Выполнить заказ${g > 1 ? "а: " + g : ""}`, goal: g, reward: Math.round(g * 280 * scale(level)), xp: g * 60 }; },
    match: (_t, e) => (e.k === "order" ? 1 : 0),
  },
  {
    id: "release", weight: 1,
    make: ({ level }) => ({ title: "Отпустить 3 рыбы", goal: 3, reward: Math.round(160 * scale(level)), xp: 50 }),
    match: (_t, e) => (e.k === "release" ? 1 : 0),
  },
  {
    id: "find", weight: 1,
    make: ({ level }) => ({ title: "Достать находку со дна", goal: 1, reward: Math.round(300 * scale(level)), xp: 70 }),
    match: (_t, e) => (e.k === "find" ? 1 : 0),
  },
  {
    id: "jump", weight: 1, minLevel: 3,
    make: ({ level }) => ({ title: "Удержать 3 прыжка рыбы", goal: 3, reward: Math.round(260 * scale(level)), xp: 60 }),
    match: (_t, e) => (e.k === "jump" ? 1 : 0),
  },
  {
    id: "sail", weight: 1,
    make: ({ level }) => ({ title: "Дважды пройти малым ходом", goal: 2, reward: Math.round(180 * scale(level)), xp: 40 }),
    match: (_t, e) => (e.k === "travel" && e.sail ? 1 : 0),
  },
  {
    id: "visit_port", weight: 1, minLevel: 6,
    make: ({ s, level, pick }) => { const ps = s.portsKnown.filter((p) => p !== s.port); if (!ps.length) return null; const p = pick(ps); return { title: `Зайти в порт ${PORT_BY_ID[p].name}`, goal: 1, reward: Math.round(260 * scale(level)), xp: 50, p: { port: p } }; },
    match: (t, e) => (e.k === "travel" && e.to === t.p?.port ? 1 : 0),
  },
  {
    id: "buy_gear", weight: 1,
    make: ({ level }) => { const g = Math.round((400 + level * 120) / 50) * 50; return { title: `Потратить в лавке ${g.toLocaleString("ru")} ₽`, goal: g, reward: Math.round(g * 0.3), xp: 40 }; },
    match: (_t, e) => (e.k === "buy" ? e.amount : 0),
  },

  // ─── дополнительные виды заданий ───
  {
    id: "catch_bait", weight: 2,
    make: ({ s, level, pick }) => {
      const own = ["shrimp", "mussel", "livebait", "spoon", "jig", "wobbler", "cutbait", "squid"].filter((b) => (s.baits as Record<string, number>)[b] > 0);
      const b = own.length ? pick(own) : "worm";
      const nm: Record<string, string> = { worm: "червя", shrimp: "креветку", mussel: "мидию", livebait: "живца", spoon: "блесну", jig: "джиг", wobbler: "воблер", cutbait: "нарезку", squid: "кальмара" };
      return { title: `Поймать 5 рыб на ${nm[b] ?? b}`, goal: 5, reward: Math.round(260 * scale(level)), xp: 60, p: { bait: b } };
    },
    match: (t, e) => (e.k === "catch" && e.bait === t.p?.bait ? 1 : 0),
  },
  {
    id: "catch_spot", weight: 2,
    make: ({ s, level }) => ({ title: `Поймать 6 рыб на своей точке: «${s.spot ? (LOC_BY_ID[s.location]?.name ?? "") : ""}»`, goal: 6, reward: Math.round(240 * scale(level)), xp: 50, p: { spot: s.spot } }),
    match: (t, e) => (e.k === "catch" && e.spot === t.p?.spot ? 1 : 0),
  },
  {
    id: "catch_dawn", weight: 2,
    make: ({ level }) => ({ title: "Поймать 4 рыбы на рассвете (5:00–8:00)", goal: 4, reward: Math.round(300 * scale(level)), xp: 60 }),
    match: (_t, e) => (e.k === "catch" && e.hour >= 5 && e.hour < 8 ? 1 : 0),
  },
  {
    id: "catch_dusk", weight: 2,
    make: ({ level }) => ({ title: "Поймать 4 рыбы на закате (18:00–21:00)", goal: 4, reward: Math.round(300 * scale(level)), xp: 60 }),
    match: (_t, e) => (e.k === "catch" && e.hour >= 18 && e.hour < 21 ? 1 : 0),
  },
  {
    id: "catch_uncommon", weight: 2,
    make: ({ level, rnd }) => { const g = 3 + Math.floor(rnd() * 3); return { title: `Поймать ${g} необычных рыб`, goal: g, reward: Math.round(g * 90 * scale(level)), xp: g * 18 }; },
    match: (_t, e) => (e.k === "catch" && e.rarity === "uncommon" ? 1 : 0),
  },
  {
    id: "catch_epic", weight: 1, minLevel: 14,
    make: ({ level }) => ({ title: "Поймать исключительную рыбу", goal: 1, reward: Math.round(900 * scale(level)), xp: 200 }),
    match: (_t, e) => (e.k === "catch" && (e.rarity === "epic" || e.rarity === "legendary") ? 1 : 0),
  },
  {
    id: "catch_record", weight: 2, minLevel: 2,
    make: ({ level }) => ({ title: "Побить личный рекорд веса любого вида", goal: 1, reward: Math.round(320 * scale(level)), xp: 70 }),
    match: (_t, e) => (e.k === "catch" && e.record ? 1 : 0),
  },
  {
    id: "catch_small", weight: 1,
    make: ({ level }) => ({ title: "Поймать 5 рыб легче 200 г", goal: 5, reward: Math.round(220 * scale(level)), xp: 40 }),
    match: (_t, e) => (e.k === "catch" && e.weight < 0.2 ? 1 : 0),
  },
  {
    id: "catch_shape_flat", weight: 1, minLevel: 3,
    make: ({ level }) => ({ title: "Поймать 2 камбалы или ската", goal: 2, reward: Math.round(300 * scale(level)), xp: 60 }),
    match: (_t, e) => (e.k === "catch" && (e.shape === "flat" || e.shape === "ray") ? 1 : 0),
  },
  {
    id: "catch_shark", weight: 1, minLevel: 8,
    make: ({ level }) => ({ title: "Поймать акулу", goal: 1, reward: Math.round(520 * scale(level)), xp: 110 }),
    match: (_t, e) => (e.k === "catch" && e.shape === "shark" ? 1 : 0),
  },
  {
    id: "catch_eel", weight: 1, minLevel: 3,
    make: ({ level }) => ({ title: "Поймать 2 угревидные рыбы", goal: 2, reward: Math.round(280 * scale(level)), xp: 55 }),
    match: (_t, e) => (e.k === "catch" && (e.shape === "eel" || e.shape === "long") ? 1 : 0),
  },
  {
    id: "catch_value", weight: 2,
    make: ({ level }) => { const g = Math.round((250 + level * 60) / 10) * 10; return { title: `Поймать рыбу дороже ${g.toLocaleString("ru")} ₽`, goal: 1, reward: Math.round(g * 0.6), xp: 70, p: { v: g } }; },
    match: (t, e) => (e.k === "catch" && e.value >= Number(t.p?.v ?? 0) ? 1 : 0),
  },
  {
    id: "catch_streak_clean", weight: 1,
    make: ({ level }) => ({ title: "Поймать 8 рыб без обрыва лески", goal: 8, reward: Math.round(360 * scale(level)), xp: 80 }),
    match: (t, e) => {
      if (e.k === "snap") { t.progress = 0; return 0; }
      return e.k === "catch" ? 1 : 0;
    },
  },
  {
    id: "catch_two_locs", weight: 1, minLevel: 4,
    make: ({ s, level }) => (unlockedLocs(s).length < 2 ? null : { title: "Поймать рыбу в трёх разных акваториях", goal: 3, reward: Math.round(480 * scale(level)), xp: 100, p: { seen: "" } }),
    match: (t, e) => {
      if (e.k !== "catch") return 0;
      const seen = String(t.p?.seen ?? "").split(",").filter(Boolean);
      if (seen.includes(e.loc)) return 0;
      t.p = { ...(t.p ?? {}), seen: [...seen, e.loc].join(",") };
      return 1;
    },
  },
  {
    id: "catch_species_count", weight: 2,
    make: ({ level, rnd }) => { const g = 5 + Math.floor(rnd() * 4); return { title: `Поймать ${g} разных видов`, goal: g, reward: Math.round(g * 55 * scale(level)), xp: g * 12, p: { seen: "" } }; },
    match: (t, e) => {
      if (e.k !== "catch") return 0;
      const seen = String(t.p?.seen ?? "").split(",").filter(Boolean);
      if (seen.includes(e.fish)) return 0;
      t.p = { ...(t.p ?? {}), seen: [...seen, e.fish].join(",") };
      return 1;
    },
  },
  {
    id: "no_escape", weight: 1,
    make: ({ level }) => ({ title: "Вытащить 5 рыб подряд без схода", goal: 5, reward: Math.round(300 * scale(level)), xp: 60 }),
    match: (t, e) => {
      if (e.k === "escape" || e.k === "snap") { t.progress = 0; return 0; }
      return e.k === "catch" ? 1 : 0;
    },
  },
];

const TPL_BY_ID = Object.fromEntries(TEMPLATES.map((t) => [t.id, t]));

export function todayKey(d = new Date()) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function seedRng(str: string) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

/** Три задания на день, детерминированно по дате и игроку */
export function makeTasks(s: SaveData, level: number, date: string, salt = 0): DailyTask[] {
  const rnd = seedRng(`${date}|${s.name}|${salt}|${s.stats.totalCaught > 0 ? 1 : 0}`);
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
  const ctx: Ctx = { s, level, rnd, pick };
  const out: DailyTask[] = [];
  const used = new Set<string>();
  let guard = 0;
  while (out.length < 3 && guard++ < 60) {
    const avail = TEMPLATES.filter((t) => !used.has(t.id) && (t.minLevel ?? 0) <= level);
    const tot = avail.reduce((a, t) => a + t.weight, 0);
    let r = rnd() * tot;
    let tpl = avail[0];
    for (const t of avail) { r -= t.weight; if (r <= 0) { tpl = t; break; } }
    used.add(tpl.id);
    const m = tpl.make(ctx);
    if (!m) continue;
    out.push({ id: `${date}-${tpl.id}-${out.length}`, tpl: tpl.id, progress: 0, done: false, claimed: false, ...m });
  }
  // третье задание — «сложное»: награда выше
  if (out[2]) { out[2].reward = Math.round(out[2].reward * 1.5); out[2].xp = Math.round(out[2].xp * 1.5); }
  return out;
}

export function newDaily(): DailyState {
  return { date: "", tasks: [], streak: 0, lastComplete: "", bonusClaimed: false, rerolls: 1 };
}

/** Проверка смены дня; возвращает true, если задания обновились */
export function rollDaily(d: DailyState, s: SaveData, level: number, now = new Date()) {
  const key = todayKey(now);
  if (d.date === key && d.tasks.length) return false;
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  if (d.lastComplete && d.lastComplete !== todayKey(y) && d.lastComplete !== key) d.streak = 0;
  d.date = key;
  d.tasks = makeTasks(s, level, key);
  d.bonusClaimed = false;
  d.rerolls = 1;
  return true;
}

export function applyDaily(d: DailyState, e: DailyEvent): DailyTask[] {
  const finished: DailyTask[] = [];
  for (const t of d.tasks) {
    if (t.done) continue;
    const tpl = TPL_BY_ID[t.tpl];
    if (!tpl) continue;
    const inc = tpl.match(t, e);
    if (!inc) continue;
    t.progress = Math.min(t.goal, t.progress + inc);
    if (t.progress >= t.goal) { t.done = true; finished.push(t); }
  }
  return finished;
}

export const streakBonus = (streak: number) => 1 + Math.min(6, streak) * 0.1;
export const dailyChestReward = (level: number, streak: number) => Math.round((600 + level * 140) * streakBonus(streak) / 10) * 10;

export const RARITY_WORD = (r: string) => RARITY_INFO[r as keyof typeof RARITY_INFO]?.name ?? r;
export const fishName = (id: string) => FISH_BY_ID[id]?.name ?? id;
