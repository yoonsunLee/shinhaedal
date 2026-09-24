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
      Promise.all([load(assetsBase+'beach.webp')]),
      new Promise(function(_,reject){ timeout=setTimeout(function(){ reject(new Error('asset timeout')); }, 1800); })
    ]).then(function(assets){
      clearTimeout(timeout);
      var beachImg=assets[0];

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
      /* 도착할 IP 페이지의 해변을 미리 그려 둔다. 여기서 그리는 위치가 그 페이지의 실제 위치와
         어긋나면 넘어가는 순간 그림이 한 번 튄다(작가 지적). ip-story.css 의 규칙을 그대로 따른다.
           .hero   height:100svh 를 min/max 로 제한 (중단점마다 값이 다르다, --nav-h 90px 포함)
           .beach  그 히어로에서 사방으로 25px 넓은 상자(inset:-25px)에 cover 로 깔고
                   배경 위치는 center 44%, 580px 이하에서는 42% center
           --shore-y 는 스크롤로 정해지는데 도착 직후엔 0이므로 여기서는 셈에 넣지 않는다 */
      var navH=90;
      var probe=document.createElement('div');
      probe.style.cssText='position:fixed;top:0;left:0;width:0;height:100svh;visibility:hidden;pointer-events:none';
      document.body.appendChild(probe);
      var svh=probe.getBoundingClientRect().height||h;
      probe.remove();

      var minH, maxH, posX=0.5, posY=0.44;
      if(w<=580){ minH=710+navH; maxH=900+navH; posX=0.42; posY=0.5; }
      else if(w<=850){ minH=750+navH; maxH=950+navH; }
      else { minH=760+navH; maxH=1080+navH; }
      var heroH=Math.max(minH, Math.min(svh, maxH));

      var boxX=-25, boxY=-25, boxW=w+50, boxH=heroH+50;   // .beach 의 inset:-25px
      var scene=document.createElement('canvas');
      scene.width=w; scene.height=h;
      var sc=scene.getContext('2d');
      sc.fillStyle='#e7ede0'; sc.fillRect(0,0,w,h);        // .hero 의 바탕색(해변이 못 채우는 아래쪽)
      var scale=Math.max(boxW/beachImg.width, boxH/beachImg.height);
      var bw=beachImg.width*scale, bh=beachImg.height*scale;
      sc.drawImage(beachImg, boxX+(boxW-bw)*posX, boxY+(boxH-bh)*posY, bw, bh);

      // .hero::before — 맨 위만 종이색으로 옅게 덮는다(높이 --nav-h + 90px)
      var wash=sc.createLinearGradient(0,0,0,navH+90);
      wash.addColorStop(0,'rgba(255,253,247,.78)'); wash.addColorStop(.45,'rgba(255,253,247,.5)'); wash.addColorStop(1,'rgba(255,253,247,0)');
      sc.fillStyle=wash; sc.fillRect(0,0,w,navH+90);

      var revealLayer=document.createElement('canvas');
      revealLayer.width=w; revealLayer.height=h;
      var rl=revealLayer.getContext('2d');

      /* 막이 위에서 아래로 내려와 화면을 덮는다.
         위에서 시작하는 이유 — PC에서 IP 메뉴는 상단에 있어 누른 직후 눈이 거기에 있다.
         움직임이 눈이 있는 곳에서 시작해야 따라가지 않아도 된다(작가 지적).
         덮고 나면 도착한 IP 페이지에서 글과 캐릭터가 아래에서 위로 떠오른다 —
         내려온 것과 반대 방향이라 넘겨받는 느낌이 난다(ip-story.css @keyframes arrive). */
      var duration=1050;
      var start;
      function easeInOut(x){ return x<0.5 ? 4*x*x*x : 1-Math.pow(-2*x+2,3)/2; }

      function draw(now){
        if(done) return;
        if(start===undefined) start=now;
        var t=(now-start)/duration;
        ctx.clearRect(0,0,w,h);

        // 떠나는 화면을 뒤로 물린다. 14%로는 글자가 다 읽혀 새 장면과 경쟁한다
        ctx.fillStyle='rgba(10,15,20,'+(Math.min(t/0.30,1)*0.28)+')';
        ctx.fillRect(0,0,w,h);

        if(t>0.14){
          var wp=Math.min((t-0.14)/0.72,1);
          var edge=h*easeInOut(wp), soft=110;
          rl.clearRect(0,0,w,h);
          rl.drawImage(scene,0,0,w,h);
          rl.globalCompositeOperation='destination-in';
          var g=rl.createLinearGradient(0,edge+soft*0.25,0,edge-soft);
          g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(1,'rgba(0,0,0,1)');
          rl.fillStyle=g; rl.fillRect(0,-soft,w,edge+soft*1.25);
          rl.globalCompositeOperation='source-over';
          ctx.drawImage(revealLayer,0,0,w,h);
        }

        // 다 덮은 뒤 한 박자(약 150ms) 멈췄다가 넘어간다 — 로딩이 흔들려도 의도한 연출로 읽힌다
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
    ['beach.webp'].forEach(function(n){
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
