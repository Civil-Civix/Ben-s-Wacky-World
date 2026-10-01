(() => {
 'use strict';
 const $=s=>document.querySelector(s),account=window.WackyAccount;
 let open=false,to=null,rows=[],generation=0,timer,peopleTimer,busy=false,oldest=null,lastPeople=0,identity=null,replyTo=null;
 let unreadTimer,unreadBusy=false,unreadIdentity=null,unreadCounts=new Map(),readBusy=false,readTimer;
 const readThrough=new Map(),photoCache=new Map();
 let selectedPerson=null,attachment=null,photoReading=false,photoGeneration=0,searchGeneration=0;
 const picker=$('#dm-picker'),groupPicker=$('#group-picker'),emojiPicker=$('#emoji-picker');
 const groupMembers=new Map();let groupSearchToken=0,groupSearchTimer,groupCreating=false;
 const isGroup=()=>!!to?.startsWith('group:');
 function groupButton(group){const b=document.createElement('button');b.type='button';b.dataset.dmPerson='group:'+group.id;b.textContent=group.name+' · '+group.count;b.setAttribute('aria-pressed',String(to===b.dataset.dmPerson));b.addEventListener('click',()=>choose({id:b.dataset.dmPerson,username:group.name,group:true}));return b;}
 function paintGroupSelection(){
  $('#group-selected').replaceChildren(...[...groupMembers.values()].map(u=>{const b=document.createElement('button');b.type='button';b.textContent=u.username+' ×';b.setAttribute('aria-label','Remove '+u.username);b.addEventListener('click',()=>{groupMembers.delete(u.id);paintGroupSelection();void searchGroupPeople();});return b;}));
  $('#group-create').disabled=groupCreating||groupMembers.size<2;
 }
 async function searchGroupPeople(){
  const q=$('#group-search').value.trim(),token=++groupSearchToken,id=account.user?.id,list=$('#group-results');
  if(q.length<2){list.textContent='Type at least two letters';return;}list.textContent='Searching…';
  try{const data=await account.api('/chat/people?q='+encodeURIComponent(q));if(token!==groupSearchToken||id!==account.user?.id||!groupPicker.open)return;
   list.replaceChildren(...data.users.map(u=>{const b=document.createElement('button');b.type='button';b.append(account.avatar(u),document.createTextNode(u.username));b.disabled=groupMembers.has(u.id)||groupMembers.size>=9;b.setAttribute('aria-label','Add '+u.username);b.addEventListener('click',()=>{groupMembers.set(u.id,u);paintGroupSelection();void searchGroupPeople();});return b;}));if(!data.users.length)list.textContent='No accounts found.';
  }catch(e){if(token===groupSearchToken)list.textContent=e.message;}
 }
 $('#messages-new-group').addEventListener('click',()=>{groupMembers.clear();$('#group-create-form').reset();$('#group-error').textContent='';$('#group-results').textContent='Type at least two letters';paintGroupSelection();groupPicker.showModal();$('#group-name').focus();});
 $('#group-search').addEventListener('input',()=>{clearTimeout(groupSearchTimer);groupSearchTimer=setTimeout(searchGroupPeople,250);});
 groupPicker.addEventListener('close',()=>{++groupSearchToken;});$('#group-cancel').addEventListener('click',()=>groupPicker.close());
 $('#group-create-form').addEventListener('submit',async e=>{e.preventDefault();if(groupCreating||groupMembers.size<2)return;const id=account.user?.id;groupCreating=true;paintGroupSelection();
  try{const result=await account.api('/chat/groups',{method:'POST',data:{name:$('#group-name').value.trim(),members:[...groupMembers.keys()]}});if(id!==account.user?.id)return;groupPicker.close();choose({id:'group:'+result.group.id,username:result.group.name,group:true});}
  catch(e){if(id===account.user?.id)$('#group-error').textContent=e.message;}finally{groupCreating=false;paintGroupSelection();}
 });
 $('#messages-leave-group').addEventListener('click',()=>{$('#group-leave-error').textContent='';$('#group-leave-picker').showModal();});
 $('#group-leave-cancel').addEventListener('click',()=>$('#group-leave-picker').close());
 $('#group-leave-confirm').addEventListener('click',async()=>{if(!isGroup())return;const target=to;$('#group-leave-confirm').disabled=true;try{await account.api('/chat/groups/'+encodeURIComponent(target.slice(6))+'/leave',{method:'POST',data:{}});$('#group-leave-picker').close();if(to===target)choose();}catch(e){$('#group-leave-error').textContent=e.message;}finally{$('#group-leave-confirm').disabled=false;}});
 const emojiChoices=[['😀','Grinning'],['😃','Happy'],['😄','Big smile'],['😁','Beaming'],['😆','Laughing'],['😅','Nervous laugh'],['😂','Tears of joy'],['🤣','Rolling with laughter'],['😊','Smiling'],['😇','Innocent'],['🙂','Slight smile'],['🙃','Upside down'],['😉','Winking'],['😍','Heart eyes'],['🥰','Feeling loved'],['😘','Blowing a kiss'],['😎','Cool'],['🤩','Star struck'],['🥳','Party'],['😭','Crying'],['🥺','Pleading'],['😔','Sad'],['😡','Angry'],['😱','Shocked'],['🤔','Thinking'],['❤️','Heart'],['💔','Broken heart'],['🙏','Prayer'],['💩','Poop'],['🥀','Wilted flower']];
 let selectionStart=0,selectionEnd=0;
 $('#messages-emoji').addEventListener('click',()=>{const input=$('#messages-text');selectionStart=input.selectionStart;selectionEnd=input.selectionEnd;emojiPicker.showModal();});
 $('#emoji-close').addEventListener('click',()=>emojiPicker.close());
 for(const [emoji,label] of emojiChoices){const b=document.createElement('button');b.type='button';b.textContent=emoji;b.title=label;b.setAttribute('aria-label',label);b.addEventListener('click',()=>{const input=$('#messages-text');if(input.value.length-(selectionEnd-selectionStart)+emoji.length>input.maxLength){note('Your message is full. Remove some text first.');return;}input.setRangeText(emoji,selectionStart,selectionEnd,'end');input.dispatchEvent(new Event('input',{bubbles:true}));emojiPicker.close();input.focus();});$('#emoji-grid').append(b);}

 function clearPhoto(){++photoGeneration;attachment=null;$('#messages-photo-file').value='';$('#messages-attachment').hidden=true;$('#messages-attachment img').removeAttribute('src');}
 async function loadPhoto(message,img){
  const id=account.user?.id,key=id+':'+message.id;
  try{let pending=photoCache.get(key);if(!pending){pending=account.api('/chat/photos/'+message.id);photoCache.set(key,pending);}const result=await pending;if(account.user?.id===id&&result.expires>Date.now()&&img.isConnected)img.src=result.photo;}
  catch{photoCache.delete(key);img.alt='Photo unavailable';}
 }
 function personButton(user){const b=document.createElement('button'),name=document.createElement('span');b.type='button';b.dataset.dmPerson=user.id;name.textContent=user.username;b.append(account.avatar(user),name);b.setAttribute('aria-pressed',String(to===user.id));b.addEventListener('click',()=>{picker.close();choose(user);});return b;}
 async function searchPeople(){
  const q=$('#messages-search').value.trim(),token=++searchGeneration,id=account.user?.id,list=$('#dm-picker-results');
  if(q.length<2){list.textContent='Type at least two letters';return;}list.textContent='Searching…';
  try{const result=await account.api('/chat/people?q='+encodeURIComponent(q));if(token!==searchGeneration||id!==account.user?.id||!picker.open)return;list.replaceChildren(...result.users.map(personButton));if(!result.users.length)list.textContent='No accounts found.';}
  catch(e){if(token===searchGeneration)list.textContent=e.message;}
 }
 $('#messages-new').addEventListener('click',()=>{$('#messages-search').value='';$('#dm-picker-results').textContent='Type at least two letters';picker.showModal();$('#messages-search').focus();});
 picker.addEventListener('close',()=>{++searchGeneration;});
 $('#messages-attach').addEventListener('click',()=>$('#messages-photo-file').click());
 $('#messages-remove-photo').addEventListener('click',clearPhoto);
 $('#messages-photo-file').addEventListener('change',async e=>{
  const file=e.target.files[0];if(!file)return;const token=++photoGeneration;photoReading=true;$('#messages-attach').disabled=true;
  try{
   if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>8*1024*1024)throw Error('Choose a PNG, JPEG, or WebP photo under 8 MB.');
   const image=await createImageBitmap(file);let data;
   try{const scale=Math.min(1,960/Math.max(image.width,image.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);for(const quality of [.8,.6,.4,.25]){data=canvas.toDataURL('image/jpeg',quality);if(data.length<=100000)break;}if(data.length>100000)throw Error('Try a smaller crop of this photo.');}finally{image.close();}
   if(token!==photoGeneration)return;attachment=data;$('#messages-attachment img').src=data;$('#messages-attachment span').textContent=file.name;$('#messages-attachment').hidden=false;note('');
  }catch(e){if(token===photoGeneration)note(e.message);}finally{photoReading=false;$('#messages-attach').disabled=busy;}
 });
 function paintUnread(){
  const quiet=account.user?.presence==='dnd',count=quiet?0:[...unreadCounts.values()].reduce((a,b)=>a+b,0),badge=$('#dm-unread-badge');badge.hidden=!count;badge.textContent=count>9?'9+':String(count);
  $('.nav-messages').setAttribute('aria-label',count?'Chat, '+count+' unread messages':'Chat');
  document.querySelectorAll('[data-dm-person]').forEach(b=>{const n=quiet?0:unreadCounts.get(b.dataset.dmPerson)||0;let tag=b.querySelector('.dm-person-unread');if(!tag){tag=document.createElement('span');tag.className='dm-person-unread';b.append(tag);}tag.hidden=!n;tag.textContent=n>9?'9+':String(n);});
 }
 async function refreshUnread(){
  const id=account.user?.id||null;
  if(id!==unreadIdentity){unreadIdentity=id;unreadCounts.clear();readThrough.clear();paintUnread();}
  if(!id||document.hidden||unreadBusy)return;
  unreadBusy=true;
  try{const data=await account.api('/chat/unread');if(account.user?.id===id){unreadCounts=new Map(data.conversations.map(c=>[c.sender,c.count]));paintUnread();}}catch(e){if(e.status===401){unreadCounts.clear();paintUnread();}}finally{unreadBusy=false;}
 }
 function scheduleUnread(){clearTimeout(unreadTimer);void refreshUnread().finally(()=>{if(account.user&&!document.hidden)unreadTimer=setTimeout(scheduleUnread,10000);});}
 async function markVisible(){
  if(!active()||!to||readBusy||document.querySelector('dialog[open]'))return;
  const log=$('#messages-log').getBoundingClientRect(),peer=to,id=account.user.id;
  const seen=rows.filter(m=>(peer.startsWith('group:')?m.user.id!==id:m.user.id===peer)&&m.expires>Date.now()).filter(m=>{const el=document.getElementById('message-'+m.id);if(!el)return false;const r=el.getBoundingClientRect();return r.top<log.bottom&&r.bottom>log.top;});
  const through=Math.max(0,...seen.map(m=>m.id));if(through<=(readThrough.get(peer)||0))return;
  readBusy=true;try{await account.api('/chat/read',{method:'POST',data:{to:peer,through}});if(account.user?.id===id){readThrough.set(peer,through);await refreshUnread();}}catch{}finally{readBusy=false;}
 }
 $('#messages-log').addEventListener('scroll',()=>{clearTimeout(readTimer);readTimer=setTimeout(markVisible,200);});
 const note=text=>$('#messages-status').textContent=text;
 function setReply(message=null){replyTo=message;$('#messages-reply').hidden=!message;$('#messages-reply-text').textContent=message?'Replying to '+message.user.username+': '+(message.text||'Photo').slice(0,140):'';}
 const active=()=>open&&!document.hidden&&!!account.user;
 let painted='';
 function paint(){
  rows=rows.filter(m=>m.expires>Date.now());for(const key of photoCache.keys())if(!rows.some(m=>key.endsWith(':'+m.id)))photoCache.delete(key);
  const signature=JSON.stringify(rows.map(m=>({...m,reply:m.reply?.expires<=Date.now()?{id:m.reply.id}:m.reply})));if(signature===painted)return;painted=signature;
  const log=$('#messages-log'),bottom=log.scrollHeight-log.scrollTop-log.clientHeight<90;
  const fragment=document.createDocumentFragment();
  for(const m of rows){
   const article=document.createElement('article');article.className='message-row';article.id='message-'+m.id;
   const replyAuthor=rows.find(parent=>parent.id===m.reply?.id)?.user;
   const repliesToMe=m.reply?.userId?m.reply.userId===account.user?.id:replyAuthor?replyAuthor.id===account.user?.id:m.reply?.username===account.user?.username;
   if((!to||isGroup())&&m.user.id!==account.user?.id&&m.reply?.expires>Date.now()&&repliesToMe)article.classList.add('message-reply-to-me');
   const content=document.createElement('div'),head=document.createElement('div'),name=document.createElement('button'),time=document.createElement('time'),text=document.createElement('p');
   name.textContent=m.user.username+(m.user.owner?' · Owner':'');time.dateTime=new Date(m.created).toISOString();time.textContent=new Date(m.created).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});text.textContent=m.text;
   name.type='button';name.className='message-profile';name.addEventListener('click',()=>void account.openProfile(m.user.id));
   const photo=document.createElement('button');photo.type='button';photo.className='message-profile message-photo';photo.setAttribute('aria-label','View '+m.user.username+' profile');photo.append(account.avatar(m.user));photo.addEventListener('click',()=>void account.openProfile(m.user.id));
   if(m.reply){const quote=document.createElement('div');quote.className='message-quote';quote.textContent=m.reply.text&&m.reply.expires>Date.now()?m.reply.username+': '+m.reply.text.slice(0,180):'Original message expired';content.append(quote);}
   const reply=document.createElement('button');reply.type='button';reply.className='message-reply-button';reply.textContent='↩ Reply';reply.setAttribute('aria-label','Reply to '+m.user.username);reply.addEventListener('click',()=>{setReply(m);$('#messages-text').focus();});
   head.className='message-heading';head.append(name);for(const role of m.user.roles||[]){const badge=document.createElement('span');badge.className='profile-role message-role';badge.textContent=role.name;if(/^#[0-9a-f]{6}$/i.test(role.color))badge.style.setProperty('--role-color',role.color);head.append(badge);}head.append(time);content.append(head,text);if(m.hasPhoto){const img=document.createElement('img');img.className='message-image';img.alt='Photo shared by '+m.user.username;img.loading='lazy';content.append(img);requestAnimationFrame(()=>void loadPhoto(m,img));}article.append(photo,content,reply);fragment.append(article);
  }
  if(!rows.length){const empty=document.createElement('p');empty.className='messages-empty';empty.textContent='No messages yet. Say hello!';fragment.append(empty);}
  log.replaceChildren(fragment);if(bottom)log.scrollTop=log.scrollHeight;
 }
 async function people(){
  if(!active())return;const token=generation;
  try{const [data,groupData]=await Promise.all([account.api('/chat/people?conversations=1'),account.api('/chat/groups')]);if(token!==generation)return;
   const users=data.users;if(selectedPerson&&!selectedPerson.group&&!users.some(u=>u.id===selectedPerson.id))users.unshift(selectedPerson);
   const list=$('#messages-people');list.replaceChildren(...users.map(personButton));
   if(!users.length){const p=document.createElement('p');p.className='messages-empty';p.textContent='No direct messages yet';list.append(p);}
   const groups=$('#messages-groups');groups.replaceChildren(...groupData.groups.map(groupButton));if(!groupData.groups.length){const p=document.createElement('p');p.className='messages-empty';p.textContent='No groups yet';groups.append(p);}
   if(isGroup()&&!groupData.groups.some(g=>'group:'+g.id===to)){choose();return;}
   paintUnread();lastPeople=Date.now();
  }catch(e){if(token===generation)note(e.message);}
 }
 async function refresh(older=false){
  if(!active())return;const token=generation,target=to;
  const params=new URLSearchParams();if(target)params.set('to',target);if(older&&oldest)params.set('before',oldest);
  try{const result=await account.api('/chat/messages?'+params);if(token!==generation||!active())return;
   const log=$('#messages-log'),height=log.scrollHeight,scroll=log.scrollTop;
   rows=older?[...result.messages,...rows]:[...rows.filter(m=>result.messages.length&&m.id<result.messages[0].id),...result.messages];
   rows=[...new Map(rows.map(m=>[m.id,m])).values()].sort((a,b)=>a.id-b.id);paint();
   if(older)log.scrollTop=scroll+log.scrollHeight-height;
   if(older||oldest===null){oldest=rows[0]?.id||null;$('#messages-older').hidden=!result.hasMore;}
   note('');void markVisible();
  }catch(e){if(token===generation){note(e.message);if(e.status===404&&isGroup()){choose();return;}if(e.status===401){rows=[];paint();$('#messages-layout').hidden=true;$('#messages-login').hidden=false;}}}
 }
 function choose(user=null){
  scheduleUnread();clearTimeout(timer);++generation;setReply();clearPhoto();selectedPerson=user;to=user?.id||null;rows=[];oldest=null;$('#messages-text').value='';$('#messages-older').hidden=true;
  $('#messages-room-title').textContent=user?(user.group?'':'@')+user.username:'Main room';$('#messages-leave-group').hidden=!user?.group;$('#messages-public').setAttribute('aria-pressed',String(!to));paint();note('Loading…');void refresh();void people();timer=setTimeout(tick,2000);
 }
 function sync(){
  scheduleUnread();clearTimeout(timer);++generation;
  const id=account.user?.id||null;if(id!==identity){identity=id;setReply();clearPhoto();photoCache.clear();selectedPerson=null;picker.close();groupPicker.close();emojiPicker.close();$('#group-leave-picker').close();groupMembers.clear();++groupSearchToken;$('#messages-groups').replaceChildren();$('#messages-leave-group').hidden=true;to=null;rows=[];oldest=null;$('#messages-text').value='';$('#messages-room-title').textContent='Main room';$('#messages-people').replaceChildren();paint();}
  $('#messages-login').hidden=!!id;$('#messages-layout').hidden=!id;
  if(active()){void refresh();void people();timer=setTimeout(tick,2000);}
 }
 async function tick(){if(!active())return;const token=generation;paint();await refresh();if(token!==generation)return;if(Date.now()-lastPeople>30000)await people();if(active()&&token===generation)timer=setTimeout(tick,2000);}
 window.WackyMessages={dm(user){if(location.hash==='#messages')choose(user);else{location.hash='messages';window.addEventListener('hashchange',()=>choose(user),{once:true});}}};
 $('#messages-reply-cancel').addEventListener('click',()=>setReply());
 window.showMessages=value=>{document.body.classList.toggle('messages-open',value);open=value;$('#messages-panel').hidden=!value;sync();};
 window.addEventListener('wacky-account-change',sync);document.addEventListener('visibilitychange',sync);
 $('#messages-public').addEventListener('click',()=>choose());$('#messages-older').addEventListener('click',()=>void refresh(true));
 $('#messages-search').addEventListener('input',()=>{clearTimeout(peopleTimer);peopleTimer=setTimeout(searchPeople,250);});
 $('#messages-form').addEventListener('submit',async event=>{
  event.preventDefault();if(busy||photoReading||!active())return;const text=$('#messages-text').value.trim();if(!text&&!attachment)return;
  const token=generation,target=to;busy=true;const button=$('#messages-form button[type=submit]');button.disabled=true;$('#messages-attach').disabled=true;$('#messages-remove-photo').disabled=true;note('Sending…');
  try{await account.api('/chat/messages',{method:'POST',data:{to:target,text,photo:attachment,replyTo:replyTo?.id||null,clientId:crypto.randomUUID()}});if(token===generation){setReply();clearPhoto();$('#messages-text').value='';await refresh();$('#messages-log').scrollTop=$('#messages-log').scrollHeight;}}
  catch(e){if(token===generation)note(e.message);}finally{busy=false;button.disabled=false;$('#messages-attach').disabled=false;$('#messages-remove-photo').disabled=false;}
 });
 $('#messages-text').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();$('#messages-form').requestSubmit();}});
})();
