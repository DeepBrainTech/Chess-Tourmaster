import { jsonResponse } from '@/lib/http';
import { GameRequestError } from './attempts';

export async function gameResponse(origin: string | null, action: () => Promise<unknown>) {
  try { return jsonResponse({ success: true, data: await action() }, undefined, origin); }
  catch (error) {
    if (error instanceof GameRequestError) return jsonResponse({ success: false, code: error.message }, { status: error.status }, origin);
    console.error('Game request failed:', error);
    return jsonResponse({ success: false, code: 'SERVER_ERROR' }, { status: 500 }, origin);
  }
}
