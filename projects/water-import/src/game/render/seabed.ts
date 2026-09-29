import { bedFrac } from "../world";
import type { Frame } from "./frame";
import { tileCaustics } from "./water";
import { clamp, glow, hash1, hexA, mix, rng, tracePoly } from "./util";

interface Decor { x: number; y: number; kind: string; s: number; c: string; seed: number }

const HABITAT: Record<string, string[]> = {
  sand: ["grass", "grass", "shell", "rock", "star", "pebbles", "grass", "urchin"],
  rock: ["boulder", "boulder", "anemone", "urchin", "grass", "kelp", "rock", "star"],
  kelp: ["kelp", "kelp", "boulder", "urchin", "sponge", "lophelia", "rock"],
  coral: ["coralB", "coralF", "anemone", "brain", "table", "tube", "coralB", "grass", "sponge"],
  mud: ["pen", "rock", "pen", "cucumber", "sponge", "brittle"],
  vents: ["worms", "worms", "rock", "cucumber", "brittle", "pen"],
  silt: ["seagrass", "reedstub", "shell", "mussels", "pebbles", "seagrass", "reedstub"],
  granite: ["boulder", "boulder", "wrack", "mussels", "star", "wrack", "rock"],
  kelpforest: ["rock", "urchin", "anemone", "star", "boulder", "wrack", "urchin"],
  roots: ["seagrass", "seagrass", "shell", "cucumber", "sponge", "seagrass", "star"],
  basalt: ["basalt", "basalt", "lavarock", "urchin", "coralB", "anemone", "basalt"],
  polar: ["icesponge", "star", "brittle", "seaspider", "urchin", "glassSponge", "icesponge"],
};
const CORAL_COLS = ["#ff6f91", "#ff9a3c", "#b06cff", "#3fd0c0", "#ffd05a", "#ff5060", "#6aa0ff"];

export class SeabedRenderer {
  private key = "";
  private ys: number[] = [];
  private back: number[] = [];
  private pts: number[] = [];
  private decor: Decor[] = [];
  private far: { x: number; y: number; h: number; w: number; kind: string; seed: number }[] = [];
  private step = 6;
  minY = 0;
  private W = 0;

  bedY(x: number) {
    const i = clamp(x / this.step, 0, this.ys.length - 1);
    const a = Math.floor(i), b = Math.min(this.ys.length - 1, a + 1);
    return this.ys[a] + (this.ys[b] - this.ys[a]) * (i - a);
  }

  build(f: Frame) {
    const { W, H, spot, sY } = f;
    const key = `${spot.id}|${W}|${H}`;
    if (key === this.key) return;
    this.key = key;
    this.W = W;
    this.ys = [];
    this.back = [];
    this.pts = [];
    for (let x = 0; x <= W + this.step; x += this.step) {
      const y = sY + f.depthPx(spot.maxDepth * bedFrac(spot, x / W));
      this.ys.push(y);
      this.pts.push(x, y);
      const yb = sY + f.depthPx(spot.maxDepth * bedFrac(spot, clamp((x / W) * 0.8 + 0.12, 0, 1)) * 0.86) - 14 * f.sc;
      this.back.push(x, yb);
    }
    this.minY = Math.min(...this.ys);
    const r = rng(spot.seed * 97);
    const list = HABITAT[f.loc.seabed] ?? HABITAT.sand;
    this.decor = [];
    const n = Math.round(W / 20);
    for (let i = 0; i < n; i++) {
      const x = r() * W;
      this.decor.push({ x, y: this.bedY(x), kind: list[Math.floor(r() * list.length)], s: 0.55 + r() * 0.9, c: CORAL_COLS[Math.floor(r() * CORAL_COLS.length)], seed: r() * 100 });
    }
    // склон — гуще
    if (spot.profile === "drop" || spot.profile === "trench" || spot.profile === "seamount") {
      for (let i = 0; i < 26; i++) {
        const x = spot.profile === "drop" ? W * (0.5 + r() * 0.15) : spot.profile === "trench" ? W * (0.42 + r() * 0.16) : W * (0.45 + r() * 0.3);
        const kind = f.loc.seabed === "coral" ? ["coralB", "coralF", "table", "tube", "brain"][Math.floor(r() * 5)] : f.loc.seabed === "vents" ? "worms" : ["boulder", "anemone", "sponge", "rock"][Math.floor(r() * 4)];
        this.decor.push({ x, y: this.bedY(x) + 2, kind, s: 0.5 + r() * 0.8, c: CORAL_COLS[Math.floor(r() * CORAL_COLS.length)], seed: r() * 100 });
      }
    }
    const feat = spot.feature;
    if (feat === "lagoon") for (let i = 0; i < 5; i++) { const x = W * (0.3 + r() * 0.6); this.decor.push({ x, y: this.bedY(x), kind: "anemoneClown", s: 1 + r() * 0.4, c: "#c060ff", seed: r() * 100 }); }
    if (feat === "vents") for (let i = 0; i < 5; i++) { const x = W * (0.48 + i * 0.05 + r() * 0.02); this.decor.push({ x, y: this.bedY(x) + 3, kind: "vent", s: 0.8 + r() * 0.8, c: "#ff6a20", seed: r() * 100 }); }
    if (feat === "deep" || feat === "icebay") for (let i = 0; i < 12; i++) { const x = r() * W; this.decor.push({ x, y: this.bedY(x), kind: "lophelia", s: 0.7 + r() * 0.8, c: "#f0ece0", seed: r() * 100 }); }
    if (feat === "twilight" || feat === "blue") for (let i = 0; i < 10; i++) { const x = r() * W; this.decor.push({ x, y: this.bedY(x), kind: "glassSponge", s: 0.8 + r() * 0.8, c: "#e8e0d0", seed: r() * 100 }); }
    if (feat === "wreck" || feat === "ridge") { const x = W * 0.3; this.decor.push({ x, y: this.bedY(x), kind: "anchor", s: 1, c: "#5a4a3a", seed: 1 }); }
    if (feat === "wreck") for (let i = 0; i < 4; i++) { const x = W * (0.2 + r() * 0.3); this.decor.push({ x, y: this.bedY(x), kind: "amphora", s: 0.8 + r() * 0.4, c: "#b06a40", seed: r() * 100 }); }
    this.decor.sort((a, b) => a.s - b.s);
    // дальний план
    this.far = [];
    const fk: Record<string, string[]> = { sand: ["grass", "dune"], rock: ["pillar", "kelp"], kelp: ["kelp", "kelp", "pillar"], coral: ["bommie", "bommie", "fan"], mud: ["spire", "dune"], vents: ["spire", "chimney"], silt: ["grass", "dune", "dune"], granite: ["dune", "pillar"], kelpforest: ["kelp", "kelp", "kelp", "pillar"], roots: ["grass", "dune"], basalt: ["pillar", "spire", "chimney"], polar: ["dune", "spire"] };
    const kinds = fk[f.loc.seabed] ?? ["dune"];
    for (let i = 0; i < Math.round(W / 55); i++) {
      const x = r() * W;
      const bi = clamp(Math.round(x / this.step) * 2 + 1, 1, this.back.length - 1);
      this.far.push({ x, y: this.back[bi] + 6, h: (40 + r() * 110) * f.sc, w: (14 + r() * 40) * f.sc, kind: kinds[Math.floor(r() * kinds.length)], seed: r() * 100 });
    }
  }

