export function validateAttachment(value,fail){
 if(value==null)return null;
 if(typeof value!=='object'||typeof value.name!=='string'||!value.name.trim()||value.name.length>120)fail(400,'Invalid attachment name.');
 const name=value.name.replace(/[\x00-\x1f]/g,'');
 if(value.type==='image'){
  if(typeof value.data!=='string'||value.data.length>400000||!/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$/.test(value.data))fail(400,'Use a small PNG or JPEG image.');
  const bytes=Buffer.from(value.data.split(',')[1],'base64');
  const valid=value.data.startsWith('data:image/png;')?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
  if(!valid)fail(400,'The image could not be read.');
  return {name,type:'image',data:value.data};
 }
 if(!['text','pdf'].includes(value.type)||typeof value.text!=='string'||!value.text.trim()||value.text.length>12000||value.text.includes('\u0000'))fail(400,'Attach up to 12,000 characters of readable text.');
 return {name,type:value.type,text:value.text};
}
export function userContent(prompt,attachment){
 if(!attachment)return prompt;
 if(attachment.type==='image')return [{type:'text',text:prompt+'\nAttached image: '+attachment.name},{type:'image_url',image_url:{url:attachment.data}}];
 return prompt+'\n\nAttached document ('+attachment.name+'):\n<document>\n'+attachment.text+'\n</document>';
}
