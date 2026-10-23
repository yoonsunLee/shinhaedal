/* 작품 창을 사진 앱처럼(작가 2026-10-23 — "애플·아이폰처럼 부드럽고 자연스럽게").
   1) 누른 작품 칸에서 그림이 커지며 열리고, 닫으면 지금 보던 작품의 칸으로 줄어 돌아간다(칸이 화면 밖이면 그 자리로 옮겨 둔 뒤).
   2) 폰(820px 이하): 그림을 옆으로 밀면 손을 따라오다가 놓으면 다음·이전 작품으로, 덜 밀면 제자리로 튕겨 돌아온다.
      아래로 끌면 그림이 손을 따라 작아지고 배경이 옅어지다가, 충분히 끌거나 빠르게 내리면 칸으로 돌아가며 닫힌다.
   작품 페이지·홈의 작품 창 코드(openWorkModal·hideWorkModal·stepWorkModal)를 감싸기만 하고 고치지 않는다.
   움직임 줄이기를 켰거나 그림이 아직 없으면 예전처럼 그냥 열고 닫는다. */
(function(){
  var modal = document.getElementById('workModal');
  if(!modal || !document.body.animate || typeof window.openWorkModal !== 'function' || typeof window.hideWorkModal !== 'function') return;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)');
  function motionOK(){ return !(reduce && reduce.matches); }
  var stage = document.getElementById('wmStage'), wmImg = document.getElementById('wmImg');
  var scroller = modal.querySelector('.work-modal');

  /* 아이폰과 비슷한 스프링(멈출 때 살짝 감기듯) — linear() 를 못 쓰는 브라우저는 iOS 곡선으로 */
  var SPRING = (function(){
    try{ if(!CSS.supports('animation-timing-function', 'linear(0, 1)')) return 'cubic-bezier(.32,.72,0,1)'; }catch(e){ return 'cubic-bezier(.32,.72,0,1)'; }
    var pts = [], w = 2 * Math.PI / 0.55, z = 0.82;           // 감쇠비 0.82: 거의 넘치지 않고 부드럽게 선다
    for(var i = 0; i <= 40; i++){
      var t = i / 40, wd = w * Math.sqrt(1 - z * z);
      var v = 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + (z * w / wd) * Math.sin(wd * t));
      pts.push(+v.toFixed(4));
    }
    pts[40] = 1;
    return 'linear(' + pts.join(', ') + ')';
  })();
  var IOS = 'cubic-bezier(.32,.72,0,1)';

  function idOf(el){ var h = el && el.getAttribute('href') || ''; var m = /\/w\/([^\/?#]+)/.exec(h); return m ? decodeURIComponent(m[1]) : null; }
  function thumbOf(tile){ return tile && tile.querySelector('.tile-media img'); }
  // object-fit:contain 으로 그려진 그림의 실제 자리(상자 안 가운데)
  function fitRect(box, nw, nh){
    if(!nw || !nh) return {left: box.left, top: box.top, width: box.width, height: box.height, right: box.right, bottom: box.bottom};
    var s = Math.min(box.width / nw, box.height / nh), w = nw * s, h = nh * s;
    var l = box.left + (box.width - w) / 2, t = box.top + (box.height - h) / 2;
    return {left: l, top: t, width: w, height: h, right: l + w, bottom: t + h};
  }
  function picRect(img){ return fitRect(img.getBoundingClientRect(), img.naturalWidth, img.naturalHeight); }
  function visible(r){ return r.width > 4 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; }
  function fly(src, from, to, dur, ease){
    var g = document.createElement('img');
    g.className = 'wm-fly'; g.alt = ''; g.setAttribute('aria-hidden', 'true'); g.decoding = 'sync'; g.src = src;
    g.style.cssText = 'left:' + to.left + 'px;top:' + to.top + 'px;width:' + to.width + 'px;height:' + to.height + 'px';
    document.body.appendChild(g);
    var sx = from.width / to.width, sy = from.height / to.height;
    var a = g.animate([{transform: 'translate(' + (from.left - to.left) + 'px,' + (from.top - to.top) + 'px) scale(' + sx + ',' + sy + ')'}, {transform: 'none'}],
                      {duration: dur, easing: ease, fill: 'forwards'});
    return {el: g, anim: a};
  }

  /* ---------- 1. 칸에서 열기 ---------- */
  var lastTile = null, lastTileAt = 0, openTile = null, openIdx = -1, flight = null;
  document.addEventListener('click', function(e){
    var t = e.target.closest && e.target.closest('.tile');
    if(t){ lastTile = t; lastTileAt = Date.now(); }
  }, true);
  var origOpen = window.openWorkModal;
  window.openWorkModal = function(idx){
    var tile = (lastTile && Date.now() - lastTileAt < 800) ? lastTile : document.querySelector('#workGrid .tile[data-idx="' + idx + '"]');
    lastTile = null;
    var th = thumbOf(tile);
    var wasOpen = modal.classList.contains('open');
    if(scroller) scroller.scrollTop = 0;
    if(wasOpen || !motionOK() || !th || !th.complete || !th.naturalWidth){ openTile = tile; openIdx = idx; return origOpen.apply(this, arguments); }
    var from = picRect(th);
    if(!visible(from)){ openTile = tile; openIdx = idx; return origOpen.apply(this, arguments); }
    modal.classList.add('wm-fly-on');
    var ret = origOpen.apply(this, arguments);
    openTile = tile; openIdx = idx;
    var to = fitRect(wmImg.getBoundingClientRect(), th.naturalWidth, th.naturalHeight);
    th.style.visibility = 'hidden';
    var f = flight = fly(th.currentSrc || th.src, from, to, 460, SPRING);
    var id = idOf(tile), t0 = performance.now();
    f.anim.onfinish = function(){
      th.style.visibility = '';
      // 큰 그림이 준비되면 같은 자리에서 사본과 바꾼다(사본 = 칸의 작은 그림)
      (function wait(){
        if(flight !== f) return;
        var vid = document.getElementById('wmVideoEmbed');
        var ready = !wmImg.hidden && wmImg.complete && wmImg.naturalWidth && (!id || (wmImg.currentSrc || wmImg.src).indexOf(id) >= 0);
        if(ready || (vid && !vid.hidden) || wmImg.hidden || performance.now() - t0 > 1800) return land(f);
        requestAnimationFrame(wait);
      })();
    };
    return ret;
  };
  function land(f){
    modal.classList.remove('wm-fly-on');
    modal.classList.add('wm-fly-land');
    var out = f.el.animate([{opacity: 1}, {opacity: 0}], {duration: 180, easing: 'cubic-bezier(.45,0,.55,1)', fill: 'forwards'});
    out.onfinish = function(){ f.el.remove(); if(flight === f) flight = null; modal.classList.remove('wm-fly-land'); };
  }
  function dropFlight(){ if(flight){ flight.el.remove(); flight = null; } modal.classList.remove('wm-fly-on', 'wm-fly-land'); }

  /* ---------- 칸으로 닫기 ---------- */
  function targetTile(){
    var cur = window.wmIndex;
    if(window.wmDetour) return null;                                  // 홈: 목록 밖 작품에 들른 중이면 돌아갈 칸이 없다
    if(openTile && cur === openIdx && document.contains(openTile)) return openTile;
    return document.querySelector('#workGrid .tile[data-idx="' + cur + '"]');
  }
  var origHide = window.hideWorkModal;
  window.hideWorkModal = function(){
    var open = modal.classList.contains('open');
    dropFlight();
    var tile = open && motionOK() ? targetTile() : null, th = thumbOf(tile);
    var vid = document.getElementById('wmVideoEmbed');
    var okImg = !wmImg.hidden && wmImg.complete && wmImg.naturalWidth && !(vid && !vid.hidden);
    if(!tile || !th || !th.complete || !th.naturalWidth || !okImg){ resetDrag(); return origHide.apply(this, arguments); }
    var from = picRect(wmImg);
    if(from.bottom < 40 || !visible(from)){ resetDrag(); return origHide.apply(this, arguments); }
    var tr = th.getBoundingClientRect();
    if(tr.top < 0 || tr.bottom > innerHeight) tile.scrollIntoView({block: 'center', behavior: 'instant'});
    var to = picRect(th);
    modal.classList.add('wm-fly-on');
    th.style.visibility = 'hidden';
    var el = document.createElement('img');
    el.className = 'wm-fly'; el.alt = ''; el.setAttribute('aria-hidden', 'true'); el.src = wmImg.currentSrc || wmImg.src;
    el.style.cssText = 'left:' + from.left + 'px;top:' + from.top + 'px;width:' + from.width + 'px;height:' + from.height + 'px';
    document.body.appendChild(el);
    var sx = to.width / from.width, sy = to.height / from.height;
    var a = el.animate([{transform: 'none'}, {transform: 'translate(' + (to.left - from.left) + 'px,' + (to.top - from.top) + 'px) scale(' + sx + ',' + sy + ')'}],
                       {duration: 400, easing: SPRING, fill: 'forwards'});
    var ret = origHide.apply(this, arguments);     // 배경·글은 끌던 모습에서 그대로 사라진다
    a.onfinish = function(){ th.style.visibility = ''; el.remove(); modal.classList.remove('wm-fly-on'); resetDrag(); };
    return ret;
  };

  /* ---------- 2. 폰: 옆으로 밀어 넘기기 · 아래로 끌어 닫기 ---------- */
  var narrow = window.matchMedia && matchMedia('(max-width:820px)');
  var g = null, suppressClick = 0;
  var fadeEls = function(){ return [document.getElementById('wmInfo'), document.getElementById('wmRail'), document.getElementById('wmCounter'),
                                    document.getElementById('wmPrev'), document.getElementById('wmNext'), document.getElementById('wmClose')].filter(Boolean); };
  function resetDrag(){
    wmImg.style.transform = '';
    wmImg.style.transition = '';
    modal.style.backgroundColor = '';
    fadeEls().forEach(function(el){ el.style.opacity = ''; });
  }
  stage.addEventListener('touchstart', function(e){
    if(!narrow || !narrow.matches || !motionOK() || e.touches.length !== 1 || !modal.classList.contains('open')) return;
    if(e.target.closest('button, a, .wm-video-embed, iframe') || wmImg.hidden) return;
    var t = e.touches[0];
    g = {x0: t.clientX, y0: t.clientY, dx: 0, dy: 0, mode: null, top: scroller ? scroller.scrollTop : 0, pts: [[t.clientX, t.clientY, performance.now()]]};
    wmImg.getAnimations().forEach(function(a){ a.cancel(); });
  }, {passive: true});
  stage.addEventListener('touchmove', function(e){
    if(!g) return;
    var t = e.touches[0];
    g.dx = t.clientX - g.x0; g.dy = t.clientY - g.y0;
    g.pts.push([t.clientX, t.clientY, performance.now()]); if(g.pts.length > 6) g.pts.shift();
    if(!g.mode){
      if(Math.hypot(g.dx, g.dy) < 8) return;
      if(Math.abs(g.dx) > Math.abs(g.dy) * 1.2) g.mode = 'h';
      else if(g.dy > 0 && g.top <= 0) g.mode = 'v';
      else { g = null; return; }                                       // 위로 끌기 = 창 내리기(원래대로)
    }
    e.preventDefault();
    if(g.mode === 'h'){
      wmImg.style.transform = 'translate3d(' + g.dx + 'px,0,0)';
    }else{
      var p = Math.min(1, Math.max(0, g.dy) / (innerHeight * 0.6));
      wmImg.style.transform = 'translate3d(' + (g.dx * 0.5) + 'px,' + Math.max(0, g.dy) + 'px,0) scale(' + (1 - p * 0.3) + ')';
      modal.style.backgroundColor = 'rgba(5,5,10,' + (1 - p * 0.85).toFixed(3) + ')';
      fadeEls().forEach(function(el){ el.style.opacity = String(Math.max(0, 1 - p * 3)); });
    }
  }, {passive: false});
  function velocityOf(s){ var a = s.pts[0], b = s.pts[s.pts.length - 1], dt = Math.max(1, b[2] - a[2]); return {x: (b[0] - a[0]) / dt, y: (b[1] - a[1]) / dt}; }
  function springBack(){
    var cur = wmImg.style.transform || 'none';
    wmImg.style.transform = '';
    wmImg.animate([{transform: cur}, {transform: 'none'}], {duration: 420, easing: SPRING});
    var bg = modal.style.backgroundColor;
    if(bg){ modal.style.backgroundColor = ''; modal.animate([{backgroundColor: bg}, {backgroundColor: 'rgb(5,5,10)'}], {duration: 300, easing: IOS}); }
    fadeEls().forEach(function(el){
      var o = el.style.opacity; el.style.opacity = '';
      if(o !== '') el.animate([{opacity: +o}, {opacity: 1}], {duration: 260, easing: IOS});
    });
  }
  stage.addEventListener('touchend', function(){
    if(!g) return;
    var s = g; g = null;
    if(!s.mode) return;
    suppressClick = Date.now();
    var v = velocityOf(s);
    if(s.mode === 'h'){
      // 넘기기: 폭의 30% 넘게 밀었고 반대로 튕기지 않았거나, 미는 쪽으로 빠르게 던졌을 때(아이폰 사진 앱과 같은 판단)
      var W = stage.clientWidth, sg = s.dx < 0 ? -1 : 1;
      var go = (Math.abs(s.dx) > W * 0.3 && !(v.x * sg < -0.2)) || (v.x * sg > 0.45 && Math.abs(s.dx) > 24);
      if(go){
        var dir = s.dx < 0 ? 1 : -1, cur = wmImg.style.transform;
        var a = wmImg.animate([{transform: cur, opacity: 1}, {transform: 'translate3d(' + (-dir * W * 0.9) + 'px,0,0)', opacity: 0}],
                              {duration: 200, easing: 'cubic-bezier(.3,.6,.4,1)', fill: 'forwards'});
        a.onfinish = function(){
          wmImg.style.visibility = 'hidden';                              // 바꾸는 쪽에서 지금 그림의 사본을 만들지 않게
          wmImg.style.transform = '';
          window.stepWorkModal(dir);
          wmImg.style.visibility = '';
          a.cancel();
        };
      }else springBack();
    }else{
      if(s.dy > 110 || v.y > 0.5){ window.closeWorkModal(); }
      else springBack();
    }
  });
  stage.addEventListener('touchcancel', function(){ if(g && g.mode) springBack(); g = null; });
  // 끌기 끝에 따라오는 '누르기'로 크게 보기가 열리지 않게
  stage.addEventListener('click', function(e){ if(Date.now() - suppressClick < 450){ e.stopPropagation(); e.preventDefault(); } }, true);
})();
