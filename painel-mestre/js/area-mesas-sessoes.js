// =============================================
// AREA MESAS — Logs de Sessão
// =============================================
import { db, collection, getDocs, getDoc, doc, addDoc, updateDoc, deleteDoc, query, where, orderBy } from './firebase-config.js';
import * as S from './state.js';
import { showAlert, escapeHtml } from './ui-utils.js';
import { addLog } from './logs.js';

// Register global loader
window._loadSessionLogs = loadSessionLogs;

async function loadSessionLogs() {
    if (!S.currentMesaId) return;
    const el = document.getElementById('sessionLogsList'); if (!el) return;
    try {
        const snap = await getDocs(collection(db, 'session-logs'));
        const logs = [];
        snap.forEach(d => { const data = d.data(); if (data.mesaId === S.currentMesaId) logs.push({ id: d.id, ...data }); });
        logs.sort((a, b) => (b.sessionNumber || 0) - (a.sessionNumber || 0));
        S.setMesaSessionLogs(logs);
        renderSessionLogs();
    } catch (e) { console.error(e); showAlert('❌ Erro ao carregar logs', 'danger'); }
}

function renderSessionLogs() {
    const el = document.getElementById('sessionLogsList'); if (!el) return;
    const logs = S.mesaSessionLogs;
    if (!logs.length) {
        el.innerHTML = '<div style="text-align:center;padding:50px;color:var(--muted)"><div style="font-size:2.5rem;margin-bottom:12px">📝</div>Nenhum log de sessão registrado</div>';
        return;
    }
    el.innerHTML = logs.map(log => `
        <div class="sessao-card" onclick="viewSessionLog('${log.id}')" style="cursor:pointer">
            <div class="sessao-card-header">
                <div class="sessao-titulo">📝 Sessão #${log.sessionNumber || '?'}</div>
                <div style="display:flex;gap:6px;align-items:center">
                    <span class="sessao-data">📅 ${log.dateReal || '-'}</span>
                    <button class="btn btn-danger btn-small" onclick="event.stopPropagation();deleteSessionLog('${log.id}')" style="padding:4px 8px">🗑️</button>
                </div>
            </div>
            ${log.gameDate ? `<div style="font-size:.78rem;color:var(--primary);margin-bottom:6px">🎮 Data no jogo: ${escapeHtml(log.gameDate)}</div>` : ''}
            <div class="sessao-resumo">${escapeHtml((log.summary || '').substring(0, 200))}${(log.summary || '').length > 200 ? '...' : ''}</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
                ${(log.participants || []).map(p => `<span style="background:rgba(139,92,246,.15);color:var(--primary);padding:2px 8px;border-radius:6px;font-size:.75rem;font-weight:700">${escapeHtml(p.characterName || '?')}</span>`).join('')}
            </div>
        </div>`).join('');
}

