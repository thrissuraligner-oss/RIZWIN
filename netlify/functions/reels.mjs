// Netlify Function: GET /api/reels
// The latest Reels of @thealignerproject, read from the Instagram API (Instagram Login). Netlify's CDN caches the
// response for 5 minutes, so a new reel shows on the site within ~5 minutes of posting while Instagram is called
// at most ~12 times an hour.
//
// Setup (once): see README "Instagram reels on the site".
//   Environment variable  IG_TOKEN  long-lived Instagram User access token (instagram_business_basic).
//   Netlify Blobs store   "instagram" (created automatically) holds the auto-refreshed token and the last good feed.
import { getStore } from '@netlify/blobs';

const TTL = 300, REFRESH_EVERY = 7 * 864e5, FIELDS = 'id,caption,media_type,thumbnail_url,permalink,timestamp';

export default async () => {
  const store = getStore('instagram');
  const token = await getToken(store);
  let reels = null;
  if (token) {
    try {
      const r = await fetch(`https://graph.instagram.com/me/media?fields=${FIELDS}&limit=30&access_token=${encodeURIComponent(token)}`);
      if (r.ok) {
        const d = await r.json();
        reels = (d.data || []).filter((m) => m.media_type === 'VIDEO' && /\/reels?\//.test(m.permalink || '')).slice(0, 12).map((m) => ({
          id: m.id, url: m.permalink, date: m.timestamp, thumb: `/api/reels/thumb/${m.id}`,
          caption: (m.caption || '').replace(/#\w+/g, '').replace(/\s+/g, ' ').trim().slice(0, 140),
        }));
        await store.setJSON('feed', reels);
        await Promise.all((d.data || []).filter((m) => m.thumbnail_url).map((m) => store.setJSON('thumb-' + m.id, { url: m.thumbnail_url, at: Date.now() })));
      }
    } catch (e) { /* fall through to the last good feed */ }
  }
  if (!reels) reels = await store.get('feed', { type: 'json' }).catch(() => null);
  const age = reels ? TTL : 60;
  return new Response(JSON.stringify({ reels: reels || [], updated: new Date().toISOString() }), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': `public, max-age=${age}`,
      'netlify-cdn-cache-control': `public, durable, s-maxage=${age}, stale-while-revalidate=3600`,
      'access-control-allow-origin': '*',
    },
  });
};

// Long-lived tokens last 60 days; refresh weekly so the feed never goes dark (the token must be >= 24 h old to refresh).
async function getToken(store) {
  let rec = await store.get('token', { type: 'json' }).catch(() => null);
  const env = Netlify.env.get('IG_TOKEN');
  if (!rec && env) rec = { token: env, at: 0 };
  if (!rec) return null;
  if (Date.now() - rec.at > REFRESH_EVERY) {
    try {
      const r = await fetch(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(rec.token)}`);
      if (r.ok) { const j = await r.json(); if (j.access_token) { rec = { token: j.access_token, at: Date.now() }; await store.setJSON('token', rec); } }
    } catch (e) { /* keep the current token */ }
  }
  return rec.token;
}

export const config = { path: '/api/reels' };
