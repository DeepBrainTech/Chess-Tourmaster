import { getMathStarTargets } from '@/lib/game/rules';
import type { ReactNode } from 'react';
import { GameIcon } from './GameArtwork';
import styles from './MathTour.module.css';

type Props = { score: number; requiredScore: number };

const milestonePositions = [291 / 440, 353 / 440, 415 / 440];

export function MathScore({ score, requiredScore, children }: Props & { children?: ReactNode }) {
  const target = Math.max(1, requiredScore);
  const progress = Math.max(0, Math.min(score, target));

  return <div className={styles.score} role="meter" aria-label="Score" aria-valuemax={target} aria-valuenow={progress}
    aria-valuetext={`Score: ${score} of ${requiredScore} points`}>
    <div className={styles.scoreTrack} aria-hidden="true">
      <div className={styles.scoreFill} style={{ inlineSize: `${progress / target * 100}%` }} />
    </div>
    <span className={styles.scoreLabel} aria-hidden="true">Score <b>{score}/{requiredScore}</b></span>
    {children}
  </div>;
}

function pointsNeeded(points: number) {
  return `${points} more ${points === 1 ? 'point' : 'points'}`;
}

function getFillPercent(score: number, targets: number[], earned: number) {
  if (score < 0) return 0;
  if (earned === targets.length) return 100;

  // Interpolate between the score thresholds at the positions of the Figma milestones.
  const previousTarget = targets[earned - 1] ?? 0;
  const previousPosition = milestonePositions[earned - 1] ?? 0;
  const progress = (score - previousTarget) / (targets[earned] - previousTarget);
  return (previousPosition + progress * (milestonePositions[earned] - previousPosition)) * 100;
}

export default function MathStarProgress({ score, requiredScore }: Props) {
  const targets = getMathStarTargets(requiredScore);
  const [oneStarTarget] = targets;
  const earned = targets.filter(target => score >= target).length;
  const nextTarget = targets[earned];
  const max = Math.max(1, targets[2]);
  const fill = getFillPercent(score, targets, earned);

  return <div className={styles.scoreRow}>
    <div className={styles.scoreReadout} aria-hidden="true">
      <span>Score</span><strong>{score}</strong>
    </div>
    <meter className="sr-only" min={0} max={max} value={Math.max(0, Math.min(score, max))}
      aria-label="Score" aria-valuetext={`${score} points. ${oneStarTarget} points required to capture the King.`} />
    <details className={styles.starGroup}>
      <summary className={styles.stars} aria-label={`Star score targets, ${earned} of 3 reached`}>
        {targets.map((points, index) => <span key={index} className={styles.milestone} aria-hidden="true">
          <span className={styles.milestoneArt}>
            <GameIcon name="score-star-outline" directory="math-tour" width={43.8101} height={315.828} />
            <GameIcon name={score >= points ? 'score-star-earned' : 'score-star-empty'}
              directory="math-tour" width={38.0957} height={260.901} />
          </span>
        </span>)}
      </summary>
      <ol className={styles.starTargets}>
        {targets.map((points, index) => <li key={index}
          aria-label={`${index + 1} ${index === 0 ? 'star' : 'stars'}: ${points} points${score >= points ? ', reached' : ''}`}
          aria-current={earned === index + 1 ? 'step' : undefined}>
          {index + 1} ★ · {points} points
        </li>)}
      </ol>
    </details>
    <div className={styles.milestoneTrack} aria-hidden="true">
      <div className={styles.milestoneFill} style={{ inlineSize: `${fill}%` }} />
    </div>
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {earned === 0 ? `${pointsNeeded(oneStarTarget - score)} to unlock King capture.`
        : `Finish at this score: ${earned} ${earned === 1 ? 'star' : 'stars'}.`}
      {earned > 0 && earned < 3 && <span>
        {pointsNeeded(nextTarget - score)} for {earned + 1} stars. Continue collecting or capture the King to finish.
      </span>}
      {earned === 3 && <span>Three-star score reached. Capture the King to finish.</span>}
    </div>
  </div>;
}
