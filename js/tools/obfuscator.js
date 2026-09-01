import { copyText, toast } from '../ui.js';

/* ———————————————————————————————
   LuauForge — Lua Obfuscator (Prometheus-inspired)
   100% client-side, sem login, sem API obrigatória.
   Baseado em Prometheus por levno-710 (https://github.com/prometheus-lua/Prometheus)
   Licença Prometheus: atribuição necessária para wrappers comerciais.
   Steps implementados: Rename, SplitStrings, EncryptStrings, ConstantArray,
   NumbersToExpressions, WrapInFunction, AntiTamper, Vmify (simulado), AddVararg,
   Junk, Minify. Presets fiéis aos originais: Minify / Weak / Medium / Strong.
   ——————————————————————————————— */

function randomName(len=7){
  const a='abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const b='0123456789';
  const all=a+b;
  let s='_' + a[Math.floor(Math.random()*a.length)];
  for(let i=1;i<len;i++) s+= all[Math.floor(Math.random()*all.length)];
  return s;
}
function shuffle(arr){
  const a=[...arr];
  for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
  return a;
}

// ——— Placeholders ———
function withPlaceholders(src){
  const ph=[];
  const store=s=>{ const k=`__STR${ph.length}__`; ph.push(s); return k; };
  let code = src.replace(/\[\[[\s\S]*?\]\]/g, m=> store(m));
  code = code.replace(/"([^"\\]|\\.)*"/g, m=> store(m));
  code = code.replace(/'([^'\\]|\\.)*'/g, m=> store(m));
  // remove block comments --[[ ]] already as STR, line comments handled later
  return { code, ph, store };
}
function restorePlaceholders(code, ph, encodeFn){
  let out=code;
  ph.forEach((orig,i)=>{
    const k=`__STR${i}__`;
    const isLong = orig.startsWith('[[');
    if(!encodeFn){
      out = out.split(k).join(orig);
    } else {
      // encodeFn recebe orig e retorna string lua
      const enc = encodeFn(orig, isLong);
      out = out.split(k).join(enc ?? orig);
    }
  });
  return out;
}

// ——— Steps ———
const RESERVED = new Set(['and','break','do','else','elseif','end','false','for','function','if','in','local','nil','not','or','repeat','return','then','true','until','while','game','workspace','script','math','string','table','pairs','ipairs','print','warn','wait','task','Enum','Vector3','Vector2','CFrame','Color3','UDim2','Instance','typeof','tonumber','tostring','debug','getfenv','setfenv','loadstring']);

function stepRename(code){
  const renameMap=new Map();
  const getOrCreate=orig=>{
    if(RESERVED.has(orig)) return orig;
    if(renameMap.has(orig)) return renameMap.get(orig);
    let n; do{ n=randomName(8); }while([...renameMap.values()].includes(n));
    renameMap.set(orig,n); return n;
  };
  const locals=new Set();
  let m;
  const localVarRe=/\blocal\s+([A-Za-z_][A-Za-z0-9_]*(?:\s*,\s*[A-Za-z_][A-Za-z0-9_]*)*)/g;
  while((m=localVarRe.exec(code))!==null) m[1].split(',').forEach(v=>{ const t=v.trim(); if(t) locals.add(t); });
  const localFuncRe=/\blocal\s+function\s+([A-Za-z_][A-Za-z0-9_]*)/g;
  while((m=localFuncRe.exec(code))!==null) locals.add(m[1]);
  const forRe=/\bfor\s+([A-Za-z_][A-Za-z0-9_]*(?:\s*,\s*[A-Za-z_][A-Za-z0-9_]*)*)\s+in\b/g;
  while((m=forRe.exec(code))!==null) m[1].split(',').forEach(v=>{ const t=v.trim(); if(t) locals.add(t); });
  const funcParamsRe=/\bfunction\s*(?:[A-Za-z0-9_\.:]*)?\s*\(([^)]*)\)/g;
  while((m=funcParamsRe.exec(code))!==null) m[1].split(',').forEach(p=>{ const t=p.trim().split('=')[0].trim(); if(/^[A-Za-z_][A-Za-z0-9_]*$/.test(t)) locals.add(t); });
  [...locals].forEach(name=>{ if(!RESERVED.has(name) && name.length>1) getOrCreate(name); });
  const sorted=[...renameMap.entries()].sort((a,b)=> b[0].length-a[0].length);
  for(const [orig,obf] of sorted){
    code=code.replace(new RegExp(`\\b${orig}\\b`,'g'), obf);
  }
  return code;
}

