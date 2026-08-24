// node criar-personagem/js/distribuicoes.test.mjs
// O jogador pode adiantar na criação a distribuição que uma peculiaridade abre.
// Se depois ele troca a raça, larga a avulsa ou baixa o nível, a escolha que
// perdeu a fonte tem de sumir junto — senão o personagem nasce com um bônus
// que nenhuma peculiaridade dele sustenta.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));

let salvou = 0;
const ctx = vm.createContext({
    console: { log() {}, warn() {}, error: console.error },
    document: { getElementById: () => null },
    escHtml: s => String(s),
    saveWizardToStorage: () => { salvou++; },
    // Pool vem do mechanics-engine na página real; aqui, um dublê.
    getDistribuirPool: nome => nome === 'Perícias Mentais'
        ? ['Ciências', 'Investigação', 'Medicina']
        : (nome === 'Elementos Rúnicos' ? [] : [nome]),
    wizardState: {
        racaSelecionada: 'Yotun', classeSelecionada: null, triboSelecionada: null,
        peculiaridadesIndividuais: [], niveisPeculiaridadesHerdadas: {}, distribuicoes: {},
    },
});
ctx.window = ctx;
vm.runInContext(fs.readFileSync(path.join(dir, 'distribuicoes-module.js'), 'utf8'), ctx);

const chamar = expr => vm.runInContext(expr, ctx);
// O vm cria os objetos noutro realm: deepStrictEqual não os reconhece.
const json = v => JSON.stringify(v);
const ws = ctx.wizardState;

const mecMental = {
    id: 'mec_estudo', tipo: 'distribuir', nome: 'Estudo Antigo',
    config: { pool: 'Perícias Mentais', quantidadeAlvos: 2, valorPorAlvo: 1, restricao: 'diferentes' },
};
const mecRunica = {
    id: 'mec_runa', tipo: 'distribuir',
    config: { pool: 'Elementos Rúnicos', quantidadeAlvos: 1, valorPorAlvo: 1 },
};
const pecRaca = { id: 'pec_sabio', nome: 'Sábio', mecanicas: [mecMental, mecRunica] };

ctx.RACES = { Yotun: { peculiaridades: [pecRaca] } };
ctx.CLASS_PECULIARITIES = {};
ctx.TRIBES = {};
ctx.INDIVIDUAL_PECULIARITIES = [];

// --- O pool rúnico não abre no wizard (runicElements nem é carregado) ---
let disp = chamar('distribuicoesDisponiveis()');
assert.equal(disp.length, 1, 'só a distribuição de perícia aparece');
assert.equal(disp[0].alvos.join(','), 'Ciências,Investigação,Medicina');
assert.equal(disp[0].quantidade, 2);

// --- Nada distribuído: a criação segue, mecanicasAplicadas sai vazia ---
assert.equal(json(chamar('distribuicoesParaFicha()')), '{}', 'distribuir é opcional');

// --- Distribuiu 1 dos 2 slots: vai para a ficha como pendente ---
ws.distribuicoes = { mec_estudo: [{ nome: 'Medicina', valor: 1 }] };
let paraFicha = chamar('distribuicoesParaFicha()');
assert.equal(paraFicha.mec_estudo.aplicada, false, 'slot vazio = distribuição pendente na ficha');
assert.equal(json(paraFicha.mec_estudo.alvosEscolhidos), json([{ nome: 'Medicina', valor: 1 }]));

// --- Os 2 slots preenchidos: aplicada ---
ws.distribuicoes = { mec_estudo: [{ nome: 'Medicina', valor: 1 }, { nome: 'Ciências', valor: 1 }] };
assert.equal(chamar('distribuicoesParaFicha()').mec_estudo.aplicada, true);

// --- Alvo que saiu do pool é descartado, o resto fica ---
ws.distribuicoes = { mec_estudo: [{ nome: 'Furtividade', valor: 1 }, { nome: 'Ciências', valor: 1 }] };
chamar('sincronizarDistribuicoes()');
assert.equal(json(ws.distribuicoes.mec_estudo), json([{ nome: 'Ciências', valor: 1 }]));

// --- restricao "diferentes": alvo repetido no estado salvo não passa ---
ws.distribuicoes = { mec_estudo: [{ nome: 'Ciências', valor: 1 }, { nome: 'Ciências', valor: 1 }] };
chamar('sincronizarDistribuicoes()');
assert.equal(ws.distribuicoes.mec_estudo.length, 1);

// --- Trocar a raça tira a peculiaridade: a escolha inteira some ---
ws.distribuicoes = { mec_estudo: [{ nome: 'Medicina', valor: 1 }, { nome: 'Ciências', valor: 1 }] };
ws.racaSelecionada = 'Pogo';
chamar('sincronizarDistribuicoes()');
assert.equal(json(ws.distribuicoes), '{}', 'sem a peculiaridade, sem os valores distribuídos');
assert.equal(json(chamar('distribuicoesParaFicha()')), '{}');

// --- Baixar o nível de uma avulsa evoluível corta os slots que sobraram ---
const mecEvo = {
    id: 'mec_dom', tipo: 'distribuir', evoluivel: true,
    config: { pool: 'Perícias Mentais', quantidadeAlvos: 1, valorPorAlvo: 1 },
    progressao: { 1: { quantidadeAlvos: 1 }, 2: { quantidadeAlvos: 2 } },
};
ctx._adjustMechanicForLevel = (m, nivel) => {
    const copia = JSON.parse(JSON.stringify(m));
    Object.assign(copia.config, m.progressao?.[String(nivel)] || {});
    return copia;
};
ctx.INDIVIDUAL_PECULIARITIES = [{ id: 'pec_dom', nome: 'Domínio', mecanicas: [mecEvo] }];
ws.peculiaridadesIndividuais = [{ id: 'pec_dom', nome: 'Domínio', nivel: 2 }];
ws.distribuicoes = { mec_dom: [{ nome: 'Medicina', valor: 1 }, { nome: 'Ciências', valor: 1 }] };
chamar('sincronizarDistribuicoes()');
assert.equal(ws.distribuicoes.mec_dom.length, 2, 'Nv.2 dá dois alvos');

ws.peculiaridadesIndividuais[0].nivel = 1;
chamar('sincronizarDistribuicoes()');
assert.equal(json(ws.distribuicoes.mec_dom), json([{ nome: 'Medicina', valor: 1 }]), 'Nv.1 devolve só o primeiro slot');

// --- Largar a avulsa apaga tudo dela ---
ws.peculiaridadesIndividuais = [];
chamar('sincronizarDistribuicoes()');
assert.equal(json(ws.distribuicoes), '{}');

// --- Sincronizar sem mudança não salva de novo ---
const antes = salvou;
chamar('sincronizarDistribuicoes()');
assert.equal(salvou, antes, 'sincronização estável não dispara auto-save');

console.log('ok — distribuições da criação: opcionais, e somem junto com a peculiaridade');
