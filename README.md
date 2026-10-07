# Lopsided

**Play it: https://onceworlds.com/play/lopsided**

One wobbly table for up to eight players (bots fill the empty seats). Every beat, everyone drops a stone at the same moment. The table
tips toward the weight, and whatever slides off the edge is gone.

## How to play

- **Tap the table** where your next stone should land (drag to adjust). Only you see your aim until the drop.
- **Stones score where they end up** when the round is over: **rim 3, ring 2, middle 1**. Off the table: nothing.
- **Weight tips the table.** The rim scores most, but a stone there is also the biggest lever: pile up on one side and that side sinks.
  Watch the marble in the top panel and the red glow on the low edge.
- **One boulder a round** (the Boulder button, or B): three times the weight. Save your pile, or dump somebody else's.
- Eight beats a round, three rounds a match. Most points wins.

## Making it

An [Onceworlds](https://onceworlds.com) engine game, no build step. `npm install`, then `npm test`, `npx @onceworlds/cli check` and
`npx @onceworlds/cli shot`. The design pitch and the balance numbers are in `DESIGN.md`; `KIT.md` says where every rule and number lives;
`node tools/balance.mjs` plays the strategy tournament. Every push to `main` deploys through `.github/workflows/onceworlds.yml`.

MIT licensed.
