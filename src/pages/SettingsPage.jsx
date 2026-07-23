import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import DataTable from '../components/DataTable';

const LABEL_KEY = {
  tol_position_m: 'settings.tolPosition',
  tol_tilt_deg: 'settings.tolTilt',
  tol_residual_m: 'settings.tolResidual',
  tol_bs_m: 'settings.tolBs',
  tol_coating_embed_m: 'settings.tolCoatingEmbed',
  tol_cross_check_m: 'settings.tolCrossCheck',
};

function getColumns(t) {
  return [
    { key: 'label', label: t('settings.col.setting'), type: 'readonly', width: 260, render: (_v, row) => (LABEL_KEY[row.key] ? t(LABEL_KEY[row.key]) : row.key) },
    { key: 'value', label: t('settings.col.value'), type: 'number', decimals: 4, width: 110 },
    { key: 'description', label: t('settings.col.description'), type: 'readonly' },
  ];
}

export default function SettingsPage() {
  const { t } = useTranslation();
  const columns = useMemo(() => getColumns(t), [t]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('project_settings').select('*').order('key');
      if (error) setToast({ type: 'err', msg: error.message });
      setRows((data ?? []).map((r) => ({ id: r.key, ...r })));
      setLoading(false);
    })();
  }, []);

  async function handleSave(rowId, key, value) {
    const { error } = await supabase.from('project_settings').update({ [key]: value }).eq('key', rowId);
    if (error) throw new Error(error.message);
    setRows((rs) => rs.map((r) => (r.id === rowId ? { ...r, [key]: value } : r)));
  }

  return (
    <div className="page-wide">
      <div className="page-toolbar">
        <h1>{t('settings.pageTitle')}</h1>
      </div>
      {loading ? <p className="hint">{t('settings.loadingLabel')}</p> : (
        <DataTable columns={columns} rows={rows} onSave={handleSave} />
      )}
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
