import crypto from 'crypto';

const SECRET = process.env.SESSION_SECRET || 'dev-secret-change-me';
export const ADMIN_USER = process.env.ADMIN_USER || 'admin';
export const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';
// Staff (marking) login. Falls back to the admin credentials when STAFF_* are not set.
export const STAFF_USER = process.env.STAFF_USER || ADMIN_USER;
export const STAFF_PASS = process.env.STAFF_PASS || ADMIN_PASS;
export const COOKIE = 'admin';
export const STAFF_COOKIE = 'staff';
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

const valid = (v) => {
  if (!v) return false;
  const [exp, sig] = v.split('.');
  return !!sig && Number(exp) > Date.now() && safeEq(sig, sign(exp));
};

export const isAdmin = (req) => valid(req.cookies.get(COOKIE)?.value);
// Staff can mark attendance; admins can too.
export const isStaff = (req) => isAdmin(req) || valid(req.cookies.get(STAFF_COOKIE)?.value);
export const credsMatch = (u, p, user, pass) =>
  safeEq(sign(String(u)), sign(user)) && safeEq(sign(String(p)), sign(pass));

export const unauthorized = () => Response.json({ error: 'Unauthorized' }, { status: 401 });
