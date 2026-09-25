import fs from 'node:fs/promises';
import path from 'node:path';
const root = process.argv[2], target = process.argv[3];
if (!root || !target) throw new Error('Usage: node stage-client.mjs SOURCE TARGET');
const web = path.join(root,'play.pokemonshowdown.com');
await fs.mkdir(target,{recursive:true});
for (const name of ['js','style','data','fx','sprites','audio','fonts']) {
  try { await fs.cp(path.join(web,name),path.join(target,name),{recursive:true}); } catch(e) { if(e.code !== 'ENOENT') throw e; }
}
for (const name of ['bww.js','bww.css','favicon.ico','favicon-256.png','favicon-notify.ico']) {
  await fs.copyFile(path.join(web,name),path.join(target,name)).catch(async e => {
    if(e.code !== 'ENOENT') throw e;
    const r=await fetch('https://play.pokemonshowdown.com/'+name);
    if(!r.ok) throw new Error('Missing '+name);
    await fs.writeFile(path.join(target,name),Buffer.from(await r.arrayBuffer()));
  });
}
await fs.copyFile(path.join(root,'LICENSE'),path.join(target,'LICENSE'));
await fs.mkdir(path.join(target,'config'),{recursive:true});
for (const file of await fs.readdir(path.join(target,'config'))) {
  const p=path.join(target,'config',file);
  if ((await fs.lstat(p)).isSymbolicLink()) await fs.unlink(p);
}
await fs.copyFile(path.join(root,'config/config.js'),path.join(target,'config/config.js'));
let html = await fs.readFile(path.join(web,'caches/index-new.html'),'utf8');
await fs.copyFile(path.join(web,'src/battle-log-misc.js'),path.join(target,'js/battle-log-misc.js'));
html = html.replaceAll('/src/battle-log-misc.js','/js/battle-log-misc.js');
html = html.replaceAll('https://play.pokemonshowdown.com/','/');
html = html.replace(/<title>.*?<\/title>/,'<title>Ben’s Pokémon Battles</title>');
// Keep the build source links visible, with no external navigation in the menu.
await fs.writeFile(path.join(target,'index.html'),html);
const resources = new Set([...html.matchAll(/(?:src|href)="\/(js|data|style)\/([^"?]+)(?:\?[^"\s]*)?"/g)].map(m=>m[1]+'/'+m[2]));
for (const file of ['data/pokedex.js','data/moves.js','data/items.js','data/abilities.js','data/typechart.js','data/aliases.js','data/learnsets.js','data/search-index.js','data/teambuilder-tables.js','data/pokedex-mini.js','data/pokedex-mini-bw.js','data/text/en.js','data/commands.js','js/server/chat-formatter.js']) resources.add(file);
for (const file of resources) {
  try { await fs.access(path.join(target,file)); continue; } catch {}
  const r=await fetch('https://play.pokemonshowdown.com/'+file,{signal:AbortSignal.timeout(20000)});
  if(!r.ok) throw new Error(`Cannot fetch required ${file}: ${r.status}`);
  await fs.mkdir(path.dirname(path.join(target,file)),{recursive:true});
  await fs.writeFile(path.join(target,file),Buffer.from(await r.arrayBuffer()));
}
// Stylesheets sometimes contain upstream absolute URLs; serve those assets locally.
async function localize(dir) {
  for(const e of await fs.readdir(dir,{withFileTypes:true})) {
    const file=path.join(dir,e.name);
    if(e.isDirectory()) await localize(file);
    else if(e.name.endsWith('.css')) {
      const text=await fs.readFile(file,'utf8');
      await fs.writeFile(file,text.replaceAll('https://play.pokemonshowdown.com/','/').replaceAll('//play.pokemonshowdown.com/','/'));
    }
  }
}
await localize(path.join(target,'style'));
console.log(`Staged ${target}; client and game data served locally.`);
