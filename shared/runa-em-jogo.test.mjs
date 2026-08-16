// Rodar: node shared/runa-em-jogo.test.mjs
//
// O circuito auditado virando runa jogável. O que este teste tranca é a Lei do
// Relógio (a runa não erra sem Defesa), a régua do dano, o "vale o maior" de
// dois Aspectus, e as três recusas que impedem uma runa quebrada de sair da
// bancada: Sublimador obrigatório, Erosor em natureza errada e Infusor sem
// contato.
import assert from 'node:assert/strict';
import { blocoDeCombate, usosDaRuna, ativacaoDoCircuito, nosComElemento } from './runa-em-jogo.js';

/* ===== catálogo mínimo, no formato que o cadastro gravou ===== */
const EL = {
    artus_criar:   { nome: 'Criar', tipoElemento: 'artus' },
    artus_destruir:{ nome: 'Destruir', tipoElemento: 'artus' },
    asp_fogo: { nome: 'Fogo', tipoElemento: 'aspectus', canalDano: 'Dano Ígneo', aceitaErosor: true,
        condicoesFisicas: [{ condicao: 'Queimadura' }, { condicao: 'Inflamado' }],
        condicoesEssencia: [{ condicao: 'Queimadura' }, { condicao: 'Amedrontado' }, { condicao: 'Exaustão' }],
        condicaoCritica: [{ condicao: 'Chaga' }] },
    asp_terra: { nome: 'Terra', tipoElemento: 'aspectus', canalDano: 'Dano Telúrico',
        condicoesFisicas: [{ condicao: 'Prostrado' }, { condicao: 'Imobilizado' }],
        condicoesEssencia: [{ condicao: 'Ancorado' }, { condicao: 'Lento' }],
        condicaoCritica: [{ condicao: 'Fratura' }] },
    asp_temporal: { nome: 'Temporal', tipoElemento: 'aspectus', canalDano: 'Dano Temporal',
        sublimadorObrigatorio: true, aceitaErosor: true,
        condicoesFisicas: [], condicoesEssencia: [{ condicao: 'Lento' }], condicaoCritica: [{ condicao: 'Envelhecido' }] },
    asp_abissal: { nome: 'Abissal', tipoElemento: 'aspectus', canalDano: 'Dano Abissal',
        sublimadorObrigatorio: true, formaFisicaCoringa: true, aceitaErosor: true,
        sanidadePorNivelGravar: 2, periciaExigida: 'Abismancia',
        condicoesFisicas: [{ condicao: 'Prostrado' }], condicoesEssencia: [{ condicao: 'Amedrontado' }],
        condicaoCritica: [{ condicao: 'Delírio' }] },
    asp_poder: { nome: 'Poder', tipoElemento: 'aspectus', canalDano: 'Dano Áureo', bloqueadoAprendizado: true,
        condicoesFisicas: [], condicoesEssencia: [], condicaoCritica: [] },
    sig_projetor: { nome: 'Projetor', tipoElemento: 'sigilus', categoria: 'emissor', flags: ['emissor'], niveis: [
        { nivel: 1, mira: { tipo: 'alvos', alcanceM: 5, maxAlvos: 1 } },
        { nivel: 2, mira: { tipo: 'alvos', alcanceM: 15, maxAlvos: 1 } },
        { nivel: 3, mira: { tipo: 'alvos', alcanceM: 40, maxAlvos: 3, penalidadeEsquiva: 2 } }] },
    sig_foco: { nome: 'Foco', tipoElemento: 'sigilus', categoria: 'emissor', flags: ['emissor'], niveis: [
        { nivel: 1, mira: { tipo: 'geometria', forma: 'cone', alcanceM: 1, comprimentoM: 1, angGraus: 30 } },
        { nivel: 2, mira: { tipo: 'geometria', forma: 'cone', alcanceM: 5, comprimentoM: 5, angGraus: 15 } },
        { nivel: 3, mira: { tipo: 'geometria', forma: 'cone', alcanceM: 15, comprimentoM: 15, angGraus: 5 } }] },
    sig_infusor: { nome: 'Infusor', tipoElemento: 'sigilus', categoria: 'emissor', flags: ['emissor', 'infusor'],
        exigeContato: true, niveis: [{ nivel: 1, mira: { tipo: 'alvos', alcanceM: 0, maxAlvos: 1, doseEss: 5 } }] },
    sig_sublimador: { nome: 'Sublimador', tipoElemento: 'sigilus', categoria: 'modulador', flags: ['sublimador'], niveis: [{ nivel: 1 }, { nivel: 2 }, { nivel: 3 }] },
    sig_impressor: { nome: 'Impressor', tipoElemento: 'sigilus', categoria: 'modulador', flags: ['impressor'], niveis: [{ nivel: 1 }, { nivel: 2 }, { nivel: 3 }] },
    sig_erosor: { nome: 'Erosor', tipoElemento: 'sigilus', categoria: 'modulador', flags: ['erosor'], niveis: [{ nivel: 1 }, { nivel: 2 }, { nivel: 3 }] },
    sig_toque: { nome: 'Toque', tipoElemento: 'sigilus', categoria: 'logico', niveis: [{ nivel: 1 }] },
    sig_gatilho: { nome: 'Gatilho', tipoElemento: 'sigilus', categoria: 'logico', niveis: [{ nivel: 1 }] },
    sig_reconhecedor: { nome: 'Reconhecedor Biométrico', tipoElemento: 'sigilus', categoria: 'logico', niveis: [{ nivel: 1 }] },
};
const no = (elementId, nivel = 1) => ({ id: 'n' + Math.random(), elementId, nivel });
const bloco = (nodes, opts = {}) => blocoDeCombate({ nodes, elementsById: EL, ct: 40, ramo: 'escripta', pericia: 3, runomancia: 3, ...opts });