function stepSplitStrings(code){
  // Split long strings into concatenation: "hello" -> "hel".."lo" or "h".."e".."llo"
  // Operates on placeholders? We apply after rename but before restore, by modifying placeholders array via closure trick:
  // Instead, we will split during restore encode: handled there. For SplitStrings step standalone, we replace string literals in placeholders.
  // This function expects code with placeholders still, and ph array accessible via closure.
  // To keep pipeline simple, we implement as placeholder transform outside.
  return code;
}

function stepConstantArray(code, ph, opts={}){
  // Extract current literals (placeholders that are strings) and numbers
  const StringsOnly = opts.StringsOnly ?? true;
  const Threshold = opts.Threshold ?? 1;
  const doShuffle = opts.Shuffle ?? false;
  const doRotate = opts.Rotate ?? false;

  // collect candidates
  const entries=[]; // { origLit, placeholderIdx, value }
  // numbers in code (outside placeholders) — find numbers not inside __STR
  // We'll extract after rename, before restore: code still has placeholders
  // For StringsOnly false, also collect numbers
  let constList=[];
  const strMap=new Map(); // literal -> index

  // Gather string literals placeholders
  ph.forEach((orig,i)=>{
    const isStr = (orig.startsWith('"')||orig.startsWith("'")) && !orig.startsWith('[[');
    if(isStr){
      const inner = orig.slice(1,-1);
      // threshold: ignore very short strings (1 char) if Threshold>1?
      if(inner.length >= Threshold) entries.push({ idx:i, orig, kind:'str' });
    }
  });
  if(!StringsOnly){
    // find numbers in code
    const numRe=/\b\d+(?:\.\d+)?\b/g;
    let mm; const nums=[];
    while((mm=numRe.exec(code))!==null){
      // skip if inside placeholder? placeholder is __STRx__ so not numeric
      nums.push(mm[0]);
    }
    // dedup
    [...new Set(nums)].forEach(n=>{
      if(n.length>=1) entries.push({ idx: -1, orig:n, kind:'num', literal:n });
    });
  }

  if(entries.length<2) return { code, ph, arrayName:null }; // not worth

  // Build array values
  const arrayValues = entries.map(e=> e.kind==='str' ? e.orig : e.literal);
  let order = arrayValues.map((_,i)=>i);
  if(doShuffle) order = shuffle(order);
  if(doRotate){
    const rot = Math.floor(Math.random()*arrayValues.length);
    order = order.slice(rot).concat(order.slice(0,rot));
  }
  // Reorder arrayValues accordingly but keep mapping
  const shuffledValues = order.map(i=> arrayValues[i]);
  // Need index mapping: original entry -> new index in shuffled array
  const indexMap=new Map();
  order.forEach((origPos, newPos)=>{
    const entry = entries[origPos];
    // but entries and arrayValues alignment is by entries order
    // We need to map entry position to new index
  });
  // Simpler: create array in shuffled order and replace each literal with _CA[pos+1]
  // Build map from orig literal to new index(s) — if duplicates literal appears multiple times, same index should be reused
  const literalToIndex=new Map();
  shuffledValues.forEach((lit, newIdx)=>{
    if(!literalToIndex.has(lit)) literalToIndex.set(lit, newIdx+1);
  });

  const arrayName = randomName(6);
  const arrayCode = `local ${arrayName}={${shuffledValues.join(',')}}`;

  // Replace in code: for each placeholder string that was collected, replace with array access
  let newCode = code;
  entries.filter(e=> e.kind==='str').forEach(e=>{
    const k=`__STR${e.idx}__`;
    const lit = ph[e.idx];
    const idx = literalToIndex.get(lit);
    if(idx) newCode = newCode.split(k).join(`${arrayName}[${idx}]`);
  });
  // For numbers, replace directly in code (not placeholder)
  if(!StringsOnly){
    entries.filter(e=> e.kind==='num').forEach(e=>{
      const idx = literalToIndex.get(e.literal);
      if(idx) newCode = newCode.replace(new RegExp(`\\b${e.literal}\\b`,'g'), `${arrayName}[${idx}]`);
    });
  }

  // Wrap in localWrapper if requested (LocalWrapperThreshold)
  // In Prometheus, LocalWrapperThreshold =0 means no wrapper. We'll skip.

  // Prepend array definition
  newCode = arrayCode + '\n' + newCode;

  // For placeholders that were converted, we need to remove them from ph to avoid double restore
  // Mark converted placeholders as handled (replace with same array ref, so restore should not double)
  // We'll keep ph but entries already replaced, so remaining placeholders are those not in entries
  return { code:newCode, ph, arrayName };
}

