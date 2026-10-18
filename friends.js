(() => {
 'use strict';
 const account=window.WackyAccount,$=s=>document.querySelector(s),dialog=$('#friends-dialog');
 let rows=[],identity=null,generation=0,tab='friends',searchTimer,busy=false;
 const say=text=>$('#friends-status').textContent=text;
 function badges(){const n=account.user?.presence==='dnd'?0:rows.filter(r=>r.relationship==='incoming').length;document.querySelectorAll('.friend-count').forEach(el=>{el.hidden=!n;el.textContent=n;});}
 function button(label,fn){const b=document.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',fn);return b;}
 async function change(user,action){const id=account.user?.id;if(!id)return;await account.api('/friends',{method:'POST',data:{userId:user.id,action}});if(account.user?.id!==id)return;await refresh();window.dispatchEvent(new Event('wacky-friends-change'));}
 function mount(parent,user){
  const box=document.createElement('div');box.className='friend-actions profile-friend-actions';parent.append(box);const id=account.user?.id;if(!id||id===user.id)return;
  async function update(){try{const data=await account.api('/friends?user='+encodeURIComponent(user.id));if(account.user?.id!==id)return;paintActions(box,user,data.relationship,update);}catch(e){profileError(box,e.message);}}
  void update();
 }
 function profileError(box,message){
  const target=box.closest('.public-profile-top')||box;target.querySelector('.friend-error')?.remove();
  const error=document.createElement('small');error.className='friend-error';error.setAttribute('role','status');error.textContent=message;target.append(error);
 }
 function paintActions(box,user,relationship,done){
  box.replaceChildren();box.closest('.public-profile-top')?.querySelector('.friend-error')?.remove();
  const choices=relationship==='friends'?[['Remove friend','remove']]:relationship==='incoming'?[['Accept','accept'],['Decline','decline']]:relationship==='outgoing'?[['Cancel request','cancel']]:[['Add friend','request']];
  for(const [label,action]of choices){const b=button(label,async()=>{box.querySelectorAll('button').forEach(b=>b.disabled=true);try{await change(user,action);await done();}catch(e){profileError(box,e.message);box.querySelectorAll('button').forEach(b=>b.disabled=false);}});if(box.classList.contains('profile-friend-actions'))account.profileIcon(b,action,label);box.append(b);}
 }
 function paint(list=rows.filter(r=>r.relationship===tab)){
  const target=$('#friends-list');target.replaceChildren();
  for(const row of list){const u=row.user,item=document.createElement('div');item.className='friend-row';const profile=button('',()=>{dialog.close();void account.openProfile(u.id);});profile.className='friend-person';profile.append(account.avatar(u));const details=document.createElement('span'),name=document.createElement('strong'),status=document.createElement('small');name.textContent=u.username;status.textContent=row.relationship==='friends'?(u.status==='online'?'Online':u.status==='dnd'?'Do not disturb':'Offline'):row.relationship==='incoming'?'Wants to be your friend':row.relationship==='outgoing'?'Request sent':'View profile';details.append(name,status);profile.append(details);item.append(profile);const actions=document.createElement('div');actions.className='friend-actions';paintActions(actions,u,row.relationship,()=>refresh());if(row.relationship==='friends')actions.prepend(button('Message',()=>{dialog.close();window.WackyMessages?.dm(u);}));item.append(actions);target.append(item);}
  if(!list.length){const empty=document.createElement('p');empty.className='friends-empty';empty.textContent=$('#friends-search').value.trim()?'No matching players.':tab==='friends'?'No friends yet. Search for someone or add them from their profile.':tab==='incoming'?'No pending requests.':'No sent requests.';target.append(empty);}
 }
 async function refresh(){
  if(!account.user)return;const token=++generation,id=account.user.id,query=$('#friends-search').value.trim();
  try{const data=await account.api('/friends');if(token!==generation||account.user?.id!==id)return;rows=data.friends;badges();if(!dialog.open)return;
   if(query.length>=2){const result=await account.api('/friends/search?q='+encodeURIComponent(query));if(token!==generation||account.user?.id!==id)return;paint(result.users.map(user=>({user,relationship:rows.find(r=>r.user.id===user.id)?.relationship||'none'})));say('');}
   else{paint();say(query?'Type at least two letters.':'');}
  }catch(e){if(token===generation&&dialog.open)say(e.message);}
 }
 function sync(){const id=account.user?.id||null;if(identity===id){badges();return;}identity=id;++generation;rows=[];badges();$('#friends-search').value='';if(!id){dialog.close();return;}void refresh();}
 document.querySelectorAll('[data-open-friends]').forEach(b=>b.addEventListener('click',()=>{if(!account.user){account.open();return;}$('#account-dialog').close();tab='friends';$('#friends-search').value='';document.querySelectorAll('[data-friends-tab]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.friendsTab===tab)));dialog.showModal();say('Loading friends…');void refresh();}));
 document.querySelectorAll('[data-friends-tab]').forEach(b=>b.addEventListener('click',()=>{tab=b.dataset.friendsTab;$('#friends-search').value='';document.querySelectorAll('[data-friends-tab]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));paint();say('');void refresh();}));
 $('#friends-search').addEventListener('input',()=>{++generation;clearTimeout(searchTimer);searchTimer=setTimeout(()=>void refresh(),250);});
 window.addEventListener('wacky-account-change',sync);document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh();});
 setInterval(()=>{if(!document.hidden&&!busy){busy=true;void refresh().finally(()=>{busy=false;});}},30000);
 const accountBadge=document.createElement('span');accountBadge.className='friend-count friend-nav-count';accountBadge.hidden=true;accountBadge.setAttribute('aria-label','Pending friend requests');document.querySelector('.nav-settings[data-open-account]').append(accountBadge);
 window.WackyFriends={mount,refresh};sync();
})();
