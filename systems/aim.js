import { Transform, defineSystem, hashString, quat } from '@onceworlds/engine';
import { Shape2D, servicesOf } from '@onceworlds/engine/modules';
import { Aim, Beat, Ghost, Hand, RoundClock, Seat } from '../components.js';
import { spawnGhost } from '../look.js';
import { mySeat } from '../queries.js';
import { BEATS, TABLE, clampAim } from '../rules.js';
import { sandboxDrop, sandboxOf } from './sandbox.js';

// This page's hands. A tap (or click) on the table aims this player's next stone there, until the beat's drop; the boulder button arms
// (or disarms) the boulder for it. Aims are this player's own replicated data (`Aim`), which the host reads when the beat drops. In the
// lobby a tap drops a practice stone on this page's own table at once.

/** The seat colour this player uses in the lobby (before the match gives everyone a seat number). */
export const lobbyColor = (id) => hashString(id) % 8;

export const Aiming = defineSystem({
  name: 'lopsided:aim',
  stage: 'input',
  run({ world, game, input, render2d, flow, net, audio, feel }) {
    if (!input || servicesOf(game).poster?.active) return;
    const beat = world.resource(Beat);
    const clock = world.resource(RoundClock);
    const me = net?.me ?? 'me';
    const seat = clock.live ? mySeat(world, me) : undefined;
    const hand = seat?.get(Hand);
    const aim = seat?.get(Aim);

    if (input.pressed('boulder')) {
      if (flow.phase === 'lobby' || (hand?.boulder && clock.live)) {
        beat.armed = !beat.armed;
        audio?.play(beat.armed ? 'powerup.shield' : 'ui.toggle', { volume: 0.7 });
        if (aim && clock.phase === 'aim' && aim.beat === clock.beat && clock.left > BEATS.lock) aim.heavy = beat.armed;
      }
    }
    if (hand && !hand.boulder) beat.armed = false;

    // A press on the table aims there; keeping the finger (or button) down and dragging moves the aim.
    const pointer = input.pointer('aim');
    if (!pointer || !render2d || !(pointer.pressed || (pointer.down && beat.dragging))) {
      if (!pointer?.down) beat.dragging = false;
      return;
    }
    const at = { x: 0, y: 0 };
    if (!render2d.screenToWorld(pointer.x, pointer.y, at)) return;
    if (pointer.pressed && Math.hypot(at.x, at.y) > TABLE.radius + 0.8) return;
    const spot = clampAim(at.x, at.y);
    const fresh = pointer.pressed;

    if (flow.phase === 'lobby' && sandboxOf(world)) {
      if (!fresh) return;
      const stone = sandboxDrop(world, lobbyColor(me), spot.x, spot.y, beat.armed);
      if (stone) {
        beat.armed = false;
        audio?.play('ui.click', { volume: 0.6 });
      }
      return;
    }
    if (!aim || clock.phase !== 'aim' || clock.left <= BEATS.lock) return;
    beat.dragging = true;
    aim.x = spot.x;
    aim.y = spot.y;
    aim.heavy = beat.armed && !!hand?.boulder;
    aim.beat = clock.beat;
    beat.aimed = true;
    if (fresh) {
      audio?.play('ui.click', { pitch: 1.1 });
      feel?.particles.burst('sparks', spot, { count: 6, scale: 0.5 });
    }
  },
});

/** The aim marker: this player's next stone, see-through, until the drop. Its ring turns while you can still move it, and stops when locked. */
export const GhostLook = defineSystem({
  name: 'lopsided:ghost',
  stage: 'update',
  queries: { ghosts: [Ghost, Transform, Shape2D] },
  run({ queries, world, game, net, time }) {
    if (servicesOf(game).poster?.active) return;
    const clock = world.resource(RoundClock);
    const seat = clock.live ? mySeat(world, net?.me ?? 'me') : undefined;
    let ghost = queries.ghosts.first();
    if (seat && !ghost) ghost = spawnGhost(world, seat.get(Seat).index);
    if (!ghost) return;
    const aim = seat?.get(Aim);
    const tr = ghost.get(Transform);
    const showing = !!aim && clock.phase === 'aim' && aim.beat === clock.beat;
    if (!showing) {
      tr.scale.set(0, 0, 1);
      return;
    }
    const locked = clock.left <= BEATS.lock;
    const size = aim.heavy ? 1.5 : 1;
    const pulse = locked ? 1 : 1 + 0.06 * Math.sin(time.now * 9);
    tr.position.set(aim.x, aim.y, 0);
    tr.scale.set(size * pulse, size * pulse, 1);
    const ring = world.entity(ghost.get(Ghost).ring);
    if (ring) {
      quat.fromAngleZ(ring.get(Transform).rotation, locked ? 0 : time.now * 1.6);
      ring.get(Shape2D).dash = locked ? 0 : 0.35;
    }
  },
});
