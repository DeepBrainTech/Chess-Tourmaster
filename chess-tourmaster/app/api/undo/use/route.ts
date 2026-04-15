import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { jsonResponse, optionsResponse } from '@/lib/http';
import { consumeUndoCount } from '@/lib/userHint';

export const POST = requireAuth(async (request: NextRequest, payload) => {
  const origin = request.headers.get('Origin');
  try {
    const result = await consumeUndoCount(payload.user_id, payload.username);
    if (!result.success) {
      return jsonResponse(
        {
          success: false,
          code: 'NO_UNDO_LEFT',
          message: 'No undos left',
          data: { undo_count: result.undo_count },
        },
        { status: 400 },
        origin
      );
    }

    return jsonResponse(
      {
        success: true,
        message: 'Undo consumed',
        data: { undo_count: result.undo_count },
      },
      undefined,
      origin
    );
  } catch (error) {
    console.error('Use undo error:', error);
    return jsonResponse(
      { success: false, message: 'Failed to use undo', code: 'SERVER_ERROR' },
      { status: 500 },
      origin
    );
  }
});

export function OPTIONS(request: NextRequest) {
  return optionsResponse(request.headers.get('Origin'));
}
