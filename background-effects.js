'use strict';
(() => {
 const canvas=document.querySelector('#theme-canvas'),ctx=canvas.getContext('2d');
 let effect='none',color='#8B7BFF',animate=true,speed=1,w=0,h=0,points=[],raf=0,last=0,time=0;
 function resize(){
  w=innerWidth;h=innerHeight;const d=Math.min(devicePixelRatio||1,1.5);
  canvas.width=Math.round(w*d);canvas.height=Math.round(h*d);ctx.setTransform(d,0,0,d,0,0);
  points=Array.from({length:effect==='matrix'?Math.ceil(w/34):effect==='constellation'?65:150},()=>({x:Math.random()*w,y:Math.random()*h,z:Math.random(),speed:12+Math.random()*22,phase:Math.random()*6.28}));
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
  ctx.globalAlpha=1;
 }
 function paused(){return document.hidden||document.body.classList.contains('playing');}
 function tick(now){raf=0;if(paused()||!animate||effect==='none'||effect==='snow')return;
  if(now-last>=32){draw(Math.min((now-last)/1000,.06));last=now;}
  raf=requestAnimationFrame(tick);
 }
 function sync(){cancelAnimationFrame(raf);raf=0;canvas.hidden=effect==='none'||effect==='snow';if(!paused()){draw(0);last=performance.now();if(animate&&!canvas.hidden)raf=requestAnimationFrame(tick);}}
 window.setBackgroundEffect=(settings)=>{const changed=effect!==settings.effect;effect=settings.effect;color=settings.accent;animate=settings.snow;speed=settings.speed||1;if(changed)resize();sync();};
 new MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:['class']});
 document.addEventListener('visibilitychange',sync);window.addEventListener('resize',()=>{resize();sync();});
 resize();
})();

