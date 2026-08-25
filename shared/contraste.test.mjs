// Rodar: node shared/contraste.test.mjs
//
// Mede o contraste texto/fundo de todas as regras CSS do repo, resolvendo a
// cadeia de var() contra a paleta real de shared/tokens.css — nos DOIS temas.
//
// Por que existe: a ficha ficou com campos ilegíveis porque `--ink` apontava
// para branco no tema claro, e porque havia hex claro cravado na mão
// (`background: #eef1f5`) sob esse mesmo texto branco. Procurar por um token
// específico não pega esses casos; medir contraste pega.
//
// Como as regras são escritas no projeto: a regra base vale para o tema claro
// e `html.dark ...` sobrescreve no escuro. Por isso cada regra é medida no
// tema em que ela manda: base → claro, html.dark → escuro.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const IGNORAR = new Set(['.git', 'node_modules', 'graphify-out', 'sistema antigo e lore']);
const MINIMO = 4.5; // WCAG AA para texto normal

// Regras que podem ficar abaixo do mínimo, com o motivo.
//
// O branco-sobre-ouro saiu daqui. Eram cinco entradas (.tab.active de tres
// paginas, .pec-compact-badge, .pagination-btn.active) que aceitavam 1.96:1
// porque o ouro clareia para #D4AF37 no tema escuro e o texto ficava branco.
// Foram consertadas: onde o fundo e token de acento, o texto virou
// `var(--lr-bg-0)`, que vira JUNTO com o acento (papel sobre ouro escuro no tema
// claro, tinta sobre ouro claro no escuro). Onde o texto e branco fixo e o fundo
// vem de outro lugar, o fundo virou literal escuro. As entradas que sobraram
// abaixo sao so as que a medicao estatica nao consegue ver.
const PERMITIDAS = new Set([
    // Branco fixo sobre a pilula de Fragmentos, que e um gradiente roxo igual
    // nos dois temas. A medicao estatica nao le gradiente, entao mede o texto
    // contra as superficies da pagina — onde ele de fato nunca cai.
    'menu/css/menu.css .frag-label',
    'menu/css/menu.css .frag-amount',
    // Cabecalho de modal pintado com gradiente escuro — o branco em cima dele
    // e o certo. A medicao nao le gradiente, entao mede o texto contra as
    // superficies da pagina, onde ele nunca cai.
    // worldbuilding: .modal-header e linear-gradient(--primary, --secondary);
    // o .modal-close e um circulo rgba(255,255,255,.2) EM CIMA desse gradiente.
    'worldbuilding/css/worldbuilding.css .modal-title',
    'worldbuilding/css/worldbuilding.css .modal-close',
    // .modal-danger .modal-header e gradiente(--danger, --lr-blood-2).
    'painel-mestre/css/modais.css .modal-danger .modal-title',
    // Barra da linha do tempo: todo .event-bar.<tipo> tem fundo gradiente
    // (npc, location, combat, quest, moment). Branco e o texto correto.
    'worldbuilding/css/worldbuilding.css .event-bar',
    // Pilula de escala da feira: o fundo vem inline de escalaColors, em
    // wb-core.js — cores saturadas escuras, todas >= 4.8:1 com branco.
    'worldbuilding/css/worldbuilding.css .feira-escala',
    // Badge de grau de aura: o fundo e `grau.cor`, escolhido pelo criador no
    // cadastro (aura.js / core.js). Cor arbitraria vinda de dado — branco e o
    // padrao razoavel, e daqui nao da para saber qual cor vai cair ali.
    'ficha-v1.7_1/css/styles_v2.css .aura-grade-indicator',
    'ficha-v1.7_1/css/styles_v2.css .aura-grau-badge-display',
    // O mesmo badge de grau de aura no painel do criador: fundo e `grau.cor`,
    // escolhido no cadastro (painel-firebase.js).
    'painel-criador/css/painel-criador.css .aura-grau-badge',
    // Nome e raca/classe do personagem: ficam SOBRE O RETRATO, em cima de um
    // veu (.pj-veu) que e um gradiente ate rgba(10,13,18,.92) — escuro nos dois
    // temas de proposito, porque o retrato vem de dado e pode ser claro. Branco
    // literal e a tinta certa ali; a medicao estatica nao le gradiente e mede o
    // texto contra as superficies da pagina, onde ele nunca cai.
    'menu/css/menu.css .character-name',
    // Botao da loja: o fundo vem do modificador, e as duas pernas de cada
    // gradiente sao literais escuros justamente porque o texto aqui e branco
    // fixo. Pior par: 5.87:1, igual nos dois temas.
    'menu/css/menu.css .loja-btn',
    // Pilula da loja: o fundo vem inline do menu-firebase.js, uma cor por tipo de
    // item, todas literais escuros. Pior par com branco: 5.02:1 nos dois temas.
    'menu/css/menu.css .loja-tag',
    // Badge de fonte/tipo de mecanica: a regra compartilhada so pinta o texto; o
    // fundo esta nas regras irmas e no style inline do painel-mechanics.js, que
    // usa var(--fonte-X)/var(--type-X). Todos esses acentos sao literais escuros,
    // nenhum e var() de tema — exatamente porque o texto em cima e branco fixo.
    // Pior par com branco: 4.84:1, igual nos dois temas.
    'painel-criador/css/painel-criador.css .badge-fonte, .badge-tipo',
    // O "x" de remover fica DENTRO de .tags-container .tag, cujo fundo agora e
    // ouro escuro literal (#6E5413). O "x" usa var(--lr-bg-0), 6.91:1.
    'painel-criador/css/painel-criador.css .tags-container .tag button:hover',
]);

