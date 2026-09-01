/**
 * Boolean Obfuscation — true/false -> expressões equivalentes
 */
import { Random } from '../random.js';

export function transformBooleans(ast, opts={}){
  const rnd=opts.random || new Random(opts.seed);
  const prob = opts.probability ?? 0.5;
  const poolTrue=[
    '(4 < 5)', '(1==1)', '(not false)', '(true or false)', '(0==0)', '(5>3)', '(""=="")', '(not nil)',
    '(math.floor(2.5)==2)', '(string.len("a")==1)', '(2+2==4)'
  ];
  const poolFalse=[
    '(4 > 5)', '(1~=1)', '(not true)', '(false and true)', '(0~=0)', '(5<3)', '("a"=="b")', '(nil and true)',
    '(math.floor(2.5)==3)', '(string.len("")==1)', '(2+2==5)'
  ];
  function walk(node){
    if(!node) return;
    if(node.type==='BooleanLiteral'){
      if(rnd.float()>prob) return;
      const expr = node.value ? rnd.choice(poolTrue) : rnd.choice(poolFalse);
      // randomize numbers inside expression a bit
      let out=expr;
      if(rnd.float()<0.3){
        out=out.replace(/\b4\b/, String(rnd.int(2,9)))
               .replace(/\b5\b/, String(rnd.int(10,20)));
      }
      node.type='RawExpression';
      node.rawCode=out;
      delete node.value;
      return;
    }
    for(const k in node){
      const v=node[k];
      if(Array.isArray(v)) v.forEach(e=> e && e.type && walk(e));
      else if(v && v.type) walk(v);
    }
  }
  walk(ast);
}
