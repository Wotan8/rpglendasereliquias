/* ═══════════════════════════════════════════════════════════
   wb-rich.js — a mesa de diagramação do Escritório do Cronista
   ───────────────────────────────────────────────────────────
   Tudo que o escritor usa para dar forma ao texto: títulos,
   ênfases, cor, alinhamento, listas, citação, filete, link,
   capitular, duas colunas e IMAGENS com tamanho e posição —
   estas pelo campo padrão (shared/campo-imagem.js), que aceita
   tanto uma URL colada quanto um arquivo do aparelho.

   O que sai daqui é sempre o vocabulário de shared/texto-mundo.css
   (classes `tm-*` + estilo inline curto). Por isso o capítulo
   aparece igual no Worldbuilding, na ficha do jogador e no
   Laboratorium — as três telas leem a MESMA folha.

   Não conhece livros nem Firestore: recebe o contenteditable e
   devolve eventos. Quem salva é o wb-editor.
   ═══════════════════════════════════════════════════════════ */

import { limparHTML } from './wb-rich-sanitize.js';
import * as Tab from './wb-tabela.js';
import { perguntar } from '../../shared/dialogo.js?v=2';

/* Blocos que o autor escolhe no seletor de estilo. */
const BLOCOS = [
    ['p', '¶ Parágrafo'],
    ['h1', 'H1 — Título'],
    ['h2', 'H2 — Seção'],
    ['h3', 'H3 — Subseção'],
    ['h4', 'H4 — Rótulo'],
    ['blockquote', '❝ Citação'],
    ['pre', '⌨ Bloco fixo'],
];

/* Alinhamento: UM controle, não quatro botões.
   São quatro estados excludentes de UMA decisão — quatro botões gastam quatro
   lugares na barra para dizer o que um controle diz melhor, porque um
   controle ainda mostra QUAL está valendo, coisa que quatro botões soltos não
   fazem. O glifo do botão vira o do alinhamento atual. */
const ALINHAR = [
    ['justifyLeft', '⬅', 'À esquerda'],
    ['justifyCenter', '↔', 'Centralizado'],
    ['justifyRight', '➡', 'À direita'],
    ['justifyFull', '☰', 'Justificado'],
];

/** A barra de ferramentas. O wb-editor injeta isto na toolbar do editor. */
export const TOOLBAR_HTML = `
<select class="wb-rich-sel" data-rich="bloco" title="Estilo do parágrafo">
    ${BLOCOS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
</select>
<span class="wb-rich-sep"></span>
<button class="btn btn-secondary btn-sm" data-rich="cmd" data-cmd="bold" title="Negrito (Ctrl+B)"><b>N</b></button>
<button class="btn btn-secondary btn-sm" data-rich="cmd" data-cmd="italic" title="Itálico (Ctrl+I)"><i>I</i></button>
<button class="btn btn-secondary btn-sm" data-rich="cmd" data-cmd="underline" title="Sublinhado (Ctrl+U)"><u>S</u></button>
<button class="btn btn-secondary btn-sm" data-rich="cmd" data-cmd="strikeThrough" title="Riscado"><s>R</s></button>
<label class="wb-rich-cor" title="Cor do texto">🎨<input type="color" data-rich="cor" value="#D4AF37"></label>
<button class="btn btn-secondary btn-sm" data-rich="marca" title="Marca-texto">🖍️</button>
<span class="wb-rich-sep"></span>
<span class="wb-rich-menu" data-alinhar>
    <button type="button" class="btn btn-secondary btn-sm wb-rich-menu__abre" data-rich="alinhar"
            title="Alinhamento do parágrafo"><span data-alinharGlifo>⬅</span> ▾</button>
    <span class="wb-rich-menu__lista" hidden>
        ${ALINHAR.map(([cmd, g, l]) =>
            `<button type="button" data-alin="${cmd}"><span>${g}</span> ${l}</button>`).join('')}
    </span>
</span>
<span class="wb-rich-sep"></span>
<button class="btn btn-secondary btn-sm" data-rich="cmd" data-cmd="insertUnorderedList" title="Lista">•—</button>
<button class="btn btn-secondary btn-sm" data-rich="cmd" data-cmd="insertOrderedList" title="Lista numerada">1.</button>
<button class="btn btn-secondary btn-sm" data-rich="cmd" data-cmd="insertHorizontalRule" title="Filete separador">—</button>
<span class="wb-rich-sep"></span>
<button class="btn btn-secondary btn-sm" data-rich="classe" data-classe="tm-capitular" title="Capitular — primeira letra grande">✒️</button>
<select class="wb-rich-sel" data-rich="cols" title="Dividir em colunas — envolve os blocos selecionados">
    <option value="">▥ Colunas…</option>
    <option value="">Uma coluna (desfaz)</option>
    <option value="tm-cols--2">Duas, texto corrido</option>
    <option value="tm-cols--3">Três, texto corrido</option>
    <option value="tm-cols--margem">Nota à esquerda + texto</option>
    <option value="tm-cols--margem-dir">Texto + nota à direita</option>
    <option value="tm-cols--desloc">Texto deslocado (arte à esquerda)</option>
    <option value="tm-cols--grade3">Três células lado a lado</option>
</select>
<select class="wb-rich-sel" data-rich="bloco2" title="Blocos de livro de regras">
    <option value="">▤ Bloco…</option>
    <option value="tm-nota">Nota de margem</option>
    <option value="tm-leitura">Ler em voz alta</option>
    <option value="tm-aviso">⚠️ Aviso</option>
    <option value="tm-aviso tm-aviso--nota">📖 Nota do mestre</option>
    <option value="tm-aviso tm-aviso--segredo">🔒 Segredo</option>
    <option value="ins:ponto">📍 Ponto de interesse</option>
    <option value="wrap:tm-carta">✉️ Carta / handout</option>
    <option value="wrap:tm-carta tm-carta--maquina">✉️ Carta datilografada</option>
    <option value="wrap:tm-carta tm-carta--mao">✉️ Carta manuscrita</option>
</select>
<button class="btn btn-secondary btn-sm" data-rich="link" title="Inserir link">🔗</button>
<button class="btn btn-secondary btn-sm" data-rich="imagem" title="Inserir imagem">🖼️</button>
<button class="btn btn-secondary btn-sm" data-rich="tabela" title="Inserir tabela">▦</button>
<button class="btn btn-secondary btn-sm" data-rich="campo" title="Campo vinculado — o valor vem do cadastro e se atualiza sozinho">🔗↻</button>
<button class="btn btn-secondary btn-sm" data-rich="tirabloco" title="Tirar o bloco daqui — descasca uma camada por clique">⊘ bloco</button>
<button class="btn btn-secondary btn-sm" data-rich="cmd" data-cmd="removeFormat" title="Limpar formatação">🧹</button>
`;

