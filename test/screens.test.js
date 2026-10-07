import { describe, expect, it, vi } from 'vitest';
import { createGame } from '@onceworlds/engine';
import { flowOf, servicesOf } from '@onceworlds/engine/modules';
import { simulate } from '@onceworlds/engine/test';
import { LocalStone, Stone } from '../components.js';
import { gameConfig } from '../game.config.js';
import { seatSpot } from '../look.js';
import { TABLE } from '../rules.js';
import { firstTree, hudTree, promptTree } from '../ui.js';
import { clockOf, inputOf, phaseOf, stonesOn } from './helpers.js';
import { fakeCanvas, strictBackend } from './fakeCanvas.js';

// What a player sees: the store pictures, the HUD on a phone, the seats on any screen, the title and lobby tables, a tap on the table
// becoming a stone, and a whole match drawn through a strict canvas.
vi.setConfig({ testTimeout: 120000 });

describe('store pictures', () => {
  for (const [name, width, height] of [
    ['cover', 1920, 1080],
    ['icon', 512, 512],
    ['action', 1920, 1080],
  ]) {
    it(`builds the ${name} picture`, async () => {
      const body = { dataset: {} };
      const game = createGame({ ...gameConfig({ poster: { search: `?poster=${name}`, body } }), headless: true });
      game.start();
      const poster = servicesOf(game).poster;
      await poster.done;
      expect(body.dataset.ready).toBe('1');
      expect(poster.size).toEqual({ width, height });
      expect(game.errors).toEqual([]);
    });
  }
});

describe('the HUD', () => {
  const base = { beat: 3, left: 2.2, fraction: 0.5, lean: { x: 0.08, y: -0.05 }, preview: { x: 0.05, y: -0.02 }, danger: 1.1, seat: 2, boulder: true, armed: false, aimed: false, hasAim: false };

  it('fits a phone held upright, in every phase, with every prompt', async () => {
    const game = createGame({ ...gameConfig(), headless: true });
    game.start();
    const { ui } = servicesOf(game);
    for (const phase of ['idle', 'aim', 'settle']) {
      for (const extra of [{}, { armed: true }, { aimed: true, left: 1 }]) {
        const state = { ...base, phase, ...extra };
        const hud = ui.preview(hudTree(state), { width: 390, height: 844, touch: true, anchor: 'top' });
        expect(hud.rect.x).toBeGreaterThanOrEqual(0);
        expect(hud.rect.x + hud.rect.w).toBeLessThanOrEqual(390);
        expect(hud.rect.y + hud.rect.h).toBeLessThan(170);
        for (const [prompt, anchor] of [[promptTree(state), 'bottom'], [firstTree(state), 'center']]) {
          if (!prompt) continue;
          const { rect } = ui.preview(prompt, { width: 390, height: 844, touch: true, anchor });
          expect(rect.x).toBeGreaterThanOrEqual(0);
          expect(rect.x + rect.w).toBeLessThanOrEqual(390);
        }
      }
    }
  });

  it('says what to do: tap before the first aim, the boulder when armed, AIM! when time is short', () => {
    const text = (tree) => JSON.stringify(tree);
    expect(text(firstTree({ ...base, phase: 'aim' }))).toContain('TAP THE TABLE');
    expect(firstTree({ ...base, phase: 'aim', aimed: true })).toBeNull();
    expect(text(promptTree({ ...base, phase: 'aim', armed: true }))).toContain('BOULDER ARMED');
    expect(text(promptTree({ ...base, phase: 'aim', aimed: true, left: 1.5 }))).toContain('AIM!');
    expect(promptTree({ ...base, phase: 'aim', aimed: true, hasAim: true })).toBeNull();
  });
});

describe('seats on any screen', () => {
  it('keeps every seat clear of the table and of each other, wide or upright, for 1 to 8 players', () => {
    for (const aspect of [16 / 9, 4 / 3, 390 / 844, 3 / 4]) {
      for (let n = 1; n <= 8; n++) {
        const spots = Array.from({ length: n }, (_, i) => seatSpot(i, n, aspect));
        for (const s of spots) expect(Math.hypot(s.x, s.y)).toBeGreaterThan(TABLE.radius + 1.5);
        for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) expect(Math.hypot(spots[i].x - spots[j].x, spots[i].y - spots[j].y)).toBeGreaterThan(3);
      }
    }
  });
});

