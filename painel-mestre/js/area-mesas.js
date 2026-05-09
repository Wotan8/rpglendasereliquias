// =============================================
// ÁREA MESAS — Mesa Selection, Auth, Players, Characters, EXP
// =============================================
import { db, collection, getDocs, getDoc, setDoc, deleteDoc, doc, addDoc, updateDoc, query, where } from './firebase-config.js';
import * as S from './state.js';
import { showAlert, escapeHtml } from './ui-utils.js';
import { addLog } from './logs.js';
import { renderCombatList } from './combat.js';

export async function onTabActivated() { await loadMesas(); }

// ===== MESA SUB-TAB SWITCHING =====
window.switchMesaSubTab = function(subTabName) {
    const container = document.getElementById('mesa-content');
    if (!container) return;
    container.querySelectorAll('.sub-tab-btn').forEach(b => b.classList.remove('active'));
    container.querySelectorAll('.sub-tab-content').forEach(c => c.classList.remove('active'));
    const btn = container.querySelector(`[data-subtab="${subTabName}"]`);
    const content = document.getElementById(`subtab-${subTabName}`);
    if (btn) btn.classList.add('active');
    if (content) content.classList.add('active');
    // Trigger load on subtab activation
    if (subTabName === 'm-personagens') loadMesaCharacters();
    if (subTabName === 'm-jogadores') loadMesaPlayers();
    if (subTabName === 'm-sessoes' && window._loadSessionLogs) window._loadSessionLogs();
    if (subTabName === 'm-config' && window._loadMesaConfig) window._loadMesaConfig();
    if (subTabName === 'm-npcs' && window._loadMesaNpcs) window._loadMesaNpcs();
    if (subTabName === 'm-inventario' && window._loadMesaInventarios) window._loadMesaInventarios();
    if (subTabName === 'm-notas' && window._loadMesaNotas) window._loadMesaNotas();
};

// ===== SCREEN MANAGEMENT =====
function showScreen(screenId) {
    ['mesa-selection-screen','mesa-auth-screen','mesa-content'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = id === screenId ? '' : 'none';
    });
}

// ===== LOAD MESAS =====
async function loadMesas() {
    try {
        const snap = await getDocs(collection(db, 'mesas'));
        const mesas = []; snap.forEach(d => mesas.push({ id: d.id, ...d.data() }));
        S.setAllMesas(mesas);
        renderMesaList();
    } catch (e) { console.error('❌ Erro mesas:', e); showAlert('❌ Erro ao carregar mesas', 'danger'); }
}
window.loadMesas = loadMesas;

function renderMesaList() {
    const grid = document.getElementById('mesasGrid'); if (!grid) return;
    if (!S.allMesas.length) {
        grid.innerHTML = '<div style="text-align:center;padding:50px;color:var(--muted);grid-column:1/-1"><div style="font-size:2.5rem;margin-bottom:12px">🎲</div>Nenhuma mesa criada.<br>Clique em "+ Criar Mesa" para começar.</div>';
        return;
    }
    grid.innerHTML = S.allMesas.map(m => `
        <div class="mesa-card" onclick="selectMesa('${m.id}')">
            <div class="mesa-card-name">🎲 ${escapeHtml(m.nome || 'Sem nome')}</div>
            <div class="mesa-card-desc">👥 ${(m.jogadores||[]).length} jogador(es)</div>
            <div class="mesa-card-desc" style="font-size:.75rem;margin-top:4px">Criada em ${m.createdAt ? new Date(m.createdAt).toLocaleDateString('pt-BR') : '-'}</div>
        </div>`).join('');
}

// ===== CREATE MESA =====
window.openCreateMesaModal = function() {
    const m = document.createElement('div'); m.className = 'modal active'; m.id = 'createMesaModal';
    m.innerHTML = `<div class="modal-content" style="max-width:500px"><div class="modal-header"><span class="modal-title">➕ Criar Mesa</span><button class="modal-close" onclick="this.closest('.modal').remove()">✕</button></div><div class="modal-body">
        <div class="form-group"><label class="form-label">Nome da Mesa *</label><input type="text" class="form-input" id="cm_nome" placeholder="Ex: Campanha das Sombras"></div>
        <div class="form-group"><label class="form-label">Senha *</label><input type="password" class="form-input" id="cm_senha" placeholder="Senha para acessar a mesa"></div>
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px"><button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancelar</button><button class="btn btn-success" onclick="createMesa()">✅ Criar</button></div>
    </div></div>`;
    document.body.appendChild(m);
};

