// Rodar: node escape-html.test.mjs
//
// Uma coisa só: todo helper de escape do projeto tem de escapar ASPAS DUPLAS.
//
// Não é preciosismo. Todos os painéis montam atributo por interpolação
// (`value="${escapeHtml(x)}"`, `src="${escapeHtml(url)}"`,
// `data-loja-item="${escapeHtml(id)}"`), e o texto vem de campo que o próprio
// jogador escreve: nome de exibição, nome de item, descrição. Um helper que
// escapa `<`, `>` e `&` mas deixa `"` passar não protege atributo nenhum — o
// valor fecha as aspas e o resto vira marcação.
//
// É o que acontece com `textContent → innerHTML`, que parece escape completo e
// não é. Em 31/08/2026 duas das seis cópias estavam assim (menu-firebase.js e
// painel-mestre/js/ui-utils.js). As outras quatro já tinham sido consertadas à
// mão, cada uma com o seu comentário explicando o mesmo problema — sinal de que
// isso volta sozinho se ninguém estiver olhando. Este teste é quem olha.
//
// O COMO é livre: `.replace(/"/g,'&quot;')` direto ou textContent seguido do
// replace das aspas, tanto faz. O que se cobra aqui é o resultado.

import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const IGNORAR = new Set(['node_modules', '.git', '.claude', '.graphify', 'graphify-out',
    'functions', 'sistema antigo e lore', '.firebase', '.obsidian', 'imagens-geradas']);

function jsDoProjeto(dir, saida = []) {
    for (const nome of readdirSync(dir)) {
        if (IGNORAR.has(nome)) continue;
        const caminho = join(dir, nome);
        if (statSync(caminho).isDirectory()) jsDoProjeto(caminho, saida);
        else if (nome.endsWith('.js')) saida.push(caminho);
    }
    return saida;
}

/** Corpo da função a partir do `{`, contando chaves. Regex não serve: a
 *  primeira versão deste teste casava até o próximo `}` de coluna zero e
 *  engolia o arquivo inteiro quando a função era aninhada. */
function corpoDaFuncao(fonte, indiceDaChave) {
    let nivel = 0;
    for (let i = indiceDaChave; i < fonte.length; i++) {
        if (fonte[i] === '{') nivel++;
        else if (fonte[i] === '}' && --nivel === 0) return fonte.slice(indiceDaChave, i + 1);
    }
    return fonte.slice(indiceDaChave);
}

const DECL = /(?:export\s+)?function\s+(esc|escHtml|escapeHtml|escapeHTML)\s*\([^)]*\)\s*\{/g;
const ESCAPA_ASPAS = /&quot;|&#0*34;|&#x0*22;/i;

const suspeitos = [];
let encontradas = 0;

for (const arquivo of jsDoProjeto(RAIZ)) {
    const fonte = readFileSync(arquivo, 'utf8');
    for (const m of fonte.matchAll(DECL)) {
        encontradas++;
        const corpo = corpoDaFuncao(fonte, m.index + m[0].length - 1);
        if (!ESCAPA_ASPAS.test(corpo)) {
            suspeitos.push(`${arquivo.replace(RAIZ, '')} → ${m[1]}() não escapa aspas duplas`);
        }
    }
}

assert.ok(encontradas >= 5, `esperava achar os helpers de escape, achei ${encontradas}`);
assert.deepEqual(suspeitos, [], '\n  ' + suspeitos.join('\n  ') + '\n');

console.log(`escape-html.test.mjs: OK (${encontradas} helpers conferidos)`);
