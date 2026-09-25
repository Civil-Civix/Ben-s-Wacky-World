'use strict';
const games = window.WACKY_GAMES || [];
const apps = window.WACKY_APPS || [];
const appById = new Map(apps.map(app=>[app.id,app]));
const isAppsView=()=>['apps','app-favorites','app-recents'].includes(view);
const byId = new Map(games.map(game => [game.id, game]));
const grid = document.querySelector('#game-grid');
const search = document.querySelector('#search');
const player = document.querySelector('#player');
const stage = document.querySelector('#game-stage');
const status = document.querySelector('#player-status');
const fullscreen = document.querySelector('#fullscreen');
const favoriteButton = document.querySelector('#favorite');
const hidePlayerBar = document.querySelector('#hide-player-bar');
const showPlayerBar = document.querySelector('#show-player-bar');
function setPlayerBarHidden(hidden, moveFocus=false) {
  document.querySelector('#player-toolbar').hidden=hidden;
  showPlayerBar.hidden=!hidden;
  hidePlayerBar.setAttribute('aria-expanded',String(!hidden));
  showPlayerBar.setAttribute('aria-expanded',String(!hidden));
  if(moveFocus)(hidden?showPlayerBar:hidePlayerBar).focus({preventScroll:true});
}
hidePlayerBar.addEventListener('click',()=>setPlayerBarHidden(true,true));
showPlayerBar.addEventListener('click',()=>setPlayerBarHidden(false,true));
const storageNotice = document.querySelector('#storage-notice');
const keys = {favorites:'bens-wacky-world.favorites.v1', recents:'bens-wacky-world.recents.v1',appFavorites:'bens-wacky-world.app-favorites.v1',appRecents:'bens-wacky-world.app-recents.v1'};
let currentGame = null, lastId = null, loadTimer, savedScroll = 0;
let imageMap = {};
let view = 'home';
let lastLaunch=null;
let gameSort='popular';try{const saved=localStorage.getItem('bens-wacky-world.game-sort');gameSort=['az','popular'].includes(saved)?saved:'popular';}catch(_){}
document.querySelector('#game-sort').value=gameSort;

