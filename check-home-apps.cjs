
const {chromium}=require('C:/Users/mrell/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
 const context=await browser.newContext({viewport:{width:1920,height:1080},reducedMotion:'no-preference'});
 await context.route('**/*',async r=>{
   const u=new URL(r.request().url());
   if(u.origin!=='http://wacky.test')return r.abort();
   const p=path.join(__dirname,u.pathname==='/'?'index.html':decodeURIComponent(u.pathname));
   const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.woff2':'font/woff2'};
   try{return r.fulfill({contentType:types[path.extname(p)]||'application/octet-stream',body:fs.readFileSync(p)});}
   catch{return r.fulfill({status:404,body:'Not found'});}
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://wacky.test');
 await page.locator('#home-panel').waitFor({state:'visible'});
 assert(await page.locator('#catalog').isHidden());
 await page.waitForFunction(()=>document.querySelector('#typed-title').classList.contains('typing'));
 const partial=await page.locator('#typed-title').textContent();assert(partial.length<16);
 await page.waitForFunction(()=>document.querySelector('#typed-title').classList.contains('rippling'));
 assert.equal(await page.locator('#typed-title').textContent(),"Ben's Wacky World");
 await page.evaluate(()=>document.fonts.ready);
 assert(await page.evaluate(()=>document.fonts.check('700 62px Inter')));
 assert.equal(await page.locator('.launch-tile').count(),8);
 assert.equal(await page.locator('.launch-placeholder').count(),5);
 assert.equal(await page.locator('.launch-placeholder svg').count(),0);
 const positions=await page.locator('.launch-tile').evaluateAll(es=>es.map(e=>({x:e.offsetLeft,y:e.offsetTop})));
 assert.equal(new Set(positions.map(p=>p.y)).size,2);
 assert.equal(new Set(positions.slice(0,4).map(p=>p.y)).size,1);
 assert.equal(await page.locator('.launch-tile').nth(1).getAttribute('href'),'#apps');
 assert.equal(await page.locator('.launch-tile').last().getAttribute('href'),'#settings');
 const ripple=await page.locator('.title-letter').first().evaluate(async e=>{
   const before=getComputedStyle(e).transform;await new Promise(r=>setTimeout(r,300));return [before,getComputedStyle(e).transform];
 });assert.notEqual(ripple[0],ripple[1]);
 await page.screenshot({path:path.join(__dirname,'homepage-preview.png')});
 await page.getByRole('link',{name:'Open apps',exact:true}).click();
 await page.getByRole('button',{name:'Open Calculator',exact:true}).waitFor();
 assert.equal(await page.locator('.game-card').count(),16);
 assert.equal(await page.locator('.game-card img').count(),0);
 assert(await page.locator('.collection-nav').isHidden());
 assert.equal(await page.locator('#game-grid').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length),6);
 await page.screenshot({path:path.join(__dirname,'apps-preview.png')});
 await page.locator('#search').fill('calculator');assert.equal(await page.locator('.game-card').count(),1);
 await page.getByRole('button',{name:'Open Calculator',exact:true}).click();
 assert(await page.locator('#favorite').isHidden());
 const frame=page.frameLocator('#game-stage iframe');
 await frame.getByRole('button',{name:'2',exact:true}).click();
 await frame.getByRole('button',{name:'+',exact:true}).click();
 await frame.getByRole('button',{name:'3',exact:true}).click();
 await frame.getByRole('button',{name:'=',exact:true}).click();
 assert.equal(await frame.locator('#currentOperationScreen').textContent(),'5');
 await page.locator('#fullscreen').click();
 await page.waitForFunction(()=>document.fullscreenElement?.tagName==='IFRAME');
 await page.evaluate(()=>document.exitFullscreen());
 await page.locator('#close').click();
 assert.equal(await page.evaluate(()=>localStorage.getItem('bens-wacky-world.recents.v1')),null);
 await page.getByRole('button',{name:'Games',exact:true}).click();
 await page.getByRole('button',{name:'Play PEAK',exact:true}).waitFor();
 assert.equal(await page.locator('.game-card').count(),405);
 await page.getByRole('link',{name:'Home',exact:true}).click();
 await page.locator('#home-panel').waitFor({state:'visible'});
 assert.equal(await page.locator('#typed-title').textContent(),"Ben's Wacky World");
 await page.getByRole('link',{name:'Open settings',exact:true}).click();
 await page.locator('#settings-panel').waitFor({state:'visible'});
 assert.deepEqual(errors,[]);
 const apps=JSON.parse(fs.readFileSync(path.join(__dirname,'apps.json')));
 assert(apps.every(app=>fs.existsSync(path.join(__dirname,app.url))));
 console.log(JSON.stringify({homeDefault:true,interLoaded:true,typing:true,rippleMoves:true,homeGrid:'4 by 2',emptyBoxesHaveNoIcons:true,apps:16,appGridColumns:6,appSearch:true,calculator:'2 + 3 = 5',appFullscreen:true,gameRecentsUnaffected:true,gameCatalog:405,settingsShortcut:true,errors},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
