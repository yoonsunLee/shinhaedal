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
