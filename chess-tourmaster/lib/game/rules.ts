export const MAX_LEVELS = 100;
export const LEVEL_VERSION = 2;
export const FIRE_LIMIT_MS = 3000;
export const MATH_STAR_PERCENTAGES = { one: 90, two: 100, three: 110 };

export function getMathStarTargets(baseScore: number): [number, number, number] {
  const { one, two, three } = MATH_STAR_PERCENTAGES;
  return [
    Math.ceil(baseScore * one / 100),
    Math.ceil(baseScore * two / 100),
    Math.ceil(baseScore * three / 100),
  ];
}

export function calculateStars(mode: string, score: number, baseScore: number, seconds: number, par: number): number {
  if (mode === 'math_tour') {
    return getMathStarTargets(baseScore).filter(target => score >= target).length;
  }
  return seconds <= par ? 3 : seconds <= par * 1.5 ? 2 : 1;
}
