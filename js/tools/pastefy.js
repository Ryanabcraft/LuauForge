import { copyText, toast } from '../ui.js';

const LS_KEY = 'lf:pastefy_key';

function getKey(){ try{ return localStorage.getItem(LS_KEY)||'' }catch{ return '' } }
function setKey(v){ try{ localStorage.setItem(LS_KEY, v) }catch{} }

export function renderPastefy(container){
  const savedKey = getKey();
  container.innerHTML = `
  <div class="tool-head">
    <div>
      <h2>Pastefy Publisher</h2>
      <p>Publique seu Lua/Luau no <span class="inline-code">pastefy.app</span> via API e gere o link <span class="inline-code">/raw</span> pronto para <span class="inline-code">loadstring(game:HttpGet(...))()</span>. Funciona 100% no navegador — com API key opcional.</p>
    </div>
    <span class="badge">API: pastefy.app/api/v2</span>
  </div>

  <div class="grid grid--2">
    <div class="panel">
      <div class="panel__head"><span class="card__title">Conteúdo</span><span class="badge" style="margin-left:auto">POST /paste</span></div>
      <div class="panel__body stack">
        <div class="grid grid--2">
          <label class="field"><span>Título</span><input id="pfTitle" class="input" placeholder="Meu script.lua" value="LuauForge.lua"/></label>
          <label class="field"><span>Visibilidade</span>
            <select id="pfVis" class="select"><option value="UNLISTED" selected>Unlisted (recomendado)</option><option value="PUBLIC">Public</option><option value="PRIVATE">Private</option></select>
          </label>
        </div>
        <label class="field"><span>Código Lua / Luau</span><textarea id="pfContent" class="textarea textarea--lg textarea--mono" placeholder="print('Hello LuauForge')"></textarea></label>
        <div class="grid grid--2">
          <label class="field"><span>API Key (opcional)</span><input id="pfKey" class="input input--mono" placeholder="Bearer Token de https://pastefy.app/apikeys" value="${savedKey.replace(/"/g,'&quot;')}"/></label>
          <label class="field"><span>Expira em (opcional)</span><input id="pfExpire" class="input" type="datetime-local"/></label>
        </div>
        <div class="row">
          <button class="btn btn--primary" id="pfPublish">Publicar no Pastefy</button>
          <button class="btn btn--sm" id="pfSaveKey">Salvar key</button>
          <button class="btn btn--sm" id="pfClear">Clear</button>
          <span class="small muted">sem key tenta anônimo; com key aparece em sua conta</span>
        </div>
        <div class="notice">Dica: gere seu token em <a href="https://pastefy.app/apikeys" target="_blank" rel="noreferrer" style="text-decoration:underline">pastefy.app/apikeys</a>. Guardamos só no seu <span class="inline-code">localStorage</span>.</div>
      </div>
    </div>

    <div class="stack">
      <div class="panel">
        <div class="panel__head">
          <span class="card__title">Resultado</span>
          <div class="row" style="margin-left:auto">
            <button class="btn btn--sm" id="pfCopyRaw">Copy raw</button>
            <button class="btn btn--sm" id="pfCopyLoad">Copy loadstring</button>
          </div>
        </div>
        <div class="panel__body stack">
          <div class="field"><span>Raw URL</span><input id="pfRaw" class="input input--mono" readonly placeholder="https://pastefy.app/xxx/raw"/></div>
          <div class="field"><span>View URL</span><input id="pfView" class="input input--mono" readonly placeholder="https://pastefy.app/xxx"/></div>
          <div class="field"><span>Loadstring</span><textarea id="pfLoad" class="textarea textarea--mono" readonly style="min-height:88px" placeholder='loadstring(game:HttpGet("https://pastefy.app/xxx/raw"))()'></textarea></div>
          <div class="output" style="display:none" id="pfOutWrap"><div class="output__bar"><span>Resposta API</span></div><pre id="pfOutRaw" class="wrap" style="max-height:220px"></pre></div>
          <div class="small muted" id="pfStatus"></div>
        </div>
      </div>
      <div class="panel">
        <div class="panel__head"><span class="card__title">Como usar</span></div>
        <div class="panel__body small muted" style="line-height:1.7">
          1. Cole seu código e clique <b>Publicar</b><br/>
          2. Copie o <b>Raw URL</b> e use no Loadstring Generator (aba Loadstring) ou copie direto o <b>loadstring</b> gerado<br/>
          3. Se der erro CORS, tente com API Key ou publique manualmente em pastefy.app e cole o link aqui
        </div>
      </div>
    </div>
  </div>
  `;

  const $ = s=> container.querySelector(s);
  const titleEl=$('#pfTitle'), contentEl=$('#pfContent'), visEl=$('#pfVis'), keyEl=$('#pfKey'), expireEl=$('#pfExpire');
  const rawEl=$('#pfRaw'), viewEl=$('#pfView'), loadEl=$('#pfLoad'), outWrap=$('#pfOutWrap'), outRaw=$('#pfOutRaw'), statusEl=$('#pfStatus');

  // default code
  contentEl.value = `-- LuauForge example\nprint("Hello from Pastefy!")\nlocal Players = game:GetService("Players")\nprint(Players.LocalPlayer.Name)\n`;

  function setStatus(msg, type='info'){ statusEl.textContent = msg; statusEl.style.color = type==='error' ? 'var(--danger)' : type==='success' ? 'var(--success)' : 'var(--text2)'; }

  async function publish(){
    const content = contentEl.value;
    if(!content.trim()){ toast('Cole o código antes de publicar','warning'); return; }
    const title = titleEl.value.trim() || 'LuauForge.lua';
    const visibility = visEl.value;
    const apiKey = keyEl.value.trim();
    const expireAt = expireEl.value ? new Date(expireEl.value).toISOString() : undefined;

    const payload = { title, content, visibility };
    if(expireAt) payload.expireAt = expireAt;

    // save key if present
    if(apiKey) setKey(apiKey);

    const btn = $('#pfPublish');
    btn.disabled = true; btn.textContent = 'Publicando...';
    setStatus('Enviando para https://pastefy.app/api/v2/paste ...');

    try{
      const headers = { 'Content-Type':'application/json' };
      if(apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

      const res = await fetch('https://pastefy.app/api/v2/paste', {
        method:'POST',
        headers,
        body: JSON.stringify(payload)
      });

      const text = await res.text();
      let data;
      try{ data = JSON.parse(text); }catch{ data = { raw:text } }

      outWrap.style.display = 'block';
      outRaw.textContent = JSON.stringify(data, null, 2);

      if(!res.ok){
        const msg = data?.message || data?.error || `HTTP ${res.status}`;
        // handle common cases
        if(res.status===401) setStatus('401 Unauthorized — use uma API Key válida de pastefy.app/apikeys ou tente sem key (anônimo pode estar desabilitado).', 'error');
        else if(res.status===429) setStatus('429 Rate limited — aguarde e tente novamente.', 'error');
        else setStatus('Erro: '+msg, 'error');
        toast('Falha ao publicar: '+msg,'error');
        return;
      }

      // success — try to extract urls
      const paste = data.paste || data;
      // pastefy returns id + raw_url? docs example raw_url
      const id = paste.id || paste.paste?.id;
      let rawUrl = paste.raw_url || paste.rawUrl || paste.raw || '';
      let viewUrl = paste.url || `https://pastefy.app/${id}`;

      // fallback construction if raw_url missing but id present
      if(!rawUrl && id) rawUrl = `https://pastefy.app/${id}/raw`;

      if(!rawUrl){ setStatus('Publicado mas não retornou raw_url — veja resposta abaixo.', 'error'); return; }

      rawEl.value = rawUrl;
      viewEl.value = viewUrl;
      const load = `loadstring(game:HttpGet("${rawUrl}"))()`;
      loadEl.value = load;
      container.dataset.output = rawUrl + '\n' + load;

      setStatus('Publicado com sucesso! Raw pronto para loadstring.', 'success');
      toast('Publicado no Pastefy','success');

      // also store last url for loadstring generator convenience
      try{ localStorage.setItem('lf:last_pastefy_raw', rawUrl); }catch{}

    }catch(e){
      outWrap.style.display = 'block';
      outRaw.textContent = String(e);
      const isCors = /Failed to fetch|NetworkError|CORS/i.test(String(e.message||e));
      if(isCors){
        setStatus('Erro de rede/CORS — o navegador bloqueou. Tente com API Key, ou publique manualmente em pastefy.app e cole o link na aba Loadstring.', 'error');
        toast('CORS/Network — tente com API Key','error');
      } else {
        setStatus('Erro: '+e.message, 'error');
        toast(e.message,'error');
      }
    }finally{
      btn.disabled = false; btn.textContent = 'Publicar no Pastefy';
    }
  }

  $('#pfPublish').addEventListener('click', publish);
  $('#pfSaveKey').addEventListener('click', ()=>{ setKey(keyEl.value.trim()); toast('API key salva localmente','success'); });
  $('#pfClear').addEventListener('click', ()=>{ contentEl.value=''; rawEl.value=''; viewEl.value=''; loadEl.value=''; outWrap.style.display='none'; outRaw.textContent=''; setStatus(''); });
  $('#pfCopyRaw').addEventListener('click', ()=> copyText(rawEl.value||''));
  $('#pfCopyLoad').addEventListener('click', ()=> copyText(loadEl.value||''));

  // allow quick publish via shortcut
  container.addEventListener('keydown', e=>{ if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){ e.preventDefault(); publish(); }});
  container._getOutput = ()=> rawEl.value||'';
}

