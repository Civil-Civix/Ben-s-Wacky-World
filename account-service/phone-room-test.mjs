// Native SQLite harness for the DO adapter, with only the Cloudflare base class
// and alarm transport replaced. No browser or production services are contacted.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
const source = (await readFile(new URL('./phone-room.mjs', import.meta.url), 'utf8'))
  .replace("import { DurableObject } from 'cloudflare:workers';", 'class DurableObject { constructor(ctx, env) { this.ctx = ctx; this.env = env; } }')
  .replace("'./phone-engine.mjs'", JSON.stringify(new URL('./phone-engine.mjs', import.meta.url).href));
const {PhoneRoom} = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
function context() {
  const db = new DatabaseSync(':memory:');
  return {db, storage: {
    sql: {exec(query,...bindings) { const stmt=db.prepare(query); const rows=stmt.all(...bindings); return {toArray:()=>rows}; }},
    transactionSync(fn) { db.exec('BEGIN'); try { const result=fn(); db.exec('COMMIT'); return result; } catch(e) { db.exec('ROLLBACK'); throw e; } },
    async setAlarm(time) { this.alarmTime=time; },
    async deleteAll() { db.exec('DROP TABLE IF EXISTS phone_entries; DROP TABLE IF EXISTS phone_meta'); this.deleted=true; },
  }};
}
test('SQLite adapter persists across instance reconstruction and serializes simultaneous ready submissions',async()=>{
  const ctx=context(); let room=new PhoneRoom(ctx,{});
  const users=Array.from({length:4},(_,i)=>({id:`u${i}`,username:`P${i}`}));
  assert.equal((await room.command(null,'create',{code:'ABC123'})).status,401);
  await room.command(users[0],'create',{code:'ABC123'});
  for(let i=1;i<4;i++) await room.command(users[i],'join');
  assert.equal((await room.command(users[0],'start')).room.phase,'playing');
  room=new PhoneRoom(ctx,{});
  const results=await Promise.all(users.map((u,i)=>room.command(u,'ready',{round:0,text:`text ${i}`})));
  assert.ok(results.every(r=>!r.error));
  const state=(await room.command(users[0],'state')).room;
  assert.equal(state.round,1); assert.equal(state.task.prompt.text,'text 3');
  assert.equal(ctx.db.prepare('SELECT COUNT(*) AS n FROM phone_entries').get().n,4);
  assert.equal((await room.command(users[0],'ready',{round:0,text:'late'})).status,409);
  assert.equal(ctx.db.prepare('SELECT COUNT(*) AS n FROM phone_entries').get().n,4);
  assert.equal(ctx.db.prepare('SELECT length(data) AS n FROM phone_meta').get().n < 5000,true);
  ctx.db.close();
});
test('exact deadline rejects stale submissions and alarm finalizes once, then expiry clears storage',async()=>{
  const originalNow=Date.now; let now=1000; Date.now=()=>now;
  const ctx=context();
  try {
    const room=new PhoneRoom(ctx,{}), users=Array.from({length:4},(_,i)=>({id:`u${i}`,username:`P${i}`}));
    await room.command(users[0],'create',{code:'ABC123'});
    for(let i=1;i<4;i++) await room.command(users[i],'join');
    const started=(await room.command(users[0],'start')).room;
    // Keep leases connected up to the boundary, so no reconnect extension.
    now=started.deadline-1000; for(const u of users) await room.command(u,'state');
    // Above keepalive detects a disconnect and extends; use the persisted clock.
    const deadline=(await room.command(users[0],'state')).room.deadline;
    for(let t=now+5000;t<deadline;t+=5000) {now=t; for(const u of users) await room.command(u,'state');}
    now=deadline; assert.equal((await room.command(users[0],'draft',{round:0,text:'late'})).status,409);
    await room.alarm(); const state=(await room.command(users[0],'state')).room;
    assert.equal(state.round,1); assert.ok(ctx.storage.alarmTime>now);
    await room.alarm(); assert.equal((await room.command(users[0],'state')).room.round,1);
    now=started.expiresAt; await room.alarm(); assert.equal(ctx.storage.deleted,true);
  } finally {Date.now=originalNow; ctx.db.close();}
});
