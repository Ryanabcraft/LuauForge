/**
 * Scope analysis — constrói cadeia de escopos, registra declaração e usos.
 * Cada escopo tem parent, children, bindings (name -> { declNode, kind, refs:[] })
 * Usado por transforms de rename para não quebrar globals / properties.
 */

export class Scope {
  constructor(parent=null, type='block'){
    this.parent=parent;
    this.type=type;
    this.bindings=new Map(); // name -> { declNodes:[], refs:[], kind }
    this.children=[];
    this.isFunction=false;
    if(parent) parent.children.push(this);
  }
  declare(name, node, kind='local'){
    if(!this.bindings.has(name)) this.bindings.set(name, { name, declNodes:[], refs:[], kind });
    this.bindings.get(name).declNodes.push(node);
  }
  // resolve nome subindo cadeia
  resolve(name){
    let cur=this;
    while(cur){
      if(cur.bindings.has(name)) return cur.bindings.get(name);
      cur=cur.parent;
    }
    return null;
  }
  // checa se nome é local em algum escopo (vs global)
  isLocal(name){
    return !!this.resolve(name);
  }
}

export function analyze(ast){
  const globalScope=new Scope(null,'global');
  let current=globalScope;

  function enter(scopeType='block'){
    const s=new Scope(current, scopeType);
    current=s;
    return s;
  }
  function leave(){
    if(current.parent) current=current.parent;
  }

  function walk(node){
    if(!node) return;
    switch(node.type){
      case 'Chunk':
        enter('chunk');
        node.body.forEach(walk);
        leave();
        break;
      case 'LocalStatement':
        node.variables.forEach(v=>{
          current.declare(v.name, v, 'local');
          // init exps podem referenciar outros locals já declarados
        });
        node.init.forEach(walk);
        // mark references in init? already walked
        break;
      case 'LocalFunction': {
        const name = node.identifier?.base?.[0];
        if(name) current.declare(name, node, 'localFunction');
        enter('function');
        current.isFunction=true;
        // params
        node.parameters.forEach(p=> current.declare(p.name, p, 'param'));
        if(node.isVararg) { /* ... not a binding */ }
        node.body.forEach(walk);
        leave();
        break;
      }
      case 'FunctionDeclaration': {
        // name is global/member, not local unless tricky
        // but function body is new scope
        enter('function');
        current.isFunction=true;
        // for method, self param implicit
        if(node.identifier?.isMethod){
          current.declare('self', {}, 'param');
        }
        node.parameters.forEach(p=> current.declare(p.name, p, 'param'));
        node.body.forEach(walk);
        leave();
        break;
      }
      case 'FunctionExpression': {
        enter('function');
        current.isFunction=true;
        node.parameters.forEach(p=> current.declare(p.name, p, 'param'));
        node.body.forEach(walk);
        leave();
        break;
      }
      case 'ForNumericStatement': {
        enter('for');
        current.declare(node.variable, {}, 'loop');
        walk(node.start); walk(node.end); if(node.step) walk(node.step);
        node.body.forEach(walk);
        leave();
        break;
      }
      case 'ForGenericStatement': {
        enter('for');
        node.variables.forEach(v=> current.declare(v, {}, 'loop'));
        node.iterators.forEach(walk);
        node.body.forEach(walk);
        leave();
        break;
      }
      case 'WhileStatement': {
        walk(node.condition);
        enter('while'); node.body.forEach(walk); leave();
        break;
      }
      case 'RepeatStatement': {
        enter('repeat'); node.body.forEach(walk); walk(node.condition); leave();
        break;
      }
      case 'DoStatement': {
        enter('do'); node.body.forEach(walk); leave();
        break;
      }
      case 'IfStatement': {
        node.clauses.forEach(c=>{
          walk(c.condition);
          enter('if');
          c.body.forEach(walk);
          leave();
        });
        if(node.elseBody){ enter('else'); node.elseBody.forEach(walk); leave(); }
        break;
      }
      case 'ReturnStatement': node.arguments.forEach(walk); break;
      case 'AssignmentStatement': node.variables.forEach(walk); node.init.forEach(walk); break;
      case 'CallStatement': walk(node.expression); break;
      case 'BinaryExpression': walk(node.left); walk(node.right); break;
      case 'UnaryExpression': walk(node.argument); break;
      case 'MemberExpression': walk(node.base); /* identifier is property, not var */ break;
      case 'IndexExpression': walk(node.base); walk(node.index); break;
      case 'CallExpression': walk(node.base); node.arguments.forEach(walk); break;
      case 'StringCallExpression': walk(node.base); walk(node.argument); break;
      case 'TableCallExpression': walk(node.base); walk(node.arguments[0]); break;
      case 'TableConstructorExpression': node.fields.forEach(f=>{
        if(f.type==='TableKey'){ /* key is identifier literal, not var */ walk(f.value); }
        else if(f.type==='TableKeyString'){ walk(f.key); walk(f.value); }
        else walk(f.value);
      }); break;
      case 'Identifier': {
        // register ref if it's local, else global (ignore)
        const binding=current.resolve(node.name);
        if(binding) binding.refs.push(node);
        break;
      }
      default: {
        // generic walk for any child that is node or array of nodes
        for(const k in node){
          const v=node[k];
          if(Array.isArray(v)) v.forEach(e=>{ if(e && typeof e==='object' && e.type) walk(e); });
          else if(v && typeof v==='object' && v.type) walk(v);
        }
        break;
      }
    }
  }

  walk(ast);
  return globalScope;
}

export function collectLocals(globalScope){
  const out=[];
  function traverse(scope){
    for(const [name, binding] of scope.bindings){
      if(binding.kind==='local' || binding.kind==='localFunction' || binding.kind==='param' || binding.kind==='loop'){
        out.push(binding);
      }
    }
    scope.children.forEach(traverse);
  }
  traverse(globalScope);
  return out;
}
