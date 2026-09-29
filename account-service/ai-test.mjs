import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker,{digest} from './worker.mjs';
import {aiDay} from './ai.mjs';
const db=new DatabaseSync(':memory:');
for(const file of ['schema.sql','chat-schema.sql','ai-schema.sql'])db.exec(readFileSync(new URL(file,import.meta.url),'utf8'));
const DB={prepare(sql){return {bind(...args){return {async first(){return db.prepare(sql).get(...args)||null;},async all(){return {results:db.prepare(sql).all(...args)};},async run(){return {meta:db.prepare(sql).run(...args)};}};}};},async batch(items){return Promise.all(items.map(x=>x.run()));}};
const yes={limit:async()=>({success:true})};
const env={DB,PASSWORD_PEPPER:'test',GROQ_API_KEY:'mock-only',ALLOWED_ORIGIN:'https://civil-civix.github.io',REQUEST_LIMIT:yes};
const tokens=['a','b','c'].map(c=>c.repeat(64));
for(let i=0;i<3;i++){db.prepare('INSERT INTO users(id,username,username_key,salt,password_hash,created) VALUES(?,?,?,?,?,?)').run('user'+i,'User'+i,'user'+i,'salt','hash',Date.now());db.prepare('INSERT INTO sessions(token_hash,user_id,expires) VALUES(?,?,?)').run(digest(tokens[i]),'user'+i,Date.now()+3*86400000);}
let calls=0,mode='ok',release;
const realFetch=globalThis.fetch;
globalThis.fetch=async(url,options)=>{assert.equal(url,'https://api.groq.com/openai/v1/chat/completions');assert.equal(options.headers.Authorization,'Bearer mock-only');calls++;if(mode==='wait')await new Promise(r=>release=r);if(mode==='fail')return new Response('provider error',{status:503});return Response.json({choices:[{message:{content:'Helpful answer <script>literal</script>'}}]});};
async function req(user=0,browser='',method='GET',data,bindings=env,origin=env.ALLOWED_ORIGIN){const response=await worker.fetch(new Request('https://api.test/ai',{method,headers:{Origin:origin,'X-Wacky-Client':'1','Content-Type':'application/json',Cookie:(user===null?'':'__Host-wacky_session='+tokens[user]+'; ')+browser},...(data?{body:JSON.stringify(data)}:{})}),bindings);return {status:response.status,data:await response.json(),cookie:response.headers.get('Set-Cookie')?.split(';')[0]};}
const message=()=>({text:'Hello',requestId:crypto.randomUUID()});
try{
assert.equal((await req(null)).status,401);assert.equal((await req(0,'','GET',null,env,'https://evil.test')).status,403);
let initial=await req();assert.equal(initial.data.remaining,15);const browser=initial.cookie;assert(browser.startsWith('__Host-wacky_ai_browser='));
assert.equal((await req(0,'','POST',message())).status,409);
const noKey=await req(0,browser,'POST',message(),{...env,GROQ_API_KEY:''});assert.equal(noKey.status,503);assert.equal(calls,0);
const first=message();assert.equal((await req(0,browser,'POST',first)).status,200);assert.equal((await req(0,browser,'POST',first)).status,200);assert.equal(calls,1);
assert.equal((await req(1,browser)).data.messages.length,0);
for(let i=1;i<15;i++)assert.equal((await req(0,browser,'POST',message())).status,200);
assert.equal((await req(1,browser,'POST',message())).status,429); // new account, same browser
const fresh=(await req(0)).cookie;assert.equal((await req(0,fresh,'POST',message())).status,429); // same account, new browser
assert.equal(calls,15);
const other=(await req(1)).cookie;mode='fail';assert.equal((await req(1,other,'POST',message())).status,503);assert.equal((await req(1,other)).data.remaining,15);
mode='wait';const pending=req(1,other,'POST',message());while(!release)await new Promise(r=>setTimeout(r,1));assert.equal((await req(1,other,'POST',message())).status,409);release();mode='ok';assert.equal((await pending).status,200);
assert.equal((await req(1,other)).data.messages.length,1);
assert.equal((await req(1,other,'POST',{...message(),text:'x'.repeat(1001)})).status,400);
assert.equal(aiDay(Date.parse('2026-09-28T06:59:59Z')),'2026-09-27');assert.equal(aiDay(Date.parse('2026-09-28T07:00:00Z')),'2026-09-28');
db.prepare('UPDATE ai_requests SET day=?').run('2000-01-01');assert.equal((await req(0,browser)).data.remaining,15);
db.prepare('UPDATE ai_requests SET expires=?').run(Date.now()-1);assert.equal((await req(0,browser)).data.messages.length,0);await worker.scheduled({},env);assert.equal(db.prepare('SELECT count(*) AS n FROM ai_requests').get().n,0);
console.log('PASS: login/origin, missing key, signed browser cookie, both 15-message limits, cross-account browser limit, private history, deduplication, concurrent sends, failure refund, Arizona reset, size limits, 24-hour expiry and cleanup.');
}finally{globalThis.fetch=realFetch;db.close();}
