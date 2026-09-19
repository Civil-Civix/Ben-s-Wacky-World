(() => {
 const select=document.querySelector('#game-sort'),wrap=document.querySelector('#sort-wrap');
 const trigger=document.querySelector('#sort-trigger'),menu=document.querySelector('#sort-menu');
 const options=[...menu.querySelectorAll('[data-sort]')];
 function sync(){
  trigger.querySelector('span').textContent=select.selectedOptions[0].textContent;
  options.forEach(option=>option.setAttribute('aria-selected',String(option.dataset.sort===select.value)));
 }
 function close(focus=false){menu.hidden=true;trigger.setAttribute('aria-expanded','false');if(focus)trigger.focus();}
 function open(){menu.hidden=false;trigger.setAttribute('aria-expanded','true');options.find(o=>o.dataset.sort===select.value).focus();}
 trigger.addEventListener('click',()=>menu.hidden?open():close());
 trigger.addEventListener('keydown',event=>{if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();open();}});
 options.forEach(option=>option.addEventListener('click',()=>{
  select.value=option.dataset.sort;select.dispatchEvent(new Event('change',{bubbles:true}));sync();close(true);
 }));
 menu.addEventListener('keydown',event=>{
  const index=options.indexOf(document.activeElement);
  if(event.key==='Escape'){event.preventDefault();close(true);}
  if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
   event.preventDefault();
   const next=event.key==='Home'?0:event.key==='End'?options.length-1:(index+(event.key==='ArrowDown'?1:-1)+options.length)%options.length;
   options[next].focus();
  }
 });
 document.addEventListener('click',event=>{if(!wrap.contains(event.target))close();});
 wrap.addEventListener('focusout',event=>{if(!wrap.contains(event.relatedTarget))close();});
 window.addEventListener('hashchange',()=>close());
 select.addEventListener('change',sync);
 sync();
})();