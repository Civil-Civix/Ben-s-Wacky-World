import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {newRoom,settingsFor,joinRoom,startRoom,advance,answerRoom,roomAction,publicRoom,nextAlarm} from '../src/party-engine.mjs';
import {PartyRoomController,loadPartyBanks} from '../src/party-room.mjs';
import {partyAPI} from '../src/party-api.mjs';
import {etDate} from '../public/rules.mjs';

const answers=[{answer:'Apple',aliases:['Malus'],tier:'krillion'},{answer:'Banana',tier:'rare'},{answer:'Cherry',tier:'deepcut'}];
const categories=[{id:'fruit',text:'Name a fruit',total:3},{id:'colors',text:'Name a color',total:2}];
function playing(settings={}){const room=newRoom('ABC234','alice','Alice',1000,settings);joinRoom(room,'bob','Bob',1000);startRoom(room,'alice',structuredClone(categories),1000,()=>0);advance(room,4000,()=>0);return room;}
const actorIdentity=room=>room.players.find(p=>p.id===room.holderId).identity;
const answer=(room,text,now=5000)=>answerRoom(room,actorIdentity(room),{answer:text,roundId:room.roundId},answers,now);

function database(){
 const sql=new DatabaseSync(':memory:');sql.exec(readFileSync(new URL('../migrations/0001_initial.sql',import.meta.url),'utf8'));
 const db={prepare:query=>{const make=args=>({first:async()=>sql.prepare(query).get(...args)||null,all:async()=>({results:sql.prepare(query).all(...args)}),run:async()=>sql.prepare(query).run(...args)});return {...make([]),bind:(...args)=>make(args)};}};
 return {sql,db,close:()=>sql.close()};
}
function seed(sql,puzzle={date:etDate(),source:'Real reference',prompts:[{text:'Name a fruit',answers}]},compressed=false){sql.prepare('INSERT OR REPLACE INTO puzzles(date,day_number,source,content) VALUES(?,?,?,?)').run(puzzle.date,1,puzzle.source,compressed?gzipSync(JSON.stringify(puzzle)):JSON.stringify(puzzle));}
function context(){
 const sql=new DatabaseSync(':memory:'),sockets=[];
 const ctx={storage:{sql:{exec(query,...args){const statement=sql.prepare(query);const rows=statement.columns().length?statement.all(...args):(statement.run(...args),[]);return {toArray:()=>rows};}},transactionSync(fn){sql.exec('BEGIN');try{const value=fn();sql.exec('COMMIT');return value;}catch(e){sql.exec('ROLLBACK');throw e;}},async setAlarm(at){ctx.alarmAt=at;ctx.alarmCalls=(ctx.alarmCalls||0)+1;},async deleteAll(){sql.exec('DROP TABLE IF EXISTS party_data');ctx.deleted=true;}},blockConcurrencyWhile:fn=>fn(),getWebSockets:()=>sockets,acceptWebSocket:ws=>sockets.push(ws),close:()=>sql.close(),sockets};return ctx;
}
async function call(controller,action,identity='alice',data={}){const response=await controller.fetch(new Request('https://party.internal/',{method:'POST',body:JSON.stringify({action,identity,code:'ABC234',name:identity,...data})}));return {status:response.status,body:await response.json()};}

