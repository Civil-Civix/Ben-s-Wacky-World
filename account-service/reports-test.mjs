import {createHmac} from 'node:crypto';
import tracks from './poly-tracks.mjs';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker,{digest} from './worker.mjs';
const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('./schema.sql',import.meta.url),'utf8'));
db.exec(readFileSync(new URL('./ai-schema.sql',import.meta.url),'utf8'));
const DB={
 prepare(sql){const wrapper={bind(...args){
  args=args.map(a=>a instanceof ArrayBuffer?new Uint8Array(a):a);
  return {
   async first(){return db.prepare(sql).get(...args)||null;},
   async all(){return {results:db.prepare(sql).all(...args)};},
   async run(){return {meta:db.prepare(sql).run(...args)};}
  };
 }};wrapper.all=()=>wrapper.bind().all();return wrapper;},
 async batch(items){return Promise.all(items.map(s=>s.run()));}
};
const yes={limit:async()=>({success:true})},env={DB,PASSWORD_PEPPER:'test-only-pepper',ALLOWED_ORIGIN:'https://civil-civix.github.io',REQUEST_LIMIT:yes,AUTH_LIMIT:yes,LOGIN_LIMIT:yes};
let cookie='';
async function req(path,method='GET',data,extra={},bindings=env){
 const response=await worker.fetch(new Request('https://accounts.test'+path,{method,headers:{Origin:env.ALLOWED_ORIGIN,'X-Wacky-Client':'1',Cookie:cookie,'Content-Type':'application/json',...extra},...(data!==undefined?{body:JSON.stringify(data)}:{})}),bindings);
 return {status:response.status,data:await response.json(),cookie:response.headers.get('Set-Cookie')};
}


db.exec(readFileSync(new URL('./reports-schema.sql',import.meta.url),'utf8'));
assert.equal((await req('/game-reports','POST',{})).status,401);
const signed=await req('/signup','POST',{username:'reporter',password:'test-password',noRecovery:true});cookie=signed.cookie;
const payload={gameId:'slope',kind:'loading',note:'Blank screen <script>test</script>'};
assert.equal((await req('/game-reports','POST',{...payload,gameId:'missing'})).status,400);
assert.equal((await req('/game-reports','POST',{...payload,note:'x'.repeat(501)})).status,400);
assert.equal((await req('/game-reports','POST',payload)).status,200);
assert.equal((await req('/game-reports','POST',payload)).status,200);assert.equal(db.prepare('SELECT count(*) n FROM game_reports').get().n,1);
assert.equal((await req('/admin/reports')).status,403);
assert.equal((await req('/admin/report-status','POST',{id:1,status:'fixed',reason:'Fixed'})).status,403);
db.prepare('UPDATE users SET owner=1').run();
let r=await req('/admin/reports');assert.equal(r.data.reports.length,1);assert.equal(r.data.reports[0].note,payload.note);
assert.equal((await req('/admin/report-status','POST',{id:1,status:'bad',reason:'test'})).status,400);
assert.equal((await req('/admin/report-status','POST',{id:1,status:'fixed',reason:'Fixed loading'})).status,200);
assert.equal((await req('/admin/reports')).data.reports.length,0);assert.equal((await req('/admin/reports?status=fixed')).data.reports.length,1);
assert.equal(db.prepare('SELECT count(*) n FROM admin_log').get().n,1);
assert.equal((await req('/game-reports','POST',payload)).status,200);assert.equal(db.prepare('SELECT status FROM game_reports').get().status,'fixed');
db.prepare('UPDATE game_reports SET updated=0').run();await req('/game-reports','POST',payload);assert.equal(db.prepare('SELECT status FROM game_reports').get().status,'open');
assert.equal((await req('/game-reports','POST',payload,{}, {...env,AUTH_LIMIT:{limit:async()=>({success:false})}})).status,429);
assert.equal((await req('/admin/reports?before=-1')).status,400);
for(let i=0;i<51;i++)db.prepare('INSERT INTO game_reports(game_id,reporter,kind,note,created,updated) VALUES(?,?,?,?,?,?)').run('test-game-'+i,signed.data.user.id,'other','',Date.now(),Date.now());
const first=(await req('/admin/reports')).data;assert.equal(first.reports.length,50);assert.equal(first.hasMore,true);const second=(await req('/admin/reports?before='+first.reports.at(-1).id)).data;assert.equal(second.reports.length,2);assert.equal(second.hasMore,false);
console.log('PASS: report auth, validation, duplicates, owner-only review, audit, resolution filters and recurrence cooldown.');db.close();
