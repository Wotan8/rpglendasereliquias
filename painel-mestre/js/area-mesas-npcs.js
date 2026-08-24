// =============================================
// AREA MESAS — NPCs Importantes (estilo Aba Geral)
// =============================================
import { db, collection, getDocs, getDoc, doc, addDoc, updateDoc, deleteDoc } from './firebase-config.js';
import * as S from './state.js';
import { showAlert, escapeHtml } from './ui-utils.js';
import { npcNaMesa, patchVinculoMesa } from '../../shared/npc-mesas.js';

window._loadMesaNpcs = loadMesaNpcs;

async function loadMesaNpcs() {
    if (!S.currentMesaId) return;
    const el = document.getElementById('mesaNpcsList'); if (!el) return;
    try {
        const snap = await getDocs(collection(db, 'npcs'));
        const npcs = [];
        snap.forEach(d => { const data = d.data(); if (npcNaMesa(data, S.currentMesaId)) npcs.push({ id: d.id, ...data }); });
        if (!npcs.length) { el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted);grid-column:1/-1">Nenhum NPC vinculado a esta mesa</div>'; return; }
        el.innerHTML = npcs.map(n => {
            const tags = (n.tags||'').split(',').filter(t=>t.trim()).map(t=>`<span class="npc-tag">${escapeHtml(t.trim())}</span>`).join('');
            return `<div class="npc-card" onclick="if(!event.target.closest('.mesa-npc-actions'))_openMesaNpcEdit('${n.id}')">
                <div class="npc-card-header">
                    <div class="npc-card-info">
                        <div class="npc-name">${escapeHtml(n.nome||'Sem nome')}</div>
                        <span class="npc-type-badge">${n.tipo==='criatura'?'🐉 Criatura':'👤 NPC'}</span>
                    </div>
                    <div class="mesa-npc-actions" style="display:flex;gap:4px">
                        <button class="btn btn-danger btn-small" onclick="event.stopPropagation();unlinkNpcFromMesa('${n.id}')" title="Desvincular da mesa">✕</button>
                    </div>
                </div>
                ${n.imagem?`<div class="npc-image-container"><img src="${n.imagem}" class="npc-card-image"></div>`:''}
                ${n.rolePlay?.personalidade?.[0]?`<div style="font-size:.82rem;color:var(--muted);margin-top:6px">- ${escapeHtml(n.rolePlay.personalidade[0])}</div>`:''}
                ${n.rolePlay?.trejeitos?`<div style="font-size:.82rem;color:var(--muted)">🎭 ${escapeHtml(n.rolePlay.trejeitos)}</div>`:''}
                ${tags?`<div class="npc-tags">${tags}</div>`:''}
            </div>`;
        }).join('');
    } catch (e) { showAlert('❌ Erro ao carregar NPCs', 'danger'); }
}

window.openLinkNpcModal = async function() {
    if (!S.currentMesaId) return;
    try {
        const snap = await getDocs(collection(db, 'npcs'));
        const available = [];
        snap.forEach(d => { const data = d.data(); if (!npcNaMesa(data, S.currentMesaId)) available.push({ id: d.id, ...data }); });
        if (!available.length) { showAlert('⚠️ Nenhum NPC disponível para vincular', 'warning'); return; }
        const opts = available.map(n => `<option value="${n.id}">${escapeHtml(n.nome || 'Sem nome')} (${n.tipo || 'NPC'})</option>`).join('');
        const m = document.createElement('div'); m.className = 'modal active'; m.id = 'linkNpcModal';
        m.innerHTML = `<div class="modal-content" style="max-width:500px"><div class="modal-header"><span class="modal-title">🔗 Vincular NPC</span><button class="modal-close" onclick="this.closest('.modal').remove()">✕</button></div><div class="modal-body">
            <div class="form-group"><label class="form-label">NPC</label><select class="form-select" id="ln_npcId" size="6" style="height:200px">${opts}</select></div>
            <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px"><button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancelar</button><button class="btn btn-success" onclick="linkNpcToMesa()">✅ Vincular</button></div>
        </div></div>`;
        document.body.appendChild(m);
    } catch (e) { showAlert('❌ Erro', 'danger'); }
};

