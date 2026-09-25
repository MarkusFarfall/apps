import type { Ctx } from './types';
import { calc, split } from './time';
import { plural, W, fmtDate, num } from './format';
import { rankOf, labels } from './data';

const cssVar = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#b5c96a';

export async function makeCard(ctx: Ctx): Promise<Blob> {
  const { profile, s, e } = ctx;
  const now = Date.now();
  const c = calc(s, e, now);
  const t = split(c.left);
  const L = labels(profile.mode);
  const { rank } = rankOf(c.pct, profile.mode);
  const A = cssVar('--accent');
  const B = cssVar('--accent2');
  const BG = cssVar('--bg');
  try {
    await document.fonts?.ready;
  } catch {
    /* ignore */
  }

  const W_ = 1080;
  const H = 1350;
  const cv = document.createElement('canvas');
  cv.width = W_;
  cv.height = H;
  const x = cv.getContext('2d')!;

  x.fillStyle = BG;
  x.fillRect(0, 0, W_, H);
  // camo blobs
  x.globalAlpha = 0.18;
  const blobs = [
    [150, 200, 260, 140],
    [880, 120, 240, 120],
    [950, 640, 200, 260],
    [300, 820, 300, 150],
    [100, 1200, 220, 200],
    [760, 1220, 280, 160],
  ];
  blobs.forEach(([bx, by, rx, ry], i) => {
    x.fillStyle = i % 2 ? A : B;
    x.beginPath();
    x.ellipse(bx, by, rx, ry, i * 0.6, 0, Math.PI * 2);
    x.fill();
  });
  x.globalAlpha = 1;

  const grad = x.createLinearGradient(0, 0, W_, H);
  grad.addColorStop(0, A);
  grad.addColorStop(1, B);

  x.textAlign = 'center';
  x.fillStyle = 'rgba(255,255,255,.6)';
  x.font = '700 40px Manrope, sans-serif';
  x.fillText((profile.name || L.who).toUpperCase() + ' • ' + rank.name.toUpperCase(), W_ / 2, 150);

  // ring
  const cx = W_ / 2;
  const cy = 560;
  const r = 300;
  x.lineWidth = 44;
  x.strokeStyle = 'rgba(255,255,255,.08)';
  x.beginPath();
  x.arc(cx, cy, r, 0, Math.PI * 2);
  x.stroke();
  x.strokeStyle = grad;
  x.lineCap = 'round';
  x.beginPath();
  x.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.001, c.pct));
  x.stroke();

  x.fillStyle = grad;
  x.font = '900 190px Unbounded, Arial Black, sans-serif';
  x.fillText(c.done ? 'ДМБ' : String(t.days), cx, cy + 40);
  x.fillStyle = 'rgba(255,255,255,.75)';
  x.font = '700 44px Manrope, sans-serif';
  x.fillText(c.done ? 'свободен!' : `${plural(t.days, W.day)} ${L.until}`, cx, cy + 120);
  x.font = '700 52px "JetBrains Mono", monospace';
  x.fillStyle = '#fff';
  if (!c.done)
    x.fillText(
      `${String(t.hours).padStart(2, '0')}:${String(t.minutes).padStart(2, '0')}:${String(t.seconds).padStart(2, '0')}`,
      cx,
      cy + 200
    );

  // percent
  x.fillStyle = grad;
  x.font = '900 110px Unbounded, Arial Black, sans-serif';
  x.fillText(`${(c.pct * 100).toFixed(2)}%`, cx, 1030);
  x.fillStyle = 'rgba(255,255,255,.6)';
  x.font = '600 38px Manrope, sans-serif';
  x.fillText(`${L.passed.toLowerCase()} • ${num(c.passed / 3600000)} ч позади`, cx, 1090);

  // bar
  x.fillStyle = 'rgba(255,255,255,.08)';
  x.beginPath();
  x.roundRect(120, 1140, W_ - 240, 26, 13);
  x.fill();
  x.fillStyle = grad;
  x.beginPath();
  x.roundRect(120, 1140, Math.max(26, (W_ - 240) * c.pct), 26, 13);
  x.fill();

  x.fillStyle = 'rgba(255,255,255,.5)';
  x.font = '600 32px Manrope, sans-serif';
  x.fillText(`${L.finish}: ${fmtDate(e)}`, cx, 1235);
  x.fillStyle = grad;
  x.font = '800 34px Unbounded, sans-serif';
  x.fillText('ДМБ ТАЙМЕР', cx, 1295);

  return new Promise((res) => cv.toBlob((b) => res(b!), 'image/png'));
}

export function shareText(ctx: Ctx) {
  const c = calc(ctx.s, ctx.e, Date.now());
  const t = split(c.left);
  const L = labels(ctx.profile.mode);
  if (c.done) return `🏆 ${L.doneTitle} ${L.doneSub}`;
  return `🪖 ${L.left}: ${t.days} ${plural(t.days, W.day)} ${t.hours} ч ${t.minutes} мин ${L.until}!\n📊 ${L.passed}: ${(c.pct * 100).toFixed(4)}%\n🎖️ Звание: ${rankOf(c.pct, ctx.profile.mode).rank.name}\n#ДМБ #дембель`;
}
