/* =====================================================================
   📖 WIKI DO PORTAL — o cânone público dentro do menu
   ---------------------------------------------------------------------
   Mostra os livros do Cronista publicados GERAL (pubDoLivro().geral) com
   estante, leitor por capítulo e busca instantânea no texto.

   As rules do Firestore exigem login para ler worldbuilding-books /
   worldbuilding-articles — visitante vê o convite para entrar.

   Escuta os eventos do menu-firebase.js:
     portal:logado    → carrega e renderiza o cânone
     portal:deslogado → mostra o convite de login
   ===================================================================== */
import { pubDoLivro, versaoDoLivro } from '../../shared/livros-pub.js';
import { estiloInline } from '../../shared/livro-estilo.js';

let livros = [];        // [{id, title, description, cover, capitulos:[...]}]
let estantes = [];      // as mesmas do Escritório do Cronista (worldbuilding-settings/estantes)
let indice = [];        // busca: {livroI, capI, titulo, texto}
let livroAberto = null;
let capAberto = 0;
let carregado = false;

const $ = (id) => document.getElementById(id);

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function stripHtml(html) {
    const d = document.createElement('div');
    d.innerHTML = html || '';
    return (d.textContent || '').replace(/\s+/g, ' ').trim();
}

/* ---------- carga (uma vez por sessão logada) ---------- */
async function carregar() {
    if (carregado) { renderEstante(); return; }
    const { collection, getDocs, doc, getDoc } =
        await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    const [bSnap, aSnap, eSnap] = await Promise.all([
        getDocs(collection(window.db, 'worldbuilding-books')),
        getDocs(collection(window.db, 'worldbuilding-articles')),
        /* Estantes: todas num doc só. Mundo sem esse doc cai em "Todos os
           livros", que é a estante virtual do próprio Escritório. */
        getDoc(doc(window.db, 'worldbuilding-settings', 'estantes')).catch(() => null),
    ]);
    estantes = (eSnap && eSnap.exists() ? eSnap.data().lista : null) || [];
    const caps = [];
    aSnap.forEach(d => caps.push({ id: d.id, ...d.data() }));
    caps.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.createdAt ?? 0) - (b.createdAt ?? 0));

    livros = [];
    bSnap.forEach(d => {
        const l = { id: d.id, ...d.data() };
        if (!pubDoLivro(l).geral) return;         // só o cânone público
        l.capitulos = caps.filter(c => c.bookId === l.id && c.status === 'publicado');
        livros.push(l);
    });
    livros.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    indice = [];
    livros.forEach((l, li) => l.capitulos.forEach((c, ci) =>
        indice.push({ livroI: li, capI: ci, titulo: c.title || '', texto: stripHtml(c.contentHTML) })));

    carregado = true;
    // o selo de versão vem de shared/livros-pub.js por import dinâmico; sem
    // esperar, a primeira pintura sairia sem 🔖
    if (window.lvPronto) { try { await window.lvPronto(); } catch { /* segue sem selo */ } }
    renderEstante();
}

/* ---------- estados ---------- */
function mostrarConvite() {
    fecharLivro();
    $('wikiEstante').innerHTML =
        '<div class="wiki-vazio">' +
        '<div class="wiki-vazio-icone">🔐</div>' +
        '<p>Entre na conta para folhear o cânone de Vasteluna.</p>' +
        '<button class="portal-entrar" onclick="portalIrLogin()">Entrar</button></div>';
}

function renderEstante() {
    const el = $('wikiEstante');
    if (!livros.length) {
        el.innerHTML = '<div class="wiki-vazio"><div class="wiki-vazio-icone">📖</div>' +
            '<p>O Cronista ainda não publicou tomos ao mundo.</p></div>';
        return;
    }
    /* O MESMO desenho do Escritório do Cronista (shared/acervo.css), pelo
       renderizador compartilhado. O índice do livro vai junto porque o leitor
       daqui é por posição — `wikiAbrirLivro(i)`, não por id. */
    const itens = livros.map((l, i) => ({ l, n: l.capitulos.length, i }));
    /* `capas`: aqui se LÊ o cânone, e uma parede de capas diz "biblioteca"
       antes de qualquer texto. A ficha em linha continua no Escritório do
       Cronista, onde a descrição importa porque se está editando.
       `abrir`: a estante do leitor nasce aberta — ele veio ver os livros, não
       abrir gavetas. */
    el.innerHTML = window.lvEstantesHTML
        ? window.lvEstantesHTML(itens, estantes, (livro) => {
            const i = livros.indexOf(livro);
            return 'wikiAbrirLivro(' + i + ')';
        }, { capas: true, abrir: true })
        : '';
}

/* ---------- leitor ---------- */
window.wikiAbrirLivro = function (i, capI, marcar) {
    livroAberto = i;
    $('wikiEstante').hidden = true;
    $('wikiLeitor').hidden = false;
    const ver = versaoDoLivro(livros[i]);
    $('leitorLivroNome').textContent = (livros[i].title || '') + (ver ? ' · 🔖 ' + ver : '');
    $('leitorToc').innerHTML = livros[i].capitulos.map((c, ci) =>
        '<button data-cap="' + ci + '" onclick="wikiAbrirCap(' + ci + ')">' + esc(c.title || '') + '</button>').join('');
    window.wikiAbrirCap(capI || 0, marcar);
};

function fecharLivro() {
    livroAberto = null;
    const leitor = $('wikiLeitor');
    if (leitor) { leitor.hidden = true; $('wikiEstante').hidden = false; }
}
window.wikiFecharLivro = fecharLivro;

