import type { LocId } from "../types";
import type { Frame } from "./frame";
import { clamp, glow, hexA, mix } from "./util";

type Kind = "cargo" | "sailboat" | "trawler" | "whale" | "orca" | "dolphins" | "seals" | "birds" | "plane" | "fishjump" | "turtle" | "flyingfish" | "manta" | "calving" | "balloon" | "fireworks" | "meteor" | "heron" | "canoe" | "lavaburst" | "penguins" | "storm";

interface Happening { kind: Kind; t: number; dur: number; x0: number; dir: 1 | -1; p: number; seed: number }

/** Какие фоновые события возможны в акватории */
const POOL: Record<LocId, Kind[]> = {
  bay: ["sailboat", "sailboat", "trawler", "birds", "plane", "fishjump", "dolphins", "canoe", "fireworks", "meteor"],
  estuary: ["heron", "birds", "birds", "fishjump", "canoe", "plane", "sailboat"],
  cape: ["cargo", "trawler", "seals", "birds", "whale", "dolphins", "sailboat", "plane", "meteor"],
  skerries: ["sailboat", "sailboat", "canoe", "seals", "birds", "fishjump", "plane"],
  fjord: ["whale", "orca", "seals", "birds", "cargo", "trawler", "meteor"],
  kelp: ["seals", "whale", "sailboat", "birds", "dolphins", "trawler", "fishjump"],
  reef: ["turtle", "manta", "dolphins", "sailboat", "flyingfish", "balloon", "canoe"],
  mangrove: ["heron", "heron", "birds", "fishjump", "canoe", "turtle"],
  ocean: ["cargo", "cargo", "whale", "orca", "dolphins", "flyingfish", "plane", "storm", "meteor"],
  volcano: ["lavaburst", "flyingfish", "dolphins", "whale", "birds", "sailboat"],
  abyss: ["cargo", "whale", "storm", "flyingfish", "meteor", "plane"],
  antarctic: ["calving", "penguins", "whale", "orca", "seals", "birds"],
};

const DUR: Record<Kind, number> = {
  cargo: 60, sailboat: 45, trawler: 50, whale: 7, orca: 9, dolphins: 8, seals: 22, birds: 18, plane: 22, fishjump: 1.4, turtle: 8,
  flyingfish: 3, manta: 3, calving: 9, balloon: 50, fireworks: 14, meteor: 1.4, heron: 12, canoe: 40, lavaburst: 10, penguins: 18, storm: 12,
};

export class AmbientLife {
  private list: Happening[] = [];
  private timer = 6;
  private loc = "";

  update(f: Frame) {
    const { e, dt, W } = f;
    if (e.s.location !== this.loc) {
      this.loc = e.s.location;
      this.list = [];
      this.timer = 3;
    }
    this.timer -= dt;
    if (this.timer <= 0 && this.list.length < 3) {
      this.timer = 9 + Math.random() * 16;
      const pool = POOL[e.s.location].filter((k) => this.allowed(f, k));
      if (pool.length) {
        const kind = pool[Math.floor(Math.random() * pool.length)];
        if (!this.list.some((h) => h.kind === kind)) {
          const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
          this.list.push({ kind, t: 0, dur: DUR[kind] * (0.8 + Math.random() * 0.4), x0: W * (0.35 + Math.random() * 0.55), dir, p: 0.1 + Math.random() * 0.7, seed: Math.random() * 100 });
        }
      }
    }
    for (const h of this.list) h.t += dt;
    this.list = this.list.filter((h) => h.t < h.dur);
  }

  private allowed(f: Frame, k: Kind) {
    const night = f.night > 0.55;
    const bad = f.weather === "storm" || f.weather === "rain";
    switch (k) {
      case "fireworks": return night && !bad && new Date().getDay() % 6 === 0;
      case "meteor": return night && f.cover < 0.6;
      case "balloon": case "plane": case "birds": case "heron": case "canoe": case "sailboat": return !night && f.weather !== "storm";
      case "storm": return f.weather === "cloudy" || f.weather === "rain";
      case "penguins": case "seals": case "turtle": case "manta": case "flyingfish": return !night;
      default: return true;
    }
  }

