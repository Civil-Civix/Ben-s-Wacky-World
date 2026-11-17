const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const roomCode=value=>String(value||'').trim().toUpperCase();
export async function phone({request,url,env,me,now,body,fail,json}){
 const path=url.pathname,actor={id:me.id,username:me.username,owner:!!me.owner};
 const objectBody=async(request,max)=>{const value=await body(request,max);if(!value||typeof value!=='object'||Array.isArray(value))fail(400,'Invalid request.');return value;};
 if(path==='/phone/me'&&request.method==='GET')return json({user:{id:me.id,username:me.username}});
 const budget=async(kind,max)=>{const bucket=Math.floor(now/3600000);const row=await env.DB.prepare('INSERT INTO phone_limits(user_id,kind,bucket,count) VALUES(?,?,?,1) ON CONFLICT(user_id,kind) DO UPDATE SET bucket=excluded.bucket,count=CASE WHEN phone_limits.bucket=excluded.bucket THEN phone_limits.count+1 ELSE 1 END WHERE phone_limits.bucket<>excluded.bucket OR phone_limits.count<? RETURNING count').bind(me.id,kind,bucket,max).first();if(!row)fail(429,'Please wait before trying again.');};
 if(path==='/phone/admin/reports'&&request.method==='GET'){
  if(!me.owner)fail(403,'Owner access required.');
  const status=url.searchParams.get('status')||'open',before=Number(url.searchParams.get('before')||Number.MAX_SAFE_INTEGER);if(!['open','reviewed','removed'].includes(status)||!Number.isSafeInteger(before))fail(400,'Invalid filter.');
  const rows=await env.DB.prepare('SELECT * FROM phone_reports WHERE status=? AND id<? ORDER BY id DESC LIMIT 21').bind(status,before).all();return json({reports:rows.results.slice(0,20).map(r=>({...r,snapshot:JSON.parse(r.snapshot)})),hasMore:rows.results.length>20});
 }
 if(path==='/phone/admin/report'&&request.method==='POST'){
  if(!me.owner)fail(403,'Owner access required.');const d=await objectBody(request,1024);if(!Number.isSafeInteger(d.id)||!['reviewed','removed'].includes(d.status))fail(400,'Invalid report.');
  const r=await env.DB.prepare('SELECT * FROM phone_reports WHERE id=?').bind(d.id).first();if(!r)fail(404,'Report not found.');
  if(d.status==='removed'){const result=await env.PHONE_ROOMS.getByName(r.room).command(actor,'remove-entry',{chainId:Number(r.chain_id),round:r.round});if(result.error&&result.status!==404)fail(result.status||400,result.error);}
  await env.DB.batch([env.DB.prepare('UPDATE phone_reports SET status=? WHERE id=?').bind(d.status,d.id),env.DB.prepare('INSERT INTO admin_log(actor,target,action,details,created) VALUES(?,?,?,?,?)').bind(me.id,r.author_id,'phone-report',JSON.stringify({reason:'Wacky Phone report '+d.status,reportId:r.id,room:r.room}),now)]);return json({ok:true});
 }
 let code,action,data={};
 if(path==='/phone/create'&&request.method==='POST'){
  await budget('create',6);for(let attempt=0;attempt<5;attempt++){code=Array.from(crypto.getRandomValues(new Uint8Array(6)),n=>alphabet[n%alphabet.length]).join('');const result=await env.PHONE_ROOMS.getByName(code).command(actor,'create',{code});if(result.status===409)continue;if(result.error)fail(result.status||400,result.error);return json(result,201);}fail(503,'Please try creating a room again.');
 }
 if(path==='/phone/join'&&request.method==='POST'){data=await objectBody(request,1024);if(typeof data.code!=='string')fail(400,'Enter a six-character room code.');code=roomCode(data.code);if(!/^[A-Z2-9]{6}$/.test(code))fail(400,'Enter a six-character room code.');action='join';await budget('join',60);}
 else {const match=/^\/phone\/([A-Z2-9]{6})(?:\/([a-z-]+))?$/.exec(path);if(!match)fail(404,'Not found.');code=match[1];action=match[2]||'state';if(request.method==='GET'&&action==='state'){}else if(request.method==='POST'&&['start','draft','ready','heartbeat','leave','kick','ban','reveal','report','download'].includes(action)){data=await objectBody(request,130000);}else fail(405,'Invalid room action.');}
 if(!/^[A-Z2-9]{6}$/.test(code))fail(400,'Enter a six-character room code.');
 if(action==='report')await budget('report',20);
 const result=await env.PHONE_ROOMS.getByName(code).command(actor,action,data);
 if(result.error)fail(result.status||400,result.error);
 if(action==='report'){
  const r=result.report;if(!r)fail(500,'Could not save report.');
  await env.DB.prepare('INSERT OR IGNORE INTO phone_reports(room,chain_id,round,reporter,author_id,author_name,reason,snapshot,created) VALUES(?,?,?,?,?,?,?,?,?)').bind(code,String(r.chainId),r.round,me.id,r.authorId||'',r.authorName||'',r.reason,JSON.stringify(r),now).run();return json({ok:true});
 }
 return json(result);
}
