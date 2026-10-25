// Serve the port's existing split assets locally, without an external host.
(() => {
 const parts = {"hcr.wasm":[{"path":"hcr.wasm.part1","size":15221492},{"path":"hcr.wasm.part2","size":15221492},{"path":"hcr.wasm.part3","size":15221492},{"path":"hcr.wasm.part4","size":15221489}],"hcr.data":[{"path":"hcr.data.part1","size":17201818},{"path":"hcr.data.part2","size":17201818},{"path":"hcr.data.part3","size":17201818},{"path":"hcr.data.part4","size":17201818},{"path":"hcr.data.part5","size":17201818},{"path":"hcr.data.part6","size":17201817}],"image.bin":[{"path":"image.bin.part1","size":11042816},{"path":"image.bin.part2","size":11042816}]};
 const original = window.fetch.bind(window);
 window.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : input, document.baseURI);
  const name = url.pathname.slice(url.pathname.lastIndexOf('/') + 1);
  if (url.origin !== location.origin || !parts[name]) return original(input, init);
  const list = parts[name], signal = init?.signal || (input instanceof Request ? input.signal : undefined);
  let index = 0, reader;
  const body = new ReadableStream({
   async pull(controller) {
    try {
     while (true) {
      if (!reader) {
       if (index === list.length) { controller.close(); return; }
       const part = list[index++];
       const response = await original(new URL(part.path, url), {signal});
       if (!response.ok || !response.body) throw new Error('Missing game part: '+part.path);
       reader = response.body.getReader();
      }
      const result = await reader.read();
      if (result.done) { reader.releaseLock(); reader = null; }
      else { controller.enqueue(result.value); return; }
     }
    } catch (error) { controller.error(error); }
   },
   cancel(reason) { return reader?.cancel(reason); }
  });
  return new Response(body, {headers:{'Content-Type':name.endsWith('.wasm')?'application/wasm':'application/octet-stream','Content-Length':String(list.reduce((sum,p)=>sum+p.size,0))}});
 };
})();
