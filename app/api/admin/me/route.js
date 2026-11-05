import { isAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  return Response.json({ admin: isAdmin(req) });
}
