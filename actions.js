import { Input, controlsFromActions } from '@onceworlds/engine/modules';

// The stick and one button: on a phone they are the platform's controls.
export const actions = {
  move: Input.axis2d({ keys: 'wasd arrows', stick: true, pad: 'left', label: 'Move' }),
  dash: Input.button({ keys: 'Space Shift', pad: 'A', touch: { label: 'Dash', big: true }, label: 'Dash' }),
};

/** What goes in onceworlds.json `controls`. A test checks the file still agrees with the action map. */
export const controls = controlsFromActions(actions);
