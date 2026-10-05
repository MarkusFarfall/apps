/**
 * Собирает автономную страницу с интерактивным Canvas-движком сцены входа.
 * Запуск: npx tsx scripts/render-auth-scene.tsx
 */
import { readFileSync, writeFileSync } from "node:fs";
import * as ts from "typescript";

const source = readFileSync("src/components/game/scene/seaEngine.ts", "utf8");
const engine = ts
  .transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
  })
  .outputText.replace("export class SeaEngine", "class SeaEngine");

const scenes = [
  ["login", "Вход", "Ночь у маяка · знакомая вода"],
  ["register", "Регистрация", "Рассвет в бухте · первый заброс впереди"],
] as const;

const cards = scenes
  .map(
    ([mode, title, caption]) => `
      <article class="panel">
        <div class="frame">
          <canvas class="sea-preview" data-mode="${mode}" aria-label="Анимированная сцена: ${title.toLowerCase()}"></canvas>
          <span class="badge">${title}</span>
          <button class="skip" type="button" data-action="skip">Пропустить заставку</button>
        </div>
        <div class="caption">
          <div class="label">${title}</div>
          <p>${caption}</p>
          <div class="controls">
            <button type="button" data-action="nibble">Приманить рыбу</button>
            <button type="button" data-action="catch">Показать улов</button>
          </div>
        </div>
      </article>`,
  )
  .join("\n");

writeFileSync(
  "auth-scene.html",
  `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Знакомая вода — сцена входа</title>
<style>
  :root { color-scheme: dark; --brass: #c8a46a; --line: rgba(230,225,214,.16); }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; padding: 32px 20px 48px; background: radial-gradient(1000px 560px at 50% -10%, #142130, #050a12 70%); color: #e6e1d6; font-family: Inter, system-ui, sans-serif; }
  h1 { margin: 0 0 6px; font-family: Georgia, serif; font-weight: 500; font-size: clamp(26px, 4vw, 38px); }
  .lead { max-width: 680px; margin: 0 0 24px; color: #9aa6ae; font-size: 14px; line-height: 1.6; }
  .row { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 360px), 1fr)); gap: 22px; max-width: 1060px; }
  .panel { min-width: 0; }
  .frame { position: relative; height: min(68vh, 600px); min-height: 380px; overflow: hidden; border: 1px solid var(--line); border-radius: 5px; background: #050c14; box-shadow: 0 26px 70px #0008; }
  canvas { display: block; width: 100%; height: 100%; }
  .badge { position: absolute; top: 14px; left: 15px; padding: 7px 10px; border: 1px solid #e6e1d633; background: #050c14a8; color: #e3c996; font-size: 10px; letter-spacing: .18em; text-transform: uppercase; backdrop-filter: blur(8px); }
  button { border: 1px solid #c8a46a88; border-radius: 2px; background: #09121ccc; color: #e3c996; cursor: pointer; font: inherit; font-size: 11px; letter-spacing: .08em; padding: 9px 12px; }
  button:hover { background: #c8a46a22; }
  .skip { position: absolute; right: 12px; bottom: 12px; background: #050c14a8; }
  .caption { padding: 13px 2px 0; }
  .label { color: var(--brass); font-size: 10px; letter-spacing: .2em; text-transform: uppercase; }
  .caption p { margin: 5px 0 12px; color: #ece3d0; font-family: Georgia, serif; font-size: 18px; font-style: italic; }
  .controls { display: flex; flex-wrap: wrap; gap: 8px; }
  .hint { margin-top: 24px; color: #84919b; font-size: 12px; line-height: 1.7; max-width: 720px; }
  @media (prefers-reduced-motion: reduce) { button { transition: none; } }
</style>
</head>
<body>
  <h1>Сцена входа и регистрации</h1>
  <p class="lead">Тот же Canvas-движок, что в игре: берег под ночным небом, маяк, вода, лодка и подводная жизнь. Наведите курсор на сцену, нажмите на воду или проверьте реакции рыбы кнопками.</p>
  <div class="row">${cards}</div>
  <p class="hint">Качество ограничено размером холста, чтобы не перегружать Retina-дисплеи. Если включено системное «уменьшить движение», сцена сразу покажет спокойный кадр.</p>
<script>
${engine}
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
document.querySelectorAll('.sea-preview').forEach((canvas) => {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return;
  const wrapper = canvas.parentElement;
  const mode = canvas.dataset.mode === 'register' ? 'register' : 'login';
  const engine = new SeaEngine(ctx, { onIntroDone() {}, onDiveDone() {} }, reduced);
  engine.setQuality(1);
  engine.setMode(mode, true);
  const resize = () => {
    const rect = wrapper.getBoundingClientRect();
    const dpr = Math.max(0.7, Math.min(window.devicePixelRatio || 1, 1.6));
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    engine.resize(rect.width, rect.height, dpr);
  };
  new ResizeObserver(resize).observe(wrapper);
  resize();
  let last = performance.now();
  const frame = (now) => {
    engine.update(Math.min((now - last) / 1000, 0.05));
    last = now;
    engine.render();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  window.addEventListener('pointermove', (event) => engine.setPointer((event.clientX / window.innerWidth) * 2 - 1));
  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    engine.tap(event.clientX - rect.left, event.clientY - rect.top);
  });
  wrapper.querySelector('[data-action="skip"]').addEventListener('click', () => engine.skipIntro());
  wrapper.parentElement.querySelector('[data-action="nibble"]').addEventListener('click', () => engine.nibble());
  wrapper.parentElement.querySelector('[data-action="catch"]').addEventListener('click', () => {
    engine.bite();
    window.setTimeout(() => engine.success(), 260);
  });
});
</script>
</body>
</html>\n`,
);
console.log("  ✓ auth-scene.html собран");