window.createMesa = async function() {
    const nome = document.getElementById('cm_nome')?.value?.trim();
    const senha = document.getElementById('cm_senha')?.value?.trim();
    if (!nome || !senha) { showAlert('⚠️ Preencha nome e senha', 'warning'); return; }
    try {
        await addDoc(collection(db, 'mesas'), { nome, senha, jogadores: [], createdAt: new Date().toISOString(), createdBy: S.currentUser?.email, config: { textoIntroducao: '', expInicial: 100 } });
        showAlert('✅ Mesa criada!', 'success');
        document.getElementById('createMesaModal')?.remove();
        await loadMesas();
    } catch (e) { showAlert('❌ Erro: ' + e.message, 'danger'); }
};

// ===== SELECT & AUTH =====
window.selectMesa = function(mesaId) {
    const mesa = S.allMesas.find(m => m.id === mesaId);
    if (!mesa) return;
    S.setCurrentMesaId(mesaId);
    S.setCurrentMesaData(mesa);
    document.getElementById('mesaAuthName').textContent = mesa.nome;
    document.getElementById('mesaPasswordInput').value = '';
    showScreen('mesa-auth-screen');
};

window.backToMesaList = function() { showScreen('mesa-selection-screen'); };

window.authenticateMesa = function() {
    const pwd = document.getElementById('mesaPasswordInput')?.value;
    if (!S.currentMesaData) return;
    if (pwd !== S.currentMesaData.senha) { showAlert('❌ Senha incorreta', 'danger'); return; }
    openMesa();
};

function openMesa() {
    document.getElementById('mesaContentName').textContent = '🎲 ' + (S.currentMesaData?.nome || '');
    showScreen('mesa-content');
    // Reset to first subtab
    switchMesaSubTab('m-jogadores');
    loadMesaPlayers();
}

window.closeMesa = function() {
    S.setCurrentMesaId(null);
    S.setCurrentMesaData(null);
    S.setMesaCharacters([]);
    S.setIsExpMode(false);
    showScreen('mesa-selection-screen');
    loadMesas();
};

// ===== DELETE MESA =====
window.openDeleteMesaModal = function() {
    if (!S.currentMesaId) return;
    const m = document.createElement('div'); m.className = 'modal active';
    m.innerHTML = `<div class="modal-content" style="max-width:500px;border:3px solid var(--danger)"><div class="modal-header" style="background:linear-gradient(135deg,var(--danger),#dc2626)"><span class="modal-title" style="color:#fff">⚠️ Deletar Mesa</span><button class="modal-close" onclick="this.closest('.modal').remove()">✕</button></div><div class="modal-body">
        <div style="color:#f87171;font-weight:700;margin-bottom:14px;text-align:center">Esta ação é IRREVERSÍVEL!</div>
        <p style="text-align:center;margin-bottom:20px">Mesa: <strong>${escapeHtml(S.currentMesaData?.nome)}</strong></p>
        <div style="display:flex;gap:10px;justify-content:flex-end"><button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancelar</button><button class="btn btn-danger" onclick="confirmDeleteMesa()">🗑️ DELETAR</button></div>
    </div></div>`;
    document.body.appendChild(m);
};

window.confirmDeleteMesa = async function() {
    if (!S.currentMesaId) return;
    try {
        await deleteDoc(doc(db, 'mesas', S.currentMesaId));
        showAlert('✅ Mesa deletada', 'success');
        document.querySelector('.modal.active')?.remove();
        window.closeMesa();
    } catch (e) { showAlert('❌ Erro: ' + e.message, 'danger'); }
};

