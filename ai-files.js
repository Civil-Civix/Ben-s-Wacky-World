(() => {
 const MAX_TEXT=12000;
 async function read(file){
  if(file.size>8*1024*1024)throw Error('Choose a file smaller than 8 MB.');
  const name=file.name.slice(0,120),ext=name.split('.').pop().toLowerCase();
  if(['png','jpg','jpeg','webp'].includes(ext)){
   let bitmap;try{bitmap=await createImageBitmap(file);}catch{throw Error('This image could not be read. Choose PNG, JPEG, or WebP.');}
   try{const canvas=document.createElement('canvas'),scale=Math.min(1,1280/Math.max(bitmap.width,bitmap.height));canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);let data=canvas.toDataURL('image/jpeg',.8);if(data.length>400000)data=canvas.toDataURL('image/jpeg',.5);if(data.length>400000)throw Error('This image is too detailed. Try a smaller crop.');return {name,type:'image',data};}finally{bitmap.close();}
  }
  let text,type='text';
  if(ext==='pdf'){
   type='pdf';const pdfjs=await import('./vendor/pdfjs/pdf.mjs');pdfjs.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdfjs/pdf.worker.mjs',document.baseURI).href;
   const task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false,useSystemFonts:true});
   try{const pdf=await task.promise;if(pdf.numPages>20)throw Error('Choose a PDF with 20 pages or fewer.');const parts=[];let size=0;for(let n=1;n<=pdf.numPages;n++){const page=await pdf.getPage(n),content=await page.getTextContent();const chunk=content.items.map(i=>i.str+(i.hasEOL?'\n':' ')).join('');size+=chunk.length;if(size>MAX_TEXT)throw Error('This PDF is too long. Attach an excerpt under 12,000 characters.');parts.push(chunk);}text=parts.join('\n');}finally{await task.destroy();}
  }else{
   if(!['txt','md','csv','json','js','ts','py','html','css','xml','yaml','yml','log'].includes(ext))throw Error('Choose an image, PDF, or text/code file.');
   if(file.size>100000)throw Error('Choose a text file smaller than 100 KB.');text=await file.text();
  }
  if(!text.trim())throw Error(type==='pdf'?'No selectable text found. Upload a screenshot of a scanned page instead.':'This file has no readable text.');
  if(text.length>MAX_TEXT)throw Error('Choose an excerpt under 12,000 characters.');
  if(text.includes('\u0000')||text.includes('\ufffd'))throw Error('This file is not readable UTF-8 text.');
  return {name,type,text};
 }
 window.WackyAIFiles={read};
})();
