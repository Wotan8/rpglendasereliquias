/* ═══════════════════════════════════════════════════════════
   wb-rich.js — a mesa de diagramação do Escritório do Cronista
   ───────────────────────────────────────────────────────────
   Tudo que o escritor usa para dar forma ao texto: títulos,
   ênfases, cor, alinhamento, listas, citação, filete, link,
   capitular, duas colunas e IMAGENS (upload ou URL) com
   tamanho e posição.

   O que sai daqui é sempre o vocabulário de shared/texto-mundo.css
   (classes `tm-*` + estilo inline curto). Por isso o capítulo
   aparece igual no Worldbuilding, na ficha do jogador e no
   Laboratorium — as três telas leem a MESMA folha.

   Não conhece livros nem Firestore: recebe o contenteditable e
   devolve eventos. Quem salva é o wb-editor.
   ═══════════════════════════════════════════════════════════ */

import { storage, ref, uploadBytes, getDownloadURL } from './firebase-config.js';
import { limparHTML } from './wb-rich-sanitize.js';

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
<button class="btn btn-secondary btn-sm" data-rich="cmd" data-cmd="removeFormat" title="Limpar formatação">🧹</button>
<input type="file" data-rich="arquivo" accept="image/*" hidden>
`;

/* Barra flutuante que aparece ao clicar numa imagem. */
const BARRA_IMG_HTML = `
<div class="wb-imgbar__grupo">
    <span>Tamanho</span>
    <button data-tam="tm-img--p">P</button>
    <button data-tam="tm-img--m">M</button>
    <button data-tam="tm-img--g">G</button>
    <button data-tam="tm-img--full">Cheia</button>
</div>
<div class="wb-imgbar__grupo">
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

const TAMANHOS = ['tm-img--p', 'tm-img--m', 'tm-img--g', 'tm-img--full'];
const POSICOES = ['tm-fig--esq', 'tm-fig--dir', 'tm-fig--flut-esq', 'tm-fig--flut-dir'];

/**
 * Liga a barra a um contenteditable.
 * @param ed        o elemento contenteditable
 * @param toolbar   onde os botões foram injetados
 * @param onChange  chamado a cada alteração (o wb-editor usa para o autosave)
 * @returns { limpar } → HTML pronto para gravar
 */
export function bindRich(ed, toolbar, onChange) {
    // Sem isto o Chrome ainda escreve <font color> em vez de style="color:…",
    // e a faxina (que só aceita style) jogaria a cor do autor fora.
    try { document.execCommand('styleWithCSS', false, true); } catch { /* Safari antigo */ }

    const avisar = () => { if (typeof onChange === 'function') onChange(); };
    const arquivo = toolbar.querySelector('[data-rich="arquivo"]');
    let figuraAtual = null;   // figura que a barra flutuante está editando
    let trocando = false;     // o file picker foi aberto para TROCAR a imagem?

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
        barra.querySelectorAll('[data-tam]').forEach(b =>
            b.classList.toggle('is-on', !!img && img.classList.contains(b.dataset.tam)));
        barra.querySelectorAll('[data-pos]').forEach(b =>
            b.classList.toggle('is-on', b.dataset.pos
                ? fig.classList.contains(b.dataset.pos)
                : !POSICOES.some(p => fig.classList.contains(p))));
    }
    const esconderBarra = () => { barra.hidden = true; figuraAtual = null; };

    barra.addEventListener('mousedown', (e) => {
        const b = e.target.closest('button');
        if (!b || !figuraAtual) return;
        e.preventDefault();
        const fig = figuraAtual;

        if (b.dataset.tam) {
            const img = fig.querySelector('img');
            if (img) { img.classList.remove(...TAMANHOS); img.classList.add(b.dataset.tam); }
        } else if (b.dataset.pos !== undefined) {
            fig.classList.remove(...POSICOES);
            if (b.dataset.pos) fig.classList.add(b.dataset.pos);
        } else if (b.dataset.acao === 'remover') {
            fig.remove(); esconderBarra(); avisar(); return;
        } else if (b.dataset.acao === 'trocar') {
            trocando = true; arquivo.value = ''; arquivo.click(); return;
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

    async function enviarImagem(file) {
        if (!file) return null;
        if (!file.type.startsWith('image/')) { alert('Só imagens, por favor.'); return null; }
        if (file.size > 8 * 1024 * 1024) { alert('Imagem acima de 8 MB. Reduza antes de subir.'); return null; }
        const nome = `${Date.now()}_${file.name.replace(/[^\w.-]/g, '_')}`;
        const snap = await uploadBytes(ref(storage, `worldbuilding-images/${nome}`), file);
        return await getDownloadURL(snap.ref);
    }

    async function comAviso(fn) {
        const antes = document.body.style.cursor;
        document.body.style.cursor = 'progress';
        try { return await fn(); }
        catch (e) { console.error('[rich] upload', e); alert('Não consegui subir a imagem. Tente de novo.'); return null; }
        finally { document.body.style.cursor = antes; }
    }

    arquivo.addEventListener('change', async () => {
        const file = arquivo.files && arquivo.files[0];
        const paraTrocar = trocando; trocando = false;
        if (!file) return;
        const url = await comAviso(() => enviarImagem(file));
        arquivo.value = '';
        if (!url) return;
        if (paraTrocar && figuraAtual) {
            const img = figuraAtual.querySelector('img');
            if (img) img.src = url;
            avisar();
        } else {
            inserirFigura(url, file.name);
        }
    });

    /* ── Botões da barra ─────────────────────────────────── */
    toolbar.addEventListener('click', (e) => {
        const alvo = e.target.closest('[data-rich]');
        if (!alvo || alvo.dataset.rich === 'arquivo' || alvo.dataset.rich === 'cor') return;
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
                const url = prompt('Endereço do link:', 'https://');
                if (url) document.execCommand('createLink', false, url);
                break;
            }
            case 'imagem': {
                const url = prompt('Cole o endereço da imagem — ou deixe vazio para escolher um arquivo do computador:', '');
                if (url === null) break;
                if (url.trim()) inserirFigura(url.trim(), '');
                else { trocando = false; arquivo.value = ''; arquivo.click(); }
                break;
            }
            case 'tabela': inserirTabela(); break;
        }
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
    function inserirTabela() {
        const cols = Math.min(8, Math.max(1, parseInt(prompt('Quantas colunas?', '3'), 10) || 0));
        if (!cols) return;
        const linhas = Math.min(30, Math.max(1, parseInt(prompt('Quantas linhas (sem contar o cabeçalho)?', '3'), 10) || 0));
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
