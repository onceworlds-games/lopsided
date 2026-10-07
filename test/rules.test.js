import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Rng } from '@onceworlds/engine';
import { actions, controls } from '../actions.js';
import { symbolPoints } from '../look.js';
import { startPoint } from '../scenes.js';
import {
  COLOR_COUNT,
  FLOOR,
  HALF,
  ROUND_SECONDS,
  WAVE,
  colorsFor,
  distanceToTile,
  floorAt,
  isSafe,
  makeFloor,
  nearestSafe,
  roundIsOver,
  roundScore,
  safeCount,
  showTime,
  tileAt,
  tileCenter,
  whoFalls,
} from '../rules.js';

// The rules are plain functions, so they are tested without a game: this is where a change to a number shows what it does.

describe('the clock', () => {
  it('shows the floor first, then goes wave after wave through show, drop and rest', () => {
    expect(floorAt(0).phase).toBe('idle');
    expect(floorAt(WAVE.grace - 0.01).phase).toBe('idle');
    const first = floorAt(WAVE.grace + 0.1);
    expect(first).toMatchObject({ wave: 0, phase: 'show' });
    expect(first.left).toBeCloseTo(showTime(0) - 0.1);
    const drop = floorAt(WAVE.grace + showTime(0) + 0.2);
    expect(drop).toMatchObject({ wave: 0, phase: 'drop' });
    expect(drop.t).toBeCloseTo(0.2);
    expect(floorAt(WAVE.grace + showTime(0) + WAVE.drop + 0.2)).toMatchObject({ wave: 0, phase: 'rest' });
    expect(floorAt(WAVE.grace + showTime(0) + WAVE.drop + WAVE.rest + 0.05)).toMatchObject({ wave: 1, phase: 'show' });
  });

  it('never skips or repeats a moment: the phases follow each other all the way through a round', () => {
    const order = { idle: 0, show: 1, drop: 2, rest: 3 };
    let last = floorAt(0);
    for (let t = 0.05; t <= ROUND_SECONDS; t += 0.05) {
      const now = floorAt(t);
      if (now.wave === last.wave) expect(order[now.phase]).toBeGreaterThanOrEqual(order[last.phase]);
      else expect(now.wave).toBe(last.wave + 1);
      expect(now.left).toBeGreaterThan(0);
      last = now;
    }
  });
});

describe('the ramp', () => {
  it('gets harder every wave and every round: less time, more colours, fewer safe tiles', () => {
    for (let wave = 1; wave < 12; wave++) {
      expect(showTime(wave)).toBeLessThanOrEqual(showTime(wave - 1));
      expect(colorsFor(wave)).toBeGreaterThanOrEqual(colorsFor(wave - 1));
      expect(safeCount(wave)).toBeLessThanOrEqual(safeCount(wave - 1));
    }
    expect(showTime(2, 3)).toBeLessThan(showTime(2, 1));
    expect(safeCount(2, 3)).toBeLessThan(safeCount(2, 1));
  });

  it('keeps a floor you can read: at least a second to run, at least two safe tiles, never more colours than exist', () => {
    for (let round = 1; round <= 7; round++) {
      for (let wave = 0; wave < 40; wave++) {
        expect(showTime(wave, round)).toBeGreaterThanOrEqual(0.8);
        expect(safeCount(wave, round)).toBeGreaterThanOrEqual(2);
        expect(colorsFor(wave, round)).toBeLessThanOrEqual(COLOR_COUNT);
      }
    }
    expect(showTime(0)).toBeGreaterThanOrEqual(2.5);
  });
});

describe('a wave\'s floor', () => {
  it('is the same on every page for the same seed, and different for another wave', () => {
    const a = makeFloor(new Rng(7).fork('w3'), 3);
    const b = makeFloor(new Rng(7).fork('w3'), 3);
    const c = makeFloor(new Rng(7).fork('w4'), 3);
    expect(a).toEqual(b);
    expect(a.tiles).not.toEqual(c.tiles);
  });

  it('has exactly the number of safe tiles it should, and only colours that are in play', () => {
    for (let wave = 0; wave < 10; wave++) {
      const floor = makeFloor(new Rng(wave + 1), wave);
      expect(floor.tiles).toHaveLength(FLOOR.cols * FLOOR.rows);
      expect(floor.tiles.filter((color) => color === floor.target)).toHaveLength(safeCount(wave));
      expect(Math.max(...floor.tiles)).toBeLessThan(floor.colors);
      expect(floor.target).toBeLessThan(floor.colors);
    }
  });
});

