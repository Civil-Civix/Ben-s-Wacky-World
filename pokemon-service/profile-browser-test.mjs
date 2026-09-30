import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
import {readFileSync,existsSync} from 'node:fs';import path from 'node:path';import {randomBytes} from 'node:crypto';
const api='https://bens-wacky-accounts.mr-ellis1009.workers.dev',host='https://civil-civix.github.io',game='https://bens-pokemon.129-146-183-45.sslip.io';
const browser=await chromium.launch({headless:true,channel:'msedge'}),players=[],errors=[];
try{
for(let i=0;i<2;i++){
 const r=await fetch(api+'/signup',{method:'POST',headers:{Origin:host,'X-Wacky-Client':'1','Content-Type':'application/json','User-Agent':'Mozilla/5.0'},body:JSON.stringify({username:'BattleTest'+i+Date.now().toString(36),password:randomBytes(24).toString('hex'),noRecovery:true})});
 const result=await r.json();if(!r.ok)throw Error(JSON.stringify(result));const cookie=r.headers.get('set-cookie').split(';')[0];console.log('Temporary profile: '+result.user.id+' '+result.user.username);
 const context=await browser.newContext({viewport:{width:1365,height:900}}),page=await context.newPage();
 await page.route('**/*',async route=>{const req=route.request(),url=new URL(req.url());
 if(req.url().startsWith(api)){
  const response=await fetch(req.url(),{method:req.method(),headers:{Origin:host,Cookie:cookie,'X-Wacky-Client':'1','Content-Type':req.headers()['content-type']||'application/json','User-Agent':'Mozilla/5.0'},...(req.postDataBuffer()?{body:req.postDataBuffer()}:{})});
  if(!response.ok)console.log('API '+url.pathname+': '+response.status);const headers=Object.fromEntries(response.headers);delete headers['set-cookie'];delete headers['content-encoding'];delete headers['content-length'];await route.fulfill({status:response.status,headers,body:Buffer.from(await response.arrayBuffer())});
 }else if(url.origin===host){const file=path.resolve(process.cwd(),decodeURIComponent(url.pathname.slice(1))||'index.html');if(!file.startsWith(process.cwd())||!existsSync(file))return route.fulfill({status:404,body:''});const ext=path.extname(file);await route.fulfill({body:readFileSync(file),contentType:({'.js':'application/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2'})[ext]||'application/octet-stream'});
 }else if(url.origin===game){await route.continue();}else await route.fulfill({body:'{}',contentType:'application/json'});
 });
 page.on('response',r=>{if(r.url().includes('/audio/')&&r.status()>=400)console.log('Audio resource '+r.status()+': '+new URL(r.url()).pathname);});page.on('pageerror',e=>{errors.push(e.message);console.log('Page error: '+e.message);});await page.goto(host+'/index.html');await page.waitForFunction(()=>window.WackyAccount?.user,{},{timeout:15000}).catch(async e=>{console.log(await page.locator('#account-message').textContent());throw e;});players.push({page,...result.user});
}
await players[0].page.evaluate(id=>WackyAccount.openProfile(id),players[1].id);
await players[0].page.getByRole('button',{name:/^Challenge /}).click();
await players[1].page.locator('#battle-invitations').getByRole('button',{name:'Accept',exact:true}).click({timeout:15000});
for(const p of players){await p.page.waitForFunction(()=>document.querySelector('#game-stage iframe')?.src.includes('profile-battle.html'));}
for(const p of players){const frame=await p.page.waitForEvent('framenavigated',{predicate:f=>f.url().includes('/profile-battle.html'),timeout:1000}).catch(()=>p.page.frames().find(f=>f.url().includes('/profile-battle.html')));if(!frame)throw Error('No game frame');p.frame=frame;await frame.waitForFunction(()=>typeof PS!=='undefined'&&PS.user.named,{timeout:30000});await frame.waitForFunction(()=>Object.keys(PS.rooms).some(id=>id.startsWith('battle-')),{timeout:30000});console.log('Browser battle connected: '+p.username);}
for(const p of players){const peer=players.find(x=>x!==p);await p.frame.waitForFunction(name=>document.body.innerText.includes(name),peer.username);}
await players[0].frame.evaluate(()=>{const id=Object.keys(PS.rooms).find(x=>x.startsWith('battle-'));PS.send('/forfeit',id);});
console.log('Browser errors: '+JSON.stringify(errors));if(errors.length)throw Error('Browser errors detected');console.log('PASS: profile challenge, acceptance, embedded authentication, battle start and profile names.');
}finally{await browser.close();}
