# apps

Монорепозиторий с моими проектами. Каждый проект живёт в отдельной папке `projects/<имя>` и разворачивается
как самостоятельный проект на Vercel со своим URL.

## Проекты

| Проект | Что это | Стек | Живая версия |
|---|---|---|---|
| [**ДМБ Таймер**](projects/dmb-timer) | Дембельский таймер до секунды: стата, календарь, «сантиметр», медали, push-уведомления. PWA, работает офлайн | Vite 7 · React 19 · TypeScript · Tailwind 4 | https://dmb-timer.vercel.app |
| [**Знакомая вода**](projects/water-import) | Симулятор морской рыбалки: 12 акваторий, 301 вид рыб, снаряжение, экономика портов. Аккаунты и облачные сохранения в Postgres | Next.js 16 · React 19 · TypeScript · Tailwind 4 · Drizzle ORM | https://znakomaya-voda.vercel.app |
| [**Pocket Radio**](projects/pocket-radio) | Интернет-радио: свои потоки, поиск станций, подкасты, плейлисты, статистика, офлайн. Облачные аккаунты в Supabase | Vite 7 · React 19 · TypeScript · Tailwind 4 · Dexie · Supabase | после деплоя на Vercel |
| *Сайт-каталог* (`site/`) | Страница со списком проектов — открывается на корневом домене | HTML + CSS, без сборки | https://apps-markusfarfall.vercel.app |

## Структура

```
.
├── site/                    каталог проектов (статический лендинг)
│   └── index.html
├── projects/
│   ├── dmb-timer/           ДМБ Таймер — исходники
│   ├── water-import/        Знакомая вода — исходники
│   └── pocket-radio/        Pocket Radio — исходники
└── README.md                этот файл
```

## Как добавить новый проект

1. Создать папку `projects/<имя>` с исходниками и собственным `README.md`.
2. Добавить проект в таблицу выше и карточку в `site/index.html`.
3. На Vercel создать проект, подключённый к этому репозиторию, с **Root Directory** = `projects/<имя>`.
   Дальше каждый push в `main` деплоится автоматически.

## Деплой

- **Vercel, Git-интеграция.** Проекты `apps` (корневой каталог, Root Directory `site`), `dmb-timer`
  (Root Directory `projects/dmb-timer`) и `water-import` (Root Directory `projects/water-import`)
  подключены к этому репозиторию. Pocket Radio — новый проект: на Vercel нужно создать запись
  с Root Directory `projects/pocket-radio` и переменными `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- `main` → production. Любая другая ветка → preview-деплой с отдельным URL.

## Заметки по окружению

Репозиторий создавался и настраивался из облачной песочницы: `.vercel/` и `.env.local` в `.gitignore`,
секретов в истории нет. Для локальной работы достаточно `git clone` и обычного `npm ci` внутри нужного проекта.
