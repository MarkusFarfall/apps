import { depthToU, JUMP_TIME, type Engine, type SonarBand } from "../engine";
import { FISH } from "../fish";
import { drawFish, drawFishGlow, fishScreenLen } from "../fishDraw";
import type { FishDef } from "../types";
import { BAIT_BY_ID, WEATHER_INFO } from "../world";
import { drawBoat } from "./boat";
import type { Frame } from "./frame";
import { drawBobberPointer, drawFightPanel, drawPower, drawRuler, drawSonar } from "./hud";
import { LandRenderer } from "./land";
import { AmbientLife } from "./ambient";
import { SeabedRenderer } from "./seabed";
import { CLOUD_COVER, SkyRenderer, skyAt, WEATHER_TINT } from "./sky";
import { clamp, glow, hexA, mix, rng, smooth, af } from "./util";
import {
  drawDepthOverlay,
  drawSeaBand,
  drawShafts,
  drawSurfaceCaustics,
  drawSurfaceFront,
  drawUnderwaterBody,
  seaSurfaceColor,
  type Ring,
} from "./water";

interface Ambient { f: FishDef; x: number; depth: number; dir: 1 | -1; speed: number; len: number; phase: number; known: boolean }
interface Creature { kind: "jelly" | "turtle" | "crab"; x: number; y: number; vx: number; vy: number; s: number; phase: number; hue: string }
interface Bubble { x: number; y: number; r: number; v: number }
interface Drop { x: number; y: number; v: number; l: number }
interface Spray { x: number; y: number; vx: number; vy: number; t: number }


interface School { x: number; depth: number; dir: 1 | -1; n: number; speed: number; phase: number; seed: number; col: string; size: number }

export type CamMode = "auto" | "surface" | "hook" | "bottom";
export const CAM_MODES: CamMode[] = ["auto", "surface", "hook", "bottom"];

export class Scene {
  camY = 0;
  camMode: CamMode = "auto";
  /** Режим перехода: скорость хода в px/с (null — обычная рыбалка) */
  voyage: number | null = null;
  private flow = 0;
  quality = 2;
  private schools: School[] = [];
  private schoolT = 3;
  private sky = new SkyRenderer();
  private land = new LandRenderer();
  private life = new AmbientLife();
  private bed = new SeabedRenderer();
  private ambient: Ambient[] = [];
  private creatures: Creature[] = [];
  private bubbles: Bubble[] = [];
  private sprays: Spray[] = [];
  private rings: Ring[] = [];
  private drops: Drop[] = [];
  private flakes: Drop[] = [];
  private snow: [number, number, number][] = [];
  private spawnT = 0;
  private creatureT = 0;
  private t = 0;
  private W = 0;
  private H = 0;
  private initQuality = -1;
  private spotKey = "";
  private bolt: [number, number][] = [];
  private lastLightning = 0;
  private sonar: SonarBand[] = [];
  private sonarT = 0;
  private whaleX = -500;

  private init(W: number, H: number) {
    if (W === this.W && H === this.H && this.initQuality === this.quality) return;
    this.W = W;
    this.H = H;
    this.initQuality = this.quality;
    const r = rng(9);
    const rainN = this.quality >= 2 ? 520 : this.quality === 1 ? 320 : 160;
    const flakeN = this.quality >= 2 ? 280 : this.quality === 1 ? 170 : 90;
    const snowN = this.quality >= 2 ? 130 : this.quality === 1 ? 80 : 45;
    this.drops = Array.from({ length: rainN }, () => ({ x: r() * W, y: r() * H, v: 750 + r() * 500, l: 10 + r() * 18 }));
    this.flakes = Array.from({ length: flakeN }, () => ({ x: r() * W, y: r() * H, v: 30 + r() * 50, l: 0.8 + r() * 2.4 }));
    this.snow = Array.from({ length: snowN }, () => [r() * W, r() * 3000, 0.5 + r() * 1.6]);
  }

