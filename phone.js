(()=>{'use strict';
 const account=window.WackyAccount,framePath=new URL('library/wacky-phone/index.html',document.baseURI).pathname;
 function frameFor(source){return [...document.querySelectorAll('#player iframe')].find(f=>f.contentWindow===source&&new URL(f.src,location.href).origin===location.origin&&new URL(f.src,location.href).pathname===framePath);}
 function theme(frame){const s=getComputedStyle(document.documentElement),get=(k,f)=>s.getPropertyValue(k).trim()||f;frame.contentWindow.postMessage({type:'bww:phone-theme',theme:{background:get('--page','#08080d'),panel:get('--surface','#16161d'),text:get('--text','#f5f5f5'),muted:get('--muted','#aaa9b7'),border:get('--line','#33313f'),accent:get('--accent','#ff4242')}},location.origin);}
 const pending=new WeakMap();
 window.addEventListener('message',async e=>{if(e.origin!==location.origin)return;const frame=frameFor(e.source);if(!frame)return;const d=e.data;if(!d||typeof d!=='object')return;
  if(d.type==='bww:phone-ready'){theme(frame);return;}
  if(d.type==='bww:phone-login'){await window.WackyBattleGame.close();account.open();return;}
  if(d.type!=='bww:phone-request'||typeof d.id!=='string'||d.id.length>80)return;
  const reply=(status,data)=>{if(frame.isConnected)e.source.postMessage({type:'bww:phone-response',id:d.id,status,data},location.origin);};
  if(!/^\/phone\/(?:me|create|join|[A-Z2-9]{6}(?:\/(?:start|draft|ready|heartbeat|leave|kick|ban|reveal|report|download))?)$/.test(d.path)||!['GET','POST'].includes(d.method)){reply(400,{error:'Invalid game request.'});return;}
  const count=pending.get(frame)||0;if(count>=4){reply(429,{error:'Please wait a moment.'});return;}pending.set(frame,count+1);
  try{const data=await account.api(d.path,{method:d.method,data:d.method==='POST'?(d.data||{}):undefined});reply(200,data);}catch(error){reply(error.status||503,{error:error.message});}finally{pending.set(frame,Math.max(0,(pending.get(frame)||1)-1));}
 });
 let themeTimer;new MutationObserver(()=>{if(themeTimer)return;themeTimer=setTimeout(()=>{themeTimer=null;for(const f of document.querySelectorAll('#player iframe'))if(frameFor(f.contentWindow))theme(f);},250);}).observe(document.documentElement,{attributes:true,attributeFilter:['style','data-background']});
 const section=document.querySelector('[data-admin-section="reports"]');if(!section)return;
 const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 const heading=node('h3','Wacky Phone reports'),refresh=node('button','Load drawing & prompt reports'),list=node('div');refresh.type='button';section.append(heading,refresh,list);
 refresh.addEventListener('click',async()=>{if(!account.user?.owner)return;refresh.disabled=true;list.replaceChildren(node('p','Loading reports…'));try{const data=await account.api('/phone/admin/reports');if(!account.user?.owner)return;list.replaceChildren();for(const r of data.reports){const article=node('article');article.className='game-report-card';article.append(node('h4',r.author_name+' · Room '+r.room),node('p',r.reason));if(r.snapshot.text)article.append(node('blockquote',r.snapshot.text));if(/^data:image\/(?:png|jpeg);base64,/.test(r.snapshot.image||'')){const image=node('img');image.src=r.snapshot.image;image.alt='Reported drawing';image.style.cssText='max-width:100%;width:400px;border-radius:12px';article.append(image);}for(const [status,label] of [['reviewed','Mark reviewed'],['removed','Remove entry']]){const b=node('button',label);b.type='button';b.addEventListener('click',async()=>{b.disabled=true;try{await account.api('/phone/admin/report',{method:'POST',data:{id:r.id,status}});article.remove();}catch(e){article.append(node('p',e.message));b.disabled=false;}});article.append(b);}list.append(article);}if(!data.reports.length)list.append(node('p','No open Wacky Phone reports.'));if(data.hasMore)list.append(node('p','Showing the newest 20. Handle these, then reload for more.'));}catch(e){list.replaceChildren(node('p',e.message));}finally{refresh.disabled=false;}});
 window.addEventListener('wacky-account-change',()=>{if(!account.user?.owner)list.replaceChildren();});
})();
