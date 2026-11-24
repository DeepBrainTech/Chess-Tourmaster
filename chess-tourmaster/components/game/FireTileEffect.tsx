import type { CSSProperties } from 'react';
import styles from './FireTileEffect.module.css';

export type FireTileState = {
  progress: number;
  charred: boolean;
  paused: boolean;
};

export default function FireTileEffect({ progress, charred, paused }: FireTileState) {
  return <span className={styles.effect} aria-hidden="true" data-fire-stage={charred ? 'charred' : 'heating'}
    data-fire-paused={paused} style={{ '--fire-progress': progress } as CSSProperties}>
    <span className={styles.fill} />
    <span className={styles.ash} />
  </span>;
}
