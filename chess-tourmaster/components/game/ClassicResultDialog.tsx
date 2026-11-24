import { useEffect, useId, useRef } from 'react';
import type { HistoryEntry } from '@/lib/game/types';
import { GameIcon } from './GameArtwork';
import MathExpression from './MathExpression';
import { MathScore } from './MathStarProgress';
import styles from './ClassicResultDialog.module.css';

type WinDetails = { stars: number; time: string; final: boolean };
type MathWin = WinDetails & {
  type: 'math-win'; score: number; requiredScore: number; tilesLeft: number; history: HistoryEntry[];
};
type Result = (WinDetails & { type: 'win'; bestTime: string }) | MathWin
  | { type: 'lose'; burned: boolean };

type Props = {
  result: Result;
  busy: boolean;
  error?: string;
  onDismiss: () => void;
  onRestart: () => void;
  onNextLevel: () => void;
  onMap: () => void;
  onHome: () => void;
};

const icons = {
  close: [25, 27], 'trapped-knight': [195, 240], home: [46, 48], retry: [38, 45],
  map: [50, 47], next: [26, 42], time: [51, 64], trophy: [53, 59],
} as const;

function ResultIcon({ name }: { name: keyof typeof icons }) {
  const [width, height] = icons[name];
  return <GameIcon name={name} width={width} height={height} directory="classic-results" />;
}

function MathWinSummary({ result }: { result: MathWin }) {
  return <>
    <div className={`${styles.stars} ${styles.mathStars}`} role="img" aria-label={`${result.stars} out of 3 stars`}>
      {[1, 2, 3].map(position => {
        const center = position === 2;
        const earned = position <= result.stars;
        const size = center ? 69.658 : 60.896;
        return <span key={position} aria-hidden="true" data-earned={earned ? 'true' : undefined}>
          <GameIcon directory="math-results" name={`${earned ? '' : 'empty-'}star-${center ? 'center' : 'side'}`}
            width={earned ? size + 20 : size} height={earned ? (center ? 72.43 : 63.67) : size} />
        </span>;
      })}
    </div>
    <div className={styles.mathScore}>
      <MathScore score={result.score} requiredScore={result.requiredScore}>
        <span className={styles.scoreStar} aria-hidden="true">
          <GameIcon directory="math-results" name="score-star" width={60.896} height={60.896} />
        </span>
      </MathScore>
    </div>
    <MathExpression history={result.history} score={result.score} result />
    <dl className={styles.stats}>
      <div>
        <span><GameIcon directory="math-results" name="tiles" width={53.3333} height={55.9785} /></span>
        <div><dt>Tiles<span className="sr-only"> left</span></dt><dd>{result.tilesLeft}</dd></div>
      </div>
      <div>
        <span><ResultIcon name="time" /></span>
        <div><dt>Time</dt><dd>{result.time}</dd></div>
      </div>
    </dl>
  </>;
}

export default function ClassicResultDialog({
  result, busy, error, onDismiss, onRestart, onNextLevel, onMap, onHome,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const primary = useRef<HTMLButtonElement>(null);
  const title = useId();
  const description = useId();
  const math = result.type === 'math-win';
  const won = result.type !== 'lose';

  useEffect(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
  }, []);

  useEffect(() => {
    if (!busy) primary.current?.focus({ preventScroll: true });
  }, [busy]);

  return <dialog ref={dialog} className={`${styles.dialog}${math ? ` ${styles.mathDialog}` : ''}`}
    data-classic-result={math ? undefined : result.type} data-math-result={math ? 'win' : undefined}
    aria-labelledby={title} aria-describedby={math ? undefined : description}
    onClose={onDismiss} onCancel={event => { if (busy) event.preventDefault(); }}>
    <div className={styles.panel}>
      <h2 className={styles.title} id={title}>{math ? 'Target Reached!' : won ? 'Level Clear!' : 'Trapped!'}</h2>
      <button className={`${styles.button} ${styles.close}`} type="button" aria-label="Close result"
        disabled={busy} onClick={() => dialog.current?.close()}>
        <ResultIcon name="close" />
      </button>
      {math ? <MathWinSummary result={result} /> : result.type === 'win' ? <>
        <div className={styles.stars} role="img" aria-label={`${result.stars} out of 3 stars`}>
          {[1, 2, 3].map(position => {
            const earned = position <= result.stars;
            const size = position === 2 ? 70 : 61;
            return <span key={position} aria-hidden="true" data-earned={earned ? 'true' : undefined}>
              <GameIcon directory={earned ? 'modes' : 'classic-results'} name={earned ? 'star' : 'empty-star'} width={size} height={size} />
            </span>;
          })}
        </div>
        <p className={styles.winMessage} id={description}>
          {result.final ? 'You cleared all 100 levels!' : 'You toured every tile and caught the King!'}
        </p>
        <dl className={styles.stats}>
          <div><ResultIcon name="time" /><div><dt>Time</dt><dd>{result.time}</dd></div></div>
          <div><ResultIcon name="trophy" /><div><dt>Best</dt><dd>{result.bestTime}</dd></div></div>
        </dl>
      </> : <>
        <div className={styles.knight}><ResultIcon name="trapped-knight" /></div>
        <p className={styles.loseMessage} id={description}>
          {result.burned ? 'Time ran out on a fire tile. Try again!' : 'No moves left. Try a new path!'}
        </p>
      </>}
      <div className={styles.actions}>
        {won ? <>
          <button type="button" aria-label="Restart level" className={`${styles.button} ${styles.square}`} disabled={busy} onClick={onRestart}>
            <GameIcon directory="classic-tour" name="restart" width={41} height={49} />
          </button>
          <button type="button" aria-label="Level Map" className={`${styles.button} ${styles.square}`} disabled={busy} onClick={onMap}>
            <ResultIcon name="map" />
          </button>
          <button ref={primary} type="button" className={`${styles.button} ${styles.primary}`} disabled={busy} onClick={onNextLevel}>
            <ResultIcon name={result.final ? 'home' : 'next'} /> {result.final ? 'Home' : 'Next Level'}
          </button>
        </> : <>
          <button type="button" aria-label="Home" className={`${styles.button} ${styles.square}`} disabled={busy} onClick={onHome}>
            <ResultIcon name="home" />
          </button>
          <button ref={primary} type="button" className={`${styles.button} ${styles.primary}`} disabled={busy} onClick={onRestart}>
            <ResultIcon name="retry" /> Try Again
          </button>
        </>}
      </div>
      {busy && <p role="status" className={styles.status}>Connecting…</p>}
      {error && <p role="alert" className={styles.status}>{error}</p>}
    </div>
  </dialog>;
}
