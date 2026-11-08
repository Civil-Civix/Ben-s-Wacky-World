import catalogue from '../music-library.json' with {type:'json'};

const ids=new Set(catalogue.tracks.map(t=>t.id));
// Explicit catalogue overrides require verified file signatures, never filename guesses.
const verifiedTypes=new Map(catalogue.tracks.filter(t=>['audio/flac','audio/ogg'].includes(t.verifiedAudioType)).map(t=>[t.id,t.verifiedAudioType]));
const hosts=new Set(['drive.google.com','drive.usercontent.google.com']);

// Only catalogue audio can be relayed. Never forward cookies, credentials or arbitrary URLs.
export async function musicAudio(request, cors={}, fetcher=fetch){
  const error=(message,status,code='SOURCE_ERROR')=>Response.json({error:message,code},{status,headers:{...cors,'Cache-Control':'no-store'}});
  if(request.method!=='GET')return error('GET required.',405);
  const id=new URL(request.url).searchParams.get('id');
  if(!ids.has(id))return error('Unknown song.',404,'UNKNOWN_SONG');
  const range=request.headers.get('Range');
  if(range&&!/^bytes=(?:\d+-\d*|-\d+)$/.test(range))return error('Invalid audio range.',416);
  const headers=new Headers({'Accept':'audio/*'});if(range)headers.set('Range',range);
  let url='https://drive.usercontent.google.com/download?export=download&id='+encodeURIComponent(id),upstream;
  try{
    for(let hop=0;hop<4;hop++){
      // Stream the body after headers arrive; do not buffer entire songs in Worker memory.
      upstream=await fetcher(url,{method:'GET',headers,redirect:'manual',signal:request.signal});
      if([301,302,303,307,308].includes(upstream.status)){
        const location=upstream.headers.get('Location');await upstream.body?.cancel();
        if(!location)return error('Music source unavailable.',502);
        const next=new URL(location,url);
        if(next.protocol!=='https:'||!hosts.has(next.hostname)||next.port||next.username||next.password)return error('Music source unavailable.',502);
        url=next.href;continue;
      }
      break;
    }
    let type=(upstream.headers.get('Content-Type')||'').split(';')[0].toLowerCase();
    if(type==='application/octet-stream'&&verifiedTypes.has(id))type=verifiedTypes.get(id);
    if(![200,206].includes(upstream.status)||!type.startsWith('audio/')){
      let page='';
      // Inspect only a small error-page prefix; successful audio remains streamed.
      if(type==='text/html'&&upstream.body){
        const reader=upstream.body.getReader();let remaining=8192;
        try{while(remaining>0){const {done,value}=await reader.read();if(done)break;const part=value.subarray(0,remaining);remaining-=part.length;page+=new TextDecoder().decode(part);}}
        finally{await reader.cancel();}
      }else await upstream.body?.cancel();
      if(upstream.status===429||/quota exceeded|too many users have viewed/i.test(page))return error('Google Drive has temporarily limited downloads for this song.',429,'SOURCE_QUOTA');
      if(upstream.status===404)return error('This song is no longer available from its source.',404,'SOURCE_MISSING');
      if(upstream.status===403||/request access|you need access|sign in/i.test(page))return error('This song is not publicly accessible from Google Drive.',403,'SOURCE_ACCESS');
      if(upstream.status===416)return error('This audio range is unavailable.',416,'INVALID_RANGE');
      if(type==='text/html')return error('Google Drive returned a download page instead of playable audio.',502,'SOURCE_PAGE');
      if([200,206].includes(upstream.status))return error('This library entry is not a playable audio file.',502,'SOURCE_FORMAT');
      return error('This song is temporarily unavailable. Try another song.',502,'SOURCE_ERROR');
    }

    const output=new Headers({...cors,'Content-Type':type,'Cache-Control':'private, max-age=300','X-Content-Type-Options':'nosniff','Access-Control-Expose-Headers':'Content-Length, Content-Range, Accept-Ranges'});
    for(const name of ['Content-Length','Content-Range','Accept-Ranges']){const value=upstream.headers.get(name);if(value)output.set(name,value);}
    return new Response(upstream.body,{status:upstream.status,headers:output});
  }catch{return error('Music could not load. Please try again.',502);}
}
