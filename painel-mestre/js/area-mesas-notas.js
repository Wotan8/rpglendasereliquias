// =============================================
// AREA MESAS — Notas Geral
// =============================================
import { db, collection, getDocs, doc, updateDoc } from './firebase-config.js';
import * as S from './state.js';
import { showAlert, escapeHtml } from './ui-utils.js';

window._loadMesaNotas = loadMesaNotas;

async function loadMesaNotas() {
    if (!S.currentMesaId) return;
    const el = document.getElementById('mesaNotasContent'); if (!el) return;
    try {
        let chars = S.mesaCharacters || [];
        if (!chars.length) {
            const snap = await getDocs(collection(db, 'characters'));
            snap.forEach(d => { const data = d.data(); if (data.mesaId === S.currentMesaId || (S.currentMesaData?.jogadores||[]).includes(data.ownerUid)) chars.push({ id: d.id, ...data }); });
        }
        if (!chars.length) { el.innerHTML = '<div style="text-align:center;padding:50px;color:var(--muted)">Nenhum personagem nesta mesa</div>'; return; }
        el.innerHTML = chars.map(c => `
            <div class="sessao-card" style="margin-bottom:14px">
                <div class="sessao-card-header">
                    <div class="sessao-titulo">🎭 ${escapeHtml(c.nome || 'Sem nome')}</div>
                    <button class="btn btn-primary btn-small" onclick="editCharNote('${c.id}')">✏️ Editar</button>
                </div>
                <div style="color:var(--ink);font-size:.88rem;line-height:1.6;white-space:pre-wrap;padding:8px 0" id="note-display-${c.id}">${escapeHtml(c.notas || c.notes || 'Sem notas')}</div>
            </div>`).join('');
    } catch (e) { console.error(e); showAlert('❌ Erro ao carregar notas', 'danger'); }
}

window.editCharNote = function(charId) {
    const chars = S.mesaCharacters || [];
    const c = chars.find(x => x.id === charId);
    if (!c) return;
    const m = document.createElement('div'); m.className = 'modal active'; m.id = 'editNoteModal';
    m.innerHTML = `<div class="modal-content" style="max-width:700px"><div class="modal-header"><span class="modal-title">✏️ Notas — ${escapeHtml(c.nome || '')}</span><button class="modal-close" onclick="this.closest('.modal').remove()">✕</button></div><div class="modal-body">
        <textarea class="form-textarea" id="en_notas" rows="12" style="min-height:200px">${escapeHtml(c.notas || c.notes || '')}</textarea>
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px"><button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancelar</button><button class="btn btn-success" onclick="saveCharNote('${charId}')">💾 Salvar</button></div>
    </div></div>`;
    document.body.appendChild(m);
};

window.saveCharNote = async function(charId) {
    const notas = document.getElementById('en_notas')?.value || '';
    try {
        await updateDoc(doc(db, 'characters', charId), { notas });
        // Update local state
        const c = (S.mesaCharacters || []).find(x => x.id === charId);
        if (c) c.notas = notas;
        showAlert('✅ Notas salvas!', 'success');
        document.getElementById('editNoteModal')?.remove();
        const display = document.getElementById(`note-display-${charId}`);
        if (display) display.textContent = notas || 'Sem notas';
    } catch (e) { showAlert('❌ Erro: ' + e.message, 'danger'); }
};
