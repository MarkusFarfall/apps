import type { Frame } from "./frame";
import type { LandRenderer } from "./land";
import { clamp, fbm, glow, hash1, hexA, mix, rng, af } from "./util";

interface BandObj { x: number; p: number; w: number; h: number; seed: number }
interface Island extends BandObj { pines: number; cottage: boolean; boathouse: boolean; lighthouse: boolean }
interface Berg extends BandObj { tab: boolean; peng: number; v: number }
interface Plume { x: number; y: number; r: number; t: number; vx: number; vy: number; kind: "steam" | "ash" }
interface Bird { x: number; y: number; s: number; seed: number }

const TAU = Math.PI * 2;

/** Сезонный цвет камыша */
function reedColors(season: number): [string, string] {
  switch (season) {
    case 0: return ["#6f7f3c", "#7a5e40"];
    case 1: return ["#5d7032", "#6a4e36"];
    case 2: return ["#b09450", "#d8c8a0"];
    default: return ["#a4966e", "#cfc4a8"];
  }
}

export class ExtraLand {
  private key = "";
  private far: number[] = [];
  private islands: Island[] = [];
  private reeds: BandObj[] = [];
  private huts: BandObj[] = [];
  private buoys: (BandObj & { red: boolean })[] = [];
  private otters: BandObj[] = [];
  private stacks: BandObj[] = [];
  private bergs: Berg[] = [];
  private mats: BandObj[] = [];
  private sandbars: BandObj[] = [];
  private mangroves: BandObj[] = [];
  private cypress: BandObj[] = [];
  private egrets: Bird[] = [];
  private poplars: number[] = [];
  private cliff: { pts: number[]; top: number[] } | null = null;
  private cone: { x0: number; x1: number; xp: number; top: number; cw: number } | null = null;
  private plumes: Plume[] = [];
  private plumeT = 0;
  private steamT = 0;
  private lavaX = 0;

  build(L: LandRenderer, f: Frame) {
    const { W, H, hY, sY, spot, loc } = f;
    const key = `${spot.id}|${W}|${H}`;
    if (key === this.key) return;
    this.key = key;
    this.far = [];
    this.islands = [];
    this.reeds = [];
    this.huts = [];
    this.buoys = [];
    this.otters = [];
    this.stacks = [];
    this.bergs = [];
    this.mats = [];
    this.sandbars = [];
    this.mangroves = [];
    this.cypress = [];
    this.egrets = [];
    this.poplars = [];
    this.cliff = null;
    this.cone = null;
    this.plumes = [];
    const r = rng(spot.seed * 53 + 7);
    const band = sY - hY;
    const feat = spot.feature;

    switch (loc.land) {
      case "estuary": {
        const far = L.ridge(f, -W * 0.05, W * 1.05, H * 0.014, 31.7, { rough: 1.6, tl: false, tr: false });
        L.layers.push({ pts: far.pts, base: "#6e7e52", haze: 0.72, reflect: true, hidden: true, x0: -W * 0.05, x1: W * 1.05 });
        this.far = far.pts;
        for (let i = 0; i < 26; i++) this.poplars.push(r() * W);
        const nearBands = feat === "reeds" ? [0.08, 0.2, 0.35, 0.55] : [0.06, 0.18, 0.3];
        for (const p of nearBands) {
          const n = 2 + Math.floor(r() * 3);
          for (let i = 0; i < n; i++) {
            const left = r() < 0.55;
            const x = left ? r() * W * 0.3 : W * (0.72 + r() * 0.3);
            this.reeds.push({ x, p, w: (40 + r() * 90) * (0.4 + p), h: (18 + r() * 14) * (0.35 + p * 1.2), seed: r() * 100 });
          }
        }
        if (feat === "stilts") {
          this.huts.push({ x: W * 0.58, p: 0.42, w: 1, h: 1, seed: 1 }, { x: W * 0.7, p: 0.3, w: 0.8, h: 1, seed: 2 }, { x: W * 0.86, p: 0.5, w: 1.1, h: 1, seed: 3 });
        }
        if (feat === "channel") {
          for (let i = 0; i < 6; i++) this.buoys.push({ x: W * (0.35 + (i % 3) * 0.22) + (i < 3 ? -20 : 20), p: i < 3 ? 0.25 : 0.62, w: 1, h: 1, seed: r() * 10, red: i % 2 === 0 });
        }
        this.egrets.push({ x: W * (0.12 + r() * 0.1), y: 0.35, s: 1, seed: r() * 10 });
        if (feat === "reeds") this.egrets.push({ x: W * 0.85, y: 0.45, s: 1.2, seed: r() * 10 });
        break;
      }
      case "skerries": {
        const far = L.ridge(f, -W * 0.05, W * 1.05, H * 0.018, 12.3, { rough: 7, tl: false, tr: false });
        L.layers.push({ pts: far.pts, base: "#5e6e70", haze: 0.8, reflect: true, hidden: true, x0: -W * 0.05, x1: W * 1.05 });
        this.far = far.pts;
        const plan: [number, number, number, number, boolean, boolean, boolean][] =
          feat === "cottage"
            ? [[0.78, 0.12, 0.2, 0.03, false, false, false], [0.14, 0.2, 0.26, 0.04, false, false, false], [0.25, 0.62, 0.42, 0.075, true, true, false], [0.9, 0.44, 0.24, 0.05, false, false, false]]
            : feat === "sound"
              ? [[0.55, 0.1, 0.16, 0.025, false, false, true], [0.06, 0.5, 0.34, 0.07, true, false, false], [0.95, 0.46, 0.3, 0.065, false, false, false], [0.35, 0.18, 0.14, 0.03, false, false, false]]
              : [[0.2, 0.1, 0.2, 0.03, false, false, false], [0.72, 0.16, 0.12, 0.03, false, false, true], [0.92, 0.26, 0.22, 0.045, true, false, false], [0.45, 0.06, 0.12, 0.02, false, false, false]];
        for (const [x, p, w, h, cottage, boathouse, lighthouse] of plan) {
          this.islands.push({ x: W * x, p, w: W * w, h: H * h, seed: r() * 100, pines: cottage ? 7 : 3 + Math.floor(r() * 7), cottage, boathouse, lighthouse });
          if (cottage) L.lights.push({ x: W * x - W * w * 0.08, y: hY + band * p - H * h * 0.55, c: "#ffc070", night: true });
        }
        this.islands.sort((a, b) => a.p - b.p);
        break;
      }
      case "kelpcoast": {
        const far = L.ridge(f, -W * 0.05, W * 0.62, H * 0.07, 41.2, { rough: 3.2, tl: false });
        L.layers.push({ pts: far.pts, base: "#48566a", haze: 0.82, reflect: true, hidden: true, x0: -W * 0.05, x1: W * 0.62 });
        this.far = far.pts;
        const x0 = feat === "canyon" ? W * 0.7 : W * 0.56;
        const topY = hY - H * (feat === "otters" ? 0.13 : 0.17);
        const pts: number[] = [x0, hY + 2];
        const top: number[] = [];
        for (let k = 0; k <= 10; k++) pts.push(x0 + k * W * 0.006 + (hash1(k * 5.1 + spot.seed) - 0.5) * 8, hY - (hY - topY) * (k / 10) + (hash1(k * 2.7) - 0.5) * 10);
        for (let x = x0 + W * 0.06; x <= W * 1.06; x += 7) {
          const y = topY + (fbm(x * 0.012, 7.3) - 0.5) * H * 0.05 + Math.sin(x * 0.05) * 3;
          pts.push(x, y);
          top.push(x, y);
        }
        pts.push(W * 1.06, hY + 2);
        this.cliff = { pts, top };
        L.layers.push({ pts, base: "#3a3632", haze: 0.3, reflect: true, hidden: true, x0, x1: W * 1.06 });
        for (let i = 0; i < 5; i++) {
          const ti = Math.floor(r() * (top.length / 2 - 2)) * 2;
          this.cypress.push({ x: top[ti], p: top[ti + 1], w: (26 + r() * 30) * f.sc, h: (18 + r() * 16) * f.sc, seed: r() * 100 });
        }
        const nStacks = feat === "otters" ? 2 : 3;
        for (let i = 0; i < nStacks; i++) this.stacks.push({ x: W * (0.36 + i * 0.1 + r() * 0.04), p: 0.12 + r() * 0.3, w: 12 + r() * 16, h: 26 + r() * 40, seed: r() * 100 });
        const nMats = feat === "canyon" ? 6 : 16;
        for (let i = 0; i < nMats; i++) this.mats.push({ x: r() * W, p: 0.08 + r() * 0.85, w: 20 + r() * 50, h: 1, seed: r() * 100 });
        if (feat === "otters") for (let i = 0; i < 5; i++) this.otters.push({ x: W * (0.42 + r() * 0.5), p: 0.35 + r() * 0.55, w: 1, h: 1, seed: r() * 100 });
        break;
      }
      case "mangrove": {
        const pts: number[] = [-W * 0.05, hY + 2];
        for (let x = -W * 0.05; x <= W * 1.05; x += 6) pts.push(x, hY - H * 0.022 - (fbm(x * 0.02, 3.3) * H * 0.028));
        pts.push(W * 1.05, hY + 2);
        L.layers.push({ pts, base: "#2e4a2c", haze: 0.55, reflect: true, hidden: true, x0: -W * 0.05, x1: W * 1.05 });
        this.far = pts;
        const both = feat === "creek";
        const nLeft = feat === "flats" ? 1 : 3;
        for (let i = 0; i < nLeft; i++) this.mangroves.push({ x: W * (0.02 + i * 0.09 + r() * 0.03), p: 0.35 + i * 0.22, w: 1, h: (0.8 + r() * 0.5) * (0.5 + (0.35 + i * 0.22)), seed: r() * 100 });
        if (both) for (let i = 0; i < 3; i++) this.mangroves.push({ x: W * (0.98 - i * 0.08 - r() * 0.03), p: 0.3 + i * 0.22, w: 1, h: (0.8 + r() * 0.5) * (0.5 + (0.3 + i * 0.22)), seed: r() * 100 });
        if (feat === "flats") for (let i = 0; i < 5; i++) this.sandbars.push({ x: W * (0.2 + r() * 0.75), p: 0.15 + r() * 0.7, w: 50 + r() * 140, h: 1, seed: r() * 100 });
        for (let i = 0; i < 6; i++) this.egrets.push({ x: r() * W, y: -1, s: 0.6 + r() * 0.5, seed: r() * 10 });
        break;
      }
      case "volcano": {
        const far = L.ridge(f, -W * 0.05, W * 0.3, H * 0.03, 17.1, { rough: 2, tl: false });
        L.layers.push({ pts: far.pts, base: "#34424a", haze: 0.8, reflect: true, hidden: true, x0: -W * 0.05, x1: W * 0.3 });
        this.far = far.pts;
        const big = feat !== "caldera";
        const x0 = big ? W * 0.42 : W * 0.6, x1 = big ? W * 1.08 : W * 1.04;
        const top = hY - H * (big ? 0.27 : 0.15);
        const xp = x0 + (x1 - x0) * 0.52;
        this.cone = { x0, x1, xp, top, cw: (x1 - x0) * 0.022 };
        const cp: number[] = [x0, hY + 2];
        for (let k = 0; k <= 30; k++) {
          const q = k / 30;
          const x = x0 + (xp - this.cone.cw - x0) * q;
          cp.push(x, hY - (hY - top) * (0.55 * q + 0.45 * Math.pow(q, 1.9)) + (hash1(k * 3.7) - 0.5) * 3);
        }
        cp.push(xp - this.cone.cw * 0.3, top + 5, xp + this.cone.cw * 0.4, top + 4, xp + this.cone.cw, top + 1);
        for (let k = 0; k <= 30; k++) {
          const q = 1 - k / 30;
          const x = xp + this.cone.cw + (x1 - xp - this.cone.cw) * (k / 30);
          cp.push(x, hY - (hY - top) * (0.5 * q + 0.5 * Math.pow(q, 2)) + (hash1(k * 5.3) - 0.5) * 3);
        }
        cp.push(x1, hY + 2);
        L.layers.push({ pts: cp, base: "#2e2a28", haze: 0.35, reflect: true, hidden: true, x0, x1 });
        this.lavaX = x0 + (xp - x0) * 0.55;
        L.lights.push({ x: xp, y: top - 4, c: "#ff6a20", night: true });
        if (feat === "lava") L.lights.push({ x: this.lavaX, y: hY - 2, c: "#ff5a18", night: false });
        if (feat === "blacksand") for (const [px, ph, pl] of [[0.08, 0.1, 12], [0.14, 0.12, -8], [0.2, 0.09, 14], [0.3, 0.08, -10]]) L.palms.push({ x: W * px, y: hY - 1, h: H * ph * 0.7, lean: pl });
        break;
      }
      case "ice": {
        const mt = L.ridge(f, -W * 0.05, W * 1.05, H * 0.1, 23.9, { sharp: 1.4, rough: 3, tl: false, tr: false });
        L.layers.push({ pts: mt.pts, base: "#b8c6d2", haze: 0.8, reflect: true, hidden: true, x0: -W * 0.05, x1: W * 1.05 });
        this.far = mt.pts;
        const near = feat === "iceedge";
        const sx0 = near ? W * 0.3 : W * 0.5, sh = H * (near ? 0.11 : 0.045);
        const pts: number[] = [sx0, hY + 2, sx0 + 4, hY - sh];
        for (let x = sx0 + 10; x <= W * 1.06; x += 12) pts.push(x, hY - sh + (hash1(x * 0.13) - 0.5) * 2);
        pts.push(W * 1.06, hY + 2);
        this.cliff = { pts, top: [sx0, sh] };
        L.layers.push({ pts, base: "#e4eef4", haze: 0.3, reflect: true, hidden: true, x0: sx0, x1: W * 1.06 });
        const nb = feat === "icebergs" ? 7 : feat === "polynya" ? 2 : 3;
        for (let i = 0; i < nb; i++) {
          const p = 0.1 + r() * 0.75;
          this.bergs.push({ x: W * (near ? r() * 0.3 : r() * 0.95), p, w: (30 + r() * 80) * (0.4 + p), h: (10 + r() * 30) * (0.4 + p), seed: r() * 100, tab: r() < 0.55, peng: r() < 0.4 ? 2 + Math.floor(r() * 5) : 0, v: 0.5 + r() });
        }
        this.bergs.sort((a, b) => a.p - b.p);
        const nf = feat === "polynya" ? 22 : 8;
        for (let i = 0; i < nf; i++) L.floes.push({ x: r() * W, y: hY + band * (0.1 + r() * 0.85), w: 18 + r() * 60, h: 3 + r() * 5, v: 1 + r() * 2 });
        break;
      }
    }
  }

