// The balance tournament: thousands of matches between fixed strategies (strategy.js), with the game's own rules and physics
// (rules.js), and no engine. Prints each strategy's win rate and points, at every table size.
//
//   node tools/balance.mjs [matches per table size, default 400] [seed]
//
// A strategy "dominates" if it wins far more than its share whatever it plays against. The numbers are recorded in DESIGN.md.

import { BEATS, beatLength, makeStone, scoreTable, stepTable, stiffnessFor } from '../rules.js';
import { STRATEGIES, STRATEGY_NAMES } from '../strategy.js';

/** A small seeded random stream with the two calls strategies use. */
export function seeded(seed) {
  let a = seed >>> 0 || 1;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { next, float: (min, max) => min + (max - min) * next(), chance: (p) => next() < p, int: (min, max) => min + Math.floor(next() * (max - min + 1)) };
}

const DT = 1 / 60;

function run(table, stones, seconds, stats) {
  for (let t = 0; t < seconds; t += DT) {
    const fell = stepTable(table, stones, DT);
    stats.fell += fell.length;
  }
}

/** One round: every seat plays its strategy for each beat; returns points by seat and what happened. */
export function playRound(strategies, rng, stats = { fell: 0, dropped: 0, tilts: [] }) {
  const table = { x: 0, y: 0, vx: 0, vy: 0, k: stiffnessFor(strategies.length) };
  const stones = [];
  const boulder = strategies.map(() => true);
  run(table, stones, BEATS.grace, stats);
  for (let beat = 0; beat < BEATS.perRound; beat++) {
    // Everyone aims looking at the same table (the one before this beat's drop).
    const aims = strategies.map((name, seat) =>
      STRATEGIES[name]({ seat, stones, tilt: { x: table.x, y: table.y }, k: table.k, beat, beats: BEATS.perRound, boulder: boulder[seat], others: strategies.length - 1 }, rng),
    );
    aims.forEach((aim, seat) => {
      const heavy = !!aim.heavy && boulder[seat];
      if (heavy) {
        boulder[seat] = false;
        stats.boulders = (stats.boulders ?? 0) + 1;
      }
      stones.push(makeStone(seat, aim.x, aim.y, heavy, beat));
      stats.dropped++;
    });
    run(table, stones, beat + 1 < BEATS.perRound ? beatLength(beat + 1) : BEATS.settle, stats);
    stats.tilts.push(Math.hypot(table.x, table.y));
  }
  return scoreTable(stones, strategies.map((_s, i) => i), boulder.flatMap((kept, seat) => (kept ? [seat] : [])));
}

/** A match of `rounds` rounds: total points by seat. */
export function playMatch(strategies, rng, rounds = 3, stats) {
  const total = strategies.map(() => 0);
  for (let r = 0; r < rounds; r++) {
    const score = playRound(strategies, rng, stats);
    for (const [seat, points] of Object.entries(score)) total[seat] += points;
  }
  return total;
}

/** Many matches at one table size with seats drawn at random from `pool`: win share and mean points by strategy. */
export function tournament(pool, seats, matches, seed) {
  const rng = seeded(seed);
  const rows = Object.fromEntries(pool.map((name) => [name, { seats: 0, wins: 0, points: 0 }]));
  const stats = { fell: 0, dropped: 0, tilts: [] };
  for (let m = 0; m < matches; m++) {
    const lineup = Array.from({ length: seats }, () => pool[Math.floor(rng.next() * pool.length)]);
    const total = playMatch(lineup, rng, 3, stats);
    const top = Math.max(...total);
    const winners = total.flatMap((p, i) => (p === top ? [i] : []));
    lineup.forEach((name, i) => {
      rows[name].seats++;
      rows[name].points += total[i];
      if (winners.includes(i)) rows[name].wins += 1 / winners.length;
    });
  }
  const out = {};
  for (const [name, row] of Object.entries(rows)) {
    // Win share relative to a fair share (1 / seats): 1.0 is exactly fair, 2.0 wins twice its share.
    out[name] = { seats: row.seats, winRate: row.seats ? row.wins / row.seats : 0, edge: row.seats ? (row.wins / row.seats) * seats : 0, points: row.seats ? row.points / row.seats : 0 };
  }
  return { rows: out, fellShare: stats.fell / Math.max(1, stats.dropped), boulderShare: (stats.boulders ?? 0) / Math.max(1, stats.dropped / BEATS.perRound) };
}

/** Head to head at a table of `seats`: half the seats play A, half B (in alternating seats). A's share of the wins. */
export function headToHead(a, b, seats, matches, seed) {
  const rng = seeded(seed);
  let wins = 0;
  for (let m = 0; m < matches; m++) {
    const lineup = Array.from({ length: seats }, (_x, i) => ((i + m) % 2 ? a : b));
    const total = playMatch(lineup, rng, 3, { fell: 0, dropped: 0, tilts: [] });
    const top = Math.max(...total);
    const winners = total.flatMap((p, i) => (p === top ? [i] : []));
    wins += winners.filter((i) => lineup[i] === a).length / winners.length;
  }
  return wins / matches;
}

const main = typeof process !== 'undefined' && process.argv[1]?.endsWith('balance.mjs');
if (main) {
  const matches = Number(process.argv[2] ?? 400);
  const seed = Number(process.argv[3] ?? 1);
  if (process.argv[4] === 'matrix') {
    const seats = Number(process.argv[5] ?? 4);
    console.log(`Head to head, ${seats} seats (half each), ${matches} matches: the row strategy's share of the wins`);
    console.log('          ' + STRATEGY_NAMES.map((n) => n.slice(0, 8).padStart(9)).join(''));
    for (const a of STRATEGY_NAMES) {
      const cells = STRATEGY_NAMES.map((b) => (a === b ? '    -    ' : (headToHead(a, b, seats, matches, seed) * 100).toFixed(0).padStart(8) + '%'));
      console.log(a.padEnd(10) + cells.join(''));
    }
    process.exit(0);
  }
  for (const seats of [2, 4, 8]) {
    const { rows, fellShare, boulderShare } = tournament(STRATEGY_NAMES, seats, matches, seed + seats);
    console.log(`\n${seats} seats, ${matches} matches (stones lost: ${(fellShare * 100).toFixed(0)}%, boulders dropped in ${(boulderShare * 100).toFixed(0)}% of seat-rounds)`);
    console.log('strategy   win%   edge  points/match');
    for (const [name, row] of Object.entries(rows).sort((a, b) => b[1].edge - a[1].edge)) {
      console.log(`${name.padEnd(9)} ${(row.winRate * 100).toFixed(1).padStart(5)}  ${row.edge.toFixed(2).padStart(5)}  ${row.points.toFixed(1).padStart(6)}`);
    }
  }
}
