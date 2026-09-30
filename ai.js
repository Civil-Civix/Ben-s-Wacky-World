(() => {
 'use strict';
 const $=s=>document.querySelector(s),account=window.WackyAccount;
 let open=false,identity=null,generation=0,state=null,busy=false,timer,pending=null,attachment=null,reading=false,fileGeneration=0;
 function inlineText(el,text){
  for(const part of text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)){
   if(part.startsWith('**')&&part.endsWith('**')){const b=document.createElement('strong');b.textContent=part.slice(2,-2);el.append(b);}
   else if(part.startsWith('`')&&part.endsWith('`')){const c=document.createElement('code');c.textContent=part.slice(1,-1);el.append(c);}
   else el.append(document.createTextNode(part));
  }
 }
 function formatAnswer(text){
  const root=document.createElement('div');root.className='ai-answer';let list=null,pre=null;
  for(const line of text.split('\n')){
   if(line.trim().startsWith('```')){if(pre){pre=null;}else{list=null;pre=document.createElement('pre');root.append(pre);}continue;}
   if(pre){pre.append(document.createTextNode(line+'\n'));continue;}
   const item=/^\s*(?:[-*] |\d+\. )(.*)/.exec(line);
   if(item){const tag=/^\s*\d/.test(line)?'OL':'UL';if(!list||list.tagName!==tag){list=document.createElement(tag.toLowerCase());root.append(list);}const li=document.createElement('li');inlineText(li,item[1]);list.append(li);}
   else{list=null;if(!line.trim())continue;const p=document.createElement('p');inlineText(p,line);root.append(p);}
  }
  return root;
 }
 const note=text=>$('#ai-status').textContent=text;
 function paint(){
  const signedIn=!!account.user;
  $('#ai-login').hidden=signedIn;$('#ai-content').hidden=!signedIn;
  $('#ai-send').disabled=!signedIn||busy||reading||!state?.enabled||(!state.unlimited&&state.remaining<1);
  $('#ai-text').disabled=!signedIn||busy||reading||!state?.enabled||(!state.unlimited&&state.remaining<1);
  $('#ai-attach').disabled=$('#ai-send').disabled;$('#ai-file-remove').disabled=busy;$('#ai-attachment').hidden=!attachment;$('#ai-file-name').textContent=attachment?.name||'';
  $('#ai-allowance').textContent=state?(state.unlimited?'Unlimited responses · Owner':state.remaining+' / '+(state.limit||10)+' responses left today'):'Checking your allowance…';
  if(!signedIn)return;
  const log=$('#ai-log'),scroll=log.scrollTop,atBottom=log.scrollHeight-log.scrollTop-log.clientHeight<90,fragment=document.createDocumentFragment();
  for(const turn of state?.messages||[]){
   if(turn.expires<=Date.now())continue;
   for(const [name,text,kind] of [['You',turn.prompt,'user'],[turn.provider?'AI Chat · '+turn.provider:'AI Chat',turn.answer,'assistant']]){
    const row=document.createElement('article'),label=document.createElement('strong'),body=document.createElement('p');
    row.className='ai-message ai-'+kind;label.textContent=name;if(kind==='assistant'&&turn.model)label.title=turn.model;body.textContent=text;label.className=kind==='user'?'sr-only':'ai-response-label';row.append(label,kind==='assistant'?formatAnswer(text):body);if(kind==='user'&&turn.attachment){const file=document.createElement('span');file.className='ai-file-label';file.textContent='▧ '+turn.attachment.name;row.prepend(file);}fragment.append(row);
   }
  }
  if(!fragment.childNodes.length){const empty=document.createElement('div');empty.className='ai-empty';const h=document.createElement('h2'),p=document.createElement('p');h.textContent='What’s on your mind?';p.textContent='Ask a question, brainstorm an idea, or get help figuring something out.';empty.append(h,p);fragment.append(empty);}
  log.replaceChildren(fragment);log.scrollTop=atBottom?log.scrollHeight:scroll;
 }
 async function refresh(){
  if(!open||document.hidden||!account.user||busy)return;
  const token=generation;
  try{const next=await account.api('/ai');if(token!==generation)return;state=next;paint();note(next.enabled?'':'AI Chat is being connected. Check back soon.');}
  catch(e){if(token===generation)note(e.message);}
 }
 function sync(){
  const id=account.user?.id||null;
  if(id!==identity){identity=id;++generation;state=null;busy=false;pending=null;attachment=null;reading=false;++fileGeneration;$('#ai-text').value='';note('');}
  paint();if(open)void refresh();
 }
 window.showAI=value=>{open=value;$('#ai-panel').hidden=!value;document.body.classList.toggle('ai-open',value);clearInterval(timer);sync();if(value)timer=setInterval(()=>{paint();void refresh();},60000);};
 window.addEventListener('wacky-account-change',sync);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&open){paint();void refresh();}});
 $('#ai-form').addEventListener('submit',async event=>{
  event.preventDefault();const text=$('#ai-text').value.trim();if(busy||reading||!account.user||!state?.enabled||(!state.unlimited&&state.remaining<1)||!text)return;
  const token=generation;if(!pending||pending.text!==text)pending={text,attachment,requestId:crypto.randomUUID()};
  busy=true;paint();note('Thinking…');
  try{
   const next=await account.api('/ai',{method:'POST',data:pending,timeout:60000});if(token!==generation)return;
   state=next;pending=null;attachment=null;$('#ai-text').value='';note('');
  }catch(e){
   if(token!==generation)return;
   if(e.status===503||e.status===400||e.status===409)pending=null;
   note(e.message||'Connection interrupted. Try sending again.');
   try{const next=await account.api('/ai');if(token===generation){state=next;if(pending&&next.messages.some(m=>m.id===pending.requestId)){pending=null;attachment=null;$('#ai-text').value='';note('');}}}catch{}
  }finally{if(token===generation){busy=false;paint();const log=$('#ai-log');log.scrollTop=log.scrollHeight;if(!$('#ai-text').disabled)$('#ai-text').focus();}}
 });
 $('#ai-attach').addEventListener('click',()=>$('#ai-file').click());
 $('#ai-file-remove').addEventListener('click',()=>{attachment=null;pending=null;++fileGeneration;paint();});
 $('#ai-file').addEventListener('change',async()=>{
  const file=$('#ai-file').files[0];$('#ai-file').value='';if(!file)return;const token=++fileGeneration,id=identity;reading=true;pending=null;attachment=null;note('Reading file…');paint();
  try{const result=await window.WackyAIFiles.read(file);if(token===fileGeneration&&id===identity){attachment=result;note('File ready. Add a question, then send.');}}
  catch(e){if(token===fileGeneration)note(e.message||'This file could not be read.');}
  finally{if(token===fileGeneration){reading=false;paint();}}
 });
 $('#ai-text').addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();$('#ai-form').requestSubmit();}});
})();
