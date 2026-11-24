const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createLoader } = require('./helpers/load-ts.cjs');
const load = createLoader();
const { generateLevelConfig, getValidMoves } = load('lib/game/levelGenerator.ts');
const { getFixedLevelConfig } = load('lib/game/levelCatalog.ts');
const { gameReducer, initialGameState, isValidMove } = load('lib/game/gameReducer.ts');
const { getHintMove } = load('lib/game/hint.ts');
const { replayGame } = load('lib/game/replay.ts');
const { GameClock } = load('lib/game/clock.ts');
const { calculateStars, getMathStarTargets } = load('lib/game/rules.ts');
const { optimisticMathScore } = load('lib/game/scoreBound.ts');
const start = (config, mode = 'classic') => gameReducer({ ...initialGameState, gameMode: mode }, { type: 'START_LEVEL', payload: config });
const move = (state, pos) => gameReducer(state, { type: 'MOVE', payload: pos });
const won = state => !state.isPlaying && state.knightPos.r === state.kingPos.r && state.knightPos.c === state.kingPos.c;

for (const mode of ['classic', 'math_tour']) {
  test(`${mode}: all 100 deterministic levels have legal complete solutions and reliable repeated hints`, () => {
    for (let level = 1; level <= 100; level++) {
      const config = generateLevelConfig(level, mode);
      assert.deepEqual(config, generateLevelConfig(level, mode), `deterministic ${level}`);
      const seen = new Set([`${config.knightPos.r},${config.knightPos.c}`]);
      let state = start(config, mode);
      let expectedScore = 0;
      for (const pos of config.solution) {
        const key = `${pos.r},${pos.c}`;
        assert.ok(!seen.has(key), `repeated tile ${mode}:${level}`);
        seen.add(key);
        assert.ok(isValidMove(state, pos.r, pos.c), `illegal solution ${mode}:${level}`);
        const tile = state.grid[pos.r][pos.c];
        if (tile.type !== 'king') expectedScore = (tile.tileMultiplier ?? 1) > 1
          ? expectedScore * tile.tileMultiplier : expectedScore + tile.value;
        state = move(state, pos);
      }
      assert.ok(won(state), `unsolvable ${mode}:${level}`);
      if (mode === 'classic') assert.equal(state.tilesLeft, 0);
      else {
        assert.equal(state.currentScore, expectedScore);
        assert.ok(expectedScore >= getMathStarTargets(config.requiredScore)[2], `three stars unreachable ${level}`);
        assert.ok(config.grid.flat().filter(t => t.hasFire).length <= 3);
        assert.ok(config.requiredScore > optimisticMathScore(config.grid, 4 + Math.floor(level * 0.08)),
          `target permits an overly short math route ${level}`);
      }
      const replay = replayGame(level, mode, config.solution, true);
      assert.ok(won(replay));
      state = start(config, mode);
      for (let i = 0; i < 49 && state.isPlaying; i++) {
        const hint = getHintMove(state);
        assert.equal(hint.type, 'next_move', `missing hint ${mode}:${level}:${i}`);
        assert.ok(isValidMove(state, hint.move.r, hint.move.c));
        state = move(state, hint.move);
      }
      assert.ok(won(state), `hints stranded ${mode}:${level}`);
      if (mode === 'math_tour') {
        assert.ok(state.currentScore >= getMathStarTargets(config.requiredScore)[2], `hints missed three stars ${level}`);
      }
    }
  });
}

test('tutorial has no fire and generous par; late math needs more moves than the opening band', () => {
  for (let level = 1; level <= 3; level++) {
    const config = generateLevelConfig(level, 'classic');
    assert.equal(config.grid.flat().some(t => t.hasFire), false);
    assert.ok(config.parTime >= 25);
  }
  const averages = [[1, 15], [61, 100]].map(([lo, hi]) => {
    let total = 0;
    for (let level = lo; level <= hi; level++) {
      let state = start(generateLevelConfig(level, 'math_tour'), 'math_tour');
      while (state.isPlaying) state = move(state, getHintMove(state).move);
      total += state.history.length;
    }
    return total / (hi - lo + 1);
  });
  assert.ok(averages[1] > averages[0] * 1.25, `math progression too flat: ${averages}`);
});

test('catalog rejects invalid input and protects server boards from caller mutation', () => {
  for (const value of [0, 101, 1.5, NaN, Infinity]) assert.throws(() => getFixedLevelConfig(value, 'classic'), RangeError);
  assert.throws(() => getFixedLevelConfig(1, 'invalid'), RangeError);
  const first = getFixedLevelConfig(1, 'classic');
  first.grid[0][0].value = 999;
  first.knightPos.r = -10;
  first.solution[0].r = -10;
  assert.deepEqual(getFixedLevelConfig(1, 'classic'), generateLevelConfig(1, 'classic'));
});

