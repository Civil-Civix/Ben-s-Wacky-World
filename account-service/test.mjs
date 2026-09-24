import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from './worker.mjs';
const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('./schema.sql',import.meta.url),'utf8'));
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
assert.equal((await req('/me')).status,401);
const registered=await req('/signup','POST',{username:'PlayerOne',password:'test-password-only',noRecovery:true});
assert.equal(registered.status,201);cookie=registered.cookie.split(';')[0];
assert(registered.cookie.includes('HttpOnly'));assert(registered.cookie.includes('Partitioned'));
assert(!JSON.stringify(registered.data).includes('password'));
const id=registered.data.user.id;
assert.equal((await req('/me')).data.user.username,'PlayerOne');
assert.equal((await req('/signup','POST',{username:'playerone',password:'another-password',noRecovery:true})).status,409);
assert.equal((await req('/signup','POST',{username:'WackyBen',password:'another-password',noRecovery:true})).status,409);
assert.equal((await req('/login','POST',{username:'PlayerOne',password:'incorrect'})).status,401);
assert.equal((await req('/login','POST',{username:'PlayerOne',password:'test-password-only'})).status,200);
assert.equal((await req('/me','PATCH',{username:'PlayerOne',bio:'<img src=x onerror=alert(1)>',owner:true,play_ms:99999})).status,200);
assert.equal((await req('/me')).data.user.owner,false);assert.equal((await req('/me')).data.user.playSeconds,0);
assert.equal((await req('/me','PATCH',{username:'WackyBen',bio:''})).status,400);
assert.equal((await req('/play/start','POST',{gameId:'stream-hub'})).status,400);
const started=await req('/play/start','POST',{gameId:'gangbeasts'});assert.equal(started.status,200);
assert.equal((await req('/play/start','POST',{gameId:'gangbeasts'})).status,409);
db.prepare('UPDATE activity SET last_seen=? WHERE user_id=?').run(Date.now()-30000,id);
const pulse={lease:started.data.lease,seq:1,elapsed:30000,stop:false};
assert.equal((await req('/play/pulse','POST',pulse)).status,200);
assert.equal((await req('/play/pulse','POST',pulse)).status,409);
assert.equal((await req('/me')).data.user.playSeconds,30);
assert.equal((await req('/play/pulse','POST',{...pulse,seq:2,elapsed:60001})).status,400);
db.prepare('UPDATE activity SET last_seen=?,accrued=0 WHERE user_id=?').run(Date.now()-100000,id);
await req('/play/pulse','POST',{...pulse,seq:2,stop:true});
assert.equal((await req('/me')).data.user.playSeconds,30);
assert.equal((await req('/play/start','POST',{gameId:'gangbeasts'})).status,200);
const board=await req('/leaderboard');assert.equal(board.status,200);assert.equal(board.data.users[0].rank,1);assert.equal(board.data.top.length,1);
assert.equal((await req('/profiles/'+id)).data.user.bio,'<img src=x onerror=alert(1)>');
assert.equal((await req('/me','GET',undefined,{Origin:'https://evil.example'})).status,403);
assert.equal((await req('/login','POST',{username:'PlayerOne',password:'test-password-only'},{},{...env,AUTH_LIMIT:{limit:async()=>({success:false})}})).status,429);
assert.equal((await req('/logout','POST',{})).status,200);assert.equal((await req('/me')).status,401);
db.close();console.log('PASS: signup/login, sessions/logout, private fields, reserved owner, profile permissions, ranking, lease exclusion, replay, idle-gap rejection and rate limiting.');
