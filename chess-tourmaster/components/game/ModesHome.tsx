import { useRef, useState, type Ref } from 'react';
import Image from 'next/image';
import type { GameMode } from '@/lib/game/types';
import { MAX_LEVELS } from '@/lib/game/rules';
import HowToPlayDialog from './HowToPlayDialog';
import LevelMap, { type ModeProgress } from './LevelMap';
import { GameAccount, GameIcon as Icon, GameLogo } from './GameArtwork';
import styles from './ModesHome.module.css';

type Props = {
  username?: string;
  coins?: number;
  shopUrl?: string;
  portalUrl: string;
  progress?: Partial<Record<GameMode, ModeProgress>>;
  initialMapMode?: GameMode;
  onCloseMap?: () => void;
  onPlay: (mode: GameMode, level?: number) => void;
  onLeaderboard: () => void;
  leaderboardButtonRef?: Ref<HTMLButtonElement>;
  onMapHelp?: (mode: GameMode) => void;
  onSettings: (mode?: GameMode) => void;
  onLogin?: () => void;
  busy?: boolean;
};

const modes = [
  { id: 'classic', art: 'classic', title: 'Classic Tour', description: 'Hop like a knight. Land on every tile, then catch the king.' },
  { id: 'math_tour', art: 'math', title: 'Math Tour', description: 'Every tile changes your score. Hit the target, then catch the King.' },
] as const;

export default function ModesHome({
  username, coins, shopUrl, portalUrl, progress, initialMapMode, onCloseMap,
  onPlay, onLeaderboard, leaderboardButtonRef, onMapHelp, onSettings, onLogin, busy,
}: Props) {
  const mapButton = useRef<HTMLButtonElement>(null);
  const [showMap, setShowMap] = useState(initialMapMode !== undefined);
  const [showHelp, setShowHelp] = useState(false);
  const [mapMode, setMapMode] = useState<GameMode>(initialMapMode ?? 'classic');
  const stars = Object.values(progress ?? {}).reduce(
    (total, mode) => total + Object.values(mode.stars).reduce((sum, count) => sum + count, 0), 0,
  );

  const account = <GameAccount username={username} coins={coins} shopUrl={shopUrl} onLogin={onLogin}
    onSettings={() => onSettings(showMap ? mapMode : undefined)}
    onHelp={showMap && onMapHelp ? () => onMapHelp(mapMode) : undefined}>
    {!showMap && <div className={styles.pill} aria-label={`${stars} stars out of ${MAX_LEVELS * 3 * modes.length}`}>
      <Icon name="star" width={35} height={30} />
      <span>{stars}<span className={styles.muted}>/{MAX_LEVELS * 3 * modes.length}</span></span>
    </div>}
  </GameAccount>;

  if (showMap) {
    return <main className={`${styles.home} ${styles.mapScreen}`}>
      <LevelMap mode={mapMode} progress={progress?.[mapMode]} busy={busy} account={account}
        onHome={() => {
          setShowMap(false);
          onCloseMap?.();
          window.scrollTo(0, 0);
          window.requestAnimationFrame(() => mapButton.current?.focus({ preventScroll: true }));
        }}
        onModeChange={setMapMode} onPlay={level => onPlay(mapMode, level)} />
    </main>;
  }

  return (
    <main className={styles.home}>
      <header className={styles.header}>
        <a className={styles.portalLink} href={portalUrl}>Back to Main Portal</a>
        {account}
      </header>

      <GameLogo />

      <section className={styles.cards} aria-label="Game modes">
        {modes.map(({ id, art, title, description }) => {
          const level = progress?.[id]?.unlocked ?? 1;
          return <article key={id} className={`${styles.card} ${styles[art]}`}>
            <div className={styles.cardCopy}>
              <h2><span className={styles.modeIcon}><Icon name={art} width={art === 'classic' ? 46 : 62} height={art === 'classic' ? 69 : 65} /></span>{title}</h2>
              <p>{description}</p>
              <div className={`${styles.pill} ${styles.level}`}>
                <span className={styles.badge} aria-hidden="true"><Icon name="level" width={47} height={57} /><span>{level}</span></span>
                Level {level}
              </div>
              <button type="button" className={`${styles.raised} ${styles.play}`} disabled={busy} onClick={() => onPlay(id)} aria-label={`Play ${title}`}>
                <Icon name="play" width={31} height={38} /> Play
              </button>
            </div>
            <div className={styles.board}>
              <Image src={`/modes/${art}-board.png`} alt="" width={806} height={865} unoptimized />
            </div>
          </article>;
        })}
      </section>

      <nav className={styles.actions} aria-label="Game menu">
        <button ref={mapButton} type="button" className={`${styles.raised} ${styles.map}`} onClick={() => {
          if (onLogin) { onLogin(); return; }
          setShowMap(true);
          window.scrollTo(0, 0);
        }}>
          <Icon name="map" width={36} height={34} /> Level Map
        </button>
        <button ref={leaderboardButtonRef} type="button" className={`${styles.raised} ${styles.leaderboard}`} onClick={onLeaderboard}>
          <Icon name="leaderboard" width={37} height={33} /> Leaderboard
        </button>
        <button type="button" className={`${styles.raised} ${styles.help}`} aria-haspopup="dialog"
          disabled={busy} onClick={() => setShowHelp(true)}>
          <Icon name="help" width={34} height={36} /> How to Play
        </button>
      </nav>

      {showHelp && <HowToPlayDialog onClose={() => setShowHelp(false)} />}
    </main>
  );
}
