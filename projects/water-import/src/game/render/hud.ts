import { depthToU, type SonarBand } from "../engine";
import { RARITY_INFO } from "../fish";
import { bedFrac } from "../world";
import type { Frame } from "./frame";
import { clamp, FONTS, hash1, roundRect } from "./util";

const INK = "#e6e1d6";
const MUTED = "rgba(230,225,214,0.55)";
const DIM = "rgba(230,225,214,0.32)";
const LINE = "rgba(230,225,214,0.12)";
const BRASS = "#c8a46a";
const BAD = "#c9735c";
const OK = "#86b494";

function spacing(ctx: CanvasRenderingContext2D, px: number) {
  (ctx as unknown as { letterSpacing?: string }).letterSpacing = `${px}px`;
}
function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, align: CanvasTextAlign = "left", color = MUTED) {
  ctx.font = `500 9.5px ${FONTS.sans}`;
  spacing(ctx, 1.8);
  ctx.textAlign = align;
  ctx.fillStyle = color;
  ctx.fillText(text.toUpperCase(), x, y);
  spacing(ctx, 0);
}
function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  roundRect(ctx, x, y, w, h, 3);
  ctx.fillStyle = "rgba(7,13,21,0.82)";
  ctx.fill();
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1;
  ctx.stroke();
}

/** Индикатор, где поплавок, если он вне кадра */
export function drawBobberPointer(f: Frame) {
  const { ctx, e, sY, cam, W, t } = f;
  if (e.phase !== "bite" && e.phase !== "waiting") return;
  const y = sY - cam;
  if (y > f.topRes + 10) return;
  const x = W * e.castNX();
  const py = f.topRes + 18;
  ctx.save();
  ctx.fillStyle = e.phase === "bite" ? `rgba(227,201,150,${0.7 + Math.sin(t * 12) * 0.3})` : "rgba(230,225,214,0.5)";
  ctx.beginPath();
  ctx.moveTo(x, py - 8);
  ctx.lineTo(x - 6, py);
  ctx.lineTo(x + 6, py);
  ctx.fill();
  label(ctx, e.phase === "bite" ? "поклёвка" : "поплавок", x, py + 13, "center", e.phase === "bite" ? BRASS : DIM);
  ctx.restore();
}

export function drawRuler(f: Frame) {
  const { ctx, W, H, cam, sY, e } = f;
  const x = W - 34;
  const marks = [1, 2, 5, 10, 15, 20, 30, 45, 60, 80, 100, 120, 160, 250, 420, 600, 1000, 1500, 2000];
  ctx.save();
  const surf = sY - cam;
  const top = Math.max(0, surf);
  if (surf < H) {
    ctx.strokeStyle = "rgba(230,225,214,0.18)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 0.5, top);
    ctx.lineTo(x + 0.5, H);
    ctx.stroke();
  }
  ctx.font = `500 10px ${FONTS.sans}`;
  ctx.textAlign = "right";
  for (const m of marks) {
    if (m > f.spot.maxDepth * 1.05) break;
    const y = sY + f.depthPx(m) - cam;
    if (y < surf + 12 || y < f.topRes || y > H - f.botRes + 20) continue;
    const reach = m <= e.line.value;
    ctx.fillStyle = reach ? "rgba(230,225,214,0.6)" : "rgba(201,115,92,0.7)";
    ctx.fillRect(x - 4, Math.round(y), 5, 1);
    ctx.fillText(`${m}`, x - 8, y + 3.5);
  }
  if (["sinking", "waiting", "bite", "fight"].includes(e.phase)) {
    const y = sY + f.depthPx(e.hookDepth) - cam;
    ctx.fillStyle = BRASS;
    ctx.beginPath();
    ctx.moveTo(x + 2, y);
    ctx.lineTo(x + 9, y - 4.5);
    ctx.lineTo(x + 9, y + 4.5);
    ctx.fill();
    ctx.font = `600 12px ${FONTS.sans}`;
    ctx.fillStyle = "#f1ebdd";
    ctx.fillText(`${e.hookDepth < 10 ? e.hookDepth.toFixed(1) : Math.round(e.hookDepth)} м`, x - 8, y - 8);
  }
  ctx.restore();
}

