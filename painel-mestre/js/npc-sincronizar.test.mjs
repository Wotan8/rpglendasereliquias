/**
 * Botão "🔄 Sincronizar registros" da Ficha de NPC.
 *
 * A ficha só herda peculiaridades, Valores Derivados e módulos no instante em
 * que a raça/classe/tribo é ESCOLHIDA. Quem mexeu no registro depois — ou
 * importou um NPC pronto — ficava com a ficha defasada sem sinal nenhum.
 * O botão passa o pente fino e vincula o que falta.
 *
 * O que se trava aqui: ele ADICIONA o que falta e NÃO remove nem duplica o
 * que o Mestre pôs à mão. Rodar duas vezes tem de ser inofensivo.
 *
 * Roda com: node painel-mestre/js/npc-sincronizar.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('./area-npcs.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
/** Recorta uma função do arquivo até o seu fechamento na coluna 0. */
const recorta = (assinatura, fim) => {
    const ini = src.indexOf(assinatura);
    assert.ok(ini > 0, `${assinatura} não encontrado`);
    const f = src.indexOf(fim, ini);
    assert.ok(f > ini, `fim de ${assinatura} não encontrado`);
    return src.slice(ini, f + fim.length);
};

/* ----- Registros de mentira, no formato do Painel do Criador ----- */
const sys = {
    racesById: { r1: { id: 'r1', nome: 'Anão', peculiaridadeIds: ['p1'], derivedValueIds: ['dv1'] } },
    classesById: { c1: { id: 'c1', nome: 'Guerreiro', bonusIniciais: ['p2'], derivedValueIds: [{ id: 'dv2', valorInicial: 3 }], modulosDaClasse: ['m1'] } },
    tribesById: { t1: { id: 't1', nome: 'Vau', peculiaridadeIds: ['p3'] } },
    pecsById: {
        p1: { id: 'p1', nome: 'Casca Grossa', derivedValueIds: ['dv3'] },
        p2: { id: 'p2', nome: 'Treino de Linha' },
        p3: { id: 'p3', nome: 'Filho do Rio' },
    },
    classModulesById: { m1: { id: 'm1', titulo: 'Golpes', schema: [], itensPredefinidos: [] } },
    derivedValues: [
        { id: 'dv0', key: 'VIGOR', nome: 'Vigor', todoPersonagem: true },
        { id: 'dv1', key: 'BLINDAGEM', nome: 'Blindagem' },
        { id: 'dv2', key: 'ACERTO', nome: 'Acerto' },
        { id: 'dv3', key: 'RESISTE', nome: 'Resistência' },
        { id: 'dv4', key: 'NADA', nome: 'Nada a ver' },
    ],
};

const alertas = [];
const sandbox = {
    F: null,
    showAlert: (msg) => alertas.push(msg),
    renderPecs: () => {}, renderPecPicker: () => {},
    renderNpcClassModules: () => {}, recalcStats: () => {},
    // As duas funções de npc-system-data.js que o botão consome.
    pecsDaOrigem: (tipo, refId, s) => {
        const doc = tipo === 'raca' ? s.racesById[refId] : tipo === 'tribo' ? s.tribesById[refId] : s.classesById[refId];
        const campo = tipo === 'classe' ? 'bonusIniciais' : 'peculiaridadeIds';
        return (doc?.[campo] || []).map(id => ({ refId: id, nivel: 1, fonte: tipo }));
    },
    modulosDaClasseNpc: (refId, s) => (s.classesById[refId]?.modulosDaClasse || []).map(id => s.classModulesById[id]),
    window: {},
};
vm.createContext(sandbox);
vm.runInContext(
    recorta('function _npcDvIdsDoCadastro(', '\n}\n') + '\n'
    + recorta('window.sincronizarRegistrosNpc = function()', '\n};\n'), sandbox);
const sincronizar = () => sandbox.window.sincronizarRegistrosNpc();

/** NPC com as três origens escolhidas, mas a ficha vazia — o caso do import. */
const npcDefasado = () => ({
    racaRef: { refId: 'r1' }, classeRef: { refId: 'c1' }, triboRef: { refId: 't1' },
    peculiaridades: [], modulosClasse: [],
    valoresDer: { vinculados: [], overrides: {}, atual: {}, extras: [] },
});

/* ----- 1) Ficha defasada: vincula tudo o que falta ----- */
sandbox.F = { npc: npcDefasado(), sys };
sincronizar();
const npc = sandbox.F.npc;

assert.deepEqual(npc.peculiaridades.map(p => p.refId).sort(), ['p1', 'p2', 'p3'],
    'herda peculiaridade da raça, da classe e da tribo');
assert.equal(npc.peculiaridades.find(p => p.refId === 'p2').fonte, 'classe',
    'a fonte da peculiaridade fica registrada');

assert.ok(npc.valoresDer.vinculados.includes('VIGOR'), 'VD "todo personagem" entra');
assert.ok(npc.valoresDer.vinculados.includes('BLINDAGEM'), 'VD vinculado pela raça entra');
assert.ok(npc.valoresDer.vinculados.includes('ACERTO'), 'VD vinculado pela classe (objeto com valorInicial) entra');
assert.ok(npc.valoresDer.vinculados.includes('RESISTE'), 'VD vinculado por uma peculiaridade RECÉM-herdada entra');
assert.ok(!npc.valoresDer.vinculados.includes('NADA'), 'VD sem vínculo nenhum fica de fora');

assert.deepEqual(npc.modulosClasse.map(m => m.refId), ['m1'], 'módulo da classe entra');

/* ----- 2) Rodar de novo não duplica nada ----- */
const antes = JSON.stringify(npc);
sincronizar();
assert.equal(JSON.stringify(sandbox.F.npc), antes, 'sincronizar duas vezes não muda nada');
assert.ok(alertas.at(-1).startsWith('✅'), 'na segunda vez avisa que não faltava nada');

/* ----- 3) O que o Mestre pôs à mão sobrevive ----- */
sandbox.F = { npc: npcDefasado(), sys };
sandbox.F.npc.peculiaridades.push({ refId: null, nomeCustom: 'Cicatriz feia', nivel: 1 });
sandbox.F.npc.valoresDer.vinculados.push('NADA');
sincronizar();
assert.ok(sandbox.F.npc.peculiaridades.some(p => p.nomeCustom === 'Cicatriz feia'),
    'peculiaridade personalizada não é varrida');
assert.ok(sandbox.F.npc.valoresDer.vinculados.includes('NADA'),
    'VD vinculado à mão não é desvinculado');

/* ----- 4) NPC sem origem do registro: não inventa nada ----- */
sandbox.F = { npc: { racaRef: { refId: null, custom: 'Coisa' }, classeRef: {}, triboRef: {},
    peculiaridades: [], modulosClasse: [], valoresDer: { vinculados: [] } }, sys };
sincronizar();
assert.deepEqual(sandbox.F.npc.peculiaridades, [], 'raça em texto livre não herda peculiaridade');
assert.deepEqual(sandbox.F.npc.valoresDer.vinculados, ['VIGOR'], 'só os universais entram');

console.log('✅ sincronizar registros do NPC OK — vincula o que falta, preserva o manual e não duplica');
