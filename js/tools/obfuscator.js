import { copyText, toast } from '../ui.js';

/* ———————————————————————————————
   LuauForge — Client-side Lua Obfuscator
   100% no navegador, sem login, sem API externa obrigatória.
   Passes: rename locals, string encode (string.char), junk, minify, header
   Mantém compatibilidade e não quebra strings/comentários.
   ——————————————————————————————— */

function randomName(len=6){
  const a='abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const b='0123456789';
  const all=a+b;
  let s='_' + a[Math.floor(Math.random()*a.length)];
  for(let i=1;i<len;i++) s+= all[Math.floor(Math.random()*all.length)];
  return s;
}

function obfuscateLua(src, opts){
  if(!src.trim()) return { code:'', map:new Map() };

  // 1) placeholders para strings longas e literais para não quebrar
  const placeholders = [];
  const store = (s)=> { const k=`__STR${placeholders.length}__`; placeholders.push(s); return k; };
  // long strings [[ ]]
  let code = src.replace(/\[\[[\s\S]*?\]\]/g, m=> store(m));
  // single line comments — preservar se não for junk? remover se light? vamos manter placeholders se remover depois
  // strings "..." e '...'
  code = code.replace(/"([^"\\]|\\.)*"/g, m=> store(m));
  code = code.replace(/'([^'\\]|\\.)*'/g, m=> store(m));

  // comments handling: se não for para manter, remover blocos --[[ ]] e --...
  // já placeholdamos [[ ]], então remover --__STRx__ para blocos e -- linhas
  code = code.replace(/--__STR\d+__/g, '');
  if(opts.stripComments) code = code.replace(/--.*$/gm, '');

  // 2) rename locals
  const renameMap = new Map();
  const reserved = new Set(['and','break','do','else','elseif','end','false','for','function','if','in','local','nil','not','or','repeat','return','then','true','until','while','game','workspace','script','math','string','table','pairs','ipairs','print','warn','wait','task','Enum','Vector3','Vector2','CFrame','Color3','UDim2','Instance','typeof','tonumber','tostring']);
  function getOrCreate(orig){
    if(reserved.has(orig)) return orig;
    if(renameMap.has(orig)) return renameMap.get(orig);
    let n;
    do{ n = randomName(opts.strong? 12 : 8); }while([...renameMap.values()].includes(n));
    renameMap.set(orig,n);
    return n;
  }

  if(opts.rename){
    // collect locals: local NAME, local function NAME, for NAME in, function NAME(params), params
    const locals = new Set();
    // local var = , local var, var = , local var=1, local a,b
    const localVarRe = /\blocal\s+([A-Za-z_][A-Za-z0-9_]*(?:\s*,\s*[A-Za-z_][A-Za-z0-9_]*)*)/g;
    let m;
    while((m=localVarRe.exec(code))!==null){
      m[1].split(',').forEach(v=> { const t=v.trim(); if(t) locals.add(t); });
    }
    // local function NAME
    const localFuncRe = /\blocal\s+function\s+([A-Za-z_][A-Za-z0-9_]*)/g;
    while((m=localFuncRe.exec(code))!==null) locals.add(m[1]);
    // for loop vars: for i,v in
    const forRe = /\bfor\s+([A-Za-z_][A-Za-z0-9_]*(?:\s*,\s*[A-Za-z_][A-Za-z0-9_]*)*)\s+in\b/g;
    while((m=forRe.exec(code))!==null) m[1].split(',').forEach(v=> { const t=v.trim(); if(t) locals.add(t); });
    // function params: function NAME(a,b) and function(a,b)
    const funcParamsRe = /\bfunction\s*(?:[A-Za-z0-9_\.:]*)?\s*\(([^)]*)\)/g;
    while((m=funcParamsRe.exec(code))!==null){
      m[1].split(',').forEach(p=>{ const t=p.trim().split('=')[0].trim(); if(/^[A-Za-z_][A-Za-z0-9_]*$/.test(t)) locals.add(t); });
    }

    // build map
    [...locals].forEach(name=>{
      if(!reserved.has(name) && name.length>1) getOrCreate(name);
    });

    // replace using word boundaries, longest first to avoid partial
    const sorted = [...renameMap.entries()].sort((a,b)=> b[0].length - a[0].length);
    for(const [orig, obf] of sorted){
      // placeholder strings contain __STRx__ so not affected because orig never matches that pattern
      code = code.replace(new RegExp(`\\b${orig}\\b`, 'g'), obf);
    }
  }

  // 3) string encode placeholder restore with optional encoding
  // prepare decoder stub if needed
  let decoderStub = '';
  let decoderName = '';
  if(opts.encodeStrings){
    decoderName = randomName(8);
    if(opts.encodeMode==='char'){
      // we'll replace each string literal with string.char(...)
      // simple char encode, no stub needed
    } else if(opts.encodeMode==='b64'){
      decoderName = randomName(8);
      decoderStub = `local ${decoderName}=function(s) local r="" for i=1,#s,2 do r=r..string.char(tonumber(s:sub(i,i+1),16)) end return r end\n`;
      // Actually for b64 we could do byte hex, similar to char but hex string decode
      // We'll implement hex pair decode as b64 mode
    } else if(opts.encodeMode==='xor'){
      const key = Math.floor(Math.random()*200)+5;
      decoderName = randomName(8);
      decoderStub = `local ${decoderName}=function(s,k) local r="" for i=1,#s do r=r..string.char((string.byte(s,i)+256-k)%256) end return r end\n`;
      // store key for later per-string
      code._xorKey = key; // attach
    }
  }

  // restore strings
  let restore = code;
  // we need to iterate placeholders in order, deciding per-placeholder encoding
  const xorKey = code._xorKey || Math.floor(Math.random()*200)+5;
  if(!opts.encodeStrings){
    // simple restore
    placeholders.forEach((orig,i)=>{
      const k=`__STR${i}__`;
      restore = restore.split(k).join(orig);
    });
  } else {
    // encode each literal that is "..." or '...' or [[ ]]
    placeholders.forEach((orig,i)=>{
      const k=`__STR${i}__`;
      let out = orig;
      const isLong = orig.startsWith('[[');
      const isSingle = orig.startsWith("'") && !isLong;
      const isDouble = orig.startsWith('"') && !isLong;
      if(isLong){
        // keep as is for now, but optionally one-line
        out = orig;
      } else if(isDouble || isSingle){
        // strip quotes
        const inner = orig.slice(1,-1).replace(/\\"/g,'"').replace(/\\'/g,"'").replace(/\\\\/g,'\\').replace(/\\n/g,'\n').replace(/\\r/g,'\r').replace(/\\t/g,'\t');
        if(opts.encodeMode==='char'){
          const codes = [...inner].map(c=> c.codePointAt(0));
          out = codes.length ? `string.char(${codes.join(',')})` : `""`;
        } else if(opts.encodeMode==='b64'){
          // hex pair string + decoder
          const hex = [...new TextEncoder().encode(inner)].map(b=> b.toString(16).padStart(2,'0')).join('');
          if(hex) out = `${decoderName}("${hex}")`;
          else out = `""`;
        } else if(opts.encodeMode==='xor'){
          const encoded = [...inner].map(c=> String.fromCharCode((c.charCodeAt(0)+xorKey)%256)).join('');
          const hex = [...new TextEncoder().encode(encoded)].map(b=> b.toString(16).padStart(2,'0')).join('');
          // second layer: hide key as well? keep simple
          if(hex) out = `${decoderName}("${hex}",${xorKey})`;
          else out = `""`;
        }
      }
      restore = restore.split(k).join(out);
    });
    if(decoderStub) restore = decoderStub + restore;
  }
  code = restore;

  // 4) junk / dead code
  if(opts.junk){
    const junkName = randomName(6);
    const junk = `do local ${junkName}=${Math.floor(Math.random()*9999)} end\n`;
    // insert after 1st line and random spots
    const lines = code.split('\n');
    const injected = [];
    lines.forEach((l,idx)=>{
      injected.push(l);
      if(idx===0 || (Math.random()<0.18 && injected.length>2)) injected.push(junk.trim());
    });
    code = injected.join('\n');
  }

  // 5) header
  if(opts.header){
    code = `-- Obfuscated with LuauForge (client-side) | ${new Date().toISOString().slice(0,10)}\n` + code;
  }

  // 6) minify / oneLine
  if(opts.minify){
    // preserve strings already encoded, but we already replaced, so safe to compress whitespace outside
    // simple: collapse whitespace, remove empty lines
    code = code.split('\n').map(l=> l.trim()).filter(l=> l.length).join(opts.oneLine ? '; ' : '\n');
    if(opts.oneLine) code = code.replace(/\s+/g,' ').replace(/\s*([=,;{}()])\s*/g,'$1').trim();
  }

  return { code, map: renameMap };
}

