import crypto from 'crypto';

const SECRET = process.env.SESSION_SECRET || 'dev-secret-change-me';
export const ADMIN_USER = process.env.ADMIN_USER || 'admin';
export const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';
export const COOKIE = 'admin';
export const MAX_AGE = 8 * 3600;

export const sign = (v) => crypto.createHmac('sha256', SECRET).update(v).digest('hex');
export const safeEq = (a, b) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

export function makeToken() {
  const exp = String(Date.now() + MAX_AGE * 1000);
  return `${exp}.${sign(exp)}`;
}

export function isAdmin(req) {
  const v = req.cookies.get(COOKIE)?.value;
  if (!v) return false;
  const [exp, sig] = v.split('.');
  return !!sig && Number(exp) > Date.now() && safeEq(sig, sign(exp));
}

export const unauthorized = () => Response.json({ error: 'Unauthorized' }, { status: 401 });
