/**
 * 🎯 As escolhas do projeto: Impressor e Manifestador.
 *
 * O furo que isto fecha: os dois Elementos Rúnicos existiam no cadastro e no
 * motor desde a etapa 3, mas `condicoesEscolhidas` e `manifestacao` eram LIDOS
 * e nunca ESCRITOS. Na prática todo Impressor caía no fallback (a primeira
 * condição do repertório) e o Manifestador não manifestava nada em particular
 * — dois sigilos decorativos, sem erro nenhum que denunciasse.
 *
 * Por isso o teste cobra a corrente inteira: escolher → guardar no Grimório →
 * reabrir → emitir. Se qualquer elo cair, os sigilos voltam a ser enfeite.
 *
 * Roda com: node laboratorium-runarum/js/projeto-escolhas.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const banc = readFileSync(new URL('./bancada.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const app = readFileSync(new URL('./lab-app.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const css = readFileSync(new URL('../css/laboratorium.css', import.meta.url), 'utf8');
const html = readFileSync(new URL('../laboratorium.html', import.meta.url), 'utf8');

/* ===== elo 1: existe onde escolher ===== */
assert.match(banc, /escolhas: \{ condicoes: \[\], manifestacao: null \}/, 'o estado das escolhas');
assert.match(banc, /function htmlProjeto\(\)/, 'o painel');
assert.match(banc, /\$\{htmlProjeto\(\)\}/, 'e ele é desenhado na bancada');
assert.match(banc, /\[data-cond\]/, 'as condições são clicáveis');
assert.match(banc, /\[data-manif\]/, 'e a manifestação também');

/* ===== elo 2: o teto do Impressor é respeitado NA TELA ===== */
assert.match(banc, /marcadas\.length >= j\.nvImp/,
    '🔒 marcar além do nível do Impressor tem de ficar desabilitado, não ser cortado depois');
assert.match(banc, /j\.nvImp >= 3 \? j\.criticas/,
    'a marca de crítico só aparece num Impressor Nv3');

/* ===== elo 3: o repertório mostrado é o que VALE agora ===== */
assert.match(banc, /essencia \? \(asp\?\.el\?\.condicoesEssencia \|\| \[\]\) : \(asp\?\.el\?\.condicoesFisicas \|\| \[\]\)/,
    '🔒 com Sublimador gravado, o repertório que aparece é o de essência');

/* ===== elo 4: a escolha chega ao bloco ===== */
assert.match(banc, /condicoesEscolhidas: runa\.condicoesEscolhidas \|\| state\.escolhas\.condicoes/,
    'runa do Grimório usa a própria escolha; a da mesa usa a da bancada');
assert.match(banc, /manifestacao: runa\.manifestacao \|\| state\.escolhas\.manifestacao/);

/* ===== elo 5: o Grimório guarda e devolve ===== */
assert.match(banc, /escolhas: \(\) => \(\{ condicoes: \[\.\.\.state\.escolhas\.condicoes\]/, 'a bancada expõe o que foi escolhido');
assert.match(banc, /restaurarEscolhas\(r\)/, 'e sabe restaurar');
assert.match(app, /\.\.\.\(window\.LabBancada\?\.escolhas\?\.\(\) \|\| \{\}\)/,
    '🔒 salvar no Grimório tem de levar as escolhas — senão reabrir a runa perde a marca escolhida');
assert.match(app, /runa\.condicoesEscolhidas = runa\.condicoes \|\| \[\]/, 'com o nome que o motor lê');
assert.match(app, /window\.LabBancada\?\.restaurarEscolhas\?\.\(r\)/, 'e abrir na mesa devolve');

/* ===== a decisão de repertório, exercitada ===== */
const sb = { window: { LabCanvas: { getState: () => ({ nodes: sb._nodes || [] }) }, LabFB: { elementsById: {} } } };
sb.globalThis = sb;
vm.createContext(sb);
vm.runInContext("const norm = s => String(s||'').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,'');", sb);
const ini = banc.indexOf('    function nosDoCircuito()');
const fim = banc.indexOf('    /** O painel de escolhas.');
vm.runInContext(banc.slice(ini, fim), sb);

const EL = {
    asp_terra: { nome: 'Terra', tipoElemento: 'aspectus',
        condicoesFisicas: [{ condicao: 'Prostrado' }, { condicao: 'Imobilizado' }],
        condicoesEssencia: [{ condicao: 'Ancorado' }, { condicao: 'Lento' }],
        condicaoCritica: [{ condicao: 'Fratura' }] },
    sig_imp: { nome: 'Impressor', tipoElemento: 'sigilus', flags: ['impressor'] },
    sig_sub: { nome: 'Sublimador', tipoElemento: 'sigilus', flags: ['sublimador'] },
    sig_man: { nome: 'Manifestador', tipoElemento: 'sigilus', categoria: 'emissor',
        manifestacoes: [{ chave: 'parede', nome: 'Parede', nivelMin: 2 }] },
};
const projeto = (nodes) => {
    sb.window.LabFB.elementsById = EL; sb._nodes = nodes;
    vm.runInContext('x = JSON.stringify(projetoAtual())', sb);
    return JSON.parse(sb.x);
};

let j = projeto([{ elementId: 'asp_terra', nivel: 2 }, { elementId: 'sig_imp', nivel: 1 }]);
assert.deepEqual(j.repertorio.map(c => c.condicao), ['Prostrado', 'Imobilizado'],
    'sem Sublimador, a bancada oferece o repertório FÍSICO');
assert.equal(j.essencia, false);
assert.equal(j.nvImp, 1);

j = projeto([{ elementId: 'asp_terra', nivel: 2 }, { elementId: 'sig_imp', nivel: 3 }, { elementId: 'sig_sub', nivel: 1 }]);
assert.deepEqual(j.repertorio.map(c => c.condicao), ['Ancorado', 'Lento'],
    '🔒 com Sublimador, a lista trocou para o de essência');
assert.equal(j.essencia, true);
assert.deepEqual(j.criticas.map(c => c.condicao), ['Fratura']);

// dois Impressores: vale o maior, como em todo o resto do sistema
j = projeto([{ elementId: 'asp_terra', nivel: 1 }, { elementId: 'sig_imp', nivel: 1 }, { elementId: 'sig_imp', nivel: 3 }]);
assert.equal(j.nvImp, 3);

// sem Impressor não há painel de condição
j = projeto([{ elementId: 'asp_terra', nivel: 2 }]);
assert.equal(j.imp, null);
assert.equal(j.nvImp, 0);

// Manifestador é lido pelo NOME (ele é emissor, não tem flag própria)
j = projeto([{ elementId: 'sig_man', nivel: 2 }]);
assert.ok(j.man, 'o Manifestador tem de ser encontrado');
assert.equal(j.nvMan, 2);

/* ===== o cache-buster acompanhou ===== */
assert.match(css, /\.lab-banc-projeto\s*\{/, 'o painel tem estilo');
const vc = html.match(/laboratorium\.css\?v=(\d+)/), vb = html.match(/bancada\.js\?v=(\d+)/);
assert.ok(vc && Number(vc[1]) >= 5, 'CSS mudou: ?v= sobe junto');
assert.ok(vb && Number(vb[1]) >= 4, 'bancada.js mudou: ?v= sobe junto');

console.log('✅ escolhas do projeto OK — o repertório certo, o teto do Impressor, e a escolha sobrevive ao Grimório');
