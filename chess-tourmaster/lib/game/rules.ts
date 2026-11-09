export const MAX_LEVELS = 100;
export const LEVEL_VERSION = 2;
export const FIRE_LIMIT_MS = 3000;
export const MATH_STAR_RATIOS = { two: 1.08, three: 1.2 };

export function getMathStarTargets(required: number): [number, number, number] {
  return [required,
    Math.ceil(required * Math.round(MATH_STAR_RATIOS.two * 100) / 100),
    Math.ceil(required * Math.round(MATH_STAR_RATIOS.three * 100) / 100)];
}

export function calculateStars(mode: string, score: number, required: number, seconds: number, par: number): number {
  if (mode === 'math_tour') {
    const [, two, three] = getMathStarTargets(required);
    return score >= three ? 3 : score >= two ? 2 : 1;
  }
  return seconds <= par ? 3 : seconds <= par * 1.5 ? 2 : 1;
}
