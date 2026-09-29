(() => {
 'use strict';
 const $=s=>document.querySelector(s),account=window.WackyAccount;
 let open=false,identity=null,generation=0,state=null,busy=false,timer,pending=null;
 const note=text=>$('#ai-status').textContent=text;
 function paint(){
  const signedIn=!!account.user;
  $('#ai-login').hidden=signedIn;$('#ai-content').hidden=!signedIn;
  $('#ai-send').disabled=!signedIn||busy||!state?.enabled||state.remaining<1;
  $('#ai-text').disabled=!signedIn||busy||!state?.enabled||state.remaining<1;
  $('#ai-allowance').textContent=state?state.remaining+' / 15 messages left today':'Checking your allowance…';
  if(!signedIn)return;
  const log=$('#ai-log'),fragment=document.createDocumentFragment();
  for(const turn of state?.messages||[]){
   if(turn.expires<=Date.now())continue;
   for(const [name,text,kind] of [['You',turn.prompt,'user'],[turn.provider?'AI Chat · '+turn.provider:'AI Chat',turn.answer,'assistant']]){
    const row=document.createElement('article'),label=document.createElement('strong'),body=document.createElement('p');
    row.className='ai-message ai-'+kind;label.textContent=name;if(kind==='assistant'&&turn.model)label.title=turn.model;body.textContent=text;row.append(label,body);fragment.append(row);
   }
  }
  if(!fragment.childNodes.length){const empty=document.createElement('div');empty.className='ai-empty';const h=document.createElement('h2'),p=document.createElement('p');h.textContent='What’s on your mind?';p.textContent='Ask a question, brainstorm an idea, or get help figuring something out.';empty.append(h,p);fragment.append(empty);}
  log.replaceChildren(fragment);
 }
 async function refresh(){
  if(!open||document.hidden||!account.user||busy)return;
  const token=generation;
  try{const next=await account.api('/ai');if(token!==generation)return;state=next;paint();note(next.enabled?'':'AI Chat is being connected. Check back soon.');}
  catch(e){if(token===generation)note(e.message);}
 }
 function sync(){
  const id=account.user?.id||null;
  if(id!==identity){identity=id;++generation;state=null;busy=false;pending=null;$('#ai-text').value='';note('');}
  paint();if(open)void refresh();
 }
 window.showAI=value=>{open=value;$('#ai-panel').hidden=!value;document.body.classList.toggle('ai-open',value);clearInterval(timer);sync();if(value)timer=setInterval(()=>{paint();void refresh();},60000);};
 window.addEventListener('wacky-account-change',sync);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&open){paint();void refresh();}});
 $('#ai-form').addEventListener('submit',async event=>{
  event.preventDefault();const text=$('#ai-text').value.trim();if(busy||!account.user||!state?.enabled||state.remaining<1||!text)return;
  const token=generation;if(!pending||pending.text!==text)pending={text,requestId:crypto.randomUUID()};
  busy=true;paint();note('Thinking…');
  try{
   const next=await account.api('/ai',{method:'POST',data:pending,timeout:60000});if(token!==generation)return;
   state=next;pending=null;$('#ai-text').value='';note('');
  }catch(e){
   if(token!==generation)return;
   if(e.status===503||e.status===400||e.status===409)pending=null;
   note(e.message||'Connection interrupted. Try sending again.');
   try{const next=await account.api('/ai');if(token===generation){state=next;if(pending&&next.messages.some(m=>m.id===pending.requestId)){pending=null;$('#ai-text').value='';note('');}}}catch{}
  }finally{if(token===generation){busy=false;paint();const log=$('#ai-log');log.scrollTop=log.scrollHeight;if(!$('#ai-text').disabled)$('#ai-text').focus();}}
 });
 $('#ai-text').addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();$('#ai-form').requestSubmit();}});
})();
