import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { effectivePrimary } from '../lib/primary';
import { crossCheckDiff, posCheckFor } from '../lib/calculations';
import { fmt } from '../lib/format';
import RecordDetailModal from '../components/RecordDetailModal';
import { getColumns } from './RecordsTable';
import { useRecordActions } from '../lib/recordActions';
import { useAutoRefresh } from '../lib/useAutoRefresh';
import { useDataRefresh } from '../lib/dataRefresh';

const UNASSIGNED = '__unassigned__';
const MIN_K = 0.4;
const MAX_K = 8;
const clampK = (k) => Math.min(MAX_K, Math.max(MIN_K, k));

// Rounds a value up to a "nice" 1/2/5 * 10^n number, for grid spacing and
// the scale bar so they read as round metres instead of arbitrary decimals.
function niceNumber(x) {
  if (!(x > 0)) return 1;
  const exp = Math.floor(Math.log10(x));
  const base = x / 10 ** exp;
  const nice = base < 1.5 ? 1 : base < 3.5 ? 2 : base < 7.5 ? 5 : 10;
  return nice * 10 ** exp;
}

// Flattens a joined asbuilt_records row into the same shape RecordsTable
// builds for its server rows — the shape RecordDetailModal/ResultReadout expect.
function flattenRecord(r) {
  const pts = {};
  (r.survey_points || []).forEach((p) => { pts[p.point_no] = p; });
  const res = r.results || {};
  return {
    id: r.id,
    pile_no: r.piles?.pile_no ?? '—',
    measured_at: r.measured_at,
    measured_time: r.measured_time,
    surveyor: r.surveyor,
    stn_name: r.station?.name ?? '—',
    p1n: pts[1]?.northing, p1e: pts[1]?.easting, p1el: pts[1]?.elevation,
    p2n: pts[2]?.northing, p2e: pts[2]?.easting, p2el: pts[2]?.elevation,
    p3n: pts[3]?.northing, p3e: pts[3]?.easting, p3el: pts[3]?.elevation,
    measured_seabed: r.measured_seabed,
    is_shared: r.is_shared,
    is_primary: r.is_primary,
    created_by: r.created_by,
    pile_stage: r.pile_stage,
    note: r.note,
    ...res,
  };
}

// Worst cross-check diff between the effective primary and the rest of a
// pile+stage group — 0 when there's nothing to compare against.
function crossCheckMax(members) {
  if (!members || members.length < 2) return 0;
  const primary = effectivePrimary(members);
  let maxDiff = 0;
  members.forEach((m) => {
    if (m.id === primary.id) return;
    maxDiff = Math.max(maxDiff, crossCheckDiff(primary, m));
  });
  return maxDiff;
}

// Design fields shown in the popover's expandable "Design details" section —
// labels match the bilingual conventions used in PilesTable/PileReport.
// batter_bearing_deg is naturally omitted for VERT. piles since it's stored
// as null for them (see 001_schema.sql), so no separate incline check is needed.
const DESIGN_FIELDS = [
  { key: 'dia_mm', labelKey: 'plan.design.diaMm', decimals: 1 },
  { key: 'pile_top_level', labelKey: 'plan.design.topLevel' },
  { key: 'pile_toe_level', labelKey: 'plan.design.toeLevel' },
  { key: 'length_m', labelKey: 'plan.design.lengthM', decimals: 2 },
  { key: 'coating_length_m', labelKey: 'plan.design.coatingM', decimals: 2 },
  { key: 'batter_bearing_deg', labelKey: 'plan.design.batterAz', decimals: 2 },
  { key: 'sea_bed_level', labelKey: 'plan.design.seabedLevel' },
];

const LEGEND_ITEMS = [
  { key: 'none', labelKey: 'plan.legendNone' },
  { key: 'beforeOnly', labelKey: 'plan.legendBeforeOnly' },
  { key: 'afterOk', labelKey: 'plan.legendAfterOk' },
  { key: 'afterOver', labelKey: 'plan.legendAfterOver' },
  { key: 'disagree', labelKey: 'plan.legendDisagree' },
];

function statusLine(label, primary, tolPositionM) {
  return primary ? `${label}: ${posCheckFor(primary.totalDev, tolPositionM)} ${fmt(primary.totalDev, 3)} m` : `${label}: —`;
}