/* ---------- cor ---------- */
const NOMEADAS = { white: '#ffffff', black: '#000000', red: '#ff0000' };

function paraRgb(v) {
    v = v.trim().toLowerCase();
    if (NOMEADAS[v]) v = NOMEADAS[v];
    let m = v.match(/^#([0-9a-f]{3})$/);
    if (m) return [...m[1]].map(c => parseInt(c + c, 16));
    m = v.match(/^#([0-9a-f]{6})$/);
    if (m) return [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16));
    m = v.match(/^rgba?\(([^)]+)\)$/);
    if (m) {
        const p = m[1].split(/[,/\s]+/).filter(Boolean).map(parseFloat);
        return p.length > 3 && p[3] < 0.9 ? [...p.slice(0, 3), p[3]] : p.slice(0, 3);
    }
    return null;
}

// Translúcido: compõe sobre o fundo da página, senão não dá pra medir nada.
const sobre = (cor, atras) => cor.length < 4 ? cor
    : cor.slice(0, 3).map((c, i) => Math.round(c * cor[3] + atras[i] * (1 - cor[3])));

const lum = ([r, g, b]) => {
    const f = c => { c /= 255; return c <= .03928 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); };
    return .2126 * f(r) + .7152 * f(g) + .0722 * f(b);
};
const contraste = (a, b) => {
    const [x, y] = [lum(a), lum(b)];
    return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
};

/* ---------- tokens ---------- */
function varsDoBloco(css, seletor) {
    const bloco = css.match(new RegExp(`${seletor}\\s*\\{([^}]*)\\}`));
    const vars = {};
    if (bloco) for (const m of bloco[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+)/g)) vars[m[1]] = m[2].trim();
    return vars;
}

// Páginas declaram vars próprias no :root delas (laboratorium tem --pedra,
// --canvas-chip...). tokens.css entra por último porque é ele que manda.
const tokensCss = readFileSync(join(RAIZ, 'shared/tokens.css'), 'utf8');
const CLARO = {};
const ESCURO = {};

function resolve(valor, vars, profundidade = 0) {
    if (profundidade > 10) return null;
    const m = valor.trim().match(/^var\(\s*(--[\w-]+)\s*(?:,\s*([\s\S]+))?\)$/);
    if (!m) return paraRgb(valor);
    if (vars[m[1]] !== undefined) return resolve(vars[m[1]], vars, profundidade + 1);
    return m[2] ? resolve(m[2], vars, profundidade + 1) : null; // token indefinido → fallback
}

