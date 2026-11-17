import test from 'node:test';
import assert from 'node:assert/strict';
import { execute, tick, view, chainFor, kindFor, GRACE, TTL } from './phone-engine.mjs';

const png = 'data:image/png;base64,iVBORw0KGgo=';
function harness(count = 4) {
  let state = null, now = 1000; const rows = new Map();
  const users = Array.from({length:count}, (_,i) => ({id:`u${i}`,username:`Player ${i}`}));
  const store = {get:(c,r)=>rows.get(`${c}:${r}`) || null,put:(c,r,v)=>rows.set(`${c}:${r}`,structuredClone(v))};
  const run = (i,action,data={}) => { const out=execute(state, typeof i === 'number' ? users[i] : i,action,data,store,now); state=out.state; return out.result; };
  run(0,'create',{code:'ABC123'}); for(let i=1;i<count;i++) run(i,'join');
  return {run,users,rows,store,get state(){return state},get now(){return now},set now(n){now=n},tick(){tick(state,store,now)}};
}
test('rotation visits each seat and chain once for odd and even counts 4–10',()=>{
  for(let n=4;n<=10;n++) for(let seat=0;seat<n;seat++) assert.equal(new Set(Array.from({length:n},(_,r)=>chainFor(seat,r,n))).size,n);
});
test('host, size, authentication and private room membership are enforced',()=>{
  const h=harness(); assert.throws(()=>h.run(1,'start'),/host/); assert.throws(()=>h.run(null,'state'),/Sign in/);
  assert.throws(()=>h.run(0,'state',42),/Invalid room request/);
  assert.throws(()=>h.run({id:'stranger',username:'x'},'state'),/member/); h.run(0,'start');
  assert.throws(()=>h.run({id:'late',username:'late'},'join'),/already started/);
  assert.throws(()=>h.run(1,'remove-entry',{chainId:0,round:0}),/owner/);
});
test('ready is editable, autosaves drafts, and all ready advance exactly once',()=>{
  const h=harness(); h.run(0,'start'); h.run(0,'draft',{round:0,text:'first'});
  assert.equal(h.run(0,'state').room.task.submission.text,'first');
  h.run(0,'ready',{round:0,text:'second'}); h.run(0,'ready',{round:0,ready:false});
  assert.equal(h.run(0,'state').room.task.ready,false);
  for(let i=0;i<4;i++) h.run(i,'ready',{round:0,text:`secret ${i}`});
  assert.equal(h.state.round,1); assert.throws(()=>h.run(0,'ready',{round:0,text:'stale'}),/ended/);
  assert.equal(h.rows.size,4); assert.equal(h.run(0,'state').room.task.prompt.text,'secret 3');
});
test('playing DTO reveals only own draft and immediately previous assigned entry',()=>{
  const h=harness(); h.run(0,'start'); h.run(1,'draft',{round:0,text:'other secret'});
  const dto=h.run(0,'state').room; assert.equal(dto.task.prompt,null); assert.equal(dto.task.submission,null);
  assert.ok(!JSON.stringify(dto).includes('other secret')); assert.equal(dto.reveal,null);
  assert.throws(()=>h.run(0,'report',{chainId:1,round:0,reason:'peek'}),/not available/);
});
test('single thirty-second clock extension, reconnect once, disconnected skip and host transfer',()=>{
  const h=harness(); h.run(0,'start'); const deadline=h.state.deadline;
  h.now+=16000; for(let i=1;i<4;i++) h.run(i,'state');
  assert.equal(h.state.deadline,deadline+GRACE); h.run(0,'state');
  h.now+=16000; for(let i=1;i<4;i++) h.run(i,'state');
  assert.equal(h.state.deadline,deadline+GRACE);
  for(let t=0;t<3;t++) { h.now+=10000; for(let i=1;i<4;i++) h.run(i,'state'); }
  h.now+=1001; h.run(1,'state'); assert.equal(h.state.hostId,'u1');
  assert.equal(h.state.players[0].skipped,true);
});
test('all rounds, simultaneous drawing, reveal privacy, downloads, reports and removal',()=>{
  for(const n of [4,5]) {
    const h=harness(n); h.run(0,'start');
    for(let r=0;r<n;r++) for(let i=0;i<n;i++) h.run(i,'ready',{round:r,...(kindFor(r)==='draw'?{image:png}:{text:`r${r} player${i}`})});
    assert.equal(h.state.phase,'reveal'); let room=h.run(0,'state').room;
    assert.equal(room.reveal.chains[0].entries.length,1); assert.equal(room.reveal.chains[1].entries.length,0);
    assert.throws(()=>h.run(0,'download',{chainId:0}),/entire chain/);
    assert.throws(()=>h.run(0,'report',{chainId:1,round:1,reason:'hidden'}),/not available/);
    const report=h.run(0,'report',{chainId:0,round:0,reason:'review'}).report;
    assert.equal(report.authorId,'u0'); assert.equal(report.text,'r0 player0');
    h.run({id:'owner',username:'Owner',owner:true},'remove-entry',{chainId:0,round:0});
    assert.equal(h.run(0,'state').room.reveal.chains[0].entries[0].text,undefined);
    for(let i=0;i<n*n;i++) { if(h.state.phase==='reveal') h.run(0,'reveal'); }
    assert.equal(h.state.phase,'complete'); assert.equal(h.run(0,'download',{chainId:0}).chain.entries.length,n);
    const final=h.run(0,'state').room;
    assert.equal(final.reveal.chains[0].fullyRevealed,true); assert.equal(final.reveal.chains[0].entryCount,n);
    assert.equal(final.reveal.chains[0].entries.length,0); assert.equal(final.reveal.chains[n-1].entries.length,n);
    assert.equal('scores' in h.run(0,'state').room,false);
    assert.equal('reactions' in final.reveal,false);
    assert.throws(()=>h.run(0,'react',{reaction:'wow'}),/Unknown room action/);
    assert.deepEqual(h.run(0,'leave'),{left:true});
    assert.equal(h.state.phase,'complete');
  }
});
test('timers finalize saved drafts; blank drawing, invalid image, stale and expired actions rejected',()=>{
  const h=harness(); h.run(0,'start'); h.run(0,'draft',{round:0,text:'saved'});
  h.now=h.state.deadline+GRACE+1; h.tick(); assert.equal(h.state.round,1);
  assert.equal(h.store.get(0,0).text,'saved');
  assert.throws(()=>h.run(0,'draft',{round:1,image:'data:image/png;base64,YWJj'}),/Invalid drawing/);
  assert.throws(()=>h.run(0,'ready',{round:1}),/submission/);
  h.now=1000+TTL; assert.throws(()=>h.run(0,'state'),/expired/);
});
test('kick freezes occupied seat then skips it without losing rotation',()=>{
  const h=harness(); h.run(0,'start'); h.run(0,'kick',{playerId:'u1'});
  assert.equal(h.state.players.length,4); assert.throws(()=>h.run(1,'state'),/member/);
  h.now+=GRACE+1; h.tick(); assert.equal(h.state.players[1].skipped,true);
});


