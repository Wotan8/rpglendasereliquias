/**
 * O foco de conjuração sai do INVENTÁRIO, não das linhas de ataque.
 *
 * O bug: a Rabeca estava empunhada na Mão 1 e o Bardo via "sem Corda
 * equipado". Causa — a lista de itens equipados era montada a partir dos
 * GOLPES, e instrumento não é arma: a Rabeca é Objeto, não tem fórmula de
 * dano, e por isso nunca virava linha de ataque. Valia para todo foco que não
 * machuca: totem, talismã, símbolo sagrado, grimório.
 *
 * Este teste lê o fonte e garante que a lista não voltou a sair dos golpes.
 *
 * Roda com: node tabuleiro/js/tab-foco-conjuracao.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { avaliarFormas } from '../../shared/conjuracao.js';

const src = readFileSync(new URL('./tab-golpes.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

/* ===== o fonte: a lista vem do inventário ===== */
assert.match(src, /itensEquipados:\s*await\s+itensDeConjuracao\(p\)/,
    'itensEquipados tem de sair do inventário (itensDeConjuracao), nunca das linhas de ataque');
assert.doesNotMatch(src, /itensEquipados:\s*equip\b/,
    'voltar a montar itensEquipados a partir de `equip` (os golpes) reintroduz o bug da Rabeca');
assert.match(src, /tagsDoModelo/,
    'as tags do MODELO do catálogo precisam entrar: a instância costuma não repeti-las');

// só o que está mesmo em uso conta como foco
const iniEstados = src.indexOf('ESTADOS_EM_USO');
assert.ok(iniEstados > 0, 'os estados de "em uso" precisam estar declarados');
const linhaEstados = src.slice(iniEstados, src.indexOf('\n', iniEstados));
for (const e of ['empunhado', 'segurar', 'vestido', 'fixado']) {
    assert.ok(linhaEstados.includes(e), `"${e}" conta como item em uso`);
}
assert.ok(!linhaEstados.includes('armazenado'), 'item guardado na mochila NÃO conjura');

/* ===== a decisão pura, com o caso real da Rabeca ===== */
const formas = [
    { id: 'f_corda', nome: 'Inst. Corda', icone: '🪕', requisito: 'item_tag', itemTags: ['Corda'], derivedValueIds: ['vd_corda'] },
    { id: 'f_sopro', nome: 'Inst. Sopro', icone: '🎺', requisito: 'item_tag', itemTags: ['Sopro'], derivedValueIds: ['vd_sopro'] },
    { id: 'f_vocal', nome: 'Vocal', icone: '🗣️', requisito: 'parte_corpo', partesDoCorpoNomes: ['Cabeça'], derivedValueIds: ['vd_vocal'] },
];
const veiculos = [
    { vdId: 'vd_vocal', label: 'Vocal', vdNome: 'Vocal' },
    { vdId: 'vd_corda', label: 'Inst. Corda', vdNome: 'Inst. Cordas' },
    { vdId: 'vd_sopro', label: 'Inst. Sopro', vdNome: 'Inst. Sopro' },
];
const ctx = {
    acertoDoVd: (n) => ({ 'Vocal': 10, 'Inst. Cordas': 11, 'Inst. Sopro': 9 }[n] ?? null),
    condicoes: [], condicaoPorId: () => null,
    partesInteiras: ['Cabeça'],
    // a Rabeca, exatamente como está no catálogo
    itensEquipados: [{ nome: 'Rabeca', tags: ['Instrumento', 'Corda'] }],
};

const r = avaliarFormas(veiculos, formas, ctx);
const corda = r.find(x => x.nome === 'Inst. Corda');
assert.equal(corda.indisponivel, '', 'com a Rabeca na mão, Inst. Corda TEM de estar disponível');
assert.equal(corda.comItem, 'Rabeca', 'e a tela diz com que item se conjura');
assert.equal(corda.acerto, 11);

const sopro = r.find(x => x.nome === 'Inst. Sopro');
assert.match(sopro.indisponivel, /sem Sopro/, 'sem instrumento de sopro, essa forma segue bloqueada');

const vocal = r.find(x => x.nome === 'Vocal');
assert.equal(vocal.indisponivel, '', 'a Cabeça inteira libera o Vocal');

// sem instrumento nenhum, as duas de item caem
const semNada = avaliarFormas(veiculos, formas, { ...ctx, itensEquipados: [] });
assert.match(semNada.find(x => x.nome === 'Inst. Corda').indisponivel, /sem Corda/);
assert.equal(semNada.find(x => x.nome === 'Vocal').indisponivel, '', 'a voz não depende de item');

console.log('✅ foco de conjuração OK — vem do inventário, junta tags do modelo, e a Rabeca conjura');
