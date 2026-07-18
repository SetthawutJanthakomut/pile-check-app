import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { localdb, replaceAll } from '../lib/localdb';
import { queueRecord, pushOne, isNetworkError } from '../lib/sync';
import { computeAll, bsCheck, parseIncline, crossCheckDiff } from '../lib/calculations';
import ResultReadout from '../components/ResultReadout';

const fmt = (v, d = 3) => (v == null || Number.isNaN(v) ? '—' : Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }));
const num = (s) => (s === '' || s == null ? null : Number(s));
const flipSign = (s) => (s === '' || s == null ? s : (s.startsWith('-') ? s.slice(1) : `-${s}`));

const EMPTY_PT = { n: '', e: '', el: '' };
const NEW_STN = '__new__';
const STAGE_BANNER = { before: 'Before driving · ก่อนตอก', after: 'After driving · หลังตอก' };

export default function FormPage({ session, role, active, editRecord, onCancelEdit, onEditSaved }) {
  const canSave = role === 'admin' || role === 'recorder';
  const [piles, setPiles] = useState([]);
  const [benchmarks, setBenchmarks] = useState([]);
  const [tol, setTol] = useState({ positionM: 0.075, tiltDeg: 1.0, residualM: 0.02, bsM: 0.01, coatingEmbedM: 2.0, crossCheckM: 0.03 });
  const [offline, setOffline] = useState(false);

  const [pileId, setPileId] = useState('');
  const [stnSelect, setStnSelect] = useState('');
  const [stnName, setStnName] = useState('');
  const [bsId, setBsId] = useState('');
  const [bsN, setBsN] = useState('');
  const [bsE, setBsE] = useState('');
  const [p1, setP1] = useState({ ...EMPTY_PT });
  const [p2, setP2] = useState({ ...EMPTY_PT });
  const [p3, setP3] = useState({ ...EMPTY_PT });
  const [seabed, setSeabed] = useState('');
  const [stage, setStage] = useState('');
  const [note, setNote] = useState('');
  const [share, setShare] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [mismatch, setMismatch] = useState(null); // { diff, tolM, surveyor, date, resolve }

  useEffect(() => {
    (async () => {
      const [{ data: p, error: pErr }, { data: b, error: bErr }] = await Promise.all([
        supabase.from('piles').select('*').order('pile_no'),
        supabase.from('benchmarks').select('*').eq('active', true).order('name'),
      ]);
      if (pErr || bErr) {
        const [cachedPiles, cachedBenchmarks] = await Promise.all([
          localdb.piles.toArray(),
          localdb.benchmarks.toArray(),
        ]);
        setPiles(cachedPiles.sort((a, c) => (a.pile_no > c.pile_no ? 1 : -1)));
        setBenchmarks(cachedBenchmarks.filter((r) => r.active).sort((a, c) => (a.name > c.name ? 1 : -1)));
        setOffline(true);
        return;
      }
      setPiles(p ?? []);
      setBenchmarks(b ?? []);
      setOffline(false);
      await Promise.all([
        replaceAll(localdb.piles, p ?? []),
        replaceAll(localdb.benchmarks, b ?? []),
      ]);
    })();
  }, []);

  // Re-fetch tolerances every time the Form tab becomes active, so edits made
  // on the Settings page take effect without a full app reload (App.jsx keeps
  // every page mounted and just toggles visibility, so mount-only fetch isn't enough).
  useEffect(() => {
    if (!active) return;
    (async () => {
      const { data: s, error } = await supabase.from('project_settings').select('*');
      if (error || !s) {
        const cached = await localdb.settings.toArray();
        if (cached.length) {
          const m = Object.fromEntries(cached.map((r) => [r.key, r.value]));
          setTol({
            positionM: m.tol_position_m ?? 0.075,
            tiltDeg: m.tol_tilt_deg ?? 1.0,
            residualM: m.tol_residual_m ?? 0.02,
            bsM: m.tol_bs_m ?? 0.01,
            coatingEmbedM: m.tol_coating_embed_m ?? 2.0,
            crossCheckM: m.tol_cross_check_m ?? 0.03,
          });
        }
        setOffline(true);
        return;
      }
      const m = Object.fromEntries(s.map((r) => [r.key, r.value]));
      setTol({
        positionM: m.tol_position_m ?? 0.075,
        tiltDeg: m.tol_tilt_deg ?? 1.0,
        residualM: m.tol_residual_m ?? 0.02,
        bsM: m.tol_bs_m ?? 0.01,
        coatingEmbedM: m.tol_coating_embed_m ?? 2.0,
        crossCheckM: m.tol_cross_check_m ?? 0.03,
      });
      setOffline(false);
      await replaceAll(localdb.settings, s);
    })();
  }, [active]);

  // Prefill the form from the record being edited (survey_points come pre-joined).
  useEffect(() => {
    if (!editRecord) return;
    const toPt = (p) => (p ? { n: String(p.northing), e: String(p.easting), el: String(p.elevation) } : { ...EMPTY_PT });
    const pts = {};
    (editRecord.survey_points || []).forEach((p) => { pts[p.point_no] = p; });
    setPileId(editRecord.pile_id ?? '');
    setStnSelect(editRecord.station_id ?? '');
    setStnName('');
    setBsId(editRecord.backsight_id ?? '');
    setBsN(editRecord.bs_measured_n != null ? String(editRecord.bs_measured_n) : '');
    setBsE(editRecord.bs_measured_e != null ? String(editRecord.bs_measured_e) : '');
    setP1(toPt(pts[1]));
    setP2(toPt(pts[2]));
    setP3(toPt(pts[3]));
    setSeabed(editRecord.measured_seabed != null ? String(editRecord.measured_seabed) : '');
    setStage(editRecord.pile_stage ?? '');
    setNote(editRecord.note ?? '');
    setShare(editRecord.is_shared ?? true);
  }, [editRecord]);

  function resetToNewEntry() {
    setPileId(''); setStnSelect(''); setStnName('');
    setBsId(''); setBsN(''); setBsE('');
    setP1({ ...EMPTY_PT }); setP2({ ...EMPTY_PT }); setP3({ ...EMPTY_PT });
    setSeabed(''); setStage(''); setNote(''); setShare(true);
  }

  function cancelEdit() {
    resetToNewEntry();
    onCancelEdit?.();
  }

  const pile = piles.find((p) => p.id === pileId) ?? null;
  const stnMatch = stnSelect && stnSelect !== NEW_STN
    ? benchmarks.find((b) => b.id === stnSelect) ?? null
    : null;
  const stnIsNew = stnSelect === NEW_STN && stnName.trim() !== '';
  // A brand-new station has no known coordinates yet; use the BS-measured
  // shot as its position (same values that will seed the new benchmark row).
  const stnCoord = stnMatch
    ? { n: stnMatch.northing, e: stnMatch.easting }
    : (stnIsNew && bsN !== '' && bsE !== '' ? { n: num(bsN), e: num(bsE) } : null);
  const bs = benchmarks.find((b) => b.id === bsId) ?? null;

  const bsResult = useMemo(() => {
    if (!bs || bsN === '' || bsE === '') return null;
    return bsCheck({ n: num(bsN), e: num(bsE) }, { n: bs.northing, e: bs.easting }, tol.bsM);
  }, [bs, bsN, bsE, tol.bsM]);

  const ready = pile && stnCoord && p1.n && p1.e && p1.el && p2.n && p2.e && p2.el;

  const results = useMemo(() => {
    if (!ready) return null;
    try {
      return computeAll({
        design: {
          pn: pile.coordinate_pn, pe: pile.coordinate_pe, cutoff: pile.pile_top_level,
          diaMm: pile.dia_mm, incline: pile.incline, batterAzDeg: pile.batter_bearing_deg,
          lengthM: pile.length_m, coatingLengthM: pile.coating_length_m,
          seaBedLevel: pile.sea_bed_level,
          toePn: pile.toe_pn, toePe: pile.toe_pe,
          pileToeLevel: pile.pile_toe_level,
        },
        stn: stnCoord,
        p1: { n: num(p1.n), e: num(p1.e), el: num(p1.el) },
        p2: { n: num(p2.n), e: num(p2.e), el: num(p2.el) },
        p3: p3.n && p3.e && p3.el ? { n: num(p3.n), e: num(p3.e), el: num(p3.el) } : null,
        measuredSeabed: num(seabed),
        tol,
      });
    } catch {
      return null;
    }
  }, [ready, pile, stnCoord, p1, p2, p3, seabed, tol]);

  function finishSave(msg) {
    setSaving(false);
    setToast({ type: 'ok', msg });
    setP1({ ...EMPTY_PT }); setP2({ ...EMPTY_PT }); setP3({ ...EMPTY_PT }); setSeabed(''); setNote('');
    setTimeout(() => setToast(null), 4000);
  }

  function askMismatch(info) {
    return new Promise((resolve) => setMismatch({ ...info, resolve }));
  }

  // Cross-check the new result against existing records of the same pile+stage
  // before saving. Offline: the server comparison is skipped entirely (nothing
  // to compare against locally) and the record is queued as usual.
  async function checkCrossCheck(excludeId) {
    if (!stage || !navigator.onLine) return { proceed: true, share };
    let q = supabase.from('asbuilt_records').select('id, surveyor, measured_at, results')
      .eq('pile_id', pile.id).eq('pile_stage', stage);
    if (excludeId) q = q.neq('id', excludeId);
    const { data, error } = await q;
    if (error || !data || data.length === 0) return { proceed: true, share };

    let worst = null;
    for (const r of data) {
      if (r.results?.asbuiltN == null) continue;
      const diff = crossCheckDiff(results, r.results);
      if (!worst || diff > worst.diff) worst = { diff, surveyor: r.surveyor, date: r.measured_at };
    }
    if (!worst) return { proceed: true, share };

    if (worst.diff <= tol.crossCheckM) {
      return { proceed: true, share, matchNote: `✓ matches existing survey (diff ${fmt(worst.diff, 3)} m)` };
    }
    const choice = await askMismatch({ diff: worst.diff, tolM: tol.crossCheckM, surveyor: worst.surveyor, date: worst.date });
    if (choice === 'cancel') return { proceed: false };
    return { proceed: true, share: choice === 'shared' };
  }

  async function save() {
    if (!results) return;
    setSaving(true);

    if (!editRecord) return saveNew();

    const cc = await checkCrossCheck(editRecord.id);
    if (!cc.proceed) { setSaving(false); return; }

    let stationId = stnMatch?.id ?? null;
    if (stnIsNew) {
      const { data: newBm, error: bmErr } = await supabase.from('benchmarks').insert({
        name: stnName.trim(),
        northing: num(bsN),
        easting: num(bsE),
        elevation: null,
        type: 'STN',
      }).select().single();
      if (bmErr) { setToast({ type: 'err', msg: bmErr.message }); setSaving(false); return; }
      stationId = newBm.id;
      setBenchmarks((bms) => [...bms, newBm]);
      setStnSelect(newBm.id);
    }

    const pts = [
      { point_no: 1, northing: num(p1.n), easting: num(p1.e), elevation: num(p1.el) },
      { point_no: 2, northing: num(p2.n), easting: num(p2.e), elevation: num(p2.el) },
    ];
    if (p3.n && p3.e && p3.el) pts.push({ point_no: 3, northing: num(p3.n), easting: num(p3.e), elevation: num(p3.el) });

    const { error } = await supabase.from('asbuilt_records').update({
      pile_id: pile.id,
      station_id: stationId,
      backsight_id: bs?.id ?? null,
      bs_measured_n: num(bsN), bs_measured_e: num(bsE),
      measured_seabed: num(seabed),
      is_shared: cc.share,
      results,
      pile_stage: stage || null,
      note: note.trim() === '' ? null : note.trim(),
    }).eq('id', editRecord.id);
    if (error) { setToast({ type: 'err', msg: error.message }); setSaving(false); return; }

    const { error: delErr } = await supabase.from('survey_points').delete().eq('record_id', editRecord.id);
    if (delErr) { setToast({ type: 'err', msg: delErr.message }); setSaving(false); return; }
    const { error: e2 } = await supabase.from('survey_points').insert(pts.map((pt) => ({ ...pt, record_id: editRecord.id })));
    setSaving(false);
    if (e2) { setToast({ type: 'err', msg: e2.message }); return; }

    setToast({ type: 'ok', msg: `Record updated · บันทึกการแก้ไขแล้ว${cc.matchNote ? ' · ' + cc.matchNote : ''}` });
    setTimeout(() => setToast(null), 4000);
    resetToNewEntry();
    onEditSaved?.();
  }

  // New (non-edit) record: builds the full payload up front with a
  // client-generated uuid, so the same object can be pushed online now or
  // queued to pending_records and retried later without ever duplicating
  // rows (pushOne always upserts on that uuid).
  async function saveNew() {
    const cc = await checkCrossCheck(null);
    if (!cc.proceed) { setSaving(false); return; }

    const stationId = stnIsNew ? crypto.randomUUID() : (stnMatch?.id ?? null);
    const pts = [
      { point_no: 1, northing: num(p1.n), easting: num(p1.e), elevation: num(p1.el) },
      { point_no: 2, northing: num(p2.n), easting: num(p2.e), elevation: num(p2.el) },
    ];
    if (p3.n && p3.e && p3.el) pts.push({ point_no: 3, northing: num(p3.n), easting: num(p3.e), elevation: num(p3.el) });

    const item = {
      uuid: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      pileNo: pile.pile_no,
      newStation: stnIsNew ? {
        id: stationId, name: stnName.trim(), northing: num(bsN), easting: num(bsE), elevation: null, type: 'STN',
      } : null,
      record: {
        pile_id: pile.id,
        station_id: stationId,
        backsight_id: bs?.id ?? null,
        bs_measured_n: num(bsN), bs_measured_e: num(bsE),
        measured_seabed: num(seabed),
        surveyor: session.user.email,
        is_shared: cc.share,
        results,
        measured_time: new Date().toISOString(),
        pile_stage: stage || null,
        note: note.trim() === '' ? null : note.trim(),
      },
      points: pts,
    };

    if (!navigator.onLine) {
      await queueRecord(item);
      finishSave('Saved offline · บันทึกออฟไลน์ — will sync · จะซิงค์เมื่อมีสัญญาณ');
      return;
    }

    try {
      await pushOne(item);
    } catch (err) {
      if (isNetworkError(err)) {
        await queueRecord(item);
        finishSave('Saved offline · บันทึกออฟไลน์ — will sync · จะซิงค์เมื่อมีสัญญาณ');
        return;
      }
      setToast({ type: 'err', msg: err.message });
      setSaving(false);
      return;
    }

    if (item.newStation) {
      setBenchmarks((bms) => [...bms, item.newStation]);
      setStnSelect(item.newStation.id);
    }
    finishSave(`Pile ${pile.pile_no} saved${cc.share ? ' · shared to team' : ' · private draft'}${item.newStation ? ' · new station created · สร้างหมุดใหม่' : ''} · ${new Date(item.record.measured_time).toLocaleString()}${cc.matchNote ? ' · ' + cc.matchNote : ''}`);
  }

  const inc = pile ? parseIncline(pile.incline) : null;

  return (
    <div className="page">
      {offline && (
        <section className="card offline-banner">
          Offline · ออฟไลน์ — using cached data · ใช้ข้อมูลล่าสุดในเครื่อง
        </section>
      )}
      {editRecord && (
        <section className="card edit-banner">
          <strong>Editing record · {pile?.pile_no ?? '—'} · {STAGE_BANNER[stage] ?? stage ?? '—'}</strong>
          <button className="link" onClick={cancelEdit}>Cancel edit · ยกเลิก</button>
        </section>
      )}
      {/* ---------- setup ---------- */}
      <section className="card">
        <h2 className="card-title">Pile &amp; station · เข็มและจุดตั้งกล้อง</h2>
        <label className="field">
          <span>Pile No.</span>
          <select value={pileId} onChange={(e) => setPileId(e.target.value)}>
            <option value="">— select pile —</option>
            {piles.map((p) => <option key={p.id} value={p.id}>{p.pile_no} · {p.incline}</option>)}
          </select>
        </label>
        {pile && (
          <div className="design-strip mono">
            <div><span>N</span>{fmt(pile.coordinate_pn)}</div>
            <div><span>E</span>{fmt(pile.coordinate_pe)}</div>
            <div><span>Cut-off</span>{fmt(pile.pile_top_level)}</div>
            <div><span>Ø</span>{pile.dia_mm} mm</div>
          </div>
        )}
        <label className="field">
          <span>Station (STN)</span>
          <select value={stnSelect} onChange={(e) => setStnSelect(e.target.value)}>
            <option value="">— select station —</option>
            {benchmarks.filter((b) => b.type === 'STN').map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            <option value={NEW_STN}>+ Add new station · เพิ่มจุดใหม่</option>
          </select>
        </label>
        {stnSelect === NEW_STN && (
          <label className="field">
            <span>New station name · ชื่อจุดใหม่</span>
            <input
              value={stnName}
              onChange={(e) => setStnName(e.target.value)}
              placeholder="Type new station name"
            />
          </label>
        )}
        {stnIsNew && (
          <p className="hint">
            {canSave
              ? 'New station — will be created on save · หมุดใหม่ จะถูกสร้างเมื่อบันทึก'
              : 'Unknown station · ไม่พบหมุดนี้'}
          </p>
        )}
      </section>

      {/* ---------- stage & note ---------- */}
      <section className="card">
        <h2 className="card-title">Stage &amp; note · ช่วงและหมายเหตุ</h2>
        <label className="field">
          <span>Stage · ช่วง</span>
          <select value={stage} onChange={(e) => setStage(e.target.value)}>
            <option value="">— select stage —</option>
            <option value="before">Before driving · ก่อนตอก</option>
            <option value="after">After driving · หลังตอก</option>
          </select>
        </label>
        <label className="field">
          <span>Note · หมายเหตุ</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note · หมายเหตุ (ถ้ามี)" />
        </label>
      </section>

      {/* ---------- BS check ---------- */}
      <section className="card">
        <h2 className="card-title">BS check · เช็คหมุดหลัง <em>shoot BS before piles</em></h2>
        <label className="field">
          <span>Backsight</span>
          <select value={bsId} onChange={(e) => setBsId(e.target.value)}>
            <option value="">— select BS —</option>
            {benchmarks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>
        <div className="grid2">
          <label className="field"><span>Measured N</span>
            <input inputMode="decimal" value={bsN} onChange={(e) => setBsN(e.target.value)} placeholder="0.000" /></label>
          <label className="field"><span>Measured E</span>
            <input inputMode="decimal" value={bsE} onChange={(e) => setBsE(e.target.value)} placeholder="0.000" /></label>
        </div>
        {bsResult && (
          <div className={`stamp ${bsResult.pass ? 'pass' : 'fail'}`}>
            {bsResult.pass ? 'TRUE' : 'FALSE'} <small>diff {fmt(bsResult.diff, 4)} m{!bsResult.pass && ' — re-setup station'}</small>
          </div>
        )}
      </section>

      {/* ---------- points ---------- */}
      <PointCard title="Point 1 · Top จุดสูงสุด" pt={p1} set={setP1} />
      <PointCard title="Point 3 · Mid กลาง (cross-check, optional)" pt={p3} set={setP3} optional />
      <PointCard title="Point 2 · Bottom จุดต่ำสุด" pt={p2} set={setP2} />

      <section className="card">
        <h2 className="card-title">Seabed re-survey · วัด seabed ใหม่ <em>blank = use design</em></h2>
        <label className="field"><span>Measured seabed EL.</span>
          <div className="num-wrap">
            <input inputMode="decimal" value={seabed} onChange={(e) => setSeabed(e.target.value)}
                   placeholder={pile?.sea_bed_level != null ? `design: ${pile.sea_bed_level}` : '0.000'} />
            <button type="button" className="sign-toggle" onClick={() => setSeabed(flipSign(seabed))}>±</button>
          </div>
        </label>
      </section>

      {/* ---------- readout ---------- */}
      {results && <ResultReadout results={results} p1El={p1.el} tol={tol} inc={inc} stage={stage} note={note} />}

      {/* ---------- save ---------- */}
      {canSave && (
        <div className="savebar">
          <label className="share-toggle">
            <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} />
            <span>Share to team · แชร์ให้ทีม</span>
          </label>
          <button className="btn-save" disabled={!results || saving} onClick={save}>
            {saving ? 'Saving…' : (editRecord ? 'Update record · บันทึกการแก้ไข' : 'Save record')}
          </button>
        </div>
      )}

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}

      {mismatch && (
        <div className="modal-backdrop" onClick={() => { mismatch.resolve('cancel'); setMismatch(null); }}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div><h2>Cross-check mismatch · ข้อมูลไม่ตรงกัน</h2></div>
            </div>
            <p>
              Does not match existing survey by {mismatch.surveyor} ({mismatch.date}) — diff {fmt(mismatch.diff, 3)} m &gt; {fmt(mismatch.tolM, 3)} m.
              อาจพิมพ์ตัวเลขผิด ตรวจสอบก่อนบันทึก. Save anyway?
            </p>
            <button className="btn-secondary" onClick={() => { setShare(true); mismatch.resolve('shared'); setMismatch(null); }}>
              Save shared · บันทึกแบบแชร์
            </button>
            <button className="btn-secondary" onClick={() => { setShare(false); mismatch.resolve('private'); setMismatch(null); }}>
              Save private · บันทึกส่วนตัว
            </button>
            <button className="link" onClick={() => { mismatch.resolve('cancel'); setMismatch(null); }}>
              Cancel · กลับไปตรวจ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PointCard({ title, pt, set, optional = false }) {
  return (
    <section className="card">
      <h2 className="card-title">{title}</h2>
      <div className="grid3">
        <label className="field"><span>Northing</span>
          <input inputMode="decimal" value={pt.n} onChange={(e) => set({ ...pt, n: e.target.value })} placeholder="0.0000" /></label>
        <label className="field"><span>Easting</span>
          <input inputMode="decimal" value={pt.e} onChange={(e) => set({ ...pt, e: e.target.value })} placeholder="0.0000" /></label>
        <label className="field"><span>Elev.</span>
          <input inputMode="decimal" value={pt.el} onChange={(e) => set({ ...pt, el: e.target.value })} placeholder="0.000" /></label>
      </div>
      {optional && <p className="hint">เว้นว่างได้ / leave blank to skip cross-check</p>}
    </section>
  );
}
