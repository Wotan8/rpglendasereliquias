// =============================================
// AREA MESAS — Sessão (página única: preparo → ao vivo → colheita)
// Um doc por sessão em mesas/{id}/sessoes com ciclo de fase.
// Preparo: início forte, cenas prováveis, segredos, encontros salvos.
// Ao vivo: revelar segredo, marcar cena, capturar inbox, iniciar encontro
//          (1 write em tabuleiro-meta/combate — o mesmo doc que o Tabuleiro
//          e o Painel já assinam; nenhum canal novo de sync).
// Colheita: frentes avançam/recuam (computeAvanco compartilhado), resumo,
//           fase 'fechada'. Segredos não revelados herdam para a próxima.
// =============================================
import { db, collection, getDocs, getDoc, doc, addDoc, updateDoc, setDoc, query, where, orderBy, limit } from './firebase-config.js';
import * as S from './state.js';
import { comCena, comCenaNova } from '../../shared/combate-cenas.js';
import { showAlert, escapeHtml } from './ui-utils.js';
import { computeAvanco } from './area-mesas-frentes.js';

window._loadMesaSessao = loadMesaSessao;

let _sessao = null;          // doc aberto (fase preparo/aoVivo) ou null
let _charsMesa = null;       // cache por mesa (docs completos p/ montar vitais)
let _charsMesaId = null;
let _npcsAll = null;         // catálogo p/ encontros (docs completos)
let _encTemp = null;         // encontro em edição no modal
let _canvases = null;        // canvases do Tabuleiro (cena → mapa)
let _canvasesMesaId = null;

const refSessoes = () => collection(db, 'mesas', S.currentMesaId, 'sessoes');
const refFrentes = () => collection(db, 'mesas', S.currentMesaId, 'frentes');
const refSessao = () => doc(refSessoes(), _sessao.id);
const uid = (p) => p + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);

async function loadMesaSessao() {
    if (!S.currentMesaId) return;
    const el = document.getElementById('mesaSessaoAtual'); if (!el) return;
    el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted)">Carregando sessão...</div>';
    try {
        const snap = await getDocs(query(refSessoes(), where('fase', 'in', ['preparo', 'aoVivo'])));
        _sessao = null;
        snap.forEach(d => { if (!_sessao) _sessao = { id: d.id, ...d.data() }; });
        if (!_sessao) renderVazio();
        else if (_sessao.fase === 'preparo') await renderPreparo();
        else renderAoVivo();
    } catch (e) { console.error(e); showAlert('❌ Erro ao carregar sessão', 'danger'); }
}

// ===== SEM SESSÃO ABERTA =====
function renderVazio() {
    const el = document.getElementById('mesaSessaoAtual');
    el.onchange = null;   // handler de auto-save é só da fase de preparo
    el.innerHTML = `<div style="text-align:center;padding:50px;color:var(--muted)">
        <div style="font-size:2.5rem;margin-bottom:12px">🎬</div>
        Nenhuma sessão em preparo.<br>
        <button class="btn btn-success" style="margin-top:16px" onclick="sesCriar()">➕ Preparar próxima sessão</button>
        <div style="font-size:.75rem;margin-top:10px">Segredos não revelados da sessão anterior entram sozinhos no novo preparo.</div>
    </div>`;
}

window.sesCriar = async function() {
    try {
        let numero = 1; const herdados = [];
        const last = await getDocs(query(refSessoes(), orderBy('numero', 'desc'), limit(1)));
        if (!last.empty) {
            const d = last.docs[0].data();
            numero = (d.numero || 0) + 1;
            (d.segredos || []).forEach(s => { if (!s.revelado) herdados.push({ ...s, herdado: true }); });
        }
        await addDoc(refSessoes(), {
            numero, fase: 'preparo',
            dataReal: new Date().toISOString().split('T')[0], dataJogo: '',
            inicioForte: '', cenas: [], segredos: herdados, encontros: [],
            recompensas: '', inbox: [], colheita: [], resumo: '', createdAt: Date.now(),
        });
        await loadMesaSessao();
    } catch (e) { showAlert('❌ Erro: ' + e.message, 'danger'); }
};

