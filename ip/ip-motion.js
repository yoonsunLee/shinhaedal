/* IP 움직임 맞추기(작가 2026-10-23 — "IP 페이지는 모션이 통일성이 없다", 시안 _점검도구/motion/ipu 에서 다섯 가지 다 고름)
   ① 들어올 때 올라오기: 사이트 site.js 와 같은 방식 — 항목(제목·글·그림·친구 카드·숲길 그림) 하나하나가 보이면, 같이 들어온 것끼리 읽는 순서로 70ms 씩.
      글은 화면 아래 12% 안쪽에 들어와서야 시작해 조금 더 길게(24px·0.8초, ip-story.css) — 예전처럼 덩어리째 올리면 아래쪽 글은 화면 밖에서 끝나
      움직임이 안 보였다('텍스트 모션이 빠졌나'). 그림은 화면에 조금이라도 보이면.
   ② 아트토이 사진 보기: 누른 사진에서 커지며 열리고 그 자리로 줄어들며 닫힘, 넘길 때 겹쳐 바뀜, 폰은 옆으로 밀면 손을 따라옴(작품 창 wm-motion.js 와 같은 박자).
   (마무리 문장 '조개와 함께…' 밝아지기는 assets/sfx-lit.js, 숲길 걷기·수영장 헤엄은 그림이 다 나타난 뒤 시작 — forest-walk.js·pool-swim.js)
   움직임 줄이기면 아무것도 숨기지 않고 움직이지 않는다. 이 파일이 못 들어오면 .ipu-ready 가 없어 모두 그냥 보인다 */
