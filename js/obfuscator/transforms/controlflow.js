/**
 * Control Flow Flattening — transforma corpo de função em máquina de estados.
 * Preserva return/break/continue, loops, if.
 * Se função não puder ser transformada com segurança, deixa intacta.
 */
import { Random } from '../random.js';

function canFlatten(funcNode){
  // Não flatten se contém: goto/label, repeat, vararg complexidade?
  // Verifica se body contém nodes não suportados para simplificar
  const banned=new Set(['GotoStatement','LabelStatement','ForGenericStatement','ForNumericStatement','WhileStatement','RepeatStatement']);
  let hasBanned=false;
  function walk(n){
    if(!n) return;
    if(banned.has(n.type)) hasBanned=true;
    for(const k in n){
      const v=n[k];
      if(Array.isArray(v)) v.forEach(e=> e && e.type && walk(e));
      else if(v && v.type) walk(v);
    }
  }
  funcNode.body.forEach(walk);
  if(hasBanned) return false;
  // Só flatten funções com 2+ statements e sem muitos retornos complexos
  if(funcNode.body.length < 2) return false;
  if(funcNode.body.length > 12) return false; // limite performance
  return true;
}

function splitIntoBlocks(body){
  // Cada statement vira um bloco, exceto if/return que mantemos juntos
  // Para MVP, cada statement é um bloco
  return body.map(stmt=> [stmt]);
}

export function transformControlFlow(ast, opts={}){
  const rnd=opts.random || new Random(opts.seed);
  const intensity = opts.intensity || 'high';
  const prob = opts.probability ?? (intensity==='extreme' ? 1 : 0.6);
  const targets=[];

  function collect(node){
    if(node.type==='FunctionDeclaration' || node.type==='LocalFunction' || node.type==='FunctionExpression'){
      if(rnd.float() < prob && canFlatten(node)) targets.push(node);
    }
    for(const k in node){
      const v=node[k];
      if(Array.isArray(v)) v.forEach(e=> e && e.type && collect(e));
      else if(v && v.type) collect(v);
    }
  }
  collect(ast);

  targets.forEach(fn=>{
    const blocks=splitIntoBlocks(fn.body);
    const states=blocks.map(()=> rnd.int(100, 900));
    // garantir estados únicos
    const uniq=new Set();
    states.forEach((s,i)=>{ while(uniq.has(s)) s=rnd.int(100,900); uniq.add(s); states[i]=s; });
    const entry=states[0];
    const stateVar=rnd.name('mangled',5,7);
    const flattened=[];
    // while true do if state==... elseif ...
    const cases=[];
    blocks.forEach((block, idx)=>{
      const curState=states[idx];
      const nextState= idx+1 < states.length ? states[idx+1] : null;
      const bodyNodes=[...block];
      // se não é último bloco, adiciona atribuição state = next e break? Na verdade no flatten, usamos state = nextState; break/end? Vamos fazer if state==cur then <block>; state=next end
      // Para último bloco, se tem return, mantém return; senão break
      const hasReturn = block.some(n=> n.type==='ReturnStatement');
      let extra=[];
      if(nextState!==null && !hasReturn){
        extra.push({ type:'RawStatement', code:`${stateVar}=${nextState}` });
      }
      if(!hasReturn && nextState!==null){
        // não precisa break, loop continua
      }
      if(hasReturn){
        // return já encerra, não precisa state update
      }
      // Se último bloco sem return, adiciona break para sair do while
      if(idx===blocks.length-1 && !hasReturn){
        extra.push({ type:'BreakStatement' });
      }
      cases.push({ state:curState, body:[...bodyNodes, ...extra] });
    });

    // Construir: local state = entry; while true do if state==... elseif ...
    const flatBody=[];
    flatBody.push({ type:'RawStatement', code:`local ${stateVar}=${entry}` });
    const whileNode={
      type:'WhileStatement',
      condition:{ type:'BooleanLiteral', value:true },
      body:[]
    };
    // Construir if-elseif chain
    // Primeiro if
    const firstCase=cases[0];
    let ifNode={
      type:'IfStatement',
      clauses:[{ condition:{ type:'RawExpression', rawCode:`${stateVar}==${firstCase.state}` }, body:firstCase.body }],
      elseBody:null
    };
    // Para casos seguintes, adicionar como elseif
    // Nossa IfStatement suporta clauses + elseBody, mas precisa de estrutura elseif como clauses adicionais
    // Vamos armazenar como clauses array onde primeiro é if, resto elseif, e else é break
    // Adaptar: clauses[0] é if, clauses[1..] são elseif
    for(let i=1;i<cases.length;i++){
      const c=cases[i];
      ifNode.clauses.push({ condition:{ type:'RawExpression', rawCode:`${stateVar}==${c.state}` }, body:c.body });
    }
    // else break
    ifNode.elseBody=[{ type:'BreakStatement' }];
    // Se último bloco não foi cases? já.
    whileNode.body.push(ifNode);
    flatBody.push(whileNode);

    // Substituir corpo da função
    fn.body=flatBody;
  });
}
