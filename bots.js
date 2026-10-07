import { Transform } from '@onceworlds/engine';
import { FlowState, Intent, defineBotSystem, seek, slips } from '@onceworlds/engine/modules';
import { Floor, Motion, Runner, Status } from './components.js';
import { HALF, RUNNER, nearestSafe } from './rules.js';

// Bots play like people: they notice the called colour a moment late (their `reaction`), usually run to the nearest tile of it, sometimes
// pick the second nearest or freeze, and use their dash only when they are running out of time. Each has its own skill. They are
// host-owned runners, so their brains run on the host and move with it if the host changes.
//
//   think - now and then (every reaction time): look at the floor and choose where to stand.
//   act   - every step: run there, and stop on arrival.
//
// The bot writes `Intent` exactly like the input system does for a player.

const idle = () => ({ goal: null, dash: 0 });

export const BotBrain = defineBotSystem({
  name: 'party:bots',
  query: [Runner, Status, Transform, Intent, Motion],
  think(ctx, bot, _runner, status, tr, _intent, motion) {
    const world = ctx.world;
    if (world.resource(FlowState).phase !== 'playing' || status.out) {
      bot.state = idle();
      return;
    }
    const floor = world.resource(Floor);
    const here = tr.position;
    if (floor.phase === 'show') {
      // The nearest tile of the called colour; a bot that slips takes the second nearest (or, when it is hurrying, stays where it is).
      const wrong = slips(bot, ctx.rng);
      const goal = nearestSafe(here.x, here.y, floor.tiles, floor.target, wrong ? 1 : 0);
      if (!goal || (wrong && floor.left < 1.2 && ctx.rng.chance(0.5))) {
        bot.state = idle();
        return;
      }
      // Dash only when walking would be too slow: more distance than the time left allows.
      const needed = goal.distance / RUNNER.speed;
      bot.state = { goal: { x: goal.x, y: goal.y }, dash: motion.cooldown <= 0 && needed > floor.left * 0.85 ? 1 : 0 };
      return;
    }
    if (floor.phase === 'drop') {
      // Stand still on the safe tile and wait for the floor to come back.
      bot.state = { goal: bot.state?.goal ?? null, dash: 0 };
      return;
    }
    // Between waves: spread out toward the middle, each bot to its own side so they don't all stand in one place.
    const side = (ctx.entity.id % 5) - 2;
    bot.state = { goal: { x: side * (HALF.x / 3) + ctx.rng.float(-1, 1), y: ctx.rng.float(-HALF.y / 2, HALF.y / 2) }, dash: 0 };
  },
  act(_ctx, bot, _runner, _status, tr, intent) {
    const state = bot.state ?? idle();
    const move = [0, 0];
    let arrived = true;
    if (state.goal) {
      const distance = Math.hypot(state.goal.x - tr.position.x, state.goal.y - tr.position.y);
      arrived = distance < 0.3;
      if (!arrived) seek(move, [tr.position.x, tr.position.y], [state.goal.x, state.goal.y], Math.min(1, distance / 0.8));
    }
    intent.move.set(move[0], move[1]);
    // A button is a held state: hold it for a few steps so the controller sees a press, then let go.
    intent.dash = state.dash > 0;
    state.dash = Math.max(0, state.dash - 0.2);
  },
});