// Game rules are tested independently from transport and the platform wrapper.
test('party defaults and settings enforce 1–5 hearts and 2–16 seats',()=>{
 assert.deepEqual(settingsFor(),{hearts:2,maxHearts:5,meterTarget:600,maxPlayers:6});
 for(const value of [{hearts:0},{hearts:6},{maxPlayers:1},{maxPlayers:17},null,[]])assert.throws(()=>settingsFor(value));
 assert.equal(settingsFor({hearts:5,maxPlayers:16}).maxPlayers,16);
});
test('host controls start, room membership, settings and kicks',()=>{
 const room=newRoom('ABC234','alice','Alice',1000,{maxPlayers:2});joinRoom(room,'bob','Bob',1000);
 assert.throws(()=>joinRoom(room,'eve','Eve',1000),/full/);
 assert.throws(()=>startRoom(room,'bob',categories,1000),/host/);
 assert.throws(()=>roomAction(room,'bob',{action:'settings',settings:{hearts:5}},1000),/host/);
 assert.throws(()=>roomAction(room,'eve',{action:'kick',playerId:room.hostId},1000),/Join/);
 assert.throws(()=>roomAction(room,'alice',{action:'settings',settings:{maxPlayers:1}},1000));
 startRoom(room,'alice',categories,1000,()=>0);
 assert.throws(()=>joinRoom(room,'eve','Eve',1000),/started/);
 assert.throws(()=>roomAction(room,'alice',{action:'kick',playerId:room.players[1].id},1000),/between matches/);
});
test('valid answers always pass, including with one millisecond left, and preserve shared fuse above eight seconds',()=>{
 const room=playing();room.fuseEndsAt=5001;const next=room.players[1].id;
 const result=answer(room,'Malus');assert.equal(result.accepted,true);assert.equal(result.passed,true);assert.equal(room.holderId,next);assert.equal(room.fuseEndsAt,13000);
 answer(room,'Banana',6000);assert.equal(room.fuseEndsAt,14000);
 const room2=playing();room2.fuseEndsAt=30000;answer(room2,'Apple');assert.equal(room2.fuseEndsAt,30000);
});
test('aliases and typo matches cannot repeat a canonical answer; invalid and stale guesses do not score',()=>{
 const room=playing();answer(room,'Malus');const before=structuredClone(room);
 assert.equal(answer(room,'Apple').accepted,false);assert.equal(answer(room,'Appl').accepted,false);assert.equal(answer(room,'submarine').accepted,false);assert.deepEqual(room,before);
 assert.throws(()=>answerRoom(room,'alice',{answer:'Banana',roundId:room.roundId},answers,5000),/another player/);
 assert.throws(()=>answerRoom(room,'bob',{answer:'Banana',roundId:room.roundId-1},answers,5000),/moved/);
});
test('600 meter points earn a heart; hearts never exceed five',()=>{
 const room=playing();const player=room.players[0];player.meter=500;const result=answer(room,'Apple');assert.equal(result.heartGained,true);assert.equal(player.hearts,3);assert.equal(player.meter,0);
 const capped=playing();capped.players[0].hearts=5;capped.players[0].meter=590;answer(capped,'Apple');assert.equal(capped.players[0].hearts,5);assert.equal(capped.players[0].meter,599);
});
test('countdown, hidden 10–30 second fuse, pop, category swap and winner follow server time',()=>{
 const room=playing({hearts:1});assert.equal(room.fuseEndsAt,14000);assert.equal(advance(room,13999),false);
 advance(room,14000);assert.equal(room.phase,'finished');assert.equal(room.winnerId,room.players[1].id);assert.equal(room.players[0].eliminated,true);
 const live=playing();advance(live,14000);assert.equal(live.phase,'pop');assert.equal(live.phaseEndsAt,15500);
 advance(live,15500);assert.equal(live.phase,'swap');assert.equal(live.categoryIndex,1);assert.equal(live.phaseEndsAt,16800);
 advance(live,16800,()=>1-Number.EPSILON);assert.equal(live.phase,'playing');assert.equal(live.fuseEndsAt,46800);
 const delayed=playing();advance(delayed,900000);assert.equal(delayed.phase,'pop');assert.equal(delayed.players[0].hearts,1);
});
test('category exhaustion swaps once, preserves remaining fuse, and stops instead of repeating all banks',()=>{
 const room=playing();answer(room,'Apple');answer(room,'Banana');answer(room,'Cherry');assert.equal(room.phase,'swap');assert.equal(room.categoryIndex,1);assert.equal(room.resumeFuseMs,9000);
 advance(room,6300);assert.equal(room.fuseEndsAt,15300);assert.equal(room.phase,'playing');
 room.used.colors=['red','blue'];room.phase='pop';room.phaseEndsAt=7000;advance(room,7000);assert.equal(room.phase,'finished');assert.equal(room.lastEvent.type,'bankExhausted');
});
test('rejoin retains identity and score; leaving transfers host and resolves the last survivor',()=>{
 const room=playing(),old=room.players[0];assert.equal(joinRoom(room,'alice','Different',5000),old);
 roomAction(room,'alice',{action:'leave'},5000);assert.equal(room.hostId,room.players[0].id);assert.equal(room.phase,'finished');assert.equal(room.winnerId,room.hostId);
});
test('public snapshots hide identities, answer banks, used answers and fuse deadline',()=>{
 const room=playing();room.categories[0].answers=answers;answer(room,'Apple');const view=publicRoom(room,'bob',5000),text=JSON.stringify(view);
 assert.equal(view.youId,room.players[1].id);assert.equal(view.category.usedCount,1);
 for(const secret of ['identity','fuseEndsAt','resumeFuseMs','aliases','Malus','"used"'])assert.equal(text.includes(secret),false,secret);
 assert.deepEqual(Object.keys(view.category).sort(),['id','text','total','usedCount']);assert.equal(nextAlarm(room),room.fuseEndsAt);
});