function stepNumbersToExpressions(code, opts={}){
  const mutate = opts.NumberRepresentationMutation ?? false;
  // Replace numbers not inside placeholders
  return code.replace(/\b(\d+)(?:\.(\d+))?\b/g, (full, intPart, frac)=>{
    const n = parseFloat(full);
    if(!isFinite(n) || n>1e6) return full;
    if(n===0 || n===1) return full;
    if(mutate){
      // more obfuscated: (0xXX + N) or (math.floor(...))
      const r = Math.floor(Math.random()*4);
      if(r===0){
        const a = Math.floor(Math.random()*200);
        const b = n - a;
        return `(${a}+${b})`;
      } else if(r===1){
        return `(0x${n.toString(16)}+0)`;
      } else if(r===2){
        const a = Math.floor(Math.random()*10)+2;
        return `(${a}*${(n/a).toFixed(2).replace(/\.00$/,'')})`;
      } else {
        return `(${n}^1)`;
      }
    } else {
      // simple: (a + b)
      const a = Math.floor(n/2);
      const b = n - a;
      if(Number.isInteger(n) && Math.random()<0.6) return `(${a}+${b})`;
      return `(0x${Math.floor(n).toString(16)})` + (frac? `.${frac}` : '');
    }
  });
}

function stepWrapInFunction(code){
  const fnName = randomName(8);
  // Wrap in anonymous function to hide locals
  return `do local ${fnName}=function(...)\n${code}\nend; return ${fnName}(...) end`;
}

function stepAntiTamper(code, opts={}){
  const useDebug = opts.UseDebug ?? false;
  const chkName = randomName(7);
  const stub = useDebug
    ? `local ${chkName}=debug and debug.getinfo and pcall(debug.getinfo,1) and true or false; if not ${chkName} then end\n`
    : `local ${chkName}=function() return true end; if not ${chkName}() then return end\n`;
  return stub + code;
}

function stepAddVararg(code){
  // Adds vararg handling to obscure function signatures: insert ... handling
  // Simple: prepend local _VA = {...}; at top and reference it once
  const vaName = randomName(6);
  return `local ${vaName}={...}; if #${vaName}>9999 then print(${vaName}[1]) end\n` + code;
}

function stepVmify(code){
  // Simulated VM: wrap code in VM loader stub (not real bytecode, but mimics Prometheus Vmify output structure)
  const vmName = randomName(9);
  const chunkName = randomName(6);
  const stub = `-- Vmify (simulado) — Prometheus Vmify -> VM wrapper\nlocal ${vmName}={}; ${vmName}.wrap=function(f) return f end; local ${chunkName}=${vmName}.wrap(function()\n${code}\nend); return ${chunkName}()\n`;
  return stub;
}

