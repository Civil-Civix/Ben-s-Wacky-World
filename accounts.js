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
  const el=document.createElement('span');el.className='profile-avatar '+size;if(user){el.dataset.status=['online','dnd'].includes(user.status)?user.status:'offline';el.title=el.dataset.status==='dnd'?'Do not disturb':el.dataset.status==='online'?'Online':'Offline';}
  if(user?.avatarVersion){const img=document.createElement('img');img.src=avatarURL(user);img.alt='';img.addEventListener('error',()=>{el.innerHTML=person;},{once:true});el.append(img);}
  else el.innerHTML=person;
  return el;
 }
 function badge(user){const b=document.createElement('span');b.className='owner-badge';b.textContent='Owner';b.hidden=!user.owner;return b;}
 async function api(path,{method='GET',data,raw,keepalive=false,timeout=20000}={}){
  const response=await fetch(API+path,{method,credentials:'include',headers:{'X-Wacky-Client':'1',...(raw?{'Content-Type':'image/jpeg'}:data!==undefined?{'Content-Type':'application/json'}:{})},
   ...(raw?{body:raw}:data!==undefined?{body:JSON.stringify(data)}:{}),keepalive,signal:AbortSignal.timeout(timeout)});
  const result=await response.json();
  if(!response.ok){const error=new Error(result.error||'Please try again.');error.status=response.status;throw error;}
  return result;
 }
 window.WackyAccount={api,avatar,openProfile,open:openAccount,get user(){return me;}};
 const accountDialog=$('#account-dialog');
 function openAccount(){renderAccount();note('');if(!accountDialog.open)accountDialog.showModal();$('.nav-settings').setAttribute('data-active','');if(!me)$('#auth-username').focus();}
 document.querySelectorAll('[data-open-account]').forEach(button=>button.addEventListener('click',e=>{e.preventDefault();openAccount();}));
 $('#account-dialog-close').addEventListener('click',()=>accountDialog.close());
 document.querySelectorAll('[data-close-account]').forEach(button=>button.addEventListener('click',()=>accountDialog.close()));
 accountDialog.addEventListener('close',()=>{$('#auth-password').value='';$('#auth-confirm').value='';$('.nav-settings').removeAttribute('data-active');});
 function previewProfile(){
  if(!me)return;
  $('#my-name').textContent=$('#profile-username').value||me.username;
  $('#account-preview-banner').style.backgroundColor=$('#profile-banner').value;
  $('#account-preview-pronouns').textContent=$('#profile-pronouns').value;
  $('#account-preview-bio').textContent=$('#profile-bio').value||'No bio yet.';
  const favorite=(window.WACKY_GAMES||[]).find(g=>g.id===$('#profile-favorite-game').value);
  $('#account-preview-favorite').textContent=favorite?'Favorite game · '+favorite.title:'';
  const roles=$('#account-preview-roles');roles.replaceChildren();for(const role of me.roles||[]){const pill=document.createElement('span');pill.className='profile-role';pill.textContent=role.name;if(/^#[0-9a-f]{6}$/i.test(role.color))pill.style.setProperty('--role-color',role.color);roles.append(pill);}
 }
 $('#profile-form').addEventListener('input',previewProfile);
 function renderAccount(fill=true){
  window.dispatchEvent(new Event('wacky-account-change'));
  document.querySelectorAll('[data-account-avatar]').forEach(el=>el.replaceChildren(avatar(me)));
  $('#account-auth').hidden=!!me;$('#account-profile').hidden=!me;accountDialog.dataset.signedIn=String(!!me);
  $('#account-dialog-title').textContent=me?'Account Settings':mode==='login'?'Welcome back':'Create your account';
  if(me){
   paintStatus();
   $('#my-avatar').replaceChildren(avatar(me,'large'));
   $('#my-name').textContent=me.username;$('#my-badge').replaceChildren(badge(me));
   $('#my-playtime').textContent=duration(me.playSeconds);
   if(fill){$('#profile-username').value=me.username;$('#profile-bio').value=me.bio;$('#profile-pronouns').value=me.pronouns||'';$('#profile-favorite-game').value=me.favoriteGame||'';$('#profile-presence').value=me.presence||'online';$('#profile-banner').value=me.bannerColor||'#24242c';$('#profile-banner-preview').style.backgroundColor=me.bannerColor||'#24242c';}
   previewProfile();
  }
 }
 async function restore(){
  const generation=++authGeneration;
  try{const result=await api('/me');if(generation!==authGeneration)return;me=result.user;note('');}
  catch(error){if(generation!==authGeneration)return;me=null;if(error.status!==401)note(error.status===403?error.message:'Accounts are temporarily unavailable. You can still play as a guest.',true);}
  sessionReady=true;renderAccount();syncTimer();
 }
 function changeMode(next){
  mode=next;$('#auth-submit').textContent=mode==='login'?'Log in':'Create account';
  $('#auth-password').autocomplete=mode==='login'?'current-password':'new-password';
  $('#auth-password').minLength=mode==='login'?1:8;
  $('#signup-notice').hidden=mode!=='signup';$('#no-recovery').required=mode==='signup';
  document.querySelectorAll('[data-auth-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.authMode===mode)));
  $('#auth-confirm-label').hidden=mode!=='signup';$('#auth-confirm').required=mode==='signup';$('#auth-confirm').value='';$('#auth-confirm').setCustomValidity('');
  $('#account-dialog-title').textContent=mode==='login'?'Welcome back':'Create your account';
  $('#auth-description').textContent=mode==='login'?'Log in to save your playtime, chat, and use Ben AI.':'Create a profile to save your playtime and join the Wacky crowd.';
  $('#auth-switch-label').textContent=mode==='login'?'Need an account?':'Already have an account?';$('#auth-switch').textContent=mode==='login'?'Sign up':'Log in';$('#auth-switch').dataset.authMode=mode==='login'?'signup':'login';
  $('#auth-password').value='';note('');
 }
 document.querySelectorAll('[data-auth-mode]').forEach(b=>b.addEventListener('click',()=>changeMode(b.dataset.authMode)));
 $('#auth-form').addEventListener('submit',async event=>{
  event.preventDefault();if(mode==='signup'&&$('#auth-password').value!==$('#auth-confirm').value){note('Passwords do not match.',true);$('#auth-confirm').focus();return;}++authGeneration;const button=$('#auth-submit');button.disabled=true;note('Signing in…');
  try{
   const result=await api('/'+mode,{method:'POST',data:{username:$('#auth-username').value.trim(),password:$('#auth-password').value,noRecovery:$('#no-recovery').checked}});
   // Verify persistence rather than pretending a blocked cookie signed the user in.
   me=(await api('/me')).user;
   $('#auth-password').value='';$('#auth-confirm').value='';sessionReady=true;renderAccount();note(mode==='signup'?'Account created. Welcome!':'Welcome back!');
   channel?.postMessage('changed');syncTimer();
  }catch(error){note(error.status===401?'Login could not be kept, or your credentials are incorrect. Check your username/password and allow this site’s sign-in cookies.':error.message,true);}
  finally{button.disabled=false;}
 });
 $('#profile-form').addEventListener('submit',async event=>{
  event.preventDefault();const button=$('#profile-save');button.disabled=true;
  try{me=(await api('/me',{method:'PATCH',data:{username:$('#profile-username').value.trim(),bio:$('#profile-bio').value,bannerColor:$('#profile-banner').value,pronouns:$('#profile-pronouns').value}})).user;renderAccount();note('Profile saved.');channel?.postMessage('changed');}
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
   $('#public-profile .public-profile-banner').style.background=user.bannerColor||'#24242c';
   const top=document.createElement('div');top.className='public-profile-top';top.append(avatar(user,'large'));
   if(me&&me.id!==user.id){const dm=document.createElement('button');dm.type='button';dm.className='profile-message-button';dm.textContent='Message';dm.addEventListener('click',()=>{profileDialog.close();window.WackyMessages?.dm(user);});const actions=document.createElement('div');actions.className='public-profile-buttons';const challenge=document.createElement('button');challenge.type='button';challenge.className='profile-challenge-button';challenge.textContent='Challenge';challenge.title='Challenge to a 6v6 random battle';challenge.setAttribute('aria-label','Challenge '+user.username);challenge.addEventListener('click',()=>void window.WackyBattles?.challenge(user));actions.append(dm,challenge);top.append(actions);}
   if(me?.owner&&!user.owner){const manage=document.createElement('button');manage.type='button';manage.className='profile-message-button';manage.textContent='Manage';manage.addEventListener('click',()=>{profileDialog.close();window.WackyAdmin?.open(user.username);});top.append(manage);}
   const name=document.createElement('h2');name.id='public-profile-name';name.textContent=user.username;
   const identity=document.createElement('div');identity.className='public-profile-identity';identity.append(name,badge(user));
   const roles=document.createElement('div');roles.className='profile-roles';for(const role of user.roles||[]){const pill=document.createElement('span');pill.className='profile-role';pill.textContent=role.name;if(/^#[0-9a-f]{6}$/i.test(role.color))pill.style.setProperty('--role-color',role.color);roles.append(pill);}
   const pronouns=document.createElement('p');pronouns.className='public-pronouns';pronouns.textContent=user.pronouns||'';pronouns.hidden=!user.pronouns;
   const status=document.createElement('p');status.className='public-profile-status';status.textContent=user.status==='online'?'Online':user.status==='dnd'?'Do not disturb':'Offline';
   const bio=document.createElement('p');bio.className='public-bio';bio.textContent=user.bio||'No bio yet.';
   const details=document.createElement('dl');details.className='public-profile-details';
   for(const [label,value] of [['Total playtime',duration(user.playSeconds)],['Joined',Number.isFinite(user.created)?new Date(user.created).toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'}):'—']]){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;details.append(dt,dd);}
   const favorite=document.createElement('div');favorite.className='public-favorite-game';const favoriteGame=(window.WACKY_GAMES||[]).find(g=>g.id===user.favoriteGame);if(favoriteGame){const label=document.createElement('small'),title=document.createElement('strong');label.textContent='Favorite game';title.textContent=favoriteGame.title;favorite.append(label,title);}else favorite.hidden=true;
   $('#public-profile-content').replaceChildren(top,identity,pronouns,status,roles,bio,favorite,details);
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
 };
 const favoriteSelect=$('#profile-favorite-game');
 for(const game of [...(window.WACKY_GAMES||[])].sort((a,b)=>a.title.localeCompare(b.title))){const option=document.createElement('option');option.value=game.id;option.textContent=game.title;favoriteSelect.append(option);}
 favoriteSelect.addEventListener('change',async()=>{
  if(!me)return;const id=me.id,favoriteGame=favoriteSelect.value;favoriteSelect.disabled=true;
  try{const current=(await api('/me')).user;if(me?.id!==id)return;const result=await api('/me',{method:'PATCH',data:{username:current.username,bio:current.bio,favoriteGame}});if(me?.id!==id)return;me=result.user;renderAccount(false);note('Favorite game saved.');channel?.postMessage('changed');}
  catch(error){if(me?.id===id){favoriteSelect.value=me.favoriteGame||'';note(error.message,true);}}finally{favoriteSelect.disabled=false;}
 });
 $('#profile-banner').addEventListener('input',e=>{$('#profile-banner-preview').style.backgroundColor=e.target.value;});
 const statusPicker=$('#status-picker');let statusTarget='profile-presence';
 document.querySelectorAll('[data-status-target]').forEach(button=>button.addEventListener('click',()=>{statusTarget=button.dataset.statusTarget;document.querySelectorAll('[data-status-choice]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.statusChoice===(me?.presence||'online'))));statusPicker.showModal();}));
 document.querySelectorAll('[data-status-choice]').forEach(button=>button.addEventListener('click',()=>{statusPicker.close();const select=$('#'+statusTarget);select.value=button.dataset.statusChoice;select.dispatchEvent(new Event('change'));}));
 let statusBusy=false;
 function paintStatus(){
  if(!me)return;for(const id of ['profile-presence','chat-presence']){$('#'+id).value=me.presence||'online';$('#'+id).disabled=statusBusy;}
  document.querySelectorAll('[data-status-target]').forEach(button=>{const value=me.presence||'online';button.querySelector('i').dataset.status=value;button.querySelector('span').textContent=value==='online'?'Online':value==='dnd'?'Do not disturb':'Appear offline';button.disabled=statusBusy;});
  $('#chat-self-avatar').replaceChildren(avatar(me));$('#chat-self-name').textContent=me.username;
 }
 async function changeStatus(value){
  if(!me||statusBusy)return;const id=me.id;statusBusy=true;paintStatus();$('#chat-presence-note').textContent='';
  try{const current=(await api('/me')).user;if(me?.id!==id)return;const result=await api('/me',{method:'PATCH',data:{username:current.username,bio:current.bio,presence:value}});if(me?.id!==id)return;me=result.user;renderAccount(false);note('Status updated.');channel?.postMessage('changed');}
  catch(error){note(error.message,true);$('#chat-presence-note').textContent=error.message;}
  finally{statusBusy=false;paintStatus();}
 }
 for(const id of ['profile-presence','chat-presence'])$('#'+id).addEventListener('change',e=>void changeStatus(e.target.value));
 let presenceBusy=false;
 async function heartbeat(){
  if(!me||presenceBusy)return;const id=me.id;presenceBusy=true;
  try{const state=await api('/presence',{method:'POST',data:{}});if(me?.id===id){const changed=me.presence!==state.presence;me={...me,...state};document.querySelectorAll('[data-account-avatar]').forEach(el=>el.replaceChildren(avatar(me)));$('#my-avatar').replaceChildren(avatar(me,'large'));paintStatus();if(changed)window.dispatchEvent(new Event('wacky-account-change'));}}
  catch{}finally{presenceBusy=false;}
 }
 window.addEventListener('wacky-account-change',()=>void heartbeat());
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void heartbeat();});
 window.addEventListener('pageshow',()=>void heartbeat());
 setInterval(()=>void heartbeat(),30000);
 renderAccount();void restore();
})();
