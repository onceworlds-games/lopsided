# Lopsided: where things live

Started from the `party-2d` kit; its shell (title with the game alive behind it, lobby with ready-up, 3-2-1, goal banner, rounds,
scoreboard, podium, awards, bots, late arrivals as spectators) is `Flow.rounds` in `game.config.js`.

## The one idea to understand: the host runs the table

The table's lean and every stone are host-owned entities: the host's page drops each beat's stones and steps the physics (`systems/host.js`,
with the pure maths in `rules.js`), and every other page draws what it receives. A player only ever writes its own `Aim`.

| What | Written by | Why |
|---|---|---|
| `Seat`, `Aim` (where my next stone goes, for which beat) | the player's own page (the host for bots) | aiming is the only thing a player decides |
| `Hand` (boulder left, live score, stones lost) | the host only | nobody can give themselves a boulder or points |
| `Board` (lean, which beat dropped, who tipped it) | the host only | a new host carries on from it; a beat drops once |
| `Stone` (and its position) | the host only | the physics runs in one place |

The round's clock is a pure function of the match clock (`clockAt` in `rules.js`), so every page agrees on the beat with no messages.

## Files

- `rules.js`: every number (the table, the stones, the rings, the beats) and the pure maths: the clock, the lean, the physics, scoring, who tipped it.
- `strategy.js`: how a seat chooses a drop (the bots use `smart` and `saboteur`; the balance tool pits all of them).
- `tools/balance.mjs`: the strategy tournament (`node tools/balance.mjs 400`, or `... 100 1 matrix 4` for head to head).
- `components.js`: the data, and which of it crosses the network. `queries.js`: queries used outside systems.
- `game.config.js`: modules, Flow (title, lobby, rounds, scoring by points on the table, awards), systems in order.
- `scenes.js`: the title's demo table, the lobby's practice table, a seat's parts, and the round's rules.
- `table.js`: builds the table (shadow, brass rim in pieces, rings, numbers, chevrons). `look.js`: stones, seats, the aim marker, seat layout.
- `systems/clock.js`: the round's clock. `systems/host.js`: drops and physics (host only). `systems/physics.js`: entities to plain stones and back.
- `systems/sandbox.js`: the local table behind the title and in the lobby. `systems/aim.js`: taps and drags, the boulder, the aim marker.
- `systems/looks.js`: stones dropping in and falling off, seats and their layout, the rim's glow, the camera. `systems/feedback.js`: sounds, shakes, "TIPPED BY", music.
- `bots.js`: the bot brain. `ui.js`: the HUD (lean gauge, beats, the drop countdown) and the two-word prompts. `posters.js`: store art.
- `theme.js`: palette, seat colours and symbols, particles, draw order.

## Change it

| You want | Change |
|---|---|
| A tippier or steadier table | `stiffness`, `grip`, `drag`, `dome`, `maxTilt` in `TABLE` (`rules.js`), then run `node tools/balance.mjs` |
| Longer or shorter beats, more beats | `BEATS` in `rules.js` |
| Different points | `RINGS` in `rules.js` |
| Bigger stones, a heavier boulder | `STONE` in `rules.js` |
| What keeping the boulder is worth | `BOULDER_KEPT` in `rules.js` |
| No double points in the last round | `isFinalRound` in `systems/clock.js` |
| How bots play | `STYLE_BY_SEAT` and `SLIPS` in `bots.js`; the strategies in `strategy.js` |

## Tests

`npm test` (no browser): `rules.test.js` (clock, rings, lean, physics, who tipped it), `strategy.test.js` (bots' reading of the table,
the balance), `matches.test.js` (whole matches with bots, a bad network, late arrivals, every chaos scenario), `screens.test.js` (store
pictures, the HUD on a phone, seat layouts, the title and lobby tables, a tap and a drag becoming a stone, a whole match drawn).
