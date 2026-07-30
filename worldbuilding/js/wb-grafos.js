/* ═══════════════════════════════════════════════════════════
   wb-grafos.js — Mapeamento relacional (vis-network)
   ──────────────────────────────────────────────────
   TRÊS modos:
   • "lineage"   — LINHAGENS FAMILIARES: você cria uma linhagem
                   (ex.: "Casa Vondiir") e adiciona NPCs E/OU
                   personagens de jogador a ela, ligando-os com
                   papéis ("Pai de", "Herdeiro de"…).
   • "genealogy" — visão geral de TODOS os NPCs e seus vínculos
                   (mentoria, inimizade, romance…).
   • "factions"  — teia de Tribos (aliança, comércio, guerra…).

   Nós de personagem podem vir de `npcs` (lore) OU de `char`
   (personagens de jogador). Clique no nó → ficha; na aresta →
   resumo do tratado/conflito.

   Coleções:
     worldbuilding-relations  → arestas dos grafos
     worldbuilding-lineages   → linhagens familiares (nova)
   ═══════════════════════════════════════════════════════════ */

import { db, collection, getDocs, doc, setDoc, deleteDoc } from './firebase-config.js';
import { WB, esc, uid, ToolModal, setTitle, contentBody, imgOf } from './wb-utils.js';
import { Eco } from './wb-ecosystem.js';
import { Calendario } from './wb-calendario.js';

