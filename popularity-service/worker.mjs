import gameIds from './game-ids.mjs';
const allowedGames = new Set(gameIds);
const encoder = new TextEncoder();
const DAY = 86400000;
export function dayAt(time = Date.now()) { return new Date(time).toISOString().slice(0, 10); }
function json(value, status = 200, extra = {}) {
  return Response.json(value, {status, headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra}});
}
async function hash(secret, value) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
  const bytes = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return Array.from(new Uint8Array(bytes), n => n.toString(16).padStart(2,'0')).join('');
}
async function readBody(request) {
  if (Number(request.headers.get('Content-Length')) > 1024) throw new Error('large');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('invalid');
  const chunks = []; let size = 0;
  try {
    while (true) {
      const {done,value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1024) { await reader.cancel(); throw new Error('large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk,offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder().decode(bytes));
}
export async function cleanup(env, now = Date.now()) {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM visits WHERE day < ?').bind(dayAt(now - DAY)),
    env.DB.prepare('DELETE FROM daily_counts WHERE day < ?').bind(dayAt(now - 29 * DAY))
  ]);
}
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const isRead = url.pathname === '/popular';
    const cors = isRead ? {'Access-Control-Allow-Origin':'*'} :
      request.headers.get('Origin') === env.ALLOWED_ORIGIN ?
      {'Access-Control-Allow-Origin':env.ALLOWED_ORIGIN,'Vary':'Origin'} : {};
    if (!isRead && url.pathname !== '/play') return json({error:'Not found'},404);
    if (!isRead && !cors['Access-Control-Allow-Origin']) return json({error:'Origin not allowed'},403);
    if (request.method === 'OPTIONS') return new Response(null,{status:204,headers:{...cors,
      'Access-Control-Allow-Methods':isRead?'GET, OPTIONS':'POST, OPTIONS',
      'Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'86400'}});
    if (request.method !== (isRead ? 'GET' : 'POST')) return json({error:'Method not allowed'},405,{...cors,Allow:isRead?'GET':'POST'});
    try {
      const now = Date.now(), today = dayAt(now);
      const ip = request.headers.get('CF-Connecting-IP');
      if (!ip) return json({error:'Client address unavailable'},400,cors);
      const ipKey = await hash(env.HASH_SECRET, today + ':ip:' + ip);
      const ipLimit = await env.IP_LIMIT.limit({key:(isRead?'read:':'write:') + ipKey});
      if (!ipLimit.success) return json({error:'Please try later'},429,{...cors,'Retry-After':'60'});
      if (isRead) {
        // Canonical key ignores query strings to prevent cache-busting database reads.
        const cacheKey = new Request(url.origin + '/popular?day=' + today);
        const cache = globalThis.caches?.default;
        const cached = cache && await cache.match(cacheKey);
        if (cached) return cached;
        const since = dayAt(now - 29 * DAY);
        const {results} = await env.DB.prepare(
          'SELECT game_id AS id, SUM(plays) AS plays FROM daily_counts WHERE day >= ? AND day <= ? GROUP BY game_id ORDER BY plays DESC, game_id ASC'
        ).bind(since,today).all();
        const response = json({windowDays:30,since,updatedAt:new Date(now).toISOString(),
          games:results.filter(row=>allowedGames.has(row.id))},200,{...cors,'Cache-Control':'public, max-age=60'});
        if (cache) ctx.waitUntil(cache.put(cacheKey,response.clone()).catch(()=>{}));
        return response;
      }
      if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json')
        return json({error:'JSON required'},415,cors);
      let body;
      try { body = await readBody(request); }
      catch (error) { return json({error:'Invalid request body'},error.message==='large'?413:400,cors); }
      if (!body || !allowedGames.has(body.gameId) ||
          typeof body.visitorId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.visitorId))
        return json({error:'Invalid game or browser ID'},400,cors);
      const visitor = await hash(env.HASH_SECRET,today + ':visitor:' + body.visitorId);
      const visitorLimit = await env.VISITOR_LIMIT.limit({key:visitor});
      if (!visitorLimit.success) return json({error:'Please try later'},429,{...cors,'Retry-After':'60'});
      // The primary key and insert trigger make duplicate/concurrent requests atomic.
      await env.DB.prepare('INSERT OR IGNORE INTO visits(day, game_id, visitor_hash) VALUES (?, ?, ?)')
        .bind(today,body.gameId,visitor).run();
      return json({ok:true},200,cors);
    } catch (_) {
      console.error(JSON.stringify({event:'popularity_unavailable',route:url.pathname}));
      return json({error:'Popularity temporarily unavailable'},503,cors);
    }
  },
  async scheduled(_controller, env) { await cleanup(env); }
};
