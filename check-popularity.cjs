const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/mrell/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
 const context=await browser.newContext({viewport:{width:1600,height:1000}});
 const page=await context.newPage(),errors=[],posts=[];
 let offline=false;
 page.on('pageerror',e=>errors.push(e.message));
 const games=JSON.parse(fs.readFileSync('games.json','utf8')), featured=games.find(g=>!g.pinned);
 await context.route('**/*',route=>{
  const u=new URL(route.request().url());
  if(u.hostname==='bens-wacky-popularity.mr-ellis1009.workers.dev') {
   if(offline)return route.fulfill({status:503,body:'{}'});
   if(u.pathname==='/play'){posts.push(route.request().postDataJSON());return route.fulfill({json:{ok:true}});}
   return route.fulfill({json:{windowDays:30,games:[{id:featured.id,plays:50}]}});
  }
  if(u.origin!=='https://civil-civix.github.io')return route.fulfill({contentType:'text/html',body:'Game fixture'});
  let rel=decodeURIComponent(u.pathname.replace(/^\/Ben-s-Wacky-World\//,''));
  if(rel.startsWith('library/'))return route.fulfill({contentType:'text/html',body:'Game fixture'});
  const file=path.join(__dirname,rel||'index.html');
  try{return route.fulfill({body:fs.readFileSync(file),contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream'});}
  catch{return route.fulfill({status:404,body:''});}
 });
 await page.goto('https://civil-civix.github.io/Ben-s-Wacky-World/#all');
 await page.locator('#game-sort').selectOption('popular');
 await page.waitForFunction(()=>window.WackyPopularity.state==='ready');
 const order=await page.locator('[data-game]').evaluateAll(cards=>cards.map(c=>c.dataset.game));
 assert.deepEqual(order.slice(0,2),games.filter(g=>g.pinned).sort((a,b)=>a.title.localeCompare(b.title)).map(g=>g.id));
 assert.equal(order[2],featured.id);
 await page.locator('[data-game="'+featured.id+'"]').click();
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('bens-wacky-world.popularity-counted.v1'))?.ids?.length===1);
 assert.equal(posts.length,1);
 await page.locator('#reload').click();
 await page.locator('#close').click();
 await page.locator('[data-game="'+featured.id+'"]').click();
 await page.locator('#close').click();
 assert.equal(posts.length,1);
 await page.reload();
 assert.equal(await page.locator('#game-sort').inputValue(),'popular');
 await page.locator('[data-game="'+featured.id+'"]').click();await page.locator('#close').click();
 assert.equal(posts.length,1);
 await page.locator('.nav-apps').click();
 await page.locator('#popularity-note').waitFor({state:'hidden'});
 await page.locator('[data-game]').first().click();await page.locator('#close').click();
 assert.equal(posts.length,1);
 await page.locator('.nav-game').click();
 await page.locator('#game-sort').selectOption('az');
 const az=await page.locator('[data-game]').evaluateAll(cards=>cards.map(c=>c.dataset.game));
 const expected=games.slice().sort((a,b)=>Number(Boolean(b.pinned))-Number(Boolean(a.pinned))||a.title.localeCompare(b.title,undefined,{sensitivity:'base',numeric:true})).map(g=>g.id);
 assert.deepEqual(az,expected);
 offline=true;
 await page.locator('#game-sort').selectOption('popular');
 await page.reload();
 await page.waitForFunction(()=>window.WackyPopularity.state==='error');
 assert.match(await page.locator('#popularity-note').textContent(),/temporarily unavailable/);
 await page.locator('[data-game]').first().click();
 assert(await page.locator('#player').isVisible());
 assert.deepEqual(errors,[]);
 console.log('PASS: popular ordering, pins, A-Z, saved sorting, local dedup, reload exclusion, apps exclusion and outage playability.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
