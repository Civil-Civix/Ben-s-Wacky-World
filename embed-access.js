// Compatibility loader for cached HTML from the former embed-only version.
// Current pages use normal deferred scripts and do not need this file.
(() => {
 'use strict';
 document.documentElement.classList.add('site-embedded');
 for(const source of document.querySelectorAll('script[data-site-src]')){
  const script=document.createElement('script');script.async=false;script.src=source.dataset.siteSrc;document.head.append(script);
 }
})();
