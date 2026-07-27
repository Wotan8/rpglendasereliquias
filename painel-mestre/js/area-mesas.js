// =============================================
// ÁREA MESAS — Mesa Selection, Auth, Players, Characters, EXP
// =============================================
import { db, collection, getDocs, getDoc, setDoc, deleteDoc, doc, addDoc, updateDoc, query, where } from './firebase-config.js';
import * as S from './state.js';
import { showAlert, escapeHtml } from './ui-utils.js';
import { addLog } from './logs.js';
import { notifyUsers } from './notify.js';
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
    if (subTabName === 'm-logs' && window._loadMesaLogs) window._loadMesaLogs();
    if (subTabName === 'm-combate' && window._loadCombatFromMesa) window._loadCombatFromMesa();
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
    // Carrega combate persistido (sincronizado com o Tabuleiro)
    if (window._loadCombatFromMesa) window._loadCombatFromMesa();
}

// ===== TABULEIRO (VTT) =====
window.openTabuleiro = function() {
    if (!S.currentMesaId) return;
    window.open(`../tabuleiro/tabuleiro.html?mesa=${S.currentMesaId}&mode=secret`, '_blank');
};

window.closeMesa = function() {
    if (window._stopMesaLogs) window._stopMesaLogs();
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

        // Count characters per player in this mesa
        const charSnap = await getDocs(query(collection(db, 'char'), where('mesaId', '==', S.currentMesaId)));
        const charCountMap = {};
        charSnap.forEach(d => {
            const data = d.data();
            const owner = data.ownerUid || '';
            charCountMap[owner] = (charCountMap[owner] || 0) + 1;
        });

        const limites = S.currentMesaData.limitePersonagens || {};
        const cfgDefault = S.currentMesaData.config?.limitePadraoPersonagens ?? 1;

        el.innerHTML = linked.map(u => {
            const uid = u.uid || u.id;
            const limit = limites[uid] ?? cfgDefault;
            const count = charCountMap[uid] || 0;
            return `
            <div class="player-card" style="display:flex;flex-wrap:wrap;gap:10px;align-items:center">
                <div class="player-avatar">👤</div>
                <div class="player-info" style="flex:1;min-width:120px">
                    <div class="player-name">${escapeHtml(u.nome || u.displayName || u.email || u.id)}</div>
                    <div class="player-email">${escapeHtml(u.email || '')}</div>
                    <div style="font-size:.75rem;color:var(--muted);margin-top:4px">🎭 ${count}/${limit} personagem(ns)</div>
                </div>
                <div style="display:flex;align-items:center;gap:6px" onclick="event.stopPropagation()">
                    <label style="font-size:.72rem;color:var(--muted);font-weight:700;white-space:nowrap">Máx. Personagens:</label>
                    <input type="number" class="form-input" value="${limit}" min="1" max="99" style="width:60px;text-align:center;padding:4px 6px;font-size:.85rem"
                        onchange="savePlayerLimit('${uid}', parseInt(this.value) || 1)">
                </div>
                <button class="btn btn-danger btn-small" onclick="unlinkPlayer('${uid}')">✕</button>
            </div>`;
        }).join('');
    } catch (e) { console.error(e); showAlert('❌ Erro ao carregar jogadores', 'danger'); }
}

window.savePlayerLimit = async function(uid, limit) {
    if (!S.currentMesaId || !S.currentMesaData) return;
    const limites = { ...(S.currentMesaData.limitePersonagens || {}) };
    limites[uid] = Math.max(1, limit);
    try {
        await updateDoc(doc(db, 'mesas', S.currentMesaId), { limitePersonagens: limites });
        S.currentMesaData.limitePersonagens = limites;
        showAlert('✅ Limite atualizado!', 'success');
    } catch (e) { showAlert('❌ Erro: ' + e.message, 'danger'); }
};

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
        const snap = await getDocs(query(collection(db, 'char'), where('mesaId', '==', S.currentMesaId)));
        const chars = [];
        snap.forEach(d => {
            chars.push({ id: d.id, ...d.data() });
        });
        S.setMesaCharacters(chars);
        displayMesaCharacters();
    } catch (e) { console.error(e); showAlert('❌ Erro ao carregar personagens', 'danger'); }
}

