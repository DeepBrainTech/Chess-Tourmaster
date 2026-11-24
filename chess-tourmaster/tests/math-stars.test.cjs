const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { createLoader } = require('./helpers/load-ts.cjs');
const load = createLoader(Object.fromEntries([
  'MathTour', 'ModesHome', 'GameNavigation', 'Tour',
].map(name => [`./${name}.module.css`, {}])));
const { getMathStarTargets, calculateStars } = load('lib/game/rules.ts');
const MathStarProgress = load('components/game/MathStarProgress.tsx').default;
const Tour = load('components/game/Tour.tsx').default;
const render = (score, requiredScore = 31) => renderToStaticMarkup(React.createElement(MathStarProgress, { score, requiredScore }));

test('visible integer star targets match server awards, including floating-point boundary cases', () => {
  assert.deepEqual(getMathStarTargets(31), [28, 31, 35]);
  assert.deepEqual(getMathStarTargets(25), [23, 25, 28]);
  assert.deepEqual(getMathStarTargets(100), [90, 100, 110]);
  for (const required of [1, 25, 31, 50, 100, 7611]) {
    const targets = getMathStarTargets(required);
    for (const score of new Set(targets.flatMap(t => [t - 1, t]))) {
      const earned = targets.filter(t => score >= t).length;
      assert.equal(calculateStars('math_tour', score, required, 0, 1), earned);
    }
  }
});

test('score meter shows all star thresholds and highlights only reached tiers', () => {
  const before = render(0);
  assert.match(before, /<meter [^>]*max="35" value="0" aria-label="Score"/);
  assert.match(before, /28 points required to capture the King/);
  assert.match(render(-3), /aria-valuetext="-3 points\./);
  assert.match(render(-3), /inline-size:0%/);
  assert.match(render(35), /inline-size:100%/);
  assert.equal((render(31).match(/score-star-earned\.svg/g) ?? []).length, 2);
  assert.equal((render(31).match(/score-star-empty\.svg/g) ?? []).length, 1);
  assert.match(before, /aria-label="1 star: 28 points"/);
  assert.match(before, /aria-label="2 stars: 31 points"/);
  assert.match(before, /aria-label="3 stars: 35 points"/);
  assert.doesNotMatch(before, /points, reached/);
  assert.match(render(31), /aria-label="2 stars: 31 points, reached" aria-current="step"/);
  assert.match(render(31), /aria-label="3 stars: 35 points"/);
  assert.match(before, /28 more points to unlock King capture/);
  assert.match(render(28), /Finish at this score: 1 star/);
  assert.match(render(28), /3 more points for 2 stars/);
  assert.match(render(31), /Finish at this score: 2 stars/);
  assert.match(render(31), /4 more points for 3 stars/);
  assert.match(render(35), /Three-star score reached/);
  assert.doesNotMatch(render(31), /Capture the King to claim your stars/);
  // A bishop or undo can lower the pending award again; stars are never promised as locked in.
  assert.match(render(27), /1 more point to unlock King capture/);
  assert.doesNotMatch(render(27), /Finish at this score/);
});

test('the in-game panel exposes star targets only for Math Tour', () => {
  const props = { level: 3, tilesLeft: 15, time: '00:12' };
  const math = renderToStaticMarkup(React.createElement(Tour, {
    ...props, mode: 'math_tour', score: 28, requiredScore: 31, history: [],
  }));
  const classic = renderToStaticMarkup(React.createElement(Tour, { ...props, mode: 'classic' }));
  assert.match(math, /Star score targets/);
  assert.match(math, /Finish at this score: 1 star/);
  assert.equal((math.match(/Star score targets/g) ?? []).length, 1);
  assert.doesNotMatch(classic, /Star score targets/);
});
