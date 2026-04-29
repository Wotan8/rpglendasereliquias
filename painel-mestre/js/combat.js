// =============================================
// COMBAT SYSTEM — Full migration from mestre.html
// =============================================
import { db, collection, getDocs, doc, onSnapshot } from './firebase-config.js';
import * as S from './state.js';
import { showAlert, escapeHtml } from './ui-utils.js';

let combatListeners = {};

// ===== ADD TO COMBAT =====
window.addCharacterToCombat = async function() {
    try {
        const snap = await getDocs(collection(db, 'characters'));
        const chars = []; snap.forEach(d => chars.push({ id: d.id, ...d.data() }));
        if (!chars.length) { showAlert('❌ Nenhum personagem', 'danger'); return; }
        const opts = chars.map(c => `<option value="${c.id}" data-name="${(c.nome||'').toLowerCase()}">${c.nome} (${c.jogador})</option>`).join('');
        const m = document.createElement('div'); m.className = 'modal active';
        m.innerHTML = `<div class="modal-content" style="max-width:500px"><div class="modal-header"><span class="modal-title">Adicionar Jogador</span><button class="modal-close" onclick="this.closest('.modal').remove()">✕</button></div><div class="modal-body"><div class="form-group"><label class="form-label">🔍 Buscar</label><input type="text" class="form-input" id="searchCharCombat" placeholder="Filtrar..." oninput="filterCombatSelect('searchCharCombat','selChar')"></div><div class="form-group"><label class="form-label">Personagem</label><select class="form-select" id="selChar" size="6" style="height:180px">${opts}</select></div><div class="form-group"><label class="form-label">Iniciativa</label><input type="number" class="form-input" id="charInit" value="0" min="0"></div><div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px"><button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancelar</button><button class="btn btn-success" onclick="confirmAddChar()">Adicionar</button></div></div></div>`;
        document.body.appendChild(m); window._tempChars = chars;
        m.addEventListener('click', e => { if (e.target === m) m.remove(); });
    } catch (e) { console.error(e); showAlert('❌ Erro', 'danger'); }
};

window.filterCombatSelect = function(searchId, selectId) {
    const s = document.getElementById(searchId).value.toLowerCase();
    const sel = document.getElementById(selectId);
    for (let i = 0; i < sel.options.length; i++) {
        const o = sel.options[i];
        o.style.display = (o.text.toLowerCase().includes(s) || (o.dataset.name||'').includes(s)) ? '' : 'none';
    }
    for (let i = 0; i < sel.options.length; i++) { if (sel.options[i].style.display !== 'none') { sel.selectedIndex = i; break; } }
};

window.confirmAddChar = function() {
    const id = document.getElementById('selChar').value;
    const init = parseInt(document.getElementById('charInit').value) || 0;
    const c = window._tempChars.find(x => x.id === id); if (!c) return;
    const vitMax = (c.vig||1) + (c.tamanho||5), enerMax = (c.prs||1) + (c.aut||1);
    const pid = 'char-' + Date.now();
    S.combatParticipants.push({ id: pid, characterId: id, name: c.nome, type: 'Jogador', initiative: init, details: `${c.raca||'-'} - ${c.classe||'-'}`, hpCurrent: c.hpCurrent !== undefined ? c.hpCurrent : vitMax, hpMax: vitMax, enerCurrent: c.enerCurrent !== undefined ? c.enerCurrent : enerMax, enerMax: enerMax, sanCurrent: c.sanCurrent !== undefined ? c.sanCurrent : 80, sanMax: 100 });
    setupCombatListener(id, pid);
    renderCombatList(); document.querySelector('.modal.active')?.remove();
    showAlert('✅ Jogador adicionado!', 'success');
};

function setupCombatListener(charId, pid) {
    const unsub = onSnapshot(doc(db, 'characters', charId), snap => {
        if (!snap.exists()) return;
        const d = snap.data(), p = S.combatParticipants.find(x => x.id === pid); if (!p) return;
        const vm = (d.vig||1) + (d.tamanho||5), em = (d.prs||1) + (d.aut||1);
        p.hpCurrent = d.hpCurrent !== undefined ? d.hpCurrent : vm; p.hpMax = vm;
        p.enerCurrent = d.enerCurrent !== undefined ? d.enerCurrent : em; p.enerMax = em;
        p.sanCurrent = d.sanCurrent !== undefined ? d.sanCurrent : 80; p.name = d.nome || p.name;
        updateParticipantStats(pid);
    }); combatListeners[pid] = unsub;
}

