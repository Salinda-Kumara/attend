import { ADMIN_USER, ADMIN_PASS, COOKIE, MAX_AGE, makeToken, safeEq, sign } from '@/lib/auth';

export async function POST(req) {
  const { username = '', password = '' } = await req.json().catch(() => ({}));
  if (!safeEq(sign(String(username)), sign(ADMIN_USER)) || !safeEq(sign(String(password)), sign(ADMIN_PASS))) {
    return Response.json({ error: 'Invalid credentials' }, { status: 401 });
  }
  const res = Response.json({ ok: true });
  res.headers.append(
    'Set-Cookie',
    `${COOKIE}=${makeToken()}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${MAX_AGE}`
  );
  return res;
}
