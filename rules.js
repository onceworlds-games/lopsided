// The numbers and the maths of Lopsided, as plain functions with no engine in them. The host's systems, the bots, the tests and the
// balance tool (tools/balance.mjs) all run exactly this code.
//
// The game: a round table balanced on one point. Each beat every player drops one stone at the same moment. The table tips toward the
// weight (the sum of every stone's mass times where it lies), and once the slope under a stone beats its grip it slides. Past the rim it
// falls and is gone. When a round ends, what is still on the table scores by ring: middle 1, inner ring 2, rim 3.
//
// Space: the table's middle is (0, 0), y up, its radius is TABLE.radius. The tilt is a vector pointing downhill (toward the low side).

export const TABLE = {
  radius: 10,
  /** The table is gently domed: an extra outward slope of `dome` per unit from the middle (0.06 at the rim). Rim stones go first. */
  dome: 0.006,
  /** A resting stone starts to slide when the slope under it is steeper than this. */
  grip: 0.15,
  /** A sliding stone slows by this (kinetic friction, a little lower than the grip: once going, a slide carries). */
  drag: 0.13,
  gravity: 30,
  /**
   * How much weight it takes to tip the table: tilt = (sum of mass x position) / stiffness, capped at `maxTilt`. A table for more players
   * is stiffer (see `stiffnessFor`), so eight players' stones rock it about as much as four players' do.
   */
  stiffness: 270,
  maxTilt: 0.24,
  /** The table swings toward its lean like a spring: a little wobble after every drop, settled in about a second. */
  spring: 22,
  damping: 6.5,
};

export const STONE = { radius: 0.72, mass: 1, boulderRadius: 1.05, boulderMass: 3 };

/** Rings, from the middle out: within `upTo` of the radius a stone scores `points`. */
export const RINGS = [
  { upTo: 0.4, points: 1 },
  { upTo: 0.72, points: 2 },
  { upTo: 1, points: 3 },
];

export const BEATS = {
  /** Seconds to look at the empty table before the first beat. */
  grace: 2.2,
  perRound: 8,
  /** Seconds to aim: the first beat is the longest, then they speed up. */
  first: 4.0,
  last: 2.6,
  /** Aims are locked this long before a drop, so what you see is what drops even over a slow network. */
  lock: 0.18,
  /** After the last drop, the table settles for this long before the round is scored. */
  settle: 4.0,
};

export const MAX_SEATS = 8;

// ---------------------------------------------------------------- the clock

/** Seconds of aiming in beat `i` (0-based). */
export const beatLength = (i) => BEATS.first + ((BEATS.last - BEATS.first) * Math.min(i, BEATS.perRound - 1)) / (BEATS.perRound - 1);

/** Seconds into the round when beat `i`'s stones drop. */
export function dropTime(i) {
  let t = BEATS.grace;
  for (let j = 0; j <= i; j++) t += beatLength(j);
  return t;
}

/** When the round is scored: the last drop plus the settle. */
export const roundLength = () => dropTime(BEATS.perRound - 1) + BEATS.settle;

/**
 * Where a round is, `elapsed` seconds in: `idle` before the first beat, `aim` during a beat (`beat` is its number, `left` the seconds to
 * its drop), `settle` after the last drop and `done` when it is scored. `t` is seconds into the phase.
 */
export function clockAt(elapsed) {
  if (elapsed < BEATS.grace) return { phase: 'idle', beat: 0, t: Math.max(0, elapsed), left: BEATS.grace - Math.max(0, elapsed), length: BEATS.grace };
  let start = BEATS.grace;
  for (let i = 0; i < BEATS.perRound; i++) {
    const length = beatLength(i);
    if (elapsed < start + length) return { phase: 'aim', beat: i, t: elapsed - start, left: start + length - elapsed, length };
    start += length;
  }
  const after = elapsed - start;
  if (after < BEATS.settle) return { phase: 'settle', beat: BEATS.perRound, t: after, left: BEATS.settle - after, length: BEATS.settle };
  return { phase: 'done', beat: BEATS.perRound, t: after - BEATS.settle, left: 0, length: 0 };
}

// ---------------------------------------------------------------- scoring

/** Points for a stone whose middle is at (x, y): 0 off the table. */
export function pointsAt(x, y) {
  const d = Math.hypot(x, y) / TABLE.radius;
  for (const ring of RINGS) if (d <= ring.upTo) return ring.points;
  return 0;
}

