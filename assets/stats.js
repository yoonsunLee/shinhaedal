/* 방문 통계 — 카페24 서버(국내)에 '무엇이 몇 번'만 보낸다. 방문자를 알아볼 수 있는 값은 만들지도 보내지도 않는다.
   처리방침 11항(방문 통계).

   세는 것: 페이지뷰 · 방문(30분 넘게 쉬었거나 다른 사이트에서 들어오면 새 방문) · 방문자(하루에 한 번)
            · 스크롤 깊이(25·50·75·100%) · 머문 시간(화면이 실제로 보이는 동안) · 버튼 클릭(수 · 누른 방문 수)
            · 구역 도달 · 작품별 열람과 머문 시간 · 들어온 곳(사이트 종류·캠페인 표시) · 언어 · 기기 종류
   세지 않는 경우: 아카이브 미리보기 · 브라우저의 추적 거부 신호(GPC·Do Not Track) · '이 브라우저를 통계에서 제외'
            · 자동화 브라우저·로봇
   브라우저에 남기는 것(localStorage 'sh_stat'): 마지막으로 센 날짜, 마지막 활동 시각, 이번 방문의 들어온 곳,
            이번 방문에서 이미 누른 버튼 종류 — 모두 이 브라우저 안에서만 쓰고 서버로 보내지 않는다.
   다른 페이지 코드는 window.shStat(이름, 대상) · window.shStatWork(작품번호|null)만 부르면 된다. */