export function renderObfuscator(container){
  container.innerHTML = `
  <div class="tool-head">
    <div>
      <h2>Lua Obfuscator</h2>
      <p>Ofusque Lua/Luau <b>100% no navegador</b> — sem login, sem API key, sem enviar código. Opções: renomear locais, codificar strings (<span class="inline-code">string.char</span>), lixo e minify. Também pode usar API externa opcional.</p>
    </div>
    <span class="badge">Client-side</span>
  </div>

  <div class="grid grid--2">
    <div class="panel">
      <div class="panel__head">
        <span class="card__title">Input</span>
        <div class="row" style="margin-left:auto">
          <select id="obPreset" class="select" style="width:150px;height:34px"><option value="light">Leve</option><option value="medium" selected>Médio</option><option value="strong">Forte</option><option value="maximum">Máximo</option></select>
          <button class="btn btn--sm" id="obExample">Exemplo</button>
        </div>
      </div>
      <div class="panel__body stack">
        <textarea id="obIn" class="textarea textarea--lg textarea--mono" placeholder="cole seu Lua/Luau aqui..."></textarea>
        <div class="grid grid--2">
          <label class="check"><input type="checkbox" id="obRename" checked/> Renomear locais</label>
          <label class="check"><input type="checkbox" id="obEncode" checked/> Codificar strings</label>
          <label class="check"><input type="checkbox" id="obStrip"/> Remover comentários</label>
          <label class="check"><input type="checkbox" id="obJunk"/> Adicionar lixo (junk)</label>
          <label class="check"><input type="checkbox" id="obMinify"/> Minify</label>
          <label class="check"><input type="checkbox" id="obOneLine"/> Uma linha</label>
          <label class="check"><input type="checkbox" id="obHeader"/> Cabeçalho data</label>
        </div>
        <div class="grid grid--2">
          <label class="field"><span>Modo strings</span>
            <select id="obMode" class="select"><option value="char">string.char (recomendado)</option><option value="b64">hex + decoder</option><option value="xor">xor + decoder</option></select>
          </label>
          <label class="field"><span>API externa (opcional)</span><input id="obApi" class="input input--mono" placeholder="https://.../api/obfuscate (deixe vazio = local)"/></label>
        </div>
        <div class="row">
          <button class="btn btn--primary" id="obGo">Obfuscar</button>
          <button class="btn btn--sm" id="obCopy">Copy</button>
          <button class="btn btn--sm" id="obClear">Clear</button>
          <span class="small muted" id="obStats"></span>
        </div>
        <div class="notice">Gratuito, sem login, código nunca sai do dispositivo no modo local. APIs externas como <span class="inline-code">magicsec.vip</span> ou <span class="inline-code">luaobfuscator.com</span> exigem key e têm CORS/rate limit — por isso o padrão é <b>local</b>.</div>
      </div>
    </div>

    <div class="panel">
      <div class="panel__head"><span class="card__title">Output</span>
        <div class="row" style="margin-left:auto">
          <button class="btn btn--sm" id="obCopyOut">Copy</button>
          <button class="btn btn--sm" id="obDownload">Download .lua</button>
        </div>
      </div>
      <div class="panel__body stack">
        <textarea id="obOut" class="textarea textarea--lg textarea--mono" readonly placeholder="código ofuscado..."></textarea>
        <div class="row small muted" id="obOutStats"></div>
        <div class="output" id="obApiOutWrap" style="display:none"><div class="output__bar"><span>API resposta</span></div><pre id="obApiOut" class="wrap" style="max-height:180px"></pre></div>
      </div>
    </div>
  </div>
  `;

  const $=s=> container.querySelector(s);
  const inEl=$('#obIn'), outEl=$('#obOut'), presetEl=$('#obPreset'), renameEl=$('#obRename'), encodeEl=$('#obEncode'), stripEl=$('#obStrip'), junkEl=$('#obJunk'), minifyEl=$('#obMinify'), oneLineEl=$('#obOneLine'), headerEl=$('#obHeader'), modeEl=$('#obMode'), apiEl=$('#obApi'), statsEl=$('#obStats'), outStats=$('#obOutStats'), apiWrap=$('#obApiOutWrap'), apiOut=$('#obApiOut');

  function applyPreset(v){
    if(v==='light'){ renameEl.checked=true; encodeEl.checked=false; junkEl.checked=false; minifyEl.checked=false; oneLineEl.checked=false; stripEl.checked=true; headerEl.checked=false; modeEl.value='char'; }
    if(v==='medium'){ renameEl.checked=true; encodeEl.checked=true; junkEl.checked=false; minifyEl.checked=true; oneLineEl.checked=false; stripEl.checked=true; headerEl.checked=false; modeEl.value='char'; }
    if(v==='strong'){ renameEl.checked=true; encodeEl.checked=true; junkEl.checked=true; minifyEl.checked=true; oneLineEl.checked=false; stripEl.checked=true; headerEl.checked=true; modeEl.value='b64'; }
    if(v==='maximum'){ renameEl.checked=true; encodeEl.checked=true; junkEl.checked=true; minifyEl.checked=true; oneLineEl.checked=true; stripEl.checked=true; headerEl.checked=true; modeEl.value='xor'; }
  }
  presetEl.addEventListener('change', ()=> applyPreset(presetEl.value));
  $('#obExample').addEventListener('click', ()=>{
    inEl.value = `local Players = game:GetService("Players")\nlocal player = Players.LocalPlayer\nlocal secret = "LuauForge"\nlocal function greet(name)\n    print("Hello, "..name.." - "..secret)\nend\n\ngreet(player.Name)\n`;
  });
  inEl.value = `local Players = game:GetService("Players")\nlocal secret = "Hello LuauForge"\nprint(secret)\n`;

  async function doObf(){
    const src = inEl.value;
    if(!src.trim()){ toast('Cole código para ofuscar','warning'); return; }
    const opts = {
      rename: renameEl.checked,
      encodeStrings: encodeEl.checked,
      encodeMode: modeEl.value,
      stripComments: stripEl.checked,
      junk: junkEl.checked,
      minify: minifyEl.checked,
      oneLine: oneLineEl.checked,
      header: headerEl.checked,
      strong: presetEl.value==='strong' || presetEl.value==='maximum'
    };
    const customApi = apiEl.value.trim();

    if(customApi){
      // try external API (user-provided). Expect POST { code } -> { code } or { result }
      const btn=$('#obGo'); btn.disabled=true; btn.textContent='Enviando...';
      try{
        const res = await fetch(customApi, {
          method:'POST',
          headers:{ 'Content-Type':'application/json' },
          body: JSON.stringify({ code: src, language:'lua', options: opts })
        });
        const txt = await res.text();
        let data; try{ data=JSON.parse(txt) }catch{ data={ code: txt } }
        apiWrap.style.display='block';
        apiOut.textContent = JSON.stringify(data,null,2);
        const out = data.code || data.result || data.obfuscated || data.data || txt;
        if(!res.ok){ toast('API erro: '+(data.message||res.status),'error'); return; }
        outEl.value = out;
        const a=src.length, b=out.length;
        statsEl.textContent = `${a} → ${b} chars`;
        outStats.textContent = `${out.split('\n').length} linhas • ${b} bytes`;
        container.dataset.output = out;
        toast('Ofuscado via API externa','success');
      }catch(e){
        toast('Falha API: '+e.message+' — usando modo local', 'warning');
        // fallback to local
        const { code } = obfuscateLua(src, opts);
        outEl.value = code;
        container.dataset.output = code;
        apiWrap.style.display='block';
        apiOut.textContent = 'Fallback local: '+e.message;
      }finally{
        btn.disabled=false; btn.textContent='Obfuscar';
      }
      return;
    }

    // local
    try{
      const t0 = performance.now();
      const { code } = obfuscateLua(src, opts);
      const t1 = performance.now();
      outEl.value = code;
      container.dataset.output = code;
      const a=src.length, b=code.length;
      statsEl.textContent = `${a} → ${b} chars • ${(t1-t0).toFixed(1)}ms`;
      outStats.textContent = `${code.split('\n').length} linhas • ${b} bytes • redução: ${a? Math.round((1-b/a)* -100):0}% (negativo = aumentou por encoding)`;
      apiWrap.style.display='none';
      toast('Ofuscado localmente','success');
    }catch(e){
      toast('Erro: '+e.message,'error');
    }
  }

  $('#obGo').addEventListener('click', doObf);
  $('#obCopy').addEventListener('click', ()=> copyText(inEl.value||''));
  $('#obCopyOut').addEventListener('click', ()=> copyText(outEl.value||''));
  $('#obClear').addEventListener('click', ()=>{ inEl.value=''; outEl.value=''; statsEl.textContent=''; outStats.textContent=''; apiWrap.style.display='none'; });
  $('#obDownload').addEventListener('click', ()=>{
    const blob = new Blob([outEl.value||''], {type:'text/plain'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download='obfuscated.lua'; a.click(); URL.revokeObjectURL(url);
  });
  container.addEventListener('keydown', e=>{ if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){ e.preventDefault(); doObf(); }});
  container._getOutput = ()=> outEl.value||'';
}

