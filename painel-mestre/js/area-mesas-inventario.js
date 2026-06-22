// =============================================
// AREA MESAS — Inventário Geral
// =============================================
import { db, collection, getDocs, doc, updateDoc } from './firebase-config.js';
import * as S from './state.js';
import { showAlert, escapeHtml } from './ui-utils.js';

window._loadMesaInventarios = loadMesaInventarios;

function _calcItemPressure(item, allItems) {
    const base = item.pressaoOverride != null ? item.pressaoOverride
        : (item.pressaoBase != null ? item.pressaoBase : (item.peso || 0));
    if (item.ehContainer) {
        const inside = allItems.filter(i => i.parentItemId === item.id);
        const insideWeight = inside.reduce((sum, i) => sum + (i.peso || 0), 0);
        return base + (insideWeight * (item.multiplicadorPressao || 1));
    }
    return base;
}

async function loadMesaInventarios() {
    if (!S.currentMesaId) return;
    const el = document.getElementById('mesaInventarioContent'); if (!el) return;
    try {
        const chars = S.mesaCharacters || [];
        if (!chars.length) {
            const snap = await getDocs(collection(db, 'char'));
            snap.forEach(d => {
                const raw = d.data();
                const f = raw.fields || {};
                if (raw.mesaId === S.currentMesaId || (S.currentMesaData?.jogadores||[]).includes(raw.ownerUid)) {
                    chars.push({
                        id: d.id,
                        nome: f.nome || raw.nome || '',
                        ownerUid: raw.ownerUid || '',
                        ...raw
                    });
                }
            });
        }
        if (!chars.length) { el.innerHTML = '<div style="text-align:center;padding:50px;color:var(--muted)">Nenhum personagem nesta mesa</div>'; return; }
        // Load items for all characters
        const itemsSnap = await getDocs(collection(db, 'items'));
        const allItems = []; itemsSnap.forEach(d => allItems.push({ id: d.id, ...d.data() }));
        let html = '';
        for (const c of chars) {
            const charItems = allItems.filter(it => it.characterId === c.id);
            const equippedItems = charItems.filter(it => it.equipado && !it.parentItemId);
            const totalPressure = equippedItems.reduce((sum, it) => sum + _calcItemPressure(it, charItems), 0);

            html += `<div class="sessao-card" style="margin-bottom:14px">
                <div class="sessao-card-header">
                    <div class="sessao-titulo">🎭 ${escapeHtml(c.nome || 'Sem nome')}</div>
                    <div style="display:flex;gap:12px;align-items:center">
                        <span style="background:rgba(245,158,11,.15);color:#f59e0b;padding:3px 10px;border-radius:8px;font-size:.78rem;font-weight:700">⚖️ Pressão: ${parseFloat(totalPressure).toFixed(2)}</span>
                        <span class="sessao-data">${charItems.length} item(ns)</span>
                    </div>
                </div>`;
            if (charItems.length) {
                html += '<div style="display:grid;gap:6px;margin-top:8px">';
                for (const it of charItems.filter(i => !i.parentItemId)) {
                    const pressure = it.equipado ? _calcItemPressure(it, charItems) : 0;
                    const equipBadge = it.equipado ? '<span style="background:rgba(16,185,129,.2);color:#10b981;padding:2px 6px;border-radius:4px;font-size:.7rem;font-weight:700">EQUIPADO</span>' : '';
                    const containerBadge = it.ehContainer ? `<span style="background:rgba(139,92,246,.15);color:var(--primary);padding:2px 6px;border-radius:4px;font-size:.7rem">📦 ${charItems.filter(i => i.parentItemId === it.id).length} dentro</span>` : '';
                    html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:rgba(0,0,0,.2);border-radius:8px;font-size:.88rem">
                        <div style="display:flex;align-items:center;gap:8px">
                            <span style="color:var(--light);font-weight:600">${escapeHtml(it.nome || it.name || 'Item')}</span>
                            <span style="color:var(--muted);font-size:.78rem">${it.tipo || ''}</span>
                            ${equipBadge}${containerBadge}
                        </div>
                        <div style="display:flex;gap:10px;align-items:center">
                            <span style="color:var(--muted);font-size:.78rem">Peso: ${parseFloat(it.peso || 0).toFixed(2)}</span>
                            ${it.equipado ? `<span style="color:#f59e0b;font-size:.78rem;font-weight:600">⚖️ ${parseFloat(pressure).toFixed(2)}</span>` : ''}
                        </div>
                    </div>`;
                }
                html += '</div>';
            } else {
                html += '<div style="color:var(--muted);font-size:.85rem;padding:8px">Inventário vazio</div>';
            }
            html += '</div>';
        }
        el.innerHTML = html;
    } catch (e) { console.error(e); showAlert('❌ Erro ao carregar inventários', 'danger'); }
}
