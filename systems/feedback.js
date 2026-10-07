import { defineSystem } from '@onceworlds/engine';
import { servicesOf } from '@onceworlds/engine/modules';
import { Beat, Board, Callout, RoundClock, Seat, Stone } from '../components.js';
import { boardOf } from '../queries.js';
import { danger } from '../rules.js';
import { seatStyle } from '../theme.js';
import { leanOf } from './looks.js';

// Every action answers within a tenth of a second, on every page. Nothing here decides anything: each page watches the round's clock, the
// Board and the stones, compares them with what it already showed (`Beat`) and plays the effect once.
//
//   beat-feel - ticks before each drop, the drop itself (one thud for everyone's stones, a heavier one with a boulder), the table creaking
//               when it is close to shedding, stones going over the edge, and "TIPPED BY ..." when one beat's drop sheds three or more
//               rival stones.
//   music     - calm before the match, tense while it is on, more layers as the table nears its tipping point.

export const BeatFeel = defineSystem({
  name: 'lopsided:beat-feel',
  stage: 'update',
  queries: { stones: [Stone], seats: [Seat] },
  run({ queries, world, game, flow, feel, audio, ui, time, net }) {
    if (servicesOf(game).poster?.active) return;
    const beat = world.resource(Beat);
    const clock = world.resource(RoundClock);
    if (!clock.live) {
      if (flow.phase === 'lobby' || flow.phase === 'title') beat.key = '';
      return;
    }
    if (beat.key !== clock.key) {
      Object.assign(beat, { key: clock.key, dropped: -1, fell: 0, tick: -1, callout: -1, armed: false });
    }
    const board = boardOf(world)?.get(Board);

    // A tick for each of the last three seconds of a beat, so nobody is surprised by the drop.
    if (clock.phase === 'aim') {
      const second = Math.ceil(clock.left);
      const id = clock.beat * 10 + second;
      if (second <= 3 && id !== beat.tick) {
        beat.tick = id;
        audio?.play('timer.tick', { pitch: 1 + (3 - second) * 0.15, volume: 0.45 });
      }
    }
    if (!board) return;

    // The drop: one thud for everyone's stones together.
    if (board.dropped > beat.dropped) {
      beat.dropped = board.dropped;
      let heavy = false;
      queries.stones.each((_e, stone) => void (stone.beat === board.dropped && stone.heavy && (heavy = true)));
      audio?.play(heavy ? 'land.heavy' : 'block', { pitch: heavy ? 0.7 : 0.9, volume: heavy ? 1 : 0.8 });
      feel?.shake(heavy ? 0.42 : 0.16);
    }

    // Stones over the edge: a falling sound each (a few at most per frame).
    if (board.fell > beat.fell) {
      const n = board.fell - beat.fell;
      beat.fell = board.fell;
      audio?.play('whoosh.fast', { pitch: 0.7, volume: Math.min(1, 0.35 + n * 0.15) });
      audio?.play('hit.punch', { pitch: 0.6, volume: 0.5, delay: 0.12 });
    }

    // An avalanche: three or more rival stones off after one beat's drop.
    if (board.tipFell >= 3 && beat.callout !== board.tipBeat) {
      beat.callout = board.tipBeat;
      let name = 'Somebody';
      let mine = false;
      queries.seats.each((_e, seat) => {
        if (seat.index !== board.tipper) return;
        mine = seat.id === net?.me;
        name = flow.seats?.find((s) => s.id === seat.id)?.name ?? name;
      });
      const style = seatStyle(board.tipper);
      const text = mine ? 'YOU TIPPED IT!' : `TIPPED BY ${name.toUpperCase()}`;
      ui?.callout(text, { color: style.fill, size: 58, ms: 1700, sound: false });
      Object.assign(world.resource(Callout), { text, sub: '', color: style.fill, at: time.now });
      audio?.play(mine ? 'stinger.win' : 'explosion.small', { volume: 0.8 });
      feel?.shake(0.55);
      feel?.hitStop(70);
    }
  },
});

export const Music = defineSystem({
  name: 'lopsided:music',
  stage: 'update',
  run({ world, flow, audio }) {
    if (!audio) return;
    const calm = flow.phase === 'title' || flow.phase === 'lobby' || flow.phase === 'results';
    const song = calm ? 'music.calm' : 'music.mystery';
    if (audio.music.current !== song) audio.music.play(song);
    if (!calm) audio.music.setIntensity?.(Math.min(1, danger(leanOf(world)) * 0.8));
  },
});
