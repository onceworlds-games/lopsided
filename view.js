import { TABLE } from './rules.js';

// Where things go on the screen, as plain maths (no engine): the camera that fits the table and its seats under the HUD, and the place
// for the prompts ("TAP THE TABLE", "AIM!"), which must never cover the table. systems/looks.js points the camera with it, ui.js puts
// the prompts where it says, and the tests check every screen size against it.

/** At this width / height and wider, the seats stand in columns beside the table; narrower, in rows above and below it. */
export const WIDE_ASPECT = 1.05;
/**
 * The HUD at the top while a round is on (the round, the clock and the beat panel) reaches this far down, in UI units, and never less
 * than `HUD_MIN_PX` screen pixels (small screens keep text at a readable size). The UI's scale (pixels per UI unit) grows with the
 * screen's short side, between 0.8 and 1.7.
 */
const HUD_UNITS = 140;
const HUD_MIN_PX = 168;
export const uiScale = (width, height) => clamp(Math.min(width, height) / 520, 0.8, 1.7);
/** Half the room the table and its seats need, in world units: across and down. */
const WIDE = { x: TABLE.radius + 9.5, y: TABLE.radius + 1.3 };
const TALL = { x: TABLE.radius + 1.1, y: TABLE.radius + 5.8 };
/** Where a seat column stands (world units from the middle), and how far its name pill reaches toward the table, in pixels. */
export const SEAT_COLUMN = TABLE.radius + 5.2;
const SEAT_PILL_PX = 80;
/** A prompt beside the table needs at least this many pixels; otherwise a strip this tall (UI units) is kept for it under the table. */
const SIDE_MIN_PX = 140;
const PROMPT_STRIP_UNITS = 64;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/**
 * The layout of a `width` x `height` screen (CSS pixels). `hud` is false behind the title and on posters (no HUD, no prompts).
 * Returns the camera (`height` and `y` in world units), whether the seats stand in columns (`wide`), where prompts go (`prompt`:
 * 'left' beside the table, or 'bottom'), the pixels free beside the table (`side`), and the table's box on the screen (`table`, pixels).
 */
export function screenLayout(width, height, { hud = true, scale = 0 } = {}) {
  const w = width > 0 ? width : 1280;
  const h = height > 0 ? height : 720;
  const aspect = w / h;
  const wide = aspect >= WIDE_ASPECT;
  const k = scale || uiScale(w, h);
  const hudPx = Math.max(HUD_MIN_PX, HUD_UNITS * k);
  const top = hud ? clamp(hudPx / h, 0.1, 0.34) : 0;
  const fit = (bottom) => {
    const need = wide ? WIDE : TALL;
    const camHeight = Math.max((need.x * 2) / aspect, (need.y * 2) / (1 - top - bottom));
    return { bottom, camHeight, camY: (camHeight * (top - bottom)) / 2 };
  };
  let cam = fit(!hud ? 0 : wide ? 0.04 : 0.11);
  let prompt = 'bottom';
  let side = 0;
  if (wide && hud) {
    side = w / 2 - SEAT_COLUMN * (h / cam.camHeight) - SEAT_PILL_PX;
    if (side >= SIDE_MIN_PX) prompt = 'left';
    else cam = fit(Math.max(cam.bottom, (PROMPT_STRIP_UNITS * k) / h));
  }
  const ppu = h / cam.camHeight;
  const r = (TABLE.radius + 0.9) * ppu;
  const cx = w / 2;
  const cy = h / 2 + cam.camY * ppu;
  return { wide, top, bottom: cam.bottom, height: cam.camHeight, y: cam.camY, prompt, side, table: { x: cx - r, y: cy - r, w: r * 2, h: r * 2 } };
}
