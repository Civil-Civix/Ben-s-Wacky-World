(() => {
 const account=window.WackyAccount,origin='https://bens-pokemon.129-146-183-45.sslip.io',box=document.createElement('aside');box.id='battle-invitations';box.setAttribute('aria-label','Battle invitations');box.setAttribute('aria-live','polite');document.body.append(box);
 let context=null,timer,busy=false,identity=null;const opened=new Set();
 const frame=()=>document.querySelector('#game-stage iframe');
 const tell=(type,data={})=>{const f=frame();if(f&&new URL(f.src).origin===origin)f.contentWindow.postMessage({type,...data},origin);};
 async function act(invite,action){try{await account.api('/battle/invites/'+invite.id,{method:'POST',data:{action}});await poll();}catch(e){box.textContent=e.message;}}
 function launch(invite){context=invite;opened.add(invite.id);window.WackyBattleGame.open();}
 async function poll(){
  clearTimeout(timer);const id=account.user?.id;if(id!==identity){identity=id;opened.clear();context=null;box.replaceChildren();}if(!id||document.hidden)return;if(busy){timer=setTimeout(poll,2000);return;}busy=true;
  try{const data=await account.api('/battle/invites');if(account.user?.id!==id)return;box.replaceChildren();for(const invite of data.invites){if(invite.status==='accepted'&&!opened.has(invite.id)){launch(invite);continue;}if(invite.status!=='pending')continue;const card=document.createElement('div'),text=document.createElement('p');text.textContent=invite.outgoing?'Waiting for '+invite.peer.username+' to accept…':invite.peer.username+' challenges you to a 6v6 random battle.';card.append(text);for(const action of invite.outgoing?['cancel']:['accept','decline']){const button=document.createElement('button');button.textContent=action[0].toUpperCase()+action.slice(1);button.addEventListener('click',()=>void act(invite,action));card.append(button);}box.append(card);}}
  catch{}finally{busy=false;if(account.user)timer=setTimeout(poll,5000);}
 }
 window.WackyBattles={async challenge(user){if(!account.user)return;try{await account.api('/battle/invites',{method:'POST',data:{to:user.id}});document.querySelector('#public-profile').close();await poll();}catch(e){let note=document.querySelector('#battle-challenge-error');if(!note){note=document.createElement('p');note.id='battle-challenge-error';note.setAttribute('role','status');document.querySelector('#public-profile-content').append(note);}note.textContent=e.message;}}};
 window.addEventListener('message',async e=>{
  if(e.origin!==origin||e.source!==frame()?.contentWindow||!account.user)return;const id=account.user.id,source=e.source;
  try{if(e.data?.type==='bww:auth-request'){
   const result=await account.api('/battle/session',{method:'POST',data:{challenge:e.data.challenge}});if(account.user?.id!==id||source!==frame()?.contentWindow)return;
   tell('bww:auth',{...result,invite:context&&context.expires>Date.now()?context:null});
  }else if(e.data?.type==='bww:names-request'){
   const result=await account.api('/battle/names',{method:'POST',data:{ids:e.data.ids}});if(account.user?.id===id&&source===frame()?.contentWindow)tell('bww:names',result);
  }}catch(error){if(source===frame()?.contentWindow)tell('bww:auth-error',{message:error.message});}
 });
 window.addEventListener('wacky-account-change',()=>{if(identity&&identity!==account.user?.id&&frame()?.src.startsWith(origin))void window.WackyBattleGame.close();void poll();});
 window.addEventListener('wacky-game-change',e=>{if(!e.detail.playing)context=null;(e.detail.playing?document.querySelector('#player'):document.body).append(box);});document.addEventListener('visibilitychange',()=>void poll());void poll();
})();
