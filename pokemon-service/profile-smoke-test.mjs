// Creates two disposable site profiles; delete their printed IDs after the check.
import {randomBytes} from 'node:crypto';
const api='https://bens-wacky-accounts.mr-ellis1009.workers.dev';
async function request(path,data,cookie=''){
 const r=await fetch(api+path,{method:'POST',headers:{Origin:'https://civil-civix.github.io','X-Wacky-Client':'1','Content-Type':'application/json',Cookie:cookie,'User-Agent':'Mozilla/5.0'},body:JSON.stringify(data)});
 const result=await r.json();if(!r.ok)throw Error(path+': '+JSON.stringify(result));return {data:result,cookie:r.headers.get('set-cookie')?.split(';')[0]};
}
const endpoint = process.argv[2] || 'wss://bens-pokemon.129-146-183-45.sslip.io/showdown/websocket';
const clients = [];
const mode = process.argv[3] || 'challenge';
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
  else console.log(`PASS: two site profiles connected via ${mode}, played three turns, and received the battle result${mode === 'search' ? ' twice, including an immediate rematch' : ''}.`);
}
async function connect(index) {
    const username=`BattleTest${index}${suffix}`;
    const registered=await request('/signup',{username,password:randomBytes(24).toString('hex'),noRecovery:true});
    const cookie=registered.cookie,name='bww'+registered.data.user.id.replaceAll('-','');
    console.log('Temporary profile: '+registered.data.user.id+' '+username);
  return new Promise((resolve,reject)=>{
    const ws = new WebSocket(endpoint);
    const client = { name, cookie, id:registered.data.user.id, ws, ready: false, room: '', lastRequest: null, forfeited: false };
    clients.push(client);
    ws.onopen = () => console.log(`Profile ${index} socket open`);
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
            const session=await request('/battle/session',{challenge:challstr.split('|')[1]},cookie);
            ws.send(`|/trn ${name},0,BWW:${session.data.token}`);
          }
          if (line.startsWith('|updateuser|') && line.split('|')[2].trim() === name && line.split('|')[3] === '1' && !client.ready) {
            client.ready = true;
            console.log(`Profile ${index} connected`);
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
  } else {
    const invitation=await request('/battle/invites',{to:b.id},a.cookie);
    await request('/battle/invites/'+invitation.data.id,{action:'accept'},b.cookie);
    a.ws.send(`|/challenge ${b.name},gen9randombattle`);
  }
} catch (error) { finish(error); }
