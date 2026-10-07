import { Transform } from '@onceworlds/engine';
import { Avatar2D, NameTag, Shape2D, Sprite } from '@onceworlds/engine/modules';
import { Look } from './components.js';
import { COLORS, LAYERS, RUNNER_COLORS } from './theme.js';
import { SYMBOLS } from './rules.js';

// How things are drawn. Real runners, the title screen's puppets and the posters all go through `dressRunner`, so they always look alike.
//
//   runner (its Transform is the spot on the floor)
//   ├─ shadow, ring      on the floor
//   └─ anchor            its z follows the runner's y, so whoever stands lower on the screen is drawn in front; it lifts a ghost up
//      └─ figure         Avatar2D: the player's own avatar, walking, turning and cheering by itself

export const runnerColor = (index) => RUNNER_COLORS[index % RUNNER_COLORS.length];

/** The outline of a symbol, as `[x, y]` pairs around the origin with the given radius. Each floor colour has one. */
export function symbolPoints(kind, r = 1) {
  const name = SYMBOLS[kind % SYMBOLS.length];
  const ring = (n, rotation, radius = r) => Array.from({ length: n }, (_, i) => [Math.cos(rotation + (i / n) * Math.PI * 2) * radius, Math.sin(rotation + (i / n) * Math.PI * 2) * radius]);
  if (name === 'circle') return ring(16, 0);
  if (name === 'triangle') return ring(3, Math.PI / 2, r * 1.1);
  if (name === 'square') return ring(4, Math.PI / 4, r * 1.05);
  if (name === 'diamond') return ring(4, 0, r * 1.15);
  // A star alternates the outer and inner points.
  return Array.from({ length: 10 }, (_, i) => {
    const radius = i % 2 ? r * 0.5 : r * 1.2;
    const angle = Math.PI / 2 + (i / 10) * Math.PI * 2;
    return [Math.cos(angle) * radius, Math.sin(angle) * radius];
  });
}

/**
 * Add the visuals to an entity that has a Transform: a shadow and a ring in the seat's colour on the floor, the player's own avatar
 * standing on them, and a name over it. `out` is what the page has already seen of the runner; `id` dresses it as that player.
 */
export function dressRunner(world, entity, { id = '', color = 0, name = '', you = false, bot = false, out = false, hud = true } = {}) {
  const child = (parent, parts) => world.spawn([Transform(), ...parts], { parent });
  const shadow = child(entity, [Shape2D({ shape: 'ellipse', size: [1, 0.5], fill: COLORS.shadow, layer: LAYERS.shadows })]);
  child(entity, [Shape2D({ shape: 'ellipse', size: [1.1, 0.58], fill: '#00000000', stroke: runnerColor(color), strokeWidth: you ? 0.14 : 0.08, layer: LAYERS.shadows, z: 1 })]);
  const anchor = child(entity, []);
  const figure = child(anchor, [Avatar2D({ player: id, height: 1.6, layer: LAYERS.runners })]);
  entity.add(Look({ out, figure: figure.id, shadow: shadow.id }));
  if (hud) entity.add(NameTag({ text: name, playerId: bot ? '' : id, you, badge: bot ? 'BOT' : '', offset: [0, 2.1] }));
  return entity;
}

/** A runner that is only a picture (the title screen, the posters), dressed as the avatar of `id`. */
export function puppet(world, { x = 0, y = 0, id = 'bot:1', color = 0 } = {}) {
  const entity = world.spawn([Transform({ position: [x, y, 0] })]);
  return dressRunner(world, entity, { id, color, hud: false });
}

const PARTS = ['head', 'torso', 'armLeft', 'armRight', 'legLeft', 'legRight'];

/** Sort the runner by depth, and float a runner who is out as a pale ghost. Called each frame for every runner and puppet. */
export function poseRunner(world, entity, look, out, now) {
  const figure = world.entity(look.figure);
  const anchor = figure?.parent;
  if (!anchor) return;
  const { x, y } = entity.get(Transform).position;
  anchor.get(Transform).position.set(0, out ? 0.6 + Math.sin(now * 3 + x) * 0.15 : 0, -y * 0.1);
  const opacity = out ? 0.45 : 1;
  for (const part of PARTS) {
    const sprite = Avatar2D.part(figure, part);
    if (sprite) sprite.get(Sprite).opacity = opacity;
  }
  for (const child of entity.children) if (child.has(Shape2D)) child.get(Shape2D).opacity = out ? 0.3 : 1;
}
