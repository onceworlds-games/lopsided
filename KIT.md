# Stand on the Color (kit: party-2d)

A party minigame for up to eight: a color and shape are called, everyone runs onto it, and every other tile drops. Fall and you float on as a ghost; last one standing wins the round. Each wave is faster and calls for fewer tiles. Bots fill the empty seats.

Built only on `@onceworlds/engine` (Render2D, Feel, Input, Audio, UI, Net, Flow). Plain ES modules, no build step, no physics (there is nothing to bump into).

It is also the template for any round-based minigame: the whole shell (title with the game alive behind it, lobby with ready-up, 3-2-1, goal banner, rounds, scoreboard, podium, awards, settings, bots, late arrivals as spectators) comes from `Flow.rounds` in `game.config.js`. Swap the floor and the rule, keep the rest.

## The one idea to understand: the floor is never sent

The floor is a pure function of the round and the seconds since it began (`floorAt`, `makeFloor` in `rules.js`), with the match's seeded random stream. Every page works out the same floor with no messages; a page that reloads or becomes the host just carries on. Only two things cross the network:

| What | Written by | Why |
|---|---|---|
| `Runner` (who, color) and the runner's position | the player's own page (the host for bots) | each page moves its own runner |
| `Status` (out, when) | the host only, in `systems/referee.js` | nobody can stay in by lying about where they stood |

Outside a round (title, lobby) the same floor runs a looping demo from the world's clock, so the game is alive behind the Play button.

## Files

- `onceworlds.json`: the game's listing. `controls` is written from `actions.js` (a test checks they agree).
- `index.html`, `main.js`: start the game. `main.js` only calls `createGame(gameConfig()).start()`.
- `game.config.js`: `gameConfig(options)` (modules, Flow: title, lobby, rounds, scoring, awards; systems), plus `config` (the ready config `main.js` starts) and `actions`. Read this first.
- `package.json`: the kit runs on its own: `npm install`, then `npm test` (only `@onceworlds/engine` and vitest).
- `rules.js`: every number (the ramp, the drop, speeds) and the pure maths (the clock, the floor, who falls).
- `components.js`: the data, and which of it crosses the network.
- `actions.js`: the stick and the dash button, for keyboard, pad and phone.
- `scenes.js`: the title demo, the lobby, spawn points, and the round's rules (`isOver`, `rank`, `end`).
- `level.js`: builds the stage (the raft, its holes and tiles, the lane rope, ripples on the water) and the camera's look (`cameraLook`). `look.js`: how a runner is drawn (the player's own avatar, who stands in front, the ghost), and the shapes.
- `bots.js`: the bot brain (think now and then, act every step).
- `ui.js`: the HUD (the called color, its shape, the time left, who is in).
- `posters.js`: store art, staged with the same code as the game.
- `theme.js`: palette, one color and shape per tile, font, draw order.
- `queries.js`: queries used outside systems.
- `systems/equip.js`: dresses every runner, and gives `Motion` and `Intent` to the ones this page simulates.
- `systems/move.js`: input to `Intent`, and running and dashing.
- `systems/floor.js`: the floor clock, how tiles look, glow and fall, the camera. `systems/referee.js`: who falls (host only).
- `systems/feedback.js`: the bell, ticks, the drop, "OUT", the ghost, the music.

## Change it

| You want | Change |
|---|---|
| Faster or slower waves, fewer or more safe tiles, more colors | `showTime`, `safeCount`, `colorsFor` in `rules.js` |
| How long the drop lasts, the grace at the start | `WAVE` in `rules.js` |
| Run speed, dash | `RUNNER` in `rules.js` |
| Round length, rounds, points | `ROUND_SECONDS` in `rules.js`; the `rounds` setting and `Flow.placePoints([6, 4, 3, 2, 1])` in `game.config.js` |
| The floor's size | `FLOOR` in `rules.js` |
| Colors, shapes, font | `theme.js` (`TILE_COLORS`) and `symbolPoints` in `look.js`; light and bloom: `cameraLook` and the lamps in `level.js` |
| How bots play | `think` in `bots.js` (`slips` makes them sometimes pick the second nearest or freeze), `skill` in `game.config.js` `roster` |
| Number of bots | `fill` in `gameConfig` (default 6 seats) |
| A different rule (musical chairs, hot floor) | the clock and `makeFloor` in `rules.js`, `whoFalls`, and the tile look in `systems/floor.js` |
| Buttons and keys | `actions.js`, then copy `controls` into `onceworlds.json` |

Keep the lobby setting's default (`rounds` option) one of the listed choices (1, 3 or 5), or the default silently becomes the first.

## Run it

The platform's CLI runs a game from this folder (`onceworlds dev`). Tests need no browser:

```
npm test
```

## Tests

- `test/rules.test.js`: the clock's phases, the ramp (always harder, always playable), a wave's floor (same on every page, the right number of safe tiles), where a runner counts as safe, who falls (and that nobody falls if everybody would), ranking, every color has its own shape, spawn points on the floor, `onceworlds.json` controls match the action map.
- `test/referee.test.js`: across two pages and a slow network: the host puts out whoever is not on the called color and every page agrees; nobody falls when everybody would; a ghost keeps moving and others see it; both pages draw the same floor and the bad tiles are gone during a drop; the dash.
- `test/matches.test.js`: whole matches (one player and five bots through three rounds; three players over a bad network; the host's rounds setting), late arrivals who watch and then play from the next round, and every chaos scenario: reload the host, drop a player, change the host, reload a player, pause during a host change, a late joiner, garbage messages, the host leaving.
- `test/screens.test.js`: store pictures build, the HUD fits a phone, the demo floor behind the title and the lobby, and a whole match drawn through a strict canvas.
- `test/fakeCanvas.js`: a small strict fake canvas for the drawing test. `test/helpers.js`: `duel` (players in a scripted timeline), `players` (humans that play well), `place`, `timeline`.

## Store art

`onceworlds posters` opens the game with `?poster=cover` and `?poster=icon` (and `?poster=action`) and captures the pictures into `store/`. It also names `icon` and `thumbnails` in `onceworlds.json` when it has none. The kit ships without the pictures: make them before the first deploy.
