import { rankedPlayer } from './ranking.mjs';
const json=(body,status=200,extra={})=>Response.json(body,{status,headers:{'Cache-Control':'no-store',...extra}});
const fail=(message,status=400)=>json({error:message},status);
const codeFor=()=>{const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',bytes=crypto.getRandomValues(new Uint8Array(6));return [...bytes].map(b=>alphabet[b%32]).join('');};
function guest(request){const value=request.headers.get('X-Krillion-Player')||request.headers.get('Cookie')?.match(/(?:^|;\s*)ok_player=([a-f0-9-]{36})/)?.[1];return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value||'')?value:null;}
async function allowed(env,request,identity,kind){
 const window=Math.floor(Date.now()/60000),raw=`party:${kind}|${request.headers.get('CF-Connecting-IP')||identity}|${window}`;
 const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw)))].map(b=>b.toString(16).padStart(2,'0')).join('');
 const row=await env.DB.prepare('INSERT INTO rate_limits(key,window,count) VALUES(?,?,1) ON CONFLICT(key,window) DO UPDATE SET count=count+1 RETURNING count').bind(hash,window).first();
 if(row.count===1)await env.DB.prepare('DELETE FROM rate_limits WHERE window<?').bind(window-5).run();return row.count<=(kind==='create'?10:180);
}
async function readBody(request){
 const reader=request.body?.getReader();if(!reader)return '';
 const parts=[];let size=0;try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096){await reader.cancel();return null;}parts.push(value);}}finally{reader.releaseLock();}
 return new Blob(parts).text();
}
export async function partyAPI(request,env,url){
 if(!env.PARTY_ROOMS)return fail('Puffer Party is not configured on this server.',503);
 const route=url.pathname.slice('/api/party/'.length),ws=route==='ws';
 if(!['create','join','state','action','ws'].includes(route))return fail('Unknown party endpoint.',404);
 if((ws||request.method==='POST')&&request.headers.get('Origin')&&request.headers.get('Origin')!==url.origin)return fail('Cross-origin requests are not accepted.',403);
 if(ws&&!request.headers.get('Origin'))return fail('An origin is required for a party connection.',403);
 if(ws){const code=(url.searchParams.get('code')||'').toUpperCase();if(!/^[A-HJ-NP-Z2-9]{6}$/.test(code))return fail('Enter a valid room code.');const internal=new URL('https://party.internal/ws');internal.searchParams.set('ticket',url.searchParams.get('ticket')||'');return env.PARTY_ROOMS.getByName(code).fetch(new Request(internal,request));}
 if(route==='state'?request.method!=='GET':request.method!=='POST')return fail('Method not allowed.',405);
 let account;try{account=await rankedPlayer(request,env);}catch{return fail('Your account connection expired. Reopen Krillion to reconnect.',401);}
 let token=guest(request);if(!token&&(route==='create'||route==='join'))token=crypto.randomUUID();
 const identity=account?'account:'+account:token;if(!identity)return fail('Join a room on this browser first.',401);
 let data={};if(request.method==='POST'){
  if(Number(request.headers.get('Content-Length')||0)>4096)return fail('Request is too large.',413);
  try{const raw=await readBody(request);if(raw===null)return fail('Request is too large.',413);data=JSON.parse(raw);if(!data||typeof data!=='object'||Array.isArray(data))throw new Error();}catch{return fail('Invalid request.');}
  if(!await allowed(env,request,identity,route==='create'?'create':'action'))return fail('Too many requests. Take a breath.',429);
 }
 const code=route==='create'?codeFor():String(route==='state'?url.searchParams.get('code')||'':data.code||'').trim().toUpperCase();
 if(!/^[A-HJ-NP-Z2-9]{6}$/.test(code))return fail('Enter a valid six-character room code.');
 const action=route==='action'?data.action:route;
 if(!(route==='action'?['connect','settings','start','rematch','answer','leave','kick']:[route]).includes(action))return fail('Unknown party action.');
 const result=await env.PARTY_ROOMS.getByName(code).fetch(new Request('https://party.internal/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,identity,code,name:data.name,settings:data.settings,playerId:data.playerId,answer:data.answer,roundId:data.roundId})}));
 const body=await result.json();if(result.ok&&(route==='create'||route==='join'))body.playerToken=token;
 return json(body,result.status,result.ok&&token?{'Set-Cookie':`ok_player=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${url.protocol==='https:'?'; Secure':''}`} : {});
}
