'use client';

import { useLayoutEffect, useRef } from 'react';
import { GameClock } from '@/lib/game/clock';

export function useGameClock(startedAt: number, running: boolean, position: string, fire: boolean,
  onTick: (seconds: number, fireRemainingMs: number) => void) {
  const clock = useRef(new GameClock());
  const callback = useRef(onTick);
  useLayoutEffect(() => { callback.current = onTick; }, [onTick]);
  useLayoutEffect(() => { clock.current = new GameClock(); }, [startedAt]);
  useLayoutEffect(() => {
    const update = () => {
      const sample = clock.current.update(performance.now(), running, position, fire);
      callback.current(sample.seconds, sample.fireRemainingMs);
    };
    update();
    if (!running) return;
    const interval = setInterval(update, 100);
    return () => clearInterval(interval);
  }, [startedAt, running, position, fire]);
}