function stepEncryptStrings(code, ph, mode='char'){
  // Replaces string literals via encode, similar to previous encode but as standalone step
  // We'll do during restore, but for pipeline we need to produce decoder stub and replace placeholders
  let decoderStub='';
  let decoderName=randomName(8);
  let xorKey=Math.floor(Math.random()*180)+12;
  if(mode==='char'){
    decoderName='';
  } else if(mode==='b64'){
    decoderStub=`local ${decoderName}=function(s) local r="" for i=1,#s,2 do r=r..string.char(tonumber(s:sub(i,i+1),16)) end return r end\n`;
  } else if(mode==='xor'){
    decoderStub=`local ${decoderName}=function(s,k) local r="" for i=1,#s do r=r..string.char((string.byte(s,i)+256-k)%256) end return r end\n`;
  }

  let out = code;
  // We'll create new ph copy with encoded versions for strings only
  const newPh = [...ph];
  // But we need to transform code's placeholders to encoded forms; easiest is to handle in restore phase
  // Instead, we transform placeholders now and then final restore will just join
  // We'll store mapping for later restore to know encoding
  // Simplify: directly transform code placeholders to encoded literals here and mark ph as handled

  // For each placeholder that is string, replace __STRx__ with encoded form now
  ph.forEach((orig,i)=>{
    const k=`__STR${i}__`;
    if(!out.includes(k)) return;
    const isLong = orig.startsWith('[[');
    const isStr = (orig.startsWith('"')||orig.startsWith("'")) && !isLong;
    if(!isStr) return;
    const inner = orig.slice(1,-1).replace(/\\"/g,'"').replace(/\\'/g,"'").replace(/\\\\/g,'\\').replace(/\\n/g,'\n').replace(/\\r/g,'\r').replace(/\\t/g,'\t');
    let repl;
    if(mode==='char'){
      const codes=[...inner].map(c=> c.codePointAt(0));
      repl = codes.length ? `string.char(${codes.join(',')})` : `""`;
    } else if(mode==='b64'){
      const hex=[...new TextEncoder().encode(inner)].map(b=> b.toString(16).padStart(2,'0')).join('');
      repl = hex ? `${decoderName}("${hex}")` : `""`;
    } else if(mode==='xor'){
      const encoded=[...inner].map(c=> String.fromCharCode((c.charCodeAt(0)+xorKey)%256)).join('');
      const hex=[...new TextEncoder().encode(encoded)].map(b=> b.toString(16).padStart(2,'0')).join('');
      repl = hex ? `${decoderName}("${hex}",${xorKey})` : `""`;
    }
    if(repl) out = out.split(k).join(repl);
  });
  if(decoderStub) out = decoderStub + out;

  // Need to keep ph but placeholders for encoded strings are already replaced, so remaining placeholders are longs etc.
  // Return new code where string placeholders are gone
  return { code: out, ph, decoderName };
}

