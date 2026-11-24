import type { ReactNode } from 'react';
import Image from 'next/image';
import styles from './ModesHome.module.css';

// Positions and dimensions are relative to the 700 × 139 Figma logo frame.
const logoLayers = [
  ['logo-left-outline', 7.77, 40.68, 263.23, 63.72],
  ['logo-left-outline', 7.77, 33.43, 263.23, 63.72],
  ['logo-left-fill', 12.95, 38.61, 252.87, 53.37],
  ['logo-left-gloss', 12.95, 38.61, 252.87, 53.37],
  ['logo-knight-outline', 263.88, 37.32, 68.32, 68.32],
  ['logo-knight-base', 265.82, 35.39, 64.45, 64.45],
  ['logo-knight-gloss', 233.59, 3.16, 128.9, 91.52],
  ['logo-knight-ring', 263.88, 33.45, 68.32, 68.32],
  ['logo-knight', 279.57, 43.13, 37.96, 46.80],
  ['logo-right-outline', 331.39, 40.68, 135.57, 63.72],
  ['logo-right-outline', 331.39, 33.43, 135.57, 63.72],
  ['logo-right-fill', 336.57, 38.61, 125.21, 53.37],
  ['logo-right-gloss', 336.57, 38.61, 125.21, 53.37],
  ['logo-chess', 481.63, 32.52, 210.61, 70.97],
] as const;

export function GameIcon({ name, width, height, directory = 'modes' }: { name: string; width: number; height: number; directory?: string }) {
  const isCoin = name === 'coin' || name === 'old-coin';
  const src = isCoin ? '/portal/coin.svg' : `/${directory}/${name}.svg`;
  return <Image src={src} alt="" width={width} height={height} unoptimized
    style={{ width: `calc(${width} * var(--u))`, height: `calc(${height} * var(--u))` }} />;
}

export function GameLogo({ classic = false, className }: { classic?: boolean; className?: string }) {
  const directory = classic ? 'classic-tour' : 'modes';
  return (
    <h1 className={`${styles.logo} ${className ?? ''}`} aria-label="Knightours Chess">
      {logoLayers.map(([name, x, y, width, height], index) => {
        const gloss = name === 'logo-knight-gloss';
        return <span key={index} className={gloss ? styles.logoGloss : undefined}
          style={{
            left: `${x / 7}%`, top: `${y / 139 * 100}%`, width: `${width / 7}%`, height: `${height / 139 * 100}%`,
            maskImage: gloss ? `url('/${directory}/logo-knight-mask.svg')` : undefined,
          }}>
          <Image src={`/${directory}/${name}.svg`} alt="" fill unoptimized />
        </span>;
      })}
    </h1>
  );
}

type AccountProps = {
  username?: string;
  coins?: number;
  shopUrl?: string;
  coinDirectory?: 'modes' | 'portal';
  onLogin?: () => void;
  onSettings: () => void;
  onHelp?: () => void;
  children?: ReactNode;
};

export function GameAccount({ username, coins, shopUrl, coinDirectory = 'portal', onLogin, onSettings, onHelp, children }: AccountProps) {
  return <div className={`${styles.account} ${onHelp ? styles.mapAccount : ''}`}>
    {children}
    {shopUrl && <a className={`${styles.pill} ${styles.coins}`} href={shopUrl} target="_blank" rel="noopener"
      aria-label={coins === undefined ? 'Shop (opens in a new tab), coin balance unavailable' : `Shop (opens in a new tab), ${coins} coins`}>
      <GameIcon name="coin" width={30} height={30} directory={coinDirectory} />
      <span>{coins?.toLocaleString('en-US') ?? '—'}</span>
      <span className={styles.roundIcon}><GameIcon name="plus" width={16} height={17} /></span>
    </a>}
    {username ? <div className={`${styles.pill} ${styles.profile}`}>
      <span className={styles.roundIcon}><GameIcon name="profile" width={16} height={19} /></span>
      <span className={styles.username} title={username}>{username}</span>
    </div> : <button type="button" className={styles.pill} onClick={onLogin}>
      <span className={styles.roundIcon}><GameIcon name="profile" width={16} height={19} /></span> Login
    </button>}
    <button type="button" className={`${styles.raised} ${styles.settings}`} onClick={onSettings} aria-label="Settings">
      <GameIcon name="settings" width={36} height={37} />
    </button>
    {onHelp && <button type="button" className={`${styles.raised} ${styles.settings} ${styles.help}`} onClick={onHelp} aria-label="How to Play">
      <GameIcon name="help" width={33} height={34} directory="level-map" />
    </button>}
  </div>;
}
