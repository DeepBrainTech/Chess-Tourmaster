export const MAX_MOVE_VOLUME = 10;

export type GameSettings = {
  sound: boolean;
  showNextMoves: boolean;
  showTimer: boolean;
  volume: number;
};

const defaultSettings: GameSettings = {
  sound: true,
  showNextMoves: true,
  showTimer: true,
  volume: 6,
};

const storageKey = 'chess-tourmaster:settings';

export function loadGameSettings(): GameSettings {
  if (typeof window === 'undefined') return defaultSettings;
  try {
    const saved: Partial<GameSettings> | null = JSON.parse(window.localStorage.getItem(storageKey) ?? 'null');
    if (!saved) return defaultSettings;
    return {
      sound: typeof saved.sound === 'boolean' ? saved.sound : defaultSettings.sound,
      showNextMoves: typeof saved.showNextMoves === 'boolean' ? saved.showNextMoves : defaultSettings.showNextMoves,
      showTimer: typeof saved.showTimer === 'boolean' ? saved.showTimer : defaultSettings.showTimer,
      volume: typeof saved.volume === 'number' && Number.isInteger(saved.volume)
        ? Math.max(0, Math.min(MAX_MOVE_VOLUME, saved.volume)) : defaultSettings.volume,
    };
  } catch {
    return defaultSettings;
  }
}

export function saveGameSettings(settings: GameSettings): void {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(settings));
  } catch {
    // Keep settings available during this session when storage is unavailable.
  }
}
