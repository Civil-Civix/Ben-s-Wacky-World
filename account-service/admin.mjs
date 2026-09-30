export async function admin({request,url,env,me,now,body,fail,json,games}){
 if(!me.owner)fail(403,'Only the owner can use admin tools.');
 const summary=u=>({id:u.id,username:u.username,owner:!!u.owner,roles:JSON.parse(u.roles||'[]'),mutedUntil:u.muted_until,suspendedUntil:u.suspended_until,banned:!!u.banned});
 if(url.pathname==='/admin/users'&&request.method==='GET'){
  const q=(url.searchParams.get('q')||'').trim().toLowerCase().slice(0,20);
  const rows=await env.DB.prepare('SELECT id,username,owner,roles,muted_until,suspended_until,banned FROM users WHERE instr(username_key,?)>0 ORDER BY owner DESC,username_key LIMIT 50').bind(q).all();return json({users:rows.results.map(summary)});
 }
 if(url.pathname==='/admin/log'&&request.method==='GET'){const rows=await env.DB.prepare('SELECT l.id,l.action,l.target,l.details,l.created,u.username AS actorName FROM admin_log l LEFT JOIN users u ON u.id=l.actor ORDER BY l.id DESC LIMIT 50').all();return json({entries:rows.results});}
 if(request.method!=='POST')fail(404,'Not found.');
 const data=await body(request),reason=typeof data.reason==='string'?data.reason.trim():'';
 if(!reason||reason.length>280)fail(400,'Add a short reason (up to 280 characters).');
 const audit=(target,action,details)=>env.DB.prepare('INSERT INTO admin_log(actor,target,action,details,created) VALUES(?,?,?,?,?)').bind(me.id,target,action,JSON.stringify({...details,reason}),now);
 if(url.pathname==='/admin/boost'){
  if(!games.has(data.gameId)||!Number.isSafeInteger(data.bonus)||data.bonus<0||data.bonus>1000000)fail(400,'Choose a game and a bonus from 0 to 1,000,000.');
  const before=await env.DB.prepare('SELECT bonus FROM game_boosts WHERE game_id=?').bind(data.gameId).first();
  await env.DB.batch([env.DB.prepare('INSERT INTO game_boosts(game_id,bonus,updated) VALUES(?,?,?) ON CONFLICT(game_id) DO UPDATE SET bonus=excluded.bonus,updated=excluded.updated').bind(data.gameId,data.bonus,now),audit(data.gameId,'popularity',{before:before?.bonus||0,after:data.bonus})]);return json({ok:true});
 }
 if(!url.pathname.startsWith('/admin/users/'))fail(404,'Not found.');
 const id=url.pathname.slice('/admin/users/'.length),user=await env.DB.prepare('SELECT id,username,owner,roles,muted_until,suspended_until,banned FROM users WHERE id=?').bind(id).first();
 if(!user)fail(404,'Account not found.');if(user.owner)fail(403,'The owner account is protected.');
 const action=data.action,fields={mute:'muted_until',unmute:'muted_until',suspend:'suspended_until',unsuspend:'suspended_until',ban:'banned',unban:'banned',roles:'roles'},field=Object.hasOwn(fields,action)?fields[action]:null;if(!field)fail(400,'Unknown action.');let value;
 if(action==='roles'){
  if(!Array.isArray(data.roles)||data.roles.length>5||data.roles.some(r=>!r||typeof r.name!=='string'||!r.name.trim()||r.name.length>24||typeof r.color!=='string'||!/^#[0-9a-f]{6}$/i.test(r.color)))fail(400,'Use up to five roles with names and colors.');
  value=JSON.stringify(data.roles.map(r=>({name:r.name.trim(),color:r.color})));
 }else if(['mute','suspend'].includes(action)){
  if(!Number.isSafeInteger(data.hours)||data.hours<1||data.hours>8760)fail(400,'Choose a duration from 1 hour to 365 days.');value=now+data.hours*3600000;
 }else value=action==='ban'?1:0;
 await env.DB.batch([env.DB.prepare('UPDATE users SET '+field+'=? WHERE id=? AND owner=0').bind(value,id),audit(id,action,{username:user.username,before:user[field],after:value})]);
 return json({ok:true,user:summary({...user,[field]:value})});
}
