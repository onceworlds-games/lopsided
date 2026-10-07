import { Audio, Awards, Bot, Feel, Flow, Input, Net, Render2D, UI } from '@onceworlds/engine/modules';
import { actions } from './actions.js';
import { BotBrain } from './bots.js';
import { Beat, Floor, Judged, Runner, Status } from './components.js';
import { DemoRun, lobbyScene, lobbySpawn, roundRules, runnerParts, startPoint, titleScene } from './scenes.js';
import { Dress, Equip } from './systems/equip.js';
import { FloorFeel, Music, RunnerLook } from './systems/feedback.js';
import { CameraFit, FloorClock, TileLook } from './systems/floor.js';
import { Drive, Move } from './systems/move.js';
import { Referee } from './systems/referee.js';
import { PartyPosters } from './posters.js';
import { COLORS, FONT, TITLE, theme } from './theme.js';
import { PartyUI } from './ui.js';

// The whole game, as the config `createGame` takes. Nothing happens when this file is imported: main.js starts it and the tests
// build it with options. Read it top to bottom: modules (what the engine gives us), Flow (the match: title, lobby, rounds, podium),
// then our systems.

/**
 * Options (all optional): `fill` seats filled with bots (default 6), `rounds` the lobby's default number of rounds, `friends` a private
 * server where the host starts the match, `quick` short pauses between screens (tests), `seed`, `poster` and `render` (tests: a fake
 * page address, a fake canvas).
 */
export function gameConfig(options = {}) {
  return {
    space: '2d',
    seed: options.seed,
    modules: [
      Render2D({ font: FONT, background: COLORS.water, poster: options.poster, ...options.render }),
      Feel(),
      Input({ actions }),
      Audio(),
      UI({ title: TITLE, theme }),
      // Only the data listed here crosses the network.
      Net({ components: [Runner, Status, Bot] }),
      Flow.rounds({
        join: { maxPlayers: 8 },
        friends: options.friends,
        // Somebody who arrives mid-round (a friends server leaves its door open) watches, then plays from the next round. A public server's door is shut.
        admit: 'round',
        title: { logo: TITLE, scene: titleScene },
        lobby: { scene: lobbyScene, spawn: lobbySpawn, hint: 'Run to the called color' },
        settings: [{ id: 'rounds', label: 'Rounds', options: [1, 3, 5], default: options.rounds ?? 3 }],
        // Empty seats are filled with bots, so a lone player gets the whole game.
        roster: {
          fill: options.fill ?? 6,
          bot: (ctx, seat) => {
            const at = startPoint(seat.index, ctx.seats.length);
            return runnerParts(seat.id, seat.index, at.x, at.y);
          },
        },
        round: roundRules,
        // Points for each place in a round; the match is the lobby's number of rounds.
        scoring: Flow.placePoints([6, 4, 3, 2, 1]),
        results: { awards: [Awards.most('Iron feet', 'waves'), Awards.most('Round wins', 'wins')] },
        timing: options.quick ? { banner: 0.4, roundEnd: 0.4, scoreboard: 0.4, results: 3 } : undefined,
      }),
      PartyUI(),
      // Store art: `?poster=cover` builds a staged picture instead of the game (Render2D provides `game.poster`).
      PartyPosters(),
    ],
    resources: [Floor(), Beat(), Judged()],
    // The game itself is built by Flow's scenes (the title, the lobby, each round); these systems run through all of them.
    systems: [Dress, Equip, Drive, Move, BotBrain, FloorClock, Referee, FloorFeel, Music, TileLook, RunnerLook, CameraFit, DemoRun],
  };
}

/** The ready config: what `createGame` takes (main.js starts it), next to the Input action map. */
export const config = gameConfig();
/** A short version for `onceworlds check`: one short round, short screens and timers, so a simulated match reaches its results. */
export const quick = gameConfig({ quick: true, rounds: 1 });
export { actions };
