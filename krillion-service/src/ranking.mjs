export async function rankedPlayer(request,env){
 const token=request.headers.get('X-Wacky-Krillion-Ticket');if(!token)return null;
 if(!/^[a-f0-9]{64}$/.test(token)||!env.ACCOUNTS_DB)throw new Error('ACCOUNT_REQUIRED');
 const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))].map(x=>x.toString(16).padStart(2,'0')).join('');
 const now=Date.now(),row=await env.ACCOUNTS_DB.prepare('SELECT u.id FROM krillion_tickets t JOIN users u ON u.id=t.user_id JOIN sessions s ON s.token_hash=t.session_hash AND s.user_id=u.id WHERE t.token_hash=? AND t.expires>? AND s.expires>? AND u.banned=0 AND u.suspended_until<=?').bind(hash,now,now,now).first();
 if(!row)throw new Error('ACCOUNT_REQUIRED');return row.id;
}
export async function publishDaily(env,run,puzzle,results){
 if(!run.completed||run.mode!=='daily'||puzzle.sample||!run.player.startsWith('account:')||results.length!==7||!env.ACCOUNTS_DB)return false;
 const score=results.reduce((sum,r)=>sum+r.score,0),id=run.player.slice(8);
 await env.ACCOUNTS_DB.prepare('INSERT OR IGNORE INTO krillion_results(date,user_id,run_id,score,finished) VALUES(?,?,?,?,?)').bind(run.date,id,run.id,score,Date.now()).run();return true;
}