export const TIPOS_REL = {
    lineage: {
        pai:       { label: 'Pai/Mãe de',   cor: '#D4AF37', dashes: false },
        herdeiro:  { label: 'Herdeiro de',  cor: '#C9A45C', dashes: false },
        conjuge:   { label: 'Cônjuge de',   cor: '#a34d6b', dashes: false },
        irmao:     { label: 'Irmão(ã) de',  cor: '#3AA6FF', dashes: false },
        adotado:   { label: 'Adotado por',  cor: '#3FAE6A', dashes: [5, 4] },
        bastardo:  { label: 'Bastardo de',  cor: '#8B7355', dashes: [3, 4] },
    },
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

export const Grafos = (() => {
    let network = null, modo = 'lineage', relations = [], lineages = [], lineageAtual = null;

    /* Pool de PERSONAGENS: NPCs (lore) + personagens de jogador (char).
       Cada nó carrega `fonte` para sabermos de onde veio. */
    function personagens() {
        const npcs = (WB().data.npcs || []).map(n => ({ ...n, fonte: 'npcs' }));
        const chars = Eco.chars.map(c => ({
            id: c.id, nome: c.nome || c.nomePersonagem || 'Sem nome',
            descricao: `${c.raca || ''} ${c.classe || ''}`.trim(),
            imagem: imgOf(c), fonte: 'char', ehJogador: true,
        }));
        return [...npcs, ...chars];
    }
    const nodeRef = (p) => `${p.fonte}:${p.id}`;              // id único do nó
    const findPersona = (ref) => personagens().find(p => nodeRef(p) === ref);

    async function loadAll() {
        try {
            const relSnap = await getDocs(collection(db, 'worldbuilding-relations'));
            relations = relSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            lineages = await Eco.reloadLineages();   // fonte compartilhada com a Linha do Tempo
        } catch (e) { console.warn('[grafos] load', e); relations = []; lineages = Eco.lineages || []; }
    }

    /* ══════════════ Montagem dos dados vis ══════════════ */
    function buildData() {
        if (modo === 'factions') return buildFactions();
        if (modo === 'lineage') return buildLineage();
        return buildGenealogy();
    }

    function personNode(p) {
        return {
            id: nodeRef(p), label: p.nome,
            title: (p.descricao || '').slice(0, 120) || undefined,
            shape: p.imagem ? 'circularImage' : 'ellipse',
            image: p.imagem || undefined,
            color: { background: '#1F2630', border: p.ehJogador ? '#3FAE6A' : '#3AA6FF' },
            borderWidth: p.ehJogador ? 3 : 2,
            font: { color: '#E9E2D2', face: 'Inter' },
        };
    }

    function edgesFrom(rels, tipos) {
        return rels.map(r => {
            const k = tipos[r.kind] || { cor: '#7d8698', dashes: false };
            return {
                id: r.id, from: r.from, to: r.to, label: r.label,
                dashes: k.dashes, color: { color: k.cor, highlight: '#E9E2D2' },
                font: { color: '#A99F8C', size: 11, strokeWidth: 0, face: 'Inter' },
                arrows: r.directed ? 'to' : '', width: 2,
            };
        });
    }

    function buildGenealogy() {
        const nodes = personagens().map(personNode);
        const nodeIds = new Set(nodes.map(n => n.id));
        const edges = edgesFrom(relations.filter(r => r.graph === 'genealogy'), TIPOS_REL.genealogy);
        // Sobrepõe os vínculos de LINHAGEM: para cada linhagem, liga seus membros
        // com uma linha na COR DA FAMÍLIA, exibindo o nome da Casa e o rótulo.
        for (const lin of (lineages || [])) {
            const cor = lin.cor || '#D4AF37';
            const rels = relations.filter(r =>
                r.graph === 'lineage' && r.lineageId === lin.id &&
                nodeIds.has(r.from) && nodeIds.has(r.to));
            if (rels.length) {
                // Há papéis definidos (Pai de, Herdeiro de…): use-os como rótulo.
                for (const r of rels) {
                    const papel = TIPOS_REL.lineage[r.kind]?.label || r.kind;
                    edges.push({
                        id: `linfam:${r.id}`, from: r.from, to: r.to,
                        label: `⚜️ ${lin.nome} · ${r.label || papel}`,
                        color: { color: cor, highlight: '#E9E2D2' },
                        font: { color: cor, size: 11, strokeWidth: 4, strokeColor: '#0E1117', face: 'Cinzel' },
                        dashes: false, width: 2.5, arrows: r.directed ? 'to' : '',
                        smooth: { type: 'curvedCW', roundness: 0.18 },
                    });
                }
            } else {
                // Sem papéis: encadeia os membros para deixar a Casa visível.
                const membros = (lin.members || []).filter(m => nodeIds.has(m.ref));
                for (let i = 0; i < membros.length - 1; i++) {
                    edges.push({
                        id: `linchain:${lin.id}:${i}`, from: membros[i].ref, to: membros[i + 1].ref,
                        label: `⚜️ ${lin.nome}`,
                        color: { color: cor, highlight: '#E9E2D2' },
                        font: { color: cor, size: 10, strokeWidth: 4, strokeColor: '#0E1117', face: 'Cinzel' },
                        dashes: [5, 4], width: 1.6,
                    });
                }
            }
        }
        return { nodes: new vis.DataSet(nodes), edges: new vis.DataSet(edges) };
    }

    function buildLineage() {
        if (!lineageAtual) return { nodes: new vis.DataSet([]), edges: new vis.DataSet([]) };
        const membros = lineageAtual.members || [];         // [{ref, fonte, id}]
        const refs = new Set(membros.map(m => m.ref));
        const nodes = membros.map(m => {
            const p = findPersona(m.ref);
            return p ? personNode(p) : { id: m.ref, label: m.nome || '?', color: { background: '#1F2630', border: '#8B1E2D' }, font: { color: '#E9E2D2' } };
        });
        // raiz visual da linhagem
        nodes.unshift({ id: `lin:${lineageAtual.id}`, label: `⚜️ ${lineageAtual.nome}`, shape: 'box',
            color: { background: '#2A1E10', border: '#D4AF37' }, font: { color: '#D4AF37', face: 'Cinzel', size: 16 }, borderWidth: 2 });
        const edges = edgesFrom(
            relations.filter(r => r.graph === 'lineage' && r.lineageId === lineageAtual.id && refs.has(r.from) && refs.has(r.to)),
            TIPOS_REL.lineage);
        return { nodes: new vis.DataSet(nodes), edges: new vis.DataSet(edges) };
    }

    function buildFactions() {
        const fonte = WB().data.factions || [];
        const nodes = fonte.map(e => ({
            id: e.id, label: e.nome || '?', title: (e.descricao || '').slice(0, 120) || undefined,
            shape: imgOf(e) ? 'circularImage' : 'box', image: imgOf(e) || undefined,
            color: { background: '#1F2630', border: '#8B1E2D' }, borderWidth: 2,
            font: { color: '#E9E2D2', face: 'Inter' },
        }));
        const edges = edgesFrom(relations.filter(r => r.graph === 'factions'), TIPOS_REL.factions);
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
            if (p.nodes.length) {
                const nid = p.nodes[0];
                if (String(nid).startsWith('lin:')) return openLineageEditor(lineageAtual);
                if (modo === 'factions') return ToolModal.openEntry('factions', nid);
                const [fonte, id] = String(nid).split(':');
                if (fonte === 'npcs') ToolModal.openEntry('npcs', id);
                else openCharCard(id);
            } else if (p.edges.length) {
                const eid = String(p.edges[0]);
                if (eid.startsWith('linfam:')) return openRelation(eid.slice('linfam:'.length));
                if (eid.startsWith('linchain:')) {
                    const linId = eid.slice('linchain:'.length).split(':')[0];
                    return openLineageEditor(lineages.find(l => l.id === linId) || null);
                }
                openRelation(eid);
            }
        });
        legend();
    }

    function legend() {
        let html = Object.values(TIPOS_REL[modo]).map(k =>
            `<span><i class="wbt-legdot" style="background:${k.cor};${k.dashes ? 'opacity:.6' : ''}"></i>${k.label}</span>`).join('');
        // Na visão geral, mostra também as cores das linhagens presentes.
        if (modo === 'genealogy' && (lineages || []).length) {
            html += (lineages || []).map(l =>
                `<span><i class="wbt-legdot" style="background:${l.cor || '#D4AF37'}"></i>⚜️ ${esc(l.nome)}</span>`).join('');
        }
        document.getElementById('grafoLegend').innerHTML = html;
    }

    /* Ficha rápida de personagem de jogador (coleção char). */
    function openCharCard(id) {
        const c = Eco.chars.find(x => x.id === id);
        if (!c) return;
        ToolModal.open(`
            <div class="wbt-entity-head">
                ${imgOf(c) ? `<img src="${esc(imgOf(c))}" class="wbt-entity-img">` : ''}
                <div><span class="wbt-kind">🎭 Personagem de Jogador</span>
                <h2>${esc(c.nome || c.nomePersonagem || '')}</h2>
                <p class="wbt-muted">${esc(c.raca || '')}${c.classe ? ' · ' + esc(c.classe) : ''}${c.nivel ? ' · Nível ' + esc(c.nivel) : ''}</p></div>
            </div>
            <div class="wbt-actions"><button class="btn btn-secondary" data-close>Fechar</button>
            <button class="btn btn-success" id="openFicha">📋 Abrir ficha</button></div>`);
        document.getElementById('openFicha').onclick = () => window.open(`../criar-personagem/criar-personagem.html?id=${id}`, '_blank');
    }

    /* ══════════════ Resumo de aresta ══════════════ */
    function openRelation(relId) {
        const r = relations.find(x => x.id === relId); if (!r) return;
        const nome = (ref) => {
            if (modo === 'factions') return (WB().data.factions || []).find(f => f.id === ref)?.nome || '?';
            return findPersona(ref)?.nome || '?';
        };
        const k = TIPOS_REL[r.graph]?.[r.kind];
        ToolModal.open(`
            <span class="wbt-kind" style="color:${k?.cor || '#7d8698'}">${k?.label || r.kind}</span>
            <h2>${esc(nome(r.from))} ${r.directed ? '→' : '⇄'} ${esc(nome(r.to))}</h2>
            <p><b style="color:var(--lr-gold)">${esc(r.label)}</b></p>
            <p class="wbt-desc">${esc(r.summary || 'Sem resumo registrado.')}</p>
            <div class="wbt-actions">
                <button class="btn btn-secondary" id="relEdit">✏️ Editar</button>
                <button class="btn btn-danger" id="relDel">🗑️ Excluir</button>
            </div>`);
        document.getElementById('relEdit').onclick = () => openEdgeForm(r);
        document.getElementById('relDel').onclick = async () => {
            if (!confirm('Excluir este vínculo?')) return;
            await deleteDoc(doc(db, 'worldbuilding-relations', r.id));
            await loadAll(); ToolModal.close(); draw();
        };
    }

    /* ══════════════ Formulário de aresta ══════════════ */
    function openEdgeForm(existing = null) {
        const tipos = TIPOS_REL[modo];
        let pool;
        if (modo === 'factions') pool = (WB().data.factions || []).map(f => ({ ref: f.id, nome: f.nome }));
        else if (modo === 'lineage') pool = (lineageAtual?.members || []).map(m => ({ ref: m.ref, nome: findPersona(m.ref)?.nome || m.nome }));
        else pool = personagens().map(p => ({ ref: nodeRef(p), nome: p.nome }));

        if (!pool || pool.length < 2) {
            WB().showAlert(modo === 'lineage' ? 'Adicione ao menos dois membros à linhagem.' : 'Cadastre ao menos duas entidades.', 'warning');
            return;
        }
        const r = existing || {
            id: uid('rel'), graph: modo, from: pool[0].ref, to: pool[1].ref,
            label: '', kind: Object.keys(tipos)[0], directed: modo !== 'factions', summary: '',
            ...(modo === 'lineage' ? { lineageId: lineageAtual.id } : {}),
        };
        const opts = (sel) => pool.map(p => `<option value="${p.ref}" ${p.ref === sel ? 'selected' : ''}>${esc(p.nome)}</option>`).join('');
        ToolModal.open(`
            <h2>${existing ? 'Editar vínculo' : 'Novo vínculo'}</h2>
            <div class="wbt-form">
                <div class="wbt-row2">
                    <label>De <select id="rlFrom" class="form-select">${opts(r.from)}</select></label>
                    <label>Para <select id="rlTo" class="form-select">${opts(r.to)}</select></label>
                </div>
                <label>Rótulo (livre)
                    <input id="rlLabel" class="form-input" value="${esc(r.label)}" placeholder='"Pai de", "Tratado do Sal"…'></label>
                <label>Tipo
                    <select id="rlKind" class="form-select">${Object.entries(tipos).map(([k, v]) => `<option value="${k}" ${k === r.kind ? 'selected' : ''}>${v.label}</option>`).join('')}</select></label>
                <label>Direção
                    <select id="rlDir" class="form-select">
                        <option value="1" ${r.directed ? 'selected' : ''}>Direcional (A → B)</option>
                        <option value="0" ${!r.directed ? 'selected' : ''}>Mútua (A ⇄ B)</option></select></label>
                <label>Resumo <textarea id="rlSummary" class="form-textarea">${esc(r.summary)}</textarea></label>
                <div class="wbt-actions"><button class="btn btn-success" id="rlSave">💾 Salvar</button></div>
            </div>`);
        document.getElementById('rlSave').onclick = async () => {
            r.from = document.getElementById('rlFrom').value;
            r.to = document.getElementById('rlTo').value;
            if (r.from === r.to) { WB().showAlert('Escolha dois diferentes.', 'warning'); return; }
            r.kind = document.getElementById('rlKind').value;
            r.label = document.getElementById('rlLabel').value.trim() || tipos[r.kind].label;
            r.directed = document.getElementById('rlDir').value === '1';
            r.summary = document.getElementById('rlSummary').value.trim();
            const { id, ...data } = r;
            await setDoc(doc(db, 'worldbuilding-relations', id), data);
            await loadAll(); ToolModal.close(); draw();
        };
    }

    /* ══════════════ LINHAGENS ══════════════ */
    /* Opções do seletor de membros, já filtradas por um termo de busca. */
    function memberOptions(pool, query = '') {
        const q = query.trim().toLowerCase();
        const list = q
            ? pool.filter(p => (p.nome || '').toLowerCase().includes(q)
                || (p.descricao || '').toLowerCase().includes(q))
            : pool;
        if (!list.length) return `<option value="" disabled>Nenhum resultado para “${esc(query)}”</option>`;
        return list.map(p =>
            `<option value="${nodeRef(p)}">${p.ehJogador ? '🎭' : '👥'} ${esc(p.nome || 'Sem nome')}${p.descricao ? ` — ${esc(p.descricao)}` : ''}</option>`).join('');
    }

    function openLineageEditor(lin = null) {
        const l = lin || { id: uid('lin'), nome: '', descricao: '', cor: '#D4AF37', brasao: '', members: [] };
        const todos = personagens();
        ToolModal.open(`
            <h2>${lin ? '⚜️ Editar linhagem' : '⚜️ Nova linhagem familiar'}</h2>
            <div class="wbt-form">
                <label>Nome da Casa/Linhagem <input id="linNome" class="form-input" value="${esc(l.nome)}" placeholder="Ex: Casa Vondiir, Clã Pedra-Negra"></label>
                <label>Descrição <textarea id="linDesc" class="form-textarea" placeholder="Origem, lema, brasão…">${esc(l.descricao)}</textarea></label>
                <label>Cor da linhagem <input id="linCor" class="wbt-input wbt-input--color" type="color" value="${esc(l.cor || '#D4AF37')}"></label>
                <div class="wbt-brasao-field">
                    <div class="wbt-brasao-preview" id="linBrasaoPreview">${l.brasao ? `<img src="${esc(l.brasao)}" alt="brasão">` : '<span class="wbt-muted">sem brasão</span>'}</div>
                    <div>
                        <label>Brasão da Casa
                            <input id="linBrasaoFile" type="file" accept="image/*" class="form-input">
                        </label>
                        <input id="linBrasaoUrl" class="form-input" value="${esc(l.brasao || '')}" placeholder="…ou cole uma URL de imagem">
                        <p class="wbt-muted">Envie uma imagem (fica salva na linhagem) ou use uma URL.</p>
                    </div>
                </div>
                <h3 class="wbt-subhead">Membros (${(l.members || []).length})</h3>
                <div id="linMembers" class="wbt-member-list">${renderMembers(l)}</div>
                <label>Adicionar membro
                    <input id="linAddSearch" class="form-input" type="search" placeholder="🔍 Buscar NPC ou personagem…" autocomplete="off" style="margin-bottom:.4rem">
                    <select id="linAdd" class="form-select" size="1">
                        <option value="">— escolher NPC ou personagem —</option>
                        ${memberOptions(todos, '')}
                    </select></label>
                <p class="wbt-muted">💡 Clique em 📅 num membro para definir nascimento/morte no calendário do mundo — isso alimenta a Linha do Tempo geracional.</p>
                <div class="wbt-actions">
                    ${lin ? '<button class="btn btn-danger" id="linDel">🗑️ Excluir linhagem</button>' : ''}
                    <button class="btn btn-success" id="linSave">💾 Salvar linhagem</button>
                </div>
            </div>`);

        // estado local editável
        let members = [...(l.members || [])];
        let brasao = l.brasao || '';
        const redraw = () => { document.getElementById('linMembers').innerHTML = renderMembers({ members }); bindMemberBtns(); };
        const bindMemberBtns = () => {
            document.querySelectorAll('[data-delmember]').forEach(b =>
                b.onclick = () => { members = members.filter(m => m.ref !== b.dataset.delmember); redraw(); });
            document.querySelectorAll('[data-datemember]').forEach(b =>
                b.onclick = () => openMemberDate(members.find(m => m.ref === b.dataset.datemember), redraw));
        };
        bindMemberBtns();

        // brasão: upload → base64
        document.getElementById('linBrasaoFile').onchange = (e) => {
            const file = e.target.files[0]; if (!file) return;
            if (file.size > 900 * 1024) { WB().showAlert('Imagem muito grande (máx. ~900 KB). Otimize antes.', 'warning'); return; }
            const reader = new FileReader();
            reader.onload = () => {
                brasao = reader.result;
                document.getElementById('linBrasaoPreview').innerHTML = `<img src="${brasao}" alt="brasão">`;
                document.getElementById('linBrasaoUrl').value = '';
            };
            reader.readAsDataURL(file);
        };
        document.getElementById('linBrasaoUrl').oninput = (e) => {
            brasao = e.target.value.trim();
            document.getElementById('linBrasaoPreview').innerHTML = brasao ? `<img src="${esc(brasao)}" alt="brasão">` : '<span class="wbt-muted">sem brasão</span>';
        };

        // Busca dentro do seletor de membros: reconstrói as opções ao digitar.
        const addSel = document.getElementById('linAdd');
        const addSearch = document.getElementById('linAddSearch');
        if (addSearch) {
            addSearch.oninput = () => {
                const q = addSearch.value;
                addSel.innerHTML = `<option value="">— escolher NPC ou personagem —</option>${memberOptions(todos, q)}`;
                // Abre a lista automaticamente quando há um termo (melhor no desktop).
                if (q) { addSel.size = Math.min(8, addSel.options.length); }
                else { addSel.size = 1; }
            };
            addSearch.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); addSel.focus(); } };
        }
        addSel.onchange = (e) => {
            const ref = e.target.value; if (!ref) return;
            if (!members.find(m => m.ref === ref)) {
                const p = findPersona(ref);
                members.push({ ref, fonte: ref.split(':')[0], id: ref.split(':')[1], nome: p?.nome || '', nascimento: null, morte: null });
                redraw();
            }
            e.target.value = '';
            e.target.size = 1;
            if (addSearch) addSearch.value = '';
            addSel.innerHTML = `<option value="">— escolher NPC ou personagem —</option>${memberOptions(todos, '')}`;
        };
        document.getElementById('linSave').onclick = async () => {
            l.nome = document.getElementById('linNome').value.trim() || 'Linhagem sem nome';
            l.descricao = document.getElementById('linDesc').value.trim();
            l.cor = document.getElementById('linCor').value;
            l.brasao = brasao;
            l.members = members;
            const { id, ...data } = l;
            await setDoc(doc(db, 'worldbuilding-lineages', id), data);
            await loadAll();
            lineageAtual = lineages.find(x => x.id === l.id) || l;
            ToolModal.close(); render();
        };
        const del = document.getElementById('linDel');
        if (del) del.onclick = async () => {
            if (!confirm('Excluir esta linhagem? Os NPCs continuam existindo; só o agrupamento é removido.')) return;
            await deleteDoc(doc(db, 'worldbuilding-lineages', l.id));
            await loadAll(); lineageAtual = null; ToolModal.close(); render();
        };
    }

    /* Datar nascimento/morte de um membro no calendário do mundo. */
    function openMemberDate(member, onDone) {
        if (!member) return;
        const nb = member.nascimento || { ano: Calendario.eras()[0]?.anoInicio ?? 0, mes: 0, dia: 1 };
        const mb = member.morte || { ano: '', mes: 0, dia: 1 };
        ToolModal.open(`
            <span class="wbt-kind">📅 Datas de ${esc(findPersona(member.ref)?.nome || member.nome)}</span>
            <h2>Nascimento &amp; Morte</h2>
            <div class="wbt-form">
                <h3 class="wbt-subhead">🌱 Nascimento</h3>
                <div class="wbt-row2">
                    <label>Ano <input id="nbAno" class="form-input" type="number" value="${nb.ano}"></label>
                    <label>Dia <input id="nbDia" class="form-input" type="number" min="1" value="${nb.dia || 1}"></label>
                </div>
                <label>Mês <select id="nbMes" class="form-select">${Calendario.monthOptions(nb.mes || 0)}</select></label>
                <h3 class="wbt-subhead">⚰️ Morte <span class="wbt-muted">(deixe o ano vazio se ainda vivo)</span></h3>
                <div class="wbt-row2">
                    <label>Ano <input id="mbAno" class="form-input" type="number" value="${mb.ano}"></label>
                    <label>Dia <input id="mbDia" class="form-input" type="number" min="1" value="${mb.dia || 1}"></label>
                </div>
                <label>Mês <select id="mbMes" class="form-select">${Calendario.monthOptions(mb.mes || 0)}</select></label>
                <div class="wbt-actions">
                    <button class="btn btn-secondary" id="mdClear">Limpar datas</button>
                    <button class="btn btn-success" id="mdSave">💾 Salvar datas</button>
                </div>
            </div>`);
        document.getElementById('mdSave').onclick = () => {
            const nbAno = document.getElementById('nbAno').value;
            member.nascimento = nbAno === '' ? null : {
                ano: +nbAno, mes: +document.getElementById('nbMes').value,
                dia: Math.max(1, +document.getElementById('nbDia').value || 1),
            };
            const mbAno = document.getElementById('mbAno').value;
            member.morte = mbAno === '' ? null : {
                ano: +mbAno, mes: +document.getElementById('mbMes').value,
                dia: Math.max(1, +document.getElementById('mbDia').value || 1),
            };
            ToolModal.close(); onDone && onDone();
        };
        document.getElementById('mdClear').onclick = () => {
            member.nascimento = null; member.morte = null;
            ToolModal.close(); onDone && onDone();
        };
    }

    function renderMembers(l) {
        const ms = l.members || [];
        if (!ms.length) return '<p class="wbt-muted">Nenhum membro ainda.</p>';
        return ms.map(m => {
            const p = findPersona(m.ref);
            const icon = m.fonte === 'char' ? '🎭' : '👥';
            const datas = m.nascimento
                ? `<span class="wbt-member-dates">✦ ${m.nascimento.ano}${m.morte ? ` – ${m.morte.ano}` : ' –'}</span>`
                : '';
            return `<div class="wbt-member">${icon} ${esc(p?.nome || m.nome || '?')} ${datas}
                <button class="wbt-x" data-datemember="${m.ref}" title="Datar nascimento/morte">📅</button>
                <button class="wbt-x" data-delmember="${m.ref}" title="Remover">✕</button></div>`;
        }).join('');
    }

    /* ══════════════ Render da view ══════════════ */
    function render() {
        setTitle('🕸️ Grafos de Conexão');
        const segBtn = (m, label) => `<button class="wbt-seg__btn ${modo === m ? 'is-active' : ''}" data-modo="${m}">${label}</button>`;

        let toolbarExtra = '';
        if (modo === 'lineage') {
            toolbarExtra = `
                <select id="linSelect" class="form-select">
                    <option value="">— escolher linhagem —</option>
                    ${lineages.map(l => `<option value="${l.id}" ${lineageAtual?.id === l.id ? 'selected' : ''}>⚜️ ${esc(l.nome)}</option>`).join('')}
                </select>
                <button class="btn btn-secondary" id="linNew">➕ Nova linhagem</button>
                ${lineageAtual ? '<button class="btn btn-secondary" id="linEdit">✏️ Editar / membros</button>' : ''}`;
        }

        contentBody().innerHTML = `
            <div class="wbt-toolbar">
                <div class="wbt-seg">
                    ${segBtn('lineage', '⚜️ Linhagens Familiares')}
                    ${segBtn('genealogy', '👥 Visão Geral de Personagens')}
                    ${segBtn('factions', '⚔️ Teia de Tribos')}
                </div>
                <span style="flex:1"></span>
                ${toolbarExtra}
                ${modo !== 'lineage' || lineageAtual ? '<button class="btn btn-secondary" id="gAddEdge">➕ Vínculo</button>' : ''}
                <button class="btn btn-secondary" id="gFit">🎯 Centralizar</button>
            </div>
            <div class="wbt-graph-wrap">
                <div id="grafoCanvas" class="wbt-graph"></div>
                <div class="wbt-graph-legend" id="grafoLegend"></div>
            </div>
            <p class="wbt-muted" style="margin-top:.6rem">${hint()}</p>`;

        document.querySelectorAll('[data-modo]').forEach(b => b.onclick = () => { modo = b.dataset.modo; render(); });
        const fit = document.getElementById('gFit'); if (fit) fit.onclick = () => network?.fit({ animation: true });
        const addEdge = document.getElementById('gAddEdge'); if (addEdge) addEdge.onclick = () => openEdgeForm();

        if (modo === 'lineage') {
            const sel = document.getElementById('linSelect');
            if (sel) sel.onchange = (e) => { lineageAtual = lineages.find(l => l.id === e.target.value) || null; render(); };
            const nw = document.getElementById('linNew'); if (nw) nw.onclick = () => openLineageEditor(null);
            const ed = document.getElementById('linEdit'); if (ed) ed.onclick = () => openLineageEditor(lineageAtual);
        }
        requestAnimationFrame(draw);
    }

    function hint() {
        if (modo === 'lineage') return lineageAtual
            ? 'Nós verdes = personagens de jogador; azuis = NPCs. Clique num nó para a ficha; "➕ Vínculo" para ligar membros ("Pai de", "Herdeiro de").'
            : 'Crie uma linhagem e adicione NPCs e/ou personagens de jogador a ela.';
        if (modo === 'factions') return 'Nós são as Tribos reais. Clique numa linha para o tratado/conflito.';
        return 'Visão geral de todos os NPCs (azul) e personagens de jogador (verde) e seus vínculos.';
    }

    return {
        async render() { await loadAll(); render(); },
        openLineageById(id) {
            modo = 'lineage';
            lineageAtual = lineages.find(l => l.id === id) || null;
            render();
        },
    };
})();