// Vincular/desvincular mexe SÓ nesta mesa — as outras campanhas do NPC ficam.
async function _setVinculo(npcId, vincular) {
    const snap = await getDoc(doc(db, 'npcs', npcId));
    if (!snap.exists()) return;
    await updateDoc(doc(db, 'npcs', npcId), patchVinculoMesa(snap.data(), S.currentMesaId, vincular));
}

window.linkNpcToMesa = async function() {
    const npcId = document.getElementById('ln_npcId')?.value;
    if (!npcId || !S.currentMesaId) return;
    try {
        await _setVinculo(npcId, true);
        showAlert('✅ NPC vinculado!', 'success');
        document.getElementById('linkNpcModal')?.remove();
        await loadMesaNpcs();
    } catch (e) { showAlert('❌ Erro: ' + e.message, 'danger'); }
};

window.unlinkNpcFromMesa = async function(npcId) {
    if (!await LRDialogo.confirmar('Desvincular este NPC da mesa?')) return;
    try {
        await _setVinculo(npcId, false);
        showAlert('✅ NPC desvinculado', 'success');
        await loadMesaNpcs();
    } catch (e) { showAlert('❌ Erro', 'danger'); }
};

window.openCreateMesaNpcModal = function() {
    const m = document.createElement('div'); m.className = 'modal active'; m.id = 'createMesaNpcModal';
    m.innerHTML = `<div class="modal-content" style="max-width:600px"><div class="modal-header"><span class="modal-title">➕ Novo NPC da Mesa</span><button class="modal-close" onclick="this.closest('.modal').remove()">✕</button></div><div class="modal-body">
        <div class="form-group"><label class="form-label">Nome *</label><input type="text" class="form-input" id="mnpc_nome" placeholder="Nome do NPC"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div class="form-group"><label class="form-label">Tipo</label><select class="form-select" id="mnpc_tipo"><option value="npc">NPC</option><option value="criatura">Criatura</option></select></div>
            <div class="form-group"><label class="form-label">Papel</label><input type="text" class="form-input" id="mnpc_papel" placeholder="Ex: Mercador, Vilão..."></div>
        </div>
        <div class="form-group"><label class="form-label">Descrição</label><textarea class="form-textarea" id="mnpc_desc" rows="3" placeholder="Descrição do NPC..."></textarea></div>
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px"><button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancelar</button><button class="btn btn-success" onclick="createMesaNpc()">✅ Criar</button></div>
    </div></div>`;
    document.body.appendChild(m);
};

window.createMesaNpc = async function() {
    const nome = document.getElementById('mnpc_nome')?.value?.trim();
    if (!nome) { showAlert('⚠️ Nome obrigatório', 'warning'); return; }
    try {
        await addDoc(collection(db, 'npcs'), {
            nome,
            tipo: document.getElementById('mnpc_tipo')?.value || 'npc',
            papel: document.getElementById('mnpc_papel')?.value?.trim() || '',
            descricao: document.getElementById('mnpc_desc')?.value?.trim() || '',
            mesaId: S.currentMesaId,
            vinculos: [{ tipo: 'mesa', id: S.currentMesaId }],
            createdAt: new Date().toISOString()
        });
        showAlert('✅ NPC criado e vinculado!', 'success');
        document.getElementById('createMesaNpcModal')?.remove();
        await loadMesaNpcs();
    } catch (e) { showAlert('❌ Erro: ' + e.message, 'danger'); }
};

// Ensure the NPC edit modal from area-npcs.js is accessible
// Dynamically import area-npcs.js if openNpcModal is not yet loaded
window._openMesaNpcEdit = async function(npcId) {
    // Ensure allNpcs has this NPC loaded
    if (!S.allNpcs || !S.allNpcs.find(n => n.id === npcId)) {
        try {
            const snap = await getDocs(collection(db, 'npcs'));
            const npcs = []; snap.forEach(d => npcs.push({ id: d.id, ...d.data() }));
            S.setAllNpcs(npcs);
        } catch (e) { console.error(e); }
    }
    // Dynamically load area-npcs.js if openNpcModal is not available
    if (!window.openNpcModal) {
        try {
            await import('./area-npcs.js' + (window._pmV || ''));
        } catch (e) { console.error('Erro ao carregar módulo NPC:', e); }
    }
    if (window.openNpcModal) {
        window.openNpcModal(npcId);
    }
};
