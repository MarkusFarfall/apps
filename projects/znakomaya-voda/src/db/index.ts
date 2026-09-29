import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalForDb = globalThis as typeof globalThis & {
  __fishingPool?: Pool;
};

let localPool: Pool | undefined;
let dbInstance: ReturnType<typeof createDb> | undefined;

function getPool() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required. Copy .env.example and add your Supabase connection string.");
  }
  if (localPool) return localPool;

  // Supabase and most hosted PostgreSQL providers require SSL.
  const needsSsl = /supabase\.(co|com)|sslmode=require/i.test(databaseUrl);
  const configuredMax = Number.parseInt(process.env.DB_POOL_MAX ?? "1", 10);
  const max = Number.isInteger(configuredMax) && configuredMax > 0 ? Math.min(configuredMax, 10) : 1;
  localPool =
    (process.env.NODE_ENV !== "production" ? globalForDb.__fishingPool : undefined) ??
    new Pool({ connectionString: databaseUrl, ssl: needsSsl ? { rejectUnauthorized: false } : undefined, max });

  if (process.env.NODE_ENV !== "production") globalForDb.__fishingPool = localPool;
  return localPool;
}

function createDb() {
  return drizzle(getPool(), { schema });
}

function getDb() {
  return (dbInstance ??= createDb());
}

// Delay creating the DB pool until a request actually accesses it. This keeps
// Next.js builds and the game UI usable before Supabase is configured.
type AppDb = ReturnType<typeof createDb>;
export const db = new Proxy({} as AppDb, {
  get(_target, property) {
    const target = getDb();
    const value = Reflect.get(target, property, target) as unknown;
    return typeof value === "function" ? value.bind(target) : value;
  },
});
