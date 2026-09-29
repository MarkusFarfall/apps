CREATE TABLE "catches" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" varchar(64) NOT NULL,
	"fish_id" varchar(48) NOT NULL,
	"weight" real NOT NULL,
	"variant" varchar(24),
	"location_id" varchar(32) NOT NULL,
	"game_day" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "players" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" varchar(40),
	"name" varchar(48) DEFAULT 'Рыбак' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "saves" (
	"player_id" varchar(64) PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"money" integer DEFAULT 0 NOT NULL,
	"codex_count" integer DEFAULT 0 NOT NULL,
	"total_caught" integer DEFAULT 0 NOT NULL,
	"play_seconds" integer DEFAULT 0 NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"achievements" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "sessions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" varchar(40) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"user_agent" varchar(200)
);

CREATE TABLE "users" (
	"id" varchar(40) PRIMARY KEY NOT NULL,
	"username" varchar(24) NOT NULL,
	"username_lower" varchar(24) NOT NULL,
	"email" varchar(254),
	"password_hash" varchar(200) NOT NULL,
	"role" varchar(16) DEFAULT 'player' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone
);

ALTER TABLE "catches" ADD CONSTRAINT "catches_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "players" ADD CONSTRAINT "players_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "saves" ADD CONSTRAINT "saves_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "catches_fish_idx" ON "catches" USING btree ("fish_id","weight");
CREATE INDEX "catches_player_idx" ON "catches" USING btree ("player_id");
CREATE UNIQUE INDEX "players_user_uq" ON "players" USING btree ("user_id");
CREATE INDEX "saves_codex_idx" ON "saves" USING btree ("codex_count");
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");
CREATE INDEX "sessions_expires_idx" ON "sessions" USING btree ("expires_at");
CREATE UNIQUE INDEX "users_username_lower_uq" ON "users" USING btree ("username_lower");
CREATE UNIQUE INDEX "users_email_uq" ON "users" USING btree ("email");

-- ── безопасность для Supabase (см. security.sql) ──
alter table public.users    enable row level security;
alter table public.sessions enable row level security;
alter table public.players  enable row level security;
alter table public.saves    enable row level security;
alter table public.catches  enable row level security;
