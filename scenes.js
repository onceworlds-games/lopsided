import { Transform, defineSystem, hashString } from '@onceworlds/engine';
import { Demo, Look, Runner, Status } from './components.js';
import { buildFloor } from './level.js';
import { poseRunner, puppet } from './look.js';
import { aliveCount, runnersOf } from './queries.js';
import { HALF, ROUND_SECONDS, roundIsOver, roundScore } from './rules.js';

// What happens where: the title screen's demo, the lobby, and the rules of a round that Flow runs. Flow calls these on the right page at
// the right time (see game.config.js); what a scene spawns is removed when the scene ends.

/** A runner's components. The same list builds players, bots and lobby avatars; the systems dress and equip them on each page. */
export const runnerParts = (id, color, x, y) => [Transform({ position: [x, y, 0] }), Runner({ id, color }), Status()];

/** Seats start on a ring around the middle of the floor. */
export function startPoint(index, count) {
  const angle = Math.PI / 2 + (index / Math.max(1, count)) * Math.PI * 2;
  return { x: Math.cos(angle) * HALF.x * 0.55, y: Math.sin(angle) * HALF.y * 0.55 };
}

// ---------------------------------------------------------------- title: the game alive behind the Play button

export function titleScene(ctx) {
  buildFloor(ctx.world);
  for (let i = 0; i < 4; i++) puppet(ctx.world, { id: `bot:${i + 1}`, color: i }).add(Demo({ phase: i * 1.7, speed: 0.6 + i * 0.12 }));
}

/** Four runners wander the floor while the tiles fall around them. */
export const DemoRun = defineSystem({
  name: 'party:demo',
  stage: 'update',
  query: [Demo, Look, Transform],
  run({ query, world, time }) {
    query.each((entity, demo, look, tr) => {
      const t = time.now * demo.speed + demo.phase;
      tr.position.set(Math.sin(t * 0.9) * HALF.x * 0.7, Math.sin(t * 1.3 + demo.phase) * HALF.y * 0.7, 0);
      poseRunner(world, entity, look, false, time.now);
    });
  },
});

// ---------------------------------------------------------------- lobby: run about while the others ready up

export function lobbyScene(ctx) {
  buildFloor(ctx.world);
}

/** Your own runner in the lobby, somewhere near the middle (the same spot every time for the same player). */
export function lobbySpawn(ctx) {
  const id = ctx.room?.me.id ?? 'me';
  const angle = (hashString(id) % 628) / 100;
  return runnerParts(id, hashString(id) % 8, Math.cos(angle) * 2.5, Math.sin(angle) * 2);
}

// ---------------------------------------------------------------- the round

export const roundRules = {
  banner: 'STAND ON THE COLOR',
  seconds: ROUND_SECONDS,
  setup(ctx) {
    buildFloor(ctx.world);
  },
  spawn(ctx, seat) {
    const at = startPoint(seat.index, ctx.seats.length);
    return runnerParts(seat.id, seat.index, at.x, at.y);
  },
  isOver(ctx) {
    return roundIsOver(aliveCount(ctx.world), ctx.seats.length);
  },
  /** Best first: still in beats out, and the later out the better. Those who fell together share a place. */
  rank(ctx) {
    const scores = {};
    runnersOf(ctx.world).each((_entity, runner, status) => {
      scores[runner.id] = roundScore(status);
    });
    return scores;
  },
  /** The winner of a round gets a "wins" stat for the awards. */
  end(ctx, outcome) {
    for (const id of outcome[0] ?? []) ctx.flow.stat('wins', 1, id);
  },
};