// ===== FASE 1 — PREPARO =====
async function renderPreparo() {
    const el = document.getElementById('mesaSessaoAtual');
    const s = _sessao;
    // Canvases do Tabuleiro p/ vincular cena → mapa (painel da sessão pula direto)
    if (!_canvases || _canvasesMesaId !== S.currentMesaId) {
        try {
            const cs = await getDocs(collection(db, 'mesas', S.currentMesaId, 'tabuleiros'));
            _canvases = []; cs.forEach(d => _canvases.push({ id: d.id, nome: d.data().nome || 'Canvas' }));
            _canvasesMesaId = S.currentMesaId;
        } catch { _canvases = []; }
    }
    // Caixa de entrada: presságios já disparados das frentes ativas = material da semana
    let pressagiosHtml = '';
    try {
        const fs = await getDocs(refFrentes());
        const itens = [];
        fs.forEach(d => {
            const f = d.data();
            if (f.status !== 'ativa') return;
            (f.pressagios || []).forEach(p => { if (p.ocorrido) itens.push(`<b>${escapeHtml(f.nome || '')}</b>: ${escapeHtml(p.texto || '')}`); });
        });
        if (itens.length) pressagiosHtml = `<div style="border:1px solid var(--primary);border-radius:8px;padding:10px 14px;margin-bottom:14px">
            <div style="font-size:.78rem;font-weight:700;color:var(--primary);margin-bottom:6px">🔔 Presságios já disparados — o mundo mostrou isto; use nas cenas</div>
            ${itens.map(t => `<div style="font-size:.82rem;color:var(--ink,var(--light));padding:2px 0">· ${t}</div>`).join('')}</div>`;
    } catch (e) { /* frentes vazias ou sem acesso: segue sem a caixa */ }

    const cenas = (s.cenas || []).map(c => cenaRowHtml(c)).join('');
    const segredos = (s.segredos || []).map(x => segredoRowHtml(x)).join('');
    const encontros = (s.encontros || []).map(enc => `
        <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
            <span style="flex:1;font-size:.88rem;color:var(--light)">⚔️ ${escapeHtml(enc.nome || 'Encontro')} <span style="color:var(--muted);font-size:.75rem">(${(enc.participantes || []).length} participante(s))</span></span>
            <button class="btn btn-secondary btn-small" onclick="sesEncontroModal('${enc.id}')">✏️</button>
            <button class="btn btn-danger btn-small" onclick="sesEncontroExcluir('${enc.id}')">✕</button>
        </div>`).join('');

    el.innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px">
            <span style="font-size:1.05rem;font-weight:800;color:var(--light)">📋 Preparo</span>
            <label style="font-size:.78rem;color:var(--muted)">Sessão nº <input type="number" class="form-input" id="ses_num" value="${s.numero || 1}" min="1" style="width:70px;text-align:center;padding:4px"></label>
            <label style="font-size:.78rem;color:var(--muted)">Data real <input type="date" class="form-input" id="ses_dataReal" value="${escapeHtml(s.dataReal || '')}" style="width:150px;padding:4px"></label>
            <label style="font-size:.78rem;color:var(--muted)">Data no jogo <input type="text" class="form-input" id="ses_dataJogo" value="${escapeHtml(s.dataJogo || '')}" placeholder="Ex: 15 de Aura" style="width:160px;padding:4px"></label>
            <span style="margin-left:auto;display:flex;gap:8px">
                <button class="btn btn-secondary btn-small" onclick="sesSalvarPreparo()">💾 Salvar</button>
                <button class="btn btn-success btn-small" onclick="sesIniciar()">▶️ Iniciar sessão</button>
            </span>
        </div>
        ${pressagiosHtml}
        <div class="form-group"><label class="form-label">🔥 Início forte (a cena de abertura, já em movimento)</label>
            <textarea class="form-textarea" id="ses_inicio" rows="2" placeholder="Nada de taverna: comece no meio da ação ou da decisão.">${escapeHtml(s.inicioForte || '')}</textarea></div>
        <div class="form-group"><label class="form-label">🎬 Cenas prováveis (lista solta, não sequência)</label>
            <div id="ses_cenas">${cenas}</div>
            <button class="btn btn-secondary btn-small" onclick="sesAddCena()" style="margin-top:6px">➕ Cena</button></div>
        <div class="form-group"><label class="form-label">🗝️ Segredos e pistas (revele em qualquer cena; mire 7–10)</label>
            <div id="ses_segredos">${segredos}</div>
            <button class="btn btn-secondary btn-small" onclick="sesAddSegredo()" style="margin-top:6px">➕ Segredo</button></div>
        <div class="form-group"><label class="form-label">⚔️ Encontros salvos</label>
            <div id="ses_encontros">${encontros || '<div style="font-size:.8rem;color:var(--muted)">Nenhum encontro montado</div>'}</div>
            <button class="btn btn-secondary btn-small" onclick="sesEncontroModal()" style="margin-top:6px">➕ Encontro</button></div>
        <div class="form-group"><label class="form-label">💰 Recompensas planejadas</label>
            <textarea class="form-textarea" id="ses_recompensas" rows="2" placeholder="Loot, favores, informações...">${escapeHtml(s.recompensas || '')}</textarea></div>`;
    // Auto-save por delegação: 'change' borbulha de qualquer input/textarea,
    // inclusive linhas adicionadas depois. Sem isto, qualquer re-render
    // (trocar sub-aba, salvar encontro) descartava o que não passou pelo 💾.
    el.onchange = () => window.sesSalvarPreparo(true);
}

function cenaRowHtml(c) {
    const opts = (_canvases || []).map(cv => `<option value="${cv.id}" ${c?.canvasId === cv.id ? 'selected' : ''}>${escapeHtml(cv.nome)}</option>`).join('');
    return `<div class="ses-cena-row" data-id="${c?.id || ''}" style="display:flex;gap:6px;margin-bottom:6px">
        <input type="text" class="form-input ses-cena-titulo" value="${escapeHtml(c?.titulo || '')}" placeholder="Título da cena" style="width:220px">
        <input type="text" class="form-input ses-cena-notas" value="${escapeHtml(c?.notas || '')}" placeholder="Notas curtas (quem, onde, o que pode dar errado)" style="flex:1">
        ${opts ? `<select class="form-select ses-cena-mapa" title="Mapa do Tabuleiro desta cena" style="width:150px"><option value="">🗺️ — mapa —</option>${opts}</select>` : ''}
        <button class="btn btn-danger btn-small" onclick="this.closest('.ses-cena-row').remove();sesSalvarPreparo(true)">✕</button></div>`;
}
function segredoRowHtml(x) {
    return `<div class="ses-seg-row" style="display:flex;gap:6px;margin-bottom:6px;align-items:center" data-id="${x?.id || ''}">
        ${x?.herdado ? '<span title="Herdado da sessão anterior" style="font-size:.72rem;color:var(--primary);font-weight:700">↪</span>' : ''}
        <input type="text" class="form-input ses-seg-texto" value="${escapeHtml(x?.texto || '')}" placeholder="Um fato que os jogadores podem descobrir" style="flex:1">
        <button class="btn btn-danger btn-small" onclick="this.closest('.ses-seg-row').remove();sesSalvarPreparo(true)">✕</button></div>`;
}
window.sesAddCena = () => document.getElementById('ses_cenas')?.insertAdjacentHTML('beforeend', cenaRowHtml(null));
window.sesAddSegredo = () => document.getElementById('ses_segredos')?.insertAdjacentHTML('beforeend', segredoRowHtml(null));

function coletarPreparo() {
    if (!document.getElementById('ses_cenas')) return null;   // DOM de preparo não está na tela
    const cenasAntigas = new Map((_sessao.cenas || []).map(x => [x.id, x]));
    const cenas = [];
    document.querySelectorAll('#ses_cenas .ses-cena-row').forEach(r => {
        const titulo = r.querySelector('.ses-cena-titulo')?.value?.trim();
        const notas = r.querySelector('.ses-cena-notas')?.value?.trim() || '';
        if (!titulo) return;
        const velho = cenasAntigas.get(r.dataset.id);
        const canvasId = r.querySelector('.ses-cena-mapa')?.value || '';
        cenas.push({ id: velho?.id || uid('cena'), titulo, notas, canvasId, feita: velho?.feita || false });
    });
    const antigos = new Map((_sessao.segredos || []).map(x => [x.id, x]));
    const segredos = [];
    document.querySelectorAll('#ses_segredos .ses-seg-row').forEach(r => {
        const texto = r.querySelector('.ses-seg-texto')?.value?.trim();
        if (!texto) return;
        const velho = antigos.get(r.dataset.id);
        segredos.push({ id: velho?.id || uid('seg'), texto, revelado: velho?.revelado || false, herdado: velho?.herdado || false });
    });
    return {
        numero: parseInt(document.getElementById('ses_num')?.value) || _sessao.numero || 1,
        dataReal: document.getElementById('ses_dataReal')?.value || '',
        dataJogo: document.getElementById('ses_dataJogo')?.value?.trim() || '',
        inicioForte: document.getElementById('ses_inicio')?.value?.trim() || '',
        recompensas: document.getElementById('ses_recompensas')?.value?.trim() || '',
        cenas, segredos,
    };
}

window.sesSalvarPreparo = async function(silencioso) {
    try {
        const dados = coletarPreparo();
        if (!dados) return;
        await updateDoc(refSessao(), dados);
        Object.assign(_sessao, dados);
        if (!silencioso) showAlert('✅ Preparo salvo', 'success');
    } catch (e) { showAlert('❌ Erro: ' + e.message, 'danger'); }
};

window.sesIniciar = async function() {
    await window.sesSalvarPreparo(true);
    try {
        await updateDoc(refSessao(), { fase: 'aoVivo', iniciadaEm: Date.now() });
        _sessao.fase = 'aoVivo';
        renderAoVivo();
    } catch (e) { showAlert('❌ Erro: ' + e.message, 'danger'); }
};

// ===== FASE 2 — AO VIVO =====
function renderAoVivo() {
    const el = document.getElementById('mesaSessaoAtual');
    el.onchange = null;   // sem auto-save aqui: coletarPreparo leria um DOM que não existe
    const s = _sessao;
    const cenas = (s.cenas || []).map((c, i) => `
        <label style="display:flex;align-items:center;gap:8px;padding:4px 0;cursor:pointer;font-size:.88rem">
            <input type="checkbox" ${c.feita ? 'checked' : ''} onchange="sesCenaFeita(${i}, this.checked)" style="width:16px;height:16px">
            <span style="color:${c.feita ? 'var(--muted)' : 'var(--light)'};${c.feita ? 'text-decoration:line-through' : ''}">${escapeHtml(c.titulo)}</span>
            <span style="font-size:.75rem;color:var(--muted)">${escapeHtml(c.notas || '')}</span>
        </label>`).join('') || '<div style="font-size:.8rem;color:var(--muted)">Sem cenas preparadas</div>';
    const segredos = (s.segredos || []).map(x => `
        <div style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:.88rem">
            <span style="flex:1;color:${x.revelado ? 'var(--muted)' : 'var(--light)'};${x.revelado ? 'text-decoration:line-through' : ''}">🗝️ ${escapeHtml(x.texto)}</span>
            ${x.revelado ? '' : `<button class="btn btn-success btn-small" onclick="sesRevelar('${x.id}', false)">✅ Revelar</button>
            <button class="btn btn-primary btn-small" onclick="sesRevelar('${x.id}', true)" title="Revela e exibe no teleprompter do Tabuleiro">🎬 No telão</button>`}
        </div>`).join('') || '<div style="font-size:.8rem;color:var(--muted)">Sem segredos preparados</div>';
    const encontros = (s.encontros || []).map(enc => `
        <div style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:.88rem">
            <span style="flex:1;color:var(--light)">⚔️ ${escapeHtml(enc.nome || 'Encontro')} <span style="color:var(--muted);font-size:.75rem">(${(enc.participantes || []).length})</span></span>
            <button class="btn btn-danger btn-small" onclick="sesEncontroIniciar('${enc.id}')">▶️ Iniciar</button>
        </div>`).join('') || '<div style="font-size:.8rem;color:var(--muted)">Sem encontros salvos</div>';
    const inbox = (s.inbox || []).slice().reverse().map(x =>
        `<div style="font-size:.82rem;color:var(--ink,var(--light));padding:2px 0">· ${escapeHtml(x.texto)}</div>`).join('');

    el.innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px">
            <span style="font-size:1.05rem;font-weight:800;color:var(--light)">🎬 Sessão ${s.numero} — ao vivo</span>
            ${s.dataJogo ? `<span style="font-size:.78rem;color:var(--primary)">🎮 ${escapeHtml(s.dataJogo)}</span>` : ''}
            <span style="margin-left:auto;display:flex;gap:8px">
                <button class="btn btn-secondary btn-small" onclick="sesVoltarPreparo()" title="Voltar à edição do preparo">✏️ Preparo</button>
                <button class="btn btn-warning btn-small" onclick="sesColheitaModal()">🏁 Encerrar sessão</button>
            </span>
        </div>
        ${s.inicioForte ? `<div style="border-left:3px solid var(--primary);padding:8px 14px;margin-bottom:14px;font-size:.9rem;color:var(--ink,var(--light))">🔥 ${escapeHtml(s.inicioForte)}</div>` : ''}
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:18px">
            <div><div class="form-label">🎬 Cenas</div>${cenas}</div>
            <div><div class="form-label">🗝️ Segredos</div>${segredos}</div>
            <div><div class="form-label">⚔️ Encontros</div>${encontros}
                ${s.recompensas ? `<div class="form-label" style="margin-top:12px">💰 Recompensas</div><div style="font-size:.82rem;color:var(--muted)">${escapeHtml(s.recompensas)}</div>` : ''}</div>
        </div>
        <div style="margin-top:18px;border-top:1px solid var(--border);padding-top:12px">
            <div class="form-label">📥 Captura rápida (Enter grava — triagem na colheita)</div>
            <input type="text" class="form-input" id="ses_inbox_input" placeholder="Um fato, uma promessa, um nome... uma linha"
                onkeydown="if(event.key==='Enter')sesInboxAdd(this)">
            <div id="ses_inbox_lista" style="margin-top:8px;max-height:160px;overflow-y:auto">${inbox}</div>
        </div>`;
}

