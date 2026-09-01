/**
 * Opaque Predicates — condições com resultado conhecido mas não óbvio.
 */
import { Random } from '../random.js';

const TRUE_PREDICATES=[
  '(function() local a=5; return a*2==10 end)()',
  '(string.len("abc")==3)',
  '(math.floor(4.7)==4)',
  '(tostring(123)=="123")',
  '((function() return true end)())',
  '(not false)',
  '(nil==nil)',
  '(type("a")=="string")'
];
const FALSE_PREDICATES=[
  '(function() local a=5; return a*2==11 end)()',
  '(string.len("abc")==4)',
  '(math.floor(4.7)==5)',
  '(tostring(123)=="124")',
  '((function() return false end)())',
  '(not true)',
  '(nil~=nil)',
  '(type("a")=="number")'
];

export function transformPredicates(ast, opts={}){
  const rnd=opts.random || new Random(opts.seed);
  const prob = opts.probability ?? 0.3;
  if(prob<=0) return;

  function wrapInOpaque(node, isTrue){
    const pred = isTrue ? rnd.choice(TRUE_PREDICATES) : rnd.choice(FALSE_PREDICATES);
    // criar if (pred) then <node> end  mas isso mudaria semântica; não vamos envolver statements com predicado falso que executa
    // Em vez disso, para statements, podemos inserir if pred then <original> end onde pred é sempre true, mas isso é detectável
    // Melhor: para IfStatement já existente, substituir condition true/false por predicate equivalente? Mas isso é mais seguro: true -> true predicate, false -> false predicate
    // Para statements soltos, inserir guard true que não altera: if pred then <stmt> end
    return node;
  }

  function walk(node){
    if(node.type==='IfStatement'){
      // Se algum clause tem condition true/false literal, substituir por predicate
      node.clauses.forEach(c=>{
        if(c.condition.type==='BooleanLiteral'){
          const isTrue=c.condition.value;
          const pred= isTrue ? rnd.choice(TRUE_PREDICATES) : rnd.choice(FALSE_PREDICATES);
          c.condition={ type:'RawExpression', rawCode:pred };
        }
      });
    }
    // Para outros statements, com prob baixa, envolver em opaque true
    if(rnd.float()< prob*0.2){
      // não implementar wrapping automático para não aumentar muito e quebrar; skip
    }
    for(const k in node){
      const v=node[k];
      if(Array.isArray(v)) v.forEach(e=> e && e.type && walk(e));
      else if(v && v.type) walk(v);
    }
  }
  walk(ast);
}
