import { describe, expect, it, vi } from 'vitest';
import { FlowState, flowOf } from '@onceworlds/engine/modules';
import { chaos, simulate } from '@onceworlds/engine/test';
import { Aim, Hand } from '../components.js';
import { gameConfig } from '../game.config.js';
import { BEATS, TABLE } from '../rules.js';
import { aimers, boardOn, clockOf, match, phaseOf, rimmer, seatOn, stonesOn } from './helpers.js';

// Whole matches, headless: every human gets a page of their own in one fake room, bots fill the empty seats, time is virtual.
vi.setConfig({ testTimeout: 120000 });

const state = (game) => game.world.resource(FlowState);

describe('a full match', () => {
  it('one player and five bots play three rounds to a podium; every bot drops a stone every beat', async () => {
    const drops = new Map();
    const rounds = new Set();
    const run = await simulate(gameConfig({ quick: true }), {
      humans: 1,
      bots: 5,
      seed: 12,
      seconds: 900,
      onFrame: (r) => {
        rimmer(r);
        const g = r.game;
        if (phaseOf(g) !== 'playing') return;
        const round = state(g).round;
        rounds.add(round);
        for (const s of stonesOn(g)) drops.set(`${round}:${s.seat}:${s.beat}`, s.heavy);
      },
      until: (r) => r.matches > 0,
    });
    expect(run.errors).toEqual([]);
    expect([...rounds]).toEqual([1, 2, 3]);
    expect(run.ranking).toHaveLength(6);
    // Six seats, eight beats, three rounds: a stone for every seat in every beat (the human aims every beat too).
    expect(drops.size).toBe(6 * BEATS.perRound * 3);
    // At most one boulder per seat per round.
    const boulders = {};
    for (const [key, heavy] of drops) if (heavy) boulders[key.split(':').slice(0, 2).join(':')] = (boulders[key.split(':').slice(0, 2).join(':')] ?? 0) + 1;
    expect(Math.max(...Object.values(boulders))).toBe(1);
    // Points are what was left on the table: at most 8 rim stones a round.
    for (const row of run.standings) {
      expect(row.points).toBeGreaterThanOrEqual(0);
      expect(row.points).toBeLessThanOrEqual(3 * BEATS.perRound * 3);
    }
    expect(run.standings[0].points).toBeGreaterThan(10);
    expect(run.awards.length).toBeGreaterThan(0);
  });

  it('the table actually tips: across a match stones fall, and bots score differently', async () => {
    let fell = 0;
    const run = await match({ humans: 1, bots: 7, rounds: 3 }, {
      seed: 21,
      seconds: 900,
      onFrame: (r) => {
        rimmer(r);
        const b = boardOn(r.game);
        if (b) fell = Math.max(fell, b.fell);
      },
    });
    expect(run.errors).toEqual([]);
    expect(run.ranking).toHaveLength(8);
    expect(fell).toBeGreaterThan(0);
    expect(new Set(run.standings.map((s) => s.points)).size).toBeGreaterThan(2);
  });

  it('three players and two bots over a bad network agree on the stones and the standings', async () => {
    let tables = null;
    const run = await match({ humans: 3, bots: 2 }, {
      seed: 22,
      latency: [20, 110],
      onFrame: (r) => {
        rimmer(r);
        // Late in the settle, every page should show the same stones in (nearly) the same places (leaving out any still teetering
        // on the edge, which a page sees a moment later than the host).
        const clock = clockOf(r.games[0]);
        if (!tables && clock.live && clock.phase === 'settle' && clock.t > 3 && r.games.every((g) => phaseOf(g) === 'playing')) {
          tables = r.games.map((g) =>
            stonesOn(g)
              .filter((s) => !(s.gone > 0) && Math.hypot(s.x, s.y) < TABLE.radius - 1)
              .map((s) => `${s.seat}:${s.beat}:${Math.round(s.x)}:${Math.round(s.y)}`)
              .sort()
              .join(' '),
          );
        }
      },
      until: (r) => r.matches > 0 && r.games.every((g) => phaseOf(g) === 'results'),
    });
    expect(run.errors).toEqual([]);
    expect(run.ranking).toHaveLength(5);
    expect(tables).not.toBeNull();
    if (new Set(tables).size !== 1) console.log(tables.join('\n'));
    expect(new Set(tables).size).toBe(1);
    expect(new Set(run.games.map((g) => JSON.stringify(state(g).standings))).size).toBe(1);
  });

  it('plays the number of rounds the host picked in the lobby', async () => {
    const seen = new Set();
    let picked = false;
    const run = await simulate(gameConfig({ quick: true, rounds: 3, fill: 4, friends: true }), {
      humans: 2,
      bots: 2,
      seed: 4,
      seconds: 400,
      onFrame: (r) => {
        rimmer(r);
        const host = r.games[0];
        if (!picked && phaseOf(host) === 'lobby') {
          picked = true;
          flowOf(host).setSetting('rounds', 1);
        }
        if (phaseOf(host) === 'playing') seen.add(`${state(host).round}/${state(host).rounds}`);
      },
      until: (r) => r.matches > 0,
    });
    expect(run.errors).toEqual([]);
    expect([...seen]).toEqual(['1/1']);
  });
});