/* ---------- varredura ---------- */
function cssDoRepo(dir = RAIZ, saida = []) {
    for (const nome of readdirSync(dir)) {
        if (IGNORAR.has(nome) || nome.startsWith('.')) continue;
        const p = join(dir, nome);
        if (statSync(p).isDirectory()) cssDoRepo(p, saida);
        else if (nome.endsWith('.css')) saida.push(p);
    }
    return saida;
}

const TODOS = cssDoRepo().map(f => readFileSync(f, 'utf8'));
for (const css of TODOS) Object.assign(CLARO, varsDoBloco(css, ':root'));
Object.assign(CLARO, varsDoBloco(tokensCss, ':root'));   // tokens.css manda

Object.assign(ESCURO, CLARO);
for (const css of TODOS) Object.assign(ESCURO, varsDoBloco(css, 'html\\.dark'));
Object.assign(ESCURO, varsDoBloco(tokensCss, 'html\\.dark'));

const semImportante = v => v.replace(/!important/g, '').trim();
const avisos = [];

// Páginas como o tabuleiro fixam `body { color: ... }` próprio; quem herda
// nelas herda aquilo, não o texto do tema.
function doBody(css, prop) {
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        if (!/(^|,)\s*(html\s*,\s*)?body\s*(,|\{|$)/.test(m[1].trim() + '{')) continue;
        const c = m[2].match(prop);
        if (c) return semImportante(c[1]);
    }
    return null;
}
// Vars declaradas no body do proprio arquivo vencem o :root por heranca —
// e como o tabuleiro prende a paleta escura sem depender do tema.
function varsDoBody(css) {
    const v = {};
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        // Tirar comentário: o seletor vem colado no bloco /* */ acima dele.
        const sel = m[1].replace(/\/\*[\s\S]*?\*\//g, '').trim();
        if (!/^(html\s*,\s*)?body$/.test(sel)) continue;
        for (const d of m[2].matchAll(/(--[\w-]+)\s*:\s*([^;]+)/g)) v[d[1]] = d[2].trim();
    }
    return v;
}
const corHerdada = (css, vars) => doBody(css, /(?<!-)color\s*:\s*([^;]+)/) || vars['--lr-text-1'];
// O tabuleiro tem `body { background: var(--tb-bg) }` escuro. Compor translúcido
// sobre o fundo do tema, e não o da página, o acusava de errado.
const fundoDaPagina = (css, vars) => doBody(css, /background(?:-color)?\s*:\s*([^;]+)/) || vars['--lr-bg-0'];

