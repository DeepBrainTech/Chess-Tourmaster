import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { jsonResponse, optionsResponse } from '@/lib/http';
import { addHintCount } from '@/lib/userHint';

export const POST = requireAuth(async (request: NextRequest, payload) => {
  const origin = request.headers.get('Origin');
  try {
    const body = await request.json().catch(() => ({}));
    const amountRaw = body?.amount;
    const amount = typeof amountRaw === 'number' ? Math.floor(amountRaw) : 1;
    const safeAmount = Math.max(1, Math.min(100, amount));

    const updated = await addHintCount(payload.user_id, payload.username, safeAmount);
    return jsonResponse(
      {
        success: true,
        message: 'Hint granted',
        data: { hint_count: updated.hint_count },
      },
      undefined,
      origin
    );
  } catch (error) {
    console.error('Grant hint error:', error);
    return jsonResponse(
      { success: false, message: 'Failed to grant hint', code: 'SERVER_ERROR' },
      { status: 500 },
      origin
    );
  }
});

export function OPTIONS(request: NextRequest) {
  return optionsResponse(request.headers.get('Origin'));
}
