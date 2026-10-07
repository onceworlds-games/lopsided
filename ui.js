import { defineModule } from '@onceworlds/engine';
import { UI, servicesOf } from '@onceworlds/engine/modules';
import { Aim, Beat, Board, Hand, RoundClock, Seat } from './components.js';
import { boardOf, mySeat, plainStones } from './queries.js';
import { BEATS, BOULDER_KEPT, STONE, TABLE, danger, targetTilt } from './rules.js';
import { COLORS, seatStyle } from './theme.js';

// The HUD answers "what now?" at a glance: the lean (a marble that rolls to the low side, red past the tipping point, and a ghost marble
// for where your aimed stone would send it), the beats left, the seconds to the drop, and your boulder. Two words appear when they
// matter ("TAP THE TABLE", "BOULDER ARMED") and then go. The title, countdown, banner, scoreboard and podium are the engine's own screens.

/** What the HUD shows right now, as plain data (the tests read it too). */
export function hudState(world, me) {
  const clock = world.resource(RoundClock);
  const beat = world.resource(Beat);
  const board = boardOf(world)?.get(Board);
  const seat = mySeat(world, me);
  const aim = seat?.get(Aim);
  const hand = seat?.get(Hand);
  const lean = board ? { x: board.x, y: board.y } : { x: 0, y: 0 };
  let preview = null;
  if (aim && clock.phase === 'aim' && aim.beat === clock.beat) {
    const m = aim.heavy ? STONE.boulderMass : STONE.mass;
    preview = targetTilt(plainStones(world), { x: aim.x, y: aim.y, m }, board?.k);
  }
  return {
    phase: clock.phase,
    beat: clock.beat,
    left: clock.left,
    fraction: clock.length > 0 ? clock.left / clock.length : 0,
    lean,
    preview,
    danger: danger(lean),
    seat: seat ? seat.get(Seat).index : -1,
    boulder: hand ? hand.boulder : false,
    armed: beat.armed,
    aimed: beat.aimed,
    hasAim: !!aim && aim.beat === clock.beat && clock.phase === 'aim',
    double: clock.double,
  };
}

/** The lean gauge: a dish with the tipping ring, the marble where the lean is now, a ghost marble where your stone would send it. */
const gauge = (state) =>
  UI.custom({
    w: 64,
    h: 64,
    draw(p, r) {
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;
      const R = r.w / 2 - 3;
      const reach = R - 8;
      // The ring where stones on the rim start to go: the lean's danger is 1 there.
      const edge = (TABLE.grip - TABLE.dome * TABLE.radius) / TABLE.maxTilt;
      const hot = state.danger >= 1;
      p.circle(cx, cy, R, { fill: COLORS.ink, stroke: hot ? COLORS.danger : COLORS.brass, strokeWidth: 3 });
      p.circle(cx, cy, reach * edge + 7, { fill: '#00000000', stroke: hot ? COLORS.danger : '#ffffff55', strokeWidth: 2 });
      const spot = (lean) => [cx + (lean.x / TABLE.maxTilt) * reach, cy - (lean.y / TABLE.maxTilt) * reach];
      if (state.preview) {
        const [gx, gy] = spot(state.preview);
        p.circle(gx, gy, 6, { fill: '#ffffff40', stroke: '#ffffffaa', strokeWidth: 2 });
      }
      const [mx, my] = spot(state.lean);
      p.circle(mx, my, 8, { fill: hot ? COLORS.danger : COLORS.gold, stroke: COLORS.ink, strokeWidth: 2 });
    },
  });

/** Eight pips: the beats of the round, done ones dark, the current one in your colour. */
const pips = (state, color) =>
  UI.custom({
    w: 8 * 14,
    h: 14,
    draw(p, r) {
      for (let i = 0; i < BEATS.perRound; i++) {
        const done = state.phase === 'settle' || state.phase === 'done' || i < state.beat;
        const now = state.phase === 'aim' && i === state.beat;
        p.circle(r.x + 7 + i * 14, r.y + 7, now ? 6 : 4.5, { fill: done ? '#ffffff30' : now ? color : '#ffffffcc', stroke: now ? COLORS.white : undefined, strokeWidth: now ? 2 : 0 });
      }
    },
  });

