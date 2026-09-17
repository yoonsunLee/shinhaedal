(()=>{
const body=document.body;
if(!matchMedia('(prefers-reduced-motion: reduce)').matches) body.classList.add('motion-ready');

const observer=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('seen');observer.unobserve(e.target)}}),{threshold:.08});
document.querySelectorAll('.reveal').forEach(e=>observer.observe(e));

let queued=false;
function update(){queued=false;let y=Math.min(scrollY,900);body.style.setProperty('--shore-y',y*.025+'px');body.style.setProperty('--char-y',y*.035+'px')}
addEventListener('scroll',()=>{if(!queued){queued=true;requestAnimationFrame(update)}},{passive:true});

const rail=document.getElementById('members'),cards=[...rail.children],count=document.getElementById('member-count');
let index=0;
function select(i){
  index=Math.max(0,Math.min(4,i));
  const instant=matchMedia('(prefers-reduced-motion: reduce)').matches;
  rail.scrollTo({left:cards[index].offsetLeft-cards[0].offsetLeft,behavior:instant?'instant':'smooth'});
  count.textContent=(index+1)+' / 5';
}
document.getElementById('prev').onclick=()=>select(index-1);
document.getElementById('next').onclick=()=>select(index+1);
rail.addEventListener('scroll',()=>{let step=cards[1].offsetLeft-cards[0].offsetLeft;index=Math.round(rail.scrollLeft/step);count.textContent=(index+1)+' / 5'},{passive:true});

const dialog=document.getElementById('viewer'),large=document.getElementById('viewer-image');
let opener;
document.querySelectorAll('.photo-open').forEach(b=>b.onclick=()=>{opener=b;large.src=b.dataset.photo;dialog.showModal();body.style.overflow='hidden';document.getElementById('close-viewer').focus()});
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
  if(e.target.closest('#close-viewer')) return;
  if(e.target===large && insideVisibleImage(e)) return;
  dialog.close();
});
dialog.addEventListener('keydown',e=>{
  if(e.key==='Backspace'){ e.preventDefault(); dialog.close(); }
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
