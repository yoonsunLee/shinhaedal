/* 수영장: 얼빵해달이 조금 아래에서 헤엄쳐 올라와 멈춘다(작가 2026-10-18 — 숲길 W1 처럼, "밑에서 위쪽으로 수영하면서 올라가는 느낌").
   그림은 그대로다: 수영장 그림 파일은 손대지 않고, 헤엄치는 동안만 원래 얼빵해달 자리를 파란 조각으로 덮은 뒤
   떼어 낸 얼빵해달(둘레 물결 표시 포함)을 레인 안에서 옮긴다. 멈추면 조각·얼빵해달을 치워 원래 그림이 그대로 보인다.
   헤엄: 팔을 저을 때마다 앞으로 밀렸다 미끄러지고(속도 출렁), 몸통을 축으로 좌우로 살짝 기우뚱(3.5°).
   s1 = 올라와 멈춤 · s2 = 멈춘 뒤 물에 떠 있듯 아주 살짝 둥실(계속). 움직임 줄이기면 헤엄치지 않는다(원래 그림). */
(function(){
  var box = document.querySelector('#pool .swim-image');
  if(!box || !window.matchMedia || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var MODE = 's1';
  if(MODE === 'none') return;
  var otter = box.querySelector('.sw-otter'), cover = box.querySelector('.sw-cover'), art = box.closest('.pool-art');
  if(!otter || !cover) return;
  var DIST = 0.16, STROKES = 4, ROT = 3.5, SURGE = 0.55, T = 2600;
  function pose(p){
    var q = p + SURGE * Math.sin(2 * Math.PI * STROKES * p) / (2 * Math.PI * STROKES);   // 저을 때 밀리고, 사이에는 미끄러짐(뒤로 가지는 않는다)
    var y = (1 - q) * DIST * box.clientHeight;
    var rot = ROT * Math.sin(Math.PI * STROKES * p);
    otter.style.transform = 'translate(0,' + y.toFixed(2) + 'px) rotate(' + rot.toFixed(2) + 'deg)';
  }
  var floating = null;
  function float(){   // s2: 멈춘 뒤 둥실(±1.2°, 위아래 2px, 3.4초 한 번)
    var t0 = null;
    var f = function(ts){
      if(t0 === null) t0 = ts;
      var k = (ts - t0) / 3400 * 2 * Math.PI, ease = Math.min(1, (ts - t0) / 900);
      otter.style.transform = 'translate(0,' + (Math.sin(k) * 2 * ease).toFixed(2) + 'px) rotate(' + (Math.sin(k + 1.1) * 1.2 * ease).toFixed(2) + 'deg)';
      floating = requestAnimationFrame(f);
    };
    floating = requestAnimationFrame(f);
  }
  function live(on){ box.classList.toggle('swim-live', on); }
  var running = false, armed = false;
  var run = function(){
    if(running) return; running = true;
    if(floating){ cancelAnimationFrame(floating); floating = null; }
    live(true); pose(0);
    var t0 = null;
    var frame = function(ts){
      if(t0 === null) t0 = ts;
      var t = Math.min(1, (ts - t0) / T), p = t * (1.3 + t * (0.4 - 0.7 * t));
      pose(p);
      if(t < 1) requestAnimationFrame(frame);
      else{
        running = false; otter.style.transform = '';
        if(MODE === 's2') float(); else live(false);      // s1: 원래 그림으로 돌려놓는다
      }
    };
    requestAnimationFrame(frame);
  };
  // 수영장 칸이 다 나타난 뒤(나타나는 동안 반투명으로 헤엄치지 않게) 시작
  var whenShown = function(cb){
    var t0 = performance.now();
    (function chk(){
      var shown = parseFloat(getComputedStyle(box).opacity) > 0.98 && (!art || parseFloat(getComputedStyle(art).opacity) > 0.98);   // 올라오기는 그림 칸마다(ip-motion.js)
      if(shown || performance.now() - t0 > 1600) cb(); else requestAnimationFrame(chk);
    })();
  };
  var inView = function(){ var r = box.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; };
  // 조각 둘이 다 받아진 뒤에야 '아래에서 대기' 상태로 바꾼다 — 그 전에 화면에 보이면(바로 그 자리로 들어온 경우) 헤엄치지 않고 원래 그림 그대로
  var dec = function(i){ return (i.decode ? i.decode() : Promise.resolve()).catch(function(){}); };
  Promise.all([dec(cover), dec(otter)]).then(function(){
    if(inView()) return;
    armed = true; live(true); pose(0);
    var io = new IntersectionObserver(function(es){
      es.forEach(function(e){ if(e.isIntersecting){ io.disconnect(); whenShown(run); } });
    }, {threshold: 0.6});
    io.observe(otter);
  });
  window.__poolSwimReplay = function(){ if(running) return; setTimeout(run, 450); };
})();
