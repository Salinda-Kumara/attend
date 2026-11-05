import { pool, ensureSchema, likeTerms } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  await ensureSchema();
  const params = likeTerms(req.nextUrl.searchParams.get('q'));
  if (!params.length) return Response.json([]);
  const where = params.map((_, i) => `p.search_text ILIKE $${i + 1}`).join(' AND ');
  const { rows } = await pool.query(
    `SELECT p.id, p.name, p.data,
            (SELECT marked_at FROM attendance a WHERE a.person_id = p.id AND a.marked_date = CURRENT_DATE) AS marked_at
     FROM people p WHERE ${where} ORDER BY p.name LIMIT 30`,
    params
  );
  return Response.json(rows);
}
