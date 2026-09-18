const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('C:/Users/mrell/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=__dirname, out=path.join(root,'.audit-evidence');
fs.mkdirSync(out,{recursive:true});
const games=JSON.parse(fs.readFileSync(path.join(root,'games.json')));
const resultPath=path.join(root,'game-audit-results.json');
const existing=fs.existsSync(resultPath)?JSON.parse(fs.readFileSync(resultPath)): [];
const results=new Map(existing.map(r=>[r.id,r]));
const limit=Number(process.argv.find(x=>x.startsWith('--limit='))?.split('=')[1]||405);
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.wasm':'application/wasm','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2','.ogg':'audio/ogg','.mp3':'audio/mpeg'};
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://127.0.0.1');
 if(u.pathname==='/audit-frame') {
  const game=games.find(g=>g.id===u.searchParams.get('id'));
  if(!game){res.writeHead(404).end();return;}
  res.writeHead(200,{'Content-Type':'text/html'});
  res.end('<!doctype html><body style="margin:0;background:black"><iframe style="border:0;width:100vw;height:100vh" allow="autoplay; fullscreen; gamepad" sandbox="allow-scripts allow-same-origin allow-forms allow-pointer-lock allow-downloads" src="/'+game.url+'"></iframe></body>');return;
 }
 let p;try{p=path.resolve(root,'.'+decodeURIComponent(u.pathname));}catch{res.writeHead(400).end();return;}
 if(!p.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.stat(p,(e,s)=>{if(e||!s.isFile()){res.writeHead(404).end('Local file not found');return;}
 res.writeHead(200,{'Content-Type':types[path.extname(p)]||'application/octet-stream'});
 fs.createReadStream(p).pipe(res);});
});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const limited=(p,ms,fallback)=>Promise.race([p,new Promise(r=>setTimeout(()=>r(fallback),ms))]);
function save(){fs.writeFileSync(resultPath,JSON.stringify([...results.values()],null,2));}
async function inspect(browser,game,second=false) {
 const context=await browser.newContext({viewport:{width:1100,height:700},ignoreHTTPSErrors:false,acceptDownloads:false});
 const page=await context.newPage();
 const bad=[],errors=[],requestsFailed=[],budgets=[];
 let transferred=0;
 page.on('pageerror',e=>{if(errors.length<12)errors.push(e.message.slice(0,500));});
 page.on('dialog',d=>d.dismiss().catch(()=>{}));
 context.on('page',p=>{if(p!==page)p.close().catch(()=>{});});
 page.on('requestfailed',r=>{if(requestsFailed.length<12)requestsFailed.push({url:r.url().slice(0,700),error:r.failure()?.errorText});});
 page.on('response',r=>{
  if(r.status()>=400 && bad.length<24)bad.push({url:r.url().slice(0,700),status:r.status(),type:r.request().resourceType()});
  const length=Number(r.headers()['content-length']||0);
  if(length>80*1024*1024 && !budgets.length) {budgets.push('Large download: '+Math.round(length/1048576)+' MB');page.close().catch(()=>{});}
 });
 const cdp=await context.newCDPSession(page);
 await cdp.send('Network.enable');
 cdp.on('Network.loadingFinished',e=>{
  transferred+=e.encodedDataLength||0;
  if(transferred>100*1024*1024 && !budgets.length){budgets.push('Reached 100 MB download budget');page.close().catch(()=>{});}
 });
 let navError=null;
 try{await page.goto('http://127.0.0.1:4187/audit-frame?id='+encodeURIComponent(game.id),{waitUntil:'domcontentloaded',timeout:6000});}
 catch(e){navError=e.message.slice(0,250);}
 await delay(2000);
 if(!page.isClosed()) {
  for(const frame of page.frames().slice(1,6)) {
   try {const flash=frame.locator('ruffle-player,ruffle-embed,ruffle-object').first();if(await flash.isVisible())await flash.click({timeout:1200});}catch(_){}
  }
 }
 await delay(second?12000:6000);
 const frames=[];
 if(!page.isClosed()) {
  for(const frame of page.frames().slice(1,8)) {
   try{
    const info=await limited(frame.evaluate(()=>{
     const visible=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>100&&r.height>70&&s.visibility!=='hidden'&&s.display!=='none';};
     const roots=[document];
 for(let i=0;i<roots.length && i<30;i++)for(const el of roots[i].querySelectorAll('*'))if(el.shadowRoot)roots.push(el.shadowRoot);
 const canvases=roots.flatMap(r=>[...r.querySelectorAll('canvas')]).filter(visible);
 const flashReady=[...document.querySelectorAll('ruffle-player,ruffle-embed,ruffle-object')].some(e=>{try{return !!(e.metadata||e.ruffle?.().metadata);}catch(_){return false;}});
 const textGame=!!document.querySelector('#bigCookie,#game-container .tile,.minefield');
     let painted=false;
     for(const c of canvases.slice(0,3)){try{const tmp=document.createElement('canvas');tmp.width=32;tmp.height=24;const ctx=tmp.getContext('2d');ctx.drawImage(c,0,0,32,24);const a=ctx.getImageData(0,0,32,24).data;const colors=new Set();for(let i=0;i<a.length;i+=16)colors.add(a[i]+','+a[i+1]+','+a[i+2]);if(colors.size>12)painted=true;}catch(_){}}
     return {title:document.title,text:(document.body?.innerText||'').slice(0,4500),canvas:canvases.length,painted,flashReady,textGame,buttons:document.querySelectorAll('button,[role=button],input[type=button]').length,iframes:document.querySelectorAll('iframe').length};
    }),2000,null);
    if(info)frames.push({url:frame.url().slice(0,700),...info});
   }catch(_){}
  }
  try{await page.screenshot({path:path.join(out,game.id+(second?'-retry':'')+'.jpg'),type:'jpeg',quality:48,timeout:4000});}catch(_){}
 }
 const text=frames.map(f=>f.text).join('\n'),painted=frames.some(f=>f.painted||f.flashReady||f.textGame);
 const loading=/\b(?:loading|downloading|extracting|initializing|please wait)\b/i.test(text);
 const visibleFailure=/(?:couldn.t find the requested file|404 not found|file not found|failed to (?:load|fetch|download)|cannot get \/|error while loading|unable to load)/i.test(text);
 const criticalMissing=bad.filter(r=>[404,410].includes(r.status)&&(['script','document'].includes(r.type)||/\.(wasm|data)(?:[?.]|$)/i.test(r.url)));
 const candidate=!budgets.length && !painted && (visibleFailure&&criticalMissing.length>0 || criticalMissing.length>0&&errors.some(e=>/not defined|cannot read|unexpected token|import|wasm|failed/i.test(e)));
 let status=painted&&!loading?'appears-loaded':'uncertain';
 if(candidate)status='failure-candidate';
 const record={id:game.id,title:game.title,url:game.url,status,checkedAt:new Date().toISOString(),seconds:second?14:8,downloadMB:Math.round(transferred/1048576),budgets,errors,bad,requestsFailed,frames,navError,evidence:'.audit-evidence/'+game.id+(second?'-retry':'')+'.jpg'};
 await limited(context.close(),4000,null);
 return record;
}
(async()=>{
 await new Promise(r=>server.listen(4187,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,channel:'msedge',args:['--mute-audio']});
 let next=0,done=0;const pending=games.filter(g=>!results.has(g.id)).slice(0,limit);
 console.log(JSON.stringify({pending:pending.length,alreadyChecked:results.size}));
 async function worker(){
  while(next<pending.length){
   const game=pending[next++];let record;
   try{
    record=await inspect(browser,game);
    if(record.status==='failure-candidate'){
     const retry=await inspect(browser,game,true);
     record={...retry,firstAttempt:record,status:retry.status==='failure-candidate'?'confirmed-failed':'uncertain'};
    }
   }catch(e){record={id:game.id,title:game.title,url:game.url,status:'uncertain',auditError:e.message.slice(0,500)};}
   results.set(game.id,record);save();done++;
   if(done%5===0 || done===pending.length)console.log(JSON.stringify({checked:results.size,total:games.length,last:game.title,status:record.status,counts:[...results.values()].reduce((a,r)=>(a[r.status]=(a[r.status]||0)+1,a),{})}));
  }
 }
 await Promise.all(Array.from({length:4},()=>worker()));
 await browser.close();server.close();save();
 console.log('Audit batch complete.');
 process.exit(0);
})().catch(e=>{console.error(e);server.close();process.exit(1);});
