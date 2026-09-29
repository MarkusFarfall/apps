import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

// Supabase (и большинство облачных Postgres) требуют SSL
const needsSsl = /supabase\.(co|com)|sslmode=require/i.test(databaseUrl);

const globalForDb = globalThis as typeof globalThis & {
  __fishingPool?: Pool;
};

export const pool =
  globalForDb.__fishingPool ??
  new Pool({
    connectionString: databaseUrl,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
    max: 5,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__fishingPool = pool;
}

export const db = drizzle(pool, { schema });
