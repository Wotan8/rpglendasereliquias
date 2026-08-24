/**
 * `await` fora de função `async` — a classe de erro que `node --check` deixa passar.
 *
 * O `--check` decide sozinho se o arquivo é módulo ou script, e quando decide
 * "módulo" ele aceita `await` no topo. Só que um `await` dentro de uma função
 * NORMAL continua sendo erro de sintaxe, e essa combinação escapou: na
 * migração dos 176 diálogos nativos, cinco arquivos passaram no `--check` e
 * quebravam no navegador com "Unexpected reserved word" — a página inteira
 * morria em silêncio, porque módulo que não parseia não roda nada.
 *
 * O truque aqui é tirar as linhas de `import`/`export` e parsear o resto como
 * SCRIPT: em script, `await` fora de async é erro sempre, sem exceção de topo.
 *
 * Vale para todo `.js` do repositório, não só para os diálogos — qualquer
 * `await` acrescentado sem marcar a função cai aqui.
 *
 *   node shared/await-orfao.test.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const PULAR = new Set(['node_modules', '.git', '.claude', 'graphify-out', 'functions']);

function varrer(dir, achados = []) {
    for (const nome of readdirSync(dir)) {
        if (PULAR.has(nome)) continue;
        const caminho = join(dir, nome);
        if (statSync(caminho).isDirectory()) varrer(caminho, achados);
        else if (nome.endsWith('.js')) achados.push(caminho);
    }
    return achados;
}

/** Tira o que só existe em módulo, para o resto poder ser lido como script. */
const semModulo = (s) => s
    .replace(/^\s*import\s+[^;]*?;\s*$/gm, '')
    .replace(/^\s*import\s*\{[\s\S]*?\}\s*from\s*[^;]*?;\s*$/gm, '')
    .replace(/^\s*export\s+(default\s+)?/gm, '')
    .replace(/^\s*export\s*\{[^}]*\}\s*;?\s*$/gm, '');

const orfaos = [];
const arquivos = varrer(RAIZ);
for (const caminho of arquivos) {
    let fonte;
    try { fonte = semModulo(readFileSync(caminho, 'utf8')); }
    catch { continue; }
    try {
        // eslint-disable-next-line no-new-func
        new Function(fonte);
    } catch (e) {
        // Só interessa o await órfão. Erro de sintaxe de verdade o `node
        // --check` já pega, e sintaxe só-de-módulo aqui seria falso positivo.
        if (/await is only valid|Unexpected reserved word/.test(e.message)) {
            orfaos.push(`${caminho.replace(RAIZ + sep, '')} :: ${e.message}`);
        }
    }
}

if (orfaos.length) {
    console.error('❌ await fora de função async:\n  ' + orfaos.join('\n  '));
    console.error('\nMarque a função como `async` — e confira se quem a chama '
        + 'lê o retorno: virar promessa muda o valor para quem lia.');
    process.exit(1);
}
console.log(`✅ await-orfao: ${arquivos.length} arquivos, nenhum await fora de função async`);
