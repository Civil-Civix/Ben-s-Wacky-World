// All times are server times. Entries (especially drawings) live outside metadata.
export const LEASE = 15000, GRACE = 30000, TTL = 86400000;
export const kindFor = round => round === 0 ? 'prompt' : round % 2 ? 'draw' : 'guess';
export const chainFor = (seat, round, count) => (seat - round + count) % count;
const fail = (error, status = 400) => { throw Object.assign(new Error(error), { status }); };
const key = (chain, round) => `${chain}:${round}`;
const active = p => !p.kicked;
const connected = (p, now) => active(p) && now < p.lastSeen + LEASE;
function transfer(s, now) {
  const host = s.players.find(p => p.id === s.hostId);
  if (!host || host.kicked || (now >= host.lastSeen + LEASE + GRACE)) {
    const next = s.players.find(p => connected(p, now));
    if (next) s.hostId = next.id;
  }
}
function begin(s, round, now) {
  s.round = round; s.deadline = now + (kindFor(round) === 'draw' ? 90000 : 45000); s.graceExtended = false;
  for (const p of s.players) {
    p.ready = false; p.skipped = false;
    p.graceUsed = !connected(p, now); p.graceUntil = p.graceUsed ? now + GRACE : null;
  }
}
function finish(s, store, now) {
  for (let seat = 0; seat < s.players.length; seat++) {
    const p = s.players[seat], chainId = chainFor(seat, s.round, s.players.length);
    const draft = store.get(chainId, s.round);
    store.put(chainId, s.round, { round: s.round, chainId, kind: kindFor(s.round), authorId: p.id, username: p.username,
      ...(draft && !p.kicked ? draft : { skipped: true }), final: true });
  }
  if (s.round + 1 === s.players.length) {
    s.phase = 'reveal'; s.deadline = null; s.revealChain = 0; s.revealStep = 0;
  } else begin(s, s.round + 1, now);
}
export function tick(s, store, now) {
  if (!s) return;
  transfer(s, now);
  if (s.phase !== 'playing') return;
  for (const p of s.players) {
    if (!connected(p, now) && !p.graceUsed) {
      p.graceUsed = true;
      p.graceUntil = (p.kickedAt ?? p.lastSeen + LEASE) + GRACE;
      if (!s.graceExtended) { s.deadline += GRACE; s.graceExtended = true; }
    }
    if (!p.ready && p.graceUntil !== null && now >= p.graceUntil && !connected(p, now)) p.skipped = true;
  }
  // First disconnection pauses the shared clock for 30 seconds, once per round.
  // Each seat gets one reconnect grace; disconnected empty seats then skip.
  const settled = p => p.ready || p.skipped || (now >= s.deadline &&
    (connected(p, now) || !p.graceUntil || now >= Math.min(p.graceUntil, s.deadline + GRACE)));
  if (s.players.every(settled)) finish(s, store, now);
}
function visible(s, chain, round) {
  return s.phase === 'complete' || (s.phase === 'reveal' && (chain < s.revealChain || (chain === s.revealChain && round <= s.revealStep)));
}
function cleanEntry(e) { if (!e) return null; const { final, ...safe } = e; return safe; }
export function view(s, actor, store, now) {
  const p = s.players.find(p => p.id === actor.id);
  if (!p || p.kicked) fail('You are not a member of this room.', 403);
  const dto = { code: s.code, phase: s.phase, hostId: s.hostId, capacity: 10, minPlayers: 4,
    players: s.players.map(p => ({ id: p.id, username: p.username, connected: connected(p, now), ready: !!p.ready, kicked: !!p.kicked })),
    round: s.round, roundCount: s.players.length, deadline: s.deadline, serverNow: now, expiresAt: s.expiresAt, task: null, reveal: null };
  if (s.phase === 'playing') {
    const chainId = chainFor(s.players.indexOf(p), s.round, s.players.length);
    dto.task = { round: s.round, chainId, kind: kindFor(s.round), prompt: s.round ? cleanEntry(store.get(chainId, s.round - 1)) : null,
      submission: cleanEntry(store.get(chainId, s.round)), ready: !!p.ready };
  }
  if (s.phase === 'reveal' || s.phase === 'complete') dto.reveal = {
    chainIndex: s.revealChain, stepIndex: s.revealStep,
    chains: s.players.map((_, chainId) => ({ chainId,
      fullyRevealed: visible(s, chainId, s.players.length - 1),
      entryCount: s.phase === 'complete' || chainId < s.revealChain ? s.players.length : chainId === s.revealChain ? s.revealStep + 1 : 0,
      entries: chainId === s.revealChain ? s.players.flatMap((_, round) => visible(s, chainId, round) ? [cleanEntry(store.get(chainId, round))] : []) : [] })),
    reactions: s.reactions || [] };
  return dto;
}
function submission(data, kind) {
  if (kind === 'draw') {
    if (typeof data.image !== 'string' || data.image.length > 120000 || !/^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(data.image)) fail('Use a PNG or JPEG drawing smaller than 120 KB.');
    const encoded = data.image.split(',')[1];
    if (encoded.length % 4 || !(data.image.startsWith('data:image/png;') ? encoded.startsWith('iVBORw0KGgo') : encoded.startsWith('/9j/'))) fail('Invalid drawing image.');
    return { image: data.image };
  }
  if (typeof data.text !== 'string' || data.text.trim().length < 1 || data.text.length > 240) fail('Enter 1–240 characters.');
  return { text: data.text.trim() };
}
export function execute(s, actor, action, data, store, now) {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) fail('Invalid room request.');
  if (!actor || typeof actor.id !== 'string' || !actor.id || typeof actor.username !== 'string') fail('Sign in to play.', 401);
  if (action === 'create') {
    if (s) fail('Room already exists.', 409);
    if (!/^[A-Z0-9]{6}$/.test(data.code || '')) fail('Invalid room code.');
    s = { code: data.code, phase: 'lobby', hostId: actor.id, createdAt: now, expiresAt: now + TTL, players: [], bans: [], round: 0, deadline: null };
  }
  if (!s || now >= s.expiresAt) fail('Room expired or not found.', 404);
  if (action === 'remove-entry') {
    if (!actor.owner) fail('Only the owner can remove an entry.', 403);
    if (!Number.isInteger(data.chainId) || !Number.isInteger(data.round) || data.chainId < 0 || data.chainId >= s.players.length || data.round < 0 || data.round >= s.players.length) fail('Invalid entry.');
    const e = store.get(data.chainId, data.round);
    if (!e) fail('Entry not found.', 404);
    const { text, image, ...rest } = e;
    store.put(data.chainId, data.round, { ...rest, removed: true, skipped: true });
    return { state: s, result: { ok: true } };
  }
  let p = s.players.find(p => p.id === actor.id);
  if (action === 'create' || action === 'join') {
    if (s.bans.includes(actor.id) || p?.kicked) fail('You cannot join this room.', 403);
    if (!p) {
      if (s.phase !== 'lobby') fail('This game has already started.', 409);
      if (s.players.length >= 10) fail('Room is full.', 409);
      p = { id: actor.id, username: actor.username.slice(0, 60), lastSeen: now, ready: false }; s.players.push(p);
    }
  }
  if (!p || p.kicked) fail('You are not a member of this room.', 403);
  // Process old leases before marking this request as a reconnection.
  tick(s, store, now);
  p.lastSeen = now;
  transfer(s, now);
  const host = () => { if (actor.id !== s.hostId) fail('Only the host can do that.', 403); };
  let extra = {};
  if (action === 'start') {
    host(); if (s.phase !== 'lobby') fail('Game already started.', 409);
    if (s.players.length < 4 || s.players.some(p => !connected(p, now))) fail('Need 4–10 connected players.');
    s.phase = 'playing'; begin(s, 0, now);
  } else if (action === 'draft' || action === 'ready') {
    if (s.phase !== 'playing' || data.round !== s.round) fail('That round has ended.', 409);
    if (now >= s.deadline || p.skipped) fail('The submission deadline has passed.', 409);
    const chainId = chainFor(s.players.indexOf(p), s.round, s.players.length);
    if ('text' in data || 'image' in data) store.put(chainId, s.round, submission(data, kindFor(s.round)));
    if (action === 'ready') {
      if (data.ready !== false && !store.get(chainId, s.round)) fail('Add a submission before marking ready.');
      p.ready = data.ready !== false;
    }
    tick(s, store, now);
  } else if (action === 'kick' || action === 'ban') {
    host(); const target = s.players.find(p => p.id === data.playerId);
    if (!target || target.id === actor.id) fail('Choose another player.');
    if (action === 'ban' && !s.bans.includes(target.id)) s.bans.push(target.id);
    if (s.phase === 'lobby') s.players = s.players.filter(p => p !== target);
    else { target.kicked = true; target.kickedAt = now; target.ready = false; target.graceUsed = true; target.graceUntil = now + GRACE; }
  } else if (action === 'leave') {
    if (s.phase === 'lobby') s.players = s.players.filter(x => x !== p);
    else p.lastSeen = now - LEASE;
    if (actor.id === s.hostId) { s.hostId = null; transfer(s, now); }
    return { state: s, result: { left: true } };
  } else if (action === 'reveal') {
    host(); if (s.phase !== 'reveal') fail('Nothing to reveal.', 409);
    if (s.revealStep + 1 < s.players.length) s.revealStep++;
    else if (s.revealChain + 1 < s.players.length) { s.revealChain++; s.revealStep = 0; }
    else s.phase = 'complete';
  } else if (action === 'react') {
    if (!['reveal','complete'].includes(s.phase) || !['😂','❤️','👏','😮'].includes(data.reaction)) fail('Invalid reaction.');
    s.reactions = [...(s.reactions || []).filter(x => x.playerId !== actor.id), { playerId: actor.id, reaction: data.reaction, chainId: s.revealChain, round: s.revealStep }];
  } else if (action === 'download' || action === 'report') {
    const chain = data.chainId, round = data.round;
    if (!Number.isInteger(chain) || chain < 0 || chain >= s.players.length) fail('Invalid chain.');
    if (action === 'download') {
      if (!visible(s, chain, s.players.length - 1)) fail('Reveal the entire chain first.', 403);
      extra.chain = { chainId: chain, entries: s.players.map((_, r) => cleanEntry(store.get(chain, r))) };
    } else {
      if (!Number.isInteger(round) || round < 0 || round >= s.players.length) fail('Invalid entry.');
      const e = store.get(chain, round), seat = s.players.indexOf(p);
      const ownPrompt = s.phase === 'playing' && chain === chainFor(seat, s.round, s.players.length) && round === s.round - 1;
      if (!e || (!visible(s, chain, round) && e.authorId !== actor.id && !ownPrompt)) fail('That entry is not available to you.', 403);
      if (typeof data.reason !== 'string' || !data.reason.trim() || data.reason.length > 1000) fail('Provide a report reason (up to 1000 characters).');
      extra.report = { code: s.code, chainId: chain, round, reporterId: actor.id, reason: data.reason.trim(), entry: cleanEntry(e),
        authorId: e.authorId, authorName: e.username, kind: e.kind, ...(e.text ? {text:e.text} : {}), ...(e.image ? {image:e.image} : {}), createdAt: now };
    }
  } else if (!['create','join','state','heartbeat'].includes(action)) fail('Unknown room action.', 404);
  return { state: s, result: { room: view(s, actor, store, now), ...extra } };
}
export function nextAlarm(s, now) {
  if (!s) return null;
  const times = [s.expiresAt];
  if (s.phase !== 'playing') return s.expiresAt;
  for (const p of s.players) {
    if (!p.kicked && p.lastSeen + LEASE > now) times.push(p.lastSeen + LEASE);
    if (!p.kicked && p.lastSeen + LEASE + GRACE > now) times.push(p.lastSeen + LEASE + GRACE);
    if (s.phase === 'playing' && p.graceUntil > now) times.push(p.graceUntil);
  }
  if (s.phase === 'playing') times.push(s.deadline > now ? s.deadline : s.deadline + GRACE);
  return Math.max(now + 1, Math.min(...times.filter(t => t > now)));
}