/* ===== 1) a runa de bolso: Criar Fogo com Projetor ===== */
const lanca = bloco([no('artus_criar', 2), no('asp_fogo', 2), no('sig_projetor', 2)]);
assert.equal(lanca.jogavel, true, lanca.problemas.join(' | '));
assert.equal(lanca.dano, '2d6+2', 'Artus vira quantidade de dados, Aspectus vira bônus');
assert.equal(lanca.alvo, 2 + 2 + 2 + 3, 'Artus + Aspectus + Emissor + Runomancia');
assert.equal(lanca.rolaAcerto, false, '🔒 Lei do Relógio: sem Defesa declarada não há rolagem');
assert.deepEqual(lanca.mira, { tipo: 'alvos', alcanceM: 15, maxAlvos: 1 }, 'a mira sai do Emissor, do nível dele');
assert.equal(lanca.canal, 'Dano', 'sem Sublimador a runa fere na forma FÍSICA da essência');
assert.equal(lanca.formaEssencia, false);

/* ===== 2) o Teto de Ofício corta a perícia no Alvo ===== */
assert.equal(bloco([no('artus_criar', 2), no('asp_fogo', 2), no('sig_projetor', 2)],
    { runomancia: 5, tetoOficio: 2 }).alvo, 2 + 2 + 2 + 2, 'o Teto de Ofício corta a Runomancia');

/* ===== 3) Sublimador troca o canal e a barreira ===== */
const sublimada = bloco([no('artus_criar', 2), no('asp_fogo', 2), no('sig_projetor', 2), no('sig_sublimador', 1)]);
assert.equal(sublimada.formaEssencia, true);
assert.equal(sublimada.canal, 'Dano Ígneo', 'com Sublimador o canal é o da essência');
assert.equal(sublimada.condicoesAplicadas[0].condicao, 'Queimadura');
assert.equal(sublimada.condicoesAplicadas[0].chance, 40, 'essência = Nv × 20%');
assert.equal(lanca.condicoesAplicadas[0].chance, 20, 'física = Nv × 10%');

