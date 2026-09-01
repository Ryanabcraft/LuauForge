/**
 * Generator — AST -> Lua code.
 * Preserva semântica, gera pretty ou minified.
 */
function gen(node, opts={}){
  const minify=opts.minify||false;
  const sep = minify ? '' : ' ';
  const nl = minify ? ';' : '\n';
  const indentStr = minify ? '' : '    ';

  function join(list, sepChar){
    return list.map(n=> generate(n, opts)).join(sepChar);
  }

  function generate(n, o, depth=0){
    if(!n) return '';
    const indent = minify ? '' : indentStr.repeat(depth);
    const childOpts = { ...o, depth };

    switch(n.type){
      case 'Chunk':
        return n.body.map(s=> generate(s, o, depth)).join(nl);
      case 'LocalStatement': {
        const vars = n.variables.map(v=> v.name).join(','+sep);
        if(n.init && n.init.length){
          return `local ${vars}=${n.init.map(e=> generate(e,o,depth)).join(','+sep)}`;
        }
        return `local ${vars}`;
      }
      case 'AssignmentStatement': {
        const vars = n.variables.map(v=> generate(v,o,depth)).join(','+sep);
        const exps = n.init.map(e=> generate(e,o,depth)).join(','+sep);
        return `${vars}=${exps}`;
      }
      case 'CallStatement':
        return generate(n.expression, o, depth);
      case 'LocalFunction': {
        const name = n.identifier ? (Array.isArray(n.identifier.base) ? n.identifier.base.join('.') : n.identifier.base) : '';
        const params = n.parameters.map(p=> p.name).join(','+sep) + (n.isVararg ? (n.parameters.length?','+sep:'')+'...' : '');
        const body = n.body.map(s=> generate(s,o,depth+1)).join(nl);
        const mid = body ? nl + body + nl + indent : '';
        return `local function ${name}(${params})${mid}end`;
      }
      case 'FunctionDeclaration': {
        let name='';
        if(n.identifier){
          name = n.identifier.base.join('.');
          if(n.identifier.isMethod) name += ':'+n.identifier.method;
        }
        const params = n.parameters.map(p=> p.name).join(','+sep) + (n.isVararg ? (n.parameters.length?','+sep:'')+'...' : '');
        const body = n.body.map(s=> generate(s,o,depth+1)).join(nl);
        const mid = body ? nl + body + nl + indent : '';
        return `function ${name}(${params})${mid}end`;
      }
      case 'FunctionExpression': {
        const params = n.parameters.map(p=> p.name).join(','+sep) + (n.isVararg ? (n.parameters.length?','+sep:'')+'...' : '');
        const body = n.body.map(s=> generate(s,o,depth+1)).join(nl);
        const mid = body ? nl + body + nl + indentStr.repeat(depth) : '';
        return `function(${params})${mid}end`;
      }
      case 'IfStatement': {
        let out='';
        n.clauses.forEach((c,i)=>{
          const kw = i===0 ? 'if' : 'elseif';
          out += `${i===0? '' : nl+indent}${kw} ${generate(c.condition,o,depth)} then${nl}${c.body.map(s=> generate(s,o,depth+1)).join(nl)}`;
        });
        if(n.elseBody){
          out += `${nl+indent}else${nl}${n.elseBody.map(s=> generate(s,o,depth+1)).join(nl)}`;
        }
        out += `${nl+indent}end`;
        return out;
      }
      case 'WhileStatement':
        return `while ${generate(n.condition,o,depth)} do${nl}${n.body.map(s=> generate(s,o,depth+1)).join(nl)}${nl+indent}end`;
      case 'RepeatStatement':
        return `repeat${nl}${n.body.map(s=> generate(s,o,depth+1)).join(nl)}${nl+indent}until ${generate(n.condition,o,depth)}`;
      case 'DoStatement':
        return `do${nl}${n.body.map(s=> generate(s,o,depth+1)).join(nl)}${nl+indent}end`;
      case 'ForNumericStatement': {
        const step = n.step ? `,${generate(n.step,o,depth)}` : '';
        return `for ${n.variable}=${generate(n.start,o,depth)},${generate(n.end,o,depth)}${step} do${nl}${n.body.map(s=> generate(s,o,depth+1)).join(nl)}${nl+indent}end`;
      }
      case 'ForGenericStatement': {
        const vars = n.variables.join(','+sep);
        const iters = n.iterators.map(e=> generate(e,o,depth)).join(','+sep);
        return `for ${vars} in ${iters} do${nl}${n.body.map(s=> generate(s,o,depth+1)).join(nl)}${nl+indent}end`;
      }
      case 'ReturnStatement':
        if(!n.arguments || !n.arguments.length) return 'return';
        return `return ${n.arguments.map(e=> generate(e,o,depth)).join(','+sep)}`;
      case 'BreakStatement': return 'break';
      case 'ContinueStatement': return 'continue';
      case 'LabelStatement': return `::${n.label}::`;
      case 'GotoStatement': return `goto ${n.label}`;
      case 'BinaryExpression': {
        const isWord = n.operator==='and' || n.operator==='or';
        const op = isWord ? ` ${n.operator} ` : `${sep}${n.operator}${sep}`;
        return `${generate(n.left,o,depth)}${op}${generate(n.right,o,depth)}`;
      }
      case 'UnaryExpression': {
        if(n.operator==='not') return `not ${generate(n.argument,o,depth)}`;
        return `${n.operator}${generate(n.argument,o,depth)}`;
      }
      case 'MemberExpression': {
        const base = generate(n.base,o,depth);
        const idx = n.identifier.name;
        return n.indexer===':' ? `${base}:${idx}` : `${base}.${idx}`;
      }
      case 'IndexExpression':
        return `${generate(n.base,o,depth)}[${generate(n.index,o,depth)}]`;
      case 'CallExpression': {
        const base = generate(n.base,o,depth);
        const args = n.arguments.map(e=> generate(e,o,depth)).join(','+sep);
        return `${base}(${args})`;
      }
      case 'StringCallExpression':
        return `${generate(n.base,o,depth)}${generate(n.argument,o,depth)}`;
      case 'TableCallExpression':
        return `${generate(n.base,o,depth)}${generate(n.arguments[0],o,depth)}`;
      case 'TableConstructorExpression': {
        if(!n.fields.length) return '{}';
        const fields = n.fields.map(f=>{
          if(f.type==='TableKey') return `${f.key.name}${sep}=${sep}${generate(f.value,o,depth)}`;
          if(f.type==='TableKeyString') return `[${generate(f.key,o,depth)}]${sep}=${sep}${generate(f.value,o,depth)}`;
          return generate(f.value,o,depth);
        }).join(','+sep);
        if(minify) return `{${fields}}`;
        // pretty: multiline if many fields
        if(fields.length>60 || n.fields.length>3){
          const inner = n.fields.map(f=>{
            if(f.type==='TableKey') return indent+indentStr+`${f.key.name}${sep}=${sep}${generate(f.value,o,depth+1)}`;
            if(f.type==='TableKeyString') return indent+indentStr+`[${generate(f.key,o,depth+1)}]${sep}=${sep}${generate(f.value,o,depth+1)}`;
            return indent+indentStr+generate(f.value,o,depth+1);
          }).join(','+nl);
          return `{${nl}${inner}${nl+indent}}`;
        }
        return `{${fields}}`;
      }
      case 'Identifier': return n.name;
      case 'NumericLiteral':
      case 'NumberLiteral': return n.raw ?? String(n.value);
      case 'StringLiteral': return n.raw ?? `"${n.value}"`;
      case 'NilLiteral': return 'nil';
      case 'BooleanLiteral': return n.value ? 'true' : 'false';
      case 'VarargLiteral': return '...';
      case 'RawExpression': return n.rawCode;
      case 'RawStatement': return n.code;
      default: return '';
    }
  }

  return generate;
}

export function generate(ast, opts={}){
  const genFn = gen(null, opts);
  // need to handle top-level
  // create wrapper that dispatches
  function dispatch(node, depth){
    return gen(node, opts)(node, opts, depth);
  }
  if(ast.type==='Chunk'){
    const sep = opts.minify ? ';' : '\n';
    const body = ast.body.map(s=> dispatch(s,0)).join(sep);
    return body;
  }
  return dispatch(ast,0);
}
