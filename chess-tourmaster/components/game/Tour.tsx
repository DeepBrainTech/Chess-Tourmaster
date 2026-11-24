import { useEffect, type ReactNode } from 'react';
import { MAX_LEVELS } from '@/lib/game/rules';
import type { GameMode, HistoryEntry, Position } from '@/lib/game/types';
import { GameAccount, GameIcon, GameLogo } from './GameArtwork';
import { HomeButton } from './GameNavigation';
import MathExpression from './MathExpression';
import MathStarProgress from './MathStarProgress';
import homeStyles from './ModesHome.module.css';
import styles from './Tour.module.css';

type Props = {
  level: number;
  tilesLeft: number;
  time?: string;
  username: string;
  coins?: number;
  shopUrl: string;
  themed: boolean;
  busy: boolean;
  canUndo: boolean;
  canHint: boolean;
  undoCount: number;
  hintCount: number;
  hintTarget: Position | null;
  onHome: () => void;
  onMap: () => void;
  onSettings: () => void;
  onHelp: () => void;
  onRestart: () => void;
  onUndo: () => void;
  onHint: () => void;
  children: ReactNode;
} & ({ mode: 'classic' } | {
  mode: 'math_tour';
  score: number;
  requiredScore: number;
  history: HistoryEntry[];
});

const icons = {
  badge: [80, 97], 'tiles-left': [40, 42], 'mode-tiles': [26, 27], timer: [38, 48],
  map: [34, 33], restart: [41, 49], undo: [42, 44], hint: [34, 49],
} as const;

function ClassicIcon({ name }: { name: keyof typeof icons }) {
  const [width, height] = icons[name];
  return <GameIcon name={name} width={width} height={height} directory="classic-tour" />;
}

export default function Tour({
  level, tilesLeft, time, username, coins, shopUrl, themed, busy, canUndo, canHint, undoCount, hintCount, hintTarget,
  onHome, onMap, onSettings, onHelp, onRestart, onUndo, onHint, children, ...game
}: Props) {
  const math = game.mode === 'math_tour';
  const title = tourTitle[game.mode];
  useEffect(() => { window.scrollTo(0, 0); }, [game.mode]);

  const actions = [
    { icon: 'restart', label: 'Restart', action: onRestart, count: null, disabled: busy },
    { icon: 'undo', label: 'Undo', action: onUndo, count: undoCount, disabled: busy || !canUndo },
    { icon: 'hint', label: 'Hint', action: onHint, count: hintCount, disabled: busy || !canHint },
  ] as const;

  return <main className={`${homeStyles.home} ${styles.screen} ${math ? styles.math : ''} ${themed ? styles.themed : ''}`}>
    <header className={styles.header}>
      <HomeButton onHome={onHome} compact={math} />
      <GameLogo classic className={styles.logo} />
      <GameAccount username={username} coins={coins} shopUrl={shopUrl} onSettings={onSettings} onHelp={onHelp}
        coinDirectory={math ? 'modes' : undefined} />
    </header>

    <div className={styles.layout}>
      <section aria-label="Chessboard" className={styles.boardArea}>
        {children}
        <span role="status" className="sr-only">
          {hintTarget ? `Suggested move: row ${hintTarget.r + 1}, column ${hintTarget.c + 1}` : ''}
        </span>
        <p className={styles.goal}>Goal: {math ? 'Collect score' : 'Clear the board'}, then capture the <strong>King</strong></p>
      </section>

      <aside className={styles.panel} aria-labelledby="tour-title">
        <h2 className={styles.title} id="tour-title">
          {math ? <GameIcon name="timer" width={24} height={31} directory="level-map" /> : <ClassicIcon name="mode-tiles" />}
          {title}
        </h2>
        <div className={styles.panelBody}>
          <div className={styles.progressRow}>
            <span className={styles.badge} aria-hidden="true">
              {math ? <GameIcon name="badge" width={80} height={92} directory="math-tour" /> : <ClassicIcon name="badge" />}
              <span>{level}</span>
            </span>
            <div className={styles.progress}>
              <span>Level {level} <span>of {MAX_LEVELS}</span></span>
              <progress value={level} max={MAX_LEVELS} aria-label={`${title} level progress`} />
            </div>
            <button type="button" className={`${styles.button} ${styles.mapButton}`} onClick={onMap} aria-label="Level Map" disabled={busy}>
              <ClassicIcon name="map" />
            </button>
          </div>

          <dl className={styles.stats}>
            <div>
              {math ? <GameIcon name="tiles-left" width={40} height={42} directory="math-tour" /> : <ClassicIcon name="tiles-left" />}
              <dt>Tiles left</dt><dd>{tilesLeft}</dd>
            </div>
            <div>
              <ClassicIcon name="timer" />
              <dt>Time</dt>
              <dd>{time ?? <><span aria-hidden="true">-</span><span className="sr-only">Hidden</span></>}</dd>
            </div>
          </dl>

          {game.mode === 'math_tour' && <>
            <MathStarProgress score={game.score} requiredScore={game.requiredScore} />
            <MathExpression history={game.history} score={game.score} />
          </>}
        </div>

        <div className={styles.actions}>
          {actions.map(({ icon, label, action, count, disabled }) => <button type="button" key={icon}
            disabled={disabled} className={styles.action} onClick={action}
            aria-label={count === null ? label : `${label}, ${count} remaining`}>
            <span className={styles.button} data-action={icon}>
              <ClassicIcon name={icon} />
              {count !== null && <span className={styles.count} aria-hidden="true">{count}</span>}
            </span>
            {label}
          </button>)}
        </div>
      </aside>
    </div>
  </main>;
}

const tourTitle: Record<GameMode, string> = { classic: 'Classic Tour', math_tour: 'Math Tour' };
