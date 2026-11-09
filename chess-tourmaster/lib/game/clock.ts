import { FIRE_LIMIT_MS } from './rules';

export class GameClock {
  activeMs = 0;
  fireMs = 0;
  private last: number | null = null;
  private running = false;
  private position = '';
  private fire = false;

  update(now: number, running: boolean, position: string, fire: boolean) {
    if (this.last !== null && this.running) {
      const delta = Math.max(0, now - this.last);
      this.activeMs += delta;
      if (this.fire) this.fireMs += delta;
    }
    if (position !== this.position || !fire) this.fireMs = 0;
    this.last = now;
    this.running = running;
    this.position = position;
    this.fire = fire;
    return { seconds: Math.floor(this.activeMs / 1000), fireRemainingMs: Math.max(0, FIRE_LIMIT_MS - this.fireMs) };
  }
}