// ===== CREATE SESSION LOG =====
window.openCreateSessionLogModal = async function() {
    if (!S.currentMesaId) return;
    // Load characters for selection
    let chars = S.mesaCharacters || [];
    if (!chars.length) {
        try {
            const snap = await getDocs(collection(db, 'characters'));
            snap.forEach(d => { const data = d.data(); if (data.mesaId === S.currentMesaId || (S.currentMesaData?.jogadores || []).includes(data.ownerUid)) chars.push({ id: d.id, ...data }); });
        } catch (e) { /* use empty */ }
    }
    const nextNum = (S.mesaSessionLogs.length > 0) ? Math.max(...S.mesaSessionLogs.map(l => l.sessionNumber || 0)) + 1 : 1;
    const charCheckboxes = chars.map(c => `
        <div style="display:flex;align-items:center;gap:8px;padding:8px;border:1px solid var(--border);border-radius:8px;margin-bottom:6px">
            <input type="checkbox" class="sl-char-cb" value="${c.id}" data-name="${escapeHtml(c.nome || '')}" data-owner="${c.ownerUid || ''}" style="width:18px;height:18px">
            <span style="flex:1;color:var(--light);font-weight:600">${escapeHtml(c.nome || 'Sem nome')}</span>
            <input type="number" class="form-input sl-char-exp" data-char-id="${c.id}" placeholder="EXP" value="0" style="width:80px;text-align:center;padding:6px">
            <select class="form-select sl-char-exp-type" data-char-id="${c.id}" style="width:60px;padding:6px"><option value="add">+</option><option value="sub">−</option></select>
        </div>`).join('');

    const m = document.createElement('div'); m.className = 'modal active'; m.id = 'createSessionModal';
    m.innerHTML = `<div class="modal-content" style="max-width:800px"><div class="modal-header"><span class="modal-title">📝 Novo Log de Sessão</span><button class="modal-close" onclick="this.closest('.modal').remove()">✕</button></div><div class="modal-body" style="max-height:75vh;overflow-y:auto">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group"><label class="form-label">Nº da Sessão</label><input type="number" class="form-input" id="sl_num" value="${nextNum}" min="1"></div>
            <div class="form-group"><label class="form-label">Data Real</label><input type="date" class="form-input" id="sl_dateReal" value="${new Date().toISOString().split('T')[0]}"></div>
        </div>
        <div class="form-group"><label class="form-label">Data no Jogo</label><input type="text" class="form-input" id="sl_gameDate" placeholder="Ex: 15 de Aura, Ano 10 EBA"></div>
        <div class="form-group"><label class="form-label">Resumo Geral *</label><textarea class="form-textarea" id="sl_summary" rows="4" placeholder="O que aconteceu nesta sessão..."></textarea></div>
        <div class="form-group"><label class="form-label">Resumo por Jogador</label><textarea class="form-textarea" id="sl_playerSummaries" rows="3" placeholder="Jogador 1: fez X. Jogador 2: fez Y."></textarea></div>
        <div class="form-group"><label class="form-label">Personagens Participantes & EXP</label>${charCheckboxes || '<div style="color:var(--muted)">Nenhum personagem na mesa</div>'}</div>
        <div class="form-group"><label class="form-label">NPCs Importantes</label><textarea class="form-textarea" id="sl_npcs" rows="2" placeholder="NPCs envolvidos..."></textarea></div>
        <div class="form-group"><label class="form-label">Locais Visitados</label><textarea class="form-textarea" id="sl_locations" rows="2" placeholder="Locais..."></textarea></div>
        <div class="form-group"><label class="form-label">Combates</label><textarea class="form-textarea" id="sl_combats" rows="2" placeholder="Descrição dos combates..."></textarea></div>
        <div class="form-group"><label class="form-label">Loot / Recompensas</label><textarea class="form-textarea" id="sl_loot" rows="2" placeholder="Itens encontrados..."></textarea></div>
        <div class="form-group"><label class="form-label">Ganchos para Próxima Sessão</label><textarea class="form-textarea" id="sl_hooks" rows="2" placeholder="O que vem a seguir..."></textarea></div>
        <div class="form-group"><label class="form-label">Momentos Memoráveis</label><textarea class="form-textarea" id="sl_moments" rows="2" placeholder="Momentos épicos, engraçados..."></textarea></div>
        <div class="form-group"><label class="form-label">Notas do Mestre (privado)</label><textarea class="form-textarea" id="sl_dmNotes" rows="3" placeholder="Anotações privadas..."></textarea></div>
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px"><button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancelar</button><button class="btn btn-success" onclick="saveSessionLog()">💾 Salvar</button></div>
    </div></div>`;
    document.body.appendChild(m);
};

window.saveSessionLog = async function() {
    const summary = document.getElementById('sl_summary')?.value?.trim();
    if (!summary) { showAlert('⚠️ Resumo é obrigatório', 'warning'); return; }
    // Collect participants
    const participants = [];
    document.querySelectorAll('.sl-char-cb:checked').forEach(cb => {
        const charId = cb.value;
        const expInput = document.querySelector(`.sl-char-exp[data-char-id="${charId}"]`);
        const typeInput = document.querySelector(`.sl-char-exp-type[data-char-id="${charId}"]`);
        participants.push({
            characterId: charId,
            characterName: cb.dataset.name || '',
            ownerUid: cb.dataset.owner || '',
            expAmount: parseInt(expInput?.value) || 0,
            expType: typeInput?.value || 'add'
        });
    });
    const logData = {
        mesaId: S.currentMesaId,
        sessionNumber: parseInt(document.getElementById('sl_num')?.value) || 1,
        dateReal: document.getElementById('sl_dateReal')?.value || '',
        gameDate: document.getElementById('sl_gameDate')?.value?.trim() || '',
        summary,
        playerSummaries: document.getElementById('sl_playerSummaries')?.value?.trim() || '',
        participants,
        npcs: document.getElementById('sl_npcs')?.value?.trim() || '',
        locations: document.getElementById('sl_locations')?.value?.trim() || '',
        combats: document.getElementById('sl_combats')?.value?.trim() || '',
        loot: document.getElementById('sl_loot')?.value?.trim() || '',
        hooks: document.getElementById('sl_hooks')?.value?.trim() || '',
        moments: document.getElementById('sl_moments')?.value?.trim() || '',
        dmNotes: document.getElementById('sl_dmNotes')?.value?.trim() || '',
        createdAt: new Date().toISOString(),
        createdBy: S.currentUser?.email
    };
    try {
        await addDoc(collection(db, 'session-logs'), logData);
        // Apply EXP to characters
        for (const p of participants) {
            if (p.expAmount > 0) {
                const charRef = doc(db, 'characters', p.characterId);
                const charSnap = await getDoc(charRef);
                if (charSnap.exists()) {
                    const cd = charSnap.data();
                    const isAdd = p.expType === 'add';
                    const newExp = isAdd ? (cd.exp||0) + p.expAmount : Math.max(0, (cd.exp||0) - p.expAmount);
                    const newTotal = isAdd ? (cd.exp_total||0) + p.expAmount : Math.max(0, (cd.exp_total||0) - p.expAmount);
                    await updateDoc(charRef, { exp: newExp, exp_total: newTotal });
                    // Notify owner
                    if (p.ownerUid) {
                        try {
                            const uRef = doc(db, 'users', p.ownerUid);
                            const uSnap = await getDoc(uRef);
                            if (uSnap.exists()) {
                                const notifs = uSnap.data().notifications || [];
                                notifs.push({ message: `Sessão #${logData.sessionNumber}: ${isAdd?'Ganhou':'Perdeu'} ${p.expAmount} EXP em ${p.characterName}!`, highlight: 'importante', from: 'Mestre', date: new Date().toISOString(), read: false });
                                await updateDoc(uRef, { notifications: notifs });
                            }
                        } catch (ne) { /* ignore */ }
                    }
                }
            }
        }
        showAlert('✅ Log de sessão salvo!', 'success');
        document.getElementById('createSessionModal')?.remove();
        await loadSessionLogs();
    } catch (e) { showAlert('❌ Erro: ' + e.message, 'danger'); }
};

