import { Transform, hashString } from '@onceworlds/engine';
import { Aim, Board, Hand, Seat } from './components.js';
import { roundScores } from './systems/host.js';
import { startSandbox } from './systems/sandbox.js';
import { lobbyColor } from './systems/aim.js';
import { buildTable } from './table.js';
import { plainStones } from './queries.js';
import { RINGS, TABLE, roundLength, seatPlace, stiffnessFor } from './rules.js';

// What happens where: the title's demo, the lobby, and the rules of a round that Flow runs. Flow calls these on the right page at the
// right time (see game.config.js); what a scene spawns is removed when the scene ends.

/** A seat's components: where it sits round the table, who it is, its aim and its hand. Players and bots alike. */
export const seatParts = (seat, count) => {
  const at = seatPlace(seat.index, count);
  return [Transform({ position: [at.x, at.y, 0] }), Seat({ id: seat.id, index: seat.index }), Aim(), Hand()];
};

// ---------------------------------------------------------------- title: the game alive behind the Play button

export function titleScene(ctx) {
  buildTable(ctx.world);
  startSandbox(ctx.world, 'demo');
}

// ---------------------------------------------------------------- lobby: practise on your own table while the others ready up

export function lobbyScene(ctx) {
  buildTable(ctx.world);
  startSandbox(ctx.world, 'practice');
}

/** Your own puck in the lobby, somewhere round the table (the same spot every time for the same player): everyone sees who is here. */
export function lobbySpawn(ctx) {
  const id = ctx.room?.me.id ?? 'me';
  const at = seatPlace(hashString(id) % 16, 16);
  return [Transform({ position: [at.x, at.y, 0] }), Seat({ id, index: lobbyColor(id) })];
}

// ---------------------------------------------------------------- the round

/** The last round's points, kept by the host between `rank` and the scoring's `award`. */
const lastRound = new WeakMap();

export const roundRules = {
  banner: 'KEEP YOUR STONES ON',
  seconds: Math.ceil(roundLength() + 6),
  setup(ctx) {
    buildTable(ctx.world);
  },
  populate(ctx) {
    ctx.world.spawn([Transform(), Board({ k: stiffnessFor(ctx.seats.length) })], { owner: 'host' });
  },
  spawn(ctx, seat) {
    return seatParts(seat, ctx.seats.length);
  },
  isOver(ctx) {
    return ctx.elapsed >= roundLength();
  },
  /** Points for the round: what each seat has on the table (rim 3, ring 2, middle 1). Higher is better. */
  rank(ctx) {
    const scores = roundScores(ctx.world, ctx.seats);
    lastRound.set(ctx.world, scores);
    return scores;
  },
  /** Stats for the awards: stones kept, and stones kept on the rim. */
  end(ctx) {
    const rim = {};
    const kept = {};
    const edge = RINGS[RINGS.length - 2].upTo * TABLE.radius;
    for (const s of plainStones(ctx.world)) {
      kept[s.seat] = (kept[s.seat] ?? 0) + 1;
      if (Math.hypot(s.x, s.y) > edge) rim[s.seat] = (rim[s.seat] ?? 0) + 1;
    }
    for (const seat of ctx.seats) {
      if (rim[seat.index]) ctx.flow.stat('rim', rim[seat.index], seat.id);
      if (kept[seat.index]) ctx.flow.stat('kept', kept[seat.index], seat.id);
    }
  },
};

/** The match's points are the rounds' points (not places): what the host worked out in `rank`. */
export const roundPoints = (_ranking, ctx) => lastRound.get(ctx.world) ?? roundScores(ctx.world, ctx.seats);
