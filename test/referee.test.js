import { describe, expect, it, vi } from 'vitest';
import { Transform } from '@onceworlds/engine';
import { Look, Status } from '../components.js';
import { RUNNER, WAVE, nearestSafe, showTime, tileCenter } from '../rules.js';
import { duel, floorOf, inputOf, place, runnerOn } from './helpers.js';

// Whole matches take a moment of real time on a busy machine (the game's own time is virtual).
vi.setConfig({ testTimeout: 60000 });

// The signature rule, end to end across two pages joined by a slow fake network: a colour is called, the other tiles drop, and the host
// puts out whoever is not standing on it. The floor itself is never sent: both pages work it out from the round's clock.
// Ann is player 1 (the host), bo is player 2; nobody else is in the match.

const statusOf = (game, id) => runnerOn(game, id).get(Status);

/** A tile of the wrong colour, far from the called ones (so a runner put there is clearly out). */
function farFromSafe(floor) {
  let best = null;
  floor.tiles.forEach((color, index) => {
    if (color === floor.target) return;
    const c = tileCenter(index % 8, Math.floor(index / 8));
    const d = nearestSafe(c.x, c.y, floor.tiles, floor.target).distance;
    if (!best || d > best.d) best = { d, ...c };
  });
  return best;
}

describe('the drop', () => {
  it('puts out whoever is not on the called colour, tells every page, and leaves the other standing to win', async () => {
    const seen = {};
    const result = await duel(
      [
        [1.6, (r) => {
          const floor = floorOf(r.games[0]);
          const safe = nearestSafe(0, 0, floor.tiles, floor.target);
          const bad = farFromSafe(floor);
          Object.assign(seen, { target: floor.target, phase: floor.phase, wave: floor.wave });
          place(r.games[0], 'p1', safe.x, safe.y);
          place(r.games[1], 'p2', bad.x, bad.y);
        }],
        [showTime(0) + WAVE.grace + WAVE.judgeAfter + 0.7, (r) => {
          const [ann, bo] = r.games;
          Object.assign(seen, {
            boOutOnHost: statusOf(ann, 'p2').out,
            boOutOnBo: statusOf(bo, 'p2').out,
            annOut: statusOf(ann, 'p1').out,
            outAt: statusOf(ann, 'p2').outAt,
            ghostLook: runnerOn(bo, 'p2').get(Look).out,
          });
        }],
      ],
      (r) => r.matches > 0,
    );
    expect(result.errors).toEqual([]);
    expect(seen).toMatchObject({ phase: 'show', wave: 0, boOutOnHost: true, boOutOnBo: true, annOut: false, ghostLook: true });
    expect(seen.outAt).toBeGreaterThan(WAVE.grace);
    // The round ends with one left standing, and the match (one round) ends with that player first.
    expect(result.ranking).toEqual(['p1', 'p2']);
  });

  it('puts out nobody when everybody is on the wrong colour: the wave is wasted and the next is faster', async () => {
    const seen = {};
    const result = await duel(
      [
        [1.6, (r) => {
          const floor = floorOf(r.games[0]);
          const bad = farFromSafe(floor);
          place(r.games[0], 'p1', bad.x, bad.y);
          place(r.games[1], 'p2', bad.x + 0.2, bad.y);
        }],
        [showTime(0) + WAVE.grace + WAVE.judgeAfter + 0.7, (r) => {
          seen.out = r.games.map((g) => [statusOf(g, 'p1').out, statusOf(g, 'p2').out]);
          seen.wave = floorOf(r.games[0]).wave;
        }],
      ],
      (r) => r.seconds > 12,
    );
    expect(result.errors).toEqual([]);
    expect(seen.out).toEqual([[false, false], [false, false]]);
    expect(seen.wave).toBe(0);
  });

  it('lets a runner who is out float on: it keeps moving and the others see it', async () => {
    const xs = {};
    // A third player stays on the called colour, so the round goes on after bo falls.
    const result = await duel(
      [
        [1.6, (r) => {
          const floor = floorOf(r.games[0]);
          const safe = nearestSafe(0, 0, floor.tiles, floor.target);
          place(r.games[0], 'p1', safe.x, safe.y);
          place(r.games[2], 'p3', safe.x, safe.y);
          place(r.games[1], 'p2', -3, farFromSafe(floor).y);
        }],
        [5.6, (r) => {
          xs.before = [runnerOn(r.games[1], 'p2').get(Transform).position.x, runnerOn(r.games[0], 'p2').get(Transform).position.x];
          inputOf(r.games[1]).setAxis('move', 1, 0);
        }],
        [6.4, (r) => {
          xs.after = [runnerOn(r.games[1], 'p2').get(Transform).position.x, runnerOn(r.games[0], 'p2').get(Transform).position.x];
          xs.out = statusOf(r.games[0], 'p2').out;
          xs.phase = floorOf(r.games[0]).live;
        }],
      ],
      (r) => r.seconds > 11,
      { humans: 3 },
    );
    expect(result.errors).toEqual([]);
    expect(xs.out).toBe(true);
    // The ghost ran east on its own page, and the host's copy of it followed.
    expect(xs.after[0]).toBeGreaterThan(xs.before[0] + 2);
    expect(xs.after[1]).toBeGreaterThan(xs.before[1] + 1.5);
  });
});

describe('the floor', () => {
  it('is the same on every page without being sent, and the bad tiles are gone during a drop', async () => {
    const seen = {};
    const result = await duel(
      [
        [2, (r) => { seen.show = r.games.map((g) => `${floorOf(g).key}|${floorOf(g).target}|${floorOf(g).tiles.join('')}`); }],
        [showTime(0) + WAVE.grace + 0.8, (r) => {
          const tiles = [];
          r.games[1].world.query([Transform]).each((_e, tr) => void (tr.scale.x === 0 && tiles.push(1)));
          seen.gone = tiles.length;
          seen.safe = floorOf(r.games[1]).tiles.filter((c) => c === floorOf(r.games[1]).target).length;
          seen.phase = floorOf(r.games[1]).phase;
        }],
      ],
      (r) => r.seconds > 12,
    );
    expect(result.errors).toEqual([]);
    expect(new Set(seen.show).size).toBe(1);
    expect(seen.phase).toBe('drop');
    // Every tile but the safe ones has shrunk to nothing (the symbols on them with it).
    expect(seen.gone).toBeGreaterThanOrEqual(48 - seen.safe);
  });
});

describe('the dash', () => {
  it('covers more ground than running, and then has to wait', async () => {
    const seen = {};
    const result = await duel(
      [
        [0.2, (r) => place(r.games[0], 'p1', -6, 0)],
        [0.6, (r) => { const input = inputOf(r.games[0]); seen.x0 = runnerOn(r.games[0], 'p1').get(Transform).position.x; input.setAxis('move', 1, 0); input.press('dash'); }],
        [0.65, (r) => inputOf(r.games[0]).release('dash')],
        [1.1, (r) => { seen.x1 = runnerOn(r.games[0], 'p1').get(Transform).position.x; }],
      ],
      (r) => r.seconds > 8,
    );
    expect(result.errors).toEqual([]);
    // Half a second of running at full speed is 2.8 metres at most; a dash adds the rest.
    expect(seen.x1 - seen.x0).toBeGreaterThan(RUNNER.speed * 0.5 + 0.6);
  });
});
