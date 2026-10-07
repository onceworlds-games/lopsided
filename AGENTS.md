# Onceworlds engine game

This is a browser game on the **Onceworlds engine**, published on **Onceworlds**, a platform for AI-made games. The engine has worlds
of entities, systems, 2D and 3D drawing, physics, input and touch, sound, UI, game feel, and the platform's rooms, matches, saves and
bots built in. You write only the client: HTML, JavaScript and assets, with no build step and no server code.

This guide is short on purpose: the rules that matter, the workflow, the APIs you use most. Look everything else up when you need it
(next section) instead of reading the whole reference.

## Workflow

1. **Start from a kit**: `npx @onceworlds/cli new my-game --kit <kit>` (the table under "Pick the default path"). It is a complete,
   working game of one kind with a lobby, bots, touch controls, sound, a finished round and tests. `KIT.md` says where each rule
   and number lives. Run `npm install` once in the folder.
2. **Change it** into your game: rules and numbers first, then art and sound, then the title and the look. Keep it playable after
   every step. Look up what you are not sure of (`onceworlds api`, `onceworlds recipe`) rather than guessing.
3. **Check it** after every change: `npx @onceworlds/cli check` lints the code for the usual mistakes (each with the line that fixes
   it), runs the game's tests, plays simulated matches with a reloaded host, a dropped player, a late joiner and garbage messages,
   and measures entities and draw calls against the budgets of each quality tier. No browser, seconds. Fix what it reports first.
4. **Look at it**: `npx @onceworlds/cli shot` saves a picture of the game a few seconds into a match (`--poster cover` for a
   poster): 2D draws without a browser, 3D needs Chrome. Look at it the way a player would.
5. **Make the store art** (`npx @onceworlds/cli posters`) and **publish**: push to GitHub (the Onceworlds workflow deploys every
   push) or push a draft with the MCP tool `deploy_preview` and publish it from onceworlds.com/create.

With the onceworlds MCP tools, the same steps are `new_game`, `api_lookup`, `recipe`, `check`, `screenshot` and `deploy_preview`.

## Look things up

Every answer is a few lines (about a hundred tokens), made from the engine you have installed:

| Command (MCP tool) | Gives |
|---|---|
| `npx @onceworlds/cli api <name or words>` (`api_lookup`) | A signature, what it does, its fields or options and an example: `api Shape2D`, `api feel.shake`, `api world.spawn`, `api "camera follow"`. `--full` lists every field and member. |
| `npx @onceworlds/cli recipe [name]` (`recipe`) | Short, tested code for a kind of game (tycoon, survival, racing, platformer, shooter, party, rpg, idle, sandbox) or a feature (chase-ai, inventory, shop, dialogue, day-night...). |
| `npx @onceworlds/cli guide [topic]` (`read_guide` with `guide: "engine"`) | A topic below, or any heading of this guide or the API reference. |
| `search_assets` (MCP) | Ready-made models, sprites, materials and sounds from the engine's library, with the code that uses each. |

