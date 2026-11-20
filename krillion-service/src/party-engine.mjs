import { TIERS, normalize, matchAnswer } from '../public/rules.mjs';
export const DEFAULT_SETTINGS = Object.freeze({hearts:2,maxHearts:5,meterTarget:600,maxPlayers:6});
export class PartyError extends Error { constructor(message,status=400){super(message);this.status=status;} }
const requireThat=(ok,message,status=400)=>{if(!ok)throw new PartyError(message,status);};
export function settingsFor(input={}){
 requireThat(input&&typeof input==='object'&&!Array.isArray(input),'Invalid party settings.');
 const hearts=input.hearts??2,maxPlayers=input.maxPlayers??6;
 requireThat(Number.isInteger(hearts)&&hearts>=1&&hearts<=5,'Choose 1–5 starting hearts.');
 requireThat(Number.isInteger(maxPlayers)&&maxPlayers>=2&&maxPlayers<=16,'Choose 2–16 players.');
 return {...DEFAULT_SETTINGS,hearts,maxPlayers};
}
export function newRoom(code,identity,name,now,settings={}){
 const player=makePlayer(identity,name);return {code,version:1,createdAt:now,updatedAt:now,expiresAt:now+24*3600000,phase:'lobby',settings:settingsFor(settings),players:[player],hostId:player.id,holderId:null,roundId:0,phaseEndsAt:null,fuseEndsAt:null,categoryIndex:0,categories:[],used:{},winnerId:null,lastEvent:null,match:0};
}
function makePlayer(identity,name){
 requireThat(typeof name==='string'&&name.trim().length>0,'Enter a player name.');
 return {id:crypto.randomUUID(),identity,name:name.trim().replace(/[\u0000-\u001f\u007f]/g,'').slice(0,24)||'Puffer',hearts:0,meter:0,score:0,eliminated:false};
}
export function member(room,identity){const p=room.players.find(p=>p.identity===identity);requireThat(p,'Join this room first.',403);return p;}
export function joinRoom(room,identity,name,now){
 const old=room.players.find(p=>p.identity===identity);if(old)return old;
 requireThat(room.phase==='lobby'||room.phase==='finished','This party has already started.',409);
 requireThat(room.players.length<room.settings.maxPlayers,'This party is full.',409);
 const p=makePlayer(identity,name);room.players.push(p);touch(room,now);return p;
}
function touch(room,now){room.version++;room.updatedAt=now;}
const alive=room=>room.players.filter(p=>!p.eliminated&&p.hearts>0);
function nextAlive(room,id){const i=room.players.findIndex(p=>p.id===id);for(let n=1;n<=room.players.length;n++){const p=room.players[(i+n)%room.players.length];if(!p.eliminated&&p.hearts>0)return p.id;}return null;}
function finish(room,now){const survivors=alive(room);if(survivors.length>1)return false;room.phase='finished';room.winnerId=survivors[0]?.id||null;room.holderId=null;room.fuseEndsAt=null;room.phaseEndsAt=null;room.lastEvent={type:'winner',playerId:room.winnerId,at:now};return true;}
function pickCategory(room){
 for(let n=1;n<=room.categories.length;n++){const index=(room.categoryIndex+n)%room.categories.length,category=room.categories[index];if((room.used[category.id]||[]).length<category.total){room.categoryIndex=index;return true;}}
 // Every immutable answer snapshot has been exhausted. Stop fairly rather than
 // silently allowing repeated answers or swapping in a different answer bank.
 room.phase='finished';room.holderId=null;room.fuseEndsAt=null;room.phaseEndsAt=null;room.winnerId=null;room.lastEvent={type:'bankExhausted'};return false;
}
function beginFuse(room,now,random){room.fuseEndsAt=now+10000+Math.floor(random()*20001);room.phase='playing';room.phaseEndsAt=null;room.roundId++;}
export function startRoom(room,identity,categories,now,random=Math.random){
 const actor=member(room,identity);requireThat(actor.id===room.hostId,'Only the host can start.',403);
 requireThat(['lobby','finished'].includes(room.phase),'The party is already running.',409);
 requireThat(room.players.length>=2,'At least two players are needed.',409);
 requireThat(categories.length>0,'No saved real categories are available. Try after a daily puzzle has synced.',503);
 room.categories=categories;room.categoryIndex=0;room.used={};room.match++;room.winnerId=null;
 for(const p of room.players){p.hearts=room.settings.hearts;p.meter=0;p.score=0;p.eliminated=false;}
 room.holderId=room.players[Math.floor(random()*room.players.length)].id;room.phase='countdown';room.phaseEndsAt=now+3000;room.fuseEndsAt=null;room.lastEvent={type:'start',at:now};room.roundId++;touch(room,now);
}
export function advance(room,now,random=Math.random){
 let changed=false;
 // Advance only the due transition. A delayed alarm must not replay multiple
 // new fuses instantly and eliminate absent players in a single request.
 if(room.phase==='countdown'&&now>=room.phaseEndsAt){beginFuse(room,now,random);changed=true;}
 else if(room.phase==='playing'&&now>=room.fuseEndsAt){
  const p=room.players.find(p=>p.id===room.holderId);if(p){p.hearts=Math.max(0,p.hearts-1);p.eliminated=p.hearts===0;}
  room.lastEvent={type:'pop',playerId:p?.id,eliminated:!!p?.eliminated,at:now};room.roundId++;room.fuseEndsAt=null;
  if(!finish(room,now)){room.nextHolderId=nextAlive(room,p?.id);room.phase='pop';room.phaseEndsAt=now+1500;}changed=true;
 }else if(room.phase==='pop'&&now>=room.phaseEndsAt){
  if(pickCategory(room)){room.holderId=room.nextHolderId;room.nextHolderId=null;room.phase='swap';room.phaseEndsAt=now+1300;room.resumeFuseMs=null;}changed=true;
 }else if(room.phase==='swap'&&now>=room.phaseEndsAt){
  if(room.resumeFuseMs!=null){room.phase='playing';room.phaseEndsAt=null;room.fuseEndsAt=now+room.resumeFuseMs;room.resumeFuseMs=null;room.roundId++;}else beginFuse(room,now,random);changed=true;
 }
 if(changed)touch(room,now);return changed;
}
export function answerRoom(room,identity,data,answers,now){
 const actor=member(room,identity);
 requireThat(room.phase==='playing','Wait for the puffer.',409);
 requireThat(actor.id===room.holderId&&!actor.eliminated,'The puffer belongs to another player.',409);
 requireThat(data.roundId===room.roundId,'The puffer moved. Try again on your next turn.',409);
 const raw=typeof data.answer==='string'?data.answer.trim().slice(0,256):'';
 requireThat(raw,'Enter an answer.');
 const found=matchAnswer(raw,answers);if(!found)return {accepted:false,message:'No match. Try another answer.'};
 const category=room.categories[room.categoryIndex],key=normalize(found.answer),used=room.used[category.id]||[];
 if(used.includes(key))return {accepted:false,message:'That answer was already used in this category.'};
 room.used[category.id]=[...used,key];const points=TIERS[found.tier].score;actor.score+=points;actor.meter+=points;let heartGained=false;
 if(actor.meter>=600&&actor.hearts<5){actor.meter-=600;actor.hearts++;heartGained=true;}
 if(actor.hearts>=5)actor.meter=Math.min(actor.meter,599);
 const passed=true;
 room.holderId=nextAlive(room,actor.id);room.fuseEndsAt=Math.max(room.fuseEndsAt,now+8000);room.roundId++;
 const result={accepted:true,answer:found.answer,tier:found.tier,score:points,passed,heartGained,message:'Puffer passed!'};
 room.lastEvent={type:'answer',playerId:actor.id,...result,at:now};
 if(room.used[category.id].length>=category.total){const remaining=room.fuseEndsAt-now;if(pickCategory(room)){room.phase='swap';room.phaseEndsAt=now+1300;room.resumeFuseMs=remaining;room.fuseEndsAt=null;room.roundId++;}}
 touch(room,now);return result;
}
export function roomAction(room,identity,data,now){
 const actor=member(room,identity),host=actor.id===room.hostId;
 if(data.action==='settings'){
  requireThat(host,'Only the host can change settings.',403);requireThat(['lobby','finished'].includes(room.phase),'Settings are locked during play.',409);
  const settings=settingsFor({...room.settings,...data.settings});requireThat(settings.maxPlayers>=room.players.length,'The room already has more players.');room.settings=settings;
 }else if(data.action==='leave'||data.action==='kick'){
  const id=data.action==='leave'?actor.id:data.playerId;
  if(data.action==='kick'){requireThat(host,'Only the host can remove players.',403);requireThat(id!==actor.id,'Use Leave to exit your room.');requireThat(['lobby','finished'].includes(room.phase),'Players can only be removed between matches.',409);}
  requireThat(room.players.some(p=>p.id===id),'Player not found.',404);
  const next=nextAlive(room,id);room.players=room.players.filter(p=>p.id!==id);
  if(room.hostId===id)room.hostId=room.players[0]?.id||null;
  if(!['lobby','finished'].includes(room.phase)){if(!finish(room,now)&&room.holderId===id){room.holderId=next;room.roundId++;}if(room.nextHolderId===id)room.nextHolderId=next;}
 }else throw new PartyError('Unknown party action.');
 touch(room,now);
}
export function publicRoom(room,identity,now){
 const you=room.players.find(p=>p.identity===identity),category=room.categories[room.categoryIndex];
 return {code:room.code,version:room.version,serverNow:now,expiresAt:room.expiresAt,phase:room.phase,hostId:room.hostId,youId:you?.id||null,settings:{...room.settings},players:room.players.map(({identity,...p})=>({...p,host:p.id===room.hostId})),holderId:room.holderId,roundId:room.roundId,category:category?{id:category.id,text:category.text,total:category.total,usedCount:(room.used[category.id]||[]).length}:null,phaseEndsAt:room.phaseEndsAt,winnerId:room.winnerId,lastEvent:room.lastEvent,match:room.match};
}
export function nextAlarm(room){if(!room.players.length)return Date.now()+1000;return Math.min(room.expiresAt,room.phase==='playing'?room.fuseEndsAt:room.phaseEndsAt||room.expiresAt);}

