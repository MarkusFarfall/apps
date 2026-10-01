/**
 * Собирает автономный HTML с настоящей сценой входа — чтобы посмотреть анимацию
 * без запуска игры. Рендерит тот же компонент, что и приложение.
 * Запуск: npx tsx scripts/render-auth-scene.tsx
 */
import { writeFileSync, readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { AuthScene } from "../src/components/game/AuthScene";

const css = readFileSync("src/app/globals.css", "utf8");
const sceneCss = css.slice(css.indexOf("/* ───────── сцена входа"));

const panel = (mode: "login" | "register", title: string, caption: string) => `
  <figure class="panel">
    <div class="frame">${renderToStaticMarkup(createElement(AuthScene, { mode }))}</div>
    <figcaption>
      <div class="label-brass">${title}</div>
      <p>${caption}</p>
    </figcaption>
  </figure>`;

writeFileSync(
  "auth-scene.html",
  `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Знакомая вода — сцена входа</title>
<style>
  :root {
    --brass: #c8a35a;
    --line: rgba(200, 163, 90, 0.22);
    --font-display: Georgia, "Times New Roman", serif;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 32px 20px 48px;
    background: radial-gradient(1200px 600px at 50% -10%, #0d1a26 0%, #050a12 60%);
    color: #e6e1d6; font-family: -apple-system, "Segoe UI", Roboto, sans-serif;
  }
  h1 { font-family: var(--font-display); font-weight: 500; font-size: 30px; margin: 0 0 4px; }
  .lead { color: #8fa0ae; font-size: 14px; margin: 0 0 26px; }
  .row { display: flex; gap: 22px; flex-wrap: wrap; align-items: flex-start; }
  .panel { margin: 0; width: 400px; max-width: 100%; }
  .frame { position: relative; height: 520px; overflow: hidden; border: 1px solid var(--line); border-radius: 4px; background: #050c14; }
  figcaption { padding: 14px 2px 0; }
  .label-brass { color: var(--brass); font-size: 11px; letter-spacing: .16em; text-transform: uppercase; }
  figcaption p { margin: 6px 0 0; font-family: var(--font-display); font-style: italic; font-size: 18px; color: #ece3d0; }
  .hint { margin-top: 30px; color: #7f8f9d; font-size: 12px; line-height: 1.7; max-width: 620px; }
  ${sceneCss}
</style>
</head>
<body>
  <h1>Сцена входа и регистрации</h1>
  <p class="lead">Тот же векторный компонент, что в игре: волны, лодка, рыба, пузырьки и всплеск. Наведите курсор на панель и нажмите — можно «пришпорить» время.</p>
  <div class="row">
    ${panel("login", "Вход", "С возвращением на воду. Лодка ждёт.")}
    ${panel("register", "Регистрация", "Снасть собрана. Осталось отойти от берега.")}
  </div>
  <p class="hint">Если в системе включено «уменьшить движение», анимация замирает — так задумано. На телефоне сцена занимает верхнюю полосу экрана, на компьютере — левую колонку.</p>
</body>
</html>
`,
);
console.log("  ✓ auth-scene.html собран");
