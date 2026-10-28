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
 const panel=document.querySelector('#home-panel');if(!panel)return;
 const badge=document.createElement('div');badge.className='home-online';
 badge.setAttribute('role','status');badge.setAttribute('aria-live','polite');
 badge.title='Active browsers in the last 2½ minutes, including guests. Multiple tabs count once.';
 const dot=document.createElement('i');dot.setAttribute('aria-hidden','true');
 const label=document.createElement('span');label.textContent='Connecting…';
 badge.append(dot,label);panel.prepend(badge);
 const updates=document.querySelector('.home-updates');
 if(updates){
  const entry=document.createElement('section');entry.className='update-entry';
  const heading=document.createElement('h3');heading.textContent='See who’s here';
  const text=document.createElement('p');text.textContent='October 28, 2026 · Home now shows how many players are online, including guests.';
  entry.append(heading,text);updates.querySelector('summary').after(entry);
 }
 const key='wacky-online-browser',stateKey='wacky-online-state';
 let memoryId,busy=false;
 function read(){try{return JSON.parse(localStorage.getItem(stateKey));}catch{return null;}}
 function paint(state){
  if(state&&Number.isSafeInteger(state.online)&&state.online>=0&&Date.now()-state.at<150000){
   label.textContent=state.online.toLocaleString()+' online';badge.dataset.ready='true';
  }else{label.textContent='Online count unavailable';badge.dataset.ready='false';}
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
