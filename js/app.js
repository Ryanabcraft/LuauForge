import { TOOLS, TOOL_MAP } from './tools/registry.js';
import { Store } from './storage.js';
import { getRoute, navigate, onRouteChange, markRecent } from './router.js';
import { toast, copyText, openModal, closeModal, bindModals } from './ui.js';
import { renderObfuscator } from './tools/obfuscator.js';
import { renderPastefy } from './tools/pastefy.js';
import { renderLoadstring } from './tools/loadstring.js';
import { renderFormatter } from './tools/formatter.js';
import { renderMinifier } from './tools/minifier.js';
import { renderEscaper, renderChar, renderBase64, renderHex, renderUrl, renderJsonLua } from './tools/encoders.js';
import { renderIdentifier, renderUUID, renderHash, renderColor3, renderUDim2, renderVector, renderCFrame, renderTween, renderServices } from './tools/generators.js';
import { renderInspector, renderExtractor, renderServiceExtractor } from './tools/inspector.js';
import { renderSnippets } from './tools/snippets.js';

const app = document.getElementById('app');
const topTitle = document.getElementById('topbarTitle');
const topSub = document.getElementById('topbarSub');
const sidebarNav = document.getElementById('sidebarNav');
const globalSearch = document.getElementById('globalSearch');

const NAV = [
  { group:'Main', items:[
    {id:'dashboard', label:'Dashboard', icon:'◈'},
    {id:'pastefy', label:'Pastefy Publisher', icon:'⤴'},
    {id:'obfuscator', label:'Lua Obfuscator', icon:'◐'},
    {id:'loadstring', label:'Loadstring Generator', icon:'⧉'},
  ]},
  { group:'Code', items:[
    {id:'formatter', label:'Lua Formatter', icon:'≡'},
    {id:'minifier', label:'Minifier', icon:'⧺'},
    {id:'inspector', label:'Script Inspector', icon:'◎'},
    {id:'extractor', label:'URL Extractor', icon:'↗'},
    {id:'serviceextractor', label:'Service Extractor', icon:'◆'},
  ]},
  { group:'Encoding', items:[
    {id:'escaper', label:'String Escaper', icon:'“”'},
    {id:'char', label:'String.char Generator', icon:'ƒ'},
    {id:'base64', label:'Base64 Tools', icon:'⬢'},
    {id:'hex', label:'HEX Tools', icon:'⬣'},
    {id:'url', label:'URL Encoder', icon:'🔗'},
    {id:'jsonlua', label:'JSON ↔ Lua', icon:'{}'},
  ]},
  { group:'Generators', items:[
    {id:'identifier', label:'Identifier Generator', icon:'#'},
    {id:'uuid', label:'UUID Generator', icon:'◐'},
    {id:'hash', label:'Hash Generator', icon:'⌬'},
    {id:'color3', label:'Color3 Generator', icon:'●'},
    {id:'udim2', label:'UDim2 Builder', icon:'▭'},
    {id:'vector', label:'Vector Generator', icon:'↔'},
    {id:'cframe', label:'CFrame Generator', icon:'⬔'},
    {id:'tween', label:'TweenInfo Generator', icon:'∿'},
    {id:'services', label:'Services Generator', icon:'⚙'},
  ]},
  { group:'Library', items:[
    {id:'snippets', label:'Snippet Library', icon:'▤'},
  ]},
  { group:'Settings', items:[
    {id:'settings', label:'Settings', icon:'⚙'},
  ]},
];