  render(ctx: CanvasRenderingContext2D, e: Engine, W: number, H: number, dt: number) {
    this.init(W, H);
    this.t += dt;
    const t = this.t;
    const loc = e.loc, spot = e.spot;
    if (this.spotKey !== spot.id) {
      this.spotKey = spot.id;
      this.ambient = [];
      this.creatures = [];
      this.schools = [];
      this.sonarT = 0;
    }
    const hour = e.hour;
    const weather = e.s.weather;
    const winfo = WEATHER_INFO[weather];
    const cover = CLOUD_COVER[weather];
    const fogK = weather === "fog" ? 1 : weather === "snow" ? 0.35 : weather === "rain" ? 0.25 : weather === "storm" ? 0.3 : 0;

    const sunA = (hour - 5.4) / 14.8;
    const sunElev = Math.sin(clamp(sunA, -0.1, 1.1) * Math.PI);
    const day = clamp(sunElev * 1.6, 0, 1) * (1 - WEATHER_TINT[weather][1] * 0.45);
    const night = 1 - clamp(sunElev * 3 + 0.12, 0, 1);
    const golden = clamp(1 - Math.abs(sunElev - 0.1) / 0.22, 0, 1) * (1 - cover * 0.5);

    const sY = H * 0.46;
    const hY = sY - H * 0.095;
    const K = H * 0.42;
    const sc = clamp(Math.min(H / 900, W / 1150), 0.5, 1.25);
    const compact = W < 820 || H < 560, land = W >= H;
    const calm = e.activeEvents.some((a) => a.id === "calm");
    const amp = (3.2 * winfo.wave * loc.waveMult * (spot.swell ?? 1) * (calm ? 0.25 : 1) + 1) * sc;

    const [top0, mid0, hor0] = skyAt(hour);
    const [tint, tAmt] = WEATHER_TINT[weather];
    const tintC = mix(tint, "#05080f", night * 0.85);
    const top = mix(top0, tintC, tAmt), mid = mix(mid0, tintC, tAmt), hor = mix(hor0, tintC, tAmt * 0.85);

    const sunX = W * (0.08 + 0.84 * clamp(sunA, -0.05, 1.05));
    const sunY = hY - sunElev * H * 0.34;
    const sunVis = clamp(1 - cover * 0.85, 0.05, 1) * (1 - fogK * 0.6) * clamp((sunElev + 0.08) * 5, 0, 1);
    const mh = (hour - 19.2 + 24) % 24;
    const moonUp = mh < 11;
    const ma = mh / 11;
    const moonX = W * (0.9 - 0.8 * ma), moonY = hY - Math.sin(ma * Math.PI) * H * 0.3;
    const moonVis = (1 - cover * 0.75) * clamp(night * 1.4, 0.12, 1) * (1 - fogK * 0.5);

    if (this.voyage) this.flow += this.voyage * dt;
    const fl = this.flow;
    const waveY = (xx: number) => { const x = xx + fl; return sY + amp * (Math.sin(x * 0.011 + t * 1.25) * 0.55 + Math.sin(x * 0.027 - t * 1.9) * 0.28 + Math.sin(x * 0.0045 + t * 0.55) * 0.9); };
    const depthPx = (m: number) => K * depthToU(m);

    // камера
    const inWater = ["sinking", "waiting", "bite", "fight"].includes(e.phase) && !(e.hooked && e.hooked.jump > 0);
    const hookY = sY + depthPx(e.hookDepth);
    const bedMaxPx = sY + depthPx(spot.maxDepth * 1.05);
    const topRes = W < 820 || H < 560 ? (W >= H ? 64 : 118) : 210;
    const maxCam = Math.max(0, bedMaxPx - H * 0.78);
    let target = 0;
    let speed = 2.2;
    switch (this.voyage ? "surface" : this.camMode) {
      case "surface":
        target = 0;
        break;
      case "hook":
        target = inWater ? hookY - H * 0.55 : 0;
        break;
      case "bottom":
        target = maxCam;
        break;
      default:
        target = inWater ? hookY - H * 0.55 : 0;
        // при поклёвке поплавок обязан быть в кадре
        if (e.phase === "bite") {
          target = Math.min(target, sY - topRes - 70);
          speed = 6;
        }
    }
    target = clamp(target, 0, maxCam);
    this.camY += (target - this.camY) * Math.min(1, dt * speed);
    const cam = this.camY;

    const f: Frame = {
      ctx, e, loc, spot, weather, W, H, t, dt, sY, hY, cam, K, sc, night, day, golden, cover, fogK, top, mid, hor,
      sunX, sunY, sunElev, sunVis, moonX, moonY, moonUp, moonVis, amp, wind: this.voyage ? Math.min(3, e.s.wind + this.voyage / 90) : e.s.wind, clarity: loc.clarity ?? 0.6, quality: this.quality, compact, land, topRes: compact ? (land ? 64 : 118) : 210, botRes: compact ? (land ? 70 : 146) : 150, depthPx, waveY,
    };

    const shake = e.shake * 4;
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    ctx.translate(shake ? (Math.random() - 0.5) * shake : 0, -cam + (shake ? (Math.random() - 0.5) * shake : 0));

    // ───── НАД ВОДОЙ ─────
    if (cam < sY + 30) {
      this.sky.draw(f);
      this.life.update(f);
      this.life.drawSky(f);
      this.land.drawAbove(f);
      drawSeaBand(f, () => { if (this.quality > 0) this.land.drawReflection(f, seaSurfaceColor(f)); });
      this.land.drawSea(f);
      if (!this.voyage) this.life.drawSea(f);
      this.land.drawDivers(f);
      this.drawSurfaceEvents(f);
    }

    // ───── ПОД ВОДОЙ ─────
    drawUnderwaterBody(f);
    this.bed.draw(f);
    this.drawWhale(f);
    this.updateSchools(f);
    this.updateCreatures(f);
    this.updateAmbient(f);
    const bobX = W * e.castNX();
    const fishPos = this.drawHooked(f, bobX, hookY, false);
    drawDepthOverlay(f);
    if (this.quality > 0) drawShafts(f);
    if (this.quality > 1) drawSurfaceCaustics(f);
    // светящийся проход
    this.bed.drawGlow(f);
    this.glowPass(f);
    this.drawHooked(f, bobX, hookY, true);
    const deepK = clamp((e.hookDepth - 30) / 250, 0, 1);
    if (inWater && deepK > 0) {
      const g = e.s.currentBait === "glow";
      const lr = (150 + deepK * 110) * sc;
      const lg = ctx.createRadialGradient(fishPos[0], fishPos[1], 0, fishPos[0], fishPos[1], lr);
      lg.addColorStop(0, g ? `rgba(80,255,210,${af(0.34 * deepK)})` : `rgba(255,236,190,${af(0.26 * deepK)})`);
      lg.addColorStop(0.45, g ? `rgba(60,200,180,${af(0.1 * deepK)})` : `rgba(200,190,160,${af(0.08 * deepK)})`);
      lg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = lg;
      ctx.fillRect(fishPos[0] - lr, fishPos[1] - lr, lr * 2, lr * 2);
      ctx.restore();
    }
    this.drawMarineSnow(f);
    this.drawBubbles(f);

    // ───── ПОВЕРХНОСТЬ ─────
    this.land.drawFront(f);
    const bx = W * 0.3;
    if (this.voyage) this.drawWake(f, bx);
    const tip = drawBoat(f, bx, this.voyage ? "helm" : "fish");
    if ((weather === "rain" || weather === "storm") && cam < sY + 40) {
      const n = weather === "storm" ? 40 : 18;
      for (let i = 0; i < n * dt * 10; i++) this.rings.push({ x: Math.random() * W, t: 0, s: 0.6 + Math.random() * 0.8 });
    }
    this.rings = this.rings.filter((r) => r.t < 0.7);
    drawSurfaceFront(f, this.rings);
    if (!this.voyage) {
      this.drawJump(f, bobX);
      this.drawLine(f, tip, bobX, hookY, fishPos);
    }
    this.drawSprays(f);

    if (!this.voyage && (e.phase === "idle" || e.phase === "charging")) {
      const dy = sY + depthPx(Math.min(e.s.targetDepth, e.maxDepth));
      ctx.save();
      ctx.setLineDash([6, 8]);
      ctx.strokeStyle = "rgba(255,230,150,0.5)";
      ctx.beginPath();
      ctx.moveTo(bx + 60, dy);
      ctx.lineTo(W - 70, dy);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(255,230,150,0.9)";
      ctx.font = "600 12px ui-sans-serif, system-ui";
      ctx.fillText(`${Math.min(e.s.targetDepth, e.maxDepth)} м`, bx + 64, dy - 6);
      ctx.restore();
    }
    ctx.restore();

    // ───── ЭКРАН ─────
    this.drawWeather(f);
    this.drawLightning(f);
    this.grade(f);
    if (!this.voyage) {
      drawRuler(f);
      drawBobberPointer(f);
    }
    this.sonarT -= dt;
    if (this.sonarT <= 0) {
      this.sonarT = 0.6;
      this.sonar = e.s.sonar > 0 ? e.sonarScan() : [];
    }
    drawSonar(f, this.sonar);
    drawPower(f);
    drawFightPanel(f);
    if (e.fade > 0) {
      ctx.fillStyle = `rgba(2,4,10,${smooth(clamp(e.fade, 0, 1))})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  private drawSurfaceEvents(f: Frame) {
    const { ctx, e, W, hY, t, night } = f;
    if (e.activeEvents.some((a) => a.id === "ghost_ship")) {
      const gx = W * 0.72 + Math.sin(t * 0.05) * 60;
      ctx.save();
      ctx.globalAlpha = 0.28 + Math.sin(t) * 0.08;
      ctx.fillStyle = "#c8e4ec";
      ctx.beginPath();
      ctx.moveTo(gx - 55, hY);
      ctx.lineTo(gx + 55, hY);
      ctx.lineTo(gx + 44, hY + 9);
      ctx.lineTo(gx - 48, hY + 9);
      ctx.fill();
      for (let m = -1; m <= 1; m++) {
        ctx.fillRect(gx + m * 26, hY - 62, 2, 62);
        ctx.beginPath();
        ctx.moveTo(gx + m * 26 + 2, hY - 56);
        ctx.quadraticCurveTo(gx + m * 26 + 20 + Math.sin(t + m) * 3, hY - 38, gx + m * 26 + 2, hY - 12);
        ctx.fill();
      }
      glow(ctx, gx - 40, hY - 4, 2, "#80ffd0", 0.7);
      ctx.restore();
    }
    if (e.activeEvents.some((a) => a.id === "whale")) {
      const wx = W * 0.82;
      const p = (t % 7) / 7;
      if (p < 0.3) {
        ctx.fillStyle = `rgba(255,255,255,${0.6 * (1 - p / 0.3)})`;
        for (let i = 0; i < 14; i++) {
          ctx.beginPath();
          ctx.arc(wx + Math.sin(i) * 8 * p * 5, hY + 5 - p * 130 * (i / 14), 3 + p * 9, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.fillStyle = mix("#1a2430", f.hor, 0.3);
      ctx.beginPath();
      ctx.ellipse(wx, hY + 7, 32, 5, 0, Math.PI, 0);
      ctx.fill();
    }
    if (e.activeEvents.some((a) => a.id === "dolphins")) {
      for (let i = 0; i < 3; i++) {
        const p = ((t * 0.35 + i * 0.3) % 1.6);
        if (p > 1) continue;
        const dx = W * (0.45 + i * 0.1) + p * 60;
        const dy = hY + (f.sY - hY) * 0.6 - Math.sin(p * Math.PI) * 22;
        ctx.save();
        ctx.translate(dx, dy);
        ctx.rotate(-Math.cos(p * Math.PI) * 0.8);
        ctx.fillStyle = mix("#3a4a5a", "#05080f", night * 0.7);
        ctx.beginPath();
        ctx.ellipse(0, 0, 14, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-2, -3);
        ctx.lineTo(-6, -9);
        ctx.lineTo(3, -3);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  /** Кильватер и бурун при переходе */
  private drawWake(f: Frame, bx: number) {
    const { ctx, W, t, sc, night } = f;
    const sp = this.voyage ?? 0;
    const fast = sp > 150;
    const len = W * (fast ? 0.55 : 0.32);
    const stern = bx - (60 + f.e.boat.tier * 18) * sc;
    const bow = bx + (60 + f.e.boat.tier * 20) * sc;
    const a = 0.55 * (1 - night * 0.4);
    // две расходящиеся пенные полосы
    for (let side = -1; side <= 1; side += 2) {
      ctx.beginPath();
      for (let i = 0; i <= 40; i++) {
        const q = i / 40;
        const x = stern - q * len;
        const y = f.waveY(x) + side * q * (fast ? 8 : 5) * sc + 1;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      const g = ctx.createLinearGradient(stern, 0, stern - len, 0);
      g.addColorStop(0, `rgba(255,255,255,${a.toFixed(3)})`);
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.strokeStyle = g;
      ctx.lineWidth = (fast ? 3 : 2) * sc;
      ctx.stroke();
    }
    // турбулентная пена за кормой
    for (let i = 0; i < (fast ? 26 : 12); i++) {
      const q = ((i * 0.37 + t * (fast ? 1.6 : 0.6)) % 1);
      const x = stern - q * len * 0.6 + Math.sin(i * 7.1 + t * 3) * 4;
      const y = f.waveY(x) + Math.sin(i * 3.3) * 3 * sc;
      ctx.fillStyle = `rgba(255,255,255,${(a * (1 - q) * 0.9).toFixed(3)})`;
      ctx.beginPath();
      ctx.ellipse(x, y, (3 + q * 14) * sc, (1 + q * 2) * sc, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // бурун у форштевня
    if (fast) {
      for (let i = 0; i < 3; i++) this.sprays.push({ x: bow + Math.random() * 6, y: f.waveY(bow) - 2, vx: 20 + Math.random() * 60, vy: -40 - Math.random() * 70, t: 0 });
      ctx.fillStyle = `rgba(255,255,255,${(a * 0.9).toFixed(3)})`;
      ctx.beginPath();
      ctx.ellipse(bow, f.waveY(bow) + 1, 14 * sc, 3 * sc, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawWhale(f: Frame) {
    const { ctx, e, W, sY, t, sc } = f;
    if (!e.activeEvents.some((a) => a.id === "whale")) return;
    this.whaleX += f.dt * 40;
    if (this.whaleX > W + 500) this.whaleX = -500;
    const wy = sY + f.depthPx(Math.min(f.spot.maxDepth * 0.5, 40));
    ctx.save();
    ctx.translate(this.whaleX, wy);
    ctx.scale(sc, sc);
    ctx.fillStyle = mix(f.loc.water.mid, "#000000", 0.45);
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(240, 0);
    ctx.bezierCurveTo(200, -55, -100, -50, -220, -6);
    ctx.lineTo(-220, 6);
    ctx.bezierCurveTo(-100, 45, 200, 55, 240, 0);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-210, 0);
    ctx.lineTo(-300, -40 + Math.sin(t) * 14);
    ctx.lineTo(-280, 0);
    ctx.lineTo(-300, 40 + Math.sin(t) * 14);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(60, 40, 70, 12, 0.5 + Math.sin(t * 0.8) * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private updateSchools(f: Frame) {
    const { ctx, e, W, sY, t, sc, loc } = f;
    this.schoolT -= f.dt;
    const maxD = Math.min(f.spot.maxDepth * 0.8, loc.id === "abyss" ? 300 : 60);
    const shoal = e.activeEvents.some((a) => a.id === "shoal");
    if (this.schoolT <= 0 && this.schools.length < (shoal ? 3 : 1) && maxD > 2) {
      this.schoolT = shoal ? 4 : 18 + Math.random() * 22;
      const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
      const cols: Record<string, string> = { reef: Math.random() < 0.5 ? "#f0c040" : "#60a0ff", fjord: "#a8b8c8", abyss: "#8090a0" };
      this.schools.push({ x: dir > 0 ? -260 : W + 260, depth: 1.5 + Math.random() * (maxD - 1.5), dir, n: 22 + Math.floor(Math.random() * 26), speed: (35 + Math.random() * 30) * sc, phase: Math.random() * 10, seed: Math.random() * 100, col: cols[loc.id] ?? "#c8d4dc", size: (0.7 + Math.random() * 0.5) * sc });
    }
    for (const sch of this.schools) {
      sch.x += sch.dir * sch.speed * f.dt;
      sch.phase += f.dt;
      const cy = sY + f.depthPx(sch.depth);
      for (let i = 0; i < sch.n; i++) {
        const hx = Math.sin(i * 12.9898 + sch.seed) * 43758.5453;
        const hy = Math.sin(i * 78.233 + sch.seed) * 12345.6789;
        const ox = ((hx - Math.floor(hx)) - 0.5) * 180 * sch.size;
        const oy = ((hy - Math.floor(hy)) - 0.5) * 50 * sch.size;
        const wave = Math.sin(sch.phase * 1.4 + ox * 0.02) * 12 * sch.size;
        const x = sch.x + ox + Math.sin(sch.phase * 0.7 + i) * 6;
        const y = cy + oy + wave;
        const glint = Math.max(0, Math.sin(sch.phase * 3 + i * 0.9 + ox * 0.05));
        const L = 8 * sch.size;
        ctx.fillStyle = glint > 0.85 ? "#ffffff" : mix(sch.col, "#203040", 0.25 - glint * 0.25);
        ctx.beginPath();
        ctx.ellipse(x, y, L, L * 0.32, Math.cos(sch.phase * 1.4 + ox * 0.02) * 0.25, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x - sch.dir * L * 0.9, y);
        ctx.lineTo(x - sch.dir * L * 1.5, y - L * 0.35);
        ctx.lineTo(x - sch.dir * L * 1.5, y + L * 0.35);
        ctx.fill();
      }
    }
    this.schools = this.schools.filter((sch) => sch.x > -400 && sch.x < W + 400);
    void t;
  }

  private updateCreatures(f: Frame) {
    const { ctx, e, W, sY, t, sc, loc } = f;
    this.creatureT -= f.dt;
    if (this.creatureT <= 0 && this.creatures.length < 3) {
      this.creatureT = 5 + Math.random() * 8;
      const r = Math.random();
      const maxD = f.spot.maxDepth;
      if (r < 0.45 && !["fjord", "estuary", "skerries", "mangrove"].includes(loc.id)) {
        const deep = loc.id === "abyss" || e.isNight;
        const d = Math.min(maxD * 0.8, 3 + Math.random() * Math.min(maxD, loc.id === "abyss" ? 900 : 60));
        this.creatures.push({ kind: "jelly", x: Math.random() * W, y: sY + f.depthPx(d), vx: (Math.random() - 0.5) * 6, vy: -3 - Math.random() * 3, s: (0.6 + Math.random() * 0.8) * sc, phase: Math.random() * 6, hue: deep ? (Math.random() < 0.5 ? "#60e0ff" : "#c080ff") : "#e8d0f0" });
      } else if (r < 0.65 && ["reef", "ocean", "mangrove", "volcano"].includes(loc.id)) {
        const d = Math.min(maxD * 0.7, 4 + Math.random() * 25);
        const dir = Math.random() < 0.5 ? 1 : -1;
        this.creatures.push({ kind: "turtle", x: dir > 0 ? -80 : W + 80, y: sY + f.depthPx(d), vx: dir * (18 + Math.random() * 10) * sc, vy: 0, s: (0.8 + Math.random() * 0.5) * sc, phase: 0, hue: "#6a7a40" });
      } else if (maxD < 70 && loc.id !== "abyss") {
        const x = Math.random() * W;
        this.creatures.push({ kind: "crab", x, y: 0, vx: (Math.random() < 0.5 ? -1 : 1) * 12 * sc, vy: 0, s: (0.7 + Math.random() * 0.5) * sc, phase: Math.random() * 6, hue: loc.id === "reef" ? "#e05030" : "#c86040" });
      }
    }
    for (const c of this.creatures) {
      c.phase += f.dt;
      if (c.kind === "jelly") {
        const pulse = Math.max(0, Math.sin(c.phase * 2));
        c.y += (c.vy * pulse * 3 + 2) * f.dt;
        c.x += c.vx * f.dt;
        if (c.y < sY + 10) c.vy = Math.abs(c.vy);
        ctx.save();
        ctx.translate(c.x, c.y);
        const bw = 12 * c.s * (1 - pulse * 0.15), bh = 9 * c.s * (1 + pulse * 0.1);
        ctx.strokeStyle = hexA(c.hue, 0.45);
        ctx.lineWidth = 1;
        for (let i = 0; i < 6; i++) {
          ctx.beginPath();
          ctx.moveTo((i - 2.5) * bw * 0.3, 0);
          for (let k = 1; k <= 6; k++) ctx.lineTo((i - 2.5) * bw * 0.3 + Math.sin(c.phase * 2 + k * 0.8 + i) * 3, k * 6 * c.s);
          ctx.stroke();
        }
        const g = ctx.createRadialGradient(0, -bh * 0.3, 0, 0, 0, bw);
        g.addColorStop(0, hexA(c.hue, 0.55));
        g.addColorStop(1, hexA(c.hue, 0.12));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(0, 0, bw, bh, 0, Math.PI, 0);
        ctx.fill();
        ctx.restore();
      } else if (c.kind === "turtle") {
        c.x += c.vx * f.dt;
        const dir = c.vx > 0 ? 1 : -1;
        const fl = Math.sin(c.phase * 2.5) * 0.5;
        ctx.save();
        ctx.translate(c.x, c.y + Math.sin(c.phase * 0.6) * 5);
        ctx.scale(dir * c.s, c.s);
        ctx.fillStyle = "#8a9a5a";
        ctx.beginPath();
        ctx.ellipse(24, -2, 8, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.save();
        ctx.rotate(fl);
        ctx.beginPath();
        ctx.ellipse(8, 10, 16, 5, 0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.beginPath();
        ctx.ellipse(-16, 8, 8, 3, -0.4 - fl * 0.5, 0, Math.PI * 2);
        ctx.fill();
        const sg = ctx.createLinearGradient(0, -14, 0, 10);
        sg.addColorStop(0, "#7a6a38");
        sg.addColorStop(1, "#3a3a20");
        ctx.fillStyle = sg;
        ctx.beginPath();
        ctx.ellipse(0, 0, 22, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(20,20,10,0.4)";
        ctx.lineWidth = 1;
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          ctx.moveTo(i * 9, -11);
          ctx.lineTo(i * 9 + 2, 10);
          ctx.stroke();
        }
        ctx.fillStyle = "#101010";
        ctx.beginPath();
        ctx.arc(28, -4, 1.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        c.x += c.vx * f.dt * (Math.sin(c.phase * 1.5) > 0 ? 1 : 0.1);
        c.y = this.bed.bedY(c.x) - 3 * c.s;
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.scale(c.s, c.s);
        ctx.strokeStyle = c.hue;
        ctx.lineWidth = 1.2;
        for (let i = -1; i <= 1; i += 2) {
          for (let k = 0; k < 3; k++) {
            const lp = Math.sin(c.phase * 10 + k * 2) * 1.5;
            ctx.beginPath();
            ctx.moveTo(i * 3, 0);
            ctx.lineTo(i * (7 + k * 1.5), 2 + lp);
            ctx.lineTo(i * (8 + k * 1.5), 4);
            ctx.stroke();
          }
        }
        ctx.fillStyle = c.hue;
        ctx.beginPath();
        ctx.ellipse(0, -1, 7, 4.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(-8, -4, 2.5, 0, Math.PI * 2);
        ctx.arc(8, -4, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#101010";
        ctx.fillRect(-2.5, -6, 1.2, 2);
        ctx.fillRect(1.3, -6, 1.2, 2);
        ctx.restore();
      }
    }
    this.creatures = this.creatures.filter((c) => c.x > -120 && c.x < W + 120 && c.y < f.cam + f.H * 3 && c.phase < 90);
  }

  private updateAmbient(f: Frame) {
    const { ctx, e, W, sY, cam, H, loc } = f;
    this.spawnT -= f.dt;
    const shoal = e.activeEvents.some((a) => a.id === "shoal");
    const maxN = shoal ? 24 : 10;
    if (this.spawnT <= 0 && this.ambient.length < maxN) {
      this.spawnT = shoal ? 0.15 : this.ambient.length < 4 ? 0.25 : 0.7 + Math.random() * 1.2;
      const inv = (px: number) => (Math.exp(px / f.K) - 1) * 8;
      const dTop = inv(Math.max(0, cam - sY)), dBot = Math.min(f.spot.maxDepth, inv(Math.max(0, cam + H - sY)));
      const tod = e.timeOfDay;
      const pool = FISH.filter(
        (fi) =>
          fi.loc.includes(loc.id) &&
          fi.rarity !== "legendary" &&
          fi.depth[1] >= dTop &&
          fi.depth[0] <= dBot &&
          (fi.time === "any" || fi.time === tod) &&
          (!fi.weather || fi.weather.includes(e.s.weather)) &&
          (!fi.season || fi.season.includes(e.season)),
      );
      if (pool.length) {
        const biased = pool.filter((p) => f.spot.bias.includes(p.id));
        const src = biased.length && Math.random() < 0.5 ? biased : pool;
        const fi = shoal ? src.reduce((a, b) => (a.weight[1] < b.weight[1] ? a : b)) : src[Math.floor(Math.random() * src.length)];
        const lo = Math.max(fi.depth[0], dTop, 0.8), hi = Math.min(fi.depth[1], dBot, f.spot.maxDepth * 0.9);
        if (hi > lo) {
          const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
          const w = fi.weight[0] + (fi.weight[1] - fi.weight[0]) * Math.random() * 0.6;
          this.ambient.push({ f: fi, dir, x: dir === 1 ? -150 : W + 150, depth: lo + Math.random() * (hi - lo), speed: (20 + Math.random() * 40 + fi.strength * 4) * f.sc, len: fishScreenLen(fi, w, 0.75 * f.sc), phase: Math.random() * 10, known: !!e.s.codex[fi.id] });
        }
      }
    }
    for (const a of this.ambient) {
      a.x += a.dir * a.speed * f.dt;
      a.phase += f.dt * (3 + a.speed * 0.05);
      let y = sY + f.depthPx(a.depth) + Math.sin(a.phase * 0.3) * 6;
      const by = this.bed.bedY(a.x) - a.len * 0.3;
      if (y > by) y = by;
      if (y < cam - 100 || y > cam + H + 100) continue;
      drawFish(ctx, a.f, a.x, y, a.len, a.dir, { wag: a.phase, alpha: 0.92, silhouette: a.known ? null : "rgba(4,10,18,0.72)" });
    }
    this.ambient = this.ambient.filter((a) => a.x > -220 && a.x < W + 220);
  }

  private glowPass(f: Frame) {
    const { ctx, sY, cam, H, e, t, W } = f;
    for (const a of this.ambient) {
      if (!a.f.glow || !a.known) continue;
      const y = sY + f.depthPx(a.depth) + Math.sin(a.phase * 0.3) * 6;
      if (y < cam - 50 || y > cam + H + 50) continue;
      drawFishGlow(ctx, a.f, a.x, y, a.len, a.dir, a.phase, 1);
    }
    for (const c of this.creatures) {
      if (c.kind === "jelly" && (f.loc.id === "abyss" || e.isNight)) glow(ctx, c.x, c.y - 3, 5 * c.s, c.hue, 0.5 + Math.sin(c.phase * 2) * 0.3);
    }
    if (e.activeEvents.some((a) => a.id === "plankton")) {
      for (let i = 0; i < 70; i++) {
        const x = (i * 97.3 + Math.sin(t * 0.3 + i) * 30) % W;
        const y = sY + 6 + ((i * 53.7) % 1) * 0 + ((i * 37) % 160) * f.sc + Math.sin(t + i) * 8;
        const a = 0.4 + Math.sin(t * 3 + i * 1.3) * 0.4;
        if (a > 0.1) glow(ctx, x, y, 1.3, "#60ffd8", a);
      }
    }
  }

  private drawHooked(f: Frame, bobX: number, hookY: number, glowOnly: boolean): [number, number] {
    const { ctx, e, W, t, sY } = f;
    if (e.hooked) {
      const h = e.hooked;
      const k = clamp(h.line / h.startLine, 0, 1.6);
      const bx = W * 0.3;
      const fishX = bx + 60 + Math.min(1.3, k) * (bobX - bx - 60) + h.sway * 70 * f.sc + Math.sin(t * 7) * h.intensity * 10;
      const fishY = sY + f.depthPx(e.hookDepth) + 6;
      if (h.jump > 0) return [fishX, fishY];
      const len = fishScreenLen(h.fish, h.weight, f.sc);
      const dir: 1 | -1 = h.sway > 0 ? 1 : -1;
      if (glowOnly) {
        drawFishGlow(ctx, h.fish, fishX + dir * len * 0.4, fishY, len, dir, t * 8, 1.3);
        if (e.hookDepth > 30) {
          ctx.save();
          ctx.globalAlpha = clamp((e.hookDepth - 30) / 200, 0, 0.75);
          drawFish(ctx, h.fish, fishX + dir * len * 0.4, fishY, len, dir, { wag: t * (6 + h.intensity * 14), variant: h.variant });
          ctx.restore();
        }
      } else {
        drawFish(ctx, h.fish, fishX + dir * len * 0.4, fishY, len, dir, { wag: t * (6 + h.intensity * 14), variant: h.variant });
        if (Math.random() < f.dt * 8 * h.intensity) this.bubbles.push({ x: fishX, y: fishY, r: 1 + Math.random() * 3, v: 40 + Math.random() * 40 });
      }
      return [fishX, fishY];
    }
    if (e.phase === "bite" && e.pendingFish && !glowOnly) {
      const fi = e.pendingFish.fish;
      const len = fishScreenLen(fi, e.pendingFish.weight, f.sc);
      drawFish(ctx, fi, bobX - len * 0.45, hookY + 4, len, 1, { wag: t * 12, silhouette: "rgba(5,12,20,0.78)" });
    }
    if (e.phase === "sinking" && !glowOnly && Math.random() < f.dt * 20) this.bubbles.push({ x: bobX + (Math.random() - 0.5) * 6, y: hookY, r: 1 + Math.random() * 2, v: 50 + Math.random() * 40 });
    return [bobX, hookY];
  }

  private drawJump(f: Frame, bobX: number) {
    const { ctx, e, W, t, sY } = f;
    const h = e.hooked;
    if (!h || h.jump <= 0) return;
    const p = 1 - h.jump / JUMP_TIME;
    const len = fishScreenLen(h.fish, h.weight, f.sc);
    const k = clamp(h.line / h.startLine, 0, 1.3);
    const bx = W * 0.3;
    const x = bx + 60 + k * (bobX - bx - 60) + (p - 0.5) * len * 1.2;
    const jh = (50 + Math.min(110, len * 0.8)) * f.sc;
    const y = f.waveY(x) - Math.sin(p * Math.PI) * jh;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-Math.cos(p * Math.PI) * 0.9);
    drawFish(ctx, h.fish, 0, 0, len, 1, { wag: t * 20, variant: h.variant });
    ctx.restore();
    if (Math.random() < f.dt * 30) this.sprays.push({ x: x - len * 0.4, y, vx: (Math.random() - 0.5) * 60, vy: -Math.random() * 40, t: 0 });
    if (p < 0.1 || p > 0.9) {
      for (let i = 0; i < 3; i++) this.sprays.push({ x: x + (Math.random() - 0.5) * len, y: sY, vx: (Math.random() - 0.5) * 140, vy: -80 - Math.random() * 140, t: 0 });
    }
  }

  private drawSprays(f: Frame) {
    const { ctx } = f;
    ctx.fillStyle = "rgba(235,245,255,0.8)";
    for (const s of this.sprays) {
      s.t += f.dt;
      s.vy += 400 * f.dt;
      s.x += s.vx * f.dt;
      s.y += s.vy * f.dt;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    this.sprays = this.sprays.filter((s) => s.t < 1.2 && s.y < f.sY + 10);
  }

  private drawLine(f: Frame, tip: [number, number], bobX: number, hookY: number, fishPos: [number, number]) {
    const { ctx, e, t, H, night } = f;
    const bobWaveY = f.waveY(bobX);
    ctx.lineWidth = 1;
    ctx.strokeStyle = night > 0.5 ? "rgba(220,230,240,0.55)" : "rgba(250,250,250,0.75)";
    if (e.phase === "casting") {
      const k = e.castT;
      const x = tip[0] + (bobX - tip[0]) * k;
      const y = tip[1] + (bobWaveY - tip[1]) * k - Math.sin(k * Math.PI) * H * 0.18;
      ctx.beginPath();
      ctx.moveTo(tip[0], tip[1]);
      ctx.quadraticCurveTo((tip[0] + x) / 2, Math.min(tip[1], y) - 10, x, y);
      ctx.stroke();
      this.drawBobber(ctx, x, y, false, t);
    } else if (["sinking", "waiting", "bite"].includes(e.phase)) {
      const bite = e.phase === "bite";
      const bobY = bobWaveY + (bite ? 2.5 + Math.abs(Math.sin(t * 14)) * 3 : Math.sin(t * 2) * 1.2);
      ctx.beginPath();
      ctx.moveTo(tip[0], tip[1]);
      ctx.quadraticCurveTo((tip[0] + bobX) / 2, Math.max(tip[1], bobY) + 20, bobX, bobY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(bobX, bobY);
      ctx.lineTo(bobX + Math.sin(t) * 3, hookY);
      ctx.strokeStyle = "rgba(230,240,250,0.4)";
      ctx.stroke();
      this.drawHook(ctx, e, bobX + Math.sin(t) * 3, hookY);
      this.drawBobber(ctx, bobX, bobY, bite, t);
      if (bite) {
        const p = e.biteProgress;
        const perfect = p < 0.42;
        ctx.save();
        ctx.lineWidth = perfect ? 2 : 1.2;
        ctx.strokeStyle = perfect ? "rgba(227,201,150,0.95)" : "rgba(230,225,214,0.35)";
        ctx.beginPath();
        ctx.arc(bobX, bobY - 2, 30 * (1 - p) + 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - p));
        ctx.stroke();
        ctx.restore();
      }
      if (bite) {
        ctx.save();
        ctx.fillStyle = "#e3c996";
        ctx.translate(bobX, bobY - 26 + Math.sin(t * 8) * 1.5);
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-3, -3, 6, 6);
        ctx.restore();
        for (let i = 0; i < 2; i++) {
          const rp = (t * 1.4 + i / 2) % 1;
          ctx.strokeStyle = `rgba(240,230,210,${0.45 * (1 - rp)})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.ellipse(bobX, bobWaveY + 2, 6 + rp * 34, 1.5 + rp * 6, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    } else if (e.phase === "fight" && e.hooked) {
      const h = e.hooked;
      const tension = h.tension;
      ctx.strokeStyle = tension > 0.9 ? "rgba(255,120,100,0.95)" : "rgba(250,250,250,0.85)";
      ctx.lineWidth = 1.2 + tension * 0.6;
      if (h.jump > 0) {
        const p = 1 - h.jump / JUMP_TIME;
        const len = fishScreenLen(h.fish, h.weight, f.sc);
        const k = clamp(h.line / h.startLine, 0, 1.3);
        const x = f.W * 0.3 + 60 + k * (bobX - f.W * 0.3 - 60) + (p - 0.5) * len * 1.2;
        const y = f.waveY(x) - Math.sin(p * Math.PI) * (50 + Math.min(110, len * 0.8)) * f.sc;
        const bx = x - len * 0.9;
        const by = f.waveY(bx);
        ctx.beginPath();
        ctx.moveTo(tip[0], tip[1]);
        ctx.quadraticCurveTo((tip[0] + bx) / 2, Math.max(tip[1], by) + 10, bx, by - 2);
        ctx.lineTo(x + len * 0.3, y);
        ctx.stroke();
        // поплавок подскакивает вслед за прыжком
        this.drawBobber(ctx, bx, by - 2 - Math.sin(p * Math.PI) * 6, false, t, Math.atan2(y - by, x - bx) * 0.4);
      } else {
        const entryX = (tip[0] + fishPos[0]) / 2 + 20;
        const entryY = f.waveY(entryX);
        ctx.beginPath();
        ctx.moveTo(tip[0], tip[1]);
        const sag = (1 - clamp(tension, 0, 1)) * 30;
        ctx.quadraticCurveTo((tip[0] + entryX) / 2, (tip[1] + entryY) / 2 + sag, entryX, entryY);
        ctx.lineTo(fishPos[0], fishPos[1]);
        ctx.stroke();
        // поплавок остаётся на леске: наклоняется к рыбе и притапливается по натяжению
        const dive = clamp(tension, 0, 1.1) * 4.5 + h.intensity * 1.5 + Math.sin(t * (6 + h.intensity * 10)) * h.intensity * 1.8;
        const lean = clamp(Math.atan2(fishPos[1] - entryY, fishPos[0] - entryX) - Math.PI / 2, -1.1, 1.1) * clamp(tension, 0.2, 1);
        this.drawBobber(ctx, entryX, entryY + dive, h.overload > 0.05, t, lean);
        if (h.running && Math.random() < f.dt * 3) this.rings.push({ x: entryX, t: 0, s: 1.4 });
        if (h.intensity > 0.6 && Math.random() < f.dt * 12) this.sprays.push({ x: entryX, y: entryY, vx: (Math.random() - 0.5) * 40, vy: -40 - Math.random() * 40, t: 0 });
      }
    }
    if (e.splash > 0) {
      const sx = e.phase === "fight" ? fishPos[0] : bobX;
      ctx.strokeStyle = `rgba(255,255,255,${e.splash * 0.8})`;
      ctx.lineWidth = 2;
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI / 2 + (i - 3) * 0.33;
        const r = (1 - e.splash) * 36 + 6;
        ctx.beginPath();
        ctx.moveTo(sx + Math.cos(a) * r * 0.4, bobWaveY + Math.sin(a) * r * 0.4);
        ctx.lineTo(sx + Math.cos(a) * r, bobWaveY + Math.sin(a) * r);
        ctx.stroke();
      }
    }
  }

