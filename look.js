import { Transform } from '@onceworlds/engine';
import { NameTag, Shape2D, Text } from '@onceworlds/engine/modules';
import { Ghost, SeatLook, StoneLook } from './components.js';
import { STONE, TABLE } from './rules.js';
import { COLORS, LAYERS, seatStyle } from './theme.js';

// How things are drawn. Real stones, the title's and the lobby's local stones and the posters all go through `dressStone`, and every
// seat (in a match, in the lobby, on a poster) through `dressSeat`, so they always look alike.
//
//   stone (its Transform is the spot on the table)
//   ├─ shadow     a dark disc, a little down and to the right
//   └─ body       the puck in the seat's colour, ink edge
//      ├─ ring    a lighter inner ring (a boulder's is thick, in the seat's colour on a dark puck)
//      ├─ symbol  the seat's white symbol
//      └─ gloss   a highlight up and to the left

/** The outline of a symbol, as `[x, y]` pairs round the origin with the given radius. */
export function symbolPoints(name, r = 1) {
  const ring = (n, rotation, radius = r) => Array.from({ length: n }, (_, i) => [Math.cos(rotation + (i / n) * Math.PI * 2) * radius, Math.sin(rotation + (i / n) * Math.PI * 2) * radius]);
  if (name === 'circle') return ring(18, 0, r * 0.9);
  if (name === 'triangle') return ring(3, Math.PI / 2, r * 1.15).map(([x, y]) => [x, y - r * 0.12]);
  if (name === 'square') return ring(4, Math.PI / 4, r * 1.05);
  if (name === 'diamond') return ring(4, 0, r * 1.15);
  if (name === 'hexagon') return ring(6, 0, r);
  if (name === 'plus') {
    const a = r * 0.36;
    const b = r;
    return [[-a, b], [a, b], [a, a], [b, a], [b, -a], [a, -a], [a, -b], [-a, -b], [-a, -a], [-b, -a], [-b, a], [-a, a]];
  }
  if (name === 'heart') {
    return Array.from({ length: 24 }, (_, i) => {
      const t = (i / 24) * Math.PI * 2;
      const x = 16 * Math.sin(t) ** 3;
      const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      return [(x / 16) * r, (y / 16) * r + r * 0.12];
    });
  }
  // A star alternates the outer and inner points.
  return Array.from({ length: 10 }, (_, i) => {
    const radius = i % 2 ? r * 0.5 : r * 1.2;
    const angle = Math.PI / 2 + (i / 10) * Math.PI * 2;
    return [Math.cos(angle) * radius, Math.sin(angle) * radius];
  });
}

const child = (world, parent, parts) => world.spawn([Transform(), ...parts], { parent });

/** Give a stone (an entity with a Transform) its look: a puck of seat `seat`'s colour and symbol, bigger and darker for a boulder. */
export function dressStone(world, entity, { seat = 0, heavy = false } = {}) {
  const style = seatStyle(seat);
  const r = heavy ? STONE.boulderRadius : STONE.radius;
  const shadow = child(world, entity, [Shape2D({ shape: 'circle', radius: r * 1.02, fill: '#05041a66', layer: LAYERS.stoneShadows })]);
  shadow.get(Transform).position.set(0.14, -0.2, 0);
  const body = child(world, entity, [Shape2D({ shape: 'circle', radius: r, fill: heavy ? style.edge : style.fill, stroke: COLORS.ink, strokeWidth: heavy ? 0.16 : 0.1, layer: LAYERS.stones })]);
  child(world, body, [Shape2D({ shape: 'circle', radius: r * 0.74, fill: '#00000000', stroke: heavy ? style.fill : '#ffffff55', strokeWidth: heavy ? 0.16 : 0.06, layer: LAYERS.stones, z: 1 })]);
  child(world, body, [Shape2D({ shape: 'polygon', points: symbolPoints(style.symbol, r * (heavy ? 0.42 : 0.4)), fill: '#fffffff2', layer: LAYERS.stones, z: 2 })]);
  const gloss = child(world, body, [Shape2D({ shape: 'ellipse', size: [r * 0.62, r * 0.32], fill: '#ffffff59', layer: LAYERS.stones, z: 3 })]);
  gloss.get(Transform).position.set(-r * 0.3, r * 0.48, 0);
  entity.add(StoneLook({ body: body.id, shadow: shadow.id }));
  return entity;
}

/** A stone that is only a picture (posters), at (x, y). */
export function pictureStone(world, x, y, seat, heavy = false) {
  return dressStone(world, world.spawn([Transform({ position: [x, y, 0] })]), { seat, heavy });
}

