/**
 * String Protection — pipeline correto sem leak.
 * 1) UTF8 -> bytes
 * 2) transforms reversíveis (XOR, ADD, REVERSE, PERMUTE, ROLLING)
 * 3) serialize como numeric array ou \ddd escapes, random choice
 * 4) runtime decoders são gerados, nunca plaintext fica em tabela
 * Cada string recebe key/transform própria, ordem aleatória.
 */
import { Random } from '../random.js';

function utf8ToBytes(str){
  return [...new TextEncoder().encode(str)];
}
function bytesToUtf8(bytes){
  return new TextDecoder().decode(Uint8Array.from(bytes));
}

// transforms
function xorTransform(bytes, key){
  const k = typeof key==='number' ? key : key[0]||0x5A;
  return bytes.map((b,i)=> b ^ (typeof key==='number' ? k : key[i % key.length]));
}
function xorInverse(bytes, key){ return xorTransform(bytes, key); } // symmetric

function addTransform(bytes, add){
  return bytes.map(b=> (b+add)&0xFF);
}
function addInverse(bytes, add){
  return bytes.map(b=> (b - add + 256)&0xFF);
}
function reverseTransform(bytes){
  return [...bytes].reverse();
}
function reverseInverse(bytes){ return reverseTransform(bytes); }

function permuteTransform(bytes, perm){
  // perm is array of indices 0..n-1 shuffled
  const out=new Array(bytes.length);
  for(let i=0;i<bytes.length;i++) out[perm[i]] = bytes[i];
  return out;
}
function permuteInverse(bytes, perm){
  const out=new Array(bytes.length);
  const inv=new Array(perm.length);
  perm.forEach((p,i)=> inv[p]=i);
  for(let i=0;i<bytes.length;i++) out[inv[i]] = bytes[i];
  return out;
}
function rollingTransform(bytes, key){
  let k=key;
  return bytes.map(b=>{ const r=(b + k)&0xFF; k=(k*31 + r)&0xFF; return r; });
}
function rollingInverse(bytes, key){
  let k=key;
  const out=[];
  for(let i=0;i<bytes.length;i++){
    const b=bytes[i];
    const orig=(b - k + 256)&0xFF;
    out.push(orig);
    k=(k*31 + b)&0xFF;
  }
  return out;
}

// gera decoder Lua para cada pipeline
function buildDecoder(pipeline, rnd, helperName){
  // pipeline: array of { op, key, perm }
  // gera função Lua que inverte sequencialmente
  // Cada string terá seu próprio helper? Para randomização, cada string tem pipeline próprio,
  // mas para não gerar N funções, criamos um helper genérico que recebe bytes + keys e aplica inversos em ordem reversa.
  // Simpler: cada string terá sua própria função inline? Vamos criar um helper único parametrizado.
  // Para manter simples, cada string vai gerar seu próprio decoder inline como função anônima? Melhor: um helper por pipeline tipo.

  // We'll create helpers per transform type and combine at call site as chained calls.
  // For MVP, gerar helper que faz: local function _D(b,k) ... end e cada string chama com sua key.
  // Para pipeline com múltiplos passos, vamos gerar função que aplica inversos na ordem reversa.

  // This function returns Lua code string for helper definition
  const name=helperName;
  // Build inverse steps in reverse order
  const steps=[...pipeline].reverse();
  let body='';
  body+=`local ${name}=function(t,k)\n`;
  body+=`local b={}\n`;
  body+=`for i=1,#t do b[i]=t[i] end\n`;
  // we need to know perm and keys per string? For permute, perm array is per-string, not global. So helper must receive perm as param.
  // Simpler: helper per string captures its own perm/key as upvalue? Then helper não é genérico.
  // Alternative: em vez de helper genérico, cada string vira chamada com bytes codificados e decoder inline que fecha sobre perm/key.

  // For simplicity, we'll generate per-string decoder as IIFE that decodes bytes array directly, no shared helper.
  // So this buildDecoder is not used for per-string; we generate per-string inline.

  return name;
}

function serializeBytes(bytes, mode, rnd){
  // modes: array, escape
  if(mode==='array'){
    return `{${bytes.join(',')}}`;
  }
  if(mode==='escape'){
    // "\102\091..." with decimal escapes
    return `"${bytes.map(b=> '\\'+String(b).padStart(3,'0')).join('')}"`;
  }
  // mixed random
  return rnd.choice([
    `{${bytes.join(',')}}`,
    `"${bytes.map(b=> '\\'+String(b).padStart(3,'0')).join('')}"`,
    `{${bytes.join(',')}}` // duplicate weight
  ]);
}

