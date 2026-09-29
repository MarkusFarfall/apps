import type { WeatherId } from "../types";
import type { Frame } from "./frame";
import { clamp, ctx2d, glow, hexA, makeCanvas, mix, rng, smooth, af } from "./util";

// [час, зенит, середина, горизонт]
const SKY: [number, string, string, string][] = [
  [0, "#02040c", "#060c20", "#0e1630"],
  [4.2, "#040818", "#0e1636", "#1e2446"],
  [5.2, "#131c48", "#4a3a6e", "#c0706a"],
  [6.1, "#2a5096", "#9a82b0", "#ffb482"],
  [7.4, "#3a76c2", "#80b0e0", "#e6e4dc"],
  [12, "#1f62ba", "#5a9ee4", "#bedcf0"],
  [16.6, "#2e6ab6", "#7eaadc", "#e8dcc6"],
  [18.5, "#2e4288", "#b06a7a", "#ff9c58"],
  [19.6, "#181e50", "#4a3668", "#c0584a"],
  [20.8, "#050a1c", "#0e1638", "#1c2442"],
  [24, "#02040c", "#060c20", "#0e1630"],
];

export function skyAt(h: number): [string, string, string] {
  for (let i = 0; i < SKY.length - 1; i++) {
    const a = SKY[i], b = SKY[i + 1];
    if (h >= a[0] && h <= b[0]) {
      const t = smooth((h - a[0]) / (b[0] - a[0]));
      return [mix(a[1], b[1], t), mix(a[2], b[2], t), mix(a[3], b[3], t)];
    }
  }
  return [SKY[0][1], SKY[0][2], SKY[0][3]];
}

export const WEATHER_TINT: Record<WeatherId, [string, number]> = {
  clear: ["#8098b0", 0],
  cloudy: ["#8c96a0", 0.34],
  rain: ["#5a646e", 0.6],
  storm: ["#262c36", 0.8],
  fog: ["#b4bcc2", 0.62],
  snow: ["#a8b0ba", 0.5],
};
export const CLOUD_COVER: Record<WeatherId, number> = { clear: 0.22, cloudy: 0.75, rain: 1, storm: 1, fog: 0.4, snow: 0.95 };

interface Cloud {
  x: number;
  y: number;
  w: number;
  h: number;
  speed: number;
  seed: number;
  layer: number;
  sprite: HTMLCanvasElement | null;
}

export class SkyRenderer {
  private W = 0;
  private H = 0;
  private stars: [number, number, number, number, string][] = [];
  private milky: HTMLCanvasElement | null = null;
  private clouds: Cloud[] = [];
  private deck: HTMLCanvasElement | null = null;
  private key = "";
  private meteors: [number, number, number][] = [];
  private gulls: [number, number, number, number][] = [];

  private setup(W: number, H: number) {
    if (W === this.W && H === this.H) return;
    this.W = W;
    this.H = H;
    this.key = "";
    const r = rng(11);
    const hy = H * 0.39;
    const tints = ["#ffffff", "#ffffff", "#dfe8ff", "#fff2dc", "#ffe0d0"];
    this.stars = Array.from({ length: 320 }, () => [r() * W, Math.pow(r(), 1.4) * hy, r() < 0.06 ? 1.8 : r() * 1.2 + 0.4, r() * 6.28, tints[Math.floor(r() * tints.length)]]);
    // Млечный путь
    const mw = makeCanvas(W, hy);
    const m = ctx2d(mw);
    m.translate(W * 0.55, hy * 0.35);
    m.rotate(-0.42);
    const len = W * 0.9;
    const band = m.createLinearGradient(0, -hy * 0.18, 0, hy * 0.18);
    band.addColorStop(0, "rgba(160,170,255,0)");
    band.addColorStop(0.5, "rgba(200,205,255,0.22)");
    band.addColorStop(1, "rgba(160,170,255,0)");
    m.fillStyle = band;
    m.fillRect(-len, -hy * 0.18, len * 2, hy * 0.36);
    for (let i = 0; i < 2600; i++) {
      const x = (r() - 0.5) * len * 2;
      const g = (r() + r() + r() - 1.5) * hy * 0.12;
      m.fillStyle = `rgba(255,255,255,${0.15 + r() * 0.5})`;
      const s = r() * 1.1 + 0.3;
      m.fillRect(x, g, s, s);
    }
    m.globalCompositeOperation = "destination-out";
    for (let i = 0; i < 60; i++) {
      const x = (r() - 0.5) * len * 2;
      const dg = m.createRadialGradient(x, (r() - 0.5) * 8, 0, x, 0, 18 + r() * 30);
      dg.addColorStop(0, "rgba(0,0,0,0.5)");
      dg.addColorStop(1, "rgba(0,0,0,0)");
      m.fillStyle = dg;
      m.beginPath();
      m.ellipse(x, (r() - 0.5) * 8, 40 + r() * 40, 6 + r() * 6, 0, 0, Math.PI * 2);
      m.fill();
    }
    this.milky = mw;
    this.clouds = Array.from({ length: 14 }, (_, i) => {
      const layer = i / 13;
      const w = (120 + r() * 200) * (0.6 + layer * 0.7) * clamp(W / 1280, 0.6, 1.4);
      return { x: r() * W * 1.3 - W * 0.15, y: H * (0.04 + (1 - layer) * 0.22 + r() * 0.05), w, h: w * (0.3 + r() * 0.16), speed: 3 + layer * 9, seed: r() * 1000, layer, sprite: null };
    });
    this.gulls = Array.from({ length: 7 }, () => [r() * W, H * (0.1 + r() * 0.2), r() * 6.28, 0.7 + r() * 0.5]);
  }

