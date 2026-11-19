import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import type { GameMode } from '@/lib/game/types';
import { gameFetch } from '@/lib/portal-session';
import { HomeButton, ModeTabs } from './GameNavigation';
import homeStyles from './ModesHome.module.css';
import styles from './Leaderboard.module.css';

type Entry = { portal_user_id: number; rank: number; username: string; total_levels: number };
type Props = { accountId: number; initialMode: GameMode; onHome: () => void };
type Result = { entries: Entry[]; error?: boolean };
const LIMIT = 10;

function LevelBadge({ level }: { level: number | null }) {
  return <span className={styles.levelBadge}>
    <span className={styles.hexagon} aria-hidden="true">
      <Image src="/leaderboard/level.svg" alt="" width={47} height={57} unoptimized />
      <span>{level ?? '—'}</span>
    </span>
    Level {level ?? '—'}
  </span>;
}

export default function Leaderboard({ accountId, initialMode, onHome }: Props) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [mode, setMode] = useState(initialMode);
  const [result, setResult] = useState<Result | null>(null);
  const [retry, setRetry] = useState(0);
  const currentUser = result?.entries.find(entry => entry.portal_user_id === accountId);
  const leaders = result?.entries.filter(entry => entry.rank <= LIMIT) ?? [];

  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, []);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await gameFetch(`/api/leaderboard?sort=levels&mode=${mode}&limit=${LIMIT}`, {
          cache: 'no-store', signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok || !data?.success || !Array.isArray(data.data)) throw new Error('leaderboard_failed');
        const entries = data.data.filter((entry: unknown): entry is Entry => {
          if (!entry || typeof entry !== 'object') return false;
          const candidate = entry as Partial<Entry>;
          return typeof candidate.username === 'string' && typeof candidate.portal_user_id === 'number'
            && Number.isSafeInteger(candidate.rank) && (candidate.rank ?? 0) > 0
            && Number.isSafeInteger(candidate.total_levels) && (candidate.total_levels ?? -1) >= 0;
        });
        if (!controller.signal.aborted) setResult({ entries });
      } catch {
        if (!controller.signal.aborted) setResult({ entries: [], error: true });
      }
    }
    void load();
    return () => controller.abort();
  }, [mode, retry]);

  return <main className={`${homeStyles.home} ${styles.screen}`}>
    <header className={styles.header}><HomeButton onHome={onHome} /></header>
    <section className={styles.panel} aria-labelledby="leaderboard-title">
      <h1 className={styles.title} id="leaderboard-title" ref={heading} tabIndex={-1}>Leaderboard</h1>
      <div className={styles.controls}>
        <div className={styles.yourRank}>
          <span>Your Rank {currentUser ? `#${currentUser.rank}` : '—'}</span>
          <LevelBadge level={currentUser?.total_levels ?? null} />
        </div>
        <ModeTabs mode={mode} onChange={nextMode => {
          if (nextMode === mode) return;
          setResult(null);
          setMode(nextMode);
        }} />
      </div>
      <div className={styles.results} aria-busy={!result}>
        {!result ? <p className={styles.state} role="status">Loading leaderboard…</p>
          : result.error ? <div className={styles.state}>
            <p role="alert">Could not load the leaderboard.</p>
            <button type="button" onClick={() => { setResult(null); setRetry(value => value + 1); }}>Retry</button>
          </div>
          : leaders.length === 0 ? <p className={styles.state} role="status">No records yet</p>
          : <ol className={styles.rows} aria-label="Leaderboard rankings" tabIndex={0}>
            {leaders.map(entry => {
              const isCurrentUser = entry.portal_user_id === accountId;
              return <li key={entry.portal_user_id} className={styles.row} aria-current={isCurrentUser ? 'true' : undefined}>
                <span className={styles.medal} data-rank={entry.rank} aria-label={`Rank ${entry.rank}`}>{entry.rank}</span>
                <span className={styles.username} title={entry.username}>{entry.username}{isCurrentUser ? ' (You)' : ''}</span>
                <LevelBadge level={entry.total_levels} />
              </li>;
            })}
          </ol>}
      </div>
    </section>
  </main>;
}
