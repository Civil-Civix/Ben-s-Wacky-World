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

db.exec(readFileSync(new URL('./score-schema.sql',import.meta.url),'utf8'));
env.BATTLE_RESULT_SECRET='test-secret-only';

db.exec(readFileSync(new URL('./friends-schema.sql',import.meta.url),'utf8'));
const make=async username=>{const r=await req('/signup','POST',{username,password:'test-password',noRecovery:true});return {id:r.data.user.id,cookie:r.cookie.split(';')[0]};};
const a=await make('FriendAlpha'),b=await make('FriendBeta'),c=await make('FriendOther');
assert.equal((await req('/friends')).status,401);assert.equal((await req('/leaderboard?scope=friends')).status,401);
cookie=a.cookie;assert.equal((await req('/friends','POST',{action:'request',userId:a.id})).status,400);
assert.equal((await req('/friends','POST',{action:'request',userId:b.id})).data.relationship,'outgoing');
assert.equal((await req('/friends','POST',{action:'accept',userId:b.id})).status,409);
assert.equal((await req('/friends','POST',{action:'request',userId:b.id})).data.relationship,'outgoing');
cookie=c.cookie;assert.equal((await req('/friends')).data.friends.length,0);assert.equal((await req('/friends','POST',{action:'accept',userId:a.id})).status,409);
cookie=b.cookie;assert.equal((await req('/friends')).data.friends[0].relationship,'incoming');assert.equal((await req('/friends','POST',{action:'accept',userId:a.id})).data.relationship,'friends');
cookie=a.cookie;assert.equal((await req('/friends?user='+b.id)).data.relationship,'friends');
assert(!JSON.stringify((await req('/friends')).data).includes('password'));assert.equal((await req('/friends')).data.friends[0].user.status,'offline');
for(const [user,time] of [[a,1000],[b,2000],[c,3000]]){db.prepare('UPDATE users SET play_ms=? WHERE id=?').run(time,user.id);db.prepare('INSERT INTO poly_records(user_id,track,frames,recording,car_style,updated) VALUES(?,?,?,?,?,?)').run(user.id,tracks[0].id,4000-time,'local-test','',Date.now());db.prepare('INSERT INTO battle_results(battle_id,winner,loser,finished) VALUES(?,?,?,?)').run('battle-'+user.id,user.id,user.id===a.id?b.id:a.id,Date.now());}
for(const path of ['/leaderboard','/leaderboard?mode=showdown','/poly/board?track='+tracks[0].id]){const r=await req(path+(path.includes('?')?'&':'?')+'scope=friends');assert.equal(r.status,200,JSON.stringify(r.data));const users=r.data.users||r.data.entries.map(e=>e.profile);assert.deepEqual(new Set(users.map(u=>u.id)),new Set([a.id,b.id]));assert.equal(r.data.top.length,2);}
assert.equal((await req('/friends','POST',{action:'remove',userId:b.id})).data.relationship,'none');assert.equal((await req('/leaderboard?scope=friends')).data.users.length,1);
assert.equal((await req('/friends','POST',{action:'request',userId:b.id})).status,429);
assert.equal((await req('/friends','POST',{action:'request',userId:c.id})).data.relationship,'outgoing');cookie=c.cookie;assert.equal((await req('/friends','POST',{action:'decline',userId:a.id})).data.relationship,'none');
cookie=b.cookie;await req('/friends','POST',{action:'request',userId:c.id});assert.equal((await req('/friends','POST',{action:'cancel',userId:c.id})).data.relationship,'none');
console.log('PASS: authenticated requests, self/outsider rejection, acceptance ownership, duplicate safety, privacy/presence, all three friend-filtered leaderboards, removal/decline/cancel and cooldown.');db.close();
