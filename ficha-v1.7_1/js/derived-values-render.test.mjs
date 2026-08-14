/**
 * Trava as peças puras que a grid de Valores Derivados usa para DESENHAR:
 * o piso/teto que a mecânica impõe às bolinhas, a pintura dos dots e os blocos
 * de HTML do tooltip. Antes da refatoração isso vivia dentro de duas funções de
 * 200+ linhas e não dava para testar sem um DOM inteiro.
 *
 * Roda com: node ficha-v1.7_1/js/derived-values-render.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('./derived-values.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

const trecho = (nome) => {
  const ini = src.indexOf(`function ${nome}(`);
  assert.ok(ini > 0, `${nome} não encontrada em derived-values.js`);
  const fim = src.indexOf('\n}\n', ini) + 3;
  assert.ok(fim > ini, `fecho de ${nome} não encontrado`);
  return src.slice(ini, fim);
};
const linhaConst = (nome) => {
  const m = src.match(new RegExp(`^const ${nome} = .*$`, 'm'));
  assert.ok(m, `const ${nome} não encontrada`);
  return m[0];
};

/* ===== sandbox mínimo: só o que essas funções tocam ===== */
const escapar = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const sandbox = {
  console,
  // _escHtml escapa via textContent → innerHTML; o dublê faz o mesmo por regex
  document: { createElement: () => ({ set textContent(v) { this.innerHTML = escapar(v); }, innerHTML: '' }) },
  window: {},
  state: { dots: {} },
  getAffectingMechanics: null,   // cada teste troca
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext([
  trecho('_escHtml'),
  linhaConst('_dvDesc'),
  trecho('_dvBlocoVinculadas'),
  trecho('_dvBlocoFontes'),
  trecho('_dvMecanicasQueAfetam'),
  trecho('_dvPisoETeto'),
  trecho('_dvLimparDot'),
  trecho('_dvPintarDots'),
  // `const` fica no escopo léxico do script e não aparece no sandbox; `function` sim
  'globalThis._dvDesc = _dvDesc;',
].join('\n'), sandbox);

const { _dvPisoETeto, _dvPintarDots, _dvBlocoVinculadas, _dvBlocoFontes, _dvDesc } = sandbox;

/* ===== piso e teto que a mecânica impõe ===== */
// o vm devolve objetos de outro realm; o clone traz para o nosso antes de comparar
const puro = (v) => JSON.parse(JSON.stringify(v));
const pisoTeto = (limite) => puro(_dvPisoETeto(limite));

assert.deepEqual(pisoTeto(null), { piso: 0, teto: 5 }, 'sem mecânica a régua é 0–5');
assert.deepEqual(pisoTeto({ tipo: 'bloqueio', min: 3, max: 4 }), { piso: 0, teto: 0 },
  'bloqueio zera tudo e ignora min/max');
assert.deepEqual(pisoTeto({ tipo: 'minimo', min: 2 }), { piso: 2, teto: 5 });
assert.deepEqual(pisoTeto({ tipo: 'maximo', max: 3 }), { piso: 0, teto: 3 });
assert.deepEqual(pisoTeto({ tipo: 'clamp', min: 2, max: 4 }), { piso: 2, teto: 4 });
assert.deepEqual(pisoTeto({ tipo: 'maximo', max: null }), { piso: 0, teto: 5 },
  'limite sem número não muda a régua');

/* ===== pintura das bolinhas ===== */
const containerFake = (n = 5) => {
  const dots = Array.from({ length: n }, (_, i) => ({
    dataset: { val: String(i + 1) },
    classes: new Set(),
    classList: {
      add(...c) { c.forEach(x => dots[i].classes.add(x)); },
      remove(...c) { c.forEach(x => dots[i].classes.delete(x)); },
    },
    style: { removeProperty() {}, setProperty() {} },
  }));
  return { dots, querySelectorAll: () => dots };
};
const pintar = (opts) => {
  const c = containerFake();
  _dvPintarDots(c, opts);
  return c.dots.map(d => [...d.classes].sort().join('+') || '—');
};

assert.deepEqual(pintar({ piso: 0, teto: 5, baseVal: 2, bonus: 0 }),
  ['filled', 'filled', '—', '—', '—'], '2 pontos = 2 bolinhas cheias');

assert.deepEqual(pintar({ piso: 0, teto: 5, baseVal: 2, bonus: 1 }),
  ['filled', 'filled', 'bonus+filled', '—', '—'], 'o bônus entra depois dos pontos próprios');

assert.deepEqual(pintar({ piso: 2, teto: 5, baseVal: 1, bonus: 0 }),
  ['filled+floor', 'filled+floor', 'filled', '—', '—'], 'o piso ocupa as primeiras bolinhas');

assert.deepEqual(pintar({ piso: 0, teto: 3, baseVal: 5, bonus: 0 }),
  ['filled', 'filled', 'filled', 'capped', 'capped'], 'acima do teto a bolinha fica inativa');

assert.deepEqual(pintar({ piso: 0, teto: 0, baseVal: 4, bonus: 2 }),
  ['capped', 'capped', 'capped', 'capped', 'capped'], 'bloqueio apaga a régua inteira');

// repintar tem que apagar o estado anterior, senão o efeito que saiu fica preso
const c = containerFake();
_dvPintarDots(c, { piso: 0, teto: 5, baseVal: 4, bonus: 0 });
_dvPintarDots(c, { piso: 0, teto: 5, baseVal: 1, bonus: 0 });
assert.deepEqual(c.dots.map(d => [...d.classes].join('+') || '—'), ['filled', '—', '—', '—', '—'],
  'a segunda pintura não pode herdar bolinha cheia da primeira');

/* ===== mecânicas externas: variantes de nome, sem repetir ===== */
sandbox.getAffectingMechanics = (nome, { skipLinked }) => {
  assert.deepEqual(skipLinked, ['m1'], 'o skipLinked tem que chegar inteiro');
  if (nome === 'Vitalidade') return [{ fonte: 'Robusto', preview: '+2' }];
  if (nome === 'Vitalidade Máxima') return [{ fonte: 'Robusto', preview: '+2' }, { fonte: 'Anel', preview: '+1' }];
  return [];
};
const achadas = puro(sandbox._dvMecanicasQueAfetam(['Vitalidade', 'Vitalidade Máxima', 'Vitalidade Máximo'], ['m1']));
assert.deepEqual(achadas, [{ fonte: 'Robusto', preview: '+2' }, { fonte: 'Anel', preview: '+1' }],
  'mesma fonte+preview vinda de duas variantes conta uma vez só');

sandbox.getAffectingMechanics = null;
assert.deepEqual(puro(sandbox._dvMecanicasQueAfetam(['Vitalidade'])), [],
  'sem o motor de mecânicas carregado, devolve vazio em vez de explodir');

/* ===== blocos de HTML do tooltip ===== */
assert.equal(_dvDesc(''), '', 'descrição vazia não vira div');
assert.equal(_dvDesc('a < b'), '<div class="dv-tooltip-desc">a &lt; b</div>');

assert.equal(_dvBlocoVinculadas([]), '', 'lista vazia não desenha o bloco');
assert.match(_dvBlocoVinculadas(['+2 Vigor']), /dv-tooltip-mechs-title">⚙️ Mecânicas Vinculadas:/);
assert.match(_dvBlocoVinculadas(['+2 Vigor']), /dv-tooltip-mech-item">• \+2 Vigor</);

assert.equal(_dvBlocoFontes('T', []), '', 'sem fontes não desenha o bloco');
assert.equal(
  _dvBlocoFontes('🔗 Outras:', [{ fonte: 'Anel', preview: '+1' }], ' dv-tooltip-extras'),
  '<div class="dv-tooltip-mechs dv-tooltip-extras">'
  + '<div class="dv-tooltip-mechs-title">🔗 Outras:</div>'
  + '<div class="dv-tooltip-mech-item"><span class="dv-tooltip-fonte">Anel:</span> +1</div>'
  + '</div>');
assert.match(_dvBlocoFontes('T', [{ fonte: 'a', preview: 'b' }]), /^<div class="dv-tooltip-mechs">/,
  'sem classe extra o bloco fica só com a classe base');

console.log('✅ derived-values: piso/teto, pintura dos dots e blocos do tooltip travados');