test('moves reject stopped games, invalid coordinates, repeat visits and premature king captures', () => {
  const state = start(generateLevelConfig(15, 'classic'));
  for (const p of [{ r: -2, c: -1 }, { r: 99, c: 99 }, { r: 1.5, c: 2 }, { r: NaN, c: 0 }, state.knightPos, state.kingPos]) {
    assert.equal(move(state, p), state);
  }
  const stopped = { ...state, isPlaying: false };
  assert.equal(move(stopped, state.solution[0]), stopped);
  const finished = replayGame(15, 'classic', state.solution, true);
  assert.equal(gameReducer(finished, { type: 'UNDO' }), finished);
  const switched = gameReducer(state, { type: 'SET_MODE', payload: 'math_tour' });
  assert.equal(switched.isPlaying, false);
  assert.deepEqual(switched.grid, []);
});

test('Math Tour unlocks King capture at the one-star target', () => {
  const config = generateLevelConfig(1, 'math_tour');
  const state = start(config, 'math_tour');
  const [approach] = getValidMoves(state.kingPos.r, state.kingPos.c, state.gridSizeVal);
  const below = { ...state, knightPos: approach, currentScore: 27 };
  const atTarget = { ...below, currentScore: 28 };
  assert.equal(move(below, state.kingPos), below);
  assert.ok(won(move(atTarget, state.kingPos)));
});

test('Math Tour hints take a higher-scoring detour and keep a known finish if the search budget runs out', () => {
  const mode = 'math_tour';
  const config = generateLevelConfig(1, mode);
  const knightPos = { r: 0, c: 0 };
  const kingPos = { r: 1, c: 2 };
  const first = { r: 2, c: 1 };
  const second = { r: 3, c: 3 };
  const state = start({ ...config, knightPos, kingPos, initialScore: 90, requiredScore: 100, tilesLeft: 2,
    solution: [kingPos], grid: config.grid.map(row => row.map(({ r, c }) => {
      const visited = r === knightPos.r && c === knightPos.c;
      const king = r === kingPos.r && c === kingPos.c;
      const scoring = [first, second].some(pos => r === pos.r && c === pos.c);
      return { r, c, visited, type: king ? 'king' : visited || scoring ? 'empty' : 'void',
        hasFire: false, value: scoring ? 5 : 0 };
    })),
  }, mode);
  assert.deepEqual(getHintMove(state, 0), { type: 'next_move', move: kingPos });
  assert.deepEqual(getHintMove(state), { type: 'next_move', move: first });
  const next = move(state, first);
  assert.deepEqual(getHintMove(next), { type: 'next_move', move: second });
  const ready = move(next, second);
  assert.deepEqual(getHintMove(ready), { type: 'next_move', move: kingPos });
  const finished = move(ready, kingPos);
  assert.ok(won(finished));
  assert.equal(finished.currentScore, 100);
});

test('undo restores score, visited tiles and adjacent fires exactly', () => {
  for (const mode of ['classic', 'math_tour']) {
    let state = start(generateLevelConfig(100, mode), mode);
    for (const pos of state.solution.slice(0, 25)) {
      const next = move(state, pos);
      const restored = gameReducer(next, { type: 'UNDO' });
      assert.deepEqual(restored.grid, state.grid);
      assert.equal(restored.currentScore, state.currentScore);
      assert.equal(restored.tilesLeft, state.tilesLeft);
      assert.deepEqual(restored.knightPos, state.knightPos);
      state = next;
    }
  }
});

// Independent exhaustive oracle for small boards; no production search or move validator.
function oracle(state) {
  function visit(r, c, seen, score, remaining) {
    for (const row of state.grid) for (const tile of row) {
      const dr = Math.abs(r - tile.r), dc = Math.abs(c - tile.c);
      if (!((dr === 1 && dc === 2) || (dr === 2 && dc === 1)) || tile.type === 'void') continue;
      const key = `${tile.r},${tile.c}`;
      if (seen.has(key) || tile.visited) continue;
      if (tile.type === 'king') {
        if (state.gameMode === 'math_tour' ? score >= Math.ceil(state.requiredScore * 90 / 100) : remaining === 0) return true;
        continue;
      }
      const nextScore = (tile.tileMultiplier ?? 1) > 1 ? score * tile.tileMultiplier : score + tile.value;
      if (visit(tile.r, tile.c, new Set([...seen, key]), nextScore, remaining - 1)) return true;
    }
    return false;
  }
  return visit(state.knightPos.r, state.knightPos.c, new Set(), state.currentScore, state.tilesLeft);
}

