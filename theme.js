import { defineRenderLayers } from '@onceworlds/engine/modules';

// How the game looks: a game show on a raft in a pool, on a sunny afternoon. Glossy coloured tiles on a white deck, a lane rope of floats
// round it, bright water that shows wherever a tile drops, and every player as their own avatar. Each floor colour also has its own shape
// and name, so it can be told apart without seeing colour: a runner finds "the blue circle", not only "blue".

export const TITLE = 'STAND ON THE COLOR';
export const FONT = 'Sora';

export const COLORS = {
  water: '#3cc8e6',
  /** The water seen through the hole a tile leaves. */
  deep: '#1fa2cf',
  deck: '#fff6e4',
  float: '#ff4d5e',
  ink: '#1b1f3a',
  shadow: '#1b1f3a55',
  gold: '#ffd23f',
  bad: '#ff4d5e',
};

/** The floor's colours, in the order the rules number them: blue, red, green, yellow, purple. */
export const TILE_COLORS = [
  { name: 'BLUE', fill: '#3b82f6', edge: '#1d4ed8' },
  { name: 'RED', fill: '#ef4444', edge: '#b91c1c' },
  { name: 'GREEN', fill: '#22c55e', edge: '#15803d' },
  { name: 'YELLOW', fill: '#facc15', edge: '#a16207' },
  { name: 'PURPLE', fill: '#a855f7', edge: '#7e22ce' },
];

/** One colour per seat: the ring under a runner's feet. */
export const RUNNER_COLORS = ['#ffffff', '#ffb86b', '#7cf2e6', '#ff8fd8', '#c0ff6b', '#9ab7ff', '#ffd9a0', '#d0b0ff'];

/** Water thrown up where something drops in: a particle burst of the game's own (`feel.particles.burst(SPLASH, at)`). */
export const SPLASH = { count: 14, life: [0.35, 0.7], speed: [2, 5], direction: Math.PI / 2, spread: 1.3, size: [0.12, 0.22], sizeEnd: 0.05, color: ['#ffffff', '#c4f4ff'], gravity: 10, drag: 0.8 };

/** A higher layer draws over a lower one. */
export const LAYERS = defineRenderLayers(['water', 'stage', 'pits', 'tiles', 'symbols', 'shadows', 'runners', 'fx']);

export const theme = { font: FONT, colors: { accent: COLORS.gold }, shadow: 'hard' };
