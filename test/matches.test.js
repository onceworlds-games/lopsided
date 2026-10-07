import { describe, expect, it, vi } from 'vitest';
import { FlowState, flowOf } from '@onceworlds/engine/modules';
import { chaos, simulate } from '@onceworlds/engine/test';
import { Runner } from '../components.js';
import { gameConfig } from '../game.config.js';
import { floorOf, phaseOf, players, runnerOn, runnersOn } from './helpers.js';

// Whole matches take a moment of real time on a busy machine (the game's own time is virtual).
vi.setConfig({ testTimeout: 60000 });

// Whole matches, headless: every human gets a page of their own in one fake room, bots fill the empty seats, time is virtual.

const state = (game) => game.world.resource(FlowState);

describe('a full match', () => {
  it('one player and five bots play every round to a podium, with awards', async () => {
    const rounds = new Set();
    const run = await simulate(gameConfig({ quick: true }), {
      humans: 1,
      bots: 5,
      seed: 12,
      seconds: 900,
      onFrame: (r) => {
        players(r);
        if (phaseOf(r.game) === 'playing') rounds.add(state(r.game).round);
      },
      until: (r) => r.matches > 0,
    });
    expect(run.errors).toEqual([]);
    expect(run.ended).toBe('until');
    expect([...rounds]).toEqual([1, 2, 3]);
    expect(run.ranking).toHaveLength(6);
    expect(new Set(run.ranking)).toEqual(new Set(['p1', 'bot:1', 'bot:2', 'bot:3', 'bot:4', 'bot:5']));
    // Three rounds of 6, 4, 3, 2 and 1 points (sixth place gets none): between 0 and 18 each, and somebody scored.
    for (const row of run.standings) {
      expect(row.points).toBeGreaterThanOrEqual(0);
      expect(row.points).toBeLessThanOrEqual(18);
    }
    expect(run.standings[0].points).toBeGreaterThan(0);
    expect(run.standings[0].points).toBeGreaterThanOrEqual(run.standings[5].points);
    expect(run.awards.map((a) => a.title)).toContain('Iron feet');
  });

  it('three players and two bots over a bad network end ranked, agreeing on the standings', async () => {
    const run = await simulate(gameConfig({ quick: true, rounds: 1, fill: 5 }), {
      humans: 3,
      bots: 2,
      seed: 22,
      latency: [20, 110],
      seconds: 400,
      onFrame: players,
      until: (r) => r.matches > 0 && r.games.every((g) => phaseOf(g) === 'results'),
    });
    expect(run.errors).toEqual([]);
    expect(run.ranking).toHaveLength(5);
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
        players(r);
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

describe('players who arrive late', () => {
  it('watch the round as spectators, seeing the same floor and the same runners, and play from the next round', async () => {
    const seen = {};
    const join = { name: 'join', at: 9, run: (env) => void env.addPlayer() };
    const run = await simulate(gameConfig({ quick: true, rounds: 3, fill: 4, friends: true }), {
      humans: 2,
      bots: 2,
      seed: 8,
      seconds: 400,
      chaos: [join],
      onFrame: (r) => {
        players(r);
        const late = r.games[2];
        if (!late || phaseOf(late) !== 'playing') return;
        if (!seen.watching && state(r.games[0]).round === 1 && r.seconds > 12) {
          seen.watching = {
            spectating: state(late).spectating,
            participant: state(late).participant,
            own: !!runnerOn(late, late.room.me.id),
            runners: runnersOn(late).length,
            hostRunners: runnersOn(r.games[0]).length,
            sameFloor: floorOf(late).key === floorOf(r.games[0]).key,
          };
        }
        if (!seen.playing && state(r.games[0]).round === 2 && r.seconds > 20) {
          seen.playing = { spectating: state(late).spectating, own: !!runnerOn(late, late.room.me.id) };
        }
      },
      until: (r) => r.matches > 0 || (seen.playing && r.seconds > 60),
    });
    expect(run.errors).toEqual([]);
    expect(seen.watching).toEqual({ spectating: true, participant: false, own: false, runners: 4, hostRunners: 4, sameFloor: true });
    expect(seen.playing).toEqual({ spectating: false, own: true });
  });
});

describe('when things go wrong', () => {
  // The same scenarios the engine's fuzzing uses, dropped into the middle of a round of a real game.
  const scenarios = ['reload-host', 'drop-player', 'host-change', 'reload-player', 'pause-during-host-change', 'late-joiner', 'garbage-messages', 'host-leaves'];

  for (const name of scenarios) {
    it(`${name}: the match still ends ranked, and every page shows the same runners`, async () => {
      let problems = null;
      let settled = 0;
      const humans = name === 'late-joiner' ? 2 : 3;
      const seats = humans + 2;
      const run = await simulate(gameConfig({ quick: true, rounds: 1, fill: seats }), {
        humans,
        bots: 2,
        seed: 33,
        latency: [10, 60],
        seconds: 300,
        chaos: [{ ...chaos[name], at: 7 }],
        onFrame: (r) => {
          players(r);
          const live = r.games.filter((g) => g.room && !g.room.closed);
          if (problems || r.match.phase !== 'playing' || !live.length || !live.every((g) => phaseOf(g) === 'results')) return;
          settled ||= r.seconds;
          if (r.seconds < settled + 1.5 || r.seconds < 10) return;
          problems = [];
          for (const g of live) {
            const ids = [];
            g.world.query([Runner]).each((_e, runner) => void ids.push(runner.id));
            if (new Set(ids).size !== ids.length) problems.push(`${g.room.me.id} sees a runner twice: ${ids}`);
            if (name !== 'host-leaves' && ids.length < seats) problems.push(`${g.room.me.id} sees ${ids.length} runners of ${seats}`);
          }
        },
        until: () => problems !== null,
      });
      expect(run.errors).toEqual([]);
      expect(run.matches).toBeGreaterThanOrEqual(1);
      expect(run.ranking.length).toBeGreaterThanOrEqual(seats);
      expect(problems).toEqual([]);
    });
  }
});
