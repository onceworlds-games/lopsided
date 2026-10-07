import { Transform, approach, defineSystem } from '@onceworlds/engine';
import { Intent } from '@onceworlds/engine/modules';
import { Motion, Runner } from '../components.js';
import { HALF, RUNNER } from '../rules.js';

// Running is plain maths: there is nothing on this floor to bump into, so no physics. `drive` turns the player's hands into an `Intent`
// (bots write their own), and `move` runs the runner: accelerate toward the stick, dash on the button, stay on the floor.

/** Runners move in the lobby and while playing; the countdown and the banner hold everyone still. */
export const canMove = (phase) => phase === 'playing' || phase === 'lobby';

export const Drive = defineSystem({
  name: 'party:drive',
  stage: 'input',
  query: [Runner, Intent],
  run({ query, input, net, flow }) {
    const live = canMove(flow.phase);
    query.each((entity, _runner, intent) => {
      // Only a human's own runner takes the keys. Bots (host-owned) are driven by bots.js.
      if (net.owner(entity) !== net.me) return;
      const stick = live ? input.axis('move') : { x: 0, y: 0 };
      // The stick's y points down on screen; Intent's points up.
      intent.move.set(stick.x, -stick.y);
      intent.dash = live && (input.held('dash') || input.pressed('dash'));
    });
  },
});

export const Move = defineSystem({
  name: 'party:move',
  stage: 'fixed',
  query: [Runner, Intent, Motion, Transform],
  run({ query, time, flow, feel, audio }) {
    const dt = time.dt;
    const live = canMove(flow.phase);
    query.each((entity, _runner, intent, motion, tr) => {
      let mx = intent.move.x;
      let my = intent.move.y;
      const length = Math.hypot(mx, my);
      if (length > 1) {
        mx /= length;
        my /= length;
      }
      const moving = length > 0.05;
      motion.cooldown = Math.max(0, motion.cooldown - dt);
      const pressed = intent.dash && !motion.dashHeld;
      motion.dashHeld = intent.dash;
      if (live && pressed && moving && motion.cooldown <= 0 && motion.dashLeft <= 0) {
        motion.dashLeft = RUNNER.dashTime;
        motion.cooldown = RUNNER.dashCooldown;
        motion.dashX = mx / Math.max(1, length);
        motion.dashY = my / Math.max(1, length);
        const d = Math.hypot(motion.dashX, motion.dashY) || 1;
        motion.dashX /= d;
        motion.dashY /= d;
        feel?.stretch(entity);
        feel?.particles.burst('dust', entity, { count: 8, direction: Math.atan2(-motion.dashY, -motion.dashX), spread: 0.8 });
        audio?.play('dash', { at: entity });
      }
      if (motion.dashLeft > 0) {
        motion.dashLeft = Math.max(0, motion.dashLeft - dt);
        motion.vx = motion.dashX * RUNNER.dashSpeed;
        motion.vy = motion.dashY * RUNNER.dashSpeed;
      } else {
        const rate = RUNNER.accel * dt;
        motion.vx = approach(motion.vx, mx * RUNNER.speed, rate);
        motion.vy = approach(motion.vy, my * RUNNER.speed, rate);
      }
      // Stay on the floor: the edge is a wall for runners, even though a fall is a tile's business.
      const limitX = HALF.x - RUNNER.radius * 0.5;
      const limitY = HALF.y - RUNNER.radius * 0.5;
      tr.position.x = Math.max(-limitX, Math.min(limitX, tr.position.x + motion.vx * dt));
      tr.position.y = Math.max(-limitY, Math.min(limitY, tr.position.y + motion.vy * dt));
    });
  },
});
