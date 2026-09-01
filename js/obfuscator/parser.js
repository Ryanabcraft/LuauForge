/**
 * Parser Lua/Luau — gera AST mínima mas com escopo correto.
 * Baseado em Recursive Descent, suporta chunk, block, stats, exps.
 * Não tenta ser completo 100% da gramática Luau, mas cobre suite de testes:
 * locals, functions, if, for, while, repeat, tables, calls, varargs, methods.
 */
import { tokenize } from './tokenizer.js';

function makeNode(type, props){ return { type, ...props }; }

// Precedência de operadores (Pratt)
const PRECEDENCE={
  'or':1,'and':2,
  '<':3,'>':3,'<=':3,'>=':3,'~=':3,'==':3,
  '|':4,'~':5,'&':6,'<<':7,'>>':7,
  '..':8,
  '+':9,'-':9,
  '*':10,'/':10,'//':10,'%':10,
  '^':12 // right associative
};

export class Parser {
  constructor(tokens, src){
    this.tokens=tokens; this.pos=0; this.src=src;
  }
  peek(off=0){ return this.tokens[this.pos+off]||{type:'Eof',value:'<eof>'}; }
  consume(){ const t=this.peek(); this.pos++; return t; }
  expectValue(v){
    const t=this.peek();
    if(t.value!==v) throw new Error(`Expected '${v}' but got '${t.value}' at ${t.line}:${t.col}`);
    return this.consume();
  }
  expectType(type){
    const t=this.peek();
    if(t.type!==type) throw new Error(`Expected ${type} but got ${t.type} ${t.value}`);
    return this.consume();
  }
  check(v){ return this.peek().value===v; }
  checkType(t){ return this.peek().type===t; }

