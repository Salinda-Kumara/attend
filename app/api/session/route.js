import { isStaff } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  return Response.json({ ok: isStaff(req) });
}
