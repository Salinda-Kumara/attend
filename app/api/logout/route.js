import { COOKIE, STAFF_COOKIE } from '@/lib/auth';

export async function POST() {
  const res = Response.json({ ok: true });
  for (const c of [STAFF_COOKIE, COOKIE]) res.headers.append('Set-Cookie', `${c}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);
  return res;
}
