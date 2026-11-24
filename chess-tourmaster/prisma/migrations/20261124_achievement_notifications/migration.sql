CREATE TABLE "achievement_notifications" (
    "attempt_id" UUID NOT NULL,
    "portal_user_id" INTEGER NOT NULL,
    "game_mode" TEXT NOT NULL,
    "clears" INTEGER NOT NULL,
    "three_stars" INTEGER NOT NULL,
    "new_clear" BOOLEAN NOT NULL,
    "new_three_stars" BOOLEAN NOT NULL,
    "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "achievement_notifications_pkey" PRIMARY KEY ("attempt_id"),
    CONSTRAINT "achievement_notifications_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "game_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "achievement_notifications_next_attempt_at_idx" ON "achievement_notifications"("next_attempt_at");
