import { Transform } from '@onceworlds/engine';
import { FlowState, servicesOf } from '@onceworlds/engine/modules';
import { simulate } from '@onceworlds/engine/test';
import { Aim, Board, Hand, RoundClock, Seat, Stone } from '../components.js';
import { gameConfig } from '../game.config.js';

// Small helpers the tests share. They read a game the way a player's page would.

export const phaseOf = (game) => game.world.resource(FlowState).phase;
export const clockOf = (game) => game.world.resource(RoundClock);
export const inputOf = (game) => servicesOf(game).input;

/** This page's entity for seat `id` (a match seat, with its Hand), or undefined. */
export function seatOn(game, id) {
  let found;
  game.world.query([Seat, Aim, Hand]).each((entity, seat) => void (seat.id === id && (found = entity)));
  return found;
}

/** The round's Board on this page, as plain data (or null before it arrives). */
export function boardOn(game) {
  let found = null;
  game.world.query([Board]).each((_e, b) => void (found ??= { x: b.x, y: b.y, dropped: b.dropped, fell: b.fell, tipper: b.tipper, tipFell: b.tipFell }));
  return found;
}

/** Every stone on a page as plain rows. */
export function stonesOn(game) {
  const rows = [];
  game.world.query([Stone, Transform]).each((entity, stone, tr) => {
    rows.push({ entity, seat: stone.seat, beat: stone.beat, heavy: stone.heavy, gone: stone.gone, x: tr.position.x, y: tr.position.y });
  });
  return rows;
}

/**
 * Humans who play: on every human page, once a beat has been on for `delay` seconds and this page has not aimed in it, aim where
 * `plan(page, beat, round)` says ({ x, y, heavy }). Use it as (part of) `onFrame`.
 */
export function aimers(plan, delay = 0.5) {
  return (run) => {
    for (const game of run.games) {
      if (!game.room || phaseOf(game) !== 'playing') continue;
      const clock = clockOf(game);
      if (!clock.live || clock.phase !== 'aim' || clock.t < delay) continue;
      const seat = seatOn(game, game.room.me.id);
      if (!seat) continue;
      const aim = seat.get(Aim);
      if (aim.beat === clock.beat) continue;
      const want = plan(game, clock.beat, game.world.resource(FlowState).round);
      aim.x = want.x;
      aim.y = want.y;
      aim.heavy = !!want.heavy;
      aim.beat = clock.beat;
    }
  };
}

/** A human who drops on the rim, going round the table beat by beat, and arms the boulder on the last beat. */
export const rimmer = aimers((game, beat) => {
  const a = beat * 0.8 + (game.room.me.id.length % 3);
  return { x: Math.cos(a) * 8.6, y: Math.sin(a) * 8.6, heavy: beat === 7 };
});

/** A match with `humans` players and bots, one round, short screens. */
export function match(options = {}, sim = {}) {
  const { humans = 1, bots = 3, rounds = 1, ...rest } = options;
  return simulate(gameConfig({ quick: true, rounds, fill: humans + bots, ...rest }), { humans, bots, seed: 3, seconds: 400, onFrame: rimmer, until: (r) => r.matches > 0, ...sim });
}