  /** В небе (за сушей) */
  drawSky(f: Frame) {
    for (const h of this.list) {
      const k = h.t / h.dur;
      if (h.kind === "plane") this.plane(f, h, k);
      else if (h.kind === "birds") this.birds(f, h, k);
      else if (h.kind === "balloon") this.balloon(f, h, k);
      else if (h.kind === "fireworks") this.fireworks(f, h);
      else if (h.kind === "meteor") this.meteor(f, h, k);
      else if (h.kind === "storm") this.farStorm(f, h, k);
    }
  }

  /** На воде (полоса моря) */
  drawSea(f: Frame) {
    const sorted = [...this.list].sort((a, b) => a.p - b.p);
    for (const h of sorted) {
      const k = h.t / h.dur;
      switch (h.kind) {
        case "cargo": this.cargo(f, h, k); break;
        case "sailboat": this.sailboat(f, h, k); break;
        case "trawler": this.trawler(f, h, k); break;
        case "canoe": this.canoe(f, h, k); break;
        case "whale": this.whale(f, h, k); break;
        case "orca": this.orca(f, h, k); break;
        case "dolphins": this.dolphins(f, h, k); break;
        case "seals": this.seals(f, h, k); break;
        case "fishjump": this.fishJump(f, h, k); break;
        case "turtle": this.turtle(f, h, k); break;
        case "flyingfish": this.flyingFish(f, h, k); break;
        case "manta": this.manta(f, h, k); break;
        case "calving": this.calving(f, h, k); break;
        case "heron": this.heron(f, h, k); break;
        case "lavaburst": this.lavaBurst(f, h, k); break;
        case "penguins": this.penguins(f, h, k); break;
      }
    }
  }