  private rebuild(f: Frame, lit: string, shade: string) {
    const sunDir = f.sunX < f.W / 2 ? -1 : 1;
    for (const c of this.clouds) {
      const cw = Math.ceil(c.w * 1.3), ch = Math.ceil(c.h * 1.8);
      const cv = c.sprite && c.sprite.width === cw && c.sprite.height === ch ? c.sprite : makeCanvas(cw, ch);
      const g = ctx2d(cv);
      g.clearRect(0, 0, cw, ch);
      const r = rng(c.seed);
      const base = ch * 0.8;
      const n = 8 + Math.floor(r() * 6);
      const puffs: [number, number, number][] = [];
      for (let i = 0; i < n; i++) {
        const k = i / (n - 1);
        const rad = c.h * (0.28 + r() * 0.28) * (1 - Math.abs(k - 0.5) * 1.1);
        puffs.push([cw * 0.12 + cw * 0.76 * k + (r() - 0.5) * cw * 0.05, base - rad * 0.55 - r() * c.h * 0.2, rad]);
      }
      for (let i = 0; i < 3; i++) {
        const rad = c.h * (0.35 + r() * 0.25);
        puffs.push([cw * (0.35 + r() * 0.3), base - c.h * (0.5 + r() * 0.3), rad]);
      }
      for (const [px, py, pr] of puffs) {
        const gr = g.createRadialGradient(px, py, 0, px, py, pr);
        gr.addColorStop(0, hexA(shade, 1));
        gr.addColorStop(0.65, hexA(shade, 0.92));
        gr.addColorStop(1, hexA(shade, 0));
        g.fillStyle = gr;
        g.beginPath();
        g.arc(px, py, pr, 0, Math.PI * 2);
        g.fill();
      }
      for (const [px, py, pr] of puffs) {
        const lx = px + sunDir * pr * 0.14, ly = py - pr * 0.24, lr = pr * 0.82;
        const gr = g.createRadialGradient(lx, ly - lr * 0.2, 0, lx, ly, lr);
        gr.addColorStop(0, hexA(mix(lit, "#ffffff", 0.2), 1));
        gr.addColorStop(0.55, hexA(lit, 0.85));
        gr.addColorStop(1, hexA(lit, 0));
        g.fillStyle = gr;
        g.beginPath();
        g.arc(lx, ly, lr, 0, Math.PI * 2);
        g.fill();
      }
      g.globalCompositeOperation = "destination-out";
      const fl = g.createLinearGradient(0, base - c.h * 0.12, 0, base + c.h * 0.08);
      fl.addColorStop(0, "rgba(0,0,0,0)");
      fl.addColorStop(1, "rgba(0,0,0,1)");
      g.fillStyle = fl;
      g.fillRect(0, base - c.h * 0.12, cw, ch);
      g.globalCompositeOperation = "source-over";
      c.sprite = cv;
    }
    // сплошная облачность
    const dw = Math.ceil(f.W), dh = Math.ceil(f.hY + 10);
    const deck = this.deck && this.deck.width === dw && this.deck.height === dh ? this.deck : makeCanvas(dw, dh);
    const d = ctx2d(deck);
    d.clearRect(0, 0, dw, dh);
    const r = rng(77);
    for (let i = 0; i < 220; i++) {
      const x = r() * dw * 1.2 - dw * 0.1;
      const y = Math.pow(r(), 0.8) * dh * 0.95;
      const rad = (40 + r() * 110) * (0.6 + (y / dh) * 0.6);
      const col = r() < 0.5 ? shade : mix(shade, lit, 0.35);
      const gr = d.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, hexA(col, 0.55));
      gr.addColorStop(1, hexA(col, 0));
      d.fillStyle = gr;
      d.beginPath();
      d.ellipse(x, y, rad * 1.8, rad * 0.6, 0, 0, Math.PI * 2);
      d.fill();
    }
    this.deck = deck;
  }

  draw(f: Frame) {
    const { ctx, W, H, hY, t, e } = f;
    this.setup(W, H);
    const abyssDark = f.loc.land === "abyss" ? 0.25 : 0;

    const g = ctx.createLinearGradient(0, 0, 0, hY);
    g.addColorStop(0, mix(f.top, "#000000", abyssDark));
    g.addColorStop(0.62, f.mid);
    g.addColorStop(1, f.hor);
    ctx.fillStyle = g;
    ctx.fillRect(0, -40, W, hY + 42);

    // свечение у горизонта со стороны солнца
    if (f.golden > 0.02) {
      const hg = ctx.createRadialGradient(f.sunX, hY, 0, f.sunX, hY, W * 0.7);
      hg.addColorStop(0, `rgba(255,150,80,${af(0.5 * f.golden * (1 - f.cover * 0.6))})`);
      hg.addColorStop(0.4, `rgba(255,120,90,${af(0.18 * f.golden)})`);
      hg.addColorStop(1, "rgba(255,120,90,0)");
      ctx.fillStyle = hg;
      ctx.fillRect(0, 0, W, hY);
    }

    // звёзды
    const starA = f.night * (1 - f.cover * 0.9) * (1 - f.fogK * 0.7);
    if (starA > 0.02) {
      if (this.milky) {
        ctx.globalAlpha = starA * 0.9;
        ctx.drawImage(this.milky, 0, 0);
      }
      for (const [x, y, r, p, c] of this.stars) {
        if (y > hY - 4) continue;
        ctx.globalAlpha = starA * (0.45 + 0.55 * Math.sin(t * (1.5 + (p % 1) * 2) + p)) * clamp(1 - y / hY + 0.25, 0, 1);
        ctx.fillStyle = c;
        ctx.fillRect(x, y, r, r);
        if (r > 1.5) {
          ctx.globalAlpha *= 0.4;
          ctx.fillRect(x - 2, y + r / 2 - 0.3, r + 4, 0.6);
          ctx.fillRect(x + r / 2 - 0.3, y - 2, 0.6, r + 4);
        }
      }
      ctx.globalAlpha = 1;
    }

    // метеоры
    if (e.activeEvents.some((a) => a.id === "meteor")) {
      if (Math.random() < f.dt * 1.6) this.meteors.push([Math.random() * W, Math.random() * H * 0.2, 0]);
      for (const m of this.meteors) {
        m[2] += f.dt;
        const k = m[2] / 0.9;
        const x = m[0] + k * 280, y = m[1] + k * 140;
        const gr = ctx.createLinearGradient(x, y, x - 110, y - 55);
        gr.addColorStop(0, `rgba(255,255,235,${af(1 - k)})`);
        gr.addColorStop(1, "rgba(255,255,255,0)");
        ctx.strokeStyle = gr;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 110, y - 55);
        ctx.stroke();
      }
      this.meteors = this.meteors.filter((m) => m[2] < 0.9);
    }

    this.drawSun(f);
    this.drawMoon(f);

    // облака
    let lit = mix("#f6f8fa", "#ffc488", f.golden * 0.85);
    lit = mix(lit, "#ff9a88", f.golden * 0.25);
    const wt = f.weather;
    if (wt === "rain") lit = mix(lit, "#8c949c", 0.55);
    if (wt === "storm") lit = mix(lit, "#4c525c", 0.72);
    if (wt === "snow" || wt === "cloudy") lit = mix(lit, "#c6ccd4", 0.22);
    if (wt === "fog") lit = mix(lit, "#d0d4d8", 0.3);
    lit = mix(lit, "#1c2232", f.night * 0.88);
    let shade = mix(lit, f.top, 0.4);
    shade = mix(shade, f.golden > 0.1 ? "#7a5a80" : "#46505e", 0.3 + f.golden * 0.2);
    const key = `${lit}|${shade}|${W}|${H}|${f.sunX < W / 2}`;
    if (key !== this.key) {
      this.key = key;
      this.rebuild(f, lit, shade);
    }
    if (f.cover > 0.7 && this.deck && f.quality > 0) {
      ctx.globalAlpha = clamp((f.cover - 0.7) * 3.3, 0, 1) * (wt === "fog" ? 0.5 : 1);
      ctx.drawImage(this.deck, 0, 0);
      ctx.globalAlpha = 1;
    }
    // перистые
    if ((wt === "clear" || wt === "cloudy") && f.night < 0.8) {
      ctx.strokeStyle = hexA(lit, 0.18 * (1 - f.night));
      ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const x0 = ((i * 260 + t * 2) % (W + 400)) - 200, y0 = H * (0.05 + (i % 3) * 0.04);
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.bezierCurveTo(x0 + 60, y0 - 10, x0 + 140, y0 + 6, x0 + 220, y0 - 4);
        ctx.stroke();
      }
    }
    const n = Math.round(clamp(f.cover * 1.25, 0, 1) * this.clouds.length);
    for (let i = 0; i < n; i++) {
      const c = this.clouds[i];
      c.x += (c.speed + e.s.wind * 26) * f.dt * (0.5 + c.layer);
      if (c.x > W + 40) c.x = -c.w * 1.4;
      if (!c.sprite) continue;
      const big = wt === "storm" || wt === "rain" ? 1.35 : 1;
      ctx.globalAlpha = wt === "fog" ? 0.55 : 0.95;
      ctx.drawImage(c.sprite, c.x, c.y - c.h * (big - 1), c.sprite.width * big, c.sprite.height * big);
    }
    ctx.globalAlpha = 1;

    // сумеречные лучи
    if (f.golden > 0.2 && f.sunVis > 0.2 && f.cover > 0.2 && f.cover < 0.98 && f.sunY < hY + 10) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 9; i++) {
        const a = Math.PI + 0.15 + (i / 8) * (Math.PI - 0.3) + Math.sin(t * 0.1 + i) * 0.02;
        const w = 0.03 + (i % 3) * 0.015;
        const L = W * 0.9;
        const gr = ctx.createRadialGradient(f.sunX, f.sunY, 0, f.sunX, f.sunY, L);
        gr.addColorStop(0, `rgba(255,200,140,${af(0.045 * f.golden * f.sunVis)})`);
        gr.addColorStop(1, "rgba(255,200,140,0)");
        ctx.fillStyle = gr;
        ctx.beginPath();
        ctx.moveTo(f.sunX, f.sunY);
        ctx.lineTo(f.sunX + Math.cos(a - w) * L, f.sunY + Math.sin(a - w) * L);
        ctx.lineTo(f.sunX + Math.cos(a + w) * L, f.sunY + Math.sin(a + w) * L);
        ctx.fill();
      }
      ctx.restore();
    }

    this.drawRainbow(f);
    this.drawGulls(f);
  }

  private drawRainbow(f: Frame) {
    const { ctx, e, W, H, hY } = f;
    const ev = e.activeEvents.find((a) => a.id === "rainbow");
    if (!ev || f.sunElev < 0.05) return;
    const left = (ev.endsAt - e.s.minutes) / 90;
    const a = Math.min(1, left * 4, (1 - left) * 6 + 0.2) * 0.26 * (1 - f.night);
    if (a <= 0.01) return;
    const cx = W - f.sunX * 0.6 + W * 0.1, cy = hY + H * 0.1, R = H * 0.42;
    const cols = ["#ff3030", "#ff9020", "#ffe030", "#40e040", "#30a0ff", "#5040ff", "#a040e0"];
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, hY);
    ctx.clip();
    ctx.globalCompositeOperation = "screen";
    const bw = H * 0.011;
    cols.forEach((c, i) => {
      ctx.strokeStyle = hexA(c, a);
      ctx.lineWidth = bw * 1.4;
      ctx.beginPath();
      ctx.arc(cx, cy, R - i * bw, Math.PI * 1.05, Math.PI * 1.95);
      ctx.stroke();
    });
    ctx.globalAlpha = 0.25;
    cols.forEach((c, i) => {
      ctx.strokeStyle = hexA(c, a);
      ctx.lineWidth = bw;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.22 + i * bw, Math.PI * 1.08, Math.PI * 1.92);
      ctx.stroke();
    });
    ctx.restore();
  }

  private drawSun(f: Frame) {
    const { ctx, hY, H } = f;
    if (f.sunElev < -0.08) return;
    const low = 1 - clamp(f.sunElev * 2.2, 0, 1);
    const r = H * 0.028 * (1 + low * 0.25);
    const core = mix("#fffbee", "#ff8a3c", low * 0.85);
    const vis = f.sunVis;
    const halo = ctx.createRadialGradient(f.sunX, f.sunY, 0, f.sunX, f.sunY, H * 0.45);
    halo.addColorStop(0, hexA(mix("#fff2d0", "#ffb070", low), 0.55 * vis));
    halo.addColorStop(0.12, hexA(mix("#ffe0a0", "#ff9050", low), 0.22 * vis));
    halo.addColorStop(1, "rgba(255,180,120,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, f.W, hY);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, -50, f.W, hY + 50);
    ctx.clip();
    ctx.globalAlpha = clamp(vis * 1.4, 0.08, 1);
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.ellipse(f.sunX, f.sunY, r, r * (1 - low * 0.12), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawMoon(f: Frame) {
    if (!f.moonUp) return;
    const { ctx, H, e } = f;
    const mx = f.moonX, my = f.moonY, r = H * 0.022;
    const phase = e.moonIndex / 8;
    const lit = (1 - Math.cos(phase * Math.PI * 2)) / 2;
    const vis = f.moonVis;
    if (vis < 0.02) return;
    const mg = ctx.createRadialGradient(mx, my, r, mx, my, r * 10);
    mg.addColorStop(0, `rgba(190,210,255,${af(0.3 * vis * lit)})`);
    mg.addColorStop(1, "rgba(190,210,255,0)");
    ctx.fillStyle = mg;
    ctx.fillRect(mx - r * 10, my - r * 10, r * 20, r * 20);
    ctx.save();
    ctx.globalAlpha = vis;
    // пепельный свет
    ctx.fillStyle = "rgba(90,100,130,0.35)";
    ctx.beginPath();
    ctx.arc(mx, my, r, 0, Math.PI * 2);
    ctx.fill();
    const k = Math.cos(phase * Math.PI * 2);
    const waxing = phase <= 0.5;
    if (lit > 0.02) {
      ctx.beginPath();
      ctx.arc(mx, my, r, -Math.PI / 2, Math.PI / 2, !waxing);
      ctx.ellipse(mx, my, Math.abs(k) * r, r, 0, Math.PI / 2, -Math.PI / 2, waxing ? k > 0 : k < 0);
      ctx.closePath();
      const mgr = ctx.createRadialGradient(mx - r * 0.3, my - r * 0.3, 0, mx, my, r);
      mgr.addColorStop(0, "#fbfbf2");
      mgr.addColorStop(1, "#d8dccc");
      ctx.fillStyle = mgr;
      ctx.fill();
      ctx.clip();
      ctx.fillStyle = "rgba(150,150,130,0.35)";
      for (const [cx, cy, cr] of [[-0.3, -0.2, 0.26], [0.35, 0.3, 0.18], [0.1, -0.45, 0.12], [-0.1, 0.45, 0.15], [0.45, -0.1, 0.1]]) {
        ctx.beginPath();
        ctx.arc(mx + cx * r, my + cy * r, cr * r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    if (lit > 0.9) glow(ctx, mx, my, r * 0.6, "#c8d8ff", 0.25 * vis);
  }

  private drawGulls(f: Frame) {
    const { ctx, e, W, t } = f;
    const gullsEv = e.activeEvents.some((a) => a.id === "gulls");
    if (e.isNight || f.loc.land === "abyss" || f.weather === "storm") return;
    if (!gullsEv && f.loc.land === "open" && f.spot.feature !== "seamount") return;
    const n = gullsEv || f.spot.feature === "seamount" ? 7 : f.weather === "clear" || f.weather === "cloudy" ? 3 : 1;
    ctx.strokeStyle = mix("#1c242c", f.hor, 0.25 + f.fogK * 0.5);
    ctx.lineCap = "round";
    for (let i = 0; i < n; i++) {
      const gg = this.gulls[i];
      gg[0] += f.dt * (18 + i * 6) * (e.s.wind * 0.8 + 0.6);
      gg[2] += f.dt * (5 + i * 0.3);
      if (gg[0] > W + 40) gg[0] = -40;
      const s = gg[3];
      const gx = gg[0], gy = gg[1] + Math.sin(t * 0.5 + i * 2) * 18;
      const fl = Math.sin(gg[2]) * 6 * s;
      ctx.lineWidth = 1.7 * s;
      ctx.beginPath();
      ctx.moveTo(gx - 11 * s, gy - fl);
      ctx.quadraticCurveTo(gx - 5 * s, gy - 5 * s, gx, gy);
      ctx.quadraticCurveTo(gx + 5 * s, gy - 5 * s, gx + 11 * s, gy - fl);
      ctx.stroke();
    }
  }
}
