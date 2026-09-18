const fs=require('node:fs'),path=require('node:path');
const root=__dirname,file=n=>path.join(root,n);
let results=JSON.parse(fs.readFileSync(file('game-audit-results.json')));
const final=process.argv.includes('--finalize');
const approved=fs.existsSync(file('reviewed-failures.json'))?JSON.parse(fs.readFileSync(file('reviewed-failures.json'))):[];
if(final) {
 if(results.length!==405)throw new Error('Audit must cover all 405 original entries before finalizing');
 for(const id of approved)if(!results.some(r=>r.id===id && r.status==='confirmed-failed'))throw new Error('Removal lacks repeat-failure evidence: '+id);
 results=results.map(r=>r.status==='confirmed-failed'&&!approved.includes(r.id)?{...r,status:'uncertain',reviewNote:'Kept for manual review after assessing the evidence.'}:r);
 fs.writeFileSync(file('game-audit-results.json'),JSON.stringify(results,null,2));
 const backup=file('.audit-backups/catalog-before-removals.json');
 const catalog=JSON.parse(fs.readFileSync(fs.existsSync(backup)?backup:file('games.json')));
 if(!fs.existsSync(backup))fs.writeFileSync(backup,JSON.stringify(catalog,null,2));
 const removed=catalog.filter(g=>approved.includes(g.id)),kept=catalog.filter(g=>!approved.includes(g.id));
 fs.writeFileSync(file('disabled-games.json'),JSON.stringify(removed,null,2));
 fs.writeFileSync(file('games.json'),JSON.stringify(kept,null,2));
 fs.writeFileSync(file('games.js'),'window.WACKY_GAMES = '+JSON.stringify(kept)+';\n');
}
function reason(r) {
 if(r.status==='confirmed-failed')return 'Failed on two attempts with missing required game assets. Hidden from the catalog; files kept.';
 if(r.reviewNote)return r.reviewNote;
 if(r.status==='appears-loaded')return 'Rendered game content or loaded Flash-game metadata was detected. Not a full play-through.';
 if(r.budgets?.length)return r.budgets.join('; ')+'. Kept for you to check manually.';
 if(r.auditError)return 'The automated check could not finish. Kept for manual review.';
 if(r.bad?.some(x=>[404,410].includes(x.status)))return 'A resource was missing, but there was not enough evidence to call the whole game broken.';
 if(r.bad?.some(x=>[401,403,429].includes(x.status)))return 'An outside server refused or limited a request. It may behave differently in your browser.';
 const text=r.frames?.map(f=>f.text).join(' ')||'';
 if(/loading|downloading|extracting|initializing|preparing|checking files/i.test(text))return 'Still loading at the audit cutoff. Large games may need much longer.';
 if(r.errors?.length)return 'A browser error was observed, but failure was not confirmed. Please check manually.';
 return 'No conclusive playable screen was detected in the short check. May require a click or more time.';
}
const data=results.map(r=>({id:r.id,title:r.title,url:r.url,status:r.status,reason:reason(r)})).sort((a,b)=>a.title.localeCompare(b.title));
fs.writeFileSync(file('audit-review-data.js'),'window.GAME_AUDIT = '+JSON.stringify(data)+';\n');
const counts=results.reduce((a,r)=>(a[r.status]=(a[r.status]||0)+1,a),{});
const lines=['# Game audit','',final?'Completed audit of all 405 original games.':'Audit in progress: '+results.length+' of 405 checked.','',
'| Result | Count |','|---|---:|',...Object.entries(counts).map(([k,v])=>'| '+k+' | '+v+' |'),'',
'Open game-audit-review.html through Start Local.cmd to review uncertain games. Its working/broken marks are saved in this browser and never delete files.','',
'Checks used a real desktop browser and the same game-frame permissions as the site. Each game received a short loading check, and Flash click-to-start screens were clicked. Suspected missing-file failures were retried. Large downloads and timeouts stayed uncertain. Appears-loaded means visible game content or emulator metadata, not a verified full play-through.','',
'Ad cleanup removes known embedded ad scripts, AdSense slots, and injected ad sidebars; replaces modified Flash loaders with the local emulator; and blocks known ad hosts and popup windows in local game documents. Ads inside cross-origin remote game frames cannot be guaranteed removable from this repository. Credits and ordinary game content are retained.','',
'Original HTML backups and local screenshots are in .audit-backups/ and .audit-evidence/ (ignored by Git). Removed catalog entries are listed in disabled-games.json; their game files were not deleted.','',
'## Hidden after repeated failure','',...data.filter(r=>r.status==='confirmed-failed').map(r=>'- '+r.title+': '+r.reason),'',
'## Uncertain: please review','',...data.filter(r=>r.status==='uncertain').map(r=>'- **'+r.title+'** — '+r.reason),'',
'## Appears loaded: kept','',...data.filter(r=>r.status==='appears-loaded').map(r=>'- '+r.title),''];
fs.writeFileSync(file('GAME-AUDIT.md'),lines.join('\n'));
console.log(JSON.stringify({final,checked:results.length,counts,hidden:final?approved:[]}));

