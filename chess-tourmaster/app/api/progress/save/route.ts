import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { optionsResponse } from '@/lib/http';
import { finishAttempt, GameRequestError } from '@/lib/game/attempts';
import { gameResponse } from '@/lib/game/api';

export const POST = requireAuth(async (request: NextRequest, user) => gameResponse(request.headers.get('Origin'), async () => {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') throw new GameRequestError('INVALID_BODY');
  return finishAttempt(user, body.attempt_id, body.moves);
}));

export function OPTIONS(request: NextRequest) { return optionsResponse(request.headers.get('Origin')); }
