import { Transform, quat } from '@onceworlds/engine';
import { PostFx2D, Shape2D, Text, camera2D } from '@onceworlds/engine/modules';
import { LeanArrow, RimPiece, TableCamera, TableShadow } from './components.js';
import { RINGS, TABLE } from './rules.js';
import { COLORS, LAYERS } from './theme.js';

// The stage: a round table on a dark floor. Its shadow, its brass rim (in pieces that light up red on the low side), three rings of
// score and the numbers on them, and chevrons that point downhill. Systems (systems/table.js) move the shadow, colour the rim and the
// chevrons from the lean every frame; this only builds the pieces. The title, the lobby, every round and the posters build it here.

const R = TABLE.radius;
export const RIM_PIECES = 48;

/** The camera's finish: a little more colour and a dark edge. Posters put the same on theirs. */
export const cameraLook = () => [PostFx2D({ saturation: 1.1, vignette: 0.32, vignetteSoftness: 0.6 })];

/** A chevron pointing along +x, centred on the origin. */
const CHEVRON = [[-0.9, 1.1], [0.35, 0], [-0.9, -1.1], [-0.25, -1.1], [1.0, 0], [-0.25, 1.1]];

export function buildTable(world, { camera = true } = {}) {
  const spawn = (x, y, ...parts) => world.spawn([Transform({ position: [x, y, 0] }), ...parts]);
  if (camera) world.spawn([Transform(), camera2D({ height: 34, clear: COLORS.floor }), ...cameraLook(), TableCamera()]);

  // A pool of light on the floor under the table (rings of fading colour).
  for (let i = 0; i < 10; i++) {
    spawn(0, 0, Shape2D({ shape: 'circle', radius: 30 - i * 1.6, fill: COLORS.floorGlow, opacity: 0.12, layer: LAYERS.floor, z: i }));
  }
  // The pivot's foot and the table's shadow, which slides toward the low side as the table leans.
  spawn(0, 0, Shape2D({ shape: 'circle', radius: R + 0.9, fill: COLORS.shadow, opacity: 0.55, layer: LAYERS.shadow }), TableShadow());

  // The brass rim, then the three rings of the top, the middle one lightest.
  spawn(0, 0, Shape2D({ shape: 'circle', radius: R + 0.85, fill: COLORS.brass, stroke: COLORS.ink, strokeWidth: 0.2, layer: LAYERS.table }));
  spawn(0, 0, Shape2D({ shape: 'circle', radius: R + 0.12, fill: COLORS.brassDark, layer: LAYERS.table, z: 1 }));
  const fills = [COLORS.ringRim, COLORS.ringInner, COLORS.ringMiddle];
  [...RINGS].reverse().forEach((ring, i) => {
    spawn(0, 0, Shape2D({ shape: 'circle', radius: R * ring.upTo, fill: fills[i], layer: LAYERS.rings, z: i }));
  });
  for (const ring of RINGS.slice(0, -1)) {
    spawn(0, 0, Shape2D({ shape: 'circle', radius: R * ring.upTo, fill: '#00000000', stroke: COLORS.ringLine, strokeWidth: 0.09, dash: 0.5, layer: LAYERS.rings, z: 5 }));
  }
  // The points, along two lines across the table like a ruler.
  for (const angle of [Math.PI * 0.32, Math.PI * 1.32]) {
    let inner = 0;
    for (const ring of RINGS) {
      const r = R * ((inner + ring.upTo) / 2);
      inner = ring.upTo;
      spawn(Math.cos(angle) * r, Math.sin(angle) * r, Text({ text: String(ring.points), size: 1.9, weight: 800, color: COLORS.ringLine, opacity: 0.55, layer: LAYERS.marks }));
    }
  }
  // The pivot: a brass pin in the middle.
  spawn(0, 0, Shape2D({ shape: 'circle', radius: 0.32, fill: COLORS.brass, stroke: COLORS.ink, strokeWidth: 0.08, layer: LAYERS.marks }));

  // The rim in pieces, each coloured by how low it is.
  for (let i = 0; i < RIM_PIECES; i++) {
    const a0 = (i / RIM_PIECES) * Math.PI * 2;
    const a1 = ((i + 0.82) / RIM_PIECES) * Math.PI * 2;
    const r = R + 0.48;
    const points = [0, 0.5, 1].map((k) => {
      const a = a0 + (a1 - a0) * k;
      return [Math.cos(a) * r, Math.sin(a) * r];
    });
    spawn(0, 0, Shape2D({ shape: 'line', points, stroke: COLORS.brass, strokeWidth: 0.5, layer: LAYERS.table, z: 2 }), RimPiece({ angle: (a0 + a1) / 2 }));
  }

  // Chevrons that point downhill, brighter and redder as the lean grows.
  for (let i = 0; i < 3; i++) {
    const arrow = spawn(0, 0, Shape2D({ shape: 'polygon', points: CHEVRON, fill: COLORS.danger, opacity: 0, layer: LAYERS.marks, z: 1 }), LeanArrow({ index: i }));
    quat.fromAngleZ(arrow.get(Transform).rotation, 0);
  }
}
