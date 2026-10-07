import { describe, expect, it, vi } from 'vitest';
import { Transform, createGame } from '@onceworlds/engine';
import { Intent, flowOf, servicesOf } from '@onceworlds/engine/modules';
import { simulate } from '@onceworlds/engine/test';
import { Demo, Motion, Runner, Tile } from '../components.js';
import { gameConfig } from '../game.config.js';
import { WAVE, showTime } from '../rules.js';
import { hudTree } from '../ui.js';
import { floorOf, inputOf, phaseOf, runnerOn, runnersOn } from './helpers.js';
import { fakeCanvas, strictBackend } from './fakeCanvas.js';

// Whole matches take a moment of real time on a busy machine (the game's own time is virtual).
vi.setConfig({ testTimeout: 60000 });

// What a player sees before and around the round: the title with the game alive behind it, the lobby you can run about in, the HUD on a
// phone, the store pictures, and the whole game drawn.

describe('store pictures', () => {
  for (const [name, search, width, height] of [
    ['cover', '?poster=cover', 1920, 1080],
    ['icon', '?poster=icon', 512, 512],
    ['action', '?poster=action', 1920, 1080],
  ]) {
    it(`builds the ${name} picture`, async () => {
      const body = { dataset: {} };
      const game = createGame({ ...gameConfig({ poster: { search, body } }), headless: true });
      game.start();
      const poster = servicesOf(game).poster;
      await poster.done;
      expect(body.dataset.ready).toBe('1');
      expect(poster.size).toEqual({ width, height });
      expect(game.errors).toEqual([]);
    });
  }

  it('shows the floor a moment into a drop on the cover: the called colour stands, every other one is sinking', async () => {
    const body = { dataset: {} };
    const game = createGame({ ...gameConfig({ poster: { search: '?poster=cover', body } }), headless: true });
    game.start();
    await servicesOf(game).poster.done;
    let sinking = 0;
    let standing = 0;
    game.world.query([Tile, Transform]).each((_e, _tile, tr) => void (tr.scale.x < 0.99 ? sinking++ : standing++));
    expect(sinking).toBeGreaterThan(20);
    expect(standing).toBeGreaterThan(2);
  });
});

describe('the HUD', () => {
  it('fits a phone held upright, in every phase', async () => {
    const game = createGame({ ...gameConfig(), headless: true });
    game.start();
    const { ui } = servicesOf(game);
    for (const phase of ['idle', 'show', 'drop', 'rest']) {
      const { rect } = ui.preview(hudTree({ phase, target: 3, fraction: 0.6, alive: 8 }), { width: 390, height: 844, touch: true, anchor: 'top' });
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.w).toBeLessThanOrEqual(390);
      expect(rect.y + rect.h).toBeLessThan(160);
    }
  });
});

describe('before the match', () => {
  it('runs the floor behind the title as a demo, then a lobby where you can run about', async () => {
    const seen = { phases: new Set(), gone: 0 };
    const run = await simulate(gameConfig({ quick: true }), {
      humans: 1,
      seed: 2,
      seconds: 14,
      autoplay: false,
      onFrame: (r) => {
        const game = r.game;
        const floor = floorOf(game);
        if (r.frames < 600) seen.phases.add(floor.phase);
        if (r.frames === 10) {
          Object.assign(seen, { title: phaseOf(game), runnersBeforePlay: game.world.query([Runner]).count(), demo: game.world.query([Demo]).count(), live: floor.live });
          flowOf(game).play();
        }
        if (r.frames === 60) {
          const me = runnerOn(game, 'p1');
          Object.assign(seen, { lobby: phaseOf(game), mine: runnersOn(game).length, equipped: me.has(Motion) && me.has(Intent), x0: runnersOn(game)[0].x });
          inputOf(game).setAxis('move', 1, 0);
        }
        if (r.frames === 120) seen.x1 = runnerOn(game, 'p1').get(Transform).position.x;
        // In the demo the tiles that are not the called colour fall, and nobody is put out.
        if (floor.phase === 'drop' && floor.t > WAVE.fall + 0.1 && r.frames > 70) {
          let gone = 0;
          game.world.query([Tile, Transform]).each((_e, _t, tr) => void (tr.scale.x === 0 && gone++));
          seen.gone = Math.max(seen.gone, gone);
        }
      },
    });
    expect(run.errors).toEqual([]);
    expect(seen).toMatchObject({ title: 'title', runnersBeforePlay: 0, demo: 4, live: false, lobby: 'lobby', mine: 1, equipped: true });
    expect([...seen.phases]).toEqual(expect.arrayContaining(['idle', 'show', 'drop']));
    expect(seen.gone).toBeGreaterThan(10);
    expect(seen.x1).toBeGreaterThan(seen.x0 + 3);
    expect(showTime(0)).toBeGreaterThan(1);
  });
});

describe('drawing', () => {
  it('draws the title, the lobby, a whole round and the podium through a strict canvas with no errors', async () => {
    const canvas = fakeCanvas(844, 390);
    const phases = new Set();
    const run = await simulate(() => gameConfig({ quick: true, rounds: 1, fill: 4, render: { backend: strictBackend(canvas), fit: 'none' } }), {
      humans: 1,
      bots: 3,
      seed: 6,
      seconds: 200,
      onFrame: (r) => {
        phases.add(phaseOf(r.game));
        const me = runnerOn(r.game, 'p1');
        // Stand still: the humans in this run do nothing, so the round is decided by the bots.
        if (me && phaseOf(r.game) === 'playing') inputOf(r.game).setAxis('move', 0, 0);
      },
      until: (r) => r.matches > 0,
    });
    expect(run.errors).toEqual([]);
    expect([...phases]).toEqual(expect.arrayContaining(['title', 'lobby', 'countdown', 'banner', 'playing', 'results']));
    canvas.assertBalanced();
    const text = canvas.args('fillText').map((a) => a[0]);
    expect(text.length).toBeGreaterThan(20);
  });
});
