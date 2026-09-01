/**
 * Function Indirection — transforma algumas chamadas em referências indiretas
 * Ex: local _p=print; _p(...)
 */
import { Random } from '../random.js';

export function transformIndirection(ast, opts={}){
  const rnd=opts.random || new Random(opts.seed);
  const prob = opts.probability ?? 0.2;
  const cache=new Map(); // original name -> alias

  function walk(node, parent){
    if(node.type==='CallExpression'){
      // base pode ser Identifier ou MemberExpression
      if(node.base.type==='Identifier' && rnd.float()<prob){
        const orig=node.base.name;
        // não indirection para locals renomeados? Permitir mas só para globals como print, pairs, etc.
        const globals=new Set(['print','pairs','ipairs','next','tonumber','tostring','type','select','unpack','table','string','math','warn','error','assert']);
        if(globals.has(orig) || rnd.float()<0.1){
          let alias=cache.get(orig);
          if(!alias){
            alias=rnd.name('mangled',6,8);
            cache.set(orig, alias);
          }
          node.base.name=alias;
          // alias será declarado no topo via helper
        }
      }
    }
    for(const k in node){
      const v=node[k];
      if(Array.isArray(v)) v.forEach(e=> e && e.type && walk(e, node));
      else if(v && v.type) walk(v, node);
    }
  }
  walk(ast, null);

  if(cache.size>0 && ast.type==='Chunk'){
    const decls=[];
    for(const [orig, alias] of cache){
      decls.push({ type:'RawStatement', code:`local ${alias}=${orig}` });
    }
    ast.body.unshift(...decls);
  }
}
