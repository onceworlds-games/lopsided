import { describe, expect, it, vi } from 'vitest';
import { STONE, TABLE, makeStone, stiffnessFor, targetTilt } from '../rules.js';
import { STRATEGIES, STRATEGY_NAMES, worth } from '../strategy.js';
import { headToHead, seeded, tournament } from '../tools/balance.mjs';

// The bots' reading of the table, and the balance: no single way of playing wins whatever it meets.
vi.setConfig({ testTimeout: 120000 });

const view = (stones, extra = {}) => ({ seat: 0, stones, tilt: targetTilt(stones, null, stiffnessFor(4)), k: stiffnessFor(4), beat: 3, beats: 8, boulder: true, others: 3, ...extra });

describe('reading the table', () => {
  it('every strategy aims somewhere on the table', () => {
    const rng = seeded(4);
    const stones = [makeStone(1, 8, 0), makeStone(2, -3, 4), makeStone(3, 0, -9, true)];
    for (const name of STRATEGY_NAMES) {
      for (let i = 0; i < 20; i++) {
        const aim = STRATEGIES[name](view(stones), rng);
        expect(Math.hypot(aim.x, aim.y)).toBeLessThanOrEqual(TABLE.radius);
      }
    }
  });

  it('a smart player does not throw a stone onto the low rim of a table about to tip', () => {
    // A heavy pile on the east rim: the table leans east, close to shedding.
    const stones = Array.from({ length: 9 }, (_, i) => makeStone(1, 9, -3 + i * 0.75));
    const rng = seeded(7);
    for (let i = 0; i < 10; i++) {
      const aim = STRATEGIES.smart(view(stones), rng);
      expect(aim.x).toBeLessThan(5);
    }
    expect(worth(view(stones), { x: -9, y: 0 }, false)).toBeGreaterThan(worth(view(stones), { x: 9.2, y: 0 }, false));
  });

  it('a saboteur spends its boulder (and the points for keeping it) to tip the leader off the table', () => {
    // Seat 2 leads with a row on the north rim, balanced by seat 1's row on the south rim; a boulder in the north tips the leader's off.
    const row = (seat, y) => Array.from({ length: 5 }, (_, i) => makeStone(seat, -4 + i * 2, y));
    const stones = [...row(2, 8.6), ...row(1, -8.6), makeStone(2, 0.5, 0.5)];
    const rng = seeded(3);
    const aim = STRATEGIES.saboteur(view(stones, { beat: 6 }), rng);
    expect(aim.heavy).toBe(true);
    expect(aim.y).toBeGreaterThan(2);
    expect(STONE.boulderMass).toBe(3);
    // A smart player with nothing at stake there keeps it.
    expect(STRATEGIES.smart(view([makeStone(1, 2, 2), makeStone(2, -2, -2)], { beat: 2 }), rng).heavy).toBe(false);
  });
});

describe('balance', () => {
  it('no strategy dominates a four-player table: the best wins well under two thirds of its matches', () => {
    const { rows, fellShare } = tournament(STRATEGY_NAMES, 4, 150, 41);
    const rates = Object.values(rows).map((r) => r.winRate);
    expect(Math.max(...rates)).toBeLessThan(0.6);
    // Hugging the middle never loses a stone and almost never wins: it is the trap, not the answer.
    expect(rows.turtle.winRate).toBeLessThan(0.15);
    // The table really is dangerous: a good share of stones go over the edge, but most stay.
    expect(fellShare).toBeGreaterThan(0.2);
    expect(fellShare).toBeLessThan(0.45);
  });

  it('reading the table beats guessing, and the smart player and the saboteur are an even match', () => {
    expect(headToHead('smart', 'random', 4, 60, 5)).toBeGreaterThan(0.6);
    const even = headToHead('smart', 'saboteur', 4, 60, 6);
    expect(even).toBeGreaterThan(0.3);
    expect(even).toBeLessThan(0.7);
  });
});
