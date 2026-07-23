import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { localdb, replaceAll } from '../lib/localdb';
import { queueRecord, queuePhotos, pushOne, isNetworkError } from '../lib/sync';
import { computeAll, bsCheck, parseIncline, crossCheckDiff } from '../lib/calculations';
import { compressPhoto, uploadPhoto, deletePhoto, fetchPhotos, photoUrl, PHOTO_TYPES } from '../lib/photos';
import { BOOL_KEY } from '../lib/statusLabels';
import ResultReadout from '../components/ResultReadout';
import SearchSelect from '../components/SearchSelect';

const fmt = (v, d = 3) => (v == null || Number.isNaN(v) ? '—' : Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }));
const num = (s) => (s === '' || s == null ? null : Number(s));
const flipSign = (s) => (s === '' || s == null ? s : (s.startsWith('-') ? s.slice(1) : `-${s}`));

const EMPTY_PT = { n: '', e: '', el: '' };
const NEW_STN = '__new__';
const ALL_ZONES = '__all__';
const STAGE_KEY = { before: 'common.stage.before', after: 'common.stage.after' };

export default function FormPage({ session, role, active, editRecord, onCancelEdit, onEditSaved }) {
  const { t } = useTranslation();
  const canSave = role === 'admin' || role === 'recorder';
  const [piles, setPiles] = useState([]);
  const [benchmarks, setBenchmarks] = useState([]);
  const [tol, setTol] = useState({ positionM: 0.075, tiltDeg: 1.0, residualM: 0.02, bsM: 0.01, coatingEmbedM: 2.0, crossCheckM: 0.03 });
  const [offline, setOffline] = useState(false);

  const [pileId, setPileId] = useState('');
  const [pileZone, setPileZone] = useState(ALL_ZONES);
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
  const [attemptedSave, setAttemptedSave] = useState(false);
  const [toast, setToast] = useState(null);
  const [mismatch, setMismatch] = useState(null); // { diff, tolM, surveyor, date, resolve }

  // existingPhotos: already-saved photos loaded when editing (id, storage_path,
  // original_type, photoType, removed). newPhotos: locally captured/chosen,
  // not yet uploaded (tempId, blob, previewUrl, photoType).
  const [existingPhotos, setExistingPhotos] = useState([]);
  const [newPhotos, setNewPhotos] = useState([]);
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

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
    setPileZone(ALL_ZONES);
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
    setAttemptedSave(false);
    (async () => {
      try {
        const rows = await fetchPhotos(editRecord.id);
        setExistingPhotos(rows.map((r) => ({
          id: r.id, storage_path: r.storage_path,
          original_type: r.photo_type, photoType: r.photo_type, removed: false,
        })));
      } catch (err) {
        setToast({ type: 'err', msg: err.message });
      }
    })();
  }, [editRecord]);

  function clearPhotoState() {
    newPhotos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    setNewPhotos([]);
    setExistingPhotos([]);
  }

  function resetToNewEntry() {
    setPileId(''); setStnSelect(''); setStnName('');
    setBsId(''); setBsN(''); setBsE('');
    setP1({ ...EMPTY_PT }); setP2({ ...EMPTY_PT }); setP3({ ...EMPTY_PT });
    setSeabed(''); setStage(''); setNote(''); setShare(true);
    setAttemptedSave(false);
    clearPhotoState();
  }

  function cancelEdit() {
    resetToNewEntry();
    onCancelEdit?.();
  }

  const totalPhotoCount = existingPhotos.filter((p) => !p.removed).length + newPhotos.length;

  async function addPhotoFiles(fileList) {
    const remaining = 6 - totalPhotoCount;
    if (remaining <= 0) return;
    const files = Array.from(fileList).slice(0, remaining);
    for (const file of files) {
      try {
        const blob = await compressPhoto(file);
        setNewPhotos((ps) => [...ps, { tempId: crypto.randomUUID(), blob, previewUrl: URL.createObjectURL(blob), photoType: 'pile' }]);
      } catch (err) {
        setToast({ type: 'err', msg: `${t('form.photoFailedToast')}: ${err.message}` });
        setTimeout(() => setToast(null), 4000);
      }
    }
  }

  function removeNewPhoto(tempId) {
    setNewPhotos((ps) => {
      const p = ps.find((x) => x.tempId === tempId);
      if (p) URL.revokeObjectURL(p.previewUrl);
      return ps.filter((x) => x.tempId !== tempId);
    });
  }

  function setNewPhotoType(tempId, photoType) {
    setNewPhotos((ps) => ps.map((x) => (x.tempId === tempId ? { ...x, photoType } : x)));
  }

  function removeExistingPhoto(id) {
    setExistingPhotos((ps) => ps.map((x) => (x.id === id ? { ...x, removed: true } : x)));
  }

  function setExistingPhotoType(id, photoType) {
    setExistingPhotos((ps) => ps.map((x) => (x.id === id ? { ...x, photoType } : x)));
  }

  // Applies the current photo edits against `recordId`: removes deleted
  // existing photos, updates changed types, uploads new ones. Used for both
  // new records (existingPhotos is always empty) and edit-mode updates.
  async function syncPhotoChanges(recordId) {
    const failures = [];
    for (const p of existingPhotos) {
      if (p.removed) {
        try { await deletePhoto(p); } catch { failures.push(p); }
      } else if (p.photoType !== p.original_type) {
        const { error } = await supabase.from('record_photos').update({ photo_type: p.photoType }).eq('id', p.id);
        if (error) failures.push(p);
      }
    }
    for (const p of newPhotos) {
      try { await uploadPhoto({ recordId, blob: p.blob, photoType: p.photoType }); } catch { failures.push(p); }
    }
    return failures;
  }

  const pile = piles.find((p) => p.id === pileId) ?? null;

  const pileZones = useMemo(() => [...new Set(piles.map((p) => p.zone).filter(Boolean))].sort(), [piles]);
  const pileOptions = useMemo(() => {
    const list = pileZone === ALL_ZONES ? piles : piles.filter((p) => p.zone === pileZone);
    return list.map((p) => ({ value: p.id, label: p.pile_no, secondary: [p.zone, p.incline].filter(Boolean).join(' · ') }));
  }, [piles, pileZone]);
  function selectPileZone(z) {
    setPileZone(z);
    if (pile && z !== ALL_ZONES && pile.zone !== z) setPileId('');
  }
  const stnOptions = useMemo(() => benchmarks.filter((b) => b.type === 'STN').map((b) => ({ value: b.id, label: b.name })), [benchmarks]);
  const bsOptions = useMemo(() => benchmarks.map((b) => ({ value: b.id, label: b.name })), [benchmarks]);
  const stnTrailingOption = { value: NEW_STN, label: t('form.addNewStationOption'), action: true };

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
  const stationSelected = !!stnMatch || stnIsNew;

  // Fields required before Save is enabled. Point 3, Note, BS measured N/E,
  // and Measured seabed are intentionally excluded — they never block save.
  const missingRequired = useMemo(() => [
    { empty: !pileId, key: 'form.field.pileNo' },
    { empty: !stationSelected, key: 'form.field.station' },
    { empty: !stage, key: 'form.field.stage' },
    { empty: !p1.n, key: 'form.field.p1Northing' },
    { empty: !p1.e, key: 'form.field.p1Easting' },
    { empty: !p1.el, key: 'form.field.p1Elevation' },
    { empty: !p2.n, key: 'form.field.p2Northing' },
    { empty: !p2.e, key: 'form.field.p2Easting' },
    { empty: !p2.el, key: 'form.field.p2Elevation' },
  ].filter((f) => f.empty), [pileId, stationSelected, stage, p1, p2]);

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
    setAttemptedSave(false);
    clearPhotoState();
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
      return { proceed: true, share, matchNote: t('form.matchNoteToast', { diff: fmt(worst.diff, 3) }) };
    }
    const choice = await askMismatch({ diff: worst.diff, tolM: tol.crossCheckM, surveyor: worst.surveyor, date: worst.date });
    if (choice === 'cancel') return { proceed: false };
    return { proceed: true, share: choice === 'shared' };
  }

  const saveBlocked = missingRequired.length > 0 || !results;

  function attemptSave() {
    if (saving) return;
    if (saveBlocked) {
      setAttemptedSave(true);
      if (missingRequired.length > 0) {
        const list = missingRequired.map((f) => t(f.key)).join(', ');
        setToast({ type: 'err', msg: t('form.missingFieldsToast', { list }) });
      } else {
        setToast({ type: 'err', msg: t('form.cannotComputeToast') });
      }
      setTimeout(() => setToast(null), 5000);
      return;
    }
    save();
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
    if (e2) { setToast({ type: 'err', msg: e2.message }); setSaving(false); return; }

    const photoFailures = await syncPhotoChanges(editRecord.id);
    setSaving(false);

    setToast({
      type: 'ok',
      msg: t('form.recordUpdatedToast') + (cc.matchNote ? ' · ' + cc.matchNote : '')
        + (photoFailures.length ? ` · ${t('form.photoFailuresSuffix', { count: photoFailures.length })}` : ''),
    });
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

    // Photos queue alongside the record itself (keyed to its client uuid) and
    // upload once the record has synced — see sync.js's syncPendingPhotos.
    const offlineMsg = `${t('form.savedOfflineToast')} — ${t('form.willSyncSuffix')}`
      + (newPhotos.length ? ` · ${t('form.photosQueuedSuffix', { count: newPhotos.length })}` : '');

    async function queueOffline() {
      await queueRecord(item);
      if (newPhotos.length) await queuePhotos(item.uuid, newPhotos);
      finishSave(offlineMsg);
    }

    if (!navigator.onLine) {
      await queueOffline();
      return;
    }

    try {
      await pushOne(item);
    } catch (err) {
      if (isNetworkError(err)) {
        await queueOffline();
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

    const photoFailures = newPhotos.length ? await syncPhotoChanges(item.uuid) : [];
    finishSave(`${t('form.pileSavedToast', { pileNo: pile.pile_no })}${cc.share ? ' · ' + t('form.sharedToTeamSuffix') : ' · ' + t('form.privateDraftSuffix')}${item.newStation ? ' · ' + t('form.newStationCreatedSuffix') : ''} · ${new Date(item.record.measured_time).toLocaleString()}${cc.matchNote ? ' · ' + cc.matchNote : ''}${photoFailures.length ? ` · ${t('form.photoFailuresSuffix', { count: photoFailures.length })}` : ''}`);
  }

  const inc = pile ? parseIncline(pile.incline) : null;

  return (
    <div className="page">
      {offline && (
        <section className="card offline-banner">
          {t('form.offlineUsingCache')}
        </section>
      )}
      {editRecord && (
        <section className="card edit-banner">
          <strong>{t('form.editingRecordPrefix')} · {pile?.pile_no ?? '—'} · {STAGE_KEY[stage] ? t(STAGE_KEY[stage]) : (stage ?? '—')}</strong>
          <button className="link" onClick={cancelEdit}>{t('form.cancelEdit')}</button>
        </section>
      )}
      <p className="hint"><span className="req-star">*</span> {t('form.requiredHint')}</p>

      {/* ---------- setup ---------- */}
      <section className="card">
        <h2 className="card-title">{t('form.cardPileStation')}</h2>
        <div className="field">
          <span>{t('form.pileNoLabel')} <span className="req-star">*</span></span>
          {pileZones.length > 0 && (
            <div className="zone-filter">
              <span className="zone-filter-label">{t('form.zoneLabel')}</span>
              <button type="button" className={`zone-pill${pileZone === ALL_ZONES ? ' active' : ''}`} onClick={() => selectPileZone(ALL_ZONES)}>
                {t('form.zoneAll')}
              </button>
              {pileZones.map((z) => (
                <button key={z} type="button" className={`zone-pill${pileZone === z ? ' active' : ''}`} onClick={() => selectPileZone(z)}>
                  {z}
                </button>
              ))}
            </div>
          )}
          <SearchSelect
            options={pileOptions}
            value={pileId}
            onChange={setPileId}
            placeholder={t('form.pileSelectPlaceholder')}
            error={attemptedSave && !pileId}
          />
        </div>
        {pile && (
          <div className="design-strip mono">
            <div><span>N</span>{fmt(pile.coordinate_pn)}</div>
            <div><span>E</span>{fmt(pile.coordinate_pe)}</div>
            <div><span>{t('form.designStripCutoff')}</span>{fmt(pile.pile_top_level)}</div>
            <div><span>Ø</span>{pile.dia_mm} mm</div>
          </div>
        )}
        <div className="field">
          <span>{t('form.stationLabel')} <span className="req-star">*</span></span>
          <SearchSelect
            options={stnOptions}
            value={stnSelect}
            onChange={setStnSelect}
            placeholder={t('form.stationSelectPlaceholder')}
            trailingOption={stnTrailingOption}
            error={attemptedSave && !stationSelected}
          />
        </div>
        {stnSelect === NEW_STN && (
          <label className="field">
            <span>{t('form.newStationNameLabel')}</span>
            <input
              value={stnName}
              onChange={(e) => setStnName(e.target.value)}
              placeholder={t('form.newStationNamePlaceholder')}
            />
          </label>
        )}
        {stnIsNew && (
          <p className="hint">
            {canSave
              ? t('form.newStationWillCreate')
              : t('form.unknownStation')}
          </p>
        )}
      </section>

      {/* ---------- stage & note ---------- */}
      <section className="card">
        <h2 className="card-title">{t('form.cardStageNote')}</h2>
        <label className="field">
          <span>{t('form.stageLabel')} <span className="req-star">*</span></span>
          <select
            value={stage}
            onChange={(e) => setStage(e.target.value)}
            className={attemptedSave && !stage ? 'input-error' : undefined}
          >
            <option value="">{t('form.stageSelectPlaceholder')}</option>
            <option value="before">{t('common.stage.before')}</option>
            <option value="after">{t('common.stage.after')}</option>
          </select>
        </label>
        <label className="field">
          <span>{t('form.noteLabel')}</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('form.notePlaceholder')} />
        </label>
      </section>

      {/* ---------- BS check ---------- */}
      <section className="card">
        <h2 className="card-title">{t('form.cardBsCheck')} <em>{t('form.bsCheckHint')}</em></h2>
        <label className="field">
          <span>{t('form.backsightLabel')}</span>
          <SearchSelect
            options={bsOptions}
            value={bsId}
            onChange={setBsId}
            placeholder={t('form.bsSelectPlaceholder')}
          />
        </label>
        <div className="grid2">
          <label className="field"><span>{t('form.measuredNLabel')}</span>
            <input inputMode="decimal" value={bsN} onChange={(e) => setBsN(e.target.value)} placeholder="0.000" /></label>
          <label className="field"><span>{t('form.measuredELabel')}</span>
            <input inputMode="decimal" value={bsE} onChange={(e) => setBsE(e.target.value)} placeholder="0.000" /></label>
        </div>
        {bsResult && (
          <div className={`stamp ${bsResult.pass ? 'pass' : 'fail'}`}>
            {t(BOOL_KEY[bsResult.pass ? 'TRUE' : 'FALSE'])} <small>diff {fmt(bsResult.diff, 4)} m{!bsResult.pass && ` — ${t('form.bsReSetupHint')}`}</small>
          </div>
        )}
      </section>

      {/* ---------- points ---------- */}
      <PointCard title={t('form.point1Title')} pt={p1} set={setP1} attemptedSave={attemptedSave} />
      <PointCard title={t('form.point3Title')} pt={p3} set={setP3} optional />
      <PointCard title={t('form.point2Title')} pt={p2} set={setP2} attemptedSave={attemptedSave} />

      <section className="card">
        <h2 className="card-title">{t('form.cardSeabed')} <em>{t('form.seabedHint')}</em></h2>
        <label className="field"><span>{t('form.measuredSeabedLabel')}</span>
          <div className="num-wrap">
            <input inputMode="decimal" value={seabed} onChange={(e) => setSeabed(e.target.value)}
                   placeholder={pile?.sea_bed_level != null ? `design: ${pile.sea_bed_level}` : '0.000'} />
            <button type="button" className="sign-toggle" onClick={() => setSeabed(flipSign(seabed))}>±</button>
          </div>
        </label>
      </section>

      {/* ---------- readout ---------- */}
      {results && <ResultReadout results={results} p1El={p1.el} tol={tol} inc={inc} stage={stage} note={note} />}

      {/* ---------- photos ---------- */}
      <section className="card">
        <h2 className="card-title">{t('form.cardPhotos')} <em>{totalPhotoCount}/6</em></h2>
        {canSave && (
          <div className="photo-add-row">
            <button type="button" className="btn-secondary" disabled={totalPhotoCount >= 6}
              onClick={() => cameraInputRef.current?.click()}>{t('form.takePhotoBtn')}</button>
            <button type="button" className="btn-secondary" disabled={totalPhotoCount >= 6}
              onClick={() => galleryInputRef.current?.click()}>{t('form.choosePhotoBtn')}</button>
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" hidden
              onChange={(e) => { addPhotoFiles(e.target.files); e.target.value = ''; }} />
            <input ref={galleryInputRef} type="file" accept="image/*" multiple hidden
              onChange={(e) => { addPhotoFiles(e.target.files); e.target.value = ''; }} />
          </div>
        )}
        {totalPhotoCount > 0 && (
          <div className="photo-thumb-row">
            {existingPhotos.filter((p) => !p.removed).map((p) => (
              <div key={p.id} className="photo-thumb">
                <img src={photoUrl(p.storage_path)} alt="" />
                {canSave ? (
                  <select value={p.photoType} onChange={(e) => setExistingPhotoType(p.id, e.target.value)}>
                    {PHOTO_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                ) : (
                  <span className="photo-type-label">{PHOTO_TYPES.find((t) => t.value === p.photoType)?.label}</span>
                )}
                {canSave && <button type="button" className="photo-remove" onClick={() => removeExistingPhoto(p.id)}>✕</button>}
              </div>
            ))}
            {newPhotos.map((p) => (
              <div key={p.tempId} className="photo-thumb">
                <img src={p.previewUrl} alt="" />
                <select value={p.photoType} onChange={(e) => setNewPhotoType(p.tempId, e.target.value)}>
                  {PHOTO_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <button type="button" className="photo-remove" onClick={() => removeNewPhoto(p.tempId)}>✕</button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ---------- save ---------- */}
      {canSave && (
        <div className="savebar">
          <label className="share-toggle">
            <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} />
            <span>{t('form.shareToTeamLabel')}</span>
          </label>
          <button
            className={`btn-save${saveBlocked ? ' btn-save-blocked' : ''}`}
            disabled={saving}
            onClick={attemptSave}
          >
            {saving ? t('form.savingBtn') : (editRecord ? t('form.updateRecordBtn') : t('form.saveRecordBtn'))}
          </button>
        </div>
      )}

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}

      {mismatch && (
        <div className="modal-backdrop" onClick={() => { mismatch.resolve('cancel'); setMismatch(null); }}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div><h2>{t('form.crossCheckMismatchTitle')}</h2></div>
            </div>
            <p>
              {t('form.crossCheckMismatchBody', { surveyor: mismatch.surveyor, date: mismatch.date, diff: fmt(mismatch.diff, 3), tol: fmt(mismatch.tolM, 3) })} {t('form.crossCheckSaveAnyway')}
            </p>
            <button className="btn-secondary" onClick={() => { setShare(true); mismatch.resolve('shared'); setMismatch(null); }}>
              {t('form.saveSharedBtn')}
            </button>
            <button className="btn-secondary" onClick={() => { setShare(false); mismatch.resolve('private'); setMismatch(null); }}>
              {t('form.savePrivateBtn')}
            </button>
            <button className="link" onClick={() => { mismatch.resolve('cancel'); setMismatch(null); }}>
              {t('form.cancelReviewBtn')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PointCard({ title, pt, set, optional = false, attemptedSave = false }) {
  const { t } = useTranslation();
  const showError = (v) => (!optional && attemptedSave && !v ? 'input-error' : undefined);
  return (
    <section className="card">
      <h2 className="card-title">{title}</h2>
      <div className="grid3">
        <label className="field"><span>{t('form.northingLabel')}{!optional && <span className="req-star"> *</span>}</span>
          <input inputMode="decimal" className={showError(pt.n)} value={pt.n} onChange={(e) => set({ ...pt, n: e.target.value })} placeholder="0.0000" /></label>
        <label className="field"><span>{t('form.eastingLabel')}{!optional && <span className="req-star"> *</span>}</span>
          <input inputMode="decimal" className={showError(pt.e)} value={pt.e} onChange={(e) => set({ ...pt, e: e.target.value })} placeholder="0.0000" /></label>
        <label className="field"><span>{t('form.elevationLabel')}{!optional && <span className="req-star"> *</span>}</span>
          <input inputMode="decimal" className={showError(pt.el)} value={pt.el} onChange={(e) => set({ ...pt, el: e.target.value })} placeholder="0.000" /></label>
      </div>
      {optional && <p className="hint">{t('form.pointOptionalHint')}</p>}
    </section>
  );
}
