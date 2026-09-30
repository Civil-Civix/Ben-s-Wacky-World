import {randomBytes,createHash} from 'node:crypto';
const hash=s=>createHash('sha256').update(s).digest('hex');
export const battleName=id=>'bww'+id.replaceAll('-','');
export async function verifyBattle({request,env,now,body,fail,json}){
 if(request.method!=='POST')fail(405,'POST required.');
 const d=await body(request);if(!d||typeof d.token!=='string'||!/^[a-f0-9]{64}$/.test(d.token)||typeof d.challenge!=='string'||!/^[a-f0-9]{256}$/i.test(d.challenge)||typeof d.userid!=='string'||!/^bww[a-f0-9]{32}$/.test(d.userid))fail(400,'Invalid battle sign-in.');
 const row=await env.DB.prepare("DELETE FROM battle_tickets WHERE token_hash=? AND challenge=? AND expires>? AND user_id IN (SELECT id FROM users WHERE banned=0 AND suspended_until<=? AND 'bww'||replace(id,'-','')=?) RETURNING user_id").bind(hash(d.token),d.challenge,now,now,d.userid).first();
 if(!row)fail(401,'Battle sign-in expired. Reopen the game.');return json({userid:d.userid});
}
export async function battle({request,url,env,me,now,body,fail,json}){
 const path=url.pathname;
 if(path==='/battle/session'&&request.method==='POST'){
  const d=await body(request);if(!d||typeof d.challenge!=='string'||!/^[a-f0-9]{256}$/i.test(d.challenge))fail(400,'Invalid battle connection.');
  const token=randomBytes(32).toString('hex');
  await env.DB.batch([env.DB.prepare('DELETE FROM battle_tickets WHERE user_id=? OR expires<=?').bind(me.id,now),env.DB.prepare('INSERT INTO battle_tickets VALUES(?,?,?,?)').bind(hash(token),me.id,d.challenge,now+60000)]);
  return json({token,name:battleName(me.id),displayName:me.username});
 }
 if(path==='/battle/names'&&request.method==='POST'){
  const d=await body(request);if(!Array.isArray(d?.ids)||d.ids.length>20||d.ids.some(id=>typeof id!=='string'||!/^bww[a-f0-9]{32}$/i.test(id)))fail(400,'Invalid players.');
  if(!d.ids.length)return json({players:[]});const rows=await env.DB.prepare("SELECT id,username FROM users WHERE 'bww'||replace(id,'-','') IN ("+d.ids.map(()=>'?').join(',')+")").bind(...d.ids.map(id=>id.toLowerCase())).all();return json({players:rows.results.map(u=>({name:battleName(u.id),displayName:u.username}))});
 }
 if(path==='/battle/invites'&&request.method==='GET'){
  const rows=await env.DB.prepare("SELECT i.*,s.username AS sender_name,r.username AS recipient_name FROM battle_invites i JOIN users s ON s.id=i.sender JOIN users r ON r.id=i.recipient WHERE (i.sender=? OR i.recipient=?) AND i.expires>? AND s.banned=0 AND r.banned=0 AND s.suspended_until<=? AND r.suspended_until<=? ORDER BY i.created DESC LIMIT 20").bind(me.id,me.id,now,now,now).all();
  return json({invites:rows.results.map(i=>({id:i.id,status:i.status,expires:i.expires,outgoing:i.sender===me.id,peer:{id:i.sender===me.id?i.recipient:i.sender,username:i.sender===me.id?i.recipient_name:i.sender_name,name:battleName(i.sender===me.id?i.recipient:i.sender)}}))});
 }
 if(path==='/battle/invites'&&request.method==='POST'){
  const d=await body(request);if(typeof d?.to!=='string'||d.to===me.id)fail(400,'Choose another player.');if(me.muted_until>now)fail(403,'Challenges are unavailable while muted.');
  const target=await env.DB.prepare('SELECT id FROM users WHERE id=? AND banned=0 AND suspended_until<=?').bind(d.to,now).first();if(!target)fail(404,'Player unavailable.');
  const id=crypto.randomUUID();const result=await env.DB.prepare("INSERT INTO battle_invites(id,sender,recipient,status,created,expires) SELECT ?,?,?,'pending',?,? WHERE NOT EXISTS(SELECT 1 FROM battle_invites WHERE ((sender=? OR recipient=?) AND status IN ('pending','accepted') AND expires>?) OR (sender=? AND created>?))").bind(id,me.id,d.to,now,now+120000,me.id,me.id,now,me.id,now-15000).run();if(!result.meta.changes)fail(409,'Finish or cancel your current invitation before challenging again.');return json({id},201);
 }
 if(path.startsWith('/battle/invites/')&&request.method==='POST'){
  const d=await body(request),id=path.slice('/battle/invites/'.length);if(!['accept','decline','cancel'].includes(d?.action))fail(400,'Invalid invitation action.');
  const recipient=d.action!=='cancel',status=d.action==='accept'?'accepted':d.action==='decline'?'declined':'cancelled';
  const result=await env.DB.prepare("UPDATE battle_invites SET status=?,expires=? WHERE id=? AND "+(recipient?'recipient':'sender')+"=? AND status='pending' AND expires>?"+(d.action==='accept'?" AND NOT EXISTS(SELECT 1 FROM battle_invites b WHERE (b.sender=? OR b.recipient=?) AND b.status='accepted' AND b.expires>?)":"")).bind(status,now+(status==='accepted'?90000:30000),id,me.id,now,...(d.action==='accept'?[me.id,me.id,now]:[])).run();if(!result.meta.changes)fail(409,'Invitation expired, already handled, or a battle is already starting.');return json({ok:true});
 }
 fail(404,'Not found.');
}
