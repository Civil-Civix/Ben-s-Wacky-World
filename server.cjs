// Local preview server. No packages or build step required.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const port = Number(process.env.PORT || 4173);
const types = {'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.wasm':'application/wasm','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.ogg':'audio/ogg','.mp3':'audio/mpeg','.wav':'audio/wav','.mp4':'video/mp4','.woff':'font/woff','.woff2':'font/woff2','.xml':'application/xml','.swf':'application/x-shockwave-flash'};
http.createServer((req,res) => {
  let filename;
  try {filename = path.resolve(root, '.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));}
  catch {res.writeHead(400).end();return;}
  if(filename !== root && !filename.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  if(req.method !== 'GET' && req.method !== 'HEAD'){res.writeHead(405).end();return;}
  fs.stat(filename,(err,stat) => {
    if(!err && stat.isDirectory()) filename=path.join(filename,'index.html');
    fs.stat(filename,(err,stat) => {
      if(err || !stat.isFile()){res.writeHead(404,{'Content-Type':'text/plain'}).end('File not found');return;}
      let ext=path.extname(filename),encoding;
      if(ext==='.gz' || ext==='.br'){encoding=ext==='.gz'?'gzip':'br';ext=path.extname(filename.slice(0,-ext.length));}
      const headers={'Content-Type':types[ext]||'application/octet-stream','Accept-Ranges':'bytes','Cache-Control':'no-cache'};
      if(encoding) headers['Content-Encoding']=encoding;
      let start=0,end=stat.size-1,code=200;
      if(req.headers.range){
        const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
        if(!match){res.writeHead(416,{'Content-Range':`bytes */${stat.size}`}).end();return;}
        if(!match[1]) start=Math.max(0,stat.size-Number(match[2]));
        else {start=Number(match[1]);if(match[2])end=Math.min(end,Number(match[2]));}
        if(start>end || start>=stat.size){res.writeHead(416,{'Content-Range':`bytes */${stat.size}`}).end();return;}
        code=206;headers['Content-Range']=`bytes ${start}-${end}/${stat.size}`;
      }
      headers['Content-Length']=Math.max(0,end-start+1);
      res.writeHead(code,headers);
      if(req.method==='HEAD' || stat.size===0){res.end();return;}
      const stream=fs.createReadStream(filename,{start,end});
      stream.on('error',()=>res.destroy());stream.pipe(res);
    });
  });
}).listen(port,'127.0.0.1',()=>console.log(`Wacky Games: http://127.0.0.1:${port}`));
