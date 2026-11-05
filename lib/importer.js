import * as XLSX from 'xlsx';
import { pool, ensureSchema } from '@/lib/db';

export const MAX_BYTES = 5 * 1024 * 1024;
export const MAX_ROWS = 20000;

// Parses an uploaded .csv / .xlsx / .xls buffer and loads it into `people`.
// mode 'append'  -> add rows that are not already in the list
// mode 'replace' -> first remove everyone who has no attendance record, then add
// mode 'clear'   -> delete the entire list (and all attendance records), then add
export async function importList(buffer, mode) {
  await ensureSchema();
  const wb = XLSX.read(buffer, { type: 'buffer', codepage: 65001 });
  const rows = [];
  for (const sn of wb.SheetNames) rows.push(...XLSX.utils.sheet_to_json(wb.Sheets[sn], { defval: '', raw: false }));
  if (!rows.length) throw new Error('The file has no data rows.');
  if (rows.length > MAX_ROWS) throw new Error(`Too many rows (max ${MAX_ROWS}).`);

  const headers = Object.keys(rows[0]).filter((h) => !/^__EMPTY/.test(h));
  const nameCol = headers.find((h) => /name/i.test(h)) || headers[0];
  if (!nameCol) throw new Error('No columns found. The first row must contain headers.');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let removed = 0;
    if (mode === 'clear') {
      // wipes the whole list; attendance rows go with it (ON DELETE CASCADE)
      removed = (await client.query('DELETE FROM people')).rowCount;
    } else if (mode === 'replace') {
      removed = (await client.query('DELETE FROM people WHERE id NOT IN (SELECT person_id FROM attendance)')).rowCount;
    }
    let added = 0, skipped = 0;
    for (const r of rows) {
      const clean = {};
      for (const [k, v] of Object.entries(r)) {
        const val = String(v).trim();
        if (/^__EMPTY/.test(k) && !val) continue;
        clean[k] = val;
      }
      if (!clean[nameCol]) { skipped++; continue; }
      const dup = await client.query('SELECT 1 FROM people WHERE data = $1::jsonb', [clean]);
      if (dup.rowCount) { skipped++; continue; }
      await client.query('INSERT INTO people (name, data, search_text) VALUES ($1,$2,$3)', [
        clean[nameCol], clean, Object.values(clean).join(' '),
      ]);
      added++;
    }
    await client.query('COMMIT');
    const total = (await client.query('SELECT count(*)::int AS n FROM people')).rows[0].n;
    return { added, skipped, removed, total, nameColumn: nameCol, columns: headers };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
