/* ═══════════════════════════════════════════════════════════
   wb-mural.js — Mural de Ideias (Kanban / post-its)
   ─────────────────────────────────────────────────
   Colunas + cartões editáveis, drag-and-drop nativo.
   Todo o mural é UM documento: worldbuilding-settings/mural.
   ═══════════════════════════════════════════════════════════ */

import { db, doc, getDoc, setDoc } from './firebase-config.js';
import { WB, esc, uid, setTitle, contentBody } from './wb-utils.js';
import { confirmar } from '../../shared/dialogo.js?v=2';

const CORES = ['#9D6B2F', '#8B1E2D', '#3FAE6A', '#5B3FB8', '#a34d6b'];
const DEFAULT = { columns: [
    { id: uid('col'), title: 'Ganchos de aventura', cards: [] },
    { id: uid('col'), title: 'Ideias soltas', cards: [] },
    { id: uid('col'), title: 'Arco em desenvolvimento', cards: [] },
    { id: uid('col'), title: 'Prontos para escrever', cards: [] },
]};

export const Mural = (() => {
    let board = null, dragId = null;

    const persist = () => setDoc(doc(db, 'worldbuilding-settings', 'mural'), board);
    const findCol = (id) => board.columns.find(c => c.id === id);
    function findCard(id) {
        for (const col of board.columns) {
            const i = col.cards.findIndex(c => c.id === id);
            if (i > -1) return { col, i, card: col.cards[i] };
        }
        return null;
    }

    function render() {
        setTitle('📌 Mural de Ideias');
        contentBody().innerHTML = `
            <div class="wbt-toolbar">
                <span class="wbt-muted">Arraste post-its entre colunas. Clique para editar o texto.</span>
                <span style="flex:1"></span>
                <button class="btn btn-secondary" id="muralAddCol">+ Coluna</button>
            </div>
            <div class="wbt-board" id="muralRoot">${board.columns.map(colHTML).join('')}</div>`;
        bind(); bindDnD();
    }

    const colHTML = (col) => `
        <div class="wbt-col" data-col="${col.id}">
            <div class="wbt-col__head">
                <input class="wbt-col__title" data-coltitle="${col.id}" value="${esc(col.title)}">
                <button class="wbt-x" data-addcard="${col.id}" title="Novo post-it">＋</button>
                <button class="wbt-x" data-delcol="${col.id}" title="Excluir coluna">✕</button>
            </div>
            <div class="wbt-col__cards" data-drop="${col.id}">${col.cards.map(cardHTML).join('')}</div>
        </div>`;

    const cardHTML = (c) => `
        <div class="wbt-card" draggable="true" data-card="${c.id}" style="--card-cor:${c.color}">
            <div class="wbt-card__text" contenteditable="true" data-cardtext="${c.id}">${esc(c.text)}</div>
            <div class="wbt-card__foot">
                ${CORES.map(cor => `<button class="wbt-colorpick" style="background:${cor}" data-cor="${cor}" data-forcard="${c.id}"></button>`).join('')}
                <span style="flex:1"></span>
                <button class="wbt-x" data-delcard="${c.id}">✕</button>
            </div>
        </div>`;

    function bindDnD() {
        document.querySelectorAll('.wbt-card').forEach(el => {
            el.addEventListener('dragstart', (e) => { dragId = el.dataset.card; el.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
            el.addEventListener('dragend', () => el.classList.remove('dragging'));
        });
        document.querySelectorAll('[data-drop]').forEach(zone => {
            zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
            zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
            zone.addEventListener('drop', (e) => {
                e.preventDefault(); zone.classList.remove('drag-over');
                if (!dragId) return;
                const src = findCard(dragId), dst = findCol(zone.dataset.drop);
                if (!src || !dst) return;
                src.col.cards.splice(src.i, 1);
                const after = e.target.closest('.wbt-card');
                if (after && after.dataset.card !== dragId) {
                    dst.cards.splice(dst.cards.findIndex(c => c.id === after.dataset.card), 0, src.card);
                } else dst.cards.push(src.card);
                dragId = null; persist(); render();
            });
        });
    }

    function bind() {
        document.getElementById('muralAddCol').onclick = () => {
            board.columns.push({ id: uid('col'), title: 'Nova coluna', cards: [] });
            persist(); render();
        };
        const root = document.getElementById('muralRoot');
        root.addEventListener('click', async (e) => {
            const add = e.target.closest('[data-addcard]'), delC = e.target.closest('[data-delcard]');
            const delCol = e.target.closest('[data-delcol]'), cor = e.target.closest('[data-cor]');
            if (add) { findCol(add.dataset.addcard)?.cards.push({ id: uid('card'), text: 'Nova ideia…', color: CORES[Math.floor(Math.random() * CORES.length)] }); persist(); render(); }
            if (delC) { const f = findCard(delC.dataset.delcard); if (f) { f.col.cards.splice(f.i, 1); persist(); render(); } }
            if (delCol && await confirmar('Excluir a coluna e todos os post-its?', { perigo: true })) { board.columns = board.columns.filter(c => c.id !== delCol.dataset.delcol); persist(); render(); }
            if (cor) { const f = findCard(cor.dataset.forcard); if (f) { f.card.color = cor.dataset.cor; persist(); render(); } }
        });
        root.addEventListener('focusout', (e) => {
            const t = e.target;
            if (t.dataset?.cardtext) { const f = findCard(t.dataset.cardtext); if (f) { f.card.text = t.innerText.trim(); persist(); } }
            if (t.dataset?.coltitle) { const c = findCol(t.dataset.coltitle); if (c) { c.title = t.value.trim() || 'Coluna'; persist(); } }
        });
    }

    return {
        async render() {
            const snap = await getDoc(doc(db, 'worldbuilding-settings', 'mural'));
            board = snap.exists() ? snap.data() : structuredClone(DEFAULT);
            render();
        },
    };
})();
