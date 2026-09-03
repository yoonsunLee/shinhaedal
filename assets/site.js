/* 공통 모바일 메뉴(햄버거) 토글. index/works/about/press/contact 5개 페이지에서 공유. */
(function(){
  var ov = document.getElementById('navOverlay');
  if(!ov) return;
  document.getElementById('btnMenu').onclick = function(){ ov.classList.add('open'); };
  document.getElementById('btnMenuClose').onclick = function(){ ov.classList.remove('open'); };
  ov.querySelectorAll('a').forEach(function(a){ a.onclick = function(){ ov.classList.remove('open'); }; });
})();
