import { TIERS } from './rules.mjs';

const $ = id => document.getElementById(id);
const runtime = JSON.parse($('runtime-config').textContent);
const read = (key, fallback = null) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const write = (key, value) => { try { value === null ? localStorage.removeItem(key) : localStorage.setItem(key, JSON.stringify(value)); } catch { /* Storage is optional. */ } };
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const CODE = /^[A-HJ-NP-Z2-9]{6}$/;
const avatars = ['krill', 'schooler', 'rare', 'deepcut', 'evil', 'tooclever'];
let accountTicket = null, playerToken = read('bww:krillion-player'), room = null, busy = false;
let socket = null, reconnectTimer = null, reconnectAttempt = 0, connecting = false, pollBusy = false;
let returnToDaily = false;
let clockOffset = 0, turnVisualAt = performance.now(), eventKey = '', positions = new Map();
let feedbackUntil = 0, feedbackTimer = null, audio = null, soundOn = read('ok:party-sound', false);
const serverNow = () => Date.now() + clockOffset;

$('player-name').value = read('ok:party-name', '');
const invitedCode = (new URL(location.href).searchParams.get('room') || '').toUpperCase();
if (CODE.test(invitedCode)) $('room-code').value = invitedCode;

const accountReady = new Promise(resolve => {
  if (parent === window) { resolve(); return; }
  const origins = ['https://bens-wacky-world.pages.dev', 'https://civil-civix.github.io', ...(runtime.local ? ['http://127.0.0.1:4337', 'http://localhost:4337'] : [])];
  $('account-status').textContent = 'Connecting your Wacky World account…';
  let settled = false;
  const timer = setTimeout(() => {
    settled = true;
    $('account-status').textContent = 'Account connection unavailable. Playing as a guest.';
    resolve();
  }, 8000);
  window.addEventListener('message', event => {
    if (settled || event.source !== parent || !origins.includes(event.origin) || event.data?.type !== 'bww:krillion-account') return;
    settled = true; clearTimeout(timer);
    accountTicket = typeof event.data.ticket === 'string' ? event.data.ticket : null;
    $('account-status').textContent = accountTicket ? 'Wacky World account connected · private party play.' : 'Guest play · your name is visible in the room.';
    resolve();
  });
  for (const origin of origins) parent.postMessage({ type: 'bww:krillion-ready' }, origin);
});

