import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { jsonResponse, optionsResponse } from '@/lib/http';
import { consumeHintCount } from '@/lib/userHint';

export const POST = requireAuth(async (request: NextRequest, payload) => {
  const origin = request.headers.get('Origin');
  try {
    const result = await consumeHintCount(payload.user_id, payload.username);
    if (!result.success) {
      return jsonResponse(
        {
          success: false,
          code: 'NO_HINT_LEFT',
          message: 'No hints left',
          data: { hint_count: result.hint_count },
        },
        { status: 400 },
        origin
      );
    }

    return jsonResponse(
      {
        success: true,
        message: 'Hint consumed',
        data: { hint_count: result.hint_count },
      },
      undefined,
      origin
    );
  } catch (error) {
    console.error('Use hint error:', error);
    return jsonResponse(
      { success: false, message: 'Failed to use hint', code: 'SERVER_ERROR' },
      { status: 500 },
      origin
    );
  }
});

export function OPTIONS(request: NextRequest) {
  return optionsResponse(request.headers.get('Origin'));
}