/** Each seat's points for the stones on the table: `{ [seat]: points }` (every seat in `seats` gets an entry). */
export function scoreTable(stones, seats = []) {
  const score = {};
  for (const seat of seats) score[seat] = 0;
  for (const s of stones) if (!s.gone) score[s.seat] = (score[s.seat] ?? 0) + pointsAt(s.x, s.y);
  return score;
}

// ---------------------------------------------------------------- the tilt

/** The stiffness of the table for a match of `seats` players: stones pile up with the number of players, the lean with its square root. */
export const stiffnessFor = (seats) => TABLE.stiffness * Math.sqrt(Math.max(2, Math.min(MAX_SEATS, seats || 4)) / 4);

/** Where the weight wants the table to lean: { x, y } downhill, capped at `maxTilt`. `k` is the table's stiffness. */
export function targetTilt(stones, extra = null, k = TABLE.stiffness) {
  let qx = 0;
  let qy = 0;
  for (const s of stones) {
    if (s.gone) continue;
    qx += s.m * s.x;
    qy += s.m * s.y;
  }
  if (extra) {
    qx += extra.m * extra.x;
    qy += extra.m * extra.y;
  }
  return capTilt(qx / k, qy / k);
}

export function capTilt(x, y) {
  const length = Math.hypot(x, y);
  if (length <= TABLE.maxTilt) return { x, y };
  const k = TABLE.maxTilt / length;
  return { x: x * k, y: y * k };
}

/** The slope under a point on a table leaning by `tilt`: the lean plus the dome. */
export const slopeAt = (tilt, x, y) => ({ x: tilt.x + TABLE.dome * x, y: tilt.y + TABLE.dome * y });

/** How close the table is to sliding stones at the rim (0 level, 1 the low rim's stones are about to go, more is sliding). */
export const danger = (tilt) => Math.hypot(tilt.x, tilt.y) / (TABLE.grip - TABLE.dome * TABLE.radius);

// ---------------------------------------------------------------- the physics

/** A stone as the physics sees it. `seat` is the player's seat number; `beat` the beat it dropped in. */
export function makeStone(seat, x, y, heavy = false, beat = 0) {
  const at = clampAim(x, y);
  return {
    seat,
    beat,
    heavy,
    x: at.x,
    y: at.y,
    vx: 0,
    vy: 0,
    m: heavy ? STONE.boulderMass : STONE.mass,
    r: heavy ? STONE.boulderRadius : STONE.radius,
    sliding: false,
    gone: false,
  };
}

/**
 * One fixed step of the table and its stones. `table` is { x, y, vx, vy, k } (the lean, how fast it changes, the stiffness); `stones`
 * are plain objects (makeStone). Changes them in place and returns the stones that fell off the edge in this step.
 */
export function stepTable(table, stones, dt) {
  // The table swings toward where the weight wants it.
  const want = targetTilt(stones, null, table.k ?? TABLE.stiffness);
  table.vx += (TABLE.spring * (want.x - table.x) - TABLE.damping * table.vx) * dt;
  table.vy += (TABLE.spring * (want.y - table.y) - TABLE.damping * table.vy) * dt;
  table.x += table.vx * dt;
  table.y += table.vy * dt;
  const lean = capTilt(table.x, table.y);
  table.x = lean.x;
  table.y = lean.y;

  // Stones slide when the slope beats their grip, and slow by the drag.
  const g = TABLE.gravity;
  for (const s of stones) {
    if (s.gone) continue;
    const slope = slopeAt(table, s.x, s.y);
    const steep = Math.hypot(slope.x, slope.y);
    if (!s.sliding && steep > TABLE.grip) s.sliding = true;
    if (!s.sliding) continue;
    s.vx += g * slope.x * dt;
    s.vy += g * slope.y * dt;
    const speed = Math.hypot(s.vx, s.vy);
    const slow = TABLE.drag * g * dt;
    if (speed <= slow) {
      s.vx = 0;
      s.vy = 0;
      if (steep <= TABLE.grip) s.sliding = false;
    } else {
      s.vx *= (speed - slow) / speed;
      s.vy *= (speed - slow) / speed;
    }
    s.x += s.vx * dt;
    s.y += s.vy * dt;
  }

  collide(stones);

  const fell = [];
  for (const s of stones) {
    if (s.gone) continue;
    if (Math.hypot(s.x, s.y) > TABLE.radius) {
      s.gone = true;
      fell.push(s);
    }
  }
  return fell;
}

