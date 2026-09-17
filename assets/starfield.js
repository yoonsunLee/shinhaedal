/* 사이트 공통 배경 — 우주/파티클 캔버스.
   IP 페이지를 제외한 모든 페이지의 </body> 직전에서 로드합니다.
   스크립트가 캔버스를 직접 만들어 body 맨 앞에 붙이므로, 페이지 쪽에서는
   <script src="assets/starfield.js"></script> 한 줄만 추가하면 됩니다. */
(function(){
  if (document.getElementById('bg-stars')) return;

  var canvas = document.createElement('canvas');
  canvas.id = 'bg-stars';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:fixed; inset:0; z-index:-1; display:block; pointer-events:none;';
  document.body.insertBefore(canvas, document.body.firstChild);

  var ctx = canvas.getContext('2d');
  var W, H, DPR;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 페이지가 <script> 태그 전에 window.STARFIELD_CONFIG를 심어두면 이 캔버스만
  // 속도/마우스 반응을 조절할 수 있다 (다른 페이지는 설정이 없으니 기본값 그대로).
  var CFG = window.STARFIELD_CONFIG || {};
  var speedScale = typeof CFG.speedScale === 'number' ? CFG.speedScale : 1;
  var parallaxScale = typeof CFG.parallaxScale === 'number' ? CFG.parallaxScale : 1;

  var hiddenPaused = document.hidden;
  var apiPaused = false;
  var paused = hiddenPaused || apiPaused;
  function updatePaused(){
    var was = paused;
    paused = hiddenPaused || apiPaused;
    if (was && !paused){ lastT = performance.now(); requestAnimationFrame(frame); }
  }
  window.__starfield = {
    pause: function(){ apiPaused = true; updatePaused(); },
    resume: function(){ apiPaused = false; updatePaused(); }
  };

  function resize(){
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  document.addEventListener('visibilitychange', function(){
    hiddenPaused = document.hidden;
    updatePaused();
  });

  // ---- nebula blobs (very low opacity, slow drift) ----
  var nebulae = [
    { x:0.2, y:0.3, r:0.55, color:'27,42,74',   phase:0 },
    { x:0.8, y:0.6, r:0.5,  color:'232,230,224', alpha:0.05, phase:2.1 },
    { x:0.5, y:0.85,r:0.6,  color:'17,20,32',   phase:4.2 }
  ];

  // ---- stars ----
  var STAR_COUNT = 220;
  var stars = [];
  for (var i = 0; i < STAR_COUNT; i++){
    var depth = Math.random(); // 0 = far/small, 1 = near/large
    stars.push({
      x: Math.random(),
      y: Math.random(),
      depth: depth,
      r: 0.4 + depth * 1.6,
      phase: Math.random() * Math.PI * 2,
      speed: 0.6 + Math.random() * 1.2,
      accent: Math.random() < 0.18
    });
  }

  // ---- shooting stars ----
  var shooters = [];
  function spawnShooter(){
    shooters.push({
      x: Math.random() * 0.6 + 0.1,
      y: Math.random() * 0.3,
      vx: 0.55 + Math.random() * 0.25,
      vy: 0.28 + Math.random() * 0.12,
      life: 0,
      maxLife: 0.9 + Math.random() * 0.4
    });
  }
  var nextShooterAt = 3 + Math.random() * 4;

  var mouseX = 0.5, mouseY = 0.5, targetX = 0.5, targetY = 0.5;
  window.addEventListener('mousemove', function(e){
    targetX = e.clientX / W; targetY = e.clientY / H;
  });

  var t0 = performance.now();
  var lastT = t0;

  function frame(now){
    if (paused) return;
    var t = (now - t0) / 1000;
    var dt = Math.min((now - lastT) / 1000, 0.05);
    lastT = now;

    mouseX += (targetX - mouseX) * 0.03;
    mouseY += (targetY - mouseY) * 0.03;
    var parX = (mouseX - 0.5) * 24 * parallaxScale;
    var parY = (mouseY - 0.5) * 16 * parallaxScale;
    var scrollY = window.scrollY || window.pageYOffset || 0;

    // background base gradient
    var g = ctx.createRadialGradient(W * 0.5, H * 0.4, 0, W * 0.5, H * 0.4, Math.max(W, H) * 0.8);
    g.addColorStop(0, '#111420');
    g.addColorStop(1, '#05050a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // nebulae — reduced-motion에서는 표류를 멈춘다(t=0 고정). 그 외엔 매 프레임 자동으로
    // 움직이는 요소라 별 반짝임·유성과 같은 기준으로 취급해야 한다.
    ctx.globalCompositeOperation = 'lighter';
    var tNeb = reduceMotion ? 0 : t;
    nebulae.forEach(function(n){
      var nx = n.x * W + Math.sin(tNeb * 0.05 + n.phase) * 40;
      var ny = n.y * H + Math.cos(tNeb * 0.04 + n.phase) * 30;
      var r = n.r * Math.max(W, H);
      var ng = ctx.createRadialGradient(nx, ny, 0, nx, ny, r);
      ng.addColorStop(0, 'rgba(' + n.color + ',' + (n.alpha || 0.10) + ')');
      ng.addColorStop(1, 'rgba(' + n.color + ',0)');
      ctx.fillStyle = ng;
      ctx.fillRect(0, 0, W, H);
    });
    ctx.globalCompositeOperation = 'source-over';

    // stars — scroll drifts them upward at a depth-scaled rate, wrapping
    // seamlessly so a long scroll (Works grid) feels like passing through space.
    stars.forEach(function(s){
      var tw = reduceMotion ? 1 : (0.55 + 0.45 * Math.sin(t * s.speed * speedScale + s.phase));
      var px = s.x * W + parX * s.depth;
      var rawY = s.y * H + parY * s.depth - scrollY * (0.04 + s.depth * 0.10) * speedScale;
      var py = ((rawY % H) + H) % H;
      var alpha = (0.15 + 0.7 * s.depth) * tw;
      ctx.beginPath();
      ctx.arc(px, py, s.r, 0, Math.PI * 2);
      ctx.fillStyle = s.accent
        ? 'rgba(134,182,232,' + alpha + ')'
        : 'rgba(245,240,230,' + alpha + ')';
      ctx.fill();
      if (s.depth > 0.75){
        var glow = ctx.createRadialGradient(px, py, 0, px, py, s.r * 3);
        glow.addColorStop(0, 'rgba(245,240,230,' + (alpha * 0.25) + ')');
        glow.addColorStop(1, 'rgba(245,240,230,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(px, py, s.r * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // shooting stars
    if (!reduceMotion){
      nextShooterAt -= dt;
      if (nextShooterAt <= 0){ spawnShooter(); nextShooterAt = 4 + Math.random() * 6; }
      shooters.forEach(function(sh){ sh.life += dt; });
      shooters = shooters.filter(function(sh){ return sh.life < sh.maxLife; });
      shooters.forEach(function(sh){
        var p = sh.life / sh.maxLife;
        var sx = (sh.x + sh.vx * p) * W;
        var sy = (sh.y + sh.vy * p) * H;
        var tailX = sx - sh.vx * W * 0.12;
        var tailY = sy - sh.vy * H * 0.12;
        var fade = Math.sin(p * Math.PI);
        var grad = ctx.createLinearGradient(tailX, tailY, sx, sy);
        grad.addColorStop(0, 'rgba(245,240,230,0)');
        grad.addColorStop(1, 'rgba(245,240,230,' + (0.85 * fade) + ')');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(sx, sy);
        ctx.stroke();
      });
    }

    requestAnimationFrame(frame);
  }

  if (!paused) requestAnimationFrame(frame);
})();