describe('the floor in space', () => {
  it('finds the tile under a point, and none off the edge', () => {
    expect(tileAt(-HALF.x + 0.1, -HALF.y + 0.1)).toMatchObject({ col: 0, row: 0, index: 0 });
    expect(tileAt(HALF.x - 0.1, HALF.y - 0.1)).toMatchObject({ col: FLOOR.cols - 1, row: FLOOR.rows - 1 });
    expect(tileAt(HALF.x + 0.1, 0)).toBeNull();
    const c = tileCenter(3, 2);
    expect(tileAt(c.x, c.y)).toMatchObject({ col: 3, row: 2 });
    expect(distanceToTile(c.x, c.y, 3, 2)).toBe(0);
    expect(distanceToTile(c.x + FLOOR.tile / 2 + 0.5, c.y, 3, 2)).toBeCloseTo(0.5);
  });

  it('counts a runner on the edge of a safe tile as safe, but not one that is clearly off it', () => {
    const tiles = new Array(FLOOR.cols * FLOOR.rows).fill(1);
    tiles[tileAt(0.5, 0.5).index] = 0;
    const edge = tileCenter(tileAt(0.5, 0.5).col, tileAt(0.5, 0.5).row);
    expect(isSafe(edge.x, edge.y, tiles, 0)).toBe(true);
    // Just over the edge, inside the margin: still safe. Further: not.
    expect(isSafe(edge.x + FLOOR.tile / 2 + WAVE.margin - 0.05, edge.y, tiles, 0)).toBe(true);
    expect(isSafe(edge.x + FLOOR.tile / 2 + WAVE.margin + 0.2, edge.y, tiles, 0)).toBe(false);
    expect(isSafe(-HALF.x + 0.5, -HALF.y + 0.5, tiles, 0)).toBe(false);
  });

  it('finds the nearest tile of a colour, and the next nearest for a bot that slips', () => {
    const tiles = new Array(FLOOR.cols * FLOOR.rows).fill(1);
    tiles[0] = 0;
    tiles[FLOOR.cols * FLOOR.rows - 1] = 0;
    const near = nearestSafe(-HALF.x + 1, -HALF.y + 1, tiles, 0);
    expect(near).toMatchObject({ col: 0, row: 0 });
    expect(nearestSafe(-HALF.x + 1, -HALF.y + 1, tiles, 0, 1)).toMatchObject({ col: FLOOR.cols - 1, row: FLOOR.rows - 1 });
    expect(nearestSafe(0, 0, tiles, 4)).toBeNull();
  });
});

describe('who falls', () => {
  it('is everyone not on the called colour', () => {
    expect(whoFalls([{ id: 'a', safe: true }, { id: 'b', safe: false }, { id: 'c', safe: false }])).toEqual(['b', 'c']);
    expect(whoFalls([{ id: 'a', safe: true }])).toEqual([]);
  });

  it('is nobody when that would be everybody, so a round always has a winner or a time limit', () => {
    expect(whoFalls([{ id: 'a', safe: false }, { id: 'b', safe: false }])).toEqual([]);
  });

  it('ranks those still in above those who fell, and the later the fall the better', () => {
    expect(roundScore({ out: false, outAt: 0 })).toBeGreaterThan(roundScore({ out: true, outAt: 50 }));
    expect(roundScore({ out: true, outAt: 30 })).toBeGreaterThan(roundScore({ out: true, outAt: 12 }));
    expect(roundIsOver(1, 4)).toBe(true);
    expect(roundIsOver(2, 4)).toBe(false);
    expect(roundIsOver(1, 1)).toBe(false);
  });
});

describe('look and map', () => {
  it('gives each colour a shape of its own, so the game is playable without telling colours apart', () => {
    const outlines = Array.from({ length: COLOR_COUNT }, (_, kind) => JSON.stringify(symbolPoints(kind, 1).map(([x, y]) => [+x.toFixed(2), +y.toFixed(2)])));
    expect(new Set(outlines).size).toBe(COLOR_COUNT);
  });

  it('starts every seat on the floor, whatever the number of seats', () => {
    for (let count = 2; count <= 8; count++) {
      for (let i = 0; i < count; i++) {
        const at = startPoint(i, count);
        expect(tileAt(at.x, at.y)).not.toBeNull();
      }
    }
  });
});

describe('controls', () => {
  it('are listed in onceworlds.json exactly as the action map says', () => {
    const file = JSON.parse(readFileSync(new URL('../onceworlds.json', import.meta.url), 'utf8'));
    expect(file.controls).toEqual(controls);
    expect(Object.keys(actions)).toEqual(['move', 'dash']);
    expect(file.engine).toBe('1');
  });
});
