/**
 * Seeded PRNG — mulberry32 + xorshift, deterministic com seed.
 * Se seed == null/undefined => usa Math.random (não determinístico)
 */
export class Random {
  constructor(seed=null){
    if(seed==null || seed===''){
      this.seeded=false;
      this.nextFloat = ()=> Math.random();
      this.nextInt = (min,max)=> Math.floor(Math.random()*(max-min+1))+min;
      return;
    }
    this.seeded=true;
    // hash seed string to 32-bit
    let h=2166136261;
    const s=String(seed);
    for(let i=0;i<s.length;i++){ h ^= s.charCodeAt(i); h = Math.imul(h,16777619); }
    this.state = h>>>0;
    if(this.state===0) this.state=0x6D2B79F5;
  }
  _next(){
    // mulberry32
    let t = this.state += 0x6D2B79F5;
    t = Math.imul(t ^ (t>>>15), t|1);
    t ^= t + Math.imul(t ^ (t>>>7), t|61);
    return ((t ^ (t>>>14))>>>0) / 4294967296;
  }
  float(){ return this.seeded ? this._next() : Math.random(); }
  int(min,max){ return Math.floor(this.float()*(max-min+1))+min; }
  choice(arr){ return arr[this.int(0,arr.length-1)]; }
  shuffle(arr){
    const a=[...arr];
    for(let i=a.length-1;i>0;i--){ const j=this.int(0,i); [a[i],a[j]]=[a[j],a[i]]; }
    return a;
  }
  // gera nome aleatório com alfabetos variados
  name(style='mixed', lenMin=5, lenMax=9){
    const len=this.int(lenMin,lenMax);
    if(style==='unicode'){
      // usar caracteres visíveis mas válidos em Lua: ainda precisa começar com _ ou letra.
      // para compatibilidade, gera _ + mistura com l/I/o/O e diacríticos simples em comentário? Mantém ASCII para não quebrar.
      // fallback para mixed
      style='mixed';
    }
    const pools={
      mixed: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
      lIl: 'lIlI1',
      O0: 'O0o',
      mangled: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_'
    };
    const styleMap={
      _A7x9: 'mixed',
      _lIlII: 'lIl',
      _O0O0O: 'O0',
      unicode: 'mixed',
      mangled: 'mangled'
    };
    const poolKey=styleMap[style]||style;
    const chars=pools[poolKey]||pools.mixed;
    const digits='0123456789';
    const all=chars+digits;
    let s='_' + this.choice([...chars.replaceAll('_','')]);
    // prefixo opcional
    if(style==='_A7x9') s='_' + String.fromCharCode(65+this.int(0,25)) + this.int(0,9);
    else if(style==='_lIlII') { s='_' + this.choice([...'lI']); }
    else if(style==='_O0O0O') { s='_' + this.choice([...'O0']); }
    while(s.length < len+1){
      s+= this.choice([...all]);
    }
    // garantir que não colida com palavras reservadas depois
    return s.slice(0,len+1);
  }
}
