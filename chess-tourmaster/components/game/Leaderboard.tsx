import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import type { GameMode } from '@/lib/game/types';
import { gameFetch } from '@/lib/portal-session';
import { HomeButton, ModeTabs } from './GameNavigation';
import homeStyles from './ModesHome.module.css';
import styles from './Leaderboard.module.css';

type Entry = { portal_user_id: number; rank: number; username: string; total_levels: number };
type Props = { accountId: number; initialMode: GameMode; onHome: () => void };
type Result = { entries: Entry[]; currentUser?: Entry; hasMore: boolean };
const LIMIT = 10;

function LevelBadge({ level }: { level: number | null }) {
  return <span className={styles.levelBadge}>
    <span className={styles.hexagon} aria-hidden="true">
      <Image src="/leaderboard/level.svg" alt="" width={47} height={57} unoptimized />
      <span>{level ?? '—'}</span>
    </span>
    <span className="sr-only">{level ?? 0} levels </span>Cleared
  </span>;
}

export default function Leaderboard({ accountId, initialMode, onHome }: Props) {
  const heading = useRef<HTMLHeadingElement>(null);
  const listEnd = useRef<HTMLLIElement>(null);
  const [mode, setMode] = useState(initialMode);
  const [result, setResult] = useState<Result | null>(null);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const currentUser = result?.currentUser;
  const hasMore = result?.hasMore ?? false;

  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, []);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await gameFetch(`/api/leaderboard?mode=${mode}&limit=${LIMIT}&offset=${offset}`, {
          cache: 'no-store', signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok || !data?.success || !Array.isArray(data.data)) throw new Error('leaderboard_failed');
        const entries: Entry[] = data.data.filter((entry: unknown): entry is Entry => {
          if (!entry || typeof entry !== 'object') return false;
          const candidate = entry as Partial<Entry>;
          return typeof candidate.username === 'string' && typeof candidate.portal_user_id === 'number'
            && Number.isSafeInteger(candidate.rank) && (candidate.rank ?? 0) > 0
            && Number.isSafeInteger(candidate.total_levels) && (candidate.total_levels ?? -1) >= 0;
        });
        if (controller.signal.aborted) return;
        const page = entries.filter(entry => entry.rank > offset && entry.rank <= offset + LIMIT);
        setResult(previous => {
          const earlier = offset === 0 ? [] : previous?.entries ?? [];
          const shown = new Set(earlier.map(entry => entry.portal_user_id));
          return {
            entries: [...earlier, ...page.filter(entry => !shown.has(entry.portal_user_id))],
            currentUser: entries.find(entry => entry.portal_user_id === accountId),
            hasMore: data.has_more === true,
          };
        });
      } catch {
        if (!controller.signal.aborted) setError(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [accountId, mode, offset, retry]);

  useEffect(() => {
    if (!hasMore || loading || error || !listEnd.current) return;
    let watching = true;
    const observer = new IntersectionObserver(([entry]) => {
      if (!watching || !entry.isIntersecting) return;
      watching = false;
      observer.disconnect();
      setLoading(true);
      setOffset(value => value + LIMIT);
    });
    observer.observe(listEnd.current);
    return () => {
      watching = false;
      observer.disconnect();
    };
  }, [error, hasMore, loading]);

  function retryLoad() {
    setLoading(true);
    setError(false);
    setRetry(value => value + 1);
  }

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
          setLoading(true);
          setError(false);
          setResult(null);
          setOffset(0);
          setMode(nextMode);
        }} />
      </div>
      <div className={styles.results} aria-busy={loading}>
        {!result && error ? <div className={styles.state}>
          <p role="alert">Could not load the leaderboard.</p>
          <button type="button" onClick={retryLoad}>Retry</button>
        </div>
          : !result ? <p className={styles.state} role="status">Loading leaderboard…</p>
          : result.entries.length === 0 ? <p className={styles.state} role="status">No records yet</p>
          : <ol className={styles.rows} aria-label="Leaderboard rankings" tabIndex={0}>
            {result.entries.map(entry => {
              const isCurrentUser = entry.portal_user_id === accountId;
              return <li key={entry.portal_user_id} value={entry.rank} className={styles.row} aria-current={isCurrentUser ? 'true' : undefined}>
                <span className={styles.medal} data-rank={entry.rank} aria-label={`Rank ${entry.rank}`}>{entry.rank}</span>
                <span className={styles.username} title={entry.username}>{entry.username}{isCurrentUser ? ' (You)' : ''}</span>
                <LevelBadge level={entry.total_levels} />
              </li>;
            })}
            {error ? <li className={styles.state}>
              <p role="alert">Could not load more rankings.</p>
              <button type="button" onClick={retryLoad}>Retry</button>
            </li> : hasMore ? <li ref={listEnd} aria-hidden="true" className={styles.listEnd} /> : null}
          </ol>}
      </div>
      <span className="sr-only" role="status">{result && loading ? 'Loading more rankings…' : ''}</span>
    </section>
  </main>;
}
