import { Pool } from 'pg';

const g = globalThis;
export const pool =
  g._pgPool ||
  (g._pgPool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/attendance',
  }));

export const SCHEMA = `
  CREATE TABLE IF NOT EXISTS people (
    id          SERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    data        JSONB NOT NULL,
    search_text TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS attendance (
    id          SERIAL PRIMARY KEY,
    person_id   INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    marked_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    marked_date DATE NOT NULL DEFAULT CURRENT_DATE,
    marked_time TIME NOT NULL DEFAULT CURRENT_TIME,
    ip_address  TEXT,
    user_agent  TEXT,
    snapshot    JSONB NOT NULL,
    UNIQUE (person_id, marked_date)
  );
  ALTER TABLE people ADD COLUMN IF NOT EXISTS added_manually BOOLEAN NOT NULL DEFAULT false;
`;

let ready;
export function ensureSchema() {
  return (ready ||= pool.query(SCHEMA).catch((e) => { ready = null; throw e; }));
}

// Word-start patterns for Postgres regex (~*): "kav" matches "Kavindi" but not "Nikavi".
export const wordTerms = (q) =>
  String(q || '').trim().split(/\s+/).filter(Boolean).slice(0, 6)
    .map((t) => '\\m' + t.slice(0, 50).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

export const likeTerms = (q) =>
  String(q || '').trim().split(/\s+/).filter(Boolean).slice(0, 6).map((t) => `%${t.replace(/[\\%_]/g, '\\$&')}%`);
