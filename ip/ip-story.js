(()=>{
const body=document.body;
if(!matchMedia('(prefers-reduced-motion: reduce)').matches) body.classList.add('motion-ready');

const observer=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('seen');observer.unobserve(e.target)}}),{threshold:.08});
document.querySelectorAll('.reveal').forEach(e=>observer.observe(e));

let queued=false;
function update(){queued=false;let y=Math.min(scrollY,900);body.style.setProperty('--shore-y',y*.025+'px');body.style.setProperty('--char-y',y*.035+'px')}
addEventListener('scroll',()=>{if(!queued){queued=true;requestAnimationFrame(update)}},{passive:true});


const dialog=document.getElementById('viewer'),large=document.getElementById('viewer-image');
// 아트토이 사진(메인 + 아래 3장)을 한 묶음으로: 어떤 사진을 눌러도 그 사진부터 열고 좌우로 넘긴다
const photoButtons=[...document.querySelectorAll('.photo-open')];
const photos=photoButtons.map(b=>({src:b.dataset.photo,alt:(b.querySelector('img')||{}).alt||''}));
const viewerRail=document.getElementById('viewerRail'),viewerCount=document.getElementById('viewerCount');
let opener,current=0,swiped=false;
photos.forEach((p,i)=>{
  const t=document.createElement('button');
  t.type='button'; t.setAttribute('aria-label',(i+1)+' / '+photos.length);
  const im=document.createElement('img'); im.src=p.src; im.alt=''; t.appendChild(im);
  t.onclick=()=>show(i);
  viewerRail.appendChild(t);
});
function show(i){
  current=(i+photos.length)%photos.length;
  large.src=photos[current].src; large.alt=photos[current].alt;
  viewerCount.textContent=(current+1)+' / '+photos.length;
  [...viewerRail.children].forEach((t,k)=>t.setAttribute('aria-current',k===current?'true':'false'));
  [1,-1].forEach(d=>{const pre=new Image(); pre.src=photos[(current+d+photos.length)%photos.length].src;});
}
photoButtons.forEach((b,i)=>b.onclick=()=>{opener=b;show(i);dialog.showModal();body.style.overflow='hidden';document.getElementById('close-viewer').focus()});
document.getElementById('viewerPrev').onclick=()=>show(current-1);
document.getElementById('viewerNext').onclick=()=>show(current+1);
let touchX=null,touchY=0;
dialog.addEventListener('touchstart',e=>{if(e.touches.length!==1){touchX=null;return;} touchX=e.touches[0].clientX; touchY=e.touches[0].clientY;},{passive:true});
dialog.addEventListener('touchend',e=>{
  if(touchX===null) return;
  const t=e.changedTouches[0],dx=t.clientX-touchX,dy=t.clientY-touchY; touchX=null;
  if(Math.abs(dx)>45 && Math.abs(dx)>Math.abs(dy)*1.3){ swiped=true; show(current+(dx<0?1:-1)); setTimeout(()=>{swiped=false},400); }
});
document.getElementById('close-viewer').onclick=()=>dialog.close();
function insideVisibleImage(e){
  const cw=large.clientWidth,ch=large.clientHeight,iw=large.naturalWidth,ih=large.naturalHeight;
  if(!cw||!ch||!iw||!ih) return false;
  const scale=Math.min(cw/iw,ch/ih);
  const rw=iw*scale,rh=ih*scale;
  const rect=large.getBoundingClientRect();
  const left=rect.left+(cw-rw)/2, top=rect.top+(ch-rh)/2;
  return e.clientX>=left && e.clientX<=left+rw && e.clientY>=top && e.clientY<=top+rh;
}
dialog.addEventListener('click',e=>{
  if(!dialog.open) return;
  if(swiped) return;
  if(e.target.closest('#close-viewer, .viewer-nav, .viewer-rail')) return;
  if(e.target===large && insideVisibleImage(e)) return;
  dialog.close();
});
dialog.addEventListener('keydown',e=>{
  if(e.key==='Backspace'){ e.preventDefault(); dialog.close(); }
  if(e.key==='ArrowRight'){ e.preventDefault(); show(current+1); }
  if(e.key==='ArrowLeft'){ e.preventDefault(); show(current-1); }
});
dialog.addEventListener('close',()=>{body.style.overflow='';large.removeAttribute('src');opener?.focus()});
})();

/* 캐릭터 이미지의 우클릭 저장 방지. 드래그 저장은 ip-story.css의 user-drag:none이 막는다. */
document.addEventListener('contextmenu', function(e){
  if(e.target.tagName === 'IMG') e.preventDefault();
});

/* 상단 메뉴 글자를 span으로 감싸 호버 시 자개빛 스침 효과(ip-story.css)의 대상으로 삼는다. */
document.querySelectorAll('.nav-menu a').forEach(function(a){
  var span = document.createElement('span');
  span.className = 'nav-sweep';
  span.textContent = a.textContent;
  a.textContent = '';
  a.appendChild(span);
});

/* 첫 화면 얼빵해달: 마우스를 올리고 움직이면 그쪽으로 살짝 기울며 따라온다(PC만).
   캐릭터 그림에만 걸고 배경은 그대로 둔다. 등장 애니메이션(transform)과 겹치지 않게
   개별 속성 translate·rotate를 쓴다. 움직임 줄이기 설정이면 끈다. */