// ===== VIEW SESSION LOG =====
window.viewSessionLog = function(logId) {
    const log = S.mesaSessionLogs.find(l => l.id === logId);
    if (!log) return;
    const m = document.createElement('div'); m.className = 'modal active';
    const sections = [
        log.summary ? `<div class="form-group"><label class="form-label">Resumo Geral</label><div style="color:var(--ink);line-height:1.6">${escapeHtml(log.summary)}</div></div>` : '',
        log.playerSummaries ? `<div class="form-group"><label class="form-label">Resumo por Jogador</label><div style="color:var(--ink);line-height:1.6;white-space:pre-wrap">${escapeHtml(log.playerSummaries)}</div></div>` : '',
        (log.participants||[]).length ? `<div class="form-group"><label class="form-label">Participantes</label>${log.participants.map(p => `<div style="padding:6px;border-bottom:1px solid var(--line)">${escapeHtml(p.characterName)} — ${p.expType==='add'?'+':'-'}${p.expAmount} EXP</div>`).join('')}</div>` : '',
        log.npcs ? `<div class="form-group"><label class="form-label">NPCs</label><div style="color:var(--ink);white-space:pre-wrap">${escapeHtml(log.npcs)}</div></div>` : '',
        log.locations ? `<div class="form-group"><label class="form-label">Locais</label><div style="color:var(--ink);white-space:pre-wrap">${escapeHtml(log.locations)}</div></div>` : '',
        log.combats ? `<div class="form-group"><label class="form-label">Combates</label><div style="color:var(--ink);white-space:pre-wrap">${escapeHtml(log.combats)}</div></div>` : '',
        log.loot ? `<div class="form-group"><label class="form-label">Loot</label><div style="color:var(--ink);white-space:pre-wrap">${escapeHtml(log.loot)}</div></div>` : '',
        log.hooks ? `<div class="form-group"><label class="form-label">Ganchos</label><div style="color:var(--ink);white-space:pre-wrap">${escapeHtml(log.hooks)}</div></div>` : '',
        log.moments ? `<div class="form-group"><label class="form-label">Momentos</label><div style="color:var(--ink);white-space:pre-wrap">${escapeHtml(log.moments)}</div></div>` : '',
        log.dmNotes ? `<div class="form-group"><label class="form-label">Notas do Mestre</label><div style="color:#f87171;white-space:pre-wrap">${escapeHtml(log.dmNotes)}</div></div>` : '',
    ].filter(Boolean).join('');
    m.innerHTML = `<div class="modal-content" style="max-width:800px"><div class="modal-header"><span class="modal-title">📝 Sessão #${log.sessionNumber || '?'} — ${log.dateReal || ''}</span><button class="modal-close" onclick="this.closest('.modal').remove()">✕</button></div><div class="modal-body" style="max-height:75vh;overflow-y:auto">
        ${log.gameDate ? `<div style="font-size:.88rem;color:var(--primary);margin-bottom:14px">🎮 Data no jogo: ${escapeHtml(log.gameDate)}</div>` : ''}
        ${sections}
    </div></div>`;
    document.body.appendChild(m);
    m.addEventListener('click', e => { if (e.target === m) m.remove(); });
};

// ===== DELETE SESSION LOG =====
window.deleteSessionLog = async function(logId) {
    if (!confirm('Deletar este log de sessão?')) return;
    try {
        await deleteDoc(doc(db, 'session-logs', logId));
        showAlert('✅ Log deletado', 'success');
        await loadSessionLogs();
    } catch (e) { showAlert('❌ Erro', 'danger'); }
};
