import { Transform, defineSystem } from '@onceworlds/engine';
import { Avatar2D } from '@onceworlds/engine/modules';
import { Beat, Floor, Look, Runner, Status } from '../components.js';
import { FLOOR, tileCenter } from '../rules.js';
import { poseRunner } from '../look.js';
import { COLORS, LAYERS, SPLASH } from '../theme.js';

// Every action answers within a tenth of a second, on every page. Nothing here decides anything: each page watches the floor and the
// replicated `Status`, compares them with what it already showed (`Beat`, `Look`) and plays the effect once.
//
//   floor-feel   - a bell when a colour is called, a tick each second before a drop, the drop itself (sound, shake, a splash where
//                  tiles fell), the floor coming back.
//   runner-look  - depth, and the pale floating ghost of a runner who is out, with a pop and "OUT" the moment it happens.
//   music        - from the asset library: calm before the match, bouncy while it is on.

export const FloorFeel = defineSystem({
  name: 'party:floor-feel',
  stage: 'update',
  run({ world, feel, audio }) {
    const floor = world.resource(Floor);
    const beat = world.resource(Beat);
    const changed = beat.id !== floor.key || beat.phase !== floor.phase;
    if (changed) {
      const first = beat.id === '';
      beat.id = floor.key;
      beat.phase = floor.phase;
      beat.tick = -1;
      if (!first && floor.live) {
        if (floor.phase === 'show') audio?.play('bell');
        if (floor.phase === 'drop') {
          feel.shake(0.35);
          audio?.play('water.splash');
          // A splash where each tile dropped into the water, not on the safe ones.
          floor.tiles.forEach((color, index) => {
            if (color === floor.target) return;
            const at = tileCenter(index % FLOOR.cols, Math.floor(index / FLOOR.cols));
            feel.particles.burst(SPLASH, at, { count: 4, layer: LAYERS.fx });
          });
        }
        if (floor.phase === 'rest') audio?.play('ui.popup');
      }
    }
    // A tick for each of the last three seconds before the drop, so nobody is surprised.
    if (floor.live && floor.phase === 'show') {
      const second = Math.ceil(floor.left);
      if (second <= 3 && second !== beat.tick) {
        beat.tick = second;
        audio?.play('timer.tick', { pitch: 1 + (3 - second) * 0.12 });
      }
    }
  },
});

export const RunnerLook = defineSystem({
  name: 'party:runner-look',
  stage: 'update',
  query: [Runner, Status, Look, Transform],
  run({ query, world, time, feel, audio, net }) {
    query.each((entity, _runner, status, look, tr) => {
      poseRunner(world, entity, look, status.out, time.now);
      if (status.out && !look.out) {
        look.out = true;
        const { x, y } = tr.position;
        feel.particles.burst(SPLASH, entity, { layer: LAYERS.fx });
        feel.floatText('OUT', { x, y: y + 2.2 }, { color: COLORS.bad, size: 1.1, layer: LAYERS.fx });
        const figure = world.entity(look.figure);
        const body = figure && Avatar2D.body(figure);
        if (body) feel.pop(body, { from: 0.2 });
        const mine = net.owner(entity) === net.me;
        audio?.play(mine ? 'stinger.lose' : 'water.splash', { at: entity, volume: 0.7 });
        if (mine) feel.shake(0.4);
      }
    });
  },
});

export const Music = defineSystem({
  name: 'party:music',
  stage: 'update',
  run({ flow, audio }) {
    const song = flow.phase === 'title' || flow.phase === 'lobby' || flow.phase === 'results' ? 'music.calm' : 'music.happy';
    if (audio && audio.music.current !== song) audio.music.play(song);
  },
});
