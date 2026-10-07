import { Transform } from '@onceworlds/engine';
import { Runner, Status } from './components.js';

// Queries that code outside systems needs (round rules, the HUD): made once per world, then reused.

const cache = new WeakMap();

/** Every runner, with whether it is still in. */
export function runnersOf(world) {
  let query = cache.get(world);
  if (!query) cache.set(world, (query = world.query([Runner, Status, Transform])));
  return query;
}

/** Runners still in. */
export function aliveCount(world) {
  let n = 0;
  runnersOf(world).each((_entity, _runner, status) => void (status.out || n++));
  return n;
}
