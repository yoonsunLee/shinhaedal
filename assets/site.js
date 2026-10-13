/* 공통 모바일 메뉴(햄버거) 토글. index/works/about/press/contact 5개 페이지에서 공유. */
(function(){
  var ov = document.getElementById('navOverlay');
  if(!ov) return;
  var backdrop = document.getElementById('navBackdrop');
  var btnMenu = document.getElementById('btnMenu');
  var btnClose = document.getElementById('btnMenuClose');
  var lastFocused = null;
  ov.inert = true; // 패널이 화면 밖으로 밀려나 있어도(display:none이 아니라 transform이라) 탭 포커스가 들어가지 않도록

  function getFocusable(){
    return Array.prototype.slice.call(
      ov.querySelectorAll('a[href], button:not([disabled])')
    ).filter(function(el){ return el.offsetParent !== null; });
  }
  function openMenu(){
    lastFocused = document.activeElement;
    ov.classList.add('open');
    ov.inert = false;
    if(backdrop) backdrop.classList.add('open');
    btnMenu.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    var focusables = getFocusable();
    if(focusables.length) focusables[0].focus();
  }
  function closeMenu(){
    ov.classList.remove('open');
    ov.inert = true;
    if(backdrop) backdrop.classList.remove('open');
    btnMenu.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    if(lastFocused){ lastFocused.focus(); lastFocused = null; }
    else btnMenu.focus();
  }
  btnMenu.onclick = openMenu;
  btnClose.onclick = closeMenu;
  if(backdrop) backdrop.onclick = closeMenu;
  ov.querySelectorAll('a').forEach(function(a){ a.onclick = closeMenu; });
  document.addEventListener('keydown', function(e){
    if(!ov.classList.contains('open')) return;
    if(e.key === 'Escape'){ closeMenu(); return; }
    if(e.key !== 'Tab') return;
    var focusables = getFocusable();
    if(!focusables.length) return;
    var first = focusables[0], last = focusables[focusables.length - 1];
    if(e.shiftKey && document.activeElement === first){
      e.preventDefault(); last.focus();
    }else if(!e.shiftKey && document.activeElement === last){
      e.preventDefault(); first.focus();
    }
  });
})();

/* 작품 이미지 외 일반 이미지(작가 사진 등)의 우클릭 저장 방지. 드래그 저장은 site.css의
   user-drag:none이 이미 막는다 — 여기서는 컨텍스트 메뉴(다른 이름으로 저장)만 막는다. */
(function(){
  document.addEventListener('contextmenu', function(e){
    if(e.target.tagName === 'IMG') e.preventDefault();
  });
})();

/* 상단 메뉴 글자를 span으로 감싸 호버 시 자개빛 스침 효과(site.css)의 대상으로 삼는다.
   href·클릭·이벤트는 <a>에 그대로 남아있어 링크 동작에는 영향이 없다. */
(function(){
  document.querySelectorAll('.nav-menu a').forEach(function(a){
    var span = document.createElement('span');
    span.className = 'nav-sweep';
    span.textContent = a.textContent;
    a.textContent = '';
    a.appendChild(span);
  });
})();
/* ---------- 다음 페이지 미리 만들어 두기(2026-10-12) ----------
   링크에 마우스를 올리면(폰은 누르는 순간) 그 페이지를 미리 만들어 둔다 — 누르면 바로 바뀌어 탭의 '불러오는 중' 표시가
   거의 안 보이고, 페이지 사이 전환도 끊기지 않는다(크롬·엣지·웨일). 모르는 브라우저는 지금과 같다.
   IP(자기 전환이 있고 무겁다)·작품 공유 페이지·작품 칸(누르면 창이 열린다)·새 창 링크는 뺀다.
   통계는 미리 만든 페이지가 실제로 보일 때만 센다(stats.js) */
