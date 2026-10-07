import { defineRenderLayers } from '@onceworlds/engine/modules';

// How the game looks: a board game on a wobbly round table, late at night. A warm cream table with three rings (1, 2, 3 points) and a
// brass rim, on a deep indigo floor. Every player's stones are glossy pucks in their own colour with their own white symbol, so a stone
// is told apart without seeing colour. Danger is red: the low side of the rim glows when stones there are about to go.

export const TITLE = 'LOPSIDED';
export const FONT = 'Sora';

export const COLORS = {
  floor: '#15133a',
  floorGlow: '#262463',
  ink: '#1b1533',
  table: '#f6ead0',
  ringMiddle: '#fff6e2',
  ringInner: '#f3dfba',
  ringRim: '#ebc88f',
  ringLine: '#b98a4e',
  brass: '#e2a93b',
  brassDark: '#9c6a1c',
  shadow: '#05041acc',
  gold: '#ffd23f',
  danger: '#ff4d3d',
  safe: '#5ee38a',
  white: '#ffffff',
};

/** One colour and one symbol per seat (stones, seat pucks, ghost and callouts). */
export const SEATS = [
  { name: 'RED', fill: '#ff4f5e', edge: '#a3122a', symbol: 'circle' },
  { name: 'BLUE', fill: '#3d8bff', edge: '#163f9c', symbol: 'triangle' },
  { name: 'GREEN', fill: '#2fcf6b', edge: '#127238', symbol: 'square' },
  { name: 'YELLOW', fill: '#ffcc1f', edge: '#9c6a00', symbol: 'diamond' },
  { name: 'PURPLE', fill: '#a95cff', edge: '#5b1fae', symbol: 'star' },
  { name: 'ORANGE', fill: '#ff8a1f', edge: '#a34400', symbol: 'hexagon' },
  { name: 'CYAN', fill: '#20d3e6', edge: '#0a6f7c', symbol: 'plus' },
  { name: 'PINK', fill: '#ff5fbf', edge: '#a3136b', symbol: 'heart' },
];

export const seatStyle = (index) => SEATS[((index % SEATS.length) + SEATS.length) % SEATS.length];

/** Dust kicked up where a stone lands, and crumbs off the rim where one falls (feel.particles.burst(..., at)). */
export const THUD = { count: 10, life: [0.25, 0.5], speed: [2, 5], spread: Math.PI * 2, size: [0.12, 0.24], sizeEnd: 0.02, color: ['#fff6e2', '#e9d2a6'], drag: 3 };
export const SPILL = { count: 14, life: [0.4, 0.8], speed: [3, 7], spread: 1.1, size: [0.14, 0.3], sizeEnd: 0.04, color: ['#ffd23f', '#ff4d3d', '#ffffff'], drag: 1.5 };

/** A higher layer draws over a lower one. */
export const LAYERS = defineRenderLayers(['floor', 'shadow', 'table', 'rings', 'marks', 'stoneShadows', 'stones', 'ghost', 'seats', 'fx']);

export const theme = { font: FONT, colors: { accent: COLORS.gold }, shadow: 'hard' };
