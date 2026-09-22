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
  if(u.origin!=='https://civil-civix.github.io')return route.fulfill({contentType:route.request().resourceType()==='script'?'text/javascript':'text/html',body:''});
  let rel=decodeURIComponent(u.pathname.replace(/^\/Ben-s-Wacky-World\//,''));
  if(rel.startsWith('library/'))return route.fulfill({contentType:'text/html',body:'Game fixture'});
  const file=path.join(__dirname,rel||'index.html');
  try{return route.fulfill({body:fs.readFileSync(file),contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream'});}
  catch{return route.fulfill({status:404,body:''});}
 });
 await page.goto('https://civil-civix.github.io/Ben-s-Wacky-World/#all');
 assert.equal(await page.locator('#game-sort').inputValue(),'popular');
 assert.deepEqual(await page.locator('#game-sort option').evaluateAll(options=>options.map(o=>o.value)),['popular','az']);
 assert.equal(await page.locator('html').evaluate(e=>getComputedStyle(e).getPropertyValue('--accent').trim()),'#FFAE00');
 await page.waitForFunction(()=>window.WackyPopularity.state==='ready');
 assert(await page.locator('#popularity-note').isHidden());
 for(const id of ['pokerogue','worldguessr']) {
  const card=page.locator('[data-game='+id+']');
  await card.scrollIntoViewIfNeeded();
  await page.waitForFunction(id=>document.querySelector('[data-game='+id+'] img')?.naturalWidth>0,id);
  assert.equal(await card.locator('img').evaluate(e=>getComputedStyle(e).objectFit),'contain');
  assert(await card.locator('span').isVisible());
  await card.screenshot({path:'.audit-evidence/'+id+'-new-card.png'});
 }
 const order=await page.locator('[data-game]').evaluateAll(cards=>cards.map(c=>c.dataset.game));
 assert.equal(order[0],featured.id);
 await page.locator('#sort-trigger').click();await page.locator('#sort-menu').screenshot({path:'.audit-evidence/sort-menu.png'});await page.keyboard.press('Escape');assert.equal(await page.locator('#sort-trigger').getAttribute('aria-expanded'),'false');
 assert(!games.some(g=>['pokerogue','worldguessr'].includes(g.id)&&g.pinned));
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
 await page.locator('#sort-trigger').click();await page.locator('[data-sort=az]').click();
 const az=await page.locator('[data-game]').evaluateAll(cards=>cards.map(c=>c.dataset.game));
 const expected=games.slice().sort((a,b)=>Number(Boolean(b.pinned))-Number(Boolean(a.pinned))||a.title.localeCompare(b.title,undefined,{sensitivity:'base',numeric:true})).map(g=>g.id);
 assert.deepEqual(az,expected);
 await page.locator('.nav-home').click();
 await page.locator('#home-panel').waitFor({state:'visible'});
 await page.locator('#home-panel [data-stream]').click();
 await page.locator('.server-choice').first().click();
 assert.equal(await page.evaluate(()=>document.fullscreenElement),null);
 assert(await page.locator('#player').isVisible());
 await page.locator('#fullscreen').click();
 await page.waitForFunction(()=>document.fullscreenElement?.tagName==='IFRAME');
 await page.locator('html').evaluate(()=>document.exitFullscreen());
 await page.locator('#close').click();
 await page.locator('.nav-settings').click();
 await page.locator('[data-accent="#8B7BFF"]').click();
 await page.reload();
 assert.equal(await page.locator('#custom-accent').inputValue(),'#8b7bff');
 assert(decodeURIComponent(await page.locator('link[rel=icon]').getAttribute('href')).includes('fill="#8B7BFF"'));
 await page.locator('#reset-appearance').click();
 assert.equal(await page.locator('#custom-accent').inputValue(),'#ffae00');
 assert(decodeURIComponent(await page.locator('link[rel=icon]').getAttribute('href')).includes('fill="#FFAE00"'));
 await page.locator('.nav-game').click();
 assert(!JSON.parse(fs.readFileSync('home-quotes.json','utf8')).includes('GG fricken easy'));
 offline=true;
 await page.locator('#sort-trigger').click();await page.locator('[data-sort=popular]').click();
 await page.reload();
 await page.waitForFunction(()=>window.WackyPopularity.state==='error');
 assert.match(await page.locator('#popularity-note').textContent(),/temporarily unavailable/);
 await page.locator('[data-game]').first().click();
 assert(await page.locator('#player').isVisible());
 assert.deepEqual(errors,[]);
 console.log('PASS: popular ordering, pins, A-Z, saved sorting, local dedup, reload exclusion, apps exclusion and outage playability.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
