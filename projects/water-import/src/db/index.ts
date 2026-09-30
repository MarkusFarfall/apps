import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

type Database = ReturnType<typeof drizzle<typeof schema>>;

/**
 * Пул создаётся ЛЕНИВО — при первом обращении к базе, а не при импорте модуля.
 *
 * Почему так: маршруты читаются на этапе сборки (`next build`), и если падать
 * от отсутствия DATABASE_URL прямо в теле модуля, сборка ломается целиком
 * («Failed to collect page data»). При ленивом пуле сборка проходит без базы,
 * а отсутствие переменной видно на первом же запросе: /api/health отвечает
 * `{"ok":false,"db":"down"}`, остальные маршруты — 503 «Сервер временно недоступен».
 */
const globalForDb = globalThis as typeof globalThis & {
  __fishingPool?: Pool;
  __fishingDb?: Database;
};

function connect(): { pool: Pool; db: Database } {
  const existingPool = globalForDb.__fishingPool;
  const existingDb = globalForDb.__fishingDb;
  if (existingPool && existingDb) return { pool: existingPool, db: existingDb };

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  // Supabase (и большинство облачных Postgres) требуют SSL
  const needsSsl = /supabase\.(co|com)|sslmode=require/i.test(databaseUrl);

  const pool =
    existingPool ??
    new Pool({
      connectionString: databaseUrl,
      ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
      max: 5,
    });

  const database = existingDb ?? drizzle(pool, { schema });

  // держим одно подключение на процесс: в dev — чтобы пережить горячую перезагрузку,
  // в продакшене — чтобы лямбда не открывала новый пул на каждый запрос
  globalForDb.__fishingPool = pool;
  globalForDb.__fishingDb = database;

  return { pool, db: database };
}

const lazy = <T extends object>(pick: () => T): T =>
  new Proxy({} as T, {
    get(_target, prop) {
      const real = pick() as Record<PropertyKey, unknown>;
      const value = real[prop];
      // методы возвращаем привязанными к настоящему объекту, иначе теряется this
      return typeof value === "function" ? value.bind(real) : value;
    },
  });

export const db: Database = lazy(() => connect().db);
export const pool: Pool = lazy(() => connect().pool);
