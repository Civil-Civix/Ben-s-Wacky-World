import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {test} from 'node:test';
import {phone} from './phone.mjs';

function fixture() {
 const sql=new DatabaseSync(':memory:');
 sql.exec(`
  CREATE TABLE phone_limits(user_id TEXT NOT NULL,kind TEXT NOT NULL,bucket INTEGER NOT NULL,count INTEGER NOT NULL,PRIMARY KEY(user_id,kind));
  CREATE TABLE phone_reports(id INTEGER PRIMARY KEY AUTOINCREMENT,room TEXT NOT NULL,chain_id TEXT NOT NULL,round INTEGER NOT NULL,reporter TEXT NOT NULL,author_id TEXT NOT NULL,author_name TEXT NOT NULL,reason TEXT NOT NULL,snapshot TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'open',created INTEGER NOT NULL,UNIQUE(room,chain_id,round,reporter));
  CREATE TABLE admin_log(id INTEGER PRIMARY KEY AUTOINCREMENT,actor TEXT NOT NULL,target TEXT NOT NULL,action TEXT NOT NULL,details TEXT NOT NULL,created INTEGER NOT NULL);
 `);
 const DB={
  prepare(source){
   const bind=(...params)=>({
    async first(){return sql.prepare(source).get(...params)||null;},
    async all(){return {results:sql.prepare(source).all(...params)};},
    async run(){return {meta:sql.prepare(source).run(...params)};}
   });
   return {bind,async all(){return bind().all();}};
  },
  async batch(items){return Promise.all(items.map(item=>item.run()));}
 };
 const commands=[];
 let nextRound=0;
 const PHONE_ROOMS={getByName(name){return {async command(actor,action,data){commands.push({name,actor,action,data});if(action==='create')return {code:name,phase:'lobby'};if(action==='join')return {joined:true,code:name};if(action==='report')return {report:{chainId:1,round:nextRound++,authorId:'author-1',authorName:'Author',reason:data.reason}};if(action==='remove-entry')return {ok:true};return {ok:true};}};}};
 const env={DB,PHONE_ROOMS}, now=1780000000000;
 async function call(path,method='GET',data,me={id:'player-1',username:'Player',owner:false,admin:true}){
  const url=new URL('https://accounts.test'+path);
  const request=new Request(url,{method,...(data!==undefined?{headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:{})});
  const body=async req=>req.json();
  const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
  const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
  try {const response=await phone({request,url,env,me,now,body,fail,json});return {status:response.status,data:await response.json()};}
  catch(error){if(Number.isInteger(error.status))return {status:error.status,data:{error:error.message}};throw error;}
 }
 return {sql,commands,call,close(){sql.close();}};
}

test('room creation is rate limited per account',async()=>{
 const f=fixture();
 try {
  for(let i=0;i<6;i++)assert.equal((await f.call('/phone/create','POST',{})).status,201);
  assert.equal((await f.call('/phone/create','POST',{})).status,429);
  assert.equal(f.commands.filter(c=>c.action==='create').length,6);
 } finally {f.close();}
});

test('join normalizes room codes and applies its per-account limit',async()=>{
 const f=fixture();
 try {
  for(const malformed of [null,7,[],{code:{room:'ABCDEF'}}])assert.equal((await f.call('/phone/join','POST',malformed,{id:'bad-shape',username:'BadShape',admin:true})).status,400);
  assert.equal(f.commands.length,0);
  const joined=await f.call('/phone/join','POST',{code:'abcdef'});
  assert.equal(joined.status,200);assert.deepEqual(joined.data,{joined:true,code:'ABCDEF'});
  assert.equal(f.commands[0].name,'ABCDEF');
  for(let i=1;i<60;i++)assert.equal((await f.call('/phone/join','POST',{code:'ABCDEF'})).status,200);
  assert.equal((await f.call('/phone/join','POST',{code:'ABCDEF'})).status,429);
 } finally {f.close();}
});

test('reports are limited, hidden from non-owners, and owner moderation is audited',async()=>{
 const f=fixture();
 const player={id:'player-1',username:'Player',owner:false,admin:true};
 const owner={id:'owner-1',username:'Owner',owner:true};
 try {
  for(const malformed of [null,7,[]])assert.equal((await f.call('/phone/ABCDEF/report','POST',malformed,player)).status,400);
  for(const malformed of [null,7,[]])assert.equal((await f.call('/phone/admin/report','POST',malformed,owner)).status,400);
  assert.equal((await f.call('/phone/ABCDEF/report','POST',{reason:'Please review',authorId:'owner-1',authorName:'Moderator',snapshot:{authorId:'owner-1'}},player)).status,200);
  assert.equal((await f.call('/phone/admin/reports','GET',undefined,player)).status,403);
  assert.equal((await f.call('/phone/admin/report','POST',{id:1,status:'reviewed'},player)).status,403);
  const listing=await f.call('/phone/admin/reports','GET',undefined,owner);
  assert.equal(listing.status,200);assert.equal(listing.data.reports.length,1);
  assert.equal(listing.data.reports[0].snapshot.reason,'Please review');
  assert.equal(listing.data.reports[0].snapshot.authorId,'author-1');
  assert.equal(listing.data.reports[0].snapshot.authorName,'Author');
  assert.equal(listing.data.reports[0].snapshot.chainId,1);
  assert.equal((await f.call('/phone/admin/report','POST',{id:1,status:'invalid'},owner)).status,400);
  assert.equal((await f.call('/phone/admin/report','POST',{id:1,status:'removed'},owner)).status,200);
  const removal=f.commands.find(c=>c.action==='remove-entry');
  assert.deepEqual(removal.data,{chainId:1,round:0});
  assert.equal(Number.isSafeInteger(removal.data.chainId),true);
  assert.equal(f.sql.prepare('SELECT COUNT(*) AS count FROM admin_log').get().count,1);
  assert.equal((await f.call('/phone/admin/reports?status=removed','GET',undefined,owner)).data.reports.length,1);
  for(let i=1;i<20;i++)assert.equal((await f.call('/phone/ABCDEF/report','POST',{reason:'repeat'},player)).status,200);
  assert.equal((await f.call('/phone/ABCDEF/report','POST',{reason:'too many'},player)).status,429);
  assert.equal(f.commands.filter(c=>c.action==='report').length,20);
 } finally {f.close();}
});


test('non-admins cannot use any Wacky Phone route or reach room storage',async()=>{
 const f=fixture(),guest={id:'regular-1',username:'Regular',owner:false,admin:false};
 try {
  const paths=[['/phone/me','GET'],['/phone/create','POST'],['/phone/join','POST'],['/phone/ABCDEF','GET'],...['start','draft','ready','heartbeat','leave','kick','ban','reveal','react','report','download'].map(action=>['/phone/ABCDEF/'+action,'POST']),['/phone/admin/reports','GET'],['/phone/admin/report','POST']];
  for(const [path,method] of paths)assert.equal((await f.call(path,method,method==='POST'?{}:undefined,guest)).status,403,path);
  assert.equal(f.commands.length,0);
  assert.equal(f.sql.prepare('SELECT COUNT(*) AS count FROM phone_limits').get().count,0);
  for(const user of [{...guest,admin:true},{...guest,owner:true}])assert.equal((await f.call('/phone/me','GET',undefined,user)).status,200);
 }finally{f.close();}
});
