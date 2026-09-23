import {scrypt,createHmac,timingSafeEqual,randomBytes,createHash} from 'node:crypto';
import gameIds from './game-ids.mjs';
const games=new Set(gameIds);
const SESSION_AGE=180*86400000;
const PUBLIC='id,username,bio,owner,created,play_ms,avatar_version';
class HTTPError extends Error {constructor(status,message){super(message);this.status=status;}}
const fail=(status,message)=>{throw new HTTPError(status,message);};
export const digest=value=>createHash('sha256').update(value).digest('hex');
export function passwordHash(password,salt,pepper){
 const input=createHmac('sha256',pepper).update(password).digest();
 return new Promise((resolve,reject)=>scrypt(input,Buffer.from(salt,'hex'),32,{N:16384,r:8,p:5,maxmem:32*1024*1024},(error,key)=>error?reject(error):resolve(key.toString('hex'))));
}
function publicUser(row){return {id:row.id,username:row.username,bio:row.bio,owner:!!row.owner,created:row.created,playSeconds:Math.floor(row.play_ms/1000),avatarVersion:row.avatar_version};}
function cookie(token,age=SESSION_AGE/1000){return '__Host-wacky_session='+token+'; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age='+age;}
async function bounded(request,max=4096){
 if(Number(request.headers.get('Content-Length'))>max)fail(413,'Upload is too large.');
 const reader=request.body?.getReader();if(!reader)fail(400,'A request body is required.');
 const chunks=[];let size=0;
 try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();fail(413,'Upload is too large.');}chunks.push(value);}}
 finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}return bytes;
}
async function body(request){
 if(request.headers.get('Content-Type')?.split(';')[0]!=='application/json')fail(415,'JSON is required.');
 try{return JSON.parse(new TextDecoder().decode(await bounded(request)));}catch(e){if(e instanceof HTTPError)throw e;fail(400,'Invalid request.');}
}
function username(value){if(typeof value!=='string'||!/^[A-Za-z0-9_]{3,20}$/.test(value))fail(400,'Username must be 3–20 letters, numbers or underscores.');return value;}
async function session(request,env,now){
 const token=/(?:^|;\s*)__Host-wacky_session=([a-f0-9]{64})(?:;|$)/.exec(request.headers.get('Cookie')||'')?.[1];
 if(!token)fail(401,'Please log in.');
 const row=await env.DB.prepare('SELECT users.*,sessions.token_hash FROM sessions JOIN users ON users.id=sessions.user_id WHERE token_hash=? AND expires>?').bind(digest(token),now).first();
 if(!row)fail(401,'Please log in again.');return row;
}
async function newSession(env,id,now){
 const token=randomBytes(32).toString('hex');
 await env.DB.prepare('INSERT INTO sessions(token_hash,user_id,expires) VALUES(?,?,?)').bind(digest(token),id,now+SESSION_AGE).run();
 return token;
}
export function validJPEG(bytes){
 if(bytes.length<4||bytes[0]!==255||bytes[1]!==216||bytes[bytes.length-2]!==255||bytes[bytes.length-1]!==217)return false;
 let p=2;
 while(p+4<=bytes.length){
  if(bytes[p++]!==255)return false;
  const marker=bytes[p++];if(marker===218)break;
  const length=(bytes[p]<<8)|bytes[p+1];if(length<2||p+length>bytes.length)return false;
  if([192,193,194].includes(marker)){
   const height=(bytes[p+3]<<8)|bytes[p+4],width=(bytes[p+5]<<8)|bytes[p+6];
   return length>=8&&width>0&&width<=256&&height>0&&height<=256;
  }p+=length;
 }return false;
}
export default {
 async fetch(request,env){
  const url=new URL(request.url),path=url.pathname,now=Date.now();
  const origin=request.headers.get('Origin');
  const publicGet=request.method==='GET'&&(path==='/leaderboard'||path.startsWith('/profiles/')||path.startsWith('/avatars/'));
  const cors=origin===env.ALLOWED_ORIGIN?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Credentials':'true','Vary':'Origin'}:publicGet?{'Access-Control-Allow-Origin':'*'}:{};
  const json=(data,status=200,extra={})=>Response.json(data,{status,headers:{...cors,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra}});
  try{
   if(!publicGet&&origin!==env.ALLOWED_ORIGIN)fail(403,'Origin not allowed.');
   if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...cors,'Access-Control-Allow-Methods':'GET, POST, PATCH, DELETE, PUT, OPTIONS','Access-Control-Allow-Headers':'Content-Type, X-Wacky-Client','Access-Control-Max-Age':'86400'}});
   if(request.method!=='GET'&&request.headers.get('X-Wacky-Client')!=='1')fail(403,'Invalid client.');
   const ip=digest(now.toString().slice(0,5)+':'+(request.headers.get('CF-Connecting-IP')||'unknown'));
   if(!(await env.REQUEST_LIMIT.limit({key:ip})).success)fail(429,'Too many requests. Please try again in a minute.');
   if(path==='/leaderboard'&&request.method==='GET'){
    const q=(url.searchParams.get('q')||'').slice(0,20).toLowerCase().replace(/[^a-z0-9_]/g,'');
    const offset=Math.min(100000,Math.max(0,parseInt(url.searchParams.get('offset')||'0',10)||0));
    const query='WITH ranked AS (SELECT '+PUBLIC+',ROW_NUMBER() OVER(ORDER BY play_ms DESC,username_key ASC) AS rank FROM users) SELECT * FROM ranked WHERE lower(username) LIKE ? ESCAPE \'\\\' ORDER BY rank LIMIT 51 OFFSET ?';
    const rows=await env.DB.prepare(query).bind('%'+q.replace(/_/g,'\\_')+'%',offset).all();
    const top=await env.DB.prepare('SELECT '+PUBLIC+' FROM users ORDER BY play_ms DESC,username_key ASC LIMIT 3').all();
    return json({users:rows.results.slice(0,50).map(r=>({...publicUser(r),rank:r.rank})),hasMore:rows.results.length>50,top:top.results.map((r,i)=>({...publicUser(r),rank:i+1}))});
   }
   if(path.startsWith('/profiles/')&&request.method==='GET'){
    const row=await env.DB.prepare('SELECT '+PUBLIC+' FROM users WHERE id=?').bind(path.slice(10)).first();
    if(!row)fail(404,'Profile not found.');return json({user:publicUser(row)});
   }
   if(path.startsWith('/avatars/')&&request.method==='GET'){
    const row=await env.DB.prepare('SELECT data FROM avatars WHERE user_id=?').bind(path.slice(9)).first();
    if(!row)fail(404,'Photo not found.');
    return new Response(new Uint8Array(row.data),{headers:{...cors,'Content-Type':'image/jpeg','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox",'Cache-Control':'public,max-age=300'}});
   }
   if(['/signup','/login'].includes(path)&&request.method==='POST'){
    const data=await body(request),name=username(data.username),key=name.toLowerCase();
    if(typeof data.password!=='string'||data.password.length<1||data.password.length>128)fail(400,'Enter your password (up to 128 characters).');
    if(!(await env.AUTH_LIMIT.limit({key:'ip:'+ip})).success||!(await env.LOGIN_LIMIT.limit({key:'user:'+digest(key)})).success)fail(429,'Too many login attempts. Wait a minute and try again.');
    if(path==='/signup'){
     if(data.password.length<8)fail(400,'Use a password with at least 8 characters.');
     if(data.noRecovery!==true)fail(400,'Acknowledge that passwords cannot be recovered.');
     if(key==='wackyben')fail(409,'That username is unavailable.');
     if(await env.DB.prepare('SELECT id FROM users WHERE username_key=?').bind(key).first())fail(409,'That username is unavailable.');
     const id=crypto.randomUUID(),salt=randomBytes(16).toString('hex'),hash=await passwordHash(data.password,salt,env.PASSWORD_PEPPER);
     try{await env.DB.prepare('INSERT INTO users(id,username,username_key,salt,password_hash,created) VALUES(?,?,?,?,?,?)').bind(id,name,key,salt,hash,now).run();}
     catch(e){if(String(e).includes('UNIQUE'))fail(409,'That username is unavailable.');throw e;}
     const token=await newSession(env,id,now);
     const row=await env.DB.prepare('SELECT '+PUBLIC+' FROM users WHERE id=?').bind(id).first();
     return json({user:publicUser(row)},201,{'Set-Cookie':cookie(token)});
    }
    const row=await env.DB.prepare('SELECT * FROM users WHERE username_key=?').bind(key).first();
    const candidate=await passwordHash(data.password,row?.salt||'00000000000000000000000000000000',env.PASSWORD_PEPPER);
    if(!row||!timingSafeEqual(Buffer.from(candidate,'hex'),Buffer.from(row.password_hash,'hex')))fail(401,'Incorrect username or password.');
    const token=await newSession(env,row.id,now);return json({user:publicUser(row)},200,{'Set-Cookie':cookie(token)});
   }
   const me=await session(request,env,now);
   if(path==='/me'&&request.method==='GET')return json({user:publicUser(me)});
   if(path==='/logout'&&request.method==='POST'){
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(me.token_hash).run();
    return json({ok:true},200,{'Set-Cookie':cookie('',0)});
   }
   if(path==='/me'&&request.method==='PATCH'){
    const data=await body(request),name=username(data.username),key=name.toLowerCase();
    if((me.owner&&key!=='wackyben')||(!me.owner&&key==='wackyben'))fail(400,'That username is reserved.');
    if(typeof data.bio!=='string'||data.bio.length>280)fail(400,'Bio must be 280 characters or fewer.');
    try{await env.DB.prepare('UPDATE users SET username=?,username_key=?,bio=? WHERE id=?').bind(name,key,data.bio.trim(),me.id).run();}
    catch(e){if(String(e).includes('UNIQUE'))fail(409,'That username is unavailable.');throw e;}
    const row=await env.DB.prepare('SELECT '+PUBLIC+' FROM users WHERE id=?').bind(me.id).first();return json({user:publicUser(row)});
   }
   if(path==='/avatar'&&['PUT','DELETE'].includes(request.method)){
    if(request.method==='PUT'){
     if(request.headers.get('Content-Type')!=='image/jpeg')fail(415,'Use a JPEG photo.');
     const bytes=await bounded(request,49152);if(!validJPEG(bytes))fail(400,'Use a JPEG photo no larger than 256 × 256.');
     await env.DB.batch([env.DB.prepare('INSERT INTO avatars(user_id,data) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data').bind(me.id,bytes.buffer),env.DB.prepare('UPDATE users SET avatar_version=? WHERE id=?').bind(now,me.id)]);
    }else await env.DB.batch([env.DB.prepare('DELETE FROM avatars WHERE user_id=?').bind(me.id),env.DB.prepare('UPDATE users SET avatar_version=0 WHERE id=?').bind(me.id)]);
    const row=await env.DB.prepare('SELECT '+PUBLIC+' FROM users WHERE id=?').bind(me.id).first();return json({user:publicUser(row)});
   }
   if(path==='/play/start'&&request.method==='POST'){
    const data=await body(request);if(!games.has(data.gameId))fail(400,'Choose a game.');
    const lease=crypto.randomUUID();
    const result=await env.DB.prepare('INSERT INTO activity(user_id,lease,last_seen,seq,accrued) VALUES(?,?,?,0,0) ON CONFLICT(user_id) DO UPDATE SET lease=excluded.lease,last_seen=excluded.last_seen,seq=0,accrued=0 WHERE activity.lease IS NULL OR activity.last_seen<?').bind(me.id,lease,now,now-65000).run();
    if(!result.meta.changes)fail(409,'Playtime is counting in another tab or device.');
    return json({lease});
   }
   if(path==='/play/pulse'&&request.method==='POST'){
    const data=await body(request);
    if(typeof data.lease!=='string'||!Number.isSafeInteger(data.seq)||data.seq<1||!Number.isFinite(data.elapsed)||data.elapsed<0||data.elapsed>60000||typeof data.stop!=='boolean')fail(400,'Invalid timer update.');
    const result=await env.DB.prepare('UPDATE activity SET accrued=CASE WHEN ?-last_seen BETWEEN 0 AND 65000 THEN MIN(?-last_seen,?) ELSE 0 END,last_seen=?,seq=?,lease=CASE WHEN ? THEN NULL ELSE lease END WHERE user_id=? AND lease=? AND seq=?').bind(now,now,Math.floor(data.elapsed),now,data.seq,data.stop?1:0,me.id,data.lease,data.seq-1).run();
    if(!result.meta.changes)fail(409,'This timer is no longer active.');
    const row=await env.DB.prepare('SELECT '+PUBLIC+' FROM users WHERE id=?').bind(me.id).first();return json({user:publicUser(row)});
   }
   fail(404,'Not found.');
  }catch(e){
   if(e instanceof HTTPError)return json({error:e.message},e.status);
   console.error(JSON.stringify({event:'account_error',route:path}));
   return json({error:'Account service is temporarily unavailable. Please try again.'},503);
  }
 },
 async scheduled(controller,env){await env.DB.prepare('DELETE FROM sessions WHERE expires<?').bind(Date.now()).run();}
};
