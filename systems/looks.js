import { Transform, clamp, defineSystem, quat } from '@onceworlds/engine';
import { Camera, FlowState, NameTag, Shape2D, Text, easeFn, servicesOf } from '@onceworlds/engine/modules';
import { Board, Hand, LeanArrow, RimPiece, Seat, SeatLook, Stone, StoneLook, TableCamera, TableShadow } from '../components.js';
import { dressSeat, dressStone, seatSpot } from '../look.js';
import { boardOf } from '../queries.js';
import { TABLE, danger } from '../rules.js';
import { COLORS, LAYERS, SPILL, THUD, seatStyle } from '../theme.js';
import { FALL_SECONDS } from './physics.js';
import { sandboxOf } from './sandbox.js';
import { lobbyColor } from './aim.js';

// How everything looks, on every page, from what it reads (nothing here decides anything):
//
//   dress-stones / stone-motion  - every stone gets its puck; a new one drops in from above with a puff of dust, a falling one tips over
//                                  the edge, shrinks and fades, with crumbs and its lost points
//   dress-seats / seat-looks     - every seat its puck, name and boulder; the live score on it
//   table-look                   - the table's shadow slides to the low side, the rim glows red where stones are about to go, chevrons
//                                  point downhill
//   camera-fit                   - the whole table and the seats in view under the HUD, on a tall phone and a wide screen

/** The table's lean right now: the round's Board, the local table behind the title and in the lobby, or level. */
export function leanOf(world) {
  const board = boardOf(world)?.get(Board);
  if (board) return board;
  return sandboxOf(world)?.table ?? { x: 0, y: 0 };
}

export const DressStones = defineSystem({
  name: 'lopsided:dress-stones',
  stage: 'update',
  query: [Stone, Transform, { without: [StoneLook] }],
  run({ query, world }) {
    query.each((entity, stone) => void dressStone(world, entity, { seat: stone.seat, heavy: stone.heavy }));
  },
});

const back = easeFn('backOut');

export const StoneMotion = defineSystem({
  name: 'lopsided:stone-motion',
  stage: 'update',
  query: [Stone, StoneLook, Transform],
  run({ query, world, time, feel }) {
    const dt = time.dt;
    query.each((entity, stone, look, tr) => {
      const body = world.entity(look.body);
      const shadow = world.entity(look.shadow);
      if (!body) return;
      look.age += dt;
      // Dropping in: from above (bigger, shadow far off) to the table, with a bounce.
      const land = clamp(look.age / 0.22, 0, 1);
      let scale = 1.7 - 0.7 * back(land);
      if (land >= 1 && !look.slid) {
        look.slid = true;
        feel?.particles.burst(THUD, tr.position, { count: stone.heavy ? 18 : 8, layer: LAYERS.fx });
        if (stone.heavy) feel?.shake(0.25);
      }
      if (shadow) {
        const off = 0.14 + (1 - land) * 0.9;
        shadow.get(Transform).position.set(off, -off * 1.4, 0);
      }
      // Falling: over the edge it tips, shrinks and fades.
      if (stone.gone > 0) {
        if (!look.fallen) {
          look.fallen = true;
          const style = seatStyle(stone.seat);
          const d = Math.hypot(tr.position.x, tr.position.y) || 1;
          feel?.particles.burst(SPILL, tr.position, { direction: Math.atan2(tr.position.y / d, tr.position.x / d), layer: LAYERS.fx });
          feel?.floatText(stone.heavy ? 'BOULDER!' : '-3', { x: tr.position.x, y: tr.position.y + 1 }, { color: style.fill, size: 1.1, layer: LAYERS.fx });
        }
        const k = clamp(stone.gone / FALL_SECONDS, 0, 1);
        scale *= 1 - 0.75 * k;
        body.get(Shape2D).opacity = 1 - k;
        if (shadow) shadow.get(Shape2D).opacity = 0;
        quat.fromAngleZ(body.get(Transform).rotation, k * 2.5);
      }
      body.get(Transform).scale.set(scale, scale, 1);
    });
  },
});

