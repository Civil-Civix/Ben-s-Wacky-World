export const FEATURE_POLL={id:'next-big-thing-20261102',closes:Date.parse('2026-11-09T00:00:00-07:00'),choices:['tournaments','wacky-phone','daily-games','music']};
export async function featurePoll({request,env,me,now,body,fail,json}){
 const poll=FEATURE_POLL;
 if(request.method==='POST'){
  if(!me)fail(401,'Sign in to cast your vote.');
  if(now>=poll.closes)fail(409,'Voting has closed. Thanks for taking part!');
  const data=await body(request,512);
  if(!data||data.poll!==poll.id||!poll.choices.includes(data.choice))fail(400,'Choose one of the four features.');
  await env.DB.prepare('INSERT INTO feature_votes(poll_id,user_id,choice,updated) VALUES(?,?,?,?) ON CONFLICT(poll_id,user_id) DO UPDATE SET choice=excluded.choice,updated=excluded.updated').bind(poll.id,me.id,data.choice,now).run();
 }else if(request.method!=='GET')fail(405,'Method not allowed.');
 const results=await env.DB.batch([
  env.DB.prepare('SELECT choice,COUNT(*) AS votes FROM feature_votes WHERE poll_id=? GROUP BY choice').bind(poll.id),
  env.DB.prepare('SELECT choice FROM feature_votes WHERE poll_id=? AND user_id=?').bind(poll.id,me?.id||'')
 ]);
 const counts=Object.fromEntries(poll.choices.map(choice=>[choice,0]));
 for(const row of results[0].results)if(poll.choices.includes(row.choice))counts[row.choice]=row.votes;
 return json({id:poll.id,closes:poll.closes,closed:now>=poll.closes,counts,total:Object.values(counts).reduce((a,b)=>a+b,0),myVote:results[1].results[0]?.choice||null});
}
