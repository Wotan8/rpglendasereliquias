/**
 * Checagem da cascata de Altura no simulador da criação.
 *   Altura → Tamanho (×3) → Vitalidade e D.Terrestre
 *   Altura² → Peso → Carga
 * Roda com: node criar-personagem/js/mechanics-simulator.test.mjs
 */
import assert from 'node:assert/strict';

/* ===== Stubs mínimos dos globais que o simulador lê ===== */
const DV = {
  altura: { id: 'dvAltura', key: 'altura', nome: 'Altura', mecanicaIds: [] },
  tamanho: { id: 'dvTamanho', key: 'tamanho', nome: 'Tamanho', mecanicaIds: ['mTamanho'] },
  peso: { id: 'dvPeso', key: 'peso', nome: 'Peso', mecanicaIds: ['mPeso'] },
  carga: { id: 'dvCarga', key: 'carga', nome: 'Carga', campoAtual: true, mecanicaIds: ['mCarga'] },
  desloc: { id: 'dvDesloc', key: 'desloc', nome: 'Desloc. Terrestre', mecanicaIds: ['mDesloc'] },
};

const eq = (...termos) => termos;
const calc = (alvo, operacao, equacao) => ({ alvo, operacao, equacao });
const modificar = (id, nome, calculos, extra = {}) => ({
  id, nome, tipo: 'modificar', duracao: 'permanente', config: { calculos }, ...extra,
});

const MECHANICS = [
  modificar('mTamanho', 'Tamanho', [calc('Tamanho', '=', eq({ tipo: 'ficha', ref: 'Altura' }, { tipo: 'fixo', op: '×', valor: 3 }))]),
  modificar('mPeso', 'Peso', [
    calc('Peso', '+', eq({ tipo: 'fixo', valor: 18 }, { tipo: 'ficha', op: '+', ref: 'FOR' }, { tipo: 'ficha', op: '+', ref: 'VIG' })),
    calc('Peso', '×', eq({ tipo: 'ficha', ref: 'Altura' }, { tipo: 'ficha', op: '×', ref: 'Altura' })),
  ]),
  modificar('mCarga', 'Carga Máxima', [
    calc('Carga', '+', eq({ tipo: 'ficha', ref: 'FOR' }, { tipo: 'ficha', op: '+', ref: 'VIG' })),
    calc('Carga', '×', eq({ tipo: 'ficha', ref: 'Peso' }, { tipo: 'fixo', op: '÷', valor: 10 })),
  ]),
  modificar('mDesloc', 'D.Terrestre', [
    calc('Desloc. Terrestre', '+', eq({ tipo: 'ficha', ref: 'FOR' }, { tipo: 'ficha', op: '+', ref: 'DES' }, { tipo: 'ficha', op: '+', ref: 'Tamanho' })),
  ]),
  // Gigantismo: +10% de Altura por nível (só esta mecânica; o resto é cascata)
  modificar('mGigAltura', 'GIGANTISMO — Altura', [calc('Altura', '×', eq({ tipo: 'fixo', valor: 1.1 }))], {
    evoluivel: true,
    nivelMaximo: 3,
    progressao: { 1: { termos: { 0: 1.1 } }, 2: { termos: { 0: 1.2 } }, 3: { termos: { 0: 1.3 } } },
  }),
];

globalThis.window = {
  DERIVED_VALUES: Object.values(DV),
  SKILLS: {},
  REGRAS_CRIACAO: { atributos: { base_inicial: 1 } },
  _systemData: {
    mechanics: MECHANICS,
    races: [{ nome: 'Humano', derivedValueIds: [{ id: 'dvAltura', valorInicial: 1.7 }] }],
    classes: [],
    tribes: [],
    peculiarities: [{ id: 'pecGigantismo', nome: 'Gigantismo', mecanicaIds: ['mGigAltura'] }],
  },
  // reaproveitado do system-data-loader: sobrescreve os termos fixos pelo nível
  _adjustMechanicForLevel(m, level) {
    const prog = m.progressao?.[String(level)];
    if (!prog?.termos) return m;
    const out = JSON.parse(JSON.stringify(m));
    for (const c of out.config.calculos) {
      let i = 0;
      for (const t of c.equacao) {
        if (!t.tipo || t.tipo === 'fixo') {
          if (prog.termos[String(i)] !== undefined) t.valor = prog.termos[String(i)];
          i++;
        }
      }
    }
    return out;
  },
};
Object.assign(globalThis, { DERIVED_VALUES: window.DERIVED_VALUES, REGRAS_CRIACAO: window.REGRAS_CRIACAO });

