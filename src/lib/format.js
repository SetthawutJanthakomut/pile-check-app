// Shared formatting/cleaning helpers for the Tables grids.
export const num = (s) => (s === '' || s == null ? null : Number(String(s).replace(/[, ]+/g, '')));

export const fmt = (v, d = 3) =>
  v == null || Number.isNaN(v) ? '—' : Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

// Maps computeAll()-style verdict strings to the .stamp pass/fail palette.
export const verdictClass = (v) => {
  if (v === 'OK') return 'ok';
  if (v === 'OVER' || v === 'CHECK!' || v === 'FALSE') return 'bad';
  return '';
};
