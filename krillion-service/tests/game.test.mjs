import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker, { validateReference, syncPuzzle, encodePuzzle, decodePuzzle } from '../src/worker.mjs';
import { DEMO } from '../src/demo.mjs';
import { SITE } from '../src/config.mjs';
import { documents, aiLinks } from '../src/docs.mjs';
import { etDate, resetAt, normalize, matchAnswer, TIERS } from '../public/rules.mjs';
import { homePage } from '../src/html.mjs';

function database(snapshot = true){
  const db=new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../migrations/0001_initial.sql',import.meta.url),'utf8'));
  db.exec(readFileSync(new URL('../migrations/0002_pause.sql',import.meta.url),'utf8'));
  if(snapshot) db.exec(readFileSync(new URL('../migrations/0003_run_puzzle_snapshot.sql',import.meta.url),'utf8'));
  const prepare=sql=>({
    bind(...args){
      const s=db.prepare(sql);
      return {
        async first(){return s.get(...args)||null},
        async all(){return {results:s.all(...args)}},
        async run(){const r=s.run(...args);return {success:true,meta:{changes:Number(r.changes)}}},
      };
    },
    async first(){return db.prepare(sql).get()||null},
  });
  return{prepare,migrateSnapshots:()=>db.exec(readFileSync(new URL('../migrations/0003_run_puzzle_snapshot.sql',import.meta.url),'utf8')),async batch(statements){db.exec('BEGIN');try{const r=[];for(const s of statements)r.push(await s.run());db.exec('COMMIT');return r}catch(e){db.exec('ROLLBACK');throw e}},close:()=>db.close()};
}
function service(){const env={DB:database(),BUCKET:{put:async()=>{},get:async()=>null},LOCAL_DEVELOPMENT:'true',REFERENCE_SYNC:'false',ASSETS:{fetch:async()=>new Response('not found',{status:404})}};let cookie='';return{env,async call(path,data,extra={}){const r=await worker.fetch(new Request('http://localhost:3051'+path,{...(data===undefined?{}:{method:'POST',body:JSON.stringify(data),headers:{'Content-Type':'application/json','Cookie':cookie,...extra}}),...(data===undefined?{headers:{Cookie:cookie,...extra}}:{})}),env,{});if(r.headers.get('Set-Cookie'))cookie=r.headers.get('Set-Cookie').split(';')[0];return{status:r.status,body:await r.json()}},cookie:()=>cookie};}

test('New York reset follows DST rather than device midnight',()=>{
  assert.equal(etDate(Date.parse('2026-10-17T03:59:59Z')),'2026-10-16');
  assert.equal(etDate(Date.parse('2026-10-17T04:00:00Z')),'2026-10-17');
  assert.equal(new Date(resetAt('2026-10-17')).toISOString(),'2026-10-18T04:00:00.000Z');
  assert.equal(new Date(resetAt('2026-12-17')).toISOString(),'2026-12-18T05:00:00.000Z');
});
test('answer matching normalizes accents, uses known aliases and avoids short fuzzy guesses',()=>{
  assert.equal(normalize('São Tomé & Príncipe'),'saotomeandprincipe');
  assert.equal(matchAnswer('mashed',DEMO.prompts[0].answers).answer,'Mashed potatoes');
  assert.equal(matchAnswer('Yttrum',DEMO.prompts[3].answers).correction,true);
  assert.equal(matchAnswer('xyz',DEMO.prompts[3].answers),null);
  assert.equal(matchAnswer('zzzzzzzzzz',DEMO.prompts[0].answers),null);
});
test('reference import validates date, question identity and tier whitelist',()=>{
  const date='2026-10-17';const today={date,dayNumber:94,prompts:DEMO.prompts.map(({id,text})=>({id,text}))},reveal={date,prompts:structuredClone(DEMO.prompts)};
  assert.equal(validateReference(today,reveal,date).prompts.length,7);
  const bad = structuredClone(reveal);
  bad.prompts[0].answers = [{answer:'Invalid',tier:'toString'}, {answer:'',tier:'rare'}, null];
  assert.throws(()=>validateReference(today,bad,date), /valid reference answer/);
  bad.prompts[0].answers.push({answer:'Valid',tier:'rare'});
  assert.deepEqual(validateReference(today,bad,date).prompts[0].answers,[{answer:'Valid',tier:'rare'}]);
  assert.throws(()=>validateReference(today,{...reveal,date:'2026-10-18'},date));
  reveal.prompts[0].text='Different question';assert.throws(()=>validateReference(today,reveal,date));
});