(function(){
  var wrap = document.querySelector('.hero-character');
  var img = wrap && wrap.querySelector('img');
  var shadow = wrap && wrap.querySelector('.character-shadow');
  if(!img) return;
  if(!matchMedia('(hover:hover) and (pointer:fine)').matches) return;
  if(matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var MAX_X = 8, MAX_Y = 5, MAX_TILT = 3, EASE = 0.1;
  var tx = 0, ty = 0, tr = 0, cx = 0, cy = 0, cr = 0, running = false;
  function render(){
    img.style.translate = cx.toFixed(2) + 'px ' + cy.toFixed(2) + 'px';
    img.style.rotate = cr.toFixed(2) + 'deg';
    if(shadow) shadow.style.translate = (cx * 0.5).toFixed(2) + 'px 0';
  }
  function loop(){
    cx += (tx - cx) * EASE; cy += (ty - cy) * EASE; cr += (tr - cr) * EASE;
    if(Math.abs(tx - cx) < 0.03 && Math.abs(ty - cy) < 0.03 && Math.abs(tr - cr) < 0.02){
      cx = tx; cy = ty; cr = tr; render(); running = false; return;
    }
    render();
    requestAnimationFrame(loop);
  }
  function kick(){ if(!running){ running = true; requestAnimationFrame(loop); } }
  wrap.addEventListener('pointermove', function(e){
    var r = img.getBoundingClientRect();
    var nx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width / 2)));
    var ny = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (r.height / 2)));
    tx = nx * MAX_X; ty = ny * MAX_Y; tr = nx * MAX_TILT;
    kick();
  });
  wrap.addEventListener('pointerleave', function(){ tx = 0; ty = 0; tr = 0; kick(); });
})();

/* 캐릭터 프로필: 첫 화면 '프로필 보기'로 열고, ✕·Esc·바깥 누르기로 닫는다.
   PC는 오른쪽 패널, 폰은 아래 시트(모양은 CSS). 닫으면 포커스는 '프로필 보기'로 돌아간다 */
(function(){
  var sheet = document.getElementById('profileSheet');
  var openBtn = document.getElementById('profileOpen');
  var closeBtn = document.getElementById('profileClose');
  if(!sheet || !openBtn || typeof sheet.showModal !== 'function') return;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)');
  function open(){
    sheet.showModal();
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(function(){ requestAnimationFrame(function(){ sheet.classList.add('is-open'); }); });
  }
  function close(){
    if(!sheet.open) return;
    sheet.classList.remove('is-open');
    if(reduce.matches){ sheet.close(); return; }
    var done = false;
    function finish(){ if(done) return; done = true; sheet.close(); }
    sheet.addEventListener('transitionend', finish, {once:true});
    setTimeout(finish, 300);   // 닫힘(0.2·0.3초)보다 조금 길게 — transitionend 가 안 오는 경우의 안전장치
  }
  openBtn.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  sheet.addEventListener('cancel', function(e){ e.preventDefault(); close(); });
  sheet.addEventListener('click', function(e){
    if(e.target !== sheet) return;
    var r = sheet.getBoundingClientRect();
    if(e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) close();
  });
  sheet.addEventListener('close', function(){
    sheet.classList.remove('is-open');
    document.body.style.overflow = '';
    openBtn.focus();
  });
})();
/* 누를 때 반응(작가 2026-10-23, 사이트 공통 site.js 와 같은 방식 — IP 는 site.js 를 안 읽는다) */
(()=>{
  if(!document.body.animate) return;
  const SHAPED='.photo-open,.profile-open,.contact-link,.scroll-link,.viewer-nav,.viewer-rail button,.icon-btn';
  const TEXT='nav a,footer a,#langKo,#langEn,.lang button';
  let ease='cubic-bezier(.32,.72,0,1)';
  try{ if(CSS.supports('animation-timing-function','linear(0, 1)')) ease='linear(0, 0.18, 0.5, 0.76, 0.92, 1.01, 1.03, 1.02, 1.005, 1)'; }catch(e){}
  let held=null;
  const release=()=>{ if(!held) return; const h=held; held=null; h.a.pause(); const cur=getComputedStyle(h.el)[h.prop]; h.a.cancel();
    h.el.animate([{[h.prop]:cur},{[h.prop]:'1'}],{duration:h.prop==='scale'?460:260,easing:h.prop==='scale'?ease:'cubic-bezier(.22,1,.36,1)'}); };
  document.addEventListener('touchstart',e=>{
    if(e.touches.length!==1||matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const el=e.target.closest&&e.target.closest(SHAPED+','+TEXT); if(!el) return;
    release(); const shaped=el.matches(SHAPED), prop=shaped?'scale':'opacity';
    held={el,prop,x:e.touches[0].clientX,y:e.touches[0].clientY,a:el.animate([{[prop]:'1'},{[prop]:shaped?'0.97':'0.5'}],{duration:shaped?110:90,easing:'cubic-bezier(.3,.6,.4,1)',fill:'forwards'})};
  },{passive:true});
  document.addEventListener('touchmove',e=>{ if(held&&Math.hypot(e.touches[0].clientX-held.x,e.touches[0].clientY-held.y)>10) release(); },{passive:true});
  document.addEventListener('touchend',release,{passive:true}); document.addEventListener('touchcancel',release,{passive:true});
})();
