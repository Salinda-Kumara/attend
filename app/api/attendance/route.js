import { isStaff, unauthorized } from '@/lib/auth';
import { pool, ensureSchema } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  if (!isStaff(req)) return unauthorized();
  await ensureSchema();
  const body = await req.json().catch(() => ({}));
  const id = parseInt(body.personId, 10);
  if (!id) return Response.json({ error: 'personId required' }, { status: 400 });

  const p = await pool.query('SELECT id, name, data FROM people WHERE id = $1', [id]);
  if (!p.rowCount) return Response.json({ error: 'Person not found' }, { status: 404 });

  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || null;
  const r = await pool.query(
    `INSERT INTO attendance (person_id, ip_address, user_agent, snapshot)
     VALUES ($1,$2,$3,$4) ON CONFLICT (person_id, marked_date) DO NOTHING
     RETURNING marked_at`,
    [id, ip, req.headers.get('user-agent') || '', p.rows[0].data]
  );
  if (!r.rowCount) {
    const ex = await pool.query('SELECT marked_at FROM attendance WHERE person_id=$1 AND marked_date=CURRENT_DATE', [id]);
    return Response.json({ error: 'Already marked today', marked_at: ex.rows[0]?.marked_at, name: p.rows[0].name }, { status: 409 });
  }
  return Response.json({ ok: true, name: p.rows[0].name, marked_at: r.rows[0].marked_at });
}