export function drawPower(f: Frame) {
  const { ctx, W, H, e } = f;
  if (e.phase !== "charging") return;
  const w = f.compact ? Math.min(380, W - 24) : Math.min(420, W * 0.5), h = 64;
  const x0 = W / 2 - w / 2, y0 = H - f.botRes - h - 22;
  ctx.save();
  panel(ctx, x0, y0, w, h);
  label(ctx, "Сила заброса", x0 + 16, y0 + 20);
  const bed = e.bedAt(e.castNX(0.15 + e.power * 0.85));
  ctx.font = `500 12px ${FONTS.sans}`;
  ctx.textAlign = "right";
  ctx.fillStyle = INK;
  ctx.fillText(`${Math.round(e.power * 100)} %   ·   дно ≈ ${bed < 10 ? bed.toFixed(1) : Math.round(bed)} м`, x0 + w - 16, y0 + 20);
  const bx = x0 + 16, bw = w - 32, by = y0 + 34;
  // профиль дна вдоль дистанции
  ctx.strokeStyle = "rgba(143,179,200,0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= 50; i++) {
    const p = i / 50;
    const d = bedFrac(f.spot, e.castNX(0.15 + p * 0.85));
    const y = by + 6 + d * 16;
    if (i === 0) ctx.moveTo(bx + p * bw, y);
    else ctx.lineTo(bx + p * bw, y);
  }
  ctx.stroke();
  ctx.fillStyle = "rgba(230,225,214,0.14)";
  ctx.fillRect(bx, by, bw, 2);
  ctx.fillStyle = BRASS;
  ctx.fillRect(bx, by, bw * e.power, 2);
  const mx = bx + bw * e.power;
  ctx.fillRect(mx - 0.5, by - 5, 1.5, 12);
  ctx.restore();
}

