export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const smooth = (t: number) => t * t * (3 - 2 * t);
export const sstep = (a: number, b: number, x: number) => smooth(clamp((x - a) / (b - a), 0, 1));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const cache = new Map<string, [number, number, number]>();
function parse(hex: string): [number, number, number] {
  let c = cache.get(hex);
  if (!c) {
    const n = parseInt(hex.slice(1, 7), 16);
    c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    if (cache.size > 4000) cache.clear();
    cache.set(hex, c);
  }
  return c;
}

/** Смешивание двух #rrggbb, результат #rrggbb */
export function mix(a: string, b: string, t: number): string {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const pa = parse(a), pb = parse(b);
  const r = (pa[0] + (pb[0] - pa[0]) * t) | 0;
  const g = (pa[1] + (pb[1] - pa[1]) * t) | 0;
  const bl = (pa[2] + (pb[2] - pa[2]) * t) | 0;
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1);
}

export function hexA(hex: string, a: number) {
  const p = parse(hex);
  return `rgba(${p[0]},${p[1]},${p[2]},${clamp(a, 0, 1).toFixed(3)})`;
}

export function rng(seed: number) {
  let s = (Math.floor(seed * 1000) >>> 0) || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

export function hash1(n: number) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export function vnoise(x: number, seed = 0) {
  const i = Math.floor(x), f = x - i;
  const a = hash1(i + seed * 57.31), b = hash1(i + 1 + seed * 57.31);
  return a + (b - a) * smooth(f);
}

export function fbm(x: number, seed = 0, oct = 4) {
  let v = 0, amp = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) {
    v += vnoise(x * f, seed + i * 13.7) * amp;
    n += amp;
    amp *= 0.5;
    f *= 2.03;
  }
  return v / n;
}

type AnyCanvas = HTMLCanvasElement;
export function makeCanvas(w: number, h: number): AnyCanvas {
  const g = globalThis as unknown as { __makeCanvas?: (w: number, h: number) => AnyCanvas };
  if (g.__makeCanvas) return g.__makeCanvas(Math.max(1, w | 0), Math.max(1, h | 0));
  const c = document.createElement("canvas");
  c.width = Math.max(1, w | 0);
  c.height = Math.max(1, h | 0);
  return c;
}
export const ctx2d = (c: AnyCanvas) => c.getContext("2d") as CanvasRenderingContext2D;

export function tracePoly(ctx: CanvasRenderingContext2D, pts: number[], close = true) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  if (close) ctx.closePath();
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, a = 1) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
  g.addColorStop(0, `rgba(255,255,255,${af(a)})`);
  g.addColorStop(0.18, hexA(color, a));
  g.addColorStop(1, hexA(color, 0));
  const prev = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r * 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = prev;
}

/** Шрифты интерфейса для canvas (устанавливаются из DOM) */
export const FONTS = { sans: "Inter, system-ui, sans-serif", serif: "'Cormorant Garamond', Georgia, serif" };
export function setFonts(sans: string, serif: string) {
  if (sans) FONTS.sans = `${sans}, system-ui, sans-serif`;
  if (serif) FONTS.serif = `${serif}, Georgia, serif`;
}

/** Безопасная альфа для строк rgba(): без экспоненциальной записи */
export const af = (a: number) => (a > 0 ? (a < 1 ? a.toFixed(4) : "1") : "0");

/** Convert the atmosphere module's RGB tuples to the renderer's #rrggbb colors. */
export const rgbHex = (rgb: readonly number[]) => `#${rgb.slice(0, 3).map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;

/** Защита градиентов: некорректный цвет или смещение не должны срывать кадр */
export function installCanvasGuards() {
  const G = (globalThis as unknown as { CanvasGradient?: { prototype: CanvasGradient } }).CanvasGradient;
  if (!G || (G.prototype as unknown as { __zvGuard?: boolean }).__zvGuard) return;
  const orig = G.prototype.addColorStop;
  G.prototype.addColorStop = function (offset: number, color: string) {
    const o = Number.isFinite(offset) ? Math.min(1, Math.max(0, offset)) : 0;
    try {
      orig.call(this, o, color);
    } catch {
      orig.call(this, o, String(color).replace(/-?\d*\.?\d+e[-+]?\d+/gi, "0"));
    }
  };
  (G.prototype as unknown as { __zvGuard?: boolean }).__zvGuard = true;
}
