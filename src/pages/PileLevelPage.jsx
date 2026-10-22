import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { buildTol } from '../lib/calculations';
import { computePileLevels, slopeFactors, slopeFromResults, roundF } from '../lib/pileLevelCalc';
import SearchSelect from '../components/SearchSelect';

const fmt = (v, d = 3) => (v == null || Number.isNaN(Number(v)) ? '—' : Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }));
const sgn = (v, d = 3) => (v == null || Number.isNaN(Number(v)) ? '—' : `${Number(v) >= 0 ? '+' : ''}${fmt(v, d)}`);
const num = (s) => (s === '' || s == null ? null : Number(s));
const ALL_ZONES = '__all__';
const fmtTime = (ts) => (ts ? new Date(ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');

/** design rake 1:V from the incline text ("BATT. (1:5)" -> 5, VERT -> null) */
function designV(incline) {
  const m = (incline || '').match(/1\s*:\s*([\d.]+)/);
  return m ? Number(m[1]) : null;
}

export default function PileLevelPage({ session, role }) {
  const { t } = useTranslation();
  const canWrite = role === 'admin' || role === 'recorder';
  const [piles, setPiles] = useState([]);
  const [embedMin, setEmbedMin] = useState(2.0);
  const [pileZone, setPileZone] = useState(ALL_ZONES);
  const [pileId, setPileId] = useState('');
  const [hi, setHi] = useState('');
  const [mark, setMark] = useState('');
  const [seabed, setSeabed] = useState('');
  const [note, setNote] = useState('');
  const [slopeRec, setSlopeRec] = useState(null);      // latest TS 'after' record { id, measured_time, results }
  const [slopeLoading, setSlopeLoading] = useState(false);
  const [saved, setSaved] = useState(null);            // existing pile_final_levels row of the selected pile
  const [list, setList] = useState([]);
  const [confirm, setConfirm] = useState(null);        // { row } pending overwrite
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);                // { ok, text }

  const loadList = useCallback(async () => {
    const { data } = await supabase.from('pile_final_levels').select('*').order('updated_at', { ascending: false });
    setList(data ?? []);
  }, []);

  useEffect(() => {
    (async () => {
      const [{ data: p }, { data: s }] = await Promise.all([
        supabase.from('piles').select('*').order('pile_no'),
        supabase.from('project_settings').select('key, value'),
      ]);
      setPiles(p ?? []);
      setEmbedMin(buildTol(Object.fromEntries((s ?? []).map((r) => [r.key, r.value]))).coatingEmbedM);
    })();
    loadList();
  }, [loadList]);

  const pile = piles.find((p) => p.id === pileId) ?? null;
  const pileById = useMemo(() => Object.fromEntries(piles.map((p) => [p.id, p])), [piles]);

  /** always the LATEST 'after' Total Station record of the pile (by measured time) */
  const fetchLatestSlope = useCallback(async (id) => {
    const { data } = await supabase.from('asbuilt_records')
      .select('id, measured_time, results, is_primary')
      .eq('pile_id', id).eq('pile_stage', 'after')
      .order('measured_time', { ascending: false }).limit(1);
    return data?.[0] ?? null;
  }, []);

  useEffect(() => {
    setMsg(null);
    if (!pileId) { setSlopeRec(null); setSaved(null); return; }
    let live = true;
    (async () => {
      setSlopeLoading(true);
      const [rec, { data: sv }] = await Promise.all([
        fetchLatestSlope(pileId),
        supabase.from('pile_final_levels').select('*').eq('pile_id', pileId).maybeSingle(),
      ]);
      if (!live) return;
      setSlopeRec(rec);
      setSaved(sv ?? null);
      // pre-fill with the saved inputs so the site team sees what is recorded
      setHi(sv ? String(sv.hi) : '');
      setMark(sv ? String(sv.pile_mark) : '');
      setSeabed(sv?.seabed != null ? String(sv.seabed) : '');
      setNote(sv?.note ?? '');
      setSlopeLoading(false);
    })();
    return () => { live = false; };
  }, [pileId, fetchLatestSlope]);

  const actualV = slopeFromResults(slopeRec?.results);
  const pileVertical = pile ? designV(pile.incline) == null : false;
  // slope used: actual from the latest TS record; design only when no TS record yet
  const slopeSource = actualV != null ? 'actual' : 'design';
  const Vused = actualV != null ? actualV : (pile ? designV(pile.incline) : null);

  const result = useMemo(() => (pile ? computePileLevels({
    hi: num(hi), mark: num(mark), seabed: num(seabed), V: Vused, L: pile.length_m, Lc: pile.coating_length_m, embedMin,
  }) : null), [pile, hi, mark, seabed, Vused, embedMin]);

  const pileZones = useMemo(() => [...new Set(piles.map((p) => p.zone).filter(Boolean))].sort(), [piles]);
  const pileOptions = useMemo(() => {
    const lst = pileZone === ALL_ZONES ? piles : piles.filter((p) => p.zone === pileZone);
    const savedIds = new Set(list.map((r) => r.pile_id));
    return lst.map((p) => ({
      value: p.id, label: p.pile_no,
      secondary: [p.zone, p.incline, savedIds.has(p.id) ? `✓ ${t('levels.savedTag')}` : null].filter(Boolean).join(' · '),
    }));
  }, [piles, pileZone, list, t]);

  function buildRow(res, rec, V, src) {
    return {
      pile_id: pile.id,
      hi: num(hi), pile_mark: num(mark), seabed: num(seabed),
      slope_v: V, slope_source: src,
      slope_record_id: src === 'actual' ? rec?.id ?? null : null,
      slope_measured_time: src === 'actual' ? rec?.measured_time ?? null : null,
      factor: res.f, length_m: pile.length_m, coating_length_m: pile.coating_length_m,
      pile_tip: res.tip, pile_top: res.top, coating_bottom: res.coatingBottom, coating_embed: res.embed,
      note: note || null,
      updated_by: session?.user?.id ?? null,
      updated_at: new Date().toISOString(),
    };
  }

  async function handleSave() {
    if (!pile || !result) return;
    setBusy(true); setMsg(null);
    try {
      // re-read the latest slope right before saving (a newer TS record may have arrived)
      const rec = await fetchLatestSlope(pile.id);
      const aV = slopeFromResults(rec?.results);
      const src = aV != null ? 'actual' : 'design';
      const V = aV != null ? aV : designV(pile.incline);
      setSlopeRec(rec);
      const res = computePileLevels({ hi: num(hi), mark: num(mark), seabed: num(seabed), V, L: pile.length_m, Lc: pile.coating_length_m, embedMin });
      const row = buildRow(res, rec, V, src);
      const { data: existing } = await supabase.from('pile_final_levels').select('*').eq('pile_id', pile.id).maybeSingle();
      if (existing) { setConfirm({ row, existing }); return; }
      await write(row);
    } finally {
      setBusy(false);
    }
  }

  async function write(row) {
    setBusy(true);
    const { error } = await supabase.from('pile_final_levels').upsert(row, { onConflict: 'pile_id' });
    setBusy(false);
    setConfirm(null);
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setMsg({ ok: true, text: t('levels.savedMsg', { pile: pile.pile_no }) });
    const { data: sv } = await supabase.from('pile_final_levels').select('*').eq('pile_id', row.pile_id).maybeSingle();
    setSaved(sv ?? null);
    loadList();
  }

  const fx = result?.factors ?? slopeFactors(Vused);
  const savedDiffers = saved && result && (
    Math.abs(saved.pile_tip - result.tip) > 0.0005 || num(seabed) !== (saved.seabed == null ? null : Number(saved.seabed))
  );

  return (
    <div className="page">
      <p className="hint">{t('levels.intro')}</p>

      <section className="card">
        <h2 className="card-title">{t('levels.cardPile')}</h2>
        <div className="field">
          <span>{t('setout.pileLabel')}</span>
          {pileZones.length > 0 && (
            <div className="zone-filter">
              <span className="zone-filter-label">{t('form.zoneLabel')}</span>
              <button type="button" className={`zone-pill${pileZone === ALL_ZONES ? ' active' : ''}`} onClick={() => setPileZone(ALL_ZONES)}>
                {t('form.zoneAll')}
              </button>
              {pileZones.map((z) => (
                <button key={z} type="button" className={`zone-pill${pileZone === z ? ' active' : ''}`} onClick={() => { setPileZone(z); if (pile && pile.zone !== z) setPileId(''); }}>
                  {z}
                </button>
              ))}
            </div>
          )}
          <SearchSelect options={pileOptions} value={pileId} onChange={setPileId} placeholder={t('setout.pileSelectPlaceholder')} />
        </div>
        {pile && (
          <div className="design-strip mono">
            <div><span>{t('designPiles.col.incline')}</span>{pile.incline || '—'}</div>
            <div><span>L</span>{fmt(pile.length_m)}</div>
            <div><span>Lc</span>{fmt(pile.coating_length_m)}</div>
            <div><span>{t('levels.designToe')}</span>{fmt(pile.pile_toe_level)}</div>
            <div><span>{t('levels.designSeabed')}</span>{fmt(pile.sea_bed_level)}</div>
          </div>
        )}
      </section>

      {pile && (
        <section className="card">
          <h2 className="card-title">{t('levels.cardSlope')}</h2>
          {slopeLoading ? <p className="hint">…</p> : slopeSource === 'actual' ? (
            <p className="hint">
              {t('levels.slopeActual', { v: fmt(actualV, 3), time: fmtTime(slopeRec.measured_time), id: slopeRec.id.slice(0, 8) })}
              {pileVertical && ` · ${t('levels.verticalNote')}`}
            </p>
          ) : (
            <p className="form-err">{t('levels.slopeDesignWarn', { incline: pile.incline || 'VERT' })}</p>
          )}
          <div className="readout mono">
            <div className="readout-head">{t('levels.factorHead', { v: Vused == null ? '∞ (VERT)' : fmt(Vused, 3) })}</div>
            <div className="readout-grid">
              <div><span>{t('levels.fx.hyp')}</span><b>{fx.hyp == null ? '—' : fmt(fx.hyp, 4)}</b></div>
              <div><span>{t('levels.fx.alongPerVert')}</span><b>× {fmt(fx.alongPerVert, 4)}</b></div>
              <div><span>{t('levels.fx.vertPerAlong')}</span><b>× {fmt(fx.vertPerAlong, 4)} → {fmt(roundF(fx.vertPerAlong), 3)}</b></div>
              <div><span>{t('levels.fx.horizPerAlong')}</span><b>× {fmt(fx.horizPerAlong, 4)}</b></div>
              <div><span>{t('levels.fx.tilt')}</span><b>{fmt(fx.tiltDeg, 2)}°</b></div>
            </div>
          </div>
        </section>
      )}

      {pile && (
        <section className="card">
          <h2 className="card-title">{t('levels.cardInput')}</h2>
          <div className="grid2">
            <label className="field"><span>{t('levels.hi')}</span>
              <input inputMode="decimal" value={hi} onChange={(e) => setHi(e.target.value)} placeholder="6.500" /></label>
            <label className="field"><span>{t('levels.mark')}</span>
              <input inputMode="decimal" value={mark} onChange={(e) => setMark(e.target.value)} placeholder="36.128" /></label>
          </div>
          <label className="field"><span>{t('levels.seabed')}</span>
            <input inputMode="decimal" value={seabed} onChange={(e) => setSeabed(e.target.value)} placeholder="-6.547" /></label>
          <label className="field"><span>{t('levels.note')}</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} /></label>
        </section>
      )}

      {pile && result && (
        <section className="readout mono">
          <div className="readout-head">{t('levels.resultHead', { pile: pile.pile_no })}</div>
          <div className="readout-grid">
            <div><span>{t('levels.tip')}</span><b>{sgn(result.tip)}</b></div>
            <div><span>{t('levels.top')}</span><b>{sgn(result.top)}</b></div>
            <div><span>{t('levels.coatBottom')}</span><b>{sgn(result.coatingBottom)}</b></div>
            <div><span>{t('levels.embed')}</span><b>{result.embed == null ? '—' : fmt(result.embed)}</b></div>
          </div>
          <div className="readout-notes note-text">
            {t('levels.formula', {
              hi: fmt(num(hi)), mark: fmt(num(mark)), f: fmt(result.f, 3), tip: sgn(result.tip),
              L: fmt(pile.length_m), top: sgn(result.top), Lc: fmt(pile.coating_length_m), cb: sgn(result.coatingBottom),
              sb: seabed === '' ? '—' : sgn(num(seabed)), emb: result.embed == null ? '—' : fmt(result.embed),
            })}
          </div>
          <div className="verdict-row">
            {result.embedCheck && (
              <div className={`stamp ${result.embedCheck === 'OK' ? 'pass' : 'fail'}`}>
                {result.embedCheck}<small>{t('levels.embedStamp', { min: fmt(embedMin) })}</small>
              </div>
            )}
          </div>
        </section>
      )}

      {pile && saved && (
        <section className="card">
          <h2 className="card-title">{t('levels.savedHead')}</h2>
          <p className="hint">
            {t('levels.savedLine', {
              hi: fmt(saved.hi), mark: fmt(saved.pile_mark), sb: saved.seabed == null ? '—' : sgn(saved.seabed),
              v: saved.slope_v == null ? 'VERT' : fmt(saved.slope_v, 3), f: fmt(saved.factor, 3),
              tip: sgn(saved.pile_tip), top: sgn(saved.pile_top), emb: saved.coating_embed == null ? '—' : fmt(saved.coating_embed),
              time: fmtTime(saved.updated_at),
            })}
          </p>
          {savedDiffers && <p className="form-err">{t('levels.savedDiffers')}</p>}
        </section>
      )}

      {pile && (
        <>
          <button type="button" className="btn-save" disabled={!canWrite || !result || busy} onClick={handleSave}>
            {busy ? '…' : t('levels.saveBtn')}
          </button>
          {!canWrite && <p className="hint">{t('levels.noWrite')}</p>}
          {msg && <p className={msg.ok ? 'hint' : 'form-err'}>{msg.text}</p>}
        </>
      )}

      <section className="card" style={{ marginTop: 16 }}>
        <h2 className="card-title">{t('levels.listHead', { n: list.length })}</h2>
        <div style={{ overflowX: 'auto' }}>
          <table className="mono" style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['pile', 'hi', 'mark', 'seabed', 'slope', 'f', 'tip', 'top', 'cb', 'embed', 'time'].map((k) => (
                <th key={k} style={{ textAlign: 'right', padding: '4px 6px', borderBottom: '1px solid var(--line)' }}>{t(`levels.col.${k}`)}</th>
              ))}</tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id} onClick={() => setPileId(r.pile_id)} style={{ cursor: 'pointer' }}>
                  <td style={{ textAlign: 'right', padding: '3px 6px' }}><b>{pileById[r.pile_id]?.pile_no ?? '?'}</b></td>
                  <td style={{ textAlign: 'right', padding: '3px 6px' }}>{fmt(r.hi)}</td>
                  <td style={{ textAlign: 'right', padding: '3px 6px' }}>{fmt(r.pile_mark)}</td>
                  <td style={{ textAlign: 'right', padding: '3px 6px' }}>{r.seabed == null ? '—' : sgn(r.seabed)}</td>
                  <td style={{ textAlign: 'right', padding: '3px 6px' }}>{r.slope_v == null ? 'VERT' : `1:${fmt(r.slope_v, 3)}`}{r.slope_source === 'design' ? ' (D)' : ''}</td>
                  <td style={{ textAlign: 'right', padding: '3px 6px' }}>{fmt(r.factor, 3)}</td>
                  <td style={{ textAlign: 'right', padding: '3px 6px' }}>{sgn(r.pile_tip)}</td>
                  <td style={{ textAlign: 'right', padding: '3px 6px' }}>{sgn(r.pile_top)}</td>
                  <td style={{ textAlign: 'right', padding: '3px 6px' }}>{sgn(r.coating_bottom)}</td>
                  <td className={r.coating_embed == null ? '' : r.coating_embed >= embedMin - 1e-9 ? 'check-ok' : 'check-bad'} style={{ textAlign: 'right', padding: '3px 6px' }}>{r.coating_embed == null ? '—' : fmt(r.coating_embed)}</td>
                  <td style={{ textAlign: 'right', padding: '3px 6px' }}>{fmtTime(r.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {confirm && (
        <div className="modal-backdrop">
          <div className="modal-panel">
            <div className="modal-header"><h2>{t('levels.confirmTitle', { pile: pile?.pile_no })}</h2></div>
            <table className="mono" style={{ width: '100%', fontSize: 13, marginBottom: 12 }}>
              <thead><tr><th /><th style={{ textAlign: 'right' }}>{t('levels.confirmOld')}</th><th style={{ textAlign: 'right' }}>{t('levels.confirmNew')}</th></tr></thead>
              <tbody>
                {[
                  ['hi', confirm.existing.hi, confirm.row.hi, fmt],
                  ['mark', confirm.existing.pile_mark, confirm.row.pile_mark, fmt],
                  ['seabed', confirm.existing.seabed, confirm.row.seabed, sgn],
                  ['slope', confirm.existing.slope_v, confirm.row.slope_v, (v) => (v == null ? 'VERT' : `1:${fmt(v, 3)}`)],
                  ['f', confirm.existing.factor, confirm.row.factor, (v) => fmt(v, 3)],
                  ['tip', confirm.existing.pile_tip, confirm.row.pile_tip, sgn],
                  ['top', confirm.existing.pile_top, confirm.row.pile_top, sgn],
                  ['embed', confirm.existing.coating_embed, confirm.row.coating_embed, fmt],
                ].map(([k, a, b, f]) => (
                  <tr key={k}>
                    <td>{t(`levels.col.${k}`)}</td>
                    <td style={{ textAlign: 'right' }}>{a == null ? '—' : f(a)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{b == null ? '—' : f(b)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="hint">{t('levels.confirmSavedAt', { time: fmtTime(confirm.existing.updated_at) })}</p>
            <button type="button" className="btn-save" disabled={busy} onClick={() => write(confirm.row)}>{t('levels.confirmOverwrite')}</button>
            <button type="button" className="btn-secondary" onClick={() => { setConfirm(null); setMsg({ ok: true, text: t('levels.notSavedMsg') }); }}>{t('levels.confirmCancel')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