function updateParticipantStats(pid) {
    const p = S.combatParticipants.find(x => x.id === pid); if (!p) return;
    ['vit','ener','san'].forEach(stat => {
        const cur = stat === 'vit' ? p.hpCurrent : stat === 'ener' ? p.enerCurrent : p.sanCurrent;
        const max = stat === 'vit' ? p.hpMax : stat === 'ener' ? p.enerMax : p.sanMax;
        const pct = max > 0 ? (cur/max)*100 : 0;
        const el = document.getElementById(`combat-${stat}-${pid}`);
        const fill = document.getElementById(`combat-${stat}-fill-${pid}`);
        if (el) el.textContent = `${cur}/${max}`;
        if (fill) { fill.style.width = pct + '%'; if (stat === 'vit') fill.style.background = pct <= 25 ? 'linear-gradient(90deg,#dc2626,#ef4444)' : 'linear-gradient(90deg,#10b981,#34d399)'; if (stat === 'san') fill.style.background = pct <= 25 ? 'linear-gradient(90deg,#dc2626,#ef4444)' : 'linear-gradient(90deg,#6366f1,#8b5cf6)'; }
    });
}

// ===== ADD NPC =====
window.addNpcToCombat = async function() {
    try {
        const snap = await getDocs(collection(db, 'npcs'));
        const npcs = []; snap.forEach(d => npcs.push({ id: d.id, ...d.data() }));
        if (!npcs.length) { showAlert('❌ Nenhum NPC', 'danger'); return; }
        const opts = npcs.map(n => `<option value="${n.id}" data-name="${(n.nome||'').toLowerCase()}">${n.nome} (${n.tipo||'NPC'})</option>`).join('');
        const m = document.createElement('div'); m.className = 'modal active';
        m.innerHTML = `<div class="modal-content" style="max-width:500px"><div class="modal-header"><span class="modal-title">Adicionar NPC/Criatura</span><button class="modal-close" onclick="this.closest('.modal').remove()">✕</button></div><div class="modal-body"><div class="form-group"><label class="form-label">🔍 Buscar</label><input type="text" class="form-input" id="searchNpcCombat" placeholder="Filtrar..." oninput="filterCombatSelect('searchNpcCombat','selNpc')"></div><div class="form-group"><label class="form-label">NPC/Criatura</label><select class="form-select" id="selNpc" size="6" style="height:180px">${opts}</select></div><div class="form-group"><label class="form-label">Iniciativa</label><input type="number" class="form-input" id="npcInit" value="0" min="0"></div><div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px"><button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancelar</button><button class="btn btn-success" onclick="confirmAddNpc()">Adicionar</button></div></div></div>`;
        document.body.appendChild(m); window._tempNpcs = npcs;
        m.addEventListener('click', e => { if (e.target === m) m.remove(); });
    } catch (e) { console.error(e); showAlert('❌ Erro', 'danger'); }
};

window.confirmAddNpc = function() {
    const id = document.getElementById('selNpc').value;
    const init = parseInt(document.getElementById('npcInit').value) || 0;
    const n = window._tempNpcs.find(x => x.id === id); if (!n) return;
    const vit = n.valoresDer?.VIT || 10, ener = n.valoresDer?.ENER || 5, san = n.valoresDer?.SAN || 100;
    S.combatParticipants.push({ id: 'npc-' + Date.now(), npcId: id, name: n.nome, type: n.tipo === 'criatura' ? 'Criatura' : 'NPC', initiative: init, details: `${n.raca||'N/A'} | ${n.papel||'-'}`, hpCurrent: vit, hpMax: vit, enerCurrent: ener, enerMax: ener, sanCurrent: san, sanMax: san, isNpc: true });
    renderCombatList(); document.querySelector('.modal.active')?.remove();
    showAlert('✅ NPC adicionado!', 'success');
};

