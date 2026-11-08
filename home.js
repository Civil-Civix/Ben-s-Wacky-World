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


(()=>{if(location.hostname!=="bens-wacky-world.pages.dev")return;const log=document.querySelector(".updates-log");if(!log)return;const entry=document.createElement("article");entry.innerHTML='<time datetime="2026-10-30">October 30, 2026</time><h2>A little universe of your own</h2><ul><li>Nova brings drifting stars and glowing gas to your background. Move your mouse or drag your finger to stir the space around you.</li><li>Choose Nova in Settings. It follows your accent color, animation speed and effect amount.</li></ul>';log.prepend(entry);document.querySelector(".updates-summary-text > span").textContent="Nova, Sol & Luna";})();

(()=>{if(location.hostname!=="bens-wacky-world.pages.dev")return;const log=document.querySelector(".updates-log");if(!log)return;const entry=document.createElement("article");entry.innerHTML='<time datetime="2026-10-30">October 30, 2026</time><h2>Three new worlds to play</h2><ul><li>Horsey Game, Feed and Grow: Fish, and Minecraft: Story Mode join New, playable inside Wacky World.</li><li>New visitors start with animated blue Nova. Your saved appearance stays the same.</li></ul>';log.prepend(entry);document.querySelector(".updates-summary-text > span").textContent="Three new games & blue Nova";})();

(()=>{if(location.hostname!=='bens-wacky-world.pages.dev')return;const log=document.querySelector('.updates-log');if(!log)return;const entry=document.createElement('article');entry.innerHTML='<time datetime="2026-11-01">November 1, 2026</time><h2>A little more color and motion</h2><ul><li>Choose Rainbow in accent colors for a cycling palette across the site and background effects.</li><li>Nova moves three times faster at every speed setting.</li><li>Pop-ups and dropdown menus now fade in quickly. Reduced-motion preferences keep the rainbow still and skip the fade.</li></ul>';log.prepend(entry);document.querySelector('.updates-summary-text > span').textContent='Rainbow accents & faster Nova';})();

(()=>{if(location.hostname!=='bens-wacky-world.pages.dev')return;const log=document.querySelector('.updates-log');if(!log)return;const entry=document.createElement('article');entry.innerHTML='<time datetime="2026-11-01">November 1, 2026</time><h2>Two colors, your way</h2><ul><li>Choose two accent colors in Settings. Split gives half the background effect each color; Fade smoothly transitions between your colors. Rainbow and Fade now blend every frame, with smoother particle glows and no color jumps when returning to the page.</li><li>Single colors and Rainbow remain available. Matching custom-color controls and a themed Color mode menu keep everything consistent. Your choices are saved on this browser.</li></ul>';log.prepend(entry);document.querySelector('.updates-summary-text > span').textContent='Two-color accents';})();

(()=>{if(location.hostname!=='bens-wacky-world.pages.dev')return;const log=document.querySelector('.updates-log');if(!log)return;const entry=document.createElement('article');entry.innerHTML='<time datetime="2026-11-02">November 2, 2026</time><h2>Clearer math, deeper color</h2><ul><li>AI replies now display formatted fractions, powers, roots and equations. Wide equations scroll inside the reply.</li><li>Crimson adds a deep burgundy background in Settings.</li></ul>';log.prepend(entry);document.querySelector('.updates-summary-text > span').textContent='AI math formatting & Crimson';})();


(()=>{if(!['bens-wacky-world.pages.dev','localhost','127.0.0.1'].includes(location.hostname))return;const log=document.querySelector('.updates-log');if(!log)return;const entry=document.createElement('article');entry.innerHTML='<time datetime="2026-11-08">November 8, 2026</time><h2>Music is here</h2><ul><li>Listen while you play, browse artists and soundtracks, and save your favorites.</li><li>Create playlists with your own photos, rename or delete them, and share them in chat. Shared playlists follow the creator’s edits.</li><li>Use the flag beside a song to report playback problems, incorrect credits, or inappropriate content. AI Songs have been removed.</li></ul>';log.prepend(entry);document.querySelector('.updates-summary-text > span').textContent='Music, shared playlists & song reports';})();
