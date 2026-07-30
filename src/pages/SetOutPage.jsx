import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { localdb } from '../lib/localdb';
import { parseIncline } from '../lib/calculations';
import { computeSetout, toDMS } from '../lib/setoutCalc';
import SearchSelect from '../components/SearchSelect';

const fmt = (v, d = 3) => (v == null || Number.isNaN(v) ? '—' : Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }));
const num = (s) => (s === '' || s == null ? null : Number(s));

const ALL_ZONES = '__all__';

// Namespaced per logged-in user so different accounts on the same browser
// don't overwrite each other's remembered Setting Out inputs.
function storageKeyFor(session) {
  const u = session?.user;
  if (u?.id) return `setout:${u.id}`;
  if (u?.email) return `setout:${u.email}`;
  return 'setout:anon';
}

function readStored(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function SetOutPage({ session }) {
  const { t } = useTranslation();
  const [piles, setPiles] = useState([]);
  const [benchmarks, setBenchmarks] = useState([]);

  const storageKey = storageKeyFor(session);
  const stored = useMemo(() => readStored(storageKey), []); // eslint-disable-line react-hooks/exhaustive-deps

  const [pileId, setPileId] = useState(stored?.pileId ?? '');
  const [pileZone, setPileZone] = useState(ALL_ZONES);
  const [stnId, setStnId] = useState(stored?.stnId ?? '');
  const [bsId, setBsId] = useState(stored?.bsId ?? '');
  const [hi, setHi] = useState(stored?.hi ?? '');
  const [zt, setZt] = useState(stored?.zt ?? '');
  const [ztA, setZtA] = useState(stored?.ztA ?? '');
  const [ztB, setZtB] = useState(stored?.ztB ?? '');

  const lastKeyRef = useRef(storageKey);
  const skipNextSaveRef = useRef(false);
  const restoreZtSkipRef = useRef(false);
  const mountedRef = useRef(false);

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
        return;
      }
      setPiles(p ?? []);
      setBenchmarks(b ?? []);
    })();
  }, []);

  const pile = piles.find((p) => p.id === pileId) ?? null;
  const inc = pile ? parseIncline(pile.incline) : null;

  // Switching piles (including across vertical<->battered) drops any typed
  // Zt values — a level typed for one pile isn't meaningful for another,
  // and this guarantees no stale value leaks into the other mode's inputs.
  // Skipped on mount and when a user-switch restore just set pileId + Zt
  // together, so a restored value isn't immediately wiped out.
  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return; }
    if (restoreZtSkipRef.current) { restoreZtSkipRef.current = false; return; }
    setZt(''); setZtA(''); setZtB('');
  }, [pileId]);

  // Re-hydrate remembered inputs when the signed-in user changes (the page
  // stays mounted across sign-out/sign-in), so one account never sees
  // another account's remembered values.
  useEffect(() => {
    if (lastKeyRef.current === storageKey) return;
    lastKeyRef.current = storageKey;
    skipNextSaveRef.current = true;
    const saved = readStored(storageKey);
    if (saved?.pileId) restoreZtSkipRef.current = true;
    setPileId(saved?.pileId ?? '');
    setStnId(saved?.stnId ?? '');
    setBsId(saved?.bsId ?? '');
    setHi(saved?.hi ?? '');
    setZt(saved?.zt ?? '');
    setZtA(saved?.ztA ?? '');
    setZtB(saved?.ztB ?? '');
  }, [storageKey]);

  // Persist the last-used inputs, debounced, so reloading or reopening the
  // tab restores them automatically.
  useEffect(() => {
    if (skipNextSaveRef.current) { skipNextSaveRef.current = false; return; }
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify({ pileId, stnId, bsId, hi, zt, ztA, ztB }));
      } catch {
        // ignore quota/denied (e.g. private browsing)
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [storageKey, pileId, stnId, bsId, hi, zt, ztA, ztB]);

  function clearStored() {
    setPileId(''); setStnId(''); setBsId(''); setHi(''); setZt(''); setZtA(''); setZtB('');
    try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
  }

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
  const stn = benchmarks.find((b) => b.id === stnId) ?? null;
  const bs = benchmarks.find((b) => b.id === bsId) ?? null;

  const ready = !!(pile && stn && bs && hi !== '' && stn.elevation != null);
  const setup = ready ? {
    N_S: stn.northing, E_S: stn.easting, Z_I: stn.elevation + num(hi),
    N_B: bs.northing, E_B: bs.easting,
  } : null;

  // Same atan2/normalize convention as computeSetout's internal Az_BS
  // (setoutCalc.js) — recomputed here for live display, not imported,
  // so this display-only page never touches the math module.
  const bsAzimuth = useMemo(() => {
    if (!stn || !bs) return null;
    const deg = Math.atan2(bs.easting - stn.easting, bs.northing - stn.northing) * (180 / Math.PI);
    return ((deg % 360) + 360) % 360;
  }, [stn, bs]);

  const singleResult = useMemo(() => {
    if (!ready || !inc?.vertical || zt === '') return null;
    return computeSetout(pile, num(zt), setup);
  }, [ready, inc, zt, pile, setup]);

  const resultA = useMemo(() => {
    if (!ready || !inc || inc.vertical || ztA === '') return null;
    return computeSetout(pile, num(ztA), setup);
  }, [ready, inc, ztA, pile, setup]);

  const resultB = useMemo(() => {
    if (!ready || !inc || inc.vertical || ztB === '') return null;
    return computeSetout(pile, num(ztB), setup);
  }, [ready, inc, ztB, pile, setup]);

  return (
    <div className="page">
      <p className="hint">{t('setout.calcOnlyNote')}</p>
      <button type="button" className="link" onClick={clearStored} style={{ padding: 0 }}>
        {t('setout.clearBtn')}
      </button>

      <section className="card">
        <h2 className="card-title">{t('setout.cardPileStation')}</h2>
        <div className="field">
          <span>{t('setout.pileLabel')}</span>
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
            placeholder={t('setout.pileSelectPlaceholder')}
          />
        </div>
        {pile && (
          <div className="design-strip mono">
            <div><span>N</span>{fmt(pile.coordinate_pn)}</div>
            <div><span>E</span>{fmt(pile.coordinate_pe)}</div>
            <div><span>{t('form.designStripCutoff')}</span>{fmt(pile.pile_top_level)}</div>
            <div><span>Ø</span>{pile.dia_mm} mm</div>
            <div><span>{t('designPiles.col.incline')}</span>{pile.incline || '—'}</div>
          </div>
        )}
        <label className="field">
          <span>{t('setout.stationLabel')}</span>
          <SearchSelect
            options={stnOptions}
            value={stnId}
            onChange={setStnId}
            placeholder={t('setout.stationSelectPlaceholder')}
          />
        </label>
        <label className="field">
          <span>{t('setout.backsightLabel')}</span>
          <SearchSelect
            options={bsOptions}
            value={bsId}
            onChange={setBsId}
            placeholder={t('setout.backsightSelectPlaceholder')}
          />
        </label>
        <label className="field">
          <span>{t('setout.hiLabel')}</span>
          <input inputMode="decimal" value={hi} onChange={(e) => setHi(e.target.value)} placeholder="0.000" />
        </label>
      </section>

      {inc?.vertical && (
        <section className="card">
          <label className="field">
            <span>{t('setout.ztLabel')}</span>
            <input inputMode="decimal" value={zt} onChange={(e) => setZt(e.target.value)} placeholder="0.000" />
          </label>
        </section>
      )}

      {inc && !inc.vertical && (
        <section className="card">
          <div className="grid2">
            <label className="field"><span>{t('setout.ztALabel')}</span>
              <input inputMode="decimal" value={ztA} onChange={(e) => setZtA(e.target.value)} placeholder="0.000" /></label>
            <label className="field"><span>{t('setout.ztBLabel')}</span>
              <input inputMode="decimal" value={ztB} onChange={(e) => setZtB(e.target.value)} placeholder="0.000" /></label>
          </div>
        </section>
      )}

      {pile && !ready && <p className="hint">{t('setout.incompleteHint')}</p>}

      {ready && (
        <SetoutSummaryCard pile={pile} inc={inc} stn={stn} bs={bs} hi={hi} setup={setup} bsAzimuth={bsAzimuth} />
      )}

      {inc?.vertical && singleResult && (
        <SetoutResultBlock zt={num(zt)} result={singleResult} />
      )}

      {inc && !inc.vertical && (
        <>
          {resultA && <SetoutResultBlock zt={num(ztA)} result={resultA} />}
          {resultB && <SetoutResultBlock zt={num(ztB)} result={resultB} />}
        </>
      )}
    </div>
  );
}

