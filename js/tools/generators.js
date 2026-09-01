import { copyText, toast } from '../ui.js';

export function renderIdentifier(container){
  container.innerHTML=`
  <div class="tool-head"><div><h2>Identifier Generator</h2><p>Gera identificadores aleatórios com prefixo, tamanho e quantidade.</p></div></div>
  <div class="panel"><div class="panel__body grid grid--2">
    <div class="stack">
      <div class="grid grid--3">
        <label class="field"><span>Quantidade</span><input id="idQty" type="number" class="input" value="10" min="1" max="200"/></label>
        <label class="field"><span>Tamanho</span><input id="idLen" type="number" class="input" value="8" min="2" max="32"/></label>
        <label class="field"><span>Prefixo</span><input id="idPre" class="input input--mono" value="_" /></label>
      </div>
      <div class="row">
        <label class="check"><input type="checkbox" id="idLetters" checked/> letras</label>
        <label class="check"><input type="checkbox" id="idNumbers" checked/> números</label>
        <label class="check"><input type="checkbox" id="idUpper" checked/> maiúsculas</label>
      </div>
      <div class="row"><button class="btn btn--primary" id="idGo">Generate</button><button class="btn btn--sm" id="idCopy">Copy All</button></div>
    </div>
    <div class="output"><div class="output__bar"><span>OUTPUT</span></div><pre id="idOut" class="wrap"></pre></div>
  </div></div>`;
  const $=s=>container.querySelector(s);
  const out=$('#idOut');
  function gen(){
    const qty=Math.max(1, Math.min(200, parseInt($('#idQty').value||'10',10)));
    const len=Math.max(2, Math.min(32, parseInt($('#idLen').value||'8',10)));
    const pre=$('#idPre').value||'';
    let chars='';
    if($('#idLetters').checked) chars+='abcdefghijklmnopqrstuvwxyz';
    if($('#idUpper').checked) chars+='ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if($('#idNumbers').checked) chars+='0123456789';
    if(!chars) chars='abcdefghijklmnopqrstuvwxyz';
    const res=[];
    for(let i=0;i<qty;i++){
      let s=pre;
      for(let j=0;j<len;j++) s+= chars[Math.floor(Math.random()*chars.length)];
      res.push(s);
    }
    out.textContent=res.join('\n');
    container.dataset.output=out.textContent;
  }
  $('#idGo').addEventListener('click', gen);
  $('#idCopy').addEventListener('click', ()=> copyText(out.textContent||''));
  container._getOutput=()=> out.textContent||'';
  gen();
}

export function renderUUID(container){
  container.innerHTML=`
  <div class="tool-head"><div><h2>UUID Generator</h2><p>UUID v4 — quantidade configurável, formato padrão RFC4122.</p></div></div>
  <div class="panel"><div class="panel__body grid grid--2">
    <div class="stack">
      <label class="field"><span>Quantidade</span><input id="uuQty" type="number" class="input" value="5" min="1" max="100"/></label>
      <div class="row"><button class="btn btn--primary" id="uuGo">Generate</button><button class="btn btn--sm" id="uuCopy">Copy All</button></div>
      <div class="notice">Gerado via <span class="inline-code">crypto.randomUUID()</span> quando disponível, com fallback seguro.</div>
    </div>
    <div class="output"><div class="output__bar"><span>UUID v4</span></div><pre id="uuOut" class="wrap"></pre></div>
  </div></div>`;
  const $=s=>container.querySelector(s);
  const out=$('#uuOut');
  function uuid(){
    if(crypto.randomUUID) return crypto.randomUUID();
    const b=crypto.getRandomValues(new Uint8Array(16));
    b[6]=(b[6]&0x0f)|0x40; b[8]=(b[8]&0x3f)|0x80;
    const h=[...b].map(x=>x.toString(16).padStart(2,'0')).join('');
    return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
  }
  function gen(){
    const n=Math.max(1,Math.min(100, parseInt($('#uuQty').value||'5',10)));
    const arr=Array.from({length:n}, ()=> uuid());
    out.textContent=arr.join('\n');
    container.dataset.output=out.textContent;
  }
  $('#uuGo').addEventListener('click', gen);
  $('#uuCopy').addEventListener('click', ()=> copyText(out.textContent||''));
  container._getOutput=()=> out.textContent||'';
  gen();
}

