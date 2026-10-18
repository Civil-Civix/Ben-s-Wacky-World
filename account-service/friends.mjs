// Friend lists are private to the authenticated account.
export const friendFilter=alias=>`(${alias}.id=? OR EXISTS(SELECT 1 FROM friendships f WHERE f.state='accepted' AND ((f.user_a=? AND f.user_b=${alias}.id) OR (f.user_b=? AND f.user_a=${alias}.id))))`;
export async function friends({request,url,env,me,now,body,fail,json,publicUser}){
 const relation=r=>!r||r.state==='declined'?'none':r.state==='accepted'?'friends':r.requester===me.id?'outgoing':'incoming';
 const pair=id=>[me.id,id].sort();
 if(request.method==='GET'){
  if(url.pathname==='/friends/search'){
   const q=(url.searchParams.get('q')||'').trim().slice(0,20);if(q.length<2)return json({users:[]});
   const rows=await env.DB.prepare("SELECT users.*,(SELECT MAX(last_seen) FROM sessions WHERE user_id=users.id AND expires>?) AS last_seen FROM users WHERE id<>? AND banned=0 AND suspended_until<=? AND instr(username_key,?)>0 ORDER BY username_key LIMIT 20").bind(now,me.id,now,q.toLowerCase()).all();
   return json({users:rows.results.map(publicUser)});
  }
  const id=url.searchParams.get('user');if(id){const row=await env.DB.prepare('SELECT state,requester FROM friendships WHERE user_a=? AND user_b=?').bind(...pair(id)).first();return json({relationship:relation(row)});}
  const rows=await env.DB.prepare("SELECT u.*,f.state,f.requester,(SELECT MAX(last_seen) FROM sessions WHERE user_id=u.id AND expires>?) AS last_seen FROM friendships f JOIN users u ON u.id=CASE WHEN f.user_a=? THEN f.user_b ELSE f.user_a END WHERE (f.user_a=? OR f.user_b=?) AND f.state<>'declined' AND u.banned=0 AND u.suspended_until<=? ORDER BY u.username_key").bind(now,me.id,me.id,me.id,now).all();
  return json({friends:rows.results.map(r=>({user:publicUser(r),relationship:relation(r)}))});
 }
 if(request.method!=='POST'||url.pathname!=='/friends')fail(405,'Method not allowed.');
 const d=await body(request);if(!d||typeof d.userId!=='string'||d.userId.length>64||d.userId===me.id)fail(400,'Choose another account.');
 if(!['request','accept','decline','cancel','remove'].includes(d.action))fail(400,'Choose a valid friend action.');
 if(!(await env.AUTH_LIMIT.limit({key:'friends:'+me.id})).success)fail(429,'Please wait before changing friends again.');
 const target=await env.DB.prepare('SELECT id FROM users WHERE id=? AND banned=0 AND suspended_until<=?').bind(d.userId,now).first();if(!target)fail(404,'Account unavailable.');
 const ids=pair(d.userId),row=await env.DB.prepare('SELECT state,requester,updated FROM friendships WHERE user_a=? AND user_b=?').bind(...ids).first();
 if(d.action==='request'){
  if(row&&row.state!=='declined')return json({relationship:relation(row)});
  if(row&&now-row.updated<86400000)fail(429,'Wait a day before sending another request to this person.');
  const count=await env.DB.prepare("SELECT COUNT(*) AS n FROM friendships WHERE (user_a IN (?,?) OR user_b IN (?,?)) AND state<>'declined'").bind(...ids,...ids).first();if(count.n>=400)fail(400,'Friend request limit reached.');
  await env.DB.prepare("INSERT INTO friendships VALUES(?,?,?,'pending',?) ON CONFLICT(user_a,user_b) DO UPDATE SET requester=excluded.requester,state='pending',updated=excluded.updated WHERE friendships.state='declined' AND friendships.updated<=?").bind(...ids,me.id,now,now-86400000).run();
 }else if(d.action==='accept'||d.action==='decline'){
  if(!row||row.state!=='pending'||row.requester===me.id)fail(409,'No incoming request to respond to.');
  await env.DB.prepare("UPDATE friendships SET state=?,updated=? WHERE user_a=? AND user_b=? AND state='pending' AND requester<>?").bind(d.action==='accept'?'accepted':'declined',now,...ids,me.id).run();
 }else{
  if(!row||(d.action==='cancel'?(row.state!=='pending'||row.requester!==me.id):row.state!=='accepted'))fail(409,'This connection has already changed.');
  await env.DB.prepare("UPDATE friendships SET state='declined',updated=? WHERE user_a=? AND user_b=? AND state=? AND (?='remove' OR requester=?)").bind(now,...ids,d.action==='remove'?'accepted':'pending',d.action,me.id).run();
 }
 const updated=await env.DB.prepare('SELECT state,requester FROM friendships WHERE user_a=? AND user_b=?').bind(...ids).first();return json({relationship:relation(updated)});
}