// ===== PLAYERS =====
async function loadMesaPlayers() {
    if (!S.currentMesaData) return;
    const jogadorUids = S.currentMesaData.jogadores || [];
    const el = document.getElementById('mesaPlayersList'); if (!el) return;
    if (!jogadorUids.length) { el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted);grid-column:1/-1">Nenhum jogador vinculado</div>'; return; }
    try {
        const snap = await getDocs(collection(db, 'users'));
        const allUsers = []; snap.forEach(d => allUsers.push({ id: d.id, ...d.data() }));
        const linked = allUsers.filter(u => jogadorUids.includes(u.uid || u.id));
        if (!linked.length) { el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted);grid-column:1/-1">Nenhum jogador encontrado</div>'; return; }
        el.innerHTML = linked.map(u => `
            <div class="player-card">
                <div class="player-avatar">👤</div>
                <div class="player-info">
                    <div class="player-name">${escapeHtml(u.nome || u.displayName || u.email || u.id)}</div>
                    <div class="player-email">${escapeHtml(u.email || '')}</div>
                </div>
                <button class="btn btn-danger btn-small" onclick="unlinkPlayer('${u.uid || u.id}')">✕</button>
            </div>`).join('');
    } catch (e) { showAlert('❌ Erro ao carregar jogadores', 'danger'); }
}

window.openLinkPlayerModal = async function() {
    try {
        const snap = await getDocs(collection(db, 'users'));
        const users = []; snap.forEach(d => users.push({ id: d.id, ...d.data() }));
        const linked = S.currentMesaData?.jogadores || [];
        const available = users.filter(u => !linked.includes(u.uid || u.id));
        if (!available.length) { showAlert('⚠️ Todos os jogadores já estão vinculados', 'warning'); return; }
        const opts = available.map(u => `<option value="${u.uid || u.id}">${escapeHtml(u.nome || u.displayName || u.email || u.id)}</option>`).join('');
        const m = document.createElement('div'); m.className = 'modal active'; m.id = 'linkPlayerModal';
        m.innerHTML = `<div class="modal-content" style="max-width:500px"><div class="modal-header"><span class="modal-title">➕ Vincular Jogador</span><button class="modal-close" onclick="this.closest('.modal').remove()">✕</button></div><div class="modal-body">
            <div class="form-group"><label class="form-label">Jogador</label><select class="form-select" id="lp_uid">${opts}</select></div>
            <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px"><button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancelar</button><button class="btn btn-success" onclick="linkPlayer()">✅ Vincular</button></div>
        </div></div>`;
        document.body.appendChild(m);
    } catch (e) { showAlert('❌ Erro', 'danger'); }
};

window.linkPlayer = async function() {
    const uid = document.getElementById('lp_uid')?.value;
    if (!uid || !S.currentMesaId) return;
    try {
        const jogadores = [...(S.currentMesaData.jogadores || []), uid];
        await updateDoc(doc(db, 'mesas', S.currentMesaId), { jogadores });
        S.currentMesaData.jogadores = jogadores;
        showAlert('✅ Jogador vinculado!', 'success');
        document.getElementById('linkPlayerModal')?.remove();
        await loadMesaPlayers();
    } catch (e) { showAlert('❌ Erro: ' + e.message, 'danger'); }
};

window.unlinkPlayer = async function(uid) {
    if (!S.currentMesaId || !confirm('Desvincular este jogador?')) return;
    try {
        const jogadores = (S.currentMesaData.jogadores || []).filter(id => id !== uid);
        await updateDoc(doc(db, 'mesas', S.currentMesaId), { jogadores });
        S.currentMesaData.jogadores = jogadores;
        showAlert('✅ Jogador desvinculado', 'success');
        await loadMesaPlayers();
    } catch (e) { showAlert('❌ Erro: ' + e.message, 'danger'); }
};

// ===== CHARACTERS =====
async function loadMesaCharacters() {
    if (!S.currentMesaId) return;
    try {
        const snap = await getDocs(collection(db, 'characters'));
        const chars = []; snap.forEach(d => { const data = d.data(); if (data.mesaId === S.currentMesaId) chars.push({ id: d.id, ...data }); });
        // Also include chars whose ownerUid is in mesa jogadores and have no mesaId
        const jogadores = S.currentMesaData?.jogadores || [];
        snap.forEach(d => { const data = d.data(); if (!data.mesaId && jogadores.includes(data.ownerUid) && !chars.find(c => c.id === d.id)) chars.push({ id: d.id, ...data }); });
        S.setMesaCharacters(chars);
        displayMesaCharacters();
    } catch (e) { console.error(e); showAlert('❌ Erro ao carregar personagens', 'danger'); }
}

