import { defineSystem } from '@onceworlds/engine';
import { FlowState, Intent } from '@onceworlds/engine/modules';
import { Motion, Look, Runner, Status } from '../components.js';
import { dressRunner } from '../look.js';

// A runner exists on every page, but each page holds a different part of it:
//
//   dress - every page gives every runner a look (a remote runner arrives with only the replicated data).
//   equip - only the page that SIMULATES a runner (its player's page, or the host for bots) gives it `Motion` and an `Intent`.
//
// `equip` looks at what each runner has, not at when it was made, so it also covers a reloaded page and a new host that adopts the bots.

function nameOf(world, flow, id) {
  const seat = flow.seats.find((s) => s.id === id);
  if (seat) return seat.name;
  const players = world.resource(FlowState).players;
  const known = Array.isArray(players) ? players.find((p) => p.id === id) : null;
  return known?.name ?? 'Player';
}

export const Dress = defineSystem({
  name: 'party:dress',
  stage: 'input',
  query: [Runner, Status, { without: [Look] }],
  run({ query, world, flow, net }) {
    query.each((entity, runner, status) => {
      const id = runner.id;
      const bot = id.startsWith('bot:');
      dressRunner(world, entity, { id, color: runner.color, name: nameOf(world, flow, id), you: net.owner(entity) === net.me, bot, out: status.out });
    });
  },
});

export const Equip = defineSystem({
  name: 'party:equip',
  stage: 'input',
  queries: {
    bare: [Runner, { without: [Motion] }],
    armed: [Runner, Motion],
  },
  run({ queries, net }) {
    queries.bare.each((entity) => {
      if (net.simulates(entity)) entity.add(Motion(), Intent());
    });
    queries.armed.each((entity) => {
      if (!net.simulates(entity)) entity.remove(Motion, Intent);
    });
  },
});
