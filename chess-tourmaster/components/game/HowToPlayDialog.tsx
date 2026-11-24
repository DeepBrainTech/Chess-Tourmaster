import Image from 'next/image';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { GameMode } from '@/lib/game/types';
import { GameIcon } from './GameArtwork';
import dialogStyles from './ClassicResultDialog.module.css';
import styles from './HowToPlayDialog.module.css';

const move = { title: 'Move your piece', description: 'Tap a highlighted tile. Each piece moves like in chess.', icon: ['knight', 29.9608, 36.9412], color: 'blue' } as const;
const star = ['star', 34.078, 33.8947] as const;

const tours = [
  {
    mode: 'classic', label: 'Classic Tour', tab: ['classic', 30.84, 46.6826],
    badge: ['classic-badge', 18.3606, 27.7924],
    steps: [
      move,
      { title: 'Clear every tile', description: 'Each tile you land on disappears. Land on all of them.', icon: ['clear', 29.633, 30.9474], color: 'purple' },
      { title: 'Catch the King last', description: 'Once every tile is gone, jump onto the King to win.', icon: ['king', 29.9608, 36.9412], color: 'red' },
      { title: 'Be quick for stars', description: 'The faster you finish, the more stars you get.', icon: star, color: 'yellow' },
    ],
    warning: 'Fire tiles are hot!', warningDetail: 'Jump off within 3 seconds, or you lose.',
  },
  {
    mode: 'math_tour', label: 'Math Tour', tab: ['math', 41.8056, 43.7794],
    badge: ['math-badge', 24.8889, 26.064],
    steps: [
      move,
      { title: 'Collect points', description: 'Each tile changes your score when you land on it.', icon: ['points', 28.1514, 29.4737], color: 'green' },
      { title: 'Reach the target', description: 'Hit the target score, then jump onto the King to win.', icon: ['target', 32.5926, 68.5094], color: 'orange' },
      { title: 'Score higher for more stars', description: 'Reach the target for 1 star. Go past it for 2 or 3.', icon: star, color: 'yellow' },
    ],
    warning: 'Fire tiles triple your score', warningDetail: 'But jump off within 3 seconds, or you lose.',
  },
] as const;

function RulesIcon({ artwork }: { artwork: readonly [string, number, number] }) {
  const [name, width, height] = artwork;
  return <GameIcon directory="how-to-play" name={name} width={width} height={height} />;
}

function isOutsideDialog({ currentTarget, clientX, clientY }: PointerEvent<HTMLDialogElement>) {
  const { left, right, top, bottom } = currentTarget.getBoundingClientRect();
  return clientX < left || clientX > right || clientY < top || clientY > bottom;
}

type Props = { initialMode?: GameMode; gameMode?: GameMode; onClose: () => void };

export default function HowToPlayDialog({ initialMode = 'classic', gameMode, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const pressedOutside = useRef(false);
  const id = useId();
  const [selectedMode, setMode] = useState(initialMode);
  const mode = gameMode ?? selectedMode;
  const visibleTours = gameMode ? tours.filter(tour => tour.mode === gameMode) : tours;
  const BadgeHeading = gameMode ? 'h2' : 'h1';

  useEffect(() => {
    const modal = dialog.current;
    if (modal && !modal.open) {
      modal.querySelector('[role="tab"][aria-selected="true"], button[value="close"]')?.setAttribute('autofocus', '');
      modal.showModal();
    }
  }, []);

  function moveTabFocus(event: KeyboardEvent<HTMLDivElement>) {
    let next: GameMode;
    switch (event.key) {
      case 'Home': next = 'classic'; break;
      case 'End': next = 'math_tour'; break;
      case 'ArrowLeft':
      case 'ArrowRight': next = mode === 'classic' ? 'math_tour' : 'classic'; break;
      default: return;
    }
    event.preventDefault();
    setMode(next);
    document.getElementById(`${id}-${next}`)?.focus();
  }

  return <dialog ref={dialog} className={`${dialogStyles.dialog} ${styles.dialog}`}
    aria-label={gameMode ? undefined : 'How to Play'} aria-labelledby={gameMode ? id : undefined}
    {...{ closedby: 'any' }} onClose={onClose}
    onPointerDown={event => {
      pressedOutside.current = !('closedBy' in event.currentTarget) && isOutsideDialog(event);
    }}
    onPointerUp={event => {
      if (pressedOutside.current && isOutsideDialog(event)) event.currentTarget.close();
      pressedOutside.current = false;
    }}>
    <form method="dialog" className={`${dialogStyles.panel} ${styles.panel}`} data-mode={mode}>
      {gameMode ? (
        <h1 className={`${dialogStyles.title} ${styles.heading}`} id={id}>How to Play</h1>
      ) : (
        <div className={styles.tabs} role="tablist" aria-label="Game mode" onKeyDown={moveTabFocus}>
          {tours.map(({ mode: tabMode, label, tab: [name, width, height] }) => <button key={tabMode} type="button"
            id={`${id}-${tabMode}`} role="tab" aria-selected={mode === tabMode} tabIndex={mode === tabMode ? 0 : -1}
            onClick={() => setMode(tabMode)}>
            <span className={styles.tabIcon}><GameIcon directory="level-map" name={name} width={width} height={height} /></span>
            <span>{label}</span>
          </button>)}
        </div>
      )}

      {visibleTours.map(tour => <div key={tour.mode} role={gameMode ? undefined : 'tabpanel'}
        aria-labelledby={gameMode ? undefined : `${id}-${tour.mode}`} hidden={mode !== tour.mode}>
        <div className={styles.rules}>
          <BadgeHeading className={styles.badge}>
            <span className={styles.badgeIcon}><RulesIcon artwork={tour.badge} /></span>{tour.label}
          </BadgeHeading>

          <div className={styles.stepList}>
            <span className={styles.stepLine} aria-hidden="true" />
            <ol className={styles.steps} role="list">
              {tour.steps.map(({ title, description, icon, color }, index) => <li key={title}>
                <span className={styles.stepNumber} aria-hidden="true">
                  <Image src="/how-to-play/step.png" alt="" width={240} height={292} unoptimized />
                  <span>{index + 1}</span>
                </span>
                <div className={styles.step}>
                  <span className={styles.stepIcon} data-color={color}><RulesIcon artwork={icon} /></span>
                  <div>
                    <h2>{title}</h2>
                    <p>{description}</p>
                  </div>
                </div>
              </li>)}
            </ol>
          </div>

          <div className={styles.footer}>
            <div className={styles.warning}>
              <div className={styles.warningBody}>
                <span className={styles.fireIcon}><RulesIcon artwork={['fire', 28.0469, 82.0493]} /></span>
                <div>
                  <p className={styles.warningLabel}>Watch Out</p>
                  <h2>{tour.warning}</h2>
                  <p>{tour.warningDetail}</p>
                </div>
              </div>
            </div>
            <button type="submit" className={`${dialogStyles.button} ${styles.done}`}>
              <span className={styles.doneIcon}><RulesIcon artwork={['done', 39.8148, 32.8346]} /></span> Got It!
            </button>
          </div>
        </div>
      </div>)}

      <button type="submit" value="close" className={`${dialogStyles.button} ${dialogStyles.close} ${styles.close}`} aria-label="Close how to play">
        <GameIcon directory="classic-results" name="close" width={25.1881} height={26.5263} />
      </button>
    </form>
  </dialog>;
}