function PileMarker({ info, proj, r, showLabel, dim, pulsing, onSelect }) {
  const { pile, status, beforeOver, disagree } = info;
  const { x, y } = proj.toXY(Number(pile.coordinate_pe), Number(pile.coordinate_pn));

  let fillEl;
  if (status === 'afterOk' || status === 'afterOver') {
    fillEl = (
      <circle cx={x} cy={y} r={r} fill={status === 'afterOk' ? 'var(--pass)' : 'var(--fail)'}
        stroke="rgba(0,0,0,0.25)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
    );
  } else if (status === 'beforeOnly') {
    fillEl = (
      <>
        <circle cx={x} cy={y} r={r} fill="none" stroke="var(--ink-soft)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        <path d={`M ${x} ${y - r} A ${r} ${r} 0 0 0 ${x} ${y + r} Z`} fill="var(--plan-amber)" />
      </>
    );
  } else {
    fillEl = <circle cx={x} cy={y} r={r} fill="var(--plan-grey)" stroke="var(--line)" strokeWidth={1} vectorEffect="non-scaling-stroke" />;
  }

  return (
    <g className={`plan-marker${dim ? ' dim' : ''}`} onClick={(e) => { e.stopPropagation(); onSelect(pile.pile_no); }}>
      {fillEl}
      {beforeOver && (
        <circle cx={x} cy={y} r={r + 2} fill="none" stroke="var(--fail)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      )}
      {disagree && (
        <circle cx={x} cy={y} r={r + 4.5} fill="none" stroke="var(--accent)" strokeWidth={2}
          strokeDasharray="3 2" vectorEffect="non-scaling-stroke" />
      )}
      {pulsing && (
        <circle cx={x} cy={y} r={r} fill="none" stroke="var(--accent)" strokeWidth={2} className="plan-pulse-ring" />
      )}
      {showLabel && (
        <text x={x + r + 3} y={y + 3.5} className="plan-label" fontSize={Math.max(9, r * 0.9)}>
          {pile.pile_no}
        </text>
      )}
    </g>
  );
}

export default function PlanView({ session, role, onEdit }) {
  const { t } = useTranslation();
  const [piles, setPiles] = useState([]);
  const [records, setRecords] = useState([]);
  const [tol, setTol] = useState(0.03);
  const [tolPositionM, setTolPositionM] = useState(0.075);
  const [toast, setToast] = useState(null);

  const containerRef = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [cam, setCam] = useState({ x: 0, y: 0, k: 1 });
  const initedRef = useRef(false);
  const lastZoneRef = useRef(undefined);
  const zoneInitedRef = useRef(false);
  const pendingFocusRef = useRef(null);
  const gestureRef = useRef({ pointers: new Map(), mode: null });

  const [activeFilters, setActiveFilters] = useState(() => new Set());
  const [selectedZone, setSelectedZone] = useState(null);
  // Starts collapsed on narrow (mobile) viewports so the panel doesn't
  // cover most of the plan on first load — still user-toggleable either way.
  const [legendOpen, setLegendOpen] = useState(() => (typeof window === 'undefined' ? true : window.innerWidth > 640));
  const [search, setSearch] = useState('');
  const [searchMsg, setSearchMsg] = useState('');
  const [pulseId, setPulseId] = useState(null);
  const [selectedPile, setSelectedPile] = useState(null);
  const [designOpen, setDesignOpen] = useState(false);
  const [modalGroup, setModalGroup] = useState(null);

  // Collapses the design-details expander whenever a different pile (or no
  // pile) is selected, so it doesn't stay open across popover instances.
  useEffect(() => { setDesignOpen(false); }, [selectedPile]);

  const reload = useCallback(async () => {
    const [pilesRes, recRes, tolRes] = await Promise.all([
      supabase.from('piles').select('id, pile_no, coordinate_pn, coordinate_pe, incline, zone, dia_mm, pile_top_level, pile_toe_level, length_m, coating_length_m, batter_bearing_deg, sea_bed_level, note').order('pile_no'),
      supabase.from('asbuilt_records')
        .select('*, piles(pile_no), station:benchmarks!station_id(name), survey_points(point_no, northing, easting, elevation)'),
      supabase.from('project_settings').select('key, value').in('key', ['tol_cross_check_m', 'tol_position_m']),
    ]);
    setPiles(pilesRes.data ?? []);
    (tolRes.data ?? []).forEach((r) => {
      if (r.key === 'tol_cross_check_m' && r.value != null) setTol(r.value);
      if (r.key === 'tol_position_m' && r.value != null) setTolPositionM(r.value);
    });
    setRecords(recRes.data ?? []);
  }, []);

  const { version, reportStart, reportEnd } = useDataRefresh();
  const { loading } = useAutoRefresh(reload, { version, onStart: reportStart, onEnd: reportEnd });

  // Raw records grouped+flattened for display — same shape RecordsTable
  // derives, kept as a memo (not fetch-time state) so the shared
  // useRecordActions delete handler's optimistic filter re-derives it.
  const recordsByPile = useMemo(() => {
    const grouped = {};
    records.forEach((r) => {
      const flat = flattenRecord(r);
      if (!grouped[flat.pile_no]) grouped[flat.pile_no] = {};
      if (!grouped[flat.pile_no][flat.pile_stage]) grouped[flat.pile_no][flat.pile_stage] = [];
      grouped[flat.pile_no][flat.pile_stage].push(flat);
    });
    return grouped;
  }, [records]);

  // One entry per plottable pile (has finite design coordinates), with its
  // derived survey status — after wins over before, disagree is orthogonal.
  const pileInfo = useMemo(() => piles
    .filter((p) => Number.isFinite(Number(p.coordinate_pe)) && Number.isFinite(Number(p.coordinate_pn)))
    .map((p) => {
      const group = recordsByPile[p.pile_no] || {};
      const beforeArr = group.before || [];
      const afterArr = group.after || [];
      const beforePrimary = effectivePrimary(beforeArr);
      const afterPrimary = effectivePrimary(afterArr);
      let status = 'none';
      if (afterPrimary) status = posCheckFor(afterPrimary.totalDev, tolPositionM) === 'OK' ? 'afterOk' : 'afterOver';
      else if (beforePrimary) status = 'beforeOnly';
      const beforeOver = status === 'beforeOnly' && beforePrimary && posCheckFor(beforePrimary.totalDev, tolPositionM) === 'OVER';
      const disagree = crossCheckMax(beforeArr) > tol || crossCheckMax(afterArr) > tol;
      return { pile: p, beforeArr, afterArr, beforePrimary, afterPrimary, status, beforeOver, disagree };
    }), [piles, recordsByPile, tol, tolPositionM]);

  const zones = useMemo(() => {
    const set = new Set();
    let hasUnassigned = false;
    piles.forEach((p) => { if (p.zone) set.add(p.zone); else hasUnassigned = true; });
    const sorted = [...set].sort();
    if (hasUnassigned) sorted.push(UNASSIGNED);
    return sorted;
  }, [piles]);

  // Defaults the view to the first zone (not an all-zones overview) so
  // distant zones don't collapse into overlapping blobs on first load.
  useEffect(() => {
    if (!zoneInitedRef.current && zones.length > 0) {
      setSelectedZone(zones[0]);
      zoneInitedRef.current = true;
    }
  }, [zones]);

  const visiblePileInfo = useMemo(() => {
    if (!selectedZone || zones.length === 0) return pileInfo;
    return pileInfo.filter((info) => (info.pile.zone || UNASSIGNED) === selectedZone);
  }, [pileInfo, selectedZone, zones.length]);

  const counts = useMemo(() => {
    const c = { none: 0, beforeOnly: 0, afterOk: 0, afterOver: 0, disagree: 0 };
    visiblePileInfo.forEach((info) => {
      c[info.status] += 1;
      if (info.disagree) c.disagree += 1;
    });
    return c;
  }, [visiblePileInfo]);

  // Fits only the currently visible (zone-filtered) piles, so distant zones
  // each get their own readable layout instead of sharing one sparse bbox.
  const bbox = useMemo(() => {
    if (!visiblePileInfo.length) return null;
    let minE = Infinity, maxE = -Infinity, minN = Infinity, maxN = -Infinity;
    visiblePileInfo.forEach(({ pile }) => {
      const e = Number(pile.coordinate_pe), n = Number(pile.coordinate_pn);
      if (e < minE) minE = e;
      if (e > maxE) maxE = e;
      if (n < minN) minN = n;
      if (n > maxN) maxN = n;
    });
    const spanE = (maxE - minE) || 1;
    const spanN = (maxN - minN) || 1;
    const padE = spanE * 0.08, padN = spanN * 0.08;
    return { minE: minE - padE, maxE: maxE + padE, minN: minN - padN, maxN: maxN + padN };
  }, [visiblePileInfo]);

  // Auto-fit projection: maps design E/N (metres) to container-pixel space at
  // cam = {x:0, y:0, k:1} — north up, so higher N maps to a smaller screen y.
  const proj = useMemo(() => {
    if (!bbox || !size.w || !size.h) return null;
    const spanE = bbox.maxE - bbox.minE;
    const spanN = bbox.maxN - bbox.minN;
    const s0 = Math.min(size.w / spanE, size.h / spanN);
    const drawW = spanE * s0, drawH = spanN * s0;
    const offX = (size.w - drawW) / 2;
    const offY = (size.h - drawH) / 2;
    return {
      s0,
      drawW,
      drawH,
      toXY: (e, n) => ({ x: offX + (e - bbox.minE) * s0, y: offY + (bbox.maxN - n) * s0 }),
    };
  }, [bbox, size]);

  // Re-fits the camera to identity on first load and whenever the selected
  // zone changes, so switching zones re-fits instead of keeping a stale
  // pan/zoom from the previous zone's bbox.
  useEffect(() => {
    if (!proj) return;
    const zoneChanged = lastZoneRef.current !== undefined && lastZoneRef.current !== selectedZone;
    if (!initedRef.current || zoneChanged) {
      setCam({ x: 0, y: 0, k: 1 });
      initedRef.current = true;
    }
    lastZoneRef.current = selectedZone;
  }, [proj, selectedZone]);

  // A pending pile search that required a zone switch resumes here once the
  // new zone's proj is ready, overriding the identity reset above.
  useEffect(() => {
    const id = pendingFocusRef.current;
    if (id == null || !proj) return;
    pendingFocusRef.current = null;
    const match = pileInfo.find((pi) => pi.pile.id === id);
    if (!match) return;
    const { x, y } = proj.toXY(Number(match.pile.coordinate_pe), Number(match.pile.coordinate_pn));
    const k = 2.5;
    setCam({ x: size.w / 2 - x * k, y: size.h / 2 - y * k, k });
    setPulseId(id);
    setTimeout(() => setPulseId((cur) => (cur === id ? null : cur)), 2900);
  }, [proj, pileInfo, size]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0].contentRect;
      setSize({ w: cr.width, h: cr.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [loading]);

  // Wheel zoom needs a non-passive native listener — React's onWheel prop
  // can't reliably preventDefault the page scroll.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    function onWheel(e) {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      setCam((c) => {
        const factor = Math.exp(-e.deltaY * 0.0015);
        const k = clampK(c.k * factor);
        const worldX = (mx - c.x) / c.k, worldY = (my - c.y) / c.k;
        return { x: mx - worldX * k, y: my - worldY * k, k };
      });
    }
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [loading]);

  // Pointer capture is deferred until real movement is detected (see
  // handlePointerMove) — capturing eagerly on pointerdown retargets the
  // synthetic click that follows a plain tap to the capture element,
  // which would silently break tapping a marker to open its popover.
  function handlePointerDown(e) {
    const pts = gestureRef.current.pointers;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    gestureRef.current.svgEl = e.currentTarget;
    if (pts.size === 1) {
      gestureRef.current.mode = 'pan';
      gestureRef.current.last = { x: e.clientX, y: e.clientY };
      gestureRef.current.moved = 0;
      gestureRef.current.captured = false;
    } else if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      gestureRef.current.mode = 'pinch';
      gestureRef.current.startDist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      gestureRef.current.startCam = { ...cam };
      gestureRef.current.startMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      // Two pointers down is unambiguously a pinch, never a tap — safe to capture now.
      pts.forEach((_, id) => { try { e.currentTarget.setPointerCapture(id); } catch { /* noop */ } });
    }
  }

  function handlePointerMove(e) {
    const pts = gestureRef.current.pointers;
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (gestureRef.current.mode === 'pan' && pts.size === 1) {
      const last = gestureRef.current.last;
      const dx = e.clientX - last.x, dy = e.clientY - last.y;
      gestureRef.current.last = { x: e.clientX, y: e.clientY };
      gestureRef.current.moved = (gestureRef.current.moved || 0) + Math.hypot(dx, dy);
      if (gestureRef.current.moved > 3) {
        if (!gestureRef.current.captured) {
          try { gestureRef.current.svgEl.setPointerCapture(e.pointerId); } catch { /* noop */ }
          gestureRef.current.captured = true;
        }
        setCam((c) => ({ ...c, x: c.x + dx, y: c.y + dy }));
      }
    } else if (gestureRef.current.mode === 'pinch' && pts.size === 2) {
      const [a, b] = [...pts.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const rect = containerRef.current.getBoundingClientRect();
      const startCam = gestureRef.current.startCam;
      const k = clampK(startCam.k * (dist / gestureRef.current.startDist));
      const startMidLocal = { x: gestureRef.current.startMid.x - rect.left, y: gestureRef.current.startMid.y - rect.top };
      const midLocal = { x: mid.x - rect.left, y: mid.y - rect.top };
      const worldX = (startMidLocal.x - startCam.x) / startCam.k;
      const worldY = (startMidLocal.y - startCam.y) / startCam.k;
      setCam({ x: midLocal.x - worldX * k, y: midLocal.y - worldY * k, k });
    }
  }

  function handlePointerUp(e) {
    gestureRef.current.pointers.delete(e.pointerId);
    if (gestureRef.current.pointers.size === 1) {
      const [p] = [...gestureRef.current.pointers.values()];
      gestureRef.current.mode = 'pan';
      gestureRef.current.last = p;
      gestureRef.current.moved = 0;
    } else if (gestureRef.current.pointers.size === 0) {
      gestureRef.current.mode = null;
    }
  }

  const baseRadius = useMemo(() => {
    if (!proj || !visiblePileInfo.length) return 10;
    const avgSpacingPx0 = Math.sqrt((proj.drawW * proj.drawH) / visiblePileInfo.length);
    return Math.min(18, Math.max(10, avgSpacingPx0 * 0.28));
  }, [proj, visiblePileInfo.length]);

  // Labels get crowded when many piles sit close together at the current
  // zoom — hide them below a spacing threshold and reveal on zoom-in.
  const showLabels = useMemo(() => {
    if (!proj || !visiblePileInfo.length) return true;
    const avgSpacingPx0 = Math.sqrt((proj.drawW * proj.drawH) / visiblePileInfo.length);
    return avgSpacingPx0 * cam.k >= 30;
  }, [proj, visiblePileInfo.length, cam.k]);

  const grid = useMemo(() => {
    if (!bbox) return null;
    const step = niceNumber(Math.max(bbox.maxE - bbox.minE, bbox.maxN - bbox.minN) / 8);
    const vLines = [];
    for (let e = Math.ceil(bbox.minE / step) * step; e <= bbox.maxE; e += step) vLines.push(e);
    const hLines = [];
    for (let n = Math.ceil(bbox.minN / step) * step; n <= bbox.maxN; n += step) hLines.push(n);
    return { vLines, hLines };
  }, [bbox]);

  const scaleBar = useMemo(() => {
    if (!proj) return null;
    const pxPerMeter = proj.s0 * cam.k;
    const meters = niceNumber(80 / pxPerMeter);
    return { meters, px: meters * pxPerMeter };
  }, [proj, cam.k]);

  function isActive(info) {
    if (activeFilters.size === 0) return true;
    if (activeFilters.has(info.status)) return true;
    if (activeFilters.has('disagree') && info.disagree) return true;
    return false;
  }

  function toggleFilter(key) {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  // Searches across all piles regardless of the current zone; if the match
  // is in a different zone, switches zones first and lets the pending-focus
  // effect above pan/pulse it once that zone's proj is ready.
  function goToPile(query) {
    const q = query.trim().toLowerCase();
    if (!q) return;
    const match = pileInfo.find((pi) => pi.pile.pile_no.toLowerCase() === q)
      || pileInfo.find((pi) => pi.pile.pile_no.toLowerCase().includes(q));
    if (!match) { setSearchMsg(t('plan.searchNotFound')); return; }
    setSearchMsg('');
    const zoneOfMatch = match.pile.zone || UNASSIGNED;
    if (zones.length && selectedZone !== zoneOfMatch) {
      pendingFocusRef.current = match.pile.id;
      setSelectedZone(zoneOfMatch);
      return;
    }
    if (!proj) return;
    const { x, y } = proj.toXY(Number(match.pile.coordinate_pe), Number(match.pile.coordinate_pn));
    const k = Math.max(cam.k, 2.5);
    setCam({ x: size.w / 2 - x * k, y: size.h / 2 - y * k, k });
    const id = match.pile.id;
    setPulseId(id);
    setTimeout(() => setPulseId((cur) => (cur === id ? null : cur)), 2900);
  }

  const popoverInfo = useMemo(
    () => pileInfo.find((pi) => pi.pile.pile_no === selectedPile) || null,
    [pileInfo, selectedPile],
  );
  let popoverPos = null;
  if (popoverInfo && proj) {
    const { x, y } = proj.toXY(Number(popoverInfo.pile.coordinate_pe), Number(popoverInfo.pile.coordinate_pn));
    const rawX = cam.x + x * cam.k;
    const rawY = cam.y + y * cam.k;
    popoverPos = {
      x: Math.min(Math.max(rawX, 110), Math.max(size.w - 110, 110)),
      y: Math.min(Math.max(rawY, 20), Math.max(size.h - 20, 20)),
    };
  }

  function handleViewRecord(info) {
    const preferred = info.afterPrimary || info.beforePrimary;
    if (!preferred) return;
    setModalGroup({ row: preferred, group: { before: info.beforeArr, after: info.afterArr } });
    setSelectedPile(null);
  }

  const stageShort = { before: t('common.stage.beforeShort'), after: t('common.stage.afterShort') };
  const { handleEdit, handleDelete } = useRecordActions({ records, setRecords, onEdit, setToast, stageLabels: stageShort });

  // Same wrappers RecordsTable uses around the shared edit/delete handlers —
  // close the Plan modal too, since it's not visible from the table's callers.
  function handleModalEdit(id) {
    handleEdit(id);
    setModalGroup(null);
  }

  async function handleModalDelete(deletedRow) {
    const ok = await handleDelete(deletedRow);
    if (!ok) return;
    setModalGroup(null);
  }

  const zoneLabel = !selectedZone
    ? '—'
    : selectedZone === UNASSIGNED
      ? t('plan.unassignedZone')
      : selectedZone;

  return (
    <div className="page-wide plan-page">
      <div className="page-toolbar">
        <h1>{t('plan.title')}</h1>
        <form
          className="plan-search"
          onSubmit={(e) => { e.preventDefault(); goToPile(search); }}
        >
          <input
            className="filter-input"
            placeholder={t('plan.searchPlaceholder')}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setSearchMsg(''); }}
          />
          <button className="btn-secondary" type="submit">{t('plan.go')}</button>
        </form>
        {searchMsg && <span className="hint">{searchMsg}</span>}
      </div>

      {zones.length > 0 && (
        <div className="zone-filter">
          <span className="zone-filter-label">{t('plan.zone')}</span>
          {zones.map((z) => (
            <button
              key={z}
              type="button"
              className={`zone-pill${selectedZone === z ? ' active' : ''}`}
              onClick={() => setSelectedZone(z)}
            >
              {z === UNASSIGNED ? t('plan.unassignedZone') : z}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <p className="hint">{t('plan.loading')}</p>
      ) : !pileInfo.length ? (
        <p className="hint">{t('plan.noPiles')}</p>
      ) : (
        <div className="plan-canvas-wrap" ref={containerRef}>
          <svg
            className="plan-svg"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <rect x={0} y={0} width={size.w} height={size.h} fill="var(--paper)" onClick={() => setSelectedPile(null)} />
            {proj && (
              <>
                <g transform={`translate(${cam.x} ${cam.y}) scale(${cam.k})`}>
                  {grid && grid.vLines.map((e) => {
                    const a = proj.toXY(e, bbox.minN);
                    const b = proj.toXY(e, bbox.maxN);
                    return <line key={`v${e}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--line)" strokeWidth={1} vectorEffect="non-scaling-stroke" opacity={0.7} />;
                  })}
                  {grid && grid.hLines.map((n) => {
                    const a = proj.toXY(bbox.minE, n);
                    const b = proj.toXY(bbox.maxE, n);
                    return <line key={`h${n}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--line)" strokeWidth={1} vectorEffect="non-scaling-stroke" opacity={0.7} />;
                  })}
                  {visiblePileInfo.map((info) => (
                    <PileMarker
                      key={info.pile.id}
                      info={info}
                      proj={proj}
                      r={baseRadius}
                      showLabel={showLabels}
                      dim={!isActive(info)}
                      pulsing={pulseId === info.pile.id}
                      onSelect={setSelectedPile}
                    />
                  ))}
                </g>
                <g transform={`translate(${size.w - 34} 34)`}>
                  <line x1={0} y1={14} x2={0} y2={-14} stroke="var(--ink)" strokeWidth={2} />
                  <polygon points="0,-16 6,-4 -6,-4" fill="var(--ink)" />
                  <text x={0} y={26} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--ink)">N</text>
                </g>
                {scaleBar && (
                  <g transform={`translate(16 ${size.h - 16})`}>
                    <line x1={0} y1={0} x2={scaleBar.px} y2={0} stroke="var(--ink)" strokeWidth={2} />
                    <line x1={0} y1={-5} x2={0} y2={5} stroke="var(--ink)" strokeWidth={2} />
                    <line x1={scaleBar.px} y1={-5} x2={scaleBar.px} y2={5} stroke="var(--ink)" strokeWidth={2} />
                    <text x={scaleBar.px / 2} y={-9} textAnchor="middle" fontSize={11} fill="var(--ink)">{scaleBar.meters} m</text>
                  </g>
                )}
              </>
            )}
          </svg>

          <div className={`plan-legend${legendOpen ? '' : ' collapsed'}`}>
            <button className="plan-legend-toggle" onClick={() => setLegendOpen((o) => !o)}>
              {legendOpen ? `${t('plan.legend')} ▾ — ${zoneLabel}` : `${t('plan.legend')} ▸`}
            </button>
            {legendOpen && (
              <ul>
                {LEGEND_ITEMS.map((item) => (
                  <li
                    key={item.key}
                    className={activeFilters.has(item.key) ? 'active' : ''}
                    onClick={() => toggleFilter(item.key)}
                  >
                    <span className={`plan-swatch plan-swatch-${item.key}`} />
                    {t(item.labelKey)} ({counts[item.key]})
                  </li>
                ))}
              </ul>
            )}
          </div>

          {popoverInfo && popoverPos && (
            <div className="plan-popover" style={{ left: popoverPos.x, top: popoverPos.y }} onClick={(e) => e.stopPropagation()}>
              <div className="plan-popover-head">
                <strong>{popoverInfo.pile.pile_no}</strong>
                <button className="link" onClick={() => setSelectedPile(null)}>✕</button>
              </div>
              <p className="hint">
                {t('plan.zone')}: {popoverInfo.pile.zone || '—'} · {t('plan.incline')}: {popoverInfo.pile.incline || '—'}
              </p>
              <p className="hint mono">
                PN {fmt(Number(popoverInfo.pile.coordinate_pn), 3)} / PE {fmt(Number(popoverInfo.pile.coordinate_pe), 3)}
              </p>

              <div className="plan-popover-design">
                <button
                  type="button"
                  className="plan-popover-design-toggle"
                  onClick={() => setDesignOpen((o) => !o)}
                >
                  {designOpen ? '▾' : '▸'} {t('plan.designDetails')}
                </button>
                {designOpen && (
                  <div className="plan-popover-design-body">
                    {DESIGN_FIELDS.map(({ key, labelKey, decimals }) => {
                      const v = popoverInfo.pile[key];
                      if (v == null || v === '') return null;
                      return (
                        <div className="plan-popover-kv" key={key}>
                          <span>{t(labelKey)}</span>
                          <b className="mono">{fmt(Number(v), decimals ?? 3)}</b>
                        </div>
                      );
                    })}
                    {popoverInfo.pile.note && (
                      <div className="plan-popover-kv">
                        <span>{t('plan.note')}</span>
                        <b>{popoverInfo.pile.note}</b>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="plan-popover-line">{statusLine(stageShort.before, popoverInfo.beforePrimary, tolPositionM)}</div>
              <div className="plan-popover-line">{statusLine(stageShort.after, popoverInfo.afterPrimary, tolPositionM)}</div>
              {(popoverInfo.afterPrimary || popoverInfo.beforePrimary) && (
                <button className="btn-secondary" onClick={() => handleViewRecord(popoverInfo)}>
                  {t('plan.viewRecord')}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {modalGroup && (
        <RecordDetailModal
          row={modalGroup.row}
          group={modalGroup.group}
          tolCrossCheckM={tol}
          tolPositionM={tolPositionM}
          columns={getColumns(t)}
          canSetPrimary={false}
          onSetPrimary={() => {}}
          session={session}
          role={role}
          onEditRecord={handleModalEdit}
          onDeleteRecord={handleModalDelete}
          onClose={() => setModalGroup(null)}
        />
      )}
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
