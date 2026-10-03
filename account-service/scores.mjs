import {inflateSync} from 'node:zlib';
import {createHmac,timingSafeEqual} from 'node:crypto';
import tracks from './poly-tracks.mjs';
const trackIds=new Set(tracks.map(t=>t.id));
export async function battleResult({request,env,now,body,fail,json}){
 if(request.method!=='POST')fail(405,'POST required.');
 if(!env.BATTLE_RESULT_SECRET)fail(503,'Battle rankings are not configured yet.');
 const d=await body(request),signature=request.headers.get('X-Battle-Signature')||'';
 if(!/^[a-f0-9]{64}$/.test(signature))fail(403,'Invalid result signature.');
 const expected=createHmac('sha256',env.BATTLE_RESULT_SECRET).update(JSON.stringify(d)).digest();
 if(!timingSafeEqual(Buffer.from(signature,'hex'),expected))fail(403,'Invalid result signature.');
 if(typeof d.battleId!=='string'||!/^battle-gen9randombattle-[a-z0-9-]{1,100}$/.test(d.battleId)||d.format!=='gen9randombattle'||d.rated!==true||!Number.isSafeInteger(d.finished)||d.finished<0||d.finished>now+60000)fail(400,'Invalid ranked battle.');
 const account=name=>typeof name==='string'&&/^bww[a-f0-9]{32}$/.test(name)?name.slice(3).replace(/^(........)(....)(....)(....)(............)$/,'$1-$2-$3-$4-$5'):null;
 const winner=account(d.winner),loser=account(d.loser);
 if(!winner||!loser||winner===loser)fail(400,'Two different site profiles are required.');
 const found=await env.DB.prepare('SELECT COUNT(*) AS n FROM users WHERE id IN (?,?) AND banned=0 AND suspended_until<=?').bind(winner,loser,now).first();
 if(found.n!==2)fail(400,'Player unavailable.');
 await env.DB.prepare('INSERT OR IGNORE INTO battle_results VALUES(?,?,?,?)').bind(d.battleId,winner,loser,d.finished).run();
 return json({ok:true});
}
export async function scoreRead({url,env,now,fail,json,publicUser}){
 const path=url.pathname;
 if(path==='/poly/tracks')return json({tracks});
 const offset=Math.min(100000,Math.max(0,parseInt(url.searchParams.get('offset'))||0));
 const q=(url.searchParams.get('q')||'').slice(0,20).replace(/[^a-z0-9_]/gi,'');
 const pattern='%'+q.replace(/_/g,'\\_')+'%';
 if(path==='/leaderboard'){
 const cte=`WITH scores AS (SELECT users.*,COUNT(b.battle_id) AS wins FROM users JOIN battle_results b ON b.winner=users.id WHERE banned=0 AND suspended_until<=? GROUP BY users.id),ranked AS (SELECT *,ROW_NUMBER() OVER(ORDER BY wins DESC,username_key ASC) AS rank FROM scores) `;
 const rows=await env.DB.prepare(cte+"SELECT * FROM ranked WHERE username LIKE ? ESCAPE '\\' ORDER BY rank LIMIT 51 OFFSET ?").bind(now,pattern,offset).all();
 const top=await env.DB.prepare(cte+'SELECT * FROM ranked ORDER BY rank LIMIT 3').bind(now).all();
 const out=r=>({...publicUser(r),rank:r.rank,wins:r.wins});
 return json({users:rows.results.slice(0,50).map(out),top:top.results.map(out),hasMore:rows.results.length>50});
 }
 if(path==='/poly/replays'){
 const ids=(url.searchParams.get('ids')||'').split(',');if(!ids.length||ids.length>10||ids.some(x=>!/^\d{1,12}$/.test(x)))fail(400,'Invalid replay IDs.');
 const rows=await env.DB.prepare('SELECT p.id,p.track,p.frames,p.recording,p.car_style AS carStyle,u.username AS nickname FROM poly_records p JOIN users u ON u.id=p.user_id WHERE p.id IN ('+ids.map(()=>'?').join(',')+') AND u.banned=0 AND u.suspended_until<=?').bind(...ids.map(Number),now).all();
 return json({recordings:ids.map(id=>rows.results.find(r=>r.id===Number(id))||null)});
 }
 const track=url.searchParams.get('track');if(!trackIds.has(track))fail(400,'Choose an official track.');
 const limit=Math.min(50,Math.max(1,parseInt(url.searchParams.get('limit'))||50));
 const cte=`WITH ranked AS (SELECT u.*,p.id AS replay_id,p.frames,p.car_style,p.updated,ROW_NUMBER() OVER(ORDER BY p.frames,p.updated,p.id) AS position FROM poly_records p JOIN users u ON u.id=p.user_id WHERE p.track=? AND u.banned=0 AND u.suspended_until<=?) `;
 const rows=await env.DB.prepare(cte+"SELECT * FROM ranked WHERE username LIKE ? ESCAPE '\\' ORDER BY position LIMIT ? OFFSET ?").bind(track,now,pattern,limit+1,offset).all();
 const total=await env.DB.prepare(cte+'SELECT COUNT(*) AS n FROM ranked').bind(track,now).first();
 const own=await env.DB.prepare(cte+'SELECT replay_id AS id,position,frames FROM ranked WHERE id=?').bind(track,now,url.searchParams.get('user')||'').first();
 const top=await env.DB.prepare(cte+'SELECT * FROM ranked ORDER BY position LIMIT 3').bind(track,now).all();
 const out=r=>({id:r.replay_id,userId:r.id,nickname:r.username,frames:r.frames,carStyle:r.car_style,position:r.position,profile:publicUser(r)});
 return json({entries:rows.results.slice(0,limit).map(out),top:top.results.map(out),total:total.n,userEntry:own,hasMore:rows.results.length>limit});
}
export function validRecording(value){
 if(typeof value!=='string'||value.length>20000||! /^[A-Za-z0-9_-]+$/.test(value))return false;
 try{const bytes=inflateSync(Buffer.from(value,'base64url'),{maxOutputLength:65536});let offset=0;
 for(let group=0;group<5;group++){if(offset+3>bytes.length)return false;const count=bytes.readUIntLE(offset,3);offset+=3;if(offset+count*3>bytes.length)return false;let frame=0;
 for(let i=0;i<count;i++){const delta=bytes.readUIntLE(offset,3);offset+=3;if(i>0&&delta===0)return false;frame+=delta;if(frame>5999999)return false;}}
 return offset===bytes.length;
 }catch{return false;}
}
export async function polySubmit({request,env,me,now,body,fail,json}){
 if(request.method!=='POST')fail(405,'POST required.');
 const d=await body(request,24000);
 if(!trackIds.has(d?.track)||!Number.isSafeInteger(d.frames)||d.frames<1000||d.frames>3600000||typeof d.recording!=='string'||d.recording.length<1||d.recording.length>20000||typeof d.carStyle!=='string'||d.carStyle.length>1024)fail(400,'Invalid track, time or replay.');
 if(!validRecording(d.recording)||! /^[A-Za-z0-9_-]*$/.test(d.carStyle))fail(400,'Invalid replay data.');
 const allowed=await env.DB.prepare('INSERT INTO poly_limits VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET last_submit=excluded.last_submit WHERE last_submit<=? RETURNING user_id').bind(me.id,now,now-3000).first();
 if(!allowed)fail(429,'Wait a few seconds before submitting another run.');
 const result=await env.DB.prepare('INSERT INTO poly_records(user_id,track,frames,recording,car_style,updated) VALUES(?,?,?,?,?,?) ON CONFLICT(user_id,track) DO UPDATE SET frames=excluded.frames,recording=excluded.recording,car_style=excluded.car_style,updated=excluded.updated WHERE excluded.frames<poly_records.frames').bind(me.id,d.track,d.frames,d.recording,d.carStyle,now).run();
 return json({ok:true,improved:result.meta.changes>0});
}