window.sesVoltarPreparo = async function() {
    try { await updateDoc(refSessao(), { fase: 'preparo' }); _sessao.fase = 'preparo'; await renderPreparo(); }
    catch (e) { showAlert('❌ Erro: ' + e.message, 'danger'); }
};

window.sesCenaFeita = async function(i, feita) {
    const cenas = (_sessao.cenas || []).map(c => ({ ...c }));
    if (!cenas[i]) return;
    cenas[i].feita = feita;
    try { await updateDoc(refSessao(), { cenas }); _sessao.cenas = cenas; renderAoVivo(); }
    catch (e) { showAlert('❌ Erro: ' + e.message, 'danger'); }
};

window.sesRevelar = async function(segId, telao) {
    const segredos = (_sessao.segredos || []).map(x => ({ ...x }));
    const seg = segredos.find(x => x.id === segId); if (!seg) return;
    seg.revelado = true; seg.reveladoEm = Date.now();
    try {
        await updateDoc(refSessao(), { segredos });
        _sessao.segredos = segredos;
        if (telao) {
            // Mesmo doc do teleprompter do Tabuleiro (tabuleiro-meta/legenda)
            await setDoc(doc(db, 'mesas', S.currentMesaId, 'tabuleiro-meta', 'legenda'),
                { texto: seg.texto, vel: 24, ativo: true, t: Date.now() }, { merge: true });
            showAlert('🎬 Segredo revelado no telão', 'success');
        } else showAlert('🗝️ Segredo revelado', 'success');
        renderAoVivo();
    } catch (e) { showAlert('❌ Erro: ' + e.message, 'danger'); }
};

