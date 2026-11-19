import { useEffect, useRef, useState, type ReactNode } from 'react';
import Image from 'next/image';
import { MAX_LEVELS } from '@/lib/game/rules';
import type { GameMode } from '@/lib/game/types';
import { HomeButton, ModeTabs } from './GameNavigation';
import styles from './LevelMap.module.css';

export type ModeProgress = { unlocked: number; stars: Record<number, number> };

type Props = {
  mode: GameMode;
  progress?: ModeProgress;
  busy?: boolean;
  account: ReactNode;
  onHome: () => void;
  onModeChange: (mode: GameMode) => void;
  onPlay: (level: number) => void;
};

const LEVELS_PER_PAGE = 20;
const icons = {
  lock: [37, 48], check: [43, 35], timer: [23, 29],
  previous: [19, 31], next: [19, 31],
  star: [30, 26], 'empty-star': [30, 26],
} as const;

function MapIcon({ name }: { name: keyof typeof icons }) {
  const [width, height] = icons[name];
  const directory = name === 'star' ? 'modes' : 'level-map';
  return <Image src={`/${directory}/${name}.svg`} alt="" width={width} height={height} unoptimized
    style={{ width: `calc(${width} * var(--u))`, height: `calc(${height} * var(--u))` }} />;
}

// Track segments positioned relative to the Figma map frame.
const trackRows = [
  { top: 10.3, parts: [['path-top', 7.84], ['path-top', 18.37], ['path-top', 30.63], ['path-top', 42.89], ['path-top', 55.15], ['path-top-end', 67.4], ['path-top-end', 79.66]] },
  { top: 43.4, parts: [['path-middle', 6.12], ['path-middle', 18.38], ['path-middle', 30.64], ['path-middle', 42.89], ['path-middle', 55.15], ['path-end', 67.41], ['path-end', 79.67]] },
  { top: 76.49, parts: [['path-bottom-start', 6.13], ['path-middle', 18.38], ['path-middle', 30.64], ['path-middle', 42.9], ['path-middle', 55.16], ['path-end', 67.41], ['path-end', 79.67]] },
] as const;

function Track() {
  return <div className={styles.track} aria-hidden="true">
    <span className={styles.rightTurn}><Image src="/level-map/path-right.svg" alt="" fill unoptimized /></span>
    <span className={styles.leftTurn}><Image src="/level-map/path-left.svg" alt="" fill unoptimized /></span>
    {trackRows.flatMap(({ top, parts }) => parts.map(([name, left]) =>
      <span key={`${top}-${left}`} className={styles.segment} style={{ top: `${top}%`, left: `${left}%` }}>
        <Image src={`/level-map/${name}.svg`} alt="" fill unoptimized />
      </span>
    ))}
  </div>;
}

export default function LevelMap({ mode, progress, busy, account, onHome, onModeChange, onPlay }: Props) {
  const unlocked = progress?.unlocked ?? 1;
  const heading = useRef<HTMLHeadingElement>(null);
  const [pages, setPages] = useState<Partial<Record<GameMode, number>>>({});
  const page = pages[mode] ?? Math.floor((unlocked - 1) / LEVELS_PER_PAGE);
  const setPage = (next: number) => setPages(previous => ({ ...previous, [mode]: next }));
  const firstLevel = page * LEVELS_PER_PAGE + 1;
  const lastLevel = Math.min(firstLevel + LEVELS_PER_PAGE - 1, MAX_LEVELS);

  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, []);

  return <>
    <header className={styles.header}>
      <HomeButton onHome={onHome} />
      <div className={styles.modeSwitch}>
        <ModeTabs mode={mode} onChange={onModeChange} />
      </div>
      {account}
    </header>

    <h1 ref={heading} tabIndex={-1} className={styles.title}>Level Map</h1>
    <section className={styles.board} aria-label="Levels">
      <Track />
      <ol className={styles.levels} start={firstLevel}>
        {Array.from({ length: lastLevel - firstLevel + 1 }, (_, index) => {
          const level = firstLevel + index;
          const stars = progress?.stars[level] ?? 0;
          const locked = level > unlocked;
          const complete = !locked && (stars > 0 || level < unlocked);
          const current = !locked && !complete;
          return <li key={level}>
            <button type="button" className={styles.level} disabled={locked || busy}
              aria-label={`Level ${level}${locked ? ', locked' : complete ? `, completed, ${stars} out of 3 stars` : ', play'}`}
              aria-current={current ? 'step' : undefined} onClick={() => onPlay(level)}>
              <span className={styles.discSlot}>
                <span className={`${styles.raised} ${styles.disc} ${locked ? styles.locked : complete ? styles.complete : styles.current}`} aria-hidden="true">
                  {locked ? <MapIcon name="lock" /> : complete ? <MapIcon name="check" /> : level}
                </span>
              </span>
              <span className={styles.levelDetail} aria-hidden="true">
                {locked ? level : complete ? <span className={styles.stars}>
                  {[1, 2, 3].map(star => <MapIcon key={star} name={star <= stars ? 'star' : 'empty-star'} />)}
                </span> : <span className={`${styles.raised} ${styles.play}`}><MapIcon name="timer" /> Play</span>}
              </span>
            </button>
          </li>;
        })}
      </ol>
    </section>

    <nav className={styles.pagination} aria-label="Level map pages">
      <button type="button" className={`${styles.raised} ${styles.pageArrow}`} disabled={page === 0} aria-label="Previous levels" onClick={() => setPage(page - 1)}>
        <MapIcon name="previous" />
      </button>
      <span aria-live="polite">Levels {firstLevel}–{lastLevel}</span>
      <button type="button" className={`${styles.raised} ${styles.pageArrow}`} disabled={lastLevel === MAX_LEVELS} aria-label="Next levels" onClick={() => setPage(page + 1)}>
        <MapIcon name="next" />
      </button>
    </nav>
  </>;
}
