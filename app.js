'use strict';
const games = window.WACKY_GAMES || [];
const grid = document.querySelector('#game-grid');
const search = document.querySelector('#search');
const player = document.querySelector('#player');
const stage = document.querySelector('#game-stage');
const status = document.querySelector('#player-status');
const fullscreen = document.querySelector('#fullscreen');
let currentGame = null;
let lastCard = null;
let loadTimer;

function normalize(text) {
  return text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}
function render() {
  const query = normalize(search.value);
  const matches = games.filter(game => normalize(game.title).includes(query));
  const fragment = document.createDocumentFragment();
  for (const game of matches) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'game-card';
    card.dataset.game = game.id;
    card.setAttribute('aria-label', `Play ${game.title}`);
    const label = document.createElement('span');
    label.textContent = game.title;
    card.append(label);
    card.addEventListener('click', () => openGame(game, card));
    fragment.append(card);
  }
  grid.replaceChildren(fragment);
  document.querySelector('#empty').hidden = matches.length > 0;
  document.querySelector('#result-count').textContent = `${matches.length} games`;
}
function loadGame() {
  clearTimeout(loadTimer);
  status.hidden = true;
  const frame = document.createElement('iframe');
  frame.title = currentGame.title;
  frame.allow = 'autoplay; fullscreen; gamepad; clipboard-write';
  frame.allowFullscreen = true;
  frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-pointer-lock allow-downloads');
  frame.src = currentGame.url;
  frame.addEventListener('load', () => {
    clearTimeout(loadTimer);
    status.hidden = true;
    frame.focus();
  });
  frame.addEventListener('error', () => {
    clearTimeout(loadTimer);
    status.textContent = 'This game could not load. Try Reload, or close it and choose another game.';
    status.hidden = false;
  });
  stage.replaceChildren(frame);
  loadTimer = setTimeout(() => {
    status.textContent = 'Still loading. Some games download extra content and need an internet connection. You can reload or close this game.';
    status.hidden = false;
  }, 30000);
}
function openGame(game, card) {
  currentGame = game;
  lastCard = card;
  document.querySelector('#game-title').textContent = game.title;
  document.body.classList.add('playing');
  player.showModal();
  loadGame();
}
async function closeGame() {
  clearTimeout(loadTimer);
  if (document.fullscreenElement) {
    try { await document.exitFullscreen(); } catch (_) { /* Closing still works. */ }
  }
  stage.replaceChildren();
  player.close();
  currentGame = null;
  document.body.classList.remove('playing');
  lastCard?.focus({preventScroll:true});
}
search.addEventListener('input', render);
document.querySelector('.nav-game').addEventListener('click', () => {search.focus();window.scrollTo({top:0,behavior:'instant'});});
document.querySelector('#reload').addEventListener('click', () => {if(currentGame) loadGame();});
document.querySelector('#close').addEventListener('click', closeGame);
player.addEventListener('cancel', event => {event.preventDefault();closeGame();});
fullscreen.addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch (_) {
    status.textContent = 'Fullscreen is unavailable in this browser view. Open the site in your desktop browser and try again.';
    status.hidden = false;
  }
});
document.addEventListener('fullscreenchange', () => {fullscreen.textContent = document.fullscreenElement ? 'Exit fullscreen' : 'Fullscreen';});
render();
