'use client';

import type { GameMode } from '@/lib/game/types';
import { MATH_STAR_PERCENTAGES } from '@/lib/game/rules';

type Props = {
  busy?: boolean;
  gameMode: GameMode;
  onCloseOverlay: () => void;
};

export default function MainModal({
  busy = false,
  gameMode,
  onCloseOverlay,
}: Props) {
  const isMathTour = gameMode === 'math_tour';

  return (
    <div
      inert={busy || undefined}
      aria-busy={busy}
      className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop"
      onClick={onCloseOverlay}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Escape' && onCloseOverlay()}
    >
      <div
        className="bg-slate-800 border-2 border-slate-500 p-6 rounded-2xl shadow-2xl max-w-sm w-full m-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-2xl font-bold text-rose-500 mb-4 fantasy-font border-b border-slate-600 pb-2">
          {isMathTour ? 'Instructions (Math Tour)' : 'Instructions (Classic Tour)'}
        </h3>
        <ul className="text-left text-gray-300 space-y-3 text-sm">
          <li className="flex items-start">
            <i className="fas fa-chess-knight w-6 text-cyan-400 mt-1" />
            <span><strong>Move:</strong> L-shape jump to clear tiles.</span>
          </li>
          {isMathTour && (
            <li className="flex items-start">
              <i className="fas fa-plus w-6 text-amber-400 mt-1" />
              <span><strong>Gather:</strong> Collect tile points to meet score requirement for King capture.</span>
            </li>
          )}
          <li className="flex items-start">
            <i className="fas fa-fire w-6 text-orange-500 mt-1" />
            <span><strong>Fire:</strong> {isMathTour ? '3s to move or burn! Fire tile = x3 score when you land on it (no piece on fire).' : '3s to move or burn!'}</span>
          </li>
          <li className="flex items-start">
            <i className="fas fa-chess-king w-6 text-rose-500 mt-1" />
            <span><strong>Win:</strong> {isMathTour ? 'Meet score requirement to capture King.' : 'Clear board to capture King.'}</span>
          </li>
          <li className="flex items-start">
            <i className="fas fa-star w-6 text-yellow-400 mt-1" />
            <span><strong>Stars:</strong> {isMathTour
              ? `By level target (≥${MATH_STAR_PERCENTAGES.one}% = 1★, ≥${MATH_STAR_PERCENTAGES.two}% = 2★, ≥${MATH_STAR_PERCENTAGES.three}% = 3★).`
              : 'By time (faster = more stars).'}</span>
          </li>
        </ul>
        <button
          type="button"
          onClick={onCloseOverlay}
          className="mt-6 w-full bg-slate-700 text-white py-2 rounded-lg hover:bg-slate-600"
        >
          Close
        </button>
      </div>
    </div>
  );
}
