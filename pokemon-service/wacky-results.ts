/** Install in server/chat-plugins. Secret stays in config/bww-result-secret. */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {createHmac} from 'node:crypto';
const dir=path.resolve('config/bww-result-outbox');
const boot=Date.now();
let sending=false;
async function flush(){
 if(sending)return;sending=true;
 try{
  const key=fs.readFileSync('config/bww-result-secret','utf8').trim();if(!key)return;
  fs.mkdirSync(dir,{recursive:true,mode:0o700});
  for(const file of fs.readdirSync(dir).filter(f=>f.endsWith('.json')).slice(0,100)){
   const target=path.join(dir,file),body=fs.readFileSync(target,'utf8');
   const response=await fetch('https://bens-wacky-accounts.mr-ellis1009.workers.dev/battle/results',{method:'POST',headers:{'Content-Type':'application/json','X-Wacky-Client':'1','X-Battle-Signature':createHmac('sha256',key).update(body).digest('hex')},body,signal:AbortSignal.timeout(10000)});
   if(response.ok)fs.unlinkSync(target);else {console.warn('Wacky result delivery pending:',response.status);break;}
  }
 }catch(error){console.warn('Wacky result delivery unavailable; queued results retained.');}finally{sending=false;}
}
const state=global as any;
if(state.__bwwResultsTimer)clearInterval(state.__bwwResultsTimer);
state.__bwwResultsTimer=setInterval(()=>void flush(),60000);state.__bwwResultsTimer.unref();
export const handlers: Chat.Handlers={
 onBattleEnd(battle,winner,players){
  if(!battle.rated||battle.format!=='gen9randombattle'||players.length!==2||!players.includes(winner)||players.some(id=>!/^bww[a-f0-9]{32}$/.test(id)))return;
  const loser=players.find(id=>id!==winner);if(!loser)return;
  const battleId=battle.roomid+'-'+boot;
  const body=JSON.stringify({battleId,format:'gen9randombattle',rated:true,winner,loser,finished:Date.now()});
  try{fs.mkdirSync(dir,{recursive:true,mode:0o700});const target=path.join(dir,battleId+'.json');fs.writeFileSync(target+'.tmp',body,{mode:0o600});fs.renameSync(target+'.tmp',target);void flush();}catch{console.error('Could not queue Wacky battle result.');}
 }
};
