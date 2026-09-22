/* 국문·영문 주소 전환 — 국문은 /works/, 영문은 /en/works/ (scripts/build_en.py가 국문 페이지로 만든 정적 사본).
   홈·Works·About·Press·Contact·Privacy·IP 7개 페이지 맨 끝에서 읽는다(작품 페이지 works/w/…는 한 주소에서 전환).
   · KO/EN 버튼: 고른 언어를 site_lang에 적고 그 언어 주소로 옮긴다(보던 ?…·#… 그대로)
   · 영문 페이지는 <base href="/works/">처럼 국문 폴더 기준으로 상대 주소를 푼다. 그래서
     ① JS가 만든 국문 페이지 링크(예: '../works/?ex=…')는 누르기 직전에 /en/…으로 바꾸고
     ② 같은 페이지 안 이동(#…, BACK TO TOP)이 국문 페이지로 새지 않게 여기서 처리한다 */
(function(){
  var PAGES = ['/', '/works/', '/about/', '/press/', '/contact/', '/privacy/', '/ip/'];
  var path = location.pathname.replace(/index\.html$/, '');
  var isEn = /^\/en\//.test(path);
  var koPath = path.replace(/^\/en(?=\/)/, '');
  if(PAGES.indexOf(koPath) < 0) return;

  function dropLang(s){ return s.replace(/([?&])lang=(?:en|ko)(&|$)/, function(a, p, e){ return e ? p : ''; }); }
  function go(l){
    try{ localStorage.setItem('site_lang', l); }catch(e){}
    location.href = (l === 'en' ? '/en' : '') + koPath + dropLang(location.search) + location.hash;
  }
  var btnKo = document.getElementById('langKo'), btnEn = document.getElementById('langEn');
  if(btnKo) btnKo.onclick = function(){ if(isEn) go('ko'); };
  if(btnEn) btnEn.onclick = function(){ if(!isEn) go('en'); };
  if(!isEn) return;

  function toEn(a){
    var raw = a.getAttribute('href') || '';
    if(raw.charAt(0) === '#') return;
    var u;
    try{ u = new URL(a.href); }catch(e){ return; }
    if(u.origin !== location.origin) return;
    var p = u.pathname.replace(/index\.html$/, '');
    if(PAGES.indexOf(p) >= 0) a.href = '/en' + p + u.search + u.hash;
  }
  ['mousedown', 'touchstart', 'focusin', 'click', 'auxclick', 'contextmenu'].forEach(function(t){
    document.addEventListener(t, function(e){
      var a = e.target && e.target.closest && e.target.closest('a[href]');
      if(a) toEn(a);
    }, true);
  });
  document.addEventListener('click', function(e){
    if(e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target && e.target.closest && e.target.closest('a[href]');
    if(!a || a.target === '_blank') return;
    var raw = a.getAttribute('href');
    if(raw.charAt(0) !== '#') return;
    e.preventDefault();
    if(raw === '#' || raw === '#top') window.scrollTo(0, 0);
    else location.hash = raw;
  });
})();
