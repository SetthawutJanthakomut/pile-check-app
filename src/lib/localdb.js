import Dexie from 'dexie';

export const localdb = new Dexie('pile-check-cache');
localdb.version(1).stores({
  piles: 'id',
  benchmarks: 'id',
  settings: 'key',
});

export async function replaceAll(table, rows) {
  await localdb.transaction('rw', table, async () => {
    await table.clear();
    if (rows.length) await table.bulkAdd(rows);
  });
}