// O fundo da pagina costuma ser gradiente (`linear-gradient(135deg,
// var(--lr-bg-0), var(--lr-surface))` no login). resolve() devolve null nisso e
// caia-se no branco do fallback — o que acusava o alert translucido do login de
// ilegivel, quando na verdade ele cai num gradiente ESCURO. Basta a primeira
// cor do gradiente: e contra ela que o translucido de cima compoe.
function corDoFundo(valor, vars) {
    if (!valor) return null;
    const direto = resolve(valor, vars);
    if (direto) return direto;
    if (!/gradient\(/.test(valor)) return null;
    for (const m of valor.matchAll(/var\(\s*--[\w-]+\s*(?:,[^()]*)?\)|#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g)) {
        const c = resolve(m[0], vars);
        if (c) return c.length > 3 ? c.slice(0, 3) : c;
    }
    return null;
}

export function ilegiveis(css, rel) {
    const achados = [];
    const locais = varsDoBody(css);
    const CLARO_L = { ...CLARO, ...locais };
    const ESCURO_L = { ...ESCURO, ...locais };
    // Com as vars do body: numa pagina que prende a paleta (login, hexmap,
    // tabuleiro) o fundo e o texto herdado vem da paleta PRESA, nao do tema.
    const herdadaClaro = corHerdada(css, CLARO_L);
    const herdadaEscuro = corHerdada(css, ESCURO_L);
    const fundoClaro = corDoFundo(fundoDaPagina(css, CLARO_L), CLARO_L) || [255, 255, 255];
    const fundoEscuro = corDoFundo(fundoDaPagina(css, ESCURO_L), ESCURO_L) || [10, 13, 18];
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const sel = m[1].replace(/\/\*[\s\S]*?\*\//g, '').trim().replace(/\s+/g, ' ');
        if (!sel || sel.startsWith('@') || sel.startsWith('--')) continue;

        const escura = sel.includes('html.dark');
        const vars = escura ? ESCURO_L : CLARO_L;
        const corpo = m[2];

        const mCorSo = corpo.match(/(?<!-)color\s*:\s*([^;]+)/);
        const mBg = corpo.match(/background(?:-color)?\s*:\s*([^;]+)/);

        // Regra que só pinta o texto: não sei em que superfície ela cai, mas se
        // for ilegível em TODAS as superfícies do tema, cai mal em qualquer uma.
        // É o caso de `color: #fff` cravado, que some no tema claro.
        if (!mBg) {
            if (!mCorSo) continue;
            const cor = resolve(semImportante(mCorSo[1]), vars);
            if (!cor || cor.length > 3) continue;
            // Inclui o fundo da PAGINA: o tabuleiro nunca usa papel, entao
            // medir --tb-muted contra branco acusava defeito que nao existe.
            const superficies = [['--lr-bg-0'], ['--lr-bg-1'], ['--lr-surface']]
                .map(([t]) => resolve(vars[t], vars))
                .concat([escura ? fundoEscuro : fundoClaro]).filter(Boolean);
            // Limite mais frouxo que o MINIMO de propósito: sem saber a
            // superfície real, só acuso o que some em qualquer uma delas —
            // texto claro em tema claro. Acento de meio-tom sobre chip colorido
            // eu não enxergo daqui, e escurecer no chute pioraria.
            const melhor = Math.max(...superficies.map(s => contraste(cor, s)));
            if (melhor < 3 && !PERMITIDAS.has(`${rel} ${sel}`)) {
                achados.push(`${melhor.toFixed(2)}:1  [${escura ? 'escuro' : 'claro '}]  ${rel}  ${sel}`
                    + `\n            texto ${semImportante(mCorSo[1])} → rgb(${cor}) ilegível em qualquer superfície do tema`);
            }
            continue;
        }

        const vBg = semImportante(mBg[1]);
        if (/gradient\(|url\(/.test(vBg)) continue;           // fundo composto — fora do alcance
        let bg = resolve(vBg, vars);
        if (!bg) continue;
        if (bg.length > 3) bg = sobre(bg, escura ? fundoEscuro : fundoClaro);

        const mCor = mCorSo;
        // Sem cor declarada o texto herda o da página — mas metade dessas regras
        // são bolinha, barra e thumb de slider, que não têm texto nenhum. Então
        // isso vira aviso, não falha, e só quando o fundo é neutro (cinza/quase
        // preto/quase branco): fundo colorido nesse grupo é quase sempre enfeite.
        const cor = resolve(mCor ? semImportante(mCor[1]) : (escura ? herdadaEscuro : herdadaClaro), vars);
        if (!cor) continue;

        const c = contraste(cor, bg);
        if (c >= MINIMO || PERMITIDAS.has(`${rel} ${sel}`)) continue;

        const linha = `${c.toFixed(2)}:1  [${escura ? 'escuro' : 'claro '}]  ${rel}  ${sel}`
            + `\n            fundo ${vBg} → rgb(${bg}) | texto ${mCor ? semImportante(mCor[1]) : '(herdado)'} → rgb(${cor})`;

        if (mCor) achados.push(linha);
        else if (Math.max(...bg) - Math.min(...bg) <= 30) avisos.push(`${rel}  ${sel}  (${c.toFixed(2)}:1, ${escura ? 'escuro' : 'claro'})`);
    }
    return achados;
}

/* ---------- style inline em JS e HTML ----------
   Boa parte da interface é montada em innerHTML com style="..." — foi lá que
   os cards da aba Mesa ficaram pretos no tema claro. Cada style vira uma
   "regra" com o número da linha no lugar do seletor. */
function arquivosComInline(dir = RAIZ, saida = []) {
    for (const nome of readdirSync(dir)) {
        if (IGNORAR.has(nome) || nome.startsWith('.')) continue;
        const p = join(dir, nome);
        if (statSync(p).isDirectory()) arquivosComInline(p, saida);
        else if (/\.(js|html)$/.test(nome) && !nome.startsWith('__') && !nome.endsWith('.test.mjs')) saida.push(p);
    }
    return saida;
}

// Regra body do <style> da propria pagina. Sem isso o style inline era medido
// sem saber em que pagina cai: o hexmap tem `body { background: #0a0e27 }` e
// prende a paleta escura ali, mas o `color: #aaa` dos style inline dele era
// comparado com as superficies CLARAS do tema e acusado de ilegivel. Levando o
// body junto, cada style inline e medido contra o fundo e as vars da pagina
// onde ele realmente vive.
function bodyDaPagina(texto) {
    const estilos = [...texto.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(m => m[1]).join('\n');
    let saida = '';
    for (const m of estilos.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const sel = m[1].replace(/\/\*[\s\S]*?\*\//g, '').trim();
        // Tira comentario do corpo: eu escrevo razoes com ":" e nome de token
        // dentro deles, e isso poderia ser lido como declaracao.
        if (/^(html\s*,\s*)?body$/.test(sel)) saida += `body { ${m[2].replace(/\/\*[\s\S]*?\*\//g, '')} }\n`;
    }
    return saida;
}

function inlineComoCss(texto) {
    let css = bodyDaPagina(texto);
    // style="..." | style='...' | style.cssText = '...'
    for (const m of texto.matchAll(/style\s*=\s*(["'`])([^"'`]*?)\1|style\.cssText\s*=\s*(["'`])([^"'`]*?)\3/g)) {
        const decl = m[2] ?? m[4];
        if (!decl || !/color|background/.test(decl)) continue;
        const linha = texto.slice(0, m.index).split('\n').length;
        css += `linha ${linha} { ${decl} }\n`;
    }
    return css;
}

/* ---------- iscas: o detector precisa continuar detectando ---------- */
const isca = css => ilegiveis(css, 'isca.css');
assert.equal(isca('.a { background: var(--lr-divine); color: var(--ink); }').length, 0,
    'no tema claro --ink virou tinta escura — este par voltou a ser legível');
assert.equal(isca('.a { background: #eef1f5; color: #F2F2F2; }').length, 1,
    'não pegou hex claro sob texto claro — foi exatamente o caso do .derived-field');
assert.equal(isca('.a { background: var(--lr-surface); }').length, 0,
    'falso positivo: superfície do tema com o texto herdado do tema');
assert.equal(isca('html.dark .a { background: var(--lr-surface); color: var(--ink); }').length, 0,
    'falso positivo: regra escura tem que ser medida na paleta escura');
assert.equal(isca('html.dark .a { background: #FFFFFF; color: var(--ink); }').length, 1,
    'não pegou fundo branco no tema escuro, onde o texto é branco');
assert.equal(isca('.a { background: #FFFFFF; }').length, 0,
    'sem cor declarada é aviso, não falha — metade dessas regras não tem texto');
assert.equal(isca('.a { background: var(--lr-gold); color: var(--lr-divine); }').length, 0,
    'falso positivo: branco sobre o ouro escuro do tema claro é legível');
assert.equal(isca('.a { background: rgba(0,0,0,.06); color: var(--ink); }').length, 0,
    'falso positivo: fundo translúcido não dá pra julgar sem saber o que está atrás');
assert.equal(isca('.a { background: var(--nao-existe, #ffffff); color: #fff; }').length, 1,
    'token inexistente tem que cair no fallback');
// Pagina que prende a paleta escura no body: o translucido em cima dela compoe
// contra o fundo ESCURO da pagina, mesmo que o fundo seja gradiente. Era assim
// que o alert do login aparecia como ilegivel sem ser.
assert.equal(isca('body { --lr-nature: #3FAE6A; background: linear-gradient(135deg, #0A0D12 0%, #1A2029 100%); }'
    + '.a { background: rgba(63,174,106,.2); color: #6FD79B; }').length, 0,
    'nao leu a primeira cor do gradiente do body — translucido escuro virou branco');
assert.equal(isca('body { background: linear-gradient(135deg, #FDFBF7 0%, #FFFFFF 100%); }'
    + '.a { background: rgba(63,174,106,.2); color: #6FD79B; }').length, 1,
    'gradiente CLARO no body tem que continuar acusando texto claro em cima');

/* ---------- repo ---------- */
const arquivos = cssDoRepo();
assert.ok(arquivos.length > 10, 'não achou os CSS do repo — caminho errado?');

const achados = arquivos.flatMap(f =>
    ilegiveis(readFileSync(f, 'utf8'), relative(RAIZ, f).replace(/\\/g, '/')));

const comInline = arquivosComInline();
achados.push(...comInline.flatMap(f =>
    ilegiveis(inlineComoCss(readFileSync(f, 'utf8')), relative(RAIZ, f).replace(/\\/g, '/'))));

// Bloco <style> dentro de HTML. Era ponto cego: a varredura pegava arquivo .css
// e atributo style="...", mas nao isto — e a pagina de LOGIN inteira vive num
// <style>. Foi por isso que ela ficou com titulo escuro em card escuro sem nada
// acusar. 159 regras entraram na conta ao ligar isto (login, 404 e hexmap).
const comStyle = comInline.filter(f => f.endsWith('.html'));
achados.push(...comStyle.flatMap(f => {
    const txt = readFileSync(f, 'utf8');
    const css = [...txt.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(m => m[1]).join('\n');
    return css.trim() ? ilegiveis(css, relative(RAIZ, f).replace(/\\/g, '/')) : [];
}));

if (avisos.length && process.env.AVISOS) {
    console.log(`\n${avisos.length} regra(s) só com fundo neutro escuro/claro, sem cor declarada —`
        + ` revisar na mão se contiverem texto:\n` + avisos.join('\n') + '\n');
}

// Dívida conhecida: regras que já estavam abaixo do mínimo quando esta medição
// passou a enxergá-las (translúcido composto e style inline em JS). Ficam
// listadas em contraste-divida.txt para o teste seguir servindo de guarda:
// regra NOVA abaixo do mínimo quebra o build; as antigas são fila de trabalho.
// Para queimar a dívida: corrija a regra e apague a linha do arquivo.
const chave = l => l.split('\n')[0].replace(/^[\d.]+:1\s+\[[^\]]+\]\s+/, '').trim();
const arqDivida = join(RAIZ, 'shared/contraste-divida.txt');
let divida = new Set();
try {
    divida = new Set(readFileSync(arqDivida, 'utf8').split('\n')
        .map(l => l.trim()).filter(l => l && !l.startsWith('#')));
} catch { /* sem arquivo: toda regra abaixo do mínimo é falha */ }

const novos = achados.filter(l => !divida.has(chave(l)));
const restam = achados.length;

assert.deepEqual(novos, [],
    `\n${novos.length} regra(s) NOVA(S) abaixo de ${MINIMO}:1 — texto ilegível sobre o próprio fundo:\n\n`
    + novos.join('\n')
    + `\n\nSe for intencional, acrescente a linha em shared/contraste-divida.txt.\n`);

console.log(`ok — ${arquivos.length} CSS + ${comInline.length} arquivos com style inline`
    + ` + ${comStyle.length} HTML com bloco <style> varridos, `
    + `0 regras novas abaixo de ${MINIMO}:1 nos dois temas`
    + (restam ? `\n     dívida pendente: ${restam} regra(s) em shared/contraste-divida.txt` : '')
    + (avisos.length ? ` | ${avisos.length} aviso(s), rode com AVISOS=1` : ''));
