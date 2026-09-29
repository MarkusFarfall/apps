import type { Frame } from "./frame";
import { ExtraLand } from "./lands2";
import { clamp, fbm, glow, hash1, hexA, mix, rng, sstep, tracePoly, af } from "./util";

export interface Layer {
  pts: number[];
  base: string;
  haze: number;
  reflect: boolean;
  /** только для отражения — рисуется отдельным модулем */
  hidden?: boolean;
  snowY?: number;
  x0: number;
  x1: number;
}
interface Tree { x: number; y: number; h: number; kind: "pine" | "round"; haze: number; c: string }
interface House { x: number; y: number; w: number; h: number; lit: boolean; haze: number; church?: boolean; c: string }
interface LightSrc { x: number; y: number; c: string; night: boolean }

export class LandRenderer {
  private key = "";
  readonly extra = new ExtraLand();
  layers: Layer[] = [];
  trees: Tree[] = [];
  houses: House[] = [];
  lights: LightSrc[] = [];
  private lighthouse: { x: number; y: number; h: number; sweep: boolean; haze: number } | null = null;
  private strata: { pts: number[]; haze: number }[] = [];
  private grass: { pts: number[]; haze: number } | null = null;
  private waterfall: { x: number; top: number; w: number } | null = null;
  palms: { x: number; y: number; h: number; lean: number }[] = [];
  floes: { x: number; y: number; w: number; h: number; v: number }[] = [];
  private mats: { x: number; y: number; w: number }[] = [];
  seaRocks: { x: number; y: number; w: number; h: number }[] = [];
  private cliffBase: { x0: number; x1: number } | null = null;

  private foliage(f: Frame, c: string, x: number, kind: "pine" | "round") {
    const se = f.e.season;
    const temperate = f.loc.climate === "temperate";
    if (!temperate && f.loc.land !== "fjord") return c;
    const h = hash1(x * 0.37);
    if (kind === "round") {
      if (se === 2) return mix(c, h < 0.33 ? "#d8742a" : h < 0.66 ? "#c8a030" : "#a8402a", 0.75);
      if (se === 3) return mix(c, "#6a5a4e", 0.7);
      if (se === 0 && h < 0.3) return mix(c, "#f0b0c8", 0.55);
      if (se === 1) return mix(c, "#3a6a2e", 0.3);
    } else if (se === 2 && f.loc.land === "fjord" && h < 0.2) return mix(c, "#c89030", 0.6);
    return c;
  }

  colorOf(f: Frame, base: string, haze: number) {
    const h = mix(base, f.hor, clamp(haze * (0.55 + f.fogK * 0.5), 0, 1));
    return mix(h, "#03060c", f.night * 0.8 * (1 - haze * 0.35));
  }

  ridge(f: Frame, x0: number, x1: number, hMax: number, seed: number, o: { sharp?: number; rough?: number; tl?: boolean; tr?: boolean; base?: number } = {}) {
    const { hY } = f;
    const baseY = o.base ?? hY + 2;
    const sharp = o.sharp ?? 1, rough = o.rough ?? 3;
    const pts: number[] = [x0, baseY];
    const hs: number[] = [];
    const step = 5;
    for (let x = x0; x <= x1 + 0.1; x += step) {
      const k = (x - x0) / (x1 - x0);
      let v = Math.pow(fbm(k * rough + seed, seed, 5), sharp) * 1.35;
      const taper = (o.tl === false ? 1 : sstep(0, 0.16, k)) * (o.tr === false ? 1 : sstep(0, 0.16, 1 - k));
      v = clamp(v * taper, 0, 1.2);
      const y = baseY - 2 - v * hMax;
      pts.push(x, y);
      hs.push(y);
    }
    pts.push(x1, baseY);
    const at = (x: number) => {
      const i = clamp(Math.round((x - x0) / step), 0, hs.length - 1);
      return hs[i];
    };
    return { pts, at };
  }

