/* ═══════════════════════════════════════════════════════════
   wb-grafos.js — Mapeamento relacional (vis-network)
   ──────────────────────────────────────────────────
   Dois grafos sobre o ECOSSISTEMA REAL:
   • "genealogy" — nós = coleção `npcs` (personagens reais)
   • "factions"  — nós = coleção `worldbuilding-factions` (Tribos)

   As ARESTAS ficam numa coleção nova e enxuta,
   `worldbuilding-relations`, cada uma referenciando os IDs
   reais das entradas. Clicar no NÓ abre a ficha real; clicar
   na ARESTA abre o resumo do tratado/conflito.
   ═══════════════════════════════════════════════════════════ */

import { db, collection, getDocs, doc, setDoc, deleteDoc } from './firebase-config.js';
import { WB, esc, uid, ToolModal, setTitle, contentBody } from './wb-utils.js';

export const TIPOS_REL = {
    genealogy: {
        familia:  { label: 'Família',        cor: '#D4AF37', dashes: false },
        mentoria: { label: 'Mentoria',       cor: '#3FAE6A', dashes: false },
        inimigo:  { label: 'Inimizade',      cor: '#8B1E2D', dashes: [4, 4] },
        romance:  { label: 'Romance',        cor: '#a34d6b', dashes: false },
        aliado:   { label: 'Aliado',         cor: '#3AA6FF', dashes: false },
        outro:    { label: 'Outro',          cor: '#7d8698', dashes: [2, 6] },
    },
    factions: {
        alianca:     { label: 'Aliança militar',     cor: '#3FAE6A', dashes: false },
        comercio:    { label: 'Rota comercial',      cor: '#D4AF37', dashes: false },
        guerra:      { label: 'Guerra aberta',       cor: '#8B1E2D', dashes: false },
        guerra_fria: { label: 'Guerra fria',         cor: '#8B1E2D', dashes: [6, 5] },
        rivalidade:  { label: 'Inimizade histórica', cor: '#a34d6b', dashes: [3, 5] },
        vassalagem:  { label: 'Vassalagem',          cor: '#5B3FB8', dashes: false },
    },
};

/* Coleção do ecossistema que fornece os nós de cada grafo */
const FONTE = { genealogy: 'npcs', factions: 'factions' };

