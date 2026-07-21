// Single source of truth for the Design Piles CSV export/import column list,
// so the two features can never drift apart on header names or order.
export const CSV_COLUMNS = [
  'pile_no',
  'zone',
  'dia_mm',
  'pile_top_level',
  'sea_bed_level',
  'pile_toe_level',
  'length_m',
  'incline',
  'coordinate_pn',
  'coordinate_pe',
  'coating_length_m',
  'batter_bearing_deg',
  'note',
];

function csvField(value) {
  if (value == null) return '';
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function pilesToCsv(rows) {
  const header = CSV_COLUMNS.join(',');
  const body = rows.map((row) => CSV_COLUMNS.map((key) => csvField(row[key])).join(','));
  return [header, ...body].join('\r\n');
}

// Full-text CSV parser (handles quoted fields, escaped quotes, and embedded
// commas/newlines) so values quoted on export round-trip cleanly on import.
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(cur); cur = '';
    } else if (c === '\r') {
      // ignore, line end handled on \n
    } else if (c === '\n') {
      row.push(cur); cur = '';
      rows.push(row); row = [];
    } else {
      cur += c;
    }
  }
  if (cur !== '' || row.length > 0) {
    row.push(cur);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ''));
}

export function exportPilesToCsv(rows) {
  const csv = pilesToCsv(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `Design_Piles_${date}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