test('settings are strict, host-only, lobby-only and returned with legacy defaults',()=>{
  const h=harness(), settings={mode:'icebreaker',timerPreset:'relaxed'};
  assert.deepEqual(h.run(0,'state').room.settings,{mode:'classic',timerPreset:'standard'});
  assert.throws(()=>h.run(null,'settings',settings),/Sign in/);
  assert.throws(()=>h.run({id:'guest',username:'Guest'},'settings',settings),/member/);
  assert.throws(()=>h.run(1,'settings',settings),/host/);
  for(const invalid of [{},{mode:'classic'},{...settings,mode:'unknown'},{...settings,timerPreset:'quick'},{...settings,deadline:1}]) {
    assert.throws(()=>h.run(0,'settings',invalid),/Invalid room settings/);
    assert.deepEqual(h.run(0,'state').room.settings,{mode:'classic',timerPreset:'standard'});
  }
  assert.deepEqual(h.run(0,'settings',settings).room.settings,settings);
  h.run(0,'start');
  assert.throws(()=>h.run(0,'settings',{mode:'classic',timerPreset:'standard'}),/lobby/);
  assert.deepEqual(h.run(0,'state').room.settings,settings);
  const old=harness(); delete old.state.settings;
  assert.deepEqual(old.run(0,'start').room.settings,{mode:'classic',timerPreset:'standard'});
  assert.equal(old.state.deadline-old.now,45000);
  for(let i=0;i<4;i++) old.run(i,'ready',{round:0,text:'legacy'});
  assert.equal(old.run(0,'state').room.task.kind,'draw');
  assert.equal(old.state.deadline-old.now,90000);
});

