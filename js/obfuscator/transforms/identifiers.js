/**
 * Identifier Renaming — scope-aware.
 * Renomeia apenas locals, params, loop vars, local functions.
 * Não toca globals, members (.name), table keys.
 */
import { Random } from '../random.js';

const RESERVED=new Set(['and','break','continue','do','else','elseif','end','false','for','function','if','in','local','nil','not','or','repeat','return','then','true','until','while']);

export function transformIdentifiers(ast, scope, opts={}){
  const rnd = opts.random || new Random(opts.seed);
  const style = opts.style || '_A7x9'; // _A7x9, _lIlII, _O0O0O, unicode, mangled
  const prefix = opts.prefix || '';
  const existing=new Set();

  // coletar todos os nomes já existentes para evitar colisão
  function collectNames(node){
    if(node.type==='Identifier') existing.add(node.name);
    for(const k in node){
      const v=node[k];
      if(Array.isArray(v)) v.forEach(e=> e && e.type && collectNames(e));
      else if(v && v.type) collectNames(v);
    }
  }
  collectNames(ast);

  // Para cada binding local, gerar novo nome
  function genName(orig){
    let tries=0;
    while(true){
      let n;
      if(style==='_A7x9') n='_'+String.fromCharCode(65+rnd.int(0,25))+rnd.int(0,9)+String.fromCharCode(97+rnd.int(0,25))+rnd.choice(['x','y','z'])+rnd.int(10,99);
      else if(style==='_lIlII') n='_' + Array.from({length:rnd.int(5,8)},()=> rnd.choice(['l','I','1','L'])).join('');
      else if(style==='_O0O0O') n='_' + Array.from({length:rnd.int(5,8)},()=> rnd.choice(['O','0','o','Q'])).join('');
      else if(style==='unicode'){
        // usar caracteres válidos mas diferentes: ainda precisa ser [A-Za-z_][A-Za-z0-9_] — unicode não é válido em Lua puro, então fallback para mangled
        n=rnd.name('mangled',6,10);
      } else {
        n=rnd.name('mangled',6,10);
      }
      if(prefix) n=prefix+n.replace(/^_/, '');
      if(!RESERVED.has(n) && !existing.has(n)){
        existing.add(n);
        return n;
      }
      if(++tries>50) return n+'_'+tries;
    }
  }

  // Walk scopes e renomeia
  function traverse(scope){
    for(const [orig, binding] of scope.bindings){
      if(binding.kind==='local' || binding.kind==='localFunction' || binding.kind==='param' || binding.kind==='loop'){
        if(RESERVED.has(orig)) continue;
        // não renomear _ENV etc? manter
        if(orig.startsWith('_ENV')) continue;
        const newName=genName(orig);
        binding.newName=newName;
        // atualizar decl nodes
        binding.declNodes.forEach(n=>{
          if(n.type==='Identifier') n.name=newName;
          // local function identifier base is string, not node — handled via binding.refs? For LocalFunction, decl is function node, but name string needs update?
          // LocalFunction stores identifier.base array; we need to patch that as well. We'll handle via AST patch later.
        });
        // atualizar refs
        binding.refs.forEach(ref=>{ ref.name=newName; });
        // para LocalFunction, patch identifier base
        if(binding.kind==='localFunction'){
          // find LocalFunction nodes that declare this name
          // refs already include identifier? LocalFunction identifier is not Identifier node, need to patch manually via traversing ast for LocalFunction with same name
        }
      }
    }
    scope.children.forEach(traverse);
  }
  traverse(scope);

  // Patch LocalFunction identifier strings (since they are not Identifier nodes)
  function patchLocalFunctions(node, scope){
    if(node.type==='LocalFunction' && node.identifier?.base){
      const orig=node.identifier.base[0];
      const binding=scope.resolve?.(orig) || scope.children.find(s=> s.bindings.has(orig))?.bindings.get(orig);
      // Instead, search globalScope
      // Simpler: walk all scopes to find binding
    }
  }

  // Simpler: walk AST and for each LocalFunction, look up its name in scope chain
  // We'll need globalScope reference. So do second pass with scope param
  function walkPatch(node, curScope){
    if(!node||!curScope) return;
    if(node.type==='LocalFunction' && node.identifier?.base){
      const orig=node.identifier.base[0];
      const b=curScope.resolve(orig);
      if(b && b.newName) node.identifier.base[0]=b.newName;
    }
    // descend with correct scope tracking
    // Determine child scope for this node
    let nextScope=curScope;
    // Find child scope that corresponds to this node's body
    // Heuristic: find scope whose type is function and whose parent is curScope
    // Instead, we track via recursion mirroring analyze traversal.

    // Generic recursion: if node introduces new scope, find it
    const introduces = ['Chunk','LocalFunction','FunctionDeclaration','FunctionExpression','ForNumericStatement','ForGenericStatement','WhileStatement','RepeatStatement','DoStatement','IfStatement'];
    if(introduces.includes(node.type)){
      // find child scope(s) — for If, there are multiple, but we handle simply by traversing children scopes in order
      // For simplicity, if node is function, nextScope is its child
      if(['LocalFunction','FunctionDeclaration','FunctionExpression'].includes(node.type)){
        const child=curScope.children.find(c=> c.isFunction);
        // But there may be multiple functions at same level, need to map by order. For now pick first unused.
        // We'll just walk AST and use scope stack, not rely on children order.
      }
    }

    // For patch, we just need to rename LocalFunction names; we can do without scope descent by using map
  }

  // Alternative easy: brute force rename LocalFunction base strings using same map we built
  // Build map orig->newName from all bindings
  const map=new Map();
  function collectMap(scope){
    for(const [k,v] of scope.bindings) if(v.newName) map.set(k, v.newName);
    scope.children.forEach(collectMap);
  }
  collectMap(scope);

  function patchAST(node){
    if(!node) return;
    if(node.type==='LocalFunction' && node.identifier?.base){
      const orig=node.identifier.base[0];
      if(map.has(orig)) node.identifier.base[0]=map.get(orig);
    }
    // also need to patch FunctionDeclaration that is local? Not needed.
    for(const k in node){
      const v=node[k];
      if(Array.isArray(v)) v.forEach(e=> e && e.type && patchAST(e));
      else if(v && v.type) patchAST(v);
    }
  }
  patchAST(ast);
}
