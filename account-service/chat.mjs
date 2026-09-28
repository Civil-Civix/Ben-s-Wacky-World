// Authentication and origin checks run in worker.mjs before this handler.
export async function chat({request,url,env,me,now,body,fail,json}) {
 const path=url.pathname;
 const person=u=>({id:u.id,username:u.username,avatarVersion:u.avatar_version,owner:!!u.owner});
 if(path==='/chat/people'&&request.method==='GET'){
  const q=(url.searchParams.get('q')||'').slice(0,20).toLowerCase().replace(/[^a-z0-9_]/g,'');
  const rows=await env.DB.prepare(`SELECT u.id,u.username,u.avatar_version,u.owner,
   (SELECT MAX(m.id) FROM chat_messages m WHERE m.expires>? AND ((m.sender=? AND m.recipient=u.id) OR (m.recipient=? AND m.sender=u.id))) AS recent
   FROM users u WHERE u.id<>? AND instr(u.username_key,?)>0 ORDER BY recent DESC,u.username_key LIMIT 50`).bind(now,me.id,me.id,me.id,q).all();
  return json({users:rows.results.map(person)});
 }
 if(path!=='/chat/messages')return null;
 let data;
 if(request.method==='POST')data=await body(request);
 else if(request.method!=='GET')return null;
 const to=request.method==='POST'?data.to:(url.searchParams.get('to')||null);
 if(to!==null&&(typeof to!=='string'||to.length>64||to===me.id))fail(400,'Choose another account.');
 if(to!==null&&!await env.DB.prepare('SELECT id FROM users WHERE id=?').bind(to).first())fail(404,'Account not found.');
 if(request.method==='POST'){
  if(typeof data.text!=='string'||!data.text.trim()||data.text.length>1000)fail(400,'Write 1â€“1,000 characters.');
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
  const result=await env.DB.prepare(`INSERT INTO chat_messages(sender,recipient,text,created,expires,client_id,reply_to)
   SELECT ?,?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM chat_messages WHERE sender=? AND created>?)`).bind(me.id,to,data.text.trim(),now,now+86400000,data.clientId,replyId,me.id,now-2000).run();
  if(!result.meta.changes)fail(429,'Wait two seconds before sending another message.');
  return json({ok:true},201);
 }
 const before=Number(url.searchParams.get('before'))||Number.MAX_SAFE_INTEGER;
 if(!Number.isSafeInteger(before)||before<1)fail(400,'Invalid page.');
 const filter=to===null?'m.recipient IS NULL':'((m.sender=? AND m.recipient=?) OR (m.sender=? AND m.recipient=?))';
 const args=to===null?[now,before]:[now,before,me.id,to,to,me.id];
 const rows=await env.DB.prepare(`SELECT m.id,m.text,m.created,m.expires,u.id AS sender,u.username,u.avatar_version,u.owner,m.reply_to,r.text AS reply_text,ru.username AS reply_name,r.expires AS reply_expires FROM chat_messages m JOIN users u ON u.id=m.sender LEFT JOIN chat_messages r ON r.id=m.reply_to LEFT JOIN users ru ON ru.id=r.sender WHERE m.expires>? AND m.id<? AND ${filter} ORDER BY m.id DESC LIMIT 101`).bind(...args).all();
 return json({messages:rows.results.slice(0,100).reverse().map(r=>({id:r.id,text:r.text,created:r.created,expires:r.expires,reply:r.reply_to?{id:r.reply_to,text:r.reply_expires>now?r.reply_text:null,username:r.reply_expires>now?r.reply_name:null,expires:r.reply_expires}:null,user:person({...r,id:r.sender})})),hasMore:rows.results.length>100});
}
