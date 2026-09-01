export function el(tag, attrs={}, ...children){
  const n = document.createElement(tag);
  for(const [k,v] of Object.entries(attrs||{})){
    if(k==='class') n.className=v;
    else if(k==='html') n.innerHTML=v;
    else if(k.startsWith('on') && typeof v==='function') n.addEventListener(k.slice(2).toLowerCase(), v);
    else if(v!==null && v!==undefined) n.setAttribute(k, String(v));
  }
  for(const c of children.flat()){
    if(c==null) continue;
    n.append(typeof c==='string' ? document.createTextNode(c) : c);
  }
  return n;
}
export function toast(msg, type='success'){
  const wrap = document.getElementById('toasts');
  const t = el('div', {class:`toast toast--${type}`},
    el('div', {style:'margin-top:2px'},
      type==='success'?'✅': type==='error'?'⛔': type==='warning'?'⚠️':'ℹ️'
    ),
    el('div', {style:'flex:1'},
      el('div', {style:'font:600 12px var(--font-sans)'}, msg)
    ),
    el('button', {class:'btn btn--sm', onclick:()=> t.remove()}, '×')
  );
  wrap.appendChild(t);
  setTimeout(()=> { t.style.opacity='0'; t.style.transform='translateY(4px)'; setTimeout(()=>t.remove(),180); }, 2600);
}
export async function copyText(text){
  try{
    await navigator.clipboard.writeText(text);
    toast('Copied to clipboard','success');
    return true;
  }catch{
    const ta=document.createElement('textarea');
    ta.value=text; document.body.appendChild(ta); ta.select();
    try{ document.execCommand('copy'); toast('Copied to clipboard','success'); }catch{ toast('Copy failed','error');}
    ta.remove();
  }
}
export function debounce(fn, ms=200){
  let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); };
}
export function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
export function bytesToHuman(n){
  if(n<1024) return n+' B';
  if(n<1024*1024) return (n/1024).toFixed(1)+' KB';
  return (n/1024/1024).toFixed(2)+' MB';
}
export function openModal(id){
  const m=document.getElementById(id);
  if(m){ m.classList.add('show'); m.setAttribute('aria-hidden','false'); }
}
export function closeModal(id){
  const m=document.getElementById(id);
  if(m){ m.classList.remove('show'); m.setAttribute('aria-hidden','true'); }
}
export function bindModals(){
  document.addEventListener('click', (e)=>{
    const t=e.target;
    const closeId = t.closest?.('[data-close]')?.getAttribute('data-close');
    if(closeId) closeModal(closeId);
  });
  document.addEventListener('keydown', (e)=>{
    if(e.key==='Escape'){
      document.querySelectorAll('.modal.show').forEach(m=> m.classList.remove('show'));
      document.getElementById('sidebar')?.classList.remove('open');
      document.getElementById('overlay')?.classList.remove('show');
    }
  });
}
