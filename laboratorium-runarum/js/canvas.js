/* =====================================================================
   ᛟ LAB CANVAS — Mesa de montagem do Laboratorium Runarum
   ---------------------------------------------------------------------
   Nós arrastáveis (pointer events), encaixe magnético RESTRITO aos
   pontos de conexão cadastrados no Painel do Criador (saída→entrada,
   sinal→sinal — Lei do Circuito), ligações desenhadas em SVG, seletor
   de nível ao vivo. Se o elemento tem imagem cadastrada, renderiza
   somente a imagem; senão, um contêiner nomeado.
   ===================================================================== */

const LabCanvas = (() => {
    const SNAP_DIST = 26;          // px para encaixar
    const UNSNAP_DIST = 42;        // px para romper ligação ao arrastar
    const NODE_W = 104, NODE_H = 104;

    const CP_CORES = { entrada: '#38bdf8', saida: '#f59e0b', sinal: '#a78bfa' };
    const CP_FALLBACK = {
        // Sem pontos cadastrados: fallback pela categoria (fluxo canônico)
        captador: [{ x: 92, y: 50, tipo: 'saida', rotulo: 'fluxo' }],
        emissor: [{ x: 8, y: 50, tipo: 'entrada', rotulo: 'fluxo' }],
        exaustor: [{ x: 8, y: 50, tipo: 'entrada', rotulo: 'residual' }],
        default: [{ x: 8, y: 50, tipo: 'entrada', rotulo: 'in' }, { x: 92, y: 50, tipo: 'saida', rotulo: 'out' }],
    };

    const state = { nodes: [], links: [], seq: 1 };
    let host = null, svg = null, elementsById = {}, onChange = null, aprendidos = {};

    // ---------- API ----------
    function init(hostEl, catalog, learnedMap, changeCb) {
        host = hostEl;
        elementsById = catalog || {};
        aprendidos = learnedMap || {};
        onChange = changeCb || (() => { });
        host.innerHTML = '<svg class="lab-links"></svg><div class="lab-hint">Arraste elementos da paleta para cá.<br>Aproxime um ponto <b style="color:#f59e0b">saída</b> de um ponto <b style="color:#38bdf8">entrada</b> para encaixar.</div>';
        svg = host.querySelector('svg');
        renderAll();
    }

    function setLearned(map) { aprendidos = map || {}; state.nodes.forEach(paintLearnState); }

    function getState() {
        return {
            nodes: state.nodes.map(n => ({ id: n.id, elementId: n.elementId, nivel: n.nivel, x: Math.round(n.x), y: Math.round(n.y) })),
            links: state.links.map(l => ({ id: l.id, a: { ...l.a }, b: { ...l.b } })),
        };
    }

    function loadState(saved) {
        clear(false);
        (saved?.nodes || []).forEach(n => {
            if (!elementsById[n.elementId]) return; // elemento removido do painel
            addNode(n.elementId, n.x, n.y, n.nivel, n.id);
        });
        (saved?.links || []).forEach(l => {
            if (state.nodes.find(n => n.id === l.a.nodeId) && state.nodes.find(n => n.id === l.b.nodeId)) {
                state.links.push({ id: l.id || 'l' + (state.seq++), a: l.a, b: l.b });
            }
        });
        drawLinks(); emitChange();
    }

    function clear(emit = true) {
        state.nodes.forEach(n => n.dom?.remove());
        state.nodes = []; state.links = [];
        drawLinks(); if (emit) emitChange();
        toggleHint();
    }

    // ---------- Pontos de conexão ----------
    function pointsOf(el) {
        if (Array.isArray(el?.pontosConexao) && el.pontosConexao.length) return el.pontosConexao;
        return CP_FALLBACK[RuneEngine.norm(el?.categoria)] || CP_FALLBACK.default;
    }
    function ptPos(node, ptIdx) {
        const pts = pointsOf(elementsById[node.elementId]);
        const p = pts[ptIdx] || { x: 50, y: 50 };
        return { x: node.x + (p.x / 100) * NODE_W, y: node.y + (p.y / 100) * NODE_H, tipo: p.tipo };
    }
    const compat = (a, b) =>
        (a === 'saida' && b === 'entrada') || (a === 'entrada' && b === 'saida') || (a === 'sinal' && b === 'sinal');

    const ptBusy = (nodeId, pt) =>
        state.links.some(l => (l.a.nodeId === nodeId && l.a.pt === pt) || (l.b.nodeId === nodeId && l.b.pt === pt));

    // ---------- Nós ----------
    function addNode(elementId, x, y, nivel, forcedId) {
        const el = elementsById[elementId];
        if (!el) return null;
        const node = {
            id: forcedId || 'n' + (state.seq++),
            elementId, nivel: Number(nivel || 1),
            x: Math.max(0, x), y: Math.max(0, y), dom: null,
        };
        state.nodes.push(node);
        renderNode(node);
        toggleHint();
        emitChange();
        return node;
    }

    function removeNode(nodeId) {
        const n = state.nodes.find(n => n.id === nodeId);
        if (!n) return;
        n.dom?.remove();
        state.nodes = state.nodes.filter(x => x.id !== nodeId);
        state.links = state.links.filter(l => l.a.nodeId !== nodeId && l.b.nodeId !== nodeId);
        drawLinks(); toggleHint(); emitChange();
    }

    function maxNivel(el) {
        const byNiveis = Array.isArray(el.niveis) && el.niveis.length ? Math.max(...el.niveis.map(n => Number(n.nivel))) : 0;
        return Number(el.maxNivel || byNiveis || (RuneEngine.norm(el.tipoElemento) === 'sigilus' ? 3 : 5));
    }

    function renderNode(node) {
        const el = elementsById[node.elementId];
        const d = document.createElement('div');
        d.className = 'lab-node';
        d.dataset.nodeId = node.id;
        d.style.left = node.x + 'px'; d.style.top = node.y + 'px';
        d.style.width = NODE_W + 'px'; d.style.height = NODE_H + 'px';

        const corpo = el.imagemUrl
            ? `<img class="lab-node-img" src="${el.imagemUrl}" alt="${escAttr(el.nome)}" draggable="false">`
            : `<div class="lab-node-box" style="--el-cor:${el.cor ? cssColor(el.cor) : '#94a3b8'}">
                 <span class="lab-node-nome">${esc(el.nome)}</span>
                 ${el.nomeLatim ? `<span class="lab-node-latim">${esc(el.nomeLatim)}</span>` : ''}
               </div>`;

        const pts = pointsOf(el).map((p, i) =>
            `<span class="lab-cp" data-pt="${i}" title="${esc(p.rotulo || p.tipo)}"
                style="left:${p.x}%;top:${p.y}%;background:${CP_CORES[p.tipo] || '#888'}"></span>`).join('');

        d.innerHTML = `
            ${corpo}${pts}
            <button class="lab-node-del" title="Remover">✕</button>
            <button class="lab-node-nivel" title="Nível (clique para mudar — custos recalculam ao vivo)">Nv${node.nivel}</button>
            <span class="lab-node-custo"></span>`;
        host.appendChild(d);
        node.dom = d;

        d.querySelector('.lab-node-del').addEventListener('pointerdown', e => e.stopPropagation());
        d.querySelector('.lab-node-del').addEventListener('click', e => { e.stopPropagation(); removeNode(node.id); });

        const nvBtn = d.querySelector('.lab-node-nivel');
        nvBtn.addEventListener('pointerdown', e => e.stopPropagation());
        nvBtn.addEventListener('click', e => {
            e.stopPropagation();
            node.nivel = node.nivel >= maxNivel(el) ? 1 : node.nivel + 1;
            nvBtn.textContent = 'Nv' + node.nivel;
            paintLearnState(node); paintCusto(node); emitChange();
        });

        d.addEventListener('pointerdown', ev => startDrag(node, ev));
        d.addEventListener('dblclick', () => window.labOpenElementInfo?.(node.elementId, node.nivel));

        paintLearnState(node); paintCusto(node);
    }

    function paintCusto(node) {
        const el = elementsById[node.elementId];
        const c = RuneEngine.custoEss(el, node.nivel);
        const span = node.dom?.querySelector('.lab-node-custo');
        if (span) span.textContent = c + ' Ess';
    }

    function paintLearnState(node) {
        const dominado = Number(aprendidos[node.elementId] || 0) >= Number(node.nivel);
        node.dom?.classList.toggle('lab-node--sim', !dominado);
        const nvBtn = node.dom?.querySelector('.lab-node-nivel');
        if (nvBtn) nvBtn.title = dominado
            ? 'Nível (dominado)' : 'Nível NÃO dominado — apenas simulação; não permite salvar no Grimório';
    }

    // ---------- Drag + snap ----------
    function startDrag(node, ev) {
        if (ev.button !== 0) return;
        ev.preventDefault();
        const rect = host.getBoundingClientRect();
        const offX = ev.clientX - rect.left - node.x + host.scrollLeft;
        const offY = ev.clientY - rect.top - node.y + host.scrollTop;
        node.dom.classList.add('lab-node--drag');
        node.dom.setPointerCapture(ev.pointerId);

        const move = e => {
            node.x = Math.max(0, e.clientX - rect.left - offX + host.scrollLeft);
            node.y = Math.max(0, e.clientY - rect.top - offY + host.scrollTop);
            node.dom.style.left = node.x + 'px'; node.dom.style.top = node.y + 'px';
            drawLinks(); previewSnap(node);
        };
        const up = e => {
            node.dom.releasePointerCapture(ev.pointerId);
            node.dom.classList.remove('lab-node--drag');
            node.dom.removeEventListener('pointermove', move);
            node.dom.removeEventListener('pointerup', up);
            clearPreview();
            // 1) romper ligações esticadas demais
            state.links = state.links.filter(l => {
                if (l.a.nodeId !== node.id && l.b.nodeId !== node.id) return true;
                const pa = ptPos(byId(l.a.nodeId), l.a.pt), pb = ptPos(byId(l.b.nodeId), l.b.pt);
                return dist(pa, pb) <= UNSNAP_DIST;
            });
            // 2) tentar encaixar
            trySnap(node);
            drawLinks(); emitChange();
        };
        node.dom.addEventListener('pointermove', move);
        node.dom.addEventListener('pointerup', up);
    }

    const byId = id => state.nodes.find(n => n.id === id);
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

    function candidates(node) {
        const myPts = pointsOf(elementsById[node.elementId]);
        const out = [];
        myPts.forEach((mp, mi) => {
            if (ptBusy(node.id, mi)) return;
            const mpos = ptPos(node, mi);
            state.nodes.forEach(other => {
                if (other.id === node.id) return;
                pointsOf(elementsById[other.elementId]).forEach((op, oi) => {
                    if (ptBusy(other.id, oi)) return;
                    if (!compat(mp.tipo, op.tipo)) return;
                    const opos = ptPos(other, oi);
                    const d = dist(mpos, opos);
                    if (d <= SNAP_DIST) out.push({ d, mi, mp, other, oi, op, mpos, opos });
                });
            });
        });
        return out.sort((a, b) => a.d - b.d);
    }

    function trySnap(node) {
        const done = new Set();
        candidates(node).forEach(c => {
            if (done.has(c.mi) || ptBusy(node.id, c.mi) || ptBusy(c.other.id, c.oi)) return;
            if (done.size === 0) { // alinhar o nó pelo primeiro encaixe
                node.x += c.opos.x - c.mpos.x;
                node.y += c.opos.y - c.mpos.y;
                node.dom.style.left = node.x + 'px'; node.dom.style.top = node.y + 'px';
            }
            const saidaFirst = (c.mp.tipo === 'saida' || (c.mp.tipo === 'sinal' && c.op.tipo === 'sinal'));
            state.links.push(saidaFirst
                ? { id: 'l' + (state.seq++), a: { nodeId: node.id, pt: c.mi }, b: { nodeId: c.other.id, pt: c.oi } }
                : { id: 'l' + (state.seq++), a: { nodeId: c.other.id, pt: c.oi }, b: { nodeId: node.id, pt: c.mi } });
            done.add(c.mi);
        });
    }

    let previewLine = null;
    function previewSnap(node) {
        clearPreview();
        const c = candidates(node)[0];
        if (!c) return;
        previewLine = mkLine(c.mpos, c.opos, true);
        svg.appendChild(previewLine);
    }
    function clearPreview() { previewLine?.remove(); previewLine = null; }

    // ---------- Ligações (SVG) ----------
    function drawLinks() {
        if (!svg) return;
        svg.querySelectorAll('.lab-link').forEach(x => x.remove());
        state.links.forEach(l => {
            const na = byId(l.a.nodeId), nb = byId(l.b.nodeId);
            if (!na || !nb) return;
            const pa = ptPos(na, l.a.pt), pb = ptPos(nb, l.b.pt);
            const line = mkLine(pa, pb, false, pa.tipo === 'sinal' || pb.tipo === 'sinal');
            line.classList.add('lab-link');
            line.addEventListener('click', () => {
                state.links = state.links.filter(x => x.id !== l.id);
                drawLinks(); emitChange();
            });
            svg.appendChild(line);
        });
        // dimensionar o svg à área usada
        const maxX = Math.max(host.clientWidth, ...state.nodes.map(n => n.x + NODE_W + 40));
        const maxY = Math.max(host.clientHeight, ...state.nodes.map(n => n.y + NODE_H + 40));
        svg.setAttribute('width', maxX); svg.setAttribute('height', maxY);
    }

    function mkLine(a, b, preview, sinal) {
        const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const dx = Math.max(24, Math.abs(b.x - a.x) / 2);
        p.setAttribute('d', `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`);
        p.setAttribute('fill', 'none');
        p.setAttribute('stroke', preview ? '#22c55e' : (sinal ? '#a78bfa' : '#f59e0b'));
        p.setAttribute('stroke-width', preview ? 2 : 3);
        if (preview || sinal) p.setAttribute('stroke-dasharray', preview ? '4 4' : '6 5');
        p.style.cursor = 'pointer';
        p.style.pointerEvents = preview ? 'none' : 'stroke';
        if (!preview) {
            const t = document.createElementNS('http://www.w3.org/2000/svg', 'title');
            t.textContent = 'Clique para romper a ligação';
            p.appendChild(t);
        }
        return p;
    }

    // ---------- util ----------
    function renderAll() { state.nodes.forEach(renderNode); drawLinks(); toggleHint(); }
    function toggleHint() {
        const h = host?.querySelector('.lab-hint');
        if (h) h.style.display = state.nodes.length ? 'none' : '';
    }
    function emitChange() { onChange?.(getState()); }
    const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
    const escAttr = esc;
    function cssColor(nome) {
        const m = { vermelha: '#ef4444', azul: '#3b82f6', verde: '#22c55e', cinza: '#94a3b8', marrom: '#b45309', dourada: '#f59e0b', prateada: '#cbd5e1', branca: '#f8fafc', negra: '#475569', purpura: '#a855f7', 'púrpura': '#a855f7', ambar: '#f59e0b', 'âmbar': '#f59e0b', violeta: '#8b5cf6', turquesa: '#2dd4bf' };
        return m[RuneEngine.norm(nome)] || nome || '#94a3b8';
    }

    return { init, addNode, removeNode, clear, getState, loadState, setLearned, NODE_W, NODE_H };
})();

if (typeof window !== 'undefined') window.LabCanvas = LabCanvas;
