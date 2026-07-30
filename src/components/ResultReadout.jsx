import { useTranslation } from 'react-i18next';
import { fmt, num } from '../lib/format';
import { posCheckFor } from '../lib/calculations';
import { DIR_KEY, CHECK_KEY, MARGIN_KEY, SEABED_DIFF_KEY, SEABED_SOURCE_KEY } from '../lib/statusLabels';
import DeviationPlanView from './DeviationPlanView';

const STAGE_LABEL_KEY = {
  before: 'result.stageBefore',
  after: 'result.stageAfter',
};

// Read-only as-built summary panel. Shared by the live Form and the Records detail view.
// `tol` and `inc` are optional — when omitted, the tolerance/design-slope hints are left out.
// `stage` and `note` are optional — when omitted, the stage/note block is left out.
export default function ResultReadout({ results, p1El, tol, inc, stage, note }) {
  const { t } = useTranslation();
  // Re-evaluate against the LIVE tolerance rather than trusting the cached
  // results.posCheck, which reflects whatever tolerance was set at save time.
  // Falls back to the cached verdict when no tolerance is loaded (tol omitted).
  const posCheck = tol ? posCheckFor(results.totalDev, tol.positionM) : results.posCheck;
  // Translates a raw calculations.js status string via its key map, falling
  // back to the raw value itself when unmapped (e.g. null).
  const st = (v, map) => (map[v] ? t(map[v]) : v);
  // The total/tol caption is one authored string with an optional " / tol …" clause;
  // when tol is omitted, interpolate it empty and drop everything from the separator on.
  const totalTolFull = t('result.totalTolCaption', { dev: fmt(results.totalDev), tol: tol ? tol.positionM : '' });
  const totalTolText = tol ? totalTolFull : totalTolFull.split(' / ')[0];
  return (
    <section className="readout mono">
      {(stage || note) && (
        <div className="readout-notes">
          {stage && <div className="stage-tag">{STAGE_LABEL_KEY[stage] ? t(STAGE_LABEL_KEY[stage]) : stage}</div>}
          {note && <div className="note-text">{note}</div>}
        </div>
      )}
      <div className="readout-caption">{new Date().toLocaleString()}</div>
      <div className="readout-head">{t('result.asbuiltHeader', { el: fmt(results.asbuiltEl) })}</div>
      <div className="readout-grid">
        <div><span>N</span>{fmt(results.asbuiltN)}</div>
        <div><span>E</span>{fmt(results.asbuiltE)}</div>
      </div>
      <div className="readout-grid">
        <div><span>{t('result.diffN')}</span>{fmt(results.diffN)} <b>{st(results.dirN, DIR_KEY)}</b></div>
        <div><span>{t('result.diffE')}</span>{fmt(results.diffE)} <b>{st(results.dirE, DIR_KEY)}</b></div>
      </div>
      <div className="verdict-row">
        <div className={`stamp big ${posCheck === 'OK' ? 'pass' : 'fail'}`}>
          {st(posCheck, CHECK_KEY)}
          <small>{totalTolText}</small>
        </div>
        <div className={`stamp ${results.slopeCheck === 'OK' ? 'pass' : 'fail'}`}>
          {t('result.slopeStamp', { check: st(results.slopeCheck, CHECK_KEY) })}
          <small>{inc ? t('result.slopeVs', { ratio: fmt(results.slope, 2), designRatio: inc.vertical ? t('common.incline.vertBadge') : `1:${inc.ratio}` }) : `1:${fmt(results.slope, 2)}`}</small>
        </div>
        {results.p3Check && (
          <div className={`stamp ${results.p3Check === 'OK' ? 'pass' : 'fail'}`}>
            {t('result.p3Stamp', { check: st(results.p3Check, CHECK_KEY) })}
            <small>{t('result.p3Res', { residual: fmt(results.residual, 4) })}</small>
          </div>
        )}
      </div>

      <div className="plan-view">
        <DeviationPlanView
          diffN={results.diffN}
          diffE={results.diffE}
          totalDev={results.totalDev}
          tolerance={tol?.positionM}
          posCheck={posCheck}
        />
      </div>

      <details className="more">
        <summary>{t('result.moreSummary')}</summary>
        <div className="readout-head">{t('result.asbuiltPileTopCenter')}</div>
        <div className="readout-grid">
          <div><span>N</span>{fmt(results.centerN)}</div>
          <div><span>E</span>{fmt(results.centerE)}</div>
          <div><span>{t('result.elLabel')}</span>{fmt(num(p1El))}</div>
        </div>
        <div className="readout-grid">
          <div><span>{t('records.col.toeN')}</span>{fmt(results.toeN)}</div>
          <div><span>{t('records.col.toeE')}</span>{fmt(results.toeE)}</div>
          <div><span>{t('records.col.toeZ')}</span>{fmt(results.toeZ)}</div>
        </div>
        {results.toeZDiff != null && (
          <div className="readout-grid">
            <div><span>{t('result.toeZDiff')}</span>{fmt(results.toeZDiff)} <b>{st(results.toeZCheck, CHECK_KEY)}</b></div>
          </div>
        )}
        {results.toeDiffN != null && (
          <div className="readout-grid">
            <div><span>{t('result.toeDiffN')}</span>{fmt(results.toeDiffN)} <b>{st(results.toeDirN, DIR_KEY)}</b></div>
            <div><span>{t('result.toeDiffE')}</span>{fmt(results.toeDiffE)} <b>{st(results.toeDirE, DIR_KEY)}</b></div>
            <div><span>{t('result.toeTotal')}</span>{fmt(results.toeTotalDev)}</div>
          </div>
        )}
        <div className="readout-grid">
          <div><span>{t('result.batterAz')}</span>{fmt(results.asbuiltBatterAz)}°</div>
          <div><span>{t('result.designLabel')}</span>{results.designBatterAz == null ? t('result.vertPlaceholder') : `${fmt(results.designBatterAz)}°`}</div>
          <div><span>{t('result.diffAz')}</span>{results.diffBatterAz == null ? '—' : `${fmt(results.diffBatterAz)}°`}</div>
        </div>
        {results.coatingBottomEl != null && (
          <div className="readout-grid">
            <div><span>{t('result.coatBottom')}</span>{fmt(results.coatingBottomEl)}</div>
            <div><span>{t('result.seabedSource', { source: st(results.seabedSource, SEABED_SOURCE_KEY) })}</span>{fmt(results.seabedUsed)}</div>
            <div>
              <span>{t('result.margin')}</span>{fmt(results.marginToSeabed)} <b>{st(results.marginLabel, MARGIN_KEY)}</b>
              {results.coatingCheck && (
                <span className={`stamp ${results.coatingCheck === 'OK' ? 'pass' : 'fail'}`}>
                  {st(results.coatingCheck, CHECK_KEY)}
                </span>
              )}
            </div>
          </div>
        )}
        {results.seabedDiff != null && (
          <div className="readout-grid">
            <div><span>{t('result.seabedDiff')}</span>{fmt(results.seabedDiff)} <b>{st(results.seabedDiffLabel, SEABED_DIFF_KEY)}</b></div>
          </div>
        )}
      </details>
    </section>
  );
}