<!-- topics:start (npm run guide:sync writes this table from docs/engine/guide/*.md) -->
| Topic | What it covers |
|---|---|
| `2d-looks` | Lights, shadows, hit flashes, outlines, glows, screen looks and shaders in 2D, one line each. |
| `assets` | Formats, loading and progress, art made in code, size and memory budgets. |
| `characters` | Players as their own avatars (Humanoid, Avatar2D), NPCs, emotes, holding things, reaching. |
| `components` | Timer, AudioSource, UI nodes and AnimationPlayer: whole jobs from plain data. |
| `data` | Worlds kept between sessions (Persist) and values every server shares. |
| `debugging` | Why a game misbehaves: `game.debug.text()`, the F3 overlay, Build's Debugger. |
| `design` | What makes a game fun here: the idea, the first minute, juice, screens, a look. |
| `effects-3d` | Particles, trails, decals, words and sprites in 3D, and which for which moment. |
| `library` | Ready-made models, sprites, textures, sounds and music by name (Library.model). |
| `lighting` | The time of day in one line (Environment), lamps, and baked light for phones. |
| `materials` | Looks in one line (rim, dissolve, hologram, wind...) and node-graph shaders. |
| `multiplayer` | Owners, replication, rpc and claims, the host as a page, shared time, rooms of 30. |
| `navigation` | Enemies, guards and bots that find their own way: NavAgent, bot orders, links. |
| `platform` | What the platform requires and already does, and how the engine is hosted. |
| `posters` | Store art made by the game's own code (game.poster), and pictures to look at (shot). |
| `scenes` | Projects of scenes and scripts (what onceworlds.com/build makes), with a complete one. |
| `terrain` | Ground from presets or heights, solid with physics, sculpted in Build or in code. |
| `testing` | Headless tests with simulate, the chaos scenarios, and what check and doctor look at. |
| `water` | Water and lava, swimming, floating on the waves, and water that hurts. |
<!-- topics:end -->

The same topics are at `https://onceworlds.com/engine-guide/<topic>.md`, the whole reference at https://onceworlds.com/engine-api.md,
and the plain SDK under the engine (`window.onceworlds`) at https://onceworlds.com/agents.md.

## Rules

These are what break real games. `check` finds most of them in your code.

1. **Rules run in `fixed` systems** with `time.dt` (seconds per step) and seeded randomness, `rng('name')` in a system or
   `world.rng('name')`: never `Math.random()`, `Date.now()` or `performance.now()` in a rule, and never `setTimeout` or
   `setInterval` for gameplay (use a `Timer` or count `time.dt`). Every page, a reload and a new host must agree.
2. **The host decides what matters.** Systems that change shared state have `authority: 'host'`; things the host owns are spawned
   with `{ owner: 'host' }`; a component a player must not write (health, score) has `net: { owner: 'host' }`. A player asks the host
   with `net.rpc` (its arguments are checked against a schema) or `net.claim` (contested things), never by writing the result.
3. **Only the engine touches the page.** Systems never use `document` or `window`; screens are `ui.view` and the standard Flow views;
   HTML is `ui.overlay.el('span', { text })` (never `innerHTML`: text from players is untrusted). Games never import three.js or
   Rapier: `Render3D`, `Mesh`, `Physics3D` and the rest are the way in.
4. **Every action works on a phone.** Each `Input.button` has `touch: { label }`, each `Input.axis2d` has `stick: true`; at most
   four buttons and a stick. `"controls"` in `onceworlds.json` is the menu's "How to play" (`npx @onceworlds/cli doctor --fix`
   writes it from the action map).
5. **Use the shell.** `Flow` makes the title, the live lobby, ready-up, the countdown, rounds, results and bots. Don't build lobbies,
   server lists, invite links, chat or volume controls: the platform has them.
6. **Keep it bounded.** Despawn what you spawn (bullets, particles, pickups) or cap it; no loop without an end; a file under about
   1,500 lines; images and sounds compressed.
7. **Saves go through `defineSave` and `Save`**, never `localStorage` (the game frame forgets it on reload). `alert`, `confirm`,
   `prompt`, popups and navigation are blocked in the game frame.
8. **Readable at a glance.** Text at least 18 px on a phone and in strong contrast with what is behind it; buttons at least 56 px.

## The files

```
index.html          loads main.js as a module; nothing else is needed
main.js             import { createGame } from '@onceworlds/engine'; import { config } from './game.config.js'; createGame(config).start();
game.config.js      export const config = { modules, systems, scene };  export const actions = { ... };  export const quick = ...
src/ or *.js        components, systems, prefabs, UI views, bots
test/*.test.js      headless tests with @onceworlds/engine/test (never deployed)
store/              icon and thumbnails (made by `posters`)
onceworlds.json     { "slug", "name", "description", "engine": "1", "genre", "icon", "thumbnails", "controls", "badges" }
```

`game.config.js` has no side effects, so the tests and `check` play exactly what `main.js` starts. `quick` is the same game with one
short round and short screens, which `check` plays so a match reaches its results. `"engine": "1"` makes the platform provide the
engine (the newest 1.x); write no import map of your own. More in the `platform` topic.

## Pick the default path

Each kind of game has one well-worn path. Start from its kit and keep its choices until something forces a change.

| Kind of game | Kit | Draws with | Moves with | Camera | Shell |
|---|---|---|---|---|---|
| Top-down arena, brawler, tank game, twin-stick shooter | `arena-2d` | `Render2D`, `Shape2D`, `Avatar2D` | `Physics2D`, `TopDown` (dash) | `camera2D`, fitted to the arena by the kit's own system | `Flow.rounds`, bots fill seats |
| Platformer, runner, obstacle course | `platformer-2d` | `Render2D`, `Library`, `Avatar2D`, `Lighting2D`, a text map | `Physics2D`, `Platformer2D` | `CameraRig.sideScroll` | `Flow.rounds` (a race to the flag) |
| Party and minigames, last-one-standing, hide and seek | `party-2d` | `Render2D`, `Shape2D`, `Avatar2D` | the kit's own movement systems writing `Intent` (no physics) | fixed `camera2D` | `Flow.rounds`, several short rounds |
| Third-person 3D arena, battle, adventure | `third-person-3d` | `Render3D`, `Environment`, `Library`, `Humanoid` | `Physics3D`, `Character3D` | `CameraRig.thirdPerson` | `Flow.rounds` |
| Racing, driving, kart | `racing-3d` | `Render3D`, `Environment`, `Terrain3D`, `Library`, `Mesh`, `PostFx` | `Physics3D`, `ArcadeVehicle` | `CameraRig.thirdPerson` | `Flow.rounds` (laps), bots drive |
| Tactics, board and card games, puzzles | `tactics-iso` | `Render2D` with the kit's own isometric projection, `Shape2D` | `Grid` (A*, ranges), `GridMover` | `camera2D`, fitted to the board by the kit's own system | `Flow.turns` |

Games the table doesn't name start from the nearest kit and a recipe: survival, sandbox and social worlds (`Flow.dropIn`, `Save`),
shooters (hit scan with `physics.raycast` on the host), tycoon and idle games, RPGs. `npx @onceworlds/cli recipe` lists them.
Projects of scenes and scripts (what the editor at onceworlds.com/build makes) are in the `scenes` topic.

## The APIs you use most

```js
import { createGame, defineComponent, defineSystem, t, Transform, Timer } from '@onceworlds/engine';
import { Render2D, Shape2D, Text, camera2D, Input, Audio, UI, Feel, Net, Flow } from '@onceworlds/engine/modules';

const Coin = defineComponent('Coin', { value: t.u8(1) }, { net: { replicate: true } });

export const actions = {
  move: Input.axis2d({ keys: 'wasd arrows', stick: true, pad: 'left', label: 'Move' }),
  dash: Input.button({ keys: 'Space', pad: 'A', touch: { label: 'Dash', big: true }, label: 'Dash' }),
};

const Collect = defineSystem({
  name: 'collect',
  stage: 'fixed',                 // 60 times a second: rules go here, with time.dt
  query: [Coin, Transform],
  authority: 'host',              // only the host's page decides
  run({ query, world, feel, audio }) { /* ... */ },
});