window.sesInboxAdd = async function(input) {
    const texto = input.value.trim(); if (!texto) return;
    const inbox = [...(_sessao.inbox || []), { texto, t: Date.now() }];
    input.value = '';
    try {
        await updateDoc(refSessao(), { inbox });
        _sessao.inbox = inbox;
        document.getElementById('ses_inbox_lista').innerHTML = inbox.slice().reverse().map(x =>
            `<div style="font-size:.82rem;color:var(--ink,var(--light));padding:2px 0">· ${escapeHtml(x.texto)}</div>`).join('');
    } catch (e) { showAlert('❌ Erro: ' + e.message, 'danger'); }
};

// ===== ENCONTROS SALVOS =====
async function carregarCatalogos() {
    if (!_charsMesa || _charsMesaId !== S.currentMesaId) {
        const snap = await getDocs(query(collection(db, 'char'), where('mesaId', '==', S.currentMesaId)));
        _charsMesa = []; snap.forEach(d => _charsMesa.push({ id: d.id, ...d.data() }));
        _charsMesaId = S.currentMesaId;
    }
    if (!_npcsAll) {
        const snap = await getDocs(collection(db, 'npcs'));
        _npcsAll = []; snap.forEach(d => _npcsAll.push({ id: d.id, ...d.data() }));
        _npcsAll.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    }
}

