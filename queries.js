import { Transform } from '@onceworlds/engine';
import { Aim, Board, Hand, Seat, Stone } from './components.js';
import { STONE } from './rules.js';

// Queries that code outside systems needs (round rules, the HUD, bots): made once per world, then reused.

const cache = new WeakMap();
function cached(world, key, spec) {
  let all = cache.get(world);
  if (!all) cache.set(world, (all = {}));
  return (all[key] ??= world.query(spec));
}

export const stonesOf = (world) => cached(world, 'stones', [Stone, Transform]);
export const seatsOf = (world) => cached(world, 'seats', [Seat, Aim, Hand, Transform]);
export const boardsOf = (world) => cached(world, 'boards', [Board]);

/** The round's Board entity (host-owned, on every page once it has arrived), or undefined. */
export function boardOf(world) {
  let found;
  boardsOf(world).each((entity) => void (found ??= entity));
  return found;
}

/** The stones on the table as the rules see them (plain objects), leaving out those that fell. */
export function plainStones(world) {
  const out = [];
  stonesOf(world).each((_e, stone, tr) => {
    if (stone.gone > 0) return;
    out.push({ seat: stone.seat, heavy: stone.heavy, beat: stone.beat, x: tr.position.x, y: tr.position.y, vx: stone.vx, vy: stone.vy, m: stone.heavy ? STONE.boulderMass : STONE.mass, r: stone.heavy ? STONE.boulderRadius : STONE.radius, sliding: stone.sliding, gone: false });
  });
  return out;
}

/** This page's own seat entity (in a round), or undefined (watching, or the lobby). */
export function mySeat(world, me) {
  let found;
  seatsOf(world).each((entity, seat) => void (seat.id === me && (found = entity)));
  return found;
}
