// Rodar: node shared/contraste-tema-claro.test.mjs
//
// shared/tokens.css define no :root `--ink: var(--lr-text-1)` (#F2F2F2) e carrega
// DEPOIS dos CSS de cada página, anulando os aliases de tema claro deles. Então
// qualquer regra que combine `background: var(--lr-divine)` (#F6F7FB) com texto
// `--ink` (declarado ou herdado) some para quem está no tema claro — contraste
// ~1.05:1 — e só reaparece no :focus, que troca o fundo por --lr-surface.
// Como `body` é escuro incondicionalmente, a página parece normal e o bug passa.
//
// Fundo correto nesses casos: var(--paper), escuro nos dois temas.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const IGNORAR = new Set(['.git', 'node_modules', 'graphify-out']);

// Fundos claros de propósito: não contêm texto, então --ink não os afeta.
const PERMITIDOS = new Set([
    'painel-criador/css/painel-criador.css .toggle-slider::before', // bolinha do switch
    'painel-criador/css/painel-criador.css .favicon-preview',       // canvas do favicon
]);

// Cores que somem sobre #F6F7FB. '(herda)' entra porque o texto herdado da
// página é --ink/--lr-text-1 em praticamente todo lugar.
const CLARAS = ['--lr-divine', '--ink', '--lr-text-1', '#fff', 'white'];

function cssDoRepo(dir = RAIZ, saida = []) {
    for (const nome of readdirSync(dir)) {
        if (IGNORAR.has(nome)) continue;
        const p = join(dir, nome);
        if (statSync(p).isDirectory()) cssDoRepo(p, saida);
        else if (nome.endsWith('.css')) saida.push(p);
    }
    return saida;
}

// `var(--paper, var(--lr-divine))` resolve para --paper (definido em tokens.css):
// o fallback é código morto e não conta como fundo claro.
const semFallback = (v) => {
    let antes;
    // `(?:[^()]|\([^()]*\))*` cobre fallback com um var() dentro; o laço cobre o resto.
    do { antes = v; v = v.replace(/var\(\s*(--[\w-]+)\s*,(?:[^()]|\([^()]*\))*\)/g, 'var($1)'); } while (v !== antes);
    return v;
};

function regrasQuebradas(css, rel) {
    const achados = [];
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const sel = m[1].replace(/\/\*[\s\S]*?\*\//g, '').trim().replace(/\s+/g, ' ');
        const corpo = m[2];
        if (sel.includes('html.dark')) continue; // o tema escuro tem override próprio

        const bg = corpo.match(/background(?:-color)?\s*:\s*([^;]+)/);
        if (!bg || !semFallback(bg[1]).includes('--lr-divine')) continue;
        if (PERMITIDOS.has(`${rel} ${sel}`)) continue;

        // `(?<!-)color` para não casar com border-color / outline-color.
        const cor = corpo.match(/(?<!-)color\s*:\s*([^;]+)/);
        const texto = cor ? semFallback(cor[1]).trim() : '(herda)';
        if (texto === '(herda)' || CLARAS.some(v => texto.includes(v))) {
            achados.push(`${rel}  ${sel}  { background: --lr-divine; color: ${texto} }`);
        }
    }
    return achados;
}

// --- o detector precisa continuar detectando (senão o teste passa por engano) ---
const isca = (css) => regrasQuebradas(css, 'isca.css');
assert.equal(isca('.a { background: var(--lr-divine); color: var(--ink); }').length, 1,
    'deixou passar o par --lr-divine + --ink');
assert.equal(isca('.a { background: var(--lr-divine); }').length, 1,
    'deixou passar fundo claro com texto herdado');
assert.equal(isca('.a { background: var(--paper); color: var(--ink); }').length, 0,
    'falso positivo: --paper é escuro nos dois temas');
assert.equal(isca('.a { background: var(--lr-divine); color: var(--lr-bg-0); }').length, 0,
    'falso positivo: chip claro com texto escuro é intencional');
assert.equal(isca('html.dark .a { background: var(--lr-divine); color: var(--ink); }').length, 0,
    'falso positivo: regra de tema escuro não vale para o tema claro');
assert.equal(isca('.a { background: var(--lr-divine); border-color: var(--ink); }').length, 1,
    'border-color não é cor de texto — deveria cair no caso "(herda)"');
assert.equal(isca('.a { background: var(--paper, var(--lr-divine)); color: var(--ink, #000); }').length, 0,
    'falso positivo: --lr-divine só como fallback de um token definido');

// --- o repo inteiro ---
const arquivos = cssDoRepo();
assert.ok(arquivos.length > 10, 'não achou os CSS do repo — caminho errado?');

const quebradas = arquivos.flatMap(f =>
    regrasQuebradas(readFileSync(f, 'utf8'), relative(RAIZ, f).replace(/\\/g, '/')));

assert.deepEqual(quebradas, [],
    `\n${quebradas.length} regra(s) com texto quase-branco sobre fundo quase-branco no tema claro.\n`
    + `Troque o fundo por var(--paper), ou adicione a PERMITIDOS se o elemento não tiver texto:\n\n`
    + quebradas.join('\n') + '\n');

console.log(`ok — ${arquivos.length} CSS varridos, 0 regras com texto invisível no tema claro`);
