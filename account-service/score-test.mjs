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
const a=await req('/signup','POST',{username:'ScoreOne',password:'test-password',noRecovery:true});const aCookie=a.cookie.split(';')[0],aId=a.data.user.id;
const b=await req('/signup','POST',{username:'ScoreTwo',password:'test-password',noRecovery:true});const bId=b.data.user.id;
cookie=aCookie;
const payload={battleId:'battle-gen9randombattle-1',format:'gen9randombattle',rated:true,winner:'bww'+aId.replaceAll('-',''),loser:'bww'+bId.replaceAll('-',''),finished:Date.now()};
const signed=d=>({'X-Battle-Signature':createHmac('sha256',env.BATTLE_RESULT_SECRET).update(JSON.stringify(d)).digest('hex'),Origin:'https://battle.test'});
assert.equal((await req('/battle/results','POST',payload)).status,403);
assert.equal((await req('/battle/results','POST',payload,signed(payload))).status,200);
assert.equal((await req('/battle/results','POST',payload,signed(payload))).status,200);
let board=await req('/leaderboard?mode=showdown');assert.equal(board.data.users[0].wins,1);assert.equal(board.data.users[0].id,aId);assert(!JSON.stringify(board.data).includes('password'));
const challenge={...payload,battleId:'battle-gen9randombattle-2',rated:false};assert.equal((await req('/battle/results','POST',challenge,signed(challenge))).status,400);
assert.equal((await req('/battle/results','POST',{...payload,winner:payload.loser},signed(payload))).status,403);
const run={track:tracks[0].id,frames:12345,recording:'eNpjYgABAXUGZAAAA1EAOg',carStyle:''};
cookie='';assert.equal((await req('/poly/best','POST',run)).status,401);cookie=aCookie;
assert.equal((await req('/poly/best','POST',{...run,track:'unknown'})).status,400);
assert.equal((await req('/poly/best','POST',{...run,recording:'bad'})).status,400);
assert.equal((await req('/poly/best','POST',run)).data.improved,true);
assert.equal((await req('/poly/best','POST',run)).status,429);
db.exec('DELETE FROM poly_limits');assert.equal((await req('/poly/best','POST',{...run,frames:99999})).data.improved,false);
db.exec('DELETE FROM poly_limits');assert.equal((await req('/poly/best','POST',{...run,frames:11000})).data.improved,true);
board=await req('/poly/board?track='+run.track+'&user='+aId);assert.equal(board.data.total,1);assert.equal(board.data.userEntry.frames,11000);assert.equal(board.data.entries[0].profile.id,aId);assert(!JSON.stringify(board.data).includes('password'));
const replayId=board.data.entries[0].id;assert.equal((await req('/poly/replays?ids='+replayId)).data.recordings[0].recording,run.recording);
assert.equal((await req('/poly/board?track='+tracks[1].id)).data.total,0);
assert.equal((await req('/poly/replays?ids=bad')).status,400);
db.prepare('UPDATE users SET banned=1 WHERE id=?').run(aId);assert.equal((await req('/leaderboard?mode=showdown')).data.users.length,0);assert.equal((await req('/poly/board?track='+run.track)).data.total,0);assert.equal((await req('/poly/replays?ids='+replayId)).data.recordings[0],null);assert.equal((await req('/poly/best','POST',run)).status,403);
console.log('PASS: signed server wins, duplicate protection, forged/challenge rejection, account ownership, track isolation, personal best updates, rate limit, replay retrieval and moderation.');db.close();
