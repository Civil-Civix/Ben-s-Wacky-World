import {aiEnabled,answerWithFallback} from './ai-providers.mjs';
import {createHash,createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
const LIMIT=15,DAY=86400000,OFFSET=7*3600000;
export const aiDay=now=>new Date(now-OFFSET).toISOString().slice(0,10);
const hash=s=>createHash('sha256').update(s).digest('hex');
const sign=(id,env)=>createHmac('sha256',env.PASSWORD_PEPPER).update('ai-browser:'+id).digest('hex');
function browserToken(request,env){
 const value=/(?:^|;\s*)__Host-wacky_ai_browser=([a-f0-9]{64})\.([a-f0-9]{64})(?:;|$)/.exec(request.headers.get('Cookie')||'');
 return value&&timingSafeEqual(Buffer.from(value[2],'hex'),Buffer.from(sign(value[1],env),'hex'))?value[1]:null;
}
// Called only after the existing origin and authenticated-session checks.
export async function ai({request,url,env,me,now,body,fail,json}){
 if(url.pathname!=='/ai')return null;
 if(!['GET','POST'].includes(request.method))fail(405,'Method not allowed.');
 let token=browserToken(request,env);const headers={};
 if(!token){
  if(request.method==='POST')fail(409,'Please reopen AI Chat to enable browser cookies.');
  token=randomBytes(32).toString('hex');
  headers['Set-Cookie']='__Host-wacky_ai_browser='+token+'.'+sign(token,env)+'; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=31536000';
 }
 const browser=hash(token),day=aiDay(now);
 // Timed-out reservations cannot hold a conversation open indefinitely.
 await env.DB.prepare("UPDATE ai_requests SET status='failed',prompt=NULL,answer=NULL WHERE user_id=? AND status='pending' AND created<?").bind(me.id,now-90000).run();
 const snapshot=async()=>{
  const used=await env.DB.prepare("SELECT (SELECT count(*) FROM ai_requests WHERE user_id=? AND day=? AND status!='failed') AS account,(SELECT count(*) FROM ai_requests WHERE browser_hash=? AND day=? AND status!='failed') AS browser").bind(me.id,day,browser,day).first();
  const rows=await env.DB.prepare("SELECT request_id AS id,prompt,answer,provider,model,created,expires FROM ai_requests WHERE user_id=? AND status='complete' AND expires>? ORDER BY created LIMIT 30").bind(me.id,now).all();
  return {enabled:aiEnabled(env),remaining:Math.max(0,LIMIT-Math.max(used.account,used.browser)),resetsAt:Date.parse(day+'T00:00:00-07:00')+DAY,messages:rows.results};
 };
 if(request.method==='GET')return json(await snapshot(),200,headers);
 if(!aiEnabled(env))fail(503,'AI Chat is not connected yet. Please check back soon.');
 const data=await body(request);
 if(typeof data.text!=='string'||!data.text.trim()||data.text.length>1000)fail(400,'Write a message of 1–1,000 characters.');
 if(typeof data.requestId!=='string'||!/^[a-zA-Z0-9-]{16,64}$/.test(data.requestId))fail(400,'Invalid message.');
 const previous=await env.DB.prepare('SELECT status FROM ai_requests WHERE user_id=? AND request_id=?').bind(me.id,data.requestId).first();
 if(previous?.status==='complete')return json(await snapshot());
 if(previous?.status==='pending')fail(409,'Your message is still being answered.');
 if(previous)fail(409,'Please send this message again.');
 // One atomic statement reserves both allowances, including simultaneous requests.
 const reserved=await env.DB.prepare(`INSERT OR IGNORE INTO ai_requests(user_id,request_id,browser_hash,day,status,prompt,created,expires)
 SELECT ?,?,?,?,'pending',?,?,?
 WHERE (SELECT count(*) FROM ai_requests WHERE user_id=? AND day=? AND status!='failed')<15
 AND (SELECT count(*) FROM ai_requests WHERE browser_hash=? AND day=? AND status!='failed')<15
 AND NOT EXISTS(SELECT 1 FROM ai_requests WHERE user_id=? AND status='pending')`).bind(me.id,data.requestId,browser,day,data.text.trim(),now,now+DAY,me.id,day,browser,day,me.id).run();
 if(!reserved.meta.changes){const state=await snapshot();if(!state.remaining)fail(429,'Daily limit reached. Your 15 messages reset at midnight Arizona time.');fail(409,'Please wait for the current answer before sending another message.');}
 try{
  const history=await env.DB.prepare("SELECT prompt,answer FROM ai_requests WHERE user_id=? AND status='complete' AND expires>? ORDER BY created DESC LIMIT 6").bind(me.id,now).all();
  const messages=[{role:'system',content:"You are a helpful, friendly AI assistant in Ben's Wacky World. Be clear and concise. You cannot browse the web, inspect site profiles, or perform actions. Do not claim otherwise."}];
  for(const turn of history.results.reverse())messages.push({role:'user',content:turn.prompt},{role:'assistant',content:turn.answer.slice(0,6000)});
  messages.push({role:'user',content:data.text.trim()});
  const result=await answerWithFallback(env,messages);
  await env.DB.prepare("UPDATE ai_requests SET status='complete',answer=?,provider=?,model=? WHERE user_id=? AND request_id=? AND status='pending'").bind(result.answer,result.provider,result.model,me.id,data.requestId).run();
 }catch{
  await env.DB.prepare("UPDATE ai_requests SET status='failed',prompt=NULL,answer=NULL WHERE user_id=? AND request_id=? AND status='pending'").bind(me.id,data.requestId).run();
  fail(503,'All AI providers are temporarily unavailable or at their limits. Your message allowance was not used. Please try again later.');
 }
 return json(await snapshot());
}
