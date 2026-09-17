/* 작품 개별 페이지(works/w/ID/)의 KO/EN 전환. 초기 언어는 페이지 <head>의 인라인 스크립트가 정한다. */
(function(){
  var html = document.documentElement;
  var btnKo = document.getElementById('langKo');
  var btnEn = document.getElementById('langEn');

  function apply(l){
    html.lang = l;
    if(btnKo) btnKo.classList.toggle('on', l === 'ko');
    if(btnEn) btnEn.classList.toggle('on', l === 'en');
    var t = html.getAttribute('data-title-' + l);
    if(t) document.title = t;
  }
  function choose(l){
    apply(l);
    try{ localStorage.setItem('site_lang', l); }catch(e){}
    try{
      var url = new URL(location.href);
      url.searchParams.set('lang', l);
      history.replaceState(null, '', url);
    }catch(e){}
  }

  if(btnKo) btnKo.addEventListener('click', function(){ choose('ko'); });
  if(btnEn) btnEn.addEventListener('click', function(){ choose('en'); });
  apply(html.lang === 'en' ? 'en' : 'ko');
})();
