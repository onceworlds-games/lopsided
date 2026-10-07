import { defineComponent, defineResource, t } from '@onceworlds/engine';
import { COLOR_COUNT, FLOOR } from './rules.js';

// Data only. What every page must agree on is replicated (`net`); the rest each page keeps for itself.

/** Who a runner is. The page that plays it writes it (and its position). */
export const Runner = defineComponent('Runner', { id: t.playerId(), color: t.u8() }, { net: { replicate: true } });

/** Whether a runner is still in. Only the host writes it, so nobody can stay in by lying about where they stood. */
export const Status = defineComponent('Status', { out: t.bool(false), outAt: t.f32(0, { step: 0.1 }) }, { net: { replicate: true, owner: 'host' } });

// ---- Kept on one page only (never sent).

/** Running and dashing, on the page that simulates the runner. */
export const Motion = defineComponent('Motion', { vx: t.f32(), vy: t.f32(), dashLeft: t.f32(), cooldown: t.f32(), dashHeld: t.bool(), dashX: t.f32(), dashY: t.f32() });

/** How a runner is drawn, and what this page already showed for it. */
export const Look = defineComponent('Look', { out: t.bool(), figure: t.entity(), shadow: t.entity() });

/** A square of the floor and the shape drawn on it. */
export const Tile = defineComponent('Tile', { col: t.u8(), row: t.u8(), symbol: t.entity(), color: t.u8(255) });

/** Title-screen runners that follow a script. */
export const Demo = defineComponent('Demo', { phase: t.f32(), speed: t.f32(1) });

export const FloorCamera = defineComponent('FloorCamera');

/** The floor right now, worked out on every page from the round's clock (or a looping demo outside a round). */
export const Floor = defineResource('Floor', {
  key: t.string(80),
  wave: t.u16(),
  phase: t.enum(['idle', 'show', 'drop', 'rest'], 'idle'),
  t: t.f32(),
  left: t.f32(),
  target: t.u8(),
  colors: t.u8(COLOR_COUNT),
  /** True while a round is being played (the floor decides who falls), false in the demo behind the title and the lobby. */
  live: t.bool(false),
  tiles: t.list(t.u8(), FLOOR.cols * FLOOR.rows),
  /** The floor of the wave before, so tiles that fell can grow back while the safe ones are recoloured. */
  prev: t.list(t.u8(), FLOOR.cols * FLOOR.rows),
  prevTarget: t.u8(),
  hasPrev: t.bool(false),
});

/** What this page has already shown of the floor (a tick, a drop), so each is shown once. */
export const Beat = defineResource('Beat', { id: t.string(100), phase: t.string(8), tick: t.i32(-1) });

/** The host's note of which drop it has judged (so a drop is judged once, even if the host changes). */
export const Judged = defineResource('Judged', { key: t.string(100) });