  private drawBobber(ctx: CanvasRenderingContext2D, x: number, y: number, bite: boolean, t: number, tilt = 0) {
    ctx.save();
    ctx.translate(x, y);
    if (tilt) ctx.rotate(tilt);
    if (this.W < 820) ctx.scale(1.35, 1.35);
    ctx.fillStyle = "#f4f4f0";
    ctx.beginPath();
    ctx.ellipse(0, 2, 3.6, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = bite ? "#ff3020" : "#e83a2a";
    ctx.beginPath();
    ctx.ellipse(0, -2, 3.6, 4, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(-0.7, -11, 1.4, 7);
    if (bite) glow(ctx, 0, -11, 2 + Math.sin(t * 20), "#ff6040", 1);
    ctx.restore();
  }

  private drawHook(ctx: CanvasRenderingContext2D, e: Engine, x: number, y: number) {
    const bait = BAIT_BY_ID[e.s.currentBait];
    ctx.strokeStyle = "#c0c4c8";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(x, y + 3, 3, 0, Math.PI);
    ctx.stroke();
    if (bait.id === "glow") glow(ctx, x, y + 4, 3, bait.color, 1);
    else {
      ctx.fillStyle = bait.color;
      ctx.beginPath();
      ctx.ellipse(x - 1, y + 5, 3, 2, 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawMarineSnow(f: Frame) {
    const { ctx, sY, cam, H, W, t, e } = f;
    const plankton = e.activeEvents.some((a) => a.id === "plankton");
    ctx.fillStyle = plankton ? "rgba(120,255,230,0.8)" : "rgba(220,235,255,0.4)";
    for (const p of this.snow) {
      p[1] -= f.dt * 6 * p[2];
      p[0] += Math.sin(t * 0.5 + p[1] * 0.01) * f.dt * 4;
      let yy = (((p[1] % (H * 1.2)) + H * 1.2) % (H * 1.2)) + cam - H * 0.1;
      if (yy < sY + 4) continue;
      if (yy > cam + H) yy -= H;
      ctx.globalAlpha = clamp((yy - sY) / (H * 0.5), 0.15, 1) * 0.6;
      ctx.fillRect(((p[0] % W) + W) % W, yy, p[2], p[2]);
    }
    ctx.globalAlpha = 1;
  }

  private drawBubbles(f: Frame) {
    const { ctx, sY, cam } = f;
    ctx.strokeStyle = "rgba(220,245,255,0.65)";
    ctx.lineWidth = 1;
    for (const b of this.bubbles) {
      b.y -= b.v * f.dt;
      b.x += Math.sin(b.y * 0.05) * 0.3;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.fillRect(b.x - b.r * 0.4, b.y - b.r * 0.5, 1, 1);
    }
    this.bubbles = this.bubbles.filter((b) => b.y > sY && b.y > cam - 50);
    if (this.bubbles.length > 220) this.bubbles.splice(0, this.bubbles.length - 220);
  }

  private drawWeather(f: Frame) {
    const { ctx, W, H, sY, cam, weather, night, t, e } = f;
    const surf = sY - cam;
    if (surf > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, W, surf + 4);
      ctx.clip();
      if (weather === "rain" || weather === "storm") {
        const n = Math.min(this.drops.length, weather === "storm" ? 520 : 280);
        const wind = e.s.wind * 0.6 + 0.15;
        ctx.strokeStyle = night > 0.5 ? "rgba(170,190,220,0.35)" : "rgba(210,225,240,0.42)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const d = this.drops[i];
          d.y += d.v * f.dt;
          d.x += d.v * wind * f.dt;
          if (d.y > H) { d.y = -20; d.x = Math.random() * W * 1.2 - W * 0.2; }
          if (d.x > W) d.x -= W;
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d.x - d.l * wind, d.y - d.l);
        }
        ctx.stroke();
      }
      if (weather === "snow") {
        ctx.fillStyle = "rgba(255,255,255,0.88)";
        for (const fl of this.flakes) {
          fl.y += fl.v * f.dt;
          fl.x += (Math.sin(t + fl.l * 10) * 20 + e.s.wind * 40) * f.dt;
          if (fl.y > H) { fl.y = -5; fl.x = Math.random() * W; }
          if (fl.x > W) fl.x -= W;
          ctx.beginPath();
          ctx.arc(fl.x, fl.y, fl.l, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }
    if (f.fogK > 0.5) {
      const fy = sY - cam;
      const fc = mix("#c8d0d4", "#101820", night * 0.85);
      const fg = ctx.createLinearGradient(0, fy - H * 0.4, 0, fy + H * 0.08);
      fg.addColorStop(0, hexA(fc, 0));
      fg.addColorStop(0.65, hexA(fc, 0.7));
      fg.addColorStop(1, hexA(fc, 0));
      ctx.fillStyle = fg;
      ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 6; i++) {
        const x = ((t * (8 + i * 3) + i * 300) % (W + 700)) - 350;
        ctx.fillStyle = hexA(fc, 0.12);
        ctx.beginPath();
        ctx.ellipse(x, fy - 30 - i * 26, 320, 30, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private drawLightning(f: Frame) {
    const { ctx, e, W, H, sY, cam } = f;
    if (e.lightning > this.lastLightning + 0.5) {
      const x0 = W * (0.2 + Math.random() * 0.7);
      this.bolt = [[x0, 0]];
      let x = x0;
      for (let y = 0; y < (sY - cam) * 0.8; y += 16) {
        x += (Math.random() - 0.5) * 38;
        this.bolt.push([x, y]);
      }
    }
    this.lastLightning = e.lightning;
    if (e.lightning <= 0) return;
    ctx.fillStyle = `rgba(230,235,255,${e.lightning * 0.35})`;
    ctx.fillRect(0, 0, W, H);
    if (e.lightning > 0.55 && this.bolt.length && sY - cam > 0) {
      ctx.save();
      ctx.strokeStyle = `rgba(255,255,255,${e.lightning})`;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = "#b0c0ff";
      ctx.shadowBlur = 22;
      ctx.beginPath();
      this.bolt.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
      ctx.restore();
    }
  }

  private grade(f: Frame) {
    const { ctx, W, H, golden, night, cam, sY } = f;
    ctx.save();
    if (golden > 0.05) {
      ctx.globalCompositeOperation = "soft-light";
      ctx.fillStyle = `rgba(255,150,70,${0.35 * golden})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (night > 0.3) {
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = `rgba(8,16,48,${0.14 * night})`;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
    // блики объектива
    const sx = f.sunX, sy = f.sunY - cam;
    if (this.quality > 1 && f.sunVis > 0.55 && sy > 0 && sy < sY - cam && f.sunElev > 0.05) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const cx = W / 2, cy = H / 2;
      const flares: [number, number, string][] = [[0.3, 18, "255,220,160"], [0.6, 10, "180,220,255"], [1.1, 34, "255,180,120"], [1.5, 14, "200,255,220"]];
      for (const [k, r, c] of flares) {
        const x = sx + (cx - sx) * k * 2, y = sy + (cy - sy) * k * 2;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r * f.sc * 1.5);
        g.addColorStop(0, `rgba(${c},${af(0.1 * f.sunVis)})`);
        g.addColorStop(1, `rgba(${c},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r * f.sc * 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.78);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, `rgba(0,0,10,${af(0.42 + night * 0.2)})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }
}