function storageWarning() {
  storageNotice.hidden = false;
  document.querySelector('#player-storage-notice').hidden = false;
}
function readList(key) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return [];
    const value = JSON.parse(raw);
    if (!Array.isArray(value)) throw new Error('Invalid saved list');
    return [...new Set(value.filter(id => typeof id === 'string' && (key===keys.appFavorites||key===keys.appRecents?appById:byId).has(id)))];
  } catch (_) { storageWarning(); return []; }
}
let favorites = new Set(readList(keys.favorites));
let recents = readList(keys.recents);
let appFavorites=new Set(readList(keys.appFavorites)),appRecents=readList(keys.appRecents);
function saveList(key, list) {
  try { localStorage.setItem(key, JSON.stringify(list)); }
  catch (_) { storageWarning(); }
}
function normalize(text) {
  return text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

let randomArtTimer;
const randomMotion=matchMedia('(prefers-reduced-motion: reduce)');
function makeRandomCard(){
 const card=document.createElement('button');
 card.type='button';card.className='game-card random-card';card.setAttribute('aria-label','Play a random game');
 const img=document.createElement('img');img.alt='';img.decoding='async';
 const label=document.createElement('span');label.textContent='Random game';
 card.append(img,label);
 const art=games.map(g=>imageMap[g.id]).filter(p=>typeof p==='string'&&p.startsWith('images/')&&!p.includes('..'));
 let previous=-1;
 function changeArt(){
  if(!art.length)return;
  let n=Math.floor(Math.random()*art.length);
  if(art.length>1&&n===previous)n=(n+1)%art.length;
  previous=n;img.src=art[n];card.classList.add('has-artwork');
 }
 img.addEventListener('error',()=>{card.classList.remove('has-artwork');img.hidden=true;});
 img.addEventListener('load',()=>{img.hidden=false;});
 changeArt();
 randomArtTimer=setInterval(()=>{
  if(!document.hidden&&!document.body.classList.contains('playing')&&!randomMotion.matches&&card.isConnected)changeArt();
 },1800);
 card.addEventListener('click',()=>openGame(games[Math.floor(Math.random()*games.length)]));
 return card;
}


function render() {
  clearInterval(randomArtTimer);
  if(view==='leaderboard'){document.title="Leaderboard | Ben's Wacky World";return;}
  if (view === "request") {document.title="Request | Ben's Wacky World";return;}
  if (view === "chat") {document.title = "Chat board | Ben\'s Wacky World"; return;}
  if (view === "home") {document.title = "Ben's Wacky World"; return;}
  if (view === "settings") {document.title = "Account Settings | Wacky Games"; return;}
  const query = normalize(search.value);
  const pool = view === 'new' ? games.filter(game=>game.collection==='new') : view === 'app-favorites' ? apps.filter(a=>appFavorites.has(a.id)) : view === 'app-recents' ? appRecents.map(id=>appById.get(id)).filter(Boolean) : view === 'apps' ? apps : view === 'recents' ? recents.map(id => byId.get(id)).filter(Boolean)
    : view === 'favorites' ? games.filter(game => favorites.has(game.id)) : games;
  const matches = pool.filter(game => normalize(game.title).includes(query));
  const popularity=window.WackyPopularity;
  const popularSort=gameSort==='popular';
  if(!isAppsView())matches.sort((a,b)=>
    (view==='all' ? Number(Boolean(b.pinned))-Number(Boolean(a.pinned)) : 0) ||
    (popularSort && popularity.hasScores ? popularity.score(b.id)-popularity.score(a.id) : 0) ||
    (gameSort==='az'||popularSort ? a.title.localeCompare(b.title,undefined,{sensitivity:'base',numeric:true}) : 0));
  const popularityNote=document.querySelector('#popularity-note');
  popularityNote.hidden=isAppsView()||!popularSort||popularity.state==='ready';
  popularityNote.textContent=popularity.state==='error' ?
    (popularity.hasScores?'Rankings could not refresh. Showing the last available ranking.':'Rankings are temporarily unavailable. Showing A–Z order.') :
    popularity.state!=='ready' ? 'Loading site-wide rankings…' :
    '';
  const fragment = document.createDocumentFragment();
  if(view==='all'&&!query&&games.length)fragment.append(makeRandomCard());
  for (const game of matches) {
    const card = document.createElement('button');
    card.type = 'button'; card.className = 'game-card'; card.dataset.game = game.id;
    card.setAttribute('aria-label', (game.kind === 'app' ? 'Open ' : 'Play ') + game.title);
    const artwork = game.kind === 'app' ? null : imageMap[game.id];
    if (typeof artwork === 'string' && artwork.startsWith('images/') && !artwork.includes('..')) {
      const img = document.createElement('img');
      img.src = artwork; img.alt = ''; img.loading = 'lazy'; img.decoding = 'async';
      card.classList.add('has-artwork');
      img.addEventListener('error', () => {img.remove();card.classList.remove('has-artwork');}, {once:true});
      card.append(img);
    }
    const label = document.createElement('span'); label.textContent = game.title; card.append(label);
    card.addEventListener('click', () => openGame(game));
    fragment.append(card);
  }
  grid.replaceChildren(fragment);
  const empty = document.querySelector('#empty');
  empty.hidden = matches.length > 0;
  empty.textContent = query ? (isAppsView() ? 'No apps found. Try another name.' : 'No games found. Try another name.')
    : (view === 'favorites'||view === 'app-favorites') ? 'No favorites yet. Open an item and select Favorite.'
    : (view === 'recents'||view === 'app-recents') ? 'No recent items yet. Open one to get started.'
    : 'No games available.';
  document.querySelector('#result-count').textContent = matches.length + (isAppsView() ? ' apps' : ' games');
  const title = view === 'new' ? 'New games' : view === 'app-favorites' ? 'Favorite apps' : view === 'app-recents' ? 'Recent apps' : view === 'apps' ? 'Apps' : view === 'all' ? 'All games' : view === 'favorites' ? 'Favorites' : 'Recents';
  grid.setAttribute('aria-label', title);
  document.querySelector('#page-title').textContent = title;
  document.title = title + ' | Wacky Games';
  document.querySelectorAll('[data-view]').forEach(link => {
    if (link.dataset.view === view) link.setAttribute('aria-current','page');
    else link.removeAttribute('aria-current');
  });
}
function updateFavorite() {
  const active = currentGame && (currentGame.kind==='app'?appFavorites:favorites).has(currentGame.id);
  favoriteButton.textContent = active ? 'Favorited' : 'Favorite';
  favoriteButton.setAttribute('aria-pressed', String(Boolean(active)));
  favoriteButton.title = active ? 'Remove from favorites' : 'Add to favorites';
}
function loadGame() {
  clearTimeout(loadTimer); status.hidden = true;
  const frame = document.createElement('iframe');
  frame.title = currentGame.title;
  frame.allow = 'autoplay; fullscreen; gamepad; clipboard-write';
  frame.allowFullscreen = true;
  frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-pointer-lock allow-downloads');
  frame.src = currentGame.url;
  frame.addEventListener('load', () => {clearTimeout(loadTimer);status.hidden = true;frame.focus();});
  frame.addEventListener('error', () => {
    clearTimeout(loadTimer);
    status.textContent = 'This content could not load. Try Reload, or close it and choose another game.';
    status.hidden = false;
  });
  stage.replaceChildren(frame);
  loadTimer = setTimeout(() => {
    status.textContent = 'Still loading. Some games download extra content and need an internet connection. You can reload or close this game.';
    status.hidden = false;
  },30000);
}
const alternateServers={
 'pokerogue':['https://pokerogue-tuon.onrender.com/','https://pokerogue-mxyt.onrender.com/'],
 'stream-hub':['https://stream-hub-pydm.onrender.com/','https://stream-hub-zuaa.onrender.com/']
};
const serverPicker=document.querySelector('#server-picker');
function openGame(game) {
 const urls=alternateServers[game.id];
 if(!urls){launchGame(game);return;}
 const opener=document.activeElement;
 document.querySelector('#server-heading').textContent=game.title;
 const choices=document.querySelector('#server-choices');
 choices.replaceChildren();
 urls.forEach((url,index)=>{
  const button=document.createElement('button');button.type='button';button.className='server-choice';
  const title=document.createElement('strong');title.textContent='Server '+(index+1);
  const detail=document.createElement('span');detail.textContent=index===0?'Original server':'Alternate server';
  button.append(title,detail);
  button.addEventListener('click',()=>{serverPicker.close();launchGame({...game,url},opener);});
  choices.append(button);
 });
 serverPicker.showModal();
}
document.querySelector('#server-cancel').addEventListener('click',()=>serverPicker.close());
function launchGame(game,opener=document.activeElement) {
  setPlayerBarHidden(false);
  hidePlayerBar.hidden=game.kind==='app';
  lastLaunch=opener;
  currentGame = game; lastId = game.id; savedScroll = window.scrollY;
  favoriteButton.hidden = game.kind === 'stream';
  if(game.kind==='app'){appRecents=[game.id,...appRecents.filter(id=>id!==game.id)];saveList(keys.appRecents,appRecents);}
  if (game.kind !== 'app' && game.kind !== 'stream') {
    recents = [game.id,...recents.filter(id => id !== game.id)];
    saveList(keys.recents,recents);
    void window.WackyPopularity.track(game);
  }
  document.querySelector('#game-title').textContent = game.title;
  updateFavorite();
  document.body.classList.add('playing'); player.showModal(); loadGame();
  window.dispatchEvent(new CustomEvent('wacky-game-change',{detail:{id:game.id,playing:true,isGame:game.kind!=='app'&&game.kind!=='stream'}}));
}
async function closeGame() {
  window.dispatchEvent(new CustomEvent('wacky-game-change',{detail:{playing:false}}));
  clearTimeout(loadTimer);
  if (document.fullscreenElement) {try {await document.exitFullscreen();} catch (_) {}}
  stage.replaceChildren(); player.close(); currentGame = null;
  document.body.classList.remove('playing');
  render();
  window.scrollTo({top:savedScroll,behavior:'instant'});
  const card = [...grid.children].find(card => card.dataset.game === lastId);
  (lastLaunch?.isConnected?lastLaunch:card || document.querySelector('[data-view][aria-current="page"]') || document.querySelector('.nav-home')).focus({preventScroll:true});
}
function applyRoute() {
  const hash = location.hash.slice(1);
  view = ['all','new','favorites','recents','settings','apps','app-favorites','app-recents','chat','request','leaderboard'].includes(hash) ? hash : 'home';
  const settingsOpen = view === 'settings';
  window.showAccountPages(view);
  window.showChatBoard(view === 'chat');
  const requestPanel=document.querySelector('#request-panel');
  requestPanel.hidden=view!=='request';
  if(view==='request'&&!requestPanel.querySelector('iframe')){
    const frame=document.createElement('iframe');frame.title='Request a game or feature';
    frame.src='https://docs.google.com/forms/d/e/1FAIpQLScLnhJjGnEV3kSKwBuLGhv1XNpWtFYBgr0Q42Pzk_tzSrw0FA/viewform?embedded=true';
    document.querySelector('#request-content').append(frame);
  }
  document.querySelector('.collection-nav').hidden = false;
  const routes=isAppsView()?['apps','app-favorites','app-recents']:['all','favorites','recents'];
  document.querySelectorAll('[data-view]:not([data-new-collection])').forEach((link,i)=>{link.dataset.view=routes[i];link.href='#'+routes[i];});
  document.querySelector('[data-new-collection]').hidden=isAppsView();
  document.querySelector('.collection-nav').setAttribute('aria-label',isAppsView()?'App collections':'Game collections');
  document.querySelector('#sort-wrap').hidden=isAppsView();
  search.placeholder = isAppsView() ? 'Search apps…' : 'Search games…';
  document.querySelector('.search-wrap .sr-only').textContent = isAppsView() ? 'Search apps' : 'Search games';
  document.querySelector('#catalog').hidden = settingsOpen || view === 'home' || view === 'chat' || view === 'request' || view === 'leaderboard';
  document.querySelector('#home-panel').hidden = view !== 'home';
  if (view === 'home') window.startHomeTitle();
  document.querySelector('#settings-panel').hidden = !settingsOpen;
  document.querySelector('.nav-settings').toggleAttribute('data-active', settingsOpen);
  for (const [selector, active] of [['.nav-home', view === 'home'], ['.nav-game', !settingsOpen && view !== 'home' && !isAppsView() && view !== 'chat' && view !== 'request' && view !== 'leaderboard'], ['.nav-apps', isAppsView()], ['.nav-settings', settingsOpen], ['.nav-chat', view === 'chat'], ['.nav-request', view === 'request'], ['.nav-leaderboard', view === 'leaderboard']]) {
    const button = document.querySelector(selector);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  }
  search.value = '';
  if(!isAppsView() && gameSort==='popular')void window.WackyPopularity.refresh();
  render(); window.scrollTo({top:0,behavior:'instant'});
}
document.querySelector('.nav-settings').addEventListener('click',()=>{location.hash='settings';});
search.addEventListener('input',render);
document.querySelector('.nav-game').addEventListener('click', () => {
  if (location.hash !== '#all') location.hash = 'all';
  else {search.value = '';render();window.scrollTo({top:0,behavior:'instant'});}
});
favoriteButton.addEventListener('click', () => {
  if (!currentGame || currentGame.kind==='stream') return;
  const list=currentGame.kind==='app'?appFavorites:favorites;
  if(list.has(currentGame.id))list.delete(currentGame.id);else list.add(currentGame.id);
  saveList(currentGame.kind==='app'?keys.appFavorites:keys.favorites,[...list]);updateFavorite();
});
document.querySelector('#game-sort').addEventListener('change',event=>{
 gameSort=event.target.value;if(gameSort==='popular')void window.WackyPopularity.refresh();try{localStorage.setItem('bens-wacky-world.game-sort',gameSort);}catch(_){}
 render();
});
document.querySelectorAll('[data-stream]').forEach(button=>button.addEventListener('click',()=>{
 openGame({id:'stream-hub',title:'Stream Hub',kind:'stream',url:'https://stream-hub-pydm.onrender.com/'});
}));

document.querySelector('#reload').addEventListener('click', () => {if(currentGame) loadGame();});
document.querySelector('#close').addEventListener('click',closeGame);
player.addEventListener('cancel',event => {event.preventDefault();closeGame();});
fullscreen.addEventListener('click',async () => {
  try {
    if(document.fullscreenElement) await document.exitFullscreen();
    else {
      const frame = stage.querySelector('iframe');
      if (frame) await frame.requestFullscreen();
    }
  } catch (_) {
    status.textContent = 'Fullscreen is unavailable in this browser view. Open the site in your desktop browser and try again.';
    status.hidden = false;
  }
});
document.addEventListener('fullscreenchange', () => {fullscreen.textContent = document.fullscreenElement ? 'Exit fullscreen' : 'Fullscreen';});
window.addEventListener('hashchange',applyRoute);
window.addEventListener('storage', event => {
  if(event.key === null || Object.values(keys).includes(event.key)) {
    favorites = new Set(readList(keys.favorites)); recents = readList(keys.recents);
    appFavorites=new Set(readList(keys.appFavorites));appRecents=readList(keys.appRecents);
    render(); updateFavorite();
  }
});
window.addEventListener('popularitychange',()=>{if(gameSort==='popular')render();});
applyRoute();
fetch('./game-images.json', {cache:'no-store'}).then(response => {
  if(!response.ok) throw new Error('Image map unavailable');
  return response.json();
}).then(map => {
  if(map && typeof map === 'object' && !Array.isArray(map)) {imageMap = map; render();}
}).catch(() => { /* Artwork is optional; blank cards remain usable. */ });
