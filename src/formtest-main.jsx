import React from 'react';
import ReactDOM from 'react-dom/client';
import FormPage from './pages/FormPage';
import { localdb } from './lib/localdb';
import './index.css';

async function seed() {
  await localdb.piles.clear();
  await localdb.benchmarks.clear();
  await localdb.piles.add({
    id: 'pile-1', pile_no: 'P-001', zone: 'A', incline: 'VERT.',
    coordinate_pn: 1000, coordinate_pe: 2000, pile_top_level: 3.5,
    dia_mm: 800, batter_bearing_deg: null, length_m: 30, coating_length_m: 25,
    sea_bed_level: -15, toe_pn: 1000, toe_pe: 2000, pile_toe_level: -26.5,
  });
  await localdb.benchmarks.add({
    id: 'bm-1', name: 'STN-1', type: 'STN', northing: 990, easting: 1990, active: true,
  });
}

seed().then(() => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <div className="page-toolbar"><h1>FormPage test harness (role=admin)</h1></div>
      <FormPage
        session={{ user: { email: 'test@test.com' } }}
        role="admin"
        active={true}
        editRecord={null}
        onCancelEdit={() => {}}
        onEditSaved={() => {}}
      />
    </React.StrictMode>,
  );
});
