// Authentication and origin checks run in worker.mjs before this handler.
export async function chat({request,url,env,me,now,body,fail,json,validJPEG}) {
 const path=url.pathname;
 const person=u=>({id:u.id,username:u.username,avatarVersion:u.avatar_version,owner:!!u.owner,status:u.presence==='offline'||!(u.last_seen>now-90000)?'offline':u.presence||'online'});
 if(path.startsWith('/chat/photos/')&&request.method==='GET'){
  const id=Number(path.slice('/chat/photos/'.length));if(!Number.isSafeInteger(id)||id<1)fail(404,'Photo unavailable.');
  const row=await env.DB.prepare('SELECT photo,expires FROM chat_messages WHERE id=? AND expires>? AND (recipient IS NULL OR sender=? OR recipient=?)').bind(id,now,me.id,me.id).first();
  if(!row?.photo)fail(404,'Photo unavailable.');return json({photo:row.photo,expires:row.expires});
 }
 if(path==='/chat/unread'&&request.method==='GET'){
  const rows=await env.DB.prepare(`SELECT m.sender,count(*) AS count FROM chat_messages m LEFT JOIN chat_reads r ON r.user_id=? AND r.peer_id=m.sender WHERE m.recipient=? AND m.expires>? AND m.id>COALESCE(r.last_id,0) GROUP BY m.sender`).bind(me.id,me.id,now).all();
  return json({count:rows.results.reduce((n,r)=>n+r.count,0),conversations:rows.results});
 }
 if(path==='/chat/read'&&request.method==='POST'){
  const data=await body(request);
  if(typeof data.to!=='string'||!Number.isSafeInteger(data.through)||data.through<1)fail(400,'Invalid read receipt.');
  const message=await env.DB.prepare('SELECT id FROM chat_messages WHERE id=? AND sender=? AND recipient=? AND expires>?').bind(data.through,data.to,me.id,now).first();
  if(!message)fail(400,'Message unavailable.');
  await env.DB.prepare('INSERT INTO chat_reads(user_id,peer_id,last_id) VALUES(?,?,?) ON CONFLICT(user_id,peer_id) DO UPDATE SET last_id=MAX(chat_reads.last_id,excluded.last_id)').bind(me.id,data.to,data.through).run();
  return json({ok:true});
 }
 if(path==='/chat/people'&&request.method==='GET'){
  const q=(url.searchParams.get('q')||'').slice(0,20).toLowerCase().replace(/[^a-z0-9_]/g,'');
  const rows=await env.DB.prepare(`SELECT u.id,u.username,u.avatar_version,u.owner,u.presence,(SELECT MAX(s.last_seen) FROM sessions s WHERE s.user_id=u.id AND s.expires>?) AS last_seen,
   (SELECT MAX(m.id) FROM chat_messages m WHERE m.expires>? AND ((m.sender=? AND m.recipient=u.id) OR (m.recipient=? AND m.sender=u.id))) AS recent
   FROM users u WHERE u.id<>? AND instr(u.username_key,?)>0 AND (?=0 OR EXISTS(SELECT 1 FROM chat_messages c WHERE c.expires>? AND ((c.sender=? AND c.recipient=u.id) OR (c.recipient=? AND c.sender=u.id)))) ORDER BY recent DESC,u.username_key LIMIT 50`).bind(now,now,me.id,me.id,me.id,q,url.searchParams.get('conversations')==='1'?1:0,now,me.id,me.id).all();
  return json({users:rows.results.map(person)});
 }
 if(path!=='/chat/messages')return null;
 let data;
 if(request.method==='POST')data=await body(request,110000);
 else if(request.method!=='GET')return null;
 const to=request.method==='POST'?data.to:(url.searchParams.get('to')||null);
 if(to!==null&&(typeof to!=='string'||to.length>64||to===me.id))fail(400,'Choose another account.');
 if(to!==null&&!await env.DB.prepare('SELECT id FROM users WHERE id=?').bind(to).first())fail(404,'Account not found.');
 if(request.method==='POST'){
  if(typeof data.text!=='string'||data.text.length>1000||(!data.text.trim()&&!data.photo))fail(400,'Write a message or attach a photo.');
  let photo=null;
  if(data.photo!=null){
   if(typeof data.photo!=='string'||data.photo.length>100000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(data.photo)||!validJPEG(Buffer.from(data.photo.split(',')[1],'base64'),960))fail(400,'Use a JPEG photo under 960 pixels and 75 KB.');
   photo=data.photo;
  }
  if(typeof data.clientId!=='string'||! /^[a-zA-Z0-9-]{16,64}$/.test(data.clientId))fail(400,'Invalid message.');
  const existing=await env.DB.prepare('SELECT id FROM chat_messages WHERE sender=? AND client_id=?').bind(me.id,data.clientId).first();
  if(existing)return json({ok:true});
  const replyId=data.replyTo??null;
  if(replyId!==null){
   if(!Number.isSafeInteger(replyId)||replyId<1)fail(400,'Invalid reply.');
   const parent=await env.DB.prepare('SELECT sender,recipient FROM chat_messages WHERE id=? AND expires>?').bind(replyId,now).first();
   const allowed=parent&&(to===null?parent.recipient===null:((parent.sender===me.id&&parent.recipient===to)||(parent.sender===to&&parent.recipient===me.id)));
   if(!allowed)fail(400,'That message is unavailable in this conversation.');
  }
  const result=await env.DB.prepare(`INSERT INTO chat_messages(sender,recipient,text,created,expires,client_id,reply_to,photo)
   SELECT ?,?,?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM chat_messages WHERE sender=? AND created>?)`).bind(me.id,to,data.text.trim()||'Photo',now,now+86400000,data.clientId,replyId,photo,me.id,now-2000).run();
  if(!result.meta.changes)fail(429,'Wait two seconds before sending another message.');
  return json({ok:true},201);
 }
 const before=Number(url.searchParams.get('before'))||Number.MAX_SAFE_INTEGER;
 if(!Number.isSafeInteger(before)||before<1)fail(400,'Invalid page.');
 const filter=to===null?'m.recipient IS NULL':'((m.sender=? AND m.recipient=?) OR (m.sender=? AND m.recipient=?))';
 const args=to===null?[now,before]:[now,before,me.id,to,to,me.id];
 const rows=await env.DB.prepare(`SELECT m.id,m.text,(m.photo IS NOT NULL) AS has_photo,u.presence,(SELECT MAX(s.last_seen) FROM sessions s WHERE s.user_id=u.id AND s.expires>${now}) AS last_seen,m.created,m.expires,u.id AS sender,u.username,u.avatar_version,u.owner,m.reply_to,r.sender AS reply_user,r.text AS reply_text,ru.username AS reply_name,r.expires AS reply_expires FROM chat_messages m JOIN users u ON u.id=m.sender LEFT JOIN chat_messages r ON r.id=m.reply_to LEFT JOIN users ru ON ru.id=r.sender WHERE m.expires>? AND m.id<? AND ${filter} ORDER BY m.id DESC LIMIT 101`).bind(...args).all();
 return json({messages:rows.results.slice(0,100).reverse().map(r=>({id:r.id,text:r.text,hasPhoto:!!r.has_photo,created:r.created,expires:r.expires,reply:r.reply_to?{id:r.reply_to,userId:r.reply_expires>now?r.reply_user:null,text:r.reply_expires>now?r.reply_text:null,username:r.reply_expires>now?r.reply_name:null,expires:r.reply_expires}:null,user:person({...r,id:r.sender})})),hasMore:rows.results.length>100});
}
