// The numbers and the maths of the game, as plain functions with no engine in them. Change them here and the tests show what happened.
//
// The game is "stand on the colour": the floor is a grid of coloured tiles. A colour (and its shape) is called, everyone runs onto it,
// and when the time is up every other tile drops away. Whoever is standing on a dropped tile is out and floats on as a ghost. Each wave
// is faster and calls for fewer tiles than the one before.
//
// Everything about the floor is a pure function of the round and the seconds since it began, so every page works out the same floor
// with no messages, and a page that reloads or becomes the host simply carries on.

export const FLOOR = { cols: 8, rows: 6, tile: 2 };
export const HALF = { x: (FLOOR.cols * FLOOR.tile) / 2, y: (FLOOR.rows * FLOOR.tile) / 2 };

export const RUNNER = {
  radius: 0.45,
  speed: 5.6,
  accel: 42,
  dashSpeed: 12.5,
  dashTime: 0.18,
  dashCooldown: 1.5,
};

export const WAVE = {
  /** Seconds the floor shows itself before the first wave of a round. */
  grace: 1.4,
  /** How long the other tiles stay gone, and how long the floor takes to come back. */
  drop: 1.3,
  rest: 1.0,
  /** The tiles fall in the first moments of the drop; the referee looks at who is standing where after this long. */
  fall: 0.3,
  judgeAfter: 0.35,
  /** A runner whose middle is this close to a safe tile counts as on it (the host sees positions a moment late). */
  margin: 0.35,
};

export const ROUND_SECONDS = 100;
export const SYMBOLS = ['circle', 'triangle', 'square', 'diamond', 'star'];
export const COLOR_COUNT = 5;

// ---------------------------------------------------------------- the ramp

/** Seconds the colour is shown before the drop: shorter every wave and every round. */
export const showTime = (wave, round = 1) => Math.max(0.8, 3.0 - 0.35 * wave - 0.3 * (round - 1));

/** How many colours are on the floor: more later, so a colour is harder to find at a glance. */
export const colorsFor = (wave, round = 1) => Math.min(COLOR_COUNT, 3 + Math.floor(wave / 2) + (round - 1));

/** How many tiles are of the called colour: fewer later, so the safe place is further away. */
export const safeCount = (wave, round = 1) => Math.max(2, Math.round(16 - 2 * wave - 2 * (round - 1)));

// ---------------------------------------------------------------- the clock

const cycleOf = (wave, round) => showTime(wave, round) + WAVE.drop + WAVE.rest;

/**
 * Where the floor is `elapsed` seconds into a round: which wave, which phase of it ('idle' before the first wave, then 'show', 'drop'
 * and 'rest'), seconds into the phase (`t`) and left of it (`left`).
 */
export function floorAt(elapsed, round = 1) {
  if (elapsed < WAVE.grace) return { wave: 0, phase: 'idle', t: Math.max(0, elapsed), left: WAVE.grace - Math.max(0, elapsed) };
  let at = elapsed - WAVE.grace;
  let wave = 0;
  while (at >= cycleOf(wave, round)) {
    at -= cycleOf(wave, round);
    wave++;
  }
  const show = showTime(wave, round);
  if (at < show) return { wave, phase: 'show', t: at, left: show - at };
  if (at < show + WAVE.drop) return { wave, phase: 'drop', t: at - show, left: show + WAVE.drop - at };
  return { wave, phase: 'rest', t: at - show - WAVE.drop, left: cycleOf(wave, round) - at };
}

/**
 * The colour called in a wave and the colour of each tile (row by row), from a seeded random stream: the same on every page.
 * `safeCount` of the tiles are the called colour; the rest are shared out among the other colours.
 */
export function makeFloor(rng, wave, round = 1) {
  const colors = colorsFor(wave, round);
  const target = rng.below(colors);
  const total = FLOOR.cols * FLOOR.rows;
  const safe = Math.min(total - 1, safeCount(wave, round));
  const tiles = new Array(total).fill(target);
  const others = [];
  for (let i = 0; i < total - safe; i++) others.push((target + 1 + (i % (colors - 1))) % colors);
  const order = Array.from({ length: total }, (_, i) => i);
  rng.shuffle(order);
  order.slice(safe).forEach((tile, i) => void (tiles[tile] = others[i]));
  return { target, colors, tiles };
}

// ---------------------------------------------------------------- the floor in space

export const tileCenter = (col, row) => ({ x: -HALF.x + FLOOR.tile * (col + 0.5), y: -HALF.y + FLOOR.tile * (row + 0.5) });

/** The tile under a point, or null off the edge. */
export function tileAt(x, y) {
  const col = Math.floor((x + HALF.x) / FLOOR.tile);
  const row = Math.floor((y + HALF.y) / FLOOR.tile);
  return col < 0 || row < 0 || col >= FLOOR.cols || row >= FLOOR.rows ? null : { col, row, index: row * FLOOR.cols + col };
}

/** How far a point is from a tile's square (0 inside it). */
export function distanceToTile(x, y, col, row) {
  const c = tileCenter(col, row);
  const dx = Math.max(0, Math.abs(x - c.x) - FLOOR.tile / 2);
  const dy = Math.max(0, Math.abs(y - c.y) - FLOOR.tile / 2);
  return Math.hypot(dx, dy);
}

/** Is a runner at (x, y) standing on the called colour? Close enough to the edge of a safe tile counts. */
export function isSafe(x, y, tiles, target) {
  const here = tileAt(x, y);
  if (here && tiles[here.index] === target) return true;
  const col = Math.floor((x + HALF.x) / FLOOR.tile);
  const row = Math.floor((y + HALF.y) / FLOOR.tile);
  for (let c = col - 1; c <= col + 1; c++) {
    for (let r = row - 1; r <= row + 1; r++) {
      if (c < 0 || r < 0 || c >= FLOOR.cols || r >= FLOOR.rows) continue;
      if (tiles[r * FLOOR.cols + c] === target && distanceToTile(x, y, c, r) <= WAVE.margin) return true;
    }
  }
  return false;
}

/** The called-colour tile nearest to a point: `{ col, row, x, y, distance }`, or null if there is none. */
export function nearestSafe(x, y, tiles, target, skip = 0) {
  const found = [];
  tiles.forEach((color, index) => {
    if (color !== target) return;
    const col = index % FLOOR.cols;
    const row = Math.floor(index / FLOOR.cols);
    const c = tileCenter(col, row);
    found.push({ col, row, x: c.x, y: c.y, distance: Math.hypot(c.x - x, c.y - y) });
  });
  found.sort((a, b) => a.distance - b.distance);
  return found[Math.min(skip, found.length - 1)] ?? null;
}

// ---------------------------------------------------------------- winning

/**
 * Who falls on a drop: the runners not on the called colour. If that would be everybody still in, nobody falls (the wave is wasted and
 * the next is faster), so a round always ends with a winner or at the time limit.
 */
export function whoFalls(standing) {
  const falling = standing.filter((runner) => !runner.safe).map((runner) => runner.id);
  return falling.length >= standing.length ? [] : falling;
}

/** How well a runner did in a round (higher is better): anyone still in beats anyone out, and the later out the better. */
export const roundScore = ({ out, outAt }) => (out ? Math.max(0, outAt) : 10000);

export const roundIsOver = (alive, seats) => seats >= 2 && alive <= 1;
