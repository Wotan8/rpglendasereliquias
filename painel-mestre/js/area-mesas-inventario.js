// =============================================
// AREA MESAS — Inventário Geral + Caixa do Mestre
// =============================================
import { db, collection, getDocs, doc, getDoc, setDoc, deleteDoc, updateDoc } from './firebase-config.js';
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

function _getCaixaMestreId(mesaId) {
    return '__caixa_mestre__' + mesaId;
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

        // Load items for all characters + caixa do mestre
        const itemsSnap = await getDocs(collection(db, 'items'));
        const allItems = []; itemsSnap.forEach(d => allItems.push({ id: d.id, ...d.data() }));

        const caixaId = _getCaixaMestreId(S.currentMesaId);
        const caixaItems = allItems.filter(it => it.characterId === caixaId);

        let html = '';

        // ===== BLOCO 1: CAIXA DO MESTRE =====
        html += `<div class="sessao-card" style="margin-bottom:14px;border:2px solid rgba(245,158,11,.25)">
            <div class="sessao-card-header" style="background:linear-gradient(135deg,rgba(245,158,11,.08),rgba(245,158,11,.02))">
                <div class="sessao-titulo" style="color:#f59e0b">📦 Caixa do Mestre</div>
                <div style="display:flex;gap:8px;align-items:center">
                    <span class="sessao-data">${caixaItems.length} item(ns)</span>
                    <button onclick="_openMestreItemFormModal('${S.currentMesaId}')" style="background:rgba(245,158,11,.15);border:1px solid rgba(245,158,11,.35);color:#f59e0b;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:.78rem;font-weight:700;transition:all .2s">➕ Criar Item</button>
                </div>
            </div>`;

        if (caixaItems.length) {
            html += '<div style="display:grid;gap:6px;margin-top:8px">';
            for (const it of caixaItems.filter(i => !i.parentItemId)) {
                const pressure = it.equipado ? _calcItemPressure(it, caixaItems) : 0;
                const containerBadge = it.ehContainer ? `<span style="background:rgba(139,92,246,.15);color:var(--primary);padding:2px 6px;border-radius:4px;font-size:.7rem">📦 ${caixaItems.filter(i => i.parentItemId === it.id).length} dentro</span>` : '';
                html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:rgba(0,0,0,.2);border-radius:8px;font-size:.88rem">
                    <div style="display:flex;align-items:center;gap:8px">
                        <span style="color:var(--light);font-weight:600">${escapeHtml(it.nome || it.name || 'Item')}</span>
                        <span style="color:var(--muted);font-size:.78rem">${it.tipo || ''}</span>
                        ${containerBadge}
                    </div>
                    <div style="display:flex;gap:6px;align-items:center">
                        <span style="color:var(--muted);font-size:.78rem">Peso: ${parseFloat(it.peso || 0).toFixed(2)}</span>
                        <span style="color:var(--muted);font-size:.78rem">×${it.quantidade || 1}</span>
                        <button onclick="_openMestreTransferModal('${it.id}','${S.currentMesaId}')" style="background:rgba(6,182,212,.12);border:1px solid rgba(6,182,212,.3);color:#06b6d4;padding:3px 8px;border-radius:5px;cursor:pointer;font-size:.75rem;font-weight:600;transition:all .2s" title="Transferir">🔄</button>
                        <button onclick="_openMestreItemFormModal('${S.currentMesaId}','${it.id}')" style="background:rgba(139,92,246,.12);border:1px solid rgba(139,92,246,.3);color:var(--primary);padding:3px 8px;border-radius:5px;cursor:pointer;font-size:.75rem;font-weight:600;transition:all .2s" title="Editar">✏️</button>
                        <button onclick="_deleteMestreItem('${it.id}')" style="background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.3);color:#ef4444;padding:3px 8px;border-radius:5px;cursor:pointer;font-size:.75rem;font-weight:600;transition:all .2s" title="Excluir">🗑️</button>
                    </div>
                </div>`;
            }
            html += '</div>';
        } else {
            html += '<div style="color:var(--muted);font-size:.85rem;padding:12px;text-align:center;font-style:italic">Caixa vazia — crie ou receba itens dos jogadores</div>';
        }
        html += '</div>';

        // ===== BLOCOS 2+: PERSONAGENS DA MESA =====
        if (!chars.length) {
            html += '<div style="text-align:center;padding:30px;color:var(--muted)">Nenhum personagem nesta mesa</div>';
        } else {
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
        }

        el.innerHTML = html;
    } catch (e) { console.error(e); showAlert('❌ Erro ao carregar inventários', 'danger'); }
}

// ===== CAIXA DO MESTRE: CRUD =====

window._openMestreItemFormModal = async function(mesaId, editItemId) {
    let existing = document.getElementById('mestreItemFormModal');
    if (existing) existing.remove();

    let item = null;
    if (editItemId) {
        try {
            const snap = await getDoc(doc(db, 'items', editItemId));
            if (snap.exists()) item = { id: snap.id, ...snap.data() };
        } catch(e) { console.error(e); }
    }

    const isEdit = !!item;
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'mestreItemFormModal';
    modal.innerHTML = `<div class="modal-content" style="max-width:550px">
        <div class="modal-header">
            <span class="modal-title">${isEdit ? '✏️ Editar Item' : '➕ Criar Item na Caixa do Mestre'}</span>
            <button class="modal-close" onclick="this.closest('.modal').remove()">✕</button>
        </div>
        <div class="modal-body">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                <div class="form-group" style="grid-column:1/-1">
                    <label class="form-label">Nome *</label>
                    <input type="text" class="form-input" id="mif_nome" value="${escapeHtml(item?.nome || '')}" placeholder="Nome do item">
                </div>
                <div class="form-group">
                    <label class="form-label">Tipo</label>
                    <select class="form-select" id="mif_tipo">
                        <option value="Objeto" ${item?.tipo==='Objeto'?'selected':''}>📦 Objeto</option>
                        <option value="Arma" ${item?.tipo==='Arma'?'selected':''}>⚔️ Arma</option>
                        <option value="Vestimenta" ${item?.tipo==='Vestimenta'?'selected':''}>🧥 Vestimenta</option>
                        <option value="Projétil" ${item?.tipo==='Projétil'?'selected':''}>🎯 Projétil</option>
                        <option value="Container" ${item?.tipo==='Container'?'selected':''}>📦 Container</option>
                        <option value="Consumível" ${item?.tipo==='Consumível'?'selected':''}>🧪 Consumível</option>
                        <option value="Relíquia" ${item?.tipo==='Relíquia'?'selected':''}>✨ Relíquia</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Peso</label>
                    <input type="number" class="form-input" id="mif_peso" value="${item?.peso || 1}" min="0" step="0.1">
                </div>
                <div class="form-group">
                    <label class="form-label">Tamanho</label>
                    <input type="number" class="form-input" id="mif_tamanho" value="${item?.tamanho || 1}" min="0">
                </div>
                <div class="form-group">
                    <label class="form-label">Quantidade</label>
                    <input type="number" class="form-input" id="mif_quantidade" value="${item?.quantidade || 1}" min="1">
                </div>
                <div class="form-group" style="grid-column:1/-1">
                    <label class="form-label">Descrição</label>
                    <textarea class="form-textarea" id="mif_descricao" rows="3" placeholder="Descrição do item">${escapeHtml(item?.descricao || '')}</textarea>
                </div>
                <div class="form-group" style="grid-column:1/-1">
                    <label class="form-label">Imagem (URL)</label>
                    <input type="text" class="form-input" id="mif_imagem" value="${escapeHtml(item?.imagem || item?.imagemUrl || '')}" placeholder="https://...">
                </div>
            </div>
            <input type="hidden" id="mif_mesaId" value="${mesaId}">
            ${isEdit ? `<input type="hidden" id="mif_editId" value="${item.id}">` : ''}
        </div>
        <div class="modal-footer" style="display:flex;gap:10px;justify-content:flex-end;padding:12px 20px;border-top:1px solid var(--border)">
            <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancelar</button>
            <button class="btn btn-success" onclick="_saveMestreItem()">💾 Salvar</button>
        </div>
    </div>`;
    document.body.appendChild(modal);
};

window._saveMestreItem = async function() {
    const nome = document.getElementById('mif_nome')?.value?.trim();
    if (!nome) { showAlert('⚠️ Nome obrigatório', 'warning'); return; }

    const mesaId = document.getElementById('mif_mesaId')?.value;
    const editId = document.getElementById('mif_editId')?.value || '';
    const tipo = document.getElementById('mif_tipo')?.value || 'Objeto';
    const isContainer = tipo === 'Container';

    const itemData = {
        nome,
        tipo,
        peso: parseFloat(document.getElementById('mif_peso')?.value) || 1,
        tamanho: parseInt(document.getElementById('mif_tamanho')?.value) || 1,
        quantidade: Math.max(1, parseInt(document.getElementById('mif_quantidade')?.value) || 1),
        descricao: document.getElementById('mif_descricao')?.value?.trim() || '',
        imagem: document.getElementById('mif_imagem')?.value?.trim() || '',
        characterId: _getCaixaMestreId(mesaId),
        ownerUid: S.currentUser?.uid || '',
        ownerId: S.currentUser?.uid || '',
        equipado: false,
        parentItemId: null,
        criadoPor: 'mestre',
        lastModified: new Date().toISOString(),
        ehContainer: isContainer,
        pressaoBase: parseFloat(document.getElementById('mif_peso')?.value) || 1
    };

    try {
        if (editId) {
            await setDoc(doc(db, 'items', editId), itemData, { merge: true });
        } else {
            const newId = 'item-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
            itemData.id = newId;
            await setDoc(doc(db, 'items', newId), itemData);
        }
        showAlert('✅ Item salvo!', 'success');
        document.getElementById('mestreItemFormModal')?.remove();
        await loadMesaInventarios();
    } catch (e) {
        console.error('❌ Erro ao salvar item:', e);
        showAlert('❌ Erro: ' + e.message, 'danger');
    }
};

window._deleteMestreItem = async function(itemId) {
    if (!confirm('Excluir este item da Caixa do Mestre?')) return;
    try {
        await deleteDoc(doc(db, 'items', itemId));
        showAlert('✅ Item excluído', 'success');
        await loadMesaInventarios();
    } catch (e) {
        console.error('❌ Erro ao excluir:', e);
        showAlert('❌ Erro: ' + e.message, 'danger');
    }
};

// ===== CAIXA DO MESTRE: TRANSFERIR =====

window._openMestreTransferModal = async function(itemId, mesaId) {
    let existing = document.getElementById('mestreTransferModal');
    if (existing) existing.remove();

    // Get item info
    let itemNome = 'Item';
    try {
        const snap = await getDoc(doc(db, 'items', itemId));
        if (snap.exists()) itemNome = snap.data().nome || 'Item';
    } catch(e) {}

    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'mestreTransferModal';
    modal.innerHTML = `<div class="modal-content" style="max-width:500px">
        <div class="modal-header">
            <span class="modal-title">🔄 Transferir: ${escapeHtml(itemNome)}</span>
            <button class="modal-close" onclick="this.closest('.modal').remove()">✕</button>
        </div>
        <div class="modal-body">
            <div style="text-align:center;padding:20px;color:var(--muted)">⏳ Carregando personagens...</div>
        </div>
    </div>`;
    document.body.appendChild(modal);

    try {
        // Get characters in mesa
        const chars = S.mesaCharacters || [];
        if (!chars.length) {
            const snap = await getDocs(collection(db, 'char'));
            snap.forEach(d => {
                const data = d.data();
                if (data.mesaId === mesaId) {
                    const f = data.fields || {};
                    chars.push({
                        id: d.id,
                        nome: f.nome || data.nome || 'Sem nome',
                        ownerUid: data.ownerUid || '',
                        ownerEmail: data.ownerEmail || data.userEmail || ''
                    });
                }
            });
        }

        const body = modal.querySelector('.modal-body');
        if (!chars.length) {
            body.innerHTML = '<div style="text-align:center;padding:30px;color:var(--muted)">🚫 Nenhum personagem na mesa</div>';
            return;
        }

        body.innerHTML = `<div style="display:grid;gap:8px;max-height:50vh;overflow-y:auto;padding:4px">
            ${chars.map(c => {
                const f = c.fields || {};
                const nome = f.nome || c.nome || 'Sem nome';
                const email = c.ownerEmail || c.userEmail || '';
                return `<div style="display:flex;flex-direction:column;gap:4px;padding:14px 16px;background:rgba(15,23,42,.5);border:2px solid rgba(139,92,246,.12);border-radius:10px;cursor:pointer;transition:all .2s"
                    onmouseenter="this.style.borderColor='#8b5cf6';this.style.background='rgba(139,92,246,.08)'"
                    onmouseleave="this.style.borderColor='rgba(139,92,246,.12)';this.style.background='rgba(15,23,42,.5)'"
                    onclick="_executeMestreTransfer('${itemId}','${c.id}','${c.ownerUid || ''}')">
                    <div style="font-weight:700;font-size:.95rem;color:var(--light)">🎭 ${escapeHtml(nome)}</div>
                    ${email ? `<div style="font-size:.78rem;color:var(--muted)">👤 ${escapeHtml(email)}</div>` : ''}
                </div>`;
            }).join('')}
        </div>`;
    } catch (e) {
        console.error(e);
        const body = modal.querySelector('.modal-body');
        if (body) body.innerHTML = `<div style="text-align:center;padding:20px;color:#ef4444">❌ Erro: ${escapeHtml(e.message)}</div>`;
    }
};

window._executeMestreTransfer = async function(itemId, targetCharId, targetOwnerUid) {
    if (!confirm('Transferir este item para o personagem selecionado?')) return;
    try {
        // Get target character ownerUid if not provided
        let ownerUid = targetOwnerUid;
        if (!ownerUid) {
            const charSnap = await getDoc(doc(db, 'char', targetCharId));
            if (charSnap.exists()) {
                ownerUid = charSnap.data().ownerUid || '';
            }
        }

        await setDoc(doc(db, 'items', itemId), {
            characterId: targetCharId,
            ownerUid: ownerUid,
            ownerId: ownerUid,
            equipado: false,
            parentItemId: null,
            lastModified: new Date().toISOString()
        }, { merge: true });

        showAlert('✅ Item transferido com sucesso!', 'success');
        document.getElementById('mestreTransferModal')?.remove();
        await loadMesaInventarios();
    } catch (e) {
        console.error('❌ Erro ao transferir:', e);
        showAlert('❌ Erro: ' + e.message, 'danger');
    }
};