/** Your boulder: a dark puck, lit when armed, faded once used. With a keyboard it is a button too (on a phone the platform's button is). */
function boulderChip(state, onToggle) {
  if (state.seat < 0) return null;
  const style = seatStyle(state.seat);
  const chip = UI.custom({
    w: 40,
    h: 40,
    draw(p, r) {
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;
      p.withAlpha(state.boulder ? 1 : 0.3, () => {
        if (state.armed && state.boulder) p.circle(cx, cy, 19, { fill: '#00000000', stroke: COLORS.gold, strokeWidth: 4 });
        p.circle(cx, cy, 14, { fill: style.edge, stroke: COLORS.ink, strokeWidth: 2 });
        p.circle(cx, cy, 8, { fill: '#00000000', stroke: style.fill, strokeWidth: 3 });
      });
    },
  });
  const kept = state.boulder && !state.armed && UI.label(`+${BOULDER_KEPT.points}`, { size: 18, color: COLORS.gold, weight: 800 });
  if (!onToggle || !state.boulder) return UI.column({ gap: 0, align: 'center' }, chip, kept);
  return UI.button(state.armed ? 'ARMED' : 'BOULDER  B', { kind: state.armed ? 'primary' : 'secondary', onClick: onToggle });
}

export function hudTree(state, onToggle = null) {
  const color = state.seat >= 0 ? seatStyle(state.seat).fill : COLORS.gold;
  const word =
    state.phase === 'idle' ? UI.label('GET READY', { size: 24, color: 'accent' })
    : state.phase === 'aim' ? UI.label(state.left <= BEATS.lock ? 'DROP!' : `DROP IN ${Math.ceil(state.left)}`, { size: 24, color: state.left <= 1 ? COLORS.danger : COLORS.white })
    : UI.label('LAST SLIDES', { size: 22, color: 'accent' });
  return UI.panel(
    { pad: [6, 12], gap: 12, dir: 'row', align: 'center', radius: 18 },
    gauge(state),
    UI.column(
      { gap: 6, align: 'start' },
      UI.row({ gap: 8, align: 'center' }, word, state.double && UI.label('x2', { size: 22, color: COLORS.gold, weight: 800 })),
      pips(state, color),
      state.phase === 'aim' && UI.bar(state.fraction, { w: 8 * 14, h: 6, fill: state.left <= 1 ? COLORS.danger : color }),
    ),
    boulderChip(state, onToggle),
  );
}

/** The two-word prompts: what to do now, shown only while it matters. */
export function promptTree(state) {
  if (state.phase !== 'aim' && state.phase !== 'idle') return null;
  if (state.armed && state.boulder) return UI.label('BOULDER ARMED', { size: 26, color: COLORS.gold, weight: 800, outline: true });
  if (!state.aimed && state.seat >= 0) return UI.label(state.phase === 'idle' ? 'TAP THE TABLE TO AIM' : 'TAP THE TABLE', { size: 30, color: COLORS.white, weight: 800, outline: true });
  if (state.phase === 'aim' && !state.hasAim && state.seat >= 0 && state.left < 2.5) return UI.label('AIM!', { size: 30, color: COLORS.danger, weight: 800, outline: true });
  return null;
}

export const GameUI = () =>
  defineModule({
    name: 'lopsided-ui',
    init(game) {
      const { ui } = servicesOf(game);
      const playing = ({ flow }) => flow !== null && flow.phase === 'playing' && !servicesOf(game).poster?.active;
      const me = () => servicesOf(game).net?.me ?? 'me';
      // Under the round and the clock (the standard `flow.hud`), which sit at the top centre.
      // With a keyboard and mouse the boulder is also a button on the HUD (B); on a phone the platform's touch button does it.
      const toggle = () => servicesOf(game).input?.tap?.('boulder');
      ui.view('lopsided:hud', ({ world, touch }) => hudTree(hudState(world, me()), touch ? null : toggle), { anchor: 'top', offset: [0, 58], order: 4, when: playing });
      ui.view('lopsided:prompt', ({ world }) => promptTree(hudState(world, me())) ?? UI.spacer(), { anchor: 'bottom', offset: [0, 40], order: 5, when: playing });
    },
  });
