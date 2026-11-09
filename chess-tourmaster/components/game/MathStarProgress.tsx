import { getMathStarTargets } from '@/lib/game/rules';

type Props = { score: number; requiredScore: number };

export default function MathStarProgress({ score, requiredScore }: Props) {
  const targets = getMathStarTargets(requiredScore);
  const earned = targets.filter(target => score >= target).length;
  const nextTarget = targets[earned];
  const pointsNeeded = (points: number) => `${points} more ${points === 1 ? 'point' : 'points'}`;

  return (
    <div className="max-w-full text-center">
      <div className="flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-slate-700 bg-slate-900/50 px-4 py-2">
        <div className="whitespace-nowrap text-sm font-bold text-amber-300 md:text-lg">
          Score: <span className="text-xl tabular-nums text-white md:text-2xl">{score}</span>
        </div>
        <ol aria-label="Star score targets" className="flex items-center gap-3 border-l border-slate-600 pl-3 sm:gap-4">
          {targets.map((target, index) => (
            <li key={index}
              aria-label={`${index + 1} ${index === 0 ? 'star' : 'stars'}: ${target} points${score >= target ? ', reached' : ''}`}
              aria-current={earned === index + 1 ? 'step' : undefined}
              className={`flex min-w-9 flex-col items-center gap-0.5 ${score >= target ? 'text-amber-300' : 'text-slate-400'}`}>
              <span aria-hidden="true" className="flex gap-0.5 text-[10px] sm:text-xs">
                {Array.from({ length: index + 1 }, (_, star) => (
                  <i key={star} className={`${score >= target ? 'fas' : 'far'} fa-star`} />
                ))}
              </span>
              <span aria-hidden="true" className="text-sm font-semibold tabular-nums">{target}</span>
            </li>
          ))}
        </ol>
      </div>
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {earned === 0 ? `${pointsNeeded(requiredScore - score)} to unlock King capture.`
          : `Finish at this score: ${earned} ${earned === 1 ? 'star' : 'stars'}.`}
        {earned > 0 && earned < 3 && <span>
          {pointsNeeded(nextTarget - score)} for {earned + 1} stars. Continue collecting or capture the King to finish.
        </span>}
        {earned === 3 && <span>Three-star score reached. Capture the King to finish.</span>}
      </div>
    </div>
  );
}