(function(){
  // 처리방침 4차 개정(2026-09-22 시행)부터 수집. __SH_STATS_ENDPOINT는 로컬 시험용
  var ENDPOINT = window.__SH_STATS_ENDPOINT || 'https://shinhaedalapi.mycafe24.com/stats/collect.php';
  var KEY = 'sh_stat', OFF_KEY = 'sh_stat_off';
  var VISIT_GAP = 30 * 60 * 1000, FLUSH_MS = 15000, MAX_EVENTS = 40;
  var ls = null;
  try{ ls = window.localStorage; }catch(e){}
  function get(k){ try{ return ls ? ls.getItem(k) : null; }catch(e){ return null; } }
  function set(k, v){ try{ if(ls){ if(v === null) ls.removeItem(k); else ls.setItem(k, v); } }catch(e){} }

  // 처리방침 페이지의 '이 브라우저를 통계에서 제외' 버튼이 쓴다
  window.shStatOff = function(v){ if(v === undefined) return get(OFF_KEY) === '1'; set(OFF_KEY, v ? '1' : null); return !!v; };
  window.shStat = function(){}; window.shStatWork = function(){};

  var nav = window.navigator || {};
  // __SH_LANG_REDIRECT: 영문 주소로 옮겨 가는 중인 국문 페이지(옮겨 간 페이지에서 센다)
  var skip = !ENDPOINT || window.__SH_PREVIEW || window.__SH_LANG_REDIRECT || nav.webdriver || nav.globalPrivacyControl === true ||
    nav.doNotTrack === '1' || window.doNotTrack === '1' || nav.msDoNotTrack === '1' || get(OFF_KEY) === '1' ||
    /bot|crawl|spider|slurp|headless|lighthouse|preview/i.test(nav.userAgent || '');
  if(skip) return;

  /* ---------- 페이지·언어·기기 ---------- */
  // 영문 페이지(/en/works/)도 같은 페이지로 센다 — 언어는 따로(l) 보낸다
  // 주소가 제각각인 곳(없는 페이지, 처리방침 지난 판)은 페이지가 __SH_PAGE로 이름을 정한다
  function pageKey(){
    if(typeof window.__SH_PAGE === 'string' && /^\/[a-z0-9\-\/]*\/$/.test(window.__SH_PAGE)) return window.__SH_PAGE;
    var p = location.pathname.replace(/index\.html$/, '').replace(/^\/en(?=\/)/, '');
    if(p.charAt(p.length - 1) !== '/') p += '/';
    return p;
  }
  var PAGE = pageKey();
  function lang(){ return (window.LANG === 'en' || document.documentElement.lang === 'en') ? 'en' : 'ko'; }
  function device(){
    // 손가락으로 쓰는 화면(coarse)이면 짧은 변 600px 기준으로 폰·태블릿, 아니면 컴퓨터(터치 노트북 포함)
    var coarse = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
    var s = Math.min(screen.width || 0, screen.height || 0);
    if(coarse) return s && s < 600 ? 'm' : 't';
    return window.innerWidth <= 560 ? 'm' : 'd';
  }
  function todayKST(){ return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10); }

  /* ---------- 들어온 곳: 사이트 종류만(전체 주소·검색어는 버림) + 캠페인 표시(?src=ig_bio 등) ---------- */
  function refHost(){
    try{ return document.referrer ? new URL(document.referrer).hostname.toLowerCase() : ''; }catch(e){ return ''; }
  }
  function isOwn(h){ return !h || h === location.hostname || /(^|\.)shinhaedal\.com$/.test(h); }
  function sourceOf(h){
    var q = '';
    try{ q = (new URLSearchParams(location.search).get('src') || '').toLowerCase(); }catch(e){}
    if(/^[a-z0-9_]{1,20}$/.test(q)) return 'c:' + q;
    var ua = nav.userAgent || '';
    if(!h){
      if(/Instagram/i.test(ua)) return 'instagram';
      if(/Barcelona|Threads/i.test(ua)) return 'threads';
      if(/KAKAOTALK/i.test(ua)) return 'kakao';
      if(/FBAN|FBAV/i.test(ua)) return 'facebook';
      if(/NAVER\(inapp/i.test(ua)) return 'naver';
      return 'direct';
    }
    var map = [[/(^|\.)instagram\.com$/, 'instagram'], [/(^|\.)threads\.(net|com)$/, 'threads'], [/kakao/, 'kakao'],
      [/(^|\.)(facebook\.com|fb\.com|fb\.me)$/, 'facebook'], [/(^|\.)(t\.co|x\.com|twitter\.com)$/, 'x'],
      [/^blog\.naver\.com$|^m\.blog\.naver\.com$/, 'naver_blog'], [/(^|\.)naver\.com$/, 'naver'], [/(^|\.)google\./, 'google'],
      [/(^|\.)daum\.net$/, 'daum'], [/(^|\.)bing\.com$/, 'bing'], [/(^|\.)(duckduckgo\.com|yahoo\.|baidu\.com|yandex\.|ecosia\.org)/, 'search'],
      [/(^|\.)idus\.com$/, 'idus'], [/(^|\.)youtube\.com$|^youtu\.be$/, 'youtube']];
    for(var i = 0; i < map.length; i++) if(map[i][0].test(h)) return map[i][1];
    return 'other';
  }

  /* ---------- 방문·방문자 ---------- */
  var st = {};
  try{ st = JSON.parse(get(KEY) || '{}') || {}; }catch(e){ st = {}; }
  var now = Date.now(), today = todayKST(), host = refHost();
  var campaign = false;
  try{ campaign = !!new URLSearchParams(location.search).get('src'); }catch(e){}
  var newVisit = !st.t || now - st.t > VISIT_GAP || !isOwn(host) || campaign;
  if(newVisit){ st.s = sourceOf(isOwn(host) ? '' : host); st.b = {}; }
  var newVisitor = st.d !== today;
  st.d = today; st.t = now;
  if(!st.b || typeof st.b !== 'object') st.b = {};
  function save(){ set(KEY, JSON.stringify(st)); }
  save();

  /* ---------- 보내기 ---------- */
  var queue = [];
  function push(ev){ queue.push(ev); if(queue.length >= MAX_EVENTS) flush(); }
  function flush(){
    if(!queue.length) return;
    var body = JSON.stringify({v:1, l:lang(), s:st.s || 'direct', d:device(), e:queue.splice(0, MAX_EVENTS)});
    var ok = false;
    try{ ok = nav.sendBeacon && nav.sendBeacon(ENDPOINT, body); }catch(e){}
    if(!ok){ try{ fetch(ENDPOINT, {method:'POST', body:body, keepalive:true, mode:'no-cors', credentials:'omit'}); }catch(e){} }
    if(queue.length) flush();
  }
  setInterval(function(){ if(!document.hidden) flush(); }, FLUSH_MS);

  push(['pv', PAGE]);
  if(newVisit) push(['visit', PAGE]);
  if(newVisitor) push(['visitor', PAGE]);
  flush();

  /* 버튼·링크: x=1이면 이번 방문에서 처음 누른 것(서버가 '누른 방문 수'에 더한다) */
  function clean(v){ return String(v == null ? '' : v).replace(/[^A-Za-z0-9_\-.\/:]/g, '').slice(0, 64); }
  function click(name, target){
    name = clean(name); target = clean(target);
    if(!name) return;
    var k = name + '|' + target, first = !st.b[k];
    st.b[k] = 1; st.t = Date.now(); save();
    push(['click', name, target, first ? 1 : 0]);
  }
  window.shStat = click;

  /* ---------- 스크롤 깊이 ---------- */
  var marks = {};
  function onScroll(){
    var d = document.documentElement, h = Math.max(d.scrollHeight, document.body ? document.body.scrollHeight : 0);
    var pct = h > 0 ? ((window.scrollY || d.scrollTop || 0) + window.innerHeight) / h * 100 : 100;
    [25, 50, 75, 100].forEach(function(m){ if(pct >= m - (m === 100 ? 2 : 0) && !marks[m]){ marks[m] = 1; push(['scroll', PAGE, String(m)]); } });
  }
  var sT = 0;
  window.addEventListener('scroll', function(){ if(!sT) sT = setTimeout(function(){ sT = 0; onScroll(); }, 250); }, {passive:true});
  window.addEventListener('load', function(){ setTimeout(onScroll, 500); });

  /* ---------- 머문 시간(화면이 보이는 동안만) — 처음 화면을 떠날 때 한 번 보낸다 ---------- */
  var visMs = 0, visFrom = document.hidden ? 0 : Date.now(), dwellSent = false;

  /* ---------- 구역 도달·구역별 머문 시간 ---------- */
  var ZONES = {
    '/': [['recent', '#works'], ['about', '.about-teaser-wrap'], ['ip', '.ip-teaser-wrap']],
    '/about/': [['note', '.ab-note'], ['credentials', '.ab-credentials'], ['exhibitions', '#exList']],
    '/ip/': [['intro', '#intro'], ['story', '#story'], ['pool', '#pool'], ['identity', '#identity'], ['toy', '#toy'], ['friends', '#friends'], ['licensing', '#licensing']]
  }[PAGE] || [];
  var zoneOn = {}, zoneMs = {}, zoneFrom = {};
  if(ZONES.length && 'IntersectionObserver' in window){
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        var z = en.target.getAttribute('data-stat-zone');
        // 구역의 30% 이상이 보이거나, 구역이 화면의 30% 이상을 차지하면 '도달'(화면보다 긴 구역 대비)
        var cover = en.rootBounds && en.rootBounds.height ? en.intersectionRect.height / en.rootBounds.height : 0;
        if(en.isIntersecting && (en.intersectionRatio >= 0.3 || cover >= 0.3)){
          if(!zoneOn[z]){ zoneOn[z] = 1; push(['reach', PAGE, z]); }
          if(!zoneFrom[z] && !document.hidden) zoneFrom[z] = Date.now();
        }else if(zoneFrom[z]){
          zoneMs[z] = (zoneMs[z] || 0) + Date.now() - zoneFrom[z]; zoneFrom[z] = 0;
        }
      });
    }, {threshold:[0, 0.1, 0.2, 0.3, 0.5, 0.75, 1]});
    var bind = function(){
      ZONES.forEach(function(z){ var el = document.querySelector(z[1]); if(el && !el.hasAttribute('data-stat-zone')){ el.setAttribute('data-stat-zone', z[0]); io.observe(el); } });
    };
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind); else bind();
  }

  /* ---------- 작품 창(팝업)·작품 페이지: 열람과 작품별 머문 시간 ---------- */
  var work = null, workMs = 0, workFrom = 0;
  function workEnd(){
    if(!work) return;
    var ms = workMs + (workFrom ? Date.now() - workFrom : 0);
    if(ms >= 1000) push(['wdwell', 'work', work, Math.round(ms / 1000)]);
    work = null; workMs = 0; workFrom = 0;
  }
  window.shStatWork = function(no, where){
    no = clean(no);
    if(no === work) return;
    workEnd();
    if(!no) return;
    work = no; workMs = 0; workFrom = document.hidden ? 0 : Date.now();
    push(['wview', clean(where || 'modal'), no]);
  };
  var pm = PAGE.match(/^\/works\/w\/([A-Za-z0-9-]+)\/$/);
  if(pm) window.shStatWork(pm[1], 'page');

  /* ---------- 화면을 떠날 때 ---------- */
  function onHide(){
    if(visFrom){ visMs += Date.now() - visFrom; visFrom = 0; }
    if(workFrom){ workMs += Date.now() - workFrom; workFrom = 0; }
    Object.keys(zoneFrom).forEach(function(z){ if(zoneFrom[z]){ zoneMs[z] = (zoneMs[z] || 0) + Date.now() - zoneFrom[z]; zoneFrom[z] = 0; } });
    if(!dwellSent){
      dwellSent = true;
      push(['dwell', PAGE, '', Math.round(visMs / 1000)]);
      Object.keys(zoneMs).forEach(function(z){ if(zoneMs[z] >= 1000) push(['zdwell', PAGE, z, Math.round(zoneMs[z] / 1000)]); });
      if(work) workEnd();
    }
    st.t = Date.now(); save();
    flush();
  }
  document.addEventListener('visibilitychange', function(){
    if(document.hidden) onHide();
    else{ visFrom = Date.now(); if(work) workFrom = Date.now(); }
  });
  window.addEventListener('pagehide', onHide);

  /* ---------- 버튼 자동 기록(페이지 코드를 거의 건드리지 않도록 여기서 모아 본다) ---------- */
  function workNoFromHref(a){
    var h = a.getAttribute('href') || '', m = h.match(/[?&]w=([A-Za-z0-9-]+)/) || h.match(/(?:^|\/)w\/([A-Za-z0-9-]+)\//);
    return m ? m[1] : '';
  }
  function exFromHref(a){ var m = (a.getAttribute('href') || '').match(/[?&]ex=([A-Za-z0-9-]+)/); return m ? m[1] : ''; }
  function outKind(a){
    var h = '';
    try{ h = new URL(a.href, location.href).hostname; }catch(e){}
    if(/instagram\.com$/.test(h)) return 'instagram';
    if(/idus\.com$/.test(h)) return 'brand_shop';
    if(/threads\./.test(h)) return 'threads';
    if(/youtube\.com$|youtu\.be$/.test(h)) return 'youtube';
    return h ? 'other' : '';
  }
  var RULES = [
    // 공통: 메뉴·언어·바깥 링크
    ['body > nav .nav-menu a, #navOverlay a', function(el){ var k = outKind(el); return ['menu', k || (el.getAttribute('href') || '').replace(/^(\.\.\/)+|^\.\//, '/').replace(/^\/?/, '/').replace(/^\/en(?=\/)/, '')]; }],
    ['#langKo, #langEn', function(el){ return ['lang', el.id === 'langEn' ? 'en' : 'ko']; }],
    // 홈
    ['.hh-credit', function(el){ return ['hero_work', workNoFromHref(el)]; }],
    ['#hhPP', function(){ return ['hero_pause', '']; }],
    ['#btnMoreWorks', function(){ return ['all_works', '']; }],
    ['.about-teaser', function(){ return ['about_teaser', '']; }],
    ['.ip-teaser', function(){ return ['ip_teaser', '']; }],
    ['.ex-poster-link', function(){ return ['ex_poster', '']; }],
    // 작품 목록(홈 Recent · Works의 Selected / All works)
    ['#selGrid .tile', function(el){ return ['open_work', 'selected:' + workNoFromHref(el)]; }],
    ['#workGrid .tile', function(el){ return ['open_work', (PAGE === '/' ? 'recent:' : 'all:') + workNoFromHref(el)]; }],
    // 작품 창(팝업)·작품 페이지
    ['#wmViewLarger, .wp-view-larger', function(){ return ['wm_large', work || '']; }],
    ['#wmRail .wm-rail-item--video', function(){ return ['wm_video', work || '']; }],
    ['#wmRail .wm-rail-item', function(){ return ['wm_photo', work || '']; }],
    ['#wmPrev, #wmNext', function(){ return ['wm_step', work || '']; }],
    ['#wmSeriesList .wm-series-item', function(){ return ['wm_series', work || '']; }],
    ['#wmShareCopy', function(el){ return [el.getAttribute('data-use-native-share') === '1' ? 'wm_share' : 'wm_copy', work || '']; }],
    ['#wmDocentToggle, #wmDocentPlay', function(){ return ['wm_docent', work || '']; }],
    ['#wmAskAbout', function(){ return ['wm_ask', work || '']; }],
    // 작품 페이지(works/w/…)
    ['.wp-action--accent', function(){ return ['wm_ask', work || '']; }],
    ['.wp-action', function(){ return ['wp_viewer', work || '']; }],
    ['.wp-prev, .wp-next', function(){ return ['wm_step', work || '']; }],
    ['.wp-series-item', function(){ return ['wm_series', work || '']; }],
    ['.wp-back', function(){ return ['wp_back', work || '']; }],
    // Press
    ['.press-link.link-go', function(el){ return ['press_ex', exFromHref(el)]; }],
    ['.press-feature-title a', function(el){ var row = el.closest('[data-no]'); return ['press_article', row ? row.getAttribute('data-no') : '']; }],
    ['.press-link.link-sub', function(el){
      var row = el.closest('[data-no]'), k = outKind(el);
      return [k === 'brand_shop' ? 'press_shop' : 'press_article', row ? row.getAttribute('data-no') : ''];
    }],
    // About
    ['a[href*="works/?ex="]', function(el){ return [PAGE === '/about/' ? 'about_ex' : 'ex_works', exFromHref(el)]; }],
    // IP
    ['#profileOpen', function(){ return ['ip_profile', 'haedal']; }],
    ['#toy button, #toy a, #toy [data-viewer], #viewerPrev, #viewerNext', function(){ return ['ip_toy', '']; }],
    ['#licensing a', function(el){ return ['ip_license', outKind(el) || 'contact']; }],
    // Contact
    ['#copyEmailBtn', function(){ return ['contact_copy', '']; }],
    ['a.direct-email, a[href^="mailto:"]', function(){ return ['contact_mail', '']; }],
    // 그 밖의 바깥 링크(인스타 아이콘 등)
    ['a[href^="http"]', function(el){ var k = outKind(el); return k && k !== 'other' ? ['out', k] : (k === 'other' ? ['out', 'other'] : null); }]
  ];
  document.addEventListener('click', function(e){
    var t = e.target;
    if(!t || !t.closest) return;
    for(var i = 0; i < RULES.length; i++){
      var el = t.closest(RULES[i][0]);
      if(el){ var r = RULES[i][1](el); if(r) click(r[0], r[1]); return; }
    }
  }, true);
  document.addEventListener('change', function(e){
    var t = e.target;
    if(!t) return;
    if(t.id === 'exFilter') click('filter', t.value || 'all');
    else if(t.id === 'cfType') click('contact_type', t.value);
  }, true);
  var typed = false;
  document.addEventListener('input', function(e){
    if(!typed && PAGE === '/contact/' && e.target && e.target.closest && e.target.closest('form')){ typed = true; click('contact_start', ''); }
  }, true);
})();
