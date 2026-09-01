/**
 * Constant Pool — opcional, mas sem leak.
 * Se strings estão protegidas, pool contém apenas representações codificadas.
 * Pool é: local _C = { <encoded> , ... } com ordem embaralhada.
 * Referências indiretas: _C[idx]
 */
import { Random } from '../random.js';

export function transformConstantPool(ast, opts={}){
  const rnd=opts.random || new Random(opts.seed);
  const enable = opts.enable ?? false;
  if(!enable) return;
  const threshold = opts.threshold ?? 2;
  const stringsOnly = opts.stringsOnly ?? true;

  // Coletar candidatos: numbers e strings que ainda são literals (não RawExpressions)
  const candidates=[];
  function collect(node){
    if(node.type==='NumericLiteral' && !stringsOnly){
      if(String(node.value).length >= threshold) candidates.push(node);
    }
    if(node.type==='StringLiteral'){
      // extrair inner length
      const raw=node.raw;
      let inner='';
      if(raw.startsWith('[[')) inner=raw.slice(2,-2);
      else inner=raw.slice(1,-1);
      if(inner.length >= threshold) candidates.push(node);
    }
    for(const k in node){
      const v=node[k];
      if(Array.isArray(v)) v.forEach(e=> e && e.type && collect(e));
      else if(v && v.type) collect(v);
    }
  }
  collect(ast);

  if(candidates.length < 2) return;

  // Dedup por valor
  const uniq=new Map();
  candidates.forEach(n=>{
    const key = n.type==='StringLiteral' ? n.raw : String(n.value);
    if(!uniq.has(key)) uniq.set(key, []);
    uniq.get(key).push(n);
  });
  const uniqList=[...uniq.entries()];
  if(uniqList.length < 2) return;

  // Embaralhar
  const shuffled=rnd.shuffle(uniqList);
  const poolName=rnd.name('mangled',6,8);
  const poolValues=shuffled.map(([raw,_])=> raw);

  // Se strings já foram encodadas, raw já será codificado (RawExpression) então não estamos neste pool.
  // Mas para garantir sem leak: se string é plaintext e intensidade high, não criar pool com plaintext quando strings protegidas ativas?
  // Aqui, strings já passaram por transformStrings antes, então se estavam protegidas, viraram RawExpression e não cairiam aqui.
  // Então pool contém apenas o que sobrou (não protegido), que é seguro.

  // Criar nó Pool
  const poolNode={
    type:'RawExpression',
    rawCode:`local ${poolName}={${poolValues.map(v=> v.startsWith('"')||v.startsWith("'")||v.startsWith('[') ? v : v).join(',')}}`
  };
  // Na verdade precisamos de local declaration, não RawExpression. Vamos inserir no topo do Chunk.

  // Substituir ocorrências por _C[idx]
  const indexMap=new Map();
  shuffled.forEach(([raw], idx)=>{
    indexMap.set(raw, idx+1);
  });
  candidates.forEach(n=>{
    const key = n.type==='StringLiteral' ? n.raw : String(n.value);
    const idx=indexMap.get(key);
    if(idx){
      n.type='RawExpression';
      n.rawCode=`${poolName}[${idx}]`;
      delete n.value; delete n.raw;
    }
  });

  // Inserir pool no topo
  if(ast.type==='Chunk'){
    // Inserir como RawStatement? Precisamos de um node que generator entenda como local.
    // Criar LocalStatement com init RawExpression
    const poolDecl={
      type:'RawStatement',
      code:`local ${poolName}={${poolValues.join(',')}}`
    };
    // Generator precisa suportar RawStatement — vamos adaptar generator para isso
    ast.body.unshift(poolDecl);
  }
}
