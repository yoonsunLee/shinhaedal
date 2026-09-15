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
