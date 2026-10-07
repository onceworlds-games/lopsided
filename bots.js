import { hashString } from '@onceworlds/engine';
import { defineBotSystem } from '@onceworlds/engine/modules';
import { Aim, Board, Hand, RoundClock, Seat } from './components.js';
import { boardOf, plainStones, seatsOf } from './queries.js';
import { BEATS, clampAim } from './rules.js';
import { STRATEGIES } from './strategy.js';

// Bots play like people: each takes a moment into the beat to look at the table (sharper bots decide sooner), then aims with the same
// reading of the table the balance tool tests (strategy.js). Each has a personality from its seat: most play `smart` (their own points,
// minding the others a little), some are saboteurs (they go after the leader), and every decision can slip into a greedy or careless
// drop (the bot's `mistake`). Their aim wobbles by their `aimNoise`, and a sharp bot sometimes changes its mind late in the beat.
// Bots write `Aim` exactly like a player's tap does, so the host drops their stones the same way.

const STYLE_BY_SEAT = ['smart', 'saboteur', 'smart', 'smart', 'saboteur', 'smart', 'climber', 'smart'];
const SLIPS = ['greedy', 'random', 'climber', 'turtle'];

/** What the bot can see: the stones on the table, the lean, whose turn it is. */
function viewFor(world, seat, hand, clock) {
  const board = boardOf(world)?.get(Board);
  return {
    seat: seat.index,
    stones: plainStones(world),
    tilt: board ? { x: board.x, y: board.y } : { x: 0, y: 0 },
    k: board?.k,
    beat: clock.beat,
    beats: BEATS.perRound,
    boulder: hand.boulder,
    others: Math.max(1, seatsOf(world).count() - 1),
  };
}

function gauss(rng) {
  return (rng.float(-1, 1) + rng.float(-1, 1) + rng.float(-1, 1)) / 1.5;
}

export const BotBrain = defineBotSystem({
  name: 'lopsided:bots',
  query: [Seat, Aim, Hand],
  think(ctx, bot, seat, aim, hand) {
    const clock = ctx.world.resource(RoundClock);
    if (!clock.live || clock.phase !== 'aim') return;
    const rng = ctx.rng;
    const state = bot.state && typeof bot.state === 'object' ? bot.state : (bot.state = {});
    if (state.beat !== clock.beat || state.key !== clock.key) {
      // A new beat: when to decide (a moment to look; sharper bots are quicker, never after the lock).
      Object.assign(state, { beat: clock.beat, key: clock.key, decided: aim.beat === clock.beat, changed: false, wait: Math.min(clock.length - 0.6, rng.float(0.5, 2.2) * (1.3 - bot.skill * 0.6)) });
    }
    if (clock.left <= BEATS.lock + 0.05) return;
    const late = state.decided && !state.changed && clock.left < 1.1 && rng.chance(0.25 * bot.skill);
    if ((state.decided && !late) || clock.t < state.wait) return;

    const style = rng.chance(bot.mistake) ? SLIPS[Math.floor(rng.float(0, SLIPS.length - 0.001))] : STYLE_BY_SEAT[hashString(seat.id) % STYLE_BY_SEAT.length];
    const pick = STRATEGIES[style](viewFor(ctx.world, seat, hand, clock), rng);
    const wobble = 0.6 + bot.aimNoise * 4;
    const at = clampAim(pick.x + gauss(rng) * wobble, pick.y + gauss(rng) * wobble);
    aim.x = at.x;
    aim.y = at.y;
    aim.heavy = !!pick.heavy && hand.boulder;
    aim.beat = clock.beat;
    if (state.decided) state.changed = true;
    state.decided = true;
  },
});