/* ===== 4) dois Aspectus: VALE O MAIOR, nunca a soma ===== */
const dois = bloco([no('artus_criar', 2), no('asp_fogo', 1), no('asp_terra', 3), no('sig_projetor', 1)]);
assert.equal(dois.nucleo.nvAspectus, 3, '🔒 o maior, não 1+3');
assert.equal(dois.dano, '2d6+3');
assert.equal(dois.nucleo.aspectus, 'Terra', 'e o dominante é quem dá o canal');

/* ===== 5) sem Impressor a natureza marca sozinha; com ele, escolhe ===== */
assert.equal(lanca.condicoesAplicadas.length, 1, 'sem Impressor, uma condição — a primeira do repertório');
const comImp = bloco([no('artus_criar', 2), no('asp_fogo', 2), no('sig_projetor', 1), no('sig_sublimador', 1), no('sig_impressor', 2)],
    { condicoesEscolhidas: ['Amedrontado', 'Exaustão'] });
assert.deepEqual(comImp.condicoesAplicadas.map(c => c.condicao), ['Amedrontado', 'Exaustão']);
const impSo1 = bloco([no('artus_criar', 2), no('asp_fogo', 2), no('sig_projetor', 1), no('sig_impressor', 1)],
    { condicoesEscolhidas: ['Inflamado'] });
assert.deepEqual(impSo1.condicoesAplicadas.map(c => c.condicao), ['Inflamado']);
// escolher sem Impressor é erro de projeto
assert.match(bloco([no('artus_criar', 1), no('asp_fogo', 1), no('sig_projetor', 1)],
    { condicoesEscolhidas: ['Amedrontado'] }).problemas.join(''), /exige um Impressor/);
// a crítica só existe a partir do Nv3, e continua exigindo crítico
const imp3 = bloco([no('artus_criar', 2), no('asp_fogo', 2), no('sig_projetor', 1), no('sig_impressor', 3)],
    { condicoesEscolhidas: ['Chaga'] });
assert.equal(imp3.condicoesAplicadas[0].portao, 'critico', 'a marca de crítico não vira chance');
assert.equal(imp3.condicoesAplicadas[0].chance, null);
assert.match(bloco([no('artus_criar', 2), no('asp_fogo', 2), no('sig_projetor', 1), no('sig_impressor', 2)],
    { condicoesEscolhidas: ['Chaga'] }).problemas.join(''), /Fora do repertório/, 'Nv2 não alcança a de crítico');

/* ===== 6) as três recusas ===== */
// Temporal sem Sublimador não tem como sair
assert.match(bloco([no('artus_criar', 2), no('asp_temporal', 2), no('sig_projetor', 1)]).problemas.join(''),
    /não tem forma física/, '🔒 Temporal exige Sublimador');
assert.equal(bloco([no('artus_criar', 2), no('asp_temporal', 2), no('sig_projetor', 1), no('sig_sublimador', 1)]).jogavel, true);
// Erosor em natureza que não desfaz
assert.match(bloco([no('artus_destruir', 2), no('asp_terra', 2), no('sig_projetor', 1), no('sig_erosor', 1)]).problemas.join(''),
    /não aceita Erosor/, '🔒 Terra não erode');
// Infusor sem toque nem proximidade fica inerte
assert.match(bloco([no('artus_criar', 1), no('asp_fogo', 1), no('sig_infusor', 1)]).problemas.join(''),
    /só injeta com ativação por toque/, '🔒 Infusor precisa de contato');
assert.equal(bloco([no('artus_criar', 1), no('asp_fogo', 1), no('sig_infusor', 1), no('sig_toque', 1)]).jogavel, true);

