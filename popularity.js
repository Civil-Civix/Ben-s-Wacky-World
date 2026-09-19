(() => {
  'use strict';
  const endpoint = 'https://bens-wacky-popularity.mr-ellis1009.workers.dev';
  const visitorKey = 'bens-wacky-world.popularity-browser.v1';
  const seenKey = 'bens-wacky-world.popularity-counted.v1';
  const validIds = new Set((window.WACKY_GAMES || []).map(game=>game.id));
  let visitorId, seen = {day:'',ids:[]}, pending = new Set();
  let scores = null, state = 'idle', lastFetched = 0, loading;
  try {
    visitorId = localStorage.getItem(visitorKey);
    const saved = JSON.parse(localStorage.getItem(seenKey));
    if (saved && typeof saved.day==='string' && Array.isArray(saved.ids))
      seen = {day:saved.day,ids:saved.ids.filter(id=>validIds.has(id))};
  } catch (_) {}
  function changed() { window.dispatchEvent(new Event('popularitychange')); }
  async function refresh() {
    if (loading) return loading;
    if (state==='ready' && Date.now()-lastFetched < 60000) return;
    state='loading';changed();
    loading=(async()=>{
      try {
        const response=await fetch(endpoint+'/popular',{signal:AbortSignal.timeout(7000),credentials:'omit'});
        if(!response.ok)throw new Error('Unavailable');
        const data=await response.json();
        if(data.windowDays!==30 || !Array.isArray(data.games))throw new Error('Invalid response');
        const next=new Map();
        for(const row of data.games) {
          if(!validIds.has(row.id))continue;
          if(!Number.isSafeInteger(row.plays)||row.plays<0)throw new Error('Invalid count');
          next.set(row.id,row.plays);
        }
        scores=next;state='ready';lastFetched=Date.now();
      } catch (_) { state='error'; }
      finally { loading=null;changed(); }
    })();
    return loading;
  }
  async function track(game) {
    // Local previews and non-game sections never contribute to real rankings.
    if(location.origin!=='https://civil-civix.github.io'||game.kind==='app'||game.kind==='stream'||!validIds.has(game.id))return;
    const day=new Date().toISOString().slice(0,10);
    if(seen.day!==day)seen={day,ids:[]};
    if(seen.ids.includes(game.id)||pending.has(game.id))return;
    pending.add(game.id);
    try {
      if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(visitorId||'')) {
        visitorId=crypto.randomUUID();
        try { localStorage.setItem(visitorKey,visitorId); } catch (_) {}
      }
      const response=await fetch(endpoint+'/play',{method:'POST',headers:{'Content-Type':'application/json'},
        credentials:'omit',body:JSON.stringify({gameId:game.id,visitorId}),signal:AbortSignal.timeout(7000)});
      if(response.ok && seen.day===day) {
        seen.ids.push(game.id);
        try { localStorage.setItem(seenKey,JSON.stringify(seen)); } catch (_) {}
      }
    } catch (_) { /* A ranking outage must never prevent playing. */ }
    finally { pending.delete(game.id); }
  }
  window.WackyPopularity={refresh,track,get state(){return state;},get hasScores(){return scores!==null;},
    score(id){return scores?.get(id)||0;}};
})();