  draw(f: Frame) {
    this.build(f);
    const { ctx, W, sY, cam, H, t } = f;
    if (this.minY - 200 > cam + H) return;
    const bedC = f.loc.bed;
    // дальние силуэты
    const farC = mix(mix(bedC, f.loc.water.mid, 0.72), "#000000", 0.1);
    ctx.fillStyle = farC;
    ctx.strokeStyle = farC;
    for (const o of this.far) {
      if (o.y - o.h > cam + H || o.y < cam - 50) continue;
      ctx.save();
      ctx.translate(o.x, o.y);
      ctx.globalAlpha = 0.75;
      if (o.kind === "kelp" || o.kind === "grass") {
        ctx.lineWidth = o.kind === "kelp" ? 3 : 1.6;
        const hh = o.kind === "kelp" ? o.h * 1.4 : o.h * 0.3;
        for (let k = 0; k < (o.kind === "kelp" ? 3 : 7); k++) {
          ctx.beginPath();
          ctx.moveTo(k * 6 - 6, 0);
          ctx.quadraticCurveTo(k * 6 + Math.sin(t * 0.5 + o.seed + k) * 12, -hh * 0.5, k * 6 + Math.sin(t * 0.4 + o.seed + k) * 18, -hh * (0.7 + (k % 3) * 0.15));
          ctx.stroke();
        }
      } else if (o.kind === "pillar" || o.kind === "spire" || o.kind === "chimney") {
        const ww = o.kind === "chimney" ? o.w * 0.5 : o.w;
        ctx.beginPath();
        ctx.moveTo(-ww, 2);
        ctx.lineTo(-ww * 0.45, -o.h);
        ctx.lineTo(ww * 0.2, -o.h * 1.08);
        ctx.lineTo(ww * 0.55, -o.h * 0.7);
        ctx.lineTo(ww, 2);
        ctx.fill();
      } else if (o.kind === "bommie" || o.kind === "dune") {
        ctx.beginPath();
        ctx.ellipse(0, 2, o.w * 1.6, o.kind === "bommie" ? o.h * 0.45 : o.h * 0.14, 0, Math.PI, 0);
        ctx.fill();
      } else if (o.kind === "fan") {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(-o.w * 1.5, -o.h * 0.6, -o.w * 0.4, -o.h * 0.9);
        ctx.quadraticCurveTo(o.w, -o.h, o.w * 1.1, -o.h * 0.5);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
    // дальний слой
    const bp = [...this.back, W + 10, this.minY + 4000, -10, this.minY + 4000];
    tracePoly(ctx, bp);
    ctx.fillStyle = mix(mix(bedC, f.loc.water.mid, 0.55), "#000000", 0.15);
    ctx.fill();
    // основной
    const pts = [...this.pts, W + 10, this.minY + 4000, -10, this.minY + 4000];
    tracePoly(ctx, pts);
    const g = ctx.createLinearGradient(0, this.minY, 0, this.minY + 300);
    g.addColorStop(0, mix(bedC, "#ffffff", 0.1));
    g.addColorStop(1, mix(bedC, "#000000", 0.55));
    ctx.fillStyle = g;
    ctx.fill();
    // кромка и осадочные слои
    ctx.save();
    tracePoly(ctx, pts);
    ctx.clip();
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = hexA(mix(bedC, "#ffffff", 0.35), 0.7);
    tracePoly(ctx, this.pts, false);
    ctx.stroke();
    ctx.lineWidth = 1;
    for (let k = 1; k <= 4; k++) {
      ctx.strokeStyle = hexA(mix(bedC, "#000000", 0.4), 0.25);
      ctx.beginPath();
      for (let i = 0; i < this.pts.length; i += 2) {
        const y = this.pts[i + 1] + k * 14 * f.sc + Math.sin(this.pts[i] * 0.03 + k) * 3;
        if (i === 0) ctx.moveTo(this.pts[i], y);
        else ctx.lineTo(this.pts[i], y);
      }
      ctx.stroke();
    }
    if (f.spot.feature === "sandbar" || f.loc.seabed === "sand") {
      ctx.strokeStyle = hexA(mix(bedC, "#000000", 0.2), 0.35);
      for (let x = 4; x < W; x += 9) {
        const y = this.bedY(x) + 5;
        ctx.beginPath();
        ctx.arc(x, y, 4, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
      }
    }
    ctx.restore();
    // каустика — тонкой полосой по поверхности мелкого дна
    const shallow = sY + f.depthPx(6 + f.clarity * 22);
    const ca = f.day * (1 - f.cover * 0.85) * f.clarity;
    if (ca > 0.05 && this.minY < shallow && f.quality > 0) {
      const band = 26 * f.sc;
      ctx.save();
      ctx.beginPath();
      for (let i = 0; i < this.pts.length; i += 2) {
        const y = this.pts[i + 1] - 3;
        if (i === 0) ctx.moveTo(this.pts[i], y);
        else ctx.lineTo(this.pts[i], y);
      }
      for (let i = this.pts.length - 2; i >= 0; i -= 2) ctx.lineTo(this.pts[i], this.pts[i + 1] + band);
      ctx.closePath();
      ctx.clip();
      ctx.globalCompositeOperation = "lighter";
      tileCaustics(ctx, 0, this.minY - 10, W, shallow - this.minY + band + 10, t * 0.8, 0.9 * f.sc, 0.32 * ca);
      ctx.restore();
    }

    this.drawFeatures(f);
    for (const d of this.decor) this.drawDecor(f, d);
  }

  private drawFeatures(f: Frame) {
    const { ctx, W, sY, sc, t } = f;
    const feat = f.spot.feature;
    if (feat === "pier") {
      for (let x = 6; x < W * 0.2; x += 34 * sc) {
        const yb = this.bedY(x);
        ctx.fillStyle = "#3a2818";
        ctx.fillRect(x, sY - 2, 6 * sc, yb - sY + 6);
        ctx.fillStyle = "#6a7a5a";
        for (let y = sY + 8; y < yb; y += 7) {
          ctx.beginPath();
          ctx.arc(x + (y % 2 ? 0 : 6 * sc), y, 2 + Math.sin(y) * 1, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.strokeStyle = "#4a7a3a";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x + 3 * sc, sY + 10);
        ctx.quadraticCurveTo(x + 12 + Math.sin(t + x) * 4, sY + 26, x + 6 + Math.sin(t * 0.8 + x) * 6, sY + 44);
        ctx.stroke();
      }
    }
    this.drawNewFeatures(f);
    if (feat === "wreck") this.drawWreck(f, W * 0.66);
    if (feat === "trench") this.drawSkeleton(f, W * 0.2);
    if (feat === "sargassum") {
      const r = rng(5);
      for (let i = 0; i < 9; i++) {
        const x = r() * W;
        const len = (30 + r() * 50) * sc;
        ctx.strokeStyle = "#8a6a24";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, sY + 2);
        for (let k = 1; k <= 6; k++) ctx.lineTo(x + Math.sin(t * 0.8 + k + i) * k * 1.5, sY + (len * k) / 6);
        ctx.stroke();
        ctx.fillStyle = "#b08a30";
        for (let k = 1; k <= 6; k++) {
          ctx.beginPath();
          ctx.arc(x + Math.sin(t * 0.8 + k + i) * k * 1.5 + 3, sY + (len * k) / 6, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    if (feat === "waterfall") {
      ctx.fillStyle = "rgba(230,245,255,0.5)";
      for (let i = 0; i < 30; i++) {
        const p = (t * 0.35 + i / 30) % 1;
        ctx.beginPath();
        ctx.arc(W * 0.93 + Math.sin(i * 3.1 + t) * 26 * p, sY + 90 * sc * (1 - p), 1 + (i % 3), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (feat === "icebay") {
      ctx.fillStyle = "rgba(210,235,250,0.55)";
      for (let i = 0; i < 4; i++) {
        const x = ((i * 0.27 + t * 0.004) % 1.2) * W - W * 0.1;
        ctx.beginPath();
        ctx.moveTo(x, sY);
        ctx.lineTo(x + 50 * sc, sY);
        ctx.lineTo(x + 38 * sc, sY + 16 * sc);
        ctx.lineTo(x + 14 * sc, sY + 22 * sc);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  private drawNewFeatures(f: Frame) {
    const { ctx, W, sY, sc, t, spot } = f;
    const feat = spot.feature;
    const r = rng(spot.seed * 13);
    // камыш и сваи лимана
    if (feat === "reeds" || feat === "stilts") {
      ctx.strokeStyle = "#5a5a30";
      ctx.lineCap = "round";
      const n = feat === "reeds" ? 26 : 10;
      for (let i = 0; i < n; i++) {
        const x = r() * W * (feat === "reeds" ? 0.2 : 0.14);
        const yb = this.bedY(x);
        ctx.lineWidth = (1.2 + r() * 1.4) * sc;
        ctx.beginPath();
        ctx.moveTo(x, sY);
        ctx.quadraticCurveTo(x + Math.sin(t * 0.6 + i) * 3, (sY + yb) / 2, x + Math.sin(t * 0.5 + i) * 2, yb + 2);
        ctx.stroke();
      }
    }
    if (feat === "stilts") {
      for (const hx of [0.58, 0.7, 0.86]) {
        for (const dx of [-16, -5, 6, 16]) {
          const x = W * hx + dx * sc * 1.3;
          const yb = this.bedY(x);
          ctx.fillStyle = "#3a2c1e";
          ctx.fillRect(x - 2 * sc, sY - 2, 4 * sc, yb - sY + 6);
          ctx.fillStyle = "#4e5a3a";
          for (let y = sY + 6; y < yb; y += 9) ctx.fillRect(x - 3 * sc, y, 6 * sc, 3 * sc);
        }
      }
    }
    if (feat === "channel") {
      for (const bx of [0.35, 0.57, 0.79]) {
        const x = W * bx;
        const yb = this.bedY(x);
        ctx.strokeStyle = "rgba(90,80,70,0.8)";
        ctx.lineWidth = 1.2;
        ctx.setLineDash([3, 2]);
        ctx.beginPath();
        ctx.moveTo(x, sY + 2);
        ctx.quadraticCurveTo(x + 10 + Math.sin(t * 0.8 + bx * 10) * 6, (sY + yb) / 2, x + 4, yb - 6 * sc);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "#4a4640";
        ctx.fillRect(x - 6 * sc, yb - 8 * sc, 14 * sc, 9 * sc);
      }
    }
    // гигантская ламинария
    if (feat === "kelpforest" || feat === "otters" || feat === "canyon") {
      const n = feat === "kelpforest" ? 16 : feat === "otters" ? 9 : 6;
      for (let i = 0; i < n; i++) {
        const x = feat === "canyon" ? r() * W * 0.45 : r() * W;
        const yb = this.bedY(x);
        const top = sY + 3;
        if (yb - top < 20) continue;
        const segs = 16;
        const phase = r() * 10;
        const pts: [number, number][] = [];
        for (let k = 0; k <= segs; k++) {
          const q = k / segs;
          pts.push([x + Math.sin(t * 0.45 + phase + q * 3) * 14 * q * sc + q * 18 * sc, yb - (yb - top) * q]);
        }
        ctx.strokeStyle = "#6a5a24";
        ctx.lineWidth = 2.2 * sc;
        ctx.beginPath();
        pts.forEach(([px, py], k) => (k ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
        ctx.stroke();
        for (let k = 1; k < segs; k++) {
          const [px, py] = pts[k];
          const side = k % 2 ? 1 : -1;
          const sw = Math.sin(t * 0.8 + phase + k) * 0.25;
          ctx.fillStyle = k % 3 ? "#8a6a2a" : "#7a5e22";
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(side * (0.9 + sw) - Math.PI / 2);
          ctx.beginPath();
          ctx.ellipse(0, -10 * sc, 3 * sc, 11 * sc, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          ctx.fillStyle = "#a88a3a";
          ctx.beginPath();
          ctx.arc(px + side * 2 * sc, py, 1.6 * sc, 0, Math.PI * 2);
          ctx.fill();
        }
        // полог у поверхности
        ctx.fillStyle = "rgba(122,94,34,0.8)";
        for (let k = 0; k < 4; k++) {
          ctx.beginPath();
          ctx.ellipse(pts[segs][0] + (k - 1.5) * 9 * sc + Math.sin(t * 0.5 + k + phase) * 3, top + 2 + k % 2, 11 * sc, 2.5 * sc, 0.1, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    // корни мангров под водой
    if (feat === "roots" || feat === "creek" || feat === "flats") {
      const sides = feat === "creek" ? [0, 1] : [0];
      for (const side of sides) {
        const n = feat === "flats" ? 5 : 14;
        for (let i = 0; i < n; i++) {
          const x0 = side ? W * (0.84 + r() * 0.16) : r() * W * (feat === "flats" ? 0.1 : 0.2);
          const x1 = x0 + (side ? -1 : 1) * (10 + r() * 50) * sc;
          const yb = this.bedY(x1);
          ctx.strokeStyle = "#3e3024";
          ctx.lineWidth = (2 + r() * 2.5) * sc;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(x0, sY - 4);
          ctx.quadraticCurveTo(x0 + (x1 - x0) * 0.2, (sY + yb) * 0.5, x1, yb + 4);
          ctx.stroke();
          ctx.fillStyle = "#8a8070";
          for (let k = 0; k < 4; k++) {
            const q = 0.2 + k * 0.15;
            ctx.beginPath();
            ctx.ellipse(x0 + (x1 - x0) * q * q + (x1 - x0) * 0.1, sY + (yb - sY) * q, 2 * sc, 1.4 * sc, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }
    // пузыри из кальдеры
    if (feat === "caldera" || feat === "lava") {
      for (let i = 0; i < 4; i++) {
        const x = W * (0.45 + i * 0.1);
        const yb = this.bedY(x);
        for (let k = 0; k < 10; k++) {
          const p = (t * 0.25 + k / 10 + i * 0.3) % 1;
          ctx.strokeStyle = `rgba(230,240,245,${0.5 * (1 - p)})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(x + Math.sin(p * 12 + i) * 5, yb - p * Math.min(260 * sc, yb - sY), 1.5 + p * 2.5, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      if (feat === "lava") {
        const x = W * 0.38, yb = this.bedY(x);
        ctx.fillStyle = "#1a1210";
        for (let k = 0; k < 6; k++) {
          ctx.beginPath();
          ctx.ellipse(x + (k - 3) * 14 * sc, yb - (k % 2) * 8 * sc, 12 * sc, 8 * sc, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    // подводные части льда
    if (feat === "icebergs" || feat === "iceedge") {
      const x = feat === "icebergs" ? W * 0.87 : W * 0.72;
      const w = (feat === "icebergs" ? 170 : W * 0.6) * sc;
      const depth = (feat === "icebergs" ? 300 : 520) * sc;
      const g = ctx.createLinearGradient(0, sY, 0, sY + depth);
      g.addColorStop(0, "rgba(200,232,244,0.75)");
      g.addColorStop(1, "rgba(120,180,210,0.35)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x - w * 0.55, sY);
      ctx.bezierCurveTo(x - w * 0.8, sY + depth * 0.4, x - w * 0.3, sY + depth * 0.9, x - w * 0.05, sY + depth);
      ctx.bezierCurveTo(x + w * 0.3, sY + depth * 0.85, x + w * 0.7, sY + depth * 0.5, x + w * 0.62, sY);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.lineWidth = 1;
      for (let k = 1; k < 6; k++) {
        ctx.beginPath();
        ctx.moveTo(x - w * 0.4 + k * w * 0.14, sY + 4);
        ctx.lineTo(x - w * 0.35 + k * w * 0.11, sY + depth * (0.4 + (k % 3) * 0.15));
        ctx.stroke();
      }
    }
    if (feat === "polynya") {
      for (const [a, b] of [[0, 0.28], [0.8, 1.02]]) {
        const x0 = W * a, x1 = W * b;
        ctx.fillStyle = "rgba(214,236,246,0.92)";
        ctx.beginPath();
        ctx.moveTo(x0, sY - 3);
        ctx.lineTo(x1, sY - 3);
        for (let x = x1; x >= x0; x -= 8) ctx.lineTo(x, sY + (10 + Math.sin(x * 0.07) * 4 + hash1(x) * 6) * sc);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "rgba(160,200,220,0.5)";
        for (let x = x0; x < x1; x += 13) ctx.fillRect(x, sY + (12 + hash1(x * 2) * 8) * sc, 3, (4 + hash1(x) * 10) * sc);
      }
    }
  }

  private drawWreck(f: Frame, cx: number) {
    const { ctx, sc } = f;
    const y = this.bedY(cx) + 6 * sc;
    const L = 280 * sc, Hh = 70 * sc;
    ctx.save();
    ctx.translate(cx, y);
    ctx.rotate(-0.12);
    const hull = () => {
      ctx.beginPath();
      ctx.moveTo(-L / 2, -Hh);
      ctx.lineTo(L * 0.28, -Hh * 0.85);
      ctx.lineTo(L * 0.34, -Hh * 0.55);
      ctx.lineTo(L * 0.5, -Hh * 0.95);
      ctx.quadraticCurveTo(L * 0.42, 0, L * 0.18, Hh * 0.1);
      ctx.lineTo(-L * 0.4, Hh * 0.1);
      ctx.quadraticCurveTo(-L * 0.52, -Hh * 0.4, -L / 2, -Hh);
      ctx.closePath();
    };
    hull();
    const g = ctx.createLinearGradient(0, -Hh, 0, Hh * 0.1);
    g.addColorStop(0, "#6a5038");
    g.addColorStop(1, "#2a1e14");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.save();
    hull();
    ctx.clip();
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 1;
    for (let k = 1; k < 7; k++) {
      ctx.beginPath();
      ctx.moveTo(-L / 2, -Hh + k * Hh * 0.16);
      ctx.lineTo(L / 2, -Hh + k * Hh * 0.16 - 3);
      ctx.stroke();
    }
    ctx.fillStyle = "#0e0a08";
    ctx.beginPath();
    ctx.moveTo(L * 0.05, -Hh * 0.6);
    ctx.lineTo(L * 0.2, -Hh * 0.7);
    ctx.lineTo(L * 0.18, -Hh * 0.2);
    ctx.lineTo(L * 0.08, -Hh * 0.25);
    ctx.fill();
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.arc(-L * 0.38 + i * L * 0.075, -Hh * 0.55, 4 * sc, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = "#3e2e20";
    ctx.lineWidth = 6 * sc;
    ctx.beginPath();
    ctx.moveTo(-L * 0.1, -Hh);
    ctx.lineTo(-L * 0.18, -Hh * 2.7);
    ctx.moveTo(L * 0.2, -Hh * 0.9);
    ctx.lineTo(L * 0.34, -Hh * 1.9);
    ctx.stroke();
    ctx.lineWidth = 3 * sc;
    ctx.beginPath();
    ctx.moveTo(-L * 0.28, -Hh * 2.2);
    ctx.lineTo(-L * 0.04, -Hh * 2.3);
    ctx.stroke();
    ctx.strokeStyle = "rgba(200,190,160,0.25)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-L * 0.18, -Hh * 2.7);
    ctx.lineTo(-L * 0.45, -Hh);
    ctx.moveTo(-L * 0.18, -Hh * 2.7);
    ctx.lineTo(L * 0.1, -Hh * 0.95);
    ctx.stroke();
    ctx.fillStyle = "#5a8a4a";
    for (let i = 0; i < 16; i++) {
      const x = -L / 2 + (i / 15) * L * 0.95;
      ctx.beginPath();
      ctx.ellipse(x, -Hh * (0.95 - (i % 3) * 0.02), 5 * sc, 3 * sc, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawSkeleton(f: Frame, cx: number) {
    const { ctx, sc } = f;
    const y = this.bedY(cx) - 4;
    ctx.strokeStyle = "#d8d0c0";
    ctx.fillStyle = "#d8d0c0";
    ctx.lineCap = "round";
    ctx.lineWidth = 4 * sc;
    ctx.beginPath();
    ctx.moveTo(cx - 120 * sc, y);
    ctx.quadraticCurveTo(cx, y - 8 * sc, cx + 110 * sc, y + 2);
    ctx.stroke();
    ctx.lineWidth = 2.4 * sc;
    for (let i = 0; i < 14; i++) {
      const x = cx - 80 * sc + i * 11 * sc;
      const h = (26 - Math.abs(i - 5) * 2.2) * sc;
      ctx.beginPath();
      ctx.moveTo(x, y - 4 * sc);
      ctx.quadraticCurveTo(x + 8 * sc, y - h, x + 3 * sc, y - h * 1.3);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.ellipse(cx + 130 * sc, y - 6 * sc, 26 * sc, 9 * sc, -0.15, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawDecor(f: Frame, d: Decor) {
    const { ctx, t } = f;
    const s = d.s * f.sc;
    const sway = Math.sin(t * 0.8 + d.seed) * 6 * s;
    ctx.save();
    ctx.translate(d.x, d.y + 2);
    switch (d.kind) {
      case "grass":
        ctx.strokeStyle = "#5a9a4a";
        ctx.lineWidth = 2;
        for (let i = 0; i < 6; i++) {
          ctx.beginPath();
          ctx.moveTo(i * 3 - 8, 0);
          ctx.quadraticCurveTo(i * 3 - 8 + sway * 0.4, -14 * s, i * 3 - 8 + sway, -(18 + (i % 3) * 7) * s);
          ctx.stroke();
        }
        break;
      case "kelp": {
        const hgt = (90 + d.seed * 1.5) * s;
        ctx.strokeStyle = "#6a7a2a";
        ctx.lineWidth = 3 * s;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        const pts: [number, number][] = [];
        for (let k = 1; k <= 12; k++) {
          const p: [number, number] = [Math.sin(t * 0.6 + d.seed + k * 0.45) * k * 1.8 * s, -hgt * (k / 12)];
          pts.push(p);
          ctx.lineTo(p[0], p[1]);
        }
        ctx.stroke();
        ctx.fillStyle = "#7c8c32";
        pts.forEach(([lx, ly], k) => {
          if (k % 2) return;
          ctx.beginPath();
          ctx.ellipse(lx + 8 * s, ly, 11 * s, 3.5 * s, 0.5 + Math.sin(t + k) * 0.25, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.ellipse(lx - 7 * s, ly - 6 * s, 9 * s, 3 * s, -0.5 + Math.sin(t + k) * 0.25, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.fillStyle = "#b0a040";
        ctx.beginPath();
        ctx.arc(pts[11][0], pts[11][1], 3 * s, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "shell":
        ctx.fillStyle = "#f0dccc";
        ctx.beginPath();
        ctx.arc(0, -1, 4.5 * s, Math.PI, 0);
        ctx.fill();
        ctx.strokeStyle = "rgba(150,110,90,0.6)";
        ctx.lineWidth = 0.7;
        for (let i = -2; i <= 2; i++) {
          ctx.beginPath();
          ctx.moveTo(0, -1);
          ctx.lineTo(i * 2 * s, -4.5 * s);
          ctx.stroke();
        }
        break;
      case "star":
        ctx.fillStyle = "#e8703c";
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? 2.5 * s : 8 * s;
          ctx.lineTo(Math.cos(a) * rr, -3 + Math.sin(a) * rr * 0.45);
        }
        ctx.fill();
        break;
      case "brittle":
        ctx.strokeStyle = "#c89078";
        ctx.lineWidth = 1.2;
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 + d.seed;
          ctx.beginPath();
          ctx.moveTo(0, -2);
          ctx.quadraticCurveTo(Math.cos(a) * 6 * s, -2 + Math.sin(a) * 2 * s, Math.cos(a + 0.4) * 11 * s, -2 + Math.sin(a + 0.4) * 3 * s);
          ctx.stroke();
        }
        break;
      case "pebbles":
        ctx.fillStyle = "#9a8a70";
        for (let i = 0; i < 5; i++) {
          ctx.beginPath();
          ctx.ellipse((i - 2) * 5 * s, -1, 2.5 * s, 1.5 * s, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      case "rock":
      case "boulder": {
        const r = (d.kind === "rock" ? 8 : 22) * s;
        const g = ctx.createRadialGradient(-r * 0.4, -r * 0.9, r * 0.1, 0, -r * 0.3, r * 1.4);
        g.addColorStop(0, "#8e8880");
        g.addColorStop(1, "#3e3a36");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(-r * 1.3, 2);
        ctx.quadraticCurveTo(-r * 1.2, -r * 0.9, -r * 0.2, -r * 1.05);
        ctx.quadraticCurveTo(r * 1.1, -r * 1.0, r * 1.3, 2);
        ctx.closePath();
        ctx.fill();
        if (d.kind === "boulder") {
          ctx.fillStyle = "#5a7a4a";
          ctx.beginPath();
          ctx.ellipse(-r * 0.3, -r * 0.95, r * 0.6, r * 0.18, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case "urchin":
        ctx.strokeStyle = "#3a1a3a";
        ctx.lineWidth = 1;
        for (let i = 0; i < 16; i++) {
          const a = Math.PI + (i / 15) * Math.PI;
          ctx.beginPath();
          ctx.moveTo(0, -4 * s);
          ctx.lineTo(Math.cos(a) * 11 * s, -4 * s + Math.sin(a) * 11 * s);
          ctx.stroke();
        }
        ctx.fillStyle = "#5a2a5a";
        ctx.beginPath();
        ctx.arc(0, -3 * s, 4.5 * s, Math.PI, 0);
        ctx.fill();
        break;
      case "coralB": {
        ctx.strokeStyle = d.c;
        ctx.lineCap = "round";
        const branch = (x: number, y: number, a: number, len: number, depth: number) => {
          if (depth <= 0) return;
          const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
          ctx.lineWidth = depth * 1.7 * s;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x2, y2);
          ctx.stroke();
          branch(x2, y2, a - 0.45, len * 0.74, depth - 1);
          branch(x2, y2, a + 0.42, len * 0.72, depth - 1);
        };
        branch(0, 0, -Math.PI / 2 + Math.sin(t * 0.5 + d.seed) * 0.03, 16 * s, 4);
        break;
      }
      case "coralF":
        ctx.fillStyle = hexA(d.c, 0.85);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(-32 * s, -30 * s, -14 * s + sway * 0.3, -50 * s);
        ctx.quadraticCurveTo(10 * s, -60 * s, 24 * s + sway * 0.3, -42 * s);
        ctx.quadraticCurveTo(28 * s, -16 * s, 0, 0);
        ctx.fill();
        ctx.strokeStyle = hexA(mix(d.c, "#000000", 0.3), 0.6);
        ctx.lineWidth = 0.8;
        for (let i = 0; i < 7; i++) {
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(-14 * s + i * 6 * s + sway * 0.3, -48 * s + Math.abs(i - 3) * 4 * s);
          ctx.stroke();
        }
        break;
      case "table":
        ctx.fillStyle = mix(d.c, "#d8c8a0", 0.5);
        ctx.fillRect(-2 * s, -14 * s, 4 * s, 14 * s);
        ctx.beginPath();
        ctx.ellipse(0, -15 * s, 22 * s, 4 * s, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      case "tube":
        for (let i = 0; i < 4; i++) {
          ctx.fillStyle = mix(d.c, "#ffffff", i * 0.1);
          const h = (14 + i * 7) * s;
          ctx.fillRect(-8 * s + i * 5 * s, -h, 4 * s, h);
          ctx.fillStyle = mix(d.c, "#000000", 0.4);
          ctx.beginPath();
          ctx.ellipse(-6 * s + i * 5 * s, -h, 2 * s, 1 * s, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      case "sponge":
        ctx.fillStyle = "#c8a040";
        ctx.beginPath();
        ctx.moveTo(-7 * s, 0);
        ctx.lineTo(-9 * s, -20 * s);
        ctx.quadraticCurveTo(0, -24 * s, 9 * s, -20 * s);
        ctx.lineTo(7 * s, 0);
        ctx.fill();
        ctx.fillStyle = "#6a4a18";
        ctx.beginPath();
        ctx.ellipse(0, -20 * s, 7 * s, 2 * s, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      case "glassSponge":
        ctx.strokeStyle = "rgba(230,225,210,0.7)";
        ctx.lineWidth = 1;
        for (let i = 0; i < 5; i++) {
          ctx.beginPath();
          ctx.moveTo(-6 * s + i * 3 * s, 0);
          ctx.quadraticCurveTo(-10 * s + i * 5 * s, -20 * s, -5 * s + i * 2.5 * s, -34 * s);
          ctx.stroke();
        }
        break;
      case "lophelia": {
        ctx.strokeStyle = d.c;
        ctx.lineCap = "round";
        const br = (x: number, y: number, a: number, len: number, dp: number) => {
          if (dp <= 0) return;
          const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
          ctx.lineWidth = 1.4 * s;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x2, y2);
          ctx.stroke();
          br(x2, y2, a - 0.6, len * 0.8, dp - 1);
          br(x2, y2, a + 0.5, len * 0.8, dp - 1);
        };
        br(0, 0, -Math.PI / 2, 9 * s, 5);
        break;
      }
      case "anemone":
      case "anemoneClown": {
        const col = d.kind === "anemoneClown" ? "#d890ff" : d.c;
        ctx.fillStyle = mix(col, "#000000", 0.35);
        ctx.fillRect(-5 * s, -6 * s, 10 * s, 6 * s);
        ctx.strokeStyle = col;
        ctx.lineWidth = 2.6 * s;
        ctx.lineCap = "round";
        for (let i = 0; i < 12; i++) {
          const a = -Math.PI / 2 + (i - 5.5) * 0.22;
          ctx.beginPath();
          ctx.moveTo(0, -6 * s);
          ctx.quadraticCurveTo(Math.cos(a) * 10 * s + sway * 0.4, -6 * s + Math.sin(a) * 10 * s, Math.cos(a) * 17 * s + sway, -6 * s + Math.sin(a) * 19 * s);
          ctx.stroke();
        }
        if (d.kind === "anemoneClown") {
          for (let k = 0; k < 2; k++) {
            const a = t * (1.2 + k * 0.4) + d.seed + k * 3;
            const fx = Math.cos(a) * 16 * s, fy = -20 * s + Math.sin(a * 1.3) * 6 * s;
            const dir = Math.sin(a) < 0 ? 1 : -1;
            ctx.save();
            ctx.translate(fx, fy);
            ctx.scale(dir, 1);
            ctx.fillStyle = "#ff7a20";
            ctx.beginPath();
            ctx.ellipse(0, 0, 5 * s, 2.8 * s, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(-4 * s, 0);
            ctx.lineTo(-7.5 * s, -2.5 * s);
            ctx.lineTo(-7.5 * s, 2.5 * s);
            ctx.fill();
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(1 * s, -2.6 * s, 1.3 * s, 5.2 * s);
            ctx.fillRect(-2.5 * s, -2.4 * s, 1.2 * s, 4.8 * s);
            ctx.restore();
          }
        }
        break;
      }
      case "brain":
        ctx.fillStyle = "#d0a860";
        ctx.beginPath();
        ctx.ellipse(0, -6 * s, 17 * s, 11 * s, 0, Math.PI, 0);
        ctx.fill();
        ctx.strokeStyle = "#8a6a30";
        ctx.lineWidth = 1;
        for (let i = -2; i <= 2; i++) {
          ctx.beginPath();
          ctx.arc(i * 5 * s, -4 * s, 5 * s, Math.PI, 0);
          ctx.stroke();
        }
        break;
      case "pen":
        ctx.strokeStyle = "#d89880";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(sway * 0.3, -28 * s);
        ctx.stroke();
        for (let i = 0; i < 7; i++) {
          ctx.beginPath();
          ctx.moveTo(sway * 0.04 * i, -8 * s - i * 3 * s);
          ctx.lineTo(sway * 0.04 * i + 6 * s, -12 * s - i * 3 * s);
          ctx.moveTo(sway * 0.04 * i, -8 * s - i * 3 * s);
          ctx.lineTo(sway * 0.04 * i - 6 * s, -12 * s - i * 3 * s);
          ctx.stroke();
        }
        break;
      case "cucumber":
        ctx.fillStyle = "#b86a6a";
        ctx.beginPath();
        ctx.ellipse(0, -3 * s, 10 * s, 3.5 * s, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      case "vent": {
        ctx.fillStyle = "#16100e";
        ctx.beginPath();
        ctx.moveTo(-16 * s, 0);
        ctx.lineTo(-7 * s, -60 * s);
        ctx.lineTo(-3 * s, -64 * s);
        ctx.lineTo(6 * s, -62 * s);
        ctx.lineTo(16 * s, 0);
        ctx.fill();
        ctx.fillStyle = "rgba(30,24,22,0.5)";
        for (let i = 0; i < 9; i++) {
          const p = (t * 0.28 + i / 9 + d.seed) % 1;
          ctx.beginPath();
          ctx.arc(Math.sin(p * 6 + d.seed) * 12 * p, -64 * s - p * 110 * s, (6 + p * 26) * s, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case "worms":
        for (let i = 0; i < 7; i++) {
          const x = (i - 3) * 4 * s, h = (16 + ((i * 7) % 11)) * s;
          ctx.strokeStyle = "#ece4dc";
          ctx.lineWidth = 2.6 * s;
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x + sway * 0.2, -h);
          ctx.stroke();
          ctx.fillStyle = "#e82838";
          ctx.beginPath();
          ctx.arc(x + sway * 0.2, -h, 2.8 * s, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      case "seagrass":
        ctx.strokeStyle = "#4a7a3a";
        ctx.lineWidth = 1.8;
        for (let i = 0; i < 7; i++) {
          ctx.beginPath();
          ctx.moveTo(i * 2.5 - 8, 0);
          ctx.quadraticCurveTo(i * 2.5 - 8 + sway * 0.5, -12 * s, i * 2.5 - 8 + sway * 1.2, -(22 + (i % 4) * 6) * s);
          ctx.stroke();
        }
        break;
      case "reedstub":
        ctx.strokeStyle = "#6a5a34";
        ctx.lineWidth = 1.6;
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.moveTo(i * 4 - 6, 0);
          ctx.lineTo(i * 4 - 6 + sway * 0.1, -(6 + i * 2) * s);
          ctx.stroke();
        }
        break;
      case "mussels":
        ctx.fillStyle = "#1e2230";
        for (let i = 0; i < 7; i++) {
          ctx.beginPath();
          ctx.ellipse((i - 3) * 3.5 * s, -2 - (i % 2) * 2 * s, 3 * s, 1.6 * s, 0.4 * (i % 3 - 1), 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      case "wrack":
        ctx.strokeStyle = "#6a5a22";
        ctx.lineWidth = 2.2 * s;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(i * 4 - 4, 0);
          ctx.bezierCurveTo(i * 4 - 8 + sway * 0.3, -8 * s, i * 4 + sway * 0.6, -14 * s, i * 4 - 4 + sway, -(18 + i * 3) * s);
          ctx.stroke();
          ctx.fillStyle = "#8a7a2e";
          ctx.beginPath();
          ctx.arc(i * 4 - 4 + sway, -(18 + i * 3) * s, 2 * s, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      case "basalt": {
        const n = 3 + Math.floor(d.seed % 3);
        for (let i = 0; i < n; i++) {
          const h = (16 + ((d.seed * (i + 3)) % 22)) * s;
          const x = (i - n / 2) * 7 * s;
          ctx.fillStyle = i % 2 ? "#2a2626" : "#343030";
          ctx.fillRect(x, -h, 6.5 * s, h + 2);
          ctx.fillStyle = "#4a4442";
          ctx.fillRect(x, -h, 6.5 * s, 1.6 * s);
        }
        break;
      }
      case "lavarock":
        ctx.fillStyle = "#1e1a1a";
        ctx.beginPath();
        ctx.moveTo(-14 * s, 2);
        ctx.quadraticCurveTo(-12 * s, -12 * s, 0, -13 * s);
        ctx.quadraticCurveTo(14 * s, -10 * s, 15 * s, 2);
        ctx.fill();
        ctx.fillStyle = "rgba(90,60,50,0.6)";
        for (let i = 0; i < 5; i++) ctx.fillRect((i - 2.5) * 5 * s, -6 * s - (i % 2) * 3 * s, 2 * s, 2 * s);
        break;
      case "seaspider":
        ctx.strokeStyle = "#c86a4a";
        ctx.lineWidth = 1;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + Math.sin(t + d.seed) * 0.1;
          ctx.beginPath();
          ctx.moveTo(0, -4 * s);
          ctx.lineTo(Math.cos(a) * 8 * s, -4 * s + Math.sin(a) * 3 * s - 4 * s);
          ctx.lineTo(Math.cos(a) * 12 * s, 0);
          ctx.stroke();
        }
        break;
      case "icesponge":
        ctx.fillStyle = "#e8e0c8";
        ctx.beginPath();
        ctx.moveTo(-8 * s, 0);
        ctx.quadraticCurveTo(-12 * s, -18 * s, -4 * s, -26 * s);
        ctx.lineTo(4 * s, -26 * s);
        ctx.quadraticCurveTo(12 * s, -18 * s, 8 * s, 0);
        ctx.fill();
        ctx.fillStyle = "#8a826a";
        ctx.beginPath();
        ctx.ellipse(0, -26 * s, 4 * s, 1.5 * s, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      case "anchor":
        ctx.strokeStyle = "#4a3a30";
        ctx.lineWidth = 4 * s;
        ctx.lineCap = "round";
        ctx.rotate(0.5);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -40 * s);
        ctx.moveTo(-10 * s, -34 * s);
        ctx.lineTo(10 * s, -34 * s);
        ctx.moveTo(-16 * s, -8 * s);
        ctx.quadraticCurveTo(0, 8 * s, 16 * s, -8 * s);
        ctx.stroke();
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, -44 * s, 4 * s, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case "amphora":
        ctx.rotate(1.2 + d.seed * 0.01);
        ctx.fillStyle = d.c;
        ctx.beginPath();
        ctx.moveTo(-3 * s, -24 * s);
        ctx.quadraticCurveTo(-12 * s, -12 * s, -5 * s, 0);
        ctx.lineTo(5 * s, 0);
        ctx.quadraticCurveTo(12 * s, -12 * s, 3 * s, -24 * s);
        ctx.fill();
        break;
    }
    ctx.restore();
  }

  /** Самосвечение дна (после затемнения глубиной) */
  drawGlow(f: Frame) {
    const { ctx, t, W, cam, H } = f;
    if (this.minY - 200 > cam + H) return;
    for (const d of this.decor) {
      if (d.y < cam - 100 || d.y > cam + H + 100) continue;
      const s = d.s * f.sc;
      if (d.kind === "vent") glow(ctx, d.x, d.y - 24 * s, 6 * s, "#ff6a20", 0.8 + Math.sin(t * 3 + d.seed) * 0.2);
      if (d.kind === "worms" && f.spot.maxDepth > 500) glow(ctx, d.x, d.y - 10 * s, 3 * s, "#ff4050", 0.35);
      if (d.kind === "pen" && f.spot.maxDepth > 300) glow(ctx, d.x, d.y - 20 * s, 3 * s, "#80a0ff", 0.4 + Math.sin(t * 2 + d.seed) * 0.3);
    }
    if (f.spot.feature === "trench" || f.spot.feature === "vents" || f.spot.feature === "twilight") {
      const r = rng(3);
      for (let i = 0; i < 40; i++) {
        const x = r() * W;
        const y = this.bedY(x) - r() * 300 * f.sc;
        const a = Math.max(0, Math.sin(t * (0.5 + r()) + i * 1.7));
        if (a > 0.1) glow(ctx, x, y, 1.2, i % 3 ? "#50e0ff" : "#80ffb0", a * 0.7);
      }
    }
  }
}