// ===== ADD CUSTOM =====
window.addCustomToCombat = function() {
    const m = document.createElement('div'); m.className = 'modal active';
    m.innerHTML = `<div class="modal-content" style="max-width:600px"><div class="modal-header"><span class="modal-title">Inimigo Personalizado</span><button class="modal-close" onclick="this.closest('.modal').remove()">✕</button></div><div class="modal-body"><div class="form-group"><label class="form-label">Nome *</label><input type="text" class="form-input" id="custName" placeholder="Ex: Goblin"></div><div class="form-group"><label class="form-label">Detalhes</label><input type="text" class="form-input" id="custDetails" placeholder="Tipo, Papel..."></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px"><div class="form-group" style="margin:0"><label class="form-label">⚔️ Iniciativa</label><input type="number" class="form-input" id="custInit" value="0" style="text-align:center"></div><div class="form-group" style="margin:0"><label class="form-label">❤️ VIT</label><input type="number" class="form-input" id="custVIT" value="10" style="text-align:center"></div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px"><div class="form-group" style="margin:0"><label class="form-label">🔥 ENER</label><input type="number" class="form-input" id="custENER" value="5" style="text-align:center"></div><div class="form-group" style="margin:0"><label class="form-label">🧠 SAN</label><input type="number" class="form-input" id="custSAN" value="50" style="text-align:center"></div></div><div class="form-group"><label class="form-label">⚔️ Habilidades</label><textarea class="form-textarea" id="custAbil" rows="3" placeholder="Ataques, resistências..."></textarea></div><div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px"><button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancelar</button><button class="btn btn-success" onclick="confirmAddCustom()">Adicionar</button></div></div></div>`;
    document.body.appendChild(m);
    m.addEventListener('click', e => { if (e.target === m) m.remove(); });
};

window.confirmAddCustom = function() {
    const name = document.getElementById('custName').value.trim();
    if (!name) { showAlert('❌ Insira um nome', 'danger'); return; }
    const vit = parseInt(document.getElementById('custVIT').value)||10, ener = parseInt(document.getElementById('custENER').value)||5, san = parseInt(document.getElementById('custSAN').value)||50;
    S.combatParticipants.push({ id: 'custom-' + Date.now(), name, type: 'Inimigo', initiative: parseInt(document.getElementById('custInit').value)||0, details: document.getElementById('custDetails').value.trim()||'Personalizado', hpCurrent: vit, hpMax: vit, enerCurrent: ener, enerMax: ener, sanCurrent: san, sanMax: san, combatAbilities: document.getElementById('custAbil').value.trim(), isCustom: true });
    renderCombatList(); document.querySelector('.modal.active')?.remove();
    showAlert('✅ Inimigo adicionado!', 'success');
};

// ===== COMBAT CONTROLS =====
window.adjustCombatStat = function(pid, stat, amt, ev) {
    if (ev) ev.stopPropagation();
    const p = S.combatParticipants.find(x => x.id === pid); if (!p) return;
    if (stat === 'vit') p.hpCurrent = Math.max(0, Math.min(p.hpCurrent + amt, p.hpMax));
    else if (stat === 'ener') p.enerCurrent = Math.max(0, Math.min(p.enerCurrent + amt, p.enerMax));
    else if (stat === 'san') p.sanCurrent = Math.max(0, Math.min(p.sanCurrent + amt, p.sanMax));
    updateParticipantStats(pid);
};

window.updateInitiative = function(pid, v) { const p = S.combatParticipants.find(x => x.id === pid); if (p) p.initiative = parseInt(v)||0; };
window.updateCustomAbilities = function(pid, v) { const p = S.combatParticipants.find(x => x.id === pid); if (p) p.combatAbilities = v; };

window.sortCombatByInitiative = function() { S.combatParticipants.sort((a, b) => b.initiative - a.initiative); renderCombatList(); showAlert('✅ Ordenado!', 'success'); };

window.clearCombat = function() {
    if (!confirm('Limpar toda a lista de combate?')) return;
    Object.values(combatListeners).forEach(u => { if (typeof u === 'function') u(); }); combatListeners = {};
    S.setCombatParticipants([]); renderCombatList(); showAlert('✅ Limpo!', 'success');
};

window.removeFromCombat = function(pid) {
    if (combatListeners[pid]) { combatListeners[pid](); delete combatListeners[pid]; }
    S.setCombatParticipants(S.combatParticipants.filter(p => p.id !== pid)); renderCombatList(); showAlert('✅ Removido', 'success');
};

window.openCombatNpcModal = function(pid) { const p = S.combatParticipants.find(x => x.id === pid); if (p?.npcId && window.openNpcEditModal) window.openNpcEditModal(p.npcId); };

