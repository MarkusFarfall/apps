import type { Frame } from "./frame";
import { clamp, ctx2d, hexA, makeCanvas, mix, rng, af } from "./util";

let causticTile: HTMLCanvasElement | null = null;

/** Тайлящаяся текстура каустики (края ячеек Вороного) */
export function getCaustics(): HTMLCanvasElement {
  if (causticTile) return causticTile;
  const S = 128;
  const c = makeCanvas(S, S);
  const g = ctx2d(c);
  const img = g.createImageData(S, S);
  const r = rng(42);
  const pts: [number, number][] = Array.from({ length: 22 }, () => [r(), r()]);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = x / S, v = y / S;
      let f1 = 9, f2 = 9;
      for (const [px, py] of pts) {
        for (let ox = -1; ox <= 1; ox++) {
          for (let oy = -1; oy <= 1; oy++) {
            const dx = px + ox - u, dy = py + oy - v;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
          }
        }
      }
      const e = f2 - f1;
      const val = Math.pow(clamp(1 - e / 0.07, 0, 1), 2.2);
      const i = (y * S + x) * 4;
      img.data[i] = 235;
      img.data[i + 1] = 255;
      img.data[i + 2] = 250;
      img.data[i + 3] = Math.round(val * 255);
    }
  }
  g.putImageData(img, 0, 0);
  causticTile = c;
  return c;
}

export function tileCaustics(ctx: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number, t: number, scale: number, alpha = 1) {
  const tile = getCaustics();
  const S = 128 * scale;
  for (let layer = 0; layer < 2; layer++) {
    const ox = ((layer ? -t * 9 : t * 7) % S + S) % S;
    const oy = ((layer ? t * 4 : -t * 3) % S + S) % S;
    ctx.globalAlpha = (layer ? 0.55 : 0.7) * alpha;
    for (let y = y0 - oy - (layer ? S * 0.37 : 0); y < y0 + h; y += S) {
      for (let x = x0 - ox - (layer ? S * 0.5 : 0); x < x0 + w; x += S) {
        ctx.drawImage(tile, x, y, S, S);
      }
    }
  }
  ctx.globalAlpha = 1;
}

export function seaSurfaceColor(f: Frame) {
  return mix(mix(f.loc.water.surface, f.top, 0.25), "#02050c", f.night * 0.72);
}

/** Дальняя полоса моря между горизонтом и разрезом */
export function drawSeaBand(f: Frame, reflect: () => void) {
  const { ctx, W, hY, sY, t, night } = f;
  const water = seaSurfaceColor(f);
  const g = ctx.createLinearGradient(0, hY, 0, sY + f.amp + 4);
  g.addColorStop(0, mix(f.hor, water, 0.35));
  g.addColorStop(0.35, mix(water, f.hor, 0.2));
  g.addColorStop(1, mix(water, mix(f.loc.water.shallow, "#02050c", night * 0.8), 0.4));
  ctx.fillStyle = g;
  ctx.fillRect(0, hY, W, sY - hY + f.amp * 2 + 6);
  reflect();

  // перспективная рябь
  const band = sY - hY;
  const lightC = mix(mix(f.mid, "#ffffff", 0.25), "#1a2438", night * 0.8);
  const darkC = mix(water, "#000000", 0.35);
  const rows = f.quality > 0 ? 34 : 14;
  for (let i = 0; i < rows; i++) {
    const p = i / rows;
    const y = hY + band * p * p;
    const th = 0.5 + p * 1.8;
    const dashes = 10 + Math.floor(p * 8);
    const spd = (8 + p * 30) * (0.5 + f.wind);
    const dS = hexA(darkC, 0.25 * (0.5 + p)), lS = hexA(lightC, 0.18 * (0.5 + p));
    for (let k = 0; k < dashes; k++) {
      const seed = i * 31.7 + k * 7.3;
      const len = (6 + (seed % 5) * 4) * (0.4 + p * 2);
      const x = (((seed * 97) % W) + t * spd + Math.sin(t * 0.8 + seed) * 6) % (W + 60) - 30;
      ctx.fillStyle = k % 3 === 0 ? dS : lS;
      ctx.fillRect(x, y, len, th);
    }
  }
  if (f.fogK > 0.3) {
    const fg = ctx.createLinearGradient(0, hY - 20, 0, hY + band * 0.8);
    const fc = mix("#c4ccd2", "#101820", night * 0.85);
    fg.addColorStop(0, hexA(fc, 0.8 * f.fogK));
    fg.addColorStop(1, hexA(fc, 0));
    ctx.fillStyle = fg;
    ctx.fillRect(0, hY - 20, W, band + 20);
  }

  // дорожка солнца / луны
  const sun = f.sunElev > -0.02;
  const gx = sun ? f.sunX : f.moonX;
  const ga = sun ? 0.95 * f.sunVis : f.moonUp ? 0.5 * f.moonVis * ((1 - Math.cos((f.e.moonIndex / 8) * Math.PI * 2)) / 2) : 0;
  if (ga > 0.03) {
    const col = sun ? mix("#fff4d8", "#ffa860", f.golden) : "#dce6ff";
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const cg = ctx.createRadialGradient(gx, hY, 0, gx, hY, band * 3);
    cg.addColorStop(0, hexA(col, 0.25 * ga));
    cg.addColorStop(1, hexA(col, 0));
    ctx.fillStyle = cg;
    ctx.fillRect(gx - band * 3, hY, band * 6, band + 4);
    for (let i = 0; i < 90; i++) {
      const p = ((i * 0.618) % 1);
      const y = hY + band * p * p;
      const spread = 8 + p * 150 * (sun ? 1 - f.sunElev * 0.5 : 0.7);
      const x = gx + Math.sin(i * 12.9898 + Math.floor(t * 4 + i * 0.37) * 3.1) * spread;
      const a = ga * 0.55 * (0.25 + 0.75 * Math.abs(Math.sin(t * 5 + i * 1.7)));
      ctx.fillStyle = hexA(col, a);
      ctx.fillRect(x, y, 2 + p * 9, 0.6 + p * 1.1);
    }
    ctx.restore();
  }
}

