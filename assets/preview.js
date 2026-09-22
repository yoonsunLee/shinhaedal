/* 아카이브(관리 화면) 미리보기 전용 — 평소 방문에는 불리지도 않는다.

   아카이브가 이 페이지를 iframe으로 띄우며 주소에 ?pv=1 을 붙이면, 각 페이지 <head>의
   한 줄짜리 로더가 이 파일을 먼저 불러온다. 이 파일은 data/*.json 요청을 가로채
   아카이브가 보내 준 '아직 반영 전' 데이터로 바꿔 끼운다. 페이지 코드는 실제 홈페이지 그대로다.

   - 데이터는 아카이브 주소(ADMIN_ORIGINS)에서 온 메시지만 받는다.
   - iframe 안에서 다른 메뉴로 옮겨 가도 미리보기가 이어지도록 sessionStorage에 표시를 남긴다
     (iframe 안에서만 쓰이는 저장소라 실제 방문과 섞이지 않는다).
   - 통계 등은 window.__SH_PREVIEW 가 true면 세지 않는다. */
(function(){
  var ADMIN_ORIGINS = ['https://yoonsunlee.github.io'];
  var framed = true;
  try{ framed = window.top !== window; }catch(e){}
  if(!framed) return;
  var on = /[?&]pv=1(&|$)/.test(location.search);
  try{
    if(on) sessionStorage.setItem('sh_pv', '1');
    else on = sessionStorage.getItem('sh_pv') === '1';
  }catch(e){}
  if(!on) return;
  window.__SH_PREVIEW = true;

  var files = null, waiting = [];
  window.addEventListener('message', function(e){
    if(ADMIN_ORIGINS.indexOf(e.origin) < 0 || !e.data || e.data.type !== 'sh-pv-data') return;
    files = e.data.files || {};
    waiting.splice(0).forEach(function(done){ done(); });
  });
  function ready(){
    if(files) return Promise.resolve();
    return new Promise(function(done){
      waiting.push(done);
      setTimeout(done, 6000); // 아카이브가 답하지 않으면 실제 파일로
    });
  }
  try{ window.parent.postMessage({type: 'sh-pv-hello', path: location.pathname + location.search}, '*'); }catch(e){}

  var realFetch = window.fetch.bind(window);
  window.fetch = function(input, init){
    var u;
    // 영문 페이지(/en/…)는 <base href>로 국문 폴더 기준 주소를 쓴다 — fetch와 같은 기준(document.baseURI)으로 푼다
    try{ u = new URL(typeof input === 'string' ? input : input.url, document.baseURI || location.href); }
    catch(e){ return realFetch(input, init); }
    var m = u.origin === location.origin && /^\/data\/(.+\.json)$/.exec(u.pathname);
    if(!m) return realFetch(input, init);
    var key = decodeURIComponent(m[1]);
    return ready().then(function(){
      if(files && Object.prototype.hasOwnProperty.call(files, key)){
        return new Response(JSON.stringify(files[key]), {status: 200, headers: {'Content-Type': 'application/json'}});
      }
      // 반영 전 데이터에 없는 작품(비공개로 바꾼 작품 등)은 실제 파일 대신 없음으로
      if(files && /^works\//.test(key)) return new Response('', {status: 404});
      return realFetch(input, init);
    });
  };
})();
