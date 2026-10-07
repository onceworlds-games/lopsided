import { Transform, defineSystem } from '@onceworlds/engine';
import { servicesOf } from '@onceworlds/engine/modules';
import { LocalStone, Stone } from '../components.js';
import { STONE, makeStone, stiffnessFor } from '../rules.js';
import { STRATEGIES } from '../strategy.js';
import { levelTable, sortStones, stepFallen, stepStones } from './physics.js';

// The table behind the title and in the lobby, on this page only (nothing here is sent): four demo seats drop stones in turn with the
// bots' own strategies, the table leans and sheds them, and when it has had enough it is swept clean and starts again. In the lobby your
// taps drop stones of your own on it too (systems/aim.js), so you learn the game while the others ready up.

const sandboxes = new WeakMap();

/** Start (or restart) this world's local table. `mode` is 'demo' (the title) or 'practice' (the lobby). */
export function startSandbox(world, mode) {
  const state = { mode, table: levelTable(stiffnessFor(4)), clock: 0, next: 1.2, drops: 0, sweep: -1, id: 0 };
  sandboxes.set(world, state);
  return state;
}

export const sandboxOf = (world) => sandboxes.get(world);

/** Drop a local stone (the demo's, or this player's practice stone). */
export function sandboxDrop(world, seat, x, y, heavy = false) {
  const state = sandboxes.get(world);
  if (!state || state.sweep >= 0) return null;
  const s = makeStone(seat, x, y, heavy);
  state.drops++;
  return world.spawn([Transform({ position: [s.x, s.y, 0] }), Stone({ seat, heavy, beat: 0 }), LocalStone({ id: ++state.id % 60000 })]);
}

const DEMO_SEATS = [0, 1, 2, 3];
const STYLES = ['smart', 'greedy', 'smart', 'climber'];

export const Sandbox = defineSystem({
  name: 'lopsided:sandbox',
  stage: 'fixed',
  queries: { stones: [Stone, Transform, LocalStone] },
  run({ queries, world, game, flow, time, rng }) {
    if (servicesOf(game).poster?.active) return;
    const state = sandboxes.get(world);
    if (!state || (flow.phase !== 'title' && flow.phase !== 'lobby')) return;
    const dt = time.dt;
    state.clock += dt;
    const { on, off } = sortStones(queries.stones);
    stepStones(state.table, on, dt);
    for (const done of stepFallen(off, dt)) world.despawn(done);

    // Sweep the table clean once it is crowded (or the demo has run its course), then start again.
    if (state.sweep < 0 && (on.length > 34 || state.drops > 44)) state.sweep = 0;
    if (state.sweep >= 0) {
      state.sweep += dt;
      for (const { stone, tr } of on) {
        const d = Math.hypot(tr.position.x, tr.position.y) || 1;
        stone.vx = (tr.position.x / d) * 9;
        stone.vy = (tr.position.y / d) * 9;
        stone.gone = dt;
      }
      if (state.sweep > 1.4) {
        Object.assign(state, { table: levelTable(state.table.k), drops: 0, sweep: -1, next: state.clock + 0.8 });
      }
      return;
    }

    // A demo seat drops a stone now and then (more often behind the title, where nobody else is dropping).
    if (state.clock >= state.next) {
      const turn = state.drops % DEMO_SEATS.length;
      const seat = DEMO_SEATS[turn] + (state.mode === 'practice' ? 4 : 0);
      const stones = on.map(({ stone, tr }) => ({ seat: stone.seat, x: tr.position.x, y: tr.position.y, m: stone.heavy ? STONE.boulderMass : STONE.mass, gone: false }));
      const view = { seat, stones, tilt: state.table, k: state.table.k, beat: Math.min(7, Math.floor(state.drops / 4)), beats: 8, boulder: rng('demo').chance(0.06), others: 3 };
      const aim = STRATEGIES[STYLES[turn]](view, rng('demo'));
      sandboxDrop(world, seat, aim.x, aim.y, aim.heavy);
      state.next = state.clock + (state.mode === 'practice' ? 1.8 : 0.75) + rng('demo').float(0, 0.4);
    }
  },
});