test('real snapshot loader accepts compressed banks, deduplicates and skips demo or malformed snapshots',async()=>{
 const {sql,db,close}=database();try{
 seed(sql,{date:'2000-01-01',source:'Real reference',prompts:[{text:'Fruit',answers:[...answers,answers[0],{answer:'Invalid',tier:'unknown'}]}]},true);
 seed(sql,{date:etDate(),source:'OpenKrillion sample bank',sample:true,prompts:[{text:'Fake',answers}]});
 const banks=await loadPartyBanks({DB:db});assert.equal(banks.length,1);assert.equal(banks[0].answers.length,3);assert.equal(banks[0].id,'2000-01-01:0');
 sql.exec('DELETE FROM puzzles');await assert.rejects(loadPartyBanks({DB:db}),/saved real puzzle/);
 }finally{close();}
});
test('controller serializes simultaneous answers and restores immutable bank after recreation',async()=>{
 const ctx=context(),{sql,db,close}=database();seed(sql);try{
 let controller=new PartyRoomController(ctx,{DB:db});await call(controller,'create');await call(controller,'join','bob');await call(controller,'start');
 let room=controller.read();room.phase='playing';room.phaseEndsAt=null;room.holderId=room.players[0].id;room.fuseEndsAt=Date.now()+20000;await controller.save(room);
 // Daily data changes cannot alter the stored match bank.
 sql.exec('DELETE FROM puzzles');controller=new PartyRoomController(ctx,{DB:db});
 const replies=await Promise.all([call(controller,'answer','alice',{answer:'Malus',roundId:room.roundId}),call(controller,'answer','alice',{answer:'Malus',roundId:room.roundId})]);
 assert.deepEqual(replies.map(r=>r.status),[200,409]);room=controller.read();assert.equal(room.players[0].score,100);assert.deepEqual(room.used[room.categories[0].id],['apple']);assert.equal(room.holderId,room.players[1].id);
 }finally{ctx.close();close();}
});
test('controller chunks and recovers large answer snapshots',()=>{
 const ctx=context();try{const controller=new PartyRoomController(ctx,{}),large=Array.from({length:5000},(_,i)=>({answer:'Fruit '+i+' '.repeat(15),tier:'rare'}));controller.saveBanks([{id:'large',answers:large}]);const rows=ctx.storage.sql.exec("SELECT key FROM party_data WHERE key LIKE 'bank:%'").toArray();assert.ok(rows.length>1);assert.deepEqual(new PartyRoomController(ctx,{}).bank('large'),large);}finally{ctx.close();}
});
test('expiry and an empty-room cleanup allow a fresh room on the same controller instance',async()=>{
 const ctx=context();try{const controller=new PartyRoomController(ctx,{});await call(controller,'create');let room=controller.read();room.expiresAt=Date.now()-1;await controller.save(room);assert.equal((await call(controller,'state')).status,404);assert.equal(ctx.deleted,true);assert.equal((await call(controller,'create')).status,200);await call(controller,'leave');assert.equal((await call(controller,'create')).status,200);}finally{ctx.close();}
});
test('controller rejects malformed requests, enforces membership, and runs persisted alarms',async()=>{
 const ctx=context();try{const controller=new PartyRoomController(ctx,{});assert.equal((await controller.fetch(new Request('https://party.internal/'))).status,405);assert.equal((await controller.fetch(new Request('https://party.internal/',{method:'POST',body:'null'}))).status,400);assert.equal((await call(controller,'create','')).status,401);await call(controller,'create');assert.equal((await call(controller,'answer','alice',{answer:'Apple',roundId:0})).status,409);assert.equal((await call(controller,'state','eve')).status,403);
 await call(controller,'join','bob');const room=controller.read();startRoom(room,'alice',categories,Date.now()-4000,()=>0);await controller.save(room);await controller.alarm();assert.equal(controller.read().phase,'playing');assert.ok(ctx.alarmAt>Date.now());
 }finally{ctx.close();}
});
test('websocket tickets expire after two minutes, are one-time and room scoped',async()=>{
 const first=context(),second=context();const NativeResponse=globalThis.Response,NativePair=globalThis.WebSocketPair;
 try{const a=new PartyRoomController(first,{}),b=new PartyRoomController(second,{});await call(a,'create');await call(b,'create');const room=a.read(),now=Date.now(),ticket=a.issueTicket(room,'alice',now),request=value=>new Request('https://party.internal/ws?ticket='+value,{headers:{Upgrade:'websocket'}});
 assert.throws(()=>a.socket(request(ticket),room,now+120000),/expired/);assert.throws(()=>b.socket(request(ticket),b.read(),now),/expired/);
 const socket=()=>({serializeAttachment(data){this.data=data;},deserializeAttachment(){return this.data;},send(){},close(){this.closed=true;}});
 globalThis.WebSocketPair=class{constructor(){this[0]=socket();this[1]=socket();}};globalThis.Response=class{constructor(body,init){Object.assign(this,init);}};
 assert.equal(a.socket(request(ticket),room,now).status,101);assert.throws(()=>a.socket(request(ticket),room,now),/expired/);
 }finally{globalThis.Response=NativeResponse;globalThis.WebSocketPair=NativePair;first.close();second.close();}
});

