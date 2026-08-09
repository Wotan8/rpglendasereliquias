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
   ═══════════════════════════════════════════════════════════ */

import { db, collection, getDocs, doc, setDoc, deleteDoc } from './firebase-config.js';
import { WB, esc, uid, ToolModal, setTitle, contentBody, searchables, KIND, poolOf } from './wb-utils.js';
import { dossieHTML } from './wb-dossie.js';
import { TOOLBAR_HTML, bindRich } from './wb-rich.js';
import { PUBLICACOES, pubDoLivro } from '../../shared/livros-pub.js';

export const Editor = (() => {
    let books = [], artigos = [], atual = null;
    let rich = null;   // mesa de diagramação (wb-rich.js) do editor aberto
    let mentionRange = null, mentionIdx = 0, saveTimer = null, refType = 'all';
    let view = 'library';   // 'library' | 'editor'

    const $ = (s) => document.querySelector(s);
    const now = () => Date.now();
    const wordCount = (html) => {
        const txt = (html || '').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ');
        const m = txt.trim().match(/\S+/g);
        return m ? m.length : 0;
    };
    const fmtDate = (ts) => ts ? new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

    async function loadAll() {
        try {
            const [bSnap, aSnap] = await Promise.all([
                getDocs(collection(db, 'worldbuilding-books')),
                getDocs(collection(db, 'worldbuilding-articles')),
            ]);
            books = bSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            artigos = aSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) { console.warn('[editor] load', e); books = books || []; artigos = artigos || []; }
    }

    /* Capítulos de um livro, na ordem definida. */
    const chaptersOf = (bookId) =>
        artigos.filter(a => a.bookId === bookId)
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.createdAt ?? 0) - (b.createdAt ?? 0));
    const loose = () => artigos.filter(a => !a.bookId)
        .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));

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

        const totalPalavras = artigos.reduce((s, a) => s + wordCount(a.contentHTML), 0);
        const bookCards = books
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
            .map(bookCard).join('');
        const looseCards = loose().map(a => articleRow(a)).join('');

        contentBody().innerHTML = `
        <div class="wb-library">
            <div class="wb-lib-toolbar">
                <div class="wb-lib-stats">
                    <span><b>${books.length}</b> livros</span>
                    <span><b>${artigos.length}</b> textos</span>
                    <span><b>${totalPalavras.toLocaleString('pt-BR')}</b> palavras</span>
                </div>
                <span style="flex:1"></span>
                <button class="btn btn-secondary btn-sm" id="newLoose">📄 Novo texto avulso</button>
                <button class="btn btn-success btn-sm" id="newBook">📗 Novo livro</button>
            </div>

            <h3 class="wb-lib-section">📚 Livros</h3>
            <div class="wb-shelf">
                ${bookCards || '<p class="wbt-muted">Nenhum livro ainda. Crie um livro para agrupar capítulos e contos.</p>'}
            </div>

            <h3 class="wb-lib-section">📄 Textos avulsos</h3>
            <div class="wb-loose-list">
                ${looseCards || '<p class="wbt-muted">Nenhum texto avulso. Bons textos avulsos podem virar capítulos depois.</p>'}
            </div>
        </div>`;

        bindLibrary();
    }

    function bookCard(b) {
        const caps = chaptersOf(b.id);
        const palavras = caps.reduce((s, a) => s + wordCount(a.contentHTML), 0);
        const capsHtml = caps.length
            ? caps.map((a, i) => articleRow(a, i + 1)).join('')
            : '<p class="wbt-muted" style="margin:.4rem .2rem">Sem capítulos ainda.</p>';
        return `
        <details class="wb-book" data-book="${b.id}">
            <summary class="wb-book__head">
                <span class="wb-book__caret">▸</span>
                <div class="wb-book__cover" style="${b.cover ? `background-image:url('${esc(b.cover)}')` : ''}"
                     ${b.cover ? `data-zoom="${esc(b.cover)}" data-zoom-alt="${esc(b.title || '')}" title="Ver a capa maior"` : ''}>${b.cover ? '' : '📖'}</div>
                <div class="wb-book__meta">
                    <div class="wb-book__title">${esc(b.title || 'Livro sem título')}</div>
                    <div class="wb-book__badges">${pubBadgesLivro(b)} <span class="wb-badge wb-badge--soft">${caps.length} cap.</span> <span class="wb-badge wb-badge--soft">${palavras.toLocaleString('pt-BR')} palavras</span></div>
                    ${b.description ? `<p class="wb-book__desc">${esc(b.description)}</p>` : ''}
                </div>
                <div class="wb-book__actions">
                    <button class="btn btn-secondary btn-sm" data-editbook="${b.id}" title="Editar livro">⚙️</button>
                    <button class="btn btn-secondary btn-sm" data-addchap="${b.id}" title="Novo capítulo">＋ cap.</button>
                </div>
            </summary>
            <div class="wb-book__chapters">${capsHtml}</div>
        </details>`;
    }

    function articleRow(a, num) {
        const palavras = wordCount(a.contentHTML);
        return `
        <div class="wb-chapter" data-openart="${a.id}">
            <span class="wb-chapter__num">${num ? num : '—'}</span>
            <div class="wb-chapter__body">
                <div class="wb-chapter__title">${esc(a.title || 'Sem título')}</div>
                ${a.synopsis ? `<div class="wb-chapter__syn">${esc(a.synopsis)}</div>` : ''}
                <div class="wb-chapter__meta">${statusBadge(a.status)} ${pubBadge(a.public)} <span class="wbt-muted">${palavras} palavras · ${fmtDate(a.updatedAt)}</span></div>
            </div>
            <button class="btn btn-secondary btn-sm" data-delart="${a.id}" title="Excluir">🗑️</button>
        </div>`;
    }

    function bindLibrary() {
        $('#newBook').onclick = () => openBookModal(null);
        $('#newLoose').onclick = () => openArticle(null, null);
        // preventDefault: dentro do <summary>, qualquer clique abre/fecha o livro.
        contentBody().querySelectorAll('[data-editbook]').forEach(b =>
            b.onclick = (e) => { e.preventDefault(); e.stopPropagation(); openBookModal(books.find(x => x.id === b.dataset.editbook)); });
        contentBody().querySelectorAll('[data-addchap]').forEach(b =>
            b.onclick = (e) => { e.preventDefault(); e.stopPropagation(); openArticle(null, b.dataset.addchap); });
        contentBody().querySelectorAll('[data-openart]').forEach(el =>
            el.onclick = (e) => { if (e.target.closest('[data-delart]')) return; openArticle(artigos.find(x => x.id === el.dataset.openart), null); });
        contentBody().querySelectorAll('[data-delart]').forEach(b =>
            b.onclick = async (e) => {
                e.stopPropagation();
                if (!confirm('Excluir este texto? Esta ação não pode ser desfeita.')) return;
                await deleteDoc(doc(db, 'worldbuilding-articles', b.dataset.delart));
                artigos = artigos.filter(x => x.id !== b.dataset.delart);
                renderLibrary();
            });
    }

    /* ══════════════ LIVRO (modal) ══════════════ */
    function openBookModal(book = null) {
        const b = book || { id: uid('book'), title: '', description: '', cover: '', public: false, order: books.length };
        const pub = pubDoLivro(book);   // livro novo nasce sem publicação nenhuma
        if (!book) Object.keys(pub).forEach(k => pub[k] = false);
        ToolModal.open(`
            <h2>${book ? '⚙️ Editar livro' : '📗 Novo livro'}</h2>
            <div class="wbt-form">
                <label>Título do livro <input id="bkTitle" class="form-input" value="${esc(b.title)}" placeholder="Ex: Crônicas de Eldoria — Vol. I"></label>
                <label>Sinopse / descrição <textarea id="bkDesc" class="form-textarea" placeholder="Do que trata este livro?">${esc(b.description || '')}</textarea></label>
                <label>Capa do livro ${CampoImagem.html({ id: 'bkCover', classe: 'form-input', valor: b.cover || '', pasta: 'worldbuilding-images/capas' })}</label>
                <div class="wbt-muted" style="margin:.6rem 0 .2rem;font-weight:700">📖 Publicações</div>
                ${PUBLICACOES.map(([k, label, dica]) => `
                    <label class="wbt-check"><input type="checkbox" id="bkPub_${k}" ${pub[k] ? 'checked' : ''}>
                        ${label} <span class="wbt-muted">— ${dica}</span></label>`).join('')}
                <div class="wbt-muted" style="font-size:.8rem;margin-top:.2rem">
                    Capítulo a capítulo, quem tranca é a aba Conhecimento do Painel do Criador.
                </div>
                <div class="wbt-actions">
                    ${book ? '<button class="btn btn-danger" id="bkDel">🗑️ Excluir livro</button>' : ''}
                    <button class="btn btn-success" id="bkSave">💾 Salvar livro</button>
                </div>
            </div>`);
        $('#bkSave').onclick = async () => {
            b.title = $('#bkTitle').value.trim() || 'Livro sem título';
            b.description = $('#bkDesc').value.trim();
            b.cover = $('#bkCover').value.trim();
            b.pub = Object.fromEntries(PUBLICACOES.map(([k]) => [k, $('#bkPub_' + k).checked]));
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
            ToolModal.close(); renderLibrary();
        };
        const del = $('#bkDel');
        if (del) del.onclick = async () => {
            const caps = chaptersOf(b.id);
            if (!confirm(`Excluir o livro "${b.title}"?${caps.length ? `\nOs ${caps.length} capítulos NÃO serão apagados — voltarão para "Textos avulsos".` : ''}`)) return;
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
            books.map(b => `<option value="${b.id}" ${b.id === sel ? 'selected' : ''}>📗 ${esc(b.title || 'Sem título')}</option>`).join('');
    }

    function openArticle(article, bookId) {
        atual = article || {
            id: uid('art'), title: '', synopsis: '', contentHTML: '',
            bookId: bookId || null, order: bookId ? chaptersOf(bookId).length : 0,
            public: false, status: 'rascunho', mentions: [], createdAt: now(),
        };
        renderEditor();
    }

    function renderEditor() {
        view = 'editor';
        const a = atual;
        setTitle('✒️ Escritório do Cronista');
        contentBody().innerHTML = `
        <div class="wbt-editor-layout" id="editorLayout">
            <div class="wbt-editor-main" id="editorMain">
                <div class="wbt-toolbar wbt-etoolbar">
                    <button class="btn btn-secondary btn-sm" id="backLib">← Biblioteca</button>
                    <span style="flex:1"></span>
                    <button class="btn btn-secondary btn-sm" id="toggleRefs" title="Painel de consulta">Consulta ⇄</button>
                    <button class="btn btn-secondary btn-sm" id="focusMode" title="Modo foco">Foco ⛶</button>
                    <button class="btn btn-success btn-sm" id="saveArticle">💾 Salvar</button>
                </div>
                <input id="articleTitle" class="wbt-article-title" placeholder="Título do conto, capítulo ou cena…" value="${esc(a.title || '')}">
                <input id="articleSyn" class="wb-article-syn" placeholder="Sinopse curta (opcional)…" value="${esc(a.synopsis || '')}">

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

                <div id="richEditor" class="wbt-rich texto-mundo" contenteditable="true"
                     data-placeholder="Escreva aqui. Digite @ para vincular NPCs, Tribos, Locais ou eventos…">${a.contentHTML || ''}</div>
                <p class="wbt-muted" id="editorStatus"></p>
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
        $('#editorStatus').textContent = `✓ Salvo às ${new Date().toLocaleTimeString('pt-BR')}`;
    }
    function autosaveHint() {
        clearTimeout(saveTimer);
        const st = $('#editorStatus'); if (st) st.textContent = 'Alterações não salvas…';
        saveTimer = setTimeout(() => { if (view === 'editor') save(); }, 4000);
    }

    function bindEditor() {
        $('#backLib').onclick = async () => { clearTimeout(saveTimer); await save(); renderLibrary(); };
        rich = bindRich($('#richEditor'), $('#richToolbar'), autosaveHint);
        $('#saveArticle').onclick = save;
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