export const config = {
  space: '2d',
  modules: [Render2D(), Input({ actions }), Audio(), UI(), Feel(), Net({ components: [Coin] }), Flow.rounds({ /* title, lobby, roster, round, scoring */ })],
  systems: [Collect],
  scene(world) { world.spawn([Transform(), camera2D({ height: 12, clear: '#10131c' })]); },
};
```

| Doing | With |
|---|---|
| Data and rules | `defineComponent(name, { field: t.f32(0) })`, `defineSystem({ name, stage, query, authority, run })`, `defineEvent` |
| Entities | `world.spawn([Transform(), ...], { owner })`, `entity.get(Health)`, `entity.has(Health)`, `world.despawn(e)`, `world.query([...]).each(...)` |
| Time and chance | `time.dt`, `time.match`, `rng('loot').int(1, 6)`, `Timer({ waitTime: 2, autostart: true })` and `TimerTimeout` |
| 2D | `Render2D()`, `camera2D({ height })`, `Shape2D`, `Sprite`, `Text`, `CameraRig.follow` |
| 3D | `Render3D()`, `Environment.preset('afternoon')` (sky, sun, haze), `Mesh.box(size, Material.standard({ color }))`, `Library.model('tree.pine')`, `PostFx.polished()`, `CameraRig.thirdPerson` |
| Moving | `Physics2D()`, `Body2D.dynamic()`, `Collider2D.box({ size })`, `Controllers()`, `Intent`, `TopDown`, `Platformer2D`, `Character3D`, `ArcadeVehicle`, `physics.raycast` |
| Finding the way | `NavAgent.chase('players')`, `NavAgent.patrol(points)`, `ctx.chase(target)` in a bot's `think` (the `navigation` topic) |
| Input | `Input({ actions })`, `input.axis('move')`, `input.held('jump')`, `input.pressed('dash')` |
| Feel and sound | `feel.shake(0.4)`, `feel.squash(e)`, `feel.particles.burst('sparks', e)` and `feel.floatText('+3', e)` (2D and 3D), `feel.tween(e, Transform, { scale: 1.3 })`, `audio.play('coin')`; in 3D `Particles3D`, `Trail3D` (the `effects-3d` topic) |
| Screens | `UI({ theme })`, `ui.view(name, build)`, `ui.draw.text`, `NameTag` |
| Multiplayer | `Net({ components })`, `net.rpc(name, { args, run })`, `net.claim`, `net: { owner: 'host' }` |
| The match | `Flow.rounds({ round: { isOver, rank }, roster: { fill }, scoring })`, `Flow.dropIn()`, `Flow.turns`, `defineBotSystem`, `botProfile` |
| Progress | `defineSave('Profile', { wins: t.u32() })`, `Save(Profile)`; `Persist()` keeps a server's world (the `data` topic) |
| Tests and art | `simulate(config, { humans, bots, chaos })` from '@onceworlds/engine/test', `game.poster('cover', setup)` |

Each of these is one `npx @onceworlds/cli api <name>` away from its options and an example.

## Go a layer down only when you must

Every default has a lower layer, and the lower layer is the same API the default is written with. Go down one step at a time and
only for the thing that needs it; the rest of the game stays on the defaults.

| You need | Default | Go down to |
|---|---|---|
| A controller that feels different | `Platformer2D`, `TopDown`, `Character3D`, `ArcadeVehicle` with their options | write a system that reads `Intent` and calls `physics.moveCharacter(entity, desired)`; then raw `Body2D` / `Body3D` velocities and `applyImpulse` |
| A look no preset gives | `Material.standard/toon/unlit` and the looks (`Material.rim`...), `PostFx.polished()`, `Environment` | `Material.custom` (WGSL), `PostFx({ passes })`, then `render.addPass` (2D) or `render3d.addPass` (3D) |
| Your own screens | the standard Flow views (`flow.title`, `flow.results`...) with `UI({ theme })` | replace a view by its name, then `ui.draw.*` immediate mode, then `ui.overlay` HTML |
| Rules of who owns what | `Net({ components })`, `owner: 'host'`, `rpc`, `claim` | `net.send` and `net.onMessage` with your own validated messages |
| A different match shape | `Flow.rounds`, `.turns`, `.dropIn`, `.coop` with their options | `Flow.none()` and drive `room.startMatch`, `endMatch` yourself, following the platform guide's "Matches" |
| A sound that isn't there | `Audio` synthesized effects, `audio.play(name)`, buses | the Web Audio graph through `audio.context` |
| More than the engine does | everything above | `window.onceworlds` (the SDK) beside the engine; read https://onceworlds.com/agents.md |

## Make it fun

Players find games in a grid of thumbnails, often on a phone, and leave within seconds if they don't get it. The `design` topic has
the whole list; these matter most:

- **Familiar beats clever**: tag, a race, an obstacle course, a color-matching floor. The name says what you do ("Pass the Bomb").
- **One tap to play**, moving within 10 seconds; show the goal (an arrow, a glowing target) instead of explaining it.
- **Always know the goal and the score** from the screen; rounds of 30 seconds to 3 minutes; the next match one tap away.
- **Never alone**: `roster: { fill }` seats bots that play like people (`botProfile(skill)`), never perfectly.
- **Every action answers within a tenth of a second** with a sound and motion: `feel.squash`, `feel.particles.burst`,
  `feel.floatText`, eased tweens, `feel.shake` and `feel.hitStop` for knockouts (the camera shakes, never the body).
- **A look for everyone**: one confident style, real lighting in 3D (`Environment.preset('afternoon')`, `PostFx.polished()`),
  saturated colors with a symbol beside every color that matters. Babyish blobs read as a game for toddlers.

## Multiplayer with the engine

- `world.spawn([...], { owner: me.id })` makes a player's page simulate it; `{ owner: 'host' }` is for the host's rules (bots,
  pickups, a ball). Replicate only what others must see (`net: { replicate: true }`), with `predict: true` on the owner's movement.
- Actions are calls: `net.rpc('fire', { args: { angle: t.f32() }, to: 'host', rate: 10, run })` checks its arguments and how often a
  player may call. Never trust a client's word about damage, score, someone else's position or time.
- Only replicated components cross the network. Looks, colliders, bodies and controllers are added on every page by a system that
  finds what lacks them (`query: [Player, { without: [Shape2D] }]`), with a body and a controller only where `net.simulates(entity)`.
- The host is a page: it reloads, drops and leaves. Rules behind `authority: 'host'` and state that is replicated or in the room
  carry on under the next host; `check` plays exactly that. More in the `multiplayer` topic.

## Test it without a browser

```js
// test/match.test.js
import { simulate } from '@onceworlds/engine/test';
import { expect, test } from 'vitest';
import { config } from '../game.config.js';

