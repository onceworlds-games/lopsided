import { defineComponent, defineResource, t } from '@onceworlds/engine';

// Data only. What every page must agree on is replicated (`net`); the rest each page keeps for itself.
//
//   Seat + Aim     one entity per player, owned by that player's page (the host's for bots): who it is and where its next stone goes
//   Hand           on the same entity, written by the host only: the boulder still in hand, the live score, stones lost
//   Board          one host-owned entity per round: the table's lean and what the host has done (which beat it dropped, who tipped it)
//   Stone          host-owned, one per stone on the table (and for a moment after it falls)

/** Who sits where. `index` is the seat's number in the match (its colour, symbol and place round the table). */
export const Seat = defineComponent('Seat', { id: t.playerId(), index: t.u8() }, { net: { replicate: true } });

/** Where this seat's next stone lands, for beat `beat` (an aim for an earlier beat is stale). Written by the seat's own page. */
export const Aim = defineComponent(
  'Aim',
  { x: t.f32(0, { step: 0.02 }), y: t.f32(0, { step: 0.02 }), heavy: t.bool(false), beat: t.i32(-1) },
  { net: { replicate: true } },
);

/** The host's word about a seat: nobody can give themselves their boulder back or a score. */
export const Hand = defineComponent('Hand', { boulder: t.bool(true), score: t.i32(0), lost: t.u8(0) }, { net: { replicate: true, owner: 'host' } });

/** The table: its lean (downhill), how fast the lean changes, its stiffness, and the host's bookkeeping. */
export const Board = defineComponent(
  'Board',
  {
    x: t.f32(0, { step: 0.0005 }),
    y: t.f32(0, { step: 0.0005 }),
    vx: t.f32(0, { step: 0.0005 }),
    vy: t.f32(0, { step: 0.0005 }),
    k: t.f32(300, { step: 0.5 }),
    /** The last beat whose stones have dropped (-1: none yet). */
    dropped: t.i32(-1),
    /** Whose drop tipped the table most in beat `tipBeat` (a seat number, -1 none), and how many rival stones fell after it. */
    tipBeat: t.i32(-1),
    tipper: t.i32(-1),
    tipFell: t.u8(0),
    /** Every stone that has fallen this round, and the beat of the last one. */
    fell: t.u16(0),
  },
  { net: { replicate: true, owner: 'host' } },
);

/** A stone on the table. `gone` counts seconds since it went over the edge (0 while it is on the table). */
export const Stone = defineComponent(
  'Stone',
  {
    seat: t.u8(),
    heavy: t.bool(false),
    beat: t.u8(),
    vx: t.f32(0, { step: 0.01 }),
    vy: t.f32(0, { step: 0.01 }),
    sliding: t.bool(false),
    gone: t.f32(0, { step: 0.05 }),
  },
  { net: { replicate: true, owner: 'host' } },
);

// ---- Kept on one page only (never sent).

/** How a stone is drawn here, and what this page has already shown of it. */
export const StoneLook = defineComponent('StoneLook', { body: t.entity(), shadow: t.entity(), age: t.f32(0), fallen: t.bool(false), slid: t.bool(false) });

/** How a seat is drawn here. */
export const SeatLook = defineComponent('SeatLook', { card: t.entity(), puck: t.entity(), score: t.entity(), boulder: t.entity(), shown: t.i32(-1), lost: t.u8(0), layout: t.string(24) });

/** This page's own aim marker. */
export const Ghost = defineComponent('Ghost', { ring: t.entity(), cross: t.entity() });

/** Pieces of the table that move with its lean. */
export const RimPiece = defineComponent('RimPiece', { angle: t.f32() });
export const TableShadow = defineComponent('TableShadow');
export const LeanArrow = defineComponent('LeanArrow', { index: t.u8() });
export const TableCamera = defineComponent('TableCamera');

/** A stone of the local table behind the title and in the lobby (not networked). */
export const LocalStone = defineComponent('LocalStone', { id: t.u16() });

/** What this page has already played of the round (each sound or callout once), and its own aiming state. */
export const Beat = defineResource('Beat', {
  key: t.string(80),
  dropped: t.i32(-1),
  fell: t.u16(0),
  tick: t.i32(-1),
  callout: t.i32(-1),
  /** The boulder is armed for this page's next drop. */
  armed: t.bool(false),
  /** This page has aimed at least once this match (the "tap the table" hint goes away). */
  aimed: t.bool(false),
  /** The pointer went down on the table and is still down: dragging moves the aim. */
  dragging: t.bool(false),
  /** The table creaked when it passed its tipping point (again only once it has come back). */
  creaked: t.bool(false),
});

/** The latest "TIPPED BY ..." to show over the table: text, colour and when it began (the world's clock). */
export const Callout = defineResource('Callout', { text: t.string(60), sub: t.string(40), color: t.string(10), at: t.f32(-99) });

/**
 * Where the round is, worked out on every page from the match clock (systems/clock.js): `live` while a round is being played, the
 * phase of the round (`idle` before the first beat, `aim`, `settle` after the last drop, `done`), the beat, seconds into and left of it.
 */
export const RoundClock = defineResource('RoundClock', {
  live: t.bool(false),
  key: t.string(80),
  phase: t.enum(['none', 'idle', 'aim', 'settle', 'done'], 'none'),
  beat: t.u8(0),
  t: t.f32(0),
  left: t.f32(0),
  length: t.f32(0),
  elapsed: t.f32(0),
  /** The last round of a match of several: its points count double. */
  double: t.bool(false),
});