// Participantes no MESMO formato de tabuleiro-meta/combate (combat.js) —
// "iniciar" vira um único setDoc e os listeners existentes fazem o resto.
function participanteDeChar(c) {
    const f = c.fields || {}, d = c.dots || {};
    const vitMax = c.hpMax || ((d.vig || c.vig || 1) + (d.tamanho || c.tamanho || 5));
    const enerMax = c.enerMax || ((d.prs || c.prs || 1) + (d.aut || c.aut || 1));
    const sanMax = c.sanMax || 100;
    return {
        id: uid('char'), characterId: c.id, name: f.nome || c.nome || 'Sem nome', type: 'Jogador',
        initiative: 0, details: `${f.raca || c.raca || '-'} - ${f.classe || c.classe || '-'}`,
        hpCurrent: c.hpCurrent !== undefined ? c.hpCurrent : vitMax, hpMax: vitMax,
        enerCurrent: c.enerCurrent !== undefined ? c.enerCurrent : enerMax, enerMax,
        sanCurrent: c.sanCurrent !== undefined ? c.sanCurrent : sanMax, sanMax,
    };
}
function participanteDeNpc(n) {
    const vd = n.valoresDer || {}, atual = vd.atual || {};
    const vitMax = vd.VIT || 10, enerMax = vd.ENER || 5, sanMax = vd.SAN || 100;
    return {
        id: uid('npc'), npcId: n.id, name: n.nome || 'NPC', type: n.tipo === 'criatura' ? 'Criatura' : 'NPC',
        initiative: 0, details: `${n.raca || 'N/A'} | ${n.papel || '-'}`, isNpc: true,
        hpCurrent: (atual.VIT ?? null) !== null ? Math.min(atual.VIT, vitMax) : vitMax, hpMax: vitMax,
        enerCurrent: (atual.ENER ?? null) !== null ? Math.min(atual.ENER, enerMax) : enerMax, enerMax,
        sanCurrent: (atual.SAN ?? null) !== null ? Math.min(atual.SAN, sanMax) : sanMax, sanMax,
    };
}