test('sample recovery backfills existing dives and preserves their prompts, scoring and review',async()=>{
  const s=service(),originalFetch=globalThis.fetch,date=etDate(),oldPlayer=crypto.randomUUID(),oldRun=crypto.randomUUID();
  s.env.DB.close();s.env.DB=database(false);
  const sample={...DEMO,date,dayNumber:1,sample:true};
  await s.env.DB.prepare('INSERT INTO puzzles(date,day_number,source,content) VALUES(?,?,?,?)').bind(date,1,sample.source,JSON.stringify(sample)).run();
  await s.env.DB.prepare('INSERT INTO runs(id,player,date,mode,round_start,created_at) VALUES(?,?,?,?,?,?)').bind(oldRun,oldPlayer,date,'daily',Date.now()-1000,Date.now()).run();
  s.env.DB.migrateSnapshots();
  assert.equal(JSON.parse((await s.env.DB.prepare('SELECT puzzle_content FROM runs WHERE id=?').bind(oldRun).first()).puzzle_content).sample,true);
  const duringDeploy=crypto.randomUUID();
  await s.env.DB.prepare('INSERT INTO runs(id,player,date,mode,round_start,created_at) VALUES(?,?,?,?,?,?)').bind(duringDeploy,crypto.randomUUID(),date,'daily',Date.now()-1000,Date.now()).run();
  const real={...DEMO,date,dayNumber:2,prompts:DEMO.prompts.map((p,i)=>({...p,text:`Official ${i}`,answers:[{answer:`Official answer ${i}`,tier:'rare'}]}))};
  s.env.REFERENCE_SYNC='true';let upstream=0;
  globalThis.fetch=async url=>{upstream++;return Response.json(String(url).includes('/reveal?')?real:{...real,prompts:real.prompts.map(({id,text})=>({id,text}))});};
  try{
    const today=await s.call('/api/today');assert.equal(today.body.sample,false);assert.equal(today.body.prompts[0].text,'Official 0');assert.equal(upstream,2);
    assert.equal(JSON.parse((await s.env.DB.prepare('SELECT puzzle_content FROM runs WHERE id=?').bind(duringDeploy).first()).puzzle_content).sample,true);
    const oldHeaders={'X-Krillion-Player':oldPlayer};
    assert.equal((await s.call('/api/state?run='+oldRun,undefined,oldHeaders)).body.prompts[0].text,DEMO.prompts[0].text);
    for(let round=0;round<7;round++){
      const answer=DEMO.prompts[round].answers.find(a=>a.tier==='krillion').answer;
      const scored=await s.call('/api/answer',{runId:oldRun,round,answer,confirm:true},oldHeaders);
      assert.equal(scored.body.result.score,100);assert.equal(scored.body.state.sample,true);
      if(round<6)await s.call('/api/next',{runId:oldRun},oldHeaders);
    }
    const review=await s.call('/api/review?run='+oldRun,undefined,oldHeaders);assert.equal(review.body.prompts[0].text,DEMO.prompts[0].text);
    const newHeaders={'X-Krillion-Player':crypto.randomUUID()},fresh=await s.call('/api/start',{},newHeaders);
    assert.equal(fresh.body.sample,false);assert.equal(fresh.body.prompts[0].text,'Official 0');
    assert.equal((await s.env.DB.prepare('SELECT puzzle_content FROM runs WHERE id=?').bind(fresh.body.runId).first()).puzzle_content,null);
    const scored=await s.call('/api/answer',{runId:fresh.body.runId,round:0,answer:'Official answer 0',confirm:true},newHeaders);assert.equal(scored.body.result.score,60);
    await s.env.DB.prepare('UPDATE runs SET completed=1 WHERE id=?').bind(fresh.body.runId).run();
    const realReview=await s.call('/api/review?run='+fresh.body.runId,undefined,newHeaders);assert.equal(realReview.body.population,0);
    const sampleReview=await s.call('/api/review?run='+oldRun,undefined,oldHeaders);assert.equal(sampleReview.body.population,0);
    const resumed=await s.call('/api/start',{},oldHeaders);assert.equal(resumed.body.runId,oldRun);assert.equal(resumed.body.sample,true);assert.equal(resumed.body.score,700);
  }finally{globalThis.fetch=originalFetch;s.env.DB.close();}
});

