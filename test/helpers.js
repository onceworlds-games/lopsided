import { Transform } from '@onceworlds/engine';
import { FlowState, netOf, servicesOf } from '@onceworlds/engine/modules';
import { simulate } from '@onceworlds/engine/test';
import { Floor, Runner, Status } from '../components.js';
import { gameConfig } from '../game.config.js';
import { RUNNER, nearestSafe, tileAt } from '../rules.js';

// Small helpers the party tests share. They read the game the way a player's page would and press buttons through the Input service.

export const phaseOf = (game) => game.world.resource(FlowState).phase;
export const floorOf = (game) => game.world.resource(Floor);
export const inputOf = (game) => servicesOf(game).input;

/** The entity of a runner on this page, or undefined while the page has not seen it yet. */
export function runnerOn(game, id) {
  let found;
  game.world.query([Runner]).each((entity, runner) => void (runner.id === id && (found = entity)));
  return found;
}

/** Every runner on a page as plain rows. */
export function runnersOn(game) {
  const rows = [];
  game.world.query([Runner, Status, Transform]).each((entity, runner, status, tr) => {
    rows.push({ id: runner.id, entity, x: tr.position.x, y: tr.position.y, out: status.out });
  });
  return rows;
}

/** Put a runner exactly here (on the page that plays it: that page owns its position). */
export function place(game, id, x, y) {
  const entity = runnerOn(game, id);
  entity.get(Transform).position.set(x, y, 0);
  netOf(game).teleport(entity);
  return entity;
}

/**
 * A timeline for `simulate`'s `onFrame`: each step `[t, fn]` runs once, `t` seconds after every page is playing a round. Steps get the
 * running simulation (`run.games[0]` is the first player, who is the host). `each` runs every frame once play has begun.
 */
export function timeline(steps, each) {
  let since = null;
  let next = 0;
  return (run) => {
    if (since === null) {
      if (!run.games.every((game) => phaseOf(game) === 'playing')) return;
      since = run.seconds;
    }
    const t = run.seconds - since;
    while (next < steps.length && t >= steps[next][0]) steps[next++][1](run, t);
    each?.(run, t);
  };
}

/** Two players (ann is the host, bo the other) in a one-round match with no bots, over a slow network. Steps are a `timeline`. */
export function duel(steps, until, { each, ...options } = {}) {
  return simulate(gameConfig({ quick: true, rounds: 1, fill: 0 }), {
    humans: 2,
    seed: 5,
    latency: 30,
    seconds: 150,
    until,
    onFrame: timeline(steps, each),
    ...options,
  });
}

/**
 * Plays every human page like a decent player: when a colour is called, run to the nearest tile of it (dashing when short of time) and
 * stand there. Use it as (part of) `onFrame`. Pages that are not in a round, or whose runner is not here yet, are left alone.
 */
export function players(run) {
  for (const game of run.games) {
    if (!game.room || phaseOf(game) !== 'playing') continue;
    const me = runnersOn(game).find((r) => r.id === game.room.me.id);
    if (!me) continue;
    const input = inputOf(game);
    const floor = floorOf(game);
    if (floor.phase !== 'show' || me.out) {
      if (floor.phase !== 'show') input.setAxis('move', 0, 0);
      continue;
    }
    const goal = nearestSafe(me.x, me.y, floor.tiles, floor.target);
    const here = tileAt(me.x, me.y);
    if (!goal || (here && floor.tiles[here.index] === floor.target)) {
      input.setAxis('move', 0, 0);
      continue;
    }
    const d = Math.hypot(goal.x - me.x, goal.y - me.y) || 1;
    // The stick's y points down on screen, so up on the map is -1.
    input.setAxis('move', (goal.x - me.x) / d, -(goal.y - me.y) / d);
    if (d / RUNNER.speed > floor.left && run.frames % 5 === 0) input.tap('dash');
  }
}