function displayMesaCharacters() {
    const grid = document.getElementById('mesaCharactersGrid'); if (!grid) return;
    const chars = S.mesaCharacters;
    if (!chars.length) { grid.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted);grid-column:1/-1">Nenhum personagem nesta mesa</div>'; return; }
    const expMode = S.isExpMode;
    grid.innerHTML = chars.map(c => {
        const vitMax = (c.vig||1) + (c.tamanho||5), enerMax = c.aut||1;
        const hasImg = c.characterImage?.length > 0;
        const imgH = hasImg ? `<div style="width:100%;height:140px;background-image:url('${c.characterImage}');background-size:cover;background-position:center;border-radius:10px 10px 0 0;border-bottom:1px solid var(--border)"></div>` : '';
        const expInput = expMode ? `<div style="margin:8px 0" onclick="event.stopPropagation()"><input type="number" class="form-input exp-individual-input" data-char-id="${c.id}" placeholder="EXP" value="0" min="0" style="width:80px;text-align:center;padding:6px"></div>` : '';
        return `<div class="player-card" onclick="openCharacter('${c.id}')" style="display:block;padding:0;overflow:hidden;cursor:pointer">
            ${imgH}<div style="padding:14px">
            ${expInput}
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                <span style="font-weight:800;color:var(--light);font-size:1.05rem">${escapeHtml(c.nome||'Sem nome')}</span>
                <span style="background:var(--primary-glow);color:var(--primary);padding:3px 10px;border-radius:8px;font-weight:800;font-size:.85rem">${c.auraImortalidade||1}</span>
            </div>
            <div style="font-size:.82rem;color:var(--muted);margin-bottom:8px">👤 ${escapeHtml(c.jogador||'-')} | ⚔️ ${c.classe||'-'} | 🎭 ${c.raca||'-'}</div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">
                <div class="stat-box"><div class="stat-label">❤️ VIT</div><div class="stat-value" style="font-size:.88rem">${c.hpCurrent||vitMax}/${vitMax}</div></div>
                <div class="stat-box"><div class="stat-label">⚡ ENER</div><div class="stat-value" style="font-size:.88rem">${c.enerCurrent||enerMax}/${enerMax}</div></div>
                <div class="stat-box"><div class="stat-label">⭐ EXP</div><div class="stat-value" style="font-size:.88rem">${c.exp||0}</div></div>
            </div>
        </div></div>`;
    }).join('');
}

window.openCharacter = function(id) { window.open(`../ficha-v1.7_1/ficha.html?id=${id}`, '_blank'); };

// ===== EXP MODE =====
window.toggleExpMode = function() {
    S.setIsExpMode(!S.isExpMode);
    const actions = document.getElementById('expBulkActions');
    const btn = document.getElementById('btnToggleExp');
    if (actions) actions.style.display = S.isExpMode ? 'flex' : 'none';
    if (btn) btn.style.display = S.isExpMode ? 'none' : '';
    displayMesaCharacters();
};

window.applyExpBulk = async function(isAdd) {
    const inputs = document.querySelectorAll('.exp-individual-input');
    if (!inputs.length) return;
    let count = 0;
    for (const input of inputs) {
        const v = parseInt(input.value) || 0;
        if (v <= 0) continue;
        const charId = input.dataset.charId;
        const c = S.mesaCharacters.find(x => x.id === charId);
        if (!c) continue;
        const newExp = isAdd ? (c.exp||0) + v : Math.max(0, (c.exp||0) - v);
        const newExpTotal = isAdd ? (c.exp_total||0) + v : Math.max(0, (c.exp_total||0) - v);
        await updateDoc(doc(db, 'characters', charId), { exp: newExp, exp_total: newExpTotal });
        await addLog(S.currentUser?.email, `${isAdd?'+':'-'}${v} EXP`, c.nome, 'characters');
        // Send notification to player
        if (c.ownerUid) {
            try {
                const userRef = doc(db, 'users', c.ownerUid);
                const userDoc = await getDoc(userRef);
                if (userDoc.exists()) {
                    const notifs = userDoc.data().notifications || [];
                    notifs.push({ message: `${isAdd?'Ganhou':'Perdeu'} ${v} EXP em ${c.nome}!`, highlight: 'importante', from: S.currentUser?.email||'Mestre', date: new Date().toISOString(), read: false });
                    await updateDoc(userRef, { notifications: notifs });
                }
            } catch (ne) { console.warn('Notif error:', ne); }
        }
        count++;
    }
    if (count > 0) {
        showAlert(`✅ EXP ${isAdd?'adicionado':'removido'} de ${count} personagem(s)`, 'success');
        S.setIsExpMode(false);
        document.getElementById('expBulkActions').style.display = 'none';
        document.getElementById('btnToggleExp').style.display = '';
        await loadMesaCharacters();
    } else { showAlert('⚠️ Nenhum valor preenchido', 'warning'); }
};

