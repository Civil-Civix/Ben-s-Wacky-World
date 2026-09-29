(() => {
 'use strict';
 const $=s=>document.querySelector(s),account=window.WackyAccount;
 let open=false,to=null,rows=[],generation=0,timer,peopleTimer,busy=false,oldest=null,lastPeople=0,identity=null,replyTo=null;
 let unreadTimer,unreadBusy=false,unreadIdentity=null,unreadCounts=new Map(),readBusy=false,readTimer;
 const readThrough=new Map();
 function paintUnread(){
  const count=[...unreadCounts.values()].reduce((a,b)=>a+b,0),badge=$('#dm-unread-badge');badge.hidden=!count;badge.textContent=count>9?'9+':String(count);
  $('.nav-messages').setAttribute('aria-label',count?'Chat, '+count+' unread direct messages':'Chat');
  document.querySelectorAll('[data-dm-person]').forEach(b=>{const n=unreadCounts.get(b.dataset.dmPerson)||0;let tag=b.querySelector('.dm-person-unread');if(!tag){tag=document.createElement('span');tag.className='dm-person-unread';b.append(tag);}tag.hidden=!n;tag.textContent=n>9?'9+':String(n);});
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
  const seen=rows.filter(m=>m.user.id===peer&&m.expires>Date.now()).filter(m=>{const el=document.getElementById('message-'+m.id);if(!el)return false;const r=el.getBoundingClientRect();return r.top<log.bottom&&r.bottom>log.top;});
  const through=Math.max(0,...seen.map(m=>m.id));if(through<=(readThrough.get(peer)||0))return;
  readBusy=true;try{await account.api('/chat/read',{method:'POST',data:{to:peer,through}});if(account.user?.id===id){readThrough.set(peer,through);await refreshUnread();}}catch{}finally{readBusy=false;}
 }
 $('#messages-log').addEventListener('scroll',()=>{clearTimeout(readTimer);readTimer=setTimeout(markVisible,200);});
 const note=text=>$('#messages-status').textContent=text;
 function setReply(message=null){replyTo=message;$('#messages-reply').hidden=!message;$('#messages-reply-text').textContent=message?'Replying to '+message.user.username+': '+message.text.slice(0,140):'';}
 const active=()=>open&&!document.hidden&&!!account.user;
 let painted='';
 function paint(){
  rows=rows.filter(m=>m.expires>Date.now());
  const signature=JSON.stringify(rows.map(m=>({...m,reply:m.reply?.expires<=Date.now()?{id:m.reply.id}:m.reply})));if(signature===painted)return;painted=signature;
  const log=$('#messages-log'),bottom=log.scrollHeight-log.scrollTop-log.clientHeight<90;
  const fragment=document.createDocumentFragment();
  for(const m of rows){
   const article=document.createElement('article');article.className='message-row';article.id='message-'+m.id;
   const replyAuthor=rows.find(parent=>parent.id===m.reply?.id)?.user;
   const repliesToMe=m.reply?.userId?m.reply.userId===account.user?.id:replyAuthor?replyAuthor.id===account.user?.id:m.reply?.username===account.user?.username;
   if(!to&&m.user.id!==account.user?.id&&m.reply?.expires>Date.now()&&repliesToMe)article.classList.add('message-reply-to-me');
   const content=document.createElement('div'),head=document.createElement('div'),name=document.createElement('button'),time=document.createElement('time'),text=document.createElement('p');
   name.textContent=m.user.username+(m.user.owner?' · Owner':'');time.dateTime=new Date(m.created).toISOString();time.textContent=new Date(m.created).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});text.textContent=m.text;
   name.type='button';name.className='message-profile';name.addEventListener('click',()=>void account.openProfile(m.user.id));
   const photo=document.createElement('button');photo.type='button';photo.className='message-profile message-photo';photo.setAttribute('aria-label','View '+m.user.username+' profile');photo.append(account.avatar(m.user));photo.addEventListener('click',()=>void account.openProfile(m.user.id));
   if(m.reply){const quote=document.createElement('div');quote.className='message-quote';quote.textContent=m.reply.text&&m.reply.expires>Date.now()?m.reply.username+': '+m.reply.text.slice(0,180):'Original message expired';content.append(quote);}
   const reply=document.createElement('button');reply.type='button';reply.className='message-reply-button';reply.textContent='↩ Reply';reply.setAttribute('aria-label','Reply to '+m.user.username);reply.addEventListener('click',()=>{setReply(m);$('#messages-text').focus();});
   head.append(name,time);content.append(head,text);article.append(photo,content,reply);fragment.append(article);
  }
  if(!rows.length){const empty=document.createElement('p');empty.className='messages-empty';empty.textContent='No messages yet. Say hello!';fragment.append(empty);}
  log.replaceChildren(fragment);if(bottom)log.scrollTop=log.scrollHeight;
 }
 async function people(){
  if(!active())return;const token=generation,q=$('#messages-search').value;
  try{const data=await account.api('/chat/people?q='+encodeURIComponent(q));if(token!==generation||q!==$('#messages-search').value)return;
   const list=$('#messages-people');list.replaceChildren();
   for(const user of data.users){const b=document.createElement('button'),name=document.createElement('span');b.type='button';b.dataset.dmPerson=user.id;name.textContent=user.username;b.append(account.avatar(user),name);b.setAttribute('aria-pressed',String(to===user.id));b.addEventListener('click',()=>choose(user));list.append(b);}
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
  }catch(e){if(token===generation){note(e.message);if(e.status===401){rows=[];paint();$('#messages-layout').hidden=true;$('#messages-login').hidden=false;}}}
 }
 function choose(user=null){
  scheduleUnread();clearTimeout(timer);++generation;setReply();to=user?.id||null;rows=[];oldest=null;$('#messages-text').value='';$('#messages-older').hidden=true;
  $('#messages-room-title').textContent=user?'@'+user.username:'Main room';$('#messages-public').setAttribute('aria-pressed',String(!to));paint();note('Loading…');void refresh();void people();timer=setTimeout(tick,2000);
 }
 function sync(){
  scheduleUnread();clearTimeout(timer);++generation;
  const id=account.user?.id||null;if(id!==identity){identity=id;setReply();to=null;rows=[];oldest=null;$('#messages-text').value='';$('#messages-room-title').textContent='Main room';$('#messages-people').replaceChildren();paint();}
  $('#messages-login').hidden=!!id;$('#messages-layout').hidden=!id;
  if(active()){void refresh();void people();timer=setTimeout(tick,2000);}
 }
 async function tick(){if(!active())return;const token=generation;paint();await refresh();if(token!==generation)return;if(Date.now()-lastPeople>30000)await people();if(active()&&token===generation)timer=setTimeout(tick,2000);}
 window.WackyMessages={dm(user){if(location.hash==='#messages')choose(user);else{location.hash='messages';window.addEventListener('hashchange',()=>choose(user),{once:true});}}};
 $('#messages-reply-cancel').addEventListener('click',()=>setReply());
 window.showMessages=value=>{document.body.classList.toggle('messages-open',value);open=value;$('#messages-panel').hidden=!value;sync();};
 window.addEventListener('wacky-account-change',sync);document.addEventListener('visibilitychange',sync);
 $('#messages-public').addEventListener('click',()=>choose());$('#messages-older').addEventListener('click',()=>void refresh(true));
 $('#messages-search').addEventListener('input',()=>{clearTimeout(peopleTimer);peopleTimer=setTimeout(people,250);});
 $('#messages-form').addEventListener('submit',async event=>{
  event.preventDefault();if(busy||!active())return;const text=$('#messages-text').value.trim();if(!text)return;
  const token=generation,target=to;busy=true;const button=$('#messages-form button');button.disabled=true;note('Sending…');
  try{await account.api('/chat/messages',{method:'POST',data:{to:target,text,replyTo:replyTo?.id||null,clientId:crypto.randomUUID()}});if(token===generation){setReply();$('#messages-text').value='';await refresh();$('#messages-log').scrollTop=$('#messages-log').scrollHeight;}}
  catch(e){if(token===generation)note(e.message);}finally{busy=false;button.disabled=false;}
 });
 $('#messages-text').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();$('#messages-form').requestSubmit();}});
})();
