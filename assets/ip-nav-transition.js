/* Plays the IP entry transition on top of the CURRENT page (not the destination),
   then navigates once the reveal has grown to cover the screen.
   Independent overlay: never mutates the current page's own DOM/CSS. */
(function(){
  function isPlainClick(e){
    return e.button===0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
  }
  var reduceMotion=matchMedia('(prefers-reduced-motion: reduce)');
  var running=false;

  function load(src){
    return new Promise(function(resolve,reject){
      var i=new Image(); i.onload=function(){resolve(i)}; i.onerror=reject; i.src=src;
    });
  }
  var ease=function(t){ return 1-Math.pow(1-t,3); };

  function play(href){
    if(running) return;
    running=true;
    var targetUrl=href;
    var assetsBase=href+'assets/';
    var navigated=false;
    function go(){
      if(navigated) return;
      navigated=true;
      try{ sessionStorage.setItem('haedal_ip_skip_arrive','1'); }catch(e){}
      location.href=targetUrl;
    }

    var canvas,frame,timeout,done=false;
    function finish(){ if(done) return; done=true; cancelAnimationFrame(frame); clearTimeout(timeout); }

    Promise.race([
      Promise.all([load(assetsBase+'transition-character.png'), load(assetsBase+'transition-shell.png'), load(assetsBase+'beach.png')]),
      new Promise(function(_,reject){ timeout=setTimeout(function(){ reject(new Error('asset timeout')); }, 1800); })
    ]).then(function(assets){
      clearTimeout(timeout);
      var otterImg=assets[0], pearlImg=assets[1], beachImg=assets[2];

      // Derive a solid reveal silhouette from the shell alpha, including its internal linework.
      var mask=document.createElement('canvas');
      mask.width=pearlImg.width; mask.height=pearlImg.height;
      var mc=mask.getContext('2d',{willReadFrequently:true});
      mc.drawImage(pearlImg,0,0);
      var pixels=mc.getImageData(0,0,mask.width,mask.height);
      mc.clearRect(0,0,mask.width,mask.height);
      mc.fillStyle='#fff';
      for(var y=0;y<mask.height;y++){
        var left=-1,right=-1;
        for(var x=0;x<mask.width;x++){
          if(pixels.data[(y*mask.width+x)*4+3]>100){ if(left<0) left=x; right=x; }
        }
        if(left>=0) mc.fillRect(left,y,right-left+1,1);
      }

      canvas=document.createElement('canvas');
      canvas.setAttribute('aria-hidden','true');
      Object.assign(canvas.style,{position:'fixed',inset:'0',width:'100%',height:'100%',zIndex:'2147483000',pointerEvents:'none'});
      document.body.appendChild(canvas);
      var w=innerWidth,h=innerHeight,dpr=Math.min(devicePixelRatio||1,2);
      canvas.width=w*dpr; canvas.height=h*dpr;
      var ctx=canvas.getContext('2d'); ctx.scale(dpr,dpr);

      // Pre-render the destination's beach hero once, so the shell reveal shows the same
      // artwork the IP page will show, instead of the page currently underneath.
      var navH=76;
      var scene=document.createElement('canvas');
      scene.width=w; scene.height=h;
      var sc=scene.getContext('2d');
      sc.fillStyle='#fffdf7'; sc.fillRect(0,0,w,navH);
      var areaW=w, areaH=Math.max(h-navH,1);
      var scale=Math.max(areaW/beachImg.width, areaH/beachImg.height);
      var bw=beachImg.width*scale, bh=beachImg.height*scale;
      var bx=(areaW-bw)/2, by=navH+(areaH-bh)*0.44;
      sc.drawImage(beachImg,bx,by,bw,bh);

      var revealLayer=document.createElement('canvas');
      revealLayer.width=w; revealLayer.height=h;
      var rl=revealLayer.getContext('2d');

      var charH=Math.min(h*.66,550), charW=charH, baseY=h-charH*.74;
      var cx=w/2, cy=baseY+charH*.67, small=charH*.25;
      var large=Math.hypot(w,h)*4;
      var duration=950;
      var start;

      function draw(now){
        if(done) return;
        if(start===undefined) start=now;
        var t=(now-start)/duration;
        ctx.clearRect(0,0,w,h);

        if(t<.48){
          var dim=Math.min(t/.2,1)*.14;
          ctx.fillStyle='rgba(10,15,20,'+dim+')';
          ctx.fillRect(0,0,w,h);

          var p=ease(Math.min(t/.27,1));
          ctx.drawImage(otterImg, cx-charW/2, h+(baseY-h)*p, charW, charH);
          if(t>.32){
            ctx.globalAlpha=Math.min((t-.32)/.08,1);
            ctx.drawImage(pearlImg, cx-small/2, cy-small/2, small, small);
            ctx.globalAlpha=1;
          }
        } else {
          ctx.fillStyle='rgba(10,15,20,.14)';
          ctx.fillRect(0,0,w,h);
          ctx.drawImage(otterImg, cx-charW/2, baseY, charW, charH);

          var p2=Math.min((t-.48)/.52,1);
          var expand=Math.pow(p2,2.4);
          var size=small+(large-small)*expand;

          ctx.globalAlpha=Math.max(0,1-p2*5);
          ctx.drawImage(pearlImg, cx-small/2, cy-small/2, small, small);
          ctx.globalAlpha=1;

          rl.clearRect(0,0,w,h);
          rl.drawImage(mask, cx-size/2, cy-size/2, size, size);
          rl.globalCompositeOperation='source-in';
          rl.drawImage(scene,0,0,w,h);
          rl.globalCompositeOperation='source-over';
          ctx.drawImage(revealLayer,0,0,w,h);

          if(p2>.92) go();
        }

        if(t>=1){ go(); finish(); return; }
        frame=requestAnimationFrame(draw);
      }

      timeout=setTimeout(function(){ go(); finish(); if(canvas) canvas.remove(); }, duration+500);
      frame=requestAnimationFrame(draw);
    }).catch(function(){
      finish();
      if(canvas) canvas.remove();
      go();
    });
  }

  window.addEventListener('pageshow', function(e){ if(e.persisted) running=false; });

  document.querySelectorAll('a[href="ip/"], a[href="../ip/"]').forEach(function(a){
    if(a.target==='_blank') return;
    a.addEventListener('click', function(e){
      if(!isPlainClick(e)) return;
      if(reduceMotion.matches) return; // let the link navigate normally, no forced transition
      if(running) return; // a transition is already stuck/in-flight; fall back to a normal click
      e.preventDefault();
      play(a.getAttribute('href'));
    });
  });
})();
