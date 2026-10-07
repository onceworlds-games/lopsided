import { Transform, defineSystem } from '@onceworlds/engine';
import { Floor, Judged, Runner, Status } from '../components.js';
import { WAVE, isSafe, whoFalls } from '../rules.js';

// The referee runs on the host only (`authority: 'host'`): a moment after the other tiles fall, whoever is not standing on the called
// colour is out. It reads where runners are (as the host sees them, which can be a moment late: see `WAVE.margin`), writes `Status`, and
// every page reacts to what it reads. Judging a drop twice is harmless, so a new host that judges the same drop again changes nothing.

export const Referee = defineSystem({
  name: 'party:referee',
  stage: 'fixed',
  authority: 'host',
  queries: { runners: [Runner, Status, Transform] },
  run({ queries, world, flow }) {
    const floor = world.resource(Floor);
    if (flow.phase !== 'playing' || !floor.live || floor.phase !== 'drop' || floor.t < WAVE.judgeAfter) return;
    const judged = world.resource(Judged);
    if (judged.key === floor.key) return;
    judged.key = floor.key;

    const standing = [];
    queries.runners.each((_entity, runner, status, tr) => {
      if (!status.out) standing.push({ id: runner.id, safe: isSafe(tr.position.x, tr.position.y, floor.tiles, floor.target) });
    });
    const falling = new Set(whoFalls(standing));
    const elapsed = flow.context().elapsed;
    queries.runners.each((_entity, runner, status) => {
      if (status.out) return;
      if (falling.has(runner.id)) {
        status.out = true;
        status.outAt = elapsed;
      } else {
        flow.stat('waves', 1, runner.id);
      }
    });
  },
});
