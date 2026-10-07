import { Transform, defineModule } from '@onceworlds/engine';
import { Avatar2D, Material2D, Shape2D, UI, feelOf, servicesOf } from '@onceworlds/engine/modules';
import { Floor, Look } from './components.js';
import { buildFloor, cameraLook } from './level.js';
import { poseRunner, puppet, symbolPoints } from './look.js';
import { FLOOR, makeFloor, tileCenter } from './rules.js';
import { COLORS, LAYERS, SPLASH, TILE_COLORS, TITLE } from './theme.js';
import { hudTree } from './ui.js';

// Store art made by the game itself: `?poster=cover` (1920x1080), `?poster=icon` (512x512) and `?poster=action`. The scenes are staged with
// the same floor and runner code as the game, then settled for a moment so the splashes are in the air when the picture is taken.
// `onceworlds posters` captures them into store/. The floor is posed by writing the `Floor` resource (the clock leaves it alone in a poster).

function camera(p, x, y, height) {
  p.camera({ height, clear: COLORS.water }).add(...cameraLook()).get(Transform).position.set(x, y, 0);
}

/** The floor of wave 3, frozen in `phase` (`drop`: only the called colour is left), and where its called tiles are. */
function stage(p, phase, t = 0.6) {
  buildFloor(p.world, { camera: false });
  const made = makeFloor(p.rng('floor'), 3, 1);
  Object.assign(p.world.resource(Floor), { tiles: made.tiles, target: made.target, colors: made.colors, phase, t, left: 1 });
  const safe = made.tiles.flatMap((color, i) => (color === made.target ? [tileCenter(i % FLOOR.cols, Math.floor(i / FLOOR.cols))] : []));
  return { ...made, safe };
}

/** Runners `[x, y]` dressed as bots 1, 2, 3... */
const runners = (p, spots, first = 0) => spots.map(([x, y], i) => puppet(p.world, { x, y, id: `bot:${first + i + 1}`, color: first + i }));

/** Once the runners are dressed (after a first moment of settling): some cheer, a ghost floats. */
function act(p, { cheer = [], ghosts = [] }) {
  p.settle(0.05);
  for (const runner of cheer) Avatar2D.play(p.world.entity(runner.get(Look).figure), 'cheer');
  for (const ghost of ghosts) poseRunner(p.world, ghost, ghost.get(Look), true, 0);
}

function cover(p) {
  camera(p, 0, 2.1, 15.5);
  // A moment into the drop: every colour still shows, the wrong ones sinking.
  const { safe, tiles, target } = stage(p, 'drop', 0.1);
  const feel = feelOf(p.world);
  tiles.forEach((color, i) => color !== target && i % 3 === 0 && feel.particles.burst(SPLASH, tileCenter(i % FLOOR.cols, Math.floor(i / FLOOR.cols)), { count: 8, layer: LAYERS.fx }));
  const standing = runners(p, safe.slice(0, 5).map(({ x, y }, i) => [x + (i % 2 ? 0.3 : -0.3), y - 0.2]));
  const ghosts = runners(p, [[-1, -1.3]], 5);
  feel.floatText('OUT', { x: -1, y: 1.4 }, { color: COLORS.bad, size: 1.1, layer: LAYERS.fx });
  act(p, { cheer: standing.filter((_r, i) => i % 2 === 0), ghosts });
  p.settle(0.3);
}

function action(p) {
  camera(p, 0, 0.8, 14);
  const { safe } = stage(p, 'show', 0.4);
  const [a, b] = safe;
  runners(p, [[a.x + 0.2, a.y], [b.x - 0.3, b.y + 0.2], [a.x - 3.2, a.y + 0.8], [b.x + 2.8, b.y - 1.6]]);
  feelOf(p.world).particles.burst('dust', { x: a.x - 3.8, y: a.y + 0.6 }, { count: 12, direction: Math.PI, spread: 0.6, layer: LAYERS.fx });
  p.settle(0.3);
}

function icon(p) {
  camera(p, 0.2, 0.5, 4.4);
  const tile = (x, y, kind, scale) => {
    const t = p.world.spawn([Transform({ position: [x, y, 0], scale: [scale, scale, 1] }), Shape2D({ shape: 'roundRect', size: [2.4, 2.4], radius: 0.35, fill: TILE_COLORS[kind].fill, stroke: COLORS.ink, strokeWidth: 0.12, layer: LAYERS.tiles }), Material2D({ glow: scale === 1 ? 0.4 : 0 })]);
    p.world.spawn([Transform(), Shape2D({ shape: 'polygon', points: symbolPoints(kind, 0.6), fill: '#ffffffcc', layer: LAYERS.symbols })], { parent: t });
  };
  tile(0, 0, 3, 1);
  tile(2.2, -1.5, 1, 0.6);
  tile(-2, 2.1, 0, 0.6);
  const [runner] = runners(p, [[0, -0.5]]);
  runner.get(Transform).scale.set(1.5, 1.5, 1);
  act(p, { cheer: [runner] });
  p.settle(0.4);
}

export const PartyPosters = () =>
  defineModule({
    name: 'party-posters',
    init(game) {
      game.poster('cover', cover);
      game.poster('action', action);
      game.poster('icon', icon, { width: 512, height: 512 });
      // The cover carries the name of the game, and the action picture the colour being called, over everything and never lit.
      const { ui } = servicesOf(game);
      const active = () => servicesOf(game).poster?.active;
      ui.view('poster-title', () => UI.label(TITLE, { size: 88, color: 'accent', weight: 800, outline: true }), { anchor: 'top', offset: [0, 36], order: 9, safe: false, when: () => active() === 'cover' });
      ui.view('poster-call', ({ world }) => hudTree({ phase: 'show', target: world.resource(Floor).target, fraction: 0.4, alive: 6 }), { anchor: 'top', offset: [0, 36], order: 9, safe: false, when: () => active() === 'action' });
    },
  });
