import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { localdb } from '../lib/localdb';
import { parseIncline } from '../lib/calculations';
import { computeSetout, toDMS } from '../lib/setoutCalc';
import SearchSelect from '../components/SearchSelect';

const fmt = (v, d = 3) => (v == null || Number.isNaN(v) ? '—' : Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }));
const num = (s) => (s === '' || s == null ? null : Number(s));

const ALL_ZONES = '__all__';

export default function SetOutPage() {
  const { t } = useTranslation();
  const [piles, setPiles] = useState([]);
  const [benchmarks, setBenchmarks] = useState([]);

  const [pileId, setPileId] = useState('');
  const [pileZone, setPileZone] = useState(ALL_ZONES);
  const [stnId, setStnId] = useState('');
  const [bsId, setBsId] = useState('');
  const [hi, setHi] = useState('');
  const [zt, setZt] = useState('');
  const [ztA, setZtA] = useState('');
  const [ztB, setZtB] = useState('');

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
  useEffect(() => {
    setZt(''); setZtA(''); setZtB('');
  }, [pileId]);

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

      {inc?.vertical && singleResult && (
        <SetoutResultBlock title={t('setout.cardResult')} result={singleResult} />
      )}

      {inc && !inc.vertical && (
        <>
          {resultA && <SetoutResultBlock title={t('setout.levelALabel')} result={resultA} />}
          {resultB && <SetoutResultBlock title={t('setout.levelBLabel')} result={resultB} />}
        </>
      )}
    </div>
  );
}

function SetoutResultBlock({ title, result }) {
  const { t } = useTranslation();
  return (
    <section className="readout mono">
      <div className="readout-caption">{title}</div>
      <PointRows label={t('setout.centreLabel')} pt={result.centre} />
      <PointRows label={t('setout.leftLabel')} pt={result.left} />
      <PointRows label={t('setout.rightLabel')} pt={result.right} />
    </section>
  );
}

function PointRows({ label, pt }) {
  const { t } = useTranslation();
  return (
    <>
      <div className="readout-head">{label}</div>
      <div className="readout-grid">
        <div><span>N</span>{fmt(pt.N)}</div>
        <div><span>E</span>{fmt(pt.E)}</div>
        <div><span>{t('setout.azLabel')}</span>{toDMS(pt.Az)}</div>
        <div><span>{t('setout.hdistLabel')}</span>{fmt(pt.HD)}</div>
        <div><span>{t('setout.zenithLabel')}</span>{toDMS(pt.ZA)}</div>
      </div>
    </>
  );
}
