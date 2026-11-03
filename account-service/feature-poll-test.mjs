import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker,{digest} from './worker.mjs';
import {FEATURE_POLL} from './feature-poll.mjs';
const db=new DatabaseSync(':memory:');
db.exec('CREATE TABLE users(id TEXT PRIMARY KEY,banned INTEGER DEFAULT 0,suspended_until INTEGER DEFAULT 0);CREATE TABLE sessions(user_id TEXT,token_hash TEXT,last_seen INTEGER,expires INTEGER);');
db.exec(readFileSync(new URL('./feature-poll-schema.sql',import.meta.url),'utf8'));
const DB={prepare(sql){let args=[];const stmt={bind(...values){args=values;return stmt;},async all(){return {results:db.prepare(sql).all(...args)};},async first(){return db.prepare(sql).get(...args)||null;},async run(){return db.prepare(sql).run(...args);}};return stmt;},async batch(items){return Promise.all(items.map(x=>x.all()));}};
const env={DB,ADDITIONAL_ALLOWED_ORIGIN:'https://bens-wacky-world.pages.dev',REQUEST_LIMIT:{limit:async()=>({success:true})}};
for(const [id,token] of [['a','a'.repeat(64)],['b','b'.repeat(64)]]){db.prepare('INSERT INTO users(id) VALUES(?)').run(id);db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(id,digest(token),Date.now(),FEATURE_POLL.closes+86400000);}
const call=(method='GET',choice,token,extra={})=>worker.fetch(new Request('https://api.test/feature-poll',{method,headers:{Origin:env.ADDITIONAL_ALLOWED_ORIGIN,'X-Wacky-Client':'1','Content-Type':'application/json',...(token?{Cookie:'__Host-wacky_session='+token.repeat(64)}:{}),...extra},...(method==='GET'?{}:{body:JSON.stringify({poll:FEATURE_POLL.id,choice})})}),env);
assert.equal((await call()).status,200);assert.equal((await (await call()).json()).total,0);
assert.equal((await call('POST','music')).status,401);
assert.equal((await call('POST','nope','a')).status,400);
assert.equal((await call('POST','music','a',{Origin:'https://evil.test'})).status,403);
assert.equal((await call('POST','music','a',{'X-Wacky-Client':'0'})).status,403);
await call('POST','music','a');await call('POST','music','a');let result=await (await call('GET',null,'a')).json();assert.equal(result.total,1);assert.equal(result.myVote,'music');
await call('POST','tournaments','a');await call('POST','daily-games','b');result=await (await call()).json();assert.equal(result.total,2);assert.equal(result.counts.music,0);assert.equal(result.counts.tournaments,1);assert.equal(result.myVote,null);
db.prepare('UPDATE users SET banned=1 WHERE id=?').run('a');assert.equal((await call('POST','music','a')).status,403);
const original=Date.now;Date.now=()=>FEATURE_POLL.closes;assert.equal((await call('POST','music','b')).status,409);assert.equal((await (await call()).json()).closed,true);Date.now=original;
console.log('PASS: guest reads, authentication, origins, invalid options, duplicate/change votes, private own vote, banned accounts, deadline');