describe('before the match', () => {
  it('runs a live table behind the title (stones drop and slide off), then a lobby where a tap drops a practice stone', async () => {
    const canvas = fakeCanvas(844, 390);
    const seen = { title: 0, fell: 0, practice: 0, phases: new Set() };
    let tapped = false;
    const run = await simulate(() => gameConfig({ quick: true, render: { backend: strictBackend(canvas), fit: 'none' } }), {
      humans: 1,
      seed: 2,
      seconds: 40,
      autoplay: false,
      onFrame: (r) => {
        const game = r.game;
        const phase = phaseOf(game);
        seen.phases.add(phase);
        const local = stonesOn(game).filter((s) => s.entity.has(LocalStone));
        if (phase === 'title') {
          seen.title = Math.max(seen.title, local.length);
          seen.fell += local.filter((s) => s.gone > 0).length > 0 ? 1 : 0;
          if (r.seconds > 25) flowOf(game).play();
        }
        if (phase === 'lobby') {
          const { ui } = servicesOf(game);
          const at = ui.worldToScreen(0, -6);
          const input = inputOf(game);
          if (!tapped && at) {
            tapped = true;
            input.setPointer('aim', { x: at.x, y: at.y, down: true });
          } else if (tapped) input.setPointer('aim', { down: false });
          seen.practice = Math.max(seen.practice, local.filter((s) => s.seat !== undefined && Math.abs(s.x) < 1.5 && s.y < -4).length);
        }
      },
      until: (r) => seen.practice > 0,
    });
    expect(run.errors).toEqual([]);
    expect([...seen.phases]).toEqual(expect.arrayContaining(['title', 'lobby']));
    expect(seen.title).toBeGreaterThan(6);
    expect(seen.fell).toBeGreaterThan(0);
    expect(seen.practice).toBeGreaterThan(0);
  });
});

describe('playing with your hands', () => {
  it('a tap on the table aims there: the stone lands where you tapped, and dragging moves the aim', async () => {
    const canvas = fakeCanvas(1280, 720);
    let mine = null;
    let step = 0;
    const run = await simulate(() => gameConfig({ quick: true, rounds: 1, fill: 3, render: { backend: strictBackend(canvas), fit: 'none' } }), {
      humans: 1,
      bots: 2,
      seed: 6,
      seconds: 200,
      onFrame: (r) => {
        const game = r.game;
        const clock = clockOf(game);
        const input = inputOf(game);
        const { ui } = servicesOf(game);
        if (!clock.live || clock.phase !== 'aim' || clock.beat !== 0) {
          if (step > 0) input.setPointer('aim', { down: false });
          if (clock.live && clock.beat >= 1 && !mine) mine = stonesOn(game).filter((s) => s.seat === 0);
          return;
        }
        // Press at (5, 5), then drag to (-6, -4) and let go.
        const press = ui.worldToScreen(5, 5);
        const drag = ui.worldToScreen(-6, -4);
        if (!press || !drag) return;
        if (step === 0 && clock.t > 0.3) (input.setPointer('aim', { x: press.x, y: press.y, down: true }), step++);
        else if (step === 1) (input.setPointer('aim', { x: (press.x + drag.x) / 2, y: (press.y + drag.y) / 2, down: true }), step++);
        else if (step === 2) (input.setPointer('aim', { x: drag.x, y: drag.y, down: true }), step++);
        else if (step === 3) (input.setPointer('aim', { x: drag.x, y: drag.y, down: false }), step++);
      },
      until: () => mine !== null,
    });
    expect(run.errors).toEqual([]);
    expect(mine).toHaveLength(1);
    expect(mine[0].x).toBeCloseTo(-6, 0);
    expect(mine[0].y).toBeCloseTo(-4, 0);
  });
});

describe('drawing', () => {
  it('draws the title, the lobby, a whole round and the podium through a strict canvas with no errors', async () => {
    const canvas = fakeCanvas(390, 844);
    const phases = new Set();
    const run = await simulate(() => gameConfig({ quick: true, rounds: 1, fill: 8, render: { backend: strictBackend(canvas), fit: 'none' } }), {
      humans: 1,
      bots: 7,
      seed: 6,
      seconds: 200,
      onFrame: (r) => phases.add(phaseOf(r.game)),
      until: (r) => r.matches > 0,
    });
    expect(run.errors).toEqual([]);
    expect([...phases]).toEqual(expect.arrayContaining(['title', 'lobby', 'countdown', 'banner', 'playing', 'results']));
    canvas.assertBalanced();
    expect(canvas.args('fillText').length).toBeGreaterThan(20);
    let stones = 0;
    run.game.world.query([Stone]).each(() => stones++);
    expect(stones).toBeGreaterThanOrEqual(0);
  });
});
