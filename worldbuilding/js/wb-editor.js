/* ═══════════════════════════════════════════════════════════
   wb-editor.js — Escritório do Cronista
   ─────────────────────────────────────
   Área do ESCRITOR. Duas telas:

   • 📚 BIBLIOTECA — estantes com LIVROS (cada um com seus
     capítulos/contos) + uma prateleira de TEXTOS AVULSOS.
     Mostra status público/privado, nº de capítulos e palavras.

   • ✒️ ESCRITA — editor rich-text com:
       – título, sinopse, livro/ordem, público, status;
       – painel de consulta com as fichas REAIS do ecossistema;
       – @menções que linkam NPCs, Tribos, Locais, eventos…;
       – autosave + modo foco.

   Coleções:
     worldbuilding-books      → livros (agrupam capítulos)
     worldbuilding-articles   → capítulos/contos/textos
     worldbuilding-settings/estantes → lista de estantes (um doc só)
   ═══════════════════════════════════════════════════════════ */

import { db, collection, getDocs, doc, getDoc, setDoc, deleteDoc } from './firebase-config.js';
import { WB, esc, uid, ToolModal, setTitle, contentBody, searchables, KIND, poolOf } from './wb-utils.js';
import { dossieHTML } from './wb-dossie.js';
import { TOOLBAR_HTML, bindRich } from './wb-rich.js';
import { PUBLICACOES, pubDoLivro, versaoDoLivro } from '../../shared/livros-pub.js';
import { confirmar } from '../../shared/dialogo.js?v=2';

