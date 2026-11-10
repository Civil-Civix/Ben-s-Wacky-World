import {friendFilter} from './friends.mjs';
export const krillionDate=(now=Date.now())=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
export async function krillionBoard({url,env,now,json,publicUser,friendId}){
 const date=krillionDate(now),q=(url.searchParams.get('q')||'').slice(0,20).toLowerCase().replace(/[^a-z0-9_]/g,''),offset=Math.min(100000,Math.max(0,parseInt(url.searchParams.get('offset'))||0));
 const cte='WITH ranked AS (SELECT u.*,k.score,RANK() OVER(ORDER BY k.score DESC) AS rank FROM krillion_results k JOIN users u ON u.id=k.user_id WHERE k.date=? AND u.banned=0 AND u.suspended_until<=?'+(friendId?' AND '+friendFilter('u'):'')+') ';
 const args=[date,now,...(friendId?[friendId,friendId,friendId]:[])];
 const rows=await env.DB.prepare(cte+'SELECT * FROM ranked WHERE instr(lower(username),?)>0 ORDER BY rank,username_key LIMIT 51 OFFSET ?').bind(...args,q,offset).all();
 const top=await env.DB.prepare(cte+'SELECT * FROM ranked ORDER BY rank,username_key LIMIT 3').bind(...args).all();
 const out=r=>({...publicUser(r),score:r.score,rank:r.rank});
 return json({date,users:rows.results.slice(0,50).map(out),top:top.results.map(out),hasMore:rows.results.length>50});
}
