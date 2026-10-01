'use strict';
(() => {
 const canvas=document.querySelector('#theme-canvas'),ctx=canvas.getContext('2d');
 let effect='none',color='#8B7BFF',animate=true,speed=1,w=0,h=0,points=[],raf=0,last=0,time=0;
 function resize(){
  w=innerWidth;h=innerHeight;const d=Math.min(devicePixelRatio||1,1.5);
  canvas.width=Math.round(w*d);canvas.height=Math.round(h*d);ctx.setTransform(d,0,0,d,0,0);
  points=Array.from({length:effect==='matrix'?Math.ceil(w/34):effect==='constellation'?65:effect==='casino'?38:effect==='cherry-blossom'?60:effect==='halloween'?24:150},()=>({x:Math.random()*w,y:Math.random()*h,z:Math.random(),speed:12+Math.random()*22,phase:Math.random()*6.28}));
  draw(0);
 }
 function dot(x,y,r,a){ctx.globalAlpha=a;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
 function draw(dt){
  dt*=speed;time+=dt;ctx.clearRect(0,0,w,h);ctx.fillStyle=color;ctx.strokeStyle=color;ctx.lineWidth=.7;
  if(effect==='matrix'){
   ctx.font='13px monospace';
   points.forEach((p,i)=>{
    p.y=(p.y+dt*p.speed)%(h+220);
    for(let j=0;j<12;j++){ctx.globalAlpha=(1-j/12)*.28;const char='01アイウエオカキクケコ'[Math.floor((i*13+j*7+Math.floor(time*2))%12)];ctx.fillText(char,i*34,p.y-j*19);}
   });
  }else if(effect==='constellation'){
   points.forEach(p=>{p.x=(p.x+dt*3)%w;p.y=(p.y+dt*2)%h;});
   for(let i=0;i<points.length;i++){
    const a=points[i];dot(a.x,a.y,1.5,.5);
    for(let j=i+1;j<points.length;j++){const b=points[j],d=Math.hypot(a.x-b.x,a.y-b.y);if(d<155){ctx.globalAlpha=(1-d/155)*.23;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}}
   }
  }else if(effect==='topography'){
   ctx.globalAlpha=.19;
   for(let k=-8;k<Math.ceil(h/24)+8;k++){
    ctx.beginPath();
    for(let x=-20;x<=w+20;x+=12){
     const y=k*26+Math.sin(x/180+k*.22+time*.04)*46+Math.cos(x/310-k*.17)*62+Math.sin(x/85+k*.1)*9;
     x===-20?ctx.moveTo(x,y):ctx.lineTo(x,y);
    }ctx.stroke();
   }
  }else if(effect==='starfield'){
   points.forEach(p=>{
    p.z+=dt*.014;if(p.z>1){p.z=.05;p.x=Math.random()*w;p.y=Math.random()*h;}
    const scale=.3+p.z*1.25,x=w/2+(p.x-w/2)*scale,y=h/2+(p.y-h/2)*scale;
    dot(x,y,.5+p.z*1.25,.18+p.z*.5);
   });
  }
  if(['casino','cherry-blossom','halloween'].includes(effect)){
   points.forEach((p,i)=>{
    const size=.65+p.z*.65;
    if(effect==='casino'){
     p.y+=dt*(p.speed+18);p.x+=Math.sin(time*.6+p.phase)*dt*6;
     if(p.y>h+45){p.y=-45;p.x=Math.random()*w;}
    }else{
     p.x+=dt*(p.speed+(effect==='halloween'?20:8));
     p.y+=Math.sin(time*.8+p.phase)*dt*7;
     if(p.x>w+55){p.x=-55;p.y=Math.random()*h;}
     if(p.y < -45)p.y=h+30;if(p.y>h+45)p.y=-30;
    }
    ctx.save();ctx.translate(p.x,p.y);ctx.scale(size,size);ctx.globalAlpha=.45;
    if(effect==='casino'){
     ctx.rotate(p.phase+time*.25);
     if(i%3!==0){
      ctx.fillStyle='#81aa7b';ctx.fillRect(-19,-9,38,18);ctx.strokeStyle='#315b38';ctx.lineWidth=1;ctx.strokeRect(-16,-6,32,12);
      ctx.fillStyle='#244d2c';ctx.font='bold 14px Georgia';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('$',0,1);
     }else{
      ctx.fillStyle='#eee8d8';ctx.beginPath();ctx.roundRect(-10,-10,20,20,4);ctx.fill();ctx.fillStyle='#303340';
      const value=Math.floor(i/3)%6+1,pips=[];
      if(value%2)pips.push([0,0]);if(value>1)pips.push([-5,-5],[5,5]);if(value>3)pips.push([5,-5],[-5,5]);if(value===6)pips.push([-5,0],[5,0]);
      pips.forEach(([x,y])=>{ctx.beginPath();ctx.arc(x,y,1.6,0,Math.PI*2);ctx.fill();});
     }
    }else if(effect==='cherry-blossom'){
     ctx.rotate(p.phase+time*.45);ctx.scale(1,.55+Math.abs(Math.sin(time*.6+p.phase))*.45);
     ctx.fillStyle=i%2?'#f4a6c1':'#e980aa';ctx.beginPath();ctx.moveTo(0,10);ctx.bezierCurveTo(-17,-1,-9,-15,0,-7);ctx.bezierCurveTo(9,-15,17,-1,0,10);ctx.fill();
     ctx.strokeStyle='#bd5f87';ctx.beginPath();ctx.moveTo(0,7);ctx.lineTo(0,-4);ctx.stroke();
    }else{
     const flap=Math.sin(time*7+p.phase)*11;
     ctx.rotate(Math.sin(time+p.phase)*.1);ctx.fillStyle='#81798e';
     for(const side of [-1,1]){ctx.save();ctx.scale(side,1);ctx.beginPath();ctx.moveTo(2,-3);ctx.quadraticCurveTo(14,-17+flap,29,-10+flap);ctx.quadraticCurveTo(22,-3,23,6);ctx.quadraticCurveTo(15,0,13,10);ctx.quadraticCurveTo(7,3,2,8);ctx.closePath();ctx.fill();ctx.restore();}
     ctx.fillStyle='#514759';ctx.beginPath();ctx.ellipse(0,2,5,10,0,0,Math.PI*2);ctx.fill();
     ctx.beginPath();ctx.moveTo(-5,-3);ctx.lineTo(-5,-12);ctx.lineTo(0,-7);ctx.lineTo(5,-12);ctx.lineTo(5,-3);ctx.fill();
     ctx.fillStyle='#f6d78c';ctx.fillRect(-3,-5,1.5,1.5);ctx.fillRect(1.5,-5,1.5,1.5);
     if(i%3===0){
      ctx.fillStyle='#e99238';ctx.beginPath();ctx.ellipse(0,-12,8,6,0,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='#ba652b';ctx.beginPath();ctx.ellipse(0,-12,3,6,0,0,Math.PI*2);ctx.stroke();
      ctx.fillStyle='#67834e';ctx.fillRect(-1,-21,2,4);ctx.fillStyle='#49302a';ctx.fillRect(-4,-13,2,2);ctx.fillRect(2,-13,2,2);
     }
    }
    ctx.restore();
   });
  }
  ctx.globalAlpha=1;
 }
 function paused(){return document.hidden||document.body.classList.contains('playing')||document.body.classList.contains('messages-open')||!document.querySelector('#ai-panel').hidden;}
 function tick(now){raf=0;if(paused()||!animate||effect==='none'||effect==='snow')return;
  if(now-last>=32){draw(Math.min((now-last)/1000,.06));last=now;}
  raf=requestAnimationFrame(tick);
 }
 function sync(){cancelAnimationFrame(raf);raf=0;canvas.hidden=effect==='none'||effect==='snow';if(!paused()){draw(0);last=performance.now();if(animate&&!canvas.hidden)raf=requestAnimationFrame(tick);}}
 window.setBackgroundEffect=(settings)=>{const changed=effect!==settings.effect;effect=settings.effect;color=settings.accent;animate=settings.snow;speed=settings.speed||1;if(changed)resize();sync();};
 new MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:['class']});
 document.addEventListener('visibilitychange',sync);window.addEventListener('hashchange',sync);window.addEventListener('resize',()=>{resize();sync();});
 resize();
})();

