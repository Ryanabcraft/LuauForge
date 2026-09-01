/**
 * Tokenizer Lua/Luau — gera tokens com posição, preserva UTF-8.
 * Suporta: strings "..." '...' [[ ]] [=[ ]=], comentários --, números, nomes, símbolos,
 * Luau: type annotations : Type (ignoradas), continue, compound assign (+= etc) como tokens separados.
 */
const KEYWORDS=new Set(['and','break','continue','do','else','elseif','end','false','for','function','if','in','local','nil','not','or','repeat','return','then','true','until','while']);
const SYMBOLS=[
  '...','..','::','//','==','~=','<=','>=','<<','>>','+=','-=','*=','/=','%=','^=','..=',
  '+','-','*','/','%','^','#','&','|','~','<','>','=','(',')','{','}','[',']',';',':',',','.','\\'
].sort((a,b)=> b.length-a.length);

export function tokenize(src){
  const tokens=[];
  let i=0, line=1, col=1;
  const len=src.length;
  const push=(type,value,raw)=>{ tokens.push({type,value,raw:raw??value,line,col}); };

  function isAlpha(c){ return /[A-Za-z_]/.test(c); }
  function isAlnum(c){ return /[A-Za-z0-9_]/.test(c); }
  function isDigit(c){ return /[0-9]/.test(c); }
  function advance(n=1){
    for(let k=0;k<n;k++){
      if(src[i]==='\n'){ line++; col=1; } else col++;
      i++;
    }
  }
  function peek(off=0){ return src[i+off]||''; }

  while(i<len){
    const c=src[i];
    // whitespace
    if(c===' '||c==='\t'||c==='\r'){ advance(); continue; }
    if(c==='\n'){ advance(); continue; }
    // comments --, --[[ ]]
    if(c==='-'&&peek(1)==='-'){
      let start=i;
      if(peek(2)==='['){
        // long comment --[=*[ ]
        let eq=0, j=2;
        while(peek(j)==='='){ eq++; j++; }
        if(peek(j)==='['){
          // long comment
          let end = `]${'='.repeat(eq)}]`;
          let e = src.indexOf(end, i+j+1);
          if(e===-1) e=len; else e+=end.length;
          const raw=src.slice(i,e);
          // treat as comment (skip) but keep for generator optional
          advance(e-i);
          continue;
        }
      }
      // short comment to end of line
      let e=i+2;
      while(e<len && src[e]!=='\n') e++;
      // skip
      advance(e-i);
      continue;
    }
    // long strings [[, [=[ etc
    if(c==='['){
      let eq=0, j=1;
      while(peek(j)==='='){ eq++; j++; }
      if(peek(j)==='['){
        const open=`[${'='.repeat(eq)}[`;
        const close=`]${'='.repeat(eq)}]`;
        let e=src.indexOf(close, i+open.length);
        if(e===-1) e=len; else e+=close.length;
        const raw=src.slice(i,e);
        push('String', raw, raw);
        advance(e-i);
        continue;
      }
    }
    // strings " ' 
    if(c==='"' || c==="'"){
      const q=c;
      let raw=q, j=i+1;
      let esc=false;
      while(j<len){
        const ch=src[j];
        raw+=ch;
        if(esc){ esc=false; j++; col++; continue; }
        if(ch==='\\'){ esc=true; j++; continue; }
        if(ch===q){ j++; break; }
        if(ch==='\n'){ break; } // unterminated, but handle
        j++;
      }
      // advance correctly
      const consumed=raw.length;
      // track lines inside? strings no newline normally except \n
      for(let k=0;k<consumed;k++){ if(src[i]==='\n'){line++;col=1;} else col++; i++; }
      // we already advanced via loop? we did manual; need to ensure i at correct pos
      // we advanced via raw length, but above we did per char; to avoid double, we already moved i
      // Instead reset i to start+consumed
      // Simpler: we already moved i via col loop, but we also consumed via j; ensure i = start+consumed
      // Our loop moved i incrementally, so i is already at start+consumed if we counted correctly.
      // But we did not set i correctly for raw building; just ensure i = start+consumed
      // It is already.
      push('String', raw, raw);
      continue;
    }
    // numbers (hex 0x, decimal, with exponent)
    if(isDigit(c) || (c==='.' && isDigit(peek(1)))){
      let s='';
      if(c==='0' && (peek(1)==='x'||peek(1)==='X')){
        s+=src.slice(i,i+2); i+=2; col+=2;
        while(i<len && /[0-9A-Fa-f_]/.test(src[i])){ s+=src[i]; advance(); }
      } else {
        while(i<len && /[0-9_]/.test(src[i])){ s+=src[i]; advance(); }
        if(peek()==='.' && peek(1)!=='.'){ s+=src[i]; advance(); while(i<len && /[0-9_]/.test(src[i])){ s+=src[i]; advance(); } }
        if(peek()==='e'||peek()==='E'){ s+=src[i]; advance(); if(peek()==='+'||peek()==='-'){ s+=src[i]; advance(); } while(i<len && /[0-9_]/.test(src[i])){ s+=src[i]; advance(); } }
      }
      // remove underscores for value but keep raw
      push('Number', s.replace(/_/g,''), s);
      continue;
    }
    // names / keywords
    if(isAlpha(c)){
      let s=c; advance();
      while(i<len && isAlnum(src[i])){ s+=src[i]; advance(); }
      if(KEYWORDS.has(s)) push('Keyword', s, s);
      else push('Name', s, s);
      continue;
    }
    // symbols
    let matched=null;
    for(const sym of SYMBOLS){
      if(src.startsWith(sym,i)){ matched=sym; break; }
    }
    if(matched){
      push('Symbol', matched, matched);
      advance(matched.length);
      continue;
    }
    // unknown char
    push('Unknown', c, c); advance();
  }
  push('Eof','<eof>','<eof>');
  return tokens;
}
