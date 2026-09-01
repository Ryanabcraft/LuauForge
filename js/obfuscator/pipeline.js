/**
 * Pipeline — orquestra transforms, randomização com seed, validação.
 * Ordem: tokenize -> parse -> scope -> transforms -> generate -> validate_parse
 */
import { parse } from './parser.js';
import { generate } from './generator.js';
import { Random } from './random.js';
import { analyze } from './scope.js';
import { transformIdentifiers } from './transforms/identifiers.js';
import { transformStrings } from './transforms/strings.js';
import { transformNumbers } from './transforms/numbers.js';
import { transformBooleans } from './transforms/booleans.js';
import { transformConstantPool } from './transforms/constants.js';
import { transformControlFlow } from './transforms/controlflow.js';
import { transformPredicates } from './transforms/predicates.js';
import { transformDeadcode } from './transforms/deadcode.js';
import { transformIndirection } from './transforms/indirection.js';
import { transformVm } from './transforms/vm.js';

export const PRESETS={
  Low: {
    identifier: { style:'_A7x9' },
    strings: { intensity:'low' },
    numbers: { probability:0.2 },
    booleans: { probability:0.2 },
    constantPool: { enable:false },
    controlFlow: { enable:false },
    predicates: { probability:0 },
    deadcode: { probability:0 },
    indirection: { probability:0 },
    vm: { enable:false },
    minify: false
  },
  Normal: {
    identifier: { style:'_A7x9' },
    strings: { intensity:'medium' },
    numbers: { probability:0.5 },
    booleans: { probability:0.4 },
    constantPool: { enable:true, threshold:2, stringsOnly:true },
    controlFlow: { enable:false },
    predicates: { probability:0.15 },
    deadcode: { probability:0.08 },
    indirection: { probability:0.1 },
    vm: { enable:false },
    minify: false
  },
  High: {
    identifier: { style:'_lIlII' },
    strings: { intensity:'high' },
    numbers: { probability:0.7 },
    booleans: { probability:0.5 },
    constantPool: { enable:true, threshold:1, stringsOnly:false },
    controlFlow: { enable:true, probability:0.5, intensity:'high' },
    predicates: { probability:0.25 },
    deadcode: { probability:0.15 },
    indirection: { probability:0.25 },
    vm: { enable:false },
    minify: true
  },
  Extreme: {
    identifier: { style:'mangled' },
    strings: { intensity:'extreme' },
    numbers: { probability:0.85 },
    booleans: { probability:0.6 },
    constantPool: { enable:true, threshold:1, stringsOnly:false },
    controlFlow: { enable:true, probability:1, intensity:'extreme' },
    predicates: { probability:0.35 },
    deadcode: { probability:0.25 },
    indirection: { probability:0.35 },
    vm: { enable:true },
    minify: true
  }
};

export function obfuscate(src, options={}){
  const presetName=options.preset || 'Normal';
  const preset=PRESETS[presetName] || PRESETS.Normal;
  const seed=options.seed ?? null;
  const rnd=new Random(seed);

  const t0=performance.now();

  // Merge preset with explicit options overrides — null desativa
  function merge(presetPart, optPart){
    if(optPart===null) return null;
    if(optPart===undefined) return { ...presetPart, random:rnd, seed };
    return { ...presetPart, ...optPart, random:rnd, seed };
  }
  const cfg={
    preset:presetName,
    seed,
    identifier: merge(preset.identifier, options.identifier),
    strings: merge(preset.strings, options.strings),
    numbers: merge(preset.numbers, options.numbers),
    booleans: merge(preset.booleans, options.booleans),
    constantPool: merge(preset.constantPool, options.constantPool),
    controlFlow: merge(preset.controlFlow, options.controlFlow),
    predicates: merge(preset.predicates, options.predicates),
    deadcode: merge(preset.deadcode, options.deadcode),
    indirection: merge(preset.indirection, options.indirection),
    vm: merge(preset.vm, options.vm),
    minify: options.minify ?? preset.minify,
    oneLine: options.oneLine ?? false,
    header: options.header ?? false,
  };

  // 1. Parse original
  let ast;
  try{
    ast=parse(src);
  }catch(e){
    throw new Error(`Parse original falhou: ${e.message}`);
  }

  // 2. Analyze scope (para rename)
  const scope=analyze(ast);

  // 3. Transforms — ordem importa
  // identifiers primeiro (renomeia locals)
  if(cfg.identifier) transformIdentifiers(ast, scope, cfg.identifier);

  // strings (sem leak) — deve vir antes de constantPool para pool não pegar plaintext já protegido
  if(cfg.strings) transformStrings(ast, cfg.strings);

  // numbers / booleans
  if(cfg.numbers) transformNumbers(ast, cfg.numbers);
  if(cfg.booleans) transformBooleans(ast, cfg.booleans);

  // constant pool (codificado) — depois de strings para não pegar plaintext
  if(cfg.constantPool?.enable) transformConstantPool(ast, cfg.constantPool);

  // indirection
  if(cfg.indirection?.probability>0) transformIndirection(ast, cfg.indirection);

  // control flow (flatten) — só para funções seguras
  if(cfg.controlFlow?.enable) transformControlFlow(ast, cfg.controlFlow);

  // opaque predicates
  if(cfg.predicates?.probability>0) transformPredicates(ast, cfg.predicates);

  // deadcode
  if(cfg.deadcode?.probability>0) transformDeadcode(ast, cfg.deadcode);

  // VM real — só se enable, e só para compatíveis, sem fake
  if(cfg.vm?.enable) transformVm(ast, cfg.vm);

  // 4. Generate
  let out;
  try{
    out=generate(ast, { minify: cfg.minify || cfg.oneLine });
    if(cfg.oneLine) out=out.replace(/\n/g,'; ').replace(/\s+/g,' ').trim();
  }catch(e){
    throw new Error(`Generate falhou: ${e.message}`);
  }

  if(cfg.header){
    const stamp=new Date().toISOString().slice(0,10);
    out=`-- Obfuscated with LuauForge (client-side) | preset:${presetName} | ${stamp}\n` + out;
  }

  // 5. Validate: parse obfuscated e garantir que faz parse
  try{
    parse(out);
  }catch(e){
    throw new Error(`Obfuscation failed: código gerado não faz parse (${e.message}). Transform que causou: ${presetName}`);
  }

  const t1=performance.now();

  return {
    code: out,
    preset: presetName,
    timeMs: (t1-t0),
    seed: seed || '(random)',
  };
}
