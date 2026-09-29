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
--> statement-breakpoint
CREATE TABLE "players" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" varchar(40),
	"name" varchar(48) DEFAULT 'Рыбак' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" varchar(40) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"user_agent" varchar(200)
);
--> statement-breakpoint
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
--> statement-breakpoint
ALTER TABLE "catches" ADD CONSTRAINT "catches_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saves" ADD CONSTRAINT "saves_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "catches_fish_idx" ON "catches" USING btree ("fish_id","weight");--> statement-breakpoint
CREATE INDEX "catches_player_idx" ON "catches" USING btree ("player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "players_user_uq" ON "players" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "saves_codex_idx" ON "saves" USING btree ("codex_count");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_lower_uq" ON "users" USING btree ("username_lower");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uq" ON "users" USING btree ("email");