  build(f: Frame) {
    const { W, H, hY, sY, spot, loc, e } = f;
    const key = `${spot.id}|${W}|${H}|${e.season}`;
    if (key === this.key) return;
    this.key = key;
    this.layers = [];
    this.trees = [];
    this.houses = [];
    this.lights = [];
    this.lighthouse = null;
    this.strata = [];
    this.grass = null;
    this.waterfall = null;
    this.palms = [];
    this.floes = [];
    this.mats = [];
    this.seaRocks = [];
    this.cliffBase = null;
    const r = rng(spot.seed * 31);
    const band = sY - hY;
    const winter = e.season === 3;

    switch (loc.land) {
      case "bay": {
        const far = this.ridge(f, W * 0.34, W * 1.06, H * 0.085, 3.1, { rough: 2.6 });
        this.layers.push({ pts: far.pts, base: "#56766a", haze: 0.75, reflect: true, x0: W * 0.34, x1: W * 1.06 });
        const mid = this.ridge(f, W * 0.55, W * 1.05, H * 0.058, 5.3, { rough: 3.2, tr: false });
        this.layers.push({ pts: mid.pts, base: "#36533f", haze: 0.42, reflect: true, x0: W * 0.55, x1: W * 1.05 });
        for (let x = W * 0.57; x < W * 1.02; x += 6) {
          if (r() < 0.55 && (x < W * 0.67 || x > W * 0.82)) this.trees.push({ x, y: mid.at(x) + 2, h: 4 + r() * 5, kind: "round", haze: 0.42, c: r() < 0.5 ? "#2e4a36" : "#3a5a3e" });
        }
        const cols = ["#d8cfc0", "#c8b8a0", "#e0d8cc", "#b8a890"];
        for (let i = 0; i < 9; i++) {
          const x = W * 0.675 + i * W * 0.016 + r() * 4;
          const w = 9 + r() * 6, h = 7 + r() * 5;
          const lit = r() < 0.7;
          const y = mid.at(x + w / 2) + 3 + r() * 3;
          this.houses.push({ x, y, w, h, lit, haze: 0.42, c: cols[Math.floor(r() * cols.length)], church: i === 4 });
          if (lit) this.lights.push({ x: x + w / 2, y: y - h / 2, c: "#ffc070", night: true });
        }
        const lx = W * 0.94;
        this.lighthouse = { x: lx, y: mid.at(lx) + 3, h: H * 0.07, sweep: false, haze: 0.42 };
        this.layers.push({ pts: [W * 0.56, hY + 2, W * 0.56, hY - 1, W * 1.05, hY - 2, W * 1.05, hY + 2], base: "#cdbb8c", haze: 0.35, reflect: false, x0: W * 0.56, x1: W * 1.05 });
        if (spot.feature === "sandbar") {
          const dune = this.ridge(f, -W * 0.02, W * 0.3, H * 0.028, 9.2, { rough: 2, tl: false });
          this.layers.push({ pts: dune.pts, base: "#cfb884", haze: 0.28, reflect: true, x0: -W * 0.02, x1: W * 0.3 });
          for (let x = 0; x < W * 0.26; x += 7) if (r() < 0.6) this.trees.push({ x, y: dune.at(x) + 1, h: 3 + r() * 4, kind: "pine", haze: 0.28, c: "#7a8a4a" });
        }
        if (spot.feature === "ridge") {
          for (let i = 0; i < 5; i++) this.seaRocks.push({ x: W * (0.46 + i * 0.06 + r() * 0.02), y: hY + band * (0.25 + r() * 0.35), w: 10 + r() * 22, h: 5 + r() * 9 });
        }
        break;
      }
      case "cliffs": {
        const far = this.ridge(f, -W * 0.02, W * 0.52, H * 0.045, 8.4, { rough: 2.4, tl: false });
        this.layers.push({ pts: far.pts, base: "#5c6e80", haze: 0.8, reflect: true, x0: 0, x1: W * 0.52 });
        const cx0 = spot.feature === "wall" ? W * 0.5 : W * 0.62;
        const top = hY - H * (spot.feature === "wall" ? 0.24 : 0.2);
        const pts: number[] = [cx0, hY + 2];
        const faceW = W * 0.07;
        for (let k = 1; k <= 14; k++) {
          const q = k / 14;
          pts.push(cx0 + faceW * q + (hash1(k * 3.3 + spot.seed) - 0.5) * 10, hY - (hY - top) * sstep(0, 1, q) + (hash1(k * 7.1) - 0.5) * 8);
        }
        const topLine: number[] = [];
        for (let x = cx0 + faceW; x <= W * 1.06; x += 8) {
          const y = top + (fbm(x * 0.01, 4.4) - 0.5) * H * 0.04 + ((x - cx0) / W) * H * 0.02;
          pts.push(x, y);
          topLine.push(x, y);
        }
        pts.push(W * 1.06, hY + 2);
        this.layers.push({ pts, base: "#57504a", haze: 0.2, reflect: true, x0: cx0, x1: W * 1.06 });
        const gl: number[] = [...topLine];
        for (let i = topLine.length - 2; i >= 0; i -= 2) gl.push(topLine[i], topLine[i + 1] + 5 + hash1(i) * 4);
        this.grass = { pts: gl, haze: 0.2 };
        for (let j = 0; j < 7; j++) {
          const y0 = top + (hY - top) * (0.14 + j * 0.12);
          const q = 1 - (y0 - top) / (hY - top);
          const xs = cx0 + faceW * (1 - q) + 6;
          const sp: number[] = [];
          for (let x = xs; x <= W * 1.06; x += 16) sp.push(x, y0 + Math.sin(x * 0.03 + j) * 2.5 + (x - xs) * 0.02);
          this.strata.push({ pts: sp, haze: 0.2 });
        }
        const lx = W * (spot.feature === "wall" ? 0.7 : 0.82);
        const ly = top + (fbm(lx * 0.01, 4.4) - 0.5) * H * 0.04 + ((lx - cx0) / W) * H * 0.02 + 3;
        this.lighthouse = { x: lx, y: ly, h: H * 0.085, sweep: true, haze: 0.2 };
        this.houses.push({ x: lx + 10, y: ly, w: 18, h: 11, lit: true, haze: 0.2, c: "#e8e2d6" });
        this.lights.push({ x: lx + 19, y: ly - 5, c: "#ffc070", night: true });
        this.cliffBase = { x0: cx0, x1: W * 1.06 };
        if (spot.feature === "current") {
          for (let i = 0; i < 4; i++) this.seaRocks.push({ x: W * (0.36 + i * 0.07), y: hY + band * (0.3 + r() * 0.3), w: 8 + r() * 14, h: 5 + r() * 7 });
        }
        break;
      }
      case "fjord": {
        const snowFrac = winter ? 0.3 : e.season === 1 ? 0.72 : 0.55;
        const far = this.ridge(f, -W * 0.05, W * 1.05, H * 0.26, 12.2, { sharp: 1.5, rough: 2.8, tl: false, tr: false });
        this.layers.push({ pts: far.pts, base: "#5e6e84", haze: 0.7, reflect: true, snowY: hY - H * 0.26 * snowFrac * 1.2, x0: -W * 0.05, x1: W * 1.05 });
        const deep = spot.feature === "deep";
        const L1 = deep ? W * 0.4 : W * 0.3, R0 = deep ? W * 0.58 : W * 0.68;
        const lw = this.ridge(f, -W * 0.05, L1, H * (deep ? 0.4 : 0.33), 14.7, { sharp: 1.1, rough: 2.2, tl: false });
        const rw = this.ridge(f, R0, W * 1.05, H * (deep ? 0.42 : 0.35), 16.1, { sharp: 1.1, rough: 2.2, tr: false });
        const nearSnow = hY - H * 0.34 * snowFrac * 1.25;
        this.layers.push({ pts: lw.pts, base: "#2e3c3c", haze: 0.3, reflect: true, snowY: nearSnow, x0: -W * 0.05, x1: L1 });
        this.layers.push({ pts: rw.pts, base: "#303e3e", haze: 0.3, reflect: true, snowY: nearSnow, x0: R0, x1: W * 1.05 });
        const forest = (at: (x: number) => number, x0: number, x1: number) => {
          for (let x = x0; x < x1; x += 4) {
            const ty = at(x);
            if (ty < nearSnow + 20) continue;
            const depth = r() * Math.min(60, hY - ty - 4);
            if (depth < 0) continue;
            this.trees.push({ x: x + r() * 3, y: ty + 6 + depth, h: 8 + r() * 10, kind: "pine", haze: 0.3, c: r() < 0.5 ? "#1a2a24" : "#223428" });
          }
        };
        forest(lw.at, 0, L1 - 10);
        forest(rw.at, R0 + 10, W);
        this.trees.sort((a, b) => a.y - b.y);
        if (spot.feature === "waterfall") {
          const x = W * 0.8;
          const ty = rw.at(x);
          this.waterfall = { x, top: ty + (hY - ty) * 0.2, w: 10 };
        }
        if (spot.feature === "icebay") {
          this.layers.push({ pts: [W * 0.05, hY + 2, W * 0.12, hY - H * 0.1, W * 0.2, hY - H * 0.12, W * 0.3, hY - H * 0.06, W * 0.36, hY - 4, W * 0.37, hY + 2], base: "#dfeaf2", haze: 0.35, reflect: true, x0: W * 0.05, x1: W * 0.37 });
          for (let i = 0; i < 9; i++) this.floes.push({ x: r() * W, y: hY + band * (0.15 + r() * 0.75), w: 14 + r() * 40, h: 3 + r() * 5, v: 2 + r() * 4 });
        }
        break;
      }
      case "reef": {
        const far = this.ridge(f, W * 0.7, W * 0.87, H * 0.03, 21.3, { rough: 2 });
        this.layers.push({ pts: far.pts, base: "#407060", haze: 0.7, reflect: true, x0: W * 0.7, x1: W * 0.87 });
        const sand: number[] = [];
        for (let k = 0; k <= 30; k++) {
          const x = -W * 0.03 + (W * 0.34) * (k / 30);
          sand.push(x, hY + 1 - Math.sin((k / 30) * Math.PI) * H * 0.018);
        }
        sand.push(W * 0.31, hY + 2, -W * 0.03, hY + 2);
        this.layers.push({ pts: sand, base: "#ecdcaa", haze: 0.22, reflect: true, x0: -W * 0.03, x1: W * 0.31 });
        const hill = this.ridge(f, W * 0.0, W * 0.2, H * 0.05, 23.8, { rough: 1.6, base: hY - 2 });
        this.layers.push({ pts: hill.pts, base: "#2f6040", haze: 0.26, reflect: true, x0: 0, x1: W * 0.2 });
        for (const [px, ph, pl] of [[0.03, 0.12, 12], [0.1, 0.15, -8], [0.16, 0.11, 14], [0.23, 0.09, 18], [0.27, 0.07, -10]]) this.palms.push({ x: W * px, y: hY - 2, h: H * ph * 0.7, lean: pl });
        if (spot.feature === "lagoon") {
          for (let i = 0; i < 4; i++) {
            const x = W * (0.5 + i * 0.055);
            this.houses.push({ x, y: hY + band * 0.35, w: 20, h: 9, lit: true, haze: 0.3, c: "#c8a878" });
            this.lights.push({ x: x + 10, y: hY + band * 0.35 - 4, c: "#ffc070", night: true });
          }
        }
        break;
      }
      case "open":
        if (spot.feature === "sargassum") for (let i = 0; i < 14; i++) this.mats.push({ x: r() * W, y: hY + band * (0.1 + r() * 0.85), w: 10 + r() * 40 });
        break;
      case "abyss":
        this.lights.push({ x: W * 0.78, y: hY - H * 0.05, c: "#ff4040", night: false });
        break;
      default:
        this.extra.build(this, f);
        break;
    }
    if (winter && loc.climate === "temperate") {
      for (const L of this.layers) if (L.base !== "#cdbb8c" && L.base !== "#cfb884") L.snowY = hY - H * (loc.land === "cliffs" ? 0.06 : 0.02);
    }
  }

