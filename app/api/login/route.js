import { ADMIN_USER, ADMIN_PASS, STAFF_USER, STAFF_PASS, COOKIE, STAFF_COOKIE, MAX_AGE, makeToken, credsMatch } from '@/lib/auth';

export async function POST(req) {
  const { username = '', password = '' } = await req.json().catch(() => ({}));
  const asAdmin = credsMatch(username, password, ADMIN_USER, ADMIN_PASS);
  const asStaff = credsMatch(username, password, STAFF_USER, STAFF_PASS);
  if (!asAdmin && !asStaff) return Response.json({ error: 'Invalid credentials' }, { status: 401 });
  const res = Response.json({ ok: true });
  const attrs = `HttpOnly; SameSite=Strict; Path=/; Max-Age=${MAX_AGE}`;
  res.headers.append('Set-Cookie', `${STAFF_COOKIE}=${makeToken()}; ${attrs}`);
  if (asAdmin) res.headers.append('Set-Cookie', `${COOKIE}=${makeToken()}; ${attrs}`); // admin page too
  return res;
}
