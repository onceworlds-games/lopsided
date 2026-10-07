import { Transform } from '@onceworlds/engine';
import { Material2D, PostFx2D, Shape2D, camera2D } from '@onceworlds/engine/modules';
import { FloorCamera, Tile } from './components.js';
import { symbolPoints } from './look.js';
import { FLOOR, HALF, tileCenter } from './rules.js';
import { COLORS, LAYERS } from './theme.js';

// The stage: a raft in a pool, with a grid of holes and a tile over each, and a lane rope of floats round its edge. The tiles' colours,
// shapes and falling are driven by the `Floor` resource every frame (systems/floor.js), so this only builds the pieces. The title screen,
// the lobby, every round and the posters all build it here. Daylight needs no lamps: the raft and the tiles throw their shadows on what
// is under them, which reads the same on the GPU and on Canvas 2D.

/** The camera's finish: a touch more colour and a soft edge. Posters put the same on theirs. */
export const cameraLook = () => [PostFx2D({ saturation: 1.08, vignette: 0.12 })];

/** Ripples on the water, as [x, y] (any that would be under the raft are left out). */
const RIPPLES = Array.from({ length: 28 }, (_, i) => [((i * 7.3) % 34) - 17, ((i * 5.7) % 30) - 15]);
const WAVE = [[-0.8, 0], [-0.4, 0.12], [0, 0], [0.4, -0.12], [0.8, 0]];

export function buildFloor(world, { camera = true } = {}) {
  const spawn = (x, y, ...parts) => world.spawn([Transform({ position: [x, y, 0] }), ...parts]);
  if (camera) world.spawn([Transform(), camera2D({ height: FLOOR.rows * FLOOR.tile + 4, clear: COLORS.water }), ...cameraLook(), FloorCamera()]);

  const frame = { w: HALF.x * 2 + 1.2, h: HALF.y * 2 + 1.2 };
  for (const [x, y] of RIPPLES) {
    if (Math.abs(x) < frame.w / 2 + 1 && Math.abs(y) < frame.h / 2 + 1) continue;
    spawn(x, y, Shape2D({ shape: 'line', points: WAVE, stroke: '#ffffff', strokeWidth: 0.1, opacity: 0.45, layer: LAYERS.water }));
  }
  spawn(0, 0, Shape2D({ shape: 'roundRect', size: [frame.w, frame.h], radius: 0.6, fill: COLORS.deck, stroke: COLORS.ink, strokeWidth: 0.12, shadow: COLORS.shadow, shadowBlur: 10, shadowOffset: [0.35, -0.35], layer: LAYERS.stage }));
  // The lane rope: red and white floats all round the deck.
  const float = (x, y, i) => spawn(x, y, Shape2D({ shape: 'circle', radius: 0.17, fill: i % 2 ? '#ffffff' : COLORS.float, stroke: COLORS.ink, strokeWidth: 0.05, layer: LAYERS.stage, z: 1 }));
  for (let i = 0, x = -frame.w / 2 + 0.6; x <= frame.w / 2 - 0.5; i++, x += 0.5) {
    float(x, frame.h / 2 - 0.3, i);
    float(x, -frame.h / 2 + 0.3, i);
  }
  for (let i = 1, y = -frame.h / 2 + 0.8; y <= frame.h / 2 - 0.7; i++, y += 0.5) {
    float(-frame.w / 2 + 0.3, y, i);
    float(frame.w / 2 - 0.3, y, i);
  }

  for (let row = 0; row < FLOOR.rows; row++) {
    for (let col = 0; col < FLOOR.cols; col++) {
      const at = tileCenter(col, row);
      spawn(at.x, at.y, Shape2D({ shape: 'roundRect', size: [1.9, 1.9], radius: 0.25, fill: COLORS.deep, layer: LAYERS.pits }));
      const tile = spawn(
        at.x,
        at.y,
        Shape2D({ shape: 'roundRect', size: [1.84, 1.84], radius: 0.25, fill: '#888888', stroke: COLORS.ink, strokeWidth: 0.1, shadow: COLORS.shadow, shadowBlur: 4, shadowOffset: [0.08, -0.12], layer: LAYERS.tiles }),
        Material2D(),
      );
      const symbol = world.spawn([Transform(), Shape2D({ shape: 'polygon', points: symbolPoints(0, 0.5), fill: '#ffffffd0', layer: LAYERS.symbols })], { parent: tile });
      tile.add(Tile({ col, row, symbol: symbol.id }));
    }
  }
}