function SetoutSummaryCard({ pile, inc, stn, bs, hi, setup, bsAzimuth }) {
  const { t } = useTranslation();
  const inclineBadge = inc?.vertical ? t('common.incline.vertBadge') : t('common.incline.battBadge', { ratio: inc.ratio });
  return (
    <section className="card setout-summary">
      <h2 className="card-title">{t('setout.designHeader')}</h2>
      <div className="setout-summary-head">
        <span className="setout-pile-no mono">{pile.pile_no}</span>
        {pile.zone && <span className="setout-zone">{pile.zone}</span>}
        <span className="setout-incline-badge mono">{inclineBadge}</span>
      </div>
      <div className="setout-summary-row4 mono">
        <div><span>{t('setout.designN')}</span>{fmt(pile.coordinate_pn)}</div>
        <div><span>{t('setout.designE')}</span>{fmt(pile.coordinate_pe)}</div>
        <div><span>{t('form.designStripCutoff')}</span>{fmt(pile.pile_top_level)}</div>
        <div><span>{t('setout.diameter')}</span>{pile.dia_mm} mm</div>
      </div>
      <div className="setout-summary-divider" />
      <div className="setout-summary-row6 mono">
        <div><span>{t('setout.stationLabel')}</span>{stn.name}</div>
        <div><span>{t('setout.backsightLabel')}</span>{bs.name}</div>
        <div><span>{t('setout.bsAzimuth')}</span>{toDMS(bsAzimuth)}</div>
        <div><span>{t('setout.hiLabel')}</span>{fmt(num(hi))}</div>
        <div><span>{t('setout.stationElev')}</span>{fmt(stn.elevation)}</div>
        <div><span>{t('setout.instrumentElev')}</span>{fmt(setup.Z_I)}</div>
      </div>
    </section>
  );
}

