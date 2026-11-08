import catalogue from '../music-library.json' with {type:'json'};
const staticIds=new Set(catalogue.tracks.map(t=>t.id));
export async function communityMusic({request,url,env,me,now,body,fail,json,cors={}}){
 const db=env.DB,path=url.pathname;
 if(path==='/music/community'&&request.method==='GET'){const blocked=await db.prepare('SELECT song_id FROM music_blocks').all();return json({songs:[],blocked:blocked.results.map(r=>r.song_id),uploadsEnabled:false});}
 if(path==='/music/community/upload'||path==='/music/community/audio')fail(404,'Not found.');
 if(!me)fail(401,'Sign in to report songs.');
 if(path==='/music/community/report'&&request.method==='POST'){
  const data=await body(request);if(!data||!['content','credit','playback','other'].includes(data.kind)||typeof data.note!=='string'||data.note.length>500)fail(400,'Choose a report reason and keep details under 500 characters.');
  if(!staticIds.has(data.songId))fail(404,'Song not found.');
  if(!(await env.AUTH_LIMIT.limit({key:'music-report:'+me.id})).success)fail(429,'Too many reports. Try again later.');
  await db.prepare("INSERT INTO music_reports(song_id,reporter,kind,note,created) VALUES(?,?,?,?,?) ON CONFLICT(song_id,reporter) DO UPDATE SET kind=excluded.kind,note=excluded.note,status='open',created=excluded.created").bind(data.songId,me.id,data.kind,data.note.trim(),now).run();return json({ok:true});
 }
 if(!me.owner)fail(403,'Only the owner can manage song reports.');
 if(path==='/music/community/reports'&&request.method==='GET'){
  const rows=await db.prepare("SELECT r.*,u.username FROM music_reports r LEFT JOIN users u ON u.id=r.reporter WHERE r.status='open' ORDER BY r.created DESC LIMIT 100").all();return json({reports:rows.results.map(r=>({...r,title:r.title||catalogue.tracks.find(t=>t.id===r.song_id)?.title||r.song_id}))});
 }
 if(path==='/music/community/moderate'&&request.method==='POST'){
  const data=await body(request);if(!data||!['dismiss','remove'].includes(data.action)||!Number.isSafeInteger(data.reportId))fail(400,'Invalid report action.');const report=await db.prepare('SELECT * FROM music_reports WHERE id=?').bind(data.reportId).first();if(!report)fail(404,'Report not found.');
  if(data.action==='remove'){await db.prepare('INSERT OR REPLACE INTO music_blocks(song_id,actor,reason,created) VALUES(?,?,?,?)').bind(report.song_id,me.id,report.kind,now).run();}
  await db.prepare('UPDATE music_reports SET status=? WHERE song_id=?').bind(data.action==='remove'?'removed':'dismissed',report.song_id).run();
  await db.prepare('INSERT INTO admin_log(actor,target,action,details,created) VALUES(?,?,?,?,?)').bind(me.id,report.song_id,'music-'+data.action,JSON.stringify({reportId:report.id,kind:report.kind}),now).run();return json({ok:true});
 }
 fail(404,'Not found.');
}
