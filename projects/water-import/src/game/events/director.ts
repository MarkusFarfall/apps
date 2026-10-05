import { EVENTS, TIER_INFO } from './catalog';
import type { AtmoMods, Buff, DirectorMessage, DirectorSave, EventCtx, EventDef, EventEffects, EventTier, LiveEvent, Outcome, VisibleEvent } from './types';

const TIERS: EventTier[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
const ss = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export type CtxInput = Omit<EventCtx, 'seen' | 'active' | 'since' | 'T'>;

export interface DirectorOptions {
  seed?: number;
  catalog?: EventDef[];
  /** темп: 1 — норма, 2 — события вдвое чаще */
  pace?: number;
  /** стартовое время, игровые минуты */
  startT?: number;
}

export interface ActiveInfo {
  live: LiveEvent;
  def: EventDef;
  k: number;
  p: number;
  /** игровых минут до начала (предвестие) или до конца */
  left: number;
}

/**
 * Режиссёр событий.
 *
 *  • Темп и напряжение: после крупного события наступает затишье, мелкие события не толпятся.
 *  • Взвешенный выбор: пригодность по условиям × редкость × новизна × ротация категорий.
 *  • Защита от «засухи»: чем дольше не было редкого, тем выше шанс редкого.
 *  • Слоты: одновременно до 3 событий и только одно «главное» (major).
 *  • Предвестники, цепочки (чайки → косяк → дельфины, звездопад → упавшая звезда…),
 *    события с выбором и временные эффекты (баффы) после выбора.
 *  • Детерминированный ГСЧ и полное сохранение состояния (save/load).
 */
export class EventDirector {
  auto = true;
  pace: number;
  T: number;
  readonly catalog: EventDef[];
  private byId: Record<string, EventDef>;
  private live: LiveEvent[] = [];
  private queue: DirectorSave['queue'] = [];
  private cd: Record<string, number> = {};
  private seen: DirectorSave['seen'] = {};
  private buffs: Buff[] = [];
  private rngState: number;
  private next: number;
  private tension = 0;
  private drought = 0;
  private uid = 1;
  private lastCat: string | null = null;
  private listeners = new Set<(m: DirectorMessage) => void>();
  private ctx: EventCtx | null = null;

  constructor(o: DirectorOptions = {}) {
    this.catalog = o.catalog ?? EVENTS;
    this.byId = Object.fromEntries(this.catalog.map((e) => [e.id, e]));
    this.rngState = (o.seed ?? Date.now()) >>> 0;
    this.T = o.startT ?? 0;
    this.pace = o.pace ?? 1;
    this.next = this.T + 520 + this.rnd() * 640;
  }

  /* ─────────────── служебное ─────────────── */

  readonly rnd = () => {
    let a = (this.rngState = (this.rngState + 0x6d2b79f5) | 0);
    a = Math.imul(a ^ (a >>> 15), 1 | a);
    a = (a + Math.imul(a ^ (a >>> 7), 61 | a)) ^ a;
    return ((a ^ (a >>> 14)) >>> 0) / 4294967296;
  };
  private lerp(r: [number, number]) {
    return r[0] + this.rnd() * (r[1] - r[0]);
  }

  on(cb: (m: DirectorMessage) => void) {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }
  private emit(m: DirectorMessage) {
    this.listeners.forEach((f) => f(m));
  }

  def(id: string) {
    return this.byId[id];
  }

  private makeCtx(inp: CtxInput): EventCtx {
    return {
      ...inp,
      T: this.T,
      seen: (id) => this.seen[id]?.n ?? 0,
      active: (id) => this.live.some((l) => l.id === id),
      since: (id) => (this.seen[id] ? this.T - this.seen[id].last : Infinity),
    };
  }

  /** Сдвиг всех таймеров (время перемотали вручную) */
  private shift(d: number) {
    for (const l of this.live) {
      l.omenAt += d;
      l.start += d;
      l.end += d;
    }
    for (const q of this.queue) q.at += d;
    for (const b of this.buffs) b.until += d;
    for (const k of Object.keys(this.cd)) this.cd[k] += d;
    for (const s of Object.values(this.seen)) s.last += d;
    this.next += d;
  }

  /* ─────────────── цикл ─────────────── */

  update(T: number, inp: CtxInput) {
    const dt = T - this.T;
    if (dt < 0 || dt > 720) this.shift(dt);
    this.T = T;
    const c = (this.ctx = this.makeCtx(inp));

    for (const l of [...this.live]) {
      if (l.phase === 'omen' && T >= l.start) {
        l.phase = 'active';
        this.onStart(l);
      }
      if (l.phase === 'active' && T >= l.end) this.finish(l);
    }
    if (this.buffs.length) this.buffs = this.buffs.filter((b) => b.until > T);

    for (const q of [...this.queue]) {
      if (T < q.at) continue;
      this.queue.splice(this.queue.indexOf(q), 1);
      const def = this.byId[q.id];
      if (!def || this.live.some((l) => l.id === q.id)) continue;
      if (def.when(c) > 0) this.spawn(def, { from: q.from, seed: q.seed });
    }

    if (dt > 0) this.tension = Math.max(0, this.tension - dt * 0.006);
    if (this.auto && T >= this.next) {
      this.roll(c);
      this.next = T + this.gap();
    }
  }

  private gap() {
    return ((520 + this.rnd() * 640) * (1 + this.tension * 1.4)) / Math.max(0.1, this.pace);
  }

  /** Веса кандидатов в текущих условиях */
  weights(c: EventCtx | null = this.ctx) {
    const out: { def: EventDef; w: number; ok: number }[] = [];
    if (!c) return out;
    const majorBusy = this.live.some((l) => this.byId[l.id]?.major);
    for (const def of this.catalog) {
      const ok = def.when(c);
      let w = ok;
      if (def.chainOnly || w <= 0 || this.live.some((l) => l.id === def.id) || (this.cd[def.id] ?? -Infinity) > this.T || (def.major && majorBusy)) w = 0;
      if (w > 0) {
        w *= (def.weight ?? 1) * TIER_INFO[def.tier].weight;
        const s = this.seen[def.id];
        if (!s) w *= 1.5;
        else {
          const ago = this.T - s.last;
          if (ago < 360) w *= 0.25 + (0.75 * ago) / 360;
        }
        if (TIERS.indexOf(def.tier) >= 2) w *= 1 + this.drought * 0.12;
        if (def.cat === this.lastCat) w *= 0.55;
        if (def.major) w *= 1 - this.tension * 0.7;
      }
      out.push({ def, w, ok });
    }
    return out;
  }

  private roll(c: EventCtx) {
    if (this.live.length >= 3) return;
    const cand = this.weights(c).filter((x) => x.w > 0);
    const total = cand.reduce((s, x) => s + x.w, 0);
    if (total <= 0) return;
    let r = this.rnd() * total;
    let pick = cand[cand.length - 1].def;
    for (const x of cand) {
      r -= x.w;
      if (r <= 0) {
        pick = x.def;
        break;
      }
    }
    if (TIERS.indexOf(pick.tier) >= 2) this.drought = 0;
    else this.drought++;
    this.spawn(pick, {});
  }

  private spawn(def: EventDef, o: { from?: string; seed?: number; skipOmen?: boolean }) {
    const T = this.T;
    const dur = this.lerp(def.duration);
    const lead = def.omen && !o.skipOmen ? this.lerp(def.omen.lead) : 0;
    const l: LiveEvent = {
      uid: this.uid++,
      id: def.id,
      phase: lead > 0 ? 'omen' : 'active',
      omenAt: T,
      start: T + lead,
      end: T + lead + dur,
      seed: o.seed ?? Math.floor(this.rnd() * 1e9),
      from: o.from,
    };
    this.live.push(l);
    this.cd[def.id] = l.end + (def.cooldown ?? 90);
    this.lastCat = def.cat;
    if (def.major) this.tension = Math.min(1, this.tension + 0.5);
    if (lead > 0) this.emit({ type: 'omen', live: l, def });
    else this.onStart(l);
    return l;
  }

  private onStart(l: LiveEvent) {
    const def = this.byId[l.id];
    const s = this.seen[l.id];
    const first = !s;
    this.seen[l.id] = { n: (s?.n ?? 0) + 1, first: s?.first ?? this.T, last: this.T };
    this.emit({ type: 'start', live: l, def });
    if (first) this.emit({ type: 'discover', live: l, def });
  }

  private finish(l: LiveEvent) {
    const i = this.live.indexOf(l);
    if (i < 0) return;
    this.live.splice(i, 1);
    const def = this.byId[l.id];
    if (this.seen[l.id]) this.seen[l.id].last = this.T;
    for (const f of def.follow ?? []) {
      if (this.rnd() < f.chance) this.queue.push({ id: f.id, at: this.T + this.lerp(f.delay), from: l.id, seed: l.seed });
    }
    this.emit({ type: 'end', live: l, def });
  }

  /* ─────────────── управление ─────────────── */

  /** Запустить событие вручную (force — игнорировать условия и слоты) */
  trigger(id: string, o: { force?: boolean; skipOmen?: boolean } = {}) {
    const def = this.byId[id];
    if (!def || this.live.some((l) => l.id === id)) return false;
    if (!o.force && this.ctx && def.when(this.ctx) <= 0) return false;
    if (def.major) for (const l of this.live.filter((x) => this.byId[x.id].major)) this.finish(l);
    this.spawn(def, { skipOmen: o.skipOmen });
    return true;
  }

  /** Завершить событие сейчас */
  stop(uid: number) {
    const l = this.live.find((x) => x.uid === uid);
    if (!l) return;
    if (l.phase === 'omen') {
      l.phase = 'active';
      this.onStart(l);
    }
    l.end = this.T;
    this.finish(l);
  }

  /** Выбор в событии-находке. Возвращает исход (награду применяет игра) */
  choose(uid: number, choiceId: string): Outcome | null {
    const l = this.live.find((x) => x.uid === uid);
    if (!l || l.choice || l.phase !== 'active') return null;
    const def = this.byId[l.id];
    const ch = def.choices?.find((x) => x.id === choiceId);
    if (!ch || !this.ctx) return null;
    const outcome = ch.resolve(this.rnd, this.ctx);
    l.choice = choiceId;
    l.outcome = outcome;
    if (outcome.buff) this.buffs.push({ id: `${def.id}:${choiceId}`, label: outcome.buff.label, effects: outcome.buff.effects, until: this.T + outcome.buff.minutes });
    if (outcome.follow) this.queue.push({ id: outcome.follow, at: this.T + 4 + this.rnd() * 6, from: def.id, seed: l.seed });
    // находку забрали — событие гаснет
    l.end = Math.min(l.end, this.T + Math.max(2, (l.end - l.start) * 0.12));
    this.emit({ type: 'outcome', live: l, def, outcome });
    return outcome;
  }

  /* ─────────────── чтение ─────────────── */

  private kOf(l: LiveEvent) {
    if (l.phase === 'omen') return { k: 0, p: 0, omen: (this.T - l.omenAt) / Math.max(0.01, l.start - l.omenAt) };
    const dur = Math.max(0.01, l.end - l.start);
    const p = Math.max(0, Math.min(1, (this.T - l.start) / dur));
    const rin = Math.min(0.2, 2 / dur);
    const rout = Math.min(0.25, 3 / dur);
    return { k: ss(0, rin, p) * (1 - ss(1 - rout, 1, p)), p, omen: 1 };
  }

  /** Для сцены */
  visible(): VisibleEvent[] {
    return this.live.map((l) => {
      const { k, p, omen } = this.kOf(l);
      return { uid: l.uid, id: l.id, def: this.byId[l.id], k, p, omen, seed: l.seed, done: !!l.choice };
    });
  }

  /** Для интерфейса */
  activeList(): ActiveInfo[] {
    return this.live.map((l) => {
      const { k, p } = this.kOf(l);
      return { live: l, def: this.byId[l.id], k, p, left: l.phase === 'omen' ? l.start - this.T : l.end - this.T };
    });
  }

  intensity(id: string) {
    let k = 0;
    for (const l of this.live) if (l.id === id) k = Math.max(k, this.kOf(l).k);
    return k;
  }

  /** Совокупные множители: активные события (по интенсивности) + баффы */
  multipliers(): Required<EventEffects> {
    const m: Required<EventEffects> = { bite: 1, rare: 1, legendary: 1, price: 1, xp: 1, gearRisk: 0, luck: 0 };
    const apply = (e: EventEffects, k: number) => {
      for (const key of ['bite', 'rare', 'legendary', 'price', 'xp'] as const) if (e[key] !== undefined) m[key] *= 1 + (e[key]! - 1) * k;
      m.gearRisk += (e.gearRisk ?? 0) * k;
      m.luck += (e.luck ?? 0) * k;
    };
    for (const l of this.live) apply(this.byId[l.id].effects, this.kOf(l).k);
    for (const b of this.buffs) apply(b.effects, 1);
    return m;
  }

  /** Добавки к атмосфере (передать в Atmosphere.mods) */
  atmoMods(): AtmoMods {
    const out: AtmoMods = {};
    for (const l of this.live) {
      const a = this.byId[l.id].atmo;
      if (!a) continue;
      const { k } = this.kOf(l);
      for (const [key, v] of Object.entries(a) as [keyof AtmoMods, number][]) out[key] = (out[key] ?? 0) + v * k;
    }
    return out;
  }

  /* ─────────────── сохранение и совместимость ─────────────── */

  save(): DirectorSave {
    return {
      v: 2,
      T: this.T,
      next: this.next,
      live: this.live.map((l) => ({ ...l })),
      queue: this.queue.map((q) => ({ ...q })),
      cd: { ...this.cd },
      seen: JSON.parse(JSON.stringify(this.seen)),
      buffs: this.buffs.map((b) => ({ ...b })),
      rng: this.rngState,
      tension: this.tension,
      drought: this.drought,
      uid: this.uid,
      auto: this.auto,
    };
  }

  load(input: DirectorSave) {
    const raw = input as unknown as Record<string, unknown> | null;
    if (!raw || (raw.v !== 1 && raw.v !== 2)) return;
    const finite = (v: unknown, fallback = 0) => typeof v === 'number' && Number.isFinite(v) ? v : fallback;
    const ids = new Set(this.catalog.map((e) => e.id));
    const effects = (v: unknown): EventEffects => {
      const out: EventEffects = {};
      if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
      const r = v as Record<string, unknown>;
      for (const k of ['bite', 'rare', 'legendary', 'price', 'xp'] as const) {
        if (typeof r[k] === 'number' && Number.isFinite(r[k])) out[k] = Math.max(0, Math.min(20, r[k]));
      }
      if (typeof r.gearRisk === 'number' && Number.isFinite(r.gearRisk)) out.gearRisk = Math.max(0, Math.min(1, r.gearRisk));
      if (typeof r.luck === 'number' && Number.isFinite(r.luck)) out.luck = Math.max(0, Math.min(2, r.luck));
      return out;
    };
    const toneOf = (v: unknown): v is Outcome['tone'] => v === 'good' || v === 'bad' || v === 'neutral';
    const cleanOutcome = (v: unknown): Outcome | undefined => {
      if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined;
      const r = v as Record<string, unknown>;
      if (typeof r.text !== 'string' || !toneOf(r.tone)) return undefined;
      const out: Outcome = { text: r.text.slice(0, 600), tone: r.tone };
      if (r.reward && typeof r.reward === 'object' && !Array.isArray(r.reward)) {
        const rw = r.reward as Record<string, unknown>;
        const reward: NonNullable<Outcome['reward']> = {};
        if (typeof rw.money === 'number' && Number.isFinite(rw.money)) reward.money = Math.max(-100_000, Math.min(100_000, rw.money));
        if (typeof rw.xp === 'number' && Number.isFinite(rw.xp)) reward.xp = Math.max(0, Math.min(100_000, rw.xp));
        if (typeof rw.item === 'string' && rw.item.length <= 64) reward.item = rw.item;
        if (rw.bait && typeof rw.bait === 'object' && !Array.isArray(rw.bait)) {
          const b = rw.bait as Record<string, unknown>;
          if (typeof b.id === 'string' && b.id.length <= 64 && typeof b.count === 'number' && Number.isFinite(b.count)) {
            reward.bait = { id: b.id, count: Math.max(0, Math.min(500, Math.floor(b.count))) };
          }
        }
        if (Object.keys(reward).length) out.reward = reward;
      }
      if (typeof r.follow === 'string' && ids.has(r.follow)) out.follow = r.follow;
      if (r.buff && typeof r.buff === 'object' && !Array.isArray(r.buff)) {
        const b = r.buff as Record<string, unknown>;
        if (typeof b.label === 'string' && typeof b.minutes === 'number' && Number.isFinite(b.minutes)) {
          out.buff = { label: b.label.slice(0, 80), effects: effects(b.effects), minutes: Math.max(0, Math.min(100_000, b.minutes)) };
        }
      }
      return out;
    };

    this.T = Math.max(0, Math.min(100_000_000, finite(raw.T, this.T)));
    this.next = Math.max(this.T, Math.min(100_000_000, finite(raw.next, this.T + 5)));
    const liveRaw = Array.isArray(raw.live) ? raw.live : [];
    this.live = liveRaw.flatMap((x): LiveEvent[] => {
      if (!x || typeof x !== 'object' || Array.isArray(x)) return [];
      const r = x as Record<string, unknown>;
      const id = typeof r.id === 'string' ? r.id : '';
      const def = this.byId[id];
      if (!def || (r.phase !== 'omen' && r.phase !== 'active')) return [];
      const omenAt = finite(r.omenAt, this.T), start = finite(r.start, this.T), end = finite(r.end, start);
      if (end < start) return [];
      const choice = typeof r.choice === 'string' && def.choices?.some((c) => c.id === r.choice) ? r.choice : undefined;
      const live: LiveEvent = {
        uid: Math.max(1, Math.floor(finite(r.uid, this.uid++))), id, phase: r.phase,
        omenAt, start, end, seed: Math.floor(Math.abs(finite(r.seed, 1))) % 1_000_000_000,
      };
      if (typeof r.from === 'string' && ids.has(r.from)) live.from = r.from;
      if (choice) live.choice = choice;
      const outcome = cleanOutcome(r.outcome);
      if (outcome) live.outcome = outcome;
      return [live];
    }).slice(0, 3);
    const queueRaw = Array.isArray(raw.queue) ? raw.queue : [];
    this.queue = queueRaw.flatMap((x): DirectorSave['queue'] => {
      if (!x || typeof x !== 'object' || Array.isArray(x)) return [];
      const r = x as Record<string, unknown>;
      if (typeof r.id !== 'string' || !ids.has(r.id)) return [];
      const q: DirectorSave['queue'][number] = { id: r.id, at: Math.max(this.T, Math.min(100_000_000, finite(r.at, this.T))), seed: Math.floor(Math.abs(finite(r.seed, 1))) % 1_000_000_000 };
      if (typeof r.from === 'string' && ids.has(r.from)) q.from = r.from;
      return [q];
    }).slice(0, 100);
    const cdRaw = raw.cd && typeof raw.cd === 'object' && !Array.isArray(raw.cd) ? raw.cd as Record<string, unknown> : {};
    this.cd = Object.fromEntries(Object.entries(cdRaw).filter(([id, v]) => ids.has(id) && typeof v === 'number' && Number.isFinite(v)).map(([id, v]) => [id, Math.max(0, Math.min(100_000_000, v as number))]));
    const seenRaw = raw.seen && typeof raw.seen === 'object' && !Array.isArray(raw.seen) ? raw.seen as Record<string, unknown> : {};
    this.seen = {};
    for (const [id, value] of Object.entries(seenRaw)) {
      if (!ids.has(id) || !value || typeof value !== 'object' || Array.isArray(value)) continue;
      const r = value as Record<string, unknown>;
      this.seen[id] = { n: Math.max(0, Math.min(100_000, Math.floor(finite(r.n)))), first: Math.max(0, finite(r.first)), last: Math.max(0, finite(r.last)) };
    }
    const buffsRaw = Array.isArray(raw.buffs) ? raw.buffs : [];
    this.buffs = buffsRaw.flatMap((x): Buff[] => {
      if (!x || typeof x !== 'object' || Array.isArray(x)) return [];
      const r = x as Record<string, unknown>;
      if (typeof r.id !== 'string' || typeof r.label !== 'string') return [];
      return [{ id: r.id.slice(0, 80), label: r.label.slice(0, 80), effects: effects(r.effects), until: Math.max(this.T, Math.min(100_000_000, finite(r.until, this.T))) }];
    }).slice(0, 100);
    this.rngState = (Math.floor(Math.abs(finite(raw.rng, 1))) >>> 0) || 1;
    this.tension = Math.max(0, Math.min(1, finite(raw.tension)));
    this.drought = Math.max(0, Math.min(100_000, Math.floor(finite(raw.drought))));
    this.uid = Math.max(1, Math.floor(finite(raw.uid, this.live.length + 1)));
    // The former catalog toggle was removed; rare world events now remain enabled.
    this.auto = true;
    if (raw.v === 1) this.next = Math.min(100_000_000, Math.max(this.next, this.T + this.gap()));
  }

  /** В формат старой игры: SaveData.events и SaveData.nextEventAt */
  toLegacy() {
    return {
      events: this.live.filter((l) => l.phase === 'active').map((l) => ({ id: l.id, endsAt: Math.round(l.end) })),
      nextEventAt: Math.round(this.next),
    };
  }

  /** Подхватить события из старого сохранения */
  fromLegacy(events: { id: string; endsAt: number }[], nextEventAt: number, T: number) {
    this.T = T;
    this.next = nextEventAt > T ? nextEventAt : T + 5;
    for (const e of events) {
      if (!this.byId[e.id] || e.endsAt <= T || this.live.some((l) => l.id === e.id)) continue;
      const end = e.endsAt;
      // Legacy saves contain only the end time. Start the event just far enough in
      // the past to restore its full current intensity instead of replaying its fade-in.
      const start = T - Math.min(2, Math.max(0.01, end - T));
      this.live.push({ uid: this.uid++, id: e.id, phase: 'active', omenAt: start, start, end, seed: Math.floor(this.rnd() * 1e9) });
    }
  }
}
