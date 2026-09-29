import { getMorph, type TailType } from "./morph";
import type { FishDef, Variant } from "./types";

const inGenus = (f: FishDef, ...g: string[]) => g.includes(f.latin.split(" ")[0]);
const hexA = (c: string, a: number) => {
  if (c.startsWith("rgb")) return c;
  const n = parseInt(c.slice(1, 7), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a.toFixed(3)})`;
};

export interface FishDrawOpts {
  alpha?: number;
  silhouette?: string | null;
  variant?: Variant | null;
  wag?: number; // фаза анимации
  darken?: number; // 0..1 затемнение глубиной
  glowBoost?: number;
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function mix(a: string, b: string, t: number) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = ((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t;
  const g = ((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t;
  const bl = (pa & 255) * (1 - t) + (pb & 255) * t;
  return "#" + ((1 << 24) + ((r | 0) << 16) + ((g | 0) << 8) + (bl | 0)).toString(16).slice(1);
}
export { mix as mixHex };

function colorsFor(f: FishDef, v: Variant | null | undefined) {
  let { body, belly, fin } = f.colors;
  const accent = f.colors.accent ?? fin;
  if (v === "albino") { body = "#f2ece6"; belly = "#ffffff"; fin = "#f0c8c8"; }
  else if (v === "golden") { body = "#e8b020"; belly = "#fff0a0"; fin = "#d09010"; }
  else if (v === "melanist") { body = "#1c1c24"; belly = "#3a3a44"; fin = "#101018"; }
  return { body, belly, fin, accent };
}

// Рыба рисуется носом вправо, центр в (0,0), длина L
export function drawFish(ctx: CanvasRenderingContext2D, f: FishDef, x: number, y: number, L: number, dir: 1 | -1, o: FishDrawOpts = {}) {
  const wag = Math.sin(o.wag ?? 0);
  const sil = o.silhouette ?? null;
  const c = colorsFor(f, o.variant);
  const dk = o.darken ?? 0;
  const col = (hex: string) => (sil ? sil : dk > 0 ? mix(hex, "#02060c", dk) : hex);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  ctx.globalAlpha *= o.alpha ?? 1;
  const glow = f.glow && !sil;
  if (o.variant === "golden" && !sil) {
    ctx.shadowColor = "#ffd040";
    ctx.shadowBlur = L * 0.25;
  }

  const bodyGrad = (h: number) => {
    if (sil) return sil;
    const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    g.addColorStop(0, col(c.body));
    g.addColorStop(0.5, col(mix(c.body, c.belly, 0.35)));
    g.addColorStop(1, col(c.belly));
    return g;
  };

  const rnd = hash(f.id);
  const shape = f.shape;
  const PM = getMorph(f);

  const tail = (tx: number, h: number, forked = true) => {
    ctx.beginPath();
    const w = wag * h * 0.25;
    ctx.moveTo(tx + L * 0.04, 0);
    if (forked) {
      ctx.quadraticCurveTo(tx - L * 0.08, -h * 0.2 + w, tx - L * 0.16, -h * 0.55 + w);
      ctx.quadraticCurveTo(tx - L * 0.09, w * 0.5, tx - L * 0.16, h * 0.55 + w);
      ctx.quadraticCurveTo(tx - L * 0.08, h * 0.2 + w, tx + L * 0.04, 0);
    } else {
      ctx.quadraticCurveTo(tx - L * 0.12, -h * 0.5 + w, tx - L * 0.14, w);
      ctx.quadraticCurveTo(tx - L * 0.12, h * 0.5 + w, tx + L * 0.04, 0);
    }
    if (sil) {
      ctx.fillStyle = sil;
      ctx.fill();
      return;
    }
    const tg = ctx.createLinearGradient(tx + L * 0.04, 0, tx - L * 0.16, 0);
    tg.addColorStop(0, col(mix(c.fin, c.body, 0.35)));
    tg.addColorStop(0.7, col(c.fin));
    tg.addColorStop(1, col(mix(c.fin, "#ffffff", 0.18)));
    ctx.fillStyle = tg;
    ctx.globalAlpha *= 0.94;
    ctx.fill();
    ctx.globalAlpha /= 0.94;
    if (L > 28) {
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = "rgba(0,0,0,0.2)";
      ctx.lineWidth = Math.max(0.4, L * 0.004);
      for (let i = -4; i <= 4; i++) {
        ctx.beginPath();
        ctx.moveTo(tx + L * 0.03, 0);
        ctx.lineTo(tx - L * 0.17, (i / 4) * h * 0.6 + w);
        ctx.stroke();
      }
      ctx.restore();
    }
  };

  const eye = (ex: number, ey: number, r0: number) => {
    if (sil) return;
    const r = r0 * 0.72;
    ctx.beginPath();
    ctx.arc(ex, ey, r * 1.25, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(ex, ey, r, 0, Math.PI * 2);
    ctx.fillStyle = col(o.variant === "albino" ? "#e8c8c0" : mix(c.body, "#c8b070", 0.55));
    ctx.fill();
    ctx.beginPath();
    ctx.arc(ex + r * 0.08, ey, r * 0.66, 0, Math.PI * 2);
    ctx.fillStyle = o.variant === "albino" ? "#8a2028" : "#07080c";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(ex + r * 0.3, ey - r * 0.3, r * 0.16, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fill();
  };

  const pattern = (h: number) => {
    if (sil || !f.pattern || f.pattern === "none") return;
    ctx.save();
    ctx.clip();
    const p = f.pattern;
    ctx.fillStyle = col(c.accent === c.fin ? mix(c.body, "#000000", 0.35) : c.accent);
    ctx.globalAlpha *= 0.55;
    if (p === "spots") {
      const small = shape === "shark" || shape === "billfish" || shape === "ray" ? 0.45 : 1;
      const nSp = Math.round(24 * PM.patDensity);
      for (let i = 0; i < nSp; i++) {
        const sx = (rnd() - 0.5) * L * 0.8, sy = (rnd() - 0.62) * h * 0.85;
        const r = L * (0.01 + rnd() * 0.02) * small * PM.patScale;
        // пятно с мягким ореолом
        ctx.globalAlpha = 0.18 * (o.alpha ?? 1);
        ctx.beginPath();
        ctx.arc(sx, sy, r * 1.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.58 * (o.alpha ?? 1);
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (p === "bars") {
      // полосы-«седла»: сужаются к брюху, чуть наклонены
      const nb = PM.patDensity > 1.1 ? 4 : 3;
      for (let i = -nb; i <= nb; i++) {
        const bx = i * L * (0.33 / nb) + L * 0.02 * PM.patScale;
        ctx.beginPath();
        ctx.moveTo(bx - L * 0.032, -h);
        ctx.lineTo(bx + L * 0.03, -h);
        ctx.quadraticCurveTo(bx + L * 0.02, 0, bx + L * 0.01, h * 0.35);
        ctx.lineTo(bx - L * 0.012, h * 0.35);
        ctx.quadraticCurveTo(bx - L * 0.028, 0, bx - L * 0.032, -h);
        ctx.fill();
      }
    } else if (p === "stripes") {
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        const y0 = i * h * 0.16;
        ctx.moveTo(-L * 0.45, y0 + h * 0.02);
        ctx.quadraticCurveTo(0, y0 - h * 0.05 - Math.abs(i) * h * 0.02, L * 0.4, y0 - h * 0.02);
        ctx.lineTo(L * 0.4, y0 + h * 0.03);
        ctx.quadraticCurveTo(0, y0 + Math.abs(i) * h * 0.01, -L * 0.45, y0 + h * 0.07);
        ctx.fill();
      }
    } else if (p === "gradient") {
      ctx.globalAlpha = 0.35 * (o.alpha ?? 1);
      const g = ctx.createLinearGradient(0, -h / 2, 0, 0);
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(1, "rgba(255,255,255,0.6)");
      ctx.fillStyle = g;
      ctx.fillRect(-L, -h * 0.1, L * 2, h * 0.12);
    }
    ctx.restore();
  };

  const sheen = (h: number) => {
    if (sil) return;
    ctx.save();
    ctx.clip();
    const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    g.addColorStop(0, "rgba(255,255,255,0.28)");
    g.addColorStop(0.35, "rgba(255,255,255,0)");
    g.addColorStop(1, "rgba(0,0,0,0.18)");
    ctx.fillStyle = g;
    ctx.fillRect(-L, -h, L * 2, h * 2);
    ctx.restore();
  };

  const finsTop = (h: number, x0: number, x1: number, tall = 0.35) => {
    ctx.beginPath();
    ctx.moveTo(x0, -h * 0.4);
    ctx.quadraticCurveTo((x0 + x1) / 2 - L * 0.05, -h * (0.5 + tall), x1, -h * 0.38);
    ctx.closePath();
    ctx.fillStyle = col(c.fin);
    ctx.globalAlpha *= 0.92;
    ctx.fill();
    ctx.globalAlpha /= 0.92;
    if (!sil && L > 30) {
      ctx.strokeStyle = "rgba(0,0,0,0.22)";
      ctx.lineWidth = Math.max(0.4, L * 0.004);
      for (let i = 1; i < 6; i++) {
        const bx = x0 + (x1 - x0) * (i / 6);
        ctx.beginPath();
        ctx.moveTo(bx, -h * 0.4);
        ctx.lineTo(bx - L * 0.03, -h * (0.4 + tall * 0.9 * Math.sin((i / 6) * Math.PI)));
        ctx.stroke();
      }
    }
  };
  const finsBottom = (h: number, x0: number, x1: number) => {
    ctx.beginPath();
    ctx.moveTo(x0, h * 0.38);
    ctx.quadraticCurveTo((x0 + x1) / 2 - L * 0.03, h * 0.75, x1, h * 0.36);
    ctx.closePath();
    ctx.fillStyle = col(c.fin);
    ctx.fill();
  };

  const M = getMorph(f);
  const finFill = (alpha = 0.92) => {
    ctx.fillStyle = col(c.fin);
    ctx.globalAlpha *= alpha;
    ctx.fill();
    ctx.globalAlpha /= alpha;
    if (M.finEdge && !sil && L > 24) {
      ctx.strokeStyle = col(M.finEdge);
      ctx.lineWidth = Math.max(0.6, L * 0.007);
      ctx.stroke();
    }
  };
  const rays = (x0: number, y0: number, pts: [number, number][]) => {
    if (sil || L < 30) return;
    ctx.strokeStyle = "rgba(0,0,0,0.2)";
    ctx.lineWidth = Math.max(0.4, L * 0.004);
    for (const [px, py] of pts) {
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(px, py);
      ctx.stroke();
    }
  };

  /** Хвост по типу */
  const tailM = (tx: number, h: number, type: TailType, size = 1) => {
    const w = wag * h * 0.25;
    const len = L * 0.16 * size;
    const span = h * 0.58 * size;
    ctx.beginPath();
    ctx.moveTo(tx + L * 0.04, -h * 0.06);
    switch (type) {
      case "deepfork":
        ctx.quadraticCurveTo(tx - len * 0.45, -span * 0.35 + w, tx - len * 1.15, -span * 1.05 + w);
        ctx.quadraticCurveTo(tx - len * 0.5, -span * 0.2 + w, tx - len * 0.25, w);
        ctx.quadraticCurveTo(tx - len * 0.5, span * 0.2 + w, tx - len * 1.15, span * 1.05 + w);
        ctx.quadraticCurveTo(tx - len * 0.45, span * 0.35 + w, tx + L * 0.04, h * 0.06);
        break;
      case "lunate":
        ctx.lineTo(tx - len * 0.2, -h * 0.05 + w * 0.3);
        ctx.quadraticCurveTo(tx - len * 0.55, -span * 0.7 + w, tx - len * 1.05, -span * 1.15 + w);
        ctx.quadraticCurveTo(tx - len * 0.55, -span * 0.25 + w, tx - len * 0.5, w);
        ctx.quadraticCurveTo(tx - len * 0.55, span * 0.25 + w, tx - len * 1.05, span * 1.15 + w);
        ctx.quadraticCurveTo(tx - len * 0.55, span * 0.7 + w, tx - len * 0.2, h * 0.05 + w * 0.3);
        ctx.lineTo(tx + L * 0.04, h * 0.06);
        break;
      case "round":
        ctx.bezierCurveTo(tx - len * 0.4, -span * 0.9 + w, tx - len * 1.1, -span * 0.7 + w, tx - len * 1.05, w);
        ctx.bezierCurveTo(tx - len * 1.1, span * 0.7 + w, tx - len * 0.4, span * 0.9 + w, tx + L * 0.04, h * 0.06);
        break;
      case "truncate":
        ctx.lineTo(tx - len * 0.85, -span * 0.85 + w);
        ctx.quadraticCurveTo(tx - len * 1.02, w, tx - len * 0.85, span * 0.85 + w);
        ctx.lineTo(tx + L * 0.04, h * 0.06);
        break;
      case "emarg":
        ctx.lineTo(tx - len * 0.95, -span * 0.9 + w);
        ctx.quadraticCurveTo(tx - len * 0.7, w, tx - len * 0.95, span * 0.9 + w);
        ctx.lineTo(tx + L * 0.04, h * 0.06);
        break;
      case "pointed":
        ctx.quadraticCurveTo(tx - len * 0.6, -span * 0.4 + w, tx - len * 1.3, w * 1.2);
        ctx.quadraticCurveTo(tx - len * 0.6, span * 0.4 + w, tx + L * 0.04, h * 0.06);
        break;
      default:
        ctx.quadraticCurveTo(tx - len * 0.5, -span * 0.35 + w, tx - len, -span * 0.95 + w);
        ctx.quadraticCurveTo(tx - len * 0.55, w * 0.5, tx - len, span * 0.95 + w);
        ctx.quadraticCurveTo(tx - len * 0.5, span * 0.35 + w, tx + L * 0.04, h * 0.06);
    }
    ctx.closePath();
    if (sil) {
      ctx.fillStyle = sil;
      ctx.fill();
      return;
    }
    const tg = ctx.createLinearGradient(tx + L * 0.04, 0, tx - len, 0);
    tg.addColorStop(0, col(mix(c.fin, c.body, 0.4)));
    tg.addColorStop(0.65, col(c.fin));
    tg.addColorStop(1, col(mix(c.fin, "#ffffff", 0.2)));
    ctx.fillStyle = tg;
    ctx.fill();
    if (M.finEdge && L > 24) {
      ctx.strokeStyle = col(M.finEdge);
      ctx.lineWidth = Math.max(0.6, L * 0.007);
      ctx.stroke();
    }
    if (L > 28) {
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = "rgba(0,0,0,0.18)";
      ctx.lineWidth = Math.max(0.4, L * 0.004);
      for (let i = -5; i <= 5; i++) {
        ctx.beginPath();
        ctx.moveTo(tx + L * 0.03, 0);
        ctx.lineTo(tx - len * 1.2, (i / 5) * span * 1.2 + w);
        ctx.stroke();
      }
      ctx.restore();
    }
  };

  /** Спинной плавник: форма по типу */
  const dorsalM = (h: number, topY: (x: number) => number) => {
    const H = h * M.dorsalH;
    const fin = (x0: number, x1: number, tall: number, sharp = false) => {
      ctx.beginPath();
      ctx.moveTo(x0, topY(x0) + h * 0.04);
      if (sharp) {
        ctx.lineTo(x0 + (x1 - x0) * 0.25, topY(x0) - H * tall);
        ctx.quadraticCurveTo(x0 + (x1 - x0) * 0.7, topY((x0 + x1) / 2) - H * tall * 0.35, x1, topY(x1) + h * 0.03);
      } else {
        ctx.quadraticCurveTo((x0 + x1) / 2 + (x1 - x0) * 0.1, topY((x0 + x1) / 2) - H * tall * 1.5, x1, topY(x1) + h * 0.03);
      }
      ctx.closePath();
      finFill();
      const pts: [number, number][] = [];
      for (let i = 1; i < 6; i++) { const bx = x0 + (x1 - x0) * (i / 6); pts.push([bx - L * 0.02, topY(bx) - H * tall * Math.sin((i / 6) * Math.PI) * (sharp ? 1.1 - i / 6 : 1)]); }
      for (const [px, py] of pts) rays(px + L * 0.02, topY(px + L * 0.02) + h * 0.02, [[px, py]]);
    };
    switch (M.dorsal) {
      case "double": fin(L * 0.02, L * 0.17, 0.32, true); fin(-L * 0.3, -L * 0.1, 0.24); break;
      case "triple": fin(L * 0.1, L * 0.2, 0.26); fin(-L * 0.08, L * 0.06, 0.22); fin(-L * 0.28, -L * 0.13, 0.2); break;
      case "long": fin(-L * 0.33, L * 0.2, 0.2); break;
      case "low": fin(-L * 0.22, L * 0.02, 0.14); break;
      case "sail": fin(-L * 0.28, L * 0.2, 0.62); break;
      case "filament": {
        fin(-L * 0.12, L * 0.16, 0.3, true);
        if (!sil) {
          ctx.strokeStyle = col(M.finEdge ?? c.fin);
          ctx.lineWidth = Math.max(0.8, L * 0.012);
          ctx.beginPath();
          ctx.moveTo(L * 0.1, topY(L * 0.1) - H * 0.25);
          ctx.quadraticCurveTo(-L * 0.05, topY(0) - H * 1.3 + wag * H * 0.1, -L * 0.4, topY(-L * 0.3) - H * 0.9 + wag * H * 0.2);
          ctx.stroke();
        }
        break;
      }
      case "spiny": {
        fin(L * 0.0, L * 0.2, 0.36, true);
        fin(-L * 0.24, -L * 0.02, 0.28);
        if (!sil && L > 26) {
          ctx.strokeStyle = col(mix(c.fin, "#000000", 0.35));
          ctx.lineWidth = Math.max(0.5, L * 0.006);
          for (let i = 0; i < 6; i++) {
            const bx = L * (0.18 - i * 0.03);
            ctx.beginPath();
            ctx.moveTo(bx, topY(bx));
            ctx.lineTo(bx - L * 0.01, topY(bx) - H * (0.42 - i * 0.03));
            ctx.stroke();
          }
        }
        break;
      }
      default: fin(-L * 0.2, L * 0.12, 0.34);
    }
    if (M.adipose) {
      const ax = -L * 0.3;
      ctx.beginPath();
      ctx.ellipse(ax, topY(ax) - h * 0.02, L * 0.03, h * 0.06, 0, Math.PI, 0);
      finFill(0.9);
    }
  };

  const standard = (hr: number, _forked: boolean) => {
    const h = L * hr * M.depth;
    const hx = L * M.hump;
    const noseY = M.jaw === "up" ? -h * 0.1 : M.jaw === "down" ? h * 0.08 : 0;
    const ped = h * (M.ped / 0.08) * 0.08;
    const sn = M.snout;
    const top = [L * (0.49 - sn * 0.14), -h * (0.62 - sn * 0.28), hx - L * 0.12, -h * 0.64, -L * 0.42, -ped] as const;
    const bot = [-L * 0.42, ped, hx - L * 0.16, h * 0.6 * M.belly, L * (0.47 - sn * 0.12), h * (0.5 - sn * 0.2) * M.belly] as const;
    const bodyPath = () => {
      ctx.beginPath();
      ctx.moveTo(L * 0.5, noseY);
      ctx.bezierCurveTo(top[0], top[1], top[2], top[3], top[4], top[5]);
      ctx.lineTo(bot[0], bot[1]);
      ctx.bezierCurveTo(bot[2], bot[3], bot[4], bot[5], L * 0.5, noseY);
    };
    // высота спины в точке x (для посадки плавников)
    const topY = (xx: number) => {
      const t = Math.max(0, Math.min(1, (L * 0.5 - xx) / (L * 0.92)));
      const u = 1 - t;
      return u * u * u * noseY + 3 * u * u * t * top[1] + 3 * u * t * t * top[3] + t * t * t * top[5];
    };
    const botY = (xx: number) => -topY(xx) * 0.92 * M.belly;
    tailM(-L * 0.42, h * 0.95, M.tail, M.tailSize);
    dorsalM(h, topY);
    // анальный плавник
    ctx.beginPath();
    const ax0 = -L * 0.28, ax1 = -L * 0.06;
    ctx.moveTo(ax0, botY(ax0) - h * 0.03);
    ctx.quadraticCurveTo((ax0 + ax1) / 2, botY((ax0 + ax1) / 2) + h * 0.3 * M.analH, ax1, botY(ax1) - h * 0.03);
    ctx.closePath();
    finFill();
    if (M.finlets && !sil) {
      ctx.fillStyle = col(M.finEdge ?? f.colors.accent ?? c.fin);
      for (let i = 0; i < 6; i++) {
        const fx = -L * (0.3 + i * 0.022);
        for (const sgn of [-1, 1]) {
          const fy = sgn < 0 ? topY(fx) : botY(fx);
          ctx.beginPath();
          ctx.moveTo(fx + L * 0.008, fy);
          ctx.lineTo(fx - L * 0.01, fy + sgn * h * 0.08);
          ctx.lineTo(fx - L * 0.012, fy);
          ctx.fill();
        }
      }
    }
    bodyPath();
    ctx.fillStyle = bodyGrad(h);
    ctx.fill();
    if (!sil) {
      ctx.save();
      bodyPath();
      ctx.clip();
      const dg = ctx.createLinearGradient(0, -h * 0.6, 0, h * 0.1);
      dg.addColorStop(0, col(mix(c.body, "#000000", 0.35)));
      dg.addColorStop(1, hexA(col(c.body), 0));
      ctx.fillStyle = dg;
      ctx.fillRect(-L, -h, L * 2, h * 1.1);
      const bl = ctx.createRadialGradient(L * 0.05, h * 0.32, 0, L * 0.05, h * 0.32, L * 0.4);
      bl.addColorStop(0, hexA(col(mix(c.belly, "#ffffff", 0.3)), 0.55));
      bl.addColorStop(1, hexA(col(c.belly), 0));
      ctx.fillStyle = bl;
      ctx.fillRect(-L, -h, L * 2, h * 2);
      ctx.restore();
    }
    bodyPath();
    pattern(h);
    if (!sil && L > 26) {
      ctx.save();
      bodyPath();
      ctx.clip();
      ctx.strokeStyle = "rgba(0,0,0,0.1)";
      ctx.lineWidth = Math.max(0.5, L * 0.005);
      const sz = Math.max(3, L * 0.042);
      let row = 0;
      for (let yy = -h * 0.55; yy < h * 0.55; yy += sz * 0.7, row++) {
        for (let xx = -L * 0.36; xx < L * 0.24; xx += sz) {
          ctx.beginPath();
          ctx.arc(xx + (row % 2) * sz * 0.5, yy, sz * 0.55, -Math.PI * 0.5, Math.PI * 0.5);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
    if (!sil && (M.lateral || M.lateralScutes)) {
      ctx.beginPath();
      ctx.moveTo(L * 0.27, topY(L * 0.27) * 0.45);
      ctx.bezierCurveTo(L * 0.1, topY(L * 0.1) * 0.55, -L * 0.2, topY(-L * 0.2) * 0.2, -L * 0.42, 0);
      ctx.strokeStyle = M.lateralScutes ? col(mix(c.body, "#000000", 0.3)) : "rgba(255,255,255,0.28)";
      ctx.lineWidth = Math.max(0.6, L * (M.lateralScutes ? 0.018 : 0.007));
      if (M.lateralScutes) ctx.setLineDash([L * 0.012, L * 0.008]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (M.scutes && !sil) {
      ctx.fillStyle = col(mix(c.belly, "#ffffff", 0.2));
      for (let i = 0; i < 9; i++) {
        const sx = L * (0.3 - i * 0.075);
        for (const yy of [topY(sx) + h * 0.06, h * 0.05]) {
          ctx.beginPath();
          ctx.moveTo(sx, yy - L * 0.014);
          ctx.lineTo(sx + L * 0.012, yy);
          ctx.lineTo(sx, yy + L * 0.014);
          ctx.lineTo(sx - L * 0.012, yy);
          ctx.fill();
        }
      }
    }
    bodyPath();
    sheen(h);
    bodyPath();
    ctx.strokeStyle = sil ? sil : "rgba(0,0,0,0.32)";
    ctx.lineWidth = Math.max(0.6, L * 0.008);
    ctx.stroke();
    if (M.headBump) {
      ctx.beginPath();
      ctx.ellipse(L * 0.33, topY(L * 0.33) + h * 0.05, L * 0.1, h * 0.18, -0.3, Math.PI, 0);
      ctx.fillStyle = sil ?? col(mix(c.body, "#000000", 0.08));
      ctx.fill();
    }
    if (!sil) {
      // жаберная крышка
      ctx.beginPath();
      ctx.moveTo(L * 0.27, topY(L * 0.27) * 0.8);
      ctx.quadraticCurveTo(L * 0.2, 0, L * 0.27, botY(L * 0.27) * 0.8);
      ctx.strokeStyle = "rgba(0,0,0,0.28)";
      ctx.lineWidth = Math.max(0.6, L * 0.012);
      ctx.stroke();
      // рот
      ctx.beginPath();
      if (M.jaw === "beak") {
        ctx.moveTo(L * 0.5, noseY - h * 0.08);
        ctx.quadraticCurveTo(L * 0.54, noseY, L * 0.5, noseY + h * 0.08);
        ctx.fillStyle = col(mix(c.fin, "#e8e8e0", 0.5));
        ctx.fill();
      } else {
        const my = M.jaw === "up" ? -h * 0.04 : M.jaw === "down" ? h * 0.12 : h * 0.04;
        ctx.moveTo(L * 0.5, noseY);
        ctx.quadraticCurveTo(L * 0.46, my, L * (0.4 - sn * 0.04), my + h * 0.02);
        ctx.strokeStyle = "rgba(0,0,0,0.4)";
        ctx.lineWidth = Math.max(0.6, L * (M.lips ? 0.018 : 0.008));
        ctx.stroke();
      }
      // усики
      if (M.barbels) {
        ctx.strokeStyle = col(mix(c.belly, c.body, 0.4));
        ctx.lineCap = "round";
        const bx = L * 0.45, by = noseY + h * 0.08;
        const n = M.barbels === 1 ? 1 : 2;
        for (let i = 0; i < n; i++) {
          const ln = M.barbels === 3 ? L * 0.34 : M.barbels === 2 ? L * 0.09 : L * 0.05;
          ctx.lineWidth = Math.max(0.6, L * (M.barbels === 3 ? 0.012 : 0.008));
          ctx.beginPath();
          ctx.moveTo(bx - i * L * 0.02, by);
          ctx.quadraticCurveTo(bx + ln * 0.2 - i * L * 0.02, by + ln * 0.5, bx - ln * (0.2 + i * 0.3) + wag * ln * 0.1, by + ln * (M.barbels === 3 ? 0.8 : 0.9));
          ctx.stroke();
        }
      }
      // грудной плавник
      ctx.beginPath();
      if (M.pectoralWing) {
        ctx.moveTo(L * 0.2, h * 0.05);
        ctx.quadraticCurveTo(L * 0.02, h * 0.9, -L * 0.14, h * (0.55 + wag * 0.1));
        ctx.quadraticCurveTo(L * 0.02, h * 0.3, L * 0.2, h * 0.05);
        ctx.fillStyle = col(M.finEdge ?? f.colors.accent ?? c.fin);
      } else {
        const pl = M.pectoral;
        ctx.moveTo(L * 0.19, h * 0.05);
        ctx.quadraticCurveTo(L * (0.19 - 0.14 * pl), h * (0.28 * pl + wag * 0.08), L * (0.19 - 0.17 * pl), h * 0.12);
        ctx.fillStyle = col(c.fin);
      }
      ctx.globalAlpha *= 0.82;
      ctx.fill();
      ctx.globalAlpha /= 0.82;
    }
    eye(L * (0.37 - sn * 0.03), topY(L * 0.37) * 0.35, Math.max(1.2, h * 0.11 * M.eye));
  };

  const special = inGenus(f, "Hippocampus") ? "seahorse" : inGenus(f, "Ostracion") ? "box" : inGenus(f, "Enteroctopus", "Grimpoteuthis") ? "octopus" : null;
  switch ((special ?? shape) as string) {
    case "seahorse": {
      const s2 = L / 100;
      const bodyC = sil ?? col(c.body);
      ctx.save();
      ctx.rotate(-0.1 + wag * 0.03);
      // хвост-спираль
      ctx.strokeStyle = bodyC;
      ctx.lineCap = "round";
      ctx.lineWidth = 7 * s2;
      ctx.beginPath();
      ctx.moveTo(-4 * s2, 18 * s2);
      ctx.bezierCurveTo(-10 * s2, 36 * s2, 4 * s2, 46 * s2, 8 * s2, 36 * s2);
      ctx.stroke();
      ctx.lineWidth = 4 * s2;
      ctx.beginPath();
      ctx.arc(2 * s2, 38 * s2, 5 * s2, 0, Math.PI * 1.6);
      ctx.stroke();
      // туловище
      ctx.beginPath();
      ctx.moveTo(4 * s2, -26 * s2);
      ctx.bezierCurveTo(16 * s2, -18 * s2, 16 * s2, 6 * s2, 4 * s2, 20 * s2);
      ctx.bezierCurveTo(-8 * s2, 20 * s2, -8 * s2, -6 * s2, -4 * s2, -22 * s2);
      ctx.closePath();
      ctx.fillStyle = sil ?? bodyGrad(40 * s2);
      ctx.fill();
      if (!sil) {
        ctx.strokeStyle = "rgba(0,0,0,0.25)";
        ctx.lineWidth = Math.max(0.5, 0.8 * s2);
        for (let i = 0; i < 9; i++) {
          ctx.beginPath();
          ctx.moveTo(-5 * s2, -18 * s2 + i * 4.4 * s2);
          ctx.lineTo(12 * s2 - Math.abs(i - 4) * 0.8 * s2, -18 * s2 + i * 4.4 * s2);
          ctx.stroke();
        }
      }
      // голова и рыло
      ctx.beginPath();
      ctx.ellipse(6 * s2, -30 * s2, 8 * s2, 6 * s2, 0.4, 0, Math.PI * 2);
      ctx.fillStyle = bodyC;
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(10 * s2, -32 * s2);
      ctx.lineTo(26 * s2, -26 * s2);
      ctx.lineTo(26 * s2, -22 * s2);
      ctx.lineTo(10 * s2, -26 * s2);
      ctx.fill();
      // корона
      ctx.beginPath();
      ctx.moveTo(0, -35 * s2);
      ctx.lineTo(2 * s2, -41 * s2);
      ctx.lineTo(5 * s2, -36 * s2);
      ctx.lineTo(8 * s2, -40 * s2);
      ctx.lineTo(9 * s2, -34 * s2);
      ctx.fill();
      // спинной плавник
      ctx.beginPath();
      ctx.ellipse(-7 * s2, 2 * s2, 4 * s2, 7 * s2, 0.2 + wag * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = sil ?? hexA(col(c.fin), 0.8);
      ctx.fill();
      eye(9 * s2, -31 * s2, 2.6 * s2);
      ctx.restore();
      break;
    }
    case "box": {
      const h = L * 0.44;
      tailM(-L * 0.36, h * 0.8, "round", 0.9);
      const boxPath = () => {
        ctx.beginPath();
        ctx.moveTo(L * 0.4, -h * 0.25);
        ctx.lineTo(L * 0.3, -h * 0.5);
        ctx.lineTo(-L * 0.3, -h * 0.5);
        ctx.lineTo(-L * 0.38, -h * 0.15);
        ctx.lineTo(-L * 0.38, h * 0.15);
        ctx.lineTo(-L * 0.3, h * 0.5);
        ctx.lineTo(L * 0.3, h * 0.5);
        ctx.lineTo(L * 0.4, h * 0.25);
        ctx.closePath();
      };
      boxPath();
      ctx.fillStyle = bodyGrad(h);
      ctx.fill();
      if (!sil) {
        ctx.save();
        boxPath();
        ctx.clip();
        ctx.strokeStyle = "rgba(0,0,0,0.18)";
        ctx.lineWidth = Math.max(0.6, L * 0.008);
        const cs = L * 0.1;
        for (let xx = -L * 0.4; xx < L * 0.4; xx += cs) for (let yy = -h * 0.6; yy < h * 0.6; yy += cs * 0.86) {
          const ox = (Math.round(yy / (cs * 0.86)) % 2) * cs * 0.5;
          ctx.beginPath();
          for (let k = 0; k < 6; k++) {
            const a2 = (k / 6) * Math.PI * 2;
            const px = xx + ox + Math.cos(a2) * cs * 0.5, py = yy + Math.sin(a2) * cs * 0.5;
            k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
          }
          ctx.closePath();
          ctx.stroke();
        }
        ctx.restore();
      }
      boxPath();
      pattern(h);
      boxPath();
      sheen(h);
      ctx.beginPath();
      ctx.ellipse(L * 0.02, h * 0.3, L * 0.07, h * 0.12, 0.4 + wag * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = sil ?? hexA(col(c.fin), 0.8);
      ctx.fill();
      eye(L * 0.26, -h * 0.18, h * 0.13);
      break;
    }
    case "octopus": {
      const s2 = L / 100;
      const bodyC = sil ?? col(c.body);
      ctx.save();
      ctx.rotate(Math.PI / 2 - 0.2);
      ctx.strokeStyle = bodyC;
      ctx.lineCap = "round";
      for (let i = 0; i < 8; i++) {
        const baseA = -0.9 + (i / 7) * 1.8;
        ctx.lineWidth = 5.5 * s2;
        ctx.beginPath();
        let px = Math.sin(baseA) * 10 * s2, py = 8 * s2;
        ctx.moveTo(px, py);
        for (let k = 1; k <= 10; k++) {
          const q = k / 10;
          px += Math.sin(baseA * 1.4 + Math.sin((o.wag ?? 0) * 1.3 + i + q * 4) * 0.6) * 4.2 * s2;
          py += 4 * s2;
          ctx.lineWidth = (5.5 - q * 4.5) * s2;
          ctx.lineTo(px, py);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(px, py);
        }
      }
      ctx.beginPath();
      ctx.ellipse(0, -8 * s2, 16 * s2, 20 * s2, 0, 0, Math.PI * 2);
      ctx.fillStyle = sil ?? bodyGrad(40 * s2);
      ctx.fill();
      if (inGenus(f, "Grimpoteuthis") && !sil) {
        ctx.fillStyle = col(c.fin);
        ctx.beginPath();
        ctx.ellipse(-16 * s2, -14 * s2, 7 * s2, 4 * s2, -0.6 + wag * 0.3, 0, Math.PI * 2);
        ctx.ellipse(16 * s2, -14 * s2, 7 * s2, 4 * s2, 0.6 - wag * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
      pattern(40 * s2);
      eye(-7 * s2, 4 * s2, 3.4 * s2);
      eye(7 * s2, 4 * s2, 3.4 * s2);
      ctx.restore();
      break;
    }
    case "fusiform": standard(0.3, true); break;
    case "deep": standard(0.58, false); break;
    case "flat": {
      // вытянутость: морской язык узкий, калкан почти круглый
      const elong = inGenus(f, "Solea", "Microstomus") ? 0.62 : inGenus(f, "Scophthalmus") ? 1.08 : inGenus(f, "Hippoglossus", "Reinhardtius", "Paralichthys") ? 0.78 : 0.85 * M.depth;
      const h = L * 0.62 * elong;
      const rx = L * (inGenus(f, "Solea") ? 0.44 : 0.4);
      const flatBody = () => {
        ctx.beginPath();
        ctx.moveTo(L * 0.42, h * 0.02);
        ctx.bezierCurveTo(L * 0.42, -h * 0.5, -rx * 0.6, -h * 0.55, -rx, -h * 0.06);
        ctx.lineTo(-rx, h * 0.06);
        ctx.bezierCurveTo(-rx * 0.6, h * 0.55, L * 0.38, h * 0.48, L * 0.42, h * 0.02);
      };
      // кайма плавников
      ctx.save();
      ctx.scale(1.12, 1.18);
      flatBody();
      ctx.restore();
      ctx.fillStyle = col(c.fin);
      ctx.fill();
      tailM(-rx + L * 0.02, h * 0.55, inGenus(f, "Hippoglossus", "Reinhardtius") ? "emarg" : M.tail === "round" || M.tail === "truncate" ? M.tail : "round", 0.9);
      flatBody();
      ctx.fillStyle = bodyGrad(h);
      ctx.fill();
      pattern(h);
      if (!sil) {
        // бугорки у калкана, точки на кайме у остальных
        ctx.fillStyle = col(mix(c.body, "#000000", 0.3));
        const n = inGenus(f, "Scophthalmus") ? 22 : 10;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          ctx.beginPath();
          ctx.arc(Math.cos(a) * rx * (inGenus(f, "Scophthalmus") ? 0.55 : 1.08), Math.sin(a) * h * (inGenus(f, "Scophthalmus") ? 0.3 : 0.58), L * 0.012, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.beginPath();
        ctx.moveTo(L * 0.3, 0);
        ctx.quadraticCurveTo(0, -h * 0.05, -rx, 0);
        ctx.strokeStyle = "rgba(255,255,255,0.2)";
        ctx.lineWidth = Math.max(0.6, L * 0.006);
        ctx.stroke();
      }
      flatBody();
      sheen(h);
      const ey = inGenus(f, "Scophthalmus") ? -h * 0.18 : -h * 0.12;
      eye(L * 0.28, ey, h * 0.08 * M.eye);
      eye(L * 0.22, ey + h * 0.13, h * 0.075 * M.eye);
      break;
    }
    case "eel":
    case "long": {
      const eel = shape === "eel";
      const h = L * (eel ? 0.1 : 0.15);
      const seg = 22;
      const pts: [number, number][] = [];
      for (let i = 0; i <= seg; i++) {
        const t = i / seg;
        const px = L * 0.5 - t * L;
        const amp = eel ? h * 0.9 * t : h * 0.25 * t * t;
        pts.push([px, Math.sin((o.wag ?? 0) * 1.2 - t * 6) * amp]);
      }
      const width = (t: number) => {
        if (M.ratTail) return h * (t < 0.12 ? 0.35 + t * 3 : Math.max(0.03, 0.72 * (1 - (t - 0.12) / 0.88) ** 1.6));
        return eel ? h * (0.5 - 0.35 * t) * M.depth : h * (t < 0.15 ? t / 0.15 * 0.5 : 0.5 - 0.3 * (t - 0.15)) * M.depth;
      };
      // спинной плавник
      if (eel) {
        ctx.beginPath();
        for (let i = 3; i <= seg; i++) {
          const [px, py] = pts[i];
          const w = width(i / seg) + h * 0.3;
          i === 3 ? ctx.moveTo(px, py - w) : ctx.lineTo(px, py - w);
        }
        for (let i = seg; i >= 3; i--) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.fillStyle = col(c.fin);
        ctx.fill();
      } else if (!M.ratTail) {
        tailM(-L * 0.47, h * 1.5, M.scutes ? "fork" : M.tail, 0.8);
        // спинной плавник вытянутых
        const dx = M.dorsal === "low" ? -L * 0.28 : -L * 0.1;
        ctx.beginPath();
        ctx.moveTo(dx + L * 0.1, -width(0.4) - h * 0.02);
        ctx.quadraticCurveTo(dx, -h * (0.9 * M.dorsalH), dx - L * 0.1, -width(0.62));
        ctx.closePath();
        finFill();
      } else {
        // долгохвост: высокий первый спинной, хвост — нить
        ctx.beginPath();
        ctx.moveTo(L * 0.28, -h * 0.55);
        ctx.lineTo(L * 0.22, -h * 1.5);
        ctx.lineTo(L * 0.14, -h * 0.6);
        ctx.closePath();
        finFill();
      }
      ctx.beginPath();
      for (let i = 0; i <= seg; i++) {
        const [px, py] = pts[i];
        const w = width(i / seg);
        i === 0 ? ctx.moveTo(px + L * M.snoutLen, py + (M.scutes ? h * 0.08 : 0)) : ctx.lineTo(px, py - w);
      }
      for (let i = seg; i >= 1; i--) {
        const [px, py] = pts[i];
        ctx.lineTo(px, py + width(i / seg));
      }
      ctx.closePath();
      ctx.fillStyle = bodyGrad(h);
      ctx.fill();
      pattern(h);
      if (!sil && M.scutes) {
        ctx.fillStyle = col(mix(c.belly, "#ffffff", 0.25));
        for (let i = 2; i < seg - 2; i += 2) {
          const [px, py] = pts[i];
          for (const off of [-width(i / seg) * 0.85, 0]) {
            ctx.beginPath();
            ctx.moveTo(px, py + off - L * 0.012);
            ctx.lineTo(px + L * 0.012, py + off);
            ctx.lineTo(px, py + off + L * 0.012);
            ctx.lineTo(px - L * 0.012, py + off);
            ctx.fill();
          }
        }
      }
      if (!sil && M.barbels) {
        ctx.strokeStyle = col(mix(c.belly, c.body, 0.4));
        ctx.lineWidth = Math.max(0.6, L * 0.006);
        for (let i = 0; i < 2; i++) {
          ctx.beginPath();
          ctx.moveTo(L * (0.5 + M.snoutLen * 0.5) - i * L * 0.015, h * 0.2);
          ctx.lineTo(L * (0.49 + M.snoutLen * 0.5) - i * L * 0.02, h * 0.62);
          ctx.stroke();
        }
      }
      eye(L * 0.4, pts[2][1] - h * 0.15, Math.max(1, h * 0.18 * M.eye));
      if (eel && f.id === "gulper" && !sil) {
        ctx.beginPath();
        ctx.moveTo(L * 0.5, 0);
        ctx.quadraticCurveTo(L * 0.35, h * 2.2, L * 0.15, h * 0.4);
        ctx.fillStyle = col(c.belly);
        ctx.fill();
      }
      if (glow) {
        const [tx, ty] = pts[seg];
        glowDot(ctx, tx, ty, h * 0.6 * (o.glowBoost ?? 1), f.glow!);
      }
      break;
    }
    case "shark":
    case "billfish": {
      const h = L * (shape === "shark" ? 0.22 : 0.2);
      // хвост
      ctx.beginPath();
      const w = wag * h * 0.3;
      ctx.moveTo(-L * 0.36, 0);
      if (shape === "shark" && M.thresher) {
        ctx.quadraticCurveTo(-L * 0.6, -h * 0.6 + w, -L * 0.95, -h * 1.3 + w * 2);
        ctx.quadraticCurveTo(-L * 0.6, -h * 0.35 + w, -L * 0.44, h * 0.1);
        ctx.lineTo(-L * 0.5, h * 0.45 + w);
      } else if (shape === "shark" && M.tail === "lunate") {
        ctx.lineTo(-L * 0.53, -h * 1.05 + w);
        ctx.quadraticCurveTo(-L * 0.45, 0, -L * 0.53, h * 0.95 + w);
      } else if (shape === "shark" && M.tail === "pointed") {
        ctx.lineTo(-L * 0.55, -h * 0.55 + w);
        ctx.quadraticCurveTo(-L * 0.47, 0, -L * 0.48, h * 0.3 + w);
      } else {
        ctx.lineTo(-L * 0.52, -h * 1.0 + w);
        ctx.quadraticCurveTo(-L * 0.44, 0, -L * 0.5, h * (shape === "shark" ? 0.5 : 0.9) + w);
      }
      ctx.closePath();
      ctx.fillStyle = col(c.fin);
      ctx.fill();
      // спинной
      ctx.beginPath();
      if (shape === "billfish") {
        ctx.moveTo(L * 0.25, -h * 0.4);
        ctx.quadraticCurveTo(L * 0.1, -h * (f.id === "sailfish" ? 2.4 : 1.4), -L * 0.2, -h * 0.35);
      } else {
        const dh = 1.25 * M.dorsalH;
        ctx.moveTo(L * 0.08, -h * 0.4);
        ctx.lineTo(-L * 0.04 - (1 - M.snout) * L * 0.03, -h * dh);
        ctx.lineTo(-L * 0.1, -h * 0.35);
        // второй спинной и анальный
        ctx.moveTo(-L * 0.24, -h * 0.28);
        ctx.lineTo(-L * 0.28, -h * (0.28 + 0.3 * M.dorsalH));
        ctx.lineTo(-L * 0.31, -h * 0.22);
      }
      ctx.fillStyle = col(shape === "billfish" && f.colors.accent ? c.accent : c.fin);
      ctx.fill();
      // тело
      const body = () => {
        ctx.beginPath();
        const nose = L * (shape === "billfish" ? 0.38 : 0.5 + M.snoutLen);
        const sk = shape === "shark" ? 1 - M.snout : 0.3;
        const dp = shape === "shark" ? M.depth : 1;
        ctx.moveTo(nose, shape === "shark" ? h * 0.05 : 0);
        ctx.bezierCurveTo(L * (0.35 + sk * 0.12), -h * (0.4 + sk * 0.35) * dp, -L * 0.2, -h * 0.55 * dp, -L * 0.4, -h * 0.05);
        ctx.lineTo(-L * 0.4, h * 0.05);
        ctx.bezierCurveTo(-L * 0.2, h * 0.5 * dp, L * (0.35 + sk * 0.1), h * (0.4 + sk * 0.2) * dp, nose, shape === "shark" ? h * 0.05 : 0);
      };
      body();
      ctx.fillStyle = bodyGrad(h);
      ctx.fill();
      body();
      pattern(h);
      body();
      sheen(h);
      if (shape === "billfish") {
        ctx.beginPath();
        ctx.moveTo(L * 0.36, -h * 0.12);
        ctx.lineTo(L * 0.62, -h * 0.02);
        ctx.lineTo(L * 0.36, h * 0.08);
        ctx.fillStyle = col(c.body);
        ctx.fill();
      }
      // грудной
      ctx.beginPath();
      ctx.moveTo(L * 0.18, h * 0.3);
      ctx.lineTo(L * 0.02, h * (1.0 + wag * 0.1));
      ctx.lineTo(L * 0.08, h * 0.3);
      ctx.fillStyle = col(c.fin);
      ctx.fill();
      if (shape === "shark" && !sil) {
        ctx.strokeStyle = "rgba(0,0,0,0.3)";
        ctx.lineWidth = Math.max(0.5, L * 0.006);
        for (let i = 0; i < M.gills; i++) {
          ctx.beginPath();
          ctx.moveTo(L * (0.27 - i * 0.02), -h * 0.2);
          ctx.lineTo(L * (0.26 - i * 0.02), h * 0.2);
          ctx.stroke();
        }
        if (M.hammer) {
          ctx.fillStyle = col(c.body);
          ctx.beginPath();
          ctx.ellipse(L * 0.47, 0, L * 0.035, h * 0.75, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        if (f.id === "cookiecutter") {
          ctx.fillStyle = col(mix(c.body, "#000000", 0.5));
          ctx.fillRect(L * 0.18, -h * 0.4, L * 0.04, h * 0.8);
        }
      }
      eye(L * 0.36, -h * 0.12, Math.max(1, h * 0.1));
      break;
    }
    case "angler": {
      const h = L * 0.62;
      tail(-L * 0.4, h * 0.5, false);
      ctx.beginPath();
      ctx.moveTo(L * 0.45, -h * 0.05);
      ctx.bezierCurveTo(L * 0.4, -h * 0.75, -L * 0.25, -h * 0.55, -L * 0.4, 0);
      ctx.bezierCurveTo(-L * 0.25, h * 0.5, L * 0.4, h * 0.65, L * 0.48, h * 0.18);
      ctx.closePath();
      ctx.fillStyle = bodyGrad(h);
      ctx.fill();
      pattern(h);
      // пасть
      if (!sil) {
        ctx.beginPath();
        ctx.moveTo(L * 0.48, h * 0.02);
        ctx.quadraticCurveTo(L * 0.25, h * 0.2, L * 0.1, h * 0.08);
        ctx.strokeStyle = "#000";
        ctx.lineWidth = Math.max(1, L * 0.02);
        ctx.stroke();
        ctx.fillStyle = "#e8e0d0";
        for (let i = 0; i < 6; i++) {
          const tx = L * (0.44 - i * 0.055);
          const ty = h * (0.05 + Math.sin(i / 5 * Math.PI) * 0.12);
          ctx.beginPath();
          ctx.moveTo(tx - L * 0.012, ty);
          ctx.lineTo(tx, ty + h * 0.09);
          ctx.lineTo(tx + L * 0.012, ty);
          ctx.fill();
        }
      }
      // удочка
      const lx = L * 0.55 + wag * L * 0.03, ly = -h * 0.7;
      ctx.beginPath();
      ctx.moveTo(L * 0.2, -h * 0.4);
      ctx.quadraticCurveTo(L * 0.3, -h * 0.9, lx, ly);
      ctx.strokeStyle = col(c.fin);
      ctx.lineWidth = Math.max(0.8, L * 0.015);
      ctx.stroke();
      if (glow) glowDot(ctx, lx, ly, L * 0.08 * (o.glowBoost ?? 1), f.glow!);
      else {
        ctx.beginPath();
        ctx.arc(lx, ly, L * 0.03, 0, Math.PI * 2);
        ctx.fillStyle = col(c.accent);
        ctx.fill();
      }
      eye(L * 0.22, -h * 0.25, h * 0.07);
      break;
    }
    case "squid": {
      const h = L * 0.2;
      // щупальца назад (вправо — голова, влево — мантия?) мантия вперёд, щупальца сзади
      ctx.strokeStyle = sil ? sil : col(c.belly);
      ctx.lineCap = "round";
      for (let i = 0; i < 8; i++) {
        ctx.beginPath();
        ctx.moveTo(-L * 0.05, (i - 3.5) * h * 0.08);
        const len = i < 2 ? 0.55 : 0.4;
        for (let k = 1; k <= 8; k++) {
          const t = k / 8;
          ctx.lineTo(-L * 0.05 - t * L * len, (i - 3.5) * h * 0.12 + Math.sin((o.wag ?? 0) * 1.5 + t * 5 + i) * h * 0.35 * t);
        }
        ctx.lineWidth = Math.max(0.8, h * (i < 2 ? 0.08 : 0.12));
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(L * 0.5, 0);
      ctx.bezierCurveTo(L * 0.3, -h * 0.9, -L * 0.05, -h * 0.6, -L * 0.08, 0);
      ctx.bezierCurveTo(-L * 0.05, h * 0.6, L * 0.3, h * 0.9, L * 0.5, 0);
      ctx.fillStyle = bodyGrad(h);
      ctx.fill();
      pattern(h);
      ctx.beginPath();
      ctx.moveTo(L * 0.5, 0);
      ctx.lineTo(L * 0.36, -h * 0.75);
      ctx.lineTo(L * 0.32, 0);
      ctx.lineTo(L * 0.36, h * 0.75);
      ctx.closePath();
      ctx.fillStyle = col(c.fin);
      ctx.fill();
      eye(-L * 0.02, -h * 0.1, h * 0.22);
      break;
    }
    case "puffer": {
      const r = L * 0.34;
      tail(-r * 1.1, r * 0.8, false);
      if (!sil) {
        ctx.strokeStyle = col(c.fin);
        ctx.lineWidth = Math.max(0.6, L * 0.012);
        for (let i = 0; i < 20; i++) {
          const a = (i / 20) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9);
          ctx.lineTo(Math.cos(a) * r * 1.22, Math.sin(a) * r * 1.22);
          ctx.stroke();
        }
      }
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = bodyGrad(r * 2);
      ctx.fill();
      pattern(r * 2);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      sheen(r * 2);
      eye(r * 0.55, -r * 0.25, r * 0.2);
      break;
    }
    case "ray": {
      const h = L * 0.8;
      ctx.beginPath();
      ctx.moveTo(-L * 0.1, 0);
      ctx.quadraticCurveTo(-L * 0.5, wag * h * 0.1, -L * 0.75, wag * h * 0.15);
      ctx.strokeStyle = sil ? sil : col(c.fin);
      ctx.lineWidth = Math.max(0.8, L * 0.02);
      ctx.stroke();
      const flap = wag * h * 0.12;
      ctx.beginPath();
      ctx.moveTo(L * 0.42, 0);
      ctx.quadraticCurveTo(L * 0.2, -h * 0.2, 0, -h * 0.5 + flap);
      ctx.quadraticCurveTo(-L * 0.08, -h * 0.2, -L * 0.2, 0);
      ctx.quadraticCurveTo(-L * 0.08, h * 0.2, 0, h * 0.5 - flap);
      ctx.quadraticCurveTo(L * 0.2, h * 0.2, L * 0.42, 0);
      ctx.fillStyle = bodyGrad(h);
      ctx.fill();
      pattern(h);
      eye(L * 0.28, -h * 0.06, h * 0.035);
      break;
    }
    case "blob": {
      const h = L * 0.6;
      tail(-L * 0.4, h * 0.4, false);
      ctx.beginPath();
      ctx.moveTo(L * 0.45, h * 0.05);
      ctx.bezierCurveTo(L * 0.5, -h * 0.7, -L * 0.3, -h * 0.5, -L * 0.4, 0);
      ctx.bezierCurveTo(-L * 0.3, h * 0.45, L * 0.4, h * 0.55, L * 0.45, h * 0.05);
      ctx.fillStyle = bodyGrad(h);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(L * 0.45, h * 0.05);
      ctx.bezierCurveTo(L * 0.5, -h * 0.7, -L * 0.3, -h * 0.5, -L * 0.4, 0);
      ctx.bezierCurveTo(-L * 0.3, h * 0.45, L * 0.4, h * 0.55, L * 0.45, h * 0.05);
      sheen(h);
      if (!sil) {
        ctx.beginPath();
        ctx.ellipse(L * 0.42, h * 0.02, L * 0.08, h * 0.12, 0.3, 0, Math.PI * 2);
        ctx.fillStyle = col(mix(c.body, "#c06060", 0.4));
        ctx.fill();
        ctx.beginPath();
        ctx.arc(L * 0.3, h * 0.28, L * 0.1, Math.PI * 1.1, Math.PI * 1.9);
        ctx.strokeStyle = "rgba(60,20,20,0.6)";
        ctx.lineWidth = Math.max(0.8, L * 0.015);
        ctx.stroke();
      }
      eye(L * 0.28, -h * 0.12, h * 0.05);
      break;
    }
  }

  if (glow && shape !== "angler" && shape !== "eel" && shape !== "long") {
    // фотофоры вдоль брюха
    for (let i = 0; i < 6; i++) glowDot(ctx, L * (0.3 - i * 0.12), L * 0.1, L * 0.035 * (o.glowBoost ?? 1), f.glow!);
  }
  ctx.restore();
}

export function glowDot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.15, color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r * 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Приблизительная «экранная» длина по весу (для анимации в сцене)
export function fishScreenLen(f: FishDef, weight: number, scale = 1) {
  const base = Math.cbrt(Math.max(0.01, weight)) * 34;
  const shapeMul = f.shape === "eel" || f.shape === "long" ? 1.8 : f.shape === "billfish" ? 1.5 : f.shape === "ray" ? 1.1 : 1;
  return Math.min(260, Math.max(14, base * shapeMul)) * scale;
}

/** Только свечение (рисуется поверх затемнения глубиной) */
export function drawFishGlow(ctx: CanvasRenderingContext2D, f: FishDef, x: number, y: number, L: number, dir: 1 | -1, wag = 0, boost = 1) {
  if (!f.glow) return;
  const pts: [number, number, number][] = [];
  if (f.shape === "angler") pts.push([L * 0.55 + Math.sin(wag) * L * 0.03, -L * 0.62 * 0.7, L * 0.08]);
  else if (f.shape === "eel" || f.shape === "long") pts.push([-L * 0.5, Math.sin(wag * 1.2 - 6) * L * 0.09, L * 0.06]);
  else for (let i = 0; i < 6; i++) pts.push([L * (0.3 - i * 0.12), L * 0.1, L * 0.035]);
  for (const [px, py, r] of pts) glowDot(ctx, x + px * dir, y + py, r * boost, f.glow);
}
