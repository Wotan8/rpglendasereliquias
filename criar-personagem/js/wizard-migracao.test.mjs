/**
 * Migração de estado salvo após a separação Raças / Classes.
 *
 * faseAtual e fasesCompletas são índices do array FASES_WIZARD. A etapa
 * "Classes" entrou no índice 2, então todo estado salvo antes disso precisa
 * ser deslocado ao restaurar, senão o jogador cai na fase errada.
 *
 * node criar-personagem/js/wizard-migracao.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const aqui = dirname(fileURLToPath(import.meta.url));

// Layout antes e depois — o "antes" está fixo de propósito: é o contrato
// com os dados que já estão gravados nos navegadores dos jogadores.
const ANTES = ['convite', 'linhagem', 'origens', 'peculiaridades', 'corpo',
    'habilidades', 'alma', 'lacos', 'equipamento', 'vespera', 'resumo'];

const src = readFileSync(join(aqui, 'data.js'), 'utf8');
const DEPOIS = eval(src.match(/const FASES_WIZARD = (\[[\s\S]*?\]);/)[1]).map(f => f.key);

// Extrai a função real de deserializeWizardState em vez de reimplementá-la.
const engine = readFileSync(join(aqui, 'wizard-engine.js'), 'utf8');
const corpo = engine.match(/function deserializeWizardState\(json\) \{[\s\S]*?\n\}/)[0];
const wizardState = {};
const deserializeWizardState = new Function('wizardState', `${corpo}; return deserializeWizardState;`)(wizardState);

const restaura = obj => {
    for (const k of Object.keys(wizardState)) delete wizardState[k];
    deserializeWizardState(JSON.stringify(obj));
    return wizardState;
};

// --- Cada fase antiga tem que continuar apontando para a MESMA fase ---
for (let i = 0; i < ANTES.length; i++) {
    const st = restaura({ faseAtual: i, fasesCompletas: [] });
    assert.equal(DEPOIS[st.faseAtual], ANTES[i],
        `faseAtual ${i} (${ANTES[i]}) foi parar em ${DEPOIS[st.faseAtual]}`);
}

// --- fasesCompletas inteiro ---
const todas = restaura({ faseAtual: 0, fasesCompletas: [0, 1, 2, 3, 4] });
assert.deepEqual([...todas.fasesCompletas].sort((a, b) => a - b), [0, 1, 3, 4, 5]);
assert.deepEqual([...todas.fasesCompletas].map(i => DEPOIS[i]),
    ['convite', 'linhagem', 'origens', 'peculiaridades', 'corpo']);

// --- Idempotência: estado já migrado não pode andar de novo ---
const jaMigrado = restaura({ faseAtual: 5, fasesCompletas: [3, 5], wizardFasesV2: true });
assert.equal(jaMigrado.faseAtual, 5, 'estado novo não pode ser deslocado');
assert.deepEqual([...jaMigrado.fasesCompletas].sort((a, b) => a - b), [3, 5]);

// Migrar duas vezes seguidas dá o mesmo resultado
const umaVez = restaura({ faseAtual: 4, fasesCompletas: [4] });
const duasVezes = restaura({ faseAtual: umaVez.faseAtual, fasesCompletas: [...umaVez.fasesCompletas], wizardFasesV2: umaVez.wizardFasesV2 });
assert.equal(duasVezes.faseAtual, umaVez.faseAtual, 'migração não é idempotente');

// --- A flag tem que ficar gravada, senão migra de novo no próximo load ---
assert.equal(restaura({ faseAtual: 2, fasesCompletas: [] }).wizardFasesV2, true);

// --- Estado sem faseAtual não pode virar NaN ---
const vazio = restaura({ fasesCompletas: [] });
assert.ok(vazio.faseAtual === undefined || Number.isFinite(vazio.faseAtual),
    `faseAtual virou ${vazio.faseAtual}`);

console.log(`ok — ${ANTES.length} fases antigas remapeadas, fasesCompletas migrado, idempotente`);
