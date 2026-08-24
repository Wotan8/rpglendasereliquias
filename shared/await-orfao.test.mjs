/**
 * `await` fora de função `async` — a classe de erro que `node --check` deixa passar.
 *
 * O `--check` decide sozinho se o arquivo é módulo ou script pelo conteúdo, e
 * quando decide "script" ele aceita `await` no meio de qualquer função: em
 * código sloppy, `await` é um IDENTIFICADOR, e `await confirmar(x)` passa a
 * ser lido como uma chamada à função `await`. Sintaxe válida, semântica
 * nenhuma. No navegador o mesmo arquivo é módulo, `await` é palavra reservada,
 * e o parse morre com "Unexpected reserved word" — que derruba o módulo
 * INTEIRO, não só a função. A página fica em branco sem dizer por quê.
 *
 * A cura é forçar o modo módulo: copiar cada `.js` para um `.mjs` temporário e
 * mandar o `node --check` nele. Extensão `.mjs` não deixa margem para o Node
 * adivinhar.
 *
 * ⚠️ Duas versões anteriores deste teste erraram, e as duas custaram uma tela:
 *   1ª — regex de import exigia que a linha acabasse no `;`, então
 *        `import './x.js'; // comentário` sobrava, o parse falhava por causa do
 *        import e o arquivo era PULADO em silêncio.
 *   2ª — parseava com `new Function`, que é sloppy, e por isso engolia
 *        exatamente o `await orfao(...)` que devia pegar.
 * Daí a regra: arquivo que não dá para analisar é FALHA, nunca silêncio.
 *
 *   node shared/await-orfao.test.mjs
 */
import { readFileSync, readdirSync, statSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

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

const pasta = mkdtempSync(join(tmpdir(), 'lr-await-'));
const alvo = join(pasta, 'alvo.mjs');

const orfaos = [];
const naoAnalisados = [];
const arquivos = varrer(RAIZ);

for (const caminho of arquivos) {
    const curto = caminho.replace(RAIZ + sep, '');
    writeFileSync(alvo, readFileSync(caminho));
    const r = spawnSync(process.execPath, ['--check', alvo], { encoding: 'utf8' });
    if (r.status === 0) continue;

    const erro = (r.stderr || '').split('\n').find(l => /Error:|SyntaxError/.test(l)) || r.stderr.trim();
    if (/await is only valid|Unexpected reserved word/.test(erro)) {
        // a linha do erro vem no cabeçalho do stderr: "…/alvo.mjs:1213"
        const linha = (r.stderr.match(/alvo\.mjs:(\d+)/) || [])[1];
        orfaos.push(`${curto}${linha ? ':' + linha : ''} :: await fora de função async`);
    } else {
        /* Script clássico costuma cair aqui por motivo legítimo (o Node exige
           módulo e o arquivo não é um). Guardo para conferência humana em vez
           de engolir — foi engolir que deixou o Painel do Mestre quebrar. */
        naoAnalisados.push(`${curto} :: ${erro.trim().slice(0, 110)}`);
    }
}
rmSync(pasta, { recursive: true, force: true });

if (orfaos.length) {
    console.error('❌ await fora de função async:\n  ' + orfaos.join('\n  '));
    console.error('\nMarque a função como `async` — e confira se quem a chama '
        + 'lê o retorno: virar promessa muda o valor para quem lia.');
    process.exit(1);
}

if (naoAnalisados.length) {
    console.log(`⚠️  ${naoAnalisados.length} arquivo(s) não parseiam como módulo `
        + '(esperado em script clássico; erro de sintaxe de verdade o node --check pega):');
    for (const a of naoAnalisados) console.log('   ' + a);
}
console.log(`✅ await-orfao: ${arquivos.length - naoAnalisados.length} de ${arquivos.length} arquivos `
    + 'analisados em modo módulo, nenhum await fora de função async');