  drawAbove(f: Frame) {
    this.build(f);
    const { ctx, W, H, hY, t, night } = f;
    // северное сияние
    if ((f.loc.land === "fjord" || f.loc.land === "ice") && night > 0.55 && (f.weather === "clear" || f.weather === "snow" || f.weather === "cloudy")) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const a = (night - 0.55) * 2.2 * (f.weather === "clear" ? 1 : 0.5);
      for (let k = 0; k < 4; k++) {
        for (let x = 0; x <= W; x += 6) {
          const y = H * (0.08 + k * 0.025) + Math.sin(x * 0.005 + t * 0.25 + k) * 30 + Math.sin(x * 0.012 - t * 0.17 + k * 2) * 14;
          const hgt = 50 + Math.sin(x * 0.02 + t + k) * 20;
          const g = ctx.createLinearGradient(0, y, 0, y + hgt);
          const c = k === 2 ? "150,90,255" : "70,255,160";
          g.addColorStop(0, `rgba(${c},0)`);
          g.addColorStop(0.7, `rgba(${c},${af(0.07 * a)})`);
          g.addColorStop(1, `rgba(${c},0)`);
          ctx.fillStyle = g;
          ctx.fillRect(x, y, 6, hgt);
        }
      }
      ctx.restore();
    }