/** Толща воды: градиент и подповерхностный отсвет */
export function drawUnderwaterBody(f: Frame) {
  const { ctx, W, H, sY, cam } = f;
  const wc = f.loc.water;
  const bottom = cam + H + 10;
  const top = Math.max(sY - f.amp * 2 - 4, cam - 10);
  if (bottom <= top) return;
  const span = f.depthPx(Math.max(f.spot.maxDepth * 1.3, 60));
  const ug = ctx.createLinearGradient(0, sY, 0, sY + span);
  const nk = f.night * 0.78 + (1 - f.day) * 0.08;
  const dk = "#01040a";
  ug.addColorStop(0, mix(mix(wc.surface, f.top, 0.12), dk, nk * 0.85));
  ug.addColorStop(0.18, mix(wc.shallow, dk, nk * 0.9));
  ug.addColorStop(0.55, mix(wc.mid, dk, nk * 0.92));
  ug.addColorStop(1, mix(wc.deep, dk, nk * 0.6));
  ctx.fillStyle = ug;
  ctx.fillRect(0, top, W, bottom - top);
}

/** Световые столбы (после затемнения, аддитивно) */
export function drawShafts(f: Frame) {
  const { ctx, W, H, sY, t, cam } = f;
  const a0 = f.day * (1 - f.cover * 0.55) * (0.6 + f.clarity * 0.4);
  if (a0 < 0.05 || cam > sY + H) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const tilt = (f.sunX - W / 2) / W;
  for (let i = 0; i < 9; i++) {
    const rx = ((i * 0.123 + 0.03) * W * 1.2 + Math.sin(t * 0.15 + i * 2.1) * 50) % (W * 1.1) - W * 0.05;
    const w = 20 + (i % 4) * 22;
    const len = H * (0.45 + (i % 3) * 0.22) * (0.6 + f.clarity * 0.6);
    const rg = ctx.createLinearGradient(0, sY, 0, sY + len);
    const a = 0.085 * a0 * (0.5 + 0.5 * Math.sin(t * 0.6 + i * 1.3));
    rg.addColorStop(0, `rgba(220,255,250,${af(a)})`);
    rg.addColorStop(1, "rgba(220,255,250,0)");
    ctx.fillStyle = rg;
    const sk = -tilt * len * 0.6 + 60;
    ctx.beginPath();
    ctx.moveTo(rx, sY);
    ctx.lineTo(rx + w, sY);
    ctx.lineTo(rx + w * 2 + sk, sY + len);
    ctx.lineTo(rx + sk, sY + len);
    ctx.fill();
  }
  ctx.restore();
}