function displayMesaCharacters() {
    const grid = document.getElementById('mesaCharactersGrid'); if (!grid) return;
    const chars = S.mesaCharacters;
    if (!chars.length) { grid.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted);grid-column:1/-1">Nenhum personagem vinculado a esta mesa</div>'; return; }
    const expMode = S.isExpMode;
    grid.innerHTML = chars.map(c => {
        // Support both old top-level fields and new nested fields format
        const f = c.fields || {};
        const nome = f.nome || c.nome || 'Sem nome';
        const classe = f.classe || c.classe || '-';
        const raca = f.raca || c.raca || '-';
        const jogador = c.ownerEmail || c.jogador || '-';
        const exp = f.exp ?? c.exp ?? 0;
        const expTotal = f.exp_total ?? c.exp_total ?? 0;
        const hasImg = (c.charImg || c.characterImage || '')?.length > 0;
        const imgSrc = c.charImg || c.characterImage || '';
        const imgH = hasImg ? `<div style="width:100%;height:140px;background-image:url('${imgSrc}');background-size:cover;background-position:center;border-radius:10px 10px 0 0;border-bottom:1px solid var(--border)"></div>` : '';
        const expInput = expMode ? `<div style="margin:8px 0" onclick="event.stopPropagation()"><input type="number" class="form-input exp-individual-input" data-char-id="${c.id}" placeholder="EXP" value="0" min="0" style="width:80px;text-align:center;padding:6px"></div>` : '';
        return `<div class="player-card" onclick="openCharacter('${c.id}')" style="display:block;padding:0;overflow:hidden;cursor:pointer">
            ${imgH}<div style="padding:14px">
            ${expInput}
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                <span style="font-weight:800;color:var(--light);font-size:1.05rem">${escapeHtml(nome)}</span>
            </div>
            <div style="font-size:.82rem;color:var(--muted);margin-bottom:8px">👤 ${escapeHtml(jogador)} | ⚔️ ${escapeHtml(classe)} | 🎭 ${escapeHtml(raca)}</div>
            <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px">
                <div class="stat-box"><div class="stat-label">⭐ EXP Rest.</div><div class="stat-value" style="font-size:.88rem">${exp}</div></div>
                <div class="stat-box"><div class="stat-label">⭐ EXP Total</div><div class="stat-value" style="font-size:.88rem">${expTotal}</div></div>
            </div>
        </div></div>`;
    }).join('');
}

window.openCharacter = function(id) { window.open(`../ficha-v1.7_1/ficha-v1.7_1.html?id=${id}`, '_blank'); };

// ===== EXP MODE & INVENTORY MODE =====
window.toggleExpMode = function() {
    S.setIsExpMode(!S.isExpMode);
    const actions = document.getElementById('expBulkActions');
    const btn = document.getElementById('btnToggleExp');
    if (actions) actions.style.display = S.isExpMode ? 'flex' : 'none';
    if (btn) btn.style.display = S.isExpMode ? 'none' : '';
    displayMesaCharacters();
};