test('failed reference synchronization retries after one minute instead of permanently caching sample content',async()=>{
  const s=service(),originalFetch=globalThis.fetch,originalNow=Date.now;let now=originalNow(),calls=0,available=false;
  Date.now=()=>now;s.env.REFERENCE_SYNC='true';
  globalThis.fetch=async()=>{calls++;return available?Response.json({...DEMO,date:etDate(),dayNumber:2}):new Response('Unavailable',{status:503});};
  try{
    assert.equal((await s.call('/api/today')).body.sample,true);assert.equal(calls,2);
    assert.equal((await s.call('/api/today')).body.sample,true);assert.equal(calls,2);
    now+=60001;available=true;
    assert.equal((await s.call('/api/today')).body.sample,false);assert.equal(calls,4);
    assert.equal((await s.call('/api/today')).body.sample,false);assert.equal(calls,4);
  }finally{globalThis.fetch=originalFetch;Date.now=originalNow;s.env.DB.close();}
});

test('large reference banks store lossless gzip BLOBs and reload every answer and alias',async()=>{
  const s=service(),originalFetch=globalThis.fetch,date=etDate();
  const massive={date,dayNumber:3,prompts:DEMO.prompts.map((p,round)=>({...p,answers:Array.from({length:2000},(_,i)=>({answer:`Café coral ${round} ${i}`,tier:'rare',aliases:[`tidal-${round}-${i}-`+'x'.repeat(180),`alias ${round} ${i}`],quip:'Original reference detail'}))}))};
  const validated=validateReference(massive,massive,date);
  assert.ok(new TextEncoder().encode(JSON.stringify(validated)).length>2*1024*1024);
  globalThis.fetch=async()=>Response.json(massive);
  try{
    await syncPuzzle(s.env,date);
    const row=await s.env.DB.prepare('SELECT content,typeof(content) AS kind FROM puzzles WHERE date=?').bind(date).first();
    assert.equal(row.kind,'blob');assert.ok(row.content.length<2*1024*1024-1024);
    assert.deepEqual(await decodePuzzle(row.content),validated);
    assert.deepEqual(await decodePuzzle(Array.from(row.content)),validated);
    assert.deepEqual(await decodePuzzle(row.content.buffer.slice(row.content.byteOffset,row.content.byteOffset+row.content.byteLength)),validated);
    // Recreate the binding wrapper so this read cannot use the warm puzzle cache.
    s.env.DB={...s.env.DB};
    const started=await s.call('/api/start',{});assert.equal(started.body.sample,false);
    const scored=await s.call('/api/answer',{runId:started.body.runId,round:0,answer:'alias 0 1999',confirm:true});
    assert.equal(scored.body.result.answer,'Café coral 0 1999');assert.equal(scored.body.result.score,60);
    // Refreshing an existing compressed row must not call JSON functions on BLOBs.
    await syncPuzzle(s.env,date);
    const sample={...DEMO,date,sample:true};
    assert.equal(typeof await encodePuzzle(sample),'string');assert.deepEqual(await decodePuzzle(await encodePuzzle(sample)),sample);
  }finally{globalThis.fetch=originalFetch;s.env.DB.close();}
});
test('seven rounds are scored on server; retries cannot duplicate points; other browsers cannot read the run',async()=>{
  const s=service();let{body:game}=await s.call('/api/start',{});const id=game.runId;
  const correction=await s.call('/api/answer',{runId:id,round:0,answer:'mashed'});assert.equal(correction.body.correction,'Mashed potatoes');
  const rejected=await s.call('/api/answer',{runId:id,round:0,answer:'zzzzzzzzzz'});assert.equal(rejected.body.rejected,true);
  for(let i=0;i<7;i++){
    const answer=DEMO.prompts[i].answers.find(a=>a.tier==='krillion').answer;
    const result=await s.call('/api/answer',{runId:id,round:i,answer,confirm:true,score:99999});assert.equal(result.status,200);assert.equal(result.body.result.score,TIERS.krillion.score);game=result.body.state;
    const duplicate=await s.call('/api/answer',{runId:id,round:i,answer});assert.equal(duplicate.body.alreadyScored,true);assert.equal(duplicate.body.state.results.length,i+1);
    if(i<6){const n=await s.call('/api/next',{runId:id});assert.equal(n.body.round,i+1);}
  }
  assert.equal(game.score,700);assert.equal(game.completed,true);
  const same=await s.call('/api/start',{});assert.equal(same.body.runId,id);
  const review=await s.call('/api/review?run='+id);assert.equal(review.status,200);assert.equal(review.body.betterThan,null);assert.equal(review.body.population,0);
  const other=service();const missing=await other.call('/api/state?run='+id);assert.equal(missing.status,404);
  const csrf=await s.call('/api/start',{}, {Origin:'https://evil.example'});assert.equal(csrf.status,403);
  s.env.DB.close();other.env.DB.close();
});
test('review stays locked, pause is server-side and practice is separate',async()=>{
  const s=service();const{body:g}=await s.call('/api/start',{});
  assert.equal((await s.call('/api/review?run='+g.runId)).status,403);
  const paused=await s.call('/api/pause',{runId:g.runId,paused:true});assert.ok(paused.body.pausedAt);
  const resumed=await s.call('/api/pause',{runId:g.runId,paused:false});assert.equal(resumed.body.pausedAt,null);assert.ok(resumed.body.roundStart>=g.roundStart);
  const practice=await s.call('/api/start',{practice:true});assert.notEqual(practice.body.runId,g.runId);assert.equal(practice.body.mode,'practice');
  s.env.DB.close();
});
test('expired server windows cannot score late answers or be revived by pausing',async()=>{
  const s=service();const{body:g}=await s.call('/api/start',{});
  s.env.LOCAL_DEVELOPMENT='false';
  await s.env.DB.prepare('UPDATE runs SET round_start=? WHERE id=?').bind(Date.now()-30000,g.runId).run();
  const paused=await s.call('/api/pause',{runId:g.runId,paused:true});assert.equal(paused.body.pausedAt,null);
  const late=await s.call('/api/answer',{runId:g.runId,round:0,answer:'Pommes soufflées',confirm:true,timeout:true});
  assert.equal(late.body.result.score,0);assert.equal(late.body.state.round,1);s.env.DB.close();
});
test('four docs share product facts, full composes all three, config mutations propagate without private keys',()=>{
  const a=documents();assert.equal(Object.keys(a).length,4);
  for(const key of ['/llms.txt','/pricing.md','/models.md'])assert.ok(a['/llms-full.txt'].includes(a[key]));
  const changed=structuredClone(SITE);changed.price.amount=7;changed.price.label='Test pricing';changed.features.push('Isolated capability test');changed.secret='DO_NOT_LEAK';
  const b=documents(changed);assert.ok(b['/pricing.md'].includes('7 USD'));assert.ok(b['/models.md'].includes('Isolated capability test'));assert.ok(b['/llms-full.txt'].includes('Test pricing'));assert.ok(!JSON.stringify(b).includes('DO_NOT_LEAK'));
});
test('five AI destinations share one localized prompt, canonical docs and native link safety',()=>{
  for(const lang of SITE.languages){const links=aiLinks(lang);assert.equal(links.length,5);const q=links.map(a=>new URL(a.href).searchParams.get('q'));assert.equal(new Set(q).size,1);assert.ok(q[0].includes(SITE.origin+'/llms-full.txt'));assert.ok(q[0].includes(lang==='zh'?'用中文回答':'answer in English'));assert.equal(new URL(links.find(a=>a.name==='Google AI Mode').href).searchParams.get('udm'),'50');const html=homePage(lang);assert.ok(html.includes('noopener noreferrer nofollow'));assert.ok(html.includes('original-footer'));assert.ok(html.includes('AI &amp; Agent Docs'));}
});
test('SSR SEO exposes an expandable guide, correct canonical and no crawler-specific cloaking',()=>{
  const html=homePage();assert.ok(html.includes('<h1 aria-label="Krillion Game'));assert.ok(html.includes('<details id="guide"'));assert.ok(html.includes('https://openkrillion.com/assets/og.png'));
  const text=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<[^>]+>/g,' '),words=text.match(/[A-Za-z]+(?:[’'-][A-Za-z]+)*/g),density=words.filter(w=>w.toLowerCase()==='krillion').length/words.length;
  assert.ok(words.length>1500);assert.ok(density>.03);assert.ok(!html.includes('googlebot'));
});
test('public docs GET and HEAD are readable UTF-8 and not SPA HTML',async()=>{
  const s=service();for(const path of Object.keys(documents()))for(const method of ['GET','HEAD']){const r=await worker.fetch(new Request('http://localhost:3051'+path,{method}),s.env,{});assert.equal(r.status,200);assert.match(r.headers.get('Content-Type'),/text\/plain; charset=utf-8/);const body=await r.text();if(method==='HEAD')assert.equal(body,'');else{assert.ok(body.startsWith('# OpenKrillion'));assert.ok(!body.includes('<!doctype html>'));}}s.env.DB.close();
});

test('embedded player token works without cookies and cannot access another player run', async()=>{
 const s=service();const started=await s.call('/api/start',{});const token=started.body.playerToken;assert.match(token,/^[a-f0-9-]{36}$/);
 const owned=await s.call('/api/state?run='+started.body.runId,undefined,{Cookie:'','X-Krillion-Player':token});assert.equal(owned.status,200);
 const denied=await s.call('/api/state?run='+started.body.runId,undefined,{Cookie:'','X-Krillion-Player':crypto.randomUUID()});assert.equal(denied.status,404);s.env.DB.close();
});

test('signed-in daily run resumes across browsers and publishes authoritative seven-round total',async()=>{
 const s=service(),published=new Map();s.env.ACCOUNTS_DB={prepare:sql=>({bind:(...args)=>({first:async()=>({id:'account-user'}),run:async()=>{if(sql.startsWith('INSERT')){const key=args[0]+args[1];if(!published.has(key))published.set(key,args);}return {};}})})};
 const date=etDate(),puzzle={...DEMO,date,sample:false};await s.env.DB.prepare('INSERT INTO puzzles(date,day_number,source,content) VALUES(?,?,?,?)').bind(date,1,'test',JSON.stringify(puzzle)).run();
 const headers={'X-Wacky-Krillion-Ticket':'a'.repeat(64),Cookie:''};let {body:g}=await s.call('/api/start',{},headers);const id=g.runId;
 assert.equal((await s.call('/api/start',{},headers)).body.runId,id);
 let expected=0;for(let i=0;i<7;i++){if(i)await s.call('/api/next',{runId:id},headers);const answer=puzzle.prompts[i].answers[0];expected+=TIERS[answer.tier].score;const r=await s.call('/api/answer',{runId:id,round:i,answer:answer.answer,confirm:true},headers);assert.equal(r.status,200);g=r.body.state;}
 assert.equal(g.completed,true);assert.equal(g.ranked,true);assert.equal(published.size,1);assert.equal([...published.values()][0][3],expected);
 assert.equal((await s.call('/api/start',{},headers)).body.runId,id);assert.equal(published.size,1);
 const guest=await s.call('/api/state?run='+id,undefined,{Cookie:''});assert.equal(guest.status,404);s.env.DB.close();
});