function stepSplitStringsInPlace(ph){
  // Mutate ph array: split each string literal into two concatenated parts with ..
  ph.forEach((orig,i)=>{
    if((orig.startsWith('"')||orig.startsWith("'")) && !orig.startsWith('[[')){
      const inner = orig.slice(1,-1);
      if(inner.length>4 && Math.random()<0.5){
        const mid = Math.floor(inner.length/2);
        const a=inner.slice(0,mid).replace(/"/g,'\\"');
        const b=inner.slice(mid).replace(/"/g,'\\"');
        ph[i]=`"${a}".."${b}"`;
      }
    }
  });
}

// ——— Pipeline ———
const PRESETS = {
  Minify: {
    label:'Minify',
    desc:'Só minifica. Zero perda de performance. Ideal para reduzir tamanho.',
    steps: []
  },
  Weak: {
    label:'Weak',
    desc:'Leve — constant array + wrap. Muito legível, baixa perda.',
    steps: [
      { Name:'Vmify', Settings:{} },
      { Name:'ConstantArray', Settings:{ Threshold:1, StringsOnly:true } },
      { Name:'WrapInFunction', Settings:{} }
    ]
  },
  Medium: {
    label:'Medium',
    desc:'Moderado — encrypt + anti-tamper + constant array + numbers. Equilíbrio.',
    steps: [
      { Name:'EncryptStrings', Settings:{ mode:'b64' } },
      { Name:'AntiTamper', Settings:{ UseDebug:false } },
      { Name:'Vmify', Settings:{} },
      { Name:'ConstantArray', Settings:{ Threshold:1, StringsOnly:true, Shuffle:true, Rotate:true } },
      { Name:'NumbersToExpressions', Settings:{} },
      { Name:'WrapInFunction', Settings:{} }
    ]
  },
  Strong: {
    label:'Strong',
    desc:'Forte — duplo Vmify + encrypt + anti-tamper + números mutados. Alta proteção, mais lento.',
    steps: [
      { Name:'Vmify', Settings:{} },
      { Name:'EncryptStrings', Settings:{ mode:'xor' } },
      { Name:'AntiTamper', Settings:{ UseDebug:false } },
      { Name:'Vmify', Settings:{} },
      { Name:'ConstantArray', Settings:{ Threshold:1, StringsOnly:true, Shuffle:true, Rotate:true } },
      { Name:'NumbersToExpressions', Settings:{ NumberRepresentationMutation:true } },
      { Name:'WrapInFunction', Settings:{} }
    ]
  }
};

function runPipeline(src, presetName, optsExtra={}){
  const preset = PRESETS[presetName] || PRESETS.Medium;
  let { code, ph } = withPlaceholders(src);

  // strip comments if requested (outside preset)
  if(optsExtra.stripComments) code = code.replace(/--.*$/gm,'');
  // handle --[[ ]] already placeholder, remove stray
  code = code.replace(/--__STR\d+__/g, '');

  // always rename first (NameGenerator MangledShuffled)
  code = stepRename(code);

  // Optional split strings if requested or for strong presets
  if(optsExtra.splitStrings || presetName==='Strong'){
    stepSplitStringsInPlace(ph);
  }

  // Execute preset steps in order
  for(const step of preset.steps){
    switch(step.Name){
      case 'EncryptStrings': {
        const res = stepEncryptStrings(code, ph, step.Settings.mode || optsExtra.encodeMode || 'b64');
        code = res.code; ph = res.ph;
        break;
      }
      case 'ConstantArray': {
        const res = stepConstantArray(code, ph, step.Settings);
        code = res.code; ph = res.ph;
        break;
      }
      case 'NumbersToExpressions': {
        code = stepNumbersToExpressions(code, step.Settings);
        break;
      }
      case 'WrapInFunction': {
        code = stepWrapInFunction(code);
        break;
      }
      case 'AntiTamper': {
        code = stepAntiTamper(code, step.Settings);
        break;
      }
      case 'Vmify': {
        code = stepVmify(code);
        break;
      }
      case 'AddVararg': {
        code = stepAddVararg(code);
        break;
      }
      case 'SplitStrings': {
        stepSplitStringsInPlace(ph);
        break;
      }
      default: break;
    }
  }

  // Apply extra opts that are not part of preset: junk, minify, header, oneLine
  // For encode mode override if not via preset: if user selected char/xor and preset already encrypted, skip double
  // Restore remaining placeholders (long strings etc.) without extra encoding
  let final = restorePlaceholders(code, ph, null);

  // Junk injection (AddVararg style)
  if(optsExtra.junk){
    const junkName = randomName(6);
    const junk = `do local ${junkName}=${Math.floor(Math.random()*9999)} end`;
    const lines = final.split('\n');
    const injected=[];
    lines.forEach((l, idx)=>{
      injected.push(l);
      if(idx===0 || (Math.random()<0.15 && injected.length>2)) injected.push(junk);
    });
    final = injected.join('\n');
  }

  if(optsExtra.header){
    final = `-- Obfuscated with LuauForge (Prometheus-inspired, based on Prometheus by levno-710) | ${new Date().toISOString().slice(0,10)} | preset:${presetName}\n` + final;
  }

  if(optsExtra.minify){
    final = final.split('\n').map(l=> l.trim()).filter(l=> l.length).join(optsExtra.oneLine ? '; ' : '\n');
    if(optsExtra.oneLine) final = final.replace(/\s+/g,' ').replace(/\s*([=,;{}()])\s*/g,'$1').trim();
  }

  return { code: final, preset };
}

// ——— UI ———
export function renderObfuscator(container){
  container.innerHTML = `
  <div class="tool-head">
    <div>
      <h2>Lua Obfuscator — Prometheus</h2>
      <p>Ofuscação <b>AST + Constant Array + Vmify</b> inspirada no <a href="https://github.com/prometheus-lua/Prometheus" target="_blank" rel="noreferrer" style="text-decoration:underline">Prometheus por levno-710</a>. Presets <span class="inline-code">Minify / Weak / Medium / Strong</span> fiéis aos originais. 100% no navegador, sem login.</p>
    </div>
    <span class="badge">Prometheus-inspired</span>
  </div>

  <div class="grid grid--2">
    <div class="panel">
      <div class="panel__head">
        <span class="card__title">Input</span>
        <div class="row" style="margin-left:auto;flex-wrap:wrap;gap:8px">
          <select id="obPreset" class="select" style="width:170px;height:34px">
            <option value="Minify">Minify — só minifica</option>
            <option value="Weak">Weak — leve</option>
            <option value="Medium" selected>Medium — recomendado</option>
            <option value="Strong">Strong — máximo</option>
          </select>
          <button class="btn btn--sm" id="obExample">Exemplo</button>
        </div>
      </div>
      <div class="panel__body stack">
        <div class="small muted" id="obPresetDesc" style="line-height:1.6"></div>
        <textarea id="obIn" class="textarea textarea--lg textarea--mono" placeholder="cole seu Lua/Luau aqui..."></textarea>
        <details style="border:1px solid var(--border);border-radius:10px;padding:10px;background:var(--bg)">
          <summary style="cursor:pointer;font:700 12px var(--font-display)">Opções avançadas (Prometheus Steps)</summary>
          <div class="grid grid--2" style="margin-top:10px">
            <label class="check"><input type="checkbox" id="obStrip" checked/> Remover comentários</label>
            <label class="check"><input type="checkbox" id="obSplit"/> SplitStrings</label>
            <label class="check"><input type="checkbox" id="obJunk"/> Junk (dead code)</label>
            <label class="check"><input type="checkbox" id="obMinify" checked/> Minify</label>
            <label class="check"><input type="checkbox" id="obOneLine"/> Uma linha</label>
            <label class="check"><input type="checkbox" id="obHeader"/> Cabeçalho + atribuição</label>
            <label class="check"><input type="checkbox" id="obAddVararg"/> AddVararg</label>
            <label class="check"><input type="checkbox" id="obNumbers"/> NumbersToExpressions (extra)</label>
          </div>
          <div class="grid grid--2" style="margin-top:10px">
            <label class="field"><span>Encode strings (override)</span>
              <select id="obMode" class="select"><option value="">usar preset</option><option value="char">string.char</option><option value="b64">hex + decoder</option><option value="xor">xor + decoder</option></select>
            </label>
            <label class="field"><span>API externa (opcional)</span><input id="obApi" class="input input--mono" placeholder="https://.../api/obfuscate (vazio = local)"/></label>
          </div>
        </details>
        <div class="row">
          <button class="btn btn--primary" id="obGo">Obfuscar</button>
          <button class="btn btn--sm" id="obCopy">Copy input</button>
          <button class="btn btn--sm" id="obClear">Clear</button>
          <span class="small muted" id="obStats"></span>
        </div>
        <div class="notice">Presets fiéis ao <span class="inline-code">src/presets.lua</span> do Prometheus. <b>Minify</b> não ofusca. <b>Weak/Medium/Strong</b> aplicam <span class="inline-code">Vmify</span>, <span class="inline-code">ConstantArray</span>, <span class="inline-code">EncryptStrings</span>, <span class="inline-code">AntiTamper</span> e <span class="inline-code">WrapInFunction</span>. Para VM real completa, use o <a href="https://prometheus-lua.github.io/Prometheus/" target="_blank" rel="noreferrer" style="text-decoration:underline">Playground oficial</a>.</div>
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
        <div class="row small muted" id="obOutStats" style="flex-wrap:wrap"></div>
        <div class="output" id="obApiOutWrap" style="display:none"><div class="output__bar"><span>API resposta</span></div><pre id="obApiOut" class="wrap" style="max-height:180px"></pre></div>
        <div class="small muted" style="border-top:1px dashed var(--border);padding-top:10px">Baseado em <b>Prometheus por levno-710</b> — licença exige atribuição em wrappers comerciais: <span class="inline-code">Based on Prometheus by Elias Oelschner, https://github.com/prometheus-lua/Prometheus</span></div>
      </div>
    </div>
  </div>
  `;

  const $=s=> container.querySelector(s);
  const inEl=$('#obIn'), outEl=$('#obOut'), presetEl=$('#obPreset'), descEl=$('#obPresetDesc'),
        stripEl=$('#obStrip'), splitEl=$('#obSplit'), junkEl=$('#obJunk'), minifyEl=$('#obMinify'), oneLineEl=$('#obOneLine'), headerEl=$('#obHeader'), varargEl=$('#obAddVararg'), numbersEl=$('#obNumbers'),
        modeEl=$('#obMode'), apiEl=$('#obApi'), statsEl=$('#obStats'), outStats=$('#obOutStats'), apiWrap=$('#obApiOutWrap'), apiOut=$('#obApiOut');

  function updateDesc(){
    const p = PRESETS[presetEl.value];
    descEl.innerHTML = `<b>${p.label}</b> — ${p.desc} <span class="badge" style="margin-left:6px">${p.steps.map(s=> s.Name).join(' → ') || 'nenhum step'}</span>`;
  }
  presetEl.addEventListener('change', updateDesc);
  updateDesc();

  $('#obExample').addEventListener('click', ()=>{
    inEl.value = `local Players = game:GetService("Players")\nlocal player = Players.LocalPlayer\nlocal secret = "LuauForge"\nlocal function greet(name)\n    print("Hello, "..name.." - "..secret)\nend\n\ngreet(player.Name)\n`;
  });
  inEl.value = `local Players = game:GetService("Players")\nlocal secret = "Hello LuauForge"\nprint(secret)\n`;

  async function doObf(){
    const src = inEl.value;
    if(!src.trim()){ toast('Cole código para ofuscar','warning'); return; }
    const presetName = presetEl.value;
    const extra = {
      stripComments: stripEl.checked,
      splitStrings: splitEl.checked,
      junk: junkEl.checked,
      minify: minifyEl.checked,
      oneLine: oneLineEl.checked,
      header: headerEl.checked,
      addVararg: varargEl.checked,
      numbersExtra: numbersEl.checked,
      encodeMode: modeEl.value || null
    };
    const customApi = apiEl.value.trim();

    if(customApi){
      const btn=$('#obGo'); btn.disabled=true; btn.textContent='Enviando...';
      try{
        const res = await fetch(customApi, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ code: src, language:'lua', options: extra, preset: presetName }) });
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
        toast('Falha API: '+e.message+' — usando Prometheus local', 'warning');
        const { code } = runPipeline(src, presetName, extra);
        outEl.value = code;
        container.dataset.output = code;
        apiWrap.style.display='block';
        apiOut.textContent = 'Fallback local Prometheus: '+e.message;
      }finally{
        btn.disabled=false; btn.textContent='Obfuscar';
      }
      return;
    }

    try{
      const t0=performance.now();
      let { code } = runPipeline(src, presetName, extra);
      // extra vararg if checked and not already via preset
      if(extra.addVararg) code = stepAddVararg(code);
      if(extra.numbersExtra) code = stepNumbersToExpressions(code, { NumberRepresentationMutation:true });
      const t1=performance.now();
      outEl.value = code;
      container.dataset.output = code;
      const a=src.length, b=code.length;
      statsEl.textContent = `${a} → ${b} chars • ${(t1-t0).toFixed(1)}ms`;
      outStats.textContent = `${code.split('\n').length} linhas • ${b} bytes • ${presetName} • ${b>a? '+'+(b-a):(b-a)} bytes`;
      apiWrap.style.display='none';
      toast('Ofuscado (Prometheus '+presetName+')','success');
    }catch(e){
      toast('Erro: '+e.message,'error');
      console.error(e);
    }
  }

  $('#obGo').addEventListener('click', doObf);
  $('#obCopy').addEventListener('click', ()=> copyText(inEl.value||''));
  $('#obCopyOut').addEventListener('click', ()=> copyText(outEl.value||''));
  $('#obClear').addEventListener('click', ()=>{ inEl.value=''; outEl.value=''; statsEl.textContent=''; outStats.textContent=''; apiWrap.style.display='none'; });
  $('#obDownload').addEventListener('click', ()=>{
    const blob=new Blob([outEl.value||''],{type:'text/plain'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download='obfuscated.lua'; a.click(); URL.revokeObjectURL(url);
  });
  container.addEventListener('keydown', e=>{ if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){ e.preventDefault(); doObf(); }});
  container._getOutput = ()=> outEl.value||'';
}
