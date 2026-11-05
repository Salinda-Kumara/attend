require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local' });
const XLSX = require('xlsx');
const { Pool } = require('pg');

const file = process.argv[2] || process.env.EXCEL_FILE || '20B List.xlsx';
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/attendance',
});

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS people (
    id SERIAL PRIMARY KEY, name TEXT NOT NULL, data JSONB NOT NULL, search_text TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS attendance (
    id SERIAL PRIMARY KEY,
    person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    marked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    marked_date DATE NOT NULL DEFAULT CURRENT_DATE,
    marked_time TIME NOT NULL DEFAULT CURRENT_TIME,
    ip_address TEXT, user_agent TEXT, snapshot JSONB NOT NULL,
    UNIQUE (person_id, marked_date)
  );`;

(async () => {
  await pool.query(SCHEMA);
  const wb = XLSX.readFile(file);
  const rows = [];
  for (const sn of wb.SheetNames) rows.push(...XLSX.utils.sheet_to_json(wb.Sheets[sn], { defval: '', raw: false }));
  if (!rows.length) throw new Error('No rows found in ' + file);

  const headers = Object.keys(rows[0]);
  const nameCol = headers.find((h) => /name/i.test(h)) || headers[0];
  console.log('Columns:', headers.join(' | '));
  console.log('Using name column:', nameCol);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // keep anyone who already has attendance; replace the rest
    await client.query('DELETE FROM people WHERE id NOT IN (SELECT person_id FROM attendance)');
    let n = 0;
    for (const r of rows) {
      const clean = {};
      for (const [k, v] of Object.entries(r)) {
        const val = String(v).trim();
        if (/^__EMPTY/.test(k) && !val) continue; // unnamed blank column
        clean[k] = val;
      }
      if (!clean[nameCol]) continue;
      const dup = await client.query('SELECT 1 FROM people WHERE data = $1::jsonb', [clean]);
      if (dup.rowCount) continue;
      await client.query('INSERT INTO people (name, data, search_text) VALUES ($1,$2,$3)', [
        clean[nameCol], clean, Object.values(clean).join(' '),
      ]);
      n++;
    }
    await client.query('COMMIT');
    console.log(`Imported ${n} people.`);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
})().catch((e) => { console.error(e); process.exit(1); });
