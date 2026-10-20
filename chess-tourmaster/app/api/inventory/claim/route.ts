import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { jsonResponse, optionsResponse } from '@/lib/http';
import { verifyInventoryReceipt } from '@/lib/inventory-receipt';
import { applyInventoryReceipt } from '@/lib/inventory';

export const POST = requireAuth(async (request: NextRequest, payload) => {
  const origin = request.headers.get('Origin');
  const body = await request.json().catch(() => null);
  const receipt = verifyInventoryReceipt(body?.grant_token, payload.user_id);
  if (!receipt) return jsonResponse({ success: false, code: 'INVALID_RECEIPT', message: 'Invalid inventory receipt' }, { status: 403 }, origin);
  try {
    const data = await applyInventoryReceipt(receipt, payload.username);
    return jsonResponse({ success: true, data }, undefined, origin);
  } catch (error) {
    console.error('Inventory delivery failed:', error);
    return jsonResponse({ success: false, code: 'SERVER_ERROR', message: 'Inventory delivery pending. Retry is safe.' }, { status: 500 }, origin);
  }
});

export function OPTIONS(request: NextRequest) { return optionsResponse(request.headers.get('Origin')); }
