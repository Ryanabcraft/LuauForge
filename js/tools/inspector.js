import { copyText, toast } from '../ui.js';

function analyze(code){
  const lines = code.split('\n');
  const blank = lines.filter(l=> l.trim()==='').length;
  const commentLines = lines.filter(l=> l.trim().startsWith('--')).length;
  const codeLines = lines.length - blank;
  const chars = code.length;
  const funcs = (code.match(/\bfunction\b/g)||[]).length;
  const locals = (code.match(/\blocal\b/g)||[]).length;
  const strings = (code.match(/"([^"\\]|\\.)*"|'([^'\\]|\\.)*'|\[\[[\s\S]*?\]\]/g)||[]).length;
  const comments = (code.match(/--.*$/gm)||[]).length;
  const urls = extractUrls(code);
  const services = extractServices(code);
  const requires = (code.match(/\brequire\s*\(/g)||[]).length;
  const httpGets = (code.match(/:HttpGet\s*\(/g)||[]).length;
  const events = (code.match(/\b(Connect|Wait|Once)\s*\(/g)||[]).length;
  const loops = (code.match(/\b(for|while|repeat)\b/g)||[]).length;
  const tables = (code.match(/\{/g)||[]).length;
  return { lines: lines.length, blank, commentLines, codeLines, chars, funcs, locals, strings, comments, urls, services, requires, httpGets, events, loops, tables };
}
function extractUrls(code){
  const re = /https?:\/\/[^\s"'`\)\]]+/g;
  const found = code.match(re)||[];
  // also raw.githubusercontent, pastefy etc without protocol? already covered
  return [...new Set(found.map(u=> u.replace(/[),;]+$/,'')))];
}
function extractServices(code){
  const re = /GetService\s*\(\s*["']([^"']+)["']\s*\)/g;
  const set=new Set();
  let m; while((m=re.exec(code))!==null) set.add(m[1]);
  return [...set];
}
function extractRequires(code){
  const re = /require\s*\([^)]*\)/g;
  return code.match(re)||[];
}
function extractFunctions(code){
  const re = /function\s+([A-Za-z0-9_\.:]+)?\s*\([^)]*\)/g;
  const arr=[]; let m; while((m=re.exec(code))!==null) arr.push(m[0]);
  // also local function
  const re2=/local\s+function\s+[A-Za-z0-9_]+\s*\([^)]*\)/g;
  let m2; while((m2=re2.exec(code))!==null) if(!arr.includes(m2[0])) arr.push(m2[0]);
  return arr;
}
function extractStrings(code){
  const re=/"([^"\\]|\\.)*"|'([^'\\]|\\.)*'|\[\[[\s\S]*?\]\]/g;
  const arr=[]; let m; while((m=re.exec(code))!==null) arr.push(m[0].slice(0,120));
  return arr;
}