window.toggleMesaInventoryMode = async function() {
    try { await import('./area-mesas-inventario.js?v=' + Date.now()); } catch(e) { console.error('Erro ao importar inventario:', e); }

    const grid = document.getElementById('mesaCharactersGrid');
    const invContainer = document.getElementById('mesaCharactersInventoryContainer');
    const condContainer = document.getElementById('mesaCharactersConditionsContainer');
    const pecContainer = document.getElementById('mesaCharactersPeculiaridadesContainer');
    const btnInv = document.getElementById('btnToggleInventario');
    const btnCond = document.getElementById('btnToggleCondicoes');
    const btnPec = document.getElementById('btnTogglePeculiaridades');
    const btnExp = document.getElementById('btnToggleExp');
    
    // Default to empty or explicit none
    const isCurrentlyHidden = (invContainer.style.display === 'none' || invContainer.style.display === '');
    
    if (isCurrentlyHidden) {
        // Entra no modo inventário
        grid.style.display = 'none';
        invContainer.style.display = 'block';
        if (condContainer) condContainer.style.display = 'none';
        if (pecContainer) pecContainer.style.display = 'none';
        
        if (btnInv) {
            btnInv.classList.remove('btn-primary');
            btnInv.classList.add('btn-secondary');
            btnInv.textContent = 'Voltar para Personagens';
        }
        if (btnCond) {
            btnCond.classList.remove('btn-secondary');
            btnCond.classList.add('btn-primary');
            btnCond.textContent = '💀 Condições';
        }
        if (btnPec) {
            btnPec.classList.remove('btn-secondary');
            btnPec.classList.add('btn-primary');
            btnPec.textContent = '✨ Peculiaridades';
        }
        if (btnExp) btnExp.style.display = 'none';
        
        // Renderiza inventários (implementado em area-mesas-inventario.js)
        if (window._loadPersonagensInventario) {
            window._loadPersonagensInventario();
        }
    } else {
        // Sai do modo inventário
        grid.style.display = 'grid'; // Volta o grid pro padrao
        invContainer.style.display = 'none';
        if (btnInv) {
            btnInv.classList.remove('btn-secondary');
            btnInv.classList.add('btn-primary');
            btnInv.textContent = '🎒 Inventário';
        }
        if (btnExp) btnExp.style.display = '';
    }
};

window.toggleMesaConditionsMode = async function() {
    try { await import('./area-mesas-condicoes.js?v=' + Date.now()); } catch(e) { console.error('Erro ao importar condicoes:', e); }

    const grid = document.getElementById('mesaCharactersGrid');
    const invContainer = document.getElementById('mesaCharactersInventoryContainer');
    const condContainer = document.getElementById('mesaCharactersConditionsContainer');
    const pecContainer = document.getElementById('mesaCharactersPeculiaridadesContainer');
    const btnInv = document.getElementById('btnToggleInventario');
    const btnCond = document.getElementById('btnToggleCondicoes');
    const btnPec = document.getElementById('btnTogglePeculiaridades');
    const btnExp = document.getElementById('btnToggleExp');
    
    // Default to empty or explicit none
    const isCurrentlyHidden = (condContainer.style.display === 'none' || condContainer.style.display === '');
    
    if (isCurrentlyHidden) {
        // Entra no modo condições
        grid.style.display = 'none';
        condContainer.style.display = 'block';
        if (invContainer) invContainer.style.display = 'none';
        if (pecContainer) pecContainer.style.display = 'none';
        
        if (btnCond) {
            btnCond.classList.remove('btn-primary');
            btnCond.classList.add('btn-secondary');
            btnCond.textContent = 'Voltar para Personagens';
        }
        if (btnInv) {
            btnInv.classList.remove('btn-secondary');
            btnInv.classList.add('btn-primary');
            btnInv.textContent = '🎒 Inventário';
        }
        if (btnPec) {
            btnPec.classList.remove('btn-secondary');
            btnPec.classList.add('btn-primary');
            btnPec.textContent = '✨ Peculiaridades';
        }
        if (btnExp) btnExp.style.display = 'none';
        
        // Renderiza condições (implementado em area-mesas-condicoes.js)
        if (window._loadPersonagensCondicoes) {
            window._loadPersonagensCondicoes();
        }
    } else {
        // Sai do modo condições
        grid.style.display = 'grid'; // Volta o grid pro padrao
        condContainer.style.display = 'none';
        if (btnCond) {
            btnCond.classList.remove('btn-secondary');
            btnCond.classList.add('btn-primary');
            btnCond.textContent = '💀 Condições';
        }
        if (btnExp) btnExp.style.display = '';
    }
};

