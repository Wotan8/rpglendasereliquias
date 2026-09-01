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
<button class="btn btn-secondary btn-sm" data-rich="cmd" data-cmd="justifyLeft" title="Alinhar à esquerda">⬅</button>
<button class="btn btn-secondary btn-sm" data-rich="cmd" data-cmd="justifyCenter" title="Centralizar">↔</button>
<button class="btn btn-secondary btn-sm" data-rich="cmd" data-cmd="justifyRight" title="Alinhar à direita">➡</button>
<button class="btn btn-secondary btn-sm" data-rich="cmd" data-cmd="justifyFull" title="Justificar">☰</button>
<span class="wb-rich-sep"></span>
<button class="btn btn-secondary btn-sm" data-rich="cmd" data-cmd="insertUnorderedList" title="Lista">•—</button>
<button class="btn btn-secondary btn-sm" data-rich="cmd" data-cmd="insertOrderedList" title="Lista numerada">1.</button>
<button class="btn btn-secondary btn-sm" data-rich="cmd" data-cmd="insertHorizontalRule" title="Filete separador">—</button>
<span class="wb-rich-sep"></span>
<button class="btn btn-secondary btn-sm" data-rich="classe" data-classe="tm-capitular" title="Capitular — primeira letra grande">✒️</button>
<button class="btn btn-secondary btn-sm" data-rich="classe" data-classe="tm-colunas" title="Duas colunas">▥</button>
<button class="btn btn-secondary btn-sm" data-rich="link" title="Inserir link">🔗</button>
<button class="btn btn-secondary btn-sm" data-rich="imagem" title="Inserir imagem">🖼️</button>
<button class="btn btn-secondary btn-sm" data-rich="tabela" title="Inserir tabela">▦</button>
<button class="btn btn-secondary btn-sm" data-rich="campo" title="Campo vinculado — o valor vem do cadastro e se atualiza sozinho">🔗↻</button>
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
        if (!alvo || alvo.dataset.rich === 'cor') return;
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

    toolbar.querySelector('[data-rich="cor"]').addEventListener('input', (e) => {
        ed.focus();
        document.execCommand('foreColor', false, e.target.value);
        avisar();
    });

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
