import { copyText, toast } from '../ui.js';

export function renderEscaper(container){
  container.innerHTML=`
  <div class="tool-head"><div><h2>String Escaper</h2><p>Converte texto para string Lua com aspas simples/duplas e escapes.</p></div></div>
  <div class="panel"><div class="panel__body grid grid--2">
    <div class="stack">
      <div class="field"><label>Input</label><textarea id="esIn" class="textarea textarea--lg" placeholder="Hello&#10;World &quot;quotes&quot;"></textarea></div>
      <div class="row">
        <label class="check"><input type="radio" name="esQ" value="double" checked/> double quotes</label>
        <label class="check"><input type="radio" name="esQ" value="single"/> single quotes</label>
        <button class="btn btn--primary" id="esGo">Escape</button>
        <button class="btn btn--sm" id="esCopy">Copy</button>
      </div>
    </div>
    <div class="stack">
      <div class="field"><label>Output (Lua string)</label><textarea id="esOut" class="textarea textarea--lg textarea--mono" readonly></textarea></div>
      <div class="row"><button class="btn btn--sm" id="esUnescape">Unescape → Text</button><button class="btn btn--sm" id="esClear">Clear</button></div>
    </div>
  </div></div>`;
  const $=s=>container.querySelector(s);
  const inEl=$('#esIn'), outEl=$('#esOut');
  function esc(){
    const q = container.querySelector('input[name="esQ"]:checked').value;
    let s=inEl.value;
    s=s.replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/\r/g,'\\r').replace(/\t/g,'\\t').replace(/\0/g,'\\0');
    if(q==='double') s=s.replace(/"/g,'\\"'); else s=s.replace(/'/g,"\\'");
    const quote=q==='double'?'"':"'";
    outEl.value=quote+s+quote;
    container.dataset.output=outEl.value;
  }
  function unesc(){
    try{
      let s=inEl.value.trim();
      // if wrapped in quotes, unwrap
      if((s.startsWith('"')&&s.endsWith('"'))||(s.startsWith("'")&&s.endsWith("'"))) s=s.slice(1,-1);
      s=s.replace(/\\n/g,'\n').replace(/\\r/g,'\r').replace(/\\t/g,'\t').replace(/\\0/g,'\0').replace(/\\"/g,'"').replace(/\\'/g,"'").replace(/\\\\/g,'\\');
      outEl.value=s; container.dataset.output=s;
    }catch(e){ toast('Invalid escape: '+e.message,'error'); }
  }
  $('#esGo').addEventListener('click', esc);
  $('#esUnescape').addEventListener('click', unesc);
  $('#esCopy').addEventListener('click', ()=> copyText(outEl.value||''));
  $('#esClear').addEventListener('click', ()=>{ inEl.value=''; outEl.value='';});
  container._getOutput=()=> outEl.value||'';
  inEl.value='Hello\nWorld "Luau"';
  esc();
}
export function renderChar(container){
  container.innerHTML=`
  <div class="tool-head"><div><h2>String.char Generator</h2><p>Texto ↔ <span class="inline-code">string.char(72,101,...)</span> com decode reverso.</p></div></div>
  <div class="panel"><div class="panel__body grid grid--2">
    <div class="stack">
      <div class="field"><label>Text</label><textarea id="chIn" class="textarea textarea--lg" placeholder="Ryan"></textarea></div>
      <div class="row"><button class="btn btn--primary" id="chEnc">→ string.char</button><button class="btn btn--sm" id="chDec">string.char → Text</button><button class="btn btn--sm" id="chCopy">Copy</button></div>
    </div>
    <div class="stack">
      <div class="field"><label>Output</label><textarea id="chOut" class="textarea textarea--lg textarea--mono" readonly></textarea></div>
      <div class="row"><button class="btn btn--sm" id="chClear">Clear</button><span class="small muted">Suporta UTF-8 via char codes</span></div>
    </div>
  </div></div>`;
  const $=s=>container.querySelector(s);
  const inEl=$('#chIn'), outEl=$('#chOut');
  function enc(){
    const s=inEl.value;
    const codes=[...s].map(c=> c.codePointAt(0));
    outEl.value=`string.char(${codes.join(', ')})`;
    container.dataset.output=outEl.value;
  }
  function dec(){
    const s=inEl.value.trim();
    // extract numbers
    const nums = (s.match(/-?\d+/g)||[]).map(Number);
    if(nums.length===0){ toast('Nenhum número encontrado','warning'); return; }
    try{
      outEl.value = String.fromCodePoint(...nums);
      container.dataset.output=outEl.value;
    }catch(e){ toast('Invalid codes: '+e.message,'error'); }
  }
  $('#chEnc').addEventListener('click', enc);
  $('#chDec').addEventListener('click', dec);
  $('#chCopy').addEventListener('click', ()=> copyText(outEl.value||''));
  $('#chClear').addEventListener('click', ()=>{ inEl.value=''; outEl.value='';});
  container._getOutput=()=> outEl.value||'';
  inEl.value='Ryan'; enc();
}
export function renderBase64(container){
  container.innerHTML=`
  <div class="tool-head"><div><h2>Base64 Tools</h2><p>Encode/decode Base64 seguro (UTF-8) 100% no navegador.</p></div></div>
  <div class="panel"><div class="panel__body grid grid--2">
    <div class="stack">
      <div class="field"><label>Input</label><textarea id="b64In" class="textarea textarea--lg textarea--mono" placeholder="Hello World"></textarea></div>
      <div class="row"><button class="btn btn--primary" id="b64Enc">Encode</button><button class="btn btn--primary" id="b64Dec">Decode</button><button class="btn btn--sm" id="b64Copy">Copy</button></div>
    </div>
    <div class="stack">
      <div class="field"><label>Output</label><textarea id="b64Out" class="textarea textarea--lg textarea--mono" readonly></textarea></div>
      <div class="row"><button class="btn btn--sm" id="b64Clear">Clear</button><span class="small muted" id="b64Info"></span></div>
    </div>
  </div></div>`;
  const $=s=>container.querySelector(s);
  const inEl=$('#b64In'), outEl=$('#b64Out'), info=$('#b64Info');
  function enc(){
    try{
      const bytes = new TextEncoder().encode(inEl.value);
      let bin=''; bytes.forEach(b=> bin+=String.fromCharCode(b));
      outEl.value=btoa(bin);
      info.textContent=`${bytes.length} bytes → ${outEl.value.length} chars`;
      container.dataset.output=outEl.value;
    }catch(e){ toast(e.message,'error');}
  }
  function dec(){
    try{
      const bin=atob(inEl.value.trim());
      const bytes=Uint8Array.from(bin, c=>c.charCodeAt(0));
      outEl.value=new TextDecoder().decode(bytes);
      info.textContent=`${bin.length} chars → ${bytes.length} bytes`;
      container.dataset.output=outEl.value;
    }catch(e){ toast('Invalid Base64','error');}
  }
  $('#b64Enc').addEventListener('click', enc);
  $('#b64Dec').addEventListener('click', dec);
  $('#b64Copy').addEventListener('click', ()=> copyText(outEl.value||''));
  $('#b64Clear').addEventListener('click', ()=>{ inEl.value=''; outEl.value=''; info.textContent='';});
  container._getOutput=()=> outEl.value||'';
  inEl.value='Hello LuauForge';
}
export function renderHex(container){
  container.innerHTML=`
  <div class="tool-head"><div><h2>HEX Tools</h2><p>Text ↔ HEX com validação e preview.</p></div></div>
  <div class="panel"><div class="panel__body grid grid--2">
    <div class="stack">
      <div class="field"><label>Text</label><textarea id="hxIn" class="textarea textarea--lg textarea--mono" placeholder="Hello"></textarea></div>
      <div class="row"><button class="btn btn--primary" id="hxEnc">Text → HEX</button><button class="btn btn--primary" id="hxDec">HEX → Text</button><button class="btn btn--sm" id="hxCopy">Copy</button></div>
    </div>
    <div class="stack">
      <div class="field"><label>Output</label><textarea id="hxOut" class="textarea textarea--lg textarea--mono" readonly></textarea></div>
      <div class="row"><button class="btn btn--sm" id="hxClear">Clear</button><span class="small muted" id="hxInfo"></span></div>
    </div>
  </div></div>`;
  const $=s=>container.querySelector(s);
  const inEl=$('#hxIn'), outEl=$('#hxOut'), info=$('#hxInfo');
  function enc(){
    const bytes=new TextEncoder().encode(inEl.value);
    outEl.value=[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
    info.textContent=`${bytes.length} bytes`;
    container.dataset.output=outEl.value;
  }
  function dec(){
    const s=inEl.value.trim().replace(/\s+/g,'');
    if(!/^[0-9a-fA-F]*$/.test(s) || s.length%2!==0){ toast('Invalid hexadecimal input','error'); return; }
    const bytes=new Uint8Array(s.length/2);
    for(let i=0;i<s.length;i+=2) bytes[i/2]=parseInt(s.slice(i,i+2),16);
    outEl.value=new TextDecoder().decode(bytes);
    info.textContent=`${bytes.length} bytes`;
    container.dataset.output=outEl.value;
  }
  $('#hxEnc').addEventListener('click', enc);
  $('#hxDec').addEventListener('click', dec);
  $('#hxCopy').addEventListener('click', ()=> copyText(outEl.value||''));
  $('#hxClear').addEventListener('click', ()=>{ inEl.value=''; outEl.value=''; info.textContent='';});
  container._getOutput=()=> outEl.value||'';
  inEl.value='Hello';
}
export function renderUrl(container){
  container.innerHTML=`
  <div class="tool-head"><div><h2>URL Encoder</h2><p>encodeURIComponent / decodeURIComponent com preview visual.</p></div></div>
  <div class="panel"><div class="panel__body grid grid--2">
    <div class="stack">
      <div class="field"><label>Input</label><textarea id="urIn" class="textarea textarea--lg textarea--mono" placeholder="https://example.com/?q=hello world"></textarea></div>
      <div class="row"><button class="btn btn--primary" id="urEnc">Encode</button><button class="btn btn--primary" id="urDec">Decode</button><button class="btn btn--sm" id="urCopy">Copy</button></div>
    </div>
    <div class="stack">
      <div class="field"><label>Output</label><textarea id="urOut" class="textarea textarea--lg textarea--mono" readonly></textarea></div>
      <div class="row"><button class="btn btn--sm" id="urClear">Clear</button></div>
    </div>
  </div></div>`;
  const $=s=>container.querySelector(s);
  const inEl=$('#urIn'), outEl=$('#urOut');
  $('#urEnc').addEventListener('click', ()=>{ try{ outEl.value=encodeURIComponent(inEl.value); container.dataset.output=outEl.value; }catch(e){ toast(e.message,'error');}});
  $('#urDec').addEventListener('click', ()=>{ try{ outEl.value=decodeURIComponent(inEl.value); container.dataset.output=outEl.value; }catch(e){ toast('Invalid URL encoding','error');}});
  $('#urCopy').addEventListener('click', ()=> copyText(outEl.value||''));
  $('#urClear').addEventListener('click', ()=>{ inEl.value=''; outEl.value='';});
  container._getOutput=()=> outEl.value||'';
  inEl.value='https://example.com/?q=hello world&x=Luau Forge';
}
export function renderJsonLua(container){
  container.innerHTML=`
  <div class="tool-head"><div><h2>JSON ↔ Lua Table</h2><p>Converte JSON para tabela Lua (e vice-versa) com formatação.</p></div></div>
  <div class="panel">
    <div class="panel__head">
      <div class="tabs"><button class="tab active" data-mode="json2lua">JSON → Lua</button><button class="tab" data-mode="lua2json">Lua → JSON</button></div>
      <div class="row" style="margin-left:auto"><button class="btn btn--primary" id="jlGo">Convert</button><button class="btn btn--sm" id="jlCopy">Copy</button><button class="btn btn--sm" id="jlClear">Clear</button></div>
    </div>
    <div class="panel__body grid grid--2">
      <div class="field"><label>Input</label><textarea id="jlIn" class="textarea textarea--lg textarea--mono" placeholder='{"name":"Ryan","enabled":true}'></textarea></div>
      <div class="field"><label>Output</label><textarea id="jlOut" class="textarea textarea--lg textarea--mono" readonly></textarea></div>
    </div>
  </div>`;
  const $=s=>container.querySelector(s);
  const inEl=$('#jlIn'), outEl=$('#jlOut');
  let mode='json2lua';
  container.querySelectorAll('.tab').forEach(b=> b.addEventListener('click', ()=>{
    container.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
    b.classList.add('active'); mode=b.dataset.mode;
  }));
  function jsonToLua(obj, indent=0){
    const pad='    '.repeat(indent);
    const pad1='    '.repeat(indent+1);
    if(obj===null) return 'nil';
    if(Array.isArray(obj)){
      if(obj.length===0) return '{}';
      return '{\n' + obj.map(v=> pad1+jsonToLua(v, indent+1)).join(',\n') + '\n'+pad+'}';
    }
    if(typeof obj==='object'){
      const entries=Object.entries(obj);
      if(entries.length===0) return '{}';
      return '{\n' + entries.map(([k,v])=>{
        const key = /^[A-Za-z_][A-Za-z0-9_]*$/.test(k) ? k : `["${k.replace(/"/g,'\\"')}"]`;
        return `${pad1}${key} = ${jsonToLua(v, indent+1)}`;
      }).join(',\n') + '\n'+pad+'}';
    }
    if(typeof obj==='string') return `"${obj.replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/\n/g,'\\n')}"`;
    if(typeof obj==='boolean') return obj?'true':'false';
    if(typeof obj==='number') return String(obj);
    return 'nil';
  }
  function luaToJson(_lua){ throw new Error('fallback to transform path'); }
  function convert(){
    try{
      if(mode==='json2lua'){
        const obj=JSON.parse(inEl.value);
        outEl.value=jsonToLua(obj);
      } else {
        // Lua -> JSON: do transform to JSON via safe steps
        let t=inEl.value.trim();
        // replace -- comments
        t=t.replace(/--\[\[[\s\S]*?\]\]/g,'').replace(/--.*$/gm,'');
        // replace single quoted strings to double for JSON step, and handle nil->null, = -> :
        // We'll attempt to parse via a tiny Lua table parser using Function after sanitizing to JSON-like string.
        // Steps: normalize keys:  foo =  -> "foo":
        // but careful not to touch inside strings. Use placeholder.
        const strs=[]; t=t.replace(/"([^"\\]|\\.)*"/g, m=>{ const k=`__S${strs.length}__`; strs.push(m); return k; });
        t=t.replace(/'([^'\\]|\\.)*'/g, m=>{ const k=`__S${strs.length}__`; const inner=m.slice(1,-1).replace(/"/g,'\\"'); strs.push(`"${inner}"`); return k; });
        t=t.replace(/\[__S(\d+)__\]\s*=/g, (_,n)=> `${strs[Number(n)]}=`);
        t=t.replace(/\b([A-Za-z_][A-Za-z0-9_]*)\s*=/g, '"$1"=');
        t=t.replace(/=/g, ':');
        t=t.replace(/\btrue\b/g,'true').replace(/\bfalse\b/g,'false');
        t=t.replace(/\bnil\b/g,'null');
        // remove trailing commas
        t=t.replace(/,(\s*[}\]])/g,'$1');
        // restore strings: but already placeholders remain inside; replace back
        t=t.replace(/__S(\d+)__/g, (_,n)=> strs[Number(n)]);
        // now it should be JSON; ensure wrapped
        const obj=JSON.parse(t);
        outEl.value=JSON.stringify(obj,null,4);
      }
      container.dataset.output=outEl.value;
    }catch(e){ toast('Convert error: '+e.message,'error'); }
  }
  $('#jlGo').addEventListener('click', convert);
  $('#jlCopy').addEventListener('click', ()=> copyText(outEl.value||''));
  $('#jlClear').addEventListener('click', ()=>{ inEl.value=''; outEl.value='';});
  container._getOutput=()=> outEl.value||'';
  inEl.value='{\n  "name": "Ryan",\n  "enabled": true,\n  "scores": [10, 20, 30]\n}';
  container.addEventListener('keydown', e=>{ if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){ e.preventDefault(); convert(); }});
}
