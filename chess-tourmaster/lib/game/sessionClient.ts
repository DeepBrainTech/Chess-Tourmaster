import { gameFetch } from '../portal-session';
import type { GameMode, Position } from './types';
import { LEVEL_VERSION } from './rules';

export class GameServiceError extends Error {
  constructor(public code: string) { super(code); }
}

async function request(path: string, body: unknown) {
  const response = await gameFetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success) throw new GameServiceError(result?.code ?? 'SERVER_ERROR');
  return result.data;
}

export class GameSessionClient {
  id: string | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  async start(level: number, mode: GameMode) {
    await this.queue.catch(() => undefined);
    const data = await request('/api/game/attempt', { action: 'start', level, game_mode: mode });
    if (data.level_version !== LEVEL_VERSION) throw new GameServiceError('VERSION_MISMATCH');
    this.id = data.attempt_id;
  }

  transition(action: 'pause' | 'resume') {
    const id = this.id;
    if (!id) return Promise.resolve();
    const next = this.queue.catch(() => undefined).then(() => request('/api/game/attempt', { action, attempt_id: id }));
    this.queue = next;
    return next;
  }

  async hint(moves: Position[]) {
    await this.queue;
    return request('/api/hint/use', { attempt_id: this.id, moves });
  }

  async finish(moves: Position[]) {
    await this.queue;
    return request('/api/progress/save', { attempt_id: this.id, moves });
  }
}