/* ===== 7) Erosor: a escada some, o dano vira verdadeiro ===== */
const ero = bloco([no('artus_criar', 5), no('asp_fogo', 5), no('sig_projetor', 1), no('sig_erosor', 2)]);
assert.equal(ero.dano, '2', '🔒 o Erosor apaga a escada de Artus — 5d6+5 vira 2');
assert.equal(ero.danoVerdadeiro, true);
assert.equal(ero.canal, 'verdadeiro', 'ignora toda Blindagem');
assert.equal(ero.erosor.usosPorCena, 2);
assert.equal(ero.erosor.reduzVitMaxima, true);
assert.equal(bloco([no('artus_criar', 1), no('asp_fogo', 1), no('sig_projetor', 1), no('sig_erosor', 3)]).dano, '3+1d4',
    'só o Nv3 volta a ter dado');

/* ===== 8) Abissal: coringa, e cobra Sanidade de quem grava ===== */
const ab = bloco([no('artus_criar', 3), no('asp_abissal', 3), no('sig_projetor', 1)]);
assert.equal(ab.jogavel, true, 'o coringa dispensa Sublimador mesmo marcado como obrigatório');
assert.equal(ab.sanidadeGravar, 6, '2 × Nv3 de Sanidade por gravação');
assert.equal(ab.periciaExigida, 'Abismancia');

/* ===== 9) Poder é visível e intransitável ===== */
assert.match(bloco([no('artus_criar', 1), no('asp_poder', 1), no('sig_projetor', 1)]).problemas.join(''),
    /bloqueado para aprendizado/);

/* ===== 10) sem Núcleo e sem Emissor ===== */
assert.match(bloco([no('sig_toque', 1)]).problemas.join(''), /Sem Núcleo/);
assert.match(bloco([no('artus_criar', 1), no('asp_fogo', 1)]).problemas.join(''), /Sem Emissor/);

/* ===== 11) ativação ===== */
const at = (ids) => ativacaoDoCircuito(nosComElemento(ids.map(i => no(i)), EL));
assert.equal(at(['sig_toque']).modo, 'toque');
assert.equal(at(['sig_toque']).contato, true);
assert.equal(at(['sig_gatilho']).modo, 'automatica');
assert.equal(at(['sig_reconhecedor']).modo, 'restrita');
assert.equal(at(['sig_projetor']).modo, 'manual', 'sem lógica nenhuma: 1 Ação Padrão, qualquer um (Parte XIV)');

/* ===== 12) usos por ofício (Parte XIV) ===== */
assert.deepEqual(usosDaRuna({ ramo: 'escripta', ct: 40, pericia: 3, qualidadeTinta: 1 }),
    { usos: 2, permanente: false, rascunho: false }, '3 + 1 − ⌈40÷20⌉ = 2');
assert.equal(usosDaRuna({ ramo: 'talha', ct: 40, pericia: 3, qualidadeTinta: 1 }).usos, 20, '× 10');
assert.equal(usosDaRuna({ ramo: 'talha', ct: 200, pericia: 1 }).usos, 10, 'o piso da Talha é 10');
assert.equal(usosDaRuna({ ramo: 'escripta', ct: 200, pericia: 1 }).usos, 1, 'o piso da Escripta é 1');
assert.deepEqual(usosDaRuna({ ramo: 'tatuagem', ct: 40, pericia: 3 }),
    { usos: null, permanente: true, rascunho: false }, 'tatuagem não conta usos');
assert.equal(usosDaRuna({ ramo: 'talha', ct: 20, pericia: 5, temDominio: false }).usos, 1,
    '🔒 sem o Domínio do ofício é rascunho: 1 uso, por melhor que seja a perícia');
assert.equal(usosDaRuna({ ramo: 'talha', ct: 20, pericia: 5, temDominio: false }).rascunho, true);

console.log('✅ runa em jogo OK — Lei do Relógio, o maior dos Aspectus, e as recusas que a bancada tem de fazer');