export const Editor = (() => {
    let books = [], artigos = [], estantes = [], atual = null;
    let rich = null;   // mesa de diagramação (wb-rich.js) do editor aberto
    let mentionRange = null, mentionIdx = 0, saveTimer = null, refType = 'all';
    let view = 'library';   // 'library' | 'editor'
    let modo = 'escrita';   // 'escrita' | 'leitura' — vale para toda a sessão
    let busca = '', fstatus = '';   // filtros da Biblioteca
    let sujo = false;               // há texto digitado que ainda não foi gravado

    const $ = (s) => document.querySelector(s);
    const now = () => Date.now();
    const wordCount = (html) => {
        const txt = (html || '').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ');
        const m = txt.trim().match(/\S+/g);
        return m ? m.length : 0;
    };
    /* `words` é gravado a cada save(). Recontar o HTML de todos os artigos a
       cada render da Biblioteca custava caro à toa — só o doc antigo, que
       nunca passou por um save novo, ainda paga a conta. */
    const palavrasDe = (a) => a.words ?? wordCount(a.contentHTML);
    const fmtDate = (ts) => ts ? new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

    /* localStorage some em aba anônima e estoura com site data bloqueado —
       lembrar estante aberta é conforto, não pode derrubar o Escritório. */
    const guardado = (chave, alt) => { try { return JSON.parse(localStorage.getItem(chave)) ?? alt; } catch { return alt; } };
    const guardar = (chave, v) => { try { localStorage.setItem(chave, JSON.stringify(v)); } catch { /* sem memória, paciência */ } };

    async function loadAll() {
        try {
            const [bSnap, aSnap, eSnap] = await Promise.all([
                getDocs(collection(db, 'worldbuilding-books')),
                getDocs(collection(db, 'worldbuilding-articles')),
                getDoc(doc(db, 'worldbuilding-settings', 'estantes')),
            ]);
            books = bSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            artigos = aSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            estantes = eSnap.exists() ? (eSnap.data().lista || []) : [];
        } catch (e) { console.warn('[editor] load', e); books = books || []; artigos = artigos || []; estantes = estantes || []; }
    }

    /* ── Estantes ──────────────────────────────────────────────
       Todas num doc só (como o mural). A estante padrão é virtual:
       lista TODOS os livros, e é onde o livro sem estante aparece. */
    const ESTANTE_TODAS = '__todas';
    const CHAVE_ABERTAS = 'wb-cronista-estantes-abertas';
    let abertas = new Set(guardado(CHAVE_ABERTAS, []));
    const salvarEstantes = () => setDoc(doc(db, 'worldbuilding-settings', 'estantes'), { lista: estantes });
    /* Um livro pode estar em várias estantes. `estanteId` (uma só) é o
       formato legado — quando `estanteIds` existe, é ele que manda. */
    const estantesDoLivro = (b) => b.estanteIds || (b.estanteId ? [b.estanteId] : []);
    const livrosDaEstante = (id) => ordenados(id === ESTANTE_TODAS ? books : books.filter(b => estantesDoLivro(b).includes(id)));
    const ordenados = (arr) => arr.slice()
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (b.updatedAt ?? 0) - (a.updatedAt ?? 0));

    /* Capítulos de um livro, na ordem definida. */
    const chaptersOf = (bookId) =>
        artigos.filter(a => a.bookId === bookId)
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.createdAt ?? 0) - (b.createdAt ?? 0));
    const loose = () => artigos.filter(a => !a.bookId)
        .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));

    /* ── Filtros da Biblioteca ─────────────────────────────────
       Uma busca de texto e um status. A regra é uma só: o LIVRO aparece se
       ele mesmo casar com a busca, ou se sobrar algum capítulo dele depois
       do filtro. Quando o livro casa pelo próprio título, os capítulos dele
       não precisam casar de novo — quem procurou o livro quer o livro. */
    const filtrando = () => !!(busca || fstatus);
    const bate = (...campos) => !busca || campos.some(c => String(c || '').toLowerCase().includes(busca));
    const statusPassa = (a) => !fstatus
        || (fstatus === 'privado' ? !a.public : (a.status || 'rascunho') === fstatus);
    const capsVisiveis = (b) => chaptersOf(b.id)
        .filter(a => statusPassa(a) && (bate(b.title, b.description) || bate(a.title, a.synopsis)));
    const livrosVisiveis = (id) => livrosDaEstante(id).filter(b =>
        !filtrando() || capsVisiveis(b).length > 0 || (!fstatus && bate(b.title, b.description)));
    const avulsosVisiveis = () => loose().filter(a => statusPassa(a) && bate(a.title, a.synopsis));

    const pubBadge = (isPub) => isPub
        ? '<span class="wb-badge wb-badge--pub">🌐 Público</span>'
        : '<span class="wb-badge wb-badge--priv">🔒 Privado</span>';
    /* Livro tem quatro publicações (shared/livros-pub.js) — o selo mostra as marcadas. */
    const pubBadgesLivro = (b) => {
        const p = pubDoLivro(b);
        const selos = PUBLICACOES.filter(([k]) => p[k])
            .map(([, label]) => `<span class="wb-badge wb-badge--pub">${label.replace('Publicar ', '')}</span>`);
        return selos.join(' ') || '<span class="wb-badge wb-badge--priv">🔒 Não publicado</span>';
    };
    /* Selo de versão — vem primeiro na fila de badges, e some se o autor
       não escreveu versão nenhuma (ver shared/livros-pub.js). */
    const seloVersao = (b) => {
        const v = versaoDoLivro(b);
        return v ? `<span class="wb-badge wb-badge--ver" title="Versão do livro">🔖 ${esc(v)}</span> ` : '';
    };
    const statusBadge = (st) => {
        const map = { rascunho: ['✏️ Rascunho', 'draft'], revisao: ['🔍 Em revisão', 'rev'], publicado: ['✅ Publicado', 'done'] };
        const [label, cls] = map[st] || map.rascunho;
        return `<span class="wb-badge wb-badge--${cls}">${label}</span>`;
    };

    /* ══════════════ BIBLIOTECA ══════════════ */
    function renderLibrary() {
        view = 'library';
        setTitle('📚 Escritório do Cronista');
        document.body.classList.remove('wbt-focus');

        const totalPalavras = artigos.reduce((s, a) => s + palavrasDe(a), 0);
        const avulsos = avulsosVisiveis();
        const ativo = filtrando();
        /* Com filtro ligado, a estante vazia só ocuparia espaço dizendo nada. */
        const comLivros = (id) => { const l = livrosVisiveis(id); return ativo && !l.length ? null : l; };
        const achados = ativo
            ? new Set([...livrosVisiveis(ESTANTE_TODAS).flatMap(b => capsVisiveis(b).map(a => a.id)), ...avulsos.map(a => a.id)]).size
            : 0;

        contentBody().innerHTML = `
        <div class="wb-library">
            <div class="wb-lib-toolbar">
                <div class="wb-lib-stats">
                    <span><b>${books.length}</b> livros</span>
                    <span><b>${artigos.length}</b> textos</span>
                    <span><b>${totalPalavras.toLocaleString('pt-BR')}</b> palavras</span>
                </div>
                <span style="flex:1"></span>
                <button class="btn btn-secondary btn-sm" id="newEstante">🗂️ Nova estante</button>
                <button class="btn btn-secondary btn-sm" id="newLoose">📄 Novo texto avulso</button>
                <button class="btn btn-success btn-sm" id="newBook">📗 Novo livro</button>
            </div>

            <div class="wb-lib-filtros">
                <input id="libBusca" class="form-input wb-lib-busca" type="search" autocomplete="off"
                       placeholder="🔎 Buscar livro ou capítulo…" value="${esc(busca)}">
                <div class="wbt-chips" id="libStatus">
                    ${[['', 'Tudo'], ['rascunho', '✏️ Rascunho'], ['revisao', '🔍 Revisão'],
                       ['publicado', '✅ Publicado'], ['privado', '🔒 Privado']].map(([v, l]) =>
                        `<button type="button" class="wbt-chip ${fstatus === v ? 'is-active' : ''}" data-fst="${v}">${l}</button>`).join('')}
                </div>
                ${ativo ? `<button class="btn btn-secondary btn-sm" id="libLimpar" title="Limpar busca e filtro">✕ Limpar</button>
                    <span class="wbt-muted">${achados} ${achados === 1 ? 'texto' : 'textos'}</span>` : ''}
            </div>

            <h3 class="wb-lib-section">📚 Biblioteca</h3>
            <div class="wb-estantes">
                ${estanteHTML({ id: ESTANTE_TODAS, nome: 'Todos os livros', icone: '📚' },
                    comLivros(ESTANTE_TODAS),
                    'Nenhum livro ainda. Crie um livro para agrupar capítulos e contos.')}
                ${estantes.map(e => estanteHTML(e, comLivros(e.id),
                    'Estante vazia. Escolha esta estante no ⚙️ do livro.')).join('')}
                ${(ativo && !avulsos.length) ? '' : estanteHTML({ id: '__avulsos', nome: 'Textos avulsos', icone: '📄' }, avulsos,
                    'Nenhum texto avulso. Bons textos avulsos podem virar capítulos depois.',
                    (lista) => `<div class="wb-loose-list">${lista.map(a => articleRow(a)).join('')}</div>`)}
            </div>
            ${ativo && !achados ? '<p class="wbt-empty">Nada casou com a busca. Tente outra palavra ou limpe o filtro.</p>' : ''}
        </div>`;

        bindLibrary();
    }

    /* Bloco compacto de estante: fechada ocupa um tijolinho na grade,
       aberta toma a largura toda e mostra os livros. Puro <details>.
       O ⚙️ fica FORA do <summary> — dentro dele, todo clique abria a
       estante junto. Ele flutua no canto do cabeçalho (CSS).

       `lista` null = estante que o filtro esvaziou, nem desenha. Aberta se o
       autor a deixou aberta da última vez, ou sempre que há filtro ligado —
       buscar e receber uma fileira de estantes fechadas não seria busca. */
    function estanteHTML(e, lista, vazioMsg, render = (l) => l.map(bookCard).join('')) {
        if (!lista) return '';
        const fixa = e.id === ESTANTE_TODAS || e.id === '__avulsos';
        const corpo = lista.length ? render(lista) : `<p class="wbt-muted">${vazioMsg}</p>`;
        return `
        <div class="wb-estante" data-estante="${esc(e.id)}">
            <details class="wb-estante__det" ${abertas.has(e.id) || filtrando() ? 'open' : ''}>
                <summary class="wb-estante__head">
                    <span class="wb-estante__caret">▸</span>
                    <span class="wb-estante__icon">${esc(e.icone || '🗂️')}</span>
                    <span class="wb-estante__name">${esc(e.nome || 'Estante sem nome')}</span>
                    <span class="wb-badge wb-badge--soft">${lista.length}</span>
                </summary>
                <div class="wb-estante__body">${corpo}</div>
            </details>
            ${fixa ? '' : `<button class="btn btn-secondary btn-sm wb-estante__cog" data-editestante="${esc(e.id)}" title="Renomear ou excluir a estante">⚙️</button>`}
        </div>`;
    }

    /* ══════════════ ESTANTE (modal) ══════════════ */
    function openEstanteModal(est = null) {
        const e = est || { id: uid('est'), nome: '', icone: '🗂️' };
        ToolModal.open(`
            <h2>${est ? '⚙️ Editar estante' : '🗂️ Nova estante'}</h2>
            <div class="wbt-form">
                <label>Nome da estante <input id="esNome" class="form-input" value="${esc(e.nome || '')}" placeholder="Ex: Regras do sistema"></label>
                <label>Ícone <input id="esIcone" class="form-input" value="${esc(e.icone || '')}" maxlength="4" placeholder="🗂️" style="width:90px"></label>
                <div class="wbt-muted" style="font-size:.8rem">
                    O livro entra na estante pelas configurações dele (⚙️ no livro), e pode
                    estar em várias ao mesmo tempo. Livro sem estante aparece só em “Todos os livros”.
                </div>
                <div class="wbt-actions">
                    ${est ? '<button class="btn btn-danger" id="esDel">🗑️ Excluir estante</button>' : ''}
                    <button class="btn btn-success" id="esSave">💾 Salvar estante</button>
                </div>
            </div>`);
        $('#esSave').onclick = async () => {
            e.nome = $('#esNome').value.trim() || 'Estante sem nome';
            e.icone = $('#esIcone').value.trim() || '🗂️';
            if (!estantes.find(x => x.id === e.id)) estantes.push(e);
            await salvarEstantes();
            ToolModal.close(); renderLibrary();
        };
        const del = $('#esDel');
        if (del) del.onclick = async () => {
            const n = livrosDaEstante(e.id).length;
            if (!await confirmar(`Excluir a estante "${e.nome}"?${n ? `\nOs ${n} livros NÃO serão apagados — continuam nas outras estantes em que estejam, e em "Todos os livros".` : ''}`, { perigo: true })) return;
            estantes = estantes.filter(x => x.id !== e.id);
            await salvarEstantes();
            ToolModal.close(); renderLibrary();
        };
    }

    function bookCard(b) {
        const todos = chaptersOf(b.id);
        const caps = filtrando() ? capsVisiveis(b) : todos;
        const palavras = todos.reduce((s, a) => s + palavrasDe(a), 0);
        /* O número do capítulo é o do SUMÁRIO, não o da lista filtrada: achar
           "cap. 1" quando na verdade é o sétimo do livro seria mentira. */
        const capsHtml = caps.length
            ? caps.map(a => articleRow(a, todos.indexOf(a) + 1)).join('')
            : '<p class="wbt-muted" style="margin:.4rem .2rem">Sem capítulos ainda.</p>';
        return `
        <details class="wb-book" data-book="${b.id}" ${filtrando() ? 'open' : ''}>
            <summary class="wb-book__head">
                <span class="wb-book__caret">▸</span>
                <div class="wb-book__cover" style="${b.cover ? `background-image:url('${esc(b.cover)}')` : ''}"
                     ${b.cover ? `data-zoom="${esc(b.cover)}" data-zoom-alt="${esc(b.title || '')}" title="Ver a capa maior"` : ''}>${b.cover ? '' : '📖'}</div>
                <div class="wb-book__meta">
                    <div class="wb-book__title">${esc(b.title || 'Livro sem título')}</div>
                    <div class="wb-book__badges">${seloVersao(b)}${pubBadgesLivro(b)} <span class="wb-badge wb-badge--soft">${filtrando() && caps.length !== todos.length ? caps.length + ' de ' + todos.length : todos.length} cap.</span> <span class="wb-badge wb-badge--soft">${palavras.toLocaleString('pt-BR')} palavras</span></div>
                    ${b.description ? `<p class="wb-book__desc">${esc(b.description)}</p>` : ''}
                </div>
                <div class="wb-book__actions">
                    <button class="btn btn-secondary btn-sm" data-editbook="${b.id}" title="Editar livro">⚙️</button>
                    <button class="btn btn-secondary btn-sm" data-dupbook="${b.id}" title="Duplicar o livro e os capítulos dele">⧉</button>
                    <button class="btn btn-secondary btn-sm" data-addchap="${b.id}" title="Novo capítulo">＋ cap.</button>
                </div>
            </summary>
            <div class="wb-book__chapters">${capsHtml}</div>
        </details>`;
    }

    function articleRow(a, num) {
        const palavras = palavrasDe(a);
        return `
        <div class="wb-chapter" data-openart="${a.id}">
            <span class="wb-chapter__num">${num ? num : '—'}</span>
            <div class="wb-chapter__body">
                <div class="wb-chapter__title">${esc(a.title || 'Sem título')}</div>
                ${a.synopsis ? `<div class="wb-chapter__syn">${esc(a.synopsis)}</div>` : ''}
                <div class="wb-chapter__meta">${statusBadge(a.status)} ${pubBadge(a.public)} <span class="wbt-muted">${palavras} palavras · ${fmtDate(a.updatedAt)}</span></div>
            </div>
            <button class="btn btn-secondary btn-sm" data-dupart="${a.id}" title="Duplicar este texto">⧉</button>
            <button class="btn btn-secondary btn-sm" data-delart="${a.id}" title="Excluir">🗑️</button>
        </div>`;
    }

    /* ── Duplicar ──────────────────────────────────────────────
       A cópia nasce SEMPRE despublicada. Duplicar é para rascunhar em
       cima de algo pronto; herdar 🌐 do original colocaria no ar um texto
       que ninguém escreveu ainda. */
    const nomeCopia = (t) => `${t || 'Sem título'} (cópia)`;
    async function gravarArtigo(a) {
        const { id, ...data } = a;
        await setDoc(doc(db, 'worldbuilding-articles', id), data);
        artigos.push(a);
    }
    async function duplicarArtigo(orig, bookId = orig.bookId) {
        const copia = {
            ...orig, id: uid('art'), title: nomeCopia(orig.title),
            bookId, order: chaptersOf(bookId).length,
            status: 'rascunho', public: false,
            createdAt: now(), updatedAt: now(), updatedBy: WB().user?.email || '',
        };
        await gravarArtigo(copia);
        return copia;
    }
    async function duplicarLivro(orig) {
        const caps = chaptersOf(orig.id);
        if (!await confirmar(`Duplicar "${orig.title}"?${caps.length ? `\nOs ${caps.length} capítulos vêm junto.` : ''}\nA cópia nasce como rascunho, sem publicação nenhuma.`)) return;
        const novo = {
            ...orig, id: uid('book'), title: nomeCopia(orig.title),
            order: books.length, versao: '', public: false,
            pub: Object.fromEntries(PUBLICACOES.map(([k]) => [k, false])),
            createdAt: now(), updatedAt: now(), updatedBy: WB().user?.email || '',
        };
        const { id, ...data } = novo;
        await setDoc(doc(db, 'worldbuilding-books', id), data);
        books.push(novo);
        for (const a of caps) await duplicarArtigo(a, novo.id);
        renderLibrary();
    }

    function bindLibrary() {
        $('#newBook').onclick = () => openBookModal(null);
        $('#newLoose').onclick = () => openArticle(null, null);
        $('#newEstante').onclick = () => openEstanteModal(null);
        contentBody().querySelectorAll('[data-editestante]').forEach(b =>
            b.onclick = () => openEstanteModal(estantes.find(x => x.id === b.dataset.editestante)));
        // preventDefault: dentro do <summary>, qualquer clique abre/fecha o livro.
        contentBody().querySelectorAll('[data-editbook]').forEach(b =>
            b.onclick = (e) => { e.preventDefault(); e.stopPropagation(); openBookModal(books.find(x => x.id === b.dataset.editbook)); });
        contentBody().querySelectorAll('[data-addchap]').forEach(b =>
            b.onclick = (e) => { e.preventDefault(); e.stopPropagation(); openArticle(null, b.dataset.addchap); });
        contentBody().querySelectorAll('[data-dupbook]').forEach(b =>
            b.onclick = (e) => { e.preventDefault(); e.stopPropagation(); duplicarLivro(books.find(x => x.id === b.dataset.dupbook)); });
        contentBody().querySelectorAll('[data-openart]').forEach(el =>
            el.onclick = (e) => {
                if (e.target.closest('[data-delart]') || e.target.closest('[data-dupart]')) return;
                openArticle(artigos.find(x => x.id === el.dataset.openart), null);
            });
        contentBody().querySelectorAll('[data-dupart]').forEach(b =>
            b.onclick = async (e) => {
                e.stopPropagation();
                await duplicarArtigo(artigos.find(x => x.id === b.dataset.dupart));
                renderLibrary();
            });
        contentBody().querySelectorAll('[data-delart]').forEach(b =>
            b.onclick = async (e) => {
                e.stopPropagation();
                if (!await confirmar('Excluir este texto? Esta ação não pode ser desfeita.', { perigo: true })) return;
                await deleteDoc(doc(db, 'worldbuilding-articles', b.dataset.delart));
                artigos = artigos.filter(x => x.id !== b.dataset.delart);
                renderLibrary();
            });

        /* Busca: re-renderiza a cada tecla e devolve o cursor onde estava —
           sem isso, digitar a segunda letra já é em outro campo. */
        const cx = $('#libBusca');
        cx.oninput = () => {
            const pos = cx.selectionStart;
            busca = cx.value.trim().toLowerCase();
            renderLibrary();
            const novo = $('#libBusca');
            novo.focus(); novo.setSelectionRange(pos, pos);
        };
        $('#libStatus').onclick = (e) => {
            const c = e.target.closest('[data-fst]'); if (!c) return;
            fstatus = c.dataset.fst === fstatus ? '' : c.dataset.fst;   // reclicar desliga
            renderLibrary();
        };
        const limpar = $('#libLimpar');
        if (limpar) limpar.onclick = () => { busca = ''; fstatus = ''; renderLibrary(); };

        /* Estante aberta/fechada sobrevive à próxima visita. Com filtro
           ligado tudo nasce aberto, e aí a marcação não vale como escolha. */
        contentBody().querySelectorAll('.wb-estante__det').forEach(d =>
            d.ontoggle = () => {
                if (filtrando()) return;
                const id = d.closest('[data-estante]').dataset.estante;
                d.open ? abertas.add(id) : abertas.delete(id);
                guardar(CHAVE_ABERTAS, [...abertas]);
            });
    }

    /* ══════════════ LIVRO (modal) ══════════════
       Três abas em vez de um rolo só: o formulário inteiro cabia em ~14
       blocos empilhados e o autor rolava para achar as publicações. As abas
       reusam o .wbt-chip que o painel de consulta já usa. */
    const STATUS_OPCOES = [['rascunho', '✏️ Rascunho'], ['revisao', '🔍 Em revisão'], ['publicado', '✅ Publicado']];
    const statusOptions = (sel) => STATUS_OPCOES
        .map(([v, l]) => `<option value="${v}" ${(sel || 'rascunho') === v ? 'selected' : ''}>${l}</option>`).join('');

    /* Uma linha da aba 📑 Capítulos. A ordem do sumário é a ordem das linhas
       no DOM — reordenar é mover o nó, não redesenhar a lista, senão cada
       arraste apagaria o status e o 🌐 que o autor acabou de mexer. */
    function linhaCapHTML(a, i) {
        return `
        <div class="wb-capedit__row" data-caprow="${a.id}" draggable="true">
            <span class="wb-capedit__pega" title="Arraste para reordenar">⠿</span>
            <input type="checkbox" class="wb-capedit__sel" data-capsel="${a.id}" aria-label="Selecionar ${esc(a.title || 'capítulo')}">
            <span class="wb-chapter__num">${i + 1}</span>
            <span class="wb-capedit__nome" title="${esc(a.title || 'Sem título')}">${esc(a.title || 'Sem título')}</span>
            <span class="wb-capedit__mudou" hidden></span>
            <span class="wb-capedit__setas">
                <button type="button" class="wbt-microbtn" data-capsobe aria-label="Subir capítulo">↑</button>
                <button type="button" class="wbt-microbtn" data-capdesce aria-label="Descer capítulo">↓</button>
            </span>
            <select class="form-select wb-capedit__st" data-capst="${a.id}">${statusOptions(a.status)}</select>
            <label class="wb-capedit__pub" title="Capítulo visível para quem já enxerga o livro">
                <input type="checkbox" data-cappub="${a.id}" ${a.public ? 'checked' : ''}> 🌐</label>
        </div>`;
    }

    function openBookModal(book = null) {
        const b = book || { id: uid('book'), title: '', description: '', cover: '', public: false, order: books.length };
        const pub = pubDoLivro(book);   // livro novo nasce sem publicação nenhuma
        if (!book) Object.keys(pub).forEach(k => pub[k] = false);
        const caps = book ? chaptersOf(b.id) : [];
        ToolModal.open(`
            <h2>${book ? '⚙️ Editar livro' : '📗 Novo livro'}</h2>
            <div class="wbt-chips wb-bktabs" id="bkTabs">
                <button type="button" class="wbt-chip is-active" data-bktab="geral">📖 Livro</button>
                <button type="button" class="wbt-chip" data-bktab="pub">🌐 Publicação</button>
                ${caps.length ? `<button type="button" class="wbt-chip" data-bktab="caps">📑 Capítulos <b>${caps.length}</b></button>` : ''}
            </div>
            <div class="wbt-form wb-bkform">
                <section data-bkpanel="geral">
                    <div class="wbt-row2">
                        <label>Título do livro <input id="bkTitle" class="form-input" value="${esc(b.title)}" placeholder="Ex: Crônicas de Eldoria — Vol. I"></label>
                        <label>Versão <input id="bkVersao" class="form-input" value="${esc(b.versao || '')}" placeholder="Ex: 2.1"></label>
                    </div>
                    <p class="wbt-muted wb-bkhint">A versão vira selo em toda tela que lista o livro, antes de abrir. Texto livre — vazio = sem selo.</p>
                    <label>Sinopse / descrição <textarea id="bkDesc" class="form-textarea" rows="3" placeholder="Do que trata este livro?">${esc(b.description || '')}</textarea></label>
                    <label>Capa do livro ${CampoImagem.html({ id: 'bkCover', classe: 'form-input', valor: b.cover || '', pasta: 'worldbuilding-images/capas' })}</label>
                    <div class="wb-bkgroup">
                        <span class="wb-bkgroup__tit">🗂️ Estantes</span>
                        ${estantes.length
                            ? `<div class="wb-bkchips">${estantes.map(e => `
                                <label class="wb-bkchip"><input type="checkbox" data-bkest="${esc(e.id)}" ${estantesDoLivro(b).includes(e.id) ? 'checked' : ''}>
                                    ${esc(e.icone || '🗂️')} ${esc(e.nome || '')}</label>`).join('')}</div>
                               <p class="wbt-muted wb-bkhint">Marque quantas quiser. Sem nenhuma, o livro fica só em “Todos os livros”.</p>`
                            : '<p class="wbt-muted wb-bkhint">Nenhuma estante criada ainda — crie uma pelo botão 🗂️ da Biblioteca.</p>'}
                    </div>
                </section>

                <section data-bkpanel="pub" hidden>
                    <div class="wb-pubgrid">
                        ${PUBLICACOES.map(([k, label, dica]) => `
                            <label class="wb-pubopt"><input type="checkbox" data-bkpub="${k}" ${pub[k] ? 'checked' : ''}>
                                <span><b>${label}</b><small>${esc(dica)}</small></span></label>`).join('')}
                    </div>
                    <p class="wbt-muted wb-bkhint">Isto vale para o LIVRO inteiro. Capítulo a capítulo, quem libera é a aba 📑 Capítulos — e quem tranca por requisito é a aba Conhecimento do Painel do Criador.</p>
                </section>

                ${caps.length ? `
                <section data-bkpanel="caps" hidden>
                    <div class="wb-capbulk">
                        <label class="wbt-check"><input type="checkbox" id="capAll"> Todos</label>
                        <span class="wbt-muted" id="capSelN">nenhum selecionado</span>
                        <span style="flex:1"></span>
                        <select id="capBulkSt" class="form-select" disabled>
                            <option value="">Status…</option>
                            ${STATUS_OPCOES.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
                        </select>
                        <button type="button" class="btn btn-secondary btn-sm" data-bulkpub="1" disabled>🌐 Público</button>
                        <button type="button" class="btn btn-secondary btn-sm" data-bulkpub="0" disabled>🔒 Privado</button>
                        <select id="capBulkLivro" class="form-select" disabled title="Mover os capítulos marcados para outro livro">
                            <option value="">Mover para…</option>
                            <option value="${b.id}">↩ Continuar aqui</option>
                            ${books.filter(x => x.id !== b.id).map(x => `<option value="${x.id}">📗 ${esc(x.title || 'Sem título')}</option>`).join('')}
                            <option value="__avulso">📄 Textos avulsos</option>
                        </select>
                    </div>
                    <div class="wb-capedit">
                        ${caps.map((a, i) => linhaCapHTML(a, i)).join('')}
                    </div>
                    <p class="wbt-muted wb-bkhint" id="capAviso" hidden></p>
                    <p class="wbt-muted wb-bkhint">Arraste pelo ⠿ (ou use ↑↓) para mudar a ordem do sumário. 🌐 é o que libera o capítulo na ficha e no Tabuleiro; o status ✅ Publicado é o que solta o capítulo no Cronista público.</p>
                </section>` : ''}
            </div>
            <div class="wbt-actions">
                ${book ? '<button class="btn btn-danger" id="bkDel">🗑️ Excluir livro</button>' : ''}
                <button class="btn btn-secondary" data-close>Cancelar</button>
                <button class="btn btn-success" id="bkSave">💾 Salvar livro</button>
            </div>`);

        /* Abas */
        $('#bkTabs').onclick = (e) => {
            const t = e.target.closest('[data-bktab]'); if (!t) return;
            $('#bkTabs').querySelectorAll('.wbt-chip').forEach(c => c.classList.toggle('is-active', c === t));
            document.querySelectorAll('.wb-bkform > section')
                .forEach(s => s.hidden = s.dataset.bkpanel !== t.dataset.bktab);
        };

        /* Ações em massa dos capítulos — valem só para o que está marcado. */
        if (caps.length) {
            const selecionados = () => [...document.querySelectorAll('[data-capsel]:checked')].map(c => c.dataset.capsel);
            const refresh = () => {
                const n = selecionados().length;
                $('#capSelN').textContent = n ? `${n} selecionado${n > 1 ? 's' : ''}` : 'nenhum selecionado';
                document.querySelectorAll('#capBulkSt, [data-bulkpub]').forEach(el => el.disabled = !n);
                $('#capAll').checked = n === caps.length;
                $('#capAll').indeterminate = n > 0 && n < caps.length;
            };
            $('#capAll').onchange = (e) => {
                document.querySelectorAll('[data-capsel]').forEach(c => c.checked = e.target.checked);
                refresh();
            };
            document.querySelector('.wb-capedit').addEventListener('change', (e) => {
                if (e.target.matches('[data-capsel]')) refresh();
            });
            $('#capBulkSt').onchange = (e) => {
                const v = e.target.value; if (!v) return;
                selecionados().forEach(id => { document.querySelector(`[data-capst="${id}"]`).value = v; });
                e.target.value = '';
            };
            document.querySelectorAll('[data-bulkpub]').forEach(btn => btn.onclick = () => {
                const on = btn.dataset.bulkpub === '1';
                selecionados().forEach(id => { document.querySelector(`[data-cappub="${id}"]`).checked = on; });
                aviso();
            });

            /* ── Mover para outro livro ────────────────────────────
               Marca a linha e só efetiva no Salvar. Sumir com a linha na
               hora tiraria do autor a chance de desistir — e ele ainda pode
               estar mexendo no status dela. */
            const lista = document.querySelector('.wb-capedit');
            const linha = (id) => document.querySelector(`[data-caprow="${id}"]`);
            $('#capBulkLivro').onchange = (e) => {
                const destino = e.target.value; if (!destino) return;
                selecionados().forEach(id => {
                    const r = linha(id), tag = r.querySelector('.wb-capedit__mudou');
                    const fica = destino === b.id;
                    r.dataset.capmove = fica ? '' : destino;
                    tag.hidden = fica;
                    tag.textContent = fica ? '' : '→ ' + (destino === '__avulso'
                        ? '📄 avulsos' : '📗 ' + (books.find(x => x.id === destino)?.title || ''));
                });
                e.target.value = '';
            };

            /* ── Ordem do sumário ──────────────────────────────────
               Arrastar (nativo, sem biblioteca) e ↑↓. As setas não são
               enfeite de acessibilidade: drag-and-drop HTML5 não existe no
               celular, e metade da mesa edita do celular. */
            const renumerar = () => [...lista.children].forEach((r, i) => {
                r.querySelector('.wb-chapter__num').textContent = i + 1;
                r.querySelector('[data-capsobe]').disabled = i === 0;
                r.querySelector('[data-capdesce]').disabled = i === lista.children.length - 1;
            });
            lista.addEventListener('click', (e) => {
                const btn = e.target.closest('[data-capsobe], [data-capdesce]'); if (!btn) return;
                const r = btn.closest('[data-caprow]');
                const vizinho = btn.hasAttribute('data-capsobe') ? r.previousElementSibling : r.nextElementSibling;
                if (!vizinho) return;
                btn.hasAttribute('data-capsobe') ? vizinho.before(r) : vizinho.after(r);
                renumerar(); btn.focus();
            });
            let arrastando = null;
            lista.addEventListener('dragstart', (e) => {
                arrastando = e.target.closest('[data-caprow]');
                arrastando.classList.add('is-arrastando');
                e.dataTransfer.effectAllowed = 'move';
            });
            lista.addEventListener('dragend', () => {
                arrastando?.classList.remove('is-arrastando'); arrastando = null; renumerar();
            });
            lista.addEventListener('dragover', (e) => {
                e.preventDefault();
                const alvo = e.target.closest('[data-caprow]');
                if (!alvo || !arrastando || alvo === arrastando) return;
                // Metade de cima do alvo = entra antes dele; metade de baixo = depois.
                const meio = alvo.getBoundingClientRect().top + alvo.offsetHeight / 2;
                e.clientY < meio ? alvo.before(arrastando) : alvo.after(arrastando);
            });
            renumerar();

            /* ── Aviso de publicação órfã ──────────────────────────
               Capítulo com 🌐 dentro de livro que ninguém publicou é
               invisível, e nada na tela dizia isso. */
            const aviso = () => {
                const semPub = ![...document.querySelectorAll('[data-bkpub]')].some(c => c.checked);
                const abertos = document.querySelectorAll('[data-cappub]:checked').length;
                const el = $('#capAviso');
                el.hidden = !(semPub && abertos);
                el.innerHTML = el.hidden ? '' :
                    `⚠️ <b>${abertos} capítulo${abertos > 1 ? 's' : ''} com 🌐, mas o livro não está publicado em lugar nenhum.</b>
                     Ninguém vai enxergar — marque uma publicação na aba 🌐 Publicação.`;
                document.querySelector('[data-bktab="caps"]').classList.toggle('is-alerta', !el.hidden);
            };
            document.querySelector('[data-bkpanel="pub"]').addEventListener('change', aviso);
            lista.addEventListener('change', (e) => { if (e.target.matches('[data-cappub]')) aviso(); });
            aviso();
        }

        $('#bkSave').onclick = async () => {
            b.title = $('#bkTitle').value.trim() || 'Livro sem título';
            b.versao = $('#bkVersao').value.trim();
            b.estanteIds = [...document.querySelectorAll('[data-bkest]:checked')].map(c => c.dataset.bkest);
            b.estanteId = null;   // legado, ver estantesDoLivro()
            b.description = $('#bkDesc').value.trim();
            b.cover = $('#bkCover').value.trim();
            b.pub = Object.fromEntries(PUBLICACOES.map(([k]) => [k, document.querySelector(`[data-bkpub="${k}"]`).checked]));
            // `public` continua gravado só para o legado: uma vez que `pub` existe no
            // doc, é ele que manda em toda leitura (shared/livros-pub.js).
            b.public = !!(b.pub.geral || b.pub.conhGeral || b.pub.conhVinculo);
            b.updatedAt = now();
            b.updatedBy = WB().user?.email || '';
            if (!b.createdAt) b.createdAt = now();
            const { id, ...data } = b;
            await setDoc(doc(db, 'worldbuilding-books', id), data);
            if (!books.find(x => x.id === b.id)) books.push(b);
            else books = books.map(x => x.id === b.id ? b : x);
            /* Capítulos: status, 🌐, ordem do sumário (= ordem das linhas) e
               destino. Só grava o que realmente mudou — o livro cheio são
               dezenas de docs e o autor costuma mexer em dois. */
            const linhas = [...document.querySelectorAll('.wb-capedit [data-caprow]')];
            const ficam = linhas.filter(r => !r.dataset.capmove);
            const fimDe = {};   // capítulo que sai entra no FIM do livro de destino
            for (const r of linhas) {
                const a = caps.find(x => x.id === r.dataset.caprow);
                const destino = r.dataset.capmove || '';
                const bookId = destino === '__avulso' ? null : (destino || b.id);
                if (destino && fimDe[destino] === undefined) fimDe[destino] = bookId ? chaptersOf(bookId).length : 0;
                const ordem = destino ? fimDe[destino]++ : ficam.indexOf(r);
                const st = r.querySelector('[data-capst]').value;
                const pb = r.querySelector('[data-cappub]').checked;
                if (st === (a.status || 'rascunho') && pb === !!a.public
                    && bookId === (a.bookId ?? null) && ordem === (a.order ?? 0)) continue;
                Object.assign(a, { status: st, public: pb, bookId, order: ordem, updatedAt: now(), updatedBy: WB().user?.email || '' });
                await setDoc(doc(db, 'worldbuilding-articles', a.id),
                    { status: st, public: pb, bookId, order: ordem, updatedAt: a.updatedAt, updatedBy: a.updatedBy }, { merge: true });
            }
            ToolModal.close(); renderLibrary();
        };
        const del = $('#bkDel');
        if (del) del.onclick = async () => {
            const caps = chaptersOf(b.id);
            if (!await confirmar(`Excluir o livro "${b.title}"?${caps.length ? `\nOs ${caps.length} capítulos NÃO serão apagados — voltarão para "Textos avulsos".` : ''}`, { perigo: true })) return;
            // Desvincula capítulos (viram avulsos) antes de excluir o livro.
            for (const a of caps) {
                a.bookId = null;
                const { id, ...data } = a;
                await setDoc(doc(db, 'worldbuilding-articles', id), data, { merge: true });
            }
            await deleteDoc(doc(db, 'worldbuilding-books', b.id));
            books = books.filter(x => x.id !== b.id);
            ToolModal.close(); renderLibrary();
        };
    }

    /* ══════════════ EDITOR (escrita) ══════════════ */
    function bookOptions(sel) {
        return `<option value="">— texto avulso —</option>` +
            books.map(b => `<option value="${b.id}" ${b.id === sel ? 'selected' : ''}>📗 ${esc(b.title || 'Sem título')}${versaoDoLivro(b) ? ' · ' + esc(versaoDoLivro(b)) : ''}</option>`).join('');
    }

    function openArticle(article, bookId) {
        atual = article || {
            id: uid('art'), title: '', synopsis: '', contentHTML: '',
            bookId: bookId || null, order: bookId ? chaptersOf(bookId).length : 0,
            public: false, status: 'rascunho', mentions: [], createdAt: now(),
        };
        renderEditor();
    }

    /* Capítulo anterior/seguinte, pelo sumário do livro. Texto avulso não
       tem ordem de leitura, então não ganha a navegação. */
    function navCapsHTML() {
        if (!atual.bookId) return '';
        const irmaos = chaptersOf(atual.bookId);
        const i = irmaos.findIndex(x => x.id === atual.id);
        const ant = i > 0 ? irmaos[i - 1] : null;
        const prox = i > -1 && i < irmaos.length - 1 ? irmaos[i + 1] : null;
        if (!ant && !prox) return '';
        const botao = (cap, dir, cls) => cap
            ? `<button type="button" class="wb-capnav__btn ${cls}" data-gocap="${cap.id}">
                   <span class="wb-capnav__dir">${dir}</span>
                   <span class="wb-capnav__nome">${esc(cap.title || 'Sem título')}</span>
               </button>`
            : '<span class="wb-capnav__vazio"></span>';
        return `<nav class="wb-capnav">
            ${botao(ant, '← Capítulo anterior', '')}
            ${botao(prox, 'Próximo capítulo →', 'wb-capnav__btn--next')}
        </nav>`;
    }

    function renderEditor() {
        view = 'editor';
        const a = atual;
        const lendo = modo === 'leitura';
        setTitle('✒️ Escritório do Cronista');
        contentBody().innerHTML = `
        <div class="wbt-editor-layout${lendo ? ' is-reading' : ''}" id="editorLayout">
            <div class="wbt-editor-main" id="editorMain">
                <div class="wbt-toolbar wbt-etoolbar">
                    <button class="btn btn-secondary btn-sm" id="backLib">← Biblioteca</button>
                    <span style="flex:1"></span>
                    <button class="btn btn-secondary btn-sm" id="toggleModo"
                            title="${lendo ? 'Voltar a editar o texto' : 'Ler sem as ferramentas de edição'}">${lendo ? '✒️ Modo escrita' : '📖 Modo leitura'}</button>
                    <button class="btn btn-secondary btn-sm" id="toggleRefs" title="Painel de consulta">Consulta ⇄</button>
                    <button class="btn btn-secondary btn-sm" id="focusMode" title="Modo foco">Foco ⛶</button>
                    <button class="btn btn-success btn-sm" id="saveArticle">💾 Salvar</button>
                </div>
                ${navCapsHTML()}
                <input id="articleTitle" class="wbt-article-title" placeholder="Título do conto, capítulo ou cena…" value="${esc(a.title || '')}" ${lendo ? 'readonly' : ''}>
                <input id="articleSyn" class="wb-article-syn" placeholder="Sinopse curta (opcional)…" value="${esc(a.synopsis || '')}" ${lendo ? 'readonly' : ''}>

                <div class="wb-editor-props">
                    <label>📗 Livro
                        <select id="artBook" class="form-select">${bookOptions(a.bookId)}</select>
                    </label>
                    <label>🔢 Ordem
                        <input id="artOrder" type="number" class="form-input" value="${a.order ?? 0}" min="0" style="width:80px">
                    </label>
                    <label>📊 Status
                        <select id="artStatus" class="form-select">
                            <option value="rascunho" ${a.status === 'rascunho' ? 'selected' : ''}>✏️ Rascunho</option>
                            <option value="revisao" ${a.status === 'revisao' ? 'selected' : ''}>🔍 Em revisão</option>
                            <option value="publicado" ${a.status === 'publicado' ? 'selected' : ''}>✅ Publicado</option>
                        </select>
                    </label>
                    <label class="wbt-check"><input type="checkbox" id="artPublic" ${a.public ? 'checked' : ''}> 🌐 Público</label>
                </div>

                <!-- Colada no texto e grudada no topo quando a página rola. -->
                <div class="wbt-toolbar wb-richbar" id="richToolbar">${TOOLBAR_HTML}</div>

                <div id="richEditor" class="wbt-rich texto-mundo" contenteditable="${lendo ? 'false' : 'true'}"
                     data-placeholder="Escreva aqui. Digite @ para vincular NPCs, Tribos, Locais ou eventos…">${a.contentHTML || ''}</div>
                <p class="wbt-muted" id="editorStatus"></p>
                ${navCapsHTML()}
                <div id="mentionBox" class="wbt-mentionbox" hidden></div>
            </div>
            <aside class="wbt-refs" id="refsPanel">
                <input id="refsSearch" class="form-input" placeholder="Buscar no ecossistema…">
                <div class="wbt-chips" id="refsTabs">
                    <button class="wbt-chip is-active" data-rt="all">Tudo</button>
                    <button class="wbt-chip" data-rt="npcs">👥 NPCs</button>
                    <button class="wbt-chip" data-rt="factions">⚔️ Tribos</button>
                    <button class="wbt-chip" data-rt="geography">📍 Locais</button>
                    <button class="wbt-chip" data-rt="history">📜 História</button>
                    <button class="wbt-chip" data-rt="races">🧬 Raças</button>
                    <button class="wbt-chip" data-rt="classes">⚔️ Classes</button>
                </div>
                <div id="refsList" class="wbt-refs__list"></div>
            </aside>
        </div>`;
        renderRefs(); bindEditor();
    }

    /* ── Painel de consulta lateral ─────────────────────── */
    function renderRefs() {
        const q = ($('#refsSearch')?.value || '').trim().toLowerCase();
        const kinds = refType === 'all' ? Object.keys(KIND) : [refType];
        const list = searchables(kinds).filter(x =>
            !q || x.nome.toLowerCase().includes(q) || x.descricao.toLowerCase().includes(q));
        $('#refsList').innerHTML = list.length ? list.map(x => {
            const k = KIND[x.cat];
            return `<div class="wbt-refcard" data-ref="${x.id}" data-refcat="${x.cat}">
                <div class="wbt-refcard__name">${k.icon} ${esc(x.nome)} <span class="wbt-tag">${k.label}</span></div>
                <p class="wbt-refcard__sum">${esc((x.descricao || 'Sem descrição.').slice(0, 200))}</p>
                <div class="wbt-refcard__acoes">
                    <button type="button" class="wbt-microbtn" data-detalhes
                            aria-expanded="false">Detalhes ▾</button>
                </div>
                <div class="wbt-refcard__full" hidden></div>
            </div>`;
        }).join('') : `<p class="wbt-muted">Nada encontrado no ecossistema.</p>`;
    }

    /* Dossiê completo, montado só quando pedido (a lista tem centenas de
       fichas — renderizar todas de véspera travava o painel). */
    function toggleDossie(card) {
        const btn = card.querySelector('[data-detalhes]');
        const box = card.querySelector('.wbt-refcard__full');
        const abrir = box.hidden;
        if (abrir && !box.dataset.pronto) {
            const cat = card.dataset.refcat;
            // `doc` aqui sombrearia o doc() do Firestore importado no topo.
            const entidade = poolOf(cat).find(x => x.id === card.dataset.ref);
            box.innerHTML = dossieHTML(entidade, KIND[cat]);
            box.dataset.pronto = '1';
        }
        box.hidden = !abrir;
        card.classList.toggle('is-detailed', abrir);
        btn.setAttribute('aria-expanded', String(abrir));
        btn.textContent = abrir ? 'Detalhes ▴' : 'Detalhes ▾';
    }

    /* ── @Mentions ──────────────────────────────────────── */
    function detect() {
        const sel = window.getSelection();
        if (!sel.rangeCount || !$('#richEditor').contains(sel.anchorNode)) return hide();
        const node = sel.anchorNode;
        if (node.nodeType !== Node.TEXT_NODE) return hide();
        const upTo = node.textContent.slice(0, sel.anchorOffset);
        const m = upTo.match(/@([\p{L}\p{N} ]{0,30})$/u);
        if (!m) return hide();
        mentionRange = document.createRange();
        mentionRange.setStart(node, sel.anchorOffset - m[0].length);
        mentionRange.setEnd(node, sel.anchorOffset);
        show(m[1].trim().toLowerCase());
    }
    function show(query) {
        const box = $('#mentionBox');
        const items = searchables().filter(x => !query || x.nome.toLowerCase().includes(query)).slice(0, 8);
        if (!items.length) return hide();
        mentionIdx = 0;
        box.innerHTML = items.map((x, i) => {
            const k = KIND[x.cat];
            return `<button data-mid="${x.id}" data-mcat="${x.cat}" class="${i === 0 ? 'is-hover' : ''}"><span class="wbt-tag">${k.icon}</span> ${esc(x.nome)}</button>`;
        }).join('');
        box.hidden = false;
        const rect = mentionRange.getBoundingClientRect();
        const host = $('#editorMain').getBoundingClientRect();
        box.style.left = `${rect.left - host.left}px`;
        box.style.top = `${rect.bottom - host.top + 6}px`;
    }
    function hide() { const b = $('#mentionBox'); if (b) b.hidden = true; mentionRange = null; }
    function insert(id, cat) {
        const item = searchables().find(x => x.id === id && x.cat === cat);
        if (!item || !mentionRange) return;
        const a = document.createElement('a');
        a.className = 'wbt-mention'; a.dataset.entity = id; a.dataset.cat = cat;
        a.textContent = item.nome; a.contentEditable = 'false';
        mentionRange.deleteContents(); mentionRange.insertNode(a);
        const space = document.createTextNode('\u00A0'); a.after(space);
        const sel = window.getSelection(), r = document.createRange();
        r.setStartAfter(space); r.collapse(true);
        sel.removeAllRanges(); sel.addRange(r);
        hide(); autosaveHint();
    }
    function keyNav(e) {
        const box = $('#mentionBox'); if (box.hidden) return;
        const btns = [...box.querySelectorAll('button')];
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            mentionIdx = (mentionIdx + (e.key === 'ArrowDown' ? 1 : -1) + btns.length) % btns.length;
            btns.forEach((b, i) => b.classList.toggle('is-hover', i === mentionIdx));
        } else if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            const b = btns[mentionIdx]; if (b) insert(b.dataset.mid, b.dataset.mcat);
        } else if (e.key === 'Escape') hide();
    }

    /* ── Salvar ─────────────────────────────────────────── */
    async function save() {
        const ed = $('#richEditor');
        if (!ed) return;   // saiu do editor antes do autosave disparar
        const mentions = [...ed.querySelectorAll('a.wbt-mention')].map(a => ({ id: a.dataset.entity, cat: a.dataset.cat }));
        const a = atual;
        a.title = $('#articleTitle').value.trim() || 'Sem título';
        a.synopsis = $('#articleSyn').value.trim();
        // Grava já higienizado: é este HTML que a ficha do jogador e o
        // Laboratorium vão renderizar, então a faxina vale na gravação.
        a.contentHTML = rich ? rich.limpar() : ed.innerHTML;
        a.bookId = $('#artBook').value || null;
        a.order = parseInt($('#artOrder').value || '0') || 0;
        a.status = $('#artStatus').value || 'rascunho';
        a.public = $('#artPublic').checked;
        a.mentions = mentions;
        a.words = wordCount(a.contentHTML);
        a.updatedAt = now();
        a.updatedBy = WB().user?.email || '';
        if (!a.createdAt) a.createdAt = now();
        const { id, ...data } = a;
        await setDoc(doc(db, 'worldbuilding-articles', id), data);
        if (!artigos.find(x => x.id === a.id)) artigos.push(a);
        else artigos = artigos.map(x => x.id === a.id ? a : x);
        sujo = false;
        $('#editorStatus').textContent = `✓ Salvo às ${new Date().toLocaleTimeString('pt-BR')}`;
    }
    function autosaveHint() {
        clearTimeout(saveTimer);
        sujo = true;
        const st = $('#editorStatus'); if (st) st.textContent = 'Alterações não salvas…';
        saveTimer = setTimeout(() => { if (view === 'editor') save(); }, 4000);
    }

    /* O autosave é de 4s. Fechar a aba dentro dessa janela levava o
       parágrafo junto, calado — o navegador é quem sabe perguntar. */
    window.addEventListener('beforeunload', (e) => {
        if (view === 'editor' && sujo) { e.preventDefault(); e.returnValue = ''; }
    });
    /* Ctrl+S. Registrado uma vez no documento (renderEditor roda de novo a
       cada capítulo, e listener por render vira pilha de listeners). */
    document.addEventListener('keydown', (e) => {
        if (!(e.key === 's' && (e.ctrlKey || e.metaKey)) || view !== 'editor') return;
        e.preventDefault();
        clearTimeout(saveTimer); save();
    });

    function bindEditor() {
        $('#backLib').onclick = async () => { clearTimeout(saveTimer); await save(); renderLibrary(); };
        rich = bindRich($('#richEditor'), $('#richToolbar'), autosaveHint);
        $('#saveArticle').onclick = save;
        // Salva antes de trocar de modo/capítulo: o texto vivo mora no DOM.
        $('#toggleModo').onclick = async () => {
            clearTimeout(saveTimer); await save();
            modo = modo === 'escrita' ? 'leitura' : 'escrita';
            renderEditor();
        };
        contentBody().querySelectorAll('[data-gocap]').forEach(b =>
            b.onclick = async () => {
                clearTimeout(saveTimer); await save();
                openArticle(artigos.find(x => x.id === b.dataset.gocap), null);
                contentBody().scrollTop = 0; window.scrollTo(0, 0);
            });
        $('#toggleRefs').onclick = () => $('#editorLayout').classList.toggle('refs-closed');
        $('#focusMode').onclick = () => document.body.classList.toggle('wbt-focus');
        $('#refsSearch').oninput = renderRefs;
        ['articleTitle', 'articleSyn', 'artBook', 'artOrder', 'artStatus', 'artPublic'].forEach(id => {
            const el = document.getElementById(id); if (el) el.addEventListener('change', autosaveHint);
        });
        $('#refsTabs').onclick = (e) => {
            const b = e.target.closest('[data-rt]'); if (!b) return;
            refType = b.dataset.rt;
            document.querySelectorAll('#refsTabs .wbt-chip').forEach(c => c.classList.toggle('is-active', c === b));
            renderRefs();
        };
        $('#refsList').onclick = (e) => {
            const c = e.target.closest('[data-ref]'); if (!c) return;
            if (e.target.closest('[data-detalhes]')) { toggleDossie(c); return; }
            if (e.target.closest('.wbt-refcard__full')) return;   // clicar dentro do dossiê não fecha
            if (e.detail === 2) ToolModal.openEntry(c.dataset.refcat, c.dataset.ref);
            else c.classList.toggle('is-open');
        };
        const ed = $('#richEditor');
        ed.addEventListener('keyup', (e) => { if (!['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(e.key)) detect(); });
        ed.addEventListener('keydown', keyNav);
        ed.addEventListener('input', autosaveHint);
        ed.addEventListener('click', (e) => {
            const a = e.target.closest('a.wbt-mention'); if (!a) return;
            e.preventDefault(); ToolModal.openEntry(a.dataset.cat, a.dataset.entity);
        });
        $('#mentionBox').addEventListener('mousedown', (e) => {
            const b = e.target.closest('[data-mid]');
            if (b) { e.preventDefault(); insert(b.dataset.mid, b.dataset.mcat); }
        });
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#mentionBox') && !e.target.closest('#richEditor')) hide();
        });
    }

    return {
        async render() { await loadAll(); renderLibrary(); },
    };
})();
