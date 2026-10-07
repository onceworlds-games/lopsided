import { defineModule } from '@onceworlds/engine';
import { UI, servicesOf } from '@onceworlds/engine/modules';
import { Floor } from './components.js';
import { symbolPoints } from './look.js';
import { aliveCount } from './queries.js';
import { COLORS, TILE_COLORS } from './theme.js';

// The HUD is what a runner needs to answer "what do I do?" and "am I still in?": the called colour (its name, its shape, the time left)
// and how many are still in. The title, countdown, banner, scoreboard and podium are the engine's own screens.

/** What the HUD shows right now, as plain data (the tests read it too). */
export function hudState(world) {
  const floor = world.resource(Floor);
  const total = floor.t + floor.left;
  return {
    phase: floor.phase,
    target: floor.target,
    fraction: total > 0 ? floor.left / total : 0,
    alive: aliveCount(world),
  };
}

/** A shape drawn in a square of the UI: the symbol of a colour. */
const symbol = (kind, color) =>
  UI.custom({
    w: 40,
    h: 40,
    draw(painter, rect) {
      const flat = symbolPoints(kind, rect.w * 0.42).flatMap(([x, y]) => [rect.x + rect.w / 2 + x, rect.y + rect.h / 2 - y]);
      painter.polygon(flat, { fill: color, stroke: COLORS.ink, strokeWidth: 3 });
    },
  });

/** The HUD as a UI tree. */
export function hudTree(state) {
  const color = TILE_COLORS[state.target % TILE_COLORS.length];
  const calling = state.phase === 'show';
  return UI.panel(
    { pad: [6, 14], gap: 4, align: 'center', radius: 16 },
    UI.row(
      { gap: 10, align: 'center' },
      calling && symbol(state.target, color.fill),
      state.phase === 'idle' && UI.label('GET READY', { size: 26, color: 'accent' }),
      calling && UI.label(color.name, { size: 30, color: color.fill }),
      state.phase === 'drop' && UI.label('DROP!', { size: 30, color: COLORS.bad }),
      state.phase === 'rest' && UI.label('NEXT', { size: 26, color: 'dim' }),
      UI.label(`${state.alive} IN`, { size: 20, color: 'dim', outline: false }),
    ),
    calling && UI.bar(state.fraction, { w: 160, h: 8, fill: color.fill }),
  );
}

export const PartyUI = () =>
  defineModule({
    name: 'party-ui',
    init(game) {
      const { ui } = servicesOf(game);
      // Under the round and the clock (the standard `flow.hud`), which sit at the top centre.
      ui.view('party:hud', ({ world }) => hudTree(hudState(world)), {
        anchor: 'top',
        offset: [0, 58],
        order: 4,
        // (A poster is a staged scene with no round on: the HUD stays out of it.)
        when: ({ flow }) => flow !== null && flow.phase === 'playing' && !servicesOf(game).poster?.active,
      });
    },
  });
