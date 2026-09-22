/* 상단 메뉴 움직임 — Vercel 대시보드 탭 방식(작가 선택 2026-09-22, 21st.dev 'Dorpdown Navigation' 참고).
   · 마우스를 올린 메뉴 뒤로 옅은 판이 깔리고, 옆 메뉴로 옮기면 판이 미끄러져 따라간다
   · 밑줄 두 개: 지금 페이지 메뉴(고정)와 올린 메뉴(따라감)
   · 메뉴 밖으로 나가면 판·따라가는 밑줄은 사라진다. 키보드(Tab)로 옮겨 다닐 때도 같다
   메뉴가 펼쳐진 넓은 화면에서만 보인다(좁은 화면은 햄버거 메뉴). 색·크기는 site.css / ip-story.css의 .nav-glide */
(function(){
  var menu = document.querySelector('nav .nav-menu');
  if(!menu) return;
  var links = Array.prototype.slice.call(menu.querySelectorAll('a'));
  if(!links.length) return;
  var li = document.createElement('li');
  li.className = 'nav-glide';
  li.setAttribute('aria-hidden', 'true');
  li.innerHTML = '<span class="ng-pill"></span><span class="ng-line ng-hover"></span><span class="ng-line ng-active"></span>';
  menu.appendChild(li);
  var pill = li.children[0], hoverLine = li.children[1], activeLine = li.children[2];
  var current = menu.querySelector('a[aria-current="page"]');
  var PAD_X = 10, PAD_Y = 6, LINE_GAP = 5;   // 판은 글자보다 좌우 10px·위아래 6px 크게, 밑줄은 판 아래 5px
  var shown = null;

  // 글자 칸(.nav-sweep, site.js가 감쌈)을 잰다 — <a> 자체는 공백 글꼴 탓에 높이가 반으로 잡힌다
  function box(a){
    var t = a.querySelector('.nav-sweep') || a;
    var r = t.getBoundingClientRect(), m = menu.getBoundingClientRect();
    return {x: r.left - m.left - PAD_X, y: r.top - m.top - PAD_Y, w: r.width + PAD_X * 2, h: r.height + PAD_Y * 2};
  }
  function toPill(a){
    var b = box(a);
    pill.style.transform = 'translate(' + b.x + 'px,' + b.y + 'px)';
    pill.style.width = b.w + 'px'; pill.style.height = b.h + 'px';
  }
  function toLine(el, a){
    var b = box(a);
    el.style.transform = 'translate(' + b.x + 'px,' + (b.y + b.h + LINE_GAP) + 'px)';
    el.style.width = b.w + 'px';
  }
  // 밖에서 처음 들어올 때는 미끄러지지 않고 그 자리에서 나타나게
  function instant(els, fn){
    els.forEach(function(e){ e.style.transition = 'none'; });
    fn();
    void li.offsetWidth;
    els.forEach(function(e){ e.style.transition = ''; });
  }
  function hover(a){
    if(shown) { toPill(a); toLine(hoverLine, a); }
    else instant([pill, hoverLine], function(){ toPill(a); toLine(hoverLine, a); });
    pill.style.opacity = '1'; hoverLine.style.opacity = '1';
    shown = a;
  }
  function leave(){
    shown = null;
    pill.style.opacity = '0'; hoverLine.style.opacity = '0';
  }
  function placeActive(){
    if(!current || !current.getClientRects().length) return;
    instant([activeLine], function(){ toLine(activeLine, current); });
    activeLine.style.opacity = '1';
  }

  links.forEach(function(a){
    a.addEventListener('mouseenter', function(){ hover(a); });
    a.addEventListener('focus', function(){
      var kb = true;
      try{ kb = a.matches(':focus-visible'); }catch(e){}
      if(kb) hover(a);
    });
    a.addEventListener('blur', function(){ if(shown === a) leave(); });
  });
  menu.addEventListener('mouseleave', leave);

  var rt = 0;
  window.addEventListener('resize', function(){
    clearTimeout(rt);
    rt = setTimeout(function(){
      placeActive();
      if(shown) instant([pill, hoverLine], function(){ toPill(shown); toLine(hoverLine, shown); });
    }, 80);
  });
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(placeActive);
  placeActive();
  // 처음 자리를 잡은 뒤부터 미끄러지는 전환을 켠다
  requestAnimationFrame(function(){ requestAnimationFrame(function(){ li.classList.add('ready'); }); });
})();
