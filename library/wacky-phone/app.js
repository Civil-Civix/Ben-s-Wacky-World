(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const pending = new Map();
  const state = { user: null, room: null, drawing: null, taskKey: '', dirty: false, revision: 0, savedRevision: 0, saving: 0, saveQueue: Promise.resolve(), generation: 0, saveTimer: null, polling: false, offset: 0, viewedChain: null, revealKey: '', chainCache: new Map(), seenEntries: new Set(), report: null, lastConnected: Date.now(), submitting: false, settingsPending: false, starting: false };
  let sequence = 0, toastTimer, requestPending = 0;
  function send(path, method = 'GET', data) {
    return new Promise((resolve, reject) => {
      const id = `phone-${Date.now()}-${++sequence}`;
      const timeout = setTimeout(() => { pending.delete(id); reject(new Error('Connection is taking a little longer. Please try again.')); }, 15000);
      pending.set(id, { resolve, reject, timeout });
      window.parent.postMessage({ type: 'bww:phone-request', id, path, method, data }, window.location.origin);
    });
  }
  window.addEventListener('message', event => {
    if (event.source !== window.parent || event.origin !== window.location.origin) return;
    const message = event.data;
    if (!message || typeof message !== 'object') return;
    if (message.type === 'bww:phone-theme' && message.theme) {
      for (const key of ['background', 'panel', 'text', 'muted', 'border', 'accent']) {
        const value = message.theme[key];
        if (typeof value === 'string' && CSS.supports('color', value)) document.documentElement.style.setProperty(`--${key}`, value);
      }
    }
    if (message.type !== 'bww:phone-response') return;
    const item = pending.get(message.id);
    if (!item) return;
    clearTimeout(item.timeout); pending.delete(message.id);
    const response = message.data || {};
    if (message.status >= 400 || response.error) {
      const error = new Error(response.error || 'Something went wrong. Please try again.');
      error.status = message.status || response.status;
      item.reject(error);
    } else item.resolve(response);
  });
  function toast(message) { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, 5000); }
  function confirmAction(title, description, accept = 'Leave room') {
    const dialog = $('confirm-dialog');
    if (dialog.open) return Promise.resolve(false);
    $('confirm-title').textContent = title;
    $('confirm-description').textContent = description;
    $('confirm-accept').textContent = accept;
    dialog.querySelector('[value="cancel"]').textContent = accept === 'Leave room' ? 'Stay here' : 'Cancel';
    dialog.returnValue = '';
    return new Promise(resolve => {
      dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), { once: true });
      dialog.showModal();
    });
  }
  async function leaveRoom() {
    if (!state.room) return;
    const room = state.room, generation = state.generation;
    if (room.phase !== 'complete' && !await confirmAction('Leave this room?', 'You can return with the room code while your seat is available.')) return;
    if (generation !== state.generation || state.room?.code !== room.code) return;
    const code = room.code;
    leaveView();
    send('/phone/' + encodeURIComponent(code) + '/leave', 'POST', {}).catch(() => {});
  }
  function show(id, visible) { $(id).hidden = !visible; }
  function localGet() { try { return localStorage.getItem('bww-phone-room') || ''; } catch { return ''; } }
  function localSet(code) { try { if (code) localStorage.setItem('bww-phone-room', code); else localStorage.removeItem('bww-phone-room'); } catch {} }
  async function action(name, data = {}) {
    if (!state.room) return null;
    const generation = state.generation;
    const result = await send(`/phone/${encodeURIComponent(state.room.code)}/${name}`, 'POST', data);
    if (result.room && generation === state.generation && state.room) acceptRoom(result.room);
    return result;
  }
  let waitingDrawing = null;
  function placeWaitingPad(inLobby = false) {
    const pad = $('waiting-pad'), slot = $(inLobby ? 'lobby-pad-slot' : 'welcome-pad-slot');
    if (pad.parentElement !== slot) slot.append(pad);
    if (!waitingDrawing && window.WackyDrawing?.create) waitingDrawing = window.WackyDrawing.create($('waiting-drawing'));
  }
  function acceptRoom(room) {
    if (!room || !Array.isArray(room.players)) return;
    const phaseOrder = { lobby: 0, playing: 1, reveal: 2, complete: 3 };
    const previous = state.room;
    if (previous?.code === room.code && (phaseOrder[room.phase] < phaseOrder[previous.phase] || (room.phase === 'playing' && previous.phase === 'playing' && room.round < previous.round))) return;
    if (previous?.code === room.code && Number(room.serverNow) < Number(previous.serverNow)) return;
    state.lastConnected = Date.now();
    show('connection', false);
    if (room.serverNow) state.offset = Number(room.serverNow) - Date.now();
    state.room = room;
    localSet(room.code);
    show('welcome', false); show('room', true); show('leave', true);
    $('leave').textContent = room.phase === 'complete' ? 'Back to lobby' : 'Leave room';
    $('room').dataset.phase = room.phase;
    $('room-code').textContent = room.code;
    $('player-count').textContent = `${room.players.length} / ${room.capacity || 10}`;
    const host = room.hostId === state.user?.id;
    const titles = { lobby: ['THE WAITING ROOM', 'Everybody in?'], playing: ['A WORK IN PROGRESS', 'Let the mix-ups begin.'], reveal: ['THE PLOT THICKENS', 'How did we get here?'], complete: ['THAT’S A WRAP', 'A masterpiece of miscommunication.'] };
    $('phase-label').textContent = titles[room.phase]?.[0] || 'WACKY PHONE';
    $('room-title').textContent = titles[room.phase]?.[1] || 'Your room';
    renderPlayers(room, host);
    show('lobby', room.phase === 'lobby'); show('playing', room.phase === 'playing'); show('reveal', room.phase === 'reveal' || room.phase === 'complete');
    placeWaitingPad(room.phase === 'lobby');
    if (room.phase === 'lobby') {
      $('lobby-message').textContent = `${Math.max(0, (room.minPlayers || 4) - room.players.length) ? 'At least four players make a proper game. Share the code to fill your room.' : 'The gang is here. There is still room for more friends.'}`;
      show('start', host); renderSettings(room, host);
      $('host-wait').textContent = host ? 'Once you start, the room closes to new players.' : 'Your host will start the game when everyone is here.';
    } else if (room.phase === 'playing') renderTask(room);
    else renderReveal(room, host);
    tick();
  }
  function roomSettings(room) {
    return { mode: room.settings?.mode === 'icebreaker' ? 'icebreaker' : 'classic', timerPreset: room.settings?.timerPreset === 'relaxed' ? 'relaxed' : 'standard' };
  }
  function renderSettings(room, host) {
    const settings = roomSettings(room), icebreaker = settings.mode === 'icebreaker', relaxed = settings.timerPreset === 'relaxed';
    for (const button of document.querySelectorAll('[data-setting]')) {
      button.setAttribute('aria-pressed', String(settings[button.dataset.setting] === button.dataset.value));
      button.disabled = !host || state.settingsPending || state.starting;
    }
    $('settings-status').textContent = state.settingsPending ? 'Saving room settings…' : host ? 'Choose the game and pace for your room.' : 'Your host chooses the game and pace.';
    $('start').disabled = state.settingsPending || state.starting || room.players.length < (room.minPlayers || 4);
    $('mode-description').textContent = icebreaker ? 'Everyone writes a question. Each friend draws their own answer to the original question. No guessing rounds.' : 'Write a phrase, draw what you read, then guess the drawing. See how the message changes.';
    $('rules').textContent = (relaxed ? '90s' : '45s') + ' to ' + (icebreaker ? 'write a question' : 'write & guess') + ' · ' + (relaxed ? '180s' : '90s') + ' to draw · No points. Just ' + (icebreaker ? 'getting to know your friends.' : 'plot twists.');
    $('rules-flow').textContent = icebreaker ? 'Every player writes a question to start a chain. In each later round, another player draws their own answer to that original question. Everyone sees the same question, never the previous drawing. There are no guessing rounds. A room of 6 plays 6 rounds.' : 'Every player starts a chain. Everyone writes, draws, or guesses at the same time, passing their page each round. A room of 6 plays 6 rounds, so every chain visits everyone.';
    $('rules-timing').textContent = (icebreaker ? 'Questions get ' : 'Writing and guessing get ') + (relaxed ? 90 : 45) + ' seconds; drawings get ' + (relaxed ? 180 : 90) + '. Drafts save automatically. Mark yourself ready when finished, and keep editing until everybody is ready. The game advances immediately when all players are ready, or when the timer ends.';
  }
  async function changeSettings(key, value) {
    const room = state.room;
    if (!room || room.phase !== 'lobby' || room.hostId !== state.user?.id || state.settingsPending || state.starting) return;
    const settings = roomSettings(room);
    if (settings[key] === value) return;
    const generation = state.generation;
    state.settingsPending = true; renderSettings(room, true);
    try { await action('settings', { ...settings, [key]: value }); }
    catch (error) { if (generation === state.generation) toast(error.message); }
    finally { if (generation === state.generation) { state.settingsPending = false; if (state.room?.phase === 'lobby') renderSettings(state.room, state.room.hostId === state.user?.id); } }
  }
  function renderPlayers(room, host) {
    const fragment = document.createDocumentFragment();
    for (const player of room.players) {
      const row = document.createElement('div'); row.className = 'player';
      const avatar = document.createElement('span'); avatar.className = 'avatar'; avatar.textContent = (player.username || '?').slice(0, 2).toUpperCase(); row.append(avatar);
      const main = document.createElement('div'); main.className = 'player-main';
      const name = document.createElement('div'); name.className = 'player-name'; name.textContent = `${player.username}${player.id === state.user?.id ? ' (you)' : ''}`;
      const detail = document.createElement('div'); detail.className = 'player-detail'; detail.textContent = player.kicked ? 'Removed' : !player.connected ? 'Reconnecting · 30s grace' : player.id === room.hostId ? 'Host' : player.ready && room.phase === 'playing' ? 'Ready to pass it on' : room.phase === 'playing' ? 'Making something wacky' : 'Ready for a little chaos';
      main.append(name, detail); row.append(main);
      if (player.ready && room.phase === 'playing') { const ready = document.createElement('span'); ready.className = 'player-status'; ready.textContent = '✓'; ready.setAttribute('aria-label', 'Ready'); row.append(ready); }
      if (host && player.id !== state.user?.id && !player.kicked && room.phase !== 'complete') {
        const buttons = document.createElement('div'); buttons.className = 'moderation';
        for (const kind of ['kick', 'ban']) { const button = document.createElement('button'); button.textContent = kind === 'kick' ? 'Remove' : 'Ban'; button.addEventListener('click', async () => { const generation = state.generation; const label = kind === 'ban' ? 'Ban' : 'Remove'; if (await confirmAction(`${label} ${player.username}?`, kind === 'ban' ? 'They will not be able to join this room again.' : 'They will lose their seat in this room.', label) && generation === state.generation) action(kind, { playerId: player.id }).catch(error => toast(error.message)); }); buttons.append(button); }
        row.append(buttons);
      }
      fragment.append(row);
    }
    $('players').replaceChildren(fragment);
  }
  function renderTask(room) {
    const task = room.task;
    if (!task) { $('task-title').textContent = 'Getting your next page ready…'; return; }
    const key = `${room.code}:${task.round}:${task.chainId}:${task.kind}`;
    $('round-label').textContent = `ROUND ${task.round + 1} OF ${room.roundCount}`;
    const readyCount = room.players.filter(player => player.ready).length;
    $('ready-status').textContent = `${readyCount} / ${room.players.length} ready`;
    $('submit').textContent = task.ready ? 'Ready · Keep editing' : "I’m ready  ✓";
    $('submit').disabled = state.submitting || (!!task.ready && !state.dirty);
    if (key === state.taskKey) return;
    clearTimeout(state.saveTimer); state.saveTimer = null;
    if (state.drawing) { state.drawing.destroy(); state.drawing = null; }
    state.taskKey = key; state.revision = 0; state.savedRevision = 0; state.dirty = false;
    const drawing = task.kind === 'draw', icebreaker = roomSettings(room).mode === 'icebreaker';
    $('task-title').textContent = icebreaker ? (drawing ? 'Draw your answer.' : 'Ask a little something.') : drawing ? 'Draw what you read.' : task.kind === 'guess' ? 'What on earth is that?' : 'Start a little something.';
    $('task-instruction').textContent = icebreaker ? (drawing ? 'Draw your own answer to this original question. Everyone answers the same question in their own way.' : 'Write a question your friends can answer with a drawing. Try a favorite thing, a memory, or a little about themselves.') : drawing ? 'Turn this phrase into a picture. Artistic talent is entirely optional.' : task.kind === 'guess' ? 'Give this drawing your best guess. Your words become the next picture.' : 'Write a funny, drawable phrase. The more specific, the better the detour.';
    $('source').replaceChildren(); show('source', !!task.prompt);
    if (task.prompt?.image) { const image = document.createElement('img'); image.src = safeImage(task.prompt.image); image.alt = 'The previous player’s drawing to guess'; $('source').append(image); }
    else if (task.prompt) $('source').textContent = task.prompt.text || 'No prompt arrived. Take it somewhere wacky.';
    show('drawing-work', drawing); show('text-work', !drawing);
    $('answer-label').textContent = icebreaker ? 'Your question for your friends' : task.kind === 'guess' ? 'Your best guess' : 'Your opening phrase';
    $('answer').placeholder = icebreaker ? 'What would your dream weekend look like?' : task.kind === 'guess' ? 'I think that might be…' : 'A very serious frog running a tiny bakery…';
    $('answer').value = task.submission?.text || ''; updateCharacters();
    $('save-state').textContent = 'Your draft saves automatically'; $('drawing-save').textContent = 'Your drawing saves automatically';
    if (drawing) {
      if (window.WackyDrawing?.create) state.drawing = window.WackyDrawing.create($('drawing'), { initial: task.submission?.image || null, onChange: () => changed(true) });
      else { $('drawing').textContent = 'The drawing tools could not load. Refresh to reconnect.'; toast('Drawing tools are unavailable. Please refresh the game.'); }
    }
  }
  function safeImage(value) { return typeof value === 'string' && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value) ? value : ''; }
  function updateCharacters() { $('characters').textContent = `${$('answer').value.length} / 500`; }
  function changed(drawing = false) {
    if (!state.room?.task || state.room.phase !== 'playing') return;
    state.dirty = true; state.revision++;
    const label = drawing ? 'drawing-save' : 'save-state'; $(label).textContent = 'Saving your draft…';
    // A changed ready submission becomes editable again on the server.
    $('submit').disabled = false; $('submit').textContent = "I’m ready  ✓";
    if (state.room.task.ready && !state.saving) { saveDraft(false).catch(error => { $(label).textContent = 'Draft not saved. Reconnecting…'; toast(error.message); }); return; }
    clearTimeout(state.saveTimer); state.saveTimer = setTimeout(() => saveDraft(false).catch(error => { $(label).textContent = 'Draft not saved. Reconnecting…'; toast(error.message); }), drawing ? 2000 : 1000);
  }
  function payload() {
    const task = state.room?.task;
    if (!task) return null;
    return task.kind === 'draw' ? { round: task.round, image: state.drawing?.getImage() || '' } : { round: task.round, text: $('answer').value.trim() };
  }
  function saveDraft(ready) {
    const key = state.taskKey, generation = state.generation;
    const run = state.saveQueue.catch(() => {}).then(() => {
      if (key !== state.taskKey || generation !== state.generation) return;
      return persistDraft(ready, generation);
    });
    state.saveQueue = run;
    return run;
  }
  async function persistDraft(ready, generation) {
    const key = state.taskKey, revision = state.revision, data = payload();
    if (!data || state.room?.phase !== 'playing') return;
    if (ready && !(data.text || data.image)) { toast('Add a little something before passing it on.'); return; }
    if (data.image && (data.image.length > 120000 || !safeImage(data.image))) throw new Error('That drawing is too large to save. Please try a simpler drawing.');
    clearTimeout(state.saveTimer); state.saveTimer = null;
    if (ready) { state.submitting = true; $('submit').disabled = true; }
    state.saving++;
    try {
      const endpoint = ready || state.room.task.ready ? 'ready' : 'draft';
      const result = await send(`/phone/${encodeURIComponent(state.room.code)}/${endpoint}`, 'POST', { ...data, ready: !!ready });
      if (generation !== state.generation || !state.room) return;
      if (state.taskKey === key && state.revision === revision) { state.dirty = false; state.savedRevision = revision; $('save-state').textContent = 'Draft saved'; $('drawing-save').textContent = 'Drawing saved'; }
      if (result.room) acceptRoom(result.room);
    } finally { state.saving--; state.submitting = false; if (state.room?.task && state.taskKey === key) $('submit').disabled = !!state.room.task.ready && !state.dirty; }
  }
  function renderReveal(room, host) {
    const reveal = room.reveal;
    if (!reveal?.chains?.length) return;
    for (const chain of reveal.chains) { if (chain.entries?.length) state.chainCache.set(chain.chainId, chain.entries); }
    const key = JSON.stringify({ chainIndex: reveal.chainIndex, stepIndex: reveal.stepIndex, chains: reveal.chains });
    show('back-lobby', room.phase === 'complete');
    show('advance', host && room.phase === 'reveal');
    $('reveal-wait').textContent = room.phase === 'complete' ? 'Rooms expire after 24 hours. Save your favorite chains before then. Head back to the lobby when you’re ready for another game.' : host ? 'You set the pace. Give everyone a moment to enjoy the mix-up.' : 'Your host will reveal the next step.';
    $('reveal-title').textContent = room.phase === 'complete' ? 'Look what you all made.' : 'Well, that took a turn.';
    $('reveal-count').textContent = `${reveal.chainIndex + 1} / ${room.roundCount} CHAINS`;
    if (state.revealKey === key && state.renderedChain === state.viewedChain) return;
    if (state.revealKey !== key) state.viewedChain = reveal.chains[reveal.chainIndex]?.chainId ?? reveal.chains[reveal.chains.length - 1].chainId;
    state.revealKey = key;
    const selected = reveal.chains.find(chain => chain.chainId === state.viewedChain) || reveal.chains[reveal.chains.length - 1];
    state.viewedChain = selected.chainId; state.renderedChain = selected.chainId;
    const tabs = document.createDocumentFragment();
    reveal.chains.forEach((chain, index) => { if (!chain.entries?.length && !chain.fullyRevealed && !state.chainCache.has(chain.chainId)) return; const button = document.createElement('button'); button.textContent = `Chain ${index + 1}`; button.className = chain.chainId === selected.chainId ? 'active' : ''; button.addEventListener('click', async () => { state.viewedChain = chain.chainId; if (chain.fullyRevealed && chain.chainId !== state.room.reveal.chainIndex) { button.disabled = true; try { const result = await action('download', { chainId: chain.chainId }); if (result.chain?.entries) state.chainCache.set(chain.chainId, result.chain.entries); } catch (error) { toast(error.message); } finally { button.disabled = false; } } state.renderedChain = null; renderReveal(state.room, state.room.hostId === state.user?.id); }); tabs.append(button); });
    $('chain-tabs').replaceChildren(tabs);
    const entries = document.createDocumentFragment();
    for (const entry of (selected.entries?.length ? selected.entries : state.chainCache.get(selected.chainId) || [])) {
      const article = document.createElement('article'); article.className = 'chain-entry';
      const entryKey = `${room.code}:${selected.chainId}:${entry.round}`;
      if (!state.seenEntries.has(entryKey)) { article.classList.add('just-revealed'); state.seenEntries.add(entryKey); }
      const meta = document.createElement('div'); meta.className = 'entry-meta';
      const author = document.createElement('span'); author.textContent = `${entry.username || 'A mystery friend'} · ${entry.kind === 'draw' ? 'drew' : entry.kind === 'guess' ? 'guessed' : 'started with'}`;
      const report = document.createElement('button'); report.textContent = 'Report'; report.addEventListener('click', () => { state.report = { chainId: selected.chainId, round: entry.round }; $('report-reason').value = ''; $('report-dialog').showModal(); }); meta.append(author, report); article.append(meta);
      if (entry.image) { const image = document.createElement('img'); image.src = safeImage(entry.image); image.alt = `Drawing by ${entry.username || 'a player'}`; article.append(image); }
      else { const words = document.createElement('p'); words.textContent = entry.text || (entry.skipped ? 'This page was left blank.' : 'A mysterious blank page.'); article.append(words); }
      entries.append(article);
    }
    $('chain').replaceChildren(entries);
    $('download').disabled = !selected.fullyRevealed && (state.chainCache.get(selected.chainId)?.length || selected.entries?.length || 0) < room.roundCount;
    $('download').title = $('download').disabled ? 'Available when every step of this chain has been revealed' : 'Download this chain as an image';
  }
  function tick() {
    const room = state.room;
    if (!room || room.phase !== 'playing' || !room.deadline) return;
    const seconds = Math.max(0, Math.ceil((Number(room.deadline) - Date.now() - state.offset) / 1000));
    $('timer').textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    $('timer').classList.toggle('urgent', seconds <= 10);
    const duration = Number(room.roundDurationMs) > 0 ? Number(room.roundDurationMs) / 1000 : (room.task?.kind === 'draw' ? 90 : 45) * (roomSettings(room).timerPreset === 'relaxed' ? 2 : 1);
    $('timer').style.setProperty('--remaining', `${Math.min(1, seconds / duration) * 100}%`);
    if (seconds === 0) $('ready-status').textContent = 'Time’s up. Passing the pages…';
  }
  async function poll() {
    if (!state.room || document.hidden || state.polling) return;
    state.polling = true;
    const generation = state.generation;
    try { const result = await send(`/phone/${encodeURIComponent(state.room.code)}`); if (generation !== state.generation || !state.room) return; if (result.room) acceptRoom(result.room); if (state.dirty && !state.saving && !state.saveTimer) saveDraft(false).catch(() => {}); }
    catch (error) {
      if (generation !== state.generation || !state.room) return;
      if ([403, 404, 410].includes(error.status)) { leaveView(); toast(error.message); }
      else show('connection', true);
    } finally { state.polling = false; }
  }
  function leaveView() {
    state.generation++; state.settingsPending = false; state.starting = false; clearTimeout(state.saveTimer); state.saveTimer = null; state.dirty = false; state.room = null; state.taskKey = ''; state.revealKey = ''; state.viewedChain = null; state.chainCache.clear(); state.seenEntries.clear(); state.renderedChain = null;
    state.drawing?.destroy(); state.drawing = null;
    placeWaitingPad();
    show('room', false); show('welcome', true); show('leave', false); localSet(''); show('rejoin', false);
  }
  async function enter(kind, code) {
    if (requestPending) return;
    requestPending++; const generation = ++state.generation; $('create').disabled = true;
    try { const result = await send(`/phone/${kind}`, 'POST', kind === 'join' ? { code: code.trim().toUpperCase() } : {}); if (result.room && generation === state.generation) acceptRoom(result.room); }
    catch (error) { toast(error.message); if (kind === 'join' && [403, 404, 410].includes(error.status)) { localSet(''); show('rejoin', false); } }
    finally { requestPending--; $('create').disabled = false; }
  }
  async function downloadChain() {
    $('download').disabled = true;
    try {
      const result = await action('download', { chainId: state.viewedChain }); const chain = result.chain;
      if (!chain?.entries?.length) throw new Error('This chain is not ready to save yet.');
      const width = 1000, pad = 60, cards = [];
      for (const entry of chain.entries) {
        let image = null;
        if (entry.image && safeImage(entry.image)) { image = new Image(); image.src = safeImage(entry.image); await image.decode(); }
        const words = entry.text || 'This page was left blank.';
        cards.push({ entry, image, words, height: image ? 520 : 170 + Math.ceil(words.length / 52) * 28 });
      }
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = 170 + cards.reduce((sum, card) => sum + card.height + 24, 0) + 60;
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#f2efe6'; ctx.fillRect(0, 0, width, canvas.height); ctx.fillStyle = '#262a26'; ctx.font = 'bold 44px sans-serif'; ctx.fillText('Wacky Phone', pad, 80); ctx.font = '20px sans-serif'; ctx.fillText(`Room ${state.room.code} · A wonderfully mixed message`, pad, 120);
      let y = 170;
      for (const card of cards) {
        ctx.fillStyle = '#fffdf7'; ctx.fillRect(pad, y, width - pad * 2, card.height); ctx.fillStyle = '#72736b'; ctx.font = '18px sans-serif'; ctx.fillText(`${card.entry.username || 'A friend'} · ${card.entry.kind}`, pad + 28, y + 38);
        if (card.image) { const ratio = Math.min((width - 2 * pad - 56) / card.image.width, 420 / card.image.height); ctx.drawImage(card.image, (width - card.image.width * ratio) / 2, y + 65, card.image.width * ratio, card.image.height * ratio); }
        else { ctx.fillStyle = '#262a26'; ctx.font = '26px sans-serif'; const words = card.words.split(/\s+/); let line = '', lineY = y + 88; for (const word of words) { if (ctx.measureText(`${line} ${word}`).width > width - 2 * pad - 56 && line) { ctx.fillText(line, pad + 28, lineY); lineY += 34; line = word; } else line = line ? `${line} ${word}` : word; } ctx.fillText(line, pad + 28, lineY); }
        y += card.height + 24;
      }
      await new Promise(resolve => canvas.toBlob(blob => { if (!blob) { resolve(); return; } const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = `wacky-phone-${state.room.code}-chain.png`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); resolve(); }, 'image/png'));
      toast('Your chain is ready to keep.');
    } catch (error) { toast(error.message); } finally { $('download').disabled = false; }
  }
  $('answer').addEventListener('input', () => { updateCharacters(); changed(); });
  $('submit').addEventListener('click', () => saveDraft(true).catch(error => toast(error.message)));
  $('create').addEventListener('click', () => enter('create'));
  $('join-form').addEventListener('submit', event => { event.preventDefault(); enter('join', $('code').value); });
  $('rejoin').addEventListener('click', () => enter('join', localGet()));
  $('login').addEventListener('click', () => window.parent.postMessage({ type: 'bww:phone-login' }, window.location.origin));
  $('leave').addEventListener('click', leaveRoom);
  $('back-lobby').addEventListener('click', leaveRoom);
  document.querySelectorAll('[data-setting]').forEach(button => button.addEventListener('click', () => changeSettings(button.dataset.setting, button.dataset.value)));
  $('start').addEventListener('click', async () => {
    if (!state.room || state.room.phase !== 'lobby' || state.room.hostId !== state.user?.id || state.settingsPending || state.starting || state.room.players.length < (state.room.minPlayers || 4)) return;
    const generation = state.generation;
    state.starting = true; renderSettings(state.room, true);
    try { await action('start'); } catch (error) { if (generation === state.generation) toast(error.message); }
    finally { if (generation === state.generation) { state.starting = false; if (state.room?.phase === 'lobby') renderSettings(state.room, state.room.hostId === state.user?.id); } }
  });
  $('copy-code').addEventListener('click', async () => { try { await navigator.clipboard.writeText(state.room.code); toast('Room code copied. Send it to your friends!'); } catch { toast(`Your room code is ${state.room.code}`); } });
  $('advance').addEventListener('click', async () => { $('advance').disabled = true; try { await action('reveal', { advance: true }); } catch (error) { toast(error.message); } finally { $('advance').disabled = false; } });
  $('download').addEventListener('click', downloadChain);
  $('cancel-report').addEventListener('click', () => $('report-dialog').close());
  $('report-form').addEventListener('submit', async event => { event.preventDefault(); const button = event.submitter; button.disabled = true; try { await action('report', { ...state.report, reason: $('report-reason').value.trim() }); $('report-dialog').close(); toast('Report sent. Thank you for helping keep things friendly.'); } catch (error) { toast(error.message); } finally { button.disabled = false; } });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); else if (state.dirty) saveDraft(false).catch(() => {}); });
  window.addEventListener('online', poll);
  setInterval(poll, 3000); setInterval(tick, 250);
  async function init() {
    placeWaitingPad();
    window.parent.postMessage({ type: 'bww:phone-ready' }, window.location.origin);
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await send('/phone/me'); state.user = result.user;
        show('account-check', false); show('account-required', !state.user); show('entry-actions', !!state.user);
        if (state.user) { $('greeting').textContent = `HELLO, ${state.user.username || 'FRIEND'}`; const previous = localGet(); if (previous) { show('rejoin', true); $('rejoin').textContent = `Return to room ${previous}`; await enter('join', previous); } }
        return;
      } catch (error) {
        if (error.status === 401) { show('account-check', false); show('account-required', true); return; }
        if (attempt === 2) { $('account-check').replaceChildren(); const heading = document.createElement('h2'); heading.textContent = 'Couldn’t connect just yet.'; const retry = document.createElement('button'); retry.className = 'primary'; retry.textContent = 'Try again'; retry.addEventListener('click', init); $('account-check').append(heading, retry); toast(error.message); }
        else await new Promise(resolve => setTimeout(resolve, 1200));
      }
    }
  }
  init();
})();
