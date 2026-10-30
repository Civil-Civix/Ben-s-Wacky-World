'use strict';
(() => {
  let started = false;
  const title = "Ben's Wacky World";
  const target = document.querySelector('#typed-title');
  function addRipple() {
    target.replaceChildren(...[...title].map((letter,index)=>{
      const span=document.createElement('span');
      span.className='title-letter'; span.textContent=letter;
      span.style.setProperty('--letter-index',index);
      return span;
    }));
    target.classList.add('rippling');
  }
  window.startHomeTitle = () => {
    if(started) return;
    started = true;
    if(matchMedia('(prefers-reduced-motion: reduce)').matches) {target.textContent=title;return;}
    target.textContent = '';
    target.classList.add('typing');
    let start;
    function tick(time) {
      start ??= time;
      const count = Math.min(title.length,Math.floor((time-start)/85));
      target.textContent = title.slice(0,count);
      if(count<title.length) requestAnimationFrame(tick);
      else {target.classList.remove('typing');addRipple();}
    }
    requestAnimationFrame(tick);
  };
})();

// Cloudflare Portable and its hosted site share this anonymous browser count.
(() => {
 if(location.hostname!=='bens-wacky-world.pages.dev')return;
 const badges=[...document.querySelectorAll('#home-panel,#catalog,#leaderboard-panel')].map(panel=>{
  panel.classList.add('has-online-count');
  const badge=document.createElement('div');badge.className='home-online';
  badge.setAttribute('role','status');badge.setAttribute('aria-live','polite');
  badge.title='Active browsers in the last 2½ minutes, including guests. Multiple tabs count once.';
  const dot=document.createElement('i');dot.setAttribute('aria-hidden','true');
  const label=document.createElement('span');label.textContent='Connecting…';
  badge.append(dot,label);panel.prepend(badge);return {badge,label};
 });
 if(!badges.length)return;
 const updates=document.querySelector('.updates-log');
 if(updates){
  const entry=document.createElement('article');
  const date=document.createElement('time');date.dateTime='2026-10-28';date.textContent='October 28, 2026';
  const heading=document.createElement('h2');heading.textContent='See who’s here';
  const list=document.createElement('ul'),item=document.createElement('li');
  item.textContent='Home, Games and Leaderboard now show how many players are online, including guests.';
  list.append(item);entry.append(date,heading,list);updates.prepend(entry);
  document.querySelector('.updates-summary-text > span').textContent='Live player count';
 }
 const key='wacky-online-browser',stateKey='wacky-online-state';
 let memoryId,busy=false;
 function read(){try{return JSON.parse(localStorage.getItem(stateKey));}catch{return null;}}
 function paint(state){
  for(const {badge,label} of badges){
  if(state&&Number.isSafeInteger(state.online)&&state.online>=0&&Date.now()-state.at<150000){
   label.textContent=state.online.toLocaleString()+' online';badge.dataset.ready='true';
  }else{label.textContent='Online count unavailable';badge.dataset.ready='false';}
  }
 }
 function visitor(){
  let id;try{id=localStorage.getItem(key);}catch{}
  if(!/^[a-f0-9]{32}$/.test(id||'')){
   id=memoryId||(memoryId=crypto.randomUUID().replaceAll('-',''));
   try{localStorage.setItem(key,id);}catch{}
  }return id;
 }
 async function pulse(){
  if(document.hidden||!navigator.onLine||busy){paint(read());return;}
  busy=true;
  const run=async()=>{
   const previous=read();
   if(previous&&Date.now()-previous.at<60000){paint(previous);return;}
   try{
    const response=await fetch('https://bens-wacky-accounts.mr-ellis1009.workers.dev/visitors',{
     method:'POST',credentials:'omit',headers:{'Content-Type':'application/json','X-Wacky-Client':'1'},
     body:JSON.stringify({visitor:visitor()}),signal:AbortSignal.timeout(10000)
    });
    if(!response.ok)throw Error('Unavailable');
    const data=await response.json();
    if(!Number.isSafeInteger(data.online)||data.online<0)throw Error('Invalid count');
    const state={online:data.online,at:Date.now()};
    try{localStorage.setItem(stateKey,JSON.stringify(state));}catch{}
    paint(state);
   }catch{paint(null);}
  };
  try{
   if(navigator.locks)await navigator.locks.request('wacky-online-pulse',{ifAvailable:true},async lock=>{if(lock)await run();else paint(read());});
   else await run();
  }finally{busy=false;}
 }
 window.addEventListener('storage',e=>{if(e.key===stateKey)paint(read());});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void pulse();});
 window.addEventListener('online',()=>void pulse());
 window.addEventListener('offline',()=>paint(null));
 void pulse();setInterval(()=>void pulse(),60000);
})();

(() => {
 if(location.hostname!=='bens-wacky-world.pages.dev')return;
 const old=[...document.querySelectorAll('.launch-tile')].find(el=>el.textContent.includes("Ben's Wacky Site"));if(!old)return;
 const tile=document.createElement('button');tile.type='button';tile.className='launch-tile links-tile';tile.setAttribute('aria-haspopup','dialog');
 tile.innerHTML=old.innerHTML;tile.querySelector('span').textContent='Links';old.replaceWith(tile);
 const dot=document.createElement('span');dot.className='links-new-dot';dot.setAttribute('aria-hidden','true');tile.append(dot);
 const seenKey='wacky-links-seen-20261029';
 function paint(){let seen=false;try{seen=localStorage.getItem(seenKey)==='1';}catch{}dot.hidden=seen;tile.setAttribute('aria-label',seen?'Open Links':'Open Links, new destinations');}paint();
 const dialog=document.createElement('dialog');dialog.className='links-dialog';dialog.setAttribute('aria-labelledby','links-heading');
 dialog.innerHTML='<h2 id="links-heading">Links</h2><p>Choose your destination</p><div class="links-choices"><a href="https://sites.google.com/view/sens-sacky-sames/home" target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg><span>Sol</span></a><a href="https://sites.google.com/view/lens-lacky-lames/home?authuser=0" target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14A9 9 0 0 1 10 3.5 9 9 0 1 0 20.5 14Z"/></svg><span>Luna</span></a></div><button type="button" class="links-close">Close</button>';
 document.body.append(dialog);tile.addEventListener('click',()=>{dialog.showModal();try{localStorage.setItem(seenKey,'1');}catch{}dot.hidden=true;tile.setAttribute('aria-label','Open Links');});
 dialog.querySelector('.links-close').addEventListener('click',()=>dialog.close());dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});dialog.addEventListener('close',()=>tile.focus());window.addEventListener('storage',e=>{if(e.key===seenKey)paint();});
 const updates=document.querySelector('.updates-log');if(updates){const entry=document.createElement('article');entry.innerHTML='<time datetime="2026-10-29">October 29, 2026</time><h2>Sol and Luna, one click away</h2><ul><li>The new Links tile lets you choose Sol or Luna. Its notification dot clears when you open it.</li><li>Admin @everyone mentions now notify guests too and stand out in World chat.</li></ul>';updates.prepend(entry);document.querySelector('.updates-summary-text > span').textContent='Sol, Luna & chat mentions';}
})();
