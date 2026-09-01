import { copyText, toast } from '../ui.js';

function escapeLuaString(s){
  return s.replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/\n/g,'\\n').replace(/\r/g,'\\r');
}

export function renderLoadstring(container){
  container.innerHTML = `
  <div class="tool-head">
    <div>
      <h2>Loadstring Generator</h2>
      <p>Gere loaders <span class="inline-code">loadstring(game:HttpGet(url))()</span> com pcall, retry, cache-bypass e fallback multi-URL.</p>
    </div>
    <span class="badge">Client-side</span>
  </div>

  <div class="grid grid--2">
    <div class="panel">
      <div class="panel__head"><span class="card__title">Input</span><span class="badge">URLs</span></div>
      <div class="panel__body stack">
        <div class="field">
          <label>Primary URL</label>
          <input id="lsUrl" class="input input--mono" placeholder="https://pastefy.app/abc/raw"/>
        </div>
        <div class="field">
          <label>Fallback URLs (uma por linha)</label>
          <textarea id="lsFallback" class="textarea textarea--mono" placeholder="https://raw.githubusercontent.com/...&#10;https://..."></textarea>
        </div>
        <div class="grid grid--2">
          <label class="check"><input type="checkbox" id="lsPcall" checked/> pcall wrapper</label>
          <label class="check"><input type="checkbox" id="lsWarn" checked/> warn on error</label>
          <label class="check"><input type="checkbox" id="lsRetry"/> retry (3x)</label>
          <label class="check"><input type="checkbox" id="lsCache" checked/> cache bypass (HttpGet true)</label>
          <label class="check"><input type="checkbox" id="lsAutoCopy"/> copiar automaticamente</label>
        </div>
        <div class="row">
          <button class="btn btn--primary" id="lsGenerate">Generate</button>
          <button class="btn" id="lsClear">Clear</button>
          <span class="small muted">Atalho: <span class="kbd">Ctrl</span> + <span class="kbd">Enter</span></span>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel__head"><span class="card__title">Output</span>
        <div class="row" style="margin-left:auto">
          <button class="btn btn--sm" id="lsCopy">Copy</button>
          <button class="btn btn--sm" id="lsCopyPcall">Copy pcall version</button>
        </div>
      </div>
      <div class="panel__body stack">
        <div class="output"><div class="output__bar"><span>LUA</span><span class="small muted" id="lsStats"></span></div><pre id="lsOut" class="wrap"></pre></div>
        <div class="notice">Dica: use MULTI-URL quando a primeira fonte pode ficar offline. O loader tenta cada URL em sequência.</div>
        <div class="field">
          <label>Preview pcall block</label>
          <div class="output"><pre id="lsPcallPreview" class="wrap"></pre></div>
        </div>
      </div>
    </div>
  </div>
  `;

  const $ = (s)=> container.querySelector(s);
  const urlEl = $('#lsUrl');
  const fbEl = $('#lsFallback');
  const pcallEl = $('#lsPcall');
  const warnEl = $('#lsWarn');
  const retryEl = $('#lsRetry');
  const cacheEl = $('#lsCache');
  const autoEl = $('#lsAutoCopy');
  const outEl = $('#lsOut');
  const pcallPrev = $('#lsPcallPreview');
  const statsEl = $('#lsStats');

  function build(){
    const primary = urlEl.value.trim();
    const fallbacks = fbEl.value.split('\n').map(s=>s.trim()).filter(Boolean);
    const urls = [primary, ...fallbacks].filter(Boolean);
    if(urls.length===0){ toast('Informe ao menos uma URL','warning'); return ''; }
    for(const u of urls){ try{ new URL(u); }catch{ toast('URL inválida: '+u,'error'); return ''; } }

    const cacheArg = cacheEl.checked ? ', true' : '';
    const usePcall = pcallEl.checked;
    const useWarn = warnEl.checked;
    const useRetry = retryEl.checked;

    let code='';
    if(urls.length===1){
      const u = escapeLuaString(urls[0]);
      if(!usePcall){
        code = `loadstring(game:HttpGet("${u}"${cacheArg}))()`;
      } else if(!useRetry){
        code = `local success, result = pcall(function()\n    return game:HttpGet("${u}"${cacheArg})\nend)\n\nif success then\n    loadstring(result)()\nelse` + (useWarn ? `\n    warn(result)` : `\n    -- handle error`) + `\nend`;
      } else {
        code = `local urls = {"${u}"}\nlocal src\nfor i=1,3 do\n    local ok, res = pcall(function() return game:HttpGet("${u}"${cacheArg}) end)\n    if ok and res and #res>0 then src=res break end\n    ${useWarn?`warn(("[loader] attempt "..i.." failed: "..tostring(res))`:`-- retry`}\n    task.wait(0.4)\nend\nif src then loadstring(src)() ${useWarn?`else warn("[loader] all attempts failed")`:`else error("failed")`} end`;
      }
    } else {
      // multi
      const arr = urls.map(u=>`    "${escapeLuaString(u)}"`).join(',\n');
      if(!useRetry){
        code = `local urls = {\n${arr}\n}\nfor _, url in ipairs(urls) do\n    local ok, src = pcall(function() return game:HttpGet(url${cacheArg}) end)\n    if ok and src and #src>0 then loadstring(src)() break end\n    ${useWarn?`warn("[loader] failed: "..url)`:`-- try next`}\nend`;
      } else {
        code = `local urls = {\n${arr}\n}\nlocal loaded=false\nfor _, url in ipairs(urls) do\n    for attempt=1,3 do\n        local ok, src = pcall(function() return game:HttpGet(url${cacheArg}) end)\n        if ok and src and #src>0 then loadstring(src)() loaded=true break end\n        ${useWarn?`warn(("[loader] "..url.." attempt "..attempt.." failed"))`:`-- retry`}\n        task.wait(0.3)\n    end\n    if loaded then break end\nend\nif not loaded then ${useWarn?`warn("[loader] all urls failed")`:`error("all urls failed")`} end`;
      }
    }
    return code;
  }

  function render(){
    const code = build();
    if(code==='') return;
    outEl.textContent = code;
    statsEl.textContent = code.length + ' chars • ' + code.split('\n').length + ' lines';
    // pcall preview block
    const primary = urlEl.value.trim() || (fbEl.value.split('\n')[0]||'').trim() || 'https://example.com/raw';
    pcallPrev.textContent = `local success, result = pcall(function()\n    return game:HttpGet("${escapeLuaString(primary)}"${cacheEl.checked?', true':''})\nend)\n\nif success then\n    loadstring(result)()\nelse\n    warn(result)\nend`;
    if(autoEl.checked) copyText(code);
    container.dataset.output = code;
  }

  $('#lsGenerate').addEventListener('click', render);
  $('#lsCopy').addEventListener('click', ()=> copyText(outEl.textContent||''));
  $('#lsCopyPcall').addEventListener('click', ()=> copyText(pcallPrev.textContent||''));
  $('#lsClear').addEventListener('click', ()=>{ urlEl.value=''; fbEl.value=''; outEl.textContent=''; pcallPrev.textContent=''; statsEl.textContent=''; });
  container.addEventListener('keydown', (e)=>{
    if((e.ctrlKey||e.metaKey) && e.key==='Enter'){ e.preventDefault(); render(); }
  });
  // expose for global copy shortcut
  container._getOutput = ()=> outEl.textContent||'';
  // initial
  urlEl.value = 'https://pastefy.app/abc/raw';
  render();
}
