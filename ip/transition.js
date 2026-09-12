/* Independent overlay. Does not modify the IP page or its styles. */
window.HaedalTransition = (() => {
 let running=false;
 const load=src=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=src});
 const ease=t=>1-Math.pow(1-t,3);
 async function play({character,shell,onReveal=()=>{},duration=950}={}) {
  if(running)return;running=true;
  let canvas,timeout,frame,done=false,resolveEnd;
  const end=new Promise(r=>resolveEnd=r);
  const cleanup=()=>{if(done)return;done=true;cancelAnimationFrame(frame);clearTimeout(timeout);canvas?.remove();running=false;resolveEnd()};
  const reveal=()=>{try{onReveal()}catch(e){console.error(e)}};
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){reveal();cleanup();return end}
  try {
   const assets=await Promise.race([Promise.all([load(character),load(shell)]),new Promise((_,reject)=>setTimeout(()=>reject(Error('asset timeout')),1800))]);
   const [otter,pearl]=assets;
   // Derive a solid reveal silhouette from the supplied shell alpha, including its internal linework.
   const mask=document.createElement('canvas');mask.width=pearl.width;mask.height=pearl.height;
   const mc=mask.getContext('2d',{willReadFrequently:true});mc.drawImage(pearl,0,0);
   const pixels=mc.getImageData(0,0,mask.width,mask.height);mc.clearRect(0,0,mask.width,mask.height);mc.fillStyle='#fff';
   for(let y=0;y<mask.height;y++){let left=-1,right=-1;for(let x=0;x<mask.width;x++){if(pixels.data[(y*mask.width+x)*4+3]>100){if(left<0)left=x;right=x}}if(left>=0)mc.fillRect(left,y,right-left+1,1)}
   canvas=document.createElement('canvas');canvas.setAttribute('aria-hidden','true');Object.assign(canvas.style,{position:'fixed',inset:'0',width:'100%',height:'100%',zIndex:'2147483000',pointerEvents:'none'});document.body.append(canvas);
   const w=innerWidth,h=innerHeight,dpr=Math.min(devicePixelRatio||1,2);canvas.width=w*dpr;canvas.height=h*dpr;const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);
   const charH=Math.min(h*.66,550),charW=charH,baseY=h-charH*.74;
   const cx=w/2,cy=baseY+charH*.67,small=charH*.25;
   const large=Math.hypot(w,h)*4;
   let start,shown=false;
   const draw=now=>{if(done)return;if(start===undefined)start=now;const t=(now-start)/duration;
    ctx.clearRect(0,0,w,h);ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;ctx.fillStyle='#101a26';ctx.fillRect(0,0,w,h);
    if(t<.48){let p=ease(Math.min(t/.27,1));ctx.drawImage(otter,cx-charW/2,h+(baseY-h)*p,charW,charH);if(t>.32){ctx.globalAlpha=Math.min((t-.32)/.08,1);ctx.drawImage(pearl,cx-small/2,cy-small/2,small,small);ctx.globalAlpha=1}}
    else {
     if(!shown){shown=true;reveal()}
     const p=Math.min((t-.48)/.52,1),expand=Math.pow(p,2.4),size=small+(large-small)*expand;
     ctx.drawImage(otter,cx-charW/2,baseY,charW,charH);
     ctx.globalAlpha=Math.max(0,1-p*5);ctx.drawImage(pearl,cx-small/2,cy-small/2,small,small);ctx.globalAlpha=1;
     ctx.globalCompositeOperation='destination-out';ctx.drawImage(mask,cx-size/2,cy-size/2,size,size);ctx.globalCompositeOperation='source-over';
     if(p>.8)canvas.style.opacity=String((1-p)/.2);
    }
    if(t>=1){cleanup();return}frame=requestAnimationFrame(draw);
   };
   timeout=setTimeout(()=>{if(!shown)reveal();cleanup()},duration+500);
   frame=requestAnimationFrame(draw);
  }catch(e){reveal();cleanup()}
  return end;
 }
 return {play};
})();