export function drawFightPanel(f: Frame) {
  const { ctx, W, H, e, t } = f;
  const h = e.hooked;
  if (e.phase !== "fight" || !h) return;
  const w = f.compact ? Math.min(430, W - (f.land ? 250 : 24)) : Math.min(480, W * 0.56), ph = 92;
  const x0 = W / 2 - w / 2, y0 = H - f.botRes - ph - 8;
  ctx.save();
  panel(ctx, x0, y0, w, ph);
  if (h.overload > 0.05) {
    roundRect(ctx, x0, y0, w, ph, 3);
    ctx.strokeStyle = `rgba(201,115,92,${0.4 + Math.sin(t * 30) * 0.3})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  const known = !!e.s.codex[h.fish.id];
  label(ctx, "Вываживание", x0 + 18, y0 + 22);
  ctx.font = `500 18px ${FONTS.serif}`;
  ctx.textAlign = "right";
  ctx.fillStyle = known ? "#f1ebdd" : MUTED;
  ctx.fillText(known ? h.fish.name : "Неизвестный вид", x0 + w - 18, y0 + 24);
  if (known) {
    ctx.fillStyle = RARITY_INFO[h.fish.rarity].color;
    const tw = ctx.measureText(h.fish.name).width;
    ctx.beginPath();
    ctx.arc(x0 + w - 26 - tw, y0 + 19, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // натяжение
  const bx = x0 + 18, bw = w - 36, by = y0 + 40;
  const zones: [number, number, string][] = [[0, 0.15, "rgba(143,179,200,0.22)"], [0.15, 0.75, "rgba(134,180,148,0.32)"], [0.75, 0.92, "rgba(210,170,90,0.45)"], [0.92, 1, "rgba(201,115,92,0.6)"]];
  for (const [a, b, c] of zones) {
    ctx.fillStyle = c;
    ctx.fillRect(bx + a * bw, by, (b - a) * bw - 1, 6);
  }
  const tx = bx + clamp(h.tension, 0, 1.03) * bw;
  ctx.fillStyle = h.tension > 0.92 ? BAD : "#f4eee0";
  ctx.fillRect(tx - 1, by - 5, 2, 16);
  // подписи
  ctx.font = `500 11px ${FONTS.sans}`;
  ctx.fillStyle = DIM;
  ctx.textAlign = "left";
  ctx.fillText("натяжение", bx, by + 22);
  ctx.textAlign = "right";
  ctx.fillText(`леска ${Math.max(0, h.line).toFixed(1)} м`, bx + bw, by + 22);
  ctx.textAlign = "center";
  let state = h.running ? "рывок" : "рыба устала — подматывайте";
  let col = h.running ? "#e0b48a" : OK;
  if (h.jump > 0) {
    state = e.reeling ? "в воздухе — отпустите" : "в воздухе";
    col = e.reeling ? BAD : OK;
  }
  ctx.fillStyle = col;
  ctx.fillText(state, bx + bw / 2, by + 22);
  // силы рыбы
  ctx.fillStyle = "rgba(230,225,214,0.1)";
  ctx.fillRect(bx, by + 34, bw, 2);
  ctx.fillStyle = "rgba(230,225,214,0.6)";
  ctx.fillRect(bx, by + 34, bw * (h.stamina / 100), 2);
  label(ctx, "силы", bx, by + 48, "left", DIM);
  // направление рывка
  if (h.running && h.jump <= 0) {
    const side = Math.sign(h.swayV);
    const ok = h.countering;
    const cx = f.compact ? (side > 0 ? x0 + 24 : x0 + w - 24) : side > 0 ? x0 - 28 : x0 + w + 28;
    const dir = side > 0 ? -1 : 1;
    ctx.strokeStyle = ok ? OK : `rgba(224,180,138,${0.6 + Math.sin(t * 10) * 0.35})`;
    ctx.lineWidth = 2;
    for (let i = 0; i < 2; i++) {
      const ox = cx + dir * i * 9;
      ctx.beginPath();
      ctx.moveTo(ox - dir * 5, y0 + ph / 2 - 10);
      ctx.lineTo(ox + dir * 5, y0 + ph / 2);
      ctx.lineTo(ox - dir * 5, y0 + ph / 2 + 10);
      ctx.stroke();
    }
    if (!f.compact) label(ctx, ok ? "верно" : "уводите", cx, y0 + ph / 2 + 26, "center", ok ? OK : "#e0b48a");
  }
  ctx.restore();
}

export function drawSonar(f: Frame, bands: SonarBand[]) {
  const { ctx, W, H, e, t } = f;
  const lvl = e.s.sonar;
  if (lvl <= 0 || !bands.length) return;
  if (f.compact && (e.phase === "fight" || e.phase === "charging")) return;
  const w = f.compact ? 140 : 190, h = f.compact ? Math.min(150, H * 0.32) : Math.min(220, H * 0.3);
  const x0 = W - w - (f.compact ? 60 : 64), y0 = H - h - f.botRes - (f.compact ? 8 : -32);
  if (y0 < f.topRes) return;
  ctx.save();
  panel(ctx, x0, y0, w, h);
  label(ctx, "Эхолот", x0 + 12, y0 + 17);
  label(ctx, ["", "I", "II", "III"][lvl], x0 + w - 12, y0 + 17, "right", BRASS);
  const px0 = x0 + 10, py0 = y0 + 26, pw = w - 44, pht = h - 36;
  ctx.save();
  ctx.beginPath();
  ctx.rect(px0, py0, pw, pht);
  ctx.clip();
  ctx.fillStyle = "#03070c";
  ctx.fillRect(px0, py0, pw, pht);
  const maxU = depthToU(f.spot.maxDepth);
  const dy = (d: number) => py0 + (depthToU(d) / maxU) * pht * 0.96;
  ctx.strokeStyle = "rgba(143,179,200,0.07)";
  ctx.lineWidth = 1;
  for (let i = 1; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(px0, py0 + (i / 6) * pht);
    ctx.lineTo(px0 + pw, py0 + (i / 6) * pht);
    ctx.stroke();
  }
  const scroll = t * 12;
  bands.forEach((b, i) => {
    if (!b.count) return;
    const y = dy(b.depth);
    const n = Math.min(5, b.count);
    for (let k = 0; k < n; k++) {
      const hx = ((hash1(i * 17 + k * 3.1) * pw * 2 - scroll * (0.6 + hash1(k + i) * 0.6)) % pw + pw) % pw;
      const fresh = lvl >= 2 && k < b.fresh;
      ctx.strokeStyle = fresh ? BRASS : lvl >= 2 && b.best ? RARITY_INFO[b.best].color : "rgba(180,210,225,0.8)";
      ctx.lineWidth = fresh ? 1.8 : 1.3;
      ctx.beginPath();
      ctx.arc(px0 + hx, y + 3, 3.6, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    }
    if (lvl >= 3 && b.legend) {
      ctx.strokeStyle = `rgba(215,180,110,${0.55 + Math.sin(t * 4) * 0.35})`;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(px0 + pw * 0.7, y + 6, 8, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    }
  });
  ctx.beginPath();
  ctx.moveTo(px0, py0 + pht);
  for (let i = 0; i <= 40; i++) ctx.lineTo(px0 + (i / 40) * pw, dy(e.bedAt(0.3 + (i / 40) * 0.55)));
  ctx.lineTo(px0 + pw, py0 + pht);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, py0, 0, py0 + pht);
  g.addColorStop(0, "rgba(200,164,106,0.75)");
  g.addColorStop(1, "rgba(90,60,30,0.85)");
  ctx.fillStyle = g;
  ctx.fill();
  if (e.line.value < f.spot.maxDepth) {
    const ly = dy(e.line.value);
    ctx.setLineDash([2, 3]);
    ctx.strokeStyle = "rgba(201,115,92,0.8)";
    ctx.beginPath();
    ctx.moveTo(px0, ly);
    ctx.lineTo(px0 + pw, ly);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  const ty = dy(Math.min(e.s.targetDepth, e.maxDepth));
  ctx.strokeStyle = "rgba(230,225,214,0.45)";
  ctx.beginPath();
  ctx.moveTo(px0, ty);
  ctx.lineTo(px0 + pw, ty);
  ctx.stroke();
  const nx2px = (nx: number) => px0 + ((nx - 0.3) / 0.55) * pw;
  ctx.fillStyle = "rgba(230,225,214,0.04)";
  ctx.fillRect(nx2px(e.castNX(0.15)), py0, nx2px(e.castNX(1)) - nx2px(e.castNX(0.15)), pht);
  if (["sinking", "waiting", "bite", "fight"].includes(e.phase)) {
    ctx.fillStyle = "#f4eee0";
    ctx.beginPath();
    ctx.arc(nx2px(e.castNX()), dy(e.hookDepth), 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  const sx = px0 + ((t * 40) % pw);
  ctx.fillStyle = "rgba(143,179,200,0.06)";
  ctx.fillRect(sx - 12, py0, 12, pht);
  ctx.restore();
  ctx.font = `500 9px ${FONTS.sans}`;
  ctx.fillStyle = DIM;
  ctx.textAlign = "left";
  for (const d of [0, f.spot.maxDepth * 0.1, f.spot.maxDepth * 0.4, f.spot.maxDepth]) {
    const y = d === 0 ? py0 + 7 : dy(d);
    ctx.fillText(`${Math.round(d)}`, px0 + pw + 4, Math.min(py0 + pht, y + 3));
  }
  ctx.restore();
}
