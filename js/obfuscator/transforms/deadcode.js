/**
 * Dead Code — pequenas quantidades plausíveis
 */
import { Random } from '../random.js';

export function transformDeadcode(ast, opts={}){
  const rnd=opts.random || new Random(opts.seed);
  const prob = opts.probability ?? 0.15;
  if(prob<=0 || ast.type!=='Chunk') return;

  function makeDead(){
    const r=rnd.int(0,3);
    if(r===0){
      const a=rnd.int(1,100), b=rnd.int(1,100);
      return { type:'RawStatement', code:`do local _d${rnd.int(10,99)}=${a}*${b}+${rnd.int(1,5)} end` };
    } else if(r===1){
      const tname=rnd.name('mangled',4,6);
      return { type:'RawStatement', code:`do local ${tname}={${rnd.int(1,5)},${rnd.int(1,5)}}; if #${tname}==999 then print(${tname}[1]) end end` };
    } else if(r===2){
      return { type:'RawStatement', code:`if (function() return false end)() then return end` };
    } else {
      const v=rnd.int(10,200);
      return { type:'RawStatement', code:`local _dead${rnd.int(100,999)}=${v} --[[dead]]` };
    }
  }

  // Inserir em Chunk e em blocos de funções
  function injectInBody(body){
    const out=[];
    body.forEach(stmt=>{
      out.push(stmt);
      if(rnd.float() < prob){
        out.push(makeDead());
      }
    });
    // ocasionalmente no início
    if(rnd.float()< prob*0.5) out.unshift(makeDead());
    return out;
  }

  function walk(node){
    if(node.type==='Chunk'){
      node.body=injectInBody(node.body);
    }
    if(node.type==='FunctionDeclaration' || node.type==='LocalFunction' || node.type==='FunctionExpression'){
      node.body=injectInBody(node.body);
    }
    // recurse
    for(const k in node){
      const v=node[k];
      if(Array.isArray(v)) v.forEach(e=> e && e.type && walk(e));
      else if(v && v.type) walk(v);
    }
  }
  walk(ast);
}
