import { useEffect, useRef } from 'react';
import { GameIcon } from './GameArtwork';
import styles from './ClassicResultDialog.module.css';

type Result = { type: 'win'; stars: number; time: string; bestTime: string; final: boolean }
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

export default function ClassicResultDialog({
  result, busy, error, onDismiss, onRestart, onNextLevel, onMap, onHome,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const primary = useRef<HTMLButtonElement>(null);
  const won = result.type === 'win';

  useEffect(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
  }, []);

  useEffect(() => {
    if (!busy) primary.current?.focus({ preventScroll: true });
  }, [busy]);

  return <dialog ref={dialog} className={styles.dialog} data-classic-result={result.type}
    aria-labelledby="classic-result-title" aria-describedby="classic-result-description"
    onClose={onDismiss} onCancel={event => { if (busy) event.preventDefault(); }}>
    <div className={styles.panel}>
      <h2 className={styles.title} id="classic-result-title">{won ? 'Level Clear!' : 'Trapped!'}</h2>
      <button className={`${styles.button} ${styles.close}`} type="button" aria-label="Close result"
        disabled={busy} onClick={() => dialog.current?.close()}>
        <ResultIcon name="close" />
      </button>
      {result.type === 'win' ? <>
        <div className={styles.stars} role="img" aria-label={`${result.stars} out of 3 stars`}>
          {[1, 2, 3].map(position => {
            const earned = position <= result.stars;
            const size = position === 2 ? 70 : 61;
            return <span key={position} aria-hidden="true" data-earned={earned ? 'true' : undefined}>
              <GameIcon directory={earned ? 'modes' : 'classic-results'} name={earned ? 'star' : 'empty-star'} width={size} height={size} />
            </span>;
          })}
        </div>
        <p className={styles.winMessage} id="classic-result-description">
          {result.final ? 'You cleared all 100 levels!' : 'You toured every tile and caught the King!'}
        </p>
        <dl className={styles.stats}>
          <div><ResultIcon name="time" /><div><dt>Time</dt><dd>{result.time}</dd></div></div>
          <div><ResultIcon name="trophy" /><div><dt>Best</dt><dd>{result.bestTime}</dd></div></div>
        </dl>
      </> : <>
        <div className={styles.knight}><ResultIcon name="trapped-knight" /></div>
        <p className={styles.loseMessage} id="classic-result-description">
          {result.burned ? 'Time ran out on a fire tile. Try again!' : 'No moves left. Try a new path!'}
        </p>
      </>}
      <div className={styles.actions}>
        {result.type === 'win' ? <>
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