function apiService(){const {sql,db,close}=database(),forwarded=[];const env={DB:db,PARTY_ROOMS:{getByName(code){return {async fetch(request){forwarded.push({code,request,data:request.method==='POST'?await request.json():null});return Response.json({room:{code}});}};}}};return {sql,env,forwarded,close,async request(route,{method='POST',body={},headers={}}={}){const url=new URL('https://game.test/api/party/'+route),request=new Request(url,{method,headers:{'Origin':url.origin,...headers},...(method==='POST'?{body:typeof body==='string'?body:JSON.stringify(body)}:{})});const response=await partyAPI(request,env,url);return {status:response.status,body:await response.json(),headers:response.headers};}};}
const guestToken='aabbccdd-1234-1234-1234-123456789abc';
test('party routes generate guest identities and codes, normalize join codes, and strip client identity',async()=>{
 const service=apiService();try{const create=await service.request('create',{body:{name:'Alice',identity:'forged'}});assert.equal(create.status,200);assert.match(create.body.playerToken,/^[a-f0-9-]{36}$/);assert.match(service.forwarded[0].code,/^[A-HJ-NP-Z2-9]{6}$/);assert.notEqual(service.forwarded[0].data.identity,'forged');assert.match(create.headers.get('Set-Cookie'),/HttpOnly; SameSite=Lax/);
 const join=await service.request('join',{body:{code:' abc234 ',name:'Bob'},headers:{'X-Krillion-Player':guestToken}});assert.equal(join.status,200);assert.equal(service.forwarded[1].code,'ABC234');assert.equal(service.forwarded[1].data.identity,guestToken);
 }finally{service.close();}
});
test('party routes reject cross-origin, malformed, oversized, unauthorized and disguised actions',async()=>{
 const service=apiService();try{
 assert.equal((await service.request('create',{headers:{Origin:'https://evil.test'}})).status,403);
 assert.equal((await service.request('create',{body:'broken'})).status,400);
 assert.equal((await service.request('create',{body:'x'.repeat(4097)})).status,413);
 assert.equal((await service.request('create',{headers:{'Content-Length':'9999'}})).status,413);
 assert.equal((await service.request('state?code=ABC234',{method:'GET'})).status,401);
 assert.equal((await service.request('action',{body:{code:'ABC234',action:'create'},headers:{'X-Krillion-Player':guestToken}})).status,400);
 assert.equal((await service.request('create',{method:'GET'})).status,405);
 assert.equal((await service.request('join',{body:{code:'INVALID'}})).status,400);
 assert.equal((await service.request('create',{headers:{'X-Wacky-Krillion-Ticket':'forged'}})).status,401);
 assert.equal(service.forwarded.length,0);
 }finally{service.close();}
});
test('party creation rate limit is enforced before forwarding an eleventh room',async()=>{
 const service=apiService();try{for(let i=0;i<10;i++)assert.equal((await service.request('create',{headers:{'CF-Connecting-IP':'192.0.2.5'}})).status,200);assert.equal((await service.request('create',{headers:{'CF-Connecting-IP':'192.0.2.5'}})).status,429);assert.equal(service.forwarded.length,10);}finally{service.close();}
});

test('unchanged state and connection polling do not rewrite rooms or broadcast unchanged snapshots',async()=>{
 const ctx=context();try{const controller=new PartyRoomController(ctx,{});await call(controller,'create');let broadcasts=0;controller.broadcast=()=>broadcasts++;const writes=ctx.alarmCalls;
 for(let i=0;i<5;i++)assert.equal((await call(controller,'state')).status,200);
 assert.equal((await call(controller,'connect')).status,200);assert.equal(ctx.alarmCalls,writes);assert.equal(broadcasts,0);
 await call(controller,'join','bob');assert.equal(ctx.alarmCalls,writes+1);assert.equal(broadcasts,1);
 }finally{ctx.close();}
});
