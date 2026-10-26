import http from 'node:http';
import path from 'node:path';
import {realpath, stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.json':'application/json','.wasm':'application/wasm','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2','.ogg':'audio/ogg','.mp3':'audio/mpeg','.ico':'image/x-icon'};
export async function createServer(folder){
 const root=await realpath(folder);
 return http.createServer(async(req,res)=>{
  const fail=(code)=>{res.writeHead(code);res.end();};
  if(!/^127\.0\.0\.1:\d+$/.test(req.headers.host||''))return fail(403);
  if(!['GET','HEAD'].includes(req.method))return fail(405);
  if(req.url==='/__bww_health'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({app:'bww-portable-windows-v1',root}));return;}
  try{
   let name=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
   if(name.endsWith('/'))name+='index.html';
   const candidate=path.resolve(root,'.'+name);
   if(!candidate.startsWith(root+path.sep))return fail(403);
   const file=await realpath(candidate);
   if(!file.startsWith(root+path.sep))return fail(403);
   const info=await stat(file);if(!info.isFile())return fail(404);
   let start=0,end=info.size-1,status=200;
   if(req.headers.range){
    const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
    if(!match||(!match[1]&&!match[2])){res.setHeader('Content-Range',`bytes */${info.size}`);return fail(416);}
    if(!match[1])start=Math.max(0,info.size-Number(match[2]));
    else {start=Number(match[1]);if(match[2])end=Math.min(end,Number(match[2]));}
    if(start>end||start>=info.size){res.setHeader('Content-Range',`bytes */${info.size}`);return fail(416);}
    status=206;res.setHeader('Content-Range',`bytes ${start}-${end}/${info.size}`);
   }
   res.setHeader('Content-Type',mime[path.extname(file).toLowerCase()]||'application/octet-stream');
   res.setHeader('Accept-Ranges','bytes');res.setHeader('Cache-Control','no-cache');
   res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Length',info.size?end-start+1:0);
   res.writeHead(status);if(req.method==='HEAD'||!info.size){res.end();return;}
   const stream=createReadStream(file,{start,end});stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);
  }catch(e){fail(e.code==='ENOENT'?404:400);}
 });
}
async function launch(){
 const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'site');
 const url='http://127.0.0.1:48763/';
 const open=()=>{if(!process.argv.includes('--no-browser'))spawn('explorer.exe',[url],{windowsHide:true,stdio:'ignore'}).on('error',()=>console.log('Open '+url+' in your browser.'));};
 const server=await createServer(root);
 server.on('error',async e=>{
  if(e.code==='EADDRINUSE'){
   try{const r=await fetch(url+'__bww_health',{signal:AbortSignal.timeout(2000)});const data=await r.json();if(data.app==='bww-portable-windows-v1'&&data.root===await realpath(root)){console.log('Already running. Opening your browser.');open();return;}}catch{}
   console.error('The portable address is busy. Close the other portable launcher, then try again.');
  }else console.error(e.message);
  process.exitCode=1;
 });
 server.listen(48763,'127.0.0.1',()=>{
  console.log("Ben's Wacky World is running at "+url+'\nKeep this window open while playing. Press Q then Enter to stop.');
  console.log('Games run in your browser. Online features still need internet.');open();
  process.stdin.resume();process.stdin.on('data',data=>{if(data.toString().trim().toLowerCase()==='q')stop();});
 });
 function stop(){server.close(()=>process.exit(0));server.closeAllConnections();process.stdin.destroy();}
 process.on('SIGINT',stop);process.on('SIGTERM',stop);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))launch().catch(e=>{console.error(e.message);process.exitCode=1;});
