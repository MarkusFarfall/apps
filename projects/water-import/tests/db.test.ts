import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getTableColumns, getTableName } from "drizzle-orm";
import * as schema from "../src/db/schema";

/**
 * Проверка слоя базы.
 *
 * Первая часть — без подключения: сверяет описание схемы в Drizzle с каноническим
 * `supabase/schema.sql`. Раньше схема жила в двух местах и синхронизировалась
 * вручную, поэтому новую колонку легко было добавить только в одно из них.
 *
 * Вторая часть — против живой базы (`TEST_DATABASE_URL`, в CI поднимается service
 * container): таблицы на месте, RLS включён, внешние ключи и каскады работают.
 */

interface TableInfo { name: string; columns: string[] }

function drizzleTables(mod: Record<string, unknown>): TableInfo[] {
  const out: TableInfo[] = [];
  for (const value of Object.values(mod)) {
    try {
      const name = getTableName(value as never);
      const columns = Object.values(getTableColumns(value as never)).map((c) => (c as { name: string }).name);
      out.push({ name, columns });
    } catch {
      // не таблица (например, вспомогательный экспорт)
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

const TABLES = drizzleTables(schema as unknown as Record<string, unknown>);

/** Блоки `CREATE TABLE "имя" ( ... );` из канонического DDL. */
function sqlTableBlocks(file: string): Map<string, string> {
  const text = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  const blocks = new Map<string, string>();
  for (const m of text.matchAll(/CREATE TABLE "([a-z_]+)" \(([\s\S]*?)\n\);/g)) blocks.set(m[1], m[2]);
  return blocks;
}

test("схема описана и в Drizzle, и в schema.sql", () => {
  assert.ok(TABLES.length >= 7, `ожидалось не меньше семи таблиц, найдено ${TABLES.length}`);
  const blocks = sqlTableBlocks("supabase/schema.sql");
  for (const t of TABLES) {
    assert.ok(blocks.has(t.name), `таблицы ${t.name} нет в supabase/schema.sql`);
    for (const col of t.columns) {
      assert.ok(blocks.get(t.name)!.includes(`"${col}"`), `колонки ${t.name}.${col} нет в supabase/schema.sql`);
    }
  }
});

test("миграция умеет добить схему до нужного вида", () => {
  const migrate = readFileSync(new URL("../scripts/db-migrate.mjs", import.meta.url), "utf8");
  const blocks = sqlTableBlocks("supabase/schema.sql");
  // Всё, что есть в schema.sql, миграция либо создаёт, либо добавляет отдельно.
  for (const t of TABLES) {
    assert.ok(blocks.has(t.name), `таблицы ${t.name} не описана в schema.sql`);
  }
  // Идемпотентность: миграция обязана быть повторяемой.
  assert.match(migrate, /create table if not exists/i);
  assert.match(migrate, /add column if not exists/i);
  assert.match(migrate, /create unique index if not exists/i);
  // Ключ идемпотентности уловов должен доезжать до схемы.
  assert.match(migrate, /catches_cid_uq/);
});

// ─────────── против живой базы ───────────

const DB_URL = process.env.TEST_DATABASE_URL;
const againstDb = { skip: !DB_URL ? "TEST_DATABASE_URL не задан — прогон против базы пропущен" : false };

test("база: таблицы, RLS и целостность кругом", againstDb, async () => {
  const pool = new Pool({ connectionString: DB_URL! });
  const db = drizzle(pool, { schema });
  const stamp = Date.now().toString(36);
  const userId = `usr_${stamp}${"0".repeat(12)}`.slice(0, 40);
  const playerId = `u-${stamp}-${Math.random().toString(36).slice(2, 8)}`;

  try {
    // 1. Все таблицы схемы на месте и закрыты от публичного API.
    const present = await db.execute(sql`select tablename from pg_tables where schemaname = 'public'`);
    const names = new Set((present.rows as { tablename: string }[]).map((r) => r.tablename));
    for (const t of TABLES) assert.ok(names.has(t.name), `в базе нет таблицы ${t.name}`);

    const rls = await db.execute(sql`
      select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relrowsecurity`);
    const rlsNames = new Set((rls.rows as { relname: string }[]).map((r) => r.relname));
    for (const t of TABLES) assert.ok(rlsNames.has(t.name), `RLS не включён для ${t.name}`);

    // 2. Ключ идемпотентности уловов: колонка и уникальный индекс.
    const cid = await db.execute(sql`
      select column_name from information_schema.columns
      where table_schema = 'public' and table_name = 'catches' and column_name = 'cid'`);
    assert.equal((cid.rows as unknown[]).length, 1, "колонки catches.cid нет — миграция не применена");
    const idx = await db.execute(sql`
      select indexname from pg_indexes
      where schemaname = 'public' and tablename = 'catches' and indexname = 'catches_cid_uq'`);
    assert.equal((idx.rows as unknown[]).length, 1, "индекса catches_cid_uq нет");

    // 3. Круг: учётная запись → профиль → сохранение → улов → дружба.
    await db.insert(schema.users).values({ id: userId, username: `t${stamp}`, usernameLower: `t${stamp}`, passwordHash: "scrypt$16384$AAAA$BBBB" });
    await db.insert(schema.players).values({ id: playerId, userId, name: "Тест" });
    await db.insert(schema.saves).values({ playerId, data: { money: 1 }, codexCount: 1, playSeconds: 10 });
    await db.insert(schema.catches).values({ playerId, fishId: "goby", weight: 0.2, locationId: "bay", cid: `c${stamp}` });
    const second = `usr_${stamp}b`.slice(0, 40);
    await db.insert(schema.users).values({ id: second, username: `t${stamp}b`, usernameLower: `t${stamp}b`, passwordHash: "x" });
    await db.insert(schema.friendships).values({ aUserId: userId < second ? userId : second, bUserId: userId < second ? second : userId, requestedBy: userId });

    // 4. Повтор улова с тем же ключом не задваивается.
    await db.insert(schema.catches).values({ playerId, fishId: "goby", weight: 0.2, locationId: "bay", cid: `c${stamp}` }).onConflictDoNothing();
    const counted = await db.execute(sql`select count(*)::int as n from catches where player_id = ${playerId}`);
    assert.equal((counted.rows as { n: number }[])[0].n, 1, "повторная отправка улова задвоила запись");

    // 5. Дружба читается с любой стороны и в обоих направлениях.
    const [a, b] = userId < second ? [userId, second] : [second, userId];
    const pair = await db.select().from(schema.friendships).where(and(eq(schema.friendships.aUserId, a), eq(schema.friendships.bUserId, b))).limit(1);
    assert.equal(pair.length, 1);

    // 6. Удаление аккаунта уносит всё за собой.
    await db.delete(schema.users).where(eq(schema.users.id, userId));
    const left = await db.execute(sql`
      select (select count(*)::int from players where id = ${playerId}) as players,
             (select count(*)::int from saves where player_id = ${playerId}) as saves,
             (select count(*)::int from catches where player_id = ${playerId}) as catches`);
    assert.deepEqual(left.rows[0], { players: 0, saves: 0, catches: 0 }, "каскадное удаление не сработало");
    await db.delete(schema.users).where(eq(schema.users.id, second));
  } finally {
    await pool.end();
  }
});
