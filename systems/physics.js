import { Transform } from '@onceworlds/engine';
import { Stone } from '../components.js';
import { STONE, TABLE, stepTable } from '../rules.js';

// The bridge between the rules' plain stones and the stone entities: step the table and the stones on it, write the result back. The host
// runs it for the match (systems/host.js), every page runs it for its own table behind the title and in the lobby (systems/sandbox.js).

/**
 * Step `table` ({ x, y, vx, vy, k }) and the stones in `entries` ([{ entity, stone, tr }], all still on the table) by `dt`. Stones
 * that went over the edge start falling (`gone` > 0); returns their entries.
 */
export function stepStones(table, entries, dt) {
  const plain = entries.map(({ stone, tr }) => ({
    seat: stone.seat,
    x: tr.position.x,
    y: tr.position.y,
    vx: stone.vx,
    vy: stone.vy,
    m: stone.heavy ? STONE.boulderMass : STONE.mass,
    r: stone.heavy ? STONE.boulderRadius : STONE.radius,
    sliding: stone.sliding,
    gone: false,
  }));
  stepTable(table, plain, dt);
  const fell = [];
  plain.forEach((p, i) => {
    const { stone, tr } = entries[i];
    if (tr.position.x !== p.x || tr.position.y !== p.y) tr.position.set(p.x, p.y, 0);
    stone.vx = p.vx;
    stone.vy = p.vy;
    stone.sliding = p.sliding;
    if (p.gone) {
      // Over the edge: keep going outward a little faster, and start the fall.
      const d = Math.hypot(p.x, p.y) || 1;
      const speed = Math.max(2.5, Math.hypot(p.vx, p.vy));
      stone.vx = (p.x / d) * speed;
      stone.vy = (p.y / d) * speed;
      stone.gone = dt;
      fell.push(entries[i]);
    }
  });
  return fell;
}

/** Stones that already fell drift out and down for a moment; returns the entities to remove. */
export function stepFallen(entries, dt) {
  const done = [];
  for (const { entity, stone, tr } of entries) {
    stone.gone += dt;
    tr.position.set(tr.position.x + stone.vx * dt, tr.position.y + stone.vy * dt, 0);
    if (stone.gone > FALL_SECONDS) done.push(entity);
  }
  return done;
}

export const FALL_SECONDS = 0.9;

/**
 * Split the stones of a query into those on the table and those falling. `skip` leaves some out (local stones in a match...). A query's
 * views are reused from one entity to the next, so each entry gets views of its own from `entity.get`.
 */
export function sortStones(query, skip) {
  const on = [];
  const off = [];
  query.each((entity, stone) => {
    if (skip?.(entity)) return;
    (stone.gone > 0 ? off : on).push({ entity, stone: entity.get(Stone), tr: entity.get(Transform) });
  });
  return { on, off };
}

export const levelTable = (k = TABLE.stiffness) => ({ x: 0, y: 0, vx: 0, vy: 0, k });