  parse(){
    const body=this.parseBlock();
    this.expectType('Eof');
    return makeNode('Chunk',{ body, source:this.src });
  }
  parseBlock(){
    const stats=[];
    while(!this.isBlockEnd()){
      if(this.check(';')){ this.consume(); continue; }
      if(this.check('::')){ // label
        this.consume(); const name=this.expectType('Name').value; this.expectValue('::');
        stats.push(makeNode('LabelStatement',{ label:name })); continue;
      }
      if(this.checkType('Eof')) break;
      const s=this.parseStat();
      if(s) stats.push(s);
      if(this.check(';')) this.consume();
    }
    return stats;
  }
  isBlockEnd(){
    const v=this.peek().value;
    return v==='end'||v==='else'||v==='elseif'||v==='until'||v==='Eof';
  }
  parseStat(){
    const t=this.peek();
    if(t.value==='break'){ this.consume(); if(this.check(';')) this.consume(); return makeNode('BreakStatement',{}); }
    if(t.value==='continue'){ this.consume(); return makeNode('ContinueStatement',{}); }
    if(t.value==='do'){ this.consume(); const body=this.parseBlock(); this.expectValue('end'); return makeNode('DoStatement',{ body }); }
    if(t.value==='while'){ this.consume(); const cond=this.parseExp(); this.expectValue('do'); const body=this.parseBlock(); this.expectValue('end'); return makeNode('WhileStatement',{ condition:cond, body }); }
    if(t.value==='repeat'){ this.consume(); const body=this.parseBlock(); this.expectValue('until'); const cond=this.parseExp(); return makeNode('RepeatStatement',{ body, condition:cond }); }
    if(t.value==='if'){ return this.parseIf(); }
    if(t.value==='for'){ return this.parseFor(); }
    if(t.value==='function'){ return this.parseFunction(false); }
    if(t.value==='local'){
      // need lookahead: local function, local NAME, local NAME : type
      if(this.peek(1).value==='function') return this.parseFunction(true);
      return this.parseLocal();
    }
    if(t.value==='return'){
      this.consume();
      const exps=[];
      if(!this.isBlockEnd() && this.peek().value!==';'){
        exps.push(this.parseExp());
        while(this.check(',')){ this.consume(); exps.push(this.parseExp()); }
      }
      if(this.check(';')) this.consume();
      return makeNode('ReturnStatement',{ arguments:exps });
    }
    if(t.value==='goto'){ this.consume(); const label=this.expectType('Name').value; return makeNode('GotoStatement',{ label }); }

    // assignment or call
    // try parse var list
    const startPos=this.pos;
    const first=this.parsePrefixExp();
    // check if next is assignment
    if(this.check(',')||this.check('=')){
      // it's assignment : first is var
      const vars=[first];
      while(this.check(',')){ this.consume(); vars.push(this.parsePrefixExp()); }
      this.expectValue('=');
      const exps=[this.parseExp()];
      while(this.check(',')){ this.consume(); exps.push(this.parseExp()); }
      return makeNode('AssignmentStatement',{ variables:vars, init:exps });
    }
    // check compound assign Luau += etc? Treat as assignment sugar: a += b => a = a + b
    // detect Symbol like +=
    if(['+=','-=','*=','/=','%=','^=','..='].includes(this.peek().value)){
      const op=this.consume().value.slice(0,-1); // + from +=
      const rhs=this.parseExp();
      // desugar: var = var op rhs
      return makeNode('AssignmentStatement',{ variables:[first], init:[ makeNode('BinaryExpression',{ operator:op, left:first, right:rhs }) ], isCompound:true, operator:op });
    }
    // otherwise it's call statement (first already is expr)
    // Ensure it's call
    if(first.type==='CallExpression' || first.type==='StringCallExpression' || first.type==='TableCallExpression' || first.type==='Identifier' || first.type==='MemberExpression' || first.type==='IndexExpression'){
      // verify it's call-like, but we treat any prefix as statement if it is call
      // If first is not call but is plain identifier, we still allow? For `foo` as statement, it's expression statement (call without parens not valid, but allow)
      if(first.type==='CallExpression' || first.type==='StringCallExpression' || first.type==='TableCallExpression'){
        return makeNode('CallStatement',{ expression:first });
      }
      // Check if we parsed var but not call: maybe it's `foo:bar()` without assignment — first would be call already
      // For `obj.method()` we already parsed as CallExpression
      // So fallback: expression statement
      return makeNode('CallStatement',{ expression:first });
    }
    throw new Error(`Unexpected statement start ${t.value} at ${t.line}:${t.col}`);
  }

  parseIf(){
    this.expectValue('if');
    const cond=this.parseExp(); this.expectValue('then');
    const thenBody=this.parseBlock();
    const clauses=[makeNode('IfClause',{ condition:cond, body:thenBody })];
    const elseifs=[];
    while(this.check('elseif')){
      this.consume();
      const c=this.parseExp(); this.expectValue('then'); const b=this.parseBlock();
      elseifs.push(makeNode('ElseifClause',{ condition:c, body:b }));
    }
    let elseBody=null;
    if(this.check('else')){ this.consume(); elseBody=this.parseBlock(); }
    this.expectValue('end');
    return makeNode('IfStatement',{ clauses: [...clauses, ...elseifs], elseBody });
  }

  parseFor(){
    this.expectValue('for');
    const name=this.expectType('Name').value;
    if(this.check('=')){
      this.consume();
      const start=this.parseExp(); this.expectValue(','); const end=this.parseExp();
      let step=null; if(this.check(',')){ this.consume(); step=this.parseExp(); }
      this.expectValue('do'); const body=this.parseBlock(); this.expectValue('end');
      return makeNode('ForNumericStatement',{ variable:name, start, end, step, body });
    } else {
      // generic for: for a,b in explist do
      const vars=[name];
      while(this.check(',')){ this.consume(); vars.push(this.expectType('Name').value); }
      this.expectValue('in'); const iterators=[this.parseExp()]; while(this.check(',')){ this.consume(); iterators.push(this.parseExp()); }
      this.expectValue('do'); const body=this.parseBlock(); this.expectValue('end');
      return makeNode('ForGenericStatement',{ variables:vars, iterators, body });
    }
  }

