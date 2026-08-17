import { put, list } from '@vercel/blob';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PREFIX = 'waitlist/';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      res.status(400).json({ error: 'Invalid email address' });
      return;
    }
    const pathname = `${PREFIX}${encodeURIComponent(email)}.json`;
    await put(pathname, JSON.stringify({ email, at: new Date().toISOString() }), {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
    });
    res.status(200).json({ ok: true });
    return;
  }

  if (req.method === 'GET') {
    const token = req.query.token;
    if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const rows = [];
    let cursor;
    do {
      const page = await list({ prefix: PREFIX, cursor, limit: 1000 });
      for (const blob of page.blobs) {
        const email = decodeURIComponent(
          blob.pathname.slice(PREFIX.length).replace(/\.json$/, '')
        );
        rows.push({ email, at: blob.uploadedAt });
      }
      cursor = page.cursor;
    } while (cursor);

    rows.sort((a, b) => new Date(b.at) - new Date(a.at));
    res.status(200).json({ count: rows.length, entries: rows });
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}
