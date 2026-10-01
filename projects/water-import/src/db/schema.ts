import { index, integer, jsonb, pgTable, real, serial, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";

// Учётные записи
export const users = pgTable(
  "users",
  {
    id: varchar("id", { length: 40 }).primaryKey(),
    username: varchar("username", { length: 24 }).notNull(),
    usernameLower: varchar("username_lower", { length: 24 }).notNull(),
    passwordHash: varchar("password_hash", { length: 200 }).notNull(),
    role: varchar("role", { length: 16 }).notNull().default("player"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("users_username_lower_uq").on(t.usernameLower)],
);

// Счётчики ограничения частоты (общие для всех инстансов)
export const rateLimits = pgTable(
  "rate_limits",
  {
    key: varchar("key", { length: 200 }).primaryKey(),
    count: integer("count").notNull().default(1),
    resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("rate_limits_reset_idx").on(t.resetAt)],
);

// Сессии: в базе хранится только SHA-256 от токена
export const sessions = pgTable(
  "sessions",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: varchar("user_id", { length: 40 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    userAgent: varchar("user_agent", { length: 200 }),
  },
  (t) => [index("sessions_user_idx").on(t.userId), index("sessions_expires_idx").on(t.expiresAt)],
);

// Игровой профиль пользователя. Гостевого режима нет.
export const players = pgTable(
  "players",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: varchar("user_id", { length: 40 }).references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 48 }).notNull().default("Рыбак"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("players_user_uq").on(t.userId)],
);

// Полное сохранение игры (JSON) + денормализованные поля для рейтингов
export const saves = pgTable(
  "saves",
  {
    playerId: varchar("player_id", { length: 64 })
      .primaryKey()
      .references(() => players.id, { onDelete: "cascade" }),
    data: jsonb("data").notNull(),
    version: integer("version").notNull().default(1),
    money: integer("money").notNull().default(0),
    codexCount: integer("codex_count").notNull().default(0),
    totalCaught: integer("total_caught").notNull().default(0),
    playSeconds: integer("play_seconds").notNull().default(0),
    level: integer("level").notNull().default(1),
    achievements: integer("achievements").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("saves_codex_idx").on(t.codexCount)],
);

// Журнал уловов — для рекордов
export const catches = pgTable(
  "catches",
  {
    id: serial("id").primaryKey(),
    playerId: varchar("player_id", { length: 64 })
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    fishId: varchar("fish_id", { length: 48 }).notNull(),
    weight: real("weight").notNull(),
    variant: varchar("variant", { length: 24 }),
    locationId: varchar("location_id", { length: 32 }).notNull(),
    gameDay: integer("game_day").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("catches_fish_idx").on(t.fishId, t.weight), index("catches_player_idx").on(t.playerId)],
);
