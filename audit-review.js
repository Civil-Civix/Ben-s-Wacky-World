'use strict';
const results=window.GAME_AUDIT||[],list=document.querySelector('#list'),viewer=document.querySelector('#viewer'),frame=document.querySelector('#frame');
let marks={};try{marks=JSON.parse(localStorage.getItem('wacky-game-audit-marks')||'{}');if(!marks||typeof marks!=='object')marks={};}catch(_){}
let selected=null,lastButton=null;
function render(){
 const q=document.querySelector('#search').value.toLowerCase(),filter=document.querySelector('#filter').value;
 const rows=results.filter(g=>(filter==='all'||g.status===filter)&&g.title.toLowerCase().includes(q));
 list.replaceChildren();
 for(const g of rows){
  const row=document.createElement('article'),details=document.createElement('div'),h=document.createElement('h2'),reason=document.createElement('div'),open=document.createElement('button');
  h.textContent=g.title+(marks[g.id]?' — you marked '+marks[g.id]:'');reason.className='reason';reason.textContent=g.reason;
  details.append(h,reason);open.textContent='Open game';open.addEventListener('click',()=>{selected=g;lastButton=open;document.querySelector('#title').textContent=g.title;frame.src=g.url;viewer.showModal();});
  row.append(details,open);list.append(row);
 }
 document.querySelector('#count').textContent=rows.length+' games';
}
async function close(){if(document.fullscreenElement)await document.exitFullscreen();frame.src='about:blank';viewer.close();render();document.querySelector('#search').focus({preventScroll:true});}
document.querySelector('#close').onclick=close;
viewer.addEventListener('cancel',e=>{e.preventDefault();close();});
document.querySelector('#reload').onclick=()=>{if(selected)frame.src=selected.url;};
document.querySelector('#full').onclick=()=>frame.requestFullscreen().catch(()=>{});
for(const [id,value] of [['working','working'],['broken','broken']])document.querySelector('#'+id).onclick=()=>{if(!selected)return;marks[selected.id]=value;try{localStorage.setItem('wacky-game-audit-marks',JSON.stringify(marks));}catch(_){}document.querySelector('#title').textContent=selected.title+' — marked '+value;};
document.querySelector('#search').oninput=render;document.querySelector('#filter').onchange=render;render();