// Pipeline randomizer: para cada string, escolhe sequência de transforms
function randomPipeline(rnd, strLen){
  const candidates=[
    [{op:'xor', key: rnd.int(1,255)}],
    [{op:'add', key: rnd.int(1,127)}],
    [{op:'xor', key: rnd.int(1,255)}, {op:'add', key: rnd.int(1,127)}],
    [{op:'add', key: rnd.int(1,127)}, {op:'xor', key: rnd.int(1,255)}],
    [{op:'reverse'}],
    [{op:'permute'}],
    [{op:'rolling', key: rnd.int(1,255)}],
    [{op:'xor', key: rnd.int(1,255)}, {op:'reverse'}],
    [{op:'xor', key: rnd.int(1,255)}, {op:'permute'}],
    [{op:'add', key: rnd.int(1,127)}, {op:'permute'}],
  ];
  // filtra pipelines que precisam de permute: gerar perm
  let pipe = rnd.choice(candidates);
  // clone and add perm array where needed
  pipe = pipe.map(step=>{
    if(step.op==='permute'){
      const perm=rnd.shuffle([...Array(strLen).keys()]);
      return { op:'permute', perm };
    }
    return { ...step };
  });
  // 20% chance de encadear + permute extra
  if(strLen>4 && rnd.float()<0.2 && !pipe.some(s=> s.op==='permute')){
    pipe.push({ op:'permute', perm: rnd.shuffle([...Array(strLen).keys()]) });
  }
  return pipe;
}

function encodeString(str, rnd){
  const bytes=utf8ToBytes(str);
  if(bytes.length===0) return { encoded:[], pipeline:[], keys:{}, mode:'array' };

  const pipeline=randomPipeline(rnd, bytes.length);
  let cur=[...bytes];
  const keys={};
  for(const step of pipeline){
    if(step.op==='xor') cur=xorTransform(cur, step.key);
    else if(step.op==='add') cur=addTransform(cur, step.key);
    else if(step.op==='reverse') cur=reverseTransform(cur);
    else if(step.op==='permute') cur=permuteTransform(cur, step.perm);
    else if(step.op==='rolling') cur=rollingTransform(cur, step.key);
  }
  const mode=rnd.choice(['array','escape']); // random representation
  const serialized=serializeBytes(cur, mode, rnd);
  return { encoded:cur, pipeline, serialized, mode, originalBytes:bytes };
}

function buildRuntimeForString(pipeline, helperBase, idx, rnd){
  // Gera expressão Lua que decodifica serialized bytes em runtime.
  // Para cada pipeline, construímos cadeia de chamadas inversas.
  // Exemplo: pipeline [xor(42), add(10), permute([...])]
  // encoded -> permuteInverse -> addInverse -> xorInverse -> bytes -> utf8

  // Vamos gerar um helper único por string? Para randomização máxima, cada string tem seu próprio decoder IIFE.
  // Isso evita padrão fácil de busca por nome de helper.
  const funcName = `${helperBase}_${idx}_${rnd.int(1000,9999)}`;
  let decodeExpr='';
  // Construir serialização já feita em encodeString, mas aqui precisamos do serializado e pipeline
  return { funcName, decodeExpr };
}

