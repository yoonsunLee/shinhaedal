/* 숲길: 얼빵해달이 길을 따라 몇 걸음 걸어와 멈춘다(작가 2026-10-18 — "화살표처럼 길을 걸어가고 있다는 느낌").
   그림은 그대로다: 2번 슬라이드에서 얼빵해달만 떼어 낸 층을 길 위에서 옮길 뿐이고, 멈춘 모습은 원래 그림과 같다.
   걸음: 발끝을 축으로 좌우로 살짝 기우뚱(3°) + 들썩(키의 1.6%). 방향은 길 위 경계와 나란히(왼발이 경계에서 같은 거리).
   w1 = 화면에 들어오면 한 번 걸어와 멈춤 · w2 = 화면을 내리는 만큼 걸어옴(올리면 뒤로). 움직임 줄이기면 걷지 않는다. */
(function(){
  var art = document.querySelector('#forest .forest-art');
  if(!art || !window.matchMedia || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var MODE = 'w1';
  if(MODE === 'none') return;
  var otter = art.querySelector('.fa-otter'), tags = [].slice.call(art.querySelectorAll('.fa-tag'));
  if(!otter) return;
  var DIR = [0.73511, -0.67795];   // 멈춘 자리 → 시작 자리(길 위쪽)
  // 얼마나 위에서 출발하나(그림 폭 대비): PC 는 그려 준 화살표처럼 화면 오른쪽 끝 가까이(0.32), 폰은 글 바로 아래까지만(0.24 — 더 올라가면 글과 겹친다)
  var wide = matchMedia('(min-width: 851px)').matches;
  var DIST = wide ? 0.32 : 0.24, STEPS = wide ? 6 : 5, ROT = 3, BOB = 0.016, T = STEPS * 520;
  art.classList.add('walk-ready');
  function pose(p, amp){
    var w = art.clientWidth, d = (1 - p) * DIST * w;
    var s = p * STEPS, k = Math.floor(s), f = p >= 1 ? 0 : s - k;
    var lift = Math.sin(Math.PI * f) * (amp == null ? 1 : amp), side = k % 2 ? -1 : 1;
    otter.style.transform = 'translate(' + (DIR[0] * d).toFixed(2) + 'px,' + (DIR[1] * d - BOB * otter.clientHeight * lift).toFixed(2) + 'px) rotate(' + (side * ROT * lift).toFixed(2) + 'deg)';
  }
  var tagTimers = [];
  function arrive(){
    otter.style.transform = '';
    tags.forEach(function(t, i){ tagTimers.push(setTimeout(function(){ t.classList.add('on'); }, 140 + i * 150)); });
  }
  function hideTags(){ tagTimers.forEach(clearTimeout); tagTimers = []; tags.forEach(function(t){ t.classList.remove('on'); }); }
  pose(0);

  if(MODE === 'w1'){
    var running = false;
    var run = function(){
      if(running) return; running = true; hideTags();
      var t0 = null;
      var frame = function(ts){
        if(t0 === null) t0 = ts;
        var t = Math.min(1, (ts - t0) / T), p = t * (1.3 + t * (0.4 - 0.7 * t));   // 걷던 속도로 들어와 천천히 멈춤
        pose(p);
        if(t < 1) requestAnimationFrame(frame); else { running = false; arrive(); }
      };
      requestAnimationFrame(frame);
    };
    // 숲길 그림이 다 나타난 뒤(ip-motion.js 올라오기, 2026-10-23) 걷기 시작 — 수영장과 같은 순서. 최대 1.6초
    var whenShown = function(cb){ var t0 = performance.now(); (function chk(){ if(parseFloat(getComputedStyle(art).opacity) > 0.98 || performance.now() - t0 > 1600) cb(); else requestAnimationFrame(chk); })(); };
    var io = new IntersectionObserver(function(es){
      es.forEach(function(e){ if(e.isIntersecting){ io.disconnect(); whenShown(run); } });
    }, {threshold: 0.6});
    io.observe(otter);
    window.__forestWalkReplay = function(){ if(running) return; hideTags(); pose(0); setTimeout(run, 450); };
  }else{
    var cur = 0, tgt = 0, amp = 0, raf = 0, arrived = false;
    var target = function(){
      var r = art.getBoundingClientRect(), V = innerHeight;
      var feet = r.top + r.height * 0.86;      // 멈춘 자리의 발끝 높이
      return Math.max(0, Math.min(1, (V * 0.98 - feet) / (V * 0.5)));
    };
    var tick = function(){
      raf = 0;
      var dl = tgt - cur;
      cur += dl * 0.12; if(Math.abs(dl) < 0.0008) cur = tgt;
      amp += ((Math.abs(dl) > 0.002 ? 1 : 0) - amp) * 0.15;      // 멈추면 똑바로 선다
      if(cur >= 0.999){ if(!arrived){ arrived = true; arrive(); } }
      else{ if(arrived && cur < 0.97){ arrived = false; hideTags(); } pose(cur, amp); }
      if(cur !== tgt || amp > 0.01) raf = requestAnimationFrame(tick);
    };
    var onScroll = function(){ tgt = target(); if(!raf) raf = requestAnimationFrame(tick); };
    addEventListener('scroll', onScroll, {passive: true});
    addEventListener('resize', onScroll);
    onScroll();
  }
})();
