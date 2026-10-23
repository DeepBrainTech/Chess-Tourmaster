'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { PortalInventoryClient } from '@/lib/portal-inventory';
import type { InventoryDelivery } from '@/lib/portal-client';
import { gameFetch } from '@/lib/portal-session';

export type InventoryCounts = { hint_count: number; undo_count: number };

export function useGameInventory(base: string, userId: number, onCounts: (counts: InventoryCounts) => void) {
  const currentAccount = useRef(userId);
  const countsCallback = useRef(onCounts);
  currentAccount.current = userId;
  countsCallback.current = onCounts;
  const client = useMemo(() => new PortalInventoryClient(base, 'chess-tourmaster', () => userId), [base, userId]);
  const busy = useRef(new Set<string>());
  const recovering = useRef<Promise<void> | null>(null);
  const applyCounts = useCallback((counts: InventoryCounts) => {
    if (currentAccount.current === userId) countsCallback.current(counts);
  }, [userId]);
  const refresh = useCallback(async () => {
    if (!userId) return;
    const res = await gameFetch('/api/inventory', { cache: 'no-store' });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error('Could not load game inventory');
    applyCounts(data.data);
  }, [userId, applyCounts]);
  const claim = useCallback(async (delivery: InventoryDelivery) => {
    const res = await gameFetch('/api/inventory/claim', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grant_token: delivery.grant_token }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error('Inventory delivery pending. Please retry.');
    applyCounts(data.data);
  }, [applyCounts]);
  const recover = useCallback(() => {
    if (!userId) return Promise.resolve();
    if (recovering.current) return recovering.current;
    const pending = (async () => {
      await client.assertAccount();
      await client.migrateInventory();
      for (let batch = 0; batch < 20; batch++) {
        const { deliveries } = await client.pendingDeliveries();
        if (!deliveries.length) return;
        for (const delivery of deliveries) {
          if (currentAccount.current !== userId) return;
          await claim(delivery);
          client.finishItem(delivery.item_id, delivery.purchase_id);
          await client.acknowledgeDelivery(delivery.purchase_id);
        }
      }
    })();
    const tracked: Promise<void> = pending.finally(() => {
      if (recovering.current === tracked) recovering.current = null;
    });
    recovering.current = tracked;
    return recovering.current;
  }, [client, claim, userId]);
  useEffect(() => {
    recovering.current = null;
    applyCounts({ hint_count: 0, undo_count: 0 });
    if (!userId) return;
    void refresh().catch(() => undefined);
    const sync = () => { void recover().catch(() => undefined).then(refresh).catch(() => undefined); };
    sync();
    window.addEventListener('focus', sync);
    return () => window.removeEventListener('focus', sync);
  }, [userId, refresh, recover, applyCounts]);
  const buy = useCallback(async (itemId: string) => {
    const delivery = await client.buyItem(itemId);
    await claim(delivery);
    client.finishItem(itemId, delivery.purchase_id);
    await client.acknowledgeDelivery(delivery.purchase_id).catch(() => undefined);
    return delivery;
  }, [client, claim]);
  const use = useCallback(async (itemId: string, consumeLocal: () => Promise<boolean>) => {
    if (busy.current.has(itemId)) return false;
    busy.current.add(itemId);
    try { return await consumeLocal(); }
    finally { busy.current.delete(itemId); }
  }, []);
  return { client, refresh, buy, use };
}