let bandCanvas: HTMLCanvasElement | null = null;
/** Каустика у поверхности */
export function drawSurfaceCaustics(f: Frame) {
  const { ctx, W, sY, t, cam, H } = f;
  const a = f.day * (1 - f.cover * 0.85) * f.clarity;
  if (a < 0.05 || cam > sY + 120) return;
  const bh = Math.round(110 * f.sc);
  if (!bandCanvas || bandCanvas.width !== Math.ceil(W) || bandCanvas.height !== bh) bandCanvas = makeCanvas(Math.ceil(W), bh);
  const b = ctx2d(bandCanvas);
  b.globalCompositeOperation = "source-over";
  b.clearRect(0, 0, bandCanvas.width, bh);
  tileCaustics(b, 0, 0, W, bh, t, 1.6 * f.sc);
  b.globalCompositeOperation = "destination-in";
  const g = b.createLinearGradient(0, 0, 0, bh);
  g.addColorStop(0, "rgba(0,0,0,0.9)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  b.fillStyle = g;
  b.fillRect(0, 0, W, bh);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.28 * a;
  ctx.drawImage(bandCanvas, 0, sY + 2);
  ctx.restore();
  void H;
}

/** Затемнение по глубине (поверх всех подводных объектов) */
export function drawDepthOverlay(f: Frame) {
  const { ctx, W, H, sY, cam, night } = f;
  const top = Math.max(sY, cam - 5);
  const bottom = cam + H + 5;
  if (bottom <= top) return;
  const L = 22 + f.clarity * 45;
  const storm = f.weather === "storm" ? 0.18 : f.weather === "rain" ? 0.1 : f.fogK * 0.06;
  const dark = mix(f.loc.water.deep, "#000308", 0.65);
  const maxD = Math.max(f.spot.maxDepth * 1.3, 40);
  const span = f.depthPx(maxD);
  const g = ctx.createLinearGradient(0, sY, 0, sY + span);
  const stops = [0, 2, 6, 15, 35, 80, 180, 400, 900, 2000];
  for (const d of stops) {
    if (d > maxD) break;
    const base = 1 - Math.exp(-d / L);
    const a = 1 - (1 - base * 0.97) * (1 - night * 0.62) * (1 - storm);
    g.addColorStop(clamp(f.depthPx(d) / span, 0, 1), hexA(dark, clamp(a, 0, 0.955)));
  }
  g.addColorStop(1, hexA(dark, 0.955));
  ctx.fillStyle = g;
  ctx.fillRect(0, top, W, bottom - top);
}

export interface Ring { x: number; t: number; s: number }

/** Передний полупрозрачный слой воды + пена + круги от дождя */
export function drawSurfaceFront(f: Frame, rings: Ring[]) {
  const { ctx, W, sY, night, t } = f;
  const wc = f.loc.water;
  const slc = mix(mix(wc.surface, "#ffffff", 0.08 * (1 - night)), "#02050c", night * 0.86);
  const depth = 80 * f.sc;
  const sl = ctx.createLinearGradient(0, sY - f.amp, 0, sY + depth);
  sl.addColorStop(0, hexA(slc, 0.75 - night * 0.35));
  sl.addColorStop(1, hexA(slc, 0));
  ctx.beginPath();
  ctx.moveTo(0, sY + depth);
  for (let x = 0; x <= W; x += 8) ctx.lineTo(x, f.waveY(x));
  ctx.lineTo(W, sY + depth);
  ctx.closePath();
  ctx.fillStyle = sl;
  ctx.fill();

  const plankton = f.e.activeEvents.some((a) => a.id === "plankton");
  ctx.beginPath();
  for (let x = 0; x <= W; x += 5) {
    const y = f.waveY(x);
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = plankton ? "rgba(110,255,225,0.85)" : `rgba(${night > 0.5 ? "170,190,210" : "255,255,255"},${af(0.12 + 0.43 * (1 - night))})`;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  // гребни
  if (f.amp > 5) {
    ctx.fillStyle = `rgba(255,255,255,${0.35 + 0.2 * (1 - night)})`;
    for (let x = (t * 30) % 40; x < W; x += 40) {
      const y = f.waveY(x);
      if (f.waveY(x - 6) > y + 0.5 && f.waveY(x + 6) > y + 0.5) {
        ctx.beginPath();
        ctx.ellipse(x, y, 7 + f.amp * 0.6, 1.6, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  // круги
  ctx.lineWidth = 1;
  for (const r of rings) {
    r.t += f.dt;
    const k = r.t / 0.7;
    if (k >= 1) continue;
    ctx.strokeStyle = `rgba(230,240,255,${0.5 * (1 - k)})`;
    ctx.beginPath();
    ctx.ellipse(r.x, f.waveY(r.x) + 1, 2 + k * 9 * r.s, 0.8 + k * 2 * r.s, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}