test('a full match ends with everyone ranked, through a reloaded host and a dropped player', async () => {
  const run = await simulate(config, { humans: 2, bots: 2, seed: 7, minutes: 3, chaos: ['reload-host', 'drop-player'], latency: [10, 60] });
  expect(run.errors).toEqual([]);
  expect(run.ranking).toHaveLength(4);
});
```

Test the rules, not the pixels: step the game (`game.run(seconds)`), drive input (`input.setAxis('move', 1, 0)`, `input.tap('jump')`)
and assert on components. The `testing` topic has the chaos scenarios, the lints and the budgets `check` uses.

## Mistakes the engine's errors will tell you about

The errors say what went wrong, where, and the line that fixes it. The usual ones:

| You wrote | What to do |
|---|---|
| `import ... from '@onceworlds/engine'` and the deploy is refused | `"engine": "1"` in `onceworlds.json` (`doctor` warns about it) |
| `world.spawn([Health])` | components are called: `Health()` or `Health({ hp: 5 })` |
| `Math.random()` or `Date.now()` in a rule | `world.rng('name')` and `time.dt` / `time.match`: the page that replays or takes over must agree |
| a rule that changes shared state on every page | put `authority: 'host'` on the system, or spawn with `{ owner: 'host' }` |
| a system that changes physics bodies in `update` | do it in `fixed`, before `'physics2d'` / `'physics3d'` |
| shaking the player's transform | `feel.shake` moves the camera only |
| your own lobby, countdown or podium | use `Flow` and the standard views; replace one by name only for a different look |
| touch controls drawn by hand | `Input({ actions })` sets the platform's; branch on `input.device`, not on screen size |
| a message handler that trusts its input | use `rpc` or `claim` (schema checked), or validate every field |
| `localStorage` for progress | `defineSave` (the frame's storage is gone on reload) |

## Gotchas found while building the kits

- `input.axis('move').y` is -1 for up, like the platform's stick; a 2D world's y points up: flip it when you move.
- An entity this page just spawned has no `net.owner` until the end of its first frame: decide "is it mine" from its data (an id
  field) or wait a frame. Host-owned things are spawned once the game is in a room (Flow's `round.populate`, or behind
  `flow.phase === 'playing'`): before the room is joined every page counts as the host.
- In a module's `install`, `game.world` doesn't exist yet: read it inside the functions you register, or in `init`. `physics` belongs
  to a world: use it in a system, and turn a call that needs it into an event a host system reads.
- The roster's bots carry the `Bot` component: list it in `Net({ components: [..., Bot] })`.
- `Input.pointer({ drag: 'none' })` never reports presses: use the default drag mode, or a button action, for taps.
- `net.isMine(entity)` is true for host entities on the host's page. Check `net.owner(entity) === me.id` when you mean "my own character".
- In `Flow.turns`, `FlowState.turn.me` is true on the host during bot turns (the host plays them). Check whose turn it is by id.
- Net only accepts a record from the page that created it. Spawn a player's own entities on that player's page, not on the host's.
- Moving platforms, elevators and doors are kinematic bodies moved by their Transform. Characters stand on them and ride them (and on
  each other), so don't carry riders yourself.
