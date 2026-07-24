import { useTranslation } from 'react-i18next';
import { fmt } from '../lib/format';

// Fixed hex values (not CSS vars) so this renders identically in the app (index.css),
// the print window, and the html-to-image export — none of which are guaranteed to
// share a stylesheet. Matches --pass/--fail/--lcd-dim/--muted across index.css and report.css.
const PASS_COLOR = '#2b8a3e';
const FAIL_COLOR = '#c92a2a';
const AXIS_COLOR = '#9fb3c8';
const MUTED_COLOR = '#46586b';

// Deviation sketch, scaled to the pile's allowable position tolerance (not to the
// deviation itself) so a 5mm miss and a 200mm miss don't render identically.
// Single source of truth for the Modal (ResultReadout), the PDF report, and the
// PNG export — all three import this component so the drawing and the caption
// text can never drift apart.
// `tolerance` is optional — when omitted (RecordDetailModal's quick view has no
// tolerance settings loaded), the ring and the "/ tol" caption suffix are left out.
export default function DeviationPlanView({ diffN, diffE, totalDev, tolerance, posCheck, className = '' }) {
  const { t } = useTranslation();
  const azimuth = Math.round((Math.atan2(diffE, diffN) * (180 / Math.PI) + 360) % 360);
  const maxView = Math.max(tolerance ?? totalDev, totalDev, 0.02) * 1.4;
  const x = diffE;
  const y = -diffN;
  const color = posCheck === 'OK' ? PASS_COLOR : FAIL_COLOR;
  const labelAnchor = x >= 0 ? 'start' : 'end';
  const labelDx = x >= 0 ? maxView * 0.07 : -maxView * 0.07;
  const labelDy = y <= 0 ? -maxView * 0.06 : maxView * 0.12;
  const fontSize = maxView * 0.09;

  return (
    <div className={className}>
      <div style={{ fontSize: '8px', letterSpacing: '0.08em', textTransform: 'uppercase', color: MUTED_COLOR, textAlign: 'center', marginBottom: '4px' }}>
        {t('common.deviationPlan.caption')}
      </div>
      <svg
        viewBox={`${-maxView} ${-maxView} ${maxView * 2} ${maxView * 2}`}
        style={{ display: 'block', width: '100%', maxWidth: '220px', height: 'auto', margin: '0 auto' }}
        role="img"
        aria-label={t('common.deviationPlan.ariaLabel')}
      >
        <line x1="0" y1={-maxView} x2="0" y2={maxView} stroke={AXIS_COLOR} strokeWidth={maxView * 0.012} strokeDasharray={`${maxView * 0.04} ${maxView * 0.04}`} />
        <line x1={-maxView} y1="0" x2={maxView} y2="0" stroke={AXIS_COLOR} strokeWidth={maxView * 0.012} strokeDasharray={`${maxView * 0.04} ${maxView * 0.04}`} />
        <text x="0" y={-maxView * 0.88} textAnchor="middle" fontSize={fontSize} fill={MUTED_COLOR}>{t('common.deviationPlan.northLabel')}</text>
        {tolerance != null && (
          <circle cx="0" cy="0" r={tolerance} fill="none" stroke={AXIS_COLOR} strokeWidth={maxView * 0.02} strokeDasharray={`${maxView * 0.05} ${maxView * 0.05}`} />
        )}
        <circle cx="0" cy="0" r={maxView * 0.05} fill="none" stroke={PASS_COLOR} strokeWidth={maxView * 0.03} />
        <line x1={-maxView * 0.09} y1="0" x2={maxView * 0.09} y2="0" stroke={PASS_COLOR} strokeWidth={maxView * 0.03} />
        <line x1="0" y1={-maxView * 0.09} x2="0" y2={maxView * 0.09} stroke={PASS_COLOR} strokeWidth={maxView * 0.03} />
        <text x={-maxView * 0.55} y={maxView * 0.25} fontSize={fontSize} fill={PASS_COLOR}>{t('common.deviationPlan.designCenter')}</text>
        <line x1="0" y1="0" x2={x} y2={y} stroke={color} strokeWidth={maxView * 0.035} />
        <circle cx={x} cy={y} r={maxView * 0.06} fill={color} />
        <text x={x + labelDx} y={y + labelDy} fontSize={fontSize} fill={color} textAnchor={labelAnchor}>{t('common.deviationPlan.asBuilt')}</text>
      </svg>
      <div style={{ fontSize: '8px', color: MUTED_COLOR, fontFamily: "'IBM Plex Mono', monospace", textAlign: 'center', marginTop: '4px' }}>
        {tolerance != null
          ? t('common.deviationPlan.devCaption', { dev: fmt(totalDev), az: azimuth, tol: fmt(tolerance, 3) })
          : t('common.deviationPlan.devCaption', { dev: fmt(totalDev), az: azimuth, tol: '' }).split(' / ')[0]}
      </div>
    </div>
  );
}