  parseLocal(){
    this.expectValue('local');
    // could be local NAME attribs : type = init
    const firstName=this.expectType('Name').value;
    // handle type annotation : Type (Luau) — skip until = or , or newline? Simple: if next is ':', skip type
    if(this.check(':')){
      this.consume();
      // skip type tokens until we hit ',' '=' or block end. Heuristic: consume until ',' '=' or keyword.
      // Consume one type name and generics < > | & etc. For simplicity, consume until ',' or '=' or 'in'/'do'
      let depth=0;
      while(this.pos < this.tokens.length){
        const v=this.peek().value;
        if(depth===0 && (v===',' || v==='=' || v==='in' || v==='do' || v===';' || v==='Eof' || v==='end')) break;
        if(v==='<'||v==='('||v==='{'||v==='[') depth++;
        if(v==='>'||v===')'||v==='}'||v===']') depth=Math.max(0,depth-1);
        // stop at '|' '&' continue
        this.consume();
      }
    }
    // check if it's `local Name` with more names
    const names=[firstName];
    // handle attributes <const>/<close>
    if(this.check('<')){ // <const>
      this.consume(); while(!this.check('>') && !this.checkType('Eof')) this.consume(); if(this.check('>')) this.consume();
    }
    while(this.check(',')){
      this.consume();
      const n=this.expectType('Name').value;
      if(this.check(':')){ this.consume(); // skip type
        let depth=0;
        while(this.pos < this.tokens.length){
          const v=this.peek().value;
          if(depth===0 && (v===',' || v==='=')) break;
          if(v==='<'||v==='('||v==='{'||v==='[') depth++;
          if(v==='>'||v===')'||v==='}'||v===']') depth=Math.max(0,depth-1);
          this.consume();
        }
      }
      if(this.check('<')){ this.consume(); while(!this.check('>')) this.consume(); this.consume(); }
      names.push(n);
    }
    let init=[];
    if(this.check('=')){
      this.consume();
      init.push(this.parseExp());
      while(this.check(',')){ this.consume(); init.push(this.parseExp()); }
    }
    return makeNode('LocalStatement',{ variables:names.map(n=> makeNode('Identifier',{ name:n })), init });
  }

  parseFunction(isLocal){
    if(isLocal){
      this.expectValue('local');
      this.expectValue('function');
    } else {
      this.expectValue('function');
    }
    let name=null, isMethod=false, methodSelf=null;
    if(!this.check('(')){
      // parse func name: Name (. Name)* (: Name)?
      const first=this.expectType('Name').value;
      let parts=[first];
      while(this.check('.')){ this.consume(); parts.push(this.expectType('Name').value); }
      if(this.check(':')){ this.consume(); isMethod=true; methodSelf=this.expectType('Name').value; }
      name={ base:parts, isMethod, method:methodSelf };
    }
    this.expectValue('(');
    const params=[];
    let isVararg=false;
    if(!this.check(')')){
      while(true){
        if(this.check('...')){ this.consume(); isVararg=true; break; }
        const p=this.expectType('Name').value;
        // Luau type annotation : Type
        if(this.check(':')){
          this.consume();
          // skip type
          let depth=0;
          while(this.pos < this.tokens.length){
            const v=this.peek().value;
            if(depth===0 && (v===','||v===')')) break;
            if(v==='<'||v==='('||v==='{'||v==='[') depth++;
            if(v==='>'||v===')'||v==='}'||v===']') depth=Math.max(0,depth-1);
            // for generic, just consume one token
            if(depth===0 && v===',') break;
            this.consume();
          }
        }
        params.push(makeNode('Identifier',{ name:p }));
        if(this.check(',')){ this.consume(); if(this.check(')')) break; else continue; }
        if(this.check('...')){ this.consume(); isVararg=true; break; }
        break;
      }
    }
    this.expectValue(')');
    // Luau return type annotation : Type ? skip
    if(this.check(':')){
      this.consume();
      let depth=0;
      while(!this.checkType('Eof') && !(depth===0 && (this.peek().value==='end' || this.peek().value==='do' ))){
        // very loose, just consume until block start
        if(this.peek().value==='do' || this.peek().value==='end') break;
        // Actually after ) : Type, next is block. So consume until we are at block start (not inside). For simplicity, if we see 'do' break.
        // But function body starts immediately, so we need to detect when block starts: we expect not to consume block keyword.
        // So if next tokens look like statement start, break.
        // Heuristic: if peek is name and peek(1) is '=' etc, it's body.
        break;
      }
    }
    const body=this.parseBlock();
    this.expectValue('end');
    if(isLocal) return makeNode('LocalFunction',{ identifier: name, parameters:params, isVararg, body });
    return makeNode('FunctionDeclaration',{ identifier:name, parameters:params, isVararg, body, isMethod });
  }

