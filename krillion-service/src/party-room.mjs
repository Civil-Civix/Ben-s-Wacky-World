import { PartyError, newRoom, member, joinRoom, startRoom, advance, answerRoom, roomAction, publicRoom, nextAlarm } from './party-engine.mjs';
import { normalize, TIERS, etDate } from '../public/rules.mjs';
const response=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
const BANK_LIMIT=24*1024*1024;
async function boundedPuzzle(content){
 if(typeof content==='string'){if(content.length>BANK_LIMIT)throw new Error('Oversize bank');return JSON.parse(content);}
 const bytes=new Uint8Array(content);if(bytes.byteLength>2*1024*1024)throw new Error('Oversize compressed bank');
 const reader=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader(),parts=[];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>BANK_LIMIT)throw new Error('Oversize expanded bank');parts.push(value);}}finally{await reader.cancel();}
 return JSON.parse(await new Blob(parts).text());
}
export async function loadPartyBanks(env){
 // Bounded historical reads only. Never silently fall back to the demo bank or
 // fetch a live mutable reference answer set for an ongoing match.
 const rows=await env.DB.prepare("SELECT date FROM puzzles WHERE date<=? AND length(content)<=2097152 AND source<>'OpenKrillion sample bank' AND CASE WHEN typeof(content)='blob' THEN 1 WHEN json_valid(content) THEN COALESCE(json_extract(content,'$.sample'),0)=0 ELSE 0 END ORDER BY date DESC LIMIT 3").bind(etDate()).all();
 for(const row of rows.results){
  try{
   const stored=await env.DB.prepare('SELECT content FROM puzzles WHERE date=?').bind(row.date).first(),puzzle=await boundedPuzzle(stored.content);
   if(puzzle.sample||puzzle.source==='OpenKrillion sample bank'||puzzle.date!==row.date||!Array.isArray(puzzle.prompts))continue;
   const banks=[];for(const p of puzzle.prompts.slice(0,7)){
    if(typeof p?.text!=='string'||!Array.isArray(p.answers)||!p.answers.length)continue;
    const seen=new Set(),answers=p.answers.filter(a=>{if(!a||typeof a.answer!=='string'||!normalize(a.answer)||!Object.hasOwn(TIERS,a.tier))return false;const k=normalize(a.answer);if(seen.has(k))return false;seen.add(k);return true;}).map(a=>({answer:a.answer,tier:a.tier,...(Array.isArray(a.aliases)?{aliases:a.aliases.filter(x=>typeof x==='string')}: {})}));
    if(answers.length)banks.push({id:`${row.date}:${banks.length}`,text:p.text,total:answers.length,answers});
   }
   if(banks.length)return banks;
  }catch(error){console.warn('Party snapshot unavailable',{date:row.date,message:error.message});}
 }
 throw new PartyError('Puffer Party needs a saved real puzzle. Play after a daily puzzle has synced.',503);
}
// This controller is also runtime-independent so the existing Node test suite
// can exercise storage/recovery. party-entry extends the platform base class.
export class PartyRoomController {
 constructor(ctx,env){this.ctx=ctx;this.env=env;this.pending=Promise.resolve();ctx.blockConcurrencyWhile(async()=>this.initialize());}
 initialize(){this.ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS party_data (key TEXT PRIMARY KEY,value TEXT NOT NULL)');}
 exclusive(fn){const result=this.pending.then(fn);this.pending=result.catch(()=>{});return result;}
 get(key){const row=this.ctx.storage.sql.exec('SELECT value FROM party_data WHERE key=?',key).toArray()[0];return row?.value;}
 read(){const raw=this.get('room');return raw?JSON.parse(raw):null;}
 put(key,value){this.ctx.storage.sql.exec('INSERT INTO party_data(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',key,value);}
 async save(room){this.put('room',JSON.stringify(room));await this.ctx.storage.setAlarm(nextAlarm(room));}
 bank(categoryId){const rows=this.ctx.storage.sql.exec("SELECT value FROM party_data WHERE key LIKE ? ORDER BY key",`bank:${categoryId}:%`).toArray();return JSON.parse(rows.map(r=>r.value).join(''));}
 saveBanks(banks){this.ctx.storage.transactionSync(()=>{this.ctx.storage.sql.exec("DELETE FROM party_data WHERE key LIKE 'bank:%'");for(const b of banks){const raw=JSON.stringify(b.answers);for(let i=0;i<raw.length;i+=60000)this.put(`bank:${b.id}:${String(i/60000).padStart(6,'0')}`,raw.slice(i,i+60000));}});}
 issueTicket(room,identity,now){const tickets=(JSON.parse(this.get('tickets')||'[]')).filter(t=>t.expires>now&&t.identity!==identity).slice(-31),ticket=crypto.randomUUID();tickets.push({ticket,identity,expires:now+120000});this.put('tickets',JSON.stringify(tickets));return ticket;}
 broadcast(room){for(const ws of this.ctx.getWebSockets()){try{const {identity}=ws.deserializeAttachment();if(!room.players.some(p=>p.identity===identity)){ws.close(1008,'Membership ended');continue;}ws.send(JSON.stringify({room:publicRoom(room,identity,Date.now())}));}catch{try{ws.close(1011,'Reconnect');}catch{}}}}
 async expire(room,now){if(!room||now<room.expiresAt&&room.players.length)return false;for(const ws of this.ctx.getWebSockets())try{ws.close(1001,'Room expired');}catch{}await this.ctx.storage.deleteAll();this.initialize();return true;}
 fetch(request){return this.exclusive(async()=>{
  try{
   const url=new URL(request.url),now=Date.now();let room=this.read();
   if(room&&await this.expire(room,now))room=null;
   if(url.pathname==='/ws')return this.socket(request,room,now);
   if(request.method!=='POST')throw new PartyError('Method not allowed.',405);
   let data;try{data=await request.json();}catch{throw new PartyError('Invalid request.');}
   if(!data||typeof data!=='object'||Array.isArray(data))throw new PartyError('Invalid request.');
   const identity=data.identity;
   if(typeof identity!=='string'||!identity||identity.length>180)throw new PartyError('Player identity required.',401);
   if(data.action==='create'){
    if(room)throw new PartyError('Room code already taken.',409);
    room=newRoom(data.code,identity,data.name,now,data.settings);await this.save(room);
    return response({room:publicRoom(room,identity,now),wsTicket:this.issueTicket(room,identity,now)});
   }
   if(!room)throw new PartyError('Room not found or expired.',404);
   let result=null,wsTicket;
   // Each DO operation, including external snapshot loading, runs through the
   // same queue. Concurrent guesses cannot score an answer or pass twice.
   const changed=advance(room,now);if(changed){await this.save(room);this.broadcast(room);}const savedVersion=room.version;
   if(data.action==='join'){joinRoom(room,identity,data.name,now);wsTicket=this.issueTicket(room,identity,now);}
   else {
    const actor=member(room,identity);
    if(data.action==='state'){}
    else if(data.action==='connect')wsTicket=this.issueTicket(room,identity,now);
    else {
     const limits=JSON.parse(this.get('limits')||'{}'),window=Math.floor(now/60000),entry=limits[actor.id];
     if(entry?.window===window&&entry.count>=120)throw new PartyError('Too many actions. Take a breath.',429);
     limits[actor.id]={window,count:entry?.window===window?entry.count+1:1};for(const id of Object.keys(limits))if(!room.players.some(p=>p.id===id))delete limits[id];this.put('limits',JSON.stringify(limits));
     if(data.action==='start'||data.action==='rematch'){
      if(actor.id!==room.hostId)throw new PartyError('Only the host can start.',403);
      if(!['lobby','finished'].includes(room.phase))throw new PartyError('The party is already running.',409);
      // Load before mutating the lobby, then persist an immutable per-match
      // snapshot. A later daily import cannot change scoring mid-match.
      const banks=await loadPartyBanks(this.env);startRoom(room,identity,banks.map(({answers,...meta})=>meta),Date.now());this.saveBanks(banks);
     }else if(data.action==='answer'){if(room.phase!=='playing')throw new PartyError('Wait for the puffer.',409);result=answerRoom(room,identity,data,this.bank(room.categories[room.categoryIndex]?.id),now);}
     else roomAction(room,identity,data,now);
    }
   }
   if(room.version!==savedVersion){await this.save(room);this.broadcast(room);}
   return response({room:publicRoom(room,identity,Date.now()),...(result?{result}:{}),...(wsTicket?{wsTicket}:{})});
  }catch(error){return response({error:error instanceof PartyError?error.message:'The room is temporarily unavailable.'},error.status||503);}
 });}
 socket(request,room,now){
  if(!room)throw new PartyError('Room not found.',404);
  if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket')throw new PartyError('WebSocket required.',426);
  const ticket=new URL(request.url).searchParams.get('ticket'),tickets=JSON.parse(this.get('tickets')||'[]'),record=tickets.find(t=>t.ticket===ticket&&t.expires>now);
  if(!record)throw new PartyError('Connection ticket expired. Reconnect.',401);member(room,record.identity);
  this.put('tickets',JSON.stringify(tickets.filter(t=>t!==record&&t.expires>now)));
  const peers=this.ctx.getWebSockets().filter(ws=>ws.deserializeAttachment()?.identity===record.identity);for(const ws of peers.slice(1))ws.close(1000,'Replaced connection');
  const [client,server]=Object.values(new WebSocketPair());this.ctx.acceptWebSocket(server);server.serializeAttachment({identity:record.identity});server.send(JSON.stringify({room:publicRoom(room,record.identity,now)}));return new Response(null,{status:101,webSocket:client});
 }
 alarm(){return this.exclusive(async()=>{const room=this.read(),now=Date.now();if(!room||await this.expire(room,now))return;advance(room,now);await this.save(room);this.broadcast(room);});}
 webSocketMessage(ws){try{ws.close(1008,'Use authenticated HTTP actions');}catch{}}
 webSocketClose(ws,code,reason){try{if(code>=1000&&code<5000&&![1004,1005,1006,1015].includes(code))ws.close(code,reason);else ws.close();}catch{}}
 webSocketError(ws){try{ws.close(1011,'Reconnect');}catch{}}
}
