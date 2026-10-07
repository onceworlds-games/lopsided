import { Transform, defineSystem } from '@onceworlds/engine';
import { Aim, Board, Hand, LocalStone, Seat, Stone } from '../components.js';
import { boardOf, plainStones } from '../queries.js';
import { BEATS, clampAim, dropTime, pointsAt, scoreTable, targetTilt, tipperOf } from '../rules.js';
import { sortStones, stepFallen, stepStones } from './physics.js';

// The host's rules (`authority: 'host'`): only the host's page runs them, and a new host carries on from the replicated Board and stones.
//
//   drop    - when a beat's time is up, every seat's aim for that beat becomes a stone (a boulder if it asked and still has one). Each beat
//             drops once: the Board says which was last, and a seat that already has a stone for the beat (a host that changed halfway
//             through a drop) gets no second one.
//   physics - the table leans, stones slide and fall; whoever's drop tipped it gets the credit for rival stones that fall soon after.
//             Each seat's live score is written to its Hand.

/** Seconds after a drop in which stones that fall are credited to that beat's tipper. */
export const TIP_WINDOW = 4;

export const HostDrop = defineSystem({
  name: 'lopsided:drop',
  stage: 'fixed',
  authority: 'host',
  queries: { seats: [Seat, Aim, Hand], stones: [Stone] },
  run({ queries, world, flow }) {
    if (flow.phase !== 'playing') return;
    const board = boardOf(world)?.get(Board);
    if (!board) return;
    const next = board.dropped + 1;
    if (next >= BEATS.perRound || flow.context().elapsed < dropTime(next)) return;

    const have = new Set();
    queries.stones.each((_e, stone) => void (stone.beat === next && have.add(stone.seat)));
    const dropped = [];
    queries.seats.each((_entity, seat, aim, hand) => {
      if (aim.beat !== next || have.has(seat.index)) return;
      const at = clampAim(aim.x, aim.y);
      const heavy = aim.heavy && hand.boulder;
      if (heavy) {
        hand.boulder = false;
        flow.stat('boulders', 1, seat.id);
      }
      world.spawn([Transform({ position: [at.x, at.y, 0] }), Stone({ seat: seat.index, heavy, beat: next })], { owner: 'host' });
      dropped.push({ seat: seat.index, x: at.x, y: at.y, m: heavy ? 3 : 1 });
    });
    board.dropped = next;
    // Whose stone pushed hardest toward where the table now wants to lean.
    const lean = targetTilt(plainStones(world), null, board.k);
    board.tipBeat = next;
    board.tipper = tipperOf(dropped, lean);
    board.tipFell = 0;
  },
});

export const HostPhysics = defineSystem({
  name: 'lopsided:physics',
  stage: 'fixed',
  authority: 'host',
  queries: { stones: [Stone, Transform], seats: [Seat, Hand] },
  run({ queries, world, flow, time }) {
    if (flow.phase !== 'playing') return;
    const entity = boardOf(world);
    if (!entity) return;
    const board = entity.get(Board);
    const dt = time.dt;
    const { on, off } = sortStones(queries.stones, (e) => e.has(LocalStone));
    const table = { x: board.x, y: board.y, vx: board.vx, vy: board.vy, k: board.k };
    const fell = stepStones(table, on, dt);
    board.x = table.x;
    board.y = table.y;
    board.vx = table.vx;
    board.vy = table.vy;

    if (fell.length) {
      const elapsed = flow.context().elapsed;
      const ids = {};
      queries.seats.each((entity, seat) => void (ids[seat.index] = { id: seat.id, hand: entity.get(Hand) }));
      const credit = board.tipper >= 0 && board.tipBeat >= 0 && elapsed - dropTime(board.tipBeat) < TIP_WINDOW;
      for (const { stone } of fell) {
        board.fell = Math.min(65535, board.fell + 1);
        const owner = ids[stone.seat];
        if (owner) owner.hand.lost = Math.min(255, owner.hand.lost + 1);
        if (credit && stone.seat !== board.tipper) {
          board.tipFell = Math.min(255, board.tipFell + 1);
          const tipper = ids[board.tipper];
          if (tipper) flow.stat('tipped', 1, tipper.id);
        }
      }
    }
    for (const done of stepFallen(off, dt)) world.despawn(done);

    // Live scores, for the seat pucks.
    const score = scoreTable(on.filter((e) => !(e.stone.gone > 0)).map(({ stone, tr }) => ({ seat: stone.seat, x: tr.position.x, y: tr.position.y })));
    queries.seats.each((_e, seat, hand) => {
      const now = score[seat.index] ?? 0;
      if (hand.score !== now) hand.score = now;
    });
  },
});

/** Each seat's points for what is on the table now: `{ [seat id]: points }`, every seat included. */
export function roundScores(world, seats) {
  const byIndex = {};
  for (const s of plainStones(world)) byIndex[s.seat] = (byIndex[s.seat] ?? 0) + pointsAt(s.x, s.y);
  const out = {};
  for (const seat of seats) out[seat.id] = byIndex[seat.index] ?? 0;
  return out;
}