  // Expressions — Pratt
  parseExp(minPrec=0){
    let left=this.parseUnary();
    while(true){
      const op=this.peek().value;
      const prec=PRECEDENCE[op];
      if(prec==null || prec < minPrec) break;
      this.consume();
      const nextMin = prec + (op==='^' || op==='..' ? 0 : 1);
      const right=this.parseExp(nextMin);
      left=makeNode('BinaryExpression',{ operator:op, left, right });
    }
    return left;
  }
  parseUnary(){
    const op=this.peek().value;
    if(op==='not' || op==='-' || op==='#' || op==='~'){
      this.consume();
      const arg=this.parseExp(PRECEDENCE['^']+1);
      return makeNode('UnaryExpression',{ operator:op, argument:arg });
    }
    return this.parsePrimary();
  }
  parsePrimary(){
    let exp=this.parseAtom();
    while(true){
      if(this.check('.')){
        this.consume(); const prop=this.expectType('Name').value;
        exp=makeNode('MemberExpression',{ base:exp, identifier:makeNode('Identifier',{name:prop}), indexer:'.' });
      } else if(this.check(':')){
        this.consume(); const method=this.expectType('Name').value;
        exp=makeNode('MemberExpression',{ base:exp, identifier:makeNode('Identifier',{name:method}), indexer:':' });
        // call follows
        exp=this.parseCall(exp);
      } else if(this.check('[')){
        this.consume(); const idx=this.parseExp(); this.expectValue(']'); exp=makeNode('IndexExpression',{ base:exp, index:idx });
      } else if(this.check('(') || this.checkType('String') || this.check('{')){
        exp=this.parseCall(exp);
      } else break;
    }
    return exp;
  }
  parseCall(base){
    if(this.check('(')){
      this.consume();
      const args=[];
      if(!this.check(')')){
        args.push(this.parseExp());
        while(this.check(',')){ this.consume(); args.push(this.parseExp()); }
      }
      this.expectValue(')');
      return makeNode('CallExpression',{ base, arguments:args });
    }
    if(this.checkType('String')){
      const s=this.consume();
      return makeNode('StringCallExpression',{ base, argument:makeNode('StringLiteral',{ value:s.value, raw:s.raw }) });
    }
    if(this.check('{')){
      const tbl=this.parseTable();
      return makeNode('TableCallExpression',{ base, arguments:[tbl] });
    }
    return base;
  }
  parseAtom(){
    const t=this.peek();
    if(t.type==='Number'){
      this.consume(); return makeNode('NumericLiteral',{ value: parseFloat(t.value.replace(/_/g,'')), raw:t.raw });
    }
    if(t.type==='String'){
      this.consume(); return makeNode('StringLiteral',{ value:t.value, raw:t.raw });
    }
    if(t.value==='nil'){ this.consume(); return makeNode('NilLiteral',{ value:null }); }
    if(t.value==='true'){ this.consume(); return makeNode('BooleanLiteral',{ value:true }); }
    if(t.value==='false'){ this.consume(); return makeNode('BooleanLiteral',{ value:false }); }
    if(t.value==='...'){ this.consume(); return makeNode('VarargLiteral',{ value:'...' }); }
    if(t.value==='function'){ return this.parseFunctionExpr(); }
    if(t.type==='Name'){
      this.consume(); return makeNode('Identifier',{ name:t.value });
    }
    if(t.value==='{'){ return this.parseTable(); }
    if(t.value==='('){
      this.consume(); const e=this.parseExp(); this.expectValue(')'); return e;
    }
    throw new Error(`Unexpected token ${t.value} at ${t.line}:${t.col}`);
  }
  parseFunctionExpr(){
    this.expectValue('function');
    this.expectValue('(');
    const params=[]; let isVararg=false;
    if(!this.check(')')){
      while(true){
        if(this.check('...')){ this.consume(); isVararg=true; break; }
        const p=this.expectType('Name').value;
        if(this.check(':')){ this.consume(); while(!this.check(',') && !this.check(')') && !this.checkType('Eof')) this.consume(); }
        params.push(makeNode('Identifier',{ name:p }));
        if(this.check(',')){ this.consume(); continue; }
        if(this.check('...')){ this.consume(); isVararg=true; break; }
        break;
      }
    }
    this.expectValue(')');
    const body=this.parseBlock(); this.expectValue('end');
    return makeNode('FunctionExpression',{ parameters:params, isVararg, body });
  }
  parseTable(){
    this.expectValue('{');
    const fields=[];
    while(!this.check('}') && !this.checkType('Eof')){
      if(this.check(',' )||this.check(';')){ this.consume(); continue; }
      // try parse field
      // Could be [exp]=exp , Name=exp , exp
      if(this.check('[')){
        this.consume(); const k=this.parseExp(); this.expectValue(']'); this.expectValue('='); const v=this.parseExp();
        fields.push(makeNode('TableKeyString',{ key:k, value:v }));
      } else {
        // lookahead Name '=' ?
        if(this.peek().type==='Name' && this.peek(1).value==='='){
          const k=this.consume().value; this.consume(); const v=this.parseExp();
          fields.push(makeNode('TableKey',{ key:makeNode('Identifier',{name:k}), value:v }));
        } else {
          const v=this.parseExp();
          fields.push(makeNode('TableValue',{ value:v }));
        }
      }
      if(this.check(',')||this.check(';')) this.consume();
    }
    this.expectValue('}');
    return makeNode('TableConstructorExpression',{ fields });
  }
  // prefix exp for stats: could be var or call chain start
  parsePrefixExp(){
    let base;
    if(this.check('(')){
      this.consume(); base=this.parseExp(); this.expectValue(')'); // paren
      // base is exp
    } else if(this.peek().type==='Name'){
      const id=this.consume(); base=makeNode('Identifier',{ name:id.value });
    } else {
      throw new Error(`Expected prefix at ${this.peek().value}`);
    }
    while(true){
      if(this.check('.')){ this.consume(); const prop=this.expectType('Name').value; base=makeNode('MemberExpression',{ base, identifier:makeNode('Identifier',{name:prop}), indexer:'.' }); }
      else if(this.check(':')){ this.consume(); const m=this.expectType('Name').value; base=makeNode('MemberExpression',{ base, identifier:makeNode('Identifier',{name:m}), indexer:':' }); // next must be call
        base=this.parseCall(base);
      }
      else if(this.check('[')){ this.consume(); const idx=this.parseExp(); this.expectValue(']'); base=makeNode('IndexExpression',{ base, index:idx }); }
      else if(this.check('(') || this.checkType('String') || this.check('{')){ base=this.parseCall(base); }
      else break;
    }
    return base;
  }
}

export function parse(src){
  const tokens=tokenize(src);
  const p=new Parser(tokens, src);
  return p.parse();
}
