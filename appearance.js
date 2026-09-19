'use strict';
(() => {
  const key = 'bens-wacky-world.appearance.v1';
  const defaults = {background:'obsidian',accent:'#FFAE00',effect:'snow',speed:1,snow:!matchMedia('(prefers-reduced-motion: reduce)').matches};
  const effects = ['none','snow','matrix','constellation','topography','starfield'];
  const backgrounds = ['midnight','obsidian','slate','mocha'];
  const root = document.documentElement;
  const layer = document.querySelector('#snow');
  const warning = document.querySelector('#appearance-notice');
  function read() {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || '{}');
      return {
        background:backgrounds.includes(saved?.background) ? saved.background : defaults.background,
        accent:/^#[0-9a-f]{6}$/i.test(saved?.accent) ? saved.accent.toUpperCase() : defaults.accent,
        speed:Number.isFinite(saved?.speed) ? Math.max(.25,Math.min(3,saved.speed)) : 1,
        effect:effects.includes(saved?.effect) ? saved.effect : defaults.effect,
        snow:typeof saved?.snow === 'boolean' ? saved.snow : defaults.snow
      };
    } catch (_) {return {...defaults};}
  }
  let appearance = read();
  const fragment = document.createDocumentFragment();
  for (let i=0;i<80;i++) {
    const flake = document.createElement('span');
    flake.className = 'snowflake';
    const size = i % 9 === 0 ? 7+Math.random()*4 : 1.5+Math.random()*2.5;
    flake.style.cssText = '--x:'+Math.random()*100+'%;--size:'+size+'px;--duration:'+(16+Math.random()*24)+'s;--delay:-'+Math.random()*40+'s;--drift:'+(Math.random()*100-50)+'px;--opacity:'+(0.16+Math.random()*0.38)+';--blur:'+(size>6?2:0.3)+'px';
    fragment.append(flake);
  }
  layer.append(fragment);
  function apply(save=false) {
    root.dataset.background = appearance.background;
    root.style.setProperty('--effect-speed',appearance.speed);
    document.querySelector('#effect-speed').value=appearance.speed;
    document.querySelector('#speed-value').textContent=appearance.speed.toFixed(2).replace(/0+$/,'').replace(/\.$/,'')+'×';
    root.style.setProperty('--accent',appearance.accent);
    const rgb = appearance.accent.slice(1).match(/../g).map(x=>parseInt(x,16));
    root.style.setProperty('--accent-rgb',rgb.join(' '));
    root.style.setProperty('--accent-ink',rgb[0]*.299+rgb[1]*.587+rgb[2]*.114>145?'#101014':'#ffffff');
    document.querySelector('meta[name="theme-color"]').content = appearance.accent;
    document.querySelectorAll('[data-background]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.background===appearance.background)));
    document.querySelectorAll('[data-accent]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.accent.toUpperCase()===appearance.accent)));
    document.querySelector('#custom-accent').value = appearance.accent;
    document.querySelector('#accent-value').textContent = appearance.accent;
    document.querySelector('#snow-enabled').checked = appearance.snow;
    layer.hidden = appearance.effect !== 'snow';
    layer.classList.toggle('still',!appearance.snow);
    document.querySelectorAll('[data-effect]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.effect===appearance.effect)));
    window.setBackgroundEffect(appearance);
    if(save) {
      try {localStorage.setItem(key,JSON.stringify(appearance));warning.hidden=true;}
      catch (_) {warning.hidden=false;}
    }
  }
  document.querySelectorAll('[data-background]').forEach(button=>button.addEventListener('click',()=>{appearance.background=button.dataset.background;apply(true);}));
  document.querySelectorAll('[data-effect]').forEach(button=>button.addEventListener('click',()=>{appearance.effect=button.dataset.effect;apply(true);}));
  document.querySelectorAll('[data-accent]').forEach(button=>button.addEventListener('click',()=>{appearance.accent=button.dataset.accent.toUpperCase();apply(true);}));
  document.querySelector('#custom-accent').addEventListener('input',event=>{appearance.accent=event.target.value.toUpperCase();apply(true);});
  document.querySelector('#effect-speed').addEventListener('input',event=>{appearance.speed=Number(event.target.value);apply(true);});
  document.querySelector('#snow-enabled').addEventListener('change',event=>{appearance.snow=event.target.checked;apply(true);});
  document.querySelector('#reset-appearance').addEventListener('click',()=>{appearance={...defaults,snow:!matchMedia('(prefers-reduced-motion: reduce)').matches};apply(true);});
  window.addEventListener('storage',event=>{if(event.key===key || event.key===null){appearance=read();apply();}});
  document.addEventListener('visibilitychange',()=>{layer.classList.toggle('paused',document.hidden);});
  apply();
})();