  // ───────────── за основными слоями ─────────────
  drawBack(L: LandRenderer, f: Frame) {
    const { ctx, W, hY } = f;
    if (!this.far.length) return;
    const land = f.loc.land;
    if (land === "estuary") {
      const c = L.colorOf(f, "#6e7e52", 0.72);
      this.fill(ctx, this.far, c);
      const pc = L.colorOf(f, f.e.season === 2 ? "#8a7a3a" : f.e.season === 3 ? "#6a6456" : "#3e5232", 0.66);
      ctx.fillStyle = pc;
      for (const x of this.poplars) {
        const h = 10 + hash1(x) * 10;
        ctx.beginPath();
        ctx.ellipse(x, hY - h * 0.55, 2.2 + hash1(x * 3) * 1.5, h * 0.55, 0, 0, TAU);
        ctx.fill();
      }
      // водонапорная башня и элеватор
      ctx.fillStyle = L.colorOf(f, "#5a5a54", 0.7);
      const tx = W * 0.83;
      ctx.fillRect(tx - 1, hY - 22, 2, 18);
      ctx.beginPath();
      ctx.moveTo(tx - 5, hY - 22);
      ctx.lineTo(tx + 5, hY - 22);
      ctx.lineTo(tx + 3, hY - 30);
      ctx.lineTo(tx - 3, hY - 30);
      ctx.fill();
      ctx.fillRect(W * 0.9, hY - 16, 12, 14);
      ctx.fillRect(W * 0.9 + 3, hY - 22, 6, 6);
      if (f.night > 0.3) glow(ctx, tx, hY - 31, 1.2, "#ff4040", f.night);
    } else if (land === "skerries") {
      this.fill(ctx, this.far, L.colorOf(f, "#5e6e70", 0.8));
      ctx.fillStyle = L.colorOf(f, "#2a3a32", 0.72);
      for (let i = 2; i < this.far.length - 2; i += 6) {
        const x = this.far[i], y = this.far[i + 1];
        if (hY - y > 3) {
          ctx.beginPath();
          ctx.moveTo(x, y - 5);
          ctx.lineTo(x - 2, y + 1);
          ctx.lineTo(x + 2, y + 1);
          ctx.fill();
        }
      }
    } else if (land === "kelpcoast") {
      this.fill(ctx, this.far, L.colorOf(f, "#48566a", 0.82));
    } else if (land === "mangrove") {
      const c = L.colorOf(f, "#2e4a2c", 0.55);
      ctx.fillStyle = c;
      for (let i = 2; i < this.far.length - 2; i += 2) {
        const x = this.far[i], y = this.far[i + 1];
        ctx.beginPath();
        ctx.arc(x, y + 4, 7 + hash1(x) * 8, Math.PI, 0);
        ctx.fill();
      }
      ctx.fillRect(-10, hY - H(f) * 0.02, W + 20, H(f) * 0.02 + 2);
      // жаркое марево
      const g = ctx.createLinearGradient(0, hY - 40, 0, hY + 4);
      g.addColorStop(0, "rgba(255,240,200,0)");
      g.addColorStop(1, `rgba(255,236,190,${af(0.18 * (1 - f.night))})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, hY - 40, W, 44);
    } else if (land === "volcano") {
      this.fill(ctx, this.far, L.colorOf(f, "#34424a", 0.8));
    } else if (land === "ice") {
      const c = L.colorOf(f, "#c8d4de", 0.78);
      this.fill(ctx, this.far, c);
      ctx.fillStyle = L.colorOf(f, "#4a4e56", 0.78);
      for (let i = 4; i < this.far.length - 4; i += 10) {
        const x = this.far[i], y = this.far[i + 1];
        if (hash1(x) < 0.35) {
          ctx.beginPath();
          ctx.moveTo(x, y + 2);
          ctx.lineTo(x + 6, y + 10);
          ctx.lineTo(x - 4, y + 12);
          ctx.fill();
        }
      }
    }
  }

  // ───────────── после основных слоёв (на линии горизонта) ─────────────
  drawAbove(L: LandRenderer, f: Frame) {
    const land = f.loc.land;
    if (land === "kelpcoast") this.drawKelpCliffs(L, f);
    else if (land === "volcano") this.drawVolcano(L, f);
    else if (land === "ice") this.drawShelf(L, f);
    else if (land === "mangrove") this.drawEgretsSky(L, f);
  }

  // ───────────── предметы в полосе моря ─────────────
  drawSea(L: LandRenderer, f: Frame) {
    const land = f.loc.land;
    if (land === "estuary") {
      for (const r of this.reeds) this.drawReedClump(L, f, r);
      for (const h of this.huts) this.drawHut(L, f, h);
      for (const b of this.buoys) this.drawBuoy(L, f, b);
      for (const e of this.egrets) if (e.y > 0) this.drawHeron(L, f, e);
    } else if (land === "skerries") {
      for (const i of this.islands) this.drawIsland(L, f, i);
    } else if (land === "kelpcoast") {
      for (const m of this.mats) this.drawKelpMat(L, f, m);
      for (const s of this.stacks) this.drawStack(L, f, s);
      for (const o of this.otters) this.drawOtter(L, f, o);
    } else if (land === "mangrove") {
      for (const b of this.sandbars) this.drawSandbar(L, f, b);
      for (const m of this.mangroves) this.drawMangrove(L, f, m);
    } else if (land === "volcano") {
      if (f.spot.feature === "caldera") this.drawCalderaRing(L, f);
      this.drawSteam(f);
    } else if (land === "ice") {
      for (const b of this.bergs) this.drawBerg(L, f, b);
    }
  }

  // ───────────── передний план ─────────────
  drawFront(L: LandRenderer, f: Frame) {
    const { W, sY, sc, e } = f;
    const land = f.loc.land;
    if (land === "estuary" && f.spot.feature === "reeds") {
      const [c, pc] = reedColors(e.season);
      this.reedStalks(f, 0, W * 0.16, sY + 4, 150 * sc, 34, 7.1, L.colorOf(f, c, 0), L.colorOf(f, pc, 0), 2.2);
    }
    if (land === "mangrove" && f.spot.feature === "roots") this.drawMangrove(L, f, { x: W * 0.06, p: 1, w: 1, h: 1.9, seed: 3.3 }, true);
    if (land === "ice" && (f.spot.feature === "icebergs" || f.spot.feature === "iceedge")) {
      this.drawBerg(L, f, { x: W * 0.87, p: 1, w: 150 * sc, h: 60 * sc, seed: 9.9, tab: true, peng: 4, v: 0 }, true);
    }
  }

  // ═════════════ примитивы ═════════════
  private fill(ctx: CanvasRenderingContext2D, pts: number[], c: string) {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
    ctx.fill();
  }

  private bandY(f: Frame, p: number) {
    return f.hY + (f.sY - f.hY) * p;
  }

  private haze(p: number) {
    return clamp(0.62 - p * 0.55, 0.05, 0.7);
  }

  /** Отражение объекта в воде: рисует fn, отражённый вокруг y, приглушённо */
  private reflect(f: Frame, y: number, fn: () => void, a = 0.35) {
    const { ctx, W, hY, sY } = f;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, Math.max(hY, y), W, sY - Math.max(hY, y) + f.amp);
    ctx.clip();
    ctx.translate(0, y);
    ctx.scale(1, -0.55);
    ctx.translate(0, -y);
    ctx.globalAlpha *= a * (1 - f.amp / 16);
    fn();
    ctx.restore();
  }

  private reedStalks(f: Frame, x0: number, x1: number, yBase: number, h: number, n: number, seed: number, c: string, pc: string, lw: number) {
    const { ctx, t } = f;
    const wind = f.wind;
    ctx.lineCap = "round";
    for (let i = 0; i < n; i++) {
      const k = hash1(seed + i * 1.37);
      const x = x0 + (x1 - x0) * ((i + k * 0.8) / n);
      const hh = h * (0.55 + 0.45 * hash1(seed * 3 + i));
      const sway = Math.sin(t * 1.2 + seed + i * 0.6) * hh * 0.05 * (0.4 + wind) + wind * hh * 0.06;
      ctx.strokeStyle = c;
      ctx.lineWidth = lw * (0.7 + k * 0.5);
      ctx.beginPath();
      ctx.moveTo(x, yBase);
      ctx.quadraticCurveTo(x + sway * 0.3, yBase - hh * 0.6, x + sway, yBase - hh);
      ctx.stroke();
      if (i % 3 === 0) {
        ctx.lineWidth = lw * 0.6;
        ctx.beginPath();
        ctx.moveTo(x + sway * 0.2, yBase - hh * 0.35);
        ctx.quadraticCurveTo(x + hh * 0.12 + sway * 0.5, yBase - hh * 0.55, x + hh * 0.2 + sway, yBase - hh * 0.5);
        ctx.stroke();
      }
      ctx.fillStyle = pc;
      ctx.beginPath();
      ctx.ellipse(x + sway, yBase - hh - lw * 3, lw * 1.3, lw * 4.2, sway * 0.02 + 0.15, 0, TAU);
      ctx.fill();
    }
  }

  private drawReedClump(L: LandRenderer, f: Frame, r: BandObj) {
    const y = this.bandY(f, r.p);
    const hz = this.haze(r.p);
    const [c0, p0] = reedColors(f.e.season);
    const c = L.colorOf(f, c0, hz), pc = L.colorOf(f, p0, hz);
    const n = Math.max(6, Math.round(r.w / 3));
    this.reflect(f, y, () => this.reedStalks(f, r.x - r.w / 2, r.x + r.w / 2, y, r.h, n, r.seed, c, pc, 0.6 + r.p * 1.2), 0.3);
    this.reedStalks(f, r.x - r.w / 2, r.x + r.w / 2, y, r.h, n, r.seed, c, pc, 0.6 + r.p * 1.2);
  }

  private drawHut(L: LandRenderer, f: Frame, h: BandObj) {
    const { ctx, night, t } = f;
    const y = this.bandY(f, h.p);
    const s = (0.5 + h.p) * h.w * f.sc;
    const hz = this.haze(h.p);
    const wood = L.colorOf(f, "#5a4430", hz), dark = L.colorOf(f, "#3a2a1c", hz), thatch = L.colorOf(f, "#a08a58", hz);
    const draw = () => {
      ctx.strokeStyle = dark;
      ctx.lineWidth = 1.6 * s;
      for (const dx of [-16, -5, 6, 16]) {
        ctx.beginPath();
        ctx.moveTo(h.x + dx * s, y + 2);
        ctx.lineTo(h.x + dx * s, y - 12 * s);
        ctx.stroke();
      }
      ctx.fillStyle = wood;
      ctx.fillRect(h.x - 20 * s, y - 13 * s, 40 * s, 2.5 * s);
      ctx.fillRect(h.x - 13 * s, y - 27 * s, 26 * s, 14 * s);
      ctx.fillStyle = thatch;
      ctx.beginPath();
      ctx.moveTo(h.x - 17 * s, y - 26 * s);
      ctx.lineTo(h.x, y - 38 * s);
      ctx.lineTo(h.x + 17 * s, y - 26 * s);
      ctx.fill();
      ctx.fillStyle = night > 0.3 ? `rgba(255,190,110,${night})` : dark;
      ctx.fillRect(h.x + 3 * s, y - 23 * s, 5 * s, 5 * s);
      ctx.fillStyle = dark;
      ctx.fillRect(h.x - 8 * s, y - 22 * s, 5 * s, 9 * s);
      // мостки
      ctx.fillStyle = wood;
      ctx.fillRect(h.x - 42 * s, y - 13 * s, 22 * s, 1.8 * s);
      ctx.strokeStyle = dark;
      ctx.lineWidth = 1 * s;
      for (const dx of [-40, -30]) {
        ctx.beginPath();
        ctx.moveTo(h.x + dx * s, y + 2);
        ctx.lineTo(h.x + dx * s, y - 12 * s);
        ctx.stroke();
      }
      // сеть на кольях
      ctx.strokeStyle = dark;
      ctx.lineWidth = 1 * s;
      const nx = h.x + 26 * s;
      ctx.beginPath();
      ctx.moveTo(nx, y + 1);
      ctx.lineTo(nx, y - 24 * s);
      ctx.moveTo(nx + 22 * s, y + 1);
      ctx.lineTo(nx + 22 * s, y - 24 * s);
      ctx.stroke();
      ctx.strokeStyle = hexA(L.colorOf(f, "#8a8a70", hz), 0.6);
      ctx.lineWidth = 0.6;
      const sag = Math.sin(t * 0.8 + h.seed) * 1.5 * s;
      for (let k = 0; k <= 6; k++) {
        ctx.beginPath();
        ctx.moveTo(nx + (22 * s * k) / 6, y - 23 * s);
        ctx.lineTo(nx + (22 * s * k) / 6 + sag, y - 8 * s);
        ctx.stroke();
      }
      for (let k = 0; k <= 4; k++) {
        ctx.beginPath();
        ctx.moveTo(nx, y - 23 * s + k * 3.7 * s);
        ctx.quadraticCurveTo(nx + 11 * s + sag, y - 21 * s + k * 3.7 * s, nx + 22 * s, y - 23 * s + k * 3.7 * s);
        ctx.stroke();
      }
    };
    this.reflect(f, y, draw, 0.35);
    draw();
  }

  private drawBuoy(L: LandRenderer, f: Frame, b: BandObj & { red: boolean }) {
    const { ctx, t, night } = f;
    const y = this.bandY(f, b.p) + Math.sin(t * 1.6 + b.seed) * 1.2;
    const s = (0.4 + b.p) * f.sc;
    const tilt = Math.sin(t * 1.3 + b.seed) * 0.12;
    const col = L.colorOf(f, b.red ? "#b83a2a" : "#2a7a4a", this.haze(b.p));
    ctx.save();
    ctx.translate(b.x, y);
    ctx.rotate(tilt);
    ctx.fillStyle = col;
    ctx.beginPath();
    if (b.red) {
      ctx.moveTo(-6 * s, 0);
      ctx.lineTo(0, -18 * s);
      ctx.lineTo(6 * s, 0);
    } else ctx.rect(-5 * s, -16 * s, 10 * s, 16 * s);
    ctx.fill();
    ctx.fillStyle = hexA("#ffffff", 0.3);
    ctx.fillRect(-5 * s, -8 * s, 10 * s, 2 * s);
    ctx.restore();
    ctx.fillStyle = hexA("#ffffff", 0.35);
    ctx.fillRect(b.x - 8 * s, y, 16 * s, 1.2);
    if (night > 0.3 && Math.sin(t * 2 + b.seed * 3) > 0.6) glow(ctx, b.x, y - 20 * s, 1.6 * s, b.red ? "#ff4030" : "#40ff60", night);
  }

  private drawHeron(L: LandRenderer, f: Frame, e: Bird) {
    const { ctx, t } = f;
    const y = this.bandY(f, e.y);
    const s = e.s * f.sc * (0.5 + e.y);
    const c = L.colorOf(f, "#8a9098", this.haze(e.y));
    const bob = Math.sin(t * 0.6 + e.seed) > 0.95 ? -2 * s : 0;
    ctx.strokeStyle = L.colorOf(f, "#4a4a44", this.haze(e.y));
    ctx.lineWidth = 1 * s;
    ctx.beginPath();
    ctx.moveTo(e.x - 1 * s, y);
    ctx.lineTo(e.x - 1 * s, y - 14 * s);
    ctx.moveTo(e.x + 2 * s, y);
    ctx.lineTo(e.x + 1 * s, y - 14 * s);
    ctx.stroke();
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.ellipse(e.x, y - 18 * s, 8 * s, 4.5 * s, -0.35, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = c;
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.moveTo(e.x + 5 * s, y - 20 * s);
    ctx.bezierCurveTo(e.x + 10 * s, y - 24 * s, e.x + 3 * s, y - 28 * s + bob, e.x + 7 * s, y - 32 * s + bob);
    ctx.stroke();
    ctx.strokeStyle = L.colorOf(f, "#c8a040", this.haze(e.y));
    ctx.lineWidth = 1.2 * s;
    ctx.beginPath();
    ctx.moveTo(e.x + 7 * s, y - 32 * s + bob);
    ctx.lineTo(e.x + 14 * s, y - 31 * s + bob);
    ctx.stroke();
  }

  private drawIsland(L: LandRenderer, f: Frame, i: Island) {
    const { ctx, e, night, t } = f;
    const y = this.bandY(f, i.p);
    const hz = this.haze(i.p);
    const rock = L.colorOf(f, e.season === 3 ? "#a8a8aa" : "#8a7e78", hz);
    const rockDark = L.colorOf(f, "#4e4642", hz);
    const pine = L.colorOf(f, e.season === 3 ? "#34443c" : "#1e2e24", hz);
    const x0 = i.x - i.w / 2, x1 = i.x + i.w / 2;
    const dome = () => {
      ctx.beginPath();
      ctx.moveTo(x0, y + 1);
      ctx.bezierCurveTo(x0 + i.w * 0.12, y - i.h * 0.7, x0 + i.w * 0.3, y - i.h, i.x - i.w * 0.05, y - i.h);
      ctx.bezierCurveTo(i.x + i.w * 0.25, y - i.h, x1 - i.w * 0.12, y - i.h * 0.5, x1, y + 1);
      ctx.closePath();
    };
    const body = () => {
      dome();
      const g = ctx.createLinearGradient(0, y - i.h, 0, y);
      g.addColorStop(0, mix(rock, "#ffffff", 0.12 * (1 - night)));
      g.addColorStop(1, rockDark);
      ctx.fillStyle = g;
      ctx.fill();
      // лес на макушке
      ctx.fillStyle = pine;
      for (let k = 0; k < i.pines; k++) {
        const q = (k + 0.5) / i.pines;
        const px = x0 + i.w * (0.2 + q * 0.6) + (hash1(i.seed + k) - 0.5) * i.w * 0.08;
        const top = y - i.h * (0.95 - Math.pow(Math.abs(q - 0.45) * 1.6, 2) * 0.4);
        const ph = i.h * (0.55 + hash1(i.seed * 2 + k) * 0.6);
        const sway = Math.sin(t * 0.7 + k + i.seed) * ph * 0.02;
        ctx.beginPath();
        ctx.moveTo(px + sway, top - ph);
        ctx.lineTo(px - ph * 0.22, top + 2);
        ctx.lineTo(px + ph * 0.22, top + 2);
        ctx.fill();
      }
      if (i.cottage) {
        const cx = i.x - i.w * 0.12, cy = y - i.h * 0.52, cs = i.h * 0.32;
        ctx.fillStyle = L.colorOf(f, "#8e2a1e", hz);
        ctx.fillRect(cx - cs, cy - cs * 0.9, cs * 2, cs * 0.9);
        ctx.fillStyle = L.colorOf(f, "#2c2c30", hz);
        ctx.beginPath();
        ctx.moveTo(cx - cs * 1.15, cy - cs * 0.9);
        ctx.lineTo(cx, cy - cs * 1.6);
        ctx.lineTo(cx + cs * 1.15, cy - cs * 0.9);
        ctx.fill();
        ctx.fillStyle = L.colorOf(f, "#f0ece4", hz);
        ctx.fillRect(cx - cs, cy - cs * 0.9, cs * 0.12, cs * 0.9);
        ctx.fillRect(cx + cs * 0.88, cy - cs * 0.9, cs * 0.12, cs * 0.9);
        ctx.fillStyle = night > 0.3 ? `rgba(255,196,110,${night})` : L.colorOf(f, "#f0ece4", hz);
        ctx.fillRect(cx - cs * 0.55, cy - cs * 0.6, cs * 0.35, cs * 0.3);
        ctx.fillRect(cx + cs * 0.2, cy - cs * 0.6, cs * 0.35, cs * 0.3);
        // флагшток
        ctx.strokeStyle = L.colorOf(f, "#e8e8e8", hz);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx + cs * 2, cy);
        ctx.lineTo(cx + cs * 2, cy - cs * 2.4);
        ctx.stroke();
        ctx.fillStyle = L.colorOf(f, "#2a5aa0", hz);
        const fw = Math.sin(t * 5) * 1.5;
        ctx.beginPath();
        ctx.moveTo(cx + cs * 2, cy - cs * 2.4);
        ctx.lineTo(cx + cs * 2.8, cy - cs * 2.25 + fw);
        ctx.lineTo(cx + cs * 2, cy - cs * 2.05);
        ctx.fill();
      }
      if (i.boathouse) {
        const bx = x0 + i.w * 0.12;
        ctx.fillStyle = L.colorOf(f, "#8e2a1e", hz);
        ctx.fillRect(bx, y - i.h * 0.28, i.h * 0.45, i.h * 0.28);
        ctx.fillStyle = L.colorOf(f, "#2c2c30", hz);
        ctx.beginPath();
        ctx.moveTo(bx - 2, y - i.h * 0.28);
        ctx.lineTo(bx + i.h * 0.225, y - i.h * 0.45);
        ctx.lineTo(bx + i.h * 0.45 + 2, y - i.h * 0.28);
        ctx.fill();
        ctx.fillStyle = L.colorOf(f, "#5a4430", hz);
        ctx.fillRect(bx + i.h * 0.45, y - 2, i.w * 0.18, 2);
      }
      if (i.lighthouse) {
        const lx = i.x + i.w * 0.1, ly = y - i.h * 0.85, lh = i.h * 1.1;
        ctx.fillStyle = L.colorOf(f, "#f0ece4", hz);
        ctx.fillRect(lx - lh * 0.08, ly - lh, lh * 0.16, lh);
        ctx.fillStyle = L.colorOf(f, "#b83a2a", hz);
        ctx.fillRect(lx - lh * 0.08, ly - lh * 0.6, lh * 0.16, lh * 0.18);
        if (night > 0.3 && Math.sin(t * 1.5) > 0) glow(ctx, lx, ly - lh - 2, 2.5, "#fff0b0", night);
      }
      // полосы ледниковой шлифовки
      ctx.strokeStyle = hexA(mix(rock, "#ffffff", 0.3), 0.35 * (1 - night));
      ctx.lineWidth = 1;
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.moveTo(x0 + i.w * (0.15 + k * 0.1), y - i.h * (0.25 + k * 0.08));
        ctx.lineTo(x0 + i.w * (0.35 + k * 0.1), y - i.h * (0.4 + k * 0.1));
        ctx.stroke();
      }
    };
    this.reflect(f, y, body, 0.4);
    body();
    ctx.fillStyle = hexA("#ffffff", 0.3 + 0.2 * (1 - night));
    const p = (Math.sin(t * 1.2 + i.seed) + 1) / 2;
    ctx.beginPath();
    ctx.ellipse(i.x, y + 1, i.w * (0.5 + p * 0.04), 1 + p, 0, 0, TAU);
    ctx.fill();
  }

  private drawKelpCliffs(L: LandRenderer, f: Frame) {
    const { ctx, hY, H, W, t, night, e } = f;
    if (!this.cliff) return;
    const c = L.colorOf(f, "#3a3632", 0.3);
    const g = ctx.createLinearGradient(0, hY - H * 0.2, 0, hY);
    g.addColorStop(0, mix(c, "#ffffff", 0.05 * (1 - night)));
    g.addColorStop(1, mix(c, "#000000", 0.25));
    ctx.fillStyle = g;
    ctx.beginPath();
    const p = this.cliff.pts;
    ctx.moveTo(p[0], p[1]);
    for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
    ctx.closePath();
    ctx.fill();
    // трава на вершине
    ctx.strokeStyle = L.colorOf(f, e.season === 2 ? "#8a7a3a" : e.season === 3 ? "#6a6a4a" : "#5a6a3a", 0.3);
    ctx.lineWidth = 3;
    ctx.beginPath();
    const tp = this.cliff.top;
    for (let i = 0; i < tp.length; i += 2) (i ? ctx.lineTo(tp[i], tp[i + 1] + 1.5) : ctx.moveTo(tp[i], tp[i + 1] + 1.5));
    ctx.stroke();
    // трещины
    ctx.strokeStyle = hexA(mix(c, "#000000", 0.5), 0.5);
    ctx.lineWidth = 1;
    for (let k = 0; k < 9; k++) {
      const x = tp[0] + (W - tp[0]) * (k / 9) + 10;
      const y0 = hY - H * 0.14 + hash1(k) * 10;
      ctx.beginPath();
      ctx.moveTo(x, y0);
      ctx.lineTo(x + (hash1(k * 3) - 0.5) * 16, hY - 4);
      ctx.stroke();
    }
    // кипарисы
    for (const cy of this.cypress) this.drawCypress(L, f, cy);
    // прибой у подножия
    for (let x = p[0]; x < W; x += 12) {
      const q = (Math.sin(t * 1.3 + x * 0.04) + 1) / 2;
      ctx.fillStyle = hexA("#ffffff", (0.3 + q * 0.4) * (1 - night * 0.6));
      ctx.fillRect(x, hY + 1 + q * 2, 9 + q * 6, 1.6);
    }
    // полосы тумана
    const fogA = 0.22 + f.fogK * 0.35 + (f.weather === "clear" ? -0.08 : 0);
    const fc = mix(mix("#dfe4e6", f.hor, 0.35), "#0e1620", night * 0.85);
    for (let k = 0; k < 7; k++) {
      const x = ((t * (5 + k * 2) + k * 260) % (W + 800)) - 400;
      const y = hY - H * 0.03 + (k % 3) * H * 0.018;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1, 0.12);
      const g2 = ctx.createRadialGradient(0, 0, 0, 0, 0, 340);
      g2.addColorStop(0, hexA(fc, fogA));
      g2.addColorStop(1, hexA(fc, 0));
      ctx.fillStyle = g2;
      ctx.beginPath();
      ctx.arc(0, 0, 340, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawCypress(L: LandRenderer, f: Frame, c: BandObj) {
    const { ctx, t } = f;
    const col = L.colorOf(f, "#233228", 0.28), trunk = L.colorOf(f, "#3a2e24", 0.28);
    const sway = Math.sin(t * 0.6 + c.seed) * 1.5;
    const lean = c.w * 0.3;
    ctx.strokeStyle = trunk;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(c.x, c.p + 1);
    ctx.quadraticCurveTo(c.x + lean * 0.3, c.p - c.h * 0.5, c.x + lean + sway, c.p - c.h);
    ctx.moveTo(c.x + lean * 0.4, c.p - c.h * 0.55);
    ctx.lineTo(c.x - c.w * 0.25, c.p - c.h * 0.8);
    ctx.stroke();
    ctx.fillStyle = col;
    const clumps: [number, number, number, number][] = [[lean + sway, -c.h, 0.55, 0.16], [lean * 0.4 + sway, -c.h * 0.92, 0.42, 0.13], [-c.w * 0.25, -c.h * 0.82, 0.3, 0.1], [lean * 1.3 + sway, -c.h * 0.9, 0.34, 0.11]];
    for (const [dx, dy, rw, rh] of clumps) {
      ctx.beginPath();
      ctx.ellipse(c.x + dx, c.p + dy, c.w * rw, c.w * rh, -0.05, 0, TAU);
      ctx.fill();
    }
  }

  private drawStack(L: LandRenderer, f: Frame, s: BandObj) {
    const { ctx, t, night } = f;
    const y = this.bandY(f, s.p);
    const k = 0.5 + s.p;
    const hz = this.haze(s.p);
    const draw = () => {
      ctx.fillStyle = L.colorOf(f, "#3e3834", hz);
      ctx.beginPath();
      ctx.moveTo(s.x - s.w * k * 0.6, y + 1);
      ctx.lineTo(s.x - s.w * k * 0.4, y - s.h * k * 0.8);
      ctx.lineTo(s.x - s.w * k * 0.15, y - s.h * k);
      ctx.lineTo(s.x + s.w * k * 0.3, y - s.h * k * 0.92);
      ctx.lineTo(s.x + s.w * k * 0.55, y + 1);
      ctx.fill();
      ctx.fillStyle = L.colorOf(f, "#e8e4d8", hz);
      ctx.fillRect(s.x - s.w * k * 0.2, y - s.h * k - 1, s.w * k * 0.35, 2);
    };
    this.reflect(f, y, draw, 0.35);
    draw();
    const q = (Math.sin(t * 1.4 + s.seed) + 1) / 2;
    ctx.fillStyle = hexA("#ffffff", (0.45 + q * 0.3) * (1 - night * 0.6));
    ctx.beginPath();
    ctx.ellipse(s.x, y + 1, s.w * k * (0.75 + q * 0.2), 1.2 + q * 1.4, 0, 0, TAU);
    ctx.fill();
  }

  private drawKelpMat(L: LandRenderer, f: Frame, m: BandObj) {
    const { ctx, t } = f;
    const y = this.bandY(f, m.p) + Math.sin(t + m.seed) * 0.6;
    const k = 0.4 + m.p * 1.1;
    ctx.fillStyle = L.colorOf(f, "#7a5a22", this.haze(m.p));
    ctx.beginPath();
    ctx.ellipse(m.x, y, m.w * k * 0.5, 1 + m.p * 2.5, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = L.colorOf(f, "#a8823a", this.haze(m.p));
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.ellipse(m.x + (hash1(m.seed + i) - 0.5) * m.w * k * 0.8, y - 0.5, 1.5 * k, 1 * k, 0, 0, TAU);
      ctx.fill();
    }
  }

  private drawOtter(L: LandRenderer, f: Frame, o: BandObj) {
    const { ctx, t } = f;
    const y = this.bandY(f, o.p) + Math.sin(t * 1.4 + o.seed) * 1.3;
    const s = (0.5 + o.p) * f.sc;
    const dir = hash1(o.seed) < 0.5 ? 1 : -1;
    const x = o.x + Math.sin(t * 0.1 + o.seed) * 20;
    const hz = this.haze(o.p);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(dir * s, s);
    ctx.rotate(Math.sin(t * 1.4 + o.seed) * 0.06);
    ctx.fillStyle = L.colorOf(f, "#5a3e28", hz);
    ctx.beginPath();
    ctx.ellipse(0, -2, 13, 4, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-15, -1, 4, 1.8, 0.3, 0, TAU);
    ctx.fill();
    ctx.fillStyle = L.colorOf(f, "#b8a890", hz);
    ctx.beginPath();
    ctx.arc(13, -5, 4.2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = L.colorOf(f, "#5a3e28", hz);
    ctx.beginPath();
    ctx.ellipse(6, -7, 2.4, 1.5, -0.6, 0, TAU);
    ctx.ellipse(3, -6.5, 2.2, 1.4, 0.4, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#101010";
    ctx.beginPath();
    ctx.arc(15.5, -6, 0.7, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = L.colorOf(f, "#8a6a2a", hz);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-10, -1);
    ctx.quadraticCurveTo(0, 3, 10, -1);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = hexA("#ffffff", 0.35);
    ctx.fillRect(x - 12 * s, y + 1, 24 * s, 1);
  }

  private drawSandbar(L: LandRenderer, f: Frame, b: BandObj) {
    const { ctx } = f;
    const y = this.bandY(f, b.p);
    const k = 0.4 + b.p;
    ctx.fillStyle = L.colorOf(f, "#c8b88a", this.haze(b.p));
    ctx.beginPath();
    ctx.ellipse(b.x, y, b.w * k * 0.5, 1.2 + b.p * 3, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = hexA(L.colorOf(f, "#e8dcb8", this.haze(b.p)), 0.6);
    ctx.beginPath();
    ctx.ellipse(b.x - b.w * k * 0.05, y - 0.5, b.w * k * 0.35, 0.6 + b.p * 1.5, 0, Math.PI, 0);
    ctx.fill();
    if (hash1(b.seed) < 0.5) this.drawEgret(f, b.x + b.w * k * 0.2, y - 1, 0.5 + b.p * 0.7, L.colorOf(f, "#f4f4f0", this.haze(b.p)), b.seed);
  }

  private drawEgret(f: Frame, x: number, y: number, s0: number, c: string, seed: number) {
    const { ctx, t } = f;
    const s = s0 * f.sc;
    ctx.strokeStyle = "rgba(40,40,40,0.8)";
    ctx.lineWidth = 0.8 * s;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - 9 * s);
    ctx.moveTo(x + 2 * s, y);
    ctx.lineTo(x + 1.5 * s, y - 9 * s);
    ctx.stroke();
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.ellipse(x + 1, y - 12 * s, 5 * s, 3 * s, -0.4, 0, TAU);
    ctx.fill();
    const nod = Math.sin(t * 0.7 + seed) > 0.8 ? 3 * s : 0;
    ctx.strokeStyle = c;
    ctx.lineWidth = 1.4 * s;
    ctx.beginPath();
    ctx.moveTo(x + 4 * s, y - 14 * s);
    ctx.quadraticCurveTo(x + 7 * s, y - 19 * s, x + 5 * s, y - 22 * s + nod);
    ctx.stroke();
    ctx.strokeStyle = "#d8b040";
    ctx.lineWidth = 0.9 * s;
    ctx.beginPath();
    ctx.moveTo(x + 5 * s, y - 22 * s + nod);
    ctx.lineTo(x + 10 * s, y - 21 * s + nod);
    ctx.stroke();
  }

  private drawEgretsSky(L: LandRenderer, f: Frame) {
    const { ctx, hY, t, W, night } = f;
    if (night > 0.7) return;
    const c = L.colorOf(f, "#f2f2ee", 0.4);
    // цапли на кромке леса
    for (let i = 0; i < this.egrets.length; i++) {
      const e = this.egrets[i];
      const idx = Math.max(2, Math.min(this.far.length - 4, Math.round((e.x / W) * (this.far.length / 2)) * 2));
      const y = this.far[idx + 1];
      if (i % 2 === 0) {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.ellipse(e.x, y - 2, 2.4, 1.4, 0, 0, TAU);
        ctx.fill();
      } else {
        const x = (e.x + t * 12) % (W + 40) - 20;
        const yy = hY - 40 - hash1(e.seed) * 40 + Math.sin(t * 0.8 + i) * 4;
        const fl = Math.sin(t * 5 + i) * 3;
        ctx.strokeStyle = c;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(x - 7, yy - fl);
        ctx.quadraticCurveTo(x - 3, yy - 2, x, yy);
        ctx.quadraticCurveTo(x + 3, yy - 2, x + 7, yy - fl);
        ctx.stroke();
      }
    }
  }

  private drawMangrove(L: LandRenderer, f: Frame, m: BandObj, front = false) {
    const { ctx, t, sY, e } = f;
    const y = front ? sY + 2 : this.bandY(f, m.p);
    const s = m.h * f.sc;
    const hz = front ? 0 : this.haze(m.p);
    const root = L.colorOf(f, "#4a3a2a", hz), leaf = L.colorOf(f, "#27472a", hz), leaf2 = L.colorOf(f, "#3a5e32", hz);
    const rootTop = y - 22 * s, trunkTop = rootTop - 30 * s;
    const draw = (withCanopy: boolean) => {
      ctx.strokeStyle = root;
      ctx.lineCap = "round";
      for (let k = 0; k < 9; k++) {
        const dx = (k - 4) * 9 * s + (hash1(m.seed + k) - 0.5) * 6 * s;
        ctx.lineWidth = (1.2 + hash1(m.seed * 2 + k) * 1.4) * s;
        ctx.beginPath();
        ctx.moveTo(m.x + dx * 0.15, rootTop + (hash1(k) * 6 - 3) * s);
        ctx.quadraticCurveTo(m.x + dx * 0.6, rootTop - 8 * s, m.x + dx, y + 2);
        ctx.stroke();
      }
      ctx.lineWidth = 4 * s;
      ctx.beginPath();
      ctx.moveTo(m.x, rootTop + 4 * s);
      ctx.lineTo(m.x + 3 * s, trunkTop);
      ctx.stroke();
      ctx.lineWidth = 2 * s;
      ctx.beginPath();
      ctx.moveTo(m.x + 2 * s, trunkTop + 10 * s);
      ctx.lineTo(m.x - 18 * s, trunkTop - 6 * s);
      ctx.moveTo(m.x + 3 * s, trunkTop + 6 * s);
      ctx.lineTo(m.x + 22 * s, trunkTop - 8 * s);
      ctx.stroke();
      if (!withCanopy) return;
      const sway = Math.sin(t * 0.8 + m.seed) * 1.5 * s;
      const cl: [number, number, number, string][] = [[0, -14, 22, leaf], [-20, -8, 17, leaf], [20, -10, 18, leaf], [-8, -24, 16, leaf2], [12, -22, 15, leaf2], [-30, 0, 11, leaf], [32, -2, 12, leaf]];
      for (const [dx, dy, r, c] of cl) {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(m.x + dx * s + sway, trunkTop + dy * s, r * s, 0, TAU);
        ctx.fill();
      }
      if (hash1(m.seed * 7) < 0.7 && f.night < 0.7) this.drawEgret(f, m.x + 16 * s, trunkTop - 30 * s, 0.7 * m.h, L.colorOf(f, "#f4f4f0", hz), m.seed);
      if (e.season === 1) {
        ctx.fillStyle = hexA(L.colorOf(f, "#e8e0a0", hz), 0.8);
        for (let k = 0; k < 6; k++) ctx.fillRect(m.x + (hash1(m.seed + k * 3) - 0.5) * 50 * s, trunkTop - hash1(k) * 30 * s, 1.5 * s, 1.5 * s);
      }
    };
    if (!front) this.reflect(f, y, () => draw(true), 0.35);
    draw(true);
    if (front) {
      ctx.fillStyle = hexA("#ffffff", 0.25);
      ctx.fillRect(m.x - 45 * s, y, 90 * s, 1.5);
    }
  }

  private drawVolcano(L: LandRenderer, f: Frame) {
    const { ctx, hY, H, W, t, night, e } = f;
    const c = this.cone;
    if (!c) return;
    const feat = f.spot.feature;
    const lay = L.layers.find((l) => l.hidden && l.base === "#2e2a28");
    if (!lay) return;
    const shape = () => {
      ctx.beginPath();
      ctx.moveTo(lay.pts[0], lay.pts[1]);
      for (let i = 2; i < lay.pts.length; i += 2) ctx.lineTo(lay.pts[i], lay.pts[i + 1]);
      ctx.closePath();
    };
    const base = L.colorOf(f, "#3a3432", 0.35);
    shape();
    const g = ctx.createLinearGradient(c.xp - 200, c.top, c.xp + 100, hY);
    g.addColorStop(0, mix(base, "#8a7a70", 0.2 * (1 - night)));
    g.addColorStop(1, mix(base, "#000000", 0.2));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.save();
    shape();
    ctx.clip();
    // растительность на нижних склонах
    const veg = ctx.createLinearGradient(0, hY - (hY - c.top) * 0.45, 0, hY);
    const vc = L.colorOf(f, e.season === 2 ? "#4a5230" : "#2e4a2a", 0.35);
    veg.addColorStop(0, hexA(vc, 0));
    veg.addColorStop(0.5, hexA(vc, 0.85));
    veg.addColorStop(1, hexA(vc, 0.95));
    ctx.fillStyle = veg;
    ctx.fillRect(c.x0, c.top, c.x1 - c.x0, hY - c.top + 4);
    // промоины
    ctx.strokeStyle = hexA(mix(base, "#000000", 0.45), 0.55);
    ctx.lineWidth = 1.2;
    for (let k = 0; k < 14; k++) {
      const q = (k + 0.5) / 14;
      const sx = c.xp + (q - 0.5) * c.cw * 3;
      const ex = c.x0 + (c.x1 - c.x0) * q;
      ctx.beginPath();
      ctx.moveTo(sx, c.top + 6);
      ctx.quadraticCurveTo((sx + ex) / 2 + (hash1(k) - 0.5) * 30, (c.top + hY) / 2, ex, hY);
      ctx.stroke();
    }
    // светлый склон
    const sun = ctx.createLinearGradient(c.x0, 0, c.xp, 0);
    sun.addColorStop(0, "rgba(255,240,220,0)");
    sun.addColorStop(1, `rgba(255,236,210,${af(0.08 * f.day)})`);
    ctx.fillStyle = sun;
    ctx.fillRect(c.x0, c.top, c.xp - c.x0, hY - c.top);
    // лавовый поток
    if (feat === "lava" || night > 0.4) {
      const a = feat === "lava" ? 1 : night * 0.5;
      ctx.lineCap = "round";
      for (const [w, col, al] of [[5, "#ff4a10", 0.35], [2.2, "#ff8a30", 0.9], [0.8, "#ffe0a0", 1]] as [number, string, number][]) {
        ctx.strokeStyle = hexA(col, al * a * (0.8 + Math.sin(t * 3) * 0.1));
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(c.xp - c.cw * 0.5, c.top + 4);
        for (let k = 1; k <= 12; k++) {
          const q = k / 12;
          const x = c.xp - c.cw * 0.5 + (this.lavaX - c.xp + c.cw * 0.5) * q + Math.sin(q * 9 + 1.3) * 6;
          ctx.lineTo(x, c.top + (hY - c.top) * Math.pow(q, 1.3));
        }
        ctx.stroke();
      }
    }
    ctx.restore();
    // кратер
    ctx.fillStyle = mix(base, "#000000", 0.35);
    ctx.beginPath();
    ctx.ellipse(c.xp, c.top + 3, c.cw * 1.1, 3, 0, 0, TAU);
    ctx.fill();
    if (night > 0.2 || feat === "lava" || e.activeEvents.some((a) => a.id === "eruption")) {
      const ga = Math.max(night, 0.35);
      const cg = ctx.createRadialGradient(c.xp, c.top, 0, c.xp, c.top, H * 0.12);
      cg.addColorStop(0, `rgba(255,120,40,${af(0.45 * ga)})`);
      cg.addColorStop(1, "rgba(255,90,30,0)");
      ctx.fillStyle = cg;
      ctx.fillRect(c.xp - H * 0.12, c.top - H * 0.12, H * 0.24, H * 0.24);
    }
    // шлейф
    this.plumeT -= f.dt;
    const erupt = e.activeEvents.some((a) => a.id === "eruption");
    if (this.plumeT <= 0) {
      this.plumeT = erupt ? 0.08 : 0.28;
      this.plumes.push({ x: c.xp + (Math.random() - 0.5) * c.cw, y: c.top, r: 4 + Math.random() * 4, t: 0, vx: 4 + f.wind * 22, vy: -(10 + Math.random() * 8) * (erupt ? 1.8 : 1), kind: erupt && Math.random() < 0.5 ? "ash" : "steam" });
    }
    for (const p of this.plumes) {
      p.t += f.dt;
      p.x += p.vx * f.dt * (1 + p.t * 0.2);
      p.y += p.vy * f.dt;
      p.vy *= 0.995;
      p.r += f.dt * 5;
      const life = clamp(1 - p.t / 16, 0, 1);
      const col = p.kind === "ash" ? mix("#5a5652", "#0a0c10", night * 0.7) : mix(mix("#e6e4e0", f.hor, 0.25), "#1a1e28", night * 0.8);
      const pg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
      pg.addColorStop(0, hexA(col, 0.4 * life));
      pg.addColorStop(1, hexA(col, 0));
      ctx.fillStyle = pg;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, TAU);
      ctx.fill();
      if (night > 0.3 && p.t < 3) {
        ctx.fillStyle = `rgba(255,110,40,${0.12 * night * (1 - p.t / 3)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y + p.r * 0.3, p.r * 0.7, 0, TAU);
        ctx.fill();
      }
    }
    this.plumes = this.plumes.filter((p) => p.t < 16 && p.x < W + 200);
    // чёрный пляж и прибой
    ctx.fillStyle = L.colorOf(f, "#1e1a18", 0.3);
    ctx.fillRect(feat === "blacksand" ? -10 : c.x0, hY - 2, feat === "blacksand" ? W + 20 : c.x1 - c.x0, 3);
    for (let x = feat === "blacksand" ? 0 : c.x0; x < (feat === "blacksand" ? W : c.x1); x += 11) {
      const q = (Math.sin(t * 1.3 + x * 0.05) + 1) / 2;
      ctx.fillStyle = hexA("#ffffff", (0.3 + q * 0.45) * (1 - night * 0.6));
      ctx.fillRect(x, hY + 1 + q * 1.5, 8 + q * 5, 1.4);
    }
  }

  private drawSteam(f: Frame) {
    const { ctx, hY, t, night } = f;
    if (f.spot.feature !== "lava") return;
    this.steamT -= f.dt;
    if (this.steamT <= 0) {
      this.steamT = 0.12;
      this.plumes.push({ x: this.lavaX + (Math.random() - 0.5) * 16, y: hY, r: 3, t: 0, vx: 3 + f.wind * 14, vy: -14 - Math.random() * 10, kind: "steam" });
    }
    if (night > 0.2) glow(ctx, this.lavaX, hY - 1, 6, "#ff6a20", 0.6 + Math.sin(t * 4) * 0.2);
  }

  private drawCalderaRing(L: LandRenderer, f: Frame) {
    const { ctx, W, t, night } = f;
    const cy = this.bandY(f, 0.45), cx = W * 0.62, rx = W * 0.2, ry = (f.sY - f.hY) * 0.18;
    const rock = L.colorOf(f, "#2a2624", 0.3);
    const arcs: [number, number][] = [[Math.PI * 0.95, Math.PI * 1.45], [Math.PI * 1.6, Math.PI * 1.9], [Math.PI * 0.05, Math.PI * 0.4], [Math.PI * 0.55, Math.PI * 0.8]];
    for (const [a0, a1] of arcs) {
      for (let a = a0; a < a1; a += 0.05) {
        const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
        const back = Math.sin(a) < 0;
        const hgt = (back ? 6 : 12) + hash1(a * 10) * (back ? 8 : 16);
        ctx.fillStyle = back ? mix(rock, f.hor, 0.25) : rock;
        ctx.beginPath();
        ctx.moveTo(x - 6, y + 1);
        ctx.lineTo(x - 2, y - hgt);
        ctx.lineTo(x + 3, y - hgt * 0.8);
        ctx.lineTo(x + 6, y + 1);
        ctx.fill();
        if (!back) {
          const q = (Math.sin(t * 1.4 + a * 5) + 1) / 2;
          ctx.fillStyle = hexA("#ffffff", (0.25 + q * 0.35) * (1 - night * 0.6));
          ctx.fillRect(x - 6, y + 0.5, 12, 1.2);
        }
      }
    }
    for (let k = 0; k < 3; k++) {
      const p = (t * 0.15 + k / 3) % 1;
      const col = mix("#e8e6e2", "#1a1e28", night * 0.8);
      ctx.fillStyle = hexA(col, 0.25 * (1 - p));
      ctx.beginPath();
      ctx.arc(cx + (k - 1) * rx * 0.4 + Math.sin(p * 4) * 6, cy - p * 60, 6 + p * 22, 0, TAU);
      ctx.fill();
    }
  }

  private drawShelf(L: LandRenderer, f: Frame) {
    const { ctx, hY, W, t, night } = f;
    if (!this.cliff) return;
    const [sx0, sh] = this.cliff.top;
    const face = L.colorOf(f, "#e8f2f8", 0.3), deep = L.colorOf(f, "#8ab8d0", 0.3);
    const g = ctx.createLinearGradient(0, hY - sh, 0, hY);
    g.addColorStop(0, mix(face, "#ffffff", 0.2 * (1 - night)));
    g.addColorStop(0.4, face);
    g.addColorStop(1, deep);
    ctx.fillStyle = g;
    const p = this.cliff.pts;
    ctx.beginPath();
    ctx.moveTo(p[0], p[1]);
    for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
    ctx.closePath();
    ctx.fill();
    // вертикальные трещины и тени
    for (let x = sx0 + 8; x < W; x += 9) {
      const hsh = hash1(x * 0.37);
      if (hsh < 0.45) continue;
      ctx.fillStyle = hexA(L.colorOf(f, "#6a9ab8", 0.3), 0.18 + hsh * 0.2);
      ctx.fillRect(x, hY - sh + 3, 1 + hsh * 3, sh * (0.5 + hsh * 0.5));
    }
    ctx.fillStyle = hexA("#ffffff", 0.6 * (1 - night * 0.7));
    ctx.fillRect(sx0 + 4, hY - sh - 1, W - sx0, 2);
    // волноприбойная ниша
    ctx.fillStyle = hexA(L.colorOf(f, "#3a7aa0", 0.3), 0.45);
    ctx.fillRect(sx0, hY - 5, W - sx0, 5);
    for (let x = sx0; x < W; x += 14) {
      const q = (Math.sin(t * 1.1 + x * 0.05) + 1) / 2;
      ctx.fillStyle = hexA("#ffffff", (0.3 + q * 0.3) * (1 - night * 0.6));
      ctx.fillRect(x, hY + q * 1.5, 10, 1.3);
    }
    // откол ледника
    if (f.e.activeEvents.some((a) => a.id === "calving")) {
      const cx = sx0 + (W - sx0) * 0.4;
      const ph = (t * 0.2) % 1;
      ctx.fillStyle = face;
      ctx.fillRect(cx, hY - sh + ph * sh, 30, sh * (1 - ph) * 0.6);
      ctx.fillStyle = hexA("#ffffff", 0.5 * (1 - ph));
      ctx.beginPath();
      ctx.ellipse(cx + 15, hY, 30 + ph * 60, 4 + ph * 6, 0, Math.PI, 0);
      ctx.fill();
    }
  }

  private drawBerg(L: LandRenderer, f: Frame, b: Berg, front = false) {
    const { ctx, t, night, sY } = f;
    const bob = Math.sin(t * 0.5 + b.seed) * (front ? 1.5 : 0.6);
    const y = (front ? sY + 2 : this.bandY(f, b.p)) + bob;
    if (!front) b.x = (b.x + b.v * f.dt * (0.3 + f.wind)) % (f.W + b.w * 2);
    const x = front ? b.x : b.x - b.w;
    const hz = front ? 0 : this.haze(b.p);
    const face = L.colorOf(f, "#eef6fa", hz), shade = L.colorOf(f, "#98c4dc", hz);
    const pts: [number, number][] = [];
    if (b.tab) {
      pts.push([x - b.w / 2, y], [x - b.w * 0.46, y - b.h * 0.9], [x - b.w * 0.3, y - b.h], [x + b.w * 0.25, y - b.h * 0.97], [x + b.w * 0.44, y - b.h * 0.85], [x + b.w / 2, y]);
    } else {
      pts.push([x - b.w / 2, y], [x - b.w * 0.3, y - b.h * 0.6], [x - b.w * 0.12, y - b.h * 1.3], [x + b.w * 0.05, y - b.h * 0.8], [x + b.w * 0.2, y - b.h * 1.05], [x + b.w * 0.45, y - b.h * 0.3], [x + b.w / 2, y]);
    }
    const draw = () => {
      ctx.beginPath();
      pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
      ctx.closePath();
      const g = ctx.createLinearGradient(x - b.w / 2, 0, x + b.w / 2, 0);
      g.addColorStop(0, mix(face, "#ffffff", 0.15 * (1 - night)));
      g.addColorStop(0.55, face);
      g.addColorStop(1, shade);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = hexA(L.colorOf(f, "#7ab0cc", hz), 0.35);
      ctx.lineWidth = 1;
      for (let k = 1; k < 4; k++) {
        ctx.beginPath();
        ctx.moveTo(x - b.w * 0.4 + k * b.w * 0.2, y - b.h * 0.85);
        ctx.lineTo(x - b.w * 0.42 + k * b.w * 0.2, y - 2);
        ctx.stroke();
      }
    };
    if (!front) this.reflect(f, y, draw, 0.35);
    else {
      // подводная часть просвечивает у поверхности
      const ug = ctx.createLinearGradient(0, y, 0, y + b.h * 1.4);
      ug.addColorStop(0, hexA("#bfe6f2", 0.45));
      ug.addColorStop(1, hexA("#bfe6f2", 0));
      ctx.fillStyle = ug;
      ctx.beginPath();
      ctx.moveTo(x - b.w * 0.55, y);
      ctx.quadraticCurveTo(x - b.w * 0.7, y + b.h * 0.9, x - b.w * 0.2, y + b.h * 1.4);
      ctx.quadraticCurveTo(x + b.w * 0.5, y + b.h * 1.2, x + b.w * 0.6, y);
      ctx.fill();
    }
    draw();
    // пингвины
    const topY = b.tab ? y - b.h * 0.97 : y - b.h * 0.3;
    const ps = (front ? 1.3 : 0.4 + b.p * 0.8) * f.sc;
    for (let k = 0; k < b.peng; k++) {
      const px = x - b.w * 0.25 + k * (b.w * 0.45) / Math.max(1, b.peng) + Math.sin(t * 0.3 + k + b.seed) * 2;
      const hop = Math.max(0, Math.sin(t * 2 + k * 1.7 + b.seed)) > 0.97 ? -2 * ps : 0;
      ctx.fillStyle = "#15171c";
      ctx.beginPath();
      ctx.ellipse(px, topY - 4 * ps + hop, 2 * ps, 4 * ps, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#f2f2ee";
      ctx.beginPath();
      ctx.ellipse(px + 0.6 * ps, topY - 3.6 * ps + hop, 1.2 * ps, 3 * ps, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#e0a030";
      ctx.fillRect(px + 1.4 * ps, topY - 7.4 * ps + hop, 1.2 * ps, 0.7 * ps);
    }
    ctx.fillStyle = hexA("#ffffff", 0.5 * (1 - night * 0.6));
    ctx.beginPath();
    ctx.ellipse(x, y + 0.5, b.w * 0.52, 1.2 + (front ? 1.5 : b.p), 0, 0, TAU);
    ctx.fill();
  }
}

/** Высота кадра (для drawBack, где нет деструктуризации H) */
function H(f: Frame) {
  return f.H;
}
