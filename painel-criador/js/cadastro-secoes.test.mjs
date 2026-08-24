/**
 * As gavetas dos cadastros do Painel do Criador conferem com os campos.
 *
 * Duas coisas quebram em silêncio e é por elas que este teste existe:
 *
 *  1. CHAVE PERDIDA — campo novo em MODULE_DEFS que ninguém encaixa numa
 *     gaveta. Ele não some (cai em "Outros campos"), mas aparece num balaio
 *     sem nome, o que é quase pior: ninguém procura ali.
 *
 *  2. GAVETA SEM ÂNCORA — gaveta em que TODOS os campos são condicionais.
 *     Com o interruptor desligado ela fica sem nenhum campo visível e o
 *     atualizarResumo a esconde inteira — junto com o interruptor que a
 *     ligaria de volta. Toda gaveta com campo condicional precisa de pelo
 *     menos um campo que apareça sempre.
 *
 * MODULE_DEFS mora dentro de painel-firebase.js, que importa o Firebase e não
 * roda em Node. Por isso as chaves são lidas do TEXTO do arquivo — é feio, mas
 * é o que permite este teste existir sem subir meio painel.
 *
 *   node painel-criador/js/cadastro-secoes.test.mjs
 */
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
    SECOES_CONDICAO, SECOES_CLASSE, SECOES_TRIBO, SECOES_VALOR_DERIVADO,
} from './cadastro-secoes.js';

const AQUI = dirname(fileURLToPath(import.meta.url));
const FONTE = readFileSync(join(AQUI, 'painel-firebase.js'), 'utf8');

/**
 * Campos de PRIMEIRO nível de um módulo, na ordem, com o que os condiciona.
 * Só o nível 1: `arrayFields` tem `key` próprio (a Tribo repete `nome` dentro
 * de Perícias e de Unidades Militares) e contá-los daria chave fantasma.
 */
function camposDoModulo(mod) {
    const ini = FONTE.indexOf(`\n    ${mod}: {`);
    assert.ok(ini > 0, `módulo ${mod} não encontrado em MODULE_DEFS`);
    const abre = FONTE.indexOf('fields: [', ini);
    assert.ok(abre > 0, `módulo ${mod} sem lista de campos`);

    let prof = 0, fim = -1;
    for (let i = abre + 8; i < FONTE.length; i++) {
        const c = FONTE[i];
        if (c === '[') prof++;
        else if (c === ']' && --prof === 0) { fim = i; break; }
    }
    assert.ok(fim > 0, `lista de campos de ${mod} não fecha`);

    const corpo = FONTE.slice(abre + 9, fim);
    const campos = [];
    let chaves = 0;
    for (let i = 0; i < corpo.length; i++) {
        if (corpo[i] === '{') {
            if (++chaves === 1) {
                // o objeto do campo vai daqui até a chave que o fecha
                let d = 1, j = i + 1;
                for (; j < corpo.length && d; j++) {
                    if (corpo[j] === '{') d++;
                    else if (corpo[j] === '}') d--;
                }
                const bloco = corpo.slice(i, j);
                const k = /key:\s*'([^']+)'/.exec(bloco);
                if (k) campos.push({
                    key: k[1],
                    condicional: /showWhen(Boolean|NotNull)?:/.test(bloco.split('arrayFields')[0]),
                });
            }
        } else if (corpo[i] === '}') chaves--;
    }
    assert.ok(campos.length, `nenhum campo lido em ${mod}`);
    return campos;
}

const CADASTROS = [
    ['conditions', 'Condição', SECOES_CONDICAO],
    ['classes', 'Classe', SECOES_CLASSE],
    ['tribes', 'Tribo', SECOES_TRIBO],
    ['derivedValues', 'Valor Derivado', SECOES_VALOR_DERIVADO],
];

let totalCampos = 0;
for (const [mod, nome, secoes] of CADASTROS) {
    const campos = camposDoModulo(mod);
    const daSpec = new Set(campos.map(c => c.key));
    const nasGavetas = secoes.flatMap(s => s.campos);
    totalCampos += campos.length;

    // 1. nenhuma chave perdida, nenhuma chave fantasma, nenhuma repetida
    const perdidas = [...daSpec].filter(k => !nasGavetas.includes(k));
    assert.deepEqual(perdidas, [],
        `${nome}: campo sem gaveta — ${perdidas.join(', ')}`);

    const fantasmas = nasGavetas.filter(k => !daSpec.has(k));
    assert.deepEqual(fantasmas, [],
        `${nome}: gaveta cita campo que não existe — ${fantasmas.join(', ')}`);

    const repetidas = nasGavetas.filter((k, i) => nasGavetas.indexOf(k) !== i);
    assert.deepEqual(repetidas, [],
        `${nome}: campo em duas gavetas — ${repetidas.join(', ')}`);

    // 2. toda gaveta precisa de um campo que apareça sempre
    for (const s of secoes) {
        const meus = s.campos.map(k => campos.find(c => c.key === k));
        assert.ok(meus.some(c => !c.condicional),
            `${nome} › ${s.titulo}: todos os campos são condicionais — a gaveta ` +
            `some junto com o interruptor que a ligaria de volta`);
    }

    // 3. higiene do mapa: id único, título e dica presentes
    const ids = secoes.map(s => s.id);
    assert.equal(new Set(ids).size, ids.length, `${nome}: id de gaveta repetido`);
    for (const s of secoes) {
        assert.ok(s.titulo && s.dica && s.icone, `${nome} › ${s.id}: falta título, dica ou ícone`);
        assert.ok(s.campos.length, `${nome} › ${s.id}: gaveta vazia`);
    }

    // 4. alguma gaveta tem de nascer aberta, senão o formulário abre em branco
    assert.ok(secoes.some(s => s.aberta), `${nome}: nenhuma gaveta nasce aberta`);

    console.log(`  ✓ ${nome.padEnd(15)} ${String(campos.length).padStart(2)} campos em ${secoes.length} gavetas`);
}

console.log(`✅ cadastro-secoes: ${totalCampos} campos dos 4 cadastros, todos com gaveta e nenhuma gaveta órfã`);
