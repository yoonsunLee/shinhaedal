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
