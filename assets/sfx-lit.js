/* 스크롤 연출 b(시안, 작가 2026-10-23): 문장이 스크롤 따라 한 단어씩 밝아진다(애플 제품 페이지처럼).
   페이지 중간의 짧은 문장에만 — About '쉽게 들어와서 오래 머무는 작업…', IP '처음부터 능숙한 존재는 없습니다…'.
   문단 윗변이 화면 맨 아래(95%)에 들어오면 시작해, 문단 아랫변이 화면 아래쪽 80%에 오면 다 밝아진다
   (10/23 작가 '문제 있다' — 가운데까지 내려야 밝아져 폰에서 다 보이는데도 흐린 글로 남았다). 멈추면 그 자리에 선다. 페이지 끝이면 다 밝힌다.
   언어를 바꿔 글이 새로 들어오면 다시 나눈다. 움직임 줄이기면 하지 않는다. */
(function(){
  if(!window.matchMedia || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var SEL = '.ab-note-hook, .pool-quote p';
  var on = function(){ var d = document.documentElement.dataset.sfx; return d === undefined || /\bb\b/.test(d); };
  var els = [].slice.call(document.querySelectorAll(SEL)), raf = 0;
  if(!els.length) return;
  function wrap(el){
    el.__sfxBusy = true;
    var w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), list = [], n;
    while((n = w.nextNode())) if(!(n.parentNode.classList && n.parentNode.classList.contains('sfx-w'))) list.push(n);
    list.forEach(function(t){
      var f = document.createDocumentFragment();
      t.data.split(/(\s+)/).forEach(function(s){
        if(!s) return;
        if(/^\s+$/.test(s)) f.appendChild(document.createTextNode(s));
        else { var sp = document.createElement('span'); sp.className = 'sfx-w'; sp.textContent = s; f.appendChild(sp); }
      });
      t.parentNode.replaceChild(f, t);
    });
    el.__w = [].slice.call(el.querySelectorAll('.sfx-w'));
    el.__last = -1;
    setTimeout(function(){ el.__sfxBusy = false; }, 0);
  }
  function clear(el){ (el.__w || []).forEach(function(s){ s.style.opacity = ''; }); el.__last = -1; }
  function update(){
    raf = 0;
    var vh = innerHeight, end = (scrollY + vh >= document.documentElement.scrollHeight - 4);
    els.forEach(function(el){
      if(!on()){ clear(el); return; }
      var r = el.getBoundingClientRect();
      if(r.bottom < -80 || r.top > vh + 80) return;
      var p = end ? 1 : Math.max(0, Math.min(1, (vh * 0.95 - r.top) / (vh * 0.15 + r.height)));
      if(Math.abs(p - el.__last) < 0.002) return;
      el.__last = p;
      var N = el.__w.length;
      el.__w.forEach(function(s, i){ var k = Math.max(0, Math.min(1, p * (N + 2) - i)); s.style.opacity = (0.35 + 0.65 * k).toFixed(3); });
    });
  }
  els.forEach(function(el){
    wrap(el);
    new MutationObserver(function(){ if(!el.__sfxBusy){ wrap(el); update(); } }).observe(el, {childList: true});
  });
  addEventListener('scroll', function(){ if(!raf) raf = requestAnimationFrame(update); }, {passive: true});
  addEventListener('resize', function(){ if(!raf) raf = requestAnimationFrame(update); });
  new MutationObserver(update).observe(document.documentElement, {attributes: true, attributeFilter: ['data-sfx']});
  update();
})();
