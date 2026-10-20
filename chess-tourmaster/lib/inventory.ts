import { prisma } from '@/lib/prisma';
import { ensureUserHint } from '@/lib/userHint';
import type { InventoryReceipt } from '@/lib/inventory-receipt';

let schemaReady: Promise<unknown> | null = null;
function ensureInventorySchema() {
  if (!schemaReady) {
    schemaReady = prisma.$executeRaw`CREATE TABLE IF NOT EXISTS inventory_deliveries (
      portal_user_id INTEGER NOT NULL,
      purchase_id UUID NOT NULL,
      hint_count INTEGER NOT NULL DEFAULT 0,
      undo_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (portal_user_id, purchase_id)
    )`.catch(error => { schemaReady = null; throw error; });
  }
  return schemaReady;
}

export async function applyInventoryReceipt(receipt: InventoryReceipt, username: string) {
  await ensureInventorySchema();
  await ensureUserHint(receipt.user_id, username);
  const hints = receipt.grants.chess_tourmaster_hint || 0;
  const undos = receipt.grants.chess_tourmaster_undo || 0;
  return prisma.$transaction(async tx => {
    const inserted = await tx.$queryRaw<{ purchase_id: string }[]>`
      INSERT INTO inventory_deliveries (portal_user_id, purchase_id, hint_count, undo_count)
      VALUES (${receipt.user_id}, ${receipt.purchase_id}::uuid, ${hints}, ${undos})
      ON CONFLICT (portal_user_id, purchase_id) DO NOTHING RETURNING purchase_id`;
    if (inserted.length) {
      await tx.userHint.update({ where: { portal_user_id: receipt.user_id },
        data: { hint_count: { increment: hints }, undo_count: { increment: undos } } });
    } else {
      const original = await tx.$queryRaw<{ hint_count: number; undo_count: number }[]>`
        SELECT hint_count, undo_count FROM inventory_deliveries
        WHERE portal_user_id = ${receipt.user_id} AND purchase_id = ${receipt.purchase_id}::uuid`;
      if (original[0]?.hint_count !== hints || original[0]?.undo_count !== undos) throw new Error('Inventory receipt mismatch');
    }
    return tx.userHint.findUniqueOrThrow({ where: { portal_user_id: receipt.user_id },
      select: { hint_count: true, undo_count: true } });
  });
}
