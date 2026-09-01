import { copyText, toast } from '../ui.js';

// Lightweight Lua/Luau formatter: indentation + spacing + preserve strings/comments
function formatLua(src, opts={tabSize:4, useTabs:false}){
  const tab = opts.useTabs ? '\t' : ' '.repeat(opts.tabSize);
  const INDENT_INC = new Set(['then','do','function','repeat']);
  const DEDENT_BEFORE = new Set(['else','elseif','end','until']);
  const INC_AFTER = new Set(['else','elseif']); // after dedent, indent again
  // Tokenize to preserve strings/comments
  let outLines=[];
  let indent=0;
  const rawLines = src.replace(/\r\n/g,'\n').split('\n');
  for(let raw of rawLines){
    let trimmed = raw.trim();
    if(trimmed===''){ outLines.push(''); continue; }
    // handle dedent before
    const first = trimmed.split(/\s+/)[0].replace(/[^a-z]/gi,'');
    // special: "else" "elseif"
    const lowFirst = (trimmed.match(/^(else|elseif|end|until)\b/)||[])[1];
    if(lowFirst && DEDENT_BEFORE.has(lowFirst)){
      indent = Math.max(0, indent-1);
    }
    // basic spacing normalizations inside line (preserve strings)
    let formatted = formatLine(trimmed);
    outLines.push(tab.repeat(indent) + formatted);
    // compute indent change after
    // count keywords in line (naive but effective)
    const tokens = tokenWords(trimmed);
    for(const w of tokens){
      if(INDENT_INC.has(w)) indent++;
      if(w==='else' || w==='elseif') {/* handled */}
      if(w==='if' && trimmed.includes(' then')) {/* already */}
    }
    if(lowFirst && INC_AFTER.has(lowFirst)) indent++;
    // handle "end" already dedented; also handle "until" etc.
    // prevent negative
    if(indent<0) indent=0;
  }
  return outLines.join('\n');
}
function tokenWords(s){
  // remove strings and comments for keyword counting
  let t=s;
  t=t.replace(/--\[\[[\s\S]*?\]\]/g,'');
  t=t.replace(/--.*$/g,'');
  t=t.replace(/"([^"\\]|\\.)*"/g,'""');
  t=t.replace(/'([^'\\]|\\.)*'/g,"''");
  t=t.replace(/\[\[[\s\S]*?\]\]/g,'[[]]');
  return (t.match(/\b[a-z]+\b/gi)||[]).map(x=>x.toLowerCase());
}
function formatLine(line){
  // Preserve leading comment as is except trim
  if(line.startsWith('--')) return line;
  // Very light spacing: ensure operators have spaces (but not inside strings)
  // Split by strings to avoid touching inside
  const parts = splitPreserveStrings(line);
  for(let i=0;i<parts.length;i++){
    if(parts[i].isString) continue;
    let s=parts[i].text;
    s=s.replace(/\s+/g,' ');
    s=s.replace(/\s*,\s*/g,', ');
    s=s.replace(/\s*([=+\-*/%<>~^]+)\s*/g, (m,op)=>{
      // don't mess with ==, ~=, <=, >=, .., ::
      return ' '+op+' ';
    });
    s=s.replace(/\s*\(\s*/g,'(').replace(/\s*\)\s*/g,')');
    s=s.replace(/\s*\{\s*/g,'{ ').replace(/\s*\}\s*/g,' }');
    s=s.replace(/\s*;\s*/g,'; ');
    s=s.replace(/\s+/g,' ').trim();
    parts[i].text=s;
  }
  return parts.map(p=>p.text).join('');
}
function splitPreserveStrings(line){
  const res=[]; let i=0; let buf=''; let inStr=null; let esc=false;
  const pushBuf=(isStr)=>{ if(buf){ res.push({text:buf,isString:isStr}); buf=''; } };
  while(i<line.length){
    const c=line[i];
    if(inStr){
      buf+=c;
      if(esc){ esc=false; }
      else if(c==='\\'){ esc=true; }
      else if(c===inStr){ pushBuf(true); inStr=null; }
      i++;
    } else {
      if(c==='"' || c==="'"){ pushBuf(false); buf+=c; inStr=c; i++; }
      else if(c==='-' && line[i+1]==='-'){ // comment start -> rest is comment
        pushBuf(false);
        res.push({text:line.slice(i),isString:false});
        break;
      } else { buf+=c; i++; }
    }
  }
  if(buf) pushBuf(false);
  return res;
}

export function renderFormatter(container){
  container.innerHTML = `
  <div class="tool-head">
    <div><h2>Lua Formatter</h2><p>Indentação inteligente, tabs/spaces, preserva strings e comentários. 100% local.</p></div>
    <span class="badge">Beta</span>
  </div>
  <div class="panel">
    <div class="panel__head">
      <div class="row">
        <label class="field" style="min-width:120px"><span style="font:600 10px var(--font-sans);letter-spacing:.1em;text-transform:uppercase;color:var(--text2)">Tab size</span>
          <select id="fmtTab" class="select"><option value="2">2</option><option value="4" selected>4</option></select>
        </label>
        <label class="check"><input type="checkbox" id="fmtTabs"/> Use tabs</label>
      </div>
      <div class="row" style="margin-left:auto">
        <button class="btn btn--primary" id="fmtDo">Format</button>
        <button class="btn btn--sm" id="fmtCopy">Copy</button>
        <button class="btn btn--sm" id="fmtClear">Clear</button>
      </div>
    </div>
    <div class="panel__body grid grid--2">
      <div class="stack">
        <div class="field"><label>Input</label><textarea id="fmtIn" class="textarea textarea--lg textarea--mono" placeholder="cole seu Lua/Luau aqui..."></textarea></div>
        <div class="small muted" id="fmtInStats"></div>
      </div>
      <div class="stack">
        <div class="field"><label>Output</label><textarea id="fmtOut" class="textarea textarea--lg textarea--mono" readonly></textarea></div>
        <div class="small muted" id="fmtOutStats"></div>
      </div>
    </div>
  </div>`;
  const $=s=>container.querySelector(s);
  const inEl=$('#fmtIn'), outEl=$('#fmtOut'), tabEl=$('#fmtTab'), tabsEl=$('#fmtTabs');
  const inStats=$('#fmtInStats'), outStats=$('#fmtOutStats');
  function stats(s){ return `${s.length} chars • ${s.split('\n').length} lines`; }
  function doFmt(){
    const src=inEl.value;
    if(!src.trim()){ toast('Cole algum código primeiro','warning'); return; }
    try{
      const formatted = formatLua(src, {tabSize: parseInt(tabEl.value,10), useTabs: tabsEl.checked});
      outEl.value=formatted;
      inStats.textContent=stats(src);
      outStats.textContent=stats(formatted);
      container.dataset.output=formatted;
      toast('Formatted','success');
    }catch(e){ toast('Erro ao formatar: '+e.message,'error'); }
  }
  $('#fmtDo').addEventListener('click', doFmt);
  $('#fmtCopy').addEventListener('click', ()=> copyText(outEl.value||''));
  $('#fmtClear').addEventListener('click', ()=>{ inEl.value=''; outEl.value=''; inStats.textContent=''; outStats.textContent=''; });
  container._getOutput=()=> outEl.value||'';
  inEl.value=`local Players=game:GetService("Players")\nlocal p=Players.LocalPlayer\nif p then\nprint("hi")\nelse\nwarn("no player")\nend\n\nlocal function foo(a,b)\nif a>b then\nreturn a\nelse\nreturn b\nend\nend`;
  container.addEventListener('keydown', e=>{ if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){ e.preventDefault(); doFmt(); }});
}
