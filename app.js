'use strict';
const games = window.WACKY_GAMES || [];
const apps = window.WACKY_APPS || [];
const byId = new Map(games.map(game => [game.id, game]));
const grid = document.querySelector('#game-grid');
const search = document.querySelector('#search');
const player = document.querySelector('#player');
const stage = document.querySelector('#game-stage');
const status = document.querySelector('#player-status');
const fullscreen = document.querySelector('#fullscreen');
const favoriteButton = document.querySelector('#favorite');
const storageNotice = document.querySelector('#storage-notice');
const keys = {favorites:'bens-wacky-world.favorites.v1', recents:'bens-wacky-world.recents.v1'};
let currentGame = null, lastId = null, loadTimer, savedScroll = 0;
let imageMap = {};
let view = 'home';

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
    return [...new Set(value.filter(id => typeof id === 'string' && byId.has(id)))];
  } catch (_) { storageWarning(); return []; }
}
let favorites = new Set(readList(keys.favorites));
let recents = readList(keys.recents);
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
  if (view === "chat") {document.title = "Chat board | Ben\'s Wacky World"; return;}
  if (view === "home") {document.title = "Ben's Wacky World"; return;}
  if (view === "settings") {document.title = "Appearance | Wacky Games"; return;}
  const query = normalize(search.value);
  const pool = view === 'apps' ? apps : view === 'recents' ? recents.map(id => byId.get(id)).filter(Boolean)
    : view === 'favorites' ? games.filter(game => favorites.has(game.id)) : games;
  const matches = pool.filter(game => normalize(game.title).includes(query));
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
  empty.textContent = query ? (view === 'apps' ? 'No apps found. Try another name.' : 'No games found. Try another name.')
    : view === 'favorites' ? 'No favorites yet. Open a game and select Favorite.'
    : view === 'recents' ? 'No recent games yet. Open a game to get started.'
    : 'No games available.';
  document.querySelector('#result-count').textContent = matches.length + (view === 'apps' ? ' apps' : ' games');
  const title = view === 'apps' ? 'Apps' : view === 'all' ? 'All games' : view === 'favorites' ? 'Favorites' : 'Recents';
  grid.setAttribute('aria-label', title);
  document.querySelector('#page-title').textContent = title;
  document.title = title + ' | Wacky Games';
  document.querySelectorAll('[data-view]').forEach(link => {
    if (link.dataset.view === view) link.setAttribute('aria-current','page');
    else link.removeAttribute('aria-current');
  });
}
function updateFavorite() {
  const active = currentGame && favorites.has(currentGame.id);
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
function openGame(game) {
  currentGame = game; lastId = game.id; savedScroll = window.scrollY;
  favoriteButton.hidden = game.kind === 'app';
  if (game.kind !== 'app') {
    recents = [game.id,...recents.filter(id => id !== game.id)];
    saveList(keys.recents,recents);
  }
  document.querySelector('#game-title').textContent = game.title;
  updateFavorite();
  document.body.classList.add('playing'); player.showModal(); loadGame();
}
async function closeGame() {
  clearTimeout(loadTimer);
  if (document.fullscreenElement) {try {await document.exitFullscreen();} catch (_) {}}
  stage.replaceChildren(); player.close(); currentGame = null;
  document.body.classList.remove('playing');
  render();
  window.scrollTo({top:savedScroll,behavior:'instant'});
  const card = [...grid.children].find(card => card.dataset.game === lastId);
  (card || document.querySelector('[data-view][aria-current="page"]')).focus({preventScroll:true});
}
function applyRoute() {
  const hash = location.hash.slice(1);
  view = ['all','favorites','recents','settings','apps','chat'].includes(hash) ? hash : 'home';
  const settingsOpen = view === 'settings';
  window.showChatBoard(view === 'chat');
  document.querySelector('.collection-nav').hidden = view === 'apps';
  search.placeholder = view === 'apps' ? 'Search apps…' : 'Search games…';
  document.querySelector('.search-wrap .sr-only').textContent = view === 'apps' ? 'Search apps' : 'Search games';
  document.querySelector('#catalog').hidden = settingsOpen || view === 'home' || view === 'chat';
  document.querySelector('#home-panel').hidden = view !== 'home';
  if (view === 'home') window.startHomeTitle();
  document.querySelector('#settings-panel').hidden = !settingsOpen;
  document.querySelector('.nav-settings').toggleAttribute('data-active', settingsOpen);
  for (const [selector, active] of [['.nav-home', view === 'home'], ['.nav-game', !settingsOpen && view !== 'home' && view !== 'apps' && view !== 'chat'], ['.nav-apps', view === 'apps'], ['.nav-settings', settingsOpen], ['.nav-chat', view === 'chat']]) {
    const button = document.querySelector(selector);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  }
  search.value = '';
  render(); window.scrollTo({top:0,behavior:'instant'});
}
document.querySelector('.nav-settings').addEventListener('click',()=>{location.hash='settings';});
search.addEventListener('input',render);
document.querySelector('.nav-game').addEventListener('click', () => {
  if (location.hash !== '#all') location.hash = 'all';
  else {search.value = '';render();window.scrollTo({top:0,behavior:'instant'});}
});
favoriteButton.addEventListener('click', () => {
  if (!currentGame || currentGame.kind === 'app') return;
  if (favorites.has(currentGame.id)) favorites.delete(currentGame.id);
  else favorites.add(currentGame.id);
  saveList(keys.favorites,[...favorites]); updateFavorite();
});
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
    render(); updateFavorite();
  }
});
applyRoute();
fetch('./game-images.json', {cache:'no-store'}).then(response => {
  if(!response.ok) throw new Error('Image map unavailable');
  return response.json();
}).then(map => {
  if(map && typeof map === 'object' && !Array.isArray(map)) {imageMap = map; render();}
}).catch(() => { /* Artwork is optional; blank cards remain usable. */ });
