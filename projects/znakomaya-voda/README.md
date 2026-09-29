# Знакомая вода

Атмосферный симулятор морской рыбалки: лодка, рыбалка на глубине, 12 акваторий, коллекция рыб, порты, сезоны, погода и ежедневные задания. Есть локальное сохранение для игры без аккаунта; учётная запись синхронизирует прогресс между устройствами.

## Стек

- Next.js 16 · React 19 · TypeScript 5
- Tailwind CSS 4
- PostgreSQL через Drizzle ORM и `pg`
- Supabase используется как управляемый PostgreSQL-хостинг. Приложение подключается серверным `DATABASE_URL`; `supabase-js` и публичный Supabase API-ключ не нужны.

## Локальная разработка

```bash
npm ci
cp .env.example .env
# Заполните DATABASE_URL строкой подключения из Supabase
npm run dev
```

Откройте <http://localhost:3000>. Для запуска проверки и production-сборки:

```bash
npm run typecheck
npm run lint
npm run build
npm start
```

Приложение запускается и без базы для просмотра интерфейса, но регистрация, аккаунты и облачные сохранения требуют `DATABASE_URL` и созданных таблиц.

## Подключение Supabase

1. Создайте проект в Supabase.
2. В **Project Settings → Database → Connection string** выберите **Transaction pooler**. Скопируйте готовый URI целиком и задайте его как `DATABASE_URL` в локальном `.env` и в переменных окружения Vercel. Не заменяйте пароль плейсхолдером из `.env.example` и не коммитьте реальные секреты.
3. Создайте схему одним из способов:
   - **Supabase Dashboard → SQL Editor:** выполните `supabase/schema.sql`, затем `supabase/security.sql`;
   - **из проекта:** после настройки `.env` запустите `npm run db:migrate`, затем отдельно выполните `supabase/security.sql` в SQL Editor.
4. Проверьте `/api/health`: при рабочем подключении ответ содержит `{"ok":true,"db":"up"}`.

`supabase/security.sql` включает RLS и закрывает таблицы от ролей `anon` и `authenticated`. Сервер подключается к Postgres с секретной строкой `DATABASE_URL`; строка не попадает в браузер. Не используйте `service_role` или пароль БД в клиентском коде.

## Переменные окружения

| Имя | Нужно | Назначение |
|---|---|---|
| `DATABASE_URL` | Да для API/БД | Supabase Postgres URI (лучше Transaction pooler на Vercel) |
| `NEXT_PUBLIC_SITE_URL` | Нет | Канонический публичный URL для Open Graph; локально `http://localhost:3000` |
| `DB_POOL_MAX` | Нет | Максимум соединений в одном инстансе; по умолчанию `1`, подходит для serverless |
| `NODE_ENV` | Нет | Next.js задаёт автоматически |

Для Preview- и Production-окружений Vercel задайте `DATABASE_URL` отдельно. Не добавляйте файл `.env` в Git.

## Drizzle и схема базы

- `src/db/schema.ts` — типизированная схема Drizzle.
- `drizzle/` — миграции, запускаемые командой `npm run db:migrate`.
- `supabase/schema.sql` — SQL для первоначальной настройки через Supabase SQL Editor.
- `supabase/security.sql` — политики доступа/RLS.
- `npm run db:generate` создаёт миграцию после изменения схемы; перед применением проверьте сгенерированный SQL.
- `npm run db:studio` открывает Drizzle Studio и использует `DATABASE_URL`.

## Деплой на Vercel

Создайте отдельный проект Vercel, подключите этот репозиторий и установите **Root Directory** = `projects/znakomaya-voda`. Vercel определит Next.js; стандартные команды установки и сборки — `npm install` и `npm run build`. Добавьте `DATABASE_URL` в Environment Variables для нужных окружений. После настройки БД откройте `/api/health`.

Здесь нет секретов Supabase: реальный проект БД и его учётные данные должны быть созданы/добавлены в Supabase и Vercel владельцем аккаунта.