export function renderHash(container){
  container.innerHTML=`
  <div class="tool-head"><div><h2>Hash Generator</h2><p>SHA-1 / 256 / 384 / 512 via Web Crypto API — sem envio para servidor.</p></div></div>
  <div class="panel"><div class="panel__body grid grid--2">
    <div class="stack">
      <div class="field"><label>Input</label><textarea id="hsIn" class="textarea" placeholder="hello world"></textarea></div>
      <div class="row">
        <select id="hsAlgo" class="select" style="max-width:180px"><option>SHA-1</option><option selected>SHA-256</option><option>SHA-384</option><option>SHA-512</option></select>
        <button class="btn btn--primary" id="hsGo">Generate</button>
        <button class="btn btn--sm" id="hsCopy">Copy</button>
      </div>
      <div class="small muted">Algoritmos nativos do navegador. Texto é codificado em UTF-8.</div>
    </div>
    <div class="output"><div class="output__bar"><span>HEX</span><span class="small muted" id="hsLen"></span></div><pre id="hsOut" class="wrap"></pre></div>
  </div></div>`;
  const $=s=>container.querySelector(s);
  const inEl=$('#hsIn'), out=$('#hsOut'), algo=$('#hsAlgo'), lenEl=$('#hsLen');
  async function gen(){
    const text=inEl.value;
    if(!text){ toast('Digite um texto','warning'); return; }
    const name=algo.value;
    try{
      const data=new TextEncoder().encode(text);
      const buf=await crypto.subtle.digest(name, data);
      const hex=[...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
      out.textContent=hex;
      lenEl.textContent=`${hex.length} hex chars • ${buf.byteLength} bytes`;
      container.dataset.output=hex;
    }catch(e){ toast(e.message,'error'); }
  }
  $('#hsGo').addEventListener('click', gen);
  $('#hsCopy').addEventListener('click', ()=> copyText(out.textContent||''));
  container._getOutput=()=> out.textContent||'';
  inEl.value='LuauForge'; gen();
}

export function renderColor3(container){
  container.innerHTML=`
  <div class="tool-head"><div><h2>Color3 Generator</h2><p>Color picker → HEX/RGB → <span class="inline-code">Color3.fromRGB</span> e <span class="inline-code">Color3.new</span>.</p></div></div>
  <div class="panel"><div class="panel__body grid grid--2">
    <div class="stack">
      <div class="row" style="align-items:flex-end">
        <label class="field"><span>Picker</span><input id="c3Pick" type="color" value="#6C63FF" style="height:42px;padding:4px;width:80px" class="input"/></label>
        <label class="field"><span>HEX</span><input id="c3Hex" class="input input--mono" value="#6C63FF"/></label>
        <div id="c3Prev" class="color-preview" style="margin-bottom:2px"></div>
      </div>
      <div class="grid grid--3">
        <label class="field"><span>R</span><input id="c3R" type="range" min="0" max="255" value="108" class="range"/><input id="c3Rn" type="number" min="0" max="255" value="108" class="input"/></label>
        <label class="field"><span>G</span><input id="c3G" type="range" min="0" max="255" value="99" class="range"/><input id="c3Gn" type="number" min="0" max="255" value="99" class="input"/></label>
        <label class="field"><span>B</span><input id="c3B" type="range" min="0" max="255" value="255" class="range"/><input id="c3Bn" type="number" min="0" max="255" value="255" class="input"/></label>
      </div>
    </div>
    <div class="stack">
      <div class="output"><div class="output__bar"><span>LUA</span><button class="btn btn--sm" id="c3Copy1" style="margin-left:auto">Copy fromRGB</button></div><pre id="c3Out1"></pre></div>
      <div class="output"><div class="output__bar"><span>LUA</span><button class="btn btn--sm" id="c3Copy2" style="margin-left:auto">Copy new</button></div><pre id="c3Out2"></pre></div>
      <div class="row small muted"><span id="c3Info"></span></div>
    </div>
  </div></div>`;
  const $=s=>container.querySelector(s);
  const pick=$('#c3Pick'), hex=$('#c3Hex'), prev=$('#c3Prev');
  const r=$('#c3R'), g=$('#c3G'), b=$('#c3B'), rn=$('#c3Rn'), gn=$('#c3Gn'), bn=$('#c3Bn');
  const out1=$('#c3Out1'), out2=$('#c3Out2'), info=$('#c3Info');
  function toHex(v){ return '#'+[r.value,g.value,b.value].map(x=> Number(x).toString(16).padStart(2,'0')).join('').toUpperCase(); }
  function updateFromRGB(){
    const rv=+r.value, gv=+g.value, bv=+b.value;
    rn.value=rv; gn.value=gv; bn.value=bv;
    const h=toHex();
    hex.value=h; pick.value=h;
    prev.style.background=h;
    out1.textContent=`Color3.fromRGB(${rv}, ${gv}, ${bv})`;
    out2.textContent=`Color3.new(${(rv/255).toFixed(4)}, ${(gv/255).toFixed(4)}, ${(bv/255).toFixed(4)})`;
    info.textContent=`HEX ${h} • RGB ${rv}, ${gv}, ${bv}`;
    container.dataset.output=out1.textContent;
  }
  function fromHex(h){
    if(!/^#?[0-9a-fA-F]{6}$/.test(h.trim())) return;
    const v=h.trim().replace('#','');
    r.value=parseInt(v.slice(0,2),16); g.value=parseInt(v.slice(2,4),16); b.value=parseInt(v.slice(4,6),16);
    updateFromRGB();
  }
  [r,g,b].forEach(el=> el.addEventListener('input', updateFromRGB));
  [rn,gn,bn].forEach((el,i)=>{
    el.addEventListener('input', ()=>{
      const arr=[rn,gn,bn], ranges=[r,g,b];
      const v=Math.max(0,Math.min(255, parseInt(el.value||'0',10)));
      ranges[i].value=v; el.value=v;
      updateFromRGB();
    });
  });
  pick.addEventListener('input', ()=> fromHex(pick.value));
  hex.addEventListener('input', ()=> fromHex(hex.value));
  $('#c3Copy1').addEventListener('click', ()=> copyText(out1.textContent));
  $('#c3Copy2').addEventListener('click', ()=> copyText(out2.textContent));
  container._getOutput=()=> out1.textContent;
  updateFromRGB();
}

export function renderUDim2(container){
  container.innerHTML=`
  <div class="tool-head"><div><h2>UDim2 Builder</h2><p>Construa <span class="inline-code">UDim2.new(xScale, xOffset, yScale, yOffset)</span> com presets.</p></div></div>
  <div class="panel"><div class="panel__body grid grid--2">
    <div class="stack">
      <div class="grid grid--2">
        <label class="field"><span>X Scale</span><input id="uX" type="number" step="0.05" class="input" value="0.5"/></label>
        <label class="field"><span>X Offset</span><input id="uXO" type="number" class="input" value="0"/></label>
        <label class="field"><span>Y Scale</span><input id="uY" type="number" step="0.05" class="input" value="0.5"/></label>
        <label class="field"><span>Y Offset</span><input id="uYO" type="number" class="input" value="0"/></label>
      </div>
      <div class="row"><span class="small muted">Presets:</span>
        <button class="btn btn--sm" data-preset="center">Center</button>
        <button class="btn btn--sm" data-preset="full">Full Screen</button>
        <button class="btn btn--sm" data-preset="topleft">Top Left</button>
        <button class="btn btn--sm" data-preset="bottomright">Bottom Right</button>
      </div>
      <div class="row"><button class="btn btn--primary" id="uGo">Generate</button><button class="btn btn--sm" id="uCopy">Copy</button></div>
    </div>
    <div class="output"><div class="output__bar"><span>LUA</span></div><pre id="uOut"></pre></div>
  </div></div>`;
  const $=s=>container.querySelector(s);
  const x=$('#uX'), xo=$('#uXO'), y=$('#uY'), yo=$('#uYO'), out=$('#uOut');
  function gen(){
    const a=parseFloat(x.value||0), b=parseInt(xo.value||0,10), c=parseFloat(y.value||0), d=parseInt(yo.value||0,10);
    out.textContent=`UDim2.new(${a}, ${b}, ${c}, ${d})`;
    // also suggest UDim2.fromScale etc.
    out.textContent+=`\n-- UDim2.fromScale(${a}, ${c})  •  UDim2.fromOffset(${b}, ${d})`;
    container.dataset.output=`UDim2.new(${a}, ${b}, ${c}, ${d})`;
  }
  container.querySelectorAll('[data-preset]').forEach(btn=> btn.addEventListener('click', ()=>{
    const p=btn.dataset.preset;
    if(p==='center'){ x.value=0.5; y.value=0.5; xo.value=0; yo.value=0; }
    if(p==='full'){ x.value=1; y.value=1; xo.value=0; yo.value=0; }
    if(p==='topleft'){ x.value=0; y.value=0; xo.value=0; yo.value=0; }
    if(p==='bottomright'){ x.value=1; y.value=1; xo.value=0; yo.value=0; }
    gen();
  }));
  $('#uGo').addEventListener('click', gen);
  $('#uCopy').addEventListener('click', ()=> copyText(container.dataset.output||''));
  container._getOutput=()=> container.dataset.output||'';
  gen();
  ['input','change'].forEach(ev=> [x,xo,y,yo].forEach(el=> el.addEventListener(ev, gen)));
}

export function renderVector(container){
  container.innerHTML=`
  <div class="tool-head"><div><h2>Vector Generator</h2><p>Vector2 / Vector3 com preview.</p></div></div>
  <div class="panel"><div class="panel__body grid grid--2">
    <div class="stack">
      <div class="tabs"><button class="tab active" data-v="2">Vector2</button><button class="tab" data-v="3">Vector3</button></div>
      <div id="v2fields" class="grid grid--2">
        <label class="field"><span>X</span><input id="vX" type="number" class="input" value="0"/></label>
        <label class="field"><span>Y</span><input id="vY" type="number" class="input" value="0"/></label>
      </div>
      <div id="v3fields" class="grid grid--3" style="display:none">
        <label class="field"><span>X</span><input id="v3X" type="number" class="input" value="0"/></label>
        <label class="field"><span>Y</span><input id="v3Y" type="number" class="input" value="0"/></label>
        <label class="field"><span>Z</span><input id="v3Z" type="number" class="input" value="0"/></label>
      </div>
      <div class="row"><button class="btn btn--primary" id="vGo">Generate</button><button class="btn btn--sm" id="vCopy">Copy</button></div>
    </div>
    <div class="output"><div class="output__bar"><span>LUA</span></div><pre id="vOut"></pre></div>
  </div></div>`;
  const $=s=>container.querySelector(s);
  const tabs=container.querySelectorAll('[data-v]');
  const v2=$('#v2fields'), v3=$('#v3fields'), out=$('#vOut');
  let mode='2';
  tabs.forEach(t=> t.addEventListener('click', ()=>{
    tabs.forEach(x=>x.classList.remove('active')); t.classList.add('active');
    mode=t.dataset.v;
    v2.style.display=mode==='2'?'grid':'none';
    v3.style.display=mode==='3'?'grid':'none';
    gen();
  }));
  function gen(){
    if(mode==='2'){
      const x=parseFloat($('#vX').value||0), y=parseFloat($('#vY').value||0);
      out.textContent=`Vector2.new(${x}, ${y})`;
    } else {
      const x=parseFloat($('#v3X').value||0), y=parseFloat($('#v3Y').value||0), z=parseFloat($('#v3Z').value||0);
      out.textContent=`Vector3.new(${x}, ${y}, ${z})`;
    }
    container.dataset.output=out.textContent;
  }
  $('#vGo').addEventListener('click', gen);
  $('#vCopy').addEventListener('click', ()=> copyText(out.textContent||''));
  container._getOutput=()=> out.textContent||'';
  container.querySelectorAll('input').forEach(i=> i.addEventListener('input', gen));
  gen();
}

export function renderCFrame(container){
  container.innerHTML=`
  <div class="tool-head"><div><h2>CFrame Generator</h2><p>Gera <span class="inline-code">CFrame.new(x,y,z)</span>.</p></div></div>
  <div class="panel"><div class="panel__body grid grid--2">
    <div class="stack">
      <div class="grid grid--3">
        <label class="field"><span>X</span><input id="cfX" type="number" class="input" value="0"/></label>
        <label class="field"><span>Y</span><input id="cfY" type="number" class="input" value="5"/></label>
        <label class="field"><span>Z</span><input id="cfZ" type="number" class="input" value="0"/></label>
      </div>
      <div class="row"><button class="btn btn--primary" id="cfGo">Generate</button><button class="btn btn--sm" id="cfCopy">Copy</button></div>
      <div class="notice">Dica: para rotação use <span class="inline-code">CFrame.Angles(0, math.rad(90), 0)</span> e combine com <span class="inline-code">*</span>.</div>
    </div>
    <div class="output"><div class="output__bar"><span>LUA</span></div><pre id="cfOut"></pre></div>
  </div></div>`;
  const $=s=>container.querySelector(s);
  const out=$('#cfOut');
  function gen(){
    const x=parseFloat($('#cfX').value||0), y=parseFloat($('#cfY').value||0), z=parseFloat($('#cfZ').value||0);
    out.textContent=`CFrame.new(${x}, ${y}, ${z})`;
    container.dataset.output=out.textContent;
  }
  $('#cfGo').addEventListener('click', gen);
  $('#cfCopy').addEventListener('click', ()=> copyText(out.textContent||''));
  container._getOutput=()=> out.textContent||'';
  container.querySelectorAll('input').forEach(i=> i.addEventListener('input', gen));
  gen();
}

export function renderTween(container){
  const easingStyles=["Linear","Sine","Quad","Cubic","Quart","Quint","Back","Bounce","Elastic","Expo","Circular"];
  const dirs=["In","Out","InOut"];
  container.innerHTML=`
  <div class="tool-head"><div><h2>TweenInfo Generator</h2><p>Monte <span class="inline-code">TweenInfo.new(...)</span> com enums visuais.</p></div></div>
  <div class="panel"><div class="panel__body grid grid--2">
    <div class="stack">
      <div class="grid grid--2">
        <label class="field"><span>Time</span><input id="twTime" type="number" step="0.05" class="input" value="0.4"/></label>
        <label class="field"><span>RepeatCount</span><input id="twRep" type="number" class="input" value="0"/></label>
        <label class="field"><span>EasingStyle</span><select id="twStyle" class="select">${easingStyles.map(s=>`<option>${s}</option>`).join('')}</select></label>
        <label class="field"><span>EasingDirection</span><select id="twDir" class="select">${dirs.map(s=>`<option>${s}</option>`).join('')}</select></label>
        <label class="field"><span>DelayTime</span><input id="twDelay" type="number" step="0.05" class="input" value="0"/></label>
        <label class="check" style="margin-top:18px"><input type="checkbox" id="twRev"/> Reverses</label>
      </div>
      <div class="row"><button class="btn btn--primary" id="twGo">Generate</button><button class="btn btn--sm" id="twCopy">Copy</button></div>
    </div>
    <div class="output"><div class="output__bar"><span>LUA</span></div><pre id="twOut"></pre></div>
  </div></div>`;
  const $=s=>container.querySelector(s);
  const out=$('#twOut');
  function gen(){
    const t=parseFloat($('#twTime').value||0), rep=parseInt($('#twRep').value||0,10), style=$('#twStyle').value, dir=$('#twDir').value, delay=parseFloat($('#twDelay').value||0), rev=$('#twRev').checked;
    out.textContent=`TweenInfo.new(\n    ${t},\n    Enum.EasingStyle.${style},\n    Enum.EasingDirection.${dir},\n    ${rep},\n    ${rev},\n    ${delay}\n)`;
    container.dataset.output=out.textContent;
  }
  $('#twGo').addEventListener('click', gen);
  $('#twCopy').addEventListener('click', ()=> copyText(out.textContent||''));
  container._getOutput=()=> out.textContent||'';
  container.querySelectorAll('input,select').forEach(el=> el.addEventListener('input', gen));
  // set defaults Quad Out
  $('#twStyle').value='Quad'; $('#twDir').value='Out';
  gen();
}

export function renderServices(container){
  const SERVICES=["Players","RunService","ReplicatedStorage","Workspace","UserInputService","TweenService","HttpService","SoundService","Lighting","CollectionService","TeleportService","MarketplaceService","PathfindingService","ContextActionService","StarterGui","Debris","Teams","TextService","ContentProvider","GroupService"];
  container.innerHTML=`
  <div class="tool-head"><div><h2>Services Generator</h2><p>Marque os services e gere <span class="inline-code">game:GetService(...)</span> em lote.</p></div></div>
  <div class="panel"><div class="panel__body grid grid--2">
    <div class="stack">
      <div class="grid grid--2" id="svGrid" style="max-height:360px;overflow:auto;padding-right:4px">
        ${SERVICES.map(s=>`<label class="check" style="padding:8px;border:1px solid var(--border);border-radius:10px;background:var(--bg2)"><input type="checkbox" value="${s}" ${["Players","RunService","TweenService"].includes(s)?'checked':''}/> ${s}</label>`).join('')}
      </div>
      <div class="row"><button class="btn btn--sm" id="svAll">Select all</button><button class="btn btn--sm" id="svNone">Clear</button><button class="btn btn--primary" id="svGo">Generate</button><button class="btn btn--sm" id="svCopy">Copy</button></div>
    </div>
    <div class="output"><div class="output__bar"><span>LUA</span></div><pre id="svOut"></pre></div>
  </div></div>`;
  const out=container.querySelector('#svOut');
  const checks=[...container.querySelectorAll('#svGrid input')];
  function gen(){
    const sel=checks.filter(c=>c.checked).map(c=>c.value);
    if(sel.length===0){ out.textContent='-- selecione ao menos um service'; return; }
    out.textContent=sel.map(s=>`local ${s} = game:GetService("${s}")`).join('\n');
    container.dataset.output=out.textContent;
  }
  container.querySelector('#svAll').addEventListener('click', ()=>{ checks.forEach(c=>c.checked=true); gen(); });
  container.querySelector('#svNone').addEventListener('click', ()=>{ checks.forEach(c=>c.checked=false); gen(); });
  container.querySelector('#svGo').addEventListener('click', gen);
  container.querySelector('#svCopy').addEventListener('click', ()=> copyText(out.textContent||''));
  checks.forEach(c=> c.addEventListener('change', gen));
  container._getOutput=()=> out.textContent||'';
  gen();
}
