import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { controls } from '../actions.js';
import {
  BEATS,
  STONE,
  TABLE,
  beatLength,
  clockAt,
  collide,
  danger,
  dropTime,
  makeStone,
  pointsAt,
  roundLength,
  scoreTable,
  settled,
  stepTable,
  stiffnessFor,
  targetTilt,
  tipperOf,
} from '../rules.js';

// The rules on their own: the clock, the rings, the lean, the physics. No engine, no network.

const R = TABLE.radius;
const level = (seats = 4) => ({ x: 0, y: 0, vx: 0, vy: 0, k: stiffnessFor(seats) });
const run = (table, stones, seconds) => {
  const fell = [];
  for (let t = 0; t < seconds; t += 1 / 60) fell.push(...stepTable(table, stones, 1 / 60));
  return fell;
};

describe('the clock', () => {
  it('has a grace, eight beats that speed up, a settle, then the round is done', () => {
    expect(clockAt(0).phase).toBe('idle');
    expect(clockAt(BEATS.grace + 0.01)).toMatchObject({ phase: 'aim', beat: 0 });
    for (let i = 1; i < BEATS.perRound; i++) {
      expect(beatLength(i)).toBeLessThan(beatLength(i - 1));
      expect(clockAt(dropTime(i - 1) + 0.01)).toMatchObject({ phase: 'aim', beat: i });
    }
    expect(clockAt(dropTime(BEATS.perRound - 1) + 0.01).phase).toBe('settle');
    expect(clockAt(roundLength() + 0.01).phase).toBe('done');
    expect(beatLength(BEATS.perRound - 1)).toBeGreaterThanOrEqual(2.5);
    // A round is short enough for "one more".
    expect(roundLength()).toBeGreaterThan(25);
    expect(roundLength()).toBeLessThan(40);
  });
});

describe('scoring', () => {
  it('pays 1 in the middle, 2 on the inner ring, 3 on the rim and nothing off the table', () => {
    expect(pointsAt(0, 0)).toBe(1);
    expect(pointsAt(R * 0.55, 0)).toBe(2);
    expect(pointsAt(0, -R * 0.9)).toBe(3);
    expect(pointsAt(R * 1.01, 0)).toBe(0);
    const stones = [makeStone(0, 0, 0), makeStone(0, R * 0.9, 0), makeStone(1, 0, R * 0.5), { ...makeStone(1, R * 0.9, 0), gone: true }];
    expect(scoreTable(stones, [0, 1, 2])).toEqual({ 0: 4, 1: 2, 2: 0 });
  });
});

describe('the lean', () => {
  it('leans toward the weight: a boulder weighs three stones, and the lean is capped', () => {
    const one = targetTilt([makeStone(0, 9, 0)]);
    const boulder = targetTilt([makeStone(0, 9, 0, true)]);
    expect(one.x).toBeGreaterThan(0);
    expect(boulder.x).toBeCloseTo(one.x * STONE.boulderMass);
    const pile = targetTilt(Array.from({ length: 60 }, () => makeStone(0, 0, -9.5)));
    expect(Math.hypot(pile.x, pile.y)).toBeCloseTo(TABLE.maxTilt);
    expect(pile.y).toBeLessThan(0);
  });

  it('is stiffer for more players, so eight players rock it about as much as four', () => {
    expect(stiffnessFor(8)).toBeGreaterThan(stiffnessFor(4));
    expect(stiffnessFor(2)).toBeLessThan(stiffnessFor(4));
    expect(stiffnessFor(4)).toBe(TABLE.stiffness);
  });
});

describe('the physics', () => {
  it('holds a balanced table still: nothing slides, nothing falls', () => {
    const table = level();
    const stones = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      stones.push(makeStone(i % 4, Math.cos(a) * 9, Math.sin(a) * 9), makeStone(i % 4, Math.cos(a) * 5, Math.sin(a) * 5));
    }
    expect(run(table, stones, 6)).toEqual([]);
    expect(stones.every((s) => !s.sliding)).toBe(true);
    expect(danger(table)).toBeLessThan(0.2);
  });

  it('a heavy side tips the table: its rim stones slide off, the high side keeps its stones, and the slide stops itself', () => {
    const table = level();
    const low = [];
    for (let i = 0; i < 8; i++) low.push(makeStone(1, Math.cos(-0.6 + i * 0.17) * 9.2, Math.sin(-0.6 + i * 0.17) * 9.2));
    const high = [makeStone(2, -8.5, 1), makeStone(2, -8.5, -1.5)];
    const middle = [makeStone(3, 0.5, 0.5)];
    const stones = [...low, ...high, ...middle];
    const fell = run(table, stones, 8);
    expect(fell.length).toBeGreaterThanOrEqual(3);
    expect(fell.every((s) => s.seat === 1)).toBe(true);
    expect(high.every((s) => !s.gone)).toBe(true);
    expect(middle[0].gone).toBe(false);
    // Once the heavy stones are gone the table levels and everything is still.
    expect(settled(table, stones)).toBe(true);
    expect(danger(table)).toBeLessThan(1);
  });

  it('a boulder on the far rim saves a pile that would have slid', () => {
    const pile = () => Array.from({ length: 7 }, (_, i) => makeStone(1, 9, -2 + i * 0.7));
    const without = pile();
    const lost = run(level(), without, 6).length;
    const saved = pile();
    const lostWithBoulder = run(level(), [...saved, makeStone(0, -9.2, 0, true)], 6).filter((s) => s.seat === 1).length;
    expect(lost).toBeGreaterThan(lostWithBoulder);
  });

  it('never leaves two stones overlapping, even dropped on the same spot', () => {
    const stones = [makeStone(0, 3, 3), makeStone(1, 3, 3), makeStone(2, 3.1, 3), makeStone(3, 3, 3, true)];
    for (let i = 0; i < 10; i++) collide(stones);
    for (let i = 0; i < stones.length; i++) {
      for (let j = i + 1; j < stones.length; j++) {
        const d = Math.hypot(stones[i].x - stones[j].x, stones[i].y - stones[j].y);
        expect(d).toBeGreaterThan((stones[i].r + stones[j].r) * 0.95);
      }
    }
  });

  it('is the same every time for the same drops (a new host carries on exactly)', () => {
    const play = () => {
      const table = level(6);
      const stones = [];
      for (let i = 0; i < 30; i++) {
        stones.push(makeStone(i % 6, Math.cos(i * 2.1) * (3 + (i % 7)), Math.sin(i * 2.1) * (3 + (i % 7)), i % 11 === 0));
        run(table, stones, 0.5);
      }
      return JSON.stringify(stones.map((s) => [s.x.toFixed(6), s.y.toFixed(6), s.gone]));
    };
    expect(play()).toBe(play());
  });
});

describe('who tipped it', () => {
  it('credits the drop that pushed hardest toward the lean, and nobody when no drop leaned that way', () => {
    const lean = { x: 0.1, y: 0 };
    expect(tipperOf([makeStone(0, -9, 0), makeStone(1, 6, 0), makeStone(2, 4, 0, true)], lean)).toBe(2);
    expect(tipperOf([makeStone(0, -9, 0)], lean)).toBe(-1);
  });
});

describe('the listing', () => {
  it('names a control for each action in onceworlds.json', () => {
    const listing = JSON.parse(readFileSync(new URL('../onceworlds.json', import.meta.url), 'utf8'));
    const actions = listing.controls.map((c) => c.action);
    for (const control of controls) expect(actions).toContain(control.action);
  });
});