export function renderInspector(container){
  container.innerHTML=`
  <div class="tool-head"><div><h2>Script Inspector</h2><p>Análise estática: linhas, funções, URLs, services, requires — sem executar o código.</p></div><span class="badge">Safe</span></div>
  <div class="panel">
    <div class="panel__head">
      <span class="card__title">Paste Lua/Luau</span>
      <div class="row" style="margin-left:auto">
        <button class="btn btn--primary" id="inGo">Analyze</button>
        <button class="btn btn--sm" id="inCopy">Copy report</button>
        <button class="btn btn--sm" id="inClear">Clear</button>
      </div>
    </div>
    <div class="panel__body grid grid--2">
      <div class="field"><textarea id="inCode" class="textarea textarea--lg textarea--mono" placeholder="cole o script aqui..."></textarea></div>
      <div class="stack" id="inStats"></div>
    </div>
    <div class="panel__body" style="border-top:1px solid var(--border)">
      <div class="tabs" id="inTabs">
        <button class="tab active" data-tab="overview">Overview</button>
        <button class="tab" data-tab="urls">URLs</button>
        <button class="tab" data-tab="services">Services</button>
        <button class="tab" data-tab="functions">Functions</button>
        <button class="tab" data-tab="strings">Strings</button>
        <button class="tab" data-tab="requires">Requires</button>
      </div>
      <div id="inTabContent" style="margin-top:12px"></div>
    </div>
  </div>`;
  const $=s=>container.querySelector(s);
  const codeEl=$('#inCode'), statsEl=$('#inStats'), tabContent=$('#inTabContent');
  let last=null;
  function render(){
    const code=codeEl.value;
    if(!code.trim()){ toast('Cole um script primeiro','warning'); return; }
    last=analyze(code);
    // stats cards
    const cards=[
      ['Lines', last.lines], ['Chars', last.chars], ['Code lines', last.codeLines], ['Blank', last.blank],
      ['Functions', last.funcs], ['Locals', last.locals], ['Strings', last.strings], ['Comments', last.comments],
      ['URLs', last.urls.length], ['Services', last.services.length], ['Requires', last.requires], ['HttpGet', last.httpGets],
      ['Events', last.events], ['Loops', last.loops], ['Tables {', last.tables],
    ];
    statsEl.innerHTML=`<div class="grid grid--3">${cards.map(([k,v])=>`<div class="card card__pad" style="padding:12px"><div class="small muted" style="font:600 10px var(--font-sans);letter-spacing:.1em;text-transform:uppercase">${k}</div><div style="font:800 18px var(--font-mono)">${v}</div></div>`).join('')}</div>`;
    showTab('overview');
    container.dataset.output=JSON.stringify(last,null,2);
  }
  function showTab(name){
    container.querySelectorAll('#inTabs .tab').forEach(t=> t.classList.toggle('active', t.dataset.tab===name));
    if(!last){ tabContent.innerHTML='<div class="empty">Analise um código para ver detalhes</div>'; return; }
    if(name==='overview'){
      tabContent.innerHTML=`
        <div class="grid grid--2">
          <div class="card card__pad"><div style="font:700 12px var(--font-sans)">URLs (${last.urls.length})</div><div class="small muted" style="margin-top:8px;word-break:break-all">${last.urls.slice(0,6).join('<br>')||'—'}</div></div>
          <div class="card card__pad"><div style="font:700 12px var(--font-sans)">Services (${last.services.length})</div><div class="small muted" style="margin-top:8px">${last.services.join(', ')||'—'}</div></div>
        </div>`;
    } else if(name==='urls'){
      tabContent.innerHTML = last.urls.length? `<div class="list" style="border:1px solid var(--border);border-radius:12px;overflow:hidden">${last.urls.map(u=>`<div class="list__item"><span style="flex:1">${u}</span><button class="btn btn--sm" data-copy="${encodeURIComponent(u)}">Copy</button></div>`).join('')}</div>` : '<div class="empty">Nenhuma URL encontrada</div>';
      tabContent.querySelectorAll('[data-copy]').forEach(b=> b.addEventListener('click', ()=> copyText(decodeURIComponent(b.dataset.copy))));
    } else if(name==='services'){
      tabContent.innerHTML = last.services.length? `<div class="list" style="border:1px solid var(--border);border-radius:12px;overflow:hidden">${last.services.map(s=>`<div class="list__item"><span>${s}</span><span class="badge" style="margin-left:auto">GetService("${s}")</span></div>`).join('')}</div>` : '<div class="empty">Nenhum service</div>';
    } else if(name==='functions'){
      const fns=extractFunctions(codeEl.value);
      tabContent.innerHTML = fns.length? `<div class="list" style="border:1px solid var(--border);border-radius:12px;overflow:hidden">${fns.slice(0,80).map(f=>`<div class="list__item mono" style="font-size:11px">${f.replace(/</g,'&lt;')}</div>`).join('')}</div>` : '<div class="empty">Nenhuma função detectada</div>';
    } else if(name==='strings'){
      const strs=extractStrings(codeEl.value);
      tabContent.innerHTML = strs.length? `<div class="list" style="border:1px solid var(--border);border-radius:12px;overflow:hidden">${strs.slice(0,80).map(s=>`<div class="list__item mono" style="font-size:11px">${s.replace(/</g,'&lt;')}</div>`).join('')}</div>` : '<div class="empty">Nenhuma string</div>';
    } else if(name==='requires'){
      const reqs=extractRequires(codeEl.value);
      tabContent.innerHTML = reqs.length? `<div class="list" style="border:1px solid var(--border);border-radius:12px;overflow:hidden">${reqs.map(r=>`<div class="list__item mono">${r.replace(/</g,'&lt;')}</div>`).join('')}</div>` : '<div class="empty">Nenhum require</div>';
    }
  }
  $('#inGo').addEventListener('click', render);
  $('#inClear').addEventListener('click', ()=>{ codeEl.value=''; statsEl.innerHTML=''; tabContent.innerHTML=''; last=null; });
  $('#inCopy').addEventListener('click', ()=> copyText(container.dataset.output||''));
  container.querySelectorAll('#inTabs .tab').forEach(t=> t.addEventListener('click', ()=> showTab(t.dataset.tab)));
  container._getOutput=()=> container.dataset.output||'';
  codeEl.value=`local Players = game:GetService("Players")\nlocal HttpService = game:GetService("HttpService")\nlocal url = "https://pastefy.app/abc/raw"\nlocal src = game:HttpGet(url)\nloadstring(src)()\n\nlocal function foo(a,b)\n    return a+b\nend\nrequire(game.ReplicatedStorage.Module)\n`;
  render();
  container.addEventListener('keydown', e=>{ if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){ e.preventDefault(); render(); }});
}
export function renderExtractor(container){
  container.innerHTML=`
  <div class="tool-head"><div><h2>URL Extractor</h2><p>Extrai todas as URLs únicas de um script Lua/Luau.</p></div></div>
  <div class="panel"><div class="panel__body grid grid--2">
    <div class="field"><label>Script</label><textarea id="exIn" class="textarea textarea--lg textarea--mono" placeholder="cole o código..."></textarea></div>
    <div class="stack">
      <div class="output"><div class="output__bar"><span>URLs</span><button class="btn btn--sm" id="exCopy" style="margin-left:auto">Copy all</button></div><pre id="exOut" class="wrap"></pre></div>
      <div class="row"><button class="btn btn--primary" id="exGo">Extract</button><button class="btn btn--sm" id="exClear">Clear</button></div>
    </div>
  </div></div>`;
  const $=s=>container.querySelector(s);
  const inEl=$('#exIn'), out=$('#exOut');
  function go(){
    const urls=[...new Set((inEl.value.match(/https?:\/\/[^\s"'`\)\]]+/g)||[]).map(u=>u.replace(/[),;]+$/,'')))];
    if(urls.length===0){ out.textContent='— nenhuma URL encontrada'; toast('Nenhuma URL','warning'); return; }
    out.textContent=urls.join('\n');
    container.dataset.output=out.textContent;
  }
  $('#exGo').addEventListener('click', go);
  $('#exCopy').addEventListener('click', ()=> copyText(out.textContent||''));
  $('#exClear').addEventListener('click', ()=>{ inEl.value=''; out.textContent='';});
  container._getOutput=()=> out.textContent||'';
  inEl.value=`loadstring(game:HttpGet("https://raw.githubusercontent.com/user/repo/main/main.lua"))()\n-- fallback https://pastefy.app/abc/raw\n`;
  go();
}
export function renderServiceExtractor(container){
  container.innerHTML=`
  <div class="tool-head"><div><h2>Service Extractor</h2><p>Detecta <span class="inline-code">game:GetService("...")</span> no código.</p></div></div>
  <div class="panel"><div class="panel__body grid grid--2">
    <div class="field"><label>Script</label><textarea id="seIn" class="textarea textarea--lg textarea--mono" placeholder="cole o código..."></textarea></div>
    <div class="stack">
      <div class="output"><div class="output__bar"><span>SERVICES</span><button class="btn btn--sm" id="seCopy" style="margin-left:auto">Copy</button></div><pre id="seOut"></pre></div>
      <div class="row"><button class="btn btn--primary" id="seGo">Extract</button><button class="btn btn--sm" id="seClear">Clear</button></div>
    </div>
  </div></div>`;
  const $=s=>container.querySelector(s);
  const inEl=$('#seIn'), out=$('#seOut');
  function go(){
    const re=/GetService\s*\(\s*["']([^"']+)["']\s*\)/g;
    const set=new Set(); let m; while((m=re.exec(inEl.value))!==null) set.add(m[1]);
    const arr=[...set];
    if(arr.length===0){ out.textContent='— nenhum service encontrado'; toast('Nenhum service','warning'); return; }
    out.textContent=arr.map(s=>`game:GetService("${s}")`).join('\n');
    container.dataset.output=out.textContent;
  }
  $('#seGo').addEventListener('click', go);
  $('#seCopy').addEventListener('click', ()=> copyText(out.textContent||''));
  $('#seClear').addEventListener('click', ()=>{ inEl.value=''; out.textContent='';});
  container._getOutput=()=> out.textContent||'';
  inEl.value=`local Players=game:GetService("Players")\nlocal RS=game:GetService('ReplicatedStorage')\nlocal TS=game:GetService("TweenService")\n`;
  go();
}
