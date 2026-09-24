
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require('C:/Users/mrell/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const ROOT=path.resolve(__dirname,'..'),BASE='https://civil-civix.github.io/Ben-s-Wacky-World/',API='https://bens-wacky-accounts.mr-ellis1009.workers.dev';
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 const context=await browser.newContext({viewport:{width:1700,height:1100}}),errors=[],calls=[];
 let userId;
 try{
 await context.route('**/*',route=>{
  const req=route.request(),u=new URL(req.url());
  if(u.origin===API){if(u.pathname.startsWith('/play/'))calls.push({path:u.pathname,data:req.postDataJSON()});return route.continue();}
  if(u.hostname==='bens-wacky-popularity.mr-ellis1009.workers.dev')return route.fulfill({json:{windowDays:30,games:[],ok:true}});
  if(u.origin!=='https://civil-civix.github.io')return route.fulfill({contentType:req.resourceType()==='script'?'text/javascript':'text/html',body:''});
  const rel=decodeURIComponent(u.pathname.replace(/^\/Ben-s-Wacky-World\//,''));
  if(rel.startsWith('library/'))return route.fulfill({contentType:'text/html',body:'<!doctype html><body style="background:#101014;color:white">Game test fixture</body>'});
  try{return route.fulfill({body:fs.readFileSync(path.join(ROOT,rel||'index.html')),contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.woff2':'font/woff2','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp'})[path.extname(rel||'index.html')]||'application/octet-stream'});}catch{return route.fulfill({status:404,body:''});}
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(BASE+'#settings');await page.locator('#account-auth').waitFor();
 await page.waitForTimeout(800);
 await page.locator('[data-auth-mode=signup]').click();
 const username='QA_'+Date.now().toString(36),password=crypto.randomBytes(18).toString('hex');
 await page.locator('#auth-username').fill(username);await page.locator('#auth-password').fill(password);await page.locator('#no-recovery').check();
 await page.locator('#auth-submit').click();await page.locator('#account-profile').waitFor({state:'visible',timeout:30000});
 const getMe=()=>page.evaluate(async API=>{const r=await fetch(API+'/me',{credentials:'include',headers:{'X-Wacky-Client':'1'}});return (await r.json()).user;},API);
 userId=(await getMe()).id;console.log('QA_ACCOUNT_ID='+userId);
 await page.reload();await page.locator('#account-profile').waitFor({state:'visible'});assert.equal(await page.locator('#my-name').textContent(),username);
 await page.locator('#profile-bio').fill('Hello from the Wacky crowd. <img src=x onerror=alert(1)>');
 await page.locator('#profile-save').click();await page.waitForFunction(()=>document.querySelector('#account-message').textContent==='Profile saved.');
 const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=300;const x=c.getContext('2d');x.fillStyle='#ffaa00';x.fillRect(0,0,300,300);x.fillStyle='#131318';x.font='bold 180px sans-serif';x.fillText('W',60,215);return c.toDataURL().split(',')[1];});
 await page.locator('#avatar-upload').setInputFiles({name:'profile.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
 await page.waitForFunction(()=>document.querySelector('#account-message').textContent==='Photo updated.');
 await page.waitForFunction(()=>document.querySelector('#my-avatar img')?.naturalWidth===256);
 assert.equal(await page.locator('.nav-settings img').count(),1);
 await page.screenshot({path:path.join(ROOT,'.audit-evidence/account-settings.png'),fullPage:true});
 const firstAvatar=(await getMe()).avatarVersion;
 await page.locator('#avatar-remove').click();await page.waitForFunction(()=>document.querySelector('#account-message').textContent==='Photo removed.');
 await page.locator('#avatar-upload').setInputFiles({name:'profile.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
 await page.waitForFunction(()=>document.querySelector('#account-message').textContent==='Photo updated.');
 assert((await getMe()).avatarVersion>firstAvatar);
 await page.locator('.nav-game').click();await page.locator('#search').fill('Gang Beasts');
 await page.locator('[data-game=gangbeasts]').click();await page.waitForTimeout(4500);await page.locator('#close').click();await page.waitForTimeout(600);
 let user=await getMe();assert(user.playSeconds>=2&&user.playSeconds<=8,JSON.stringify(user));
 const beforeApps=user.playSeconds,starts=calls.filter(c=>c.path==='/play/start').length;
 await page.locator('.nav-apps').click();await page.locator('[data-game]').first().click();await page.waitForTimeout(1200);await page.locator('#close').click();
 assert.equal(calls.filter(c=>c.path==='/play/start').length,starts);
 assert.equal((await getMe()).playSeconds,beforeApps);
 await page.locator('.nav-game').click();await page.locator('#search').fill('Gang Beasts');await page.locator('[data-game=gangbeasts]').click();await page.waitForTimeout(1400);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
 await page.waitForTimeout(700);const hiddenTime=(await getMe()).playSeconds;
 await page.waitForTimeout(1800);await page.locator('#close').click();await page.waitForTimeout(400);assert.equal((await getMe()).playSeconds,hiddenTime);
 await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
 await page.locator('.nav-leaderboard').click();await page.waitForFunction(()=>document.querySelectorAll('.leaderboard-person').length>=2);
 assert(await page.locator('#catalog').isHidden());assert(await page.locator('#settings-panel').isHidden());
 await page.screenshot({path:path.join(ROOT,'.audit-evidence/leaderboard.png'),fullPage:true});
 await page.locator('.leaderboard-person').filter({hasText:username}).click();await page.locator('.public-bio').waitFor();assert.equal(await page.locator('.public-bio img').count(),0);
 assert((await page.locator('.public-bio').textContent()).includes('<img'));await page.locator('#public-profile-close').click();
 await page.locator('#leaderboard-search').fill('WackyBen');await page.waitForFunction(()=>document.querySelectorAll('.leaderboard-person').length===1);
 assert.equal(await page.locator('.leaderboard-person .owner-badge').textContent(),'Owner');
 await page.locator('.nav-settings').click();await page.locator('#account-logout').click();await page.locator('#account-auth').waitFor({state:'visible'});
 await page.reload();await page.locator('#account-auth').waitFor({state:'visible'});
 await page.locator('#auth-username').fill(username);await page.locator('#auth-password').fill(password);await page.locator('#auth-submit').click();await page.locator('#account-profile').waitFor({state:'visible'});
 await page.locator('#account-logout').click();await page.locator('#account-auth').waitFor({state:'visible'});
 assert.deepEqual(errors,[]);console.log('PASS: live signup/login persistence, profile, circular photo upload/remove/cache, game-only timer, hidden-tab pause, public profile escaping, leaderboard/search/owner badge, logout.');
 }finally{await browser.close();if(userId)console.log('CLEANUP_ACCOUNT_ID='+userId);}
})().catch(e=>{console.error(e);process.exitCode=1;});
