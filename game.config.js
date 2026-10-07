import { Audio, Awards, Bot, Feel, Flow, Input, Net, Render2D, UI } from '@onceworlds/engine/modules';
import { actions } from './actions.js';
import { BotBrain } from './bots.js';
import { Aim, Beat, Board, Callout, Hand, RoundClock, Seat, Stone } from './components.js';
import { Posters } from './posters.js';
import { lobbyScene, lobbySpawn, roundPoints, roundRules, seatParts, titleScene } from './scenes.js';
import { Aiming, GhostLook } from './systems/aim.js';
import { Clock } from './systems/clock.js';
import { BeatFeel, Music } from './systems/feedback.js';
import { HostDrop, HostPhysics } from './systems/host.js';
import { CameraFit, DressSeats, DressStones, SeatLayout, SeatLooks, StoneMotion, TableLook } from './systems/looks.js';
import { Sandbox } from './systems/sandbox.js';
import { COLORS, FONT, TITLE, theme } from './theme.js';
import { GameUI } from './ui.js';

// The whole game, as the config `createGame` takes. Nothing happens when this file is imported: main.js starts it and the tests build
// it with options. Read it top to bottom: modules (what the engine gives us), Flow (the match: title, lobby, rounds, podium), then our
// systems in the order they run.

/**
 * Options (all optional): `fill` seats filled with bots (default 6), `rounds` the lobby's default number of rounds, `friends` a private
 * server where the host starts the match, `quick` short pauses between screens (tests), `seed`, `poster` and `render` (tests: a fake
 * page address, a fake canvas).
 */
export function gameConfig(options = {}) {
  const points = Flow.mostPoints({ rounds: 'rounds' });
  return {
    space: '2d',
    seed: options.seed,
    modules: [
      Render2D({ font: FONT, background: COLORS.floor, poster: options.poster, ...options.render }),
      Feel(),
      Input({ actions }),
      Audio(),
      UI({ title: TITLE, theme }),
      // Only the data listed here crosses the network.
      Net({ components: [Seat, Aim, Hand, Board, Stone, Bot] }),
      Flow.rounds({
        join: { maxPlayers: 8 },
        friends: options.friends,
        // Somebody who arrives mid-round (a friends server leaves its door open) watches, then plays from the next round.
        admit: 'round',
        title: { logo: TITLE, scene: titleScene },
        lobby: { scene: lobbyScene, spawn: lobbySpawn, hint: 'Tap the table to practise' },
        settings: [{ id: 'rounds', label: 'Rounds', options: [1, 3, 5], default: options.rounds ?? 3 }],
        // Empty seats are filled with bots, so a lone player gets the whole game.
        roster: { fill: options.fill ?? 6, bot: (ctx, seat) => seatParts(seat, ctx.seats.length) },
        round: roundRules,
        // A round's points are the stones each seat has left on the table; the match adds them up.
        scoring: { ...points, award: roundPoints },
        results: { awards: [Awards.most('Avalanche', 'tipped'), Awards.most('Rim runner', 'rim'), Awards.most('Iron grip', 'kept')] },
        timing: options.quick ? { banner: 0.4, roundEnd: 0.4, scoreboard: 0.4, results: 3 } : undefined,
      }),
      GameUI(),
      // Store art: `?poster=cover` builds a staged picture instead of the game (Render2D provides `game.poster`).
      Posters(),
    ],
    resources: [Beat(), RoundClock(), Callout()],
    // The game itself is built by Flow's scenes (the title, the lobby, each round); these systems run through all of them.
    systems: [Clock, Aiming, BotBrain, HostDrop, HostPhysics, Sandbox, DressStones, StoneMotion, DressSeats, SeatLayout, SeatLooks, TableLook, GhostLook, BeatFeel, Music, CameraFit],
  };
}

/** The ready config: what `createGame` takes (main.js starts it), next to the Input action map. */
export const config = gameConfig();
/** A short version for `onceworlds check`: one round and short screens, so a simulated match reaches its results. */
export const quick = gameConfig({ quick: true, rounds: 1 });
export { actions };
