/* Ben's Wacky World community leaderboard adapter. */
'use strict';
(() => {
 const API='https://bens-wacky-accounts.mr-ellis1009.workers.dev';
 let user=null,engine=null;
 async function request(path,data){const r=await fetch(API+path,{credentials:'include',headers:{'Content-Type':'application/json','X-Wacky-Client':'1'},...(data?{method:'POST',body:JSON.stringify(data)}:{})});const result=await r.json();if(!r.ok)throw Error(result.error||'Leaderboard unavailable.');return result;}
 const identity=request('/me').then(d=>{user=d.user;}).catch(()=>{});
 let noticeTimer,hideTimer,noticeFrame;
 function notice(text){
  clearTimeout(noticeTimer);clearTimeout(hideTimer);cancelAnimationFrame(noticeFrame);
  let el=document.querySelector('#bww-rank-notice');
  if(!el){el=document.createElement('div');el.id='bww-rank-notice';el.setAttribute('role','status');el.style.cssText='position:fixed;left:10px;bottom:80px;z-index:9999;padding:9px 12px;border-radius:8px;background:#101524e8;color:white;font:13px Arial;max-width:min(420px,calc(100vw - 20px));box-sizing:border-box;pointer-events:none;opacity:0;transition:opacity .4s ease';document.body.append(el);}
  el.hidden=false;el.textContent=text;el.style.opacity='1';
  function position(){
   const tracker=Array.from(document.querySelectorAll('.checkpoint-ui')).find(node=>node.getClientRects().length);
   const r=tracker?.getBoundingClientRect();
   const top=r?Math.max(10,r.top-el.offsetHeight-10):Math.max(10,innerHeight-el.offsetHeight-80);
   el.style.bottom='auto';el.style.top=top+'px';el.style.left=Math.max(10,Math.min(r?.left||10,innerWidth-el.offsetWidth-10))+'px';
   noticeFrame=requestAnimationFrame(position);
  }
  position();noticeTimer=setTimeout(()=>{el.style.opacity='0';hideTimer=setTimeout(()=>{el.hidden=true;cancelAnimationFrame(noticeFrame);},400);},10000);
 }
 async function board(track,skip=0,amount=20){await identity;if(engine&&!engine.tracks().some(t=>t.id===track))return {total:0,entries:[],userEntry:null};return request('/poly/board?track='+encodeURIComponent(track)+'&offset='+skip+'&limit='+amount+(user?'&user='+encodeURIComponent(user.id):''));}
 window.BWWPoly={
  board,
  async submit(track,frames,recording,carStyle){if(engine&&!engine.tracks().some(t=>t.id===track))return null;await identity;if(!user){notice('Log in on Ben’s Wacky World to post your time.');return null;}try{const r=await request('/poly/best',{track,frames,recording,carStyle});notice(r.improved?'Personal best saved to Wacky World!':'Your faster time is already on the leaderboard.');return r;}catch(e){notice(e.message);throw e;}},
  async recordings(ids){return (await request('/poly/replays?ids='+ids.map(encodeURIComponent).join(','))).recordings;},
  ready(value){engine=value;window.dispatchEvent(new Event('bww-poly-ready'));const id=new URLSearchParams(location.search).get('bwwReplay');if(id&&/^\d+$/.test(id))this.watch(Number(id)).catch(e=>notice(e.message));},
  async watch(id){const r=(await this.recordings([id]))[0];if(!r)throw Error('Replay is no longer available.');await engine.watch(r);},
  get user(){return user;}, get tracks(){return engine?.tracks()||[];}
 };
})();
