(() => {
 'use strict';
 const site='https://sites.google.com/stu.tempeunion.org/bens-wack-world/home';
 const host=value=>{try{return new URL(value).hostname;}catch{return '';}};
 const framed=window.self!==window.top;
 const ancestors=Array.from(location.ancestorOrigins||[]);
 const googleSite=value=>host(value)==='sites.google.com';
 // Google Sites can use an intermediate Google-hosted embed frame.
 // Browsers without ancestorOrigins expose only that immediate referrer.
 const referrerHost=host(document.referrer);
 const sitesWrapper=referrerHost==='www.gstatic.com'&&new URL(document.referrer).pathname.startsWith('/atari/embeds/');
 const allowed=framed&&(ancestors.length?ancestors.some(googleSite):googleSite(document.referrer)||sitesWrapper||referrerHost.endsWith('.googleusercontent.com'));
 if(!allowed){
  const card=document.createElement('main');card.className='site-entry-card';
  const title=document.createElement('h1');title.textContent="Ben's Wacky World";
  const text=document.createElement('p');text.textContent='Open our Google Site to play games and join the community.';
  const link=document.createElement('a');link.href=site;link.target='_top';link.textContent="Open Ben's Wacky World";
  card.append(title,text,link);document.body.replaceChildren(card);document.documentElement.classList.add('site-entry');return;
 }
 document.documentElement.classList.add('site-embedded');
 // Ordered dynamic scripts preserve the existing shared globals and dependencies.
 for(const source of document.querySelectorAll('script[data-site-src]')){
  const script=document.createElement('script');script.async=false;script.src=source.dataset.siteSrc;document.head.append(script);
 }
})();
