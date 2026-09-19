const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/mrell/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{const b=await chromium.launch({headless:true,channel:'msedge'});try{
const c=await b.newContext({viewport:{width:1600,height:1000}}),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
await c.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin!=='http://wacky.test')return r.abort();if(u.pathname.startsWith('/library/'))return r.fulfill({body:'Game fixture',contentType:'text/html'});const file=path.join(__dirname,u.pathname==='/'?'index.html':decodeURIComponent(u.pathname));try{return r.fulfill({body:fs.readFileSync(file),contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream'});}catch{return r.fulfill({status:404,body:''});}});
await p.goto('http://wacky.test/#settings');
for(const effect of ['matrix','constellation','topography','starfield']){
 await p.locator('[data-effect='+effect+']').click();
 const first=await p.locator('#theme-canvas').evaluate(e=>e.toDataURL());await p.waitForTimeout(180);
 assert.notEqual(await p.locator('#theme-canvas').evaluate(e=>e.toDataURL()),first,effect+' must move');
 assert(await p.locator('#snow').isHidden());
 await p.locator('#snow-enabled').uncheck();const still=await p.locator('#theme-canvas').evaluate(e=>e.toDataURL());await p.waitForTimeout(100);
 assert.equal(await p.locator('#theme-canvas').evaluate(e=>e.toDataURL()),still);
 await p.locator('#snow-enabled').check();
}
await p.locator('[data-accent="#20C392"]').click();await p.reload();assert.equal(await p.locator('[data-effect=starfield]').getAttribute('aria-pressed'),'true');
assert.equal(await p.locator('#custom-accent').inputValue(),'#20c392');
await p.locator('.nav-home').click();await p.waitForTimeout(1700);
assert.match(await p.locator('body').evaluate(e=>getComputedStyle(e,'::before').backgroundColor),/32, 195, 146/);
assert.match(await p.locator('#home-panel').evaluate(e=>getComputedStyle(e,'::before').backgroundImage),/32, 195, 146/);
await p.screenshot({path:'.audit-evidence/theme-home.png'});
await p.locator('.nav-settings').click();await p.locator('[data-accent="#8B7BFF"]').click();await p.locator('[data-effect=constellation]').click();
await p.screenshot({path:'.audit-evidence/theme-settings.png'});
await p.locator('#effect-speed').fill('2.5');await p.locator('#effect-speed').dispatchEvent('input');
await p.reload();assert.equal(await p.locator('#effect-speed').inputValue(),'2.5');assert.equal(await p.locator('#speed-value').textContent(),'2.5×');
await p.locator('[data-effect=snow]').click();
const duration=await p.locator('.snowflake').first().evaluate(e=>parseFloat(getComputedStyle(e).animationDuration));
await p.locator('#effect-speed').fill('0.5');await p.locator('#effect-speed').dispatchEvent('input');
const slow=await p.locator('.snowflake').first().evaluate(e=>parseFloat(getComputedStyle(e).animationDuration));assert(Math.abs(slow/duration-5)<.01);
await p.locator('.nav-game').click();await p.locator('.game-card').first().waitFor();assert.equal(await p.locator('.game-card').count(),400);
await p.waitForFunction(()=>document.querySelector('.game-card img')?.naturalWidth>0);
assert.equal(await p.locator('.game-card img').count(),400);
assert.equal(await p.locator('[data-game=fivenightsatepstein]').count(),0);
await p.screenshot({path:'.audit-evidence/artwork-catalog.png'});
await p.locator('.game-card').first().click();const frozen=await p.locator('#theme-canvas').evaluate(e=>e.toDataURL());await p.waitForTimeout(100);assert.equal(await p.locator('#theme-canvas').evaluate(e=>e.toDataURL()),frozen);
await p.locator('#close').click();
await p.emulateMedia({reducedMotion:'reduce'});await p.locator('.nav-settings').click();await p.locator('#reset-appearance').click();assert.equal(await p.locator('#snow-enabled').isChecked(),false);
assert.deepEqual(errors,[]);console.log('PASS: four effects move, pause, persist, follow accent, and stop during games; title tint and spotlight; 400 games; no page errors.');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