/* Barra flutuante que aparece ao clicar numa imagem. */
const BARRA_IMG_HTML = `
<div class="wb-imgbar__grupo">
    <span>Tamanho</span>
    <button data-larg="30">P</button>
    <button data-larg="55">M</button>
    <button data-larg="80">G</button>
    <button data-larg="100">Cheia</button>
    <input type="range" data-largslider min="10" max="100" step="1" title="Largura livre, em % da mancha">
    <output data-largout>—</output>
</div>
<div class="wb-imgbar__grupo">
    <span>Camada</span>
    <button data-camada="" title="Junto do texto — a imagem ocupa lugar na página">≡</button>
    <button data-camada="tm-fig--frente" title="À frente do texto — solta, por cima; arraste para posicionar">▲</button>
    <button data-camada="tm-fig--fundo" title="Ao fundo — solta, por trás do texto; arraste para posicionar">▽</button>
</div>
<div class="wb-imgbar__grupo" data-grupo="pos">
    <span>Posição</span>
    <button data-pos="" title="Centralizada">▣</button>
    <button data-pos="tm-fig--esq" title="À esquerda">◧</button>
    <button data-pos="tm-fig--dir" title="À direita">◨</button>
    <button data-pos="tm-fig--flut-esq" title="Texto contorna pela direita">⬕</button>
    <button data-pos="tm-fig--flut-dir" title="Texto contorna pela esquerda">⬔</button>
</div>
<div class="wb-imgbar__grupo">
    <button data-acao="trocar" title="Trocar a imagem">🔄</button>
    <button data-acao="remover" title="Remover" class="is-danger">🗑️</button>
</div>
`;

/* Legado: os livros de hoje tem a largura numa CLASSE no <img>. Continuam
   valendo (texto-mundo.css desenha as quatro), e a primeira mexida no
   tamanho troca por `--tm-fig-larg`, que aceita qualquer valor. */
/* Barra flutuante da tabela — aparece com o cursor dentro de uma célula. */
const BARRA_TAB_HTML = `
<div class="wb-imgbar__grupo">
    <span>Linha</span>
    <button data-tab="linha-acima" title="Linha acima">⤒</button>
    <button data-tab="linha-abaixo" title="Linha abaixo">⤓</button>
    <button data-tab="linha-fora" title="Remover a linha" class="is-danger">⊖</button>
</div>
<div class="wb-imgbar__grupo">
    <span>Coluna</span>
    <button data-tab="col-esq" title="Coluna à esquerda">⇤</button>
    <button data-tab="col-dir" title="Coluna à direita">⇥</button>
    <button data-tab="col-fora" title="Remover a coluna" class="is-danger">⊖</button>
    <input type="range" data-collarg min="0" max="80" step="1" title="Largura da coluna, em % da tabela (0 = automática)">
    <output data-colout>auto</output>
</div>
<div class="wb-imgbar__grupo">
    <span>Mesclar</span>
    <button data-tab="mescla-dir" title="Juntar com a célula à direita">⇥|</button>
    <button data-tab="mescla-baixo" title="Juntar com a célula abaixo">⤓|</button>
    <button data-tab="divide" title="Separar de volta">⊞</button>
</div>
<div class="wb-imgbar__grupo">
    <span>Fundo</span>
    <input type="color" data-tabcor value="#8a6a2f" title="Cor de fundo">
    <button data-escopo="cel" class="is-on" title="Pintar só a célula">▫</button>
    <button data-escopo="linha" title="Pintar a linha">▤</button>
    <button data-escopo="coluna" title="Pintar a coluna">▥</button>
    <button data-tab="sem-cor" title="Tirar a cor">⌫</button>
</div>
<div class="wb-imgbar__grupo">
    <span>Estilo</span>
    <button data-estilo="tm-tab--zebra" title="Linhas alternadas">≣</button>
    <button data-estilo="tm-tab--sem-borda" title="Sem grade">⬚</button>
    <button data-estilo="tm-tab--compacta" title="Compacta">⇕</button>
    <button data-estilo="tm-tab--chave" title="Primeira coluna em destaque">◫</button>
</div>
`;
const ESTILOS_TAB = ['tm-tab--zebra', 'tm-tab--sem-borda', 'tm-tab--compacta', 'tm-tab--chave'];

const TAMANHOS = ['tm-img--p', 'tm-img--m', 'tm-img--g', 'tm-img--full'];
const LARG_DA_CLASSE = { 'tm-img--p': 30, 'tm-img--m': 55, 'tm-img--g': 80, 'tm-img--full': 100 };
const POSICOES = ['tm-fig--esq', 'tm-fig--dir', 'tm-fig--flut-esq', 'tm-fig--flut-dir'];
const CAMADAS = ['tm-fig--frente', 'tm-fig--fundo'];

