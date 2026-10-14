/* A shared weekly shuffle; featuring a track never changes its records. */
(() => {
 'use strict';
 const start=Date.parse('2026-10-12T00:00:00-07:00'),weekMs=7*86400000;
 function pick(tracks,now=Date.now()){
  if(!tracks.length)return null;
  const week=Math.max(0,Math.floor((now-start)/weekMs));
  let index=Math.max(0,tracks.findIndex(t=>t.name==='Desert 5'));
  for(let n=1;n<=week;n++){let hash=(n^0x57ac2026)>>>0;hash=Math.imul(hash^(hash>>>16),0x45d9f3b)>>>0;hash=Math.imul(hash^(hash>>>16),0x45d9f3b)>>>0;hash=(hash^(hash>>>16))>>>0;if(tracks.length>1)index=(index+1+hash%(tracks.length-1))%tracks.length;}
  return {week,track:tracks[index],next:start+(week+1)*weekMs};
 }
 window.WackyWeeklyTrack={pick};
})();
