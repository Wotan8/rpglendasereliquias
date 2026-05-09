// =============================================
// AREA MESAS — Inventário Geral
// =============================================
import { db, collection, getDocs, doc, updateDoc } from './firebase-config.js';
import * as S from './state.js';
import { showAlert, escapeHtml } from './ui-utils.js';

window._loadMesaInventarios = loadMesaInventarios;

async function loadMesaInventarios() {
    if (!S.currentMesaId) return;
    const el = document.getElementById('mesaInventarioContent'); if (!el) return;
    try {
        const chars = S.mesaCharacters || [];
        if (!chars.length) {
            // Reload chars
            const snap = await getDocs(collection(db, 'characters'));
            snap.forEach(d => { const data = d.data(); if (data.mesaId === S.currentMesaId || (S.currentMesaData?.jogadores||[]).includes(data.ownerUid)) chars.push({ id: d.id, ...data }); });
        }
        if (!chars.length) { el.innerHTML = '<div style="text-align:center;padding:50px;color:var(--muted)">Nenhum personagem nesta mesa</div>'; return; }
        // Load items for all characters
        const itemsSnap = await getDocs(collection(db, 'items'));
        const allItems = []; itemsSnap.forEach(d => allItems.push({ id: d.id, ...d.data() }));
        let html = '';
        for (const c of chars) {
            const charItems = allItems.filter(it => it.characterId === c.id);
            html += `<div class="sessao-card" style="margin-bottom:14px">
                <div class="sessao-card-header">
                    <div class="sessao-titulo">🎭 ${escapeHtml(c.nome || 'Sem nome')}</div>
                    <span class="sessao-data">${charItems.length} item(ns)</span>
                </div>`;
            if (charItems.length) {
                html += '<div style="display:grid;gap:6px;margin-top:8px">';
                for (const it of charItems) {
                    html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:rgba(0,0,0,.2);border-radius:8px;font-size:.88rem">
                        <div><span style="color:var(--light);font-weight:600">${escapeHtml(it.nome || it.name || 'Item')}</span> <span style="color:var(--muted);font-size:.78rem">${it.tipo || it.type || ''}</span></div>
                        <div style="display:flex;gap:6px;align-items:center">
                            <span style="color:var(--muted);font-size:.78rem">Qtd: ${it.quantidade || it.quantity || 1}</span>
                            <span style="color:var(--muted);font-size:.78rem">⚖️ ${it.totalWeight || it.weight || 0}</span>
                        </div>
                    </div>`;
                }
                html += '</div>';
            } else {
                html += '<div style="color:var(--muted);font-size:.85rem;padding:8px">Inventário vazio</div>';
            }
            // Also show containers
            const containers = c.containers || [];
            if (containers.length) {
                html += '<div style="margin-top:8px">';
                for (const cont of containers) {
                    html += `<div style="padding:6px 10px;background:rgba(139,92,246,.1);border-radius:8px;margin-bottom:4px;font-size:.82rem"><span style="color:var(--primary);font-weight:700">📂 ${escapeHtml(cont.name || 'Container')}</span> <span style="color:var(--muted)">Cap: ${cont.maxCapacity || '?'}</span></div>`;
                }
                html += '</div>';
            }
            html += '</div>';
        }
        el.innerHTML = html;
    } catch (e) { console.error(e); showAlert('❌ Erro ao carregar inventários', 'danger'); }
}
