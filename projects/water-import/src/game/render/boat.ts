import type { Frame } from "./frame";
import { clamp, glow, hexA, mix, af } from "./util";

const W_ = [120, 140, 190, 250, 290];
const DECK = [-14, -16, -20, -26, -30];
const DRAFT = [8, 10, 16, 22, 26];
const CABIN = [0, 0, 30, 40, 46];

const smoke: { x: number; y: number; t: number; vx: number }[] = [];

/** stowed — снасть убрана (переход, стоянка в порту), helm — рыбак правит / гребёт */
export function drawBoat(f: Frame, x: number, pose: "fish" | "helm" | "moored" = "fish"): [number, number] {
  const { ctx, e, t, night, sc: s } = f;
  const b = e.boat;
  const st = b.style;
  // визуальный базовый класс корпуса
  const tier = ({ row: 0, kayak: 0, dinghy: 1, barkas: 1, cutter: 2, yacht: 2, seiner: 3, trawler: 3, research: 4 } as const)[st] ?? b.tier;
  const GEO: Partial<Record<typeof st, [number, number, number, number]>> = {
    kayak: [112, -5, 5, 0],
    barkas: [168, -18, 13, 0],
    yacht: [205, -15, 13, 0],
    trawler: [275, -28, 25, 44],
  };
  const y = f.waveY(x) + 2;
  const slope = (f.waveY(x + 24) - f.waveY(x - 24)) / 48;
  const ang = Math.atan(slope) * 0.85 * (1.15 - b.stability * 0.65);
  const g = GEO[st];
  const w = (g ? g[0] : W_[tier]) * s, deck = (g ? g[1] : DECK[tier]) * s, draft = (g ? g[2] : DRAFT[tier]) * s;
  const dim = (c: string, k = 0.72) => mix(c, "#060a12", night * k);

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);

  // надстройка
  const cx = -w * (tier === 4 ? 0.12 : 0.1), cw = w * (tier === 2 ? 0.32 : 0.36), ch = (g ? g[3] : CABIN[tier]) * s;
  // ───── особые суда ─────
  if (st === "barkas") {
    // кубрик и мачта с убранным парусом
    const kx = -w * 0.12, kw = w * 0.26, kh = 16 * s;
    ctx.fillStyle = dim(b.trim);
    ctx.fillRect(kx - kw / 2, deck - kh, kw, kh);
    ctx.fillStyle = dim(mix(b.hull, "#000000", 0.25));
    ctx.beginPath();
    ctx.moveTo(kx - kw / 2 - 3 * s, deck - kh);
    ctx.quadraticCurveTo(kx, deck - kh - 7 * s, kx + kw / 2 + 3 * s, deck - kh);
    ctx.fill();
    ctx.fillStyle = night > 0.35 ? `rgba(255,196,110,${0.6 + night * 0.4})` : dim("#3a3a3a");
    ctx.beginPath();
    ctx.arc(kx - kw * 0.2, deck - kh * 0.55, 2.4 * s, 0, Math.PI * 2);
    ctx.arc(kx + kw * 0.2, deck - kh * 0.55, 2.4 * s, 0, Math.PI * 2);
    ctx.fill();
    const mx = w * 0.05;
    ctx.strokeStyle = dim("#4a3624");
    ctx.lineWidth = 3 * s;
    ctx.beginPath();
    ctx.moveTo(mx, deck);
    ctx.lineTo(mx, deck - 62 * s);
    ctx.stroke();
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.moveTo(mx, deck - 18 * s);
    ctx.lineTo(mx - w * 0.3, deck - 14 * s);
    ctx.stroke();
    ctx.strokeStyle = dim("#c8b890");
    ctx.lineWidth = 4 * s;
    ctx.beginPath();
    ctx.moveTo(mx - 2 * s, deck - 17 * s);
    ctx.quadraticCurveTo(mx - w * 0.15, deck - 21 * s + Math.sin(t * 2) * s, mx - w * 0.29, deck - 15 * s);
    ctx.stroke();
    ctx.strokeStyle = dim("#303030");
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(mx, deck - 62 * s);
    ctx.lineTo(w * 0.47, deck - 6 * s);
    ctx.moveTo(mx, deck - 62 * s);
    ctx.lineTo(-w * 0.46, deck);
    ctx.stroke();
  }
  if (st === "yacht") {
    // низкая рубка, высокая мачта, грот и стаксель
    const rx = -w * 0.08, rw = w * 0.3, rh = 10 * s;
    ctx.fillStyle = dim("#e8e6e0");
    ctx.beginPath();
    ctx.moveTo(rx - rw / 2, deck);
    ctx.lineTo(rx - rw / 2 + 6 * s, deck - rh);
    ctx.lineTo(rx + rw / 2, deck - rh);
    ctx.lineTo(rx + rw / 2 + 8 * s, deck);
    ctx.fill();
    ctx.fillStyle = night > 0.35 ? `rgba(255,196,110,${0.5 + night * 0.5})` : dim("#2a3e56");
    ctx.fillRect(rx - rw * 0.3, deck - rh * 0.72, rw * 0.6, rh * 0.35);
    const mx = w * 0.02, mh = 118 * s;
    ctx.strokeStyle = dim("#c8c8c8");
    ctx.lineWidth = 2.2 * s;
    ctx.beginPath();
    ctx.moveTo(mx, deck);
    ctx.lineTo(mx, deck - mh);
    ctx.stroke();
    ctx.strokeStyle = dim("#8a8a8a");
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(mx, deck - mh);
    ctx.lineTo(w * 0.48, deck - 7 * s);
    ctx.moveTo(mx, deck - mh);
    ctx.lineTo(-w * 0.45, deck);
    ctx.stroke();
    const billow = Math.sin(t * 0.9) * 3 * s + f.wind * 6 * s;
    const sail = dim(mix("#f6f4ee", "#ffd8b0", f.golden * 0.35));
    ctx.fillStyle = sail;
    ctx.beginPath();
    ctx.moveTo(mx - 1.5 * s, deck - mh + 4 * s);
    ctx.quadraticCurveTo(mx - w * 0.2 - billow, deck - mh * 0.45, mx - w * 0.36, deck - 13 * s);
    ctx.lineTo(mx - 1.5 * s, deck - 11 * s);
    ctx.fill();
    ctx.fillStyle = dim(mix("#ecebe4", "#ffd8b0", f.golden * 0.3));
    ctx.beginPath();
    ctx.moveTo(mx + 1.5 * s, deck - mh * 0.92);
    ctx.quadraticCurveTo(mx + w * 0.22 + billow, deck - mh * 0.4, w * 0.45, deck - 8 * s);
    ctx.lineTo(mx + 1.5 * s, deck - 10 * s);
    ctx.fill();
    ctx.strokeStyle = hexA("#000000", 0.12);
    ctx.lineWidth = 0.7;
    for (let k = 1; k < 5; k++) {
      ctx.beginPath();
      ctx.moveTo(mx - 1.5 * s, deck - mh * (k / 5));
      ctx.lineTo(mx - w * 0.07 * k - billow * 0.3, deck - mh * (k / 5) + 6 * s);
      ctx.stroke();
    }
    ctx.fillStyle = dim("#1a3a6a");
    ctx.fillRect(mx - w * 0.37, deck - 15 * s, w * 0.37, 3 * s);
    if (night > 0.3) glow(ctx, mx, deck - mh - 2, 1.8 * s, "#ffffff", night);
  }
  if (tier >= 2 && st !== "yacht") {
    const cg = ctx.createLinearGradient(cx - cw / 2, 0, cx + cw / 2, 0);
    cg.addColorStop(0, dim(b.trim));
    cg.addColorStop(1, dim(mix(b.trim, "#000000", 0.18)));
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.moveTo(cx - cw / 2, deck);
    ctx.lineTo(cx - cw / 2, deck - ch);
    ctx.lineTo(cx + cw / 2 - 6 * s, deck - ch);
    ctx.lineTo(cx + cw / 2 + 4 * s, deck - ch * 0.45);
    ctx.lineTo(cx + cw / 2 + 4 * s, deck);
    ctx.fill();
    ctx.fillStyle = dim(mix(b.trim, "#000000", 0.3));
    ctx.fillRect(cx - cw / 2 - 4 * s, deck - ch - 4 * s, cw + 4 * s, 4 * s);
    const nWin = tier === 2 ? 3 : 4;
    for (let i = 0; i < nWin; i++) {
      const wx = cx - cw / 2 + 5 * s + i * ((cw - 10 * s) / nWin);
      ctx.fillStyle = night > 0.35 ? `rgba(255,200,110,${0.55 + night * 0.45})` : dim("#86b8d8");
      ctx.fillRect(wx, deck - ch + 7 * s, (cw - 10 * s) / nWin - 3 * s, 9 * s);
      if (night <= 0.35) {
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.fillRect(wx + 1, deck - ch + 8 * s, 2 * s, 7 * s);
      }
    }
    // антенна
    ctx.strokeStyle = dim("#303438");
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(cx - cw * 0.3, deck - ch - 4 * s);
    ctx.lineTo(cx - cw * 0.3, deck - ch - 26 * s);
    ctx.stroke();
    // спасательный круг
    ctx.lineWidth = 3 * s;
    ctx.strokeStyle = dim("#e8e8e8");
    ctx.beginPath();
    ctx.arc(cx - cw / 2 + 8 * s, deck - ch * 0.35, 5 * s, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = dim("#d83a2a");
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      ctx.arc(cx - cw / 2 + 8 * s, deck - ch * 0.35, 5 * s, k * (Math.PI / 2), k * (Math.PI / 2) + 0.6);
      ctx.stroke();
    }
    if (tier >= 3) {
      // мачта, стрела, сеть
      const mx = cx + cw * 0.1, mtop = deck - ch - 56 * s;
      ctx.strokeStyle = dim("#2e2e30");
      ctx.lineWidth = 3 * s;
      ctx.beginPath();
      ctx.moveTo(mx, deck - ch);
      ctx.lineTo(mx, mtop);
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(mx, mtop);
      ctx.lineTo(w * 0.46, deck - 4 * s);
      ctx.moveTo(mx, mtop);
      ctx.lineTo(-w * 0.48, deck);
      ctx.stroke();
      if (st === "trawler") {
        ctx.strokeStyle = dim("#e8e4dc");
        ctx.lineWidth = 4.5 * s;
        ctx.beginPath();
        ctx.moveTo(-w * 0.48, deck);
        ctx.lineTo(-w * 0.44, deck - 52 * s);
        ctx.lineTo(-w * 0.33, deck - 52 * s);
        ctx.lineTo(-w * 0.3, deck);
        ctx.stroke();
        ctx.fillStyle = dim("#303438");
        ctx.beginPath();
        ctx.arc(-w * 0.4, deck - 8 * s, 8 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = dim("#e8e4dc");
        ctx.fillRect(cx + cw * 0.2, deck - ch - 22 * s, 10 * s, 18 * s);
        ctx.fillStyle = dim("#b8322a");
        ctx.fillRect(cx + cw * 0.2, deck - ch - 22 * s, 10 * s, 5 * s);
        if (Math.random() < f.dt * 6) smoke.push({ x: x + (cx + cw * 0.2 + 5 * s), y: y + deck - ch - 22 * s, t: 0, vx: 6 + f.wind * 30 });
      }
      if (tier === 3 && st === "seiner") {
        ctx.lineWidth = 2.5 * s;
        ctx.beginPath();
        ctx.moveTo(mx, deck - ch - 10 * s);
        ctx.lineTo(-w * 0.44, deck - ch - 30 * s);
        ctx.stroke();
        ctx.strokeStyle = dim("#8a8a60");
        ctx.lineWidth = 0.8;
        for (let k = 0; k < 6; k++) {
          ctx.beginPath();
          ctx.moveTo(-w * 0.44 + k * 3 * s, deck - ch - 29 * s);
          ctx.quadraticCurveTo(-w * 0.4 + k * 4 * s, deck - 10 * s, -w * 0.36 + k * 2 * s, deck - 2);
          ctx.stroke();
        }
        // труба
        ctx.fillStyle = dim("#c83a2a");
        ctx.fillRect(cx - cw * 0.35, deck - ch - 18 * s, 8 * s, 14 * s);
        ctx.fillStyle = dim("#1a1a1a");
        ctx.fillRect(cx - cw * 0.35, deck - ch - 20 * s, 8 * s, 3 * s);
        if (Math.random() < f.dt * 6) smoke.push({ x: x + (cx - cw * 0.35 + 4 * s), y: y + deck - ch - 20 * s, t: 0, vx: 6 + f.wind * 30 });
      }
      if (night > 0.3) {
        glow(ctx, mx, mtop - 2, 2.2 * s, "#ffffff", night);
        glow(ctx, w * 0.46, deck - 6 * s, 1.6 * s, "#40ff60", night);
      }
    }
    if (tier === 4) {
      ctx.strokeStyle = dim("#f0a020");
      ctx.lineWidth = 4 * s;
      ctx.beginPath();
      ctx.moveTo(-w * 0.47, deck);
      ctx.lineTo(-w * 0.42, deck - 46 * s);
      ctx.lineTo(-w * 0.3, deck);
      ctx.stroke();
      ctx.strokeStyle = dim("#303030");
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-w * 0.42, deck - 46 * s);
      ctx.lineTo(-w * 0.5, deck + 30 * s);
      ctx.stroke();
      ctx.fillStyle = dim("#f4f4f4");
      ctx.beginPath();
      ctx.arc(cx + cw * 0.2, deck - ch - 10 * s, 8 * s, Math.PI, 0);
      ctx.fill();
    }
    // флаг
    const fx0 = cx - cw * 0.3, fy0 = deck - ch - 26 * s;
    const wv = Math.sin(t * 6) * 2 * s;
    ctx.fillStyle = dim(tier === 4 ? "#2a60c0" : "#d8d8d8");
    ctx.beginPath();
    ctx.moveTo(fx0, fy0);
    ctx.quadraticCurveTo(fx0 - 7 * s, fy0 + wv, fx0 - 14 * s, fy0 + 1 * s);
    ctx.lineTo(fx0 - 14 * s, fy0 + 7 * s);
    ctx.quadraticCurveTo(fx0 - 7 * s, fy0 + 6 * s - wv, fx0, fy0 + 6 * s);
    ctx.fill();
  }

  // корпус
  const hull = () => {
    ctx.beginPath();
    ctx.moveTo(-w / 2, deck);
    ctx.lineTo(w * 0.5, deck - 7 * s);
    ctx.quadraticCurveTo(w * 0.44, draft * 0.6, w * 0.26, draft);
    ctx.lineTo(-w * 0.42, draft);
    ctx.quadraticCurveTo(-w * 0.5, draft * 0.3, -w / 2, deck);
    ctx.closePath();
  };
  hull();
  const hg = ctx.createLinearGradient(0, deck, 0, draft);
  hg.addColorStop(0, dim(mix(b.hull, "#ffffff", 0.14)));
  hg.addColorStop(0.6, dim(b.hull));
  hg.addColorStop(1, dim(mix(b.hull, "#000000", 0.4)));
  ctx.fillStyle = hg;
  ctx.fill();
  ctx.save();
  hull();
  ctx.clip();
  ctx.fillStyle = dim(b.trim);
  ctx.fillRect(-w, deck - 1, w * 2, 4 * s);
  if (tier === 0) {
    ctx.strokeStyle = dim("#3a2412");
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(-w, deck + i * 5 * s);
      ctx.lineTo(w, deck + i * 5 * s - 3);
      ctx.stroke();
    }
    for (let i = -3; i <= 3; i++) {
      ctx.fillStyle = hexA("#000000", 0.18);
      ctx.fillRect(i * w * 0.12, deck, 1.5, draft - deck);
    }
  } else {
    ctx.fillStyle = dim(mix(b.trim, "#000000", 0.1));
    ctx.fillRect(-w, deck + 9 * s, w * 2, 2.5 * s);
    ctx.fillStyle = dim("#8a2a22");
    ctx.fillRect(-w, draft - 4 * s, w * 2, 6 * s);
  }
  // блик
  ctx.fillStyle = `rgba(255,255,255,${0.12 * (1 - night)})`;
  ctx.fillRect(-w, deck + 1, w * 2, 1.5);
  ctx.restore();
  if (tier === 3) {
    ctx.fillStyle = dim("#1a1a1a");
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(-w * 0.3 + i * w * 0.18, deck + 7 * s, 4 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (tier >= 2) {
    ctx.fillStyle = dim(b.trim);
    ctx.font = `700 ${Math.round(7 * s)}px Georgia, serif`;
    ctx.fillText(b.name.split("«")[1]?.replace("»", "").toUpperCase() ?? "", w * 0.14, deck + 13 * s);
  }
  if (st === "kayak") {
    const pa = Math.sin(t * 0.8) * 0.15;
    ctx.save();
    ctx.translate(w * 0.12, deck - 16 * s);
    ctx.rotate(0.5 + pa);
    ctx.strokeStyle = dim("#2a2a2a");
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.moveTo(-40 * s, 0);
    ctx.lineTo(40 * s, 0);
    ctx.stroke();
    ctx.fillStyle = dim("#e0b020");
    ctx.beginPath();
    ctx.ellipse(-42 * s, 0, 8 * s, 3 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(42 * s, 0, 8 * s, 3 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = dim("#1e2a22");
    ctx.beginPath();
    ctx.ellipse(w * 0.12, deck + 1, 12 * s, 4 * s, 0, Math.PI, 0);
    ctx.fill();
  } else if (tier === 0) {
    ctx.strokeStyle = dim("#8a6040");
    ctx.lineWidth = 2.6 * s;
    ctx.beginPath();
    ctx.moveTo(-w * 0.08, deck - 3);
    ctx.lineTo(-w * 0.46, draft + 12 * s);
    ctx.stroke();
    ctx.fillStyle = dim("#8a6040");
    ctx.beginPath();
    ctx.ellipse(-w * 0.47, draft + 13 * s, 3 * s, 7 * s, 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = dim("#4a6a8a");
    ctx.fillRect(-w * 0.34, deck - 7 * s, 14 * s, 7 * s);
  } else if (tier === 1) {
    ctx.fillStyle = dim("#2a2a2a");
    ctx.fillRect(-w / 2 - 11 * s, deck - 13 * s, 13 * s, 17 * s);
    ctx.fillRect(-w / 2 - 6 * s, deck + 4 * s, 4 * s, 18 * s);
    ctx.fillStyle = dim("#c83a2a");
    ctx.fillRect(-w / 2 - 11 * s, deck - 13 * s, 13 * s, 4 * s);
    ctx.fillStyle = hexA(dim("#a8d0e8"), 0.7);
    ctx.beginPath();
    ctx.moveTo(-w * 0.05, deck);
    ctx.lineTo(w * 0.02, deck - 14 * s);
    ctx.lineTo(w * 0.08, deck - 14 * s);
    ctx.lineTo(w * 0.08, deck);
    ctx.fill();
  }

  // фонарь
  const lanternX = tier >= 2 ? cx + cw * 0.3 : -w * 0.3;
  const lanternY = tier >= 2 ? deck - ch - 8 * s : deck - 20 * s;
  if (tier < 2) {
    ctx.strokeStyle = dim("#403020");
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(lanternX, deck);
    ctx.lineTo(lanternX, lanternY);
    ctx.stroke();
  }
  if (night > 0.3) {
    const lg = ctx.createRadialGradient(lanternX, lanternY, 0, lanternX, lanternY, 110 * s);
    lg.addColorStop(0, `rgba(255,196,110,${af(0.4 * night)})`);
    lg.addColorStop(1, "rgba(255,180,100,0)");
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = lg;
    ctx.fillRect(lanternX - 110 * s, lanternY - 110 * s, 220 * s, 220 * s);
    ctx.restore();
    glow(ctx, lanternX, lanternY, 2.6 * s, "#ffc070", 1);
  } else {
    ctx.fillStyle = dim("#c89040");
    ctx.fillRect(lanternX - 2 * s, lanternY - 3 * s, 4 * s, 6 * s);
  }

  // рыбак
  const fx = st === "kayak" ? w * 0.12 : w * (tier >= 2 ? 0.34 : 0.18);
  const fy = deck - 5 * s - (tier >= 2 ? 3 * s : 0) + (st === "kayak" ? 15 * s : 0);
  const rainy = ["rain", "storm", "snow"].includes(f.weather);
  const cold = e.temperature < 5;
  const coat = dim(rainy ? "#e8b820" : cold ? "#5a3a2a" : "#3e4e3e");
  const skin = dim("#d8a888");
  ctx.fillStyle = dim("#26263a");
  ctx.fillRect(fx - 5 * s, fy - 18 * s, 4 * s, 18 * s);
  ctx.fillRect(fx + 1 * s, fy - 18 * s, 4 * s, 18 * s);
  ctx.fillStyle = dim("#1a1a1a");
  ctx.fillRect(fx - 6 * s, fy - 3 * s, 6 * s, 3 * s);
  ctx.fillRect(fx + 1 * s, fy - 3 * s, 6 * s, 3 * s);
  ctx.fillStyle = coat;
  ctx.beginPath();
  ctx.moveTo(fx - 8.5 * s, fy - 15 * s);
  ctx.lineTo(fx - 6.5 * s, fy - 40 * s);
  ctx.quadraticCurveTo(fx, fy - 43 * s, fx + 6.5 * s, fy - 40 * s);
  ctx.lineTo(fx + 8.5 * s, fy - 15 * s);
  ctx.fill();
  ctx.fillStyle = hexA("#000000", 0.18);
  ctx.fillRect(fx - 8 * s, fy - 24 * s, 16 * s, 2 * s);
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(fx + 1.2 * s, fy - 46.5 * s, 5.6 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = dim("#9a9a96");
  ctx.beginPath();
  ctx.arc(fx + 1 * s, fy - 43.5 * s, 4.8 * s, 0.15, Math.PI - 0.15);
  ctx.fill();
  ctx.fillStyle = dim("#101010");
  ctx.fillRect(fx + 3.5 * s, fy - 48 * s, 1.3 * s, 1.3 * s);
  // шапка
  ctx.fillStyle = rainy ? coat : dim(cold ? "#8a2a2a" : "#5a4a30");
  if (rainy) {
    ctx.beginPath();
    ctx.moveTo(fx - 8 * s, fy - 48 * s);
    ctx.quadraticCurveTo(fx + 1 * s, fy - 59 * s, fx + 10 * s, fy - 48 * s);
    ctx.lineTo(fx + 12 * s, fy - 47 * s);
    ctx.lineTo(fx - 9 * s, fy - 47 * s);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.ellipse(fx + 1 * s, fy - 50.5 * s, 9 * s, 2.4 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(fx + 1 * s, fy - 50.5 * s, 5.6 * s, Math.PI, 0);
    ctx.fill();
  }
  // трубка
  const calm = e.phase === "waiting" || e.phase === "idle" || e.phase === "sinking";
  ctx.strokeStyle = dim("#3a2210");
  ctx.lineWidth = 1.4 * s;
  ctx.beginPath();
  ctx.moveTo(fx + 5 * s, fy - 44 * s);
  ctx.lineTo(fx + 9 * s, fy - 43 * s);
  ctx.lineTo(fx + 9.5 * s, fy - 46 * s);
  ctx.stroke();
  if (calm && Math.random() < f.dt * 1.8) {
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const lx = fx + 9.5 * s, ly = fy - 47 * s;
    smoke.push({ x: x + lx * ca - ly * sa, y: y + lx * sa + ly * ca, t: 0, vx: 4 + f.wind * 20 });
  }

  if (pose !== "fish") {
    // удочка уложена вдоль планширя
    ctx.strokeStyle = dim("#241810");
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.moveTo(-w * 0.34, deck - 3 * s);
    ctx.lineTo(w * 0.22, deck - 5 * s);
    ctx.stroke();
    ctx.fillStyle = dim("#9a9aa2");
    ctx.beginPath();
    ctx.arc(-w * 0.26, deck - 1 * s, 2.4 * s, 0, Math.PI * 2);
    ctx.fill();
    const rowing = tier === 0 && st !== "yacht";
    const sh = { x: fx + 3 * s, y: fy - 38 * s };
    if (rowing) {
      // гребёт: вёсла (или весло каяка) в ритме
      const ph = t * (pose === "helm" ? 2.2 : 0.6);
      const stroke = Math.sin(ph);
      const gx = fx - 4 * s + stroke * 6 * s, gy = fy - 28 * s + Math.cos(ph) * 2 * s;
      ctx.strokeStyle = coat;
      ctx.lineWidth = 3.4 * s;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(sh.x, sh.y);
      ctx.lineTo(gx, gy);
      ctx.stroke();
      if (pose === "helm") {
        ctx.strokeStyle = dim(st === "kayak" ? "#2a2a2a" : "#8a6040");
        ctx.lineWidth = 2.4 * s;
        ctx.beginPath();
        ctx.moveTo(gx, gy);
        const ex = gx - 40 * s + stroke * 16 * s, ey = draft + 14 * s - Math.cos(ph) * 6 * s;
        ctx.lineTo(ex, ey);
        ctx.stroke();
        ctx.fillStyle = dim(st === "kayak" ? "#e0b020" : "#8a6040");
        ctx.beginPath();
        ctx.ellipse(ex, ey, 3 * s, 7 * s, 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = skin;
      ctx.beginPath();
      ctx.arc(gx, gy, 1.8 * s, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // у штурвала / румпеля: руки вперёд, лёгкое покачивание
      const sway = Math.sin(t * 1.4) * 1.5 * s;
      const wx = fx - 10 * s, wy = fy - 30 * s;
      if (tier >= 2 || st === "yacht") {
        ctx.strokeStyle = dim("#5a3e24");
        ctx.lineWidth = 1.6 * s;
        ctx.beginPath();
        ctx.arc(wx, wy, 6 * s, 0, Math.PI * 2);
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2 + (pose === "helm" ? Math.sin(t * 0.7) * 0.4 : 0);
          ctx.moveTo(wx, wy);
          ctx.lineTo(wx + Math.cos(a) * 8.5 * s, wy + Math.sin(a) * 8.5 * s);
        }
        ctx.stroke();
      } else {
        ctx.strokeStyle = dim("#3a3a3a");
        ctx.lineWidth = 2.2 * s;
        ctx.beginPath();
        ctx.moveTo(-w * 0.44, deck - 8 * s);
        ctx.lineTo(wx, wy + 2 * s);
        ctx.stroke();
      }
      ctx.strokeStyle = coat;
      ctx.lineWidth = 3.4 * s;
      ctx.lineCap = "round";
      for (const dy of [-3, 3]) {
        ctx.beginPath();
        ctx.moveTo(sh.x, sh.y);
        ctx.lineTo(wx + 4 * s + sway, wy + dy * s);
        ctx.stroke();
      }
      ctx.fillStyle = skin;
      ctx.beginPath();
      ctx.arc(wx + 4 * s + sway, wy - 3 * s, 1.7 * s, 0, Math.PI * 2);
      ctx.arc(wx + 4 * s + sway, wy + 3 * s, 1.7 * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    const ca0 = Math.cos(ang), sa0 = Math.sin(ang);
    return [x + fx * ca0 - (fy - 40 * s) * sa0, y + fx * sa0 + (fy - 40 * s) * ca0];
  }

  // удилище
  let rodA = -0.85;
  let bend = 0;
  switch (e.phase) {
    case "charging": rodA = -0.85 - e.power * 1.3; break;
    case "casting": rodA = -2.1 + Math.min(1, e.castT * 3) * 1.6; break;
    case "waiting": case "sinking": rodA = -0.55 + Math.sin(t * 1.3) * 0.03; break;
    case "bite": rodA = -0.45 + Math.sin(t * 30) * 0.08; bend = 0.25; break;
    case "fight": {
      const h = e.hooked;
      rodA = -0.95 - (e.reeling ? 0.18 : 0) + e.pullDir * 0.18;
      bend = clamp(h?.tension ?? 0, 0, 1.2) * (h && h.jump > 0 ? 0.5 : 1);
      break;
    }
    case "caught": rodA = -1.1; break;
  }
  const hx = fx + 6 * s, hy = fy - 30 * s;
  ctx.strokeStyle = coat;
  ctx.lineWidth = 3.6 * s;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(fx + 3 * s, fy - 38 * s);
  ctx.lineTo(hx, hy);
  ctx.stroke();
  const rodLen = (72 + tier * 6) * s;
  const tipX = hx + Math.cos(rodA) * rodLen * (1 - bend * 0.14);
  const tipY = hy + Math.sin(rodA) * rodLen * (1 - bend * 0.28) + bend * rodLen * 0.38;
  const cxr = hx + Math.cos(rodA) * rodLen * 0.62, cyr = hy + Math.sin(rodA) * rodLen * 0.62;
  ctx.strokeStyle = dim("#241810");
  ctx.lineWidth = 2.6 * s;
  ctx.beginPath();
  ctx.moveTo(hx - Math.cos(rodA) * 12 * s, hy - Math.sin(rodA) * 12 * s);
  ctx.quadraticCurveTo(cxr, cyr, (hx + cxr) / 2 + (tipX - hx) * 0.2, (hy + cyr) / 2 + (tipY - hy) * 0.2);
  ctx.stroke();
  ctx.lineWidth = 1.4 * s;
  ctx.beginPath();
  ctx.moveTo((hx + cxr) / 2 + (tipX - hx) * 0.2, (hy + cyr) / 2 + (tipY - hy) * 0.2);
  ctx.quadraticCurveTo(cxr + (tipX - cxr) * 0.3, cyr + (tipY - cyr) * 0.1, tipX, tipY);
  ctx.stroke();
  // катушка и рука, крутящая ручку
  ctx.fillStyle = dim("#9a9aa2");
  ctx.beginPath();
  ctx.arc(hx + 2 * s, hy + 3 * s, 3 * s, 0, Math.PI * 2);
  ctx.fill();
  const crank = e.reeling || e.phase === "sinking" ? t * (e.reeling ? 14 : 4) : 0;
  const kx = hx + 2 * s + Math.cos(crank) * 4 * s, ky = hy + 3 * s + Math.sin(crank) * 4 * s;
  ctx.strokeStyle = coat;
  ctx.lineWidth = 3 * s;
  ctx.beginPath();
  ctx.moveTo(fx - 2 * s, fy - 37 * s);
  ctx.lineTo(kx, ky);
  ctx.stroke();
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(kx, ky, 1.8 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // пена у бортов
  ctx.fillStyle = `rgba(255,255,255,${0.35 + 0.15 * (1 - night)})`;
  for (let i = 0; i < 6; i++) {
    const px = x - w * 0.5 + (i / 5) * w;
    const p = (Math.sin(t * 2 + i * 1.3) + 1) / 2;
    ctx.beginPath();
    ctx.ellipse(px, f.waveY(px) + 1, 6 + p * 8, 1.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // дым
  for (const p of smoke) {
    p.t += f.dt;
    p.x += p.vx * f.dt;
    p.y -= 14 * f.dt;
    ctx.fillStyle = `rgba(${night > 0.5 ? "90,95,105" : "210,210,215"},${0.3 * (1 - p.t / 3)})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2 + p.t * 5, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = smoke.length - 1; i >= 0; i--) if (smoke[i].t > 3) smoke.splice(i, 1);

  const ca = Math.cos(ang), sa = Math.sin(ang);
  return [x + tipX * ca - tipY * sa, y + tipX * sa + tipY * ca];
}