test('off-route hints agree with exhaustive oracle; impossible and budget-limited searches are distinct', () => {
  for (const mode of ['classic', 'math_tour']) {
    for (let level = 1; level <= 20; level++) {
      const config = generateLevelConfig(level, mode);
      const route = [config.knightPos, ...config.solution].slice(0, 8);
      const allowed = new Set(route.map(p => `${p.r},${p.c}`));
      const king = route[route.length - 1];
      config.grid.forEach(row => row.forEach(t => {
        t.type = allowed.has(`${t.r},${t.c}`) ? 'empty' : 'void';
        if (t.r === king.r && t.c === king.c) t.type = 'king';
      }));
      config.kingPos = king;
      config.solution = undefined;
      config.tilesLeft = route.length - 2;
      config.requiredScore = mode === 'math_tour' ? 12 : 0;
      const state = start(config, mode);
      const hint = getHintMove(state);
      const possible = oracle(state);
      assert.equal(hint.type === 'next_move', possible, `${mode}:${level}`);
      if (possible) assert.ok(won(move(state, hint.move)) || oracle(move(state, hint.move)));
    }
  }
  const state = start(generateLevelConfig(15, 'classic'));
  state.solution = undefined;
  assert.equal(getHintMove(state, 0).type, 'search_exhausted');
  const math = start(generateLevelConfig(1, 'math_tour'), 'math_tour');
  math.solution = undefined;
  math.grid.forEach(row => row.forEach(t => { if (!t.visited && t.type !== 'king') t.type = 'void'; }));
  math.requiredScore = 1000;
  assert.equal(getHintMove(math).type, 'no_win_path');
});

test('fire gets a fresh deadline on every landing, pauses preserve remaining time and wall time never leaks into score', () => {
  const clock = new GameClock();
  clock.update(0, true, '1,2', true);
  assert.equal(clock.update(2500, true, '1,2', true).fireRemainingMs, 500);
  assert.equal(clock.update(2500, true, '3,3', true).fireRemainingMs, 3000);
  assert.equal(clock.update(3500, false, '3,3', true).fireRemainingMs, 2000);
  assert.equal(clock.update(35000, true, '3,3', true).fireRemainingMs, 2000);
  const sample = clock.update(37000, true, '3,3', true);
  assert.equal(sample.fireRemainingMs, 0);
  assert.equal(sample.seconds, 5);
  assert.equal(clock.update(37000, true, '1,4', false).fireRemainingMs, 3000);
});

test('star boundaries are shared; replay rejects fabricated, incomplete and post-win moves', () => {
  assert.equal(calculateStars('math_tour', 110, 100, 0, 1), 3);
  assert.equal(calculateStars('math_tour', 109, 100, 0, 1), 2);
  assert.equal(calculateStars('math_tour', 99, 100, 0, 1), 1);
  assert.equal(calculateStars('math_tour', 89, 100, 0, 1), 0);
  assert.equal(calculateStars('classic', 0, 0, 25, 25), 3);
  assert.equal(calculateStars('classic', 0, 0, 37.5, 25), 2);
  assert.equal(calculateStars('classic', 0, 0, 38, 25), 1);
  const config = generateLevelConfig(1, 'classic');
  for (const moves of [null, [], [{ r: -1, c: 999 }], [...config.solution, config.knightPos], Array(50).fill({ r: 0, c: 0 })]) {
    assert.throws(() => replayGame(1, 'classic', moves, true));
  }
});

test('math short-route bound dominates every permutation of additions, negatives and multipliers', () => {
  const operations = [{ value: 5 }, { value: 3 }, { value: 1 }, { value: -3 },
    { value: 0, tileMultiplier: 2 }, { value: 0, tileMultiplier: 3 }];
  const grid = [operations.map((tile, c) => ({ ...tile, r: 0, c, visited: false, type: 'empty', hasFire: false }))];
  const maximum = Array(operations.length + 1).fill(0);
  function permute(score, remaining, depth) {
    for (let i = depth; i < maximum.length; i++) maximum[i] = Math.max(maximum[i], score);
    remaining.forEach((op, i) => permute((op.tileMultiplier ?? 1) > 1 ? score * op.tileMultiplier : score + op.value,
      remaining.filter((_, j) => i !== j), depth + 1));
  }
  permute(0, operations, 0);
  maximum.forEach((expected, moves) => assert.equal(optimisticMathScore(grid, moves), expected));
});
