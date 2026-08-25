// Rodar: node shared/sanfona.test.mjs
//
// A gramática de recolher/expandir só continua única enquanto ninguém escrever
// a própria. Este teste varre o projeto atrás de:
//
//   1. seta de bloco retrátil desenhada fora de shared/sanfona.css;
//   2. página que usa `.lr-sanfona`/`.lr-seta`/`data-sanfona` sem carregar a
//      folha — o bloco fica sem seta nenhuma e ninguém percebe até abrir;
//   3. bloco marcado `data-sanfona` sem cabeçalho onde pendurar o botão.
//
// O comportamento (o botão, a contagem, o que some em bloco estreito) é medido
// ao vivo em __check-sanfona.html: precisa de layout de verdade.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const PULAR = new Set(['.git', 'node_modules', '.claude', 'graphify-out', 'functions',
    'sistema antigo e lore', 'avulsos-imagens']);

function* arquivos(dir) {
    for (const nome of readdirSync(dir)) {
        if (PULAR.has(nome)) continue;
        const p = join(dir, nome);
        if (statSync(p).isDirectory()) yield* arquivos(p);
        else yield p;
    }
}

const todos = [...arquivos(raiz)];
const ler = (p) => readFileSync(p, 'utf8');
const rel = (p) => relative(raiz, p).replace(/\\/g, '/');

/* ===== 1) ninguém desenha a própria seta ===== */
{
    // O glifo e o giro moram numa folha só. Um `content: '▾'` novo num
    // `summary::before` é a quarta gramática nascendo.
    const re = /(summary|__head|-head)(::-webkit-details-marker|::before|::after)\s*\{[^}]*content\s*:\s*['"][▸▾▶▼◀◄►⌄⌃]/g;
    const culpados = [];
    for (const p of todos.filter(x => x.endsWith('.css'))) {
        if (rel(p) === 'shared/sanfona.css') continue;
        for (const m of ler(p).matchAll(re)) culpados.push(`${rel(p)}: ${m[0].slice(0, 60)}`);
    }
    assert.deepEqual(culpados, [],
        'seta de bloco retrátil desenhada fora de shared/sanfona.css — use .lr-sanfona ou .lr-seta');
}

/* ===== 2) quem usa, carrega ===== */
{
    // Quais páginas carregam a folha e o módulo.
    const paginas = todos.filter(p => p.endsWith('.html') && !/__check|__previa/.test(p));
    const usaSanfona = (txt) => /\blr-sanfona\b|\blr-seta\b|data-sanfona/.test(txt);

    // Um arquivo .js só "pertence" à página que o carrega; a busca é pelo nome.
    const jsDaPagina = (html, dirPagina) =>
        [...html.matchAll(/(?:src|import\s+')([^'"\s>]+\.js)/g)]
            .map(m => m[1].split('?')[0])
            .map(u => join(dirPagina, u))
            .filter(p => todos.includes(p));

    const faltando = [];
    for (const p of paginas) {
        const html = ler(p);
        const dir = dirname(p);
        const textos = [html, ...jsDaPagina(html, dir).map(ler)];
        if (!textos.some(usaSanfona)) continue;
        if (!/shared\/sanfona\.css/.test(html)) faltando.push(`${rel(p)}: falta sanfona.css`);
        if (/data-sanfona\b/.test(textos.join('\n')) && !/shared\/sanfona\.js/.test(html)) {
            faltando.push(`${rel(p)}: usa data-sanfona mas não importa sanfona.js`);
        }
    }
    assert.deepEqual(faltando, [],
        'página usa a sanfona sem carregar a folha/o módulo — o bloco fica sem seta e sem botão');
}

/* ===== 3) bloco com grupo tem onde pendurar o botão ===== */
{
    /* `ligarSanfona` procura `:scope > [data-sanfona-barra]` ou `:scope >
       summary`. Sem um dos dois ele desiste em silêncio, e o botão que o
       usuário pediu simplesmente não aparece. */
    const semBarra = [];
    for (const p of todos.filter(x => /\.(js|html)$/.test(x) && !/__check/.test(x))) {
        const txt = ler(p);
        for (const m of txt.matchAll(/<(\w+)([^>]*\bdata-sanfona\b(?![-\w])[^>]*)>/g)) {
            const tag = m[1];
            // <details> sempre tem <summary>; os demais precisam declarar a barra.
            if (tag === 'details') continue;
            const depois = txt.slice(m.index, m.index + 600);
            if (!/data-sanfona-barra/.test(depois)) {
                semBarra.push(`${rel(p)}: <${tag} data-sanfona> sem data-sanfona-barra por perto`);
            }
        }
    }
    assert.deepEqual(semBarra, [],
        'bloco data-sanfona sem cabeçalho — o botão "tudo" não teria onde aparecer');
}

/* ===== 4) o módulo exporta o que as telas chamam ===== */
{
    const js = ler(join(raiz, 'shared', 'sanfona.js'));
    assert.match(js, /export function ligarSanfona/);
    assert.match(js, /window\.LRSanfona = \{ ligarSanfona \}/,
        'a ficha de NPC e o inventário são scripts clássicos: sem a ponte, o botão some');

    const css = ler(join(raiz, 'shared', 'sanfona.css'));
    assert.match(css, /\dcqi\b/,
        'o botão se mede pelo BLOCO em unidade de contêiner; um @media do viewport erraria');
    assert.match(css, /\[data-sanfona\] \{ container-type: inline-size; \}/,
        'sem container-type a unidade cqi não resolve e o botão fica no tamanho mínimo');
    assert.ok(!/@container \(/.test(css),
        'nada de faixa de tamanho: o botão escala contínuo, não em degraus');
    assert.match(css, /\.lr-sanf-tudo\[hidden\] \{ display: none; \}/,
        'display de autor vence [hidden] — sem esta linha o botão vira pílula vazia');
    // `(?<![-\w])` para não casar com `border-color`, que pode transicionar.
    assert.ok(!/transition:[^;]*(?<![-\w])color\b/.test(css),
        'color na transição dentro de um contêiner de @container fica preso no valor do outro tema');
}

console.log('✅ sanfona: uma gramática só · páginas carregam a folha · todo grupo tem cabeçalho');
