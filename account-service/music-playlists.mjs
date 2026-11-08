import catalogue from '../music-library.json' with {type:'json'};
const songs=new Set(catalogue.tracks.map(t=>t.id));
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
export function playlistStore(db){return {
 get:id=>db.prepare('SELECT p.*,u.username FROM music_playlists p JOIN users u ON u.id=p.owner_id WHERE p.id=? AND u.banned=0').bind(id).first(),
 find:(owner,client)=>db.prepare('SELECT * FROM music_playlists WHERE owner_id=? AND client_id=?').bind(owner,client).first(),
 count:owner=>db.prepare('SELECT COUNT(*) AS n FROM music_playlists WHERE owner_id=?').bind(owner).first().then(r=>r.n),
 create:p=>db.prepare('INSERT OR IGNORE INTO music_playlists(id,owner_id,client_id,name,tracks,cover,version,updated) VALUES(?,?,?,?,?,?,1,?)').bind(p.id,p.owner_id,p.client_id,p.name,p.tracks,p.cover,p.updated).run(),
 remove:(id,owner)=>db.prepare('DELETE FROM music_playlists WHERE id=? AND owner_id=?').bind(id,owner).run(),
 update:p=>db.prepare('UPDATE music_playlists SET name=?,tracks=?,cover=?,version=version+1,updated=? WHERE id=? AND owner_id=? AND version=?').bind(p.name,p.tracks,p.cover,p.updated,p.id,p.owner_id,p.version).run().then(r=>r.meta.changes>0)
};}
export async function musicPlaylists({request,url,env,me,now,body,fail,json,validJPEG,store=playlistStore(env.DB)}){
 if(!/^\/music\/playlists(?:\/[a-f0-9-]{36})?$/.test(url.pathname))fail(404,'Playlist not found.');
 const id=url.pathname.split('/')[3];
 const publicValue=p=>({id:p.id,name:p.name,tracks:JSON.parse(p.tracks),cover:p.cover,version:p.version,updated:p.updated,ownerId:p.owner_id,by:p.username||me?.username||'Playlist creator'});
 if(request.method==='GET'){
  if(!uuid.test(id||''))fail(404,'Playlist not found.');const p=await store.get(id);if(!p)fail(404,'This playlist is no longer available.');return json(publicValue(p));
 }
 if(!me)fail(401,'Sign in to share a playlist.');
 if(request.method==='DELETE'){if(!uuid.test(id||''))fail(404,'Playlist not found.');const current=await store.get(id);if(!current)return json({ok:true});if(current.owner_id!==me.id)fail(403,'Only the creator can delete this playlist.');await store.remove(id,me.id);return json({ok:true});}
 if(!['POST','PATCH'].includes(request.method))fail(405,'Method not allowed.');
 const data=await body(request,90000);
 if(!data||typeof data.name!=='string'||!data.name.trim()||data.name.length>60)fail(400,'Use a playlist name of 1–60 characters.');
 if(!Array.isArray(data.tracks)||data.tracks.length>200||data.tracks.some(id=>!songs.has(id)))fail(400,'Choose up to 200 songs from the music library.');
 const cover=data.cover??'';
 if(typeof cover!=='string'||cover.length>50000)fail(400,'Playlist photo is too large.');
 if(cover){if(!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(cover))fail(400,'Use a JPEG playlist photo.');const raw=Uint8Array.from(atob(cover.slice(23)),c=>c.charCodeAt(0));if(!validJPEG(raw,256))fail(400,'Invalid playlist photo.');}
 const values={name:data.name.trim(),tracks:JSON.stringify([...new Set(data.tracks)]),cover,updated:now,owner_id:me.id};
 if(request.method==='POST'){
  if(id||!uuid.test(data.clientId||''))fail(400,'Invalid playlist.');
  const existing=await store.find(me.id,data.clientId);if(existing)return json(publicValue(existing));
  if(await store.count(me.id)>=30)fail(429,'You can share up to 30 playlists.');
  await store.create({...values,id:crypto.randomUUID(),client_id:data.clientId});return json(publicValue(await store.find(me.id,data.clientId)),201);
 }
 if(!uuid.test(id||''))fail(404,'Playlist not found.');const current=await store.get(id);if(!current)fail(404,'Playlist not found.');if(current.owner_id!==me.id)fail(403,'Only the creator can edit this playlist.');
 if(!Number.isSafeInteger(data.version)||data.version!==current.version)fail(409,'This playlist changed elsewhere. Open its shared link to reload it before editing.');
 if(!await store.update({...values,id,version:data.version}))fail(409,'This playlist changed elsewhere. Reload its shared link.');
 return json(publicValue(await store.get(id)));
}
