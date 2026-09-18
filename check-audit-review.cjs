const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/mrell/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try {
 const context=await browser.newContext({viewport:{width:1400,height:900}}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',route=>{
  const u=new URL(route.request().url());
  if(u.origin!=='http://wacky.test')return route.abort();
  if(u.pathname.startsWith('/library/'))return route.fulfill({contentType:'text/html',body:'<p>Game frame fixture</p>'});
  const p=path.join(__dirname,decodeURIComponent(u.pathname));
  try{return route.fulfill({contentType:p.endsWith('.js')?'text/javascript':'text/html',body:fs.readFileSync(p)});}catch{return route.fulfill({status:404,body:'Missing'});}
 });
 await page.goto('http://wacky.test/game-audit-review.html');
 const counts=await page.evaluate(()=>GAME_AUDIT.reduce((a,r)=>(a[r.status]=(a[r.status]||0)+1,a),{}));
 assert.equal(await page.locator('article').count(),counts.uncertain);
 await page.locator('#filter').selectOption('all');
 assert.equal(await page.locator('article').count(),405);
 await page.locator('#search').fill('Slime Rancher');
 assert.equal(await page.locator('article').count(),1);
 await page.getByRole('button',{name:'Open game'}).click();
 assert(await page.locator('#viewer').isVisible());
 await page.locator('#working').click();await page.locator('#close').click();
 assert.match(await page.locator('article h2').textContent(),/marked working/);
 await page.reload();
 await page.locator('#filter').selectOption('all');await page.locator('#search').fill('Slime Rancher');
 assert.match(await page.locator('article h2').textContent(),/marked working/);
 await page.getByRole('button',{name:'Open game'}).click();await page.locator('#broken').click();
 await page.locator('#reload').click();await page.locator('#full').click();
 await page.waitForFunction(()=>document.fullscreenElement?.id==='frame');
 await page.evaluate(()=>document.exitFullscreen());await page.locator('#close').click();
 assert.match(await page.locator('article h2').textContent(),/marked broken/);
 assert.equal(await page.locator('#frame').getAttribute('src'),'about:blank');
 await page.locator('#search').fill('');await page.locator('#filter').selectOption('uncertain');
 await page.screenshot({path:path.join(__dirname,'.audit-evidence/review-page.png')});
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({filtering:true,marksPersist:true,playerAndFullscreen:true,pageErrors:errors,counts}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

