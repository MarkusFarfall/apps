import { TIME_SCALE, type Engine } from "../engine";
import type { PortId } from "../types";
import { drawBoat } from "./boat";
import type { Frame } from "./frame";
import { drawBolt, drawIce, drawLeaves, drawRainbow, drawRain, drawSnow, makeBolt, type Bolt } from "./weatherFx";
import { drawEventFx, type FxCall, type FxScene } from "./eventFx";
import { clamp, glow, hash1, hexA, mix, rng, rgbHex } from "./util";

export type Building = "market" | "shop" | "shipyard" | "tavern";
export interface Hotspot { id: Building | "dock"; x: number; y: number }

/** Расположение зданий по ширине экрана */
const LAYOUT: Record<PortId, Record<Building | "dock", number>> = {
  home: { tavern: 0.12, market: 0.33, shop: 0.52, dock: 0.66, shipyard: 0.86 },
  nordhavn: { market: 0.14, tavern: 0.33, shop: 0.5, dock: 0.66, shipyard: 0.86 },
  mirador: { shop: 0.13, market: 0.32, tavern: 0.51, dock: 0.68, shipyard: 0.88 },
  coral: { market: 0.14, tavern: 0.34, shop: 0.53, dock: 0.7, shipyard: 0.88 },
  southcross: { tavern: 0.14, shop: 0.34, market: 0.53, dock: 0.7, shipyard: 0.88 },
};

interface Pal {
  wall: string[];
  roof: string;
  trim: string;
  quay: string;
  quayFace: string;
  water: [string, string];
  hills: [string, string];
}
const PAL: Record<PortId, Pal> = {
  home: { wall: ["#d8cdb8", "#c4b08c", "#e2dacb", "#b8a07c"], roof: "#8a3a2a", trim: "#f0e8d8", quay: "#6a5238", quayFace: "#4a3a28", water: ["#3a8a96", "#0e3446"], hills: ["#5a7a5e", "#34503e"] },
  nordhavn: { wall: ["#8e2a1e", "#b8722a", "#8e2a1e", "#3a5a6a", "#e8d8b0"], roof: "#2a2a2e", trim: "#f0ece4", quay: "#4a4a4c", quayFace: "#2e2e30", water: ["#2e6a7a", "#08202c"], hills: ["#6a7a88", "#3a4a52"] },
  mirador: { wall: ["#7a8a96", "#9a7a6a", "#6a7a6a", "#c8b8a0"], roof: "#3a3a44", trim: "#e8e4dc", quay: "#5a4838", quayFace: "#3a2e24", water: ["#3a7a7a", "#0a2a30"], hills: ["#4e5a66", "#2e3a38"] },
  coral: { wall: ["#e0a040", "#40a0b0", "#d86a5a", "#f0e0b0", "#6ab07a", "#d8a0c0"], roof: "#b08a4a", trim: "#fff8e8", quay: "#c8b088", quayFace: "#8a7456", water: ["#40c8c8", "#0a5a78"], hills: ["#3a6a44", "#24482e"] },
  southcross: { wall: ["#e8eef2", "#d8602a", "#e8eef2", "#b8c8d4"], roof: "#8aa0b0", trim: "#ffffff", quay: "#d8e2ea", quayFace: "#9ab0c0", water: ["#3a7a96", "#062030"], hills: ["#c8d4de", "#9aacb8"] },
};

interface Walker { x: number; v: number; seed: number; c: string; crate: boolean }
export const isFairDay = (d = new Date()) => d.getDay() === 0 || d.getDay() === 6;
interface Puff { x: number; y: number; t: number; r: number }

export class PortScene {
  hot: Hotspot[] = [];
  private t = 0;
  private walkers: Walker[] = [];
  private smoke: Puff[] = [];
  private smokeT = 0;
  private gulls: [number, number, number][] = [];
  private key = "";
  private reflecting = false;
  private clouds: [number, number, number, number][] = [];
  private lightningBolt: Bolt = [];
  private lastBoltSeed = -1;

