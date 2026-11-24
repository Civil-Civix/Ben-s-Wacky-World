'use strict';
(() => {
  // Never request advertising from Portable, Google Sites, or any other embed.
  if (location.hostname !== 'bens-wacky-world.pages.dev' || window.self !== window.top) return;
  const home = document.querySelector('#home-panel');
  if (!home) return;
  const wide = matchMedia('(min-width: 1500px) and (min-height: 740px)');
  let used = false, cancelled = false;
  function eligible() {
    return wide.matches && !home.hidden && !document.hidden && !document.fullscreenElement && !document.body.classList.contains('playing') && !document.querySelector('dialog[open]');
  }
  function remove() {
    cancelled = true;
    document.querySelectorAll('.site-ad-rail').forEach(node => node.remove());
    home.classList.remove('with-site-ads');
  }
  function refresh() {
    if (!eligible()) { if (used) remove(); return; }
    // No timed refresh or repeated impressions when opening/closing site views.
    if (used) return;
    used = true; cancelled = false;
    home.classList.add('with-site-ads');
    const rails = ['left', 'right'].map(side => {
      const rail = document.createElement('aside');
      rail.className = 'site-ad-rail site-ad-' + side;
      rail.setAttribute('aria-label', 'Advertisement');
      const label = document.createElement('span'); label.textContent = 'Advertisement';
      const close = document.createElement('button');
      close.type = 'button'; close.className = 'site-ad-close'; close.textContent = '×';
      close.setAttribute('aria-label', 'Close ' + side + ' advertisement until reload');
      close.title = 'Close advertisement';
      close.addEventListener('click', () => {
        rail.remove();
        if (!home.querySelector('.site-ad-rail')) home.classList.remove('with-site-ads');
      });
      rail.append(label, close); home.append(rail); return rail;
    });
    function load(index) {
      if (cancelled || !eligible() || !rails[index]?.isConnected) return;
      const config = document.createElement('script');
      config.textContent = "atOptions = {'key':'ef02e7672e49cc0fd3c92863f07fa354','format':'iframe','height':600,'width':160,'params':{}};";
      const script = document.createElement('script');
      script.src = 'https://bauval.org/22/ef02e7672e49cc0fd3c92863f07fa354';
      script.onload = () => { if (index === 0) load(1); };
      script.onerror = () => { rails[index].remove(); if (index === 0) load(1); };
      rails[index].append(config, script);
    }
    load(0);
  }
  wide.addEventListener('change', refresh);
  document.addEventListener('visibilitychange', refresh);
  document.addEventListener('fullscreenchange', refresh);
  new MutationObserver(refresh).observe(home, {attributes:true, attributeFilter:['hidden']});
  new MutationObserver(refresh).observe(document.body, {attributes:true, attributeFilter:['class']});
  new MutationObserver(refresh).observe(document.body, {subtree:true, attributes:true, attributeFilter:['open']});
  refresh();
})();