(function(){
  if(!(window.HTMLScriptElement && HTMLScriptElement.supports && HTMLScriptElement.supports('speculationrules'))) return;
  var s = document.createElement('script');
  s.type = 'speculationrules';
  s.textContent = JSON.stringify({prerender:[{source:'document', eagerness:'moderate', where:{and:[
    {href_matches:'/*'},
    {not:{href_matches:['/ip/*', '/en/ip/*', '/works/w/*', '/en/works/w/*']}},
    {not:{selector_matches:'[target=_blank], [download], .tile, .ex-go'}}
  ]}}]});
  document.head.appendChild(s);
})();
/* IP 는 페이지 사이 전환에 참여하지 않는다(자기 전환이 있다). 그쪽으로 갈 때는 지금 페이지가 처음부터 전환을 건너뛴다 —
   안 그러면 브라우저가 전환을 시작했다가 '취소됨'을 콘솔에 남긴다 */
window.addEventListener('pageswap', function(e){
  var v = e.viewTransition, to = e.activation && e.activation.entry && e.activation.entry.url;
  if(!v || !to) return;
  try{ if(/^\/(en\/)?ip\//.test(new URL(to).pathname)){ v.ready.catch(function(){}); v.finished.catch(function(){}); v.skipTransition(); } }catch(err){}
});
/* ---------- 들어올 때 올라오기(2026-10-13) ----------
   페이지가 <head> 에서 정한 항목(window.__RISE)을, 디졸브가 끝나면(window.__riseGo) 화면에 보이는 것부터 올린다.
   차례(R.order): reading 읽는 순서 · interleave 단(R.cols)끼리 좌·우·좌·우 엇갈림 · diagonal 첫 칸에서의 격자 거리(물결) ·
   random 무작위. 화면 밖 항목은 스크롤해 조금이라도 보이면 같은 방식으로, 목록이 새로 그려지면(전시 고르기) 새 칸도.
   R.ready 가 있으면 그 칸이 처음 다시 그려질 때까지(최대 1.2초) 기다린다 — 두 번 오르지 않게.
   R.waitImg 가 있으면 칸마다 그 그림이 다 받아진 뒤에 올린다(최대 2.5초) — 빈 칸이 보이지 않게 */
(function(){
  var R = window.__RISE, d = document.documentElement;
  if(!R || !window.__riseGo || !d.classList.contains('rise-wait')) return;
  var pending = [], queued = [], started = false, raf = 0;
  var io = new IntersectionObserver(function(es){
    es.forEach(function(en){ if(en.isIntersecting){ io.unobserve(en.target); queued.push(en.target); } });
    schedule();
  }, {threshold:0.01});
  function collect(){
    Array.prototype.forEach.call(document.querySelectorAll(R.sel), function(el){
      if(el.classList.contains('is-risen') || pending.indexOf(el) >= 0) return;
      pending.push(el); io.observe(el);
    });
  }
  function schedule(){ if(started && !raf) raf = requestAnimationFrame(flush); }
  function uniq(v, tol){ var s = v.slice().sort(function(a, b){ return a - b; }), u = []; s.forEach(function(x){ if(!u.length || x - u[u.length - 1] > tol) u.push(x); }); return u; }
  function near(u, x, tol){ for(var i = 0; i < u.length; i++) if(Math.abs(u[i] - x) <= tol) return i; return 0; }
  function reading(a){ return a.slice().sort(function(x, y){ return (Math.round(x.top / 12) - Math.round(y.top / 12)) || (x.left - y.left); }); }
  // 한 묶음 안에서 항목마다 지연(ms)을 정한다
  function plan(list){
    var pos = list.map(function(el){ var r = el.getBoundingClientRect(); return {el:el, top:r.top, left:r.left}; });
    var step = R.step, out = [];
    if(R.order === 'interleave'){
      var head = [], cols = [], key = new Map();
      reading(pos).forEach(function(p){
        var c = R.cols && p.el.closest(R.cols);
        if(!c){ head.push(p); return; }
        if(!key.has(c)){ key.set(c, cols.length); cols.push([]); }
        cols[key.get(c)].push(p);
      });
      cols.sort(function(a, b){ return a[0].left - b[0].left; });   // 왼쪽 단부터
      var seq = head.slice();
      for(var i = 0; cols.some(function(c){ return i < c.length; }); i++) cols.forEach(function(c){ if(i < c.length) seq.push(c[i]); });
      seq.forEach(function(p, k){ out.push([p.el, k * step]); });
    }else if(R.order === 'diagonal'){
      var xs = uniq(pos.map(function(p){ return p.left; }), 8), ys = uniq(pos.map(function(p){ return p.top; }), 12);
      pos.forEach(function(p){ var c = near(xs, p.left, 8), r = near(ys, p.top, 12); out.push([p.el, Math.sqrt(r * r + c * c) * step]); });
    }else if(R.order === 'random'){
      var sh = pos.slice();
      for(var j = sh.length - 1; j > 0; j--){ var k = Math.floor(Math.random() * (j + 1)), t = sh[j]; sh[j] = sh[k]; sh[k] = t; }
      sh.forEach(function(p, n){ out.push([p.el, n * step + Math.random() * step * 0.6]); });
    }else reading(pos).forEach(function(p, n){ out.push([p.el, n * step]); });
    var max = out.reduce(function(m, o){ return Math.max(m, o[1]); }, 0), cap = R.cap || 1100;
    if(max > cap) out.forEach(function(o){ o[1] *= cap / max; });   // 한꺼번에 많으면 전체 길이에 맞춰 좁힌다
    return out;
  }
  function rise(el, delay){
    el.style.setProperty('--rise-delay', delay + 'ms');
    el.classList.add('is-risen');
    // 움직임이 끝나면 떼어 낸다 — 붙어 있으면 올렸을 때(hover) 효과를 막는다
    setTimeout(function(){ el.classList.add('rise-done'); }, delay + (R.dur || 900) + 120);
  }
  function flush(){
    raf = 0;
    var list = queued.splice(0).filter(function(el){ return el.isConnected && !el.classList.contains('is-risen'); });
    plan(list).forEach(function(o){
      var el = o[0], delay = Math.round(o[1]), k = pending.indexOf(el);
      if(k >= 0) pending.splice(k, 1);
      var img = R.waitImg && el.querySelector(R.waitImg);
      if(!img || (img.complete && img.naturalWidth) || img.style.visibility === 'hidden'){ rise(el, delay); return; }
      // 그림이 아직이면 다 받아질 때까지(최대 2.5초, R.waitMax) 기다렸다가, 원래 차례에서 이미 지난 만큼 빼고 올린다 — 빈 칸이 보이지 않게
      var t0 = performance.now(), done = false;
      function go(){ if(done) return; done = true; rise(el, Math.max(0, Math.round(delay - (performance.now() - t0)))); }
      img.addEventListener('load', go, {once:true});
      img.addEventListener('error', go, {once:true});
      if(img.loading === 'lazy') img.loading = 'eager';   // 화면에 들어온 칸은 바로 받기 시작하게
      setTimeout(go, R.waitMax || 2500);   // 아주 느린 인터넷에서도 너무 오래 비워 두지는 않게
    });
  }
  // 화면에 조금이라도 보이는데 아직 안 오른 항목을 한 묶음으로(아래 끝에 걸친 줄까지)
  function sweep(){
    pending.slice().forEach(function(el){
      var r = el.getBoundingClientRect();
      if(r.top < innerHeight && r.bottom > 0 && queued.indexOf(el) < 0){ io.unobserve(el); queued.push(el); }
    });
    schedule();
  }
  collect();
  (R.watch || []).forEach(function(id){ var g = document.getElementById(id); if(g) new MutationObserver(collect).observe(g, {childList:true}); });
  var ready = Promise.resolve();
  if(R.ready){
    var g = document.getElementById(R.ready);
    if(g) ready = new Promise(function(res){
      var mo = new MutationObserver(function(){ mo.disconnect(); res(); });
      mo.observe(g, {childList:true});
      setTimeout(function(){ mo.disconnect(); res(); }, 1200);
    });
  }
  function start(){
    if(started) return;
    started = true; collect(); sweep();
    if(document.fonts && document.fonts.ready) document.fonts.ready.then(sweep);   // 글꼴이 늦게 들어와 줄이 움직였으면 한 번 더
  }
  window.__riseGo.then(function(){ return ready; }).then(start);
  setTimeout(start, 4000);   // 무슨 일이 있어도 4초 뒤에는 다 보이게
})();
