/**
 * Web Worker — obfuscação pesada não congela UI
 * Uso: postMessage({ code, options }) -> postMessage({ code, timeMs, error })
 */
import { obfuscate } from '../js/obfuscator/pipeline.js';

// Vite/CJS não, é ES module worker — import via importScripts fallback?
// Para compatibilidade GitHub Pages sem bundler, usamos import via dynamic import com URL relativa
// Mas Workers em module precisam de `type: module`. Vamos usar self.onmessage com import dinâmico.

self.onmessage = async (e)=>{
  const { id, code, options } = e.data;
  try{
    // dynamic import pipeline (caminho relativo ao worker)
    // Se já importado estaticamente, usar. Tentamos import estático acima; se falhar, fallback.
    const result = obfuscate(code, options);
    self.postMessage({ id, ok:true, ...result });
  }catch(err){
    self.postMessage({ id, ok:false, error: err.message, stack: err.stack });
  }
};
