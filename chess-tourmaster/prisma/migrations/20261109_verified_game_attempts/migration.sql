CREATE TABLE "game_attempts" (
  "id" UUID PRIMARY KEY,
  "portal_user_id" INTEGER NOT NULL,
  "game_mode" TEXT NOT NULL,
  "level" INTEGER NOT NULL CHECK (level BETWEEN 1 AND 100),
  "level_version" INTEGER NOT NULL,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resumed_at" TIMESTAMP(3),
  "active_ms" INTEGER NOT NULL DEFAULT 0,
  "finished_at" TIMESTAMP(3),
  "stars" INTEGER,
  "moves_count" INTEGER
);
CREATE INDEX "game_attempts_portal_user_id_idx" ON "game_attempts"("portal_user_id");
CREATE TABLE "attempt_hints" (
  "attempt_id" UUID NOT NULL REFERENCES "game_attempts"("id") ON DELETE CASCADE,
  "position_key" TEXT NOT NULL,
  "move_r" INTEGER NOT NULL,
  "move_c" INTEGER NOT NULL,
  PRIMARY KEY ("attempt_id", "position_key")
);
