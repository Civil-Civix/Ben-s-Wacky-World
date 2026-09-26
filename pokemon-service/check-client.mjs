import assert from 'node:assert/strict';
const origin = 'https://bens-pokemon.129-146-183-45.sslip.io';
async function get(path, options) { return fetch(origin + path, {signal:AbortSignal.timeout(30000),...options}); }
const home = await get('/battle.html');
assert.equal(home.status,200);
const html = await home.text();
assert.match(html, /Ben’s Pokémon Battles/);
for (const match of html.matchAll(/<script[^>]+src="([^"]+)"/g)) {
  const resource = new URL(match[1],origin);
  assert.equal(resource.origin,origin,'Client scripts must be self-hosted');
  const response=await get(resource.pathname+resource.search);
  assert.equal(response.status,200,resource.pathname);
  assert.match(response.headers.get('content-type'), /javascript/,resource.pathname);
}
assert.match(home.headers.get('content-security-policy'), /frame-src 'none'/);
for (const file of ['/config/config.js','/js/client-main.js','/data/pokedex.js','/data/teambuilder-tables.js','/sprites/gen5/pikachu.png','/sprites/ani/pikachu.gif','/sprites/pokemonicons-sheet.png','/LICENSE']) {
  const r=await get(file); assert.equal(r.status,200,file); assert.ok((await r.arrayBuffer()).byteLength>50,file);
}
assert.equal((await get('/guest-name')).status,403);
assert.equal((await get('/guest-name',{method:'POST',headers:{Origin:'https://example.com'},body:'act=getassertion'})).status,403);
assert.equal((await get('/guest-name',{method:'POST',headers:{Origin:origin},body:'act=login&pass=not-a-real-password'})).status,400);
assert.equal((await get('/sprites/evil.html')).status,404);
console.log('PASS: local client/data, cached sprites, restrictive browser policy, and rejection of password/cross-origin requests.');
