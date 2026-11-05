import { pool } from '@/lib/db';
import { isAdmin, unauthorized } from '@/lib/auth';

export async function DELETE(req, { params }) {
  if (!isAdmin(req)) return unauthorized();
  const { id } = await params;
  await pool.query('DELETE FROM attendance WHERE id = $1', [parseInt(id, 10)]);
  return Response.json({ ok: true });
}
