export const aiEnabled=env=>!!(env.GROQ_API_KEY||env.AI||env.OPENROUTER_API_KEY);
async function smallJSON(response){
 const reader=response.body.getReader(),chunks=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>131072){await reader.cancel();throw new Error('Response too large');}chunks.push(value);}}
 finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
 return JSON.parse(new TextDecoder().decode(bytes));
}

async function deadline(task,ms){let timer;try{return await Promise.race([task,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Provider timeout')),ms);})]);}finally{clearTimeout(timer);}}
export async function answerWithFallback(env,messages){
 const providers=[];
 if(env.GROQ_API_KEY)providers.push({name:'Groq',model:'openai/gpt-oss-20b',url:'https://api.groq.com/openai/v1/chat/completions',key:env.GROQ_API_KEY});
 if(env.AI)providers.push({name:'Cloudflare',model:'@cf/meta/llama-3.1-8b-instruct-fp8-fast'});
 if(env.OPENROUTER_API_KEY)providers.push({name:'OpenRouter',model:'openrouter/free',url:'https://openrouter.ai/api/v1/chat/completions',key:env.OPENROUTER_API_KEY});
 for(const provider of providers){
  try{
   let answer,model=provider.model;
   if(provider.name==='Cloudflare'){
    const result=await deadline(env.AI.run(model,{messages,max_tokens:800,stream:false}),15000);
    answer=result.response;
   }else{
    const payload={model,messages,stream:false,...(provider.name==='Groq'?{max_completion_tokens:1024,reasoning_effort:'low'}:{max_tokens:800})};
    const response=await fetch(provider.url,{method:'POST',headers:{Authorization:'Bearer '+provider.key,'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)});
    if(!response.ok){await response.body?.cancel();continue;}
    const result=await smallJSON(response);
    answer=result.choices?.[0]?.message?.content;
    if(typeof result.model==='string')model=result.model.slice(0,160);
   }
   if(typeof answer==='string'&&answer.trim())return {answer:answer.slice(0,12000),provider:provider.name,model};
  }catch{/* Availability failures move to the next provider; never log keys or prompts. */}
 }
 throw new Error('All AI providers unavailable');
}