/** Stones never overlap: push each pair apart by their masses, and share their speed along the push (a soft, heavy knock). */
export function collide(stones) {
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < stones.length; i++) {
      const a = stones[i];
      if (a.gone) continue;
      for (let j = i + 1; j < stones.length; j++) {
        const b = stones[j];
        if (b.gone) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const min = a.r + b.r;
        const d2 = dx * dx + dy * dy;
        if (d2 >= min * min) continue;
        let d = Math.sqrt(d2);
        let nx = 1;
        let ny = 0;
        if (d > 1e-6) {
          nx = dx / d;
          ny = dy / d;
        } else {
          // Exactly on top of each other: push apart along a fixed direction from their seats (the same on every run).
          const angle = (a.seat * 2.4 + b.seat * 1.3 + i * 0.7) % (Math.PI * 2);
          nx = Math.cos(angle);
          ny = Math.sin(angle);
          d = 0;
        }
        const overlap = min - d;
        const total = a.m + b.m;
        a.x -= nx * overlap * (b.m / total);
        a.y -= ny * overlap * (b.m / total);
        b.x += nx * overlap * (a.m / total);
        b.y += ny * overlap * (a.m / total);
        // Closing speed along the push: share it (mostly inelastic), and a knocked stone starts to slide.
        const closing = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
        if (closing > 0) {
          const impulse = (1.25 * closing) / total;
          a.vx -= impulse * b.m * nx;
          a.vy -= impulse * b.m * ny;
          b.vx += impulse * a.m * nx;
          b.vy += impulse * a.m * ny;
          if (closing > 0.4) {
            a.sliding = true;
            b.sliding = true;
          }
        }
      }
    }
  }
}

/** True when nothing on the table moves and the table has stopped swinging. */
export function settled(table, stones) {
  if (Math.hypot(table.vx, table.vy) > 0.004) return false;
  for (const s of stones) if (!s.gone && s.sliding && Math.hypot(s.vx, s.vy) > 0.05) return false;
  return true;
}

// ---------------------------------------------------------------- who tipped it

/**
 * Of the stones that dropped together in one beat, whose pushed the table hardest toward where it now leans: the seat to credit
 * ("TIPPED BY ...") when stones slide off soon after, or -1 when no drop leaned that way.
 */
export function tipperOf(dropped, tilt) {
  const length = Math.hypot(tilt.x, tilt.y);
  if (length < 1e-6) return -1;
  const ux = tilt.x / length;
  const uy = tilt.y / length;
  let best = -1;
  let most = 0.5;
  for (const s of dropped) {
    const push = s.m * (s.x * ux + s.y * uy);
    if (push > most) {
      most = push;
      best = s.seat;
    }
  }
  return best;
}

// ---------------------------------------------------------------- seats

/** Where seat `index` of `count` sits around the table (outside the rim), as an angle and a point. */
export function seatPlace(index, count, distance = TABLE.radius + 2.2) {
  const n = Math.max(2, count);
  const angle = -Math.PI / 2 + (index / n) * Math.PI * 2;
  return { angle, x: Math.cos(angle) * distance, y: Math.sin(angle) * distance };
}

/** Clamp an aim to the table (a stone's middle may be anywhere on it). */
export function clampAim(x, y) {
  const r = TABLE.radius - 0.1;
  const d = Math.hypot(x, y);
  if (!Number.isFinite(d)) return { x: 0, y: 0 };
  return d > r ? { x: (x * r) / d, y: (y * r) / d } : { x, y };
}

// ---------------------------------------------------------------- reading the table (bots, and the aim preview)

/**
 * How likely a stone at (x, y) is to be lost if the table leant by `tilt`: most for one whose slope beats its grip and points outward,
 * less for one that would slide inward (it may cross the table), 0 for one that holds.
 */
export function lossRisk(tilt, x, y) {
  const slope = slopeAt(tilt, x, y);
  const steep = Math.hypot(slope.x, slope.y);
  if (steep <= TABLE.grip) return 0;
  const d = Math.hypot(x, y) || 1;
  const outward = (slope.x * x + slope.y * y) / (steep * d);
  // How far past the grip (a hard lean loses more), and whether it slides out or across.
  const hard = Math.min(1, (steep - TABLE.grip) / 0.06 + 0.35);
  return outward > 0.2 ? hard : outward > -0.5 ? hard * 0.45 : hard * 0.15;
}

/** The expected points of a set of stones after a lean, seat by seat. */
export function expectedScores(stones, tilt) {
  const score = {};
  for (const s of stones) {
    if (s.gone) continue;
    score[s.seat] = (score[s.seat] ?? 0) + pointsAt(s.x, s.y) * (1 - lossRisk(tilt, s.x, s.y));
  }
  return score;
}
