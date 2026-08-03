// node criar-personagem/js/mesa-exp-inicial.test.mjs
// Personagem vinculado a mesa começa com (EXP Inicial da mesa + nº da sessão
// atual), inclusive quando o jogador retoma uma criação salva no localStorage.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));

let store = {};
const ctx = vm.createContext({
    console: { log() {}, warn() {}, error: console.error },
    setTimeout() {},
    localStorage: {
        getItem: (k) => (k in store ? store[k] : null),
        setItem: (k, v) => { store[k] = v; },
        removeItem: (k) => { delete store[k]; }
    },
    document: { getElementById: () => null, querySelector: () => null, addEventListener() {} },
    location: { search: '' },
    URLSearchParams: URLSearchParams,
    confirm: () => ctx.RESPOSTA_DO_JOGADOR,
    alert() {},
    FASES_WIZARD: [],   // vazio: buildProgressBar/goToPhase saem na primeira linha
    RESPOSTA_DO_JOGADOR: true
});
ctx.window = ctx;

for (const f of ['wizard-engine.js', 'exp-tracker.js', 'storage.js', 'app.js']) {
    vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx);
}
const st = ctx.wizardState;
// ExpTracker é `const` no topo do arquivo: fica no escopo léxico do contexto,
// não vira propriedade dele. Só dá pra ler de dentro.
const expTotal = () => vm.runInContext('ExpTracker.getTotal()', ctx);

/** Simula o que o firebase.js entrega antes do initWizard + reinicia o guard. */
function abrirCriador(mesa, saveAntigo) {
    store = saveAntigo ? { lr_wizard_state: JSON.stringify(saveAntigo) } : {};
    vm.runInContext('_wizardInitialized = false;', ctx);
    ctx.resetWizardState();
    st.mesaVinculada = mesa;
    ctx.initWizard();
}

const MESA = { id: 'm1', nome: 'Reliera', expInicial: 120, sessaoAtual: 46 };

// --- Criação nova ---
abrirCriador(MESA, null);
assert.equal(expTotal(), 166, '120 da mesa + sessão 46');
assert.equal(st.expInicial, 120, 'expInicial gravado na ficha é só o valor da mesa');

// --- Retomando criação salva: mesa mudou o EXP e rolou sessão nova ---
abrirCriador(
    { ...MESA, expInicial: 150, sessaoAtual: 47 },
    { mesaVinculada: { ...MESA }, expInicial: 120, wizardFasesV2: true, faseAtual: 3,
      expSources: { exp_inicial: { amount: 120 }, exp_sessao: { amount: 46 } } }
);
assert.equal(st.faseAtual, 3, 'o resto do progresso salvo continua restaurado');
assert.equal(expTotal(), 197, 'valores do servidor vencem os do localStorage');
assert.equal(st.mesaVinculada.sessaoAtual, 47);

// --- Criação salva de OUTRA mesa, agora numa mesa sem sessão registrada ---
abrirCriador(
    { id: 'm2', nome: 'Mesa nova', expInicial: 100 },
    { mesaVinculada: { ...MESA }, expSources: { exp_inicial: { amount: 120 }, exp_sessao: { amount: 46 } } }
);
assert.equal(expTotal(), 100, 'sem sessão registrada não sobra bônus da mesa anterior');

// --- Sem mesa: EXP manual, ninguém mexe ---
abrirCriador(null, null);
ctx.setExpInicial(80);
assert.equal(expTotal(), 80);

console.log('OK');