// ===== RENDER =====
export function renderCombatList() {
    const el = document.getElementById('combatList'); if (!el) return;
    if (!S.combatParticipants.length) { el.innerHTML = '<div class="no-combat">Nenhum participante no combate</div>'; return; }
    el.innerHTML = S.combatParticipants.map(p => {
        const isPlayer = p.type === 'Jogador', isNpc = p.isNpc === true, isCustom = p.isCustom === true;
        const hasStats = isPlayer || isNpc || isCustom, hasCtrl = isNpc || isCustom;
        let stats = '', abil = '';
        if (hasStats) {
            const vp = p.hpMax > 0 ? (p.hpCurrent/p.hpMax)*100 : 0, ep = p.enerMax > 0 ? (p.enerCurrent/p.enerMax)*100 : 0, sp = p.sanMax > 0 ? (p.sanCurrent/p.sanMax)*100 : 0;
            const vc = vp <= 25 ? 'linear-gradient(90deg,#dc2626,#ef4444)' : 'linear-gradient(90deg,#10b981,#34d399)';
            const sc = sp <= 25 ? 'linear-gradient(90deg,#dc2626,#ef4444)' : 'linear-gradient(90deg,#6366f1,#8b5cf6)';
            const btn = (stat, id) => hasCtrl ? `<button class="combat-stat-btn" onclick="adjustCombatStat('${p.id}','${stat}',-1,event)">−</button>` : '';
            const btnP = (stat, id) => hasCtrl ? `<button class="combat-stat-btn" onclick="adjustCombatStat('${p.id}','${stat}',1,event)">+</button>` : '';
            stats = `<div class="combat-stats">
                <div class="combat-stat-item ${hasCtrl?'combat-stat-npc':''}">${btn('vit')}<span class="combat-stat-label">❤️ VIT</span><div class="combat-stat-bar"><div class="combat-stat-fill" id="combat-vit-fill-${p.id}" style="width:${vp}%;background:${vc}"></div></div><span class="combat-stat-value" id="combat-vit-${p.id}">${p.hpCurrent}/${p.hpMax}</span>${btnP('vit')}</div>
                <div class="combat-stat-item ${hasCtrl?'combat-stat-npc':''}">${btn('ener')}<span class="combat-stat-label">🔥 ENER</span><div class="combat-stat-bar"><div class="combat-stat-fill" id="combat-ener-fill-${p.id}" style="width:${ep}%;background:linear-gradient(90deg,#f59e0b,#fbbf24)"></div></div><span class="combat-stat-value" id="combat-ener-${p.id}">${p.enerCurrent}/${p.enerMax}</span>${btnP('ener')}</div>
                <div class="combat-stat-item ${hasCtrl?'combat-stat-npc':''}">${btn('san')}<span class="combat-stat-label">🧠 SAN</span><div class="combat-stat-bar"><div class="combat-stat-fill" id="combat-san-fill-${p.id}" style="width:${sp}%;background:${sc}"></div></div><span class="combat-stat-value" id="combat-san-${p.id}">${p.sanCurrent}/${p.sanMax}</span>${btnP('san')}</div>
            </div>`;
        }
        if (isCustom) abil = `<div class="combat-abilities-container" onclick="event.stopPropagation()"><label class="combat-abilities-label">⚔️ Habilidades:</label><textarea class="combat-abilities-input" onchange="updateCustomAbilities('${p.id}',this.value)">${p.combatAbilities||''}</textarea></div>`;
        const click = isNpc ? `onclick="openCombatNpcModal('${p.id}')" style="cursor:pointer"` : '';
        const cls = isCustom ? 'combat-participant-custom' : isNpc ? 'combat-participant-npc' : '';
        const npcHint = isNpc ? '<span style="font-size:.7rem;color:#94a3b8;margin-left:5px">📋 detalhes</span>' : '';
        return `<div class="combat-participant ${cls}" ${click}><div class="combat-initiative"><div class="combat-initiative-value">${p.initiative}</div><div class="combat-initiative-label">Iniciativa</div></div><div style="flex:1"><div class="combat-name">${escapeHtml(p.name)}${npcHint}</div><span class="combat-type">${p.type}</span><div class="combat-details">${escapeHtml(p.details||'')}</div>${stats}${abil}</div><div class="combat-actions" onclick="event.stopPropagation()"><input type="number" class="combat-initiative-input" value="${p.initiative}" onchange="updateInitiative('${p.id}',this.value)"><button class="btn btn-danger btn-small" onclick="removeFromCombat('${p.id}')">🗑️</button></div></div>`;
    }).join('');
}
