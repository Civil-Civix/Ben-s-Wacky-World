
const {chromium}=require('C:/Users/mrell/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try {
 const context=await browser.newContext({viewport:{width:1920,height:1080},reducedMotion:'no-preference'});
 await context.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.origin!=='http://wacky.test')return route.abort();
   if(url.pathname.startsWith('/library/'))return route.fulfill({contentType:'text/html',body:'<body>Game fixture</body>'});
   const p=path.join(__dirname,url.pathname==='/'?'index.html':decodeURIComponent(url.pathname));
   const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'};
   try{return route.fulfill({contentType:types[path.extname(p)]||'application/octet-stream',body:fs.readFileSync(p)});}
   catch{return route.fulfill({status:404,body:'Not found'});}
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://wacky.test/#all');
 await page.locator('.snowflake').first().waitFor({state:'attached'});
 assert.equal(await page.locator('.snowflake').count(),80);
 const motion=await page.evaluate(async()=>{
   const snow=[...document.querySelectorAll('.snowflake')].find(e=>e.getBoundingClientRect().y>20 && e.getBoundingClientRect().y<innerHeight-100);
   const before=snow.getBoundingClientRect().y;
   await new Promise(r=>setTimeout(r,350));
   return {before,after:snow.getBoundingClientRect().y,pointerEvents:getComputedStyle(document.querySelector('#snow')).pointerEvents};
 });
 assert(motion.after>motion.before+3);assert.equal(motion.pointerEvents,'none');
 await page.getByRole('button',{name:'Settings',exact:true}).click();
 await page.locator('#settings-panel').waitFor({state:'visible'});
 assert(await page.locator('#catalog').isHidden());
 await page.screenshot({path:path.join(__dirname,'appearance-preview.png')});
 await page.getByRole('button',{name:'Mocha',exact:true}).click();
 assert.equal(await page.locator('html').getAttribute('data-background'),'mocha');
 await page.getByRole('button',{name:'Blue accent',exact:true}).click();
 assert.equal(await page.locator('#accent-value').textContent(),'#389AFF');
 await page.locator('#custom-accent').fill('#35ccaa');
 assert.equal(await page.locator('#accent-value').textContent(),'#35CCAA');
 await page.locator('#snow-enabled').uncheck();
 assert(await page.locator('#snow').isHidden());
 await page.reload();await page.locator('#settings-panel').waitFor({state:'visible'});
 assert.equal(await page.locator('html').getAttribute('data-background'),'mocha');
 assert.equal(await page.locator('#custom-accent').inputValue(),'#35ccaa');
 assert(!(await page.locator('#snow-enabled').isChecked()));
 await page.locator('#snow-enabled').check();
 await page.getByRole('button',{name:'Games',exact:true}).click();
 await page.locator('#catalog').waitFor({state:'visible'});
 assert(await page.locator('#settings-panel').isHidden());
 await page.getByRole('button',{name:'Play PEAK',exact:true}).click();
 assert.equal(await page.locator('.snowflake').first().evaluate(e=>getComputedStyle(e).animationPlayState),'paused');
 assert(await page.locator('#snow').isHidden());
 await page.locator('#close').click();
 assert.equal(await page.locator('.snowflake').first().evaluate(e=>getComputedStyle(e).animationPlayState),'running');
 await page.getByRole('button',{name:'Settings',exact:true}).click();
 await page.locator('#reset-appearance').click();
 assert.equal(await page.locator('html').getAttribute('data-background'),'obsidian');
 assert.equal(await page.locator('#accent-value').textContent(),'#8B7BFF');
 await page.getByRole('button',{name:'Games',exact:true}).click();
 await page.locator('#catalog').waitFor({state:'visible'});
 await page.screenshot({path:path.join(__dirname,'snow-preview.png')});
 assert.deepEqual(errors,[]);
 const reduced=await browser.newContext({reducedMotion:'reduce'});
 await reduced.route('**/*',async r=>{
   const u=new URL(r.request().url()),p=path.join(__dirname,u.pathname==='/'?'index.html':u.pathname);
   const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'};
   try{return r.fulfill({contentType:types[path.extname(p)]||'text/plain',body:fs.readFileSync(p)});}catch{return r.fulfill({status:404,body:''});}
 });
 const rp=await reduced.newPage();await rp.goto('http://wacky.test/#settings');
 await rp.locator('#settings-panel').waitFor({state:'visible'});
 assert(!(await rp.locator('#snow-enabled').isChecked()));
 await rp.locator('#snow-enabled').check();assert(await rp.locator('#snow').isVisible());
 console.log(JSON.stringify({snowActuallyFalls:motion,themeChanges:true,customAccent:true,snowToggle:true,savedAfterReload:true,settingsNavigation:true,pausedDuringGame:true,reset:true,reducedMotionDefaultAndOptIn:true,errors},null,2));
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