/**
 * Give a seat its look: a card (a child of the seat that systems/looks.js places for this screen's shape) with a puck in the seat's
 * colour and symbol, the live score on it, a small dark boulder while it is still in hand, and the player's avatar and name.
 */
export function dressSeat(world, entity, { seat = 0, id = '', name = '', you = false, bot = false, tag = true } = {}) {
  const style = seatStyle(seat);
  const card = child(world, entity, []);
  const puck = child(world, card, [Shape2D({ shape: 'circle', radius: 1.15, fill: style.fill, stroke: you ? COLORS.gold : COLORS.ink, strokeWidth: you ? 0.26 : 0.14, shadow: '#05041a99', shadowBlur: 6, shadowOffset: [0.1, -0.16], layer: LAYERS.seats })]);
  const badge = child(world, puck, [Shape2D({ shape: 'circle', radius: 0.44, fill: COLORS.ink, layer: LAYERS.seats, z: 2 })]);
  badge.get(Transform).position.set(0.86, 0.76, 0);
  child(world, badge, [Shape2D({ shape: 'polygon', points: symbolPoints(style.symbol, 0.24), fill: style.fill, layer: LAYERS.seats, z: 3 })]);
  const score = child(world, puck, [Text({ text: '0', size: 1.15, weight: 800, color: COLORS.white, outline: 0.16, outlineColor: COLORS.ink, layer: LAYERS.seats, z: 4 })]);
  // The boulder in hand: a small dark puck at the seat's lower left.
  const boulder = child(world, card, [Shape2D({ shape: 'circle', radius: 0.46, fill: style.edge, stroke: COLORS.ink, strokeWidth: 0.1, layer: LAYERS.seats, z: 1 })]);
  boulder.get(Transform).position.set(-1.1, -0.85, 0);
  child(world, boulder, [Shape2D({ shape: 'circle', radius: 0.26, fill: '#00000000', stroke: style.fill, strokeWidth: 0.1, layer: LAYERS.seats, z: 2 })]);
  if (tag) card.add(NameTag({ text: name, playerId: bot ? '' : id, you, badge: bot ? 'BOT' : '', offset: [0, 2.2] }));
  entity.add(SeatLook({ card: card.id, puck: puck.id, score: score.id, boulder: boulder.id }));
  return entity;
}

/**
 * Where seat `index` of `count` is drawn on a screen of this shape (width / height). The table always gets the most room: on a wide
 * screen the seats stand in a column either side of it, on a tall one (a phone held upright) in a row above and a row below it.
 * Returns the spot and whether its name goes above (`up`) or below the puck.
 */
export function seatSpot(index, count, aspect) {
  const n = Math.max(1, count);
  const first = Math.ceil(n / 2);
  const side = index < first ? 0 : 1;
  const inLine = side === 0 ? first : n - first;
  const k = side === 0 ? index : index - first;
  const spread = (span) => (inLine <= 1 ? 0 : -span / 2 + (span * k) / (inLine - 1));
  if (aspect >= 1.05) {
    // Columns: left from the top down, right from the top down.
    const y = -spread(TABLE.radius * 1.5) + 0.6;
    return { x: (side === 0 ? -1 : 1) * (TABLE.radius + 5.2), y, up: true };
  }
  // Rows: the first half under the table (nearest the thumbs), the rest above it.
  return { x: spread(TABLE.radius * 1.55), y: side === 0 ? -(TABLE.radius + 2.6) : TABLE.radius + 2.6, up: side === 1 };
}

/** This page's own aim: a see-through stone of its colour with a turning dashed ring, and its symbol on the spot. */
export function spawnGhost(world, seat) {
  const style = seatStyle(seat);
  const ghost = world.spawn([Transform({ position: [0, 0, 0], scale: [0, 0, 1] }), Shape2D({ shape: 'circle', radius: STONE.radius, fill: style.fill, opacity: 0.55, stroke: COLORS.ink, strokeWidth: 0.08, layer: LAYERS.ghost })]);
  const ring = child(world, ghost, [Shape2D({ shape: 'circle', radius: STONE.radius + 0.35, fill: '#00000000', stroke: COLORS.ink, strokeWidth: 0.12, dash: 0.35, layer: LAYERS.ghost, z: 1 })]);
  const cross = child(world, ghost, [Shape2D({ shape: 'polygon', points: symbolPoints(style.symbol, STONE.radius * 0.42), fill: '#ffffffcc', layer: LAYERS.ghost, z: 2 })]);
  ghost.add(Ghost({ ring: ring.id, cross: cross.id }));
  return ghost;
}
