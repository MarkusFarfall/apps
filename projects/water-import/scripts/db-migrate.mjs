/**
 * Приводит базу к схеме проекта: создаёт таблицы, если их ещё нет,
 * и всегда обновляет политики доступа (supabase/security.sql).
 * Повторный запуск безопасен.
 *
 * Запуск:  node scripts/db-migrate.mjs
 * Строка подключения берётся из DATABASE_URL или из .env.local / .env.
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

for (const file of ['.env.local', '.env']) {
  const full = path.join(root, file);
  if (!existsSync(full)) continue;
  for (const line of readFileSync(full, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL не задан (укажите переменную окружения или .env.local)');
  process.exit(1);
}

const read = (name) => readFileSync(path.join(root, 'supabase', name), 'utf8');

const client = new pg.Client({
  connectionString: url,
  ssl: /sslmode=require|supabase\.(co|com)/i.test(url) ? { rejectUnauthorized: false } : undefined,
});

const fail = (message) => {
  console.error(`✗ ${message}`);
  process.exit(1);
};

try {
  await client.connect();
} catch (error) {
  fail(`не удалось подключиться к базе: ${error.message}`);
}

try {
  const existing = await client.query("select coalesce(to_regclass('public.users')::text, '') as t");
  if (existing.rows[0].t === 'users') {
    console.log('→ таблицы уже есть, схему не трогаю');
  } else {
    console.log('→ создаю таблицы (supabase/schema.sql)');
    await client.query(read('schema.sql'));
  }

  // Таблицы, добавленные позже базовой схемы. Раньше миграция при виде готовых
  // таблиц ничего не делала, поэтому на уже развёрнутых базах новые таблицы
  // не появлялись — создаём их отдельно и безопасно для повторного запуска.
  const later = [
    {
      name: 'rate_limits',
      sql: `create table if not exists public.rate_limits (
              key varchar(200) primary key,
              count integer not null default 1,
              reset_at timestamptz not null
            );
            create index if not exists rate_limits_reset_idx on public.rate_limits (reset_at);`,
    },
  ];
  for (const t of later) {
    const has = await client.query("select to_regclass('public.' || $1)::text as t", [t.name]);
    if (has.rows[0].t) {
      console.log(`→ таблица ${t.name} уже есть`);
    } else {
      await client.query(t.sql);
      console.log(`→ создана таблица ${t.name}`);
    }
  }

  console.log('→ применяю политики доступа (supabase/security.sql)');
  await client.query(read('security.sql'));

  const counts = await client.query(
    "select count(*)::int as n from information_schema.tables where table_schema = 'public'",
  );
  const rls = await client.query(
    "select count(*)::int as n from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relrowsecurity",
  );
  console.log(`✓ готово: таблиц в public — ${counts.rows[0].n}, под RLS — ${rls.rows[0].n}`);
} catch (error) {
  fail(error.message);
} finally {
  await client.end();
}
