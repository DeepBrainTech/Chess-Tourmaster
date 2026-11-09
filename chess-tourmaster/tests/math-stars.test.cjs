const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { createLoader } = require('./helpers/load-ts.cjs');
const load = createLoader();
const { getMathStarTargets, calculateStars } = load('lib/game/rules.ts');
const MathStarProgress = load('components/game/MathStarProgress.tsx').default;
const { TilesAndScoreBar } = load('components/game/GameHeader.tsx');
const render = (score, requiredScore = 31) => renderToStaticMarkup(React.createElement(MathStarProgress, { score, requiredScore }));

test('visible integer star targets match server awards, including floating-point boundary cases', () => {
  assert.deepEqual(getMathStarTargets(31), [31, 34, 38]);
  assert.deepEqual(getMathStarTargets(25), [25, 27, 30]);
  assert.equal(calculateStars('math_tour', 27, 25, 0, 1), 2);
  for (const required of [1, 25, 31, 50, 100, 7611]) {
    const targets = getMathStarTargets(required);
    for (const score of new Set(targets.flatMap(t => [t - 1, t]))) {
      const earned = targets.filter(t => score >= t).length;
      if (score >= required) assert.equal(calculateStars('math_tour', score, required, 0, 1), earned);
    }
  }
});

test('compact score capsule shows all star thresholds and highlights only reached tiers', () => {
  const before = render(0);
  assert.match(before, /Score:/);
  assert.match(before, /aria-label="1 star: 31 points"/);
  assert.match(before, /aria-label="2 stars: 34 points"/);
  assert.match(before, /aria-label="3 stars: 38 points"/);
  assert.doesNotMatch(before, /points, reached/);
  assert.match(render(34), /aria-label="2 stars: 34 points, reached" aria-current="step"/);
  assert.match(render(34), /aria-label="3 stars: 38 points"/);
  assert.match(before, /31 more points to unlock King capture/);
  assert.match(render(31), /Finish at this score: 1 star/);
  assert.match(render(31), /3 more points for 2 stars/);
  assert.match(render(34), /Finish at this score: 2 stars/);
  assert.match(render(34), /4 more points for 3 stars/);
  assert.match(render(38), /Three-star score reached/);
  assert.doesNotMatch(render(34), /Capture the King to claim your stars/);
  // A bishop or undo can lower the pending award again; stars are never promised as locked in.
  assert.match(render(30), /1 more point to unlock King capture/);
  assert.doesNotMatch(render(30), /Finish at this score/);
});

test('the in-game bar exposes star targets only for Math Tour', () => {
  const props = { tilesLeft: 15, gameTimeSeconds: 12, currentScore: 31, requiredScore: 31 };
  const math = renderToStaticMarkup(React.createElement(TilesAndScoreBar, { ...props, gameMode: 'math_tour' }));
  const classic = renderToStaticMarkup(React.createElement(TilesAndScoreBar, { ...props, gameMode: 'classic' }));
  assert.match(math, /Star score targets/);
  assert.match(math, /Finish at this score: 1 star/);
  assert.equal((math.match(/Star score targets/g) ?? []).length, 1);
  assert.doesNotMatch(classic, /Star score targets/);
});
