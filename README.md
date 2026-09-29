# apps

Монорепозиторий с моими проектами. Каждый проект живёт в отдельной папке `projects/<имя>` и разворачивается
как самостоятельный проект на Vercel со своим URL.

## Проекты

| Проект | Что это | Стек | Живая версия |
|---|---|---|---|
| [**ДМБ Таймер**](projects/dmb-timer) | Дембельский таймер до секунды: стата, календарь, «сантиметр», медали, push-уведомления. PWA, работает офлайн | Vite 7 · React 19 · TypeScript · Tailwind 4 | https://dmb-timer.vercel.app |
| [**Знакомая вода**](projects/znakomaya-voda) | Атмосферный симулятор морской рыбалки: акватории, коллекция рыб, порты, сезоны, аккаунты и облачные сохранения | Next.js 16 · React 19 · TypeScript · Tailwind 4 · Supabase Postgres | Настроить Vercel |
| *Сайт-каталог* (`site/`) | Страница со списком проектов — открывается на корневом домене | HTML + CSS, без сборки | https://apps-markusfarfall.vercel.app |

## Структура

```
.
├── site/                    каталог проектов (статический лендинг)
│   └── index.html
├── projects/
│   ├── dmb-timer/           ДМБ Таймер — исходники
│   │   ├── src/
│   │   ├── public/
│   │   ├── package.json
│   │   └── README.md
│   └── znakomaya-voda/      Знакомая вода — Next.js + Supabase Postgres
│       ├── src/
│       ├── supabase/
│       ├── package.json
│       └── README.md
└── README.md                этот файл
```

## Как добавить новый проект

1. Создать папку `projects/<имя>` с исходниками и собственным `README.md`.
2. Добавить проект в таблицу выше и карточку в `site/index.html`.
3. На Vercel создать проект, подключённый к этому репозиторию, с **Root Directory** = `projects/<имя>`.
   Дальше каждый push в `main` деплоится автоматически.

## Деплой

- **Vercel, Git-интеграция.** Проекты `apps` (Root Directory `site`) и `dmb-timer`
  (Root Directory `projects/dmb-timer`) подключены. `znakomaya-voda` требует отдельного проекта Vercel
  с Root Directory `projects/znakomaya-voda` и переменной `DATABASE_URL` от Supabase.
- `main` → production. Любая другая ветка → preview-деплой с отдельным URL.

## Заметки по окружению

Репозиторий создавался и настраивался из облачной песочницы: `.vercel/` и `.env.local` в `.gitignore`,
секретов в истории нет. Для локальной работы достаточно `git clone` и обычного `npm ci` внутри нужного проекта.
