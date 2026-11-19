import Image from 'next/image';
import type { GameMode } from '@/lib/game/types';
import styles from './GameNavigation.module.css';

const modes = [
  { id: 'classic', label: 'Classic Tour', icon: 'classic', width: 31, height: 47 },
  { id: 'math_tour', label: 'Math Tour', icon: 'math', width: 42, height: 44 },
] as const;

function NavigationIcon({ icon, width, height }: { icon: string; width: number; height: number }) {
  return <Image src={`/level-map/${icon}.svg`} alt="" width={width} height={height} unoptimized
    style={{ width: `calc(${width} * var(--u))`, height: `calc(${height} * var(--u))` }} />;
}

export function HomeButton({ onHome }: { onHome: () => void }) {
  return <button type="button" className={styles.home} onClick={onHome}>
    <NavigationIcon icon="home" width={26} height={42} /> Home
  </button>;
}

export function ModeTabs({ mode, onChange }: { mode: GameMode; onChange: (mode: GameMode) => void }) {
  return <div className={styles.tabs} role="group" aria-label="Game mode">
    {modes.map(({ id, label, icon, width, height }) => <button key={id} type="button"
      aria-pressed={mode === id} onClick={() => onChange(id)}>
      <NavigationIcon icon={icon} width={width} height={height} />
      <span>{label}</span>
    </button>)}
  </div>;
}
