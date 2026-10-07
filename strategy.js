// How a seat chooses where to drop, as plain functions: the game's bots use `smart` (with their own spite and slips), and the balance
// tool (tools/balance.mjs) pits every strategy here against the others. `rng` needs only `float(min, max)` and `chance(p)`.
//
// A "view" is what a player can see: { seat, stones, tilt, k (the table's stiffness), beat, beats, boulder (still in hand), others (how
// many other seats) }.

import { BEATS, STONE, TABLE, capTilt, lossRisk, pointsAt, targetTilt } from './rules.js';

const R = TABLE.radius;

const polar = (r, angle) => ({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });

/** The side of the table that is up right now (opposite the lean), or a random side when it is level. */
function uphill(view, rng) {
  const t = view.tilt;
  if (Math.hypot(t.x, t.y) < 0.01) return rng.float(0, Math.PI * 2);
  return Math.atan2(-t.y, -t.x);
}

/** The places worth considering: rings from the middle to the rim, all round, with a little jitter so no two bots think alike. */
function candidates(rng) {
  const out = [];
  const rings = [0.12, 0.3, 0.5, 0.64, 0.78, 0.88, 0.95];
  for (const k of rings) {
    const n = k < 0.2 ? 4 : 14;
    const turn = rng.float(0, Math.PI * 2);
    for (let i = 0; i < n; i++) out.push(polar(R * k + rng.float(-0.3, 0.3), turn + (i / n) * Math.PI * 2));
  }
  return out;
}

// The other seats' stones this beat are unknown: a smart player hedges against the lean moving a little either way.
const HEDGE = [
  [0, 0, 2],
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
];

/**
 * What a drop at `aim` is worth to `view.seat`: its own expected points after the lean it causes (hedged against the others' drops),
 * minus `spite` times the average opponent's (or the leader's, with `focus`).
 */
export function worth(view, aim, heavy, { spite = 0.35, caution = 1, leader = -1 } = {}) {
  const m = heavy ? STONE.boulderMass : STONE.mass;
  const lean = targetTilt(view.stones, { x: aim.x, y: aim.y, m }, view.k);
  // The more beats left, the more the lean will still move: hedge wider early in the round.
  const left = Math.max(0, (view.beats ?? BEATS.perRound) - 1 - (view.beat ?? 0));
  const spread = ((0.018 * TABLE.stiffness) / (view.k ?? TABLE.stiffness)) * Math.sqrt(Math.max(1, view.others ?? 3)) * (0.6 + 0.12 * left) * caution;
  let total = 0;
  let weights = 0;
  for (const [dx, dy, w] of HEDGE) {
    const tilt = capTilt(lean.x + dx * spread, lean.y + dy * spread);
    let mine = pointsAt(aim.x, aim.y) * (1 - lossRisk(tilt, aim.x, aim.y));
    let theirs = 0;
    let top = 0;
    const by = {};
    for (const s of view.stones) {
      if (s.gone) continue;
      const v = pointsAt(s.x, s.y) * (1 - lossRisk(tilt, s.x, s.y));
      if (s.seat === view.seat) mine += v;
      else {
        theirs += v;
        by[s.seat] = (by[s.seat] ?? 0) + v;
      }
    }
    if (leader >= 0) top = by[leader] ?? 0;
    const against = leader >= 0 ? top : theirs / Math.max(1, view.others ?? 1);
    total += w * (mine - spite * against);
    weights += w;
  }
  return total / weights;
}

/** The best drop by `worth`, with the boulder when it is worth `boulderGain` more than a stone (or on the last beat). */
function best(view, rng, options = {}) {
  const lastBeat = view.beat >= (view.beats ?? BEATS.perRound) - 1;
  let top = null;
  for (const aim of candidates(rng)) {
    const value = worth(view, aim, false, options);
    if (!top || value > top.value) top = { ...aim, heavy: false, value };
    if (view.boulder) {
      const heavy = worth(view, aim, true, options) - (lastBeat ? 0 : options.boulderGain ?? 1.2);
      if (heavy > top.value) top = { ...aim, heavy: true, value: heavy };
    }
  }
  return top;
}

/** Each strategy: (view, rng) => { x, y, heavy }. */
export const STRATEGIES = {
  /** Uniform over the table; the boulder whenever. */
  random(view, rng) {
    const at = polar(R * Math.sqrt(rng.float(0, 1)) * 0.97, rng.float(0, Math.PI * 2));
    return { ...at, heavy: view.boulder && rng.chance(0.15) };
  },
  /** Only the middle ring: 1 point a stone, almost never lost. The boulder in the middle too. */
  turtle(view, rng) {
    return { ...polar(rng.float(0, R * 0.36), rng.float(0, Math.PI * 2)), heavy: view.boulder && view.beat >= 6 };
  },
  /** Only the rim, anywhere round it: 3 points a stone if it stays. */
  greedy(view, rng) {
    return { ...polar(rng.float(R * 0.76, R * 0.96), rng.float(0, Math.PI * 2)), heavy: view.boulder && rng.chance(0.2) };
  },
  /** The rim, on whichever side is up right now (which levels the table). The boulder on the last beat, uphill. */
  climber(view, rng) {
    const angle = uphill(view, rng) + rng.float(-0.7, 0.7);
    return { ...polar(rng.float(R * 0.74, R * 0.94), angle), heavy: view.boulder && view.beat >= (view.beats ?? BEATS.perRound) - 1 };
  },
  /** Reads the table: the drop worth most to itself, minding the others a little. */
  smart(view, rng) {
    const { x, y, heavy } = best(view, rng, { spite: 0.35 });
    return { x, y, heavy };
  },
  /** Reads the table to hurt the leader: worth to itself minus the leading rival's (on the table now). */
  saboteur(view, rng) {
    const now = {};
    for (const s of view.stones) if (!s.gone && s.seat !== view.seat) now[s.seat] = (now[s.seat] ?? 0) + pointsAt(s.x, s.y);
    let leader = -1;
    for (const [seat, points] of Object.entries(now)) if (leader < 0 || points > now[leader]) leader = Number(seat);
    const { x, y, heavy } = best(view, rng, { spite: 0.9, leader, boulderGain: 0.6 });
    return { x, y, heavy };
  },
};

export const STRATEGY_NAMES = Object.keys(STRATEGIES);
