(() => {
 const parentOrigin='https://civil-civix.github.io',names=new Map(),requested=new Set();let challenge='',name='',invite=null,lastAction=0,requestAt=0,authPending=false,wasNamed=false;
 const panel=document.createElement('div');panel.id='bww-profile-panel';panel.innerHTML='<h1>Pokémon Battles</h1><p id="bww-profile-state">Open this game from Ben’s Wacky World and sign in with your profile.</p><button id="bww-random" disabled>Find a random battle</button><button id="bww-cancel-search">Cancel search</button><p>6v6 · Gen 9 · Random teams</p>';document.body.append(panel);
 const state=text=>document.getElementById('bww-profile-state').textContent=text;
 const send=(type,data={})=>{if(parent!==window)parent.postMessage({type,...data},parentOrigin);};
 document.getElementById('bww-random').onclick=()=>{PS.send('/search gen9randombattle');state('Looking for another player…');};document.getElementById('bww-cancel-search').onclick=()=>{PS.send('/cancelsearch');state('Search cancelled.');};
 window.addEventListener('message',e=>{if(e.source!==parent||e.origin!==parentOrigin)return;const d=e.data;
  if(d?.type==='bww:auth'&&typeof d.token==='string'&&/^bww[a-f0-9]{32}$/.test(d.name)){authPending=false;name=d.name;names.set(name,d.displayName);invite=d.invite;PS.connection.send('|/trn '+name+',0,BWW:'+d.token);state('Connecting as '+d.displayName+'…');}
  if(d?.type==='bww:auth-error'){authPending=false;state(d.message||'Please reopen the game.');}
  if(d?.type==='bww:names'&&Array.isArray(d.players))for(const p of d.players)if(/^bww[a-f0-9]{32}$/.test(p.name)&&typeof p.displayName==='string')names.set(p.name,p.displayName);
 });
 function paintNames(){const walk=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT),missing=new Set();let node;while(node=walk.nextNode()){if(['SCRIPT','STYLE','TEXTAREA','OPTION'].includes(node.parentElement?.tagName)||!node.textContent.match(/bww[a-f0-9]{32}/i))continue;const before=node.textContent,after=before.replace(/bww[a-f0-9]{32}/gi,id=>{const key=id.toLowerCase();if(names.has(key))return names.get(key);if(!requested.has(key))missing.add(key);return id;});if(before!==after)node.textContent=after;}if(missing.size){const ids=[...missing].slice(0,20);ids.forEach(id=>requested.add(id));send('bww:names-request',{ids});}}
 setInterval(()=>{
  if(typeof PS==='undefined'||!PS.user?.challstr)return;const current=PS.user.challstr.split('|')[1];
  if(current!==challenge){challenge=current;name='';authPending=false;requestAt=0;}
  if(!PS.user.named&&!authPending&&Date.now()-requestAt>10000){requestAt=Date.now();authPending=true;send('bww:auth-request',{challenge});setTimeout(()=>{authPending=false;},12000);}
  if(PS.user.named&&!wasNamed)state('Signed in as '+(names.get(name)||'your profile')+'. Ready to battle.');wasNamed=!!PS.user.named;
  const inBattle=Object.keys(PS.rooms).some(id=>id.startsWith('battle-'));panel.hidden=inBattle;document.getElementById('bww-random').disabled=!PS.user.named;
  if(PS.user.named&&invite&&!inBattle&&invite.expires>Date.now()&&Date.now()-lastAction>4000){lastAction=Date.now();names.set(invite.peer.name,invite.peer.username);PS.send(invite.outgoing?'/challenge '+invite.peer.name+',gen9randombattle':'/accept '+invite.peer.name);state('Starting your battle with '+invite.peer.username+'…');}
  if(inBattle)invite=null;paintNames();
 },500);
})();
