(() => {
 'use strict';
 const $=s=>document.querySelector(s),account=window.WackyAccount;
 let open=false,to=null,rows=[],generation=0,timer,peopleTimer,busy=false,oldest=null,lastPeople=0,identity=null;
 const note=text=>$('#messages-status').textContent=text;
 const active=()=>open&&!document.hidden&&!!account.user;
 function paint(){
  rows=rows.filter(m=>m.expires>Date.now());
  const log=$('#messages-log'),bottom=log.scrollHeight-log.scrollTop-log.clientHeight<90;
  const fragment=document.createDocumentFragment();
  for(const m of rows){
   const article=document.createElement('article');article.className='message-row';
   const content=document.createElement('div'),head=document.createElement('div'),name=document.createElement('strong'),time=document.createElement('time'),text=document.createElement('p');
   name.textContent=m.user.username+(m.user.owner?' · Owner':'');time.dateTime=new Date(m.created).toISOString();time.textContent=new Date(m.created).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});text.textContent=m.text;
   head.append(name,time);content.append(head,text);article.append(account.avatar(m.user),content);fragment.append(article);
  }
  if(!rows.length){const empty=document.createElement('p');empty.className='messages-empty';empty.textContent='No messages yet. Say hello!';fragment.append(empty);}
  log.replaceChildren(fragment);if(bottom)log.scrollTop=log.scrollHeight;
 }
 async function people(){
  if(!active())return;const token=generation,q=$('#messages-search').value;
  try{const data=await account.api('/chat/people?q='+encodeURIComponent(q));if(token!==generation||q!==$('#messages-search').value)return;
   const list=$('#messages-people');list.replaceChildren();
   for(const user of data.users){const b=document.createElement('button'),name=document.createElement('span');b.type='button';name.textContent=user.username;b.append(account.avatar(user),name);b.setAttribute('aria-pressed',String(to===user.id));b.addEventListener('click',()=>choose(user));list.append(b);}
   lastPeople=Date.now();
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
   note('');
  }catch(e){if(token===generation){note(e.message);if(e.status===401){rows=[];paint();$('#messages-layout').hidden=true;$('#messages-login').hidden=false;}}}
 }
 function choose(user=null){
  ++generation;to=user?.id||null;rows=[];oldest=null;$('#messages-text').value='';$('#messages-older').hidden=true;
  $('#messages-room-title').textContent=user?'@'+user.username:'Main room';$('#messages-public').setAttribute('aria-pressed',String(!to));paint();note('Loading…');void refresh();void people();
 }
 function sync(){
  clearTimeout(timer);++generation;
  const id=account.user?.id||null;if(id!==identity){identity=id;to=null;rows=[];oldest=null;$('#messages-text').value='';$('#messages-room-title').textContent='Main room';$('#messages-people').replaceChildren();paint();}
  $('#messages-login').hidden=!!id;$('#messages-layout').hidden=!id;
  if(active()){void refresh();void people();timer=setTimeout(tick,8000);}
 }
 async function tick(){if(!active())return;const token=generation;paint();await refresh();if(token!==generation)return;if(Date.now()-lastPeople>30000)await people();if(active()&&token===generation)timer=setTimeout(tick,8000);}
 window.showMessages=value=>{open=value;$('#messages-panel').hidden=!value;sync();};
 window.addEventListener('wacky-account-change',sync);document.addEventListener('visibilitychange',sync);
 $('#messages-public').addEventListener('click',()=>choose());$('#messages-older').addEventListener('click',()=>void refresh(true));
 $('#messages-search').addEventListener('input',()=>{clearTimeout(peopleTimer);peopleTimer=setTimeout(people,250);});
 $('#messages-form').addEventListener('submit',async event=>{
  event.preventDefault();if(busy||!active())return;const text=$('#messages-text').value.trim();if(!text)return;
  const token=generation,target=to;busy=true;const button=$('#messages-form button');button.disabled=true;note('Sending…');
  try{await account.api('/chat/messages',{method:'POST',data:{to:target,text,clientId:crypto.randomUUID()}});if(token===generation){$('#messages-text').value='';await refresh();$('#messages-log').scrollTop=$('#messages-log').scrollHeight;}}
  catch(e){if(token===generation)note(e.message);}finally{busy=false;button.disabled=false;}
 });
 $('#messages-text').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();$('#messages-form').requestSubmit();}});
})();
