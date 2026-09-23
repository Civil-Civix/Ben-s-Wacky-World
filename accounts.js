(() => {
 'use strict';
 const API='https://bens-wacky-accounts.mr-ellis1009.workers.dev';
 const $=s=>document.querySelector(s);
 const person='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/></svg>';
 let me=null,mode='login',sessionReady=false,game=null,lease=null,sequence=0,checkpoint=0;
 let queue=Promise.resolve(),listGeneration=0,offset=0,searchTimer,retryAt=0,authGeneration=0,profileGeneration=0;
 const channel=typeof BroadcastChannel==='function'?new BroadcastChannel('wacky-account'):null;
 const note=(text,error=false)=>{$('#account-message').textContent=text;$('#account-message').classList.toggle('is-error',error);};
 const duration=seconds=>{const minutes=Math.floor(seconds/60);return Math.floor(minutes/60)+'h '+(minutes%60)+'m';};
 const avatarURL=user=>API+'/avatars/'+encodeURIComponent(user.id)+'?v='+user.avatarVersion;
 function avatar(user,size=''){
  const el=document.createElement('span');el.className='profile-avatar '+size;
  if(user?.avatarVersion){const img=document.createElement('img');img.src=avatarURL(user);img.alt='';img.addEventListener('error',()=>{el.innerHTML=person;},{once:true});el.append(img);}
  else el.innerHTML=person;
  return el;
 }
 function badge(user){const b=document.createElement('span');b.className='owner-badge';b.textContent='Owner';b.hidden=!user.owner;return b;}
 async function api(path,{method='GET',data,raw,keepalive=false}={}){
  const response=await fetch(API+path,{method,credentials:'include',headers:{'X-Wacky-Client':'1',...(raw?{'Content-Type':'image/jpeg'}:data!==undefined?{'Content-Type':'application/json'}:{})},
   ...(raw?{body:raw}:data!==undefined?{body:JSON.stringify(data)}:{}),keepalive,signal:AbortSignal.timeout(20000)});
  const result=await response.json();
  if(!response.ok){const error=new Error(result.error||'Please try again.');error.status=response.status;throw error;}
  return result;
 }
 function renderAccount(fill=true){
  document.querySelectorAll('[data-account-avatar]').forEach(el=>el.replaceChildren(avatar(me)));
  $('#account-auth').hidden=!!me;$('#account-profile').hidden=!me;
  if(me){
   $('#my-avatar').replaceChildren(avatar(me,'large'));
   $('#my-name').textContent=me.username;$('#my-badge').replaceChildren(badge(me));
   $('#my-playtime').textContent=duration(me.playSeconds);
   if(fill){$('#profile-username').value=me.username;$('#profile-bio').value=me.bio;}
  }
 }
 async function restore(){
  const generation=++authGeneration;
  try{const result=await api('/me');if(generation!==authGeneration)return;me=result.user;note('');}
  catch(error){if(generation!==authGeneration)return;me=null;if(error.status!==401)note('Accounts are temporarily unavailable. You can still play as a guest.',true);}
  sessionReady=true;renderAccount();syncTimer();
 }
 function changeMode(next){
  mode=next;$('#auth-submit').textContent=mode==='login'?'Log in':'Create account';
  $('#auth-password').autocomplete=mode==='login'?'current-password':'new-password';
  $('#auth-password').minLength=mode==='login'?1:8;
  $('#signup-notice').hidden=mode!=='signup';$('#no-recovery').required=mode==='signup';
  document.querySelectorAll('[data-auth-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.authMode===mode)));
  $('#auth-password').value='';note('');
 }
 document.querySelectorAll('[data-auth-mode]').forEach(b=>b.addEventListener('click',()=>changeMode(b.dataset.authMode)));
 $('#auth-form').addEventListener('submit',async event=>{
  event.preventDefault();++authGeneration;const button=$('#auth-submit');button.disabled=true;note('Signing in…');
  try{
   const result=await api('/'+mode,{method:'POST',data:{username:$('#auth-username').value.trim(),password:$('#auth-password').value,noRecovery:$('#no-recovery').checked}});
   // Verify persistence rather than pretending a blocked cookie signed the user in.
   me=(await api('/me')).user;
   $('#auth-password').value='';sessionReady=true;renderAccount();note(mode==='signup'?'Account created. Welcome!':'Welcome back!');
   channel?.postMessage('changed');syncTimer();
  }catch(error){note(error.status===401?'Login could not be kept, or your credentials are incorrect. Check your username/password and allow this site’s sign-in cookies.':error.message,true);}
  finally{button.disabled=false;}
 });
 $('#profile-form').addEventListener('submit',async event=>{
  event.preventDefault();const button=$('#profile-save');button.disabled=true;
  try{me=(await api('/me',{method:'PATCH',data:{username:$('#profile-username').value.trim(),bio:$('#profile-bio').value}})).user;renderAccount();note('Profile saved.');channel?.postMessage('changed');}
  catch(error){note(error.message,true);}finally{button.disabled=false;}
 });
 $('#account-logout').addEventListener('click',async()=>{
  $('#account-logout').disabled=true;++authGeneration;
  try{await enqueue(()=>pulse(true));await api('/logout',{method:'POST',data:{}});me=null;lease=null;renderAccount();note('Logged out.');channel?.postMessage('changed');}
  catch(error){note(error.message,true);}finally{$('#account-logout').disabled=false;}
 });
 $('#my-public-profile').addEventListener('click',()=>{if(me)void openProfile(me.id);});
 async function resizePhoto(file){
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5*1024*1024)throw new Error('Choose a JPG, PNG or WebP photo under 5 MB.');
  const image=await createImageBitmap(file);
  try{
   const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
   const ctx=canvas.getContext('2d'),side=Math.min(image.width,image.height);ctx.fillStyle='#101014';ctx.fillRect(0,0,256,256);
   ctx.drawImage(image,(image.width-side)/2,(image.height-side)/2,side,side,0,0,256,256);
   let blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.8));
   if(blob?.size>49152)blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.55));
   if(!blob||blob.size>49152)throw new Error('This photo is too detailed. Choose a smaller image.');
   return blob;
  }finally{image.close();}
 }
 $('#avatar-upload').addEventListener('change',async event=>{
  const input=event.target,file=input.files[0];if(!file)return;input.disabled=true;note('Uploading photo…');
  try{const blob=await resizePhoto(file);me=(await api('/avatar',{method:'PUT',raw:blob})).user;renderAccount(false);note('Photo updated.');channel?.postMessage('changed');}
  catch(error){note(error.message,true);}finally{input.value='';input.disabled=false;}
 });
 $('#avatar-remove').addEventListener('click',async()=>{try{me=(await api('/avatar',{method:'DELETE'})).user;renderAccount(false);note('Photo removed.');channel?.postMessage('changed');}catch(error){note(error.message,true);}});
 // Only one server-issued lease can earn time for an account, even across devices.
 const active=()=>sessionReady&&me&&game&&!document.hidden&&!document.prerendering;
 function enqueue(fn){queue=queue.then(fn).catch(error=>{lease=null;retryAt=Date.now()+65000;if(error.status===401){me=null;renderAccount();}$('#playtime-state').textContent=error.status===409?'Playtime is counting in another tab or device.':'Playtime could not sync. It will retry automatically.';});return queue;}
 async function pulse(stop=false,endedAt){
  if(!lease)return;
  const elapsed=Math.max(0,Math.min(60000,(endedAt??performance.now())-checkpoint));
  const data={lease,seq:++sequence,elapsed,stop};
  const response=await api('/play/pulse',{method:'POST',data,keepalive:stop});
  checkpoint=performance.now();if(stop)lease=null;
  if(me&&response.user.id===me.id){me=response.user;renderAccount(false);}
 }
 async function sync(){
  if(!active()){await pulse(true);$('#playtime-state').textContent=me?'Open a game to start counting.':'Log in to save your playtime.';return;}
  if(lease||Date.now()<retryAt)return;
  const response=await api('/play/start',{method:'POST',data:{gameId:game}});
  lease=response.lease;sequence=0;checkpoint=performance.now();
  if(!active()){await pulse(true);return;}
  $('#playtime-state').textContent='Counting while your game tab is visible.';
 }
 function syncTimer(){void enqueue(sync);}
 window.addEventListener('wacky-game-change',event=>{game=event.detail.playing&&event.detail.isGame?event.detail.id:null;if(!game){const ended=performance.now();void enqueue(()=>pulse(true,ended));}syncTimer();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){const ended=performance.now();void enqueue(()=>pulse(true,ended));}syncTimer();});
 window.addEventListener('pagehide',()=>{const ended=performance.now();void enqueue(()=>pulse(true,ended));});
 window.addEventListener('pageshow',syncTimer);
 setInterval(()=>{void enqueue(async()=>{if(active()&&lease)await pulse(false);else await sync();});},30000);
 channel?.addEventListener('message',()=>{void enqueue(()=>pulse(true)).then(restore);});
 const profileDialog=$('#public-profile');
 $('#public-profile-close').addEventListener('click',()=>profileDialog.close());
 async function openProfile(id){
  const generation=++profileGeneration;
  $('#public-profile-content').textContent='Loading profile…';if(!profileDialog.open)profileDialog.showModal();
  try{
   const user=(await api('/profiles/'+encodeURIComponent(id))).user;
   if(generation!==profileGeneration)return;
   const name=document.createElement('h2');name.id='public-profile-name';name.textContent=user.username;
   const bio=document.createElement('p');bio.className='public-bio';bio.textContent=user.bio||'No bio yet.';
   const time=document.createElement('p');time.className='public-time';time.textContent=duration(user.playSeconds)+' total playtime';
   $('#public-profile-content').replaceChildren(avatar(user,'large'),name,badge(user),bio,time);
  }catch(error){if(generation===profileGeneration)$('#public-profile-content').textContent=error.message;}
 }
 function personRow(user,podium=false){
  const button=document.createElement('button');button.type='button';button.className=podium?'podium-person place-'+user.rank:'leaderboard-person';
  const rank=document.createElement('span');rank.className='rank';rank.textContent='#'+user.rank;
  const name=document.createElement('strong');name.textContent=user.username;
  const time=document.createElement('span');time.className='rank-time';time.textContent=duration(user.playSeconds);
  button.append(rank,avatar(user),name,badge(user),time);button.addEventListener('click',()=>void openProfile(user.id));return button;
 }
 async function loadBoard(reset=true){
  const generation=++listGeneration;if(reset){offset=0;$('#leaderboard-list').replaceChildren();}
  $('#leaderboard-status').textContent='Loading leaderboard…';$('#leaderboard-more').disabled=true;
  try{
   const data=await api('/leaderboard?q='+encodeURIComponent($('#leaderboard-search').value.trim())+'&offset='+offset);
   if(generation!==listGeneration)return;
   $('#leaderboard-podium').replaceChildren(...data.top.map(u=>personRow(u,true)));
   data.users.forEach(user=>$('#leaderboard-list').append(personRow(user)));
   offset+=data.users.length;$('#leaderboard-more').hidden=!data.hasMore;
   $('#leaderboard-status').textContent=offset?'All-time game playtime. Select a player to view their profile.':'No accounts found.';
  }catch(error){if(generation===listGeneration)$('#leaderboard-status').textContent=error.message;}
  finally{if(generation===listGeneration)$('#leaderboard-more').disabled=false;}
 }
 $('#leaderboard-search').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>void loadBoard(),250);});
 $('#leaderboard-more').addEventListener('click',()=>void loadBoard(false));
 $('#leaderboard-refresh').addEventListener('click',()=>void loadBoard());
 window.showAccountPages=view=>{
  $('#leaderboard-panel').hidden=view!=='leaderboard';
  if(view==='leaderboard')void loadBoard();
  if(view==='settings')renderAccount();
 };
 renderAccount();void restore();
})();
