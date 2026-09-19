import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker,{cleanup,dayAt} from './worker.mjs';
import ids from './game-ids.mjs';
const sql=new DatabaseSync(':memory:');
sql.exec(readFileSync(new URL('schema.sql',import.meta.url),'utf8'));
let statements=0;
const DB={
 prepare(query){
  const stmt=sql.prepare(query);
  return {bind(...args){return {
   async run(){statements++;return {meta:stmt.run(...args)};},
   async all(){statements++;return {results:stmt.all(...args)};}
  };}};
 },
 async batch(items){return Promise.all(items.map(item=>item.run()));}
};
const env={DB,ALLOWED_ORIGIN:'https://civil-civix.github.io',HASH_SECRET:'test-secret-only',
 IP_LIMIT:{limit:async()=>({success:true})},VISITOR_LIMIT:{limit:async()=>({success:true})}};
const ctx={waitUntil:promise=>promise};
const browser=crypto.randomUUID();
const body={gameId:ids[0],visitorId:browser};
function request(path='/play',value=body,options={}) {
 return new Request('https://example.test'+path,{
  method:path==='/popular'?'GET':'POST',
  headers:{Origin:env.ALLOWED_ORIGIN,'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.1',...options.headers},
  ...(path!=='/popular'?{body:JSON.stringify(value)}:{}),...options
 });
}
async function send(req,bindings=env){return worker.fetch(req,bindings,ctx);}
const duplicates=await Promise.all(Array.from({length:8},()=>send(request())));
assert(duplicates.every(r=>r.status===200));
assert.equal(sql.prepare('SELECT plays FROM daily_counts').get().plays,1);
await send(request('/play',{...body,visitorId:crypto.randomUUID()}));
assert.equal(sql.prepare('SELECT plays FROM daily_counts').get().plays,2);
await send(request('/play',{...body,gameId:ids[1]}));
assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM daily_counts').get().n,2);
assert.equal(sql.prepare('SELECT visitor_hash FROM visits LIMIT 1').get().visitor_hash.length,64);
assert.equal((await send(request('/play',{...body,gameId:'invalid-app'}))).status,400);
assert.equal((await send(request('/play',{...body,visitorId:'not-a-uuid'}))).status,400);
assert.equal((await send(new Request('https://example.test/play',{method:'POST',headers:{Origin:'https://evil.test'}}))).status,403);
assert.equal((await send(new Request('https://example.test/play',{method:'OPTIONS',headers:{Origin:env.ALLOWED_ORIGIN}}))).status,204);
assert.equal((await send(request('/play',{...body,padding:'x'.repeat(1025)}))).status,413);
assert.equal((await send(request('/play',body,{body:'{'}))).status,400);
const before=statements;
assert.equal((await send(request(),{...env,IP_LIMIT:{limit:async()=>({success:false})}})).status,429);
assert.equal((await send(request(),{...env,VISITOR_LIMIT:{limit:async()=>({success:false})}})).status,429);
assert.equal(statements,before);
const now=Date.now();
sql.prepare('INSERT INTO daily_counts VALUES (?,?,?)').run(dayAt(now-30*86400000),ids[0],100);
sql.prepare('INSERT INTO daily_counts VALUES (?,?,?)').run(dayAt(now-29*86400000),ids[1],7);
const ranking=await (await send(request('/popular'))).json();
assert.equal(ranking.games[0].id,ids[1]);
assert.equal(ranking.games[0].plays,8);
assert.equal(ranking.games.find(g=>g.id===ids[0]).plays,2);
sql.prepare('INSERT INTO visits VALUES (?,?,?)').run(dayAt(now-2*86400000),ids[2],'old-visitor');
await cleanup(env,now);
assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM visits WHERE day < ?').get(dayAt(now-86400000)).n,0);
assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM daily_counts WHERE day < ?').get(dayAt(now-29*86400000)).n,0);
const unavailable=await send(request('/popular'),{...env,DB:{prepare(){throw new Error('offline');}}});
assert.equal(unavailable.status,503);
sql.close();
console.log('PASS: atomic duplicates, multiple browsers/games, validation, CORS, rate limits, 30-day ranking, retention and outages.');
