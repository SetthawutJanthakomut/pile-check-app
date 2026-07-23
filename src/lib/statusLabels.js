// Maps computeAll()-style raw status strings (English, fixed) to i18n keys.
// Render-layer only — calculations.js keeps returning the raw strings so
// verdictClass() and other logic that compares against them still works.
export const DIR_KEY = {
  'GO NORTH': 'status.goNorth', 'GO SOUTH': 'status.goSouth',
  'GO EAST': 'status.goEast', 'GO WEST': 'status.goWest',
};
export const CHECK_KEY = { OK: 'status.ok', OVER: 'status.over', 'CHECK!': 'status.check' };
export const BOOL_KEY = { TRUE: 'status.true', FALSE: 'status.false' };
export const MOVED_KEY = {
  'moved NORTH': 'status.movedNorth', 'moved SOUTH': 'status.movedSouth',
  'moved EAST': 'status.movedEast', 'moved WEST': 'status.movedWest',
};
export const MARGIN_KEY = { 'Above seabed': 'status.aboveSeabed', 'Below seabed': 'status.belowSeabed' };
export const SEABED_DIFF_KEY = {
  'Deeper (scour)': 'status.deeperScour', 'Shallower (silting)': 'status.shallowerSilting',
};
export const SEABED_SOURCE_KEY = { measured: 'status.measured', design: 'status.design' };
