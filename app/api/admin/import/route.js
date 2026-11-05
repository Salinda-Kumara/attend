import { isAdmin, unauthorized } from '@/lib/auth';
import { importList, MAX_BYTES } from '@/lib/importer';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  if (!isAdmin(req)) return unauthorized();
  try {
    const form = await req.formData();
    const file = form.get('file');
    const m = form.get('mode');
    const mode = m === 'clear' || m === 'replace' ? m : 'append';
    if (!file || typeof file === 'string') return Response.json({ error: 'Choose a file to import.' }, { status: 400 });
    if (!/\.(csv|xlsx|xls)$/i.test(file.name)) return Response.json({ error: 'Only .csv, .xlsx or .xls files are supported.' }, { status: 400 });
    if (file.size > MAX_BYTES) return Response.json({ error: 'File is too large (max 5 MB).' }, { status: 400 });
    const result = await importList(Buffer.from(await file.arrayBuffer()), mode);
    return Response.json({ ok: true, ...result });
  } catch (e) {
    return Response.json({ error: e.message || 'Import failed.' }, { status: 400 });
  }
}