  render(ctx: CanvasRenderingContext2D, e: Engine, W: number, H: number, dt: number) {
    this.t += dt;
    const t = this.t;
    const pid = e.s.port;
    const P = PAL[pid];
    const L = LAYOUT[pid];
    const atmo = e.atmosphere.state;
    const weather = e.weather;
    const sunElev = atmo.sunElev;
    const night = atmo.night;
    const golden = atmo.golden;
    const sc = clamp(Math.min(H / 820, W / 760), 0.5, 1.3);
    const hY = H * 0.5;
    const quayY = H * 0.66;
    const waterY = H * 0.715;
    const waveAmp = (1.4 + atmo.waves * 0.45) * sc;
    const waveY = (x: number) => waterY + 4 * sc + Math.sin(x * 0.02 + t * 1.1) * waveAmp + Math.sin(t * 0.7) * 1.2 * sc;
    const dockX = W * L.dock;
    let fxRodTip: readonly [number, number] = [dockX + 100 * sc, waterY - 62 * sc];
    const visibleFx = new Map(e.eventDirector.visible().map((event) => [event.uid, event]));
    const fxCalls: FxCall[] = [];
    for (const { live, def } of e.eventDirector.activeList()) {
      const event = visibleFx.get(live.uid);
      if (!event || !def.fx?.length) continue;
      const age = Math.max(0, (e.s.minutes - live.start) / TIME_SCALE);
      for (const spec of def.fx) fxCalls.push({ e: event, spec, age });
    }
    const fxScene = (): FxScene => ({
      c: ctx, t, W, H, s: sc, q: 2, horizon: hY, surface: waterY, seabed: H, visW: W, cam: 0,
      windPx: atmo.wind * atmo.windDir * 26 * sc, sAt: waveY,
      glow: (x, y, r, col, a) => glow(ctx, x, y, r, rgbHex(col), a),
      sun: { x: sunX, y: sunY }, moon: { x: moonX, y: moonY }, rocks: [],
      capeX: W * 0.78, capeTop: hY, rodTip: fxRodTip,
      mast: [dockX + 8 * sc, waterY - 45 * sc], lantern: [dockX, quayY - 42 * sc], boatX: dockX + 40 * sc,
      A: atmo, pal: atmo.palette,
    });
    const sunX = W * clamp((atmo.sunAz - 45) / 270, 0, 1);
    const sunY = hY - Math.sin((sunElev * Math.PI) / 180) * H * 0.4;
    const moonX = W * clamp((atmo.moonAz - 45) / 270, 0, 1);
    const moonY = hY - Math.sin((atmo.moonElev * Math.PI) / 180) * H * 0.3;
    const key = `${pid}|${W}|${H}`;
    if (key !== this.key) {
      this.key = key;
      const r = rng(pid.length * 13 + 3);
      const cols = ["#3a3a44", "#5a3a2a", "#2a3a5a", "#4a4a3a", "#6a2a2a"];
      this.walkers = Array.from({ length: pid === "southcross" ? 4 : 7 }, () => ({ x: r() * W, v: (r() < 0.5 ? -1 : 1) * (12 + r() * 16) * sc, seed: r() * 100, c: cols[Math.floor(r() * cols.length)], crate: r() < 0.35 }));
      this.gulls = Array.from({ length: 5 }, () => [r() * W, H * (0.08 + r() * 0.2), r() * 6]);
      this.clouds = Array.from({ length: 7 }, () => [r() * W * 1.3 - W * 0.15, H * (0.05 + r() * 0.25), (70 + r() * 110) * sc, 4 + r() * 6]);
      this.smoke = [];
    }

    // ───── небо ─────
    const tAmt = clamp(atmo.cover * 0.45 + atmo.dark * 0.45 + atmo.fog * 0.1, 0, 1);
    const top = rgbHex(atmo.palette.skyTop);
    const mid = rgbHex(atmo.palette.skyMid);
    const hor = rgbHex(atmo.palette.skyHor);
    const g = ctx.createLinearGradient(0, 0, 0, hY);
    g.addColorStop(0, top);
    g.addColorStop(0.6, mid);
    g.addColorStop(1, hor);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, hY + 2);
    if (atmo.starVis > 0.01) {
      const r = rng(9);
      for (let i = 0; i < 180; i++) {
        const x = r() * W, y = Math.pow(r(), 1.3) * hY * 0.9, s = r() * 1.3 + 0.3;
        ctx.globalAlpha = atmo.starVis * (0.4 + 0.6 * Math.sin(t * 2 + i));
        ctx.fillStyle = "#fff";
        ctx.fillRect(x, y, s, s);
      }
      ctx.globalAlpha = 1;
    }
    if (atmo.aurora > 0.01) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let k = 0; k < 3; k++) {
        for (let x = 0; x <= W; x += 8) {
          const y = H * (0.08 + k * 0.03) + Math.sin(x * 0.006 + t * 0.25 + k) * 26;
          const hh = 60 + Math.sin(x * 0.02 + t + k) * 20;
          const gg = ctx.createLinearGradient(0, y, 0, y + hh);
          const c = k === 1 ? "150,90,255" : "70,255,160";
          gg.addColorStop(0, `rgba(${c},0)`);
          gg.addColorStop(0.7, `rgba(${c},${(0.12 * atmo.aurora).toFixed(3)})`);
          gg.addColorStop(1, `rgba(${c},0)`);
          ctx.fillStyle = gg;
          ctx.fillRect(x, y, 8, hh);
        }
      }
      ctx.restore();
    }
    // солнце и луна следуют астрономическим координатам атмосферы
    if (sunElev > -1) {
      const gl = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, H * 0.35);
      gl.addColorStop(0, hexA(rgbHex(atmo.palette.glow), 0.5 * atmo.sunVis));
      gl.addColorStop(1, "rgba(255,200,140,0)");
      ctx.fillStyle = gl;
      ctx.fillRect(0, 0, W, hY);
      ctx.fillStyle = hexA(rgbHex(atmo.palette.sun), atmo.sunVis);
      ctx.beginPath();
      ctx.arc(sunX, sunY, H * 0.026, 0, Math.PI * 2);
      ctx.fill();
    }
    if (atmo.moonElev > -1 && atmo.moonVis > 0.02) {
      const r = H * 0.02;
      ctx.save();
      ctx.globalAlpha = atmo.moonVis;
      ctx.fillStyle = "#e7e9e4";
      ctx.beginPath();
      ctx.arc(moonX, moonY, r, 0, Math.PI * 2);
      ctx.fill();
      const k = Math.cos(atmo.moonPhase * Math.PI * 2);
      ctx.fillStyle = "rgba(55,62,82,0.8)";
      ctx.beginPath();
      ctx.ellipse(moonX + (atmo.moonPhase < 0.5 ? 1 : -1) * k * r, moonY, Math.abs(k) * r, r, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      glow(ctx, moonX, moonY, r * 5, "#c8d8ff", 0.18 * atmo.moonVis * atmo.moonIllum);
    }
    if (fxCalls.length) drawEventFx(fxScene(), "sky", fxCalls);
    const dim = (c: string, k = 0.75) => mix(c, "#060a12", night * k);
    // облака
    {
      const cover = atmo.cover;
      let lit = mix(rgbHex(atmo.palette.cloud), "#ffc488", golden * 0.3);
      if (atmo.dark > 0.25) lit = mix(lit, "#6a7078", atmo.dark * 0.55);
      lit = mix(lit, "#1a2030", night * 0.88);
      const shade = mix(lit, top, 0.45);
      const n = Math.round(this.clouds.length * cover);
      for (let i = 0; i < n; i++) {
        const c = this.clouds[i];
        c[0] += (c[3] + atmo.wind * 1.2 * atmo.windDir) * dt;
        if (c[0] - c[2] * 1.5 > W) c[0] = -c[2] * 1.6;
        const [cx, cy, cw] = c;
        for (let k = 0; k < 6; k++) {
          const px = cx + (k - 2.5) * cw * 0.28, py = cy - Math.sin((k / 5) * Math.PI) * cw * 0.16, pr = cw * (0.2 + Math.sin((k / 5) * Math.PI) * 0.16);
          const cg = ctx.createRadialGradient(px, py - pr * 0.3, 0, px, py, pr);
          cg.addColorStop(0, hexA(lit, 0.85));
          cg.addColorStop(0.6, hexA(shade, 0.7));
          cg.addColorStop(1, hexA(shade, 0));
          ctx.fillStyle = cg;
          ctx.beginPath();
          ctx.arc(px, py, pr, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // ───── задний план ─────
    this.backdrop(ctx, pid, W, H, hY, quayY, sc, night, P, t, dim);
    if (fxCalls.length) drawEventFx(fxScene(), "horizon", fxCalls);

    // ───── вода ─────
    const wg = ctx.createLinearGradient(0, hY, 0, H);
    const portNear = mix(P.water[0], rgbHex(atmo.palette.seaNear), 0.34);
    const portDeep = mix(P.water[1], rgbHex(atmo.palette.deep), 0.28);
    wg.addColorStop(0, dim(mix(portNear, hor, 0.35), 0.7));
    wg.addColorStop(0.35, dim(portNear, 0.8));
    wg.addColorStop(1, dim(portDeep, 0.6));
    ctx.fillStyle = wg;
    ctx.fillRect(0, hY, W, H - hY);
    if (fxCalls.length) drawEventFx(fxScene(), "under", fxCalls);
    for (let i = 0; i < 44; i++) {
      const p = (i * 0.618) % 1;
      const y = hY + (H - hY) * p;
      const x = ((i * 173 + t * (10 + p * 30)) % (W + 80)) - 40;
      ctx.fillStyle = `rgba(255,255,255,${(0.05 + p * 0.12) * (1 - night * 0.6)})`;
      ctx.fillRect(x, y, 10 + p * 40, 1 + p);
    }

    // ───── набережная ─────
    ctx.fillStyle = dim(P.quay);
    ctx.fillRect(0, quayY - 6 * sc, W, waterY - quayY + 6 * sc);
    ctx.fillStyle = dim(P.quayFace);
    ctx.fillRect(0, quayY + 4 * sc, W, waterY - quayY - 4 * sc);
    ctx.fillStyle = hexA("#000000", 0.25);
    for (let x = 0; x < W; x += 26 * sc) ctx.fillRect(x, quayY + 4 * sc, 1.5, waterY - quayY);
    for (let x = 12 * sc; x < W; x += 90 * sc) {
      ctx.fillStyle = dim("#2a2a2a");
      ctx.fillRect(x, quayY - 12 * sc, 6 * sc, 8 * sc);
    }

    // ───── здания ─────
    this.hot = [];
    const bw = Math.min(150 * sc, W * 0.19);
    const order: Building[] = ["market", "shop", "shipyard", "tavern"];
    const drawTown = () => {
      for (const b of order) {
        const x = W * L[b];
        const top = this.building(ctx, pid, b, x, quayY - 6 * sc, bw, sc, night, P, t, dim);
        if (!this.reflecting) this.hot.push({ id: b, x, y: top });
      }
      this.extras(ctx, pid, W, H, quayY, sc, night, t, dim);
      this.props(ctx, pid, W, quayY, sc, t, dim);
    };
    // отражение в воде
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, waterY, W, H - waterY);
    ctx.clip();
    ctx.translate(0, waterY * 2 + 2 * sc);
    ctx.scale(1, -1);
    ctx.globalAlpha = 0.26 * (1 - night * 0.25);
    this.reflecting = true;
    drawTown();
    this.reflecting = false;
    ctx.restore();
    // рябь поверх отражения
    for (let yy = waterY + 2; yy < H; yy += 3 * sc) {
      const q = (yy - waterY) / (H - waterY);
      ctx.fillStyle = hexA(dim(mix(P.water[0], P.water[1], q), 0.7), 0.35 + q * 0.35);
      const off = Math.sin(yy * 0.3 + t * 2.2) * 6 * sc;
      ctx.fillRect(off, yy, W, 1.2 * sc);
    }
    // тень под стенкой набережной
    const sh = ctx.createLinearGradient(0, waterY, 0, waterY + 26 * sc);
    sh.addColorStop(0, "rgba(0,0,0,0.35)");
    sh.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = sh;
    ctx.fillRect(0, waterY, W, 26 * sc);
    drawTown();

    // ───── фонари ─────
    for (let x = W * 0.06; x < W; x += W * 0.22) {
      const ly = quayY - 46 * sc;
      ctx.fillStyle = dim("#1c1e22");
      ctx.fillRect(x - 1.2 * sc, ly, 2.4 * sc, 40 * sc);
      ctx.fillRect(x - 4 * sc, ly - 5 * sc, 8 * sc, 6 * sc);
      if (night > 0.25) {
        glow(ctx, x, ly - 2 * sc, 3 * sc, "#ffcf7a", night);
        const lg = ctx.createRadialGradient(x, quayY, 0, x, quayY, 70 * sc);
        lg.addColorStop(0, `rgba(255,200,120,${(0.22 * night).toFixed(3)})`);
        lg.addColorStop(1, "rgba(255,200,120,0)");
        ctx.fillStyle = lg;
        ctx.fillRect(x - 70 * sc, quayY - 70 * sc, 140 * sc, 140 * sc);
        ctx.fillStyle = `rgba(255,200,120,${(0.25 * night).toFixed(3)})`;
        for (let k = 0; k < 6; k++) ctx.fillRect(x - 1.5 + Math.sin(t * 3 + k * 1.7 + x) * 2, waterY + 6 + k * 9 * sc, 3, 6 * sc);
      }
    }

    // ───── прохожие ─────
    for (const w of this.walkers) {
      w.x += w.v * dt;
      if (w.x < -20) w.x = W + 20;
      if (w.x > W + 20) w.x = -20;
      const step = Math.sin(t * 7 + w.seed) * 2 * sc;
      const y = quayY - 6 * sc;
      ctx.fillStyle = dim(w.c, 0.8);
      ctx.fillRect(w.x - 2.5 * sc, y - 15 * sc, 5 * sc, 9 * sc);
      ctx.beginPath();
      ctx.arc(w.x, y - 18 * sc, 2.6 * sc, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(w.x - 2 * sc + step * 0.3, y - 6 * sc, 1.6 * sc, 6 * sc);
      ctx.fillRect(w.x + 0.5 * sc - step * 0.3, y - 6 * sc, 1.6 * sc, 6 * sc);
      if (w.crate) {
        ctx.fillStyle = dim(pid === "southcross" ? "#d8602a" : "#8a6a42", 0.8);
        ctx.fillRect(w.x - 4 * sc, y - 22 * sc, 8 * sc, 6 * sc);
        ctx.strokeStyle = hexA("#000000", 0.3);
        ctx.lineWidth = 0.8;
        ctx.strokeRect(w.x - 4 * sc, y - 22 * sc, 8 * sc, 6 * sc);
      }
    }

    // ───── кошка на причале ─────
    if (pid !== "southcross") {
      const cx = W * L.dock - 50 * sc, cy = quayY - 6 * sc;
      const tail = Math.sin(t * 1.8) * 3 * sc;
      ctx.fillStyle = dim(pid === "coral" ? "#c88a4a" : "#2a2a2c", 0.8);
      ctx.beginPath(); ctx.ellipse(cx, cy - 3.5 * sc, 5 * sc, 3.5 * sc, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 4.5 * sc, cy - 7 * sc, 2.6 * sc, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx + 3 * sc, cy - 9 * sc); ctx.lineTo(cx + 3.6 * sc, cy - 11.5 * sc); ctx.lineTo(cx + 4.8 * sc, cy - 9.4 * sc); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx + 5 * sc, cy - 9.4 * sc); ctx.lineTo(cx + 6.4 * sc, cy - 11.5 * sc); ctx.lineTo(cx + 6.8 * sc, cy - 8.8 * sc); ctx.fill();
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = 1.4 * sc;
      ctx.beginPath(); ctx.moveTo(cx - 4.5 * sc, cy - 3 * sc); ctx.quadraticCurveTo(cx - 9 * sc, cy - 6 * sc + tail, cx - 7 * sc, cy - 11 * sc + tail); ctx.stroke();
      if (night > 0.4) { glow(ctx, cx + 5.5 * sc, cy - 7.3 * sc, 0.7 * sc, "#c8ff80", night * 0.8); }
    }

    // ───── движение в гавани ─────
    {
      const period = 38;
      const ph = (t % period) / period;
      const dir = Math.floor(t / period) % 2 ? 1 : -1;
      const bx = dir > 0 ? -80 + (W + 160) * ph : W + 80 - (W + 160) * ph;
      const by = waterY + (H - waterY) * 0.55;
      const s2 = sc * 0.9;
      ctx.save();
      ctx.translate(bx, by + Math.sin(t * 1.4) * 1.5 * sc);
      ctx.scale(dir * s2, s2);
      ctx.fillStyle = dim(pid === "coral" ? "#f0e0b0" : pid === "nordhavn" ? "#8e2a1e" : "#e8e4dc");
      ctx.beginPath(); ctx.moveTo(-28, -4); ctx.lineTo(30, -6); ctx.lineTo(24, 5); ctx.lineTo(-24, 5); ctx.fill();
      ctx.fillStyle = dim(pid === "southcross" ? "#e87a20" : "#2a4a6a");
      ctx.fillRect(-6, -16, 16, 11);
      ctx.fillStyle = night > 0.3 ? "rgba(255,200,110,0.9)" : dim("#8ab0c8");
      ctx.fillRect(-3, -13, 10, 4);
      ctx.restore();
      for (let i = 0; i < 10; i++) {
        const q = i / 10;
        ctx.fillStyle = `rgba(255,255,255,${(0.35 * (1 - q) * (1 - night * 0.5)).toFixed(3)})`;
        ctx.beginPath(); ctx.ellipse(bx - dir * (28 + q * 90) * s2, by + 4 * sc + q * 3, 4 + q * 14, 1 + q * 1.5, 0, 0, Math.PI * 2); ctx.fill();
      }
      if (night > 0.3) glow(ctx, bx + dir * 8 * s2, by - 18 * s2, 1.4, "#ffffff", night);
    }

    // ───── ярмарка выходного дня ─────
    if (isFairDay() && pid !== "southcross") {
      const cols = ["#d8402a", "#f0c040", "#2a70b0", "#3a9a5a", "#f0f0e8"];
      for (let seg = 0; seg < 3; seg++) {
        const x0 = W * (0.05 + seg * 0.2), x1 = x0 + W * 0.2, yy = quayY - 110 * sc;
        ctx.strokeStyle = dim("#3a3a3a");
        ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(x0, yy); ctx.quadraticCurveTo((x0 + x1) / 2, yy + 26 * sc, x1, yy); ctx.stroke();
        for (let i = 1; i < 12; i++) {
          const q = i / 12;
          const fx = x0 + (x1 - x0) * q, fy = yy + Math.sin(q * Math.PI) * 26 * sc * 0.95;
          const sw = Math.sin(t * 3 + i + seg) * 1.5 * sc;
          ctx.fillStyle = dim(cols[(i + seg) % cols.length]);
          ctx.beginPath(); ctx.moveTo(fx - 3.5 * sc, fy); ctx.lineTo(fx + 3.5 * sc, fy); ctx.lineTo(fx + sw, fy + 8 * sc); ctx.fill();
          if (night > 0.3 && i % 3 === 0) glow(ctx, fx, fy + 2 * sc, 1.4 * sc, "#ffd890", night);
        }
      }
    }

    // ───── пришвартованные суда ─────
    ctx.fillStyle = dim(P.quay);
    ctx.fillRect(dockX - 70 * sc, quayY - 2 * sc, 140 * sc, 5 * sc);
    for (const dx of [-60, -20, 20, 60]) {
      ctx.fillStyle = dim(P.quayFace);
      ctx.fillRect(dockX + dx * sc, quayY, 5 * sc, waterY - quayY + 30 * sc);
    }
    this.mooredBoats(ctx, pid, W, waterY, sc, night, t, dim);
    const f = { ctx, e, t, dt, night, sc: sc * 0.9, golden, weather, waveY, W, H, atmo, wind: Math.min(1.5, atmo.wind / 18) } as unknown as Frame;
    if (atmo.ice > 0.02) drawIce(ctx, t, W, waveY, atmo.ice, atmo.wind * atmo.windDir * 26 * sc, sc, atmo.palette.seaNear);
    ctx.save();
    fxRodTip = drawBoat(f, dockX + 40 * sc, "moored");
    ctx.restore();
    if (fxCalls.length) {
      drawEventFx(fxScene(), "surface", fxCalls);
      drawEventFx(fxScene(), "front", fxCalls);
    }
    this.hot.push({ id: "dock", x: dockX + 40 * sc, y: waterY - 80 * sc });
    // канат
    ctx.strokeStyle = dim("#c8b080");
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(dockX - 20 * sc, quayY);
    ctx.quadraticCurveTo(dockX, waterY + 6, dockX + 10 * sc, waveY(dockX + 10 * sc) - 4 * sc);
    ctx.stroke();

    // ───── чайки ─────
    if (night < 0.6 && atmo.wind < 18 && atmo.precip < 0.82 && pid !== "southcross") {
      ctx.strokeStyle = dim("#e8e8e4", 0.9);
      ctx.lineWidth = 1.6;
      for (const gg of this.gulls) {
        gg[0] += dt * 22;
        gg[2] += dt * 5;
        if (gg[0] > W + 30) gg[0] = -30;
        const fl = Math.sin(gg[2]) * 5;
        const y = gg[1] + Math.sin(t * 0.5 + gg[2] * 0.1) * 10;
        ctx.beginPath();
        ctx.moveTo(gg[0] - 10, y - fl);
        ctx.quadraticCurveTo(gg[0] - 4, y - 4, gg[0], y);
        ctx.quadraticCurveTo(gg[0] + 4, y - 4, gg[0] + 10, y - fl);
        ctx.stroke();
      }
    }

    // ───── дым из труб ─────
    this.smokeT -= dt;
    ctx.fillStyle = "rgba(0,0,0,0)";
    for (const p of this.smoke) {
      p.t += dt;
      p.y -= 14 * sc * dt;
      p.x += (6 + atmo.wind) * dt;
      p.r += 4 * sc * dt;
      ctx.fillStyle = `rgba(${night > 0.5 ? "80,86,96" : "220,220,224"},${(0.35 * (1 - p.t / 5)).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    this.smoke = this.smoke.filter((p) => p.t < 5);

    // ───── погода ─────
    const q = 1 as 0 | 1 | 2;
    const windPx = atmo.wind * atmo.windDir * 26 * sc;
    const precip = { t, x0: 0, x1: W, top: 0, bottom: H, floor: () => H, wind: windPx, s: sc, q, near: false };
    if (atmo.rain > 0.02) {
      drawRain(ctx, { ...precip, intensity: atmo.rain, color: atmo.palette.cloud });
      drawRain(ctx, { ...precip, near: true, intensity: atmo.rain, color: atmo.palette.cloud });
    }
    if (atmo.snow > 0.02) {
      drawSnow(ctx, { ...precip, intensity: atmo.snow, color: [238, 245, 255] });
      drawSnow(ctx, { ...precip, near: true, intensity: atmo.snow, color: [252, 254, 255] });
    }
    if (atmo.leaves > 0.02) drawLeaves(ctx, t, 0, W, 0, H, windPx, atmo.leaves, "leaf", sc);
    if (atmo.petals > 0.02) drawLeaves(ctx, t, 0, W, 0, H, windPx * 0.6, atmo.petals, "petal", sc);
    if (atmo.rainbow > 0.02 && sunElev > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, W, hY);
      ctx.clip();
      ctx.globalCompositeOperation = "screen";
      drawRainbow(ctx, W - sunX + W * 0.05, hY + H * 0.08, H * 0.4, atmo.rainbow * 0.68);
      ctx.restore();
    }
    const fogAmount = Math.max(atmo.fog, pid === "mirador" ? 0.22 : 0);
    if (fogAmount > 0.04) {
      const fc = mix(rgbHex(atmo.palette.fog), "#101820", night * 0.85);
      for (let k = 0; k < 5; k++) {
        const x = ((t * (6 + k * 2) + k * 300) % (W + 700)) - 350;
        const y = hY - 10 + k * 22 * sc;
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(1, 0.12);
        const fg = ctx.createRadialGradient(0, 0, 0, 0, 0, 380);
        fg.addColorStop(0, hexA(fc, 0.16 + fogAmount * 0.45));
        fg.addColorStop(1, hexA(fc, 0));
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.arc(0, 0, 380, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    const strike = e.lastLightningStrike;
    if (strike && strike.seed !== this.lastBoltSeed) {
      this.lastBoltSeed = strike.seed;
      const r = rng(strike.seed);
      const x0 = W * strike.x;
      this.lightningBolt = makeBolt(x0, 0, x0 + (r() - 0.5) * W * 0.12, hY, r);
    }
    if (e.lightning > 0.01) {
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.fillStyle = `rgba(230,235,255,${e.lightning * 0.24})`;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      if (this.lightningBolt.length) drawBolt(ctx, this.lightningBolt, e.lightning, sc);
    }
    // виньетка
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.8);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, `rgba(0,0,10,${(0.45 + night * 0.2).toFixed(3)})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }

  private puff(x: number, y: number, sc: number) {
    if (this.smokeT <= 0) {
      this.smoke.push({ x, y, t: 0, r: 3 * sc });
    }
  }

  private backdrop(ctx: CanvasRenderingContext2D, pid: PortId, W: number, H: number, hY: number, quayY: number, sc: number, night: number, P: Pal, t: number, dim: (c: string, k?: number) => string) {
    const ridge = (hMax: number, seed: number, col: string, sharp = 1) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(0, hY + 2);
      for (let x = 0; x <= W; x += 6) {
        const n = (Math.sin(x * 0.006 + seed) * 0.5 + Math.sin(x * 0.017 + seed * 2) * 0.3 + Math.sin(x * 0.041 + seed * 3) * 0.2 + 1) / 2;
        ctx.lineTo(x, hY - Math.pow(n, sharp) * hMax);
      }
      ctx.lineTo(W, hY + 2);
      ctx.fill();
    };
    if (pid === "home") {
      ridge(H * 0.09, 1.3, dim(mix(P.hills[0], "#9ab0c0", 0.4)));
      ridge(H * 0.06, 4.1, dim(P.hills[1]));
      // маяк на холме
      const lx = W * 0.94, ly = hY - H * 0.07;
      ctx.fillStyle = dim("#ece6da");
      ctx.fillRect(lx - 6 * sc, ly - 44 * sc, 12 * sc, 44 * sc);
      ctx.fillStyle = dim("#b83a2a");
      ctx.fillRect(lx - 6 * sc, ly - 30 * sc, 12 * sc, 6 * sc);
      ctx.fillRect(lx - 6 * sc, ly - 14 * sc, 12 * sc, 6 * sc);
      ctx.fillStyle = dim("#2a2a2a");
      ctx.fillRect(lx - 8 * sc, ly - 52 * sc, 16 * sc, 8 * sc);
      if (night > 0.25) {
        glow(ctx, lx, ly - 48 * sc, 3 * sc, "#fff0b0", night);
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const a = Math.sin(t * 0.8);
        ctx.fillStyle = `rgba(255,240,180,${(0.12 * night * Math.abs(a)).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(lx, ly - 48 * sc);
        ctx.lineTo(lx + a * W * 0.5, ly - 70 * sc);
        ctx.lineTo(lx + a * W * 0.5, ly - 20 * sc);
        ctx.fill();
        ctx.restore();
      }
    } else if (pid === "nordhavn") {
      ridge(H * 0.3, 2.2, dim(mix(P.hills[0], "#b0c0d0", 0.2)), 1.4);
      // снег на вершинах
      ctx.fillStyle = dim("#eef4f8", 0.6);
      for (let x = 0; x <= W; x += 6) {
        const n = (Math.sin(x * 0.006 + 2.2) * 0.5 + Math.sin(x * 0.017 + 4.4) * 0.3 + Math.sin(x * 0.041 + 6.6) * 0.2 + 1) / 2;
        const hgt = Math.pow(n, 1.4) * H * 0.3;
        if (hgt > H * 0.18) ctx.fillRect(x, hY - hgt, 6, (hgt - H * 0.18) * 0.7);
      }
      ridge(H * 0.12, 5.1, dim(P.hills[1]));
      ctx.fillStyle = dim("#1e2e24");
      for (let x = 0; x < W; x += 5) {
        const y = hY - 4 - hash1(x) * H * 0.04;
        ctx.beginPath();
        ctx.moveTo(x, y - 8 * sc);
        ctx.lineTo(x - 3 * sc, y + 2);
        ctx.lineTo(x + 3 * sc, y + 2);
        ctx.fill();
      }
    } else if (pid === "mirador") {
      ridge(H * 0.1, 7.3, dim(mix(P.hills[0], "#c0c8d0", 0.35)));
      ridge(H * 0.07, 3.3, dim(P.hills[1]));
      for (let i = 0; i < 6; i++) {
        const x = W * (0.05 + i * 0.17), y = hY - H * 0.05;
        ctx.fillStyle = dim("#233228");
        ctx.beginPath();
        ctx.ellipse(x, y - 14 * sc, 22 * sc, 8 * sc, -0.1, 0, Math.PI * 2);
        ctx.ellipse(x + 14 * sc, y - 20 * sc, 16 * sc, 6 * sc, -0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = dim("#3a2e24");
        ctx.fillRect(x, y - 14 * sc, 3 * sc, 18 * sc);
      }
    } else if (pid === "coral") {
      ridge(H * 0.16, 1.9, dim(mix(P.hills[0], "#a0c8c0", 0.3)));
      ridge(H * 0.06, 6.2, dim(P.hills[1]));
    } else {
      ridge(H * 0.12, 3.9, dim("#c8d4de"), 1.3);
      ctx.fillStyle = dim("#eef6fa");
      ctx.fillRect(0, hY - 10 * sc, W, 12 * sc);
      for (let i = 0; i < 4; i++) {
        const x = W * (0.1 + i * 0.25) + Math.sin(t * 0.05 + i) * 10, y = hY + 6 * sc + i * 4;
        ctx.fillStyle = dim("#eef6fa");
        ctx.beginPath();
        ctx.moveTo(x - 30 * sc, y);
        ctx.lineTo(x - 18 * sc, y - 18 * sc);
        ctx.lineTo(x + 20 * sc, y - 15 * sc);
        ctx.lineTo(x + 30 * sc, y);
        ctx.fill();
      }
    }
    void quayY;
  }

  private building(ctx: CanvasRenderingContext2D, pid: PortId, b: Building, x: number, y: number, w: number, sc: number, night: number, P: Pal, t: number, dim: (c: string, k?: number) => string): number {
    const lit = night > 0.3;
    const flick = 0.85 + Math.sin(t * 2.3 + x * 0.07) * 0.08 + (Math.sin(t * 17 + x) > 0.97 ? -0.3 : 0);
    const win = lit ? `rgba(255,200,110,${Math.min(1, (0.6 + night * 0.4) * flick).toFixed(3)})` : dim("#3a4654");
    const wallIdx = { market: 0, shop: 1, shipyard: 2, tavern: 3 }[b];
    const wall = dim(P.wall[wallIdx % P.wall.length]);
    const roof = dim(P.roof);
    const trim = dim(P.trim);
    const hMul = { market: 0.55, shop: 0.7, shipyard: 0.9, tavern: 0.95 }[b];
    const h = w * hMul;
    const x0 = x - w / 2;
    let top = y - h;
    ctx.save();
    if (pid === "southcross" && b !== "shipyard") {
      // модуль-купол или контейнер станции
      if (b === "tavern" || b === "market") {
        const r = w * 0.5;
        ctx.fillStyle = dim(b === "tavern" ? "#e8eef2" : "#d8602a");
        ctx.beginPath();
        ctx.arc(x, y, r, Math.PI, 0);
        ctx.fill();
        ctx.strokeStyle = hexA("#000000", 0.15);
        ctx.lineWidth = 1;
        for (let k = 1; k < 4; k++) {
          ctx.beginPath();
          ctx.arc(x, y, r * (k / 4), Math.PI, 0);
          ctx.stroke();
        }
        for (let k = 0; k < 3; k++) {
          ctx.fillStyle = win;
          ctx.fillRect(x - r * 0.6 + k * r * 0.45, y - r * 0.45, r * 0.25, r * 0.18);
        }
        top = y - r;
      } else {
        ctx.fillStyle = dim("#d8602a");
        ctx.fillRect(x0, y - h * 0.6, w, h * 0.6);
        ctx.fillStyle = dim("#b8481a");
        for (let k = 0; k < 8; k++) ctx.fillRect(x0 + (k / 8) * w, y - h * 0.6, 1.5, h * 0.6);
        for (let k = 0; k < 4; k++) {
          ctx.fillStyle = win;
          ctx.fillRect(x0 + 8 * sc + k * (w - 16 * sc) / 4, y - h * 0.45, (w - 16 * sc) / 4 - 5 * sc, h * 0.14);
        }
        top = y - h * 0.6;
      }
    } else if (b === "market") {
      // навесы с лотками
      const n = 3;
      for (let k = 0; k < n; k++) {
        const sx = x0 + (k / n) * w, sw = w / n - 4 * sc;
        ctx.fillStyle = dim("#5a4430");
        ctx.fillRect(sx + 2 * sc, y - h * 0.7, 2 * sc, h * 0.7);
        ctx.fillRect(sx + sw - 2 * sc, y - h * 0.7, 2 * sc, h * 0.7);
        const stripeA = pid === "coral" ? ["#f0e0a0", "#e06a4a"] : pid === "nordhavn" ? ["#e8e4dc", "#2a5a8a"] : ["#f0e8d8", "#b83a2a"];
        for (let s = 0; s < 6; s++) {
          ctx.fillStyle = dim(stripeA[s % 2]);
          ctx.beginPath();
          ctx.moveTo(sx + (s / 6) * sw, y - h * 0.7);
          ctx.lineTo(sx + ((s + 1) / 6) * sw, y - h * 0.7);
          ctx.lineTo(sx + ((s + 1) / 6) * sw + 2 * sc, y - h * 0.56);
          ctx.lineTo(sx + (s / 6) * sw + 2 * sc, y - h * 0.56);
          ctx.fill();
        }
        ctx.fillStyle = dim("#6a5236");
        ctx.fillRect(sx, y - h * 0.26, sw, h * 0.26);
        // ящики с рыбой
        for (let f = 0; f < 3; f++) {
          ctx.fillStyle = dim("#a8b8c0");
          ctx.beginPath();
          ctx.ellipse(sx + sw * (0.2 + f * 0.3), y - h * 0.28, 5 * sc, 2 * sc, 0.2 * (f - 1), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      top = y - h * 0.72;
      if (lit) glow(ctx, x, y - h * 0.4, 5 * sc, "#ffcf7a", night * 0.7);
    } else if (b === "shipyard") {
      // стапель с корпусом и кран
      ctx.fillStyle = dim("#4a3a2c");
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x0 + w, y);
      ctx.lineTo(x0 + w * 0.9, y + 16 * sc);
      ctx.lineTo(x0 + w * 0.1, y + 16 * sc);
      ctx.fill();
      ctx.fillStyle = dim(pid === "coral" ? "#f0f0ea" : pid === "nordhavn" ? "#3a3a3a" : "#2a5a7a");
      ctx.beginPath();
      ctx.moveTo(x0 + w * 0.12, y - h * 0.32);
      ctx.lineTo(x0 + w * 0.82, y - h * 0.38);
      ctx.quadraticCurveTo(x0 + w * 0.75, y - h * 0.08, x0 + w * 0.6, y - h * 0.06);
      ctx.lineTo(x0 + w * 0.2, y - h * 0.06);
      ctx.quadraticCurveTo(x0 + w * 0.1, y - h * 0.18, x0 + w * 0.12, y - h * 0.32);
      ctx.fill();
      ctx.fillStyle = dim("#8a2a22");
      ctx.fillRect(x0 + w * 0.18, y - h * 0.12, w * 0.5, h * 0.05);
      ctx.strokeStyle = dim("#6a5236");
      ctx.lineWidth = 2 * sc;
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        ctx.moveTo(x0 + w * (0.25 + k * 0.14), y);
        ctx.lineTo(x0 + w * (0.25 + k * 0.14), y - h * 0.08);
        ctx.stroke();
      }
      // кран
      ctx.strokeStyle = dim(pid === "southcross" ? "#e08a30" : "#c8a030");
      ctx.lineWidth = 3 * sc;
      const cx = x0 + w * 0.95;
      ctx.beginPath();
      ctx.moveTo(cx, y);
      ctx.lineTo(cx, y - h * 1.35);
      ctx.lineTo(x0 + w * 0.2, y - h * 1.35);
      ctx.moveTo(cx, y - h * 1.15);
      ctx.lineTo(x0 + w * 0.45, y - h * 1.35);
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.strokeStyle = dim("#2a2a2a");
      const sway = Math.sin(t * 0.8) * 3 * sc;
      ctx.beginPath();
      ctx.moveTo(x0 + w * 0.35, y - h * 1.35);
      ctx.lineTo(x0 + w * 0.35 + sway, y - h * 0.62);
      ctx.stroke();
      ctx.fillStyle = dim("#2a2a2a");
      ctx.fillRect(x0 + w * 0.35 + sway - 4 * sc, y - h * 0.62, 8 * sc, 6 * sc);
      if (lit) glow(ctx, cx, y - h * 1.37, 2 * sc, "#ff4040", night);
      top = y - h * 1.4;
    } else {
      // дома: лавка и таверна
      const roofType = pid === "coral" ? "thatch" : pid === "mirador" ? "flat" : "gable";
      const bodyH = b === "tavern" ? h : h * 0.85;
      if (pid === "coral") {
        ctx.fillStyle = dim("#4a3624");
        for (let k = 0; k < 4; k++) ctx.fillRect(x0 + 4 * sc + k * (w - 8 * sc) / 3, y - 2, 3 * sc, 18 * sc);
      }
      const by = pid === "coral" ? y - 6 * sc : y;
      ctx.fillStyle = wall;
      ctx.fillRect(x0, by - bodyH, w, bodyH);
      if (pid === "nordhavn") {
        ctx.fillStyle = hexA("#000000", 0.16);
        for (let k = 0; k < w; k += 6 * sc) ctx.fillRect(x0 + k, by - bodyH, 1.2, bodyH);
      }
      if (roofType === "gable") {
        ctx.fillStyle = roof;
        ctx.beginPath();
        ctx.moveTo(x0 - 5 * sc, by - bodyH);
        ctx.lineTo(x, by - bodyH - w * 0.4);
        ctx.lineTo(x0 + w + 5 * sc, by - bodyH);
        ctx.fill();
        top = by - bodyH - w * 0.4;
      } else if (roofType === "thatch") {
        ctx.fillStyle = dim("#b89a5a");
        ctx.beginPath();
        ctx.moveTo(x0 - 10 * sc, by - bodyH + 4 * sc);
        ctx.lineTo(x, by - bodyH - w * 0.35);
        ctx.lineTo(x0 + w + 10 * sc, by - bodyH + 4 * sc);
        ctx.fill();
        ctx.strokeStyle = dim("#8a6a3a");
        ctx.lineWidth = 1;
        for (let k = 0; k < 10; k++) {
          ctx.beginPath();
          ctx.moveTo(x0 - 10 * sc + k * (w + 20 * sc) / 10, by - bodyH + 4 * sc);
          ctx.lineTo(x, by - bodyH - w * 0.3);
          ctx.stroke();
        }
        top = by - bodyH - w * 0.35;
      } else {
        ctx.fillStyle = roof;
        ctx.fillRect(x0 - 4 * sc, by - bodyH - 6 * sc, w + 8 * sc, 6 * sc);
        ctx.fillStyle = trim;
        for (let k = 0; k < 8; k++) ctx.fillRect(x0 + (k / 8) * w, by - bodyH - 12 * sc, 3 * sc, 6 * sc);
        top = by - bodyH - 12 * sc;
      }
      // окна
      const rows = b === "tavern" ? 2 : 1;
      for (let r = 0; r < rows; r++) {
        for (let k = 0; k < 3; k++) {
          const wx = x0 + w * (0.14 + k * 0.28), wy = by - bodyH + bodyH * (0.18 + r * 0.38);
          ctx.fillStyle = win;
          ctx.fillRect(wx, wy, w * 0.16, bodyH * 0.2);
          ctx.fillStyle = trim;
          ctx.fillRect(wx + w * 0.075, wy, 1.2, bodyH * 0.2);
        }
      }
      // дверь
      ctx.fillStyle = dim("#3a2a1c");
      ctx.fillRect(x - w * 0.09, by - bodyH * 0.34, w * 0.18, bodyH * 0.34);
      // вывеска
      ctx.fillStyle = dim("#2a2018");
      ctx.fillRect(x0 + w + 2 * sc, by - bodyH * 0.8, 16 * sc, 1.5 * sc);
      ctx.fillStyle = dim(b === "tavern" ? "#c8a46a" : "#8ab0c8");
      const swing = Math.sin(t * 1.3 + x) * 0.08;
      ctx.save();
      ctx.translate(x0 + w + 12 * sc, by - bodyH * 0.8);
      ctx.rotate(swing);
      ctx.fillRect(-7 * sc, 2 * sc, 14 * sc, 10 * sc);
      ctx.strokeStyle = dim("#2a2018");
      ctx.lineWidth = 1.4 * sc;
      ctx.beginPath();
      if (b === "tavern") {
        ctx.arc(0, 7 * sc, 3 * sc, 0, Math.PI);
        ctx.moveTo(0, 4 * sc);
        ctx.lineTo(0, 10 * sc);
      } else {
        ctx.moveTo(-4 * sc, 10 * sc);
        ctx.lineTo(4 * sc, 4 * sc);
      }
      ctx.stroke();
      ctx.restore();
      if (b === "tavern") {
        // труба с дымом
        const chx = x0 + w * 0.75;
        ctx.fillStyle = dim("#4a3a32");
        ctx.fillRect(chx, top + w * 0.1, 8 * sc, w * 0.25);
        if (!this.reflecting && (this.smokeT <= 0 || Math.random() < 0.05)) this.puff(chx + 4 * sc, top + w * 0.08, sc);
        if (lit) {
          const lg = ctx.createRadialGradient(x, by - 10 * sc, 0, x, by - 10 * sc, w * 0.8);
          lg.addColorStop(0, `rgba(255,190,110,${(0.22 * night).toFixed(3)})`);
          lg.addColorStop(1, "rgba(255,190,110,0)");
          ctx.fillStyle = lg;
          ctx.fillRect(x - w, by - w, w * 2, w * 1.2);
        }
      }
    }
    ctx.restore();
    if (!this.reflecting && this.smokeT <= 0) this.smokeT = 0.35;
    return top;
  }

  private extras(ctx: CanvasRenderingContext2D, pid: PortId, W: number, H: number, quayY: number, sc: number, night: number, t: number, dim: (c: string, k?: number) => string) {
    if (pid === "coral") {
      for (const [px, ph, lean] of [[0.03, 110, 10], [0.24, 90, -12], [0.43, 120, 8], [0.97, 100, -10]] as [number, number, number][]) {
        const x = W * px, h = ph * sc, tx = x + lean * sc + Math.sin(t * 0.8 + x) * 3, ty = quayY - 6 * sc - h;
        ctx.strokeStyle = dim("#5a4630");
        ctx.lineWidth = 4 * sc;
        ctx.beginPath();
        ctx.moveTo(x, quayY - 6 * sc);
        ctx.quadraticCurveTo(x + lean * sc * 0.3, quayY - h * 0.5, tx, ty);
        ctx.stroke();
        ctx.fillStyle = dim("#27472a");
        for (let i = 0; i < 7; i++) {
          const a = -Math.PI / 2 + (i - 3) * 0.52 + Math.sin(t * 1.2 + i) * 0.05;
          const Lf = 48 * sc;
          ctx.beginPath();
          ctx.moveTo(tx, ty);
          ctx.quadraticCurveTo(tx + Math.cos(a) * Lf * 0.6, ty + Math.sin(a) * Lf * 0.4 - 8 * sc, tx + Math.cos(a) * Lf, ty + Math.sin(a) * Lf * 0.4 + Lf * 0.35);
          ctx.quadraticCurveTo(tx + Math.cos(a) * Lf * 0.5, ty + Math.sin(a) * Lf * 0.2, tx, ty);
          ctx.fill();
        }
      }
      // гирлянда
      ctx.strokeStyle = dim("#3a3a3a");
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(W * 0.06, quayY - 90 * sc);
      ctx.quadraticCurveTo(W * 0.3, quayY - 60 * sc, W * 0.6, quayY - 88 * sc);
      ctx.stroke();
      for (let i = 0; i < 16; i++) {
        const q = i / 15;
        const x = W * 0.06 + (W * 0.54) * q, y = quayY - 90 * sc + Math.sin(q * Math.PI) * 26 * sc;
        const c = ["#ff8a5a", "#ffd060", "#80d0ff"][i % 3];
        if (night > 0.3) glow(ctx, x, y, 1.6 * sc, c, night);
        else {
          ctx.fillStyle = dim(c);
          ctx.beginPath();
          ctx.arc(x, y, 1.8 * sc, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (pid === "mirador") {
      // колесо обозрения
      const cx = W * 0.72, cy = quayY - 110 * sc, r = 60 * sc;
      ctx.strokeStyle = dim("#c8c0b0");
      ctx.lineWidth = 2 * sc;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + t * 0.08;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        ctx.stroke();
        const gx = cx + Math.cos(a) * r, gy = cy + Math.sin(a) * r;
        ctx.fillStyle = dim(["#b83a2a", "#2a5a8a", "#d8a030"][i % 3]);
        ctx.fillRect(gx - 4 * sc, gy, 8 * sc, 7 * sc);
        if (night > 0.3) glow(ctx, gx, gy - 1, 1.3 * sc, "#ffd890", night);
      }
      ctx.lineWidth = 3 * sc;
      ctx.beginPath();
      ctx.moveTo(cx - 34 * sc, quayY - 6 * sc);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx + 34 * sc, quayY - 6 * sc);
      ctx.stroke();
      // трубы консервного завода
      for (const dx of [0.58, 0.61]) {
        ctx.fillStyle = dim("#5a4a3a");
        ctx.fillRect(W * dx, quayY - 150 * sc, 9 * sc, 150 * sc);
        if (!this.reflecting && Math.random() < 0.08) this.smoke.push({ x: W * dx + 4 * sc, y: quayY - 152 * sc, t: 0, r: 4 * sc });
      }
    } else if (pid === "nordhavn") {
      // портовые краны на заднем плане
      for (const cx of [0.58, 0.95]) {
        ctx.strokeStyle = dim("#c8a030");
        ctx.lineWidth = 4 * sc;
        const x = W * cx;
        ctx.beginPath();
        ctx.moveTo(x, quayY - 6 * sc);
        ctx.lineTo(x, quayY - 190 * sc);
        ctx.lineTo(x - 100 * sc, quayY - 190 * sc);
        ctx.moveTo(x, quayY - 170 * sc);
        ctx.lineTo(x - 60 * sc, quayY - 190 * sc);
        ctx.stroke();
        if (night > 0.3) glow(ctx, x, quayY - 192 * sc, 2 * sc, "#ff4040", night);
      }
      // бочки и сети
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = dim(i % 2 ? "#2a5a8a" : "#8a3a2a");
        ctx.fillRect(W * 0.22 + i * 11 * sc, quayY - 18 * sc, 9 * sc, 12 * sc);
      }
    } else if (pid === "home") {
      // сохнущие сети
      ctx.strokeStyle = dim("#3a2a1c");
      ctx.lineWidth = 2 * sc;
      const x = W * 0.22;
      ctx.beginPath();
      ctx.moveTo(x, quayY - 6 * sc);
      ctx.lineTo(x, quayY - 50 * sc);
      ctx.moveTo(x + 36 * sc, quayY - 6 * sc);
      ctx.lineTo(x + 36 * sc, quayY - 50 * sc);
      ctx.stroke();
      ctx.strokeStyle = hexA(dim("#8a8a70"), 0.7);
      ctx.lineWidth = 0.6;
      const sag = Math.sin(t) * 2 * sc;
      for (let k = 0; k <= 8; k++) {
        ctx.beginPath();
        ctx.moveTo(x + (36 * sc * k) / 8, quayY - 48 * sc);
        ctx.lineTo(x + (36 * sc * k) / 8 + sag, quayY - 16 * sc);
        ctx.stroke();
      }
      for (let k = 0; k <= 5; k++) {
        ctx.beginPath();
        ctx.moveTo(x, quayY - 48 * sc + k * 6 * sc);
        ctx.quadraticCurveTo(x + 18 * sc + sag, quayY - 45 * sc + k * 6 * sc, x + 36 * sc, quayY - 48 * sc + k * 6 * sc);
        ctx.stroke();
      }
    } else {
      // радиомачта и пингвины
      const x = W * 0.62;
      ctx.strokeStyle = dim("#6a7a88");
      ctx.lineWidth = 2 * sc;
      ctx.beginPath();
      ctx.moveTo(x - 10 * sc, quayY - 6 * sc);
      ctx.lineTo(x, quayY - 200 * sc);
      ctx.lineTo(x + 10 * sc, quayY - 6 * sc);
      for (let k = 1; k < 8; k++) {
        const yy = quayY - 6 * sc - k * 24 * sc;
        const hw = 10 * sc * (1 - k / 8);
        ctx.moveTo(x - hw, yy);
        ctx.lineTo(x + hw, yy);
      }
      ctx.stroke();
      if (Math.sin(t * 2.5) > 0) glow(ctx, x, quayY - 202 * sc, 2.5 * sc, "#ff3030", 1);
      for (let k = 0; k < 6; k++) {
        const px = W * 0.44 + k * 9 * sc + Math.sin(t * 0.4 + k) * 3;
        const hop = Math.max(0, Math.sin(t * 2 + k * 1.7)) > 0.97 ? -3 * sc : 0;
        ctx.fillStyle = "#15171c";
        ctx.beginPath();
        ctx.ellipse(px, quayY - 12 * sc + hop, 3 * sc, 6 * sc, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#f2f2ee";
        ctx.beginPath();
        ctx.ellipse(px + 0.8 * sc, quayY - 11.5 * sc + hop, 1.8 * sc, 4.5 * sc, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    void H;
  }

  /** Флаги, ящики, бочки, швартовы — детали набережной */
  private props(ctx: CanvasRenderingContext2D, pid: PortId, W: number, quayY: number, sc: number, t: number, dim: (c: string, k?: number) => string) {
    const y = quayY - 6 * sc;
    const flagCols: Record<PortId, [string, string]> = { home: ["#2a5a8a", "#e8e4dc"], nordhavn: ["#b83a2a", "#f0ece4"], mirador: ["#1a3a6a", "#d8a030"], coral: ["#20a0b0", "#f0d040"], southcross: ["#e87a20", "#f4f4f4"] };
    const [c1, c2] = flagCols[pid];
    for (const fx of [0.6, 0.76]) {
      const x = W * fx, ph = 70 * sc;
      ctx.fillStyle = dim("#d8d8d8");
      ctx.fillRect(x - 1 * sc, y - ph, 2 * sc, ph);
      ctx.beginPath();
      ctx.arc(x, y - ph, 2 * sc, 0, Math.PI * 2);
      ctx.fill();
      const fw = 26 * sc, fh = 16 * sc;
      for (let band = 0; band < 2; band++) {
        ctx.fillStyle = dim(band ? c2 : c1);
        ctx.beginPath();
        for (let i = 0; i <= 10; i++) {
          const q = i / 10;
          const wv = Math.sin(t * 5 + q * 4 + fx * 10) * 2.6 * sc * q;
          const yy = y - ph + 2 * sc + band * fh * 0.5 + wv;
          if (i === 0) ctx.moveTo(x + 1 * sc, yy);
          else ctx.lineTo(x + 1 * sc + q * fw, yy);
        }
        for (let i = 10; i >= 0; i--) {
          const q = i / 10;
          const wv = Math.sin(t * 5 + q * 4 + fx * 10) * 2.6 * sc * q;
          ctx.lineTo(x + 1 * sc + q * fw, y - ph + 2 * sc + (band + 1) * fh * 0.5 + wv);
        }
        ctx.closePath();
        ctx.fill();
      }
    }
    if (pid === "southcross") return;
    // ящики и бочки
    const crate = dim(pid === "coral" ? "#b08a5a" : "#7a5a38");
    const bx = W * 0.44;
    for (const [dx, dy, w, h] of [[0, 0, 16, 12], [16, 0, 14, 12], [6, -12, 14, 12]] as [number, number, number, number][]) {
      ctx.fillStyle = crate;
      ctx.fillRect(bx + dx * sc, y - (12 - dy) * sc - h * sc + 12 * sc, w * sc, h * sc);
      ctx.strokeStyle = hexA("#000000", 0.3);
      ctx.lineWidth = 1;
      ctx.strokeRect(bx + dx * sc, y - (12 - dy) * sc - h * sc + 12 * sc, w * sc, h * sc);
      ctx.beginPath();
      ctx.moveTo(bx + dx * sc, y - (12 - dy) * sc - h * sc + 12 * sc);
      ctx.lineTo(bx + (dx + w) * sc, y - (12 - dy) * sc + 12 * sc);
      ctx.stroke();
    }
    for (let i = 0; i < 3; i++) {
      const x = W * 0.47 + 26 * sc + i * 10 * sc;
      ctx.fillStyle = dim(i % 2 ? "#5a3a24" : "#6a4a2e");
      ctx.beginPath();
      ctx.ellipse(x, y - 7 * sc, 4.5 * sc, 7 * sc, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = dim("#2a2a2a");
      ctx.fillRect(x - 4.5 * sc, y - 10 * sc, 9 * sc, 1.2 * sc);
      ctx.fillRect(x - 4.5 * sc, y - 4 * sc, 9 * sc, 1.2 * sc);
    }
    // бухта каната
    ctx.strokeStyle = dim("#c8b080");
    ctx.lineWidth = 1.4 * sc;
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.ellipse(W * 0.4, y - 2 * sc - k * 1.6 * sc, (7 - k) * sc, 2.4 * sc, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  private mooredBoats(ctx: CanvasRenderingContext2D, pid: PortId, W: number, waterY: number, sc: number, night: number, t: number, dim: (c: string, k?: number) => string) {
    const boats: [number, number, string, string, boolean][] =
      pid === "coral" ? [[0.2, 0.9, "#f0f0ea", "#2a7ab0", true], [0.46, 0.7, "#e06a4a", "#f0e0b0", false]]
        : pid === "southcross" ? [[0.3, 1.3, "#e87a20", "#f4f4f4", false]]
          : pid === "nordhavn" ? [[0.28, 1.4, "#3a3a3a", "#d8a030", false], [0.46, 0.8, "#8e2a1e", "#e8e4dc", false]]
            : [[0.25, 0.8, "#e8e4dc", "#c84030", false], [0.44, 0.7, "#7a5230", "#d8c090", false]];
    for (const [fx, k, hull, trim, sail] of boats) {
      const x = W * fx, s = sc * k;
      const bob = Math.sin(t * 1.1 + fx * 10) * 1.5 * sc;
      const tilt = Math.sin(t * 0.9 + fx * 7) * 0.03;
      ctx.save();
      ctx.translate(x, waterY + 2 * sc + bob);
      ctx.rotate(tilt);
      ctx.fillStyle = dim(hull);
      ctx.beginPath();
      ctx.moveTo(-50 * s, -8 * s);
      ctx.lineTo(52 * s, -11 * s);
      ctx.quadraticCurveTo(44 * s, 6 * s, 30 * s, 8 * s);
      ctx.lineTo(-42 * s, 8 * s);
      ctx.quadraticCurveTo(-50 * s, 2 * s, -50 * s, -8 * s);
      ctx.fill();
      ctx.fillStyle = dim(trim);
      ctx.fillRect(-50 * s, -9 * s, 102 * s, 2.5 * s);
      if (sail) {
        ctx.strokeStyle = dim("#c8c8c8");
        ctx.lineWidth = 1.5 * s;
        ctx.beginPath();
        ctx.moveTo(0, -10 * s);
        ctx.lineTo(0, -80 * s);
        ctx.stroke();
        ctx.fillStyle = dim("#f4f2ec");
        ctx.beginPath();
        ctx.moveTo(-1, -76 * s);
        ctx.lineTo(-30 * s, -12 * s);
        ctx.lineTo(-1, -12 * s);
        ctx.fill();
      } else if (k > 1) {
        ctx.fillStyle = dim(trim);
        ctx.fillRect(-10 * s, -30 * s, 30 * s, 20 * s);
        ctx.fillStyle = night > 0.3 ? "rgba(255,200,110,0.9)" : dim("#6a9ab8");
        ctx.fillRect(-6 * s, -25 * s, 22 * s, 6 * s);
        ctx.strokeStyle = dim("#303030");
        ctx.lineWidth = 2 * s;
        ctx.beginPath();
        ctx.moveTo(-20 * s, -9 * s);
        ctx.lineTo(-20 * s, -60 * s);
        ctx.stroke();
      }
      ctx.restore();
      ctx.fillStyle = `rgba(255,255,255,${(0.25 * (1 - night * 0.6)).toFixed(3)})`;
      ctx.fillRect(x - 50 * s, waterY + 10 * sc + bob, 100 * s, 1.2);
    }
  }
}