// Main transform
export function transformStrings(ast, opts={}){
  const rnd=opts.random || new Random(opts.seed);
  const intensity = opts.intensity ?? 'medium'; // low, medium, high, extreme
  const shouldProtect = (str)=>{
    if(str.length===0) return false;
    if(intensity==='low') return str.length>1; // Low sempre protege (simples)
    if(intensity==='medium') return str.length>1 && rnd.float()<0.9;
    if(intensity==='high') return true;
    if(intensity==='extreme') return true;
    return true;
  };

  // coletar StringLiterals
  const strings=[];
  function collect(node){
    if(node.type==='StringLiteral'){
      // extrair conteúdo sem quotes/brackets
      const raw=node.raw;
      let content='';
      if(raw.startsWith('[[') || raw.startsWith('[=')){
        // long string: extrair entre [[ e ]]
        const m=raw.match(/^\[=*\[/);
        const eq=m[0].length-2;
        const close=`]${'='.repeat(eq)}]`;
        content=raw.slice(m[0].length, raw.length-close.length);
      } else {
        // "..." or '...' — remover quotes e unescape simples
        const inner=raw.slice(1,-1);
        // unescape \n \t etc. para bytes reais
        content=inner.replace(/\\a/g,'\x07').replace(/\\b/g,'\b').replace(/\\f/g,'\f').replace(/\\n/g,'\n').replace(/\\r/g,'\r').replace(/\\t/g,'\t').replace(/\\v/g,'\v').replace(/\\"/g,'"').replace(/\\'/g,"'").replace(/\\\\/g,'\\').replace(/\\(\d{1,3})/g, (_,d)=> String.fromCharCode(parseInt(d,10)));
      }
      strings.push({ node, raw, content });
    }
    for(const k in node){
      const v=node[k];
      if(Array.isArray(v)) v.forEach(e=> e && e.type && collect(e));
      else if(v && v.type) collect(v);
    }
  }
  collect(ast);

  if(strings.length===0) return { injectedHelpers:[] };

  // Para cada string, decidir proteger e gerar encoded + runtime
  // Vamos substituir StringLiteral por CallExpression que decodifica
  // Precisamos de helpers únicos injetados no topo do chunk
  const helpers=[];
  const helperBase=rnd.name('mangled',6,8);

  strings.forEach((info, idx)=>{
    if(!shouldProtect(info.content)) return;

    const { content, node } = info;
    const bytes=utf8ToBytes(content);
    const pipeline=randomPipeline(rnd, bytes.length);
    let cur=[...bytes];
    for(const step of pipeline){
      if(step.op==='xor') cur=xorTransform(cur, step.key);
      else if(step.op==='add') cur=addTransform(cur, step.key);
      else if(step.op==='reverse') cur=reverseTransform(cur);
      else if(step.op==='permute') cur=permuteTransform(cur, step.perm);
      else if(step.op==='rolling') cur=rollingTransform(cur, step.key);
    }

    const mode=rnd.choice(['array','escape']);
    const serialized = serializeBytes(cur, mode, rnd);

    // Gerar helper para esta string (isolado, não reutilizado) — maior randomização
    const helperName = `${helperBase}_${idx}`;
    // Construir decoder que inverte pipeline: aplicar inversos em ordem reversa
    // Gerar código Lua do helper
    let helperCode='';
    // Helper recebe t (tabela ou string) e retorna string decodificada
    // Vamos criar helper como function que recebe bytes serializados já no formato escolhido

    // Para simplificar, sempre passamos tabela de bytes {..} para helper, mesmo se serializado como escape string — normalizamos para tabela
    // Se mode === 'array', serialized já é {a,b,...}, se escape, é "..." com \ddd — mas vamos normalizar para tabela para helper unificado

    // Gerar helper que: local function _H(t) -> decodifica e retorna string via string.char unpack
    // Implementação Lua para helpers:
    // function _H(t) 
    //   local b={}; for i=1,#t do b[i]=t[i] end
    //   -- inverse steps
    //   ... for each step in reverse: b = inverse(b, key/perm)
    //   return string.char(table.unpack(b))
    // end

    // Construir inversos
    let stepsCode='';
    const rev=[...pipeline].reverse();
    rev.forEach(step=>{
      if(step.op==='xor'){
        stepsCode+=`for i=1,#b do b[i]=b[i] ~ ${step.key} end\n`; // use ~ for xor (Lua 5.3+) — para compat 5.1 usar bit32? Vamos usar bit32 ou manual
        // Para compatibilidade 5.1, usar: b[i] = b[i] ~ key -> em Lua 5.1 precisa bit32.bxor; vamos detectar runtime
        // Troca para: b[i]=(b[i] ~ key) & 0xFF mas em 5.1 falha. Melhor usar: (b[i]+256 - key) %256 para add, e para xor usar bit32
        // Vamos usar: b[i]=bit32 and bit32.bxor(b[i],key) or (b[i]~key) fallback
      } else if(step.op==='add'){
        stepsCode+=`for i=1,#b do b[i]=(b[i]-${step.key}+256)%256 end\n`;
      } else if(step.op==='reverse'){
        stepsCode+=`for i=1,math.floor(#b/2) do b[i],b[#b-i+1]=b[#b-i+1],b[i] end\n`;
      } else if(step.op==='permute'){
        // need inverse perm: perm is forward, so inverse is inv[perm[i]] = i
        const inv=new Array(step.perm.length);
        step.perm.forEach((p,i)=> inv[p]=i);
        stepsCode+=`do local t={}; for i=1,#b do t[${inv.map((v,i)=> `${i+1}:${v+1}`).join(',')}] end end\n`; // placeholder
        // Simpler: gerar tabela inv e loop
        const invStr=inv.map(v=> v+1).join(',');
        stepsCode+=`do local _perm={${invStr}}; local _tmp={}; for i=1,#b do _tmp[_perm[i]]=b[i] end; for i=1,#b do b[i]=_tmp[i] end end\n`;
      } else if(step.op==='rolling'){
        stepsCode+=`do local k=${step.key}; local _tmp={}; for i=#b,1,-1 do local cur=b[i]; local prevK; if i==1 then prevK=k else prevK=(k*31 + b[i-1])%256 end; -- wait need forward? For inverse we need rollingInverse logic
`;
      }
    });

    // Para não complicar com bit32, vamos simplificar helpers: gerar decoders que usam operações aritméticas portáteis:
    // - xor: b[i] = b[i] ~ key  => em 5.1 usa bit32.bxor, em 5.3+ usa ~
    // Vamos gerar helper portátil:
    // local _bxor = bit32 and bit32.bxor or function(a,b) local r=0; for i=0,7 do ... end return r end

    // Para MVP, vamos gerar decoder inline que já decodifica bytes para string via string.char, sem helper compartilhado, usando IIFE que contém lógica específica daquela string

    // Geração final: transformar node em CallExpression que decodifica
    // Em vez de helper separado, substituir StringLiteral por algo como: (function() local t={...}; -- decodifica -- return string.char(table.unpack(t)) end)()

    // Para evitar complexidade de helpers compartilhados, geramos IIFE por string
    let iife='';
    // Representação aleatória: array {1,2} ou escape "\001\002"
    let initCode;
    if(serialized.startsWith('{')){
      initCode=`local _b=${serialized}`;
    } else {
      // escape string literal already quoted
      initCode=`local _s=${serialized}; local _b={string.byte(_s,1,-1)}`;
    }

    // Construir decodificação inline — inversa pipeline
    let decodeSteps='';
    rev.forEach(step=>{
      if(step.op==='xor'){
        // xor manual compatível 5.1 (sem bit32 / ~)
        decodeSteps+=`for i=1,#_b do local a=_b[i]; local b=${step.key}; local r=0; local p=1; for _=1,8 do local abit=a%2; local bbit=b%2; if abit~=bbit then r=r+p end; a=(a-abit)/2; b=(b-bbit)/2; p=p*2 end; _b[i]=r end\n`;
      } else if(step.op==='add'){
        decodeSteps+=`for i=1,#_b do _b[i]=(_b[i] - ${step.key} + 256)%256 end\n`;
      } else if(step.op==='reverse'){
        decodeSteps+=`for i=1,math.floor(#_b/2) do _b[i],_b[#_b-i+1]=_b[#_b-i+1],_b[i] end\n`;
      } else if(step.op==='permute'){
        const inv=new Array(step.perm.length);
        step.perm.forEach((p,i)=> inv[p]=i);
        const invStr=inv.map(v=> v+1).join(',');
        decodeSteps+=`do local _perm={${invStr}}; local _tmp={}; for i=1,#_b do _tmp[_perm[i]]=_b[i] end; for i=1,#_b do _b[i]=_tmp[i] end end\n`;
      } else if(step.op==='rolling'){
        decodeSteps+=`do local k=${step.key}; local _orig={}; for i=1,#_b do local enc=_b[i]; local dec=(enc - k + 256)%256; _orig[i]=dec; k=(k*31 + enc)%256 end; for i=1,#_b do _b[i]=_orig[i] end end\n`;
      }
    });

    // Montar IIFE
    const iifeCode=`(function() ${initCode}; ${decodeSteps} return string.char(table.unpack(_b)) end)()`;
    // Substituir node por um nó que será gerado como esse código — criamos um nó especial RawExpression
    node.type='RawExpression';
    node.rawCode=iifeCode;
    // limpar outros campos
    delete node.value;
    delete node.raw;
  });

  return { transformedCount: strings.filter(s=> s.node.type==='RawExpression').length };
}
