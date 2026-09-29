import { getMorph } from "./morph";
import type { FishDef } from "./types";

const rgb = (h: string) => { const n = parseInt(h.slice(1, 7), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const hex = (r: number, g: number, b: number) => "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");

function toHsl([r, g, b]: number[]) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (mx + mn) / 2;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}
function fromHsl(h: number, s: number, l: number) {
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return hex(f(0) * 255, f(8) * 255, f(4) * 255);
}
function shift(c: string, dh: number, ds: number, dl: number) {
  const [h, s, l] = toHsl(rgb(c));
  return fromHsl((h + dh + 1) % 1, Math.max(0.05, Math.min(0.95, s + ds)), Math.max(0.08, Math.min(0.92, l + dl)));
}
const cd = (a: string, b: string) => { const x = rgb(a), y = rgb(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };

/** Визуальное расстояние двух видов: цвет + морфология + узор */
export function visualDistance(a: FishDef, b: FishDef) {
  if (a.shape !== b.shape) return 999;
  const ma = getMorph(a), mb = getMorph(b);
  let d = cd(a.colors.body, b.colors.body) + cd(a.colors.belly, b.colors.belly) * 0.5 + cd(a.colors.fin, b.colors.fin) * 0.7;
  if ((a.pattern ?? "none") !== (b.pattern ?? "none")) d += 60;
  if (ma.tail !== mb.tail) d += 22;
  if (ma.dorsal !== mb.dorsal) d += 22;
  if (ma.jaw !== mb.jaw) d += 10;
  if (ma.barbels !== mb.barbels) d += 18;
  if (ma.scutes !== mb.scutes || ma.hammer !== mb.hammer || ma.thresher !== mb.thresher || ma.ratTail !== mb.ratTail) d += 40;
  d += Math.abs(ma.depth - mb.depth) * 80 + Math.abs(ma.snout - mb.snout) * 30;
  return d;
}

/** Разводит почти одинаковые виды по цвету; порядок определяет, кого сдвигать */
export function ensureDistinct(list: FishDef[], threshold = 70) {
  for (let i = 0; i < list.length; i++) {
    const f = list[i];
    for (let guard = 0; guard < 6; guard++) {
      const twin = list.slice(0, i).find((g) => visualDistance(f, g) < threshold);
      if (!twin) break;
      // направление сдвига — от цвета «близнеца»
      const [h1, , l1] = toHsl(rgb(f.colors.body));
      const [h2, , l2] = toHsl(rgb(twin.colors.body));
      const dh = (h1 >= h2 ? 1 : -1) * 0.045;
      const dl = (l1 >= l2 ? 1 : -1) * 0.06;
      f.colors = {
        ...f.colors,
        body: shift(f.colors.body, dh, 0.06, dl),
        fin: shift(f.colors.fin, dh * 1.4, 0.08, dl * 0.6),
        belly: shift(f.colors.belly, dh * 0.5, 0, dl * 0.4),
        accent: f.colors.accent ? shift(f.colors.accent, dh, 0.05, 0) : shift(f.colors.body, dh * 3, 0.15, -0.12),
      };
    }
  }
}
