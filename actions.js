import { Input, controlsFromActions } from '@onceworlds/engine/modules';

// A tap (or click) on the table aims your next stone; one button arms your boulder. On a phone the table is the control, and the
// boulder is the platform's one touch button.
export const actions = {
  aim: Input.pointer({ label: 'Aim your stone' }),
  boulder: Input.button({ keys: 'B Shift', pad: 'Y', touch: { label: 'Boulder', big: true }, label: 'Boulder (3x weight)' }),
};

/** What goes in onceworlds.json `controls`. A test checks the file still agrees with the action map. */
export const controls = controlsFromActions(actions);
