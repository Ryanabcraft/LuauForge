import { copyText, toast } from '../ui.js';

function minifyLua(src, opts){
  let s=src;
  // preserve strings by placeholder
  const placeholders=[];
  function store(str){ const k=`__STR${placeholders.length}__`; placeholders.push(str); return k; }
  // capture long strings [[ ]]
  s=s.replace(/\[\[[\s\S]*?\]\]/g, m=> store(m));
  s=s.replace(/"([^"\\]|\\.)*"/g, m=> store(m));
  s=s.replace(/'([^'\\]|\\.)*'/g, m=> store(m));
  // also preserve long comments --[[ ]]
  // remove block comments --[[ ]]
  s=s.replace(/--\[\[[\s\S]*?\]\]/g, '');
  if(opts.removeComments){
    s=s.replace(/--.*$/gm, '');
  }
  if(opts.removeEmptyLines){
    s=s.replace(/^\s*$/gm,'');
  }
  if(opts.compact){
    s=s.replace(/\s+/g,' ');
    s=s.replace(/\s*([=+\-*/%<>&|~^,;:{}()\[\]])\s*/g,'$1');
    // fix collapsed keywords needing space: endelse, thenelse etc.
    s=s.replace(/endelse/g,'end else').replace(/else(if)/g,'else $1');
    s=s.replace(/\b(and|or|not|then|else|elseif|do|end|function|local|return|if|for|while|repeat|until|in)\b/g, (m)=> m);
    // ensure keyword boundaries: insert space between keyword and identifier if glued by symbol removal
    s=s.replace(/([a-zA-Z0-9_])(local|function|if|then|else|elseif|end|do|while|for|return)([^a-zA-Z0-9_])/g,'$1 $2$3');
  } else {
    // just trim lines
    s=s.split('\n').map(l=>l.trim()).join('\n');
  }
  s=s.trim();
  // restore strings
  placeholders.forEach((orig,i)=>{
    const k=`__STR${i}__`;
    s=s.split(k).join(orig);
  });
  // final: if remove empty lines, collapse multiple newlines
  if(opts.removeEmptyLines) s=s.replace(/\n{2,}/g,'\n');
  return s;
}

export function renderMinifier(container){
  container.innerHTML=`
  <div class="tool-head"><div><h2>Minifier</h2><p>Comprima Lua/Luau removendo comentários e espaços com métricas de redução.</p></div><span class="badge">Client-side</span></div>
  <div class="panel">
    <div class="panel__head">
      <div class="row">
        <label class="check"><input type="checkbox" id="mnComments" checked/> remover comentários</label>
        <label class="check"><input type="checkbox" id="mnSpaces" checked/> remover espaços extras</label>
        <label class="check"><input type="checkbox" id="mnEmpty" checked/> remover linhas vazias</label>
        <label class="check"><input type="checkbox" id="mnCompact" checked/> compactar (agressivo)</label>
      </div>
      <div class="row" style="margin-left:auto">
        <button class="btn btn--primary" id="mnDo">Minify</button>
        <button class="btn btn--sm" id="mnCopy">Copy</button>
        <button class="btn btn--sm" id="mnClear">Clear</button>
      </div>
    </div>
    <div class="panel__body grid grid--2">
      <div class="stack">
        <label class="field"><span style="font:600 11px var(--font-sans);letter-spacing:.08em;text-transform:uppercase;color:var(--text2)">Input</span>
          <textarea id="mnIn" class="textarea textarea--lg textarea--mono" placeholder="cole o código..."></textarea>
        </label>
        <div class="row small muted" id="mnInStats"></div>
      </div>
      <div class="stack">
        <label class="field"><span style="font:600 11px var(--font-sans);letter-spacing:.08em;text-transform:uppercase;color:var(--text2)">Output</span>
          <textarea id="mnOut" class="textarea textarea--lg textarea--mono" readonly></textarea>
        </label>
        <div class="row small muted" id="mnOutStats"></div>
        <div class="pill" id="mnReduction" style="display:none"></div>
      </div>
    </div>
  </div>`;
  const $=s=>container.querySelector(s);
  const inEl=$('#mnIn'), outEl=$('#mnOut'), inStats=$('#mnInStats'), outStats=$('#mnOutStats'), redEl=$('#mnReduction');
  function doMin(){
    const src=inEl.value;
    if(!src.trim()){ toast('Cole código para minificar','warning'); return; }
    const opts={ removeComments: $('#mnComments').checked, removeEmptyLines: $('#mnEmpty').checked, compact: $('#mnCompact').checked };
    // spaces option is part of compact; if unchecked, disable compact spacing
    let res=minifyLua(src, opts);
    if(!$('#mnSpaces').checked){
      // undo aggressive spacing: reintroduce single spaces around operators lightly
      res=res.replace(/([^\s])([=+\-*/%<>&|~^,;:{}()])/g,'$1 $2').replace(/([=+\-*/%<>&|~^,;:{}()])([^\s])/g,'$1 $2');
    }
    outEl.value=res;
    const a=src.length, b=res.length;
    const pct = a? Math.round((1-b/a)*100):0;
    inStats.textContent=`Original: ${a} chars • ${src.split('\n').length} lines`;
    outStats.textContent=`Minified: ${b} chars • ${res.split('\n').length} lines`;
    redEl.style.display='flex';
    redEl.innerHTML=`<span><b>${pct}%</b> reduction — saved ${a-b} chars</span><span class="badge ${pct>30?'badge--ok':''}" style="margin-left:auto">${b} bytes</span>`;
    container.dataset.output=res;
    toast('Minified','success');
  }
  $('#mnDo').addEventListener('click', doMin);
  $('#mnCopy').addEventListener('click', ()=> copyText(outEl.value||''));
  $('#mnClear').addEventListener('click', ()=>{ inEl.value=''; outEl.value=''; inStats.textContent=''; outStats.textContent=''; redEl.style.display='none'; });
  container._getOutput=()=> outEl.value||'';
  inEl.value=`-- example\nlocal Players = game:GetService("Players")\nlocal player = Players.LocalPlayer  -- get player\n\nlocal function greet(name)\n    print("Hello, " .. name)\nend\n\ngreet(player.Name)\n`;
  container.addEventListener('keydown', e=>{ if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){ e.preventDefault(); doMin(); }});
}
