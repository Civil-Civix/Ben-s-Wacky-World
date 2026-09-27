// Two temporary guest players exercise the public TLS/WebSocket battle path.
const endpoint = process.argv[2] || 'wss://bens-pokemon.129-146-183-45.sslip.io/showdown/websocket';
const assertionEndpoint = process.argv[3] || 'https://play.pokemonshowdown.com/action.php';
const clients = [];
const mode = process.argv[4] || 'challenge';
if (!['challenge', 'search'].includes(mode)) throw new Error('Mode must be challenge or search');
const suffix = Date.now().toString(36);
let finished = false;
let round = 1;
const results = new Set();
const timer = setTimeout(() => finish(new Error('Battle test timed out')), 90000);
function finish(error) {
  if (finished) return;
  finished = true;
  clearTimeout(timer);
  for (const c of clients) { if (c.ws.readyState === WebSocket.OPEN) c.ws.send('|/cancelsearch'); c.ws.close(); }
  if (error) { console.error(error.message); process.exitCode = 1; }
  else console.log(`PASS: two guests connected via ${mode}, played three turns, and received the battle result${mode === 'search' ? ' twice, including an immediate rematch' : ''}.`);
}
function connect(index) {
  return new Promise((resolve, reject) => {
    const name = `BwwTest${index}${suffix}`;
    const ws = new WebSocket(endpoint);
    const client = { name, ws, ready: false, room: '', lastRequest: null, forfeited: false };
    clients.push(client);
    ws.onopen = () => console.log(`Guest ${index} socket open`);
    ws.onerror = () => { reject(new Error('WebSocket connection failed')); finish(new Error('WebSocket connection failed')); };
    ws.onmessage = async ({data}) => {
      try {
        const lines = String(data).split('\n');
        const room = lines[0].startsWith('>') ? lines.shift().slice(1) : '';
        for (const line of lines) {
          if (line.startsWith('|popup|')) throw new Error(line);
          if (index === 2 && line.startsWith('|pm|') && line.includes('|/challenge gen9randombattle|')) {
            ws.send(`|/accept ${clients[0].name}`);
          }
          if (line.startsWith('|challstr|')) {
            const challstr = line.slice('|challstr|'.length);
            const response = await fetch(assertionEndpoint, {
              method: 'POST', headers: {Origin: new URL(assertionEndpoint).origin}, body: new URLSearchParams({act:'getassertion', userid:name.toLowerCase(), challstr}), signal: AbortSignal.timeout(15000),
            });
            const assertion = await response.text();
            if (!response.ok || assertion.startsWith(';') || assertion.length < 20) throw new Error('Guest assertion failed');
            ws.send(`|/trn ${name},0,${assertion}`);
          }
          if (line.startsWith('|updateuser|') && line.split('|')[2].trim() === name && line.split('|')[3] === '1' && !client.ready) {
            client.ready = true;
            console.log(`Guest ${index} connected`);
            resolve(client);
          }
          if (line.startsWith('|updatechallenges|') && index === 2) {
            const challenge = JSON.parse(line.slice(18));
            if (challenge.challengesFrom?.[clients[0].name.toLowerCase()]) ws.send(`|/accept ${clients[0].name}`);
          }
          if (room.startsWith('battle-')) {
            if (line === '|init|battle') {
              if (index === 1) console.log(`Battle room: ${room}`);
              client.room = room;
            }
            if (line === '|turn|3' && index === 1 && !client.forfeited) {
              client.forfeited = true; ws.send(`${room}|/forfeit`);
            }
            if (line.startsWith('|request|') && !clients[0].forfeited) {
              const req = JSON.parse(line.slice(9) || 'null');
              if (req && !req.wait && req.rqid !== client.lastRequest) {
                client.lastRequest = req.rqid;
                ws.send(`${room}|/choose default|${req.rqid}`);
              }
            }
            if (line.startsWith('|win|') && clients[0].forfeited) {
              results.add(index);
              if (results.size === 2) {
                if (mode === 'search' && round === 1) {
                  round++;
                  results.clear();
                  for (const c of clients) {
                    c.ws.send(`${c.room}|/leave`);
                    c.room = ''; c.lastRequest = null; c.forfeited = false;
                    c.ws.send('|/search gen9randombattle');
                  }
                } else finish();
              }
            }
          }
          // A queued choice can arrive after the other guest's scripted forfeit.
          if (line === "|error|[Invalid choice] There's nothing to choose" && clients[0].forfeited) continue;
          if (line.startsWith('|nametaken|') || line.startsWith('|error|')) throw new Error(line);
        }
      } catch (error) { reject(error); finish(error); }
    };
  });
}
try {
  const a = await connect(1);
  const b = await connect(2);
  if (mode === 'search') {
    a.ws.send('|/search gen9randombattle');
    b.ws.send('|/search gen9randombattle');
  } else a.ws.send(`|/challenge ${b.name},gen9randombattle`);
} catch (error) { finish(error); }
