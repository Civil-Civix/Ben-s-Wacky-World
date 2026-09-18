'use strict';
(() => {
  let started = false;
  const title = "Ben's Wacky World";
  const target = document.querySelector('#typed-title');
  window.startHomeTitle = () => {
    if(started) return;
    started = true;
    if(matchMedia('(prefers-reduced-motion: reduce)').matches) {target.textContent=title;return;}
    target.textContent = '';
    target.classList.add('typing');
    let start;
    function tick(time) {
      start ??= time;
      const count = Math.min(title.length,Math.floor((time-start)/85));
      target.textContent = title.slice(0,count);
      if(count<title.length) requestAnimationFrame(tick);
      else target.classList.remove('typing');
    }
    requestAnimationFrame(tick);
  };
})();
