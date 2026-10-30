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
const yes={limit:async()=>({success:true})},env={DB,PASSWORD_PEPPER:'test-only-pepper',ALLOWED_ORIGIN:'https://civil-civix.github.io',ADDITIONAL_ALLOWED_ORIGIN:'https://bens-wacky-world.pages.dev',REQUEST_LIMIT:yes,AUTH_LIMIT:yes,LOGIN_LIMIT:yes};
let cookie='';
async function req(path,method='GET',data,extra={},bindings=env){
 const response=await worker.fetch(new Request('https://accounts.test'+path,{method,headers:{Origin:env.ALLOWED_ORIGIN,'X-Wacky-Client':'1',Cookie:cookie,'Content-Type':'application/json',...extra},...(data!==undefined?{body:JSON.stringify(data)}:{})}),bindings);
 return {status:response.status,data:await response.json(),cookie:response.headers.get('Set-Cookie'),headers:response.headers};
}

for(const file of ['chat-schema.sql','group-schema.sql','public-rooms.sql','chat-notifications.sql','chat-guest-mentions-index.sql'])db.exec(readFileSync(new URL(file,import.meta.url),'utf8'));
const now=Date.now(),tokens={};
for(const [i,name] of ['owner','alice','bob','outsider'].entries()){
 tokens[name]=(i+1).toString().repeat(64);
 db.prepare('INSERT INTO users(id,username,username_key,salt,password_hash,created,owner) VALUES(?,?,?,?,?,?,?)').run(name,name,name,'s','h',now-10000,name==='owner'?1:0);
 db.prepare('INSERT INTO sessions(token_hash,user_id,expires) VALUES(?,?,?)').run(digest(tokens[name]),name,now+60000);
}
function as(name){cookie=name?'__Host-wacky_session='+tokens[name]:'';}
let seq=0;
async function send(name,to,text,extra={}){as(name);db.prepare('UPDATE chat_messages SET created=? WHERE sender=?').run(now-3000,name);return req('/chat/messages','POST',{to,text,clientId:'notification-test-'+(++seq),...extra});}
assert.equal((await send('alice',null,'Hello World')).status,201);
const parent=(await req('/chat/messages')).data.messages[0].id;
assert.equal((await send('bob',null,'A reply',{replyTo:parent})).status,201);
as('alice');let unread=(await req('/chat/unread')).data;
assert.equal(unread.count,1);assert.equal(unread.notifications[0].kind,'reply');assert.equal(unread.notifications[0].to,'room:world');
const reply=unread.notifications[0].id;
as('outsider');assert.equal((await req('/chat/unread')).data.notifications.length,0);
assert.equal((await send('bob',null,'@everyone hi')).status,403);
assert.equal((await send('bob',null,'hey @EVERYONE!')).status,403);
assert.equal((await send('owner','bob','@everyone hi')).status,400);
assert.equal((await send('owner',null,'@everyone welcome')).status,201);
as('alice');unread=(await req('/chat/unread')).data;assert.equal(unread.notifications.length,2);
const broadcast=unread.notifications[0].id;
assert.equal((await req('/chat/read','POST',{to:'room:world',through:broadcast})).status,200);
assert.equal((await req('/chat/unread')).data.notifications.length,0);
// Read receipts are monotonic.
assert.equal((await req('/chat/read','POST',{to:'room:world',through:reply})).status,200);
assert.equal((await req('/chat/unread')).data.count,0);
assert.equal((await send('alice','bob','Private message')).status,201);
const secret=(await req('/chat/messages?to=bob')).data.messages[0].id;
db.prepare('UPDATE chat_messages SET photo=? WHERE id IN (?,?)').run('data:image/jpeg;base64,test',parent,secret);
as('owner');const created=await req('/chat/groups','POST',{name:'Private group',members:['alice','bob']});assert.equal(created.status,201);
const to='group:'+created.data.group.id;
assert.equal((await send('owner',to,'@everyone group only')).status,201);
as('alice');assert.equal((await req('/chat/unread')).data.notifications[0].to,to);
as('outsider');assert(!(await req('/chat/unread')).data.notifications.some(n=>n.to===to));
as('alice');await req('/chat/groups/'+created.data.group.id+'/leave','POST',{});assert(!(await req('/chat/unread')).data.notifications.some(n=>n.to===to));
as(null);
assert.equal((await req('/chat/public/mentions')).data.count,1);
assert.equal((await req('/chat/public/mentions?after='+broadcast)).data.count,0);
assert.equal((await req('/chat/public/mentions?after=-1')).status,400);
assert.equal((await req('/chat/public/mentions?to='+to)).status,403);
assert.equal((await req('/chat/public/mentions','POST',{})).status,401);
const publicChat=await req('/chat/public');assert.equal(publicChat.status,200);assert(publicChat.data.messages.length>=3);
assert.equal(publicChat.data.messages.find(m=>m.id===broadcast).mentionsEveryone,true);
assert(publicChat.data.messages.every(m=>!m.text.includes('Private')&&!m.text.includes('group only')));
assert.equal((await req('/chat/public?to=bob')).status,403);
assert.equal((await req('/chat/public?to='+to)).status,403);
assert.equal((await req('/chat/public/photos/'+secret)).status,404);
assert.equal((await req('/chat/public/photos/'+parent)).status,200);
assert.equal((await req('/chat/messages?to=bob')).status,401);
assert.equal((await req('/chat/unread')).status,401);
assert.equal((await req('/chat/messages','POST',{to:null,text:'Guest send',clientId:'guest-write-test-01'})).status,401);
assert.equal((await req('/chat/public','POST',{})).status,401);
assert.equal((await req('/chat/public','GET',undefined,{Origin:'https://evil.test'})).status,403);
db.prepare('UPDATE chat_messages SET expires=? WHERE id=?').run(now-1,parent);
assert.equal((await req('/chat/public/photos/'+parent)).status,404);
assert(!(await req('/chat/public')).data.messages.some(m=>m.id===parent));
as('bob');db.prepare('UPDATE chat_messages SET expires=?').run(now-1);assert.equal((await req('/chat/unread')).data.notifications.length,0);
as(null);assert.equal((await req('/chat/public/mentions')).data.count,0);
console.log('PASS: guest read-only access, private/group/photo isolation, admin mentions, targeted replies, room read receipts, group membership and expiry.');
