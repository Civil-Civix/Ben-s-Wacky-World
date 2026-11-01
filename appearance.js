'use strict';
(() => {
  const key = 'bens-wacky-world.appearance.v1';
  const defaults = {background:'midnight',accent:'#3399FF',effect:'nova',speed:1,amount:1,snow:true,secondaryAccent:'#FA578C',accentMode:'single'};
  const effects = ['none','nova','snow','matrix','constellation','topography','starfield','casino','cherry-blossom','halloween'];
  const backgrounds = ['midnight','obsidian','slate','mocha','moss','snow'];
  const root = document.documentElement;
  const layer = document.querySelector('#snow');
  const warning = document.querySelector('#appearance-notice');
  function read() {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || '{}');
      return {
        background:backgrounds.includes(saved?.background) ? saved.background : defaults.background,
        accent:saved?.accent==='RAINBOW' ? 'RAINBOW' : /^#[0-9a-f]{6}$/i.test(saved?.accent) ? (saved.accent.toUpperCase()==='#FFAE00'?'#FFDD00':saved.accent.toUpperCase()) : defaults.accent,
        secondaryAccent:/^#[0-9a-f]{6}$/i.test(saved?.secondaryAccent)?saved.secondaryAccent.toUpperCase():defaults.secondaryAccent,
        accentMode:saved?.accent!=='RAINBOW'&&['split','fade'].includes(saved?.accentMode)?saved.accentMode:'single',
        speed:Number.isFinite(saved?.speed) ? Math.max(.25,Math.min(5,saved.speed)) : 1,
        amount:Number.isFinite(saved?.amount) ? Math.max(.25,Math.min(3,saved.amount)) : 1,
        effect:effects.includes(saved?.effect) ? saved.effect : defaults.effect,
        snow:typeof saved?.snow === 'boolean' ? saved.snow : defaults.snow
      };
    } catch (_) {return {...defaults};}
  }
  let appearance = read();
  const fragment = document.createDocumentFragment();
  for (let i=0;i<240;i++) {
    const flake = document.createElement('span');
    flake.className = 'snowflake';
    const size = i % 9 === 0 ? 7+Math.random()*4 : 1.5+Math.random()*2.5;
    flake.style.cssText = '--x:'+Math.random()*100+'%;--size:'+size+'px;--duration:'+(16+Math.random()*24)+'s;--delay:-'+Math.random()*40+'s;--drift:'+(Math.random()*100-50)+'px;--opacity:'+(0.16+Math.random()*0.38)+';--blur:'+(size>6?2:0.3)+'px';
    fragment.append(flake);
  }
  layer.append(fragment);
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  function currentAccent(){
    if(appearance.accent!=='RAINBOW'){
      if(appearance.accentMode!=='fade'||reducedMotion.matches)return appearance.accent;
      const blend=(1-Math.cos(performance.now()/1000*Math.PI/4))/2;
      return '#'+appearance.accent.slice(1).match(/../g).map((v,i)=>Math.round(parseInt(v,16)*(1-blend)+parseInt(appearance.secondaryAccent.slice(1+i*2,3+i*2),16)*blend).toString(16).padStart(2,'0')).join('');
    }
    if(reducedMotion.matches)return '#3399FF';
    const hue=(210+performance.now()/1000*12)%360;
    const channel=n=>{const k=(n+hue/30)%12;return Math.round((.6-.32*Math.max(-1,Math.min(k-3,9-k,1)))*255).toString(16).padStart(2,'0');};
    return '#'+channel(0)+channel(8)+channel(4);
  }
  function paintAccent(accent,updateIcon=false){
    root.style.setProperty('--accent',accent);
    const rgb = accent.slice(1).match(/../g).map(x=>parseInt(x,16));
    root.style.setProperty('--accent-rgb',rgb.join(' '));
    const effectColor=appearance.background==='snow' && appearance.effect!=='cherry-blossom' ? '#'+rgb.map(v=>Math.round(v*.5).toString(16).padStart(2,'0')).join('') : accent;
    root.style.setProperty('--effect-color',effectColor);
    root.style.setProperty('--accent-ink',rgb[0]*.299+rgb[1]*.587+rgb[2]*.114>145?'#101014':'#ffffff');
    document.querySelector('meta[name="theme-color"]').content = accent;
    if(updateIcon){
    const favicon = document.querySelector('link[rel="icon"]');
    const icon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="'+accent+'"/><text x="16" y="23" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="23" fill="'+root.style.getPropertyValue('--accent-ink')+'">W</text></svg>';
    favicon.href = 'data:image/svg+xml,' + encodeURIComponent(icon);
    }
    return effectColor;
  }
  setInterval(()=>{if((appearance.accent!=='RAINBOW'&&appearance.accentMode!=='fade')||reducedMotion.matches||document.hidden||document.body.classList.contains('playing'))return;const accent=currentAccent(),effectColor=paintAccent(accent);window.setBackgroundEffectColor(effectColor);},80);
  function apply(save=false) {
    root.dataset.accentMode=appearance.accentMode;
    root.dataset.background = appearance.background;
    root.dataset.effect = appearance.effect;
    root.dataset.animateEffects = String(appearance.snow);
    root.style.setProperty('--effect-speed',appearance.speed);
    document.querySelector('#effect-speed').value=appearance.speed;
    document.querySelector('#speed-value').textContent=appearance.speed.toFixed(2).replace(/0+$/,'').replace(/\.$/,'')+'×';
    const accent=currentAccent(),effectColor=paintAccent(accent,true);
    document.querySelector('#effect-amount').value=appearance.amount;
    document.querySelector('#amount-value').textContent=Number(appearance.amount.toFixed(2))+'×';
    Array.from(layer.children).forEach((flake,i)=>{flake.hidden=i>=Math.round(80*appearance.amount);});
    document.querySelectorAll('button[data-background]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.background===appearance.background)));
    document.querySelectorAll('[data-accent]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.accent.toUpperCase()===appearance.accent)));
    document.querySelector('#custom-accent').value = appearance.accent==='RAINBOW'?accent:appearance.accent;
    document.querySelector('#accent-mode').value=appearance.accentMode;
    document.querySelector('#secondary-accent-controls').hidden=appearance.accentMode==='single';
    document.querySelector('#secondary-accent').value=appearance.secondaryAccent;
    document.querySelector('#secondary-accent-value').textContent=appearance.secondaryAccent;
    document.querySelectorAll('[data-secondary-accent]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.secondaryAccent===appearance.secondaryAccent)));
    const secondaryEffectColor=appearance.background==='snow'&&appearance.effect!=='cherry-blossom'?'#'+appearance.secondaryAccent.slice(1).match(/../g).map(v=>Math.round(parseInt(v,16)*.5).toString(16).padStart(2,'0')).join(''):appearance.secondaryAccent;
    root.style.setProperty('--effect-secondary',secondaryEffectColor);
    document.querySelector('#accent-value').textContent = appearance.accent==='RAINBOW'?'Rainbow':appearance.accent;
    document.querySelector('#snow-enabled').checked = appearance.snow;
    layer.hidden = appearance.effect !== 'snow';
    layer.classList.toggle('still',!appearance.snow);
    document.querySelectorAll('button[data-effect]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.effect===appearance.effect)));
    window.setBackgroundEffect({...appearance,accent,effectColor,secondaryEffectColor});
    window.dispatchEvent(new Event('bww:appearance'));
    if(save) {
      try {localStorage.setItem(key,JSON.stringify(appearance));warning.hidden=true;}
      catch (_) {warning.hidden=false;}
    }
  }
  document.querySelectorAll('button[data-background]').forEach(button=>button.addEventListener('click',()=>{appearance.background=button.dataset.background;apply(true);}));
  document.querySelectorAll('button[data-effect]').forEach(button=>button.addEventListener('click',()=>{appearance.effect=button.dataset.effect;apply(true);}));
  document.querySelectorAll('[data-accent]').forEach(button=>button.addEventListener('click',()=>{appearance.accent=button.dataset.accent.toUpperCase();if(appearance.accent==='RAINBOW')appearance.accentMode='single';apply(true);}));
  const secondOptions=document.querySelector('#secondary-accent-options');
  document.querySelectorAll('[data-accent]:not([data-accent="RAINBOW"])').forEach(original=>{const button=original.cloneNode(true);button.dataset.secondaryAccent=button.dataset.accent;delete button.dataset.accent;button.setAttribute('aria-label',original.getAttribute('aria-label').replace('accent','second accent'));button.addEventListener('click',()=>{appearance.secondaryAccent=button.dataset.secondaryAccent;apply(true);});secondOptions.append(button);});
  document.querySelector('#secondary-accent').addEventListener('input',e=>{appearance.secondaryAccent=e.target.value.toUpperCase();apply(true);});
  document.querySelector('#accent-mode').addEventListener('change',e=>{appearance.accentMode=e.target.value;if(appearance.accentMode!=='single'&&appearance.accent==='RAINBOW')appearance.accent=defaults.accent;apply(true);});
  reducedMotion.addEventListener('change',()=>apply());
  document.querySelector('#custom-accent').addEventListener('input',event=>{appearance.accent=event.target.value.toUpperCase();apply(true);});
  document.querySelector('#effect-speed').addEventListener('input',event=>{appearance.speed=Number(event.target.value);apply(true);});
  document.querySelector('#effect-amount').addEventListener('input',event=>{appearance.amount=Number(event.target.value);apply(true);});
  document.querySelector('#snow-enabled').addEventListener('change',event=>{appearance.snow=event.target.checked;apply(true);});
  document.querySelector('#reset-appearance').addEventListener('click',()=>{appearance={...defaults};apply(true);});
  window.addEventListener('storage',event=>{if(event.key===key || event.key===null){appearance=read();apply();}});
  document.addEventListener('visibilitychange',()=>{layer.classList.toggle('paused',document.hidden);});
  apply();
})();
