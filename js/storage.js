const LS = {
  get(k, fallback=null){ try{ const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; }catch{ return fallback; }},
  set(k, v){ localStorage.setItem(k, JSON.stringify(v)); },
  del(k){ localStorage.removeItem(k); }
};
export const Store = {
  favs: {
    key: 'lf:favs',
    all(){ return LS.get(this.key, []); },
    has(id){ return this.all().includes(id); },
    toggle(id){
      const a = this.all();
      const i = a.indexOf(id);
      if(i>=0) a.splice(i,1); else a.push(id);
      LS.set(this.key, a); return a;
    }
  },
  recent: {
    key: 'lf:recent',
    push(id){
      let a = LS.get(this.key, []);
      a = [id, ...a.filter(x=>x!==id)].slice(0,8);
      LS.set(this.key, a);
    },
    all(){ return LS.get(this.key, []); }
  },
  settings: {
    key: 'lf:settings',
    defaults: { accent:'purple', theme:'dark', fontSize:13, tabSize:4, editorMode:'light' },
    get(){
      const s = LS.get(this.key, {});
      return { ...this.defaults, ...s };
    },
    set(patch){
      const cur = this.get();
      const next = { ...cur, ...patch };
      LS.set(this.key, next);
      return next;
    }
  }
};