window.toggleMesaPeculiaridadesMode = async function() {
    try { await import('./area-mesas-peculiaridades.js?v=' + Date.now()); } catch(e) { console.error('Erro ao importar peculiaridades:', e); }

    const grid = document.getElementById('mesaCharactersGrid');
    const invContainer = document.getElementById('mesaCharactersInventoryContainer');
    const condContainer = document.getElementById('mesaCharactersConditionsContainer');
    const pecContainer = document.getElementById('mesaCharactersPeculiaridadesContainer');
    const btnInv = document.getElementById('btnToggleInventario');
    const btnCond = document.getElementById('btnToggleCondicoes');
    const btnPec = document.getElementById('btnTogglePeculiaridades');
    const btnExp = document.getElementById('btnToggleExp');
    
    const isCurrentlyHidden = (pecContainer.style.display === 'none' || pecContainer.style.display === '');
    
    if (isCurrentlyHidden) {
        // Entra no modo peculiaridades
        grid.style.display = 'none';
        pecContainer.style.display = 'block';
        if (invContainer) invContainer.style.display = 'none';
        if (condContainer) condContainer.style.display = 'none';
        
        if (btnPec) {
            btnPec.classList.remove('btn-primary');
            btnPec.classList.add('btn-secondary');
            btnPec.textContent = 'Voltar para Personagens';
        }
        if (btnInv) {
            btnInv.classList.remove('btn-secondary');
            btnInv.classList.add('btn-primary');
            btnInv.textContent = '🎒 Inventário';
        }
        if (btnCond) {
            btnCond.classList.remove('btn-secondary');
            btnCond.classList.add('btn-primary');
            btnCond.textContent = '💀 Condições';
        }
        if (btnExp) btnExp.style.display = 'none';
        
        // Renderiza peculiaridades
        if (window._loadPersonagensPeculiaridades) {
            window._loadPersonagensPeculiaridades();
        }
    } else {
        // Sai do modo peculiaridades
        grid.style.display = 'grid';
        pecContainer.style.display = 'none';
        if (btnPec) {
            btnPec.classList.remove('btn-secondary');
            btnPec.classList.add('btn-primary');
            btnPec.textContent = '✨ Peculiaridades';
        }
        if (btnExp) btnExp.style.display = '';
    }
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
        const f = c.fields || {};
        const curExp = parseInt(f.exp ?? c.exp ?? 0, 10) || 0;
        const curExpTotal = parseInt(f.exp_total ?? c.exp_total ?? 0, 10) || 0;
        const nome = f.nome || c.nome || 'Sem nome';
        const newExp = isAdd ? curExp + v : Math.max(0, curExp - v);
        const newExpTotal = isAdd ? curExpTotal + v : Math.max(0, curExpTotal - v);
        // Update in 'char' collection using nested fields path
        await updateDoc(doc(db, 'char', charId), { 'fields.exp': newExp, 'fields.exp_total': newExpTotal });
        await addLog(S.currentUser?.email, `⭐ ${isAdd?'+':'-'}${v} EXP concedido pelo Mestre`, nome, 'characters', {
            charId, mesaId: S.currentMesaId, category: 'Progressão & EXP',
            changes: [
                { label: 'EXP Disponível', from: String(curExp), to: String(newExp) },
                { label: 'EXP Total', from: String(curExpTotal), to: String(newExpTotal) }
            ]
        });
        // Send notification to player
        if (c.ownerUid) {
            try {
                await notifyUsers([c.ownerUid], {
                    type: 'exp_received',
                    highlight: 'importante',
                    message: `${isAdd?'Ganhou':'Perdeu'} ${v} EXP em ${nome}!`,
                    data: { direction: isAdd ? 'up' : 'down', amount: v, characterName: nome }
                });
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
        await notifyUsers(sel, { type: 'master_message', message: msg, highlight: hl });
        showAlert(`✅ Enviada a ${sel.length} jogador(es)`, 'success');
        document.getElementById('mesaNotifModal')?.remove();
    } catch (e) { showAlert('❌ Erro', 'danger'); }
};
