import { Transform, clamp, defineSystem } from '@onceworlds/engine';
import { Camera, Material2D, Shape2D, easeFn, servicesOf } from '@onceworlds/engine/modules';
import { FloorCamera, Floor, Tile } from '../components.js';
import { FLOOR, HALF, WAVE, floorAt, makeFloor } from '../rules.js';
import { symbolPoints } from '../look.js';
import { TILE_COLORS } from '../theme.js';

// The floor, on every page. It is not stored or sent anywhere: it is worked out from the round's clock and the match's seed, so every page
// shows the same floor and a page that loads halfway through a round, or becomes the host, just carries on.
//
//   floor-clock - once a step: which wave and phase we are in, and the colours of this wave's tiles (and the last wave's).
//   tile-look   - once a frame: colour, shape and falling of every tile; the called colour glows until the floor comes back.
//   camera-fit  - the whole floor stays in view under the HUD, on a tall phone screen as well as a wide one.
//
// Outside a round (the title, the lobby) the same floor runs a looping demo off the world's clock: the game alive behind the Play button.

export const FloorClock = defineSystem({
  name: 'party:floor-clock',
  stage: 'fixed',
  run({ world, game, flow, time, rng }) {
    // A poster poses the floor by hand: leave it alone.
    if (servicesOf(game).poster?.active) return;
    const floor = world.resource(Floor);
    const phase = flow.phase;
    let key = 'demo';
    let round = 1;
    let elapsed = time.now;
    let live = false;
    if (phase === 'playing') {
      const now = flow.context();
      [key, round, elapsed, live] = [now.rid, now.round, now.elapsed, true];
    } else if (phase === 'countdown' || phase === 'banner') {
      [key, elapsed] = ['ready', 0];
    } else if (phase === 'roundEnd' || phase === 'scoreboard') {
      return;
    }
    const at = floorAt(elapsed, round);
    // The next wave's floor is drawn from the moment the fallen tiles start to come back.
    const shown = at.phase === 'rest' ? at.wave + 1 : at.wave;
    const id = `${key}:${shown}`;
    if (floor.key !== id) {
      const made = makeFloor(rng('floor').fork(id), shown, round);
      floor.key = id;
      floor.target = made.target;
      floor.colors = made.colors;
      floor.tiles = made.tiles;
      floor.hasPrev = shown > 0;
      if (shown > 0) {
        const before = makeFloor(rng('floor').fork(`${key}:${shown - 1}`), shown - 1, round);
        floor.prev = before.tiles;
        floor.prevTarget = before.target;
      }
    }
    floor.wave = shown;
    floor.phase = at.phase;
    floor.t = at.t;
    floor.left = at.left;
    floor.live = live;
  },
});

export const TileLook = defineSystem({
  name: 'party:tile-look',
  stage: 'update',
  query: [Tile, Shape2D, Material2D, Transform],
  run({ query, world, time }) {
    const floor = world.resource(Floor);
    const back = easeFn('backOut');
    const pulse = 0.2 + 0.15 * Math.sin(time.now * 8);
    query.each((_entity, tile, shape, material, tr) => {
      const index = tile.row * FLOOR.cols + tile.col;
      const color = floor.tiles[index] ?? 0;
      if (tile.color !== color) {
        tile.color = color;
        shape.fill.copy(TILE_COLORS[color].fill);
        shape.stroke.copy(TILE_COLORS[color].edge);
        const symbol = world.entity(tile.symbol);
        if (symbol) symbol.get(Shape2D).points = symbolPoints(color, 0.5);
      }
      // The tiles that are not the called colour fall at the start of a drop, stay gone, and grow back when the floor returns.
      let scale = 1;
      if (floor.phase === 'drop' && color !== floor.target) scale = 1 - clamp(floor.t / WAVE.fall, 0, 1);
      else if (floor.phase === 'rest' && floor.hasPrev && floor.prev[index] !== floor.prevTarget) scale = Math.max(0, back(clamp(floor.t / (WAVE.rest * 0.8), 0, 1)));
      else if (floor.phase === 'rest' && floor.hasPrev) scale = 1 + 0.12 * Math.sin(clamp(floor.t / 0.4, 0, 1) * Math.PI);
      tr.scale.set(scale, scale, 1);
      shape.opacity = Math.min(1, scale * 1.6);
      material.glow = (floor.phase === 'show' || floor.phase === 'drop') && color === floor.target ? pulse : 0;
    });
  },
});

/** The top of the screen that belongs to the HUD while a round is on (the called colour, the round and the clock). */
const HUD_SHARE = 0.2;

/** The whole floor in view, under the HUD: a wide screen is limited by the floor's height, a tall one by its width. */
export const CameraFit = defineSystem({
  name: 'party:camera-fit',
  stage: 'late',
  query: [FloorCamera, Camera, Transform],
  run({ query, ui, flow }) {
    const screen = ui?.safe.screen;
    const aspect = screen && screen.w > 0 && screen.h > 0 ? screen.w / screen.h : 16 / 9;
    const hud = flow.phase === 'title' ? 0 : HUD_SHARE;
    const height = Math.max((HALF.y * 2 + 2) / (1 - hud), (HALF.x * 2 + 2) / aspect);
    query.each((_entity, _tag, camera, tr) => {
      camera.height = height;
      tr.position.set(0, (height * hud) / 2, 0);
    });
  },
});
