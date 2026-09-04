/**
 * 🚪 O portão da condição, a cura por potência e o d10 com Desvantagem (Livro, p. 9–10).
 * Roda com: node shared/condicao-portao.test.mjs
 */
import assert from 'node:assert/strict';
import { condicaoPega, curarAflicoes, efeitoDasCondicoes, PORTOES, faixaDeFerimento, condicoesDeFerimento, nivelDeSobrecarga } from './combate-cenas.js';
import { rolarD10 } from '../tabuleiro/js/tab-conflito-calc.js';

assert.deepEqual(PORTOES, ['direto', 'corpo', 'mente', 'nenhum']);

// direto e sem portão sempre pegam
assert.equal(condicaoPega({ portao: 'direto', graus: -3 }), true, 'direto: entrou o golpe, entrou a condição');
assert.equal(condicaoPega({ portao: 'nenhum', graus: -3 }), true, 'sem portão: só em quem quer');
// resistido compara Graus com o número do alvo
assert.equal(condicaoPega({ portao: 'corpo', graus: 3, resistencia: 3 }), true, 'Graus ≥ VIG: pega');
assert.equal(condicaoPega({ portao: 'corpo', graus: 2, resistencia: 3 }), false, 'Graus < VIG: resistiu');
assert.equal(condicaoPega({ portao: 'mente', graus: 2, resistencia: 4 }), false, 'mente compara com PRS');
assert.equal(condicaoPega({ portao: 'corpo', graus: 2, resistencia: 3, critico: true }), true, '🔒 crítico sempre pega');
// a Resistência da cena entra somada (VIG 3 + já pegou 1 vez = 4)
assert.equal(condicaoPega({ portao: 'corpo', graus: 3, resistencia: 3 + 1 }), false, 'segunda vez na mesma cena: +1');

// cura por potência: só Aflição, só nível ≤ N
const REG = [{ nome: 'Peçonha', aflicao: true }, { nome: 'Sangrando' }];
const conds = [{ nome: 'Peçonha', nivel: 2 }, { nome: 'Peçonha', nivel: 4 }, { nome: 'Sangrando', nivel: 1 }];
let r = curarAflicoes(conds, REG, 3);
assert.deepEqual(r.curadas, ['Peçonha'], 'só a Peçonha 2 sai com potência 3');
assert.equal(r.condicoes.length, 2);
assert.equal(curarAflicoes(conds, REG, 0).curadas.length, 0, 'potência 0 não cura nada');
assert.equal(curarAflicoes(conds, REG, 5).condicoes.length, 1, 'potência 5 tira as duas Peçonhas; Sangrando não é Aflição');

// Desvantagem e o valor por rodada por nível
const reg2 = [
    { nome: 'Prostrado', desvantagem: true },
    { nome: 'Sangrando', acumulaNiveis: true, nivelMaximo: 5, afetaTabuleiro: true, porRodadaEfeito: 'dano_vit', porRodadaValor: '1', porRodadaPorNivel: true },
];
const ef = efeitoDasCondicoes([{ nome: 'Prostrado' }, { nome: 'Sangrando', nivel: 3 }], reg2);
assert.equal(ef.desvantagem, true, 'Prostrado dá Desvantagem');
assert.equal(ef.porRodada[0].valor, '3', 'Sangrando 3 = 3 por rodada');
assert.equal(efeitoDasCondicoes([{ nome: 'Sangrando' }], reg2).porRodada[0].valor, '1', 'nível ausente = 1');
assert.equal(efeitoDasCondicoes([], reg2).desvantagem, false);

// o d10 com Desvantagem fica com o pior (o maior, que é roll-under)
const seq = (vals) => { let i = 0; return () => vals[i++ % vals.length]; };
assert.deepEqual(rolarD10({ rng: seq([4]) }), { dado: 4, dados: [4] }, 'sem nada: um dado');
assert.deepEqual(rolarD10({ desvantagem: true, rng: seq([4, 8]) }), { dado: 8, dados: [4, 8] }, 'Desvantagem: o pior');
assert.deepEqual(rolarD10({ vantagem: true, rng: seq([4, 8]) }), { dado: 4, dados: [4, 8] }, 'Vantagem: o melhor');
assert.deepEqual(rolarD10({ vantagem: true, desvantagem: true, rng: seq([4, 8]) }).dados, [4], 'as duas se anulam');

// 🩹 Ferimento pela Vitalidade (Livro, p. 10): 24 → 18 / 12 / 6
assert.equal(faixaDeFerimento(24, 24), null, 'inteiro');
assert.equal(faixaDeFerimento(18, 24), 'Ferido', 'até 75%');
assert.equal(faixaDeFerimento(12, 24), 'Grave', 'até 50%');
assert.equal(faixaDeFerimento(6, 24), 'Beira da Morte', 'até 25%');
assert.equal(faixaDeFerimento(0, 24), 'Morrendo', 'zero');
assert.equal(faixaDeFerimento(20, 24, [50, 25, 10]), null, 'as faixas vêm de config/regras');
assert.equal(faixaDeFerimento(5, 0), null, 'sem máximo não há trilha');
const REGF = [{ nome: 'Ferido', icone: '🩹', trilha: 'ferimento' }, { nome: 'Grave', trilha: 'ferimento' }];
let f = condicoesDeFerimento([{ nome: 'Cego' }, { nome: 'Ferido' }], 'Grave', REGF);
assert.deepEqual([f.entrou, f.saiu], ['Grave', ['Ferido']], 'troca de faixa: sai Ferido, entra Grave');
assert.deepEqual(f.condicoes.map(c => c.nome), ['Cego', 'Grave'], 'a condição manual fica');
f = condicoesDeFerimento(f.condicoes, 'Grave', REGF);
assert.equal(f.entrou, null, 'mesma faixa: nada muda');
f = condicoesDeFerimento(f.condicoes, null, REGF);
assert.deepEqual([f.saiu, f.condicoes.length], [['Grave'], 1], 'curou: a faixa sai');
// ⚖️ Sobrecarga pelo peso
assert.equal(nivelDeSobrecarga(20, 25), 0, 'dentro da Carga');
assert.equal(nivelDeSobrecarga(30, 25), 1, '+20%: nível 1');
assert.equal(nivelDeSobrecarga(36, 25), 2, '+44%: nível 2');
assert.equal(nivelDeSobrecarga(40, 25), 3, '+60%: nível 3');
assert.equal(nivelDeSobrecarga(30, 0), 0, 'sem Carga não há trilha');

console.log('✅ portão, cura por potência, Desvantagem, o d10, Ferimento e Sobrecarga OK');
