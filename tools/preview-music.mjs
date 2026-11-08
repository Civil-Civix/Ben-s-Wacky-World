import {communityMusic} from '../account-service/community-music.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Readable} from 'node:stream';
import {musicPlaylists,playlistStore} from '../account-service/music-playlists.mjs';
import {validJPEG} from '../account-service/worker.mjs';
import {DatabaseSync} from 'node:sqlite';
import {musicAudio} from '../account-service/music.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const allowed=new Set([...fs.readFileSync(path.join(root,'tools/build-pages.mjs'),'utf8').match(/const ROOT_FILES = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map(m=>m[1]));
const mime={'.html':'text/html','.js':'application/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};
// Preview-only SQLite database, isolated from Cloudflare and live accounts.
const sqlite=new DatabaseSync(path.join(root,'.audit-evidence/music-playlists-preview.sqlite'));
sqlite.exec('CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,username TEXT,banned INTEGER DEFAULT 0)');
sqlite.exec(fs.readFileSync(path.join(root,'account-service/music-playlists.sql'),'utf8'));
sqlite.exec(fs.readFileSync(path.join(root,'account-service/music-reports.sql'),'utf8'));
sqlite.exec('CREATE TABLE IF NOT EXISTS admin_log(actor TEXT,target TEXT,action TEXT,details TEXT,created INTEGER)');
const db={prepare:sql=>({all:async()=>({results:sqlite.prepare(sql).all()}),bind:(...args)=>({all:async()=>({results:sqlite.prepare(sql).all(...args)}),first:async()=>sqlite.prepare(sql).get(...args),run:async()=>{const r=sqlite.prepare(sql).run(...args);return {meta:{changes:r.changes}};}})})};
const previewStore=playlistStore(db),create=previewStore.create;
previewStore.create=async p=>{sqlite.prepare('INSERT OR IGNORE INTO users(id,username) VALUES(?,?)').run(p.owner_id,'Preview listener');return create(p);};
http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://127.0.0.1:4337');
    if(url.pathname.startsWith('/music/community')){
      if(!['127.0.0.1:4337','localhost:4337'].includes(req.headers.host)||req.headers.origin&&!['http://127.0.0.1:4337','http://localhost:4337'].includes(req.headers.origin)){res.writeHead(403);return res.end();}
      const owner=req.headers['x-preview-owner'];
      const me=/^[a-f0-9-]{36}$/.test(owner||'')?{id:owner,username:'Preview listener',owner:true}:null;
      if(me)sqlite.prepare('INSERT OR IGNORE INTO users(id,username) VALUES(?,?)').run(me.id,me.username);
      try{const request=new Request(url,{method:req.method,headers:req.headers,...(req.method==='GET'?{}:{body:Readable.toWeb(req),duplex:'half'})});const response=await communityMusic({request,url,env:{DB:db,AUTH_LIMIT:{limit:async()=>({success:true})}},me,now:Date.now(),body:async r=>{const t=await r.text();if(t.length>4096)throw Object.assign(Error('Request too large'),{status:413});return JSON.parse(t);},fail:(status,message)=>{throw Object.assign(Error(message),{status});},json:(data,status=200)=>Response.json(data,{status})});res.writeHead(response.status,Object.fromEntries(response.headers));if(response.body)Readable.fromWeb(response.body).pipe(res);else res.end();return;}catch(e){res.writeHead(e.status||500,{'Content-Type':'application/json'});return res.end(JSON.stringify({error:e.message}));}
    }
    if(url.pathname.startsWith('/music/playlists')){
      const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
      try{
        if(req.headers.host!=='127.0.0.1:4337'&&req.headers.host!=='localhost:4337')fail(403,'Local preview only.');
        if(req.headers.origin&&!['http://127.0.0.1:4337','http://localhost:4337'].includes(req.headers.origin))fail(403,'Local preview only.');
        const owner=req.headers['x-preview-owner'];
        if(req.method!=='GET'&&!/^[a-f0-9-]{36}$/.test(owner||''))fail(401,'Preview identity required.');
        const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>90000)fail(413,'Upload too large.');chunks.push(chunk);}
        const request=new Request(url,{method:req.method,headers:req.headers,...(req.method==='GET'?{}:{body:Buffer.concat(chunks)})});
        const response=await musicPlaylists({request,url,env:{DB:db},me:owner?{id:owner,username:'Preview listener'}:null,now:Date.now(),fail,validJPEG,store:previewStore,
          body:async request=>{if(!request.headers.get('Content-Type')?.startsWith('application/json'))fail(415,'JSON required.');try{return await request.json();}catch{fail(400,'Invalid JSON.');}},
          json:(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}})});
        res.writeHead(response.status,Object.fromEntries(response.headers));return res.end(await response.text());
      }catch(e){res.writeHead(e.status||500,{'Content-Type':'application/json'});return res.end(JSON.stringify({error:e.status?e.message:'Preview request failed.'}));}
    }

    if(url.pathname==='/music/audio'){
      const controller=new AbortController();res.on('close',()=>controller.abort());
      const request=new Request(url,{method:req.method,headers:req.headers,signal:controller.signal});
      const response=await musicAudio(request);
      res.writeHead(response.status,Object.fromEntries(response.headers));
      if(response.body)Readable.fromWeb(response.body).on('error',()=>res.destroy()).pipe(res);else res.end();
      return;
    }
    const rel=decodeURIComponent(url.pathname).slice(1)||'index.html',full=path.resolve(root,rel);
    if(!full.startsWith(root+path.sep)||(!allowed.has(rel)&&!['images/','fonts/','vendor/','library/'].some(p=>rel.startsWith(p)))){res.writeHead(404);return res.end();}
    if(!fs.statSync(full).isFile())throw Error();
    res.writeHead(200,{'Content-Type':mime[path.extname(full)]||'application/octet-stream','Cache-Control':'no-store'});
    fs.createReadStream(full).on('error',()=>res.destroy()).pipe(res);
  }catch{if(!res.headersSent)res.writeHead(404);res.end();}
}).listen(4337,'127.0.0.1',()=>console.log('Music preview: http://127.0.0.1:4337'));
