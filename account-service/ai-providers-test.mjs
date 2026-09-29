import assert from 'node:assert/strict';
import {answerWithFallback,aiEnabled} from './ai-providers.mjs';
const original=globalThis.fetch;const messages=[{role:'user',content:'Hello'}];let calls=[];
const env={GROQ_API_KEY:'fake-groq',OPENROUTER_API_KEY:'fake-router',AI:{run:async(model,data)=>{calls.push('Cloudflare');assert.deepEqual(data.messages,messages);return {response:'Cloudflare answer'};}}};
try{
assert.equal(aiEnabled({}),false);assert(aiEnabled({AI:env.AI}));
globalThis.fetch=async(url,opts)=>{calls.push(url);assert.deepEqual(JSON.parse(opts.body).messages,messages);return Response.json({choices:[{message:{content:'Groq answer'}}]});};
assert.equal((await answerWithFallback(env,messages)).provider,'Groq');assert.equal(calls.length,1);
calls=[];globalThis.fetch=async(url)=>{calls.push(url);return new Response('',{status:429});};assert.equal((await answerWithFallback(env,messages)).provider,'Cloudflare');assert.equal(calls.length,2);
calls=[];globalThis.fetch=async(url,opts)=>{calls.push(url);if(url.includes('groq'))return new Response('',{status:503});assert.equal(JSON.parse(opts.body).model,'openrouter/free');return Response.json({model:'actual-free-model',choices:[{message:{content:'Router answer'}}]});};
const failingCloud={run:async()=>{calls.push('Cloudflare');throw Error('Unavailable');}};
const answer=await answerWithFallback({...env,AI:failingCloud},messages);assert.equal(answer.provider,'OpenRouter');assert.equal(answer.model,'actual-free-model');assert.equal(calls.length,3);
globalThis.fetch=async()=>Response.json({choices:[{message:{content:''}}]});await assert.rejects(answerWithFallback({...env,AI:failingCloud},messages));
console.log('PASS: primary success, quota/outage fallback order, original context, free-only OpenRouter, model label, empty/all-failed replies.');
}finally{globalThis.fetch=original;}
