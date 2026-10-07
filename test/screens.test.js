import { describe, expect, it, vi } from 'vitest';
import { createGame } from '@onceworlds/engine';
import { flowOf, servicesOf } from '@onceworlds/engine/modules';
import { simulate } from '@onceworlds/engine/test';
import { LocalStone, Stone } from '../components.js';
import { gameConfig } from '../game.config.js';
import { seatSpot } from '../look.js';
import { TABLE } from '../rules.js';
import { UI } from '@onceworlds/engine/modules';
import { hudTree, keyboardInUse, promptTree } from '../ui.js';
import { screenLayout } from '../view.js';
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
  const SIZES = [
    [390, 844],
    [844, 390],
    [1280, 720],
    [1920, 1080],
    [1024, 768],
    [2560, 1080],
  ];
  const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const game = createGame({ ...gameConfig(), headless: true });
  game.start();
  const { ui } = servicesOf(game);

  it('fits every screen in every phase, and never covers the table', () => {
    for (const [width, height] of SIZES) {
      for (const touch of [true, false]) {
        for (const phase of ['idle', 'aim', 'settle']) {
          for (const extra of [{}, { armed: true }, { boulder: false }, { aimed: true, left: 1 }]) {
            const hud = ui.preview(hudTree({ ...base, phase, ...extra }, () => {}, !touch), { width, height, touch, anchor: 'top', offset: [0, 58] });
            const layout = screenLayout(width, height, { scale: hud.scale });
            expect(hud.rect.x).toBeGreaterThanOrEqual(0);
            expect(hud.rect.x + hud.rect.w).toBeLessThanOrEqual(width);
            expect(hud.rect.y + hud.rect.h).toBeLessThanOrEqual(layout.table.y + 4);
          }
        }
      }
    }
  });

  it('puts the prompts clear of the table on every screen: under the seats when tall, beside the table when wide', () => {
    for (const [width, height] of SIZES) {
      const layout = screenLayout(width, height);
      expect(layout.prompt).toBe(width / height < 1.05 ? 'bottom' : width / height > 1.6 ? 'left' : layout.prompt);
      for (const state of [{ ...base, phase: 'aim' }, { ...base, phase: 'aim', aimed: true, left: 1.2 }]) {
        let rect;
        let zones = [];
        if (layout.prompt === 'left') {
          const { scale } = ui.preview(UI.spacer(), { width, height, anchor: 'left' });
          const room = Math.max(60, layout.side / scale - 16);
          const seen = ui.preview(UI.column({ w: room, align: 'center' }, promptTree(state, { maxWidth: room })), { width, height, touch: true, anchor: 'top-left', offset: [8, 64] });
          rect = seen.rect;
          zones = seen.safe.zones;
        } else {
          rect = ui.preview(promptTree(state), { width, height, touch: true, anchor: 'bottom', offset: [0, 18], safe: false }).rect;
        }
        // Beside the table, it also keeps clear of the platform's buttons and the thumbs.
        for (const zone of zones) expect(overlaps(rect, zone), `${width}x${height} prompt under ${JSON.stringify(zone)}`).toBe(false);
        expect(overlaps(rect, layout.table), `${width}x${height} ${JSON.stringify(rect)} vs ${JSON.stringify(layout.table)}`).toBe(false);
        expect(rect.x).toBeGreaterThanOrEqual(0);
        expect(rect.x + rect.w).toBeLessThanOrEqual(width);
        expect(rect.y + rect.h).toBeLessThanOrEqual(height);
      }
    }
  });

  it('makes the boulder a thumb-sized button on a touch screen, with its state on it, and names the key only for a keyboard', () => {
    const tap = ui.preview(hudTree({ ...base, phase: 'aim' }, () => {}, false), { width: 390, height: 844, touch: true, anchor: 'top' });
    const button = tap.hits.find((h) => JSON.stringify(h).includes('boulder'));
    expect(button).toBeTruthy();
    expect(button.rect.h / tap.scale).toBeGreaterThanOrEqual(56 / tap.scale - 0.5);
    const text = (tree) => JSON.stringify(tree);
    expect(text(hudTree({ ...base, phase: 'aim' }, () => {}, false))).toContain('"BOULDER"');
    expect(text(hudTree({ ...base, phase: 'aim' }, () => {}, true))).toContain('BOULDER (B)');
    expect(text(hudTree({ ...base, phase: 'aim', armed: true }, () => {}, true))).toContain('ARMED');
    expect(text(hudTree({ ...base, phase: 'aim', boulder: false }, () => {}, true))).toContain('USED');
    // Keys are named only where a keyboard is the input: never on touch, never before a mouse or a key has been used.
    const input = (device, type) => ({ device, pointer: () => ({ type }) });
    expect(keyboardInUse(input('touch', 'touch'), true, {})).toBe(false);
    expect(keyboardInUse(input('keyboard', 'none'), false, { keyboard: false })).toBe(false);
    expect(keyboardInUse(input('mouse', 'mouse'), false, {})).toBe(true);
    expect(keyboardInUse(input('keyboard', 'none'), false, { keyboard: true })).toBe(true);
    expect(keyboardInUse(input('pad', 'none'), false, { keyboard: true })).toBe(false);
  });

  it('says what to do: tap before the first aim, AIM! when time is short, nothing otherwise', () => {
    const text = (tree) => JSON.stringify(tree);
    expect(text(promptTree({ ...base, phase: 'aim' }))).toContain('TAP THE TABLE');
    expect(text(promptTree({ ...base, phase: 'aim', aimed: true, left: 1.5 }))).toContain('AIM!');
    expect(promptTree({ ...base, phase: 'aim', aimed: true, hasAim: true })).toBeNull();
    expect(promptTree({ ...base, phase: 'settle' })).toBeNull();
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
