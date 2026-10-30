// Netlify Function: GET /api/reels/thumb/:id
// Serves a reel's cover image from our own domain (one fast, cached connection; Instagram CDN links are signed and change).
import { getStore } from '@netlify/blobs';

export default async (req, context) => {
  const id = String(context.params.id || '');
  if (!/^\d{5,25}$/.test(id)) return new Response('Not found', { status: 404 });
  const store = getStore('instagram');
  const rec = await store.get('thumb-' + id, { type: 'json' }).catch(() => null);
  let src = rec && Date.now() - rec.at < 864e5 ? rec.url : null;
  if (!src) {
    const t = await store.get('token', { type: 'json' }).catch(() => null), token = t?.token || Netlify.env.get('IG_TOKEN');
    if (!token) return new Response('Not configured', { status: 404 });
    const r = await fetch(`https://graph.instagram.com/${id}?fields=thumbnail_url,media_url,media_type&access_token=${encodeURIComponent(token)}`);
    if (!r.ok) return new Response('Not found', { status: 404 });
    const m = await r.json(); src = m.thumbnail_url || (m.media_type === 'IMAGE' ? m.media_url : null);
    if (!src) return new Response('Not found', { status: 404 });
    await store.setJSON('thumb-' + id, { url: src, at: Date.now() });
  }
  const img = await fetch(src);
  if (!img.ok) { await store.delete('thumb-' + id).catch(() => {}); return new Response('Not found', { status: 404 }); }
  return new Response(img.body, {
    headers: {
      'content-type': img.headers.get('content-type') || 'image/jpeg',
      'cache-control': 'public, max-age=86400',
      'netlify-cdn-cache-control': 'public, durable, s-maxage=86400',
    },
  });
};

export const config = { path: '/api/reels/thumb/:id' };