describe('aims and boulders', () => {
  it("a player's aim becomes their stone, on that spot, on every page; the boulder drops once a round", async () => {
    // Every stone of p2's as each page first sees it (stones may slide on and off later: the table is tippy).
    const first = [new Map(), new Map()];
    let hand = null;
    const run = await match({ humans: 2, bots: 0, fill: 2 }, {
      seed: 9,
      latency: 40,
      onFrame: (r) => {
        aimers((game, beat) => (game.room.me.id === 'p2' ? { x: -6, y: beat - 3, heavy: true } : { x: 6, y: 3 - beat, heavy: false }))(r);
        r.games.forEach((g, i) => {
          for (const s of stonesOn(g)) if (s.seat === 1 && !first[i].has(s.beat)) first[i].set(s.beat, s);
        });
        const clock = clockOf(r.games[0]);
        if (clock.live && clock.phase === 'aim' && clock.beat === 3 && clock.t > 0.6 && hand === null) hand = seatOn(r.games[1], 'p2')?.get(Hand).boulder;
      },
      until: (r) => r.matches > 0 || (hand !== null && first[1].size >= 3),
    });
    expect(run.errors).toEqual([]);
    // p2's first three stones landed on its side, on both pages; every one asked for a boulder but only the first was one.
    for (const seen of first) {
      const three = [0, 1, 2].map((b) => seen.get(b));
      expect(three.every(Boolean)).toBe(true);
      for (const s of three) expect(s.x).toBeLessThan(-3);
      expect(three.filter((s) => s.heavy).map((s) => s.beat)).toEqual([0]);
    }
    expect(hand).toBe(false);
  });

  it('an aim for a beat that already dropped, or off the table, cannot put a stone anywhere else', async () => {
    let checked = false;
    const run = await match({ humans: 1, bots: 1, fill: 2 }, {
      seed: 5,
      onFrame: (r) => {
        const g = r.game;
        const clock = clockOf(g);
        const seat = seatOn(g, 'p1');
        if (!seat || !clock.live || clock.phase !== 'aim') return;
        const aim = seat.get(Aim);
        // An old beat, and a spot far off the table.
        aim.beat = Math.max(0, clock.beat - 1);
        aim.x = 400;
        aim.y = -900;
        if (clock.beat >= 4) checked = true;
      },
      until: (r) => checked,
    });
    expect(run.errors).toEqual([]);
    const mine = stonesOn(run.game).filter((s) => s.seat === 0);
    for (const s of mine) expect(Math.hypot(s.x, s.y)).toBeLessThanOrEqual(TABLE.radius + 1.5);
    // Only the very first beat could take the first aim (beat 0); later ones are always a beat late.
    expect(mine.length).toBeLessThanOrEqual(1);
  });
});

describe('players who arrive late', () => {
  it('watch the round as spectators, seeing the same table, and play from the next round', async () => {
    const seen = {};
    const join = { name: 'join', at: 9, run: (env) => void env.addPlayer() };
    const run = await simulate(gameConfig({ quick: true, rounds: 3, fill: 4, friends: true }), {
      humans: 2,
      bots: 2,
      seed: 8,
      seconds: 500,
      chaos: [join],
      onFrame: (r) => {
        rimmer(r);
        const late = r.games[2];
        if (!late || phaseOf(late) !== 'playing') return;
        const host = r.games[0];
        if (!seen.watching && state(host).round === 1 && clockOf(host).beat >= 3 && clockOf(host).t > 0.8) {
          seen.watching = { spectating: state(late).spectating, own: !!seatOn(late, late.room.me.id), sameDrops: boardOn(late)?.dropped === boardOn(host)?.dropped };
        }
        if (!seen.playing && state(host).round === 2 && clockOf(host).beat >= 1) {
          seen.playing = { spectating: state(late).spectating, own: !!seatOn(late, late.room.me.id) };
        }
      },
      until: (r) => r.matches > 0 || (seen.playing && r.seconds > 80),
    });
    expect(run.errors).toEqual([]);
    expect(seen.watching).toEqual({ spectating: true, own: false, sameDrops: true });
    expect(seen.playing).toEqual({ spectating: false, own: true });
  });
});

describe('when things go wrong', () => {
  // The engine's own fuzzing scenarios, dropped into the middle of a round.
  const scenarios = ['reload-host', 'drop-player', 'host-change', 'reload-player', 'pause-during-host-change', 'late-joiner', 'garbage-messages', 'forged-state', 'host-leaves'];

  for (const name of scenarios) {
    it(`${name}: the match still ends ranked, and no page ever shows two stones for one seat in one beat`, async () => {
      const problems = [];
      const humans = name === 'late-joiner' ? 2 : 3;
      const seats = humans + 2;
      const run = await simulate(gameConfig({ quick: true, rounds: 1, fill: seats }), {
        humans,
        bots: 2,
        seed: 33,
        latency: [10, 60],
        seconds: 300,
        chaos: [{ ...chaos[name], at: 14 }],
        onFrame: (r) => {
          rimmer(r);
          for (const g of r.games) {
            if (!g.room || g.room.closed || phaseOf(g) !== 'playing') continue;
            const keys = stonesOn(g).map((s) => `${s.seat}:${s.beat}`);
            if (new Set(keys).size !== keys.length) problems.push(`${g.room.me.id} at ${r.seconds.toFixed(1)}s: ${keys.sort().join(' ')}`);
          }
        },
        until: (r) => r.matches > 0 && r.seconds > 20,
      });
      expect(run.errors).toEqual([]);
      expect(run.matches).toBeGreaterThanOrEqual(1);
      expect(run.ranking.length).toBeGreaterThanOrEqual(seats - (name === 'host-leaves' ? 1 : 0));
      expect(problems.slice(0, 3)).toEqual([]);
    });
  }
});
