/* Wacky World: suppress known ad hosts and popup windows in this game document. */
(() => {
  const adHost = /(^|\.)(googlesyndication\.com|doubleclick\.net|googleadservices\.com|adservice\.google\.[a-z.]+|adsterra\.com|monetag\.com|breadisgay\.eduplace\.net|popads\.net|popcash\.net|adnxs\.com|adsrvr\.org|adinplay\.com)$/i;
  const isAd = value => {try{return adHost.test(new URL(String(value),document.baseURI).hostname);}catch{return false;}};
  const selector = '[id^="sidebarad"],iframe.sidebar-frame,ins.adsbygoogle,iframe[id^="google_ads"],iframe[id^="aswift_"],[data-ad-client][data-ad-slot]';
  const clean = node => {
    if(node.nodeType!==1)return false;
    if(node.matches(selector) || (['SCRIPT','IFRAME'].includes(node.tagName) && isAd(node.src))) {
      node.remove();return true;
    }
    node.querySelectorAll(selector).forEach(el=>el.remove());
    return false;
  };
  const originalAppend=Node.prototype.appendChild, originalInsert=Node.prototype.insertBefore;
  Node.prototype.appendChild=function(node){if(clean(node))return node;return originalAppend.call(this,node);};
  Node.prototype.insertBefore=function(node,ref){if(clean(node))return node;return originalInsert.call(this,node,ref);};
  new MutationObserver(records=>records.forEach(r=>r.addedNodes.forEach(clean))).observe(document.documentElement,{childList:true,subtree:true});
  const originalFetch=window.fetch;
  if(originalFetch)window.fetch=function(input,...args){if(isAd(input?.url||input))return Promise.reject(new TypeError('Advertisement blocked'));return originalFetch.call(this,input,...args);};
  const originalOpen=XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open=function(method,url,...args){return originalOpen.call(this,method,isAd(url)?'data:text/plain,':url,...args);};
  const queue=[];
  queue.push=function(options){queueMicrotask(()=>{
    if(!options||typeof options!=='object')return;
    try{options.beforeAd?.();options.afterAd?.();options.adBreakDone?.({breakStatus:'noAdPreloaded'});}catch(_){}
  });return 0;};
  try{Object.defineProperty(window,'adsbygoogle',{get:()=>queue,set:()=>{},configurable:false});}catch(_){}
  window.open=()=>({closed:true,focus(){},close(){},location:{}});
})();