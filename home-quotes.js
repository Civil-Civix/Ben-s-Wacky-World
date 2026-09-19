'use strict';
(() => {
 const element=document.querySelector('#home-quote'),home=document.querySelector('#home-panel');
 const motion=matchMedia('(prefers-reduced-motion: reduce)');
 let quotes=[],index=0,timer;
 function active(){return !document.hidden&&!home.hidden&&!document.body.classList.contains('playing');}
 function sync(){
  clearTimeout(timer);element.classList.remove('quote-visible');
  if(!quotes.length||!active())return;
  element.hidden=false;element.textContent=quotes[index];element.classList.add('quote-visible');
  if(quotes.length>1&&!motion.matches)timer=setTimeout(next,5500);
 }
 function next(){
  element.classList.remove('quote-visible');
  timer=setTimeout(()=>{index=(index+1)%quotes.length;sync();},600);
 }
 new MutationObserver(sync).observe(home,{attributes:true,attributeFilter:['hidden']});
 new MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:['class']});
 document.addEventListener('visibilitychange',sync);motion.addEventListener('change',sync);
 fetch('./home-quotes.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Quotes unavailable');return r.json();}).then(data=>{
  if(Array.isArray(data))quotes=[...new Set(data.filter(q=>typeof q==='string'&&q.trim()).map(q=>q.trim()))];
  sync();
 }).catch(()=>{element.hidden=true;});
})();

