import { pool, ensureSchema } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  await ensureSchema();
  const { rows } = await pool.query(
    `SELECT (SELECT count(*)::int FROM people) AS total,
            (SELECT count(*)::int FROM attendance WHERE marked_date = CURRENT_DATE) AS present`
  );
  return Response.json(rows[0]);
}
