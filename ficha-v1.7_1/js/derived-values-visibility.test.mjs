/**
 * Regra: se o personagem tem uma peculiaridade que traz um Valor Derivado
 * (`derivedValueIds`), esse VD passa a valer para ele — mesmo que a raça, a
 * classe e a tribo não o tenham vinculado e mesmo que `todoPersonagem` seja false.
 *
 * Vale para as QUATRO fontes de peculiaridade: raça, classe, tribo e individual.
 *
 * Roda com: node ficha-v1.7_1/js/derived-values-visibility.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

/* Extrai do arquivo só renderDerivedValuesGrid e os ajudantes que ela chama (o
   resto do módulo depende do DOM inteiro). Paramos na primeira linha que fecha
   a função na coluna 0. */
// Normaliza CRLF: o recorte procura o fecho da função como '\n}\n', e o arquivo
// vira CRLF toda vez que alguém o salva por um editor do Windows.
const src = readFileSync(new URL('./derived-values.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const trecho = (nome) => {
  const ini = src.indexOf(`function ${nome}(`);
  assert.ok(ini > 0, `${nome} não encontrada em derived-values.js`);
  const fim = src.indexOf('\n}\n', ini) + 3;
  assert.ok(fim > ini, `fecho de ${nome} não encontrado`);
  return src.slice(ini, fim);
};

const CODIGO = [
  // quem decide o que aparece
  '_dvColetarVinculos', '_dvResolverPec', '_dvVinculosDoPersonagem', '_dvAgruparEmBlocos',
  'renderDerivedValuesGrid',
  // quem monta cada campo da grid
  '_dvAfixo', '_dvCriarLabel', '_dvCriarInputMaximo', '_dvCriarInputAtual',
  '_dvLinhaAtualMax', '_dvLinhaValor', '_dvCriarCampo', '_dvRestaurarAtuais',
].map(trecho).join('\n');

const DV_EXCLUSIVO = { id: 'dvOlfato', key: 'olfato', nome: 'Percepção Olfativa', todoPersonagem: false, ordem: 1, blocoId: 'sentidos', blocoNome: 'Sentidos' };
const DV_UNIVERSAL = { id: 'dvAltura', key: 'altura', nome: 'Altura', todoPersonagem: true, ordem: 2, blocoId: 'porte', blocoNome: 'Porte' };
const pecComDV = (id, nome) => ({ id, nome, key: nome, derivedValueIds: [{ id: DV_EXCLUSIVO.id, valorInicial: 0 }] });

/** Monta um sandbox com os globais que a função lê e devolve os VDs aplicáveis.
    `_dynamicDerivedKeys` é exatamente o conjunto que a função considera visível. */
function visiveis({ raca = '', classe = '', tribo = '', individuais = [] } = {}) {
  const elemento = () => ({
    innerHTML: '', style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {} },
    appendChild() {}, addEventListener() {}, querySelector: () => null, querySelectorAll: () => [],
    setAttribute() {}, insertBefore() {},
  });

  const sandbox = {
    console,
    document: {
      getElementById: id => {
        if (id === 'derivedValuesGrid') return elemento();
        if (id === 'selRaca') return { value: raca };
        if (id === 'selClasse') return { value: classe };
        if (id === 'selTribo') return { value: tribo };
        return null;
      },
      createElement: elemento,
      querySelector: () => null,
      querySelectorAll: () => [],
    },
    window: {
      DERIVED_VALUES: [DV_EXCLUSIVO, DV_UNIVERSAL],
      RACES: { Humano: { peculiaridades: raca === 'Humano' ? [pecComDV('pRaca', 'Faro Racial')] : [] } },
      CLASS_PECULIARITIES: { Batedor: [pecComDV('pClasse', 'Faro de Batedor')] },
      TRIBES: { Nômades: { peculiaridades: [pecComDV('pTribo', 'Faro Nômade')] } },
      TRIBOS: undefined,
      state: { peculiaridadesIndividuais: individuais },
      _systemData: { races: [], classes: [], peculiarities: [pecComDV('pInd', 'Olfato Apurado')] },
    },
    // a função chama estes helpers; aqui só precisamos do lado dos dados
    _resolvePeculiaridade: pecObj => {
      const id = typeof pecObj === 'object' ? pecObj.id : pecObj;
      return [pecComDV('pRaca'), pecComDV('pClasse'), pecComDV('pTribo'), pecComDV('pInd')]
        .find(p => p.id === id) || null;
    },
    initDerivedTooltips() {},
    recalcAll() {},
  };
  sandbox.globalThis = sandbox;
  sandbox.state = sandbox.window.state; // a função também usa `state` sem prefixo
  Object.assign(sandbox, { _dynamicDerivedKeys: new Set() });

  vm.createContext(sandbox);
  vm.runInContext(`${CODIGO}\nrenderDerivedValuesGrid();`, sandbox);
  const keys = sandbox._dynamicDerivedKeys || new Set();
  return sandbox.window.DERIVED_VALUES.filter(dv => keys.has(dv.key)).map(dv => dv.nome);
}

/* --- Universal sempre aparece; exclusivo sem vínculo nenhum, não --- */
let r = visiveis();
assert.ok(r.includes('Altura'), 'VD todoPersonagem deve sempre aparecer');
assert.ok(!r.includes('Percepção Olfativa'), 'VD exclusivo sem vínculo NÃO deve aparecer');

/* --- As quatro fontes de peculiaridade devem trazer o VD junto --- */
r = visiveis({ raca: 'Humano' });
assert.ok(r.includes('Percepção Olfativa'), 'peculiaridade de RAÇA deve vincular o VD');

r = visiveis({ individuais: [{ id: 'pInd' }] });
assert.ok(r.includes('Percepção Olfativa'), 'peculiaridade INDIVIDUAL deve vincular o VD');

r = visiveis({ tribo: 'Nômades' });
assert.ok(r.includes('Percepção Olfativa'), 'peculiaridade de TRIBO deve vincular o VD');

// REGRESSÃO: lia window.CLASSES[nome].peculiaridades, global que nunca existiu —
// o correto é window.CLASS_PECULIARITIES[nome], que já é o array de peculiaridades.
r = visiveis({ classe: 'Batedor' });
assert.ok(r.includes('Percepção Olfativa'), 'peculiaridade de CLASSE deve vincular o VD');

console.log('✅ VD de peculiaridade fica visível pelas 4 fontes (raça, classe, tribo, individual)');
