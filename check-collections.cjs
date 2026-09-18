const {chromium}=require('C:/Users/mrell/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try {
 const context=await browser.newContext({viewport:{width:1920,height:1080}});
 const base='http://wacky.test';
 await context.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.origin!==base) return route.abort();
   if(url.pathname.startsWith('/library/')) return route.fulfill({contentType:'text/html',body:'<html><body>Player test fixture</body></html>'});
   const filename=path.join(__dirname,decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
   const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png'};
   try {return route.fulfill({contentType:types[path.extname(filename)]||'application/octet-stream',body:fs.readFileSync(filename)});}
   catch {return route.fulfill({status:404,body:'Not found'});}
 });
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);
 await page.locator('.game-card').first().waitFor();
 assert.equal(await page.locator('.game-card').count(),405);
 assert.equal(await page.locator('.game-card img').count(),0);
 const width=await page.locator('.game-card').first().evaluate(e=>e.getBoundingClientRect().width);
 assert(width>=275 && width<=281);
 await page.getByRole('link',{name:'Favorites',exact:true}).click(); await page.waitForFunction(()=>document.querySelector('[data-view=favorites]').getAttribute('aria-current')==='page');
 await page.locator('#empty').waitFor({state:'visible'});
 await page.getByRole('link',{name:'All',exact:true}).click(); await page.waitForFunction(()=>document.querySelector('[data-view=all]').getAttribute('aria-current')==='page');
 await page.getByRole('button',{name:'Play PEAK',exact:true}).click();
 await page.locator('#favorite').click();
 assert.equal(await page.locator('#favorite').getAttribute('aria-pressed'),'true');
 await page.locator('#reload').click();
 assert.equal(await page.locator('#game-stage iframe').count(),1);
 await page.locator('#fullscreen').click();
 await page.waitForFunction(()=>!!document.fullscreenElement);
 await page.locator('#close').click();
 await page.getByRole('link',{name:'Favorites',exact:true}).click(); await page.waitForFunction(()=>document.querySelector('[data-view=favorites]').getAttribute('aria-current')==='page');
 assert.equal(await page.locator('.game-card').count(),1);
 await page.reload();
 await page.getByRole('button',{name:'Play PEAK',exact:true}).waitFor();
 assert.equal(await page.locator('.game-card').count(),1);
 await page.getByRole('button',{name:'Play PEAK',exact:true}).click();
 assert.equal(await page.locator('#favorite').getAttribute('aria-pressed'),'true');
 await page.locator('#close').click();
 await page.getByRole('link',{name:'All',exact:true}).click(); await page.waitForFunction(()=>document.querySelector('[data-view=all]').getAttribute('aria-current')==='page');
 await page.getByRole('button',{name:'Play Trombone Champ',exact:true}).click();
 await page.locator('#close').click();
 await page.getByRole('link',{name:'Recents',exact:true}).click(); await page.waitForFunction(()=>document.querySelector('[data-view=recents]').getAttribute('aria-current')==='page');
 assert.deepEqual(await page.locator('.game-card').evaluateAll(cards=>cards.map(c=>c.dataset.game)),['trombonechamp','peak']);
 await page.getByRole('button',{name:'Play PEAK',exact:true}).click();
 await page.locator('#favorite').click();
 await page.locator('#close').click();
 assert.deepEqual(await page.locator('.game-card').evaluateAll(cards=>cards.map(c=>c.dataset.game)),['peak','trombonechamp']);
 await page.reload();
 await page.locator('.game-card').first().waitFor();
 assert.equal(await page.locator('.game-card').count(),2);
 await page.locator('#search').fill('Trombone');
 assert.equal(await page.locator('.game-card').count(),1);
 await page.getByRole('link',{name:'Favorites',exact:true}).click(); await page.waitForFunction(()=>document.querySelector('[data-view=favorites]').getAttribute('aria-current')==='page');
 assert.equal(await page.locator('.game-card').count(),0);
 const values=await page.evaluate(()=>({favorites:JSON.parse(localStorage.getItem('bens-wacky-world.favorites.v1')),recents:JSON.parse(localStorage.getItem('bens-wacky-world.recents.v1'))}));
 assert.deepEqual(values,{favorites:[],recents:['peak','trombonechamp']});
 await page.getByRole('link',{name:'All',exact:true}).click(); await page.waitForFunction(()=>document.querySelector('[data-view=all]').getAttribute('aria-current')==='page');
 await page.locator('.game-card').first().hover();
 await page.waitForFunction(()=>getComputedStyle(document.querySelector('.game-card')).borderTopColor==='rgb(139, 123, 255)');
 await page.screenshot({path:path.join(__dirname,'catalog-preview.png')});
 await page.getByRole('link',{name:'Recents',exact:true}).click(); await page.waitForFunction(()=>document.querySelector('[data-view=recents]').getAttribute('aria-current')==='page');
 await page.screenshot({path:path.join(__dirname,'collections-preview.png')});
 // Verify image mapping and fallback without adding any artwork to the repository.
 await page.route('**/game-images.json',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({peak:'images/test.png',trombonechamp:'images/missing.png'})}));
 await page.route('**/images/test.png',r=>r.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=','base64')}));
 await page.goto(base+'/#all'); await page.reload();
 await page.locator('[data-game="peak"] img').waitFor();
 await page.waitForFunction(()=>document.querySelector('[data-game="peak"] img')?.naturalWidth===1);
 await page.waitForFunction(()=>!document.querySelector('[data-game="trombonechamp"] img'));
 // Malformed saved data and blocked storage must not break the catalog.
 const broken=await context.newPage();
 await broken.addInitScript(()=>{
   localStorage.setItem('bens-wacky-world.favorites.v1','bad json');
   Storage.prototype.setItem=function(){throw new Error('Storage disabled');};
 });
 await broken.goto(base+'/#favorites');
 await broken.locator('#storage-notice').waitFor();
 await broken.getByRole('link',{name:'All',exact:true}).click();
 await broken.getByRole('button',{name:'Play PEAK',exact:true}).click();
 await broken.locator('#favorite').click();
 assert(await broken.locator('#player-storage-notice').isVisible());
 await broken.locator('#close').click();
 await broken.getByRole('link',{name:'Favorites',exact:true}).click(); await broken.waitForFunction(()=>document.querySelector('[data-view=favorites]').getAttribute('aria-current')==='page');
 assert.equal(await broken.locator('.game-card').count(),1);
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({cards:405,columns:6,favoritesAddRemove:true,recentsOrderAndDeduplication:true,persistence:true,collectionSearch:true,fullscreenAndReload:true,purpleHover:true,artworkAndFallback:true,storageFailureHandled:true,pageErrors:errors,gameplay:'not tested; game frames mocked for UI checks'},null,2));
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
