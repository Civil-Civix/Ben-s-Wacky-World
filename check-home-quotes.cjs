const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/mrell/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{const b=await chromium.launch({headless:true,channel:'msedge'});try{
const c=await b.newContext({viewport:{width:1600,height:1000}}),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
await c.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin!=='http://wacky.test')return r.abort();if(u.pathname.startsWith('/library/'))return r.fulfill({body:'Game fixture',contentType:'text/html'});const file=path.join(__dirname,u.pathname==='/'?'index.html':decodeURIComponent(u.pathname));try{return r.fulfill({body:fs.readFileSync(file),contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream'});}catch{return r.fulfill({status:404,body:''});}});
await p.goto('http://wacky.test/#home');
assert(await p.locator('#home-quote').isHidden());
assert.equal(await p.locator('.launch-grid a').nth(2).innerText(),'Request');
assert.equal(await p.locator('.launch-grid a').nth(3).innerText(),"W\nBen's Wacky Site");
await p.route('**/home-quotes.json',r=>r.fulfill({contentType:'application/json',body:JSON.stringify(['First test quote','Second test quote'])}));
await p.reload();await p.waitForFunction(()=>document.querySelector('#home-quote').textContent==='First test quote');
await p.waitForFunction(()=>Number(getComputedStyle(document.querySelector('#home-quote')).opacity)>.95);
await p.waitForFunction(()=>document.querySelector('#home-quote').textContent==='Second test quote');
await p.waitForFunction(()=>Number(getComputedStyle(document.querySelector('#home-quote')).opacity)>.95);
assert.deepEqual(errors,[]);console.log('PASS: renamed tiles, empty approved list hidden, full quote text rotates with opacity fades, no errors.');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});