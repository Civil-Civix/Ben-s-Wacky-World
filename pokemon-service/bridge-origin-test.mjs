import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const siteOrigins=['https://civil-civix.github.io','https://bens-wacky-world.pages.dev','https://wacky-project-84f094.gitlab.io'];
const caddy=readFileSync(new URL('./Caddyfile.selfhosted',import.meta.url),'utf8');
const ancestors=caddy.match(/frame-ancestors ([^;\"]+)/)?.[1].split(/\s+/);
for(const origin of [...siteOrigins,'https://sites.google.com','https://www.gstatic.com'])
 assert.ok(ancestors?.includes(origin),`Caddy frame policy includes ${origin}`);
const profileSource=readFileSync(new URL('./profile-bridge.js',import.meta.url),'utf8');
for(const origin of siteOrigins){
 const sent=[],listeners={},parent={postMessage:(message,target)=>sent.push({message,target})},auth=[];
 const window={parent,addEventListener:(type,listener)=>listeners[type]=listener};
 const document={createElement:()=>({setAttribute(){}})};
 const PS={connection:{send:message=>auth.push(message)}};
 vm.runInNewContext(profileSource,{window,parent,document,PS,setInterval(){}});
 const message={type:'bww:auth',token:'bww'+'a'.repeat(32),name:'bww'+'a'.repeat(32),displayName:'Racer'};
 listeners.message({source:parent,origin,data:message});
 assert.deepEqual(auth,['|/trn bww'+'a'.repeat(32)+',0,BWW:bww'+'a'.repeat(32)],`profile auth accepted from ${origin}`);
 listeners.message({source:{},origin,data:message});
 assert.equal(auth.length,1,'profile bridge rejects a non-parent source');
 listeners.message({source:parent,origin:origin+'.evil.test',data:message});
 listeners.message({source:parent,origin:'null',data:message});
 assert.equal(auth.length,1,'profile bridge rejects lookalike and opaque origins');
}
{
 const sent=[],listeners={},styles=new Map(),parent={postMessage:(message,target)=>sent.push({message,target})};
 const window={parent,addEventListener:(type,listener)=>listeners[type]=listener};
 const document={documentElement:{style:{setProperty:(key,value)=>styles.set(key,value)},dataset:{}}};
 vm.runInNewContext(readFileSync(new URL('./theme-bridge.js',import.meta.url),'utf8'),{window,document});
 assert.deepEqual(sent.map(item=>item.target),[...siteOrigins,'http://127.0.0.1:4173']);
 const theme={type:'bww:theme',accent:'#123456',background:'obsidian'};
 listeners.message({source:parent,origin:siteOrigins[1],data:theme});
 assert.equal(styles.get('--bww-accent'),'#123456');
 listeners.message({source:parent,origin:'https://bens-wacky-world.pages.dev.evil.test',data:{...theme,accent:'#abcdef'}});
 assert.equal(styles.get('--bww-accent'),'#123456','theme bridge rejects lookalike origins');
 listeners.message({source:{},origin:siteOrigins[1],data:{...theme,accent:'#abcdef'}});
 assert.equal(styles.get('--bww-accent'),'#123456','theme bridge rejects a non-parent source');
 listeners.message({source:parent,origin:siteOrigins[2]+'.evil.test',data:{...theme,accent:'#abcdef'}});
 listeners.message({source:parent,origin:'null',data:{...theme,accent:'#abcdef'}});
 assert.equal(styles.get('--bww-accent'),'#123456','theme bridge rejects lookalike and opaque origins');
}
console.log('PASS: profile and theme bridges accept both exact site origins, reject lookalikes/non-parent sources, and announce to configured parents.');
