import { TOOLS, TOOL_MAP } from './tools/registry.js';
import { Store } from './storage.js';

export function getRoute(){
  const h = location.hash || '#/dashboard';
  const id = h.replace(/^#\//,'').split('?')[0] || 'dashboard';
  return id;
}
export function navigate(id){
  location.hash = '#/' + id;
}
export function onRouteChange(cb){
  window.addEventListener('hashchange', ()=> cb(getRoute()));
}
export function markRecent(id){
  if(TOOL_MAP[id]) Store.recent.push(id);
}
