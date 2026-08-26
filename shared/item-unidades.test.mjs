/**
 * Peso e Tamanho de item: unidade sempre, arredondamento nunca.
 *
 * Tamanho está na escala de METROS e é fracionado — 0,1 é 10 cm. Um `parseInt`
 * em qualquer ponto do caminho transforma uma adaga de 0,3 m em 0 e um item de
 * 1,2 m em 1, silenciosamente. Como o campo passa por seis formulários
 * diferentes, este teste varre o repo inteiro em vez de confiar em um só.
 *
 * Roda com: node shared/item-unidades.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const IGNORAR = new Set(['node_modules', '.git', '.claude', '.agents', 'functions',
                         'graphify-out', 'sistema antigo e lore', 'changelogs']);

function varrerJs(dir, achados = []) {
    for (const nome of readdirSync(dir)) {
        if (IGNORAR.has(nome)) continue;
        const full = path.join(dir, nome);
        if (statSync(full).isDirectory()) varrerJs(full, achados);
        else if (nome.endsWith('.js') && !nome.endsWith('.test.mjs')) achados.push(full);
    }
    return achados;
}

const arquivos = varrerJs(raiz).map(f => ({
    rel: path.relative(raiz, f).replace(/\\/g, '/'),
    src: readFileSync(f, 'utf8')
}));
assert.ok(arquivos.length > 50, `varredura achou só ${arquivos.length} arquivos — caminho errado?`);

/* ===== 1. Nada pode arredondar Tamanho ou Peso de item =====
   `tamanho` também nomeia tamanho de fonte e de célula do Tabuleiro, que são
   inteiros de propósito — por isso a checagem é ancorada nos nomes dos campos
   de ITEM, não na palavra solta. */
const CAMPOS_DE_ITEM = [
    'invFormTamanho', 'invFormPeso', 'customItemTamanho', 'customItemPeso',
    'aif_tamanho', 'aif_peso', 'itemTamanhoMestre', 'itemPesoMestre',
    'item.tamanho', 'item.peso', 'i.tamanho', 'i.peso',
];

const arredondam = [];
for (const { rel, src } of arquivos) {
    src.split('\n').forEach((linha, n) => {
        // O que importa é o ARGUMENTO: `parseInt(i.quantidade)` numa linha que
        // também soma `i.peso` é legítimo — quantidade é inteira de propósito.
        for (const m of linha.matchAll(/(?:parseInt|Math\.round)\s*\(\s*([^,)]*)/g)) {
            const arg = m[1];
            // Math.round(x * 100) / 100 corta casa morta, não arredonda o valor.
            if (/\*\s*100/.test(arg)) continue;
            if (CAMPOS_DE_ITEM.some(c => arg.includes(c))) {
                arredondam.push(`${rel}:${n + 1}  ${linha.trim().slice(0, 90)}`);
            }
        }
    });
}
assert.deepEqual(arredondam, [],
    'Tamanho/Peso de item não pode passar por parseInt ou arredondamento:\n' + arredondam.join('\n'));

/* ===== 2. Todo formulário de item aceita fração =====
   Sem `step`, o input[type=number] recusa 0,3 na validação do navegador. */
const semStep = [];
for (const { rel, src } of arquivos) {
    src.split('\n').forEach((linha, n) => {
        const ehCampoDeItem = /id="(invFormTamanho|invFormPeso|customItemTamanho|customItemPeso|itemTamanhoMestre|itemPesoMestre)"/.test(linha);
        if (ehCampoDeItem && !/step="/.test(linha)) semStep.push(`${rel}:${n + 1}`);
    });
}
assert.deepEqual(semStep, [], 'campo de Peso/Tamanho sem step= aceita só inteiro:\n' + semStep.join('\n'));

/* ===== 3. Os formatadores estão iguais em toda cópia =====
   São duplicados de propósito (metade dos arquivos é script clássico e não
   importa de shared/), mas duplicata que diverge é pior que duplicata. */
const copiasPeso = new Set(), copiasTam = new Set();
const donos = [];
for (const { rel, src } of arquivos) {
    // Aceita a copia indentada: em aliado-inventario.js os dois vivem DENTRO da
    // IIFE, porque inventory.js ja usa esses nomes no escopo global e `const`
    // repetido em script classico derruba o arquivo inteiro.
    const p = src.match(/^[ 	]*const _pesoKg = .*$/m);
    const t = src.match(/^[ 	]*const _tamanhoM = .*$/m);
    if (p || t) donos.push(rel);
    if (p) copiasPeso.add(p[0].trim());
    if (t) copiasTam.add(t[0].trim());
}
assert.ok(donos.length >= 6, `só ${donos.length} arquivos formatam peso/tamanho: ${donos.join(', ')}`);
assert.equal(copiasPeso.size, 1, 'as cópias de _pesoKg divergiram:\n' + [...copiasPeso].join('\n'));
assert.equal(copiasTam.size, 1, 'as cópias de _tamanhoM divergiram:\n' + [...copiasTam].join('\n'));

/* ===== 4. E formatam certo =====
   Exibição adaptativa (25/08/2026): abaixo de 1 a unidade desce para g/cm;
   de 1 pra cima, kg/m com vírgula pt-BR e sem zeros à direita. O dado gravado
   segue em kg/m — só a tela converte. */
const _pesoKg = eval('(' + [...copiasPeso][0].replace('const _pesoKg = ', '') .replace(/;$/, '') + ')');
const _tamanhoM = eval('(' + [...copiasTam][0].replace('const _tamanhoM = ', '').replace(/;$/, '') + ')');

assert.equal(_pesoKg(0.5), '500 g');
assert.equal(_pesoKg(0.035), '35 g', '35 g não pode virar "0.04 kg"');
assert.equal(_pesoKg('1'), '1 kg');
assert.equal(_pesoKg(1.25), '1,25 kg');
assert.equal(_pesoKg(undefined), '0 kg', 'sem peso ainda mostra a unidade');

assert.equal(_tamanhoM(0.1), '10 cm', '0,1 m = 10 cm, e não pode virar 0');
assert.equal(_tamanhoM(1.2), '1,2 m');
assert.equal(_tamanhoM(1), '1 m', 'inteiro não ganha casa morta');
assert.equal(_tamanhoM(0.35), '35 cm');
assert.equal(_tamanhoM(undefined), '0 m');
// Ponto flutuante: 0.1 + 0.2 = 0.30000000000000004 não pode vazar para a tela.
assert.equal(_tamanhoM(0.1 + 0.2), '30 cm');

console.log(`✅ unidades de item OK — ${arquivos.length} arquivos varridos, `
    + `${donos.length} formatam peso/tamanho, nenhum arredonda`);
