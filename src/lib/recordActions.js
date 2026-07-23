import { useTranslation } from 'react-i18next';
import { supabase } from './supabase';

// Same permission rules as the Records table row actions: Edit requires
// ownership + admin/recorder role; Delete requires ownership only. RLS
// enforces this server-side regardless — these just control button visibility.
export function canEditRecord(row, session, role) {
  const mine = !!session && row?.created_by === session.user.id;
  return mine && (role === 'admin' || role === 'recorder');
}

export function canDeleteRecord(row, session) {
  return !!session && row?.created_by === session.user.id;
}

// Shared edit/delete handlers so the Records table and the detail modal
// call the exact same logic instead of duplicating it.
export function useRecordActions({ records, setRecords, onEdit, setToast, stageLabels = {} }) {
  const { t } = useTranslation();

  function handleEdit(id) {
    const full = records.find((r) => r.id === id);
    if (full) onEdit?.(full);
  }

  async function handleDelete(row) {
    const label = `${row.pile_no} (${stageLabels[row.pile_stage] ?? row.pile_stage})`;
    if (!window.confirm(t('records.confirmDelete', { label }))) return false;
    const { error } = await supabase.from('asbuilt_records').delete().eq('id', row.id);
    if (error) { setToast({ type: 'err', msg: error.message }); setTimeout(() => setToast(null), 4000); return false; }
    setRecords((rs) => rs.filter((r) => r.id !== row.id));
    return true;
  }

  return { handleEdit, handleDelete };
}
