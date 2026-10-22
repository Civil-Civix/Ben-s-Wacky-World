// Replay trusted results so late arrivals and voided matches remain consistent.
export function showdownRatings(battles){
 const ratings=new Map(),seen=new Set();
 const player=id=>{if(!ratings.has(id))ratings.set(id,{elo:1000,wins:0,losses:0});return ratings.get(id);};
 for(const battle of [...battles].sort((a,b)=>a.finished-b.finished||(a.battle_id<b.battle_id?-1:a.battle_id>b.battle_id?1:0))){
  if(battle.voided||seen.has(battle.battle_id))continue;
  seen.add(battle.battle_id);
  const winner=player(battle.winner),loser=player(battle.loser);
  const expected=1/(1+10**((loser.elo-winner.elo)/400));
  const change=Math.max(1,Math.round(32*(1-expected)));
  winner.elo+=change;winner.wins++;loser.elo-=change;loser.losses++;
 }
 return ratings;
}
