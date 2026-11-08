'use strict';
(() => {
  // This pilot is for Cloudflare Portable; local hosts allow isolated QA.
  if (!['bens-wacky-world.pages.dev', 'localhost', '127.0.0.1'].includes(location.hostname)) return;
  const icon = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 14v-2a8 8 0 0 1 16 0v2M4 13H3v7h4v-7ZM20 13h1v7h-4v-7Z"/></svg>';
  const cleanText=value=>String(value||'').replace(/\p{Extended_Pictographic}|\p{Regional_Indicator}|\p{Emoji_Modifier}|[\uFE0F\u200D\u20E3]/gu,'').replace(/\s+/g,' ').trim();
  const creditText=t=>t.artist ? t.artist+(t.composer&&t.composer!==t.artist?' · Composer: '+t.composer:'') : t.composer?'Composer: '+t.composer:'Artist credit unavailable';
  const noteIcon='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M9 17V5l11-2v12M9 8l11-2"/><ellipse cx="6" cy="17" rx="3" ry="2"/><ellipse cx="17" cy="15" rx="3" ry="2"/></svg>';
  const heartIcon='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 20 4 12C-2 5 7 0 12 7c5-7 14-2 8 5Z"/></svg>';
  const key = 'wacky-music-library.v1';
  let catalogueTracks=[],communityGeneration=0;let tracks = [], byId = new Map(), active = null, queue = [], baseQueue = [], loaded = false, loading = null, limit = 80, returnFocus;
  let saved = {favorites: [], playlists: []};
  try {
    const data = JSON.parse(localStorage.getItem(key));
    if (data && Array.isArray(data.favorites) && Array.isArray(data.playlists)) {
      saved.favorites = data.favorites.filter(x => typeof x === 'string');
      saved.playlists = data.playlists.filter(p => typeof p.id === 'string' && typeof p.name === 'string' && Array.isArray(p.tracks)).map(p => ({id:p.id,name:p.name.slice(0,60),tracks:p.tracks.filter(x => typeof x === 'string'),cover:typeof p.cover==='string'?p.cover:'',shareId:/^[a-f0-9-]{36}$/.test(p.shareId||'')?p.shareId:null,shareVersion:Number.isSafeInteger(p.shareVersion)?p.shareVersion:0,shareOwnerId:p.shareOwnerId||null}));
    }
  } catch {}
  const dialog = document.createElement('dialog');
  dialog.id = 'music-library';
  dialog.setAttribute('aria-labelledby', 'music-heading');
  dialog.innerHTML = `<div class="music-shell"><aside class="music-sidebar"><div class="music-brand">${icon}<h2 id="music-heading">Music</h2></div><nav class="music-nav" aria-label="Music navigation"><button type="button" data-music-view="all" aria-current="page"><span aria-hidden="true">◫</span> Browse</button><button type="button" data-music-view="favorites"><span aria-hidden="true">${heartIcon}</span> Liked songs</button></nav><div class="music-library-label"><span>Your library</span></div><details class="music-new-playlist"><summary>+ New playlist</summary><form id="music-create"><label class="sr-only" for="music-playlist-name">New playlist name</label><input id="music-playlist-name" placeholder="Playlist name" maxlength="60" required><button type="submit">Create</button></form></details><div id="music-playlists"></div><p class="music-save-note">Saved on this browser</p></aside>
    <div class="music-main"><header class="music-header"><label class="music-search-wrap"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg><span class="sr-only">Search music</span><input id="music-search" type="search" placeholder="Search songs, artists, soundtracks" autocomplete="off"></label><button type="button" data-music-close aria-label="Close music library">×</button></header>
    <div class="music-body"><select id="music-collection" hidden aria-label="Music collection"><option value="all">All music</option><option value="favorites">Favorites</option></select><div class="music-page-heading"><span class="music-eyebrow">YOUR COLLECTION</span><h3 id="music-view-title">Browse music</h3><p id="music-view-note">A soundtrack for every game.</p></div><section id="music-discover" aria-labelledby="music-discover-heading"><div class="music-section-heading"><h4 id="music-discover-heading">Pick a collection</h4><button type="button" id="music-albums-more">Show all</button></div><div id="music-albums"></div></section><div class="music-section-heading music-songs-heading"><h4 id="music-list-title">All songs</h4><p id="music-status" role="status"></p></div><button id="music-retry" type="button" hidden>Try loading again</button><div id="music-tracks" aria-label="Songs"></div><button id="music-more" type="button" hidden>Show more songs</button></div></div></div>
    <footer class="music-listening"><div class="music-current"><div class="music-now-cover" aria-hidden="true">${icon}</div><div><strong id="music-now">Nothing playing yet</strong><span id="music-album">Choose a song to get started</span></div></div><div class="music-player-center"><div class="music-transport"><button id="music-shuffle" type="button" aria-label="Shuffle" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m18 3 3 3-3 3M3 6h3c5 0 7 12 12 12h3M18 15l3 3-3 3M3 18h3c2 0 4-3 6-6s4-6 6-6h3"/></svg></button><button id="music-prev" type="button" aria-label="Previous song" disabled><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5v14M19 5 8 12l11 7Z"/></svg></button><button id="music-play" type="button" aria-label="Play" disabled><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7Z"/></svg></button><button id="music-next" type="button" aria-label="Next song" disabled><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 5v14M5 5l11 7-11 7Z"/></svg></button><button id="music-repeat" type="button" aria-label="Repeat off" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4m14-1v2a3 3 0 0 1-3 3H3"/></svg><span id="music-repeat-one" hidden>1</span></button></div><div class="music-timeline"><span id="music-elapsed">0:00</span><input id="music-seek" type="range" min="0" max="0" step="0.1" value="0" disabled aria-label="Seek through song"><span id="music-duration">0:00</span></div><p id="music-play-status" role="status" hidden></p></div><div class="music-player-right"><div class="music-volume"><button id="music-mute" type="button" aria-label="Mute" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4 5 9H2v6h3l6 5ZM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/></svg></button><input id="music-volume" type="range" min="0" max="1" step="0.01" value="0.8" aria-label="Volume"></div><button id="music-keep" type="button">Back to site ↗</button></div></footer>`;
  document.body.append(dialog);
  const $ = selector => dialog.querySelector(selector);
  const status = $('#music-status'), collection = $('#music-collection');
  const launchers = [];
  function launcher(className, text) {
    const b = document.createElement('button'); b.type='button'; b.className=className; b.innerHTML=icon;
    b.setAttribute('aria-label','Open Music'); b.title='Music';
    if(text){const span=document.createElement('span');span.textContent=text;b.append(span);}
    b.addEventListener('click', open); launchers.push(b); return b;
  }
  document.querySelector('.nav-stream')?.after(launcher('nav-music'));
  const linksTile=document.querySelector('.launch-grid .links-tile') || [...document.querySelectorAll('.launch-grid .launch-tile')].find(el=>el.textContent.includes("Ben's Wacky Site"));
  linksTile?.replaceWith(launcher('launch-tile music-tile','Music'));
  document.querySelector('.player-actions')?.prepend(launcher('music-game-button player-icon-button'));
  const resume=launcher('music-resume','Music');resume.hidden=true;document.body.append(resume);
  function persist() {try{localStorage.setItem(key,JSON.stringify(saved));}catch{status.textContent='Your browser could not save these changes. They will last until this page closes.';}}
  let artists=[],shelves=[],shelfObservers=[];const unavailable=new Set();
  function chooseCollection(value){collection.value=value;$('#music-search').value='';limit=80;render();$('.music-body').scrollTop=0;}
  dialog.querySelectorAll('[data-music-view]').forEach(b=>b.onclick=()=>chooseCollection(b.dataset.musicView));
  function renderLibrary(){
    const list=$('#music-playlists');list.replaceChildren();
    for(const p of saved.playlists){const b=button('',p.name,()=>chooseCollection('playlist:'+p.id));b.className='music-playlist-link';const art=coverImage(p,'music-playlist-art');art.setAttribute('aria-hidden','true');const text=document.createElement('span'),name=document.createElement('strong'),count=document.createElement('small');name.textContent=cleanText(p.name);count.textContent=p.tracks.length+' songs';text.append(name,count);b.append(art,text);b.setAttribute('aria-current',String(collection.value==='playlist:'+p.id));list.append(b);}
    dialog.querySelectorAll('[data-music-view]').forEach(b=>b.setAttribute('aria-current',collection.value===b.dataset.musicView?'page':'false'));
  }
  function renderAlbums(){
    shelfObservers.forEach(o=>o.disconnect());shelfObservers=[];const discover=$('#music-discover');discover.removeAttribute('aria-labelledby');discover.setAttribute('aria-label','Browse music');discover.replaceChildren();
    const top=artists.map(a=>({...a,collection:'artist:'+a.name,tracks:a.tracks.filter(id=>!unavailable.has(id))})).filter(a=>a.tracks.length).sort((a,b)=>b.tracks.length-a.tracks.length||a.name.localeCompare(b.name)).slice(0,30);
    const rows=[{id:'top',title:'Artists with the most songs',items:top},...shelves.map(s=>({...s,items:s.items.map((a,i)=>({...a,collection:'shelf:'+s.id+':'+i,tracks:a.tracks.filter(id=>byId.has(id)&&!unavailable.has(id))})).filter(a=>a.tracks.length).slice(0,30)}))];
    for(const row of rows){
      const section=document.createElement('section');section.className='music-shelf';section.dataset.shelf=row.id;
      const header=document.createElement('div');header.className='music-section-heading';const title=document.createElement('h4');title.id='music-shelf-'+row.id;title.textContent=row.title;section.setAttribute('aria-labelledby',title.id);
      const controls=document.createElement('div');controls.className='music-shelf-controls';const rail=document.createElement('div');rail.className='music-shelf-rail';rail.tabIndex=0;rail.setAttribute('role','region');rail.setAttribute('aria-label',row.title);if(row.id==='top')rail.id='music-albums';
      const move=direction=>rail.scrollBy({left:direction*Math.max(200,rail.clientWidth*.85),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
      const prev=button('‹','Scroll '+row.title+' left',()=>move(-1)),next=button('›','Scroll '+row.title+' right',()=>move(1));controls.append(prev,next);header.append(title,controls);section.append(header,rail);discover.append(section);
      for(const artist of row.items){
        const b=button('', 'Browse '+artist.name,()=>chooseCollection(artist.collection));b.className='music-album-card music-artist-card';b.style.setProperty('--cover-hue',[...artist.name].reduce((n,c)=>n+c.codePointAt(0),0)%360);
        const art=document.createElement('span');art.className='music-cover';art.setAttribute('aria-hidden','true');
        if(typeof artist.photo==='string'&&artist.photo.startsWith('images/')&&!artist.photo.includes('..')){const img=document.createElement('img');img.src=artist.photo;img.alt='';art.append(img);}else{const initials=document.createElement('b');initials.textContent=artist.name.split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase();art.append(initials);}
        const name=document.createElement('strong');name.textContent=artist.name;const count=document.createElement('small');count.textContent=artist.tracks.length+' songs';b.append(art,name,count);rail.append(b);
      }
      const state=()=>{prev.disabled=rail.scrollLeft<=2;next.disabled=rail.scrollLeft+rail.clientWidth>=rail.scrollWidth-2;};rail.addEventListener('scroll',state,{passive:true});const observer=new ResizeObserver(state);observer.observe(rail);shelfObservers.push(observer);requestAnimationFrame(state);
      rail.addEventListener('keydown',e=>{if(e.target!==rail)return;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();move(e.key==='ArrowLeft'?-1:1);}});
    }
  }

  function collectionOptions() {
    const selected=collection.value;
    collection.replaceChildren(new Option('All music','all'),new Option('Favorites','favorites'));
    const playlists=document.createElement('optgroup');playlists.label='Your playlists';
    for(const p of saved.playlists)playlists.append(new Option(cleanText(p.name),'playlist:'+p.id));
    if(playlists.children.length)collection.append(playlists);
    for(const a of artists)collection.append(new Option(a.name,'artist:'+a.name));
    for(const shelf of shelves)for(const [i,item] of shelf.items.entries())collection.append(new Option(item.name,'shelf:'+shelf.id+':'+i));
    if(sharedPlaylist)collection.append(new Option(sharedPlaylist.name,'shared'));
    const albums=document.createElement('optgroup');albums.label='Artists & soundtracks';
    for(const name of [...new Set(tracks.map(t=>t.album))].sort())albums.append(new Option(name,'album:'+name));
    collection.append(albums);
    collection.value=[...collection.options].some(o=>o.value===selected)?selected:'all';
  }
  async function load() {
    if(loaded)return;
    if(loading)return loading;
    status.textContent='Loading your music…';$('#music-retry').hidden=true;
    loading=(async()=>{try{
      const response=await fetch('music-library.json?v=20261107-shelves',{signal:AbortSignal.timeout(20000)});
      if(!response.ok)throw Error();
      const data=await response.json();
      if(!Array.isArray(data.tracks))throw Error();
      tracks=data.tracks.filter(t=>/^[A-Za-z0-9_-]+$/.test(t.id)&&typeof t.title==='string'&&typeof t.album==='string').map(t=>({...t,title:cleanText(t.title),album:cleanText(t.album),artist:cleanText(t.artist),composer:cleanText(t.composer)}));
      artists=Array.isArray(data.artists)?data.artists:[];shelves=Array.isArray(data.shelves)?data.shelves:[];byId=new Map(tracks.map(t=>[t.id,t]));saved.favorites=saved.favorites.filter(id=>byId.has(id));for(const p of saved.playlists)p.tracks=p.tracks.filter(id=>byId.has(id));catalogueTracks=tracks.slice();loaded=true;collectionOptions();renderAlbums();render();await refreshCommunity();
    }catch{status.textContent='Music could not load. Check your connection and try again.';$('#music-retry').hidden=false;}finally{loading=null;}})();
    return loading;
  }
  function open() {if(dialog.open)return;returnFocus=document.activeElement;dialog.showModal();void load();}
  function close(){dialog.close();returnFocus?.focus({preventScroll:true});}
  function matching() {
    const query=$('#music-search').value.trim().toLocaleLowerCase(),value=collection.value;
    const playlist=value==='shared'?sharedPlaylist:value.startsWith('playlist:')?saved.playlists.find(p=>p.id===value.slice(9)):null;
    const artist=value.startsWith('artist:')?artists.find(a=>a.name===value.slice(7)):value.startsWith('shelf:')?shelves.find(s=>s.id===value.split(':')[1])?.items[Number(value.split(':')[2])]:null;
    return tracks.filter(t=>!unavailable.has(t.id)&&(!query||(t.title+' '+t.album+' '+(t.artist||'')+' '+(t.composer||'')).toLocaleLowerCase().includes(query)) && (artist?artist.tracks.includes(t.id):value==='community'?t.community:value==='favorites'?saved.favorites.includes(t.id):value.startsWith('album:')?t.album===value.slice(6):playlist?playlist.tracks.includes(t.id):true));
  }
  function button(text,label,handler){const b=document.createElement('button');b.type='button';b.textContent=text;b.setAttribute('aria-label',label);b.title=label;b.onclick=handler;return b;}
  function render(){
    if(!loaded)return;
    const list=matching(),fragment=document.createDocumentFragment();
    renderLibrary();renderPlaylistTools();
    const query=$('#music-search').value.trim(),selected=collection.selectedOptions[0]?.textContent||'Browse music';
    $('#music-discover').hidden=collection.value!=='all'||Boolean(query);
    $('#music-view-title').textContent=query?'Search results':collection.value==='all'?'Browse music':collection.value==='favorites'?'Liked songs':selected;
    $('#music-view-note').textContent=query?'Songs matching “'+query+'”':collection.value==='all'?'Artists, soundtracks, and everything in between.':'Your music, ready when you are.';
    $('#music-list-title').textContent=query?'Songs':collection.value==='all'?'All songs':'Track list';
    status.textContent=list.length?`${list.length.toLocaleString()} songs${list.length>limit?' · showing '+Math.min(limit,list.length):''}`:'No songs here yet.';
    for(const t of list.slice(0,limit)){
      const row=document.createElement('div');row.className='music-track';row.dataset.active=String(active?.id===t.id);
      const play=button('', 'Listen to '+t.title,()=>{baseQueue=list.map(x=>x.id);setQueue(t.id);select(t.id);});play.className='music-track-play';
      const symbol=document.createElement('span');symbol.className='music-track-symbol';symbol.innerHTML=active?.id===t.id?noteIcon:'<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m8 5 11 7-11 7Z"/></svg>';symbol.setAttribute('aria-hidden','true');
      const copy=document.createElement('span'),title=document.createElement('strong'),album=document.createElement('small');title.textContent=t.title;album.textContent=creditText(t);album.title=creditText(t);copy.append(title,album);play.append(symbol,copy);
      const favorite=button('','Favorite '+t.title,()=>{saved.favorites=saved.favorites.includes(t.id)?saved.favorites.filter(id=>id!==t.id):[...saved.favorites,t.id];render();persist();});favorite.setAttribute('aria-pressed',String(saved.favorites.includes(t.id)));favorite.className='music-favorite';favorite.innerHTML=heartIcon;row.append(play,favorite);
      if(collection.value.startsWith('playlist:')){
        row.append(button('−','Remove '+t.title+' from playlist',()=>{const p=saved.playlists.find(p=>p.id===collection.value.slice(9));p.tracks=p.tracks.filter(id=>id!==t.id);playlistChanged(p);}));
      }
      const add=button('+ Playlist','Add '+t.title+' to a playlist',()=>choosePlaylistFor(t,add));add.className='music-add-trigger';add.setAttribute('aria-haspopup','dialog');row.append(add);
      const report=button('','Report '+t.title,()=>window.WackyMusicCommunity?.report(t));report.className='music-report-song';report.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M5 21V3m0 1c5-4 9 4 14 0v10c-5 4-9-4-14 0"/></svg>';row.append(report);
      fragment.append(row);
    }
    $('#music-tracks').replaceChildren(fragment);$('#music-more').hidden=list.length<=limit;
  }
  const previewMode=['localhost','127.0.0.1'].includes(location.hostname);
  let previewOwner;try{previewOwner=localStorage.getItem('wacky-music-preview-user')||crypto.randomUUID();localStorage.setItem('wacky-music-preview-user',previewOwner);}catch{previewOwner=crypto.randomUUID();}
  const ownerId=()=>previewMode?previewOwner:window.WackyAccount?.user?.id;
  const validCover=value=>typeof value==='string'&&value.length<=50000&&/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value);
  const sharingQueue=new Map();let sharedPlaylist=null,shareLoad=0;
  async function playlistAPI(path,{method='GET',data}={}){
    if(!previewMode)return window.WackyAccount.api(path,{method,data});
    const r=await fetch(path,{method,headers:{'Content-Type':'application/json','X-Preview-Owner':previewOwner},...(data?{body:JSON.stringify(data)}:{})});const result=await r.json();if(!r.ok)throw Object.assign(new Error(result.error||'Playlist unavailable.'),{status:r.status});return result;
  }
  function playlistLink(p){return (previewMode?location.origin:'https://bens-wacky-world.pages.dev')+'/#music-playlist='+p.shareId;}
  const selectedPlaylist=()=>collection.value==='shared'?sharedPlaylist:saved.playlists.find(p=>'playlist:'+p.id===collection.value);
  function payload(p){return {name:p.name,tracks:p.tracks,cover:p.cover||'',clientId:p.id,version:p.shareVersion};}
  function syncPlaylist(p){
    if(!p.shareId||p.deleted)return Promise.resolve(true);
    const pending=(sharingQueue.get(p.id)||Promise.resolve()).catch(()=>{}).then(async()=>{if(p.deleted)return true;
      try{p.syncError='';p.syncing=true;renderPlaylistTools();const r=await playlistAPI('/music/playlists/'+p.shareId,{method:'PATCH',data:payload(p)});p.shareVersion=r.version;p.syncing=false;persist();renderPlaylistTools();return true;}
      catch(error){p.syncing=false;p.syncError=error.message;persist();renderPlaylistTools();return false;}
    });sharingQueue.set(p.id,pending);return pending;
  }
  function playlistChanged(p){persist();render();void syncPlaylist(p);}
  const toolsBar=document.createElement('div');toolsBar.id='music-playlist-tools';toolsBar.hidden=true;$('.music-page-heading').after(toolsBar);
  const photoInput=document.createElement('input');photoInput.type='file';photoInput.accept='image/jpeg,image/png,image/webp';photoInput.hidden=true;photoInput.id='music-playlist-photo';dialog.append(photoInput);
  let photoPlaylist=null;
  photoInput.onchange=async()=>{
    const p=photoPlaylist,file=photoInput.files[0];photoInput.value='';if(!file||!p)return;
    try{if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>8*1024*1024)throw Error('Choose a JPG, PNG or WebP under 8 MB.');const image=await createImageBitmap(file);const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d');ctx.fillStyle='#15151b';ctx.fillRect(0,0,256,256);const side=Math.min(image.width,image.height);ctx.drawImage(image,(image.width-side)/2,(image.height-side)/2,side,side,0,0,256,256);image.close();let cover='';for(const quality of [.85,.65,.45,.25]){cover=canvas.toDataURL('image/jpeg',quality);if(cover.length<=50000)break;}if(!validCover(cover))throw Error('This photo is too detailed. Try a smaller image.');p.cover=cover;playlistChanged(p);}catch(e){status.textContent=e.message;}
  };
  function coverImage(p,className){const span=document.createElement('span');span.className=className;if(validCover(p.cover)){const img=document.createElement('img');img.src=p.cover;img.alt='';span.append(img);}else span.innerHTML=noteIcon;return span;}
  async function sharePlaylist(p,sendToChat){
    if(!ownerId()){status.textContent='Sign in to share a playlist.';window.WackyAccount?.open();return;}
    if(!p.tracks.length){status.textContent='Add a song before sharing this playlist.';return;}
    try{
      if(p.shareId){if(!await syncPlaylist(p))return;}else{const r=await playlistAPI('/music/playlists',{method:'POST',data:payload(p)});p.shareId=r.id;p.shareVersion=r.version;p.shareOwnerId=r.ownerId;persist();}
      renderPlaylistTools();const url=playlistLink(p);
      if(sendToChat&&!previewMode){close();window.WackyMessages?.draftPlaylist({name:p.name,url});}
      else {try{await navigator.clipboard.writeText(url);status.textContent=previewMode?'Preview link copied — works on this computer only.':'Playlist link copied.';}catch{status.textContent='Copy the playlist link below.';}}
    }catch(e){status.textContent=e.message;}
  }
  const editDialog=document.createElement('dialog');editDialog.id='music-edit-playlist';editDialog.setAttribute('aria-labelledby','music-edit-title');
  editDialog.innerHTML='<form><h3 id="music-edit-title"></h3><label for="music-edit-name">Playlist name</label><input id="music-edit-name" maxlength="60" required autocomplete="off"><p id="music-edit-note"></p><p id="music-edit-error" role="alert"></p><div><button type="button" id="music-edit-cancel">Cancel</button><button type="submit" id="music-edit-confirm">Save</button></div></form>';document.body.append(editDialog);
  let editingPlaylist=null,editingMode='',editBusy=false;
  function editPlaylist(p,mode){editingPlaylist=p;editingMode=mode;const deleting=mode==='delete';editDialog.querySelector('h3').textContent=deleting?'Delete playlist?':'Rename playlist';const input=editDialog.querySelector('input');input.value=p.name;input.hidden=deleting;input.required=!deleting;editDialog.querySelector('label').hidden=deleting;editDialog.querySelector('#music-edit-note').textContent=deleting?(p.shareId?'This deletes “'+p.name+'” and its shared link. Copies saved by other listeners stay in their libraries.':'Delete “'+p.name+'” from your library? The songs stay available in Music.'):(p.shareId?'The name will update on your shared playlist too.':'');editDialog.querySelector('#music-edit-error').textContent='';editDialog.querySelector('#music-edit-confirm').textContent=deleting?'Delete playlist':'Save name';editDialog.showModal();if(!deleting){input.focus();input.select();}}
  editDialog.querySelector('#music-edit-cancel').onclick=()=>editDialog.close();editDialog.addEventListener('cancel',e=>{if(editBusy)e.preventDefault();});
  editDialog.querySelector('form').onsubmit=async e=>{
    e.preventDefault();if(editBusy||!editingPlaylist)return;const p=editingPlaylist,name=cleanText(editDialog.querySelector('input').value);if(editingMode==='rename'&&!name){editDialog.querySelector('#music-edit-error').textContent='Enter a playlist name.';return;}
    editBusy=true;editDialog.querySelectorAll('button,input').forEach(b=>b.disabled=true);
    try{
      await sharingQueue.get(p.id);
      if(editingMode==='delete'){
        if(p.shareId)await playlistAPI('/music/playlists/'+p.shareId,{method:'DELETE'});
        p.deleted=true;saved.playlists=saved.playlists.filter(x=>x!==p);sharingQueue.delete(p.id);persist();collectionOptions();chooseCollection('all');status.textContent='Playlist deleted.';
      }else{
        if(p.shareId){const r=await playlistAPI('/music/playlists/'+p.shareId,{method:'PATCH',data:{...payload(p),name}});p.shareVersion=r.version;}
        p.name=name;p.syncError='';persist();collectionOptions();render();
      }
      editDialog.close();
    }catch(error){editDialog.querySelector('#music-edit-error').textContent=error.message;}
    finally{editBusy=false;editDialog.querySelectorAll('button,input').forEach(b=>b.disabled=false);}
  };

  function renderPlaylistTools(){
    const p=selectedPlaylist();toolsBar.replaceChildren();toolsBar.hidden=!p;if(!p)return;
    const remote=collection.value==='shared';const picture=coverImage(p,'music-playlist-cover');
    if(!remote){const change=button('','Change playlist photo',()=>{photoPlaylist=p;photoInput.click();});change.className='music-change-photo';change.append(picture);const label=document.createElement('span');label.textContent='Change photo';change.append(label);toolsBar.append(change);}else toolsBar.append(picture);
    const actions=document.createElement('div');actions.className='music-playlist-actions';
    if(!remote){actions.append(button('Rename','Rename playlist',()=>editPlaylist(p,'rename')),button('Delete','Delete playlist',()=>editPlaylist(p,'delete')));actions.append(button(previewMode?'Create preview link':'Share in chat',previewMode?'Share playlist preview':'Share playlist in chat',()=>void sharePlaylist(p,true)));if(p.cover)actions.append(button('Remove photo','Remove playlist photo',()=>{p.cover='';playlistChanged(p);}));}
    else{const by=document.createElement('p');by.textContent='Shared by '+p.by;actions.append(by,button('Save a copy','Save your own copy of this playlist',()=>{const copy={id:crypto.randomUUID(),name:p.name,tracks:p.tracks.slice(),cover:p.cover||''};saved.playlists.push(copy);persist();collectionOptions();chooseCollection('playlist:'+copy.id);}));}
    const note=document.createElement('small');note.textContent=remote?'This playlist updates when its creator makes changes.':p.syncError?'Not synced: '+p.syncError:p.syncing?'Saving changes…':p.shareId?'Shared · changes sync automatically':'Share a link so others can listen.';note.setAttribute('role','status');actions.append(note);
    if(p.shareId){const link=document.createElement('input');link.readOnly=true;link.value=playlistLink(p);link.setAttribute('aria-label','Shared playlist link');link.onclick=()=>link.select();actions.append(link);if(!remote)actions.append(button('Copy link','Copy playlist link',()=>void sharePlaylist(p,false)));}
    toolsBar.append(actions);
  }
  const addDialog=document.createElement('dialog');addDialog.id='music-add-dialog';addDialog.setAttribute('aria-labelledby','music-add-heading');addDialog.innerHTML='<header><h3 id="music-add-heading">Add to playlist</h3><button type="button" aria-label="Close playlist chooser">×</button></header><p id="music-add-song"></p><div id="music-add-options"></div><button type="button" id="music-add-create">+ New playlist</button>';document.body.append(addDialog);
  addDialog.querySelector('header button').onclick=()=>addDialog.close();addDialog.querySelector('#music-add-create').onclick=()=>{addDialog.close();$('.music-new-playlist').open=true;$('#music-playlist-name').focus();};
  function choosePlaylistFor(t,trigger){
    addDialog.querySelector('#music-add-song').textContent=t.title;const list=addDialog.querySelector('#music-add-options');list.replaceChildren();
    for(const p of saved.playlists){const already=p.tracks.includes(t.id);const b=button('', 'Add to '+p.name,()=>{if(p.tracks.length>=200){status.textContent='Playlists can hold up to 200 songs.';addDialog.close();return;}p.tracks.push(t.id);addDialog.close();playlistChanged(p);status.textContent='Added to '+p.name;});b.disabled=already;b.append(coverImage(p,'music-menu-cover'));const text=document.createElement('span'),title=document.createElement('strong'),count=document.createElement('small');title.textContent=cleanText(p.name);count.textContent=already?'Already added':p.tracks.length+' songs';text.append(title,count);b.append(text);list.append(b);}
    if(!saved.playlists.length){const empty=document.createElement('p');empty.textContent='Create your first playlist below.';list.append(empty);}
    addDialog.showModal();const rect=trigger.getBoundingClientRect(),width=Math.min(330,innerWidth-24);addDialog.style.width=width+'px';addDialog.style.left=Math.max(12,Math.min(rect.right-width,innerWidth-width-12))+'px';addDialog.style.top=Math.max(12,Math.min(rect.bottom+8,innerHeight-addDialog.offsetHeight-12))+'px';
  }
  async function openShared(id){
    if(!/^[a-f0-9-]{36}$/.test(id))return;const token=++shareLoad;open();await load();if(!loaded)return;status.textContent='Opening shared playlist…';
    try{const r=await playlistAPI('/music/playlists/'+id);if(token!==shareLoad)return;
      const value={id:crypto.randomUUID(),shareId:r.id,shareVersion:r.version,shareOwnerId:r.ownerId,name:cleanText(r.name),tracks:r.tracks.filter(id=>byId.has(id)),cover:validCover(r.cover)?r.cover:'',by:cleanText(r.by)};
      if(r.ownerId===ownerId()){let own=saved.playlists.find(p=>p.shareId===id);if(own){Object.assign(own,value,{id:own.id});}else{own=value;saved.playlists.push(own);}persist();collectionOptions();chooseCollection('playlist:'+own.id);}
      else{sharedPlaylist=value;collectionOptions();chooseCollection('shared');}
    }catch(e){status.textContent=e.message;}
  }
  async function refreshCommunity(){const token=++communityGeneration;try{const data=await playlistAPI('/music/community');if(token!==communityGeneration)return;const blocked=new Set(data.blocked||[]);tracks=[...catalogueTracks,...data.songs.map(t=>({...t,title:cleanText(t.title),artist:cleanText(t.artist)}))].filter(t=>!blocked.has(t.id));byId=new Map(tracks.map(t=>[t.id,t]));if(active&&blocked.has(active.id)){audio.pause();announce('This song was removed from the library.');}collectionOptions();renderAlbums();render();}catch{}}
  setInterval(()=>{if(loaded&&dialog.open&&!document.hidden)void refreshCommunity();},60000);
  window.WackyMusic={openShared,refreshCommunity,chooseCollection};
  function shareRoute(){const m=/^#music-playlist=([a-f0-9-]{36})$/.exec(location.hash);if(m)void openShared(m[1]);}
  window.addEventListener('hashchange',shareRoute);setTimeout(shareRoute,0);
  setInterval(()=>{if(dialog.open&&!document.hidden&&collection.value==='shared'&&sharedPlaylist)void refreshShared();},30000);
  async function refreshShared(){const target=sharedPlaylist;if(!target)return;try{const r=await playlistAPI('/music/playlists/'+target.shareId);if(sharedPlaylist!==target||r.id!==target.shareId||r.version===target.shareVersion)return;Object.assign(sharedPlaylist,{name:cleanText(r.name),tracks:r.tracks.filter(id=>byId.has(id)),cover:validCover(r.cover)?r.cover:'',shareVersion:r.version});collectionOptions();render();}catch(error){if(error.status===404&&sharedPlaylist===target){sharedPlaylist=null;collectionOptions();chooseCollection('all');status.textContent='This shared playlist was deleted.';}else status.textContent='Shared playlist could not refresh. Reopen its link to try again.';}}

  const audio=document.createElement('audio');audio.id='music-audio';audio.preload='metadata';audio.crossOrigin='anonymous';audio.volume=.8;document.body.append(audio);
  let shuffled=false,repeatMode=0,playAttempt=0,buffering=false;
  const playerStatus=$('#music-play-status'),seek=$('#music-seek');
  const playIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7Z"/></svg>';
  const pauseIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h4v14H6ZM14 5h4v14h-4Z"/></svg>';
  function formatTime(value){if(!Number.isFinite(value)||value<0)return '0:00';return Math.floor(value/60)+':'+String(Math.floor(value%60)).padStart(2,'0');}
  function announce(message=''){playerStatus.textContent=message;playerStatus.hidden=!message;}
  function setQueue(firstId){
    queue=baseQueue.slice();
    if(shuffled){queue=queue.filter(id=>id!==firstId);for(let i=queue.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[queue[i],queue[j]]=[queue[j],queue[i]];}if(firstId)queue.unshift(firstId);}
  }
  function paintPlayback(){
    const playing=!audio.paused&&!audio.ended;
    document.body.classList.toggle('music-is-playing',playing&&audio.readyState>=3&&!buffering);
    $('#music-play').innerHTML=playing?pauseIcon:playIcon;$('#music-play').setAttribute('aria-label',playing?'Pause':'Play');
    $('#music-play').disabled=!active||unavailable.has(active.id);$('#music-prev').disabled=!active||(!queue.length&&unavailable.has(active.id));$('#music-next').disabled=queue.length<(active&&unavailable.has(active.id)?1:2);
    const duration=Number.isFinite(audio.duration)?audio.duration:0;
    seek.disabled=!duration;seek.max=duration;seek.value=audio.currentTime||0;seek.style.setProperty('--progress',(duration?audio.currentTime/duration*100:0)+'%');
    seek.setAttribute('aria-valuetext',formatTime(audio.currentTime)+' of '+formatTime(duration));
    $('#music-elapsed').textContent=formatTime(audio.currentTime);$('#music-duration').textContent=formatTime(duration);
  }
  async function play(){
    if(!active)return;const attempt=++playAttempt;
    if(audio.error)audio.load();
    try{await audio.play();if(attempt===playAttempt)announce();}
    catch(error){if(attempt!==playAttempt||error.name==='AbortError'||audio.error)return;announce(error.name==='NotAllowedError'?'Press Play to start listening.':'This song could not play. Try Play again or choose another song.');}
    paintPlayback();
  }
  const audioEndpoint=(song=active)=>(previewMode?'':'https://bens-wacky-accounts.mr-ellis1009.workers.dev')+(song?.community?'/music/community/audio':'/music/audio');
  let errorCheck=0;
  async function explainAudioError(){
    const song=active,code=audio.error?.code,token=++errorCheck;if(!song)return;
    buffering=true;paintPlayback();announce('Checking why this song could not play…');
    let message='This song could not load. Check your connection or try another song.',hide=false;
    try{
      const response=await fetch(audioEndpoint()+'?id='+encodeURIComponent(song.id),{headers:{Range:'bytes=0-'},signal:AbortSignal.timeout(10000)});
      if((response.headers.get('Content-Type')||'').includes('application/json')){
        const failure=await response.json();message=failure.error||message;
        hide=['SOURCE_QUOTA','SOURCE_MISSING','SOURCE_ACCESS','SOURCE_PAGE','SOURCE_FORMAT','UNKNOWN_SONG'].includes(failure.code);
      }else{await response.body?.cancel();if(code===3||code===4){hide=true;message='This browser could not play this audio file.';}}
    }catch{}
    if(token!==errorCheck||active!==song)return;
    if(hide){unavailable.add(song.id);baseQueue=baseQueue.filter(id=>id!==song.id);queue=queue.filter(id=>id!==song.id);renderAlbums();render();message+=' Hidden from this visit’s library.';}
    announce(message);paintPlayback();
  }

  function select(id){
    const t=byId.get(id);if(!t||unavailable.has(id))return;++errorCheck;
    playAttempt++;active=t;
    const endpoint=audioEndpoint(t);
    audio.src=endpoint+'?id='+encodeURIComponent(t.id);audio.loop=repeatMode===2;
    $('#music-now').textContent=t.title;$('#music-album').textContent=creditText(t);$('#music-album').title=creditText(t);$('#music-keep').textContent='Keep listening';
    resume.hidden=false;resume.querySelector('span').textContent=t.title;announce('Loading…');paintPlayback();render();void play();
  }
  function next(offset,automatic=false){
    if(!active||!queue.length)return;
    if(offset<0&&audio.currentTime>3){audio.currentTime=0;paintPlayback();return;}
    const i=queue.indexOf(active.id),target=i+offset;
    if(automatic&&target>=queue.length&&repeatMode===0){paintPlayback();return;}
    select(queue[(target+queue.length)%queue.length]);
  }
  $('#music-play').onclick=()=>{if(audio.paused){void play();}else{playAttempt++;audio.pause();announce();paintPlayback();}};
  $('#music-prev').onclick=()=>next(-1);$('#music-next').onclick=()=>next(1);
  $('#music-shuffle').onclick=()=>{shuffled=!shuffled;$('#music-shuffle').setAttribute('aria-pressed',String(shuffled));setQueue(active?.id);};
  $('#music-repeat').onclick=()=>{repeatMode=(repeatMode+1)%3;audio.loop=repeatMode===2;$('#music-repeat').setAttribute('aria-pressed',String(repeatMode>0));$('#music-repeat').setAttribute('aria-label',['Repeat off','Repeat all','Repeat one'][repeatMode]);$('#music-repeat-one').hidden=repeatMode!==2;};
  seek.oninput=()=>{if(Number.isFinite(audio.duration)){audio.currentTime=Math.min(audio.duration,Number(seek.value));paintPlayback();}};
  function paintVolume(){const muted=audio.muted||audio.volume===0;$('#music-mute').setAttribute('aria-pressed',String(muted));$('#music-mute').setAttribute('aria-label',muted?'Unmute':'Mute');$('#music-volume').value=audio.muted?0:audio.volume;$('#music-volume').style.setProperty('--progress',Number($('#music-volume').value)*100+'%');}
  $('#music-volume').oninput=()=>{audio.volume=Number($('#music-volume').value);audio.muted=false;paintVolume();};$('#music-mute').onclick=()=>{audio.muted=!audio.muted;if(!audio.muted&&audio.volume===0)audio.volume=.8;paintVolume();};
  for(const event of ['timeupdate','durationchange','loadedmetadata','play','pause','ended','emptied'])audio.addEventListener(event,paintPlayback);
  audio.addEventListener('playing',()=>{buffering=false;announce();paintPlayback();});audio.addEventListener('waiting',()=>{buffering=true;paintPlayback();if(!audio.paused)announce('Buffering…');});audio.addEventListener('error',()=>void explainAudioError());audio.addEventListener('ended',()=>next(1,true));
  paintVolume();paintPlayback();
  $('[data-music-close]').onclick=close;$('#music-keep').onclick=close;
  $('#music-search').oninput=()=>{limit=80;render();};collection.onchange=()=>{limit=80;render();};
  $('#music-more').onclick=()=>{limit+=80;render();};$('#music-retry').onclick=()=>void load();
  $('#music-create').onsubmit=e=>{e.preventDefault();const name=cleanText($('#music-playlist-name').value);if(!name)return;const p={id:crypto.randomUUID(),name,tracks:[]};saved.playlists.push(p);$('#music-playlist-name').value='';collectionOptions();render();$('.music-new-playlist').open=false;status.textContent='Created '+name+'. Add songs using + Playlist.';persist();};
})();
