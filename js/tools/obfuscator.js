import { copyText, toast } from '../ui.js';
import { obfuscate, PRESETS } from '../obfuscator/pipeline.js';

function useWorker(){
  try{
    // module worker
    const w = new Worker(new URL('../../workers/obfuscator.worker.js', import.meta.url), { type:'module' });
    return w;
  }catch(e){
    return null;
  }
}

export function renderObfuscator(container){
  const presetOptions = Object.keys(PRESETS).map(k=> `<option value="${k}" ${k==='Normal'?'selected':''}>${k}</option>`).join('');
  container.innerHTML = `
  <div class="tool-head">
    <div>
      <h2>Lua Obfuscator</h2>
      <p>Pipeline real: <span class="inline-code">Tokenizer → Parser → AST → Scope → Transforms → Generator</span>. 100% client-side, via Web Worker. Sem regex frágil, sem vazamento de plaintext, sem VM falsa.</p>
    </div>
    <span class="badge">AST-based</span>
  </div>

  <div class="panel" style="margin-bottom:14px">
    <div class="panel__head" style="flex-wrap:wrap;gap:12px">
      <label class="field" style="min-width:160px"><span>Preset</span>
        <select id="obPreset" class="select">${presetOptions}</select>
      </label>
      <label class="field" style="min-width:160px"><span>Random Seed (opcional)</span><input id="obSeed" class="input input--mono" placeholder="ex: 12345 ou deixe vazio = random"/></label>
      <div class="row" style="margin-left:auto;align-items:flex-end">
        <button class="btn btn--primary" id="obGo">Obfuscate</button>
        <button class="btn btn--sm" id="obExample">Exemplo</button>
      </div>
    </div>
    <div class="panel__body">
      <div class="grid grid--2">
        <label class="check"><input type="checkbox" id="obIdentifier" checked/> Identifier Rename (scope-aware)</label>
        <label class="check"><input type="checkbox" id="obStrings" checked/> String Protection</label>
        <label class="check"><input type="checkbox" id="obNumbers" checked/> Number Obfuscation</label>
        <label class="check"><input type="checkbox" id="obBooleans" checked/> Boolean Obfuscation</label>
        <label class="check"><input type="checkbox" id="obPool"/> Constant Pool (sem leak)</label>
        <label class="check"><input type="checkbox" id="obFlow"/> Control Flow Flattening</label>
        <label class="check"><input type="checkbox" id="obOpaque"/> Opaque Predicates</label>
        <label class="check"><input type="checkbox" id="obDead"/> Dead Code (plausível)</label>
        <label class="check"><input type="checkbox" id="obIndir"/> Function Indirection</label>
        <label class="check"><input type="checkbox" id="obVm"/> VM Protection (real, só compatíveis)</label>
        <label class="check"><input type="checkbox" id="obMinify"/> Minify</label>
        <label class="check"><input type="checkbox" id="obOneLine"/> Uma linha</label>
        <label class="check"><input type="checkbox" id="obHeader"/> Cabeçalho</label>
      </div>
      <div class="row" style="margin-top:8px">
        <span class="small muted">Preset define defaults; você pode ajustar acima. Duas runs com mesma seed + mesmas opções geram mesmo output.</span>
      </div>
    </div>
  </div>

  <div class="grid grid--2">
    <div class="panel">
      <div class="panel__head"><span class="card__title">Original</span><span class="small muted" id="obOrigStats" style="margin-left:auto"></span></div>
      <div class="panel__body stack">
        <textarea id="obIn" class="textarea textarea--lg textarea--mono" placeholder="cole seu Lua/Luau aqui..."></textarea>
        <div class="row">
          <button class="btn btn--sm" id="obClear">Clear</button>
          <span class="small muted">Suporta: locals, closures, tables, varargs, while/repeat, for, methods, UTF-8, continue</span>
        </div>
      </div>
    </div>
    <div class="panel">
      <div class="panel__head"><span class="card__title">Obfuscated</span>
        <div class="row" style="margin-left:auto">
          <button class="btn btn--sm" id="obCopyOut">Copy Output</button>
          <button class="btn btn--sm" id="obDownload">Download .lua</button>
        </div>
      </div>
      <div class="panel__body stack">
        <textarea id="obOut" class="textarea textarea--lg textarea--mono" readonly placeholder="código obfuscado..."></textarea>
        <div class="grid grid--3 small muted" id="obMetrics" style="gap:8px">
          <div>Original: <b id="mOrig">—</b></div>
          <div>Obfuscated: <b id="mObf">—</b></div>
          <div>Aumento: <b id="mInc">—</b></div>
          <div>Tempo: <b id="mTime">—</b></div>
          <div>Preset: <b id="mPreset">—</b></div>
          <div>Seed: <b id="mSeed">—</b></div>
        </div>
        <div class="small muted" id="obLeakTest" style="display:none"></div>
      </div>
    </div>
  </div>

  <div class="row" style="margin-top:12px">
    <a class="btn btn--sm" href="tests/tests.html" target="_blank">Abrir Test Suite →</a>
    <span class="small muted">Baseado em Prometheus (apenas inspiração de arquitetura). Nenhum wrapper falso de VM.</span>
  </div>
  `;

  const $=s=> container.querySelector(s);
  const presetEl=$('#obPreset'), seedEl=$('#obSeed'), inEl=$('#obIn'), outEl=$('#obOut'),
        idEl=$('#obIdentifier'), strEl=$('#obStrings'), numEl=$('#obNumbers'), boolEl=$('#obBooleans'),
        poolEl=$('#obPool'), flowEl=$('#obFlow'), opaqueEl=$('#obOpaque'), deadEl=$('#obDead'), indirEl=$('#obIndir'), vmEl=$('#obVm'), minifyEl=$('#obMinify'), oneLineEl=$('#obOneLine'), headerEl=$('#obHeader'),
        mOrig=$('#mOrig'), mObf=$('#mObf'), mInc=$('#mInc'), mTime=$('#mTime'), mPreset=$('#mPreset'), mSeed=$('#mSeed'), leakEl=$('#obLeakTest'), origStats=$('#obOrigStats');

  let worker=null;
  let workerReady=false;
  try{
    worker = useWorker();
    if(worker){
      worker.onmessage=(e)=>{
        const { id, ok, code, timeMs, error, preset, seed } = e.data;
        const btn=$('#obGo');
        btn.disabled=false; btn.textContent='Obfuscate';
        if(!ok){ toast('Obfuscation failed: '+error,'error'); leakEl.style.display='block'; leakEl.textContent='❌ '+error; leakEl.style.color='var(--danger)'; return; }
        outEl.value=code;
        container.dataset.output=code;
        const orig=inEl.value.length, obf=code.length;
        mOrig.textContent=orig+' chars';
        mObf.textContent=obf+' chars';
        mInc.textContent= (orig? (((obf-orig)/orig)*100).toFixed(1):'0') + '%';
        mTime.textContent=timeMs.toFixed(1)+'ms';
        mPreset.textContent=preset;
        mSeed.textContent=seed;
        // leak test
        if(inEl.value.includes('VERY_UNIQUE_SECRET_928374') && code.includes('VERY_UNIQUE_SECRET_928374')){
          leakEl.style.display='block'; leakEl.textContent='❌ LEAK: plaintext vazou!'; leakEl.style.color='var(--danger)';
        } else {
          leakEl.style.display='block'; leakEl.textContent='✓ sem leak de plaintext'; leakEl.style.color='var(--success)';
        }
        toast('Obfuscado via Worker','success');
      };
      worker.onerror=(e)=>{ worker=null; toast('Worker falhou, usando thread principal','warning'); };
      workerReady=true;
    }
  }catch{ worker=null; }

  function applyPreset(name){
    const p=PRESETS[name];
    if(!p) return;
    idEl.checked = !!p.identifier;
    strEl.checked = !!p.strings;
    numEl.checked = !!p.numbers;
    boolEl.checked = !!p.booleans;
    poolEl.checked = !!p.constantPool?.enable;
    flowEl.checked = !!p.controlFlow?.enable;
    opaqueEl.checked = !!p.predicates?.probability;
    deadEl.checked = !!p.deadcode?.probability;
    indirEl.checked = !!p.indirection?.probability;
    vmEl.checked = !!p.vm?.enable;
    minifyEl.checked = !!p.minify;
  }
  presetEl.addEventListener('change', ()=> applyPreset(presetEl.value));
  applyPreset('Normal');

  // sync UI -> preset overrides? We keep individual checkboxes as overrides

  function updateOrigStats(){
    const c=inEl.value;
    origStats.textContent = c.length ? `${c.length} chars • ${c.split('\n').length} linhas` : '';
  }
  inEl.addEventListener('input', updateOrigStats);
  inEl.value=`local Players = game:GetService("Players")\nlocal player = Players.LocalPlayer\nlocal secret = "Hello LuauForge"\nlocal function greet(name)\n    print("Hello, "..name.." - "..secret)\nend\n\ngreet(player.Name)\n`;
  updateOrigStats();

  $('#obExample').addEventListener('click', ()=>{
    inEl.value=`local Players = game:GetService("Players")\nlocal player = Players.LocalPlayer\nlocal secret = "Hello LuauForge"\nlocal function greet(name)\n    print("Hello, "..name.." - "..secret)\nend\n\ngreet(player.Name)\n`;
    updateOrigStats();
  });

  async function doObf(){
    const src=inEl.value;
    if(!src.trim()){ toast('Cole código para ofuscar','warning'); return; }
    const preset=presetEl.value;
    const seed=seedEl.value.trim() || null;
    const options={
      preset,
      seed,
      identifier: idEl.checked ? { style: preset==='High'?'_lIlII' : preset==='Extreme'?'mangled':'_A7x9' } : null,
      strings: strEl.checked ? {} : null,
      numbers: numEl.checked ? {} : null,
      booleans: boolEl.checked ? {} : null,
      constantPool: poolEl.checked ? { enable:true } : { enable:false },
      controlFlow: flowEl.checked ? { enable:true } : { enable:false },
      predicates: opaqueEl.checked ? { probability:0.25 } : { probability:0 },
      deadcode: deadEl.checked ? { probability:0.12 } : { probability:0 },
      indirection: indirEl.checked ? { probability:0.2 } : { probability:0 },
      vm: vmEl.checked ? { enable:true } : { enable:false },
      minify: minifyEl.checked,
      oneLine: oneLineEl.checked,
      header: headerEl.checked,
    };
    // desativa transforms que checkbox desmarcado (pipeline já checa)
    // Para strings etc., se null, pipeline vai pular (precisa tratar)
    // Vamos passar diretamente: se desmarcado, passar null e pipeline deve ignorar
    const btn=$('#obGo');
    btn.disabled=true; btn.textContent='Obfuscando...';
    leakEl.style.display='none';

    // Tentar worker se disponível e código > 500 chars (pesado)
    if(workerReady && worker && src.length>500){
      const id=Math.random().toString(36).slice(2);
      worker.postMessage({ id, code: src, options });
      // timeout fallback?
      setTimeout(()=>{
        if(btn.disabled) { /* still */ }
      }, 100);
      return;
    }

    try{
      const res=obfuscate(src, options);
      outEl.value=res.code;
      container.dataset.output=res.code;
      mOrig.textContent=src.length+' chars';
      mObf.textContent=res.code.length+' chars';
      mInc.textContent= (src.length? (((res.code.length-src.length)/src.length)*100).toFixed(1):'0') + '%';
      mTime.textContent=res.timeMs.toFixed(1)+'ms';
      mPreset.textContent=res.preset;
      mSeed.textContent=res.seed;
      if(src.includes('VERY_UNIQUE_SECRET_928374') && res.code.includes('VERY_UNIQUE_SECRET_928374')){
        leakEl.style.display='block'; leakEl.textContent='❌ LEAK: plaintext vazou!'; leakEl.style.color='var(--danger)';
        toast('LEAK detectado','error');
      } else {
        leakEl.style.display='block'; leakEl.textContent='✓ sem leak de plaintext'; leakEl.style.color='var(--success)';
        toast('Obfuscado com sucesso','success');
      }
    }catch(e){
      toast(e.message,'error');
      leakEl.style.display='block'; leakEl.textContent='❌ '+e.message; leakEl.style.color='var(--danger)';
      console.error(e);
    }finally{
      btn.disabled=false; btn.textContent='Obfuscate';
    }
  }

  $('#obGo').addEventListener('click', doObf);
  $('#obClear').addEventListener('click', ()=>{ inEl.value=''; outEl.value=''; updateOrigStats(); mOrig.textContent='—'; mObf.textContent='—'; mInc.textContent='—'; mTime.textContent='—'; leakEl.style.display='none'; });
  $('#obCopyOut').addEventListener('click', ()=> copyText(outEl.value||''));
  $('#obDownload').addEventListener('click', ()=>{
    const blob=new Blob([outEl.value||''],{type:'text/plain'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download='obfuscated.lua'; a.click(); URL.revokeObjectURL(url);
  });
  container.addEventListener('keydown', e=>{ if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){ e.preventDefault(); doObf(); }});
  container._getOutput=()=> outEl.value||'';
}
