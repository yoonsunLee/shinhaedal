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
    var assetsBase=href.replace(/^\/en\//,'/')+'assets/'; // 영문 IP(/en/ip/)도 그림은 /ip/assets/에 있다
    var navigated=false;
    function go(){
      if(navigated) return;
      navigated=true;
      try{ sessionStorage.setItem('haedal_ip_skip_arrive','1'); }catch(e){}
      location.href=targetUrl;
    }

    var canvas,frame,timeout,done=false;
    // keepCover=true 면 그림만 멈추고 덮개는 화면에 남긴다.
    // 이동을 시작해도 새 페이지가 그려지기까지는 시간이 걸린다. 그 사이에 덮개를 걷으면
    // 원래 보던 페이지가 한 번 드러났다가 넘어간다(작가 지적, 첫 방문처럼 목적지가 느릴 때).
    // 덮개는 페이지가 실제로 바뀔 때 문서와 함께 사라지고, 뒤로가기로 되돌아온 경우는
    // 아래 pageshow 핸들러가 지운다 — 여기서 굳이 지울 이유가 없다.
    function finish(keepCover){
      if(done) return; done=true;
      cancelAnimationFrame(frame); clearTimeout(timeout);
      if(!keepCover && canvas){ canvas.remove(); canvas=null; }
    }

    Promise.race([
      Promise.all([load(assetsBase+'transition-character.webp'), load(assetsBase+'transition-shell.webp'), load(assetsBase+'beach.webp')]),
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
      canvas.className='ip-transition-canvas';
      canvas.setAttribute('aria-hidden','true');
      Object.assign(canvas.style,{position:'fixed',inset:'0',width:'100%',height:'100%',zIndex:'2147483000',pointerEvents:'none'});
      document.body.appendChild(canvas);
      var w=innerWidth,h=innerHeight,dpr=Math.min(devicePixelRatio||1,2);
      canvas.width=w*dpr; canvas.height=h*dpr;
      var ctx=canvas.getContext('2d'); ctx.scale(dpr,dpr);

      // Pre-render the destination's beach hero once, so the shell reveal shows the same
      // artwork the IP page will show, instead of the page currently underneath.
      // IP 페이지처럼 해변 그림이 메뉴 뒤까지 이어지고, 맨 위만 종이색으로 옅게 덮는다(ip-story.css .hero::before)
      var navH=90;
      var scene=document.createElement('canvas');
      scene.width=w; scene.height=h;
      var sc=scene.getContext('2d');
      var areaW=w, areaH=Math.max(h,1);
      var scale=Math.max(areaW/beachImg.width, areaH/beachImg.height);
      var bw=beachImg.width*scale, bh=beachImg.height*scale;
      var bx=(areaW-bw)/2, by=(areaH-bh)*0.44;
      sc.drawImage(beachImg,bx,by,bw,bh);
      var wash=sc.createLinearGradient(0,0,0,navH+90);
      wash.addColorStop(0,'rgba(255,253,247,.78)'); wash.addColorStop(.45,'rgba(255,253,247,.5)'); wash.addColorStop(1,'rgba(255,253,247,0)');
      sc.fillStyle=wash; sc.fillRect(0,0,w,navH+90);

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

          // 화면을 완전히 덮은 뒤에 이동한다. 덜 덮은 채로 넘어가면 가장자리가 비친다.
          if(p2>=1){ go(); finish(true); return; }
        }

        if(t>=1){ go(); finish(true); return; }
        frame=requestAnimationFrame(draw);
      }

      timeout=setTimeout(function(){ go(); finish(true); }, duration+500);   // 늦어져도 덮개는 남긴다
      frame=requestAnimationFrame(draw);
    }).catch(function(){
      finish();
      go();
    });
  }

  window.addEventListener('pageshow', function(e){
    if(!e.persisted) return;
    running=false;
    // 안전장치: 어떤 경로로든 캔버스가 지워지지 않은 채 bfcache에 들어갔다면 복원 시 정리한다.
    document.querySelectorAll('.ip-transition-canvas').forEach(function(c){ c.remove(); });
  });

  /* 그림 세 장(304KB)을 누른 뒤에야 받기 시작하면, 받는 동안 화면에 아무 변화가 없어
     눌렀는데 멈춘 것처럼 보인다(느린 연결에서 1초 넘게 걸리는 것을 확인했다).
     그렇다고 모든 페이지에서 미리 받으면 IP로 가지 않는 사람에게도 304KB를 물리게 된다.
     그래서 "갈 것 같을 때"만 받는다 — 링크에 마우스를 올리거나 키보드 포커스가 닿는 순간,
     그리고 터치에서는 손가락이 닿는 순간. 누르기까지의 짧은 시간이 머리를 벌어 준다. */
  var warmed=false;
  function warmAssets(href){
    if(warmed || reduceMotion.matches) return;
    warmed=true;
    var base=href.replace(/^\/en\//,'/')+'assets/';
    ['transition-character.webp','transition-shell.webp','beach.webp'].forEach(function(n){
      load(base+n).catch(function(){});
    });
  }

  document.querySelectorAll('a[href="ip/"], a[href="../ip/"], a[href="/en/ip/"]').forEach(function(a){
    if(a.target==='_blank') return;
    var href=a.getAttribute('href');
    ['pointerenter','focus','touchstart'].forEach(function(ev){
      a.addEventListener(ev, function(){ warmAssets(href); }, {passive:true, once:true});
    });
    a.addEventListener('click', function(e){
      if(!isPlainClick(e)) return;
      if(reduceMotion.matches) return; // let the link navigate normally, no forced transition
      if(running) return; // a transition is already stuck/in-flight; fall back to a normal click
      e.preventDefault();
      play(a.getAttribute('href'));
    });
  });
})();
