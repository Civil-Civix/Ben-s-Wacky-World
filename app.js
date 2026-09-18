'use strict';
const games = window.WACKY_GAMES || [];
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
let view = 'all';

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
function render() {
  if (view === "settings") {document.title = "Appearance | Wacky Games"; return;}
  const query = normalize(search.value);
  const pool = view === 'recents' ? recents.map(id => byId.get(id)).filter(Boolean)
    : view === 'favorites' ? games.filter(game => favorites.has(game.id)) : games;
  const matches = pool.filter(game => normalize(game.title).includes(query));
  const fragment = document.createDocumentFragment();
  for (const game of matches) {
    const card = document.createElement('button');
    card.type = 'button'; card.className = 'game-card'; card.dataset.game = game.id;
    card.setAttribute('aria-label', 'Play ' + game.title);
    const artwork = imageMap[game.id];
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
  empty.textContent = query ? 'No games found. Try another name.'
    : view === 'favorites' ? 'No favorites yet. Open a game and select Favorite.'
    : view === 'recents' ? 'No recent games yet. Open a game to get started.'
    : 'No games available.';
  document.querySelector('#result-count').textContent = matches.length + ' games';
  const title = view === 'all' ? 'All games' : view === 'favorites' ? 'Favorites' : 'Recents';
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
    status.textContent = 'This game could not load. Try Reload, or close it and choose another game.';
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
  recents = [game.id,...recents.filter(id => id !== game.id)];
  saveList(keys.recents,recents);
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
  view = ['favorites','recents','settings'].includes(hash) ? hash : 'all';
  const settingsOpen = view === 'settings';
  document.querySelector('#catalog').hidden = settingsOpen;
  document.querySelector('#settings-panel').hidden = !settingsOpen;
  document.querySelector('.nav-settings').toggleAttribute('data-active', settingsOpen);
  for (const [selector, active] of [['.nav-game', !settingsOpen], ['.nav-settings', settingsOpen]]) {
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
  if (!currentGame) return;
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
fetch('./game-images.json').then(response => {
  if(!response.ok) throw new Error('Image map unavailable');
  return response.json();
}).then(map => {
  if(map && typeof map === 'object' && !Array.isArray(map)) {imageMap = map; render();}
}).catch(() => { /* Artwork is optional; blank cards remain usable. */ });