  // ─── утилиты ───
  private y(f: Frame, p: number) { return f.hY + (f.sY - f.hY) * p * p; }
  private sz(f: Frame, p: number) { return (0.25 + p * 0.9) * f.sc; }
  private col(f: Frame, c: string, p: number) {
    const h = mix(c, f.hor, clamp(0.6 - p * 0.55 + f.fogK * 0.3, 0, 0.9));
    return mix(h, "#03060c", f.night * 0.8);
  }
  private fade(k: number, a = 0.12) { return Math.min(1, k / a, (1 - k) / a); }
  private splash(f: Frame, x: number, y: number, r: number, a: number) {
    const { ctx } = f;
    ctx.fillStyle = `rgba(255,255,255,${(0.7 * a).toFixed(3)})`;
    for (let i = 0; i < 7; i++) {
      const ang = -Math.PI / 2 + (i - 3) * 0.35;
      ctx.beginPath();
      ctx.arc(x + Math.cos(ang) * r, y + Math.sin(ang) * r * 0.8, Math.max(0.6, r * 0.12), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.4, r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // ─── суда ───
  private cargo(f: Frame, h: Happening, k: number) {
    const { ctx, W } = f;
    const p = h.p * 0.35;
    const y = this.y(f, p) + 1, s = this.sz(f, p) * 1.6;
    const x = h.dir > 0 ? -140 + (W + 280) * k : W + 140 - (W + 280) * k;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(h.dir * s, s);
    ctx.fillStyle = this.col(f, "#3a3e44", p);
    ctx.beginPath();
    ctx.moveTo(-60, 0); ctx.lineTo(62, 0); ctx.lineTo(56, 7); ctx.lineTo(-56, 7); ctx.closePath();
    ctx.fill();
    ctx.fillStyle = this.col(f, "#8a2a22", p);
    ctx.fillRect(-56, 5, 112, 2);
    const cc = ["#b8402a", "#2a5a8a", "#d8a030", "#3a7a4a", "#8a8a8a"];
    for (let i = 0; i < 8; i++) for (let r = 0; r < 2; r++) {
      ctx.fillStyle = this.col(f, cc[(i * 3 + r + Math.floor(h.seed)) % cc.length], p);
      ctx.fillRect(-44 + i * 10, -6 - r * 6, 9, 5.5);
    }
    ctx.fillStyle = this.col(f, "#e8e4dc", p);
    ctx.fillRect(40, -16, 14, 16);
    ctx.fillStyle = this.col(f, "#2a2a2a", p);
    ctx.fillRect(44, -22, 5, 6);
    ctx.restore();
    if (f.night > 0.3) {
      glow(ctx, x + h.dir * 46 * s, y - 18 * s, 1.2, "#ffffff", f.night);
      glow(ctx, x - h.dir * 58 * s, y - 2 * s, 1, "#ff4040", f.night);
    }
  }

  private sailboat(f: Frame, h: Happening, k: number) {
    const { ctx, W, t } = f;
    const p = 0.15 + h.p * 0.35;
    const y = this.y(f, p) + 1, s = this.sz(f, p);
    const x = h.dir > 0 ? -60 + (W + 120) * k : W + 60 - (W + 120) * k;
    const heel = Math.sin(t * 0.8 + h.seed) * 0.05 - h.dir * 0.08;
    ctx.save();
    ctx.translate(x, y + Math.sin(t * 1.3 + h.seed) * s);
    ctx.rotate(heel);
    ctx.scale(h.dir * s, s);
    ctx.fillStyle = this.col(f, "#f2efe8", p);
    ctx.beginPath(); ctx.moveTo(-20, -2); ctx.lineTo(22, -3); ctx.lineTo(16, 4); ctx.lineTo(-16, 4); ctx.fill();
    ctx.strokeStyle = this.col(f, "#6a6a6a", p);
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, -3); ctx.lineTo(0, -46); ctx.stroke();
    ctx.fillStyle = this.col(f, (Math.floor(h.seed) % 3 === 0 ? "#d85a3a" : "#f6f4ee"), p);
    ctx.beginPath(); ctx.moveTo(-1, -44); ctx.quadraticCurveTo(-18, -24, -20, -5); ctx.lineTo(-1, -5); ctx.fill();
    ctx.fillStyle = this.col(f, "#ecebe4", p);
    ctx.beginPath(); ctx.moveTo(1, -40); ctx.quadraticCurveTo(14, -22, 18, -4); ctx.lineTo(1, -4); ctx.fill();
    ctx.restore();
  }

  private trawler(f: Frame, h: Happening, k: number) {
    const { ctx, W, t } = f;
    const p = 0.2 + h.p * 0.3;
    const y = this.y(f, p) + 1, s = this.sz(f, p) * 1.2;
    const x = h.dir > 0 ? -80 + (W + 160) * k : W + 80 - (W + 160) * k;
    ctx.save();
    ctx.translate(x, y + Math.sin(t * 1.1 + h.seed) * 0.8 * s);
    ctx.scale(h.dir * s, s);
    ctx.fillStyle = this.col(f, "#2a4a6a", p);
    ctx.beginPath(); ctx.moveTo(-30, -2); ctx.lineTo(32, -6); ctx.lineTo(26, 5); ctx.lineTo(-26, 5); ctx.fill();
    ctx.fillStyle = this.col(f, "#e8e4dc", p);
    ctx.fillRect(6, -16, 16, 12);
    ctx.strokeStyle = this.col(f, "#3a3a3a", p);
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(-10, -3); ctx.lineTo(-10, -30); ctx.lineTo(-30, -8); ctx.moveTo(-10, -30); ctx.lineTo(10, -16); ctx.stroke();
    ctx.restore();
    // чайки за траулером
    ctx.strokeStyle = this.col(f, "#f0f0ee", p);
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const gx = x - h.dir * (30 + i * 9) * s + Math.sin(t * 1.3 + i * 2) * 8 * s, gy = y - (20 + (i % 3) * 8) * s + Math.cos(t * 1.1 + i) * 4 * s;
      const fl = Math.sin(t * 8 + i) * 2 * s;
      ctx.beginPath(); ctx.moveTo(gx - 4 * s, gy - fl); ctx.lineTo(gx, gy); ctx.lineTo(gx + 4 * s, gy - fl); ctx.stroke();
    }
  }

  private canoe(f: Frame, h: Happening, k: number) {
    const { ctx, W, t } = f;
    const p = 0.35 + h.p * 0.35;
    const y = this.y(f, p) + 1, s = this.sz(f, p);
    const x = h.dir > 0 ? -30 + (W * 0.7) * k : W + 30 - (W * 0.7) * k;
    const stroke = Math.sin(t * 2.4 + h.seed);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(h.dir * s, s);
    ctx.fillStyle = this.col(f, f.loc.climate === "tropic" ? "#8a5a30" : "#c8742e", p);
    ctx.beginPath(); ctx.moveTo(-18, -2); ctx.quadraticCurveTo(0, 4, 18, -2); ctx.quadraticCurveTo(0, 1, -18, -2); ctx.fill();
    ctx.fillStyle = this.col(f, "#3a3a4a", p);
    ctx.fillRect(-2, -10, 4, 8);
    ctx.beginPath(); ctx.arc(0, -12, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = this.col(f, "#2a2a2a", p);
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-8 + stroke * 6, 4); ctx.lineTo(8 - stroke * 6, -14); ctx.stroke();
    ctx.restore();
  }

  // ─── животные ───
  private whale(f: Frame, h: Happening, k: number) {
    const { ctx } = f;
    const p = 0.25 + h.p * 0.3;
    const y = this.y(f, p), s = this.sz(f, p) * 1.8;
    const x = h.x0;
    const col = this.col(f, "#2a3440", p);
    // фонтан
    if (k < 0.35) {
      const q = k / 0.35;
      ctx.fillStyle = `rgba(240,245,250,${(0.55 * (1 - q)).toFixed(3)})`;
      for (let i = 0; i < 12; i++) {
        ctx.beginPath();
        ctx.arc(x + Math.sin(i * 1.7) * 6 * s * q, y - 4 * s - q * 34 * s * (0.5 + (i % 4) / 6), (1.5 + q * 3) * s, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // спина и хвост
    if (k > 0.2 && k < 0.95) {
      const q = (k - 0.2) / 0.75;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.ellipse(x + h.dir * q * 20 * s, y, 26 * s, Math.sin(q * Math.PI) * 5 * s, 0, Math.PI, 0);
      ctx.fill();
      if (q > 0.6) {
        const tq = (q - 0.6) / 0.4;
        const tx = x - h.dir * 14 * s, ty = y - Math.sin(tq * Math.PI) * 18 * s;
        ctx.beginPath();
        ctx.moveTo(tx, y);
        ctx.lineTo(tx - 2 * s, ty);
        ctx.quadraticCurveTo(tx - 14 * s, ty - 6 * s, tx - 16 * s, ty - 2 * s);
        ctx.quadraticCurveTo(tx, ty + 2 * s, tx + 16 * s, ty - 2 * s);
        ctx.quadraticCurveTo(tx + 14 * s, ty - 6 * s, tx + 2 * s, ty);
        ctx.lineTo(tx, y);
        ctx.fill();
        if (tq > 0.85) this.splash(f, tx, y, 10 * s, (1 - tq) * 6);
      }
    }
  }

  private orca(f: Frame, h: Happening, k: number) {
    const { ctx, W, t } = f;
    const p = 0.35 + h.p * 0.35;
    const y = this.y(f, p), s = this.sz(f, p) * 1.3;
    const base = h.dir > 0 ? W * 0.1 + W * 0.6 * k : W * 0.9 - W * 0.6 * k;
    for (let i = 0; i < 3; i++) {
      const ph = (t * 1.1 + i * 1.3 + h.seed) % (Math.PI * 2);
      const up = Math.max(0, Math.sin(ph));
      if (up < 0.05) continue;
      const x = base - h.dir * i * 22 * s;
      const hh = (i === 0 ? 18 : 11) * s * up;
      ctx.fillStyle = this.col(f, "#101418", p);
      ctx.beginPath();
      ctx.moveTo(x - 5 * s, y);
      ctx.quadraticCurveTo(x - 2 * s, y - hh * 0.6, x + h.dir * 1 * s, y - hh);
      ctx.quadraticCurveTo(x + h.dir * 3 * s, y - hh * 0.4, x + 5 * s, y);
      ctx.fill();
      ctx.fillStyle = `rgba(255,255,255,${(0.4 * up).toFixed(3)})`;
      ctx.fillRect(x - 7 * s, y, 14 * s, 1.2);
    }
    void this.fade(k);
  }

  private dolphins(f: Frame, h: Happening, k: number) {
    const { ctx, W } = f;
    const p = 0.4 + h.p * 0.4;
    const y0 = this.y(f, p), s = this.sz(f, p);
    for (let i = 0; i < 4; i++) {
      const q = (k * 3 + i * 0.22) % 1;
      const cx = (h.dir > 0 ? W * 0.15 : W * 0.85) + h.dir * (k * W * 0.6 + i * 26 * s);
      const x = cx + h.dir * (q - 0.5) * 40 * s;
      const y = y0 - Math.sin(q * Math.PI) * 22 * s;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(h.dir * (q - 0.5) * 1.6);
      ctx.scale(h.dir, 1);
      ctx.fillStyle = this.col(f, "#4a5a6a", p);
      ctx.beginPath(); ctx.ellipse(0, 0, 13 * s, 3.8 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-2 * s, -3 * s); ctx.lineTo(-6 * s, -9 * s); ctx.lineTo(3 * s, -3 * s); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-12 * s, 0); ctx.lineTo(-17 * s, -4 * s); ctx.lineTo(-17 * s, 4 * s); ctx.fill();
      ctx.restore();
      if (q < 0.06 || q > 0.94) this.splash(f, x, y0, 6 * s, 0.8);
    }
  }

  private seals(f: Frame, h: Happening, k: number) {
    const { ctx, t } = f;
    const p = 0.45 + h.p * 0.3;
    const y = this.y(f, p), s = this.sz(f, p);
    const a = this.fade(k, 0.15);
    for (let i = 0; i < 3; i++) {
      const x = h.x0 + i * 16 * s;
      const bob = Math.sin(t * 1.3 + i * 2) * 1.5 * s;
      const up = Math.max(0, Math.sin(t * 0.6 + i * 1.7 + h.seed)) * a;
      if (up < 0.1) continue;
      ctx.fillStyle = this.col(f, "#4a4038", p);
      ctx.beginPath(); ctx.ellipse(x, y - 3 * s * up + bob, 3.5 * s, 4 * s * up, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = "#101010";
      ctx.fillRect(x + 1 * s, y - 5 * s * up + bob, 0.9 * s, 0.9 * s);
      ctx.fillStyle = `rgba(255,255,255,${(0.3 * up).toFixed(3)})`;
      ctx.beginPath(); ctx.ellipse(x, y + 0.5, 6 * s, 1 * s, 0, 0, Math.PI * 2); ctx.fill();
    }
  }

  private fishJump(f: Frame, h: Happening, k: number) {
    const { ctx } = f;
    const p = 0.55 + h.p * 0.4;
    const y0 = this.y(f, p), s = this.sz(f, p);
    const x = h.x0 + h.dir * (k - 0.5) * 24 * s;
    const y = y0 - Math.sin(k * Math.PI) * 14 * s;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(h.dir * (k - 0.5) * 2);
    ctx.fillStyle = this.col(f, "#b8c8d0", p);
    ctx.beginPath(); ctx.ellipse(0, 0, 6 * s, 2 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    if (k < 0.1 || k > 0.88) this.splash(f, x, y0, 5 * s, 0.9);
    ctx.strokeStyle = `rgba(255,255,255,${(0.4 * (1 - k)).toFixed(3)})`;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(h.x0 - h.dir * 12 * s, y0 + 1, 4 + k * 18 * s, 1 + k * 3 * s, 0, 0, Math.PI * 2); ctx.stroke();
  }

  private turtle(f: Frame, h: Happening, k: number) {
    const { ctx } = f;
    const p = 0.6 + h.p * 0.35;
    const y = this.y(f, p), s = this.sz(f, p);
    const up = Math.sin(k * Math.PI);
    const x = h.x0 + h.dir * k * 30 * s;
    ctx.fillStyle = this.col(f, "#5a5a34", p);
    ctx.beginPath(); ctx.ellipse(x, y, 9 * s, 3 * s * up, 0, Math.PI, 0); ctx.fill();
    ctx.beginPath(); ctx.arc(x + h.dir * 10 * s, y - 2 * s * up, 2.4 * s * up, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(255,255,255,${(0.35 * up).toFixed(3)})`;
    ctx.beginPath(); ctx.ellipse(x, y + 0.5, 12 * s, 1.2 * s, 0, 0, Math.PI * 2); ctx.fill();
  }

  private flyingFish(f: Frame, h: Happening, k: number) {
    const { ctx } = f;
    const p = 0.5 + h.p * 0.4;
    const y0 = this.y(f, p), s = this.sz(f, p);
    for (let i = 0; i < 5; i++) {
      const q = clamp((k - i * 0.06) / 0.7, 0, 1);
      if (q <= 0 || q >= 1) continue;
      const x = h.x0 + h.dir * (q * 140 * s + i * 6 * s);
      const y = y0 - Math.sin(q * Math.PI) * (10 + i * 2) * s;
      ctx.fillStyle = this.col(f, "#6a90c0", p);
      ctx.beginPath(); ctx.ellipse(x, y, 4 * s, 1.2 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = this.col(f, "#a8c8e8", p);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - h.dir * 2 * s, y - 4 * s); ctx.lineTo(x + h.dir * 2 * s, y - 1 * s); ctx.fill();
    }
  }

  private manta(f: Frame, h: Happening, k: number) {
    const { ctx } = f;
    const p = 0.5 + h.p * 0.4;
    const y0 = this.y(f, p), s = this.sz(f, p) * 1.3;
    const x = h.x0 + h.dir * (k - 0.5) * 20 * s;
    const y = y0 - Math.sin(k * Math.PI) * 24 * s;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(k * Math.PI * 2) * 0.8);
    ctx.fillStyle = this.col(f, "#1a1e28", p);
    const fl = Math.sin(k * 20) * 3 * s;
    ctx.beginPath(); ctx.moveTo(-16 * s, fl); ctx.quadraticCurveTo(0, -8 * s, 16 * s, fl); ctx.quadraticCurveTo(0, 4 * s, -16 * s, fl); ctx.fill();
    ctx.restore();
    if (k > 0.85) this.splash(f, x, y0, 14 * s, (1 - k) * 6);
  }

  private heron(f: Frame, h: Happening, k: number) {
    const { ctx, W, t } = f;
    const x = h.dir > 0 ? -30 + (W + 60) * k : W + 30 - (W + 60) * k;
    const y = f.hY - 30 - h.p * 40 + Math.sin(t * 0.7) * 4;
    const s = f.sc * 1.2;
    const fl = Math.sin(t * 3.5) * 5 * s;
    ctx.strokeStyle = this.col(f, "#e8e8e4", 0.5);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x - 12 * s, y - fl); ctx.quadraticCurveTo(x - 5 * s, y - 3 * s, x, y); ctx.quadraticCurveTo(x + 5 * s, y - 3 * s, x + 12 * s, y - fl);
    ctx.moveTo(x, y); ctx.lineTo(x + h.dir * 9 * s, y - 1 * s);
    ctx.moveTo(x, y); ctx.lineTo(x - h.dir * 10 * s, y + 1 * s);
    ctx.stroke();
  }

  private lavaBurst(f: Frame, h: Happening, k: number) {
    const { ctx, W } = f;
    const x = W * 0.72, y = f.hY - f.H * 0.26;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 26; i++) {
      const a = -Math.PI / 2 + ((i * 1.618) % 1 - 0.5) * 1.4;
      const v = 40 + ((i * 37) % 50);
      const tt = k * h.dur * 0.6;
      const px = x + Math.cos(a) * v * tt;
      const py = y + Math.sin(a) * v * tt + 30 * tt * tt;
      const al = Math.max(0, 1 - tt / 2.4) * this.fade(k, 0.05);
      if (al <= 0) continue;
      ctx.fillStyle = `rgba(255,${120 + (i % 3) * 40},40,${al.toFixed(3)})`;
      ctx.beginPath(); ctx.arc(px, py, 1.6, 0, Math.PI * 2); ctx.fill();
    }
    const g = ctx.createRadialGradient(x, y, 0, x, y, 60);
    g.addColorStop(0, `rgba(255,120,40,${(0.35 * (1 - k)).toFixed(3)})`);
    g.addColorStop(1, "rgba(255,120,40,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - 60, y - 60, 120, 120);
    ctx.restore();
  }

  private calving(f: Frame, h: Happening, k: number) {
    const { ctx, W } = f;
    const x = W * (0.45 + (h.seed % 1) * 0.4), y = f.hY;
    const hgt = f.H * 0.09;
    const q = clamp(k / 0.5, 0, 1);
    ctx.fillStyle = this.col(f, "#e4eef4", 0.3);
    ctx.save();
    ctx.translate(x, y - hgt * (1 - q));
    ctx.rotate(q * 0.5);
    ctx.fillRect(-10, -hgt * 0.6, 22, hgt * 0.6 * (1 - q * 0.6));
    ctx.restore();
    if (q >= 1) {
      const r = (k - 0.5) / 0.5;
      ctx.fillStyle = `rgba(255,255,255,${(0.6 * (1 - r)).toFixed(3)})`;
      ctx.beginPath(); ctx.ellipse(x, y + 1, 20 + r * 70, 3 + r * 8, 0, Math.PI, 0); ctx.fill();
      ctx.strokeStyle = `rgba(255,255,255,${(0.4 * (1 - r)).toFixed(3)})`;
      ctx.beginPath(); ctx.ellipse(x, y + 4 + r * 10, 30 + r * 120, 2 + r * 5, 0, 0, Math.PI * 2); ctx.stroke();
    }
  }

  private penguins(f: Frame, h: Happening, k: number) {
    const { ctx, t } = f;
    const p = 0.35 + h.p * 0.3;
    const y0 = this.y(f, p), s = this.sz(f, p);
    for (let i = 0; i < 6; i++) {
      const ph = (t * 1.6 + i * 0.9 + h.seed) % (Math.PI * 2);
      const up = Math.sin(ph);
      if (up < 0.2) continue;
      const x = h.x0 + h.dir * (k * 120 * s + i * 9 * s);
      const y = y0 - up * 7 * s;
      ctx.fillStyle = this.col(f, "#15171c", p);
      ctx.beginPath(); ctx.ellipse(x, y, 4 * s, 1.6 * s, h.dir * 0.3, 0, Math.PI * 2); ctx.fill();
      if (up > 0.9) this.splash(f, x, y0, 3 * s, 0.6);
    }
  }

  // ─── небо ───
  private plane(f: Frame, h: Happening, k: number) {
    const { ctx, W, H } = f;
    const y = H * (0.06 + h.p * 0.12);
    const x = h.dir > 0 ? -40 + (W + 80) * k : W + 40 - (W + 80) * k;
    const tail = W * 0.35;
    const g = ctx.createLinearGradient(x, y, x - h.dir * tail, y);
    g.addColorStop(0, hexA(mix("#ffffff", "#1a2030", f.night * 0.8), 0.55));
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.strokeStyle = g;
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - h.dir * tail, y + 6); ctx.stroke();
    ctx.fillStyle = mix("#e8e8e8", "#303440", f.night * 0.7);
    ctx.fillRect(x - 3, y - 0.8, 6, 1.6);
    if (f.night > 0.3 && Math.sin(f.t * 6) > 0.5) glow(ctx, x, y, 1, "#ff4040", 1);
  }

  private birds(f: Frame, h: Happening, k: number) {
    const { ctx, W, H, t } = f;
    const y = H * (0.1 + h.p * 0.15);
    const cx = h.dir > 0 ? -80 + (W + 160) * k : W + 80 - (W + 160) * k;
    ctx.strokeStyle = mix("#2a3038", f.hor, 0.35 + f.fogK * 0.3);
    ctx.lineWidth = 1.3;
    for (let i = 0; i < 9; i++) {
      const row = Math.ceil(i / 2), side = i % 2 ? 1 : -1;
      const x = cx - h.dir * row * 11, yy = y + side * row * 6 + Math.sin(t * 0.8 + i) * 1.5;
      const fl = Math.sin(t * 6 + i * 0.7) * 3;
      ctx.beginPath(); ctx.moveTo(x - 6, yy - fl); ctx.quadraticCurveTo(x - 2, yy - 2, x, yy); ctx.quadraticCurveTo(x + 2, yy - 2, x + 6, yy - fl); ctx.stroke();
    }
  }

  private balloon(f: Frame, h: Happening, k: number) {
    const { ctx, W, H, t } = f;
    const x = h.dir > 0 ? W * 0.05 + W * 0.9 * k : W * 0.95 - W * 0.9 * k;
    const y = H * (0.12 + h.p * 0.1) + Math.sin(t * 0.3) * 6;
    const r = 11 * f.sc;
    const cols = ["#d8402a", "#f0c040", "#2a70b0"];
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = mix(cols[i % 3], f.hor, 0.35);
      ctx.beginPath();
      ctx.moveTo(x, y - r);
      ctx.quadraticCurveTo(x - r + (i / 5) * r * 2, y - r * 0.2, x, y + r);
      ctx.quadraticCurveTo(x - r + ((i + 1) / 6) * r * 2, y - r * 0.2, x, y - r);
      ctx.fill();
    }
    ctx.strokeStyle = mix("#3a3a3a", f.hor, 0.3);
    ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(x - 4, y + r * 0.8); ctx.lineTo(x - 2, y + r * 1.6); ctx.moveTo(x + 4, y + r * 0.8); ctx.lineTo(x + 2, y + r * 1.6); ctx.stroke();
    ctx.fillStyle = mix("#6a4a2a", f.hor, 0.3);
    ctx.fillRect(x - 2.5, y + r * 1.6, 5, 3.5);
  }

  private fireworks(f: Frame, h: Happening) {
    const { ctx, W, H } = f;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let b = 0; b < 6; b++) {
      const t0 = b * 2.1;
      const tt = h.t - t0;
      if (tt < 0 || tt > 2.4) continue;
      const bx = W * (0.55 + ((b * 0.37 + h.seed) % 0.4)), by = H * (0.12 + ((b * 0.29) % 0.14));
      const col = ["255,120,90", "255,220,120", "140,200,255", "200,140,255"][b % 4];
      if (tt < 0.5) {
        ctx.fillStyle = `rgba(${col},0.9)`;
        ctx.fillRect(bx, f.hY - (f.hY - by) * (tt / 0.5), 1.5, 4);
        continue;
      }
      const q = (tt - 0.5) / 1.9;
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * Math.PI * 2;
        const r = q * 50 * f.sc;
        ctx.fillStyle = `rgba(${col},${(1 - q).toFixed(3)})`;
        ctx.beginPath(); ctx.arc(bx + Math.cos(a) * r, by + Math.sin(a) * r + q * q * 20, 1.4, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }

  private meteor(f: Frame, h: Happening, k: number) {
    const { ctx, W, H } = f;
    const x0 = W * (0.2 + (h.seed % 1) * 0.6), y0 = H * 0.05;
    const x = x0 + h.dir * k * 220, y = y0 + k * 100;
    const g = ctx.createLinearGradient(x, y, x - h.dir * 90, y - 40);
    g.addColorStop(0, `rgba(255,255,240,${(1 - k).toFixed(3)})`);
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.strokeStyle = g;
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - h.dir * 90, y - 40); ctx.stroke();
  }

  private farStorm(f: Frame, h: Happening, k: number) {
    const { ctx, W } = f;
    const x = W * (0.6 + (h.seed % 1) * 0.3), y = f.hY;
    const col = mix("#3a4050", f.hor, 0.3);
    ctx.fillStyle = hexA(col, 0.5 * this.fade(k, 0.2));
    ctx.beginPath(); ctx.ellipse(x, y - 30, 70, 22, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = hexA(col, 0.3 * this.fade(k, 0.2));
    ctx.lineWidth = 1;
    for (let i = 0; i < 12; i++) { ctx.beginPath(); ctx.moveTo(x - 50 + i * 9, y - 18); ctx.lineTo(x - 56 + i * 9, y); ctx.stroke(); }
    if (Math.sin(f.t * 7 + h.seed) > 0.97) {
      ctx.strokeStyle = "rgba(240,240,255,0.8)";
      ctx.beginPath(); ctx.moveTo(x, y - 28); ctx.lineTo(x - 5, y - 16); ctx.lineTo(x + 2, y - 12); ctx.lineTo(x - 3, y); ctx.stroke();
      ctx.fillStyle = "rgba(220,230,255,0.08)";
      ctx.fillRect(0, 0, W, y);
    }
  }
}
