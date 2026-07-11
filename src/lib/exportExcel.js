// Excel export helper (SheetJS) for the Records table.
// Reads values straight from the row objects the table already renders — no recomputation.
import * as XLSX from 'xlsx';

function cellValue(col, row) {
  if (col.render) return col.render(row[col.key], row);
  const v = row[col.key];
  return v == null ? null : v;
}

function buildWorkbook(columns, rows, sheetName) {
  const header = columns.map((c) => c.label);
  const body = rows.map((row) => columns.map((col) => cellValue(col, row)));
  const sheet = XLSX.utils.aoa_to_sheet([header, ...body]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, sheetName);
  return wb;
}

export function exportRecordsToExcel(columns, rows) {
  const wb = buildWorkbook(columns, rows, 'AsBuilt Records');
  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `AsBuilt_Records_${date}.xlsx`);
}

export function exportBenchmarksToExcel(columns, rows) {
  const wb = buildWorkbook(columns, rows, 'Benchmarks');
  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `Benchmarks_${date}.xlsx`);
}
