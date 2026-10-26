import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const cloudflareUrl='https://bens-wacky-world.pages.dev/';
const gitlabUrl='https://wacky-project-84f094.gitlab.io/';
function launcherHtml(siteUrl){return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ben's Wacky World</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%23FF4242'/%3E%3Ctext x='16' y='24' text-anchor='middle' font-family='Arial' font-weight='bold' font-size='24' fill='white'%3EW%3C/text%3E%3C/svg%3E">
<style>html,body{margin:0;width:100%;height:100%;background:#09090d;color:#eee;font:16px system-ui}iframe{display:block;width:100%;height:100%;border:0}#loading{position:fixed;inset:0;display:grid;place-items:center;background:#09090d;text-align:center;padding:24px}#loading[hidden]{display:none}h1{font-size:28px}p{color:#b8b8c4}a{color:#ff7272}button{font:inherit;background:#24242c;border:1px solid #444;color:white;padding:10px 18px;border-radius:10px;cursor:pointer}#help[hidden]{display:none}</style></head>
<body><div id="loading" role="status"><div><h1>Ben's Wacky World</h1><p id="status">Opening your world…</p><div id="help" hidden><p>Check your connection, then try again.</p><button id="retry" type="button">Retry</button><p><a href="${siteUrl}" target="_blank" rel="noopener">Open the website directly</a></p></div><noscript><p><a href="${siteUrl}">Open Ben's Wacky World</a></p></noscript></div></div>
<iframe id="world" title="Ben's Wacky World" allow="autoplay; fullscreen; gamepad; clipboard-write" allowfullscreen></iframe>
<script>
const frame=document.getElementById('world'),loading=document.getElementById('loading'),help=document.getElementById('help');
let timer;
function start(){loading.hidden=false;help.hidden=true;document.getElementById('status').textContent='Opening your world…';clearTimeout(timer);timer=setTimeout(()=>{document.getElementById('status').textContent='Taking longer than usual.';help.hidden=false;},15000);frame.src='${siteUrl}'+location.hash;}
frame.addEventListener('load',()=>{if(frame.getAttribute('src')){clearTimeout(timer);loading.hidden=true;}});
frame.addEventListener('error',()=>{clearTimeout(timer);loading.hidden=false;help.hidden=false;document.getElementById('status').textContent='Unable to load the site.';});
document.getElementById('retry').addEventListener('click',start);
start();
</script></body></html>`;}
await mkdir(path.join(root,'.portable'),{recursive:true});
const launchers=[
  ['Bens Wacky World - Cloudflare.html',cloudflareUrl],
  ['Bens Wacky World - GitLab.html',gitlabUrl],
  ['Bens Wacky World.html',cloudflareUrl],
];
for(const [filename,url] of launchers){
  const output=path.join(root,'.portable',filename);
  await writeFile(output,launcherHtml(url));
  console.log(output);
}
