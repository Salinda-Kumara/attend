import { pool, ensureSchema, likeTerms } from '@/lib/db';
import { isAdmin, unauthorized } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  if (!isAdmin(req)) return unauthorized();
  await ensureSchema();
  const sp = req.nextUrl.searchParams;
  const params = [];
  const conds = [];
  if (sp.get('date')) { params.push(sp.get('date')); conds.push(`a.marked_date = $${params.length}`); }
  for (const t of likeTerms(sp.get('q'))) {
    params.push(t);
    conds.push(`(p.search_text ILIKE $${params.length})`);
  }
  const { rows } = await pool.query(
    `SELECT a.id, p.name, a.snapshot AS data, to_char(a.marked_date,'YYYY-MM-DD') AS marked_date,
            a.marked_at, a.ip_address, p.added_manually AS manual
     FROM attendance a JOIN people p ON p.id = a.person_id
     ${conds.length ? 'WHERE ' + conds.join(' AND ') : ''}
     ORDER BY a.marked_at DESC LIMIT 5000`,
    params
  );
  const total = await pool.query('SELECT count(*)::int AS n FROM people');
  return Response.json({ rows, totalPeople: total.rows[0].n });
}