const { simulateDerivedValues } = await import('./mechanics-simulator.js');

const rodar = (pecs = [], derivedModifiers = {}) => {
  window.wizardState = {
    racaSelecionada: 'Humano',
    atributos: { attr_for: 1, attr_des: 1, attr_vig: 1 }, // +1 base = 2 cada
    pericias: {},
    peculiaridadesIndividuais: pecs,
    derivedModifiers,
  };
  return simulateDerivedValues();
};

const perto = (a, b, tol = 0.05) => Math.abs(a - b) <= tol;

/* --- Sem peculiaridade: a cascata precisa fechar --- */
const base = rodar();
assert.equal(base.dvAltura, 1.7, 'Altura = constante da raça');
assert.ok(perto(base.dvTamanho, 5.1), `Tamanho = Altura×3, veio ${base.dvTamanho}`);
// REGRESSÃO: antes da correção o Peso lia Altura=0 e saía zerado
assert.ok(perto(base.dvPeso, 63.58), `Peso = (18+FOR+VIG)×Altura², veio ${base.dvPeso}`);
assert.ok(base.dvPeso > 0, 'Peso não pode sair zerado no wizard');
assert.ok(perto(base.dvCarga, 25.4, 0.2), `Carga = (FOR+VIG)×Peso÷10, veio ${base.dvCarga}`);
assert.ok(perto(base.dvDesloc, 9.1), `D.Terrestre = FOR+DES+Tamanho, veio ${base.dvDesloc}`);

/* --- Gigantismo Nv1: +10% de Altura tem que arrastar a cadeia inteira --- */
const nv1 = rodar([{ id: 'pecGigantismo', nivel: 1 }]);
assert.ok(perto(nv1.dvAltura, 1.87), `Nv1: Altura 1,70 ×1,1 = 1,87, veio ${nv1.dvAltura}`);
assert.ok(perto(nv1.dvTamanho, 5.61), `Nv1: Tamanho, veio ${nv1.dvTamanho}`);
assert.ok(nv1.dvPeso > base.dvPeso, 'Nv1: Peso sobe junto com a Altura');
assert.ok(nv1.dvCarga > base.dvCarga, 'Nv1: Carga sobe junto com o Peso');
assert.ok(nv1.dvDesloc > base.dvDesloc, 'Nv1: D.Terrestre sobe junto com o Tamanho');

/* --- Nv3: a progressão por nível tem que ser lida (1,3 e não 1,1) --- */
const nv3 = rodar([{ id: 'pecGigantismo', nivel: 3 }]);
assert.ok(perto(nv3.dvAltura, 2.21), `Nv3: Altura 1,70 ×1,3 = 2,21, veio ${nv3.dvAltura}`);
assert.ok(perto(nv3.dvTamanho, 6.63), `Nv3: Tamanho, veio ${nv3.dvTamanho}`);
assert.ok(nv3.dvCarga > nv1.dvCarga, 'Nv3: Carga acima do Nv1');

/* --- Constante de Criação (slider da Véspera) arrasta a cascata, igual à ficha:
       lá state.derived[Altura] já vem somado com o modificador quando o Peso lê. --- */
const comMod = rodar([], { dvAltura: 0.3 });
// O próprio VD continua sem a constante — o slider é quem a soma na exibição.
assert.ok(perto(comMod.dvAltura, 1.7), `Altura crua sem a constante, veio ${comMod.dvAltura}`);
// REGRESSÃO: antes, subir a Altura na Véspera não mexia no Peso do wizard,
// mas mexia na ficha — o personagem engordava sozinho ao abrir a ficha.
assert.ok(perto(comMod.dvPeso, 22 * 2.0 * 2.0), `Peso = (18+FOR+VIG)×(1,7+0,3)², veio ${comMod.dvPeso}`);
assert.ok(perto(comMod.dvTamanho, 6.0), `Tamanho = (Altura+0,3)×3, veio ${comMod.dvTamanho}`);

console.log('✅ cascata de Altura ok — base', base.dvAltura, '| Nv1', nv1.dvAltura, '| Nv3', nv3.dvAltura,
  '| Peso c/ constante +0,3', comMod.dvPeso);
