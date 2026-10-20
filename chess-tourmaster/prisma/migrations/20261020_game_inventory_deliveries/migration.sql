CREATE TABLE IF NOT EXISTS "inventory_deliveries" (
  "portal_user_id" INTEGER NOT NULL,
  "purchase_id" UUID NOT NULL,
  "hint_count" INTEGER NOT NULL DEFAULT 0,
  "undo_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("portal_user_id", "purchase_id")
);
