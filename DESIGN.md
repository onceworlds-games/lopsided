# Lopsided: design pitch

**One wobbly table, up to eight players. Every beat, everyone drops a stone at once. Weight tips the table, and whatever slides off the
edge is gone.**

## The hook

A round table balanced on a single point. The rim scores the most, but a stone on the rim is also the heaviest lever there is: pile up
there and the table tips toward *you*. Every stone anyone drops changes everyone's risk. The table is shared, the greed is personal.

## The core loop (a beat is 3 seconds, a round is 8 beats, a match is 3 rounds: about 90 seconds of play)

1. **Aim** (hidden): tap where your next stone lands. Your ghost stone shows only to you, and a ghost bubble on the table's spirit level
   shows how *your* stone alone would tip it.
2. **Drop**: every player's stone lands at the same moment. The reveal is the moment: who went greedy, who counterweighted, who
   dropped a boulder on your pile.
3. **Tip and slide**: the table leans toward the weight. Stones near the low rim slide; anything past the edge falls and is lost.
   Weight that falls off levels the table again, so a slide stops itself.
4. **Read** the new lean (the bubble, the red glowing low edge, the live scores) and aim again.

At the end of a round the stones still on the table score by ring: **center 1, middle 2, rim 3**. Each player also has one **boulder**
per round: three times the weight, for a counterweight that saves your pile or a sledgehammer that dumps a rival's. Or keep it: a
boulder still in hand at the end of the round is worth 3, so throwing it has to be worth more than that. The last round counts double.

## Why it's strategic

- **Greed against leverage.** Points and danger grow together with distance from the middle. There is no safe greedy move.
- **Every move is shared.** A stone that balances your pile also tips someone else's. Counterplay is readable: the table leans toward
  whoever is heaviest, and anyone can push it further.
- **Sacrifice plays.** Throwing a stone (or your boulder) onto a rival's side past the tipping point costs you one stone and can cost
  them five.
- **Simultaneous, hidden drops**: reads, bluffs and timing instead of reflexes. Holding the boulder for the last beat is a threat
  everyone has to respect.
- **Built-in comebacks.** The leader is the heaviest, and the heaviest side is the one that slides.

## Why it spreads

- **Avalanches**: one boulder, ten stones sliding off, "TIPPED BY MIA" across the table. That's the clip.
- **Betrayals without chat**: the player balancing your pile from across the table stops balancing it, or drops their boulder on it.
- **Clutch last beats**: the final drop decides the round, in full view.
- **Spectators get it in one second**: the table leans, stones slide off, colors and numbers show who is winning.
- **Phones first**: one tap per beat, one button. Rounds of 30 seconds, a match in 90; "one more" is cheap. Bots fill every seat.

## The three riskiest assumptions

1. **Hidden simultaneous drops feel like decisions, not a lottery.** Players must be able to read the lean and predict a slide. If not,
   the game is noise. (Mitigation: the spirit level and its ghost bubble, the glowing low edge, a tipping threshold so that small
   imbalances do nothing and big ones do a lot.)
2. **The physics stays legible and balanced.** No runaway table flips that clear everything, no dead-level table where nothing ever
   falls, and no single strategy (hug the middle, rush the rim, sabotage) that wins regardless. (Mitigation: a gently domed table plus
   friction, simulated bot matches with fixed strategies, numbers recorded below.)
3. **Tap-to-aim on a phone is precise and fast enough**, and a 3-second beat is long enough for a new player but short enough to keep
   the tension. (Mitigation: a big table filling the phone's width, a ghost stone, beats that start longer and speed up.)

## Balance (measured)

`node tools/balance.mjs 400 7` plays thousands of headless matches (3 rounds each) with the game's own rules and physics between six fixed
strategies (`strategy.js`), seated at random:

- **random**: anywhere on the table. **turtle**: only the middle ring. **greedy**: only the rim, anywhere.
- **climber**: the rim on whichever side is up right now. **smart**: reads the table (its own expected points after the lean it
  causes, hedged against the others' unknown drops, minding the others a little). **saboteur**: reads the table to hurt the leader.

Win rate (fair share is 50% / 25% / 12.5%), the final tuning (stiffness 190, grip 0.14, drag 0.13, dome 0.006, kept boulder 3):

| Strategy | 2 seats | 4 seats | 8 seats |
|---|---|---|---|
| saboteur | 76% | 38% | 21% |
| climber | 76% | 33% | 19% |
| smart | 71% | 49% | 20% |
| greedy | 35% | 13% | 7% |
| random | 21% | 9% | 3% |
| turtle | 20% | 7% | 5% |

Stones lost over the edge: 38% / 41% / 35%. Boulders thrown in about 16% of seat-rounds (kept otherwise).

Head to head at 4 seats (two of each), the share of wins: **climber beats smart 54-43, smart beats saboteur 62-43, saboteur beats
climber 63-42.** The three ways of reading the table form a cycle; none wins whatever it meets. The naive strategies (rim only, middle
only, anywhere) lose to all three: hugging the middle never loses a stone and almost never wins.

What changed on the way (each a rerun of the tournament):

1. First tuning: 64% of stones lost at 8 seats and "turtle" won the most there: the table didn't scale with players. The stiffness now
   grows with the square root of the seat count, so 8 players rock it about as much as 4.
2. Slides were bimodal (nothing, or 8+ stones at once). A gentle dome and kinetic friction close to the grip made rim stones go first
   and slides stop themselves; gravity was raised so a slide is a quick, readable snap instead of a creep.
3. With "use it or lose it" boulders every bot saved its boulder for the last beat: every round ended in a boulder storm decided by
   luck. A kept boulder now scores 3, so boulders are thrown only when they swing more than that, and the climax is a choice.
4. That calmed the table so much that "climber" (always the uphill rim) won everything (losses fell to 14-20%). The table was made
   tippier (stiffness 270 to 190, grip 0.15 to 0.14), which restored the cycle above.

Bots in the game play `smart`, `saboteur` and `climber` by seat, slip into `greedy`/`random`/`climber`/`turtle` by their mistake rate,
and wobble their aim by their aim noise.
