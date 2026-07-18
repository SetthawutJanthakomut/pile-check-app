// Effective primary record for a pile+stage group — used everywhere a single
// record must represent the group: before/after pairing + head-movement
// summary, the detail modal's paired cards, and the PDF/PNG report.
// Explicit is_primary wins; otherwise the latest by measured time.
export function effectivePrimary(records) {
  if (!records || records.length === 0) return null;
  const explicit = records.find((r) => r.is_primary);
  if (explicit) return explicit;
  return records.reduce((latest, r) => {
    if (!latest) return r;
    const lt = latest.measured_time ? new Date(latest.measured_time).getTime() : -Infinity;
    const rt = r.measured_time ? new Date(r.measured_time).getTime() : -Infinity;
    return rt > lt ? r : latest;
  }, null);
}
