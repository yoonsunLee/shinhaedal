/* 공통 모바일 메뉴(햄버거) 토글. index/works/about/press/contact 5개 페이지에서 공유. */
(function(){
  var ov = document.getElementById('navOverlay');
  if(!ov) return;
  var btnMenu = document.getElementById('btnMenu');
  var btnClose = document.getElementById('btnMenuClose');
  var lastFocused = null;

  function getFocusable(){
    return Array.prototype.slice.call(
      ov.querySelectorAll('a[href], button:not([disabled])')
    ).filter(function(el){ return el.offsetParent !== null; });
  }
  function openMenu(){
    lastFocused = document.activeElement;
    ov.classList.add('open');
    btnMenu.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    var focusables = getFocusable();
    if(focusables.length) focusables[0].focus();
  }
  function closeMenu(){
    ov.classList.remove('open');
    btnMenu.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    if(lastFocused){ lastFocused.focus(); lastFocused = null; }
    else btnMenu.focus();
  }
  btnMenu.onclick = openMenu;
  btnClose.onclick = closeMenu;
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