/** A largura da figura em %, venha ela do estilo novo ou da classe velha. */
export function largDaFigura(fig) {
    const v = parseFloat(String(fig?.style?.getPropertyValue('--tm-fig-larg') || '').replace('%', ''));
    if (Number.isFinite(v)) return v;
    const img = fig?.querySelector?.('img');
    for (const c of TAMANHOS) if (img?.classList.contains(c)) return LARG_DA_CLASSE[c];
    return fig?.classList.contains('tm-fig--flut-esq') || fig?.classList.contains('tm-fig--flut-dir') ? 42 : 55;
}

/** Grava a largura e aposenta a classe legada — duas fontes para a mesma
 *  medida e como um bug espera para acontecer. */
export function definirLarg(fig, pct) {
    const v = Math.min(100, Math.max(5, Math.round(pct)));
    fig.style.setProperty('--tm-fig-larg', v + '%');
    fig.querySelector('img')?.classList.remove(...TAMANHOS);
    return v;
}

/**
 * Liga a barra a um contenteditable.
 * @param ed        o elemento contenteditable
 * @param toolbar   onde os botões foram injetados
 * @param onChange  chamado a cada alteração (o wb-editor usa para o autosave)
 * @returns { limpar } → HTML pronto para gravar
 */
/* `pedirCampo` chega de fora: quem sabe listar as entidades cadastradas e o
   Escritorio (wb-utils/ecossistema), e a mesa de diagramacao nao precisa
   conhecer o ecossistema para saber inserir um <span>. Sem ela, o botao do
   campo vinculado simplesmente nao faz nada. */
/* A mesa que está ligada AGORA. Ouvinte no `document` tem de ser registrado
   uma vez por MÓDULO, não uma vez por bindRich: o editor rebinda a cada
   capítulo aberto, e um ouvinte por abertura vira uma pilha que só cresce.
   Com `selectionchange` — que dispara a cada movimento do cursor — a pilha
   deixou a suíte de teste rastejando antes de eu perceber o que era. */
let _vivo = null;
document.addEventListener('selectionchange', () => {
    if (!_vivo) return;
    if (_vivo.ed.contains(document.getSelection()?.anchorNode)) _vivo.pintarEstado();
});
document.addEventListener('click', (e) => {
    if (_vivo && !_vivo.menuAlin.contains(e.target)) _vivo.listaAlin.hidden = true;
});

