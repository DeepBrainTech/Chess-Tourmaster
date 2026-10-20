import jwt from 'jsonwebtoken';

export const INVENTORY_ITEMS = ['chess_tourmaster_hint', 'chess_tourmaster_undo'] as const;
export type InventoryReceipt = {
  user_id: number;
  purchase_id: string;
  grants: Partial<Record<(typeof INVENTORY_ITEMS)[number], number>>;
};

export function verifyInventoryReceipt(token: unknown, userId: number): InventoryReceipt | null {
  try {
    const secret = process.env.TOURMASTER_JWT_SECRET;
    if (typeof token !== 'string' || !secret || secret.startsWith('change-this-')) return null;
    const claims = jwt.verify(token, secret, {
      algorithms: [(process.env.TOURMASTER_JWT_ALG || 'HS256') as jwt.Algorithm],
      audience: process.env.TOURMASTER_JWT_AUD || 'chess-tourmaster',
      issuer: process.env.TOURMASTER_JWT_ISS || 'main-portal',
    });
    if (typeof claims === 'string' || claims.purpose !== 'chess-tourmaster-inventory'
      || claims.game_key !== 'chess-tourmaster' || claims.user_id !== userId
      || !Number.isSafeInteger(claims.user_id) || claims.user_id <= 0 || !Number.isSafeInteger(claims.exp)
      || !/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(claims.purchase_id || '')
      || !claims.grants || typeof claims.grants !== 'object' || Array.isArray(claims.grants)
      || !Object.keys(claims.grants).length
      || Object.entries(claims.grants).some(([item, count]) => !INVENTORY_ITEMS.includes(item as typeof INVENTORY_ITEMS[number])
        || !Number.isSafeInteger(count) || (count as number) <= 0 || (count as number) > 1000000000)) return null;
    return claims as InventoryReceipt;
  } catch { return null; }
}
