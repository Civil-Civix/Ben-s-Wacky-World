(() => {
 'use strict';
 if(location.hostname!=='bens-wacky-world.pages.dev')return;
 const account=window.WackyAccount,id='next-big-thing-20261102',dismissKey='wacky-poll-later:'+id;
 const choices=[
  ['tournaments','🏆','Tournaments','Join tournaments against other players and earn trophies and profile achievements.','#ffcb54'],
  ['wacky-phone','☎️','Wacky Phone','Play drawing telephone with friends. Write a prompt, draw someone else’s, then guess what their drawing is.','#b699ff'],
  ['daily-games','🗓️','Daily Games','Play Krillion and other daily games directly on the site.','#60dbbc'],
  ['music','🎧','Music App','Listen to music, make playlists, and control playback without leaving your game.','#ff8cb5']
 ];
 const home=document.querySelector('#home-panel'),button=document.createElement('button');
 button.type='button';button.className='feature-poll-launch';button.innerHTML='<span aria-hidden="true">✦</span><span><strong>You pick what’s next</strong><small>Choose between four new features.</small></span><span aria-hidden="true">Vote →</span>';
 home.querySelector('.updates-log')?.closest('details')?.before(button);
 if(!button.isConnected)home.append(button);
 const dialog=document.createElement('dialog');dialog.id='feature-poll-dialog';dialog.setAttribute('aria-labelledby','feature-poll-title');
 dialog.innerHTML='<button type="button" class="poll-x" aria-label="Close voting">×</button><h2 id="feature-poll-title">Vote for the next feature!</h2><p class="poll-intro">What should we build next for Wacky World? Pick your favorite.</p><form><fieldset class="poll-choices"><legend class="sr-only">Choose the next feature</legend></fieldset><p class="poll-status" role="status" aria-live="polite"></p><div class="poll-actions"><button type="button" class="poll-later">Maybe later</button><button type="button" class="poll-retry" hidden>Try again</button><button type="submit" class="poll-vote">Cast my vote ✦</button></div></form><p class="poll-fine">One vote per account. Change your pick until November 9, 12 AM Arizona time.<br>These are ideas for what comes next—not features available yet.</p>';
 document.body.append(dialog);
 const $=s=>dialog.querySelector(s),field=$('fieldset'),status=$('.poll-status'),vote=$('.poll-vote');
 for(const [key,icon,title,description,color] of choices){
  const label=document.createElement('label');label.className='poll-card';label.style.setProperty('--poll-color',color);
  label.innerHTML='<input type="radio" name="feature" value="'+key+'"><span class="poll-art" aria-hidden="true">'+icon+'</span><span class="poll-check" aria-hidden="true">✓</span><strong>'+title+'</strong><span class="poll-description">'+description+'</span><span class="poll-result" hidden><span class="poll-meter"><span></span></span><span class="poll-tally"></span></span>';
  field.append(label);
 }
 let data=null,selected=null,busy=false,loaded=false,sequence=0,opener=null,autoStarted=false,pendingLogin=false;
 const day=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Phoenix',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const dismissed=()=>{try{return localStorage.getItem(dismissKey)===day();}catch{return false;}};
 function paint(){
  const closed=data?.closed||Boolean(data&&Date.now()>=data.closes),results=Boolean(data&&(data.myVote||closed));
  for(const input of field.querySelectorAll('input')){
   input.checked=input.value===selected;input.disabled=busy||!loaded||closed;
   const card=input.closest('label'),result=card.querySelector('.poll-result'),count=data?.counts[input.value]||0,percent=data?.total?Math.round(count/data.total*100):0;
   card.classList.toggle('is-picked',input.checked);result.hidden=!results;
   card.querySelector('.poll-meter span').style.width=percent+'%';card.querySelector('.poll-tally').textContent=percent+'% · '+count+' vote'+(count===1?'':'')+(data?.myVote===input.value?' · Your vote':'');
  }
  vote.disabled=busy||!loaded||closed||!selected||(Boolean(account.user)&&selected===data?.myVote);
  vote.textContent=busy?'Saving your vote…':closed?'Voting closed':!account.user?'Sign in to vote':data?.myVote?'Update my vote ✦':'Cast my vote ✦';
  $('.poll-later').textContent=data?.myVote||closed?'Done':'Maybe later';
 }
 async function refresh(){
  const version=++sequence;loaded=false;paint();status.textContent='Loading the ballot…';$('.poll-retry').hidden=true;
  try{const next=await account.api('/feature-poll');if(version!==sequence)return;data=next;loaded=true;selected=next.myVote||selected;paint();status.textContent=next.closed?'The votes are in! Here’s what the community picked.':next.myVote?'You’re on the board! '+next.total+' vote'+(next.total===1?'':'s')+' so far.':'Pick one. Make it count.';}
  catch(error){if(version!==sequence)return;status.textContent='Couldn’t load voting. Try again in a moment.';$('.poll-retry').hidden=false;paint();}
 }
 function dismiss(){try{localStorage.setItem(dismissKey,day());}catch{}dialog.close();}
 function open(){if(dialog.open)return;opener=document.activeElement;dialog.showModal();void refresh();}
 button.addEventListener('click',open);$('.poll-x').addEventListener('click',dismiss);$('.poll-later').addEventListener('click',dismiss);
 dialog.addEventListener('cancel',event=>{event.preventDefault();dismiss();});dialog.addEventListener('close',()=>opener?.focus());
 $('.poll-retry').addEventListener('click',refresh);
 field.addEventListener('change',event=>{selected=event.target.value;paint();});
 $('form').addEventListener('submit',async event=>{
  event.preventDefault();if(busy||!loaded||!selected||data?.closed)return;
  if(!account.user){pendingLogin=true;dialog.close();account.open();return;}
  busy=true;paint();const version=++sequence;
  try{const next=await account.api('/feature-poll',{method:'POST',data:{poll:id,choice:selected}});if(version!==sequence)return;data=next;selected=next.myVote;status.textContent='Vote locked in! You helped choose our next adventure. ✦';dialog.classList.remove('poll-celebrate');void dialog.offsetWidth;dialog.classList.add('poll-celebrate');try{localStorage.setItem('wacky-poll-voted:'+id+':'+account.user.id,'1');}catch{}}
  catch(error){if(version===sequence)status.textContent=error.message||'Your vote wasn’t saved. Please try again.';}
  finally{if(version===sequence){busy=false;paint();}}
 });
 document.querySelector('#account-dialog').addEventListener('close',()=>{if(pendingLogin&&account.user){pendingLogin=false;open();}});
 window.addEventListener('wacky-account-change',()=>{++sequence;busy=false;data=null;loaded=false;if(dialog.open)void refresh();else if(autoStarted&&!dismissed()&&!pendingLogin){autoStarted=false;setTimeout(launch,200);}});
 // Do not interrupt a game or another dialog while showing the launch invitation.
 async function launch(){
  if(autoStarted||dismissed())return;autoStarted=true;
  await refresh();if(!loaded||data.myVote||data.closed)return;
  let attempts=0;function offer(){if(dismissed()||data?.myVote||dialog.open)return;if(document.hidden||document.querySelector('dialog[open]')||document.body.classList.contains('playing')){if(++attempts<60)setTimeout(offer,1000);return;}opener=document.activeElement;dialog.showModal();}offer();
 }
 setTimeout(launch,1500);
 window.addEventListener('storage',event=>{if(event.key===dismissKey&&dismissed()&&dialog.open&&!busy)dialog.close();});
})();