window.wikiAbrirCap = function (i, marcar) {
    const l = livros[livroAberto];
    capAberto = Math.max(0, Math.min(i, l.capitulos.length - 1));
    const corpo = $('leitorCorpo');
    // O container e um <article> fixo no index.html, entao a aparencia entra
    // por setAttribute — e para isso o helper tem a forma sem o `style="`.
    corpo.setAttribute('style', estiloInline(l));
    corpo.innerHTML = l.capitulos[capAberto].contentHTML || '';
    if (marcar) destacar(corpo, marcar);

    document.querySelectorAll('#leitorToc button').forEach(b =>
        b.classList.toggle('ativo', +b.dataset.cap === capAberto));
    $('leitorAnterior').disabled = capAberto === 0;
    $('leitorProximo').disabled = capAberto === l.capitulos.length - 1;

    // offsetTop seria relativo ao pai posicionado (a folha) — usar o rect
    const topo = $('secaoWiki').getBoundingClientRect().top + window.scrollY - 64;
    window.scrollTo({ top: Math.max(0, topo), behavior: 'auto' });
    if (marcar) corpo.querySelector('mark')?.scrollIntoView({ block: 'center' });
};

window.wikiCapVizinho = (d) => window.wikiAbrirCap(capAberto + d);

/* progresso de leitura */
window.addEventListener('scroll', () => {
    const leitor = $('wikiLeitor');
    if (!leitor || leitor.hidden) return;
    const r = $('leitorCorpo').getBoundingClientRect();
    const v = Math.min(1, Math.max(0, (window.innerHeight - r.top) / (r.height + window.innerHeight)));
    $('leitorProgressoBarra').style.width = (v * 100) + '%';
}, { passive: true });

/* ---------- busca ---------- */
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

let buscaTimer = null;

function ligarBusca() {
    const input = $('wikiBusca');
    if (!input) return;
    input.addEventListener('input', () => {
        clearTimeout(buscaTimer);
        buscaTimer = setTimeout(buscar, 160);
    });
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.querySelector('.wiki-res-item')?.click();
        if (e.key === 'Escape') window.wikiLimparBusca();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === '/' && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) {
            e.preventDefault();
            window.portalIrBusca();
        }
    });
}

window.wikiLimparBusca = function () {
    $('wikiBusca').value = '';
    buscar();
    $('wikiBusca').focus();
};

function buscar() {
    const q = $('wikiBusca').value.trim();
    const painel = $('wikiResultados');
    $('wikiBuscaLimpar').hidden = !q;

    if (q.length < 2 || !carregado) {
        painel.hidden = true;
        $('wikiEstante').hidden = livroAberto !== null;
        $('wikiLeitor').hidden = livroAberto === null;
        return;
    }

    const nq = norm(q);
    const achados = [];
    indice.forEach(e => {
        const nt = norm(e.texto);
        const pos = nt.indexOf(nq);
        const noTitulo = norm(e.titulo).includes(nq);
        if (pos < 0 && !noTitulo) return;
        let ocorr = noTitulo ? 3 : 0, p = pos;
        while (p >= 0 && ocorr < 30) { ocorr++; p = nt.indexOf(nq, p + nq.length); }
        achados.push({ e, ocorr, pos: Math.max(0, pos) });
    });
    achados.sort((a, b) => b.ocorr - a.ocorr);

    painel.hidden = false;
    $('wikiEstante').hidden = true;
    $('wikiLeitor').hidden = true;

    if (!achados.length) {
        painel.innerHTML = '<div class="wiki-vazio"><div class="wiki-vazio-icone">🔎</div>' +
            '<p>Nada no cânone para “' + esc(q) + '”.</p></div>';
        return;
    }

    const reQ = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    painel.innerHTML =
        '<div class="wiki-res-resumo">' + achados.length + ' capítulo(s) mencionam “' + esc(q) + '”</div>' +
        achados.slice(0, 12).map(a => {
            const l = livros[a.e.livroI];
            const ini = Math.max(0, a.pos - 60);
            let trecho = esc(a.e.texto.slice(ini, a.pos + 160));
            trecho = trecho.replace(new RegExp('(' + reQ + ')', 'gi'), '<mark>$1</mark>');
            return '<button class="wiki-res-item" onclick="wikiAbrirLivro(' + a.e.livroI + ',' + a.e.capI +
                ',\'' + q.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;') + '\')">' +
                '<div class="wiki-res-cam">' + esc(l.title || '') +
                (versaoDoLivro(l) ? ' · 🔖 ' + esc(versaoDoLivro(l)) : '') + '</div>' +
                '<div class="wiki-res-titulo">' + esc(a.e.titulo) + '</div>' +
                '<div class="wiki-res-trecho">…' + trecho + '…</div></button>';
        }).join('');
}

function destacar(raiz, termo) {
    const alvo = termo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('(' + alvo + ')', 'gi');
    const reTeste = new RegExp(alvo, 'i'); // sem /g: .test com /g carrega lastIndex
    const tw = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
    const nos = [];
    while (tw.nextNode()) if (reTeste.test(tw.currentNode.nodeValue)) nos.push(tw.currentNode);
    nos.slice(0, 40).forEach(no => {
        const span = document.createElement('span');
        span.innerHTML = esc(no.nodeValue).replace(re, '<mark>$1</mark>');
        no.parentNode.replaceChild(span, no);
    });
}

/* ---------- integração com o estado de auth do menu ---------- */
document.addEventListener('portal:logado', () => {
    carregar().catch(err => {
        console.error('Wiki: erro ao carregar cânone', err);
        $('wikiEstante').innerHTML = '<div class="wiki-vazio"><div class="wiki-vazio-icone">📖</div>' +
            '<p>O cânone não pôde ser carregado. <button class="portal-entrar" onclick="location.reload()">Tentar de novo</button></p></div>';
    });
});
document.addEventListener('portal:deslogado', mostrarConvite);

ligarBusca();
