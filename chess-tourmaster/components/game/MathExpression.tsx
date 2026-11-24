import { useEffect, useId, useRef, useState } from 'react';
import type { HistoryEntry } from '@/lib/game/types';
import { GameIcon } from './GameArtwork';
import styles from './MathTour.module.css';

const operators = {
  add: { symbol: '+', width: 17.52, height: 17.5 },
  subtract: { symbol: '−', width: 17.79, height: 5.79 },
  multiply: { symbol: '×', width: 15.69, height: 15.67 },
} as const;

const previewLength = 7;

export default function MathExpression({ history, score, result = false }: {
  history: HistoryEntry[]; score: number; result?: boolean;
}) {
  const title = useId();
  const listId = useId();
  const operations = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const entries = history.filter(({ tileMultiplier = 1, scoreCollected }) => tileMultiplier !== 1 || scoreCollected !== 0);
  const hasMore = result && !expanded && entries.length > previewLength;
  const visibleEntries = hasMore ? entries.slice(0, previewLength) : entries;

  useEffect(() => {
    const list = operations.current;
    if (list && !result) list.scrollTop = list.scrollHeight;
  }, [history.length, result]);

  useEffect(() => {
    if (expanded) operations.current?.focus({ preventScroll: true });
  }, [expanded]);

  return <section className={`${styles.expression}${result ? ` ${styles.resultExpression}` : ''}`} aria-labelledby={title}>
    <h3 id={title}>{result ? 'Your Expression' : 'Expression'}</h3>
    <div className={styles.operations} ref={operations} role="group" aria-label="Score operations"
      tabIndex={!result && history.length > 0 ? 0 : expanded ? -1 : undefined}>
      <ol id={listId}>
        {visibleEntries.map(({ tileMultiplier = 1, scoreCollected }, index) => {
          const name = tileMultiplier > 1 ? 'multiply' : scoreCollected < 0 ? 'subtract' : 'add';
          const { symbol, width, height } = operators[name];
          return <li key={index} data-operation={name}>
            <span aria-hidden="true"><GameIcon name={name} width={width} height={height} directory="math-tour" /></span>
            <span className="sr-only">{symbol}</span>
            {name === 'multiply' ? tileMultiplier : Math.abs(scoreCollected)}
          </li>;
        })}
      </ol>
      {result && <div className={styles.resultTotal}>
        {hasMore && <button type="button" className={styles.moreOperations} aria-expanded="false" aria-controls={listId}
          aria-label="Show all score operations" onClick={() => setExpanded(true)}>…</button>}
        <ExpressionTotal score={score} />
      </div>}
    </div>
    {!result && <ExpressionTotal score={score} />}
  </section>;
}

function ExpressionTotal({ score }: { score: number }) {
  return <p className={styles.expressionTotal} aria-label={`Total: ${score}`}>
    <GameIcon name="equals" width={19.29} height={13.83} directory="math-tour" /> {score}
  </p>;
}
