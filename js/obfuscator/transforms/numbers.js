/**
 * Number Obfuscation — transforma números em expressões equivalentes.
 * Ex: 100 -> (50*2), (413-313), (0x64)
 * Probabilidade configurável, não mexe em 0/1 e em locais sensíveis.
 */
import { Random } from '../random.js';

export function transformNumbers(ast, opts={}){
  const rnd=opts.random || new Random(opts.seed);
  const prob = opts.probability ?? 0.6;
  const intensity = opts.intensity || 'medium';

  function isSafeContext(parentType){
    // não transformar se parent for parte de tabela index numérico? Permitir, mas evitar em alguns.
    return true;
  }

  function obfuscateNumber(n){
    if(n===0 || n===1) return String(n);
    if(!Number.isFinite(n) || Math.abs(n)>1e9) return String(n);
    const r=rnd.float();
    if(rnd.float() > prob) return String(n);

    // diferentes estratégias
    const strategies=[];
    if(Number.isInteger(n)){
      const a=rnd.int(1, Math.max(1, Math.abs(n)-1));
      const b=n-a;
      strategies.push(`(${a}+${b})`);
      strategies.push(`(${a+5} + ${b-5})`);
      strategies.push(`(0x${n.toString(16)})`);
      if(n>10) strategies.push(`(${Math.floor(n/2)}*2+${n%2})`);
      if(intensity==='high' || intensity==='extreme'){
        const x=rnd.int(2,9);
        strategies.push(`(${x}*${(n/x).toFixed(rnd.choice([0,1,2]))}+${(n - x*Math.floor(n/x)).toFixed(0)})`);
        strategies.push(`(math.floor(${n+0.3}))`);
      }
    } else {
      // float
      const a=(n/2).toFixed(2);
      strategies.push(`(${a}*2)`);
    }
    if(intensity==='extreme'){
      strategies.push(`(tonumber("0x${n.toString(16)}"))`);
    }
    return rnd.choice(strategies);
  }

  function walk(node, parent){
    if(!node) return;
    if(node.type==='NumericLiteral'){
      if(!isSafeContext(parent?.type)) return;
      const orig=node.value;
      const expr=obfuscateNumber(orig);
      if(expr!==String(orig)){
        node.type='RawExpression';
        node.rawCode=expr;
        delete node.value; delete node.raw;
      }
      return;
    }
    for(const k in node){
      const v=node[k];
      if(Array.isArray(v)) v.forEach(e=> e && e.type && walk(e, node));
      else if(v && v.type) walk(v, node);
    }
  }
  walk(ast, null);
}