function nameOf(world, flow, id) {
  const seat = flow?.seats?.find((s) => s.id === id);
  if (seat) return seat.name;
  const players = world.resource(FlowState).players;
  const known = Array.isArray(players) ? players.find((p) => p.id === id) : null;
  return known?.name ?? (id.startsWith('bot:') ? 'Bot' : 'Player');
}

export const DressSeats = defineSystem({
  name: 'lopsided:dress-seats',
  stage: 'update',
  query: [Seat, Transform, { without: [SeatLook] }],
  run({ query, world, flow, net }) {
    query.each((entity, seat) => {
      const color = entity.has(Hand) ? seat.index : lobbyColor(seat.id);
      dressSeat(world, entity, { seat: color, id: seat.id, name: nameOf(world, flow, seat.id), you: seat.id === net?.me, bot: seat.id.startsWith('bot:') });
    });
  },
});

export const SeatLooks = defineSystem({
  name: 'lopsided:seat-looks',
  stage: 'update',
  query: [Seat, SeatLook, Transform],
  run({ query, world, feel, audio, net }) {
    query.each((entity, seat, look) => {
      const hand = entity.has(Hand) ? entity.get(Hand) : null;
      const score = hand?.score ?? 0;
      const puck = world.entity(look.puck);
      if (look.shown !== score) {
        const text = world.entity(look.score);
        if (text) text.get(Text).text = String(score);
        if (puck && look.shown >= 0 && score > look.shown) feel?.squash(puck);
        look.shown = score;
      }
      if (hand && hand.lost > look.lost) {
        look.lost = hand.lost;
        if (puck) feel?.squash(puck);
        if (seat.id === net?.me) {
          feel?.shake(0.3);
          audio?.play('hurt', { volume: 0.5 });
        }
      }
      const boulder = world.entity(look.boulder);
      if (boulder) {
        const shape = boulder.get(Shape2D);
        const visible = !hand || hand.boulder;
        if (shape.visible !== visible) {
          shape.visible = visible;
          for (const child of boulder.children) if (child.has(Shape2D)) child.get(Shape2D).visible = visible;
        }
      }
    });
  },
});

const aspectOf = (ui) => {
  const screen = ui?.safe.screen;
  return screen && screen.w > 0 && screen.h > 0 ? screen.w / screen.h : 16 / 9;
};

/**
 * Seats are drawn where this screen has room (look.js `seatSpot`): the seat entity stays where its page put it, and its card (a child) is
 * moved so that it lands on the spot. Match seats go by their seat number; lobby pucks by who arrived, in id order.
 */
export const SeatLayout = defineSystem({
  name: 'lopsided:seat-layout',
  stage: 'update',
  query: [Seat, SeatLook, Transform],
  run({ query, world, ui }) {
    const aspect = aspectOf(ui);
    const match = [];
    const lobby = [];
    query.each((entity, seat) => void (entity.has(Hand) ? match : lobby).push({ entity, index: seat.index, id: seat.id }));
    lobby.sort((a, b) => (a.id < b.id ? -1 : 1));
    const place = (list, byIndex) => {
      list.forEach((row, i) => {
        const spot = seatSpot(byIndex ? row.index : i, byIndex ? Math.max(list.length, row.index + 1) : list.length, aspect);
        const look = row.entity.get(SeatLook);
        const key = `${spot.x.toFixed(2)},${spot.y.toFixed(2)}`;
        const card = world.entity(look.card);
        if (!card) return;
        const at = row.entity.get(Transform).position;
        card.get(Transform).position.set(spot.x - at.x, spot.y - at.y, 0);
        if (look.layout !== key) {
          look.layout = key;
          if (card.has(NameTag)) card.get(NameTag).offset.set(0, spot.up ? 2.3 : -2.3);
        }
      });
    };
    place(match, true);
    place(lobby, false);
  },
});

/** Rim colours from brass (high or safe) to red (low and about to shed stones), precomputed. */
const RIM_STEPS = ['#e2a93b', '#e99a39', '#f08537', '#f66e3a', '#fb5a3c', '#ff4d3d', '#ff3b30'];

