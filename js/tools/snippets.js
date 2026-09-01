import { SNIPPETS } from './snippets-data.js';
import { copyText } from '../ui.js';

export function renderSnippets(container){
  const cats=[...new Set(SNIPPETS.map(s=>s.cat))];
  container.innerHTML=`
  <div class="tool-head"><div><h2>Snippet Library</h2><p>Biblioteca curada: basics, UI, networking, debug — copie e use.</p></div><span class="badge">${SNIPPETS.length} snippets</span></div>
  <div class="panel">
    <div class="panel__head">
      <div class="tabs" id="snTabs"><button class="tab active" data-cat="All">All</button>${cats.map(c=>`<button class="tab" data-cat="${c}">${c}</button>`).join('')}</div>
      <input id="snSearch" class="input" placeholder="Filtrar snippets..." style="max-width:260px;margin-left:auto"/>
    </div>
    <div class="panel__body"><div class="grid grid--2" id="snGrid"></div></div>
  </div>`;
  const grid=container.querySelector('#snGrid');
  const search=container.querySelector('#snSearch');
  let cat='All';
  function render(){
    const q=(search.value||'').toLowerCase();
    const list=SNIPPETS.filter(s=> (cat==='All'||s.cat===cat) && (!q || (s.title+s.desc+s.code).toLowerCase().includes(q)));
    grid.innerHTML=list.map(s=>`
      <div class="snippet">
        <div class="snippet__head">
          <b>${s.title}</b><span class="badge">${s.cat}</span>
          <span class="small muted" style="margin-left:auto">${s.desc}</span>
        </div>
        <pre>${s.code.replace(/</g,'&lt;')}</pre>
        <div class="row" style="padding:10px"><button class="btn btn--sm btn--primary" data-copy="${s.id}">Copy</button><span class="small muted">${s.id}</span></div>
      </div>
    `).join('') || '<div class="empty">Nenhum snippet encontrado</div>';
    grid.querySelectorAll('[data-copy]').forEach(b=> b.addEventListener('click', ()=>{
      const item=SNIPPETS.find(x=>x.id===b.dataset.copy);
      if(item) copyText(item.code);
    }));
  }
  container.querySelectorAll('#snTabs .tab').forEach(t=> t.addEventListener('click', ()=>{
    container.querySelectorAll('#snTabs .tab').forEach(x=>x.classList.remove('active'));
    t.classList.add('active'); cat=t.dataset.cat; render();
  }));
  search.addEventListener('input', render);
  container._getOutput=()=> SNIPPETS.map(s=>`-- ${s.title}\n${s.code}`).join('\n\n');
  render();
}
