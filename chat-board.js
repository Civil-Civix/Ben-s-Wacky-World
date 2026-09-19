'use strict';
(() => {
 const panel=document.querySelector('#chat-panel'),content=document.querySelector('#chat-content'),warning=document.querySelector('#chat-warning'),accept=document.querySelector('#chat-accept'),help=document.querySelector('#chat-help');
 const placeholder=content.innerHTML;
 let opened=false;
 window.showChatBoard=show=>{
  panel.hidden=!show;
  if(show&&!opened){
   content.innerHTML=placeholder;content.classList.add('gated');content.inert=true;content.setAttribute('aria-hidden','true');
   warning.hidden=false;help.hidden=true;
   requestAnimationFrame(()=>{if(!panel.hidden)accept.focus({preventScroll:true});});
  }else if(!show&&opened){content.replaceChildren();}
  opened=show;
 };
 accept.addEventListener('click',()=>{
  if(panel.hidden)return;
  const frame=document.createElement('iframe');
  frame.title="Ben's Wacky Chat Board";
  frame.src='https://padlet.com/embed/s7pwwvbavdtpqawp';
  frame.allow='clipboard-write';frame.referrerPolicy='strict-origin-when-cross-origin';
  content.replaceChildren(frame);content.classList.remove('gated');content.inert=false;content.removeAttribute('aria-hidden');
  warning.hidden=true;help.hidden=false;frame.focus();
 });
})();