test('both presets provide the selected duration on every round in both modes',()=>{
  for(const mode of ['classic','icebreaker']) for(const timerPreset of ['standard','relaxed']) {
    const h=harness(5);h.run(0,'settings',{mode,timerPreset});h.run(0,'start');
    for(let round=0;round<5;round++) {
      const kind=kindFor(round,mode),expected=(kind==='draw'?90000:45000)*(timerPreset==='relaxed'?2:1);
      const room=h.run(0,'state').room;
      assert.equal(room.task.kind,kind);assert.equal(room.roundDurationMs,expected);assert.equal(room.deadline-h.now,expected);
      for(let i=0;i<5;i++) h.run(i,'ready',{round,...(kind==='draw'?{image:png}:{text:'text'})});
    }
    assert.equal(h.state.phase,'reveal');
  }
});

test('Icebreaker gives each other player the original question once, keeps drawings private and exports correct kinds',()=>{
  for(let n=4;n<=10;n++) {
    const h=harness(n),seen=Array.from({length:n},()=>new Set());
    h.run(0,'settings',{mode:'icebreaker',timerPreset:'standard'});h.run(0,'start');
    for(let i=0;i<n;i++) h.run(i,'ready',{round:0,text:'question '+i});
    for(let round=1;round<n;round++) {
      for(let i=0;i<n;i++) {
        const dto=h.run(i,'state').room,chain=chainFor(i,round,n);
        assert.equal(dto.roundCount,n);assert.equal(dto.task.kind,'draw');assert.equal(dto.task.chainId,chain);
        assert.equal(dto.task.prompt.text,'question '+chain);assert.equal(dto.task.prompt.round,0);
        assert.equal(dto.task.prompt.kind,'prompt');assert.equal(dto.task.submission,null);assert.equal(dto.reveal,null);
        assert.ok(!JSON.stringify(dto).includes('data:image/'));
        assert.notEqual(chain,i);seen[i].add(chain);
        if(round>1) {
          assert.equal(h.run(i,'report',{chainId:chain,round:0,reason:'question'}).report.text,'question '+chain);
          assert.throws(()=>h.run(i,'report',{chainId:chain,round:round-1,reason:'hidden drawing'}),/not available/);
        }
      }
      assert.throws(()=>h.run(0,'draft',{round,text:'guess'}),/drawing/);
      for(let i=0;i<n;i++) h.run(i,'ready',{round,image:png});
    }
    assert.equal(h.state.phase,'reveal');
    for(const visited of seen) assert.equal(visited.size,n-1);
    for(let i=0;i<n*n;i++) if(h.state.phase==='reveal') h.run(0,'reveal');
    for(let chainId=0;chainId<n;chainId++) {
      const entries=h.run(0,'download',{chainId}).chain.entries;
      assert.equal(entries.length,n);assert.equal(entries[0].kind,'prompt');
      for(const e of entries.slice(1)) {assert.equal(e.kind,'draw');assert.ok(e.image);}
      assert.equal(new Set(entries.map(e=>e.authorId)).size,n);
    }
  }
});

test('Icebreaker deadline finalization preserves draw metadata for saved and skipped entries',()=>{
  const h=harness();h.run(0,'settings',{mode:'icebreaker',timerPreset:'standard'});h.run(0,'start');
  for(let i=0;i<4;i++) h.run(i,'ready',{round:0,text:'question'});
  for(let i=0;i<4;i++) h.run(i,'ready',{round:1,image:png});
  h.run(0,'draft',{round:2,image:png});h.now=h.state.deadline+GRACE+1;h.tick();
  assert.equal(h.state.round,3);
  for(let chain=0;chain<4;chain++) assert.equal(h.store.get(chain,2).kind,'draw');
  assert.equal(h.store.get(chainFor(0,2,4),2).image,png);
  assert.equal(h.store.get(chainFor(1,2,4),2).skipped,true);
});