export function bindRich(ed, toolbar, onChange, opts = {}) {
    // Sem isto o Chrome ainda escreve <font color> em vez de style="color:…",
    // e a faxina (que só aceita style) jogaria a cor do autor fora.
    try { document.execCommand('styleWithCSS', false, true); } catch { /* Safari antigo */ }

    const avisar = () => { if (typeof onChange === 'function') onChange(); };
    let figuraAtual = null;   // figura que a barra flutuante está editando

    /* ── Barra flutuante das imagens ─────────────────────── */
    const barra = document.createElement('div');
    barra.className = 'wb-imgbar';
    barra.hidden = true;
    barra.innerHTML = BARRA_IMG_HTML;
    (ed.offsetParent || ed.parentElement).appendChild(barra);

    function mostrarBarra(fig) {
        figuraAtual = fig;
        const img = fig.querySelector('img');
        const host = barra.offsetParent || ed.parentElement;
        const r = fig.getBoundingClientRect();
        const h = host.getBoundingClientRect();
        barra.style.left = `${Math.max(0, r.left - h.left)}px`;
        barra.style.top = `${r.top - h.top - 44}px`;
        barra.hidden = false;
        const larg = largDaFigura(fig);
        barra.querySelectorAll('[data-larg]').forEach(b =>
            b.classList.toggle('is-on', Number(b.dataset.larg) === larg));
        barra.querySelector('[data-largslider]').value = larg;
        barra.querySelector('[data-largout]').textContent = larg + '%';
        barra.querySelectorAll('[data-pos]').forEach(b =>
            b.classList.toggle('is-on', b.dataset.pos
                ? fig.classList.contains(b.dataset.pos)
                : !POSICOES.some(p => fig.classList.contains(p))));
        barra.querySelectorAll('[data-camada]').forEach(b =>
            b.classList.toggle('is-on', b.dataset.camada
                ? fig.classList.contains(b.dataset.camada)
                : !CAMADAS.some(c => fig.classList.contains(c))));
        // "Onde na linha" não faz sentido para figura solta: ela não está
        // numa linha. Some em vez de virar botão que não faz nada.
        barra.querySelector('[data-grupo="pos"]').hidden = CAMADAS.some(c => fig.classList.contains(c));
        posicionarAlca(fig);
    }
    const esconderBarra = () => { barra.hidden = true; alca.hidden = true; figuraAtual = null; };

    /* ── Alça de redimensionar ──────────────────────────────
       Um quadradinho no canto da figura. A conta é em % da MANCHA (a largura
       do texto), não em pixels: é assim que a mesma imagem tem o mesmo peso
       no monitor e no celular. */
    const alca = document.createElement('div');
    alca.className = 'wb-imgalca';
    alca.hidden = true;
    alca.title = 'Arraste para redimensionar';
    (ed.offsetParent || ed.parentElement).appendChild(alca);

    function posicionarAlca(fig) {
        const host = alca.offsetParent || ed.parentElement;
        const r = fig.getBoundingClientRect(), h = host.getBoundingClientRect();
        alca.style.left = `${r.right - h.left - 7}px`;
        alca.style.top = `${r.bottom - h.top - 7}px`;
        alca.hidden = false;
    }

    alca.addEventListener('pointerdown', (e) => {
        if (!figuraAtual) return;
        e.preventDefault();
        alca.setPointerCapture(e.pointerId);
        const fig = figuraAtual;
        const mancha = ed.clientWidth || 1;
        const x0 = e.clientX, larg0 = largDaFigura(fig);
        const mover = (ev) => {
            const pct = definirLarg(fig, larg0 + ((ev.clientX - x0) / mancha) * 100);
            barra.querySelector('[data-largslider]').value = pct;
            barra.querySelector('[data-largout]').textContent = pct + '%';
            posicionarAlca(fig); mostrarBarra(fig);
        };
        const soltar = () => {
            alca.removeEventListener('pointermove', mover);
            alca.removeEventListener('pointerup', soltar);
            avisar();
        };
        alca.addEventListener('pointermove', mover);
        alca.addEventListener('pointerup', soltar);
    });

    /* ── Arrastar a figura solta ────────────────────────────
       Só vale para frente/fundo: no fluxo, a posição é do texto, não do
       mouse. A coordenada é gravada em %, pelo mesmo motivo da largura. */
    ed.addEventListener('pointerdown', (e) => {
        const fig = e.target.closest('.tm-fig--frente, .tm-fig--fundo');
        if (!fig || !ed.contains(fig)) return;
        e.preventDefault();
        mostrarBarra(fig);
        const caixa = ed.getBoundingClientRect();
        const r = fig.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - r.top;
        ed.setPointerCapture(e.pointerId);
        const mover = (ev) => {
            const x = ((ev.clientX - dx - caixa.left) / caixa.width) * 100;
            const y = ((ev.clientY - dy - caixa.top) / caixa.height) * 100;
            fig.style.setProperty('--tm-fig-x', Math.min(100, Math.max(0, x)).toFixed(1) + '%');
            fig.style.setProperty('--tm-fig-y', Math.max(0, y).toFixed(1) + '%');
            posicionarAlca(fig);
        };
        const soltar = () => {
            ed.removeEventListener('pointermove', mover);
            ed.removeEventListener('pointerup', soltar);
            mostrarBarra(fig); avisar();
        };
        ed.addEventListener('pointermove', mover);
        ed.addEventListener('pointerup', soltar);
    });

    barra.addEventListener('mousedown', (e) => {
        const b = e.target.closest('button');
        if (!b || !figuraAtual) return;
        e.preventDefault();
        const fig = figuraAtual;

        if (b.dataset.larg) {
            definirLarg(fig, Number(b.dataset.larg));
        } else if (b.dataset.camada !== undefined) {
            fig.classList.remove(...CAMADAS);
            if (b.dataset.camada) {
                fig.classList.remove(...POSICOES);   // solta não tem "onde na linha"
                fig.classList.add(b.dataset.camada);
                // Nasce onde já está, não no canto: a imagem que some da tela
                // ao virar "à frente" parece que o botão a apagou.
                if (!fig.style.getPropertyValue('--tm-fig-x')) {
                    const r = fig.getBoundingClientRect(), c = ed.getBoundingClientRect();
                    fig.style.setProperty('--tm-fig-x', Math.min(100, Math.max(0, ((r.left + r.width / 2 - c.left) / c.width) * 100)).toFixed(1) + '%');
                    fig.style.setProperty('--tm-fig-y', Math.max(0, ((r.top - c.top) / c.height) * 100).toFixed(1) + '%');
                }
            }
        } else if (b.dataset.pos !== undefined) {
            fig.classList.remove(...POSICOES);
            if (b.dataset.pos) fig.classList.add(b.dataset.pos);
        } else if (b.dataset.acao === 'remover') {
            fig.remove(); esconderBarra(); avisar(); return;
        } else if (b.dataset.acao === 'trocar') {
            pedirImagem(true); return;
        }
        mostrarBarra(fig);
        avisar();
    });

    /* ── Inserção de imagem ──────────────────────────────── */
    function novaFigura(url, alt) {
        const fig = document.createElement('figure');
        fig.className = 'tm-fig';
        fig.innerHTML =
            `<img src="${url}" alt="${(alt || '').replace(/"/g, '&quot;')}" class="tm-img tm-img--m">` +
            `<figcaption></figcaption>`;
        return fig;
    }

    function inserirFigura(url, alt) {
        const fig = novaFigura(url, alt);
        const sel = window.getSelection();
        const dentro = sel.rangeCount && ed.contains(sel.anchorNode);
        if (dentro) {
            const r = sel.getRangeAt(0);
            r.collapse(false);
            r.insertNode(fig);
        } else {
            ed.appendChild(fig);
        }
        // Um parágrafo depois da figura, senão o cursor fica preso no fim.
        const depois = document.createElement('p');
        depois.innerHTML = '<br>';
        fig.after(depois);
        const r2 = document.createRange();
        r2.setStart(depois, 0); r2.collapse(true);
        sel.removeAllRanges(); sel.addRange(r2);
        avisar();
    }

    /** Pergunta a imagem no campo padrão (URL colada ou arquivo do aparelho) e
     *  ou insere uma figura nova, ou troca a da barra flutuante. */
    async function pedirImagem(paraTrocar) {
        const url = await CampoImagem.escolher({
            titulo: paraTrocar ? '🖼️ Trocar imagem' : '🖼️ Inserir imagem',
            pasta: 'worldbuilding-images',
        });
        if (!url) return;
        if (paraTrocar && figuraAtual) {
            const img = figuraAtual.querySelector('img');
            if (img) img.src = url;
            avisar();
        } else {
            inserirFigura(url, '');
        }
    }

    /* ── Barra flutuante da tabela ───────────────────────
       Mesma gramática da barra de imagem: aparece colada no que está sendo
       editado, e some quando o cursor sai. */
    const barraTab = document.createElement('div');
    barraTab.className = 'wb-imgbar wb-tabbar';
    barraTab.hidden = true;
    barraTab.innerHTML = BARRA_TAB_HTML;
    (ed.offsetParent || ed.parentElement).appendChild(barraTab);
    let celAtual = null;
    let escopoCor = 'cel';

    function mostrarBarraTab(cel) {
        celAtual = cel;
        const tabela = Tab.tabelaDe(cel);
        const host = barraTab.offsetParent || ed.parentElement;
        const r = (tabela.closest('.tm-tabela-rola') || tabela).getBoundingClientRect();
        const h = host.getBoundingClientRect();
        barraTab.style.left = `${Math.max(0, r.left - h.left)}px`;
        barraTab.hidden = false;
        /* A altura é medida DEPOIS de aparecer: esta barra envolve em duas
           ou três linhas conforme a largura da tela, e um deslocamento fixo
           de 44px a fazia sentar em cima do cabeçalho da tabela. Não cabe
           acima? Vai para baixo, que é melhor do que tapar o que se edita. */
        const alt = barraTab.offsetHeight + 6;
        const acima = r.top - h.top - alt;
        barraTab.style.top = `${acima >= 0 ? acima : r.bottom - h.top + 6}px`;
        const larg = Tab.larguraDe(cel);
        barraTab.querySelector('[data-collarg]').value = larg;
        barraTab.querySelector('[data-colout]').textContent = larg ? larg + '%' : 'auto';
        barraTab.querySelectorAll('[data-estilo]').forEach(b =>
            b.classList.toggle('is-on', tabela.classList.contains(b.dataset.estilo)));
        barraTab.querySelectorAll('[data-escopo]').forEach(b =>
            b.classList.toggle('is-on', b.dataset.escopo === escopoCor));
        // Dividir só faz sentido em célula mesclada.
        barraTab.querySelector('[data-tab="divide"]').disabled =
            (cel.colSpan || 1) === 1 && (cel.rowSpan || 1) === 1;
    }
    const esconderBarraTab = () => { barraTab.hidden = true; celAtual = null; };

    barraTab.addEventListener('mousedown', (e) => {
        const b = e.target.closest('button');
        if (!b || !celAtual || b.disabled) return;
        e.preventDefault();
        const cel = celAtual;
        const acoes = {
            'linha-acima': () => Tab.inserirLinha(cel, 'acima'),
            'linha-abaixo': () => Tab.inserirLinha(cel, 'abaixo'),
            'col-esq': () => Tab.inserirColuna(cel, 'esq'),
            'col-dir': () => Tab.inserirColuna(cel, 'dir'),
            'mescla-dir': () => Tab.mesclar(cel, 'dir'),
            'mescla-baixo': () => Tab.mesclar(cel, 'baixo'),
            'divide': () => Tab.dividir(cel),
            'sem-cor': () => Tab.pintar(cel, '', escopoCor),
        };
        if (b.dataset.escopo) {
            escopoCor = b.dataset.escopo;
        } else if (b.dataset.estilo) {
            Tab.tabelaDe(cel).classList.toggle(b.dataset.estilo);
        } else if (b.dataset.tab === 'linha-fora' || b.dataset.tab === 'col-fora') {
            const tabela = Tab.tabelaDe(cel);
            const foi = b.dataset.tab === 'linha-fora' ? Tab.removerLinha(cel) : Tab.removerColuna(cel);
            // A célula que a barra editava pode ter sido a removida.
            if (foi) { esconderBarraTab(); avisar(); }
            else mostrarBarraTab(tabela.querySelector('td, th') || cel);
            return;
        } else if (acoes[b.dataset.tab]) {
            acoes[b.dataset.tab]();
        }
        mostrarBarraTab(cel.isConnected ? cel : Tab.tabelaDe(cel)?.querySelector('td, th'));
        avisar();
    });

    barraTab.querySelector('[data-tabcor]').addEventListener('input', (e) => {
        if (!celAtual) return;
        Tab.pintar(celAtual, e.target.value, escopoCor);
        avisar();
    });
    barraTab.querySelector('[data-collarg]').addEventListener('input', (e) => {
        if (!celAtual) return;
        const v = Number(e.target.value);
        Tab.larguraColuna(celAtual, v);
        barraTab.querySelector('[data-colout]').textContent = v ? v + '%' : 'auto';
        avisar();
    });

    /* O cursor entrou numa célula? A barra segue o cursor, não o clique —
       navegar com Tab entre células também precisa trazer a barra junto. */
    const seguirCursor = () => {
        const sel = window.getSelection();
        let no = sel.rangeCount ? sel.anchorNode : null;
        if (no && no.nodeType === Node.TEXT_NODE) no = no.parentElement;
        const cel = no?.closest?.('td, th');
        if (cel && ed.contains(cel)) mostrarBarraTab(cel);
        else if (!barraTab.contains(document.activeElement)) esconderBarraTab();
    };
    ed.addEventListener('keyup', seguirCursor);
    ed.addEventListener('click', seguirCursor);

    /* ── Campo vinculado ─────────────────────────────────
       Insere o <span> e um espaco depois: sem o espaco, o cursor fica preso
       dentro de um no contenteditable=false e nao da para continuar a frase. */
    async function inserirCampo() {
        if (typeof opts.pedirCampo !== 'function') return;
        const escolha = await opts.pedirCampo();
        if (!escolha) return;
        const span = document.createElement('span');
        span.className = 'tm-campo';
        span.dataset.cat = escolha.cat;
        span.dataset.entity = escolha.id;
        span.dataset.campo = escolha.campo;
        span.contentEditable = 'false';
        span.textContent = escolha.valor || '—';
        const sel = window.getSelection();
        if (sel.rangeCount && ed.contains(sel.anchorNode)) {
            const r = sel.getRangeAt(0);
            r.deleteContents(); r.insertNode(span);
        } else {
            ed.appendChild(span);
        }
        const espaco = document.createTextNode(' ');
        span.after(espaco);
        const r2 = document.createRange();
        r2.setStartAfter(espaco); r2.collapse(true);
        sel.removeAllRanges(); sel.addRange(r2);
        avisar();
    }

    /* ── Botões da barra ─────────────────────────────────── */
    toolbar.addEventListener('click', async (e) => {
        const alvo = e.target.closest('[data-rich]');
        /* Controle de formulário se vira sozinho: <select> e <input> têm
           `change`/`input` próprios. Cair aqui é um BUG, não um caso extra —
           `preventDefault()` + `ed.focus()` roubam o foco no meio do clique, e
           um dropdown que perde o foco fecha antes de o autor escolher. Era
           por isso que o menu de Bloco e Colunas abria e fechava, e só dava
           para usar clicando e segurando.

           A guarda antiga era `dataset.rich === 'cor'` — o mesmo problema, já
           encontrado uma vez no seletor de cor e remendado só ali. Agora vale
           para todo controle, inclusive os que ainda não existem. */
        if (!alvo || alvo.matches('select, input, textarea')) return;
        e.preventDefault();
        ed.focus();

        switch (alvo.dataset.rich) {
            case 'cmd':
                document.execCommand(alvo.dataset.cmd, false, null);
                break;
            case 'marca':
                document.execCommand('hiliteColor', false, 'rgba(212,175,55,.22)');
                break;
            case 'classe':
                alternarClasse(alvo.dataset.classe);
                break;
            case 'link': {
                const url = await perguntar('Endereço do link:', { valor: 'https://' });
                if (url) document.execCommand('createLink', false, url);
                break;
            }
            case 'imagem': pedirImagem(false); break;
            case 'tabela': await inserirTabela(); break;
            case 'campo': await inserirCampo(); break;
            case 'tirabloco': removerBloco(); break;
        }
        avisar();
    });

    barra.querySelector('[data-largslider]').addEventListener('input', (e) => {
        if (!figuraAtual) return;
        const pct = definirLarg(figuraAtual, Number(e.target.value));
        barra.querySelector('[data-largout]').textContent = pct + '%';
        posicionarAlca(figuraAtual);
        avisar();
    });

    /* ── Alinhamento: um controle, quatro estados ───────────
       O menu abre no clique e fecha ao escolher ou ao clicar fora. Não é
       <select> porque o glifo do botão precisa MOSTRAR o alinhamento atual,
       e <select> nativo não deixa desenhar o rótulo fechado. */
    const menuAlin = toolbar.querySelector('[data-alinhar]');
    const listaAlin = menuAlin.querySelector('.wb-rich-menu__lista');
    const glifoAlin = menuAlin.querySelector('[data-alinharGlifo]');

    toolbar.querySelector('[data-rich="alinhar"]').addEventListener('click', (e) => {
        e.stopPropagation();
        listaAlin.hidden = !listaAlin.hidden;
    });
    listaAlin.addEventListener('click', (e) => {
        const b = e.target.closest('[data-alin]'); if (!b) return;
        ed.focus();
        document.execCommand(b.dataset.alin, false, null);
        listaAlin.hidden = true;
        pintarEstado();
        avisar();
    });
    _vivo = { ed, menuAlin, listaAlin, pintarEstado: () => pintarEstado() };

    /* ── Estado visível ─────────────────────────────────────
       O menu tem de dizer o que ESTÁ aplicado. Sem isto, o autor escolhe
       "Carta", o <select> volta para "Bloco…" e nada na tela conta que aquele
       parágrafo virou uma Carta — e aí ele não sabe nem que há o que desfazer.
       Metade do ⊘ bloco é este espelho. */
    function pintarEstado() {
        const sel = window.getSelection();
        let no = sel.rangeCount ? sel.anchorNode : null;
        if (no && no.nodeType === Node.TEXT_NODE) no = no.parentElement;
        if (!no || !ed.contains(no)) return;

        // Alinhamento: o glifo do botão vira o do estado atual.
        const alinAtual = ALINHAR.find(([cmd]) => {
            try { return document.queryCommandState(cmd); } catch { return false; }
        }) || ALINHAR[0];
        glifoAlin.textContent = alinAtual[1];
        menuAlin.querySelectorAll('[data-alin]').forEach(b =>
            b.classList.toggle('is-on', b.dataset.alin === alinAtual[0]));

        // Bloco de parágrafo.
        const selBloco = toolbar.querySelector('[data-rich="bloco"]');
        for (let n = no; n && n !== ed; n = n.parentElement) {
            const tag = n.tagName.toLowerCase();
            if (BLOCOS.some(([v]) => v === tag)) { selBloco.value = tag; break; }
        }

        /* Caixa e coluna: o <select> passa a MOSTRAR o que envolve o cursor,
           em vez de voltar sempre ao rótulo. Reescolher a mesma opção desfaz,
           e agora dá para ver qual é "a mesma". */
        const marcarSel = (seletor, achar) => {
            const s2 = toolbar.querySelector(seletor);
            const v = achar();
            s2.value = [...s2.options].some(o => o.value === v) ? v : '';
            s2.classList.toggle('is-on', !!v);
        };
        marcarSel('[data-rich="bloco2"]', () => {
            for (let n = no; n && n !== ed; n = n.parentElement) {
                if (n.classList.contains('tm-ponto')) return 'ins:ponto';
                if (n.classList.contains('tm-carta')) {
                    if (n.classList.contains('tm-carta--maquina')) return 'wrap:tm-carta tm-carta--maquina';
                    if (n.classList.contains('tm-carta--mao')) return 'wrap:tm-carta tm-carta--mao';
                    return 'wrap:tm-carta';
                }
                if (n.classList.contains('tm-aviso--nota')) return 'tm-aviso tm-aviso--nota';
                if (n.classList.contains('tm-aviso--segredo')) return 'tm-aviso tm-aviso--segredo';
                if (n.classList.contains('tm-aviso')) return 'tm-aviso';
                if (n.classList.contains('tm-leitura')) return 'tm-leitura';
                if (n.classList.contains('tm-nota')) return 'tm-nota';
            }
            return '';
        });
        marcarSel('[data-rich="cols"]', () => {
            const cx = no.closest?.('[class*="tm-cols--"]');
            if (!cx || !ed.contains(cx)) return '';
            return [...cx.classList].find(c => c.startsWith('tm-cols--')) || '';
        });

        // O ⊘ só acende quando há bloco para tirar.
        toolbar.querySelector('[data-rich="tirabloco"]')
            .classList.toggle('is-on', !!temBlocoAqui(no));
    }
    /* Espelha o cursor: teclado e clique. O `selectionchange` mora no
       DOCUMENTO, e por isso é registrado uma vez só (ver `_vivo` no topo) —
       a seta que anda entre parágrafos não dispara keyup nem click. */
    ed.addEventListener('keyup', pintarEstado);
    ed.addEventListener('click', pintarEstado);

    toolbar.querySelector('[data-rich="cor"]').addEventListener('input', (e) => {
        ed.focus();
        document.execCommand('foreColor', false, e.target.value);
        avisar();
    });

    /* ── Colunas: envolve os blocos escolhidos ──────────────
       `columns`/`grid` precisam de um PAI. Sem envolver, "duas colunas"
       viraria uma classe solta num parágrafo, que não divide nada. */
    toolbar.querySelector('[data-rich="cols"]').addEventListener('change', (e) => {
        const classe = e.target.value;
        e.target.selectedIndex = 0;
        const blocos = blocosDaSelecao();
        if (!blocos.length) return;
        ed.focus();
        const dentro = blocos[0].closest('[class*="tm-cols--"]');
        if (dentro) desembrulhar(dentro);
        if (classe) envolver(blocos, classe);
        avisar();
    });

    /* Blocos. Três gestos diferentes por trás do mesmo seletor, e o valor
       diz qual: `ins:` insere estrutura, `wrap:` envolve o que está
       selecionado, e o resto é classe no bloco onde o cursor está. Um
       seletor só porque, para quem escreve, os três são "pôr um bloco". */
    toolbar.querySelector('[data-rich="bloco2"]').addEventListener('change', (e) => {
        const valor = e.target.value;
        e.target.selectedIndex = 0;
        if (!valor) return;
        ed.focus();

        if (valor.startsWith('ins:')) { inserirPonto(); avisar(); return; }
        if (valor.startsWith('wrap:')) {
            const blocos = blocosDaSelecao();
            if (!blocos.length) return;
            const dentro = blocos[0].closest('.tm-carta');
            if (dentro) desembrulhar(dentro);           // reaplicar desfaz
            else envolver(blocos, valor.slice(5));
            avisar();
            return;
        }

        const classes = valor.split(' ').filter(Boolean);
        const bloco = blocosDaSelecao()[0];
        if (!bloco) return;
        const jaTem = classes.every(c => bloco.classList.contains(c));
        // Trocar de bloco não pode empilhar: sair de "aviso" para "leitura"
        // com as duas classes daria uma caixa que é as duas e não é nenhuma.
        bloco.classList.remove('tm-nota', 'tm-leitura', 'tm-aviso', 'tm-aviso--nota', 'tm-aviso--segredo');
        if (!jaTem) bloco.classList.add(...classes);
        avisar();
    });

    /* Classes de bloco que o autor liga pelo menu. Ficam numa lista só para
       tirar todas de uma vez — e para o dia em que entrar a sexta. */
    const CLASSES_BLOCO = ['tm-nota', 'tm-leitura', 'tm-aviso', 'tm-aviso--nota',
        'tm-aviso--segredo', 'tm-capitular'];

    /**
     * Tira o bloco de onde o cursor está. DESCASCA UMA CAMADA POR CLIQUE, da
     * mais interna para a mais externa — parágrafo dentro de uma Carta dentro
     * de duas colunas sai em três cliques, e a cada um dá para ver o que
     * aconteceu. Tirar tudo de uma vez apagaria diagramação que o autor quis
     * manter, e ele não teria como saber o que perdeu.
     */
    /**
     * A camada de bloco mais interna a partir de `no`, ou null.
     *
     * Sobe do CURSOR, não do bloco de topo. Uma nota de margem dentro de duas
     * colunas tem a nota por dentro e as colunas por fora; partindo do topo, o
     * primeiro clique arrancaria as colunas e deixaria a nota — o contrário do
     * que quem clicou está vendo.
     *
     * Devolve `{ no, tipo }` para o ⊘ saber o que fazer e o estado saber se
     * há algo a fazer. Uma definição só: se as duas divergirem, o botão acende
     * quando não faz nada, ou faz sem estar aceso.
     */
    function temBlocoAqui(no) {
        for (let n = no; n && n !== ed; n = n.parentElement) {
            if (!n.classList) continue;
            const classes = CLASSES_BLOCO.filter(c => n.classList.contains(c));
            if (classes.length) return { no: n, tipo: 'classe', classes };
            if (n.classList.contains('tm-ponto')) return { no: n, tipo: 'ponto' };
            if (n.classList.contains('tm-carta')) return { no: n, tipo: 'envoltorio' };
            if (/(^| )tm-cols--/.test(n.className)) return { no: n, tipo: 'envoltorio' };
        }
        return null;
    }

    function removerBloco() {
        const sel = window.getSelection();
        if (!sel.rangeCount) return;
        let no = sel.anchorNode;
        if (no && no.nodeType === Node.TEXT_NODE) no = no.parentElement;
        if (!no || !ed.contains(no)) return;

        const alvo = temBlocoAqui(no);
        if (!alvo) return;
        if (alvo.tipo === 'classe') { alvo.no.classList.remove(...alvo.classes); }
        else if (alvo.tipo === 'ponto') {
            /* O ponto de interesse não se desembrulha cru: o número é etiqueta
               do bloco, e sozinho no meio do texto vira lixo. */
            alvo.no.querySelector('.tm-ponto__n')?.remove();
            desembrulhar(alvo.no);
        } else {
            desembrulhar(alvo.no);
        }
        pintarEstado();
    }

    /** Os blocos de topo tocados pela seleção — é neles que coluna e caixa
     *  fazem sentido, não no <span> onde o cursor por acaso está. */
    function blocosDaSelecao() {
        const sel = window.getSelection();
        if (!sel.rangeCount) return [];
        const r = sel.getRangeAt(0);
        const deTopo = (no) => {
            let n = no?.nodeType === Node.TEXT_NODE ? no.parentElement : no;
            while (n && n.parentElement && n.parentElement !== ed) n = n.parentElement;
            return n && n !== ed ? n : null;
        };
        const ini = deTopo(r.startContainer), fim = deTopo(r.endContainer);
        if (!ini) return [];
        const todos = [...ed.children];
        const a2 = todos.indexOf(ini), b2 = fim ? todos.indexOf(fim) : a2;
        return todos.slice(Math.min(a2, b2), Math.max(a2, b2) + 1);
    }

    /* O ponto de interesse é ESTRUTURA, não classe: número, título e
       descrição em papéis fixos. Nasce com texto de exemplo em vez de vazio
       — três caixas em branco não dizem o que vai em cada uma. */
    function inserirPonto() {
        const bloco = blocosDaSelecao()[0];
        const cx = document.createElement('div');
        cx.className = 'tm-ponto';
        cx.innerHTML = '<span class="tm-ponto__n">01</span>'
            + '<h3>Nome do ponto</h3>'
            + '<p>O que os personagens veem ao olhar para isto.</p>';
        if (bloco) bloco.after(cx); else ed.appendChild(cx);
        // Parágrafo depois, senão o cursor fica preso no fim do bloco.
        const p = document.createElement('p');
        p.innerHTML = '<br>';
        cx.after(p);
        const r = document.createRange();
        r.setStart(cx.querySelector('h3'), 0); r.collapse(true);
        const sel = window.getSelection();
        sel.removeAllRanges(); sel.addRange(r);
    }

    function envolver(blocos, classe) {
        const caixa = document.createElement('div');
        caixa.className = classe;
        blocos[0].before(caixa);
        blocos.forEach(b => caixa.appendChild(b));
    }
    function desembrulhar(caixa) {
        while (caixa.firstChild) caixa.before(caixa.firstChild);
        caixa.remove();
    }

    toolbar.querySelector('[data-rich="bloco"]').addEventListener('change', (e) => {
        ed.focus();
        document.execCommand('formatBlock', false, e.target.value);
        avisar();
    });

    /** Tabela com cabeçalho, do tamanho que o autor pedir. */
    async function inserirTabela() {
        const cols = Math.min(8, Math.max(1, parseInt(await perguntar('Quantas colunas?', { valor: '3' }), 10) || 0));
        if (!cols) return;
        const linhas = Math.min(30, Math.max(1, parseInt(await perguntar('Quantas linhas (sem contar o cabeçalho)?', { valor: '3' }), 10) || 0));
        if (!linhas) return;

        const cel = (t) => `<${t}><br></${t}>`.repeat(cols);
        const html =
            `<div class="tm-tabela-rola"><table>` +
            `<thead><tr>${cel('th')}</tr></thead>` +
            `<tbody>${`<tr>${cel('td')}</tr>`.repeat(linhas)}</tbody>` +
            `</table></div><p><br></p>`;
        document.execCommand('insertHTML', false, html);
    }

    /** Liga/desliga uma classe `tm-*` no bloco onde o cursor está. */
    function alternarClasse(classe) {
        const sel = window.getSelection();
        if (!sel.rangeCount) return;
        let no = sel.anchorNode;
        if (no && no.nodeType === Node.TEXT_NODE) no = no.parentElement;
        while (no && no !== ed && no.parentElement !== ed) no = no.parentElement;
        if (!no || no === ed) return;
        no.classList.toggle(classe);
    }

    /* ── Colar: entra limpo, senão a diagramação some nas outras telas ── */
    ed.addEventListener('paste', (e) => {
        const dt = e.clipboardData;
        if (!dt) return;
        const html = dt.getData('text/html');
        e.preventDefault();
        if (html) {
            document.execCommand('insertHTML', false, limparHTML(html));
        } else {
            document.execCommand('insertText', false, dt.getData('text/plain'));
        }
        avisar();
    });

    /* ── Clique numa imagem abre a barra de layout ───────── */
    ed.addEventListener('click', (e) => {
        const fig = e.target.closest('figure.tm-fig');
        if (fig && ed.contains(fig)) mostrarBarra(fig);
        else if (!e.target.closest('.wb-imgbar')) esconderBarra();
    });
    ed.addEventListener('scroll', esconderBarra);
    window.addEventListener('resize', esconderBarra);

    /* Mantém o seletor de estilo mostrando o bloco onde o cursor está. */
    const seletor = toolbar.querySelector('[data-rich="bloco"]');
    ed.addEventListener('keyup', sincronizarBloco);
    ed.addEventListener('mouseup', sincronizarBloco);
    function sincronizarBloco() {
        let b = '';
        try { b = (document.queryCommandValue('formatBlock') || '').toLowerCase(); } catch { /* ignora */ }
        if (BLOCOS.some(([v]) => v === b)) seletor.value = b;
    }

    return {
        esconderBarra,
        /** HTML pronto para gravar — a mesma faxina do colar, agora na fronteira que conta. */
        limpar: () => limparHTML(ed.innerHTML),
    };
}