/** The colour last given to a shape's fill or stroke, so it is only written when it changes. */
const painted = new WeakMap();
function paint(entity, color, key, value) {
  let seen = painted.get(entity);
  if (!seen) painted.set(entity, (seen = {}));
  if (seen[key] === value) return;
  seen[key] = value;
  color.copy(value);
}

export const TableLook = defineSystem({
  name: 'lopsided:table-look',
  stage: 'update',
  queries: { rim: [RimPiece, Shape2D], shadow: [TableShadow, Transform], arrows: [LeanArrow, Shape2D, Transform] },
  run({ queries, world, time }) {
    const lean = leanOf(world);
    const size = Math.hypot(lean.x, lean.y);
    const ux = size > 1e-5 ? lean.x / size : 0;
    const uy = size > 1e-5 ? lean.y / size : 0;
    const risk = danger(lean);
    queries.shadow.each((_e, _tag, tr) => tr.position.set(lean.x * 22, lean.y * 22 - 0.4, 0));
    queries.rim.each((entity, piece, shape) => {
      // How low this piece of the rim is, from -1 (the high side) to 1 (the low side).
      const low = Math.cos(piece.angle) * ux + Math.sin(piece.angle) * uy;
      const heat = clamp(low * (risk - 0.35) * 1.6, 0, 1);
      const pulse = risk >= 1 ? 0.5 + 0.5 * Math.sin(time.now * 14) : 1;
      const step = Math.round(heat * pulse * (RIM_STEPS.length - 1));
      paint(entity, shape.stroke, 'stroke', RIM_STEPS[step]);
      shape.strokeWidth = 0.5 + 0.25 * heat;
    });
    const angle = Math.atan2(uy, ux);
    const show = clamp((risk - 0.3) * 1.1, 0, 0.75);
    queries.arrows.each((entity, arrow, shape, tr) => {
      const flowAt = (time.now * 0.9 + arrow.index / 3) % 1;
      const r = 1.2 + (TABLE.radius - 3.2) * flowAt;
      tr.position.set(ux * r, uy * r, 0);
      quat.fromAngleZ(tr.rotation, angle);
      const s = 0.8 + risk * 0.4;
      tr.scale.set(s, s, 1);
      shape.opacity = show * Math.sin(flowAt * Math.PI);
      paint(entity, shape.fill, 'fill', risk >= 1 ? COLORS.danger : COLORS.ringLine);
    });
  },
});

/** Screen pixels the HUD takes at the top while a round is on (the round, the clock and the beat panel), and the strip kept at the bottom. */
const HUD_TOP_PX = 186;
const HUD_BOTTOM = 0.05;
/** Half the room the table and its seats need: on a wide screen across (with the seat columns) and down (the table), on a tall one across (the table) and down (with the seat rows). */
const WIDE = { x: TABLE.radius + 9.5, y: TABLE.radius + 1.3 };
const TALL = { x: TABLE.radius + 1.1, y: TABLE.radius + 5.8 };

export const CameraFit = defineSystem({
  name: 'lopsided:camera-fit',
  stage: 'late',
  query: [TableCamera, Camera, Transform],
  run({ query, ui, flow, game }) {
    const aspect = aspectOf(ui);
    const poster = servicesOf(game).poster?.active;
    const screenH = ui?.safe.screen?.h || 720;
    const top = poster || flow.phase === 'title' ? 0 : clamp(HUD_TOP_PX / screenH, 0.1, 0.3);
    const bottom = poster || flow.phase === 'title' ? 0 : HUD_BOTTOM;
    const free = 1 - top - bottom;
    const need = aspect >= 1.05 ? WIDE : TALL;
    const height = Math.max((need.x * 2) / aspect, (need.y * 2) / free);
    query.each((_entity, _tag, camera, tr) => {
      camera.height = height;
      tr.position.set(0, (height * (top - bottom)) / 2, 0);
    });
  },
});