window.sesEncontroModal = async function(encId) {
    try { await carregarCatalogos(); } catch (e) { showAlert('❌ Erro ao carregar personagens/NPCs', 'danger'); return; }
    const enc = encId ? (_sessao.encontros || []).find(x => x.id === encId) : null;
    _encTemp = enc ? JSON.parse(JSON.stringify(enc)) : { id: uid('enc'), nome: '', participantes: [] };
    const optsChar = _charsMesa.map(c => `<option value="${c.id}">${escapeHtml(c.fields?.nome || c.nome || 'Sem nome')}</option>`).join('');
    const optsNpc = _npcsAll.map(n => `<option value="${n.id}">${escapeHtml(n.nome || 'Sem nome')} (${n.tipo || 'NPC'})</option>`).join('');
    const m = document.createElement('div'); m.className = 'modal active'; m.id = 'sesEncModal';
    m.innerHTML = `<div class="modal-content" style="max-width:680px"><div class="modal-header"><span class="modal-title">⚔️ ${enc ? 'Editar' : 'Novo'} Encontro</span><button class="modal-close" onclick="this.closest('.modal').remove()">✕</button></div><div class="modal-body" style="max-height:75vh;overflow-y:auto">
        <div class="form-group"><label class="form-label">Nome *</label><input type="text" class="form-input" id="enc_nome" value="${escapeHtml(_encTemp.nome)}" placeholder="Ex: Emboscada na estrada"></div>
        <div class="form-group"><label class="form-label">Participantes</label><div id="enc_lista"></div></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;border-top:1px solid var(--border);padding-top:10px">
            <div><label class="form-label" style="font-size:.75rem">🎭 Jogador</label>
                <div style="display:flex;gap:6px"><select class="form-select" id="enc_selChar" style="flex:1">${optsChar || '<option value="">—</option>'}</select>
                <button class="btn btn-success btn-small" onclick="sesEncAddChar()">➕</button></div></div>
            <div><label class="form-label" style="font-size:.75rem">👹 NPC/Criatura</label>
                <div style="display:flex;gap:6px"><select class="form-select" id="enc_selNpc" style="flex:1">${optsNpc || '<option value="">—</option>'}</select>
                <button class="btn btn-success btn-small" onclick="sesEncAddNpc()">➕</button></div></div>
        </div>
        <div style="display:flex;gap:6px;align-items:end;margin-top:10px">
            <div style="flex:1"><label class="form-label" style="font-size:.75rem">Inimigo avulso</label><input type="text" class="form-input" id="enc_custNome" placeholder="Nome"></div>
            <div><label class="form-label" style="font-size:.75rem">❤️VIT</label><input type="number" class="form-input" id="enc_custVit" value="10" style="width:70px;text-align:center"></div>
            <div><label class="form-label" style="font-size:.75rem">🔥ENER</label><input type="number" class="form-input" id="enc_custEner" value="5" style="width:70px;text-align:center"></div>
            <div><label class="form-label" style="font-size:.75rem">🧠SAN</label><input type="number" class="form-input" id="enc_custSan" value="50" style="width:70px;text-align:center"></div>
            <button class="btn btn-success btn-small" onclick="sesEncAddCustom()">➕</button>
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px">
            <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancelar</button>
            <button class="btn btn-success" onclick="sesEncontroSalvar()">💾 Salvar Encontro</button></div>
    </div></div>`;
    document.body.appendChild(m);
    sesEncRenderLista();
};

