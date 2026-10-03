import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {createHmac} from 'node:crypto';
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'bww-results-test-')),cwd=process.cwd();
fs.mkdirSync(path.join(temp,'config'));fs.writeFileSync(path.join(temp,'config/bww-result-secret'),'test-only');process.chdir(temp);
const sent=[];globalThis.fetch=async(url,options)=>{sent.push(options);return {ok:true};};
try{const {handlers}=await import('./wacky-results.ts');const players=['bww'+'a'.repeat(32),'bww'+'b'.repeat(32)];
handlers.onBattleEnd({rated:0,format:'gen9randombattle',roomid:'battle-gen9randombattle-1'},players[0],players);assert.equal(sent.length,0);
handlers.onBattleEnd({rated:1,format:'gen9randombattle',roomid:'battle-gen9randombattle-2'},players[0],players);
await new Promise(r=>setTimeout(r,50));assert.equal(sent.length,1);const body=JSON.parse(sent[0].body);assert.equal(body.winner,players[0]);assert.equal(body.loser,players[1]);assert.equal(sent[0].headers['X-Battle-Signature'],createHmac('sha256','test-only').update(sent[0].body).digest('hex'));assert.equal(fs.readdirSync('config/bww-result-outbox').length,0);
globalThis.fetch=async()=>({ok:false,status:503});handlers.onBattleEnd({rated:1,format:'gen9randombattle',roomid:'battle-gen9randombattle-3'},players[0],players);await new Promise(r=>setTimeout(r,50));assert.equal(fs.readdirSync('config/bww-result-outbox').length,1);
console.log('PASS: server handler excludes challenges, signs results, clears delivered rows, retains outbox on failure.');
}finally{clearInterval(globalThis.__bwwResultsTimer);process.chdir(cwd);fs.rmSync(temp,{recursive:true,force:true});}
