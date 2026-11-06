import { isStaff, unauthorized } from '@/lib/auth';
import { pool, ensureSchema } from '@/lib/db';

export const dynamic = 'force-dynamic';

const CONTACT = 'Contact Number';

async function getColumns() {
  const { rows } = await pool.query('SELECT data FROM people ORDER BY id LIMIT 1');
  const keys = rows[0] ? Object.keys(rows[0].data) : ['Full Name'];
  // people added by hand also get a contact number
  if (!keys.some((k) => /contact|phone|mobile/i.test(k))) keys.push(CONTACT);
  const nameCol = keys.find((k) => /name/i.test(k)) || keys[0];
  return { columns: keys, nameCol };
}

// Field list for the "add person" form
export async function GET(req) {
  if (!isStaff(req)) return unauthorized();
  await ensureSchema();
  return Response.json(await getColumns());
}

// Add someone who is not in the list (optionally mark them present right away)
export async function POST(req) {
  if (!isStaff(req)) return unauthorized();
  await ensureSchema();
  const body = await req.json().catch(() => ({}));
  const { columns, nameCol } = await getColumns();

  const clean = {};
  for (const c of columns) clean[c] = String((body.data || {})[c] ?? '').trim().replace(/\s+/g, ' ').slice(0, 200);
  if (!clean[nameCol]) return Response.json({ error: 'Name is required.' }, { status: 400 });

  const dup = await pool.query('SELECT id FROM people WHERE data = $1::jsonb', [clean]);
  if (dup.rowCount) return Response.json({ error: 'This person is already in the list.' }, { status: 409 });

  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || null;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const p = await client.query(
      'INSERT INTO people (name, data, search_text, added_manually) VALUES ($1,$2,$3,true) RETURNING id',
      [clean[nameCol], clean, Object.values(clean).join(' ')]
    );
    let marked_at = null;
    if (body.mark) {
      const a = await client.query(
        'INSERT INTO attendance (person_id, ip_address, user_agent, snapshot) VALUES ($1,$2,$3,$4) RETURNING marked_at',
        [p.rows[0].id, ip, req.headers.get('user-agent') || '', clean]
      );
      marked_at = a.rows[0].marked_at;
    }
    await client.query('COMMIT');
    return Response.json({ ok: true, name: clean[nameCol], marked_at });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