function iconSvg(name){
  const m={
    dashboard:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
    loadstring:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 1 0-7l1-1a5 5 0 0 1 7 7l-1 1"/><path d="M14 11a5 5 0 0 1 0 7l-1 1a5 5 0 0 1-7-7l1-1"/></svg>`,
    formatter:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/></svg>`,
    minifier:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 14a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-2z"/><path d="M4 9h16"/><path d="M8 5h8"/></svg>`,
    escaper:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 8h10"/><path d="M7 12h10"/><path d="M7 16h10"/></svg>`,
    default:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>`
  };
  return m[name]||m.default;
}

function buildSidebar(filter=''){
  const q=filter.toLowerCase();
  const favs=Store.favs.all();
  let html='';
  if(!q){
    if(favs.length){
      html+=`<div class="nav-group">Favorites</div>`;
      TOOLS.filter(t=> favs.includes(t.id)).forEach(t=>{
        html+=`<button class="nav-item" data-nav="${t.id}"><span class="nav-dot"></span>${iconSvg(t.id)}<span>${t.name}</span><span class="nav-badge" style="background:rgba(245,158,11,.14);border-color:rgba(245,158,11,.22);color:#F59E0B">★</span></button>`;
      });
    }
  }
  for(const g of NAV){
    const items = g.items.filter(it=>{
      if(!q) return true;
      const tool=TOOL_MAP[it.id];
      const hay=(it.label+' '+(tool?.tags||'')+' '+it.id).toLowerCase();
      return hay.includes(q);
    });
    if(items.length===0) continue;
    html+=`<div class="nav-group">${g.group}</div>`;
    for(const it of items){
      const isTool=!!TOOL_MAP[it.id];
      html+=`<button class="nav-item" data-nav="${it.id}"><span class="nav-dot"></span>${iconSvg(it.id)}<span>${it.label}</span>${isTool?`<span class="nav-badge">${TOOL_MAP[it.id].category}</span>`:''}</button>`;
    }
  }
  sidebarNav.innerHTML=html;
  sidebarNav.querySelectorAll('[data-nav]').forEach(b=>{
    b.addEventListener('click', ()=>{
      navigate(b.dataset.nav);
      closeSidebar();
    });
  });
  updateActive();
}
function updateActive(){
  const route=getRoute();
  sidebarNav.querySelectorAll('[data-nav]').forEach(b=>{
    b.classList.toggle('active', b.dataset.nav===route);
  });
}
function closeSidebar(){
  if(window.innerWidth<=860){
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('overlay').classList.remove('show');
  }
}
function openSidebar(){
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('overlay').classList.add('show');
  document.getElementById('btnCloseSidebar').style.display='grid';
}

// Views
function viewDashboard(){
  const recent=Store.recent.all().map(id=> TOOL_MAP[id]).filter(Boolean).slice(0,4);
  const favs=Store.favs.all().map(id=> TOOL_MAP[id]).filter(Boolean);
  topTitle.textContent='Dashboard';
  topSub.textContent='Escolha uma ferramenta e gere código em segundos.';
  app.innerHTML=`
  <div class="hero">
    <div class="hero__inner">
      <div>
        <div class="hero__eyebrow"><i aria-hidden="true"></i> v1.0 • ${TOOLS.length} ferramentas • atalho Ctrl+K</div>
        <h1>LuauForge<br/><em>Toolkit</em> para Lua & Luau</h1>
        <p>Loaders, formatter, minifier, encoders, Color3/UDim2 e inspector. Tudo roda no seu navegador, sem backend — rápido no PC e no celular, com modo claro e escuro.</p>
        <div class="hero-actions">
          <a class="btn btn--primary" href="#/loadstring">Começar agora →</a>
          <a class="btn" href="#/formatter">Testar Formatter</a>
          <a class="btn btn--ghost" href="https://github.com/Ryanabcraft/LuauForge" target="_blank" rel="noreferrer">GitHub</a>
        </div>
        <div class="row" style="margin-top:16px">
          <span class="badge">Sem backend</span><span class="badge">Hash routing</span><span class="badge">PWA</span><span class="badge">Mobile 375px→1440px</span>
        </div>
      </div>
      <div class="hero__side">
        <div class="hero__panel">
          <div class="hero__panel-head"><b>Preview — Loadstring</b><span class="badge" style="margin-left:auto">copiar 1 clique</span></div>
          <pre class="hero__code">loadstring(game:HttpGet(
  "https://pastefy.app/abc/raw", true
))()</pre>
        </div>
        <div class="stats">
          <div class="stat stat--accent"><b>${TOOLS.length}</b><span>Ferramentas</span></div>
          <div class="stat"><b>Ctrl+K</b><span>Busca rápida</span></div>
          <div class="stat"><b>44px</b><span>Toque mínimo</span></div>
        </div>
        <div class="notice" style="margin:0">Dica: favorite ★ suas ferramentas e use <span class="kbd">Ctrl</span>+<span class="kbd">Enter</span> para gerar e <span class="kbd">Ctrl</span>+<span class="kbd">Shift</span>+<span class="kbd">C</span> para copiar.</div>
      </div>
    </div>
  </div>

  ${recent.length?`
  <div class="card" style="margin-top:14px">
    <div class="card__head"><span class="card__title">Recent</span><span class="card__desc">Últimas ferramentas usadas</span></div>
    <div class="card__pad grid grid--4">${recent.map(t=> toolCardHtml(t)).join('')}</div>
  </div>`:''}

  ${favs.length?`
  <div class="card" style="margin-top:14px">
    <div class="card__head"><span class="card__title">Favorites</span><span class="card__desc">${favs.length} ferramentas favoritadas</span></div>
    <div class="card__pad grid grid--4">${favs.map(t=> toolCardHtml(t)).join('')}</div>
  </div>`:''}

  <div class="card" style="margin-top:14px">
    <div class="card__head"><span class="card__title">All Tools</span><span class="card__desc">Clique para abrir • Favorite com ★</span>
      <input id="dashSearch" class="input" placeholder="Filtrar..." style="max-width:220px;margin-left:auto;height:34px"/>
    </div>
    <div class="card__pad grid grid--4" id="dashGrid">${TOOLS.map(t=> toolCardHtml(t)).join('')}</div>
  </div>
  `;
  const dashSearch=app.querySelector('#dashSearch');
  const grid=app.querySelector('#dashGrid');
  function filterDash(){
    const q=(dashSearch.value||'').toLowerCase();
    grid.innerHTML = TOOLS.filter(t=> !q || (t.name+' '+t.desc+' '+t.tags).toLowerCase().includes(q)).map(t=> toolCardHtml(t)).join('') || '<div class="empty">Nenhuma ferramenta</div>';
    bindToolCards();
  }
  dashSearch?.addEventListener('input', filterDash);
  bindToolCards();
  function bindToolCards(){
    app.querySelectorAll('[data-tool]').forEach(c=> c.addEventListener('click', ()=> navigate(c.dataset.tool)));
    app.querySelectorAll('[data-fav]').forEach(b=> b.addEventListener('click', (e)=>{
      e.stopPropagation();
      const id=b.dataset.fav;
      Store.favs.toggle(id);
      viewDashboard();
      toast(Store.favs.has(id)?'Added to favorites':'Removed from favorites','success');
      buildSidebar(globalSearch.value||'');
    }));
  }
}
function toolCardHtml(t){
  const isFav=Store.favs.has(t.id);
  return `<div class="card tool-card" data-tool="${t.id}" role="button" tabindex="0" aria-label="${t.name}">
    <div class="tool-card__top">
      <div class="tool-icon" aria-hidden="true">${iconSvg(t.id)}</div>
      <button class="fav-btn ${isFav?'active':''}" data-fav="${t.id}" aria-label="${isFav?'Remover dos favoritos':'Favoritar'} ${t.name}">${isFav?'★':'☆'}</button>
    </div>
    <div class="tool-name">${t.name}</div>
    <div class="tool-desc">${t.desc}</div>
    <div class="tool-meta"><span class="chip chip--accent">${t.category}</span><span class="chip">${t.id}</span></div>
  </div>`;
}

function viewSettings(){
  topTitle.textContent='Settings';
  topSub.textContent='Preferências salvas no seu navegador.';
  const s=Store.settings.get();
  app.innerHTML=`
  <div class="grid grid--2">
    <div class="panel"><div class="panel__head"><span class="card__title">Aparência</span><span class="badge" style="margin-left:auto">claro / escuro</span></div><div class="panel__body stack">
      <label class="field"><span>Tema</span><select id="setTheme" class="select"><option value="light">Claro (Branco)</option><option value="dark">Escuro</option><option value="darker">Escuro+ (Preto)</option></select></label>
      <label class="field"><span>Cor de destaque</span><select id="setAccent" class="select"><option value="forge">Forge (laranja)</option><option value="blue">Blue</option><option value="green">Green</option><option value="red">Red</option><option value="purple">Purple</option></select></label>
      <label class="field"><span>Tamanho da fonte (editor)</span><input id="setFont" type="range" min="11" max="18" value="${s.fontSize}" class="range"/><span class="small muted" id="setFontVal">${s.fontSize}px</span></label>
      <label class="field"><span>Tab size</span><select id="setTab" class="select"><option value="2">2 espaços</option><option value="4">4 espaços</option></select></label>
      <div class="row"><button class="btn btn--primary" id="setSave">Salvar</button><button class="btn btn--sm" id="setReset">Restaurar padrão</button></div>
    </div></div>
    <div class="panel"><div class="panel__head"><span class="card__title">Sobre & Armazenamento</span></div><div class="panel__body stack">
      <div class="notice">Tudo roda localmente. Use o botão <b>🌙/☀️</b> na barra superior para alternar claro/escuro sem recarregar.</div>
      <div class="card card__pad" style="background:var(--bg)"><div style="font:700 12px var(--font-display)">Armazenamento</div><div class="small muted" id="storageInfo" style="margin-top:6px"></div><div class="row" style="margin-top:12px"><button class="btn btn--sm" id="clearFavs">Limpar favoritos</button><button class="btn btn--sm" id="clearRecent">Limpar recentes</button></div></div>
    </div></div>
  </div>`;
  const theme=app.querySelector('#setTheme'), accent=app.querySelector('#setAccent'), font=app.querySelector('#setFont'), fontVal=app.querySelector('#setFontVal'), tab=app.querySelector('#setTab');
  theme.value=s.theme; accent.value=s.accent; tab.value=String(s.tabSize);
  font.addEventListener('input', ()=> fontVal.textContent=font.value+'px');
  app.querySelector('#setSave').addEventListener('click', ()=>{
    const next=Store.settings.set({ theme: theme.value, accent: accent.value, fontSize: parseInt(font.value,10), tabSize: parseInt(tab.value,10) });
    applySettings(next);
    toast('Settings saved','success');
  });
  app.querySelector('#setReset').addEventListener('click', ()=>{
    localStorage.removeItem(Store.settings.key);
    applySettings(Store.settings.get());
    viewSettings();
    toast('Reset done','success');
  });
  app.querySelector('#clearFavs').addEventListener('click', ()=>{ localStorage.removeItem(Store.favs.key); toast('Favorites cleared','success'); viewSettings(); buildSidebar(globalSearch.value||''); });
  app.querySelector('#clearRecent').addEventListener('click', ()=>{ localStorage.removeItem(Store.recent.key); toast('Recent cleared','success'); viewSettings(); });
  app.querySelector('#storageInfo').textContent=`favs: ${Store.favs.all().length} • recent: ${Store.recent.all().length} • accent: ${s.accent} • theme: ${s.theme}`;
}

function applySettings(s){
  const theme = s.theme === 'system' ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : s.theme;
  document.documentElement.setAttribute('data-accent', s.accent);
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.style.setProperty('--editor-font', s.fontSize+'px');
  const meta = document.querySelector('meta[name="theme-color"]');
  if(meta) meta.setAttribute('content', theme === 'light' ? '#FFFFFF' : '#080A0F');
  const btn = document.getElementById('btnTheme');
  if(btn) btn.textContent = theme === 'light' ? '☀️' : '🌙';
  if(btn) btn.title = theme === 'light' ? 'Mudar para modo escuro' : 'Mudar para modo claro';
}

// Tool mounting with shell for copy shortcut + favorite toggle
let currentToolContainer=null;
function mountTool(id, renderer, title, subtitle){
  topTitle.textContent=title;
  topSub.textContent=subtitle;
  app.innerHTML=`<div id="toolMount"></div>
  <div class="row" style="margin-top:12px;justify-content:space-between">
    <button class="btn btn--sm" id="btnFavTool">☆ Favorite</button>
    <span class="small muted">Ctrl+Enter para gerar • Ctrl+Shift+C para copiar output</span>
  </div>`;
  const mount=app.querySelector('#toolMount');
  currentToolContainer=mount;
  renderer(mount);
  markRecent(id);
  const favBtn=app.querySelector('#btnFavTool');
  function syncFav(){ const has=Store.favs.has(id); favBtn.textContent= has?'★ Favorited':'☆ Favorite'; favBtn.classList.toggle('btn--primary', has); }
  syncFav();
  favBtn.addEventListener('click', ()=>{ Store.favs.toggle(id); syncFav(); buildSidebar(globalSearch.value||''); toast(Store.favs.has(id)?'Added to favorites':'Removed','success'); });
}

const ROUTES = {
  dashboard: ()=> viewDashboard(),
  settings: ()=> viewSettings(),
  obfuscator: ()=> mountTool('obfuscator', renderObfuscator, 'Lua Obfuscator','Ofusque sem enviar código — gratuito e sem login.'),
  pastefy: ()=> mountTool('pastefy', renderPastefy, 'Pastefy Publisher','Publique no pastefy.app e copie o raw para loadstring.'),
  loadstring: ()=> mountTool('loadstring', renderLoadstring, 'Loadstring Generator','Gere loaders com pcall, retry e fallback.'),
  formatter: ()=> mountTool('formatter', renderFormatter, 'Lua Formatter','Indenta e formata Lua/Luau.'),
  minifier: ()=> mountTool('minifier', renderMinifier, 'Minifier','Comprima seu código.'),
  escaper: ()=> mountTool('escaper', renderEscaper, 'String Escaper','Escapa strings para Lua.'),
  char: ()=> mountTool('char', renderChar, 'String.char Generator','Texto ↔ string.char.'),
  base64: ()=> mountTool('base64', renderBase64, 'Base64 Tools','Encode/decode Base64.'),
  hex: ()=> mountTool('hex', renderHex, 'HEX Tools','Text ↔ HEX.'),
  url: ()=> mountTool('url', renderUrl, 'URL Encoder','encode/decode URL.'),
  jsonlua: ()=> mountTool('jsonlua', renderJsonLua, 'JSON ↔ Lua','Converta JSON ↔ tabela Lua.'),
  identifier: ()=> mountTool('identifier', renderIdentifier, 'Identifier Generator','IDs aleatórios.'),
  uuid: ()=> mountTool('uuid', renderUUID, 'UUID Generator','UUID v4 em lote.'),
  hash: ()=> mountTool('hash', renderHash, 'Hash Generator','SHA via Web Crypto.'),
  color3: ()=> mountTool('color3', renderColor3, 'Color3 Generator','Picker → Color3.'),
  udim2: ()=> mountTool('udim2', renderUDim2, 'UDim2 Builder','UDim2.new com presets.'),
  vector: ()=> mountTool('vector', renderVector, 'Vector Generator','Vector2/Vector3.'),
  cframe: ()=> mountTool('cframe', renderCFrame, 'CFrame Generator','CFrame.new.'),
  tween: ()=> mountTool('tween', renderTween, 'TweenInfo Generator','TweenInfo.new.'),
  services: ()=> mountTool('services', renderServices, 'Services Generator','game:GetService em lote.'),
  inspector: ()=> mountTool('inspector', renderInspector, 'Script Inspector','Análise estática completa.'),
  extractor: ()=> mountTool('extractor', renderExtractor, 'URL Extractor','Extrai URLs únicas.'),
  serviceextractor: ()=> mountTool('serviceextractor', renderServiceExtractor, 'Service Extractor','Lista GetService.'),
  snippets: ()=> mountTool('snippets', renderSnippets, 'Snippet Library','Snippets prontos para copiar.'),
};

function renderRoute(){
  const id=getRoute();
  const fn=ROUTES[id] || ROUTES.dashboard;
  try{ fn(); }catch(e){ app.innerHTML=`<div class="card card__pad"><b>Erro</b><div class="small muted">${e.message}</div></div>`; console.error(e); }
  updateActive();
  window.scrollTo({top:0, behavior:'instant'});
}

function init(){
  bindModals();
  const s=Store.settings.get();
  applySettings(s);
  buildSidebar();
  renderRoute();
  onRouteChange(renderRoute);
  // search
  globalSearch.addEventListener('input', ()=> buildSidebar(globalSearch.value));
  document.getElementById('btnOpenTools').addEventListener('click', ()=> navigate('loadstring'));
  document.getElementById('btnHamburger').addEventListener('click', openSidebar);
  document.getElementById('overlay').addEventListener('click', closeSidebar);
  document.getElementById('btnCloseSidebar').addEventListener('click', closeSidebar);
  document.getElementById('btnAbout').addEventListener('click', ()=> openModal('modalAbout'));
  document.getElementById('btnShortcuts').addEventListener('click', ()=> openModal('modalShortcuts'));
  document.getElementById('btnTheme').addEventListener('click', ()=>{
    const cur = Store.settings.get();
    const nextTheme = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    const next = Store.settings.set({ theme: nextTheme });
    applySettings(next);
    toast(nextTheme === 'light' ? 'Modo claro ativado' : 'Modo escuro ativado','success');
  });
  // keyboard
  document.addEventListener('keydown', (e)=>{
    if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='k'){ e.preventDefault(); globalSearch.focus(); }
    if((e.ctrlKey||e.metaKey) && e.key==='Enter'){
      // trigger Generate inside tool if exists
      const btn=currentToolContainer?.querySelector('.btn--primary');
      if(btn) btn.click();
    }
    if((e.ctrlKey||e.metaKey) && e.shiftKey && e.key.toLowerCase()==='c'){
      e.preventDefault();
      const out=currentToolContainer?._getOutput?.() || currentToolContainer?.dataset?.output || '';
      if(out) copyText(out); else toast('Nothing to copy','warning');
    }
  });
  // register sw
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
  }
}
init();
