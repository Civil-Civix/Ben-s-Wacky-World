const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/mrell/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const b=await chromium.launch({headless:true,channel:'msedge'});
 try {
  const p=await b.newPage();let adRequests=0;
  await p.route('**/*',r=>{if(/googlesyndication|breadisgay/.test(r.request().url()))adRequests++;return r.abort();});
  await p.setContent('<html><head></head><body><button id="play">Play</button><div id="normal">Game content</div></body></html>');
  await p.addScriptTag({content:fs.readFileSync(path.join(__dirname,'game-ad-guard.js'),'utf8')});
  const r=await p.evaluate(async()=>{
   const ad=document.createElement('script');ad.src='https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';document.body.appendChild(ad);
   const iframe=document.createElement('iframe');iframe.src='https://breadisgay.eduplace.net/e';document.body.appendChild(iframe);
   const injected=document.createElement('div');injected.id='sidebarad1';document.body.append(injected);
   const slot=document.createElement('ins');slot.className='adsbygoogle';document.body.append(slot);
   let before=0,after=0,reason;
   adsbygoogle.push({beforeAd(){before++;},afterAd(){after++;},adBreakDone(r){reason=r.breakStatus;}});
   const popup=window.open('https://example.org');
   await new Promise(r=>setTimeout(r,100));
   return {scripts:document.querySelectorAll('script[src]').length,iframes:document.querySelectorAll('iframe').length,adSlots:document.querySelectorAll('#sidebarad1,.adsbygoogle').length,gameText:document.querySelector('#normal').textContent,before,after,reason,popupClosed:popup.closed};
  });
  assert.equal(adRequests,0);assert.equal(r.scripts,0);assert.equal(r.iframes,0);assert.equal(r.adSlots,0);
  assert.equal(r.gameText,'Game content');assert.equal(r.after,1);assert.equal(r.reason,'noAdPreloaded');assert(r.popupClosed);
  console.log(JSON.stringify({adRequests,...r},null,2));
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});