function SetoutResultBlock({ zt, result }) {
  const { t } = useTranslation();
  return (
    <section className="readout setout-result">
      <div className="setout-result-head">
        <span className="setout-result-title">{t('setout.resultTitle')}</span>
        <span className="setout-zt-pill mono">{t('setout.ztPill')} = {fmt(zt)} m</span>
      </div>
      <PointBlock
        variant="centre"
        label={t('setout.centreLabel')}
        pt={result.centre}
      />
      <PointBlock
        variant="left"
        label={t('setout.leftLabel')}
        pt={result.left}
      />
      <PointBlock
        variant="right"
        label={t('setout.rightLabel')}
        pt={result.right}
      />
    </section>
  );
}

function PointBlock({ variant, label, pt }) {
  const { t } = useTranslation();
  return (
    <div className={`setout-point setout-point-${variant}`}>
      <div className="setout-point-head">
        <span className="setout-point-dot" />
        <span className="setout-point-label">{label}</span>
      </div>
      <div className="setout-point-primary mono">
        <div><span>{t('setout.azLabel')}</span><b>{toDMS(pt.Az)}</b></div>
        <div><span>{t('setout.hdistLabel')}</span><b>{fmt(pt.HD)}</b></div>
        <div><span>{t('setout.zenithLabel')}</span><b>{toDMS(pt.ZA)}</b></div>
      </div>
      <div className="setout-point-secondary mono">
        <div><span>{t('setout.northing')}</span><b>{fmt(pt.N)}</b></div>
        <div><span>{t('setout.easting')}</span><b>{fmt(pt.E)}</b></div>
      </div>
    </div>
  );
}
