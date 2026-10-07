import { defineSystem } from '@onceworlds/engine';
import { servicesOf } from '@onceworlds/engine/modules';
import { RoundClock } from '../components.js';
import { clockAt } from '../rules.js';

/** The last round of a match of more than one counts double: the comeback is always on. */
export const isFinalRound = (ctx) => ctx.rounds > 1 && ctx.round === ctx.rounds;

// The round's clock, on every page: a pure function of the seconds since the round began (the match clock, the same on every page), so a
// page that reloads or becomes the host simply carries on. Outside a round it says so (`live` false).

export const Clock = defineSystem({
  name: 'lopsided:clock',
  stage: 'fixed',
  run({ world, game, flow }) {
    const clock = world.resource(RoundClock);
    if (servicesOf(game).poster?.active) return;
    if (flow.phase !== 'playing') {
      clock.live = false;
      clock.phase = 'none';
      return;
    }
    const now = flow.context();
    const at = clockAt(now.elapsed);
    clock.live = true;
    clock.key = now.rid;
    clock.phase = at.phase;
    clock.beat = at.beat;
    clock.t = at.t;
    clock.left = at.left;
    clock.length = at.length;
    clock.elapsed = now.elapsed;
    clock.double = isFinalRound(now);
  },
});
