/* IP 들어갈 때 얼빵해달 벽 — 작가 안(2026-10-16): 아래에서 일러스트 얼빵해달과 이세계 얼빵해달이 번갈아 줄지어 올라와
   화면을 덮고, IP 페이지에서는 같은 자리의 벽이 아래로 쏙 내려가며 열린다.
   · 떠나는 페이지: IP 링크를 누르면 벽을 세우고(뒤에는 IP 첫 화면의 해변을 미리 그려 둔다), 다 덮이면 IP 로 간다
   · IP 페이지(<head> 에서 바로 돈다): 방금 벽을 세우고 왔으면 같은 벽을 첫 화면보다 먼저 그려 두고 아래로 내려 보낸다
   배치는 화면 크기와 안(A·B·C)만으로 정해진다 — 두 페이지가 같은 자리에 같은 얼빵해달을 그려야 넘어가는 순간이 튀지 않는다.
   같은 방문(탭)에서 두 번째부터는 같은 벽을 짧게(작가 2026-10-16) — 자리는 같고 박자만 빠르다.
   움직임 줄이기를 켠 방문자는 벽 없이 그냥 넘어간다. */
(function(){
  var KEY = 'ip_wall';
  var IMG = {ill: '/ip/assets/wall-ill.webp', nacre: '/ip/assets/wall-nacre.webp'};
  var RATIO = 1.053;   // 두 그림 모두 실루엣 높이/폭(342×360, 339×360)
  var reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var FIXED = 'B';   // 실제 반영 때 고른 안(A·B·C). 시안에서는 비워 두고 sessionStorage 'ipfx' 로 고른다
  function variant(){ if(/^[ABCR]$/.test(FIXED)) return FIXED; try{ return sessionStorage.getItem('ipfx') || 'A'; }catch(e){ return 'A'; } }
  function rnd(r, c, k){ var x = Math.sin(r * 12.9898 + c * 78.233 + k * 37.719) * 43758.5453; return x - Math.floor(x); }

  /* 배치: 아래 줄부터 위로. 줄마다 반 칸 엇갈리고(벽돌), 위 줄은 아래 줄 뒤에 반쯤 숨는다. 두 얼빵해달은 바둑판처럼 번갈아 */
  function layout(W, H, v, quick){
    var cols = W < 600 ? 3 : W < 1000 ? 4 : 5;
    var cw = W / cols, size = cw * 1.16, h = size * RATIO, step = h * 0.52;
    var rows = v === 'C' ? 2 : Math.ceil((H - h * 0.9) / step) + 2;
    var B = v === 'B', out = [];
    var rowGap = v === 'C' ? 140 : B ? Math.min(60, 420 / Math.max(1, rows - 1)) : Math.min(80, 520 / Math.max(1, rows - 1));
    for(var r = 0; r < rows; r++){
      var off = (r % 2) ? cw / 2 : 0;
      for(var c = -1; c <= cols; c++){
        var cx = c * cw + cw / 2 + off;
        if(cx < -size * 0.45 || cx > W + size * 0.45) continue;
        var s = size * (B ? 0.9 + rnd(r, c, 3) * 0.2 : 1);
        var o = {r: r, z: rows - r, s: s,
          x: cx - s / 2 + (B ? (rnd(r, c, 1) - 0.5) * size * 0.22 : 0),
          b: r * step - h * 0.05 + (B ? (rnd(r, c, 2) - 0.5) * step * 0.35 : 0),
          rot: B ? Math.round((rnd(r, c, 4) - 0.5) * 18) : 0,
          t: ((r + c) % 2 + 2) % 2 ? 'nacre' : 'ill'};
        // 나타나는 차례 — A: 아래 줄부터, 줄 안에서는 왼쪽→오른쪽 물결 · B: 아래에서 위로 와르르 · C: 두 줄, 가운데부터
        o.d = v === 'B' ? r * rowGap + rnd(r, c, 5) * 130
            : v === 'C' ? r * rowGap + Math.abs(cx - W / 2) / W * 240
            : r * rowGap + Math.max(0, cx / W) * 150;
        if(quick) o.d *= 0.4;   // 두 번째부터: 자리는 같고 박자만 빠르게
        out.push(o);
      }
    }
    out.rows = rows;
    return out;
  }

  /* IP 첫 화면 해변을 그대로 미리 그린다 — ip-story.css 의 .hero / .beach / .hero::before 규칙(ip-nav-transition.js 와 같은 셈) */
  function beachCanvas(W, H, img){
    var dpr = Math.min(window.devicePixelRatio || 1, 2), cv = document.createElement('canvas');
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    var g = cv.getContext('2d'); g.scale(dpr, dpr);
    var navH = 90, probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:100svh;visibility:hidden;pointer-events:none';
    document.body.appendChild(probe); var svh = probe.getBoundingClientRect().height || H; probe.remove();
    var minH, maxH, px = 0.5, py = 0.44;
    if(W <= 580){ minH = 710 + navH; maxH = 900 + navH; px = 0.42; py = 0.5; }
    else if(W <= 850){ minH = 750 + navH; maxH = 950 + navH; }
    else { minH = 760 + navH; maxH = 1080 + navH; }
    var heroH = Math.max(minH, Math.min(svh, maxH)), bw0 = W + 50, bh0 = heroH + 50;
    g.fillStyle = '#e7ede0'; g.fillRect(0, 0, W, H);
    var sc = Math.max(bw0 / img.width, bh0 / img.height), bw = img.width * sc, bh = img.height * sc;
    g.drawImage(img, -25 + (bw0 - bw) * px, -25 + (bh0 - bh) * py, bw, bh);
    var wash = g.createLinearGradient(0, 0, 0, navH + 90);
    wash.addColorStop(0, 'rgba(255,253,247,.78)'); wash.addColorStop(.45, 'rgba(255,253,247,.5)'); wash.addColorStop(1, 'rgba(255,253,247,0)');
    g.fillStyle = wash; g.fillRect(0, 0, W, navH + 90);
    return cv;
  }

  function build(list){
    var root = document.createElement('div');
    root.id = 'ipWall'; root.setAttribute('aria-hidden', 'true');
    root.style.cssText = 'position:fixed;inset:0;z-index:2147483000;pointer-events:none;overflow:hidden';
    var imgs = list.map(function(o){
      var im = document.createElement('img');
      im.src = IMG[o.t]; im.alt = ''; im.decoding = 'sync'; im.draggable = false;
      im.style.cssText = 'position:absolute;left:' + o.x.toFixed(1) + 'px;bottom:' + o.b.toFixed(1) + 'px;width:' + o.s.toFixed(1) + 'px;height:' +
        (o.s * RATIO).toFixed(1) + 'px;max-width:none;z-index:' + o.z + ';transform-origin:50% 100%;will-change:transform;' + (o.rot ? 'rotate:' + o.rot + 'deg;' : '');
      root.appendChild(im);
      return im;
    });
    (document.body || document.documentElement).appendChild(root);
    return {root: root, imgs: imgs};
  }
  function load(src){ return new Promise(function(ok, no){ var i = new Image(); i.onload = function(){ ok(i); }; i.onerror = no; i.src = src; }); }

  /* ───────── IP 페이지: 방금 세운 벽을 이어받아 걷어 낸다 ─────────
     B 와르르: 올라온 기세 그대로 계속 위로 빠져나간다(작가 2026-10-16 "밑으로 떨어지지 말고 위로") — 먼저 온 아래 줄부터.
     A·C: 아래로 쏙 — 위(뒤) 줄부터.
     첫 화면 글·캐릭터는 벽이 걷히는 동안 붙잡아 두었다가(ipwall-hold) 풀어 준다 — 풀면 원래 세 박자
     (이름표·제목·얼빵해달 글자 → 캐릭터 → 나머지 글, 작가 2026-09-24)가 그 순간부터 그대로 돈다. */
  function arrive(){
    var s = null;
    try{ s = JSON.parse(sessionStorage.getItem(KEY) || 'null'); sessionStorage.removeItem(KEY); }catch(e){}
    if(!s || reduce || Date.now() - s.t > 10000) return;
    if(Math.abs(innerWidth - s.W) > 2 || Math.abs(innerHeight - s.H) > 120) return;   // 그사이 화면을 돌렸으면 벽 없이
    var de = document.documentElement, up = !!s.up || s.v === 'B', q = !!s.short, D = q ? 380 : 480;
    de.classList.add('ipwall-on', 'ipwall-hold');
    var st = document.createElement('style');
    st.textContent = '.ipwall-hold body>nav,.ipwall-hold .hero-inner .eyebrow,.ipwall-hold .hero-inner h1,.ipwall-hold .hero-inner .hero-name,' +
      '.ipwall-hold .hero-character img,.ipwall-hold .hero-inner .hero-note,.ipwall-hold .hero-inner .hero-actions,.ipwall-hold .hero-inner .hero-index' +
      '{animation:none!important;opacity:0!important}';
    (document.head || de).appendChild(st);
    var release = function(){ de.classList.remove('ipwall-hold'); };
    var safety = setTimeout(release, 3000);   // 무슨 일이 있어도 첫 화면은 나온다
    var list = layout(s.W, s.H, s.v, q), w = build(list);
    var ready = Promise.all(w.imgs.map(function(im){ return im.decode ? im.decode().catch(function(){}) : 0; }));
    Promise.race([ready, new Promise(function(r){ setTimeout(r, 400); })]).then(function(){
      requestAnimationFrame(function(){ setTimeout(function(){
        var rows = list.rows, last = 0;
        w.imgs.forEach(function(im, i){
          var o = list[i], delay, to;
          if(up){
            delay = o.r * (q ? 15 : 30) + rnd(o.r, i, 6) * (q ? 30 : 60);
            to = 'translate(' + ((rnd(o.r, i, 7) - 0.5) * 30).toFixed(0) + 'px,' + (-(s.H - o.b + 60)).toFixed(0) + 'px)';
          }else{
            delay = (rows - 1 - o.r) * (q ? 18 : 38);
            to = 'translateY(' + (o.b + o.s * RATIO + 60).toFixed(0) + 'px)';
          }
          last = Math.max(last, delay + D);
          im.animate([{transform: 'none'}, {transform: to}], {duration: D, delay: delay, easing: 'cubic-bezier(.5,0,.8,.25)', fill: 'forwards'});
        });
        // 위로 빠질 때는 제목이 있는 위쪽이 마지막에 열리므로 늦게, 아래로 쏙일 때는 위가 먼저 열리므로 일찍 푼다
        setTimeout(function(){ clearTimeout(safety); release(); }, last * (up ? (q ? 0.5 : 0.62) : s.v === 'C' ? 0.2 : 0.4));
        setTimeout(function(){ w.root.remove(); }, last + 60);
      }, 90); });
    });
  }

  /* ───────── 떠나는 페이지: IP 링크를 누르면 벽을 세운다 ───────── */
  var running = false, warmed = null;
  function warm(){ if(!warmed) warmed = Promise.all([load(IMG.ill), load(IMG.nacre), load('/ip/assets/beach.webp')]); return warmed; }
  function isIp(a){ try{ return /^\/(en\/)?ip\/?$/.test(new URL(a.href, location.href).pathname); }catch(e){ return false; } }
  function depart(href){
    if(running) return; running = true;
    var v = variant(), W = innerWidth, H = innerHeight, n = 0, up = v === 'B';
    try{ n = +sessionStorage.getItem('ip_wall_n') || 0; sessionStorage.setItem('ip_wall_n', n + 1); }catch(e){}
    var q = n >= 1;   // 같은 방문에서 두 번째부터는 짧게
    if(v === 'R'){ v = 'ABC'.charAt(Math.floor(Math.random() * 3)); up = true; }   // 시안 '랜덤': 셋 중 하나, 모두 위로
    var go = function(){ location.href = href; };
    var timer = setTimeout(function(){ running = false; go(); }, 1500);   // 그림을 못 받으면 벽 없이
    warm().then(function(a){
      clearTimeout(timer);
      var list = layout(W, H, v, q), w = build(list);
      var bg = beachCanvas(W, H, a[2]);
      bg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:0;opacity:0';
      w.root.insertBefore(bg, w.root.firstChild);
      bg.animate([{opacity: 0}, {opacity: 1}], {duration: q ? 350 : 650, delay: q ? 40 : v === 'C' ? 60 : 120, easing: 'ease-out', fill: 'forwards'});
      var dur = q ? 240 : v === 'B' ? 340 : 400, end = 0;
      w.imgs.forEach(function(im, i){
        var o = list[i]; end = Math.max(end, o.d + dur);
        im.animate([{transform: 'translateY(55%) scale(.72)', opacity: 0},
                    {transform: 'translateY(-5%) scale(1.04)', opacity: 1, offset: 0.62},
                    {transform: 'none', opacity: 1}],
                   {duration: dur, delay: o.d, easing: 'cubic-bezier(.22,.8,.3,1)', fill: 'both'});
      });
      // 마지막 줄이 다 서기 조금 전에 넘어간다 — 다 덮인 채로 멈춰 있으면 늘어진다. C 는 뒤 해변이 다 번진 뒤에
      end = q ? Math.max(end - 100, v === 'C' ? 420 : 380) : Math.max(end - 180, v === 'C' ? 760 : 700);
      setTimeout(function(){
        try{ sessionStorage.setItem(KEY, JSON.stringify({v: v, up: up, short: q, W: W, H: H, t: Date.now()})); }catch(e){}
        go();   // 벽은 그대로 둔다 — 새 페이지가 그려질 때 함께 사라진다(뒤로가기는 아래 pageshow 가 치운다)
      }, end);
    }, function(){ clearTimeout(timer); running = false; go(); });
  }
  function setupDepart(){
    // 링크에 손이 가면 그림을 미리 받는다(누른 뒤 받기 시작하면 멈춘 것처럼 보인다)
    ['pointerover', 'focusin', 'touchstart'].forEach(function(t){
      document.addEventListener(t, function(e){ var a = e.target.closest && e.target.closest('a[href]'); if(a && isIp(a) && !reduce) warm(); }, {passive: true, capture: true});
    });
    // 옛 IP 전환(ip-nav-transition.js, 링크에 직접 붙음)보다 먼저 받아서 그쪽은 돌지 않게 한다
    document.addEventListener('click', function(e){
      var a = e.target.closest && e.target.closest('a[href]');
      if(!a || !isIp(a) || reduce || a.target === '_blank') return;
      if(e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      depart(a.href);
    }, true);
    window.addEventListener('pageshow', function(e){
      if(!e.persisted) return;
      running = false; var r = document.getElementById('ipWall'); if(r) r.remove();
    });
  }

  if(/^\/(en\/)?ip\/?$/.test(location.pathname)) arrive();
  else if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setupDepart); else setupDepart();
  window.__ipWallLayout = layout;   // 점검 도구가 두 페이지의 배치가 같은지 본다
})();
