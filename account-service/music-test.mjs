import test from 'node:test';
import assert from 'node:assert/strict';
import {musicAudio} from './music.mjs';
const id='1-7jUpCrdAhnUrqg8DE-2VjjBhSsqAn-r';
const req=(headers={},suffix=id)=>new Request('https://example.com/music/audio?id='+suffix,{headers});
test('streams ranged audio and forwards no user credentials',async()=>{
 let calls=0;
 const r=await musicAudio(req({Range:'bytes=0-3',Cookie:'private',Authorization:'private'}),{'Access-Control-Allow-Origin':'https://bens-wacky-world.pages.dev'},async(url,options)=>{
  calls++;assert(url.startsWith('https://drive.usercontent.google.com/'));assert.equal(options.headers.get('Range'),'bytes=0-3');assert.equal(options.headers.get('Cookie'),null);assert.equal(options.headers.get('Authorization'),null);
  return new Response('song',{status:206,headers:{'Content-Type':'audio/mpeg','Content-Length':'4','Content-Range':'bytes 0-3/100','Accept-Ranges':'bytes','Set-Cookie':'secret'}});
 });assert.equal(r.status,206);assert.equal(r.headers.get('Content-Range'),'bytes 0-3/100');assert.equal(r.headers.get('Set-Cookie'),null);assert.equal(await r.text(),'song');assert.equal(calls,1);
});
test('unknown IDs and multipart ranges never reach the network',async()=>{
 const fail=()=>assert.fail('Unexpected fetch');assert.equal((await musicAudio(req({},'not-a-song'),{},fail)).status,404);assert.equal((await musicAudio(req({Range:'bytes=0-3,8-9'}),{},fail)).status,416);
});
test('does not return HTML login or download warning pages as audio',async()=>{const r=await musicAudio(req(),{},async()=>new Response('<html>Login</html>',{headers:{'Content-Type':'text/html'}}));assert.equal(r.status,502);});
test('refuses redirects to non-Drive hosts',async()=>{let calls=0;const r=await musicAudio(req(),{},async()=>{calls++;return new Response(null,{status:302,headers:{Location:'http://127.0.0.1/private'}})});assert.equal(r.status,502);assert.equal(calls,1);});
test('bounds trusted redirect loops',async()=>{let calls=0;const r=await musicAudio(req(),{},async()=>{calls++;return new Response(null,{status:302,headers:{Location:'https://drive.google.com/loop'}})});assert.equal(r.status,502);assert.equal(calls,4);});
test('handles unavailable sources and permits only reads',async()=>{assert.equal((await musicAudio(req(),{},async()=>{throw Error('offline')})).status,502);assert.equal((await musicAudio(new Request('https://example.com/music/audio?id='+id,{method:'POST'}),{},()=>assert.fail())).status,405);});

test('recognizes a Drive quota page even when its HTTP status is 200',async()=>{
 const r=await musicAudio(req(),{},async()=>new Response('<html><title>Google Drive - Quota exceeded</title>Too many users have viewed or downloaded this file recently.</html>',{headers:{'Content-Type':'text/html; charset=utf-8'}}));
 assert.equal(r.status,429);const data=await r.json();assert.equal(data.code,'SOURCE_QUOTA');assert.match(data.error,/Google Drive/);assert(!data.error.includes('<html>'));
});
test('bounds HTML inspection and cancels the error stream',async()=>{
 let reads=0,cancelled=false;const r=await musicAudio(req(),{},async()=>new Response(new ReadableStream({pull(c){reads++;c.enqueue(new TextEncoder().encode('x'.repeat(4096)));},cancel(){cancelled=true;}}),{headers:{'Content-Type':'text/html'}}));
 assert.equal(r.status,502);assert.equal((await r.json()).code,'SOURCE_PAGE');assert(cancelled);assert(reads<=3);
});
test('distinguishes source access, missing files and network errors',async()=>{
 for(const [status,code] of [[403,'SOURCE_ACCESS'],[404,'SOURCE_MISSING'],[429,'SOURCE_QUOTA'],[416,'INVALID_RANGE']]){const r=await musicAudio(req(),{},async()=>new Response('',{status}));assert.equal(r.status,status);assert.equal((await r.json()).code,code);}
 const r=await musicAudio(req(),{},async()=>{throw Error('offline');});assert.equal((await r.json()).code,'SOURCE_ERROR');
});

test('rejects a non-audio import with a distinct reason',async()=>{const r=await musicAudio(req(),{},async()=>new Response('#EXTM3U',{headers:{'Content-Type':'application/octet-stream'}}));assert.equal((await r.json()).code,'SOURCE_FORMAT');});

test('serves signature-verified FLAC with an audio MIME type, including seek ranges',async()=>{const id='1GlHKSK51YYvQkIZsk06eAuzpuxwL_j5W';const r=await musicAudio(req({Range:'bytes=1024-'},id),{},async()=>new Response('flac bytes',{status:206,headers:{'Content-Type':'application/octet-stream','Content-Range':'bytes 1024-1033/1034'}}));assert.equal(r.status,206);assert.equal(r.headers.get('Content-Type'),'audio/flac');assert.equal(r.headers.get('Content-Range'),'bytes 1024-1033/1034');const blocked=await musicAudio(req({},id),{},async()=>new Response('<title>Quota exceeded</title>',{headers:{'Content-Type':'text/html'}}));assert.equal(blocked.status,429);});
