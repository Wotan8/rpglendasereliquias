/* ═══════════════════════════════════════════════════════════
   wb-editor.js — Escritório do Cronista
   ─────────────────────────────────────
   • Rich text (contenteditable) + toolbar
   • Split-screen: painel de consulta com as fichas REAIS
     (NPCs, Tribos, Locais, História) do ecossistema
   • @Mentions: "@" sugere qualquer entidade real; ao escolher,
     insere link que abre a ficha
   • Modo Foco
   • Textos salvos em worldbuilding-articles/{id}
   ═══════════════════════════════════════════════════════════ */

import { db, collection, getDocs, doc, setDoc, deleteDoc } from './firebase-config.js';
import { WB, esc, uid, ToolModal, setTitle, contentBody, searchables, KIND } from './wb-utils.js';

export const Editor = (() => {
    let artigos = [], atual = null, mentionRange = null, mentionIdx = 0, saveTimer = null, refType = 'all';

    async function loadArtigos() {
        try {
            const snap = await getDocs(collection(db, 'worldbuilding-articles'));
            artigos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch { artigos = []; }
    }

    const $ = (s) => document.querySelector(s);

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
                <p class="wbt-refcard__sum">${esc((x.descricao || 'Sem descrição.').slice(0, 200))}</p></div>`;
        }).join('') : `<p class="wbt-muted">Nada encontrado no ecossistema.</p>`;
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

    /* ── Artigos ────────────────────────────────────────── */
    function artigoOptions() {
        return `<option value="">— textos salvos —</option>` +
            artigos.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
                .map(a => `<option value="${a.id}" ${a.id === atual?.id ? 'selected' : ''}>${esc(a.title || 'Sem título')}</option>`).join('');
    }
    function load(a) {
        atual = a;
        $('#articleTitle').value = a?.title || '';
        $('#richEditor').innerHTML = a?.contentHTML || '';
        $('#editorStatus').textContent = a ? 'Texto carregado.' : '';
        $('#articleSelect').innerHTML = artigoOptions();
    }
    async function save() {
        const ed = $('#richEditor');
        const mentions = [...ed.querySelectorAll('a.wbt-mention')].map(a => ({ id: a.dataset.entity, cat: a.dataset.cat }));
        const a = atual || { id: uid('art') };
        a.title = $('#articleTitle').value.trim() || 'Sem título';
        a.contentHTML = ed.innerHTML;
        a.mentions = mentions;
        a.updatedAt = Date.now();
        a.updatedBy = WB().user?.email || '';
        const { id, ...data } = a;
        await setDoc(doc(db, 'worldbuilding-articles', id), data);
        atual = a;
        if (!artigos.find(x => x.id === a.id)) artigos.push(a);
        $('#editorStatus').textContent = `✓ Salvo às ${new Date().toLocaleTimeString('pt-BR')}`;
        $('#articleSelect').innerHTML = artigoOptions();
    }
    function autosaveHint() {
        clearTimeout(saveTimer);
        $('#editorStatus').textContent = 'Alterações não salvas…';
        saveTimer = setTimeout(() => { if (atual) save(); }, 4000);
    }

    /* ── Render ─────────────────────────────────────────── */
    function render() {
        setTitle('✒️ Escritório do Cronista');
        contentBody().innerHTML = `
        <div class="wbt-editor-layout" id="editorLayout">
            <div class="wbt-editor-main" id="editorMain">
                <div class="wbt-toolbar wbt-etoolbar">
                    <select id="articleSelect" class="form-select">${artigoOptions()}</select>
                    <button class="btn btn-secondary btn-sm" id="newArticle">+ Novo</button>
                    <span style="flex:1"></span>
                    <button class="btn btn-secondary btn-sm" data-cmd="bold" title="Negrito"><b>N</b></button>
                    <button class="btn btn-secondary btn-sm" data-cmd="italic" title="Itálico"><i>I</i></button>
                    <button class="btn btn-secondary btn-sm" data-cmd="formatBlock:h2" title="Título">T</button>
                    <button class="btn btn-secondary btn-sm" data-cmd="formatBlock:blockquote" title="Citação">❝</button>
                    <button class="btn btn-secondary btn-sm" data-cmd="insertUnorderedList" title="Lista">•—</button>
                    <span style="flex:1"></span>
                    <button class="btn btn-secondary btn-sm" id="toggleRefs" title="Painel de consulta">Consulta ⇄</button>
                    <button class="btn btn-secondary btn-sm" id="focusMode" title="Modo foco">Foco ⛶</button>
                    <button class="btn btn-success btn-sm" id="saveArticle">💾 Salvar</button>
                </div>
                <input id="articleTitle" class="wbt-article-title" placeholder="Título do conto ou cena…">
                <div id="richEditor" class="wbt-rich" contenteditable="true"
                     data-placeholder="Escreva aqui. Digite @ para vincular NPCs, Tribos, Locais ou eventos…"></div>
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
        renderRefs(); bind();
    }

    function bind() {
        document.querySelectorAll('[data-cmd]').forEach(b => b.onclick = () => {
            const [cmd, arg] = b.dataset.cmd.split(':');
            $('#richEditor').focus(); document.execCommand(cmd, false, arg || null); autosaveHint();
        });
        $('#saveArticle').onclick = save;
        $('#newArticle').onclick = () => load(null);
        $('#articleSelect').onchange = (e) => { const a = artigos.find(x => x.id === e.target.value); if (a) load(a); };
        $('#toggleRefs').onclick = () => $('#editorLayout').classList.toggle('refs-closed');
        $('#focusMode').onclick = () => document.body.classList.toggle('wbt-focus');
        $('#refsSearch').oninput = renderRefs;
        $('#refsTabs').onclick = (e) => {
            const b = e.target.closest('[data-rt]'); if (!b) return;
            refType = b.dataset.rt;
            document.querySelectorAll('#refsTabs .wbt-chip').forEach(c => c.classList.toggle('is-active', c === b));
            renderRefs();
        };
        $('#refsList').onclick = (e) => {
            const c = e.target.closest('[data-ref]'); if (!c) return;
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
        async render() { await loadArtigos(); render(); },
    };
})();
