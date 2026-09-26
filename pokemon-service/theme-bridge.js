// Only accept appearance preferences from the direct, trusted site parent.
(() => {
  const parents=['https://civil-civix.github.io','http://127.0.0.1:4173'];
  const palettes={
    obsidian:['#050505','#0c0c0f','#131316','#29272f','#a39fac'],
    midnight:['#101017','#191921','#202029','#35353f','#aaaabb'],
    slate:['#101922','#172430','#203140','#334658','#a6b8ca'],
    mocha:['#1b1512','#29201b','#332822','#49392e','#c1ad9c']
  };
  window.addEventListener('message',event=>{
    if(event.source!==window.parent || !parents.includes(event.origin) || event.data?.type!=='bww:theme')return;
    const {accent,background}=event.data;
    if(typeof accent!=='string'||!/^#[a-f0-9]{6}$/i.test(accent)||!Object.hasOwn(palettes,background))return;
    const style=document.documentElement.style;
    const rgb=accent.slice(1).match(/../g).map(n=>parseInt(n,16));
    style.setProperty('--bww-accent',accent);
    style.setProperty('--bww-ink',rgb[0]*.299+rgb[1]*.587+rgb[2]*.114>145?'#101014':'#ffffff');
    ['page','surface','panel','line','muted'].forEach((key,i)=>style.setProperty('--bww-'+key,palettes[background][i]));
    document.documentElement.dataset.bwwBackground=background;
  });
  if(window.parent!==window) for(const origin of parents) window.parent.postMessage({type:'bww:theme-ready'},origin);
})();
