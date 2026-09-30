import { config } from "dotenv";
import type { Config } from "drizzle-kit";

// локальные секреты читаем из .env.local, затем из .env; в CI/Vercel переменная приходит из окружения
config({ path: [".env.local", ".env"], quiet: true });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error(
    "DATABASE_URL не задан: укажите переменную окружения или создайте .env.local\n" +
      "(например: postgresql://postgres:postgres@127.0.0.1:5432/app_db)",
  );
  process.exit(1);
}

export default {
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url },
} satisfies Config;
