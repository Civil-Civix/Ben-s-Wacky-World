export async function admin({request,url,env,me,now,body,fail,json,games}){
 if(!me.owner)fail(403,'Only the owner can use admin tools.');
 const summary=u=>({id:u.id,username:u.username,owner:!!u.owner,roles:JSON.parse(u.roles||'[]'),mutedUntil:u.muted_until,suspendedUntil:u.suspended_until,banned:!!u.banned});
 if(url.pathname==='/admin/users'&&request.method==='GET'){
  const q=(url.searchParams.get('q')||'').trim().toLowerCase().slice(0,20);
  const rows=await env.DB.prepare('SELECT id,username,owner,roles,muted_until,suspended_until,banned FROM users WHERE instr(username_key,?)>0 ORDER BY owner DESC,username_key LIMIT 50').bind(q).all();return json({users:rows.results.map(summary)});
 }
 if(url.pathname==='/admin/log'&&request.method==='GET'){const rows=await env.DB.prepare('SELECT l.id,l.action,l.target,l.details,l.created,u.username AS actorName FROM admin_log l LEFT JOIN users u ON u.id=l.actor ORDER BY l.id DESC LIMIT 50').all();return json({entries:rows.results});}
 if(url.pathname==='/admin/scores'&&request.method==='GET'){
  const id=url.searchParams.get('user'),user=await env.DB.prepare('SELECT id,username,play_ms FROM users WHERE id=?').bind(id||'').first();if(!user)fail(404,'Account not found.');
  const poly=await env.DB.prepare('SELECT id,track,frames FROM poly_records WHERE user_id=? ORDER BY track').bind(id).all();
  const wins=await env.DB.prepare('SELECT battle_id,finished FROM battle_results WHERE winner=? AND voided=0 ORDER BY finished DESC LIMIT 100').bind(id).all();return json({user,poly:poly.results,wins:wins.results});
 }
 if(url.pathname==='/admin/reports'&&request.method==='GET'){
  const status=url.searchParams.get('status')||'open',before=Number(url.searchParams.get('before')||Number.MAX_SAFE_INTEGER);if(!['open','fixed','removed'].includes(status)||!Number.isSafeInteger(before)||before<1)fail(400,'Invalid report filter.');
  const rows=await env.DB.prepare('SELECT r.*,u.username FROM game_reports r LEFT JOIN users u ON u.id=r.reporter WHERE r.status=? AND r.id<? ORDER BY r.id DESC LIMIT 51').bind(status,before).all();return json({reports:rows.results.slice(0,50),hasMore:rows.results.length>50});
 }
 if(request.method!=='POST')fail(404,'Not found.');
 const data=await body(request),reason=typeof data.reason==='string'?data.reason.trim():'';
 if(!reason||reason.length>280)fail(400,'Add a short reason (up to 280 characters).');
 const audit=(target,action,details)=>env.DB.prepare('INSERT INTO admin_log(actor,target,action,details,created) VALUES(?,?,?,?,?)').bind(me.id,target,action,JSON.stringify({...details,reason}),now);
 if(url.pathname==='/admin/report-status'){
  if(!Number.isSafeInteger(data.id)||!['open','fixed','removed'].includes(data.status))fail(400,'Invalid report update.');
  const report=await env.DB.prepare('SELECT * FROM game_reports WHERE id=?').bind(data.id).first();if(!report)fail(404,'Report not found.');
  await env.DB.batch([env.DB.prepare('UPDATE game_reports SET status=?,updated=? WHERE id=?').bind(data.status,now,data.id),audit(report.game_id,'game-report-status',{reportId:data.id,before:report.status,after:data.status})]);return json({ok:true});
 }
 if(url.pathname==='/admin/remove-message'){
  if(!Number.isSafeInteger(data.id)||data.id<1)fail(400,'Invalid message.');
  const message=await env.DB.prepare('SELECT id,sender FROM chat_messages WHERE id=?').bind(data.id).first();if(!message)fail(404,'Message not found.');
  await env.DB.batch([env.DB.prepare('DELETE FROM chat_messages WHERE id=?').bind(data.id),audit(String(data.id),'delete-message',{sender:message.sender})]);return json({ok:true});
 }
 if(url.pathname==='/admin/remove-score'){
  const user=await env.DB.prepare('SELECT id,username,play_ms FROM users WHERE id=?').bind(typeof data.userId==='string'?data.userId:'').first();if(!user)fail(404,'Account not found.');
  let update,before;
  if(data.kind==='poly'){
   if(!Number.isSafeInteger(data.id)||data.id<1)fail(400,'Invalid record.');
   before=await env.DB.prepare('SELECT id,track,frames FROM poly_records WHERE id=? AND user_id=?').bind(data.id,user.id).first();if(!before)fail(404,'Record not found.');update=env.DB.prepare('DELETE FROM poly_records WHERE id=? AND user_id=?').bind(data.id,user.id);
  }else if(data.kind==='showdown'){
   if(typeof data.id!=='string'||data.id.length>150)fail(400,'Invalid battle.');
   before=await env.DB.prepare('SELECT battle_id,finished FROM battle_results WHERE battle_id=? AND winner=? AND voided=0').bind(data.id,user.id).first();if(!before)fail(404,'Win not found.');update=env.DB.prepare('UPDATE battle_results SET voided=1 WHERE battle_id=? AND winner=?').bind(data.id,user.id);
  }else if(data.kind==='playtime'){before={play_ms:user.play_ms};update=env.DB.prepare('UPDATE users SET play_ms=0 WHERE id=?').bind(user.id);
  }else fail(400,'Unknown score type.');
  await env.DB.batch([update,audit(user.id,'remove-score',{username:user.username,kind:data.kind,before})]);return json({ok:true});
 }
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

export async function reportGame({request,env,me,now,body,fail,json,games}){
 if(request.method!=='POST')fail(405,'Use POST.');
 const data=await body(request);if(!games.has(data.gameId)||!['loading','broken','controls','other'].includes(data.kind)||typeof data.note!=='string'||data.note.length>500)fail(400,'Choose a game and problem, with details up to 500 characters.');
 if(!(await env.AUTH_LIMIT.limit({key:'game-report:'+me.id})).success)fail(429,'Too many reports. Try again shortly.');
 await env.DB.prepare("INSERT INTO game_reports(game_id,reporter,kind,note,created,updated) VALUES(?,?,?,?,?,?) ON CONFLICT(game_id,reporter) DO UPDATE SET kind=excluded.kind,note=excluded.note,status='open',created=excluded.created,updated=excluded.updated WHERE game_reports.status<>'open' AND game_reports.updated<excluded.updated-86400000").bind(data.gameId,me.id,data.kind,data.note.trim(),now,now).run();
 return json({ok:true});
}