function sesEncRenderLista() {
    const el = document.getElementById('enc_lista'); if (!el) return;
    el.innerHTML = (_encTemp.participantes || []).map((p, i) => `
        <div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid var(--border);font-size:.85rem">
            <span style="flex:1;color:var(--light)">${escapeHtml(p.name)} <span style="color:var(--muted);font-size:.72rem">${p.type} · ❤️${p.hpMax} 🔥${p.enerMax} 🧠${p.sanMax}</span></span>
            <label style="font-size:.72rem;color:var(--muted)">Inic. <input type="number" class="form-input" value="${p.initiative || 0}" onchange="_encTempInit(${i}, this.value)" style="width:60px;text-align:center;padding:3px"></label>
            <button class="btn btn-danger btn-small" onclick="sesEncRemover(${i})">✕</button>
        </div>`).join('') || '<div style="font-size:.8rem;color:var(--muted)">Ninguém ainda — adicione abaixo</div>';
}
window._encTempInit = (i, v) => { if (_encTemp.participantes[i]) _encTemp.participantes[i].initiative = parseInt(v) || 0; };
window.sesEncRemover = (i) => { _encTemp.participantes.splice(i, 1); sesEncRenderLista(); };
window.sesEncAddChar = function() {
    const c = _charsMesa.find(x => x.id === document.getElementById('enc_selChar')?.value);
    if (c) { _encTemp.participantes.push(participanteDeChar(c)); sesEncRenderLista(); }
};
window.sesEncAddNpc = function() {
    const n = _npcsAll.find(x => x.id === document.getElementById('enc_selNpc')?.value);
    if (n) { _encTemp.participantes.push(participanteDeNpc(n)); sesEncRenderLista(); }
};
window.sesEncAddCustom = function() {
    const nome = document.getElementById('enc_custNome')?.value?.trim();
    if (!nome) { showAlert('⚠️ Nome do inimigo', 'warning'); return; }
    const vit = parseInt(document.getElementById('enc_custVit')?.value) || 10;
    const ener = parseInt(document.getElementById('enc_custEner')?.value) || 5;
    const san = parseInt(document.getElementById('enc_custSan')?.value) || 50;
    _encTemp.participantes.push({
        id: uid('custom'), name: nome, type: 'Inimigo', initiative: 0, details: 'Personalizado', isCustom: true,
        hpCurrent: vit, hpMax: vit, enerCurrent: ener, enerMax: ener, sanCurrent: san, sanMax: san,
    });
    document.getElementById('enc_custNome').value = '';
    sesEncRenderLista();
};

window.sesEncontroSalvar = async function() {
    const nome = document.getElementById('enc_nome')?.value?.trim();
    if (!nome) { showAlert('⚠️ Nome obrigatório', 'warning'); return; }
    // O re-render abaixo redesenha o preparo a partir do doc — salvar antes
    // para não descartar cenas/segredos digitados e ainda não persistidos
    if (_sessao.fase === 'preparo') await window.sesSalvarPreparo(true);
    _encTemp.nome = nome;
    const encontros = (_sessao.encontros || []).filter(x => x.id !== _encTemp.id);
    encontros.push(_encTemp);
    try {
        await updateDoc(refSessao(), { encontros });
        _sessao.encontros = encontros;
        document.getElementById('sesEncModal')?.remove();
        showAlert('✅ Encontro salvo', 'success');
        if (_sessao.fase === 'preparo') await renderPreparo(); else renderAoVivo();
    } catch (e) { showAlert('❌ Erro: ' + e.message, 'danger'); }
};

window.sesEncontroExcluir = async function(encId) {
    if (!confirm('Excluir este encontro?')) return;
    if (_sessao.fase === 'preparo') await window.sesSalvarPreparo(true);
    const encontros = (_sessao.encontros || []).filter(x => x.id !== encId);
    try {
        await updateDoc(refSessao(), { encontros });
        _sessao.encontros = encontros;
        if (_sessao.fase === 'preparo') await renderPreparo(); else renderAoVivo();
    } catch (e) { showAlert('❌ Erro: ' + e.message, 'danger'); }
};

window.sesEncontroIniciar = async function(encId) {
    const enc = (_sessao.encontros || []).find(x => x.id === encId); if (!enc) return;
    if (!confirm(`Iniciar "${enc.nome}"? Isto abre uma cena de combate com o nome do encontro.`)) return;
    try {
        // O encontro vira uma CENA nova (as outras continuam armadas). Precisa do
        // doc atual para não derrubar as cenas existentes — uma leitura, e só
        // quando o mestre inicia um encontro de verdade.
        const ref = doc(db, 'mesas', S.currentMesaId, 'tabuleiro-meta', 'combate');
        const atual = (await getDoc(ref)).data() || null;
        const novo = comCenaNova(atual, 'enc-' + encId, enc.nome || 'Encontro');
        await setDoc(ref, {
            ...comCena(novo, 'enc-' + encId, { participantes: enc.participantes || [] }),
            atualizadoEm: Date.now(),
        }, { merge: true });
        if (window._loadCombatFromMesa) window._loadCombatFromMesa();
        showAlert('⚔️ Encontro iniciado — combate sincronizado com o Tabuleiro', 'success');
    } catch (e) { showAlert('❌ Erro: ' + e.message, 'danger'); }
};

