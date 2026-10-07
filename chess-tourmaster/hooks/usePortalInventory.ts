'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PortalInventoryClient, gameAccountId } from '@/lib/portal-inventory';

export function usePortalInventory(base: string, token: string | null) {
  const userId = gameAccountId(token);
  const client = useMemo(() => new PortalInventoryClient(base, 'chess-tourmaster', () => userId), [base, userId]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const busy = useRef(new Set<string>());
  const refresh = useCallback(async () => {
    await client.assertAccount();
    const data = await client.inventory();
    setQuantities(Object.fromEntries(data.items.map(item => [item.item_id, item.quantity])));
  }, [client]);
  useEffect(() => {
    setQuantities({});
    if (userId) void refresh().catch(() => undefined);
  }, [refresh, userId]);
  const buy = useCallback(async (itemId: string) => {
    const result = await client.buyItem(itemId);
    setQuantities(previous => ({ ...previous, [itemId]: result.inventory_quantity }));
    await refresh().catch(() => undefined);
    return result;
  }, [client, refresh]);
  const use = useCallback(async (itemId: string, useEarned: () => Promise<boolean>) => {
    if (busy.current.has(itemId)) return false;
    busy.current.add(itemId);
    try {
      if ((quantities[itemId] || 0) > 0 || client.hasPendingUse(itemId)) {
        const result = await client.useItem(itemId);
        setQuantities(previous => ({ ...previous, [itemId]: result.inventory_quantity }));
        await refresh().catch(() => undefined);
        return true;
      }
      return await useEarned();
    } finally { busy.current.delete(itemId); }
  }, [client, quantities, refresh]);
  return { client, quantities, refresh, buy, use };
}
