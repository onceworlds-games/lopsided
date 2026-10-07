import { defineModule } from '@onceworlds/engine';
import { UI, servicesOf } from '@onceworlds/engine/modules';
import { Aim, Beat, Board, Hand, RoundClock, Seat } from './components.js';
import { boardOf, mySeat, plainStones } from './queries.js';
import { BEATS, STONE, TABLE, danger, targetTilt } from './rules.js';
import { COLORS, seatStyle } from './theme.js';
import { screenLayout } from './view.js';

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

/**
 * Your boulder, as a button: "BOULDER" while it is off, gold "ARMED" while your next drop is the boulder, and a faded "USED" puck once it
 * has dropped. On a touch screen the UI makes it thumb-sized (56 px); the key ("B") is only named where a keyboard is the input.
 */
function boulderControl(state, onToggle, keys) {
  if (state.seat < 0) return null;
  if (!state.boulder) {
    const style = seatStyle(state.seat);
    return UI.row(
      { gap: 6, align: 'center' },
      UI.custom({
        w: 30,
        h: 30,
        draw(p, r) {
          p.withAlpha(0.35, () => {
            p.circle(r.x + r.w / 2, r.y + r.h / 2, 13, { fill: style.edge, stroke: COLORS.ink, strokeWidth: 2 });
            p.circle(r.x + r.w / 2, r.y + r.h / 2, 7, { fill: '#00000000', stroke: style.fill, strokeWidth: 3 });
          });
        },
      }),
      UI.label('USED', { size: 18, color: 'dim' }),
    );
  }
  const label = state.armed ? 'ARMED' : keys ? 'BOULDER (B)' : 'BOULDER';
  return UI.button(label, { key: 'boulder', kind: state.armed ? 'primary' : 'secondary', onClick: onToggle ?? undefined, disabled: !onToggle });
}

export function hudTree(state, onToggle = null, keys = false) {
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
    boulderControl(state, onToggle, keys),
  );
}

/**
 * The prompts: what to do now, in two or three words, shown only while it matters. "TAP THE TABLE" until you first aim, "AIM!" when a
 * beat is running out and you haven't. They sit where view.js `screenLayout` keeps room for them, never over the table.
 */
export function promptTree(state, { maxWidth = 0 } = {}) {
  if (state.seat < 0 || (state.phase !== 'aim' && state.phase !== 'idle')) return null;
  const big = { weight: 800, outline: true, align: 'center', ...(maxWidth > 0 ? { maxWidth } : {}) };
  if (!state.aimed) return UI.label('TAP THE TABLE', { size: 32, color: COLORS.white, ...big });
  if (state.phase === 'aim' && !state.hasAim && state.left < 2.5) return UI.label('AIM!', { size: 34, color: COLORS.danger, ...big });
  return null;
}

/** Whether to name keys: a keyboard is the input (not touch, not a pad) and a mouse or a key has actually been used on this page. */
export function keyboardInUse(input, touch, beat) {
  if (!input || touch) return false;
  if (input.device !== 'keyboard' && input.device !== 'mouse') return false;
  return input.pointer('aim')?.type === 'mouse' || !!beat?.keyboard;
}

export const GameUI = () =>
  defineModule({
    name: 'lopsided-ui',
    init(game) {
      const { ui } = servicesOf(game);
      const playing = ({ flow }) => flow !== null && flow.phase === 'playing' && !servicesOf(game).poster?.active;
      const me = () => servicesOf(game).net?.me ?? 'me';
      const layoutOf = ({ width, height, scale }) => screenLayout(width * scale, height * scale, { scale });
      // The boulder button presses the same action as the B key (systems/aim.js toggles it).
      const toggle = () => servicesOf(game).input?.tap?.('boulder');
      // Under the round and the clock (the standard `flow.hud`), which sit at the top centre.
      ui.view(
        'lopsided:hud',
        (ctx) => hudTree(hudState(ctx.world, me()), toggle, keyboardInUse(servicesOf(game).input, ctx.touch, ctx.world.resource(Beat))),
        { anchor: 'top', offset: [0, 58], order: 4, when: playing },
      );
      // Prompts under the seats (a tall screen, or a wide one with no room beside the table). Only words, so they may sit where the thumbs
      // rest: kept "safe" they would be pushed up over the table on a phone...
      ui.view('lopsided:prompt', (ctx) => promptTree(hudState(ctx.world, me())) ?? UI.spacer(), {
        anchor: 'bottom',
        offset: [0, 18],
        order: 5,
        safe: false,
        when: (ctx) => playing(ctx) && layoutOf(ctx).prompt === 'bottom',
      });
      // ...or in the free space beside the left seat column, near the top, clear of the thumbs (a wide screen).
      ui.view(
        'lopsided:prompt-side',
        (ctx) => {
          const room = Math.max(60, layoutOf(ctx).side / ctx.scale - 16);
          const prompt = promptTree(hudState(ctx.world, me()), { maxWidth: room });
          return prompt ? UI.column({ w: room, align: 'center' }, prompt) : UI.spacer();
        },
        { anchor: 'top-left', offset: [8, 64], order: 5, when: (ctx) => playing(ctx) && layoutOf(ctx).prompt === 'left' },
      );
    },
  });