// ===== FASE 3 — COLHEITA =====
window.sesColheitaModal = async function() {
    let frentes = [];
    try {
        const snap = await getDocs(refFrentes());
        snap.forEach(d => { const f = d.data(); if (f.status === 'ativa') frentes.push({ id: d.id, ...f }); });
    } catch (e) { /* sem frentes: colheita só fecha a sessão */ }
    const inbox = (_sessao.inbox || []).map(x =>
        `<div style="font-size:.82rem;color:var(--ink,var(--light));padding:2px 0">· ${escapeHtml(x.texto)}</div>`).join('');
    const linhas = frentes.map(f => {
        const r = f.relogio || {};
        return `<div class="ses-colheita-frente" data-id="${f.id}" style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border);flex-wrap:wrap">
            <span style="min-width:160px;font-weight:700;color:var(--light);font-size:.88rem">${escapeHtml(f.nome)} <span style="color:var(--muted);font-weight:400">${Math.min(r.cheias || 0, r.fatias || 6)}/${r.fatias || 6}</span></span>
            <span style="display:flex;gap:10px;font-size:.8rem">
                <label style="cursor:pointer"><input type="radio" name="delta-${f.id}" value="-1"> ↩️ recuou</label>
                <label style="cursor:pointer"><input type="radio" name="delta-${f.id}" value="0" checked> ➖ estável</label>
                <label style="cursor:pointer"><input type="radio" name="delta-${f.id}" value="1"> ⏭️ avançou</label>
            </span>
            <input type="text" class="form-input ses-colheita-motivo" placeholder="Motivo (se mexeu)" style="flex:1;min-width:160px;padding:4px">
        </div>`;
    }).join('');
    const m = document.createElement('div'); m.className = 'modal active'; m.id = 'sesColheitaModal';
    m.innerHTML = `<div class="modal-content" style="max-width:720px"><div class="modal-header"><span class="modal-title">🏁 Colheita — Sessão ${_sessao.numero}</span><button class="modal-close" onclick="this.closest('.modal').remove()">✕</button></div><div class="modal-body" style="max-height:75vh;overflow-y:auto">
        ${inbox ? `<div class="form-group"><label class="form-label">📥 Capturado ao vivo (use no resumo e nas frentes)</label>${inbox}</div>` : ''}
        ${linhas ? `<div class="form-group"><label class="form-label">🕰️ Frentes — o mundo reagiu?</label>${linhas}
            <div style="font-size:.72rem;color:var(--muted);margin-top:6px">Regra da casa: frente ignorada avança. Presságios cruzados disparam e aparecem no próximo preparo.</div></div>` : ''}
        <div class="form-group"><label class="form-label">📝 Resumo da sessão</label>
            <textarea class="form-textarea" id="col_resumo" rows="5" placeholder="O que aconteceu...">${escapeHtml(_sessao.resumo || '')}</textarea></div>
        <div style="font-size:.75rem;color:var(--muted);margin-bottom:12px">⭐ EXP: use o modo +EXP em Personagens ou o fluxo de distribuição por rubrica, como hoje.</div>
        <div style="display:flex;gap:10px;justify-content:flex-end">
            <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Voltar</button>
            <button class="btn btn-warning" onclick="sesColheitaConfirmar()">🏁 Fechar sessão</button></div>
    </div></div>`;
    document.body.appendChild(m);
    m._frentes = frentes;
};

window.sesColheitaConfirmar = async function() {
    const modal = document.getElementById('sesColheitaModal'); if (!modal) return;
    const frentes = modal._frentes || [];
    const colheita = []; const disparadosTodos = [];
    try {
        for (const row of modal.querySelectorAll('.ses-colheita-frente')) {
            const id = row.dataset.id;
            const delta = parseInt(row.querySelector(`input[name="delta-${id}"]:checked`)?.value) || 0;
            if (!delta) continue;
            const f = frentes.find(x => x.id === id); if (!f) continue;
            const motivo = row.querySelector('.ses-colheita-motivo')?.value?.trim() || '';
            const mov = computeAvanco(f, delta, `Sessão ${_sessao.numero}${motivo ? ': ' + motivo : ''}`);
            if (!mov) continue;
            await updateDoc(doc(refFrentes(), id), mov.patch);
            colheita.push({ frenteId: id, nome: f.nome || '', delta, motivo });
            disparadosTodos.push(...mov.disparados);
        }
        await updateDoc(refSessao(), {
            fase: 'fechada', fechadaEm: Date.now(), colheita,
            resumo: document.getElementById('col_resumo')?.value?.trim() || '',
        });
        modal.remove();
        if (disparadosTodos.length) showAlert('🔔 Presságio disparado: ' + disparadosTodos.join(' · '), 'warning');
        else showAlert(`✅ Sessão ${_sessao.numero} fechada`, 'success');
        _sessao = null;
        await loadMesaSessao();
    } catch (e) { showAlert('❌ Erro: ' + e.message, 'danger'); }
};