async function api(path, data) {
  const response = await fetch('/api/party/' + path, {
    credentials: 'same-origin', cache: 'no-store',
    headers: { 'Content-Type': 'application/json', ...(accountTicket ? { 'X-Wacky-Krillion-Ticket': accountTicket } : {}), ...(playerToken ? { 'X-Krillion-Player': playerToken } : {}) },
    ...(data === undefined ? {} : { method: 'POST', body: JSON.stringify(data) }), signal: AbortSignal.timeout(15000)
  });
  const body = await response.json();
  if (!response.ok) { const error = new Error(body.error || 'The signal is lost. Please retry.'); error.status = response.status; throw error; }
  if (body.playerToken) { playerToken = body.playerToken; write('bww:krillion-player', playerToken); }
  return body;
}
function connection(label, warning = false) { $('connection').textContent = label; $('connection').classList.toggle('reconnecting', warning); }
function showError(message, door = !room) { const el = $(door ? 'door-error' : 'room-error'); el.textContent = message; el.hidden = !message; }
function feedback(message, bad = false, color = '') {
  feedbackUntil = Date.now() + 4000;
  $('answer-feedback').textContent = message;
  $('answer-feedback').classList.toggle('bad', bad);
  $('answer-feedback').style.setProperty('--feedback-color', color || (bad ? '#ff9f43' : '#4de3ff'));
  clearTimeout(feedbackTimer);
  feedbackTimer = setTimeout(() => { $('answer-feedback').textContent = ''; }, 4000);
}
function hearts(count, max = 5) { return `<span aria-hidden="true">${'♥'.repeat(Math.max(0, count))}<span class="heart-empty">${'♡'.repeat(Math.max(0, max - count))}</span></span>`; }
function me() { return room?.players.find(p => p.id === room.youId); }
function host() { return room?.hostId === room?.youId; }
function canAnswer() { return room?.phase === 'playing' && room.holderId === room.youId && !me()?.eliminated; }
function syncButtons() {
  $('create-room').disabled = busy; $('join-room').disabled = busy;
  $('start-game').disabled = busy || !host() || (room?.players.length || 0) < 2;
  $('rematch').disabled = busy || !host() || (room?.players.length || 0) < 2;
  const settingsAllowed = room && host() && ['lobby', 'finished'].includes(room.phase);
  $('setting-hearts').disabled = busy || !settingsAllowed; $('setting-max').disabled = busy || !settingsAllowed;
  $('answer').disabled = busy || !canAnswer(); $('submit-answer').disabled = busy || !canAnswer();
  $('confirm-leave').disabled = busy;
  document.querySelectorAll('.kick').forEach(button => { button.disabled = busy; });
}
function sound(type) {
  if (!soundOn) return;
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    void audio.resume();
    const notes = type === 'pop' ? [90, 45] : type === 'winner' ? [392, 523, 659] : type === 'answer' ? [440, 660] : [330];
    notes.forEach((frequency, index) => {
      const osc = audio.createOscillator(), gain = audio.createGain(), at = audio.currentTime + index * .08;
      osc.type = type === 'pop' ? 'sawtooth' : 'sine'; osc.frequency.setValueAtTime(frequency, at);
      gain.gain.setValueAtTime(.045, at); gain.gain.exponentialRampToValueAtTime(.001, at + .15);
      osc.connect(gain).connect(audio.destination); osc.start(at); osc.stop(at + .16);
    });
  } catch { /* Audio is optional. */ }
}
function syncSound() {
  $('sound-toggle').textContent = soundOn ? '♪ ON' : '♪ OFF';
  $('sound-toggle').setAttribute('aria-pressed', String(soundOn));
  $('sound-toggle').setAttribute('aria-label', soundOn ? 'Turn sound off' : 'Turn sound on');
}
function playerPosition(index, total) {
  if (total > 8) { const columns = total <= 12 ? 3 : 4, rows = Math.ceil(total / columns); return { x: (index % columns + .5) / columns * 100, y: (Math.floor(index / columns) + .4) / rows * 100 }; }
  const angle = -Math.PI / 2 + index / total * Math.PI * 2;
  return { x: 50 + Math.cos(angle) * 47, y: 45 + Math.sin(angle) * 39 };
}
function renderPlayers() {
  const lobby = room.phase === 'lobby', removable = host() && ['lobby', 'finished'].includes(room.phase);
  const event = room.lastEvent, recent = event && serverNow() - event.at < 3400;
  positions = new Map();
  $('players').innerHTML = room.players.map((player, index) => {
    const pos = playerPosition(index, room.players.length); positions.set(player.id, pos);
    const count = lobby ? room.settings.hearts : player.hearts;
    const max = Math.max(room.settings.hearts, count);
    const say = recent && event.type === 'answer' && event.playerId === player.id;
    const tier = TIERS[event?.tier];
    return `<article class="player ${player.id === room.youId ? 'you' : ''} ${player.id === room.holderId && !lobby ? 'holder' : ''} ${player.eliminated ? 'out' : ''} ${player.id === room.winnerId ? 'winner' : ''} ${recent && event.type === 'pop' && event.playerId === player.id ? 'hit' : ''}" style="--x:${pos.x}%;--y:${pos.y}%" aria-label="${escape(player.name)}${player.host ? ', host' : ''}, ${count} hearts, ${player.score} points${player.eliminated ? ', spectating' : ''}"><span class="perch" aria-hidden="true"></span><img class="diver" src="/assets/${avatars[index % avatars.length]}.svg" alt=""><span class="player-name" title="${escape(player.name)}${player.host ? ' · HOST' : ''}">${player.host ? '♛ ' : ''}${escape(player.name)}</span><span class="hearts">${hearts(count, max)}</span><span class="meter" role="meter" aria-label="${escape(player.name)} rarity meter" aria-valuemin="0" aria-valuemax="600" aria-valuenow="${player.meter}" style="--meter:${Math.min(100, player.meter / 600 * 100)}%"><i></i></span>${removable && player.id !== room.youId ? `<button class="kick" type="button" data-kick="${escape(player.id)}" aria-label="Remove ${escape(player.name)}">×</button>` : ''}${say ? `<span class="say" style="--say-color:${tier?.color || '#4de3ff'}">${escape(event.answer)} · +${event.score}</span>` : ''}</article>`;
  }).join('');
}
function applyRoom(next) {
  if (!next || room && next.code === room.code && next.version < room.version) return;
  if (!next.youId) { exitRoom('Your diver has left this room.'); return; }
  const prior = room, phaseChanged = prior?.phase !== next.phase, turnChanged = prior?.holderId !== next.holderId || prior?.roundId !== next.roundId;
  room = next; clockOffset = next.serverNow - Date.now();
  write('ok:party-room', room.code);
  if (phaseChanged || turnChanged) turnVisualAt = performance.now();
  $('door').hidden = true; $('room').hidden = false; $('party-root').dataset.phase = room.phase;
  $('room').toggleAttribute('data-crowded', room.players.length > 8);
  $('invite-code').textContent = room.code; $('large-code').textContent = room.code;
  $('setting-hearts').value = String(room.settings.hearts); $('setting-max').value = String(room.settings.maxPlayers);
  $('settings-status').textContent = host() ? 'You are the host. Changes save automatically.' : 'Only the host can change these.';
  const lobby = room.phase === 'lobby', finished = room.phase === 'finished';
  $('lobby-controls').hidden = !lobby; $('category-card').hidden = lobby || finished;
  $('winner-card').hidden = !finished; $('answer-dock').hidden = lobby || finished;
  $('start-game').hidden = !host(); $('host-wait').hidden = host();
  $('lobby-status').textContent = `${room.players.length} / ${room.settings.maxPlayers} divers · ${room.players.length < 2 ? 'invite a friend to begin' : 'ready when you are'}`;
  $('category-text').textContent = room.category?.text || 'Getting the next category…';
  $('answers-used').textContent = `${room.category?.usedCount || 0} USED`;
  $('category-label').textContent = room.phase === 'swap' ? 'NEW CATEGORY' : 'THE CATEGORY';
  $('category-hint').textContent = 'one answer · no repeats · hidden fuse';
  $('your-hearts').innerHTML = hearts(me().hearts, Math.max(room.settings.hearts, me().hearts));
  $('your-hearts').setAttribute('aria-label', `Your hearts: ${me().hearts}`);
  $('meter-description').textContent = `${me().meter} / 600 rarity → +1 heart · ${me().score} points`;
  const holder = room.players.find(p => p.id === room.holderId);
  $('turn-status').textContent = me().eliminated ? 'YOU’RE OUT · stay and watch your school' : room.phase === 'pop' ? 'POP! A heart goes overboard…' : room.phase === 'swap' ? 'A fresh category is drifting in…' : room.phase === 'countdown' ? 'Get ready, divers…' : canAnswer() ? 'YOUR PUFFER · name an answer and pass!' : `${holder?.name || 'Another diver'} has the puffer…`;
  $('answer').placeholder = me().eliminated ? 'spectating this match…' : canAnswer() ? 'name something…' : 'waiting for the puffer…';
  if (turnChanged && prior?.holderId === prior?.youId) $('answer').value = '';
  if (finished) {
    const winner = room.players.find(p => p.id === room.winnerId);
    $('winner-name').textContent = winner?.name || 'THE SCHOOL SURVIVED';
    $('winner-detail').textContent = winner ? `${winner.hearts} ${winner.hearts === 1 ? 'heart' : 'hearts'} afloat · ${winner.score} rarity points` : room.lastEvent?.type === 'bankExhausted' ? 'Every answer in the saved category bank was found.' : 'No divers left floating. Try another round.';
    $('rematch').hidden = !host(); $('rematch-wait').hidden = host();
    if (host() && room.players.length < 2) $('winner-detail').textContent += ' Invite another diver for a rematch.';
  }
  renderPlayers(); syncButtons(); tick();
  const event = room.lastEvent, key = event ? `${room.match}:${event.type}:${event.at}:${event.playerId}` : '';
  if (key && key !== eventKey) {
    eventKey = key;
    if (serverNow() - (event.at || 0) < 5000) {
      if (event.type === 'answer') {
        sound('answer');
        if (event.playerId === room.youId) feedback(`${event.answer} · ${TIERS[event.tier]?.name || 'Accepted'} +${event.score}${event.heartGained ? ' · +1 HEART!' : ''} · passed!`, false, TIERS[event.tier]?.color);
      } else if (event.type === 'pop') sound('pop');
      else if (event.type === 'winner') sound('winner');
    }
  }
  if (canAnswer() && (turnChanged || phaseChanged) && !busy && !document.querySelector('dialog[open]')) $('answer').focus({ preventScroll: true });
}
function tick() {
  if (!room) return;
  const phase = room.phase, sleeping = ['lobby', 'finished'].includes(phase), puffer = $('puffer');
  $('countdown').hidden = phase !== 'countdown';
  if (phase === 'countdown') $('countdown-number').textContent = String(Math.max(1, Math.ceil((room.phaseEndsAt - serverNow()) / 1000)));
  // The server never sends its fuse deadline. These stages decorate the current
  // turn; they cannot predict a pop and never control any game transition.
  const stage = Math.min(3, Math.floor((performance.now() - turnVisualAt) / 4000));
  const src = `/assets/party/${sleeping ? 'puffer-sleep' : `puffer-${stage}`}.png`;
  if ($('puffer-image').getAttribute('src') !== src) $('puffer-image').src = src;
  puffer.classList.toggle('sleeping', sleeping); puffer.classList.toggle('furious', !sleeping && stage === 3 && phase === 'playing'); puffer.classList.toggle('popping', phase === 'pop');
  $('puffer-sleep').hidden = !sleeping;
  const pos = positions.get(room.holderId);
  puffer.style.left = `${!sleeping && pos ? 50 + (pos.x - 50) * .65 : 50}%`;
  puffer.style.top = `${!sleeping && pos ? 45 + (pos.y - 45) * .65 : 45}%`;
  if (Date.now() > feedbackUntil && $('answer-feedback').textContent) $('answer-feedback').textContent = '';
  // Remove speech bubbles after their brief display without rebuilding focused controls.
  if (room.lastEvent && serverNow() - room.lastEvent.at >= 3400) document.querySelectorAll('.say').forEach(el => el.remove());
}
function closeSocket() {
  clearTimeout(reconnectTimer); reconnectTimer = null;
  if (socket) { const old = socket; socket = null; old.onclose = null; old.close(); }
}
function exitRoom(message = '') {
  closeSocket(); room = null; reconnectAttempt = 0; write('ok:party-room', null);
  document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
  clearTimeout(feedbackTimer); feedbackUntil = 0; $('answer-feedback').textContent = '';
  $('door').hidden = false; $('room').hidden = true; $('party-root').dataset.phase = 'door';
  $('answer').value = ''; $('room-error').hidden = true; connection('OPENKRILLION');
  const url = new URL(location.href); url.searchParams.delete('room'); history.replaceState(null, '', url);
  showError(message, true); syncButtons();
}
function retrySocket() {
  if (!room || reconnectTimer) return;
  connection(navigator.onLine ? 'RECONNECTING · HTTP SYNC' : 'OFFLINE · RETRYING', true);
  reconnectTimer = setTimeout(() => { reconnectTimer = null; void connectSocket(); }, Math.min(15000, 1000 * 2 ** Math.min(reconnectAttempt++, 4)));
}
async function connectSocket(ticket) {
  if (!room || connecting || socket && socket.readyState < 2) return;
  connecting = true; const code = room.code;
  try {
    ticket ??= (await api('action', { code, action: 'connect' })).wsTicket;
    if (room?.code !== code) return;
    const url = new URL('/api/party/ws', location.href); url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'; url.searchParams.set('code', code); url.searchParams.set('ticket', ticket);
    const ws = new WebSocket(url); socket = ws;
    ws.onopen = () => { if (socket !== ws) return; reconnectAttempt = 0; connection('LIVE · CONNECTED'); showError(''); };
    ws.onmessage = event => { if (socket !== ws || room?.code !== code) return; try { const data = JSON.parse(event.data); if (data.room) applyRoom(data.room); } catch { /* A malformed event is ignored; HTTP sync remains available. */ } };
    ws.onerror = () => { if (socket === ws) connection('HTTP SYNC · RECONNECTING', true); };
    ws.onclose = () => { if (socket !== ws) return; socket = null; retrySocket(); };
  } catch { retrySocket(); }
  finally { connecting = false; }
}
async function refresh() {
  if (!room || pollBusy || !navigator.onLine) return;
  pollBusy = true; const code = room.code;
  try {
    const body = await api('state?code=' + encodeURIComponent(code));
    if (room?.code === code) { applyRoom(body.room); if (!socket || socket.readyState !== WebSocket.OPEN) connection('HTTP SYNC · RECONNECTING', true); }
  } catch (error) {
    if (room?.code !== code) return;
    if ([403, 404].includes(error.status)) exitRoom(error.message);
    else { connection('SIGNAL LOST · RETRYING', true); showError(error.message); }
  } finally { pollBusy = false; }
}
async function perform(action, data = {}) {
  if (busy || !room) return;
  busy = true; syncButtons(); showError('');
  const code = room.code;
  try {
    const body = await api('action', { code, action, ...data });
    if (room?.code !== code) return;
    if (action === 'leave') { exitRoom(); if (returnToDaily) location.assign('/'); return; }
    applyRoom(body.room);
    if (body.result && !body.result.accepted) { feedback(body.result.message, true); $('answer').classList.remove('shake'); void $('answer').offsetWidth; $('answer').classList.add('shake'); sound('reject'); }
    if (body.result?.accepted) $('answer').value = '';
  } catch (error) { showError(error.message); if (action === 'answer') feedback(error.message, true); void refresh(); }
  finally { busy = false; syncButtons(); if (canAnswer() && !document.querySelector('dialog[open]')) $('answer').focus({ preventScroll: true }); }
}
async function enter(create) {
  if (busy) return;
  const name = $('player-name').value.trim(), code = $('room-code').value.trim().toUpperCase();
  if (!name) { showError('Enter your diver name.', true); $('player-name').focus(); return; }
  if (!create && !CODE.test(code)) { showError('Enter a valid six-character room code.', true); $('room-code').focus(); return; }
  busy = true; syncButtons(); showError('', true); write('ok:party-name', name);
  try {
    await accountReady;
    const body = await api(create ? 'create' : 'join', { name, ...(create ? {} : { code }) });
    applyRoom(body.room); connection('CONNECTING…', true); void connectSocket(body.wsTicket);
    const url = new URL(location.href); url.searchParams.set('room', body.room.code); history.replaceState(null, '', url);
  } catch (error) { showError(error.message, true); }
  finally { busy = false; syncButtons(); }
}
async function copyInvite(codeOnly = false) {
  if (!room) return;
  const url = new URL('/party', location.href); url.searchParams.set('room', room.code);
  try { await navigator.clipboard.writeText(codeOnly ? room.code : url.href); showError(codeOnly ? 'Room code copied.' : 'Invite link copied.'); }
  catch { showError(`Invite a friend with room code ${room.code}.`); }
}
$('create-form').addEventListener('submit', event => { event.preventDefault(); void enter(true); });
$('join-form').addEventListener('submit', event => { event.preventDefault(); void enter(false); });
$('room-code').addEventListener('input', () => { $('room-code').value = $('room-code').value.toUpperCase().replace(/[^A-Z2-9]/g, ''); });
$('settings-form').addEventListener('submit', event => event.preventDefault());
for (const id of ['setting-hearts', 'setting-max']) $(id).addEventListener('change', () => void perform('settings', { settings: { hearts: Number($('setting-hearts').value), maxPlayers: Number($('setting-max').value) } }));
$('start-game').addEventListener('click', () => void perform('start'));
$('rematch').addEventListener('click', () => void perform('rematch'));
$('answer-form').addEventListener('submit', event => { event.preventDefault(); if (canAnswer() && $('answer').value.trim()) void perform('answer', { answer: $('answer').value.trim(), roundId: room.roundId }); });
$('players').addEventListener('click', event => { const button = event.target.closest('[data-kick]'); if (button) void perform('kick', { playerId: button.dataset.kick }); });
$('copy-code').addEventListener('click', () => void copyInvite(true));
$('copy-invite').addEventListener('click', () => void copyInvite());
$('help-button').addEventListener('click', () => $('help-dialog').showModal());
$('leave-room').addEventListener('click', () => { returnToDaily = false; $('leave-dialog').showModal(); });
$('daily-link').addEventListener('click', event => { if (!room) return; event.preventDefault(); returnToDaily = true; $('leave-dialog').showModal(); });
$('confirm-leave').addEventListener('click', () => void perform('leave'));
for (const button of document.querySelectorAll('[data-close]')) button.addEventListener('click', () => button.closest('dialog').close());
$('sound-toggle').addEventListener('click', () => { soundOn = !soundOn; write('ok:party-sound', soundOn); syncSound(); sound('answer'); });
window.addEventListener('online', () => { void refresh(); void connectSocket(); });
window.addEventListener('offline', () => { if (room) connection('OFFLINE · RETRYING', true); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) { void refresh(); void connectSocket(); } });
setInterval(tick, 200);
let reconciliationAt = 0;
setInterval(() => {
  if (document.hidden || !room) return;
  const interval = socket?.readyState === WebSocket.OPEN ? 30000 : 2500;
  if (Date.now() - reconciliationAt >= interval) { reconciliationAt = Date.now(); void refresh(); }
}, 1000);
syncSound(); syncButtons();
await accountReady;
const savedCode = read('ok:party-room');
if (CODE.test(savedCode || '') && (!invitedCode || invitedCode === savedCode)) {
  try {
    const body = await api('state?code=' + encodeURIComponent(savedCode));
    if (!room) { applyRoom(body.room); connection('RECONNECTING…', true); void connectSocket(); }
  } catch { write('ok:party-room', null); }
}


