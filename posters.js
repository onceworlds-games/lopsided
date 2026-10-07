import { Transform, defineModule, quat } from '@onceworlds/engine';
import { NameTag, Shape2D, Text, feelOf, servicesOf } from '@onceworlds/engine/modules';
import { Board, Hand, SeatLook, Stone } from './components.js';
import { cameraLook, buildTable } from './table.js';
import { dressSeat, pictureStone, seatSpot, spawnGhost } from './look.js';
import { COLORS, LAYERS, SPILL, THUD, TITLE, seatStyle } from './theme.js';
import { hudTree } from './ui.js';

// Store art made by the game itself: `?poster=cover` (1920x1080), `?poster=icon` (512x512) and `?poster=action`, staged with the same
// table, stones and seats as the game. The lean is posed with a Board of the poster's own; stones over the edge are posed mid-fall.

function camera(p, x, y, height) {
  p.camera({ height, clear: COLORS.floor }).add(...cameraLook()).get(Transform).position.set(x, y, 0);
}

/** A table leaning toward (x, y), with seats round it as on a wide screen (`name`, `score`, the boulder still in hand). */
function stage(p, lean, seats = []) {
  buildTable(p.world, { camera: false });
  p.world.spawn([Transform(), Board({ x: lean[0], y: lean[1], dropped: 3 })]);
  seats.forEach(({ name, score, boulder = true }, i) => {
    const spot = seatSpot(i, seats.length, 16 / 9);
    const seat = p.world.spawn([Transform({ position: [spot.x, spot.y, 0] }), Hand({ score, boulder })]);
    dressSeat(p.world, seat, { seat: i, id: `bot:${i + 1}`, name, you: name === 'You' });
    const look = seat.get(SeatLook);
    p.world.entity(look.score).get(Text).text = String(score);
    if (!boulder) p.world.entity(look.boulder).get(Shape2D).visible = false;
    const card = p.world.entity(look.card);
    if (card?.has(NameTag)) card.get(NameTag).offset.set(0, spot.up ? 2.3 : -2.3);
  });
}

/** A stone over the edge, mid-fall. */
function falling(p, x, y, seat, gone = 0.35) {
  const s = p.world.spawn([Transform({ position: [x, y, 0] }), Stone({ seat, gone })]);
  return s;
}

const polar = (r, deg) => [Math.cos((deg * Math.PI) / 180) * r, Math.sin((deg * Math.PI) / 180) * r];

/** The match moment on the cover and the action picture: a crowded table sliding toward the lower right. */
function crowd(p) {
  const spots = [
    [8.6, -28, 0], [7.4, -44, 2], [9.1, -12, 3], [8.2, -62, 1], [6.1, -30, 4], [5.0, -8, 2], [8.9, 8, 5],
    [8.7, 152, 1], [8.2, 118, 3], [6.6, 165, 0], [8.9, 96, 2], [5.4, 128, 5], [3.0, 70, 4], [2.2, 200, 1],
    [8.6, 214, 4], [7.0, 236, 0], [4.6, 250, 3], [8.9, 270, 2], [1.4, 320, 5], [6.4, 300, 1], [8.8, 32, 0],
  ];
  for (const [r, deg, seat] of spots) pictureStone(p.world, ...polar(r, deg), seat);
  // The boulder that did it, just landed on the far side.
  pictureStone(p.world, ...polar(7.6, 136), 4, true);
}

function cover(p) {
  camera(p, -8.6, 0, 25);
  stage(p, [0.12, -0.1]);
  crowd(p);
  const feel = feelOf(p.world);
  // Three going over the low edge right now, with their lost points.
  for (const [r, deg, seat, gone] of [[10.5, -38, 2, 0.08], [11.0, -24, 0, 0.2], [10.3, -53, 1, 0.02]]) {
    const [x, y] = polar(r, deg);
    falling(p, x, y, seat, gone);
    feel.particles.burst(SPILL, { x, y }, { direction: (deg * Math.PI) / 180, count: 22, layer: LAYERS.fx });
  }
  feel.particles.burst(THUD, { x: polar(7.6, 136)[0], y: polar(7.6, 136)[1] }, { count: 26, layer: LAYERS.fx });
  // The name, tipped like the table, and what you do.
  const words = (text, x, y, size, color, angle = 0) => {
    const e = p.world.spawn([Transform({ position: [x, y, 0] }), Text({ text, size, weight: 800, color, outline: size * 0.1, outlineColor: COLORS.ink, layer: LAYERS.fx, z: 5 })]);
    quat.fromAngleZ(e.get(Transform).rotation, angle);
  };
  words(TITLE, -19.6, 3.6, 3.5, COLORS.gold, 0.1);
  words('TIP THE TABLE.', -19.6, -1.3, 1.6, COLORS.white);
  words('KEEP YOUR STONES ON.', -19.6, -3.8, 1.35, COLORS.white);
  words('TIPPED BY MIA!', 6.6, -10.4, 1.5, seatStyle(4).fill, 0.12);
  p.settle(0.4);
}

function action(p) {
  camera(p, 0, 1.6, 30);
  stage(p, [0.07, -0.05], [{ name: 'You', score: 15 }, { name: 'Rex', score: 9 }, { name: 'Juno', score: 17 }, { name: 'Ollie', score: 12 }, { name: 'Pip', score: 6 }, { name: 'Sky', score: 14 }]);
  crowd(p);
  // Your aim for this beat, on the high side.
  const ghost = spawnGhost(p.world, 0);
  ghost.get(Transform).position.set(...polar(8.6, 196), 0);
  ghost.get(Transform).scale.set(1, 1, 1);
  p.settle(0.4);
}

function icon(p) {
  camera(p, 4.6, -4.2, 13.5);
  stage(p, [0.12, -0.1]);
  for (const [r, deg, seat] of [[6.4, -40, 0], [7.8, -58, 1], [4.6, -20, 3], [3.2, -62, 4]]) pictureStone(p.world, ...polar(r, deg), seat);
  const feel = feelOf(p.world);
  for (const [r, deg, seat, gone] of [[10.5, -34, 2, 0.12], [11.1, -48, 5, 0.3]]) {
    const [x, y] = polar(r, deg);
    falling(p, x, y, seat, gone);
    feel.particles.burst(SPILL, { x, y }, { direction: (deg * Math.PI) / 180, layer: LAYERS.fx });
  }
  p.settle(0.4);
}

export const Posters = () =>
  defineModule({
    name: 'lopsided-posters',
    init(game) {
      game.poster('cover', cover);
      game.poster('action', action);
      game.poster('icon', icon, { width: 512, height: 512 });
      const { ui } = servicesOf(game);
      const active = () => servicesOf(game).poster?.active;
      ui.view(
        'poster-hud',
        () => hudTree({ phase: 'aim', beat: 3, left: 2.4, fraction: 0.6, lean: { x: 0.07, y: -0.05 }, preview: { x: 0.03, y: -0.02 }, danger: 0.9, seat: 0, boulder: true, armed: false, aimed: true, hasAim: true }, () => {}),
        { anchor: 'top', offset: [0, 30], order: 9, safe: false, when: () => active() === 'action' },
      );
    },
  });
