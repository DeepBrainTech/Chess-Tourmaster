/** Copy this module into a game's browser client. No framework dependencies. */
export type Assets = { coins: number; diamonds: number; flowers: number };
export type Cost = Partial<Assets>;
export type PurchaseRequest = { request_id: string; target: string };
export type ItemRequest = { request_id: string; item_id: string };
export type GameSession = {
  game_token: string;
  expires_in: number;
  user: { id: number; username: string };
};
export type Grant = {
  grant_token: string;
  purchase_id: string;
  expires_at: number;
  game_key: string;
  product_id: string;
  user_id: number;
  assets: Assets;
  cost: Cost;
};
export type Quote = {
  game_key: string;
  product_id: string;
  duration_seconds: number;
  user_id: number;
  assets: Assets;
  cost: Cost;
};
export type InventoryDelivery = {
  item_id: string;
  purchase_id: string;
  grants: Record<string, number>;
  grant_token: string;
};
export type RedeemedItem = InventoryDelivery & { cost: Assets; assets: Assets };

export class PortalApiError extends Error {
  constructor(public readonly status: number, public readonly code: string) {
    super(code);
    this.name = "PortalApiError";
  }
}

export class PortalGameClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string, private readonly apiSlug: string, private readonly gameKey = apiSlug) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(this.baseUrl + path, {
      ...init,
      credentials: "include",
      cache: "no-store",
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.success) {
      const detail = payload?.detail;
      const code = typeof detail === "string" ? detail
        : Array.isArray(detail) ? "validation_error"
        : typeof payload?.message === "string" ? payload.message : "portal_request_failed";
      throw new PortalApiError(response.status, code);
    }
    return payload.data as T;
  }

  private purchasePath(productId: string): string {
    return "/api/games/" + encodeURIComponent(this.apiSlug)
      + "/purchases/" + encodeURIComponent(productId);
  }

  assets(): Promise<Assets> {
    return this.request("/api/user/assets");
  }

  catalog(): Promise<{ items: Record<string, { name: string; games: string[]; cost: Assets }>; game_mode: string }> {
    const query = new URLSearchParams({ game_mode: this.gameKey });
    return this.request("/api/games/shop/catalog?" + query);
  }

  startSession(timezone?: string): Promise<GameSession & { assets: Assets }> {
    return this.request("/api/games/" + encodeURIComponent(this.apiSlug) + "/token", {
      method: "POST",
      headers: timezone ? { "X-User-Timezone": timezone } : undefined,
    });
  }

  refreshSession(): Promise<GameSession> {
    return this.request("/api/games/" + encodeURIComponent(this.apiSlug) + "/session");
  }

  quote(productId: string): Promise<Quote> {
    return this.request(this.purchasePath(productId) + "/quote");
  }

  redeemGrant(productId: string, request: PurchaseRequest): Promise<Grant> {
    return this.request(this.purchasePath(productId) + "/redeem", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request),
    });
  }

  redeemItem(request: ItemRequest): Promise<RedeemedItem> {
    const query = new URLSearchParams({ ...request, game_mode: this.gameKey });
    return this.request("/api/user/shop/redeem?" + query, { method: "POST" });
  }

  migrateInventory(): Promise<{ migrated: boolean }> {
    return this.request('/api/user/shop/chess-tourmaster/migrate', { method: 'POST' });
  }

  pendingDeliveries(): Promise<{ deliveries: InventoryDelivery[] }> {
    return this.request('/api/user/shop/chess-tourmaster/deliveries');
  }

  acknowledgeDelivery(purchaseId: string): Promise<{ delivered: boolean }> {
    return this.request('/api/user/shop/chess-tourmaster/deliveries/' + encodeURIComponent(purchaseId) + '/ack', { method: 'POST' });
  }

  checkout(asset: "coins" | "diamonds", bundleId: string, locale: string): Promise<{ url: string }> {
    const kind = asset === "coins" ? "coin" : "diamond";
    return this.request("/api/billing/" + kind + "-checkout-session", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bundle_id: bundleId, locale }),
    });
  }
}

/** Generate once per user action, then keep this object when retrying a lost response. */
export function newPurchaseRequest(target: string): PurchaseRequest {
  return { request_id: crypto.randomUUID(), target };
}

export function newItemRequest(itemId: string): ItemRequest {
  return { request_id: crypto.randomUUID(), item_id: itemId };
}
