import Image from 'next/image';
import type { MathPiece, TileData } from '@/lib/game/types';
import FireTileEffect, { type FireTileState } from './FireTileEffect';
import styles from './MathTour.module.css';

const visitedArtwork: Partial<Record<MathPiece, string>> = {
  pawn: 'pawn-visited', bishop: 'bishop-visited', rook: 'rook-visited',
};

type Props = {
  tile: TileData;
  isKnight: boolean;
  valid: boolean;
  hinted: boolean;
  dimmed: boolean;
  locked: boolean;
  onMove: (r: number, c: number) => void;
  fire?: FireTileState;
};

export default function MathTile({ tile, isKnight, valid, hinted, dimmed, locked, onMove, fire }: Props) {
  const { r, c, piece, value, tileMultiplier = 1, hasFire } = tile;
  const visitedPiece = piece && (visitedArtwork[piece] ?? piece);
  if (!isKnight && (tile.type === 'void' || tile.visited)) {
    return <span className={styles.emptyTile} aria-hidden="true" data-visited-piece={piece} data-dimmed={dimmed}>
      {visitedPiece && <Image src={`/math-tour/${visitedPiece}.svg`} alt="" fill unoptimized />}
    </span>;
  }

  const isKing = tile.type === 'king' && !isKnight;
  const kind = isKnight ? (hasFire ? 'burning' : 'player') : isKing ? 'destination'
    : hasFire ? 'fire' : tileMultiplier > 1 ? 'multiply' : value < 0 ? 'subtract' : 'add';
  const hasValue = !isKnight && !isKing && (tileMultiplier > 1 || value !== 0);
  const tileValue = tileMultiplier > 1 ? `×${tileMultiplier}` : value < 0 ? `−${Math.abs(value)}` : `+${value}`;
  const label = [
    isKnight ? (hasFire ? 'Knight on fire tile' : 'Knight') : isKing ? 'King' : hasFire ? 'Fire tile' : piece ?? 'Tile',
    hasValue ? (tileMultiplier > 1 ? `multiply score by ${tileMultiplier}` : `${value} points`) : '',
    `row ${r + 1}, column ${c + 1}`,
    hinted ? 'suggested move' : valid ? 'available move' : '',
  ].filter(Boolean).join(', ');
  const artwork = isKnight ? '/classic-tour/knight.svg' : isKing ? '/classic-tour/king.svg'
    : hasFire ? '/classic-tour/fire.svg' : piece ? `/math-tour/${piece}.svg` : undefined;
  const artworkSize = kind === 'fire' ? { width: 42.3624, height: 439.001 } : { fill: true };

  return <button type="button" className={styles.tile} data-kind={kind} data-math-piece={piece} data-next={valid}
    data-hint={hinted} data-dimmed={dimmed} aria-label={label} disabled={locked || isKnight} onClick={() => onMove(r, c)}>
    {fire && <FireTileEffect {...fire} />}
    {artwork && <span className={styles.piece}><Image src={artwork} alt="" {...artworkSize} unoptimized /></span>}
    {hasValue && <span className={styles.tileValue} aria-hidden="true">{tileValue}</span>}
    {valid && !artwork && !hasValue && <span className={styles.movePoint} aria-hidden="true" />}
  </button>;
}