(function(){
  if(!window.matchMedia || matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
  document.body.classList.add('ipu-ready');

  /* ① 들어올 때 올라오기 */
  var queued = [], raf = 0;
  // 숲길은 원래 장면 순서대로 글이 먼저, 그림은 글이 올라온 뒤(그림이 보이기 시작했을 때만 — 폰에서는 그림이 글 아래라 따로 들어온다)
  var forestArt = document.querySelector('.forest-art'), forestCopy = document.querySelector('.forest-copy > *'), artWaiting = false;
  function take(es){
    es.forEach(function(e){
      if(!e.isIntersecting) return;
      var el = e.target;
      io0.unobserve(el); io12.unobserve(el);
      if(el === forestArt && forestCopy && !forestCopy.classList.contains('ipu-in') && queued.indexOf(forestCopy) < 0){ artWaiting = true; return; }
      if(!el.classList.contains('ipu-in') && queued.indexOf(el) < 0) queued.push(el);
    });
    if(queued.length && !raf) raf = requestAnimationFrame(flush);
  }
  var io0 = new IntersectionObserver(function(es){ take(es.filter(function(e){ return !e.target.classList.contains('ipu-txt'); })); }, {threshold: 0.01});
  var io12 = new IntersectionObserver(take, {rootMargin: '0px 0px -12% 0px', threshold: 0});
  function flush(){
    raf = 0;
    var pos = queued.splice(0).map(function(el){ var r = el.getBoundingClientRect(); return {el: el, top: r.top, left: r.left}; });
    pos.sort(function(x, y){ return (Math.round(x.top / 12) - Math.round(y.top / 12)) || (x.left - y.left); });
    var fi = -1;   // 숲길 그림이 글과 같이 들어왔으면 글 뒤로
    pos.forEach(function(p, k){ if(p.el === forestArt) fi = k; });
    if(fi >= 0) pos.push(pos.splice(fi, 1)[0]);
    var step = pos.length > 6 ? 350 / (pos.length - 1) : 70;
    pos.forEach(function(p, k){ p.el.style.setProperty('--ipu-d', Math.round(k * step) + 'ms'); p.el.classList.add('ipu-in'); });
    if(artWaiting && forestCopy && forestCopy.classList.contains('ipu-in')){
      artWaiting = false;
      var withCopy = pos.some(function(p){ return p.el === forestCopy; });   // 글이 방금 올라왔으면 그 0.14초 뒤, 이미 올라와 있었으면 바로
      forestArt.style.setProperty('--ipu-d', (withCopy ? (parseInt(forestCopy.style.getPropertyValue('--ipu-d'), 10) || 0) + 140 : 0) + 'ms');
      forestArt.classList.add('ipu-in');
    }
  }
  document.querySelectorAll('.reveal > *, .toy-bottom > *, .member, .forest-art').forEach(function(el){
    if(!el.matches('.member, .forest-art, img') && !el.querySelector('img')){ el.classList.add('ipu-txt'); io12.observe(el); }
    else io0.observe(el);
  });
  // 맨 아래까지 내렸는데 화면 아래 12% 에 남아 시작 못 한 글이 있으면 그때 올린다
  addEventListener('scroll', function(){
    if(scrollY + innerHeight < document.documentElement.scrollHeight - 4) return;
    document.querySelectorAll('.ipu-txt:not(.ipu-in)').forEach(function(el){
      var r = el.getBoundingClientRect();
      if(r.top < innerHeight && r.bottom > 0 && queued.indexOf(el) < 0){ io12.unobserve(el); queued.push(el); }
    });
    if(queued.length && !raf) raf = requestAnimationFrame(flush);
  }, {passive: true});

  /* ② 아트토이 사진 보기. 사진 창은 dialog(맨 위 층)라 날아가는 사본도 창 안에 둔다 */
  (function(){
    var dlg = document.getElementById('viewer'), large = document.getElementById('viewer-image');
    if(!dlg || !large || !document.body.animate) return;
    var SPRING = 'cubic-bezier(.32,.72,0,1)';
    try{ if(CSS.supports('animation-timing-function', 'linear(0, 1)')) SPRING = 'linear(0, 0.19, 0.5, 0.75, 0.9, 0.98, 1.01, 1.012, 1.006, 1)'; }catch(e){}
    var opener = null, lastSrc = '', dragX = 0, flying = false, closing = false;
    function box(img, how){   // 그림이 실제로 그려진 자리(object-fit 에 맞춰)
      var b = img.getBoundingClientRect(), nw = img.naturalWidth, nh = img.naturalHeight;
      if(!nw || !nh || how === 'fill') return {left: b.left, top: b.top, width: b.width, height: b.height};
      var s = (how === 'cover' ? Math.max : Math.min)(b.width / nw, b.height / nh), w = nw * s, h = nh * s;
      return {left: b.left + (b.width - w) / 2, top: b.top + (b.height - h) / 2, width: w, height: h};
    }
    // 작은 사진 칸(r)·칸을 덮는 그림 자리(c) → 큰 사진 자리(t) 기준의 한 장면. 칸 밖으로 나간 부분은 잘라 둔다
    function frame(r, c, t){
      var s = c.width / t.width;
      return {transform: 'translate(' + (c.left - t.left) + 'px,' + (c.top - t.top) + 'px) scale(' + s + ')',
              clipPath: 'inset(' + Math.max(0, (r.top - c.top) / s) + 'px ' + Math.max(0, (c.left + c.width - r.left - r.width) / s) + 'px ' + Math.max(0, (c.top + c.height - r.top - r.height) / s) + 'px ' + Math.max(0, (r.left - c.left) / s) + 'px)'};
    }
    function thumbFrames(th, t){
      var how = getComputedStyle(th).objectFit, r = th.getBoundingClientRect();
      var c = box(th, how === 'cover' ? 'cover' : (how === 'contain' ? 'contain' : 'fill'));
      if(how === 'contain') r = c;
      return [frame(r, c, t), {transform: 'none', clipPath: 'inset(0px 0px 0px 0px)'}];
    }
    function clone(src, t){
      var g = document.createElement('img'); g.className = 'ipu-fly'; g.alt = ''; g.src = src;
      g.style.cssText = 'left:' + t.left + 'px;top:' + t.top + 'px;width:' + t.width + 'px;height:' + t.height + 'px';
      dlg.appendChild(g); return g;
    }
    document.addEventListener('click', function(e){ var b = e.target.closest && e.target.closest('.photo-open'); if(b) opener = b; }, true);
    var origShow = dlg.showModal.bind(dlg), origClose = dlg.close.bind(dlg);
    dlg.showModal = function(){
      origShow();
      lastSrc = large.getAttribute('src') || '';
      closing = false; dlg.classList.remove('ipu-closing'); dlg.classList.add('ipu-open');
      var th = opener && opener.querySelector('img');
      var go = function(){
        if(!th || !th.naturalWidth || !large.naturalWidth || !dlg.open) return;
        var t = box(large, 'contain'), f = thumbFrames(th, t), g = clone(large.currentSrc || large.src, t);
        large.style.opacity = '0'; flying = true;
        g.animate(f, {duration: 460, easing: SPRING, fill: 'forwards'}).onfinish = function(){ large.style.opacity = ''; flying = false; g.remove(); };
      };
      if(large.complete && large.naturalWidth) go(); else large.addEventListener('load', go, {once: true});
    };
    dlg.close = function(){
      if(!dlg.open) return origClose();
      if(closing) return;
      closing = true;
      var rail = [].slice.call(document.querySelectorAll('#viewerRail button'));
      var idx = rail.findIndex(function(b){ return b.getAttribute('aria-current') === 'true'; });
      var btn = document.querySelectorAll('.photo-open')[idx], th = btn && btn.querySelector('img'), r = th && th.getBoundingClientRect(), done = false;
      dlg.classList.remove('ipu-open'); dlg.classList.add('ipu-closing');
      var finish = function(){
        if(done) return; done = true; closing = false;
        dlg.classList.remove('ipu-closing'); large.style.opacity = '';
        [].slice.call(dlg.querySelectorAll('.ipu-fly')).forEach(function(g){ g.remove(); });
        origClose();
      };
      if(th && th.naturalWidth && large.naturalWidth && r.bottom > 0 && r.top < innerHeight){
        var t = box(large, 'contain'), f = thumbFrames(th, t), g = clone(large.currentSrc || large.src, t);
        large.style.opacity = '0';
        g.animate([f[1], f[0]], {duration: 380, easing: 'cubic-bezier(.32,.72,0,1)', fill: 'forwards'}).onfinish = finish;
        setTimeout(finish, 600);
      }else setTimeout(finish, 220);
    };
    dlg.addEventListener('cancel', function(e){ e.preventDefault(); dlg.close(); });
    // 넘기기: 바뀌기 전 사진을 겹쳐 두고 옅어지게(0.42초), 새 사진은 떠오르게. 손으로 밀었으면 민 쪽으로 빠지고 반대쪽에서 들어온다
    new MutationObserver(function(){
      var src = large.getAttribute('src') || '';
      if(!src || src === lastSrc){ lastSrc = src; return; }
      var prev = lastSrc; lastSrc = src;
      var dir = dragX < 0 ? -1 : (dragX > 0 ? 1 : 0), cur = large.style.transform || 'none';
      dragX = 0; large.style.transform = '';
      if(!dlg.open || flying || !prev) return;
      var gh = document.createElement('img'); gh.className = 'ipu-ghost'; gh.src = prev; gh.alt = '';
      gh.style.cssText = 'left:' + large.offsetLeft + 'px;top:' + large.offsetTop + 'px;width:' + large.offsetWidth + 'px;height:' + large.offsetHeight + 'px';
      large.parentNode.insertBefore(gh, large.nextSibling);
      var W = large.offsetWidth;
      gh.animate([{opacity: 1, transform: cur}, {opacity: 0, transform: dir ? 'translateX(' + (dir * W * 0.5) + 'px)' : 'none'}],
                 {duration: dir ? 300 : 420, easing: 'cubic-bezier(.45,0,.55,1)', fill: 'forwards'}).onfinish = function(){ gh.remove(); };
      large.animate(dir ? [{opacity: 0, transform: 'translateX(' + (-dir * W * 0.18) + 'px)'}, {opacity: 1, transform: 'none'}] : [{opacity: 0}, {opacity: 1}],
                    {duration: 420, easing: dir ? SPRING : 'cubic-bezier(.45,0,.55,1)'});
    }).observe(large, {attributes: true, attributeFilter: ['src']});
    // 폰: 옆으로 밀면 사진이 손을 따라온다. 넘길지는 ip-story.js 가 정하고(45px), 못 넘기면 스프링으로 제자리
    var x0 = null, y0 = 0, horiz = false;
    dlg.addEventListener('touchstart', function(e){
      x0 = null;
      if(e.touches.length !== 1 || e.target.closest('button')) return;
      x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; horiz = false; dragX = 0;
    }, {passive: true});
    dlg.addEventListener('touchmove', function(e){
      if(x0 === null || e.touches.length !== 1) return;
      var dx = e.touches[0].clientX - x0, dy = e.touches[0].clientY - y0;
      if(!horiz && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.2) horiz = true;
      if(horiz){ dragX = dx; large.style.transform = 'translateX(' + dx + 'px)'; }
    }, {passive: true});
    dlg.addEventListener('touchend', function(){
      if(x0 === null) return; x0 = null;
      if(large.style.transform){ var cur = large.style.transform; large.style.transform = ''; dragX = 0; large.animate([{transform: cur}, {transform: 'none'}], {duration: 460, easing: SPRING}); }
    });
  })();
})();