    this.extra.drawBack(this, f);
    for (const L of this.layers) {
      if (L.hidden) continue;
      const col = this.colorOf(f, L.base, L.haze);
      tracePoly(ctx, L.pts);
      const g = ctx.createLinearGradient(0, hY - H * 0.3, 0, hY);
      g.addColorStop(0, mix(col, "#ffffff", 0.04 * (1 - night)));
      g.addColorStop(1, mix(col, f.hor, 0.18 * (1 - night)));
      ctx.fillStyle = g;
      ctx.fill();
      // подсветка кромки со стороны солнца
      if (f.golden > 0.1 && L.haze < 0.8) {
        ctx.strokeStyle = hexA("#ffb070", 0.25 * f.golden * f.sunVis);
        ctx.lineWidth = 1.2;
        tracePoly(ctx, L.pts.slice(2, -2), false);
        ctx.stroke();
      }
      if (L.snowY !== undefined) {
        ctx.save();
        tracePoly(ctx, L.pts);
        ctx.clip();
        ctx.beginPath();
        ctx.moveTo(L.x0, -1000);
        for (let x = L.x0; x <= L.x1; x += 10) ctx.lineTo(x, L.snowY + Math.sin(x * 0.09) * 6 + (fbm(x * 0.02, 3) - 0.5) * 30);
        ctx.lineTo(L.x1, -1000);
        ctx.closePath();
        const sc = mix(this.colorOf(f, "#f4f8fc", L.haze * 0.7), "#ffd8b8", f.golden * 0.4);
        const sg = ctx.createLinearGradient(0, L.snowY - H * 0.15, 0, L.snowY + 20);
        sg.addColorStop(0, sc);
        sg.addColorStop(1, mix(sc, "#8aa0b8", 0.3));
        ctx.fillStyle = sg;
        ctx.fill();
        ctx.restore();
      }
      this.drawDetailsFor(f, L.haze);
    }
    if (this.grass) {
      tracePoly(ctx, this.grass.pts);
      const se = f.e.season;
      ctx.fillStyle = this.colorOf(f, se === 3 ? "#e8eef2" : se === 2 ? "#8a7a3a" : se === 1 ? "#6a8a3e" : "#56733e", this.grass.haze);
      ctx.fill();
    }
    if (this.strata.length) {
      ctx.strokeStyle = hexA(this.colorOf(f, "#2e2a26", 0.2), 0.6);
      ctx.lineWidth = 1;
      for (const s of this.strata) {
        tracePoly(ctx, s.pts, false);
        ctx.stroke();
      }
    }
    if (this.lighthouse) this.drawLighthouse(f);
    if (this.waterfall) this.drawWaterfall(f);
    for (const p of this.palms) this.drawPalm(f, p.x, p.y, p.h, p.lean);
    if (f.loc.land === "abyss") this.drawPlatform(f);
    this.extra.drawAbove(this, f);
  }

  private drawDetailsFor(f: Frame, haze: number) {
    const { ctx, night, t } = f;
    const winter = f.e.season === 3 && (f.loc.climate === "temperate" || f.loc.land === "fjord");
    for (const tr of this.trees) {
      if (tr.haze !== haze) continue;
      ctx.fillStyle = this.colorOf(f, this.foliage(f, tr.c, tr.x, tr.kind), haze);
      if (tr.kind === "pine") {
        const sway = Math.sin(t * 0.8 + tr.x) * 0.6;
        ctx.beginPath();
        ctx.moveTo(tr.x + sway, tr.y - tr.h);
        ctx.lineTo(tr.x - tr.h * 0.28, tr.y);
        ctx.lineTo(tr.x + tr.h * 0.28, tr.y);
        ctx.fill();
        if (winter) {
          ctx.fillStyle = this.colorOf(f, "#eef4f8", haze);
          ctx.beginPath();
          ctx.moveTo(tr.x + sway, tr.y - tr.h);
          ctx.lineTo(tr.x - tr.h * 0.12, tr.y - tr.h * 0.55);
          ctx.lineTo(tr.x + tr.h * 0.12, tr.y - tr.h * 0.55);
          ctx.fill();
        }
      } else if (winter) {
        ctx.strokeStyle = this.colorOf(f, "#4a3e36", haze);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(tr.x, tr.y);
        ctx.lineTo(tr.x, tr.y - tr.h * 1.1);
        for (let k = 0; k < 4; k++) {
          const yy = tr.y - tr.h * (0.4 + k * 0.18), dx = tr.h * (0.5 - k * 0.1) * (k % 2 ? 1 : -1);
          ctx.moveTo(tr.x, yy);
          ctx.lineTo(tr.x + dx, yy - tr.h * 0.3);
        }
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(tr.x, tr.y - tr.h * 0.6, tr.h * 0.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = hexA("#ffffff", 0.08 * (1 - night));
        ctx.beginPath();
        ctx.arc(tr.x - tr.h * 0.2, tr.y - tr.h * 0.8, tr.h * 0.35, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    for (const h of this.houses) {
      if (h.haze !== haze) continue;
      const wall = this.colorOf(f, h.c, haze);
      const roof = this.colorOf(f, f.loc.land === "reef" ? "#8a6a3a" : "#9a4a38", haze);
      if (f.loc.land === "reef") {
        ctx.strokeStyle = this.colorOf(f, "#5a4028", haze);
        ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(h.x + 2 + i * 8, h.y);
          ctx.lineTo(h.x + 2 + i * 8, h.y + 7);
          ctx.stroke();
        }
      }
      ctx.fillStyle = wall;
      ctx.fillRect(h.x, h.y - h.h, h.w, h.h);
      ctx.fillStyle = roof;
      ctx.beginPath();
      ctx.moveTo(h.x - 2, h.y - h.h);
      ctx.lineTo(h.x + h.w / 2, h.y - h.h - h.h * 0.7);
      ctx.lineTo(h.x + h.w + 2, h.y - h.h);
      ctx.fill();
      if (h.church) {
        ctx.fillStyle = wall;
        ctx.fillRect(h.x + h.w / 2 - 2.5, h.y - h.h * 2.6, 5, h.h * 1.6);
        ctx.fillStyle = roof;
        ctx.beginPath();
        ctx.moveTo(h.x + h.w / 2 - 3.5, h.y - h.h * 2.6);
        ctx.lineTo(h.x + h.w / 2, h.y - h.h * 3.5);
        ctx.lineTo(h.x + h.w / 2 + 3.5, h.y - h.h * 2.6);
        ctx.fill();
      }
      if (h.lit && night > 0.25) {
        ctx.fillStyle = `rgba(255,196,110,${night})`;
        ctx.fillRect(h.x + h.w * 0.3, h.y - h.h * 0.65, 3, 3);
        if (h.w > 13) ctx.fillRect(h.x + h.w * 0.65, h.y - h.h * 0.65, 3, 3);
      } else {
        ctx.fillStyle = hexA("#20303a", 0.6);
        ctx.fillRect(h.x + h.w * 0.3, h.y - h.h * 0.65, 2.5, 2.5);
      }
    }
  }

  private drawLighthouse(f: Frame) {
    const L = this.lighthouse!;
    const { ctx, night, t, W } = f;
    const w0 = L.h * 0.16, w1 = L.h * 0.1;
    const white = this.colorOf(f, "#eeeae2", L.haze), red = this.colorOf(f, "#c43a2e", L.haze);
    ctx.fillStyle = white;
    ctx.beginPath();
    ctx.moveTo(L.x - w0 / 2, L.y);
    ctx.lineTo(L.x - w1 / 2, L.y - L.h);
    ctx.lineTo(L.x + w1 / 2, L.y - L.h);
    ctx.lineTo(L.x + w0 / 2, L.y);
    ctx.fill();
    ctx.fillStyle = red;
    for (const q of [0.25, 0.6]) {
      const y = L.y - L.h * q, ww = w0 + (w1 - w0) * q;
      ctx.fillRect(L.x - ww / 2, y - L.h * 0.07, ww, L.h * 0.12);
    }
    ctx.fillStyle = this.colorOf(f, "#2a2a2a", L.haze);
    ctx.fillRect(L.x - w1 * 0.8, L.y - L.h - 2, w1 * 1.6, 2);
    ctx.fillRect(L.x - w1 * 0.4, L.y - L.h - 9, w1 * 0.8, 1.5);
    ctx.beginPath();
    ctx.moveTo(L.x - w1 * 0.55, L.y - L.h - 9);
    ctx.lineTo(L.x, L.y - L.h - 14);
    ctx.lineTo(L.x + w1 * 0.55, L.y - L.h - 9);
    ctx.fill();
    const ly = L.y - L.h - 5;
    if (night > 0.2) {
      glow(ctx, L.x, ly, 3, "#fff0b0", Math.min(1, night * 1.2));
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const a = L.sweep ? t * 0.9 : Math.sin(t * 0.5) * 0.7 + Math.PI;
      const dx = Math.cos(a);
      const len = W * 0.55;
      const inten = 0.28 * night * Math.pow(Math.abs(dx), 0.5);
      const g = ctx.createLinearGradient(L.x, ly, L.x + dx * len, ly);
      g.addColorStop(0, `rgba(255,240,190,${af(inten)})`);
      g.addColorStop(1, "rgba(255,240,190,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(L.x, ly - 1);
      ctx.lineTo(L.x + dx * len, ly - 30 - f.fogK * 20);
      ctx.lineTo(L.x + dx * len, ly + 26 + f.fogK * 20);
      ctx.lineTo(L.x, ly + 1);
      ctx.fill();
      if (Math.abs(dx) > 0.96) glow(ctx, L.x, ly, 10, "#fff6d0", 0.6 * night);
      ctx.restore();
    } else {
      ctx.fillStyle = this.colorOf(f, "#e8d890", L.haze);
      ctx.fillRect(L.x - w1 * 0.35, ly - 3, w1 * 0.7, 5);
    }
  }

  private drawWaterfall(f: Frame) {
    const wf = this.waterfall!;
    const { ctx, hY, t } = f;
    const c = this.colorOf(f, "#e8f4fa", 0.25);
    const g = ctx.createLinearGradient(0, wf.top, 0, hY);
    g.addColorStop(0, hexA(c, 0.75));
    g.addColorStop(1, hexA(c, 0.95));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(wf.x - wf.w / 2, wf.top);
    ctx.lineTo(wf.x + wf.w / 2, wf.top);
    ctx.lineTo(wf.x + wf.w * 0.8, hY);
    ctx.lineTo(wf.x - wf.w * 0.8, hY);
    ctx.fill();
    ctx.strokeStyle = hexA(mix(c, "#7a9aaa", 0.4), 0.7);
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const x = wf.x - wf.w * 0.4 + i * wf.w * 0.2;
      const off = (t * 60 + i * 17) % 20;
      ctx.setLineDash([6, 14]);
      ctx.lineDashOffset = -off;
      ctx.beginPath();
      ctx.moveTo(x, wf.top);
      ctx.lineTo(x + (x - wf.x) * 0.5, hY);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    for (let i = 0; i < 8; i++) {
      const p = (t * 0.4 + i / 8) % 1;
      ctx.fillStyle = hexA(c, 0.35 * (1 - p));
      ctx.beginPath();
      ctx.arc(wf.x + Math.sin(i * 2.3) * 16 * p, hY - p * 18, 5 + p * 14, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawPalm(f: Frame, x: number, y: number, h: number, lean: number) {
    const { ctx, t } = f;
    const c = this.colorOf(f, "#24402c", 0.24);
    const trunk = this.colorOf(f, "#5a4630", 0.24);
    const sway = Math.sin(t * 0.9 + x) * 3 * (0.5 + f.wind);
    const tx = x + lean + sway, ty = y - h;
    ctx.strokeStyle = trunk;
    ctx.lineWidth = 3.2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + lean * 0.2, y - h * 0.5, tx, ty);
    ctx.stroke();
    ctx.fillStyle = c;
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (i - 3) * 0.52 + Math.sin(t * 1.3 + i + x) * 0.06 * (0.5 + f.wind);
      const L = h * 0.55;
      const ex = tx + Math.cos(a) * L, ey = ty + Math.sin(a) * L * 0.5 + L * 0.35;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.quadraticCurveTo(tx + Math.cos(a) * L * 0.6, ty + Math.sin(a) * L * 0.5 - 8, ex, ey);
      ctx.quadraticCurveTo(tx + Math.cos(a) * L * 0.5, ty + Math.sin(a) * L * 0.25, tx, ty);
      ctx.fill();
    }
  }

  private drawPlatform(f: Frame) {
    const { ctx, hY, W, H, t, night } = f;
    const x = W * 0.78, deck = hY - H * 0.03;
    const c = this.colorOf(f, "#3a3e44", 0.55);
    ctx.fillStyle = c;
    ctx.strokeStyle = c;
    ctx.lineWidth = 2;
    for (const dx of [-26, -9, 9, 26]) {
      ctx.beginPath();
      ctx.moveTo(x + dx, hY + 2);
      ctx.lineTo(x + dx * 0.9, deck);
      ctx.stroke();
    }
    ctx.fillRect(x - 34, deck - 4, 68, 5);
    ctx.fillRect(x - 24, deck - 14, 26, 10);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 14, deck - 4);
    ctx.lineTo(x + 18, deck - 46);
    ctx.lineTo(x + 22, deck - 4);
    ctx.moveTo(x + 18, deck - 44);
    ctx.lineTo(x + 44, deck - 26);
    ctx.stroke();
    if (Math.sin(t * 2.5) > 0.3) glow(ctx, x + 18, deck - 47, 2.5, "#ff3030", 1);
    if (night > 0.3) {
      for (let i = 0; i < 4; i++) glow(ctx, x - 22 + i * 7, deck - 9, 1.2, "#ffd890", night);
    }
    if (f.spot.feature === "twilight") {
      const bx = W * 0.6, by = hY + (f.sY - hY) * 0.5 + Math.sin(t * 1.4) * 1.5;
      ctx.fillStyle = this.colorOf(f, "#c83a2a", 0.3);
      ctx.beginPath();
      ctx.moveTo(bx - 5, by);
      ctx.lineTo(bx - 2, by - 14);
      ctx.lineTo(bx + 2, by - 14);
      ctx.lineTo(bx + 5, by);
      ctx.fill();
      if (Math.sin(t * 3) > 0.5) glow(ctx, bx, by - 16, 2, "#ffe060", 1);
    }
  }

  /** Отражения в полосе моря (между горизонтом и линией воды) */
  drawReflection(f: Frame, water: string) {
    const { ctx, hY, sY, W, t, night } = f;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, hY, W, sY - hY);
    ctx.clip();
    ctx.save();
    ctx.translate(0, hY);
    ctx.scale(1, -0.5);
    ctx.translate(0, -hY);
    ctx.globalAlpha = 0.45 * (1 - f.amp / 14);
    for (const L of this.layers) {
      if (!L.reflect) continue;
      tracePoly(ctx, L.pts);
      ctx.fillStyle = mix(this.colorOf(f, L.base, L.haze), water, 0.45);
      ctx.fill();
    }
    ctx.restore();
    if (night > 0.3) {
      ctx.globalCompositeOperation = "lighter";
      for (const l of this.lights) {
        if (l.night && night < 0.3) continue;
        const len = (sY - hY) * 0.9;
        const g = ctx.createLinearGradient(0, hY, 0, hY + len);
        g.addColorStop(0, hexA(l.c, 0.35 * night));
        g.addColorStop(1, hexA(l.c, 0));
        ctx.fillStyle = g;
        for (let k = 0; k < 8; k++) {
          const yy = hY + (k / 8) * len;
          ctx.fillRect(l.x - 1.5 + Math.sin(t * 3 + k * 1.7 + l.x) * 2, yy, 3, len / 10);
        }
      }
    }
    ctx.restore();
  }

  /** Объекты на воде в полосе моря */
  drawSea(f: Frame) {
    const { ctx, hY, sY, W, t, night } = f;
    // объекты на воде (бунгало и т.п.), у которых нет своего слоя суши
    const hz = new Set(this.layers.map((l) => l.haze));
    const orphan = new Set([...this.houses, ...this.trees].map((o) => o.haze).filter((h) => !hz.has(h)));
    orphan.forEach((h) => this.drawDetailsFor(f, h));
    this.extra.drawSea(this, f);
    const band = sY - hY;
    const foam = hexA(mix("#ffffff", "#40506a", night * 0.7), 0.75);
    for (const rk of this.seaRocks) {
      ctx.fillStyle = this.colorOf(f, "#3e3a36", 0.3);
      ctx.beginPath();
      ctx.moveTo(rk.x - rk.w / 2, rk.y);
      ctx.quadraticCurveTo(rk.x - rk.w * 0.3, rk.y - rk.h, rk.x, rk.y - rk.h * 1.1);
      ctx.quadraticCurveTo(rk.x + rk.w * 0.35, rk.y - rk.h * 0.9, rk.x + rk.w / 2, rk.y);
      ctx.fill();
      const p = (Math.sin(t * 1.2 + rk.x) + 1) / 2;
      ctx.fillStyle = foam;
      ctx.beginPath();
      ctx.ellipse(rk.x, rk.y, rk.w * (0.55 + p * 0.25), 1.5 + p * 1.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (this.cliffBase) {
      for (let x = this.cliffBase.x0; x < W; x += 14) {
        const p = (Math.sin(t * 1.4 + x * 0.05) + 1) / 2;
        ctx.fillStyle = hexA(mix("#ffffff", "#40506a", night * 0.7), 0.35 + p * 0.4);
        ctx.fillRect(x, hY + 1 + p * 2, 10 + p * 6, 1.5);
      }
    }
    if (f.spot.feature === "arch") {
      const ax = W * 0.44, ay = hY + band * 0.35, aw = W * 0.09, ah = f.H * 0.1;
      ctx.fillStyle = this.colorOf(f, "#4c4640", 0.3);
      ctx.beginPath();
      ctx.moveTo(ax - aw / 2, ay);
      ctx.lineTo(ax - aw * 0.45, ay - ah * 0.8);
      ctx.quadraticCurveTo(ax - aw * 0.3, ay - ah * 1.1, ax, ay - ah);
      ctx.quadraticCurveTo(ax + aw * 0.35, ay - ah * 1.05, ax + aw * 0.5, ay - ah * 0.6);
      ctx.lineTo(ax + aw * 0.55, ay);
      ctx.lineTo(ax + aw * 0.22, ay);
      ctx.quadraticCurveTo(ax + aw * 0.2, ay - ah * 0.62, ax - aw * 0.02, ay - ah * 0.64);
      ctx.quadraticCurveTo(ax - aw * 0.22, ay - ah * 0.6, ax - aw * 0.24, ay);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = this.colorOf(f, "#5a7a42", 0.3);
      ctx.fillRect(ax - aw * 0.3, ay - ah * 1.02, aw * 0.5, 3);
      ctx.fillStyle = foam;
      ctx.fillRect(ax - aw * 0.55, ay - 1, aw * 1.1, 2);
    }
    if (f.spot.feature === "current") {
      ctx.strokeStyle = hexA(mix("#ffffff", "#40506a", night * 0.7), 0.4);
      ctx.lineWidth = 1;
      for (let i = 0; i < 16; i++) {
        const y = hY + band * ((i * 0.618) % 1);
        const x = ((t * (30 + i * 3) + i * 170) % (W + 200)) - 100;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + 20, y - 2, x + 40 + (y - hY), y);
        ctx.stroke();
      }
    }
    if (f.spot.feature === "reefwall") {
      for (let x = W * 0.34; x < W; x += 5) {
        const y = hY + band * 0.45 + Math.sin(x * 0.02) * 2;
        const p = (Math.sin(t * 1.6 - x * 0.02) + 1) / 2;
        ctx.fillStyle = hexA(mix("#ffffff", "#40506a", night * 0.7), 0.25 + p * 0.55);
        ctx.fillRect(x, y - p * 2.5, 5, 1.5 + p * 1.5);
      }
    }
    if (f.spot.feature === "wreck") {
      const mx = W * 0.72, my = hY + band * 0.4;
      ctx.strokeStyle = this.colorOf(f, "#3a2e22", 0.3);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(mx, my);
      ctx.lineTo(mx + 5, my - f.H * 0.07);
      ctx.moveTo(mx - 9, my - f.H * 0.05);
      ctx.lineTo(mx + 14, my - f.H * 0.055);
      ctx.stroke();
      ctx.fillStyle = this.colorOf(f, "#b8a888", 0.3);
      ctx.beginPath();
      ctx.moveTo(mx + 13, my - f.H * 0.055);
      ctx.quadraticCurveTo(mx + 18 + Math.sin(t * 2) * 3, my - f.H * 0.035, mx + 11, my - f.H * 0.02);
      ctx.lineTo(mx + 8, my - f.H * 0.05);
      ctx.fill();
      ctx.fillStyle = foam;
      ctx.fillRect(mx - 8, my - 1, 16, 2);
    }
    for (const fl of this.floes) {
      fl.x += fl.v * f.dt * (0.4 + f.wind);
      if (fl.x - fl.w > W) fl.x = -fl.w;
      const y = fl.y + Math.sin(t + fl.x * 0.01) * 0.6;
      ctx.fillStyle = this.colorOf(f, "#eef6fa", 0.3);
      ctx.beginPath();
      ctx.moveTo(fl.x - fl.w / 2, y);
      ctx.lineTo(fl.x - fl.w * 0.35, y - fl.h);
      ctx.lineTo(fl.x + fl.w * 0.3, y - fl.h * 0.8);
      ctx.lineTo(fl.x + fl.w / 2, y);
      ctx.fill();
      ctx.fillStyle = this.colorOf(f, "#8ab8d0", 0.3);
      ctx.fillRect(fl.x - fl.w / 2, y, fl.w, 1.5);
    }
    for (const m of this.mats) {
      m.x += f.dt * 3;
      if (m.x - m.w > W) m.x = -m.w;
      const k = (m.y - hY) / band;
      ctx.fillStyle = this.colorOf(f, "#8a6a28", 0.3);
      ctx.beginPath();
      ctx.ellipse(m.x, m.y, m.w * (0.5 + k * 0.6), 1 + k * 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = this.colorOf(f, "#b08a38", 0.3);
      for (let i = 0; i < 4; i++) ctx.fillRect(m.x + Math.sin(i * 2.7 + m.w) * m.w * 0.4, m.y - 1, 2, 1.5);
    }
    if (f.loc.land === "open") {
      const sx = ((t * 4 + f.spot.seed * 300) % (W + 300)) - 150;
      const c = this.colorOf(f, "#34383e", 0.7);
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(sx, hY - 1);
      ctx.lineTo(sx + 70, hY - 1);
      ctx.lineTo(sx + 66, hY - 7);
      ctx.lineTo(sx + 4, hY - 7);
      ctx.fill();
      ctx.fillRect(sx + 52, hY - 16, 12, 9);
      ctx.fillRect(sx + 56, hY - 22, 3, 6);
      if (night > 0.3) {
        glow(ctx, sx + 58, hY - 23, 1.2, "#ffffff", night);
        glow(ctx, sx + 4, hY - 8, 1, "#ff4040", night);
        glow(ctx, sx + 70, hY - 8, 1, "#40ff60", night);
      }
    }
  }

  private gannets: { x: number; y: number; t: number; vx: number; phase: number }[] = [];
  /** Олуши, пикирующие в воду во время «чаек» и над косяком */
  drawDivers(f: Frame) {
    const { ctx, e, W, H, hY, sY, night } = f;
    const active = e.activeEvents.some((a) => a.id === "gulls" || a.id === "shoal") && !e.isNight && f.loc.land !== "abyss";
    if (active && this.gannets.length < 4 && Math.random() < f.dt * 0.8)
      this.gannets.push({ x: W * (0.4 + Math.random() * 0.5), y: H * (0.08 + Math.random() * 0.1), t: 0, vx: (Math.random() - 0.5) * 30, phase: 0 });
    const col = mix("#f4f4f0", "#1a2030", night * 0.8);
    for (const g of this.gannets) {
      g.t += f.dt;
      const x = g.x + g.vx * g.t;
      if (g.phase === 0) {
        const y = g.y + Math.sin(g.t * 2) * 6;
        this.bird(ctx, x, y, Math.sin(g.t * 9) * 5, col, 1);
        if (g.t > 1.5 + Math.random() * 2) { g.phase = 1; g.t = 0; g.x = x; }
      } else if (g.phase === 1) {
        const k = Math.min(1, g.t / 0.7);
        const targetY = hY + (sY - hY) * 0.5;
        const y = g.y + (targetY - g.y) * k * k;
        ctx.save();
        ctx.translate(g.x, y);
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(0, 6);
        ctx.lineTo(-2.5, -6);
        ctx.lineTo(2.5, -6);
        ctx.fill();
        ctx.restore();
        if (k >= 1) { g.phase = 2; g.t = 0; }
      } else {
        const p = g.t / 0.8;
        const y = hY + (sY - hY) * 0.5;
        ctx.fillStyle = `rgba(255,255,255,${0.8 * (1 - p)})`;
        for (let i = 0; i < 6; i++) {
          ctx.beginPath();
          ctx.arc(g.x + (i - 2.5) * 2.5 * (1 + p * 2), y - Math.sin(p * Math.PI) * (8 + (i % 3) * 5), 1.4, 0, Math.PI * 2);
          ctx.fill();
        }
        if (p >= 1) g.phase = 3;
      }
    }
    this.gannets = this.gannets.filter((g) => g.phase < 3);
  }

  private bird(ctx: CanvasRenderingContext2D, x: number, y: number, fl: number, col: string, s: number) {
    ctx.strokeStyle = col;
    ctx.lineWidth = 2 * s;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x - 12 * s, y - fl);
    ctx.quadraticCurveTo(x - 5 * s, y - 4 * s, x, y);
    ctx.quadraticCurveTo(x + 5 * s, y - 4 * s, x + 12 * s, y - fl);
    ctx.stroke();
  }

  /** Пирс на переднем плане */
  drawFront(f: Frame) {
    this.extra.drawFront(this, f);
    if (f.spot.feature !== "pier") return;
    const { ctx, sY, W, night, t } = f;
    const x1 = W * 0.2;
    const deckY = sY - 16 * f.sc;
    const wood = mix("#6a4a30", "#0a0c10", night * 0.75);
    const dark = mix("#3a2818", "#05070a", night * 0.75);
    ctx.fillStyle = dark;
    for (let x = 6; x < x1; x += 34 * f.sc) ctx.fillRect(x, deckY, 6 * f.sc, sY - deckY + 20);
    ctx.fillStyle = wood;
    ctx.fillRect(-4, deckY - 5 * f.sc, x1 + 8, 6 * f.sc);
    ctx.fillStyle = dark;
    ctx.fillRect(-4, deckY + 1, x1 + 8, 2 * f.sc);
    for (let x = 4; x < x1; x += 11 * f.sc) {
      ctx.fillStyle = hexA("#000000", 0.25);
      ctx.fillRect(x, deckY - 5 * f.sc, 1, 5 * f.sc);
    }
    // перила и фонарь
    ctx.fillStyle = dark;
    ctx.fillRect(x1 - 6 * f.sc, deckY - 42 * f.sc, 3 * f.sc, 38 * f.sc);
    ctx.fillRect(x1 - 12 * f.sc, deckY - 44 * f.sc, 15 * f.sc, 3 * f.sc);
    const lamp = { x: x1 - 11 * f.sc, y: deckY - 38 * f.sc };
    ctx.fillRect(lamp.x - 3 * f.sc, lamp.y - 3 * f.sc, 6 * f.sc, 7 * f.sc);
    if (night > 0.25) {
      glow(ctx, lamp.x, lamp.y + 1, 3 * f.sc, "#ffc070", night);
      const lg = ctx.createRadialGradient(lamp.x, lamp.y, 0, lamp.x, lamp.y, 120 * f.sc);
      lg.addColorStop(0, `rgba(255,190,110,${af(0.22 * night)})`);
      lg.addColorStop(1, "rgba(255,190,110,0)");
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = lg;
      ctx.fillRect(lamp.x - 120 * f.sc, lamp.y - 120 * f.sc, 240 * f.sc, 240 * f.sc);
      ctx.restore();
    }
    // тумбы и канат
    ctx.fillStyle = mix("#2a2a2a", "#05070a", night * 0.6);
    ctx.fillRect(x1 * 0.5, deckY - 11 * f.sc, 6 * f.sc, 6 * f.sc);
    ctx.strokeStyle = mix("#c8b080", "#101418", night * 0.7);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x1 * 0.5 + 3 * f.sc, deckY - 9 * f.sc);
    ctx.quadraticCurveTo(x1 * 0.5 + 20 * f.sc, sY + Math.sin(t) * 2, x1 * 0.5 + 40 * f.sc, sY + 2);
    ctx.stroke();
  }
}
