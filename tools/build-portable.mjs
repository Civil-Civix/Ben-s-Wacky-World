import {readFile,writeFile,mkdir,cp,stat,lstat,rm,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const manifest=JSON.parse(await readFile(path.join(root,'tools/portable-games.json'),'utf8'));
const bundled=path.join(root,'library/bundled');
const overrides=path.join(root,'tools/portable-overrides');
const output=path.join(root,'.portable/site');
const digest=b=>createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
function target(g,f){const dir=path.join(bundled,g.id),dest=path.resolve(dir,f.path.slice(g.prefix.length));if(!dest.startsWith(dir+path.sep))throw Error('Unsafe manifest path');return dest;}
if(process.argv.includes('--download')){
 const queue=manifest.flatMap(g=>g.files.map(f=>({g,f})));
 async function worker(){while(queue.length){const {g,f}=queue.shift(),dest=target(g,f);let b;try{b=await readFile(dest);}catch{}if(b&&b.length===f.bytes&&digest(b)===f.sha)continue;
  let downloaded=false;for(let i=0;i<3;i++){try{const response=await fetch('https://raw.githubusercontent.com/'+g.repo+'/'+g.revision+'/'+f.path.split('/').map(encodeURIComponent).join('/'),{signal:AbortSignal.timeout(120000)});if(!response.ok)throw Error('HTTP '+response.status);b=Buffer.from(await response.arrayBuffer());if(b.length!==f.bytes||digest(b)!==f.sha)throw Error('Asset integrity mismatch');await mkdir(path.dirname(dest),{recursive:true});await writeFile(dest,b);downloaded=true;break;}catch(e){if(i===2)throw Error(g.id+'/'+f.path+': '+e.message);}}
  if(downloaded)console.log('Downloaded '+g.id+'/'+f.path);
 }}
 await Promise.all(Array.from({length:6},worker));
 await cp(overrides,bundled,{recursive:true});
}
// Validate every downloaded file. Intentional launcher changes are checked against overrides.
for(const g of manifest)for(const f of g.files){const dest=target(g,f),override=path.join(overrides,g.id,f.path.slice(g.prefix.length));let expected;try{expected=await readFile(override);}catch{}const b=await readFile(dest).catch(()=>{throw Error('Missing '+dest+'; run with --download first.');});if(expected?!b.equals(expected):(b.length!==f.bytes||digest(b)!==f.sha))throw Error('Unexpected local modification: '+dest);}
// Verify added helpers, attribution and the shared ZIP library too.
async function verifyOverrides(dir, relative='') {
 for (const entry of await readdir(dir, {withFileTypes:true})) {
  const rel=path.join(relative,entry.name), source=path.join(dir,entry.name);
  if(entry.isDirectory()) { await verifyOverrides(source,rel); continue; }
  const actual=await readFile(path.join(bundled,rel));
  if(!actual.equals(await readFile(source))) throw Error('Launcher override mismatch: '+rel);
 }
}
await verifyOverrides(overrides);
if(process.argv.includes('--check')){console.log('Verified all 297 source assets and launcher overrides.');process.exit(0);}
// Output is restricted to .portable/site; never remove a caller-selected folder.
for(const p of [path.dirname(output),output]){try{if((await lstat(p)).isSymbolicLink())throw Error('Refusing symbolic link output');}catch(e){if(e.code!=='ENOENT')throw e;}}
await rm(output,{recursive:true,force:true});await mkdir(output,{recursive:true});
const builder=await readFile(path.join(root,'tools/build-pages.mjs'),'utf8');
const rootFiles=[...builder.match(/const ROOT_FILES = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map(m=>m[1]);
for(const file of rootFiles)await cp(path.join(root,file),path.join(output,file));
for(const dir of ['fonts','images','vendor','licenses']){try{await cp(path.join(root,dir),path.join(output,dir),{recursive:true});}catch(e){if(e.code!=='ENOENT')throw e;}}
await mkdir(path.join(output,'library'),{recursive:true});
await cp(bundled,path.join(output,'library/bundled'),{recursive:true});
await cp(path.join(root,'library/polytrack'),path.join(output,'library/polytrack'),{recursive:true});
const games=JSON.parse(await readFile(path.join(root,'games.json'),'utf8')).filter(g=>g.id==='polytrack'||manifest.some(m=>m.id===g.id)).map(g=>({...g,url:g.id==='polytrack'?g.url:'library/bundled/'+g.id+'/index.html',source:'bundled'}));
await writeFile(path.join(output,'games.json'),JSON.stringify(games,null,2)+'\n');
await writeFile(path.join(output,'games.js'),'window.WACKY_GAMES = '+JSON.stringify(games)+';\n');
let html=await readFile(path.join(output,'index.html'),'utf8');html=html.replace('Guest chat &amp; reply notifications','Portable game pack preview');await writeFile(path.join(output,'index.html'),html);
console.log('Built '+games.length+' locally bundled games at '+output);
console.log('This is the game-pack preview. Online services and a platform-specific launcher are not packaged yet.');