// ===== MESA NOTIFICATIONS =====
window.openMesaNotificationModal = async function() {
    if (!S.currentMesaData) return;
    const jogadorUids = S.currentMesaData.jogadores || [];
    if (!jogadorUids.length) { showAlert('⚠️ Nenhum jogador vinculado', 'warning'); return; }
    try {
        const snap = await getDocs(collection(db, 'users'));
        const users = []; snap.forEach(d => users.push({ id: d.id, ...d.data() }));
        const linked = users.filter(u => jogadorUids.includes(u.uid || u.id));
        const m = document.createElement('div'); m.className = 'modal active'; m.id = 'mesaNotifModal';
        m.innerHTML = `<div class="modal-content" style="max-width:600px"><div class="modal-header"><span class="modal-title">📢 Notificar Jogadores</span><button class="modal-close" onclick="this.closest('.modal').remove()">✕</button></div><div class="modal-body">
            <div class="form-group"><label class="form-label">Mensagem *</label><textarea class="form-textarea" id="mn_msg" rows="4" placeholder="Digite a mensagem..."></textarea></div>
            <div class="form-group"><label class="form-label">Destaque</label><div style="display:flex;gap:12px"><label style="cursor:pointer;display:flex;align-items:center;gap:6px"><input type="radio" name="mnHighlight" value="normal" checked> Normal</label><label style="cursor:pointer;display:flex;align-items:center;gap:6px"><input type="radio" name="mnHighlight" value="importante"> Importante</label><label style="cursor:pointer;display:flex;align-items:center;gap:6px"><input type="radio" name="mnHighlight" value="urgente"> Urgente</label></div></div>
            <div class="form-group"><label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" id="mn_selectAll" onchange="document.querySelectorAll('.mn-cb').forEach(c=>c.checked=this.checked)" style="width:18px;height:18px"> <span class="form-label" style="margin:0">Selecionar Todos</span></label></div>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px;max-height:200px;overflow-y:auto">
                ${linked.map(u => `<label style="display:flex;align-items:center;gap:8px;padding:8px;border-radius:8px;cursor:pointer;border:1px solid var(--border)"><input type="checkbox" class="mn-cb" value="${u.uid||u.id}" style="width:16px;height:16px"><span style="font-size:.88rem;color:var(--light)">${escapeHtml(u.nome||u.email||u.id)}</span></label>`).join('')}
            </div>
            <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:20px"><button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancelar</button><button class="btn btn-primary" onclick="sendMesaNotification()">📤 Enviar</button></div>
        </div></div>`;
        document.body.appendChild(m);
    } catch (e) { showAlert('❌ Erro', 'danger'); }
};

window.sendMesaNotification = async function() {
    const msg = document.getElementById('mn_msg')?.value?.trim();
    if (!msg) { showAlert('⚠️ Mensagem vazia', 'warning'); return; }
    const hl = document.querySelector('input[name="mnHighlight"]:checked')?.value || 'normal';
    const sel = Array.from(document.querySelectorAll('.mn-cb:checked')).map(c => c.value);
    if (!sel.length) { showAlert('⚠️ Selecione destinatários', 'warning'); return; }
    try {
        for (const uid of sel) {
            const r = doc(db, 'users', uid); const d = await getDoc(r); if (!d.exists()) continue;
            const n = d.data().notifications || [];
            n.push({ message: msg, highlight: hl, from: S.currentUser?.email||'Mestre', date: new Date().toISOString(), read: false });
            await updateDoc(r, { notifications: n });
        }
        showAlert(`✅ Enviada a ${sel.length} jogador(es)`, 'success');
        document.getElementById('mesaNotifModal')?.remove();
    } catch (e) { showAlert('❌ Erro', 'danger'); }
};