export const Grafos = (() => {
    let network = null, grafoAtual = 'genealogy', relations = [];

    async function loadRelations() {
        try {
            const snap = await getDocs(collection(db, 'worldbuilding-relations'));
            relations = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch { relations = []; }
    }

    /* ── Montagem dos dados vis ─────────────────────────── */
    function buildData() {
        const fonte = WB().data[FONTE[grafoAtual]] || [];
        const style = grafoAtual === 'factions'
            ? { shape: 'box', color: { background: '#1F2630', border: '#8B1E2D' } }
            : { shape: 'ellipse', color: { background: '#1F2630', border: '#3AA6FF' } };

        const nodes = fonte.map(e => ({
            id: e.id, label: e.nome || e.titulo || '?',
            title: (e.descricao || '').slice(0, 120) || undefined,
            ...style, borderWidth: 2,
            font: { color: '#E9E2D2', face: 'Inter' },
            image: e.imagem || undefined,
            shape: e.imagem ? 'circularImage' : style.shape,
        }));

        const kinds = TIPOS_REL[grafoAtual];
        const edges = relations.filter(r => r.graph === grafoAtual).map(r => {
            const k = kinds[r.kind] || { cor: '#7d8698', dashes: false };
            return {
                id: r.id, from: r.from, to: r.to, label: r.label,
                dashes: k.dashes, color: { color: k.cor, highlight: '#E9E2D2' },
                font: { color: '#A99F8C', size: 11, strokeWidth: 0, face: 'Inter' },
                arrows: r.directed ? 'to' : '', width: 2,
            };
        });
        return { nodes: new vis.DataSet(nodes), edges: new vis.DataSet(edges) };
    }

    function draw() {
        const container = document.getElementById('grafoCanvas');
        if (!container) return;
        if (network) { network.destroy(); network = null; }
        network = new vis.Network(container, buildData(), {
            physics: { solver: 'forceAtlas2Based', forceAtlas2Based: { gravitationalConstant: -60, springLength: 150 }, stabilization: { iterations: 120 } },
            interaction: { hover: true, tooltipDelay: 150 },
            edges: { smooth: { type: 'dynamic' } },
        });
        network.on('click', (p) => {
            if (p.nodes.length) ToolModal.openEntry(FONTE[grafoAtual], p.nodes[0]);
            else if (p.edges.length) openRelation(p.edges[0]);
        });
        legend();
    }

    function legend() {
        document.getElementById('grafoLegend').innerHTML =
            Object.values(TIPOS_REL[grafoAtual]).map(k =>
                `<span><i class="wbt-legdot" style="background:${k.cor};${k.dashes ? 'opacity:.6' : ''}"></i>${k.label}</span>`).join('');
    }

    /* ── Resumo do tratado/conflito (clique na aresta) ──── */
    function openRelation(relId) {
        const r = relations.find(x => x.id === relId); if (!r) return;
        const fonte = WB().data[FONTE[grafoAtual]] || [];
        const a = fonte.find(e => e.id === r.from), b = fonte.find(e => e.id === r.to);
        const k = TIPOS_REL[r.graph]?.[r.kind];
        ToolModal.open(`
            <span class="wbt-kind" style="color:${k?.cor || '#7d8698'}">${k?.label || r.kind}</span>
            <h2>${esc(a?.nome || '?')} ${r.directed ? '→' : '⇄'} ${esc(b?.nome || '?')}</h2>
            <p><b style="color:var(--lr-gold)">${esc(r.label)}</b></p>
            <p class="wbt-desc">${esc(r.summary || 'Nenhum resumo do tratado/conflito registrado ainda.')}</p>
            <div class="wbt-actions">
                <button class="btn btn-secondary" id="relEdit">✏️ Editar</button>
                <button class="btn btn-danger" id="relDel">🗑️ Excluir vínculo</button>
            </div>`);
        document.getElementById('relEdit').onclick = () => openEdgeForm(r);
        document.getElementById('relDel').onclick = async () => {
            if (!confirm('Excluir este vínculo?')) return;
            await deleteDoc(doc(db, 'worldbuilding-relations', r.id));
            await loadRelations(); ToolModal.close(); draw();
        };
    }

    /* ── Formulário de vínculo ──────────────────────────── */
    function openEdgeForm(existing = null) {
        const fonte = WB().data[FONTE[grafoAtual]] || [];
        if (fonte.length < 2) {
            const onde = grafoAtual === 'factions' ? '⚔️ Tribos' : '👥 NPCs';
            WB().showAlert(`Cadastre ao menos dois na categoria ${onde} antes de criar vínculos.`, 'warning');
            return;
        }
        const r = existing || {
            id: uid('rel'), graph: grafoAtual, from: fonte[0].id, to: fonte[1].id,
            label: '', kind: Object.keys(TIPOS_REL[grafoAtual])[0],
            directed: grafoAtual === 'genealogy', summary: '',
        };
        const opts = (sel) => fonte.map(e => `<option value="${e.id}" ${e.id === sel ? 'selected' : ''}>${esc(e.nome || e.titulo)}</option>`).join('');
        ToolModal.open(`
            <h2>${existing ? 'Editar vínculo' : 'Novo vínculo'}</h2>
            <div class="wbt-form">
                <div class="wbt-row2">
                    <label>De <select id="rlFrom" class="form-select">${opts(r.from)}</select></label>
                    <label>Para <select id="rlTo" class="form-select">${opts(r.to)}</select></label>
                </div>
                <label>Rótulo da linha (livre)
                    <input id="rlLabel" class="form-input" value="${esc(r.label)}" placeholder='"Pai de", "Assassino de", "Tratado do Sal"'></label>
                <label>Tipo de relação
                    <select id="rlKind" class="form-select">${Object.entries(TIPOS_REL[grafoAtual]).map(([k, v]) => `<option value="${k}" ${k === r.kind ? 'selected' : ''}>${v.label}</option>`).join('')}</select></label>
                <label>Direção
                    <select id="rlDir" class="form-select">
                        <option value="1" ${r.directed ? 'selected' : ''}>Direcional (A → B)</option>
                        <option value="0" ${!r.directed ? 'selected' : ''}>Mútua (A ⇄ B)</option></select></label>
                <label>Resumo do tratado / conflito
                    <textarea id="rlSummary" class="form-textarea" placeholder="Termos do tratado, origem da rixa…">${esc(r.summary)}</textarea></label>
                <div class="wbt-actions"><button class="btn btn-success" id="rlSave">💾 Salvar vínculo</button></div>
            </div>`);
        document.getElementById('rlSave').onclick = async () => {
            r.from = document.getElementById('rlFrom').value;
            r.to = document.getElementById('rlTo').value;
            if (r.from === r.to) { WB().showAlert('Escolha duas entidades diferentes.', 'warning'); return; }
            r.kind = document.getElementById('rlKind').value;
            r.label = document.getElementById('rlLabel').value.trim() || TIPOS_REL[grafoAtual][r.kind].label;
            r.directed = document.getElementById('rlDir').value === '1';
            r.summary = document.getElementById('rlSummary').value.trim();
            const { id, ...data } = r;
            await setDoc(doc(db, 'worldbuilding-relations', id), data);
            await loadRelations(); ToolModal.close(); draw();
        };
    }

    /* ── Render da view ─────────────────────────────────── */
    function render() {
        setTitle('🕸️ Grafos de Conexão');
        contentBody().innerHTML = `
            <div class="wbt-toolbar">
                <div class="wbt-seg">
                    <button class="wbt-seg__btn ${grafoAtual === 'genealogy' ? 'is-active' : ''}" data-g="genealogy">👥 Genealogia &amp; Personagens</button>
                    <button class="wbt-seg__btn ${grafoAtual === 'factions' ? 'is-active' : ''}" data-g="factions">⚔️ Teia de Tribos</button>
                </div>
                <span style="flex:1"></span>
                <button class="btn btn-secondary" id="gAddEdge">➕ Vínculo</button>
                <button class="btn btn-secondary" id="gFit">🎯 Centralizar</button>
            </div>
            <div class="wbt-graph-wrap">
                <div id="grafoCanvas" class="wbt-graph"></div>
                <div class="wbt-graph-legend" id="grafoLegend"></div>
            </div>
            <p class="wbt-muted" style="margin-top:.6rem">Os nós são ${grafoAtual === 'factions' ? 'as Tribos' : 'os NPCs'} reais do seu mundo. Clique num nó para a ficha; numa linha para o tratado/conflito.</p>`;

        document.querySelectorAll('[data-g]').forEach(btn => btn.onclick = () => { grafoAtual = btn.dataset.g; render(); });
        document.getElementById('gAddEdge').onclick = () => openEdgeForm();
        document.getElementById('gFit').onclick = () => network?.fit({ animation: true });
        requestAnimationFrame(draw);   // container precisa estar no DOM/medido
    }

    return {
        async render() { await loadRelations(); render(); },
    };
})();
