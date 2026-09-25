// Fixed-origin asset cache and guest assertions only. No account passwords/cookies.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
const origin = 'https://bens-pokemon.129-146-183-45.sslip.io';
const cache = process.env.BWW_CACHE || '/var/cache/bww-client';
const types = {'.png':'image/png','.gif':'image/gif','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.mp3':'audio/mpeg','.ogg':'audio/ogg','.js':'text/javascript','.css':'text/css','.woff':'font/woff','.woff2':'font/woff2','.ico':'image/x-icon'};
await fs.mkdir(cache, {recursive:true});
let used = 0, downloads = 0;
for (const file of await fs.readdir(cache)) used += (await fs.stat(path.join(cache, file))).size;
const inflight = new Map(), rate = new Map();
setInterval(() => rate.clear(), 60000).unref();
function reply(res, status, text, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, {'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}).end(text);
}
async function limitedBody(stream, limit) {
  const chunks = []; let size = 0;
  for await (const chunk of stream) { size += chunk.length; if (size > limit) throw new Error('Body too large'); chunks.push(Buffer.from(chunk)); }
  return Buffer.concat(chunks);
}
async function asset(urlPath) {
  const key = crypto.createHash('sha256').update(urlPath).digest('hex');
  const filename = path.join(cache, key);
  try { return await fs.readFile(filename); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  if (inflight.has(key)) return inflight.get(key);
  if (downloads >= 8) throw new Error('Asset service busy');
  const job = (async () => {
    downloads++;
    try {
      const upstream = await fetch('https://play.pokemonshowdown.com' + urlPath, {redirect:'error', signal:AbortSignal.timeout(20000)});
      if (!upstream.ok) throw new Error('Asset unavailable');
      const body = await limitedBody(upstream.body, 8 * 1024 * 1024);
      if (used + body.length > 512 * 1024 * 1024) throw new Error('Asset cache full');
      used += body.length;
      await fs.writeFile(filename, body);
      return body;
    } finally { downloads--; inflight.delete(key); }
  })();
  inflight.set(key, job); return job;
}
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, origin);
    if (url.pathname === '/guest-name') {
      res.on('finish', () => console.info('Guest endpoint HTTP', res.statusCode));
      if (req.method !== 'POST' || req.headers.origin !== origin) return reply(res,403,'Forbidden');
      const ip = req.headers['x-real-ip'] || req.socket.remoteAddress;
      const count = (rate.get(ip) || 0) + 1; rate.set(ip, count);
      const total = (rate.get('*') || 0) + 1; rate.set('*', total);
      if (count > 30 || total > 120) return reply(res,429,';;Please wait a minute and reconnect.');
      const data = new URLSearchParams((await limitedBody(req,4096)).toString());
      console.info('Guest request shape', data.get('act'), [...data.keys()].join(','), (data.get('userid') || '').length, (data.get('challstr') || '').length);
      if (data.get('act') === 'upkeep') return reply(res,200,']{"loggedin":false}');
      if (data.get('act') !== 'getassertion' || [...data.keys()].some(k => !['act','userid','challstr'].includes(k))) return reply(res,400,';;Only temporary player names are supported.');
      if (!/^[a-z0-9]{1,18}$/.test(data.get('userid') || '') || !/^\d+\|[a-f0-9]{128,512}$/i.test(data.get('challstr') || '')) return reply(res,400,';;Invalid player request.');
      const upstream = await fetch('https://play.pokemonshowdown.com/action.php', {method:'POST',body:data,redirect:'error',signal:AbortSignal.timeout(10000)});
      if (!upstream.ok) throw new Error('Name service unavailable');
      const assertion = (await limitedBody(upstream.body,4096)).toString();
      return reply(res,200,assertion.startsWith(';') ? ';;That name is reserved. Please choose another guest name.' : assertion);
    }
    if (!['GET','HEAD'].includes(req.method)) return reply(res,405,'Method not allowed');
    // No URL parameters, traversal, HTML, arbitrary hosts, or account endpoints.
    const pathname = decodeURIComponent(url.pathname);
    if (!/^\/(sprites|audio|fx|data)\/[a-zA-Z0-9_./-]+$/.test(pathname) || pathname.includes('..') || !types[path.extname(pathname)]) return reply(res,404,'Not found');
    const body = await asset(pathname);
    res.writeHead(200,{'Content-Type':types[path.extname(pathname)],'Content-Length':body.length,'Cache-Control':'public, max-age=86400','X-Content-Type-Options':'nosniff'});
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch { reply(res,502,'Service temporarily unavailable. Please retry.'); }
});
server.requestTimeout = 15000;
server.headersTimeout = 10000;
server.listen(8001,'127.0.0.1');
