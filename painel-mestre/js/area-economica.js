// =============================================
// ÁREA ECONÔMICA — Recursos, Avulsos, Economia
// =============================================

import { db, collection, getDocs, getDoc, setDoc, deleteDoc, doc, addDoc, updateDoc } from './firebase-config.js';
import * as S from './state.js';
import { showAlert, escapeHtml } from './ui-utils.js';
import { addLog } from './logs.js';


/* Peso e Tamanho do item SEMPRE saem com unidade. Tamanho é em metros e
   fracionado — 0,1 é 10 cm —, então nada de arredondar para inteiro; as casas
   mortas caem para "1 m" não virar "1,00 m". */
const _pesoKg = (v) => `${(parseFloat(v) || 0).toFixed(2)} kg`;
const _tamanhoM = (v) => `${Math.round((parseFloat(v) || 0) * 100) / 100} m`;

export async function onTabActivated() { await loadAvulsosItems(); }

// ===== LOAD AVULSOS =====
async function loadAvulsosItems() {
    try {
        const snap = await getDocs(collection(db, 'items'));
        const items = [];
        snap.forEach(d => { const data = d.data(); if (!data.characterId) items.push({ id: d.id, ...data }); });
        S.setAvulsosItems(items);
        renderAvulsosItems();
    } catch (e) { console.error('❌ Avulsos:', e); showAlert('❌ Erro avulsos', 'danger'); }
}
window.loadAvulsosItems = loadAvulsosItems;

function renderAvulsosItems() {
    const list = document.getElementById('avulsosItemsList');
    const empty = document.getElementById('avulsosItemsEmpty');
    const main = document.getElementById('avulsosItemsContainer');
    const count = document.getElementById('avulsosItemsCount');
    if (!list) return;

    let items = S.avulsosItems.filter(i => !i.parentItemId);
    const ft = document.getElementById('avulsosFilterTipo')?.value || '';
    const fc = document.getElementById('avulsosFilterCategoria')?.value || '';
    const fs = (document.getElementById('avulsosFilterSearch')?.value || '').toLowerCase();
    if (ft) items = items.filter(i => i.tipo === ft);
    if (fc) items = items.filter(i => i.category === fc);
    if (fs) items = items.filter(i => (i.name||'').toLowerCase().includes(fs) || (i.description||'').toLowerCase().includes(fs));

    if (count) count.textContent = `${items.length} recurso(s) avulso(s)`;
    if (items.length === 0) { if (main) main.style.display = 'none'; if (empty) empty.style.display = 'block'; return; }
    if (main) main.style.display = 'block'; if (empty) empty.style.display = 'none';

    items.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    list.innerHTML = items.map(item => `
        <div class="item-draggable" onclick="editAvulsoItem('${item.id}')" style="background:var(--lr-bg-1);border:2px solid var(--border);border-radius:12px;padding:18px;display:flex;align-items:center;gap:15px;cursor:pointer;margin-bottom:10px">
            <div style="width:50px;height:50px;background:rgba(245,158,11,.2);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:1.5rem;flex-shrink:0">📦</div>
            <div style="flex:1;min-width:0">
                <div style="font-weight:700;color:var(--light)">${escapeHtml(item.name || 'Sem nome')} <span style="background:rgba(245,158,11,.2);color:var(--lr-gold);padding:2px 8px;border-radius:6px;font-size:.75rem">${item.tipo || '-'}</span></div>
                <div style="font-size:.82rem;color:var(--muted);margin-top:4px">Peso: ${_pesoKg(item.totalWeight || item.peso)} | Tam: ${_tamanhoM(item.tamanho)} | Qtd: ${item.quantity || 1}</div>
            </div>
            <div style="display:flex;gap:8px">
                <button class="btn btn-danger btn-small" onclick="event.stopPropagation();deleteAvulsoItem('${item.id}')">🗑️</button>
            </div>
        </div>
    `).join('');
}
window.renderAvulsosItems = renderAvulsosItems;

window.applyAvulsosFilters = function() { renderAvulsosItems(); };
window.clearAvulsosFilters = function() {
    ['avulsosFilterTipo','avulsosFilterCategoria','avulsosFilterSearch'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    renderAvulsosItems();
};

window.openAddAvulsoItemModal = function() { showAlert('⚠️ Criar recurso — em migração', 'warning'); };
window.editAvulsoItem = function(id) { showAlert('⚠️ Editar recurso — em migração', 'warning'); };
window.deleteAvulsoItem = async function(id) {
    const item = S.avulsosItems.find(i => i.id === id);
    if (!item || !await LRDialogo.confirmar(`Excluir "${item.name}"?`, { perigo: true })) return;
    try { await deleteDoc(doc(db, 'items', id)); showAlert('✅ Recurso excluído', 'success'); await addLog(S.currentUser?.email, `excluiu recurso avulso "${item.name}"`); await loadAvulsosItems(); }
    catch (e) { showAlert('❌ Erro', 'danger'); }
};

window.openAvulsoContainer = function() { showAlert('⚠️ Container — em migração', 'warning'); };
window.closeAvulsoContainerViewer = function() { S.setCurrentOpenContainerId(null); document.getElementById('avulsoContainerViewer').style.display = 'none'; renderAvulsosItems(); };

// ===== JSON IMPORT =====
window.handleJsonFileUpload = function(e) {
    const file = e.target.files[0]; if (!file) return;
    document.getElementById('selectedFileName').textContent = `📄 ${file.name}`;
    const reader = new FileReader();
    reader.onload = (ev) => { document.getElementById('jsonTextInput').value = ev.target.result; showAlert('✅ JSON carregado', 'success'); };
    reader.readAsText(file);
};

window.previewJsonItems = function() {
    const text = document.getElementById('jsonTextInput')?.value?.trim();
    if (!text) { showAlert('⚠️ Cole um JSON', 'warning'); return; }
    try {
        let parsed = JSON.parse(text);
        let items = Array.isArray(parsed) ? parsed : parsed.itens || parsed.items || (parsed.name ? [parsed] : []);
        items = items.filter(i => i.name || i.nome).map(i => ({ name: i.name || i.nome, tipo: i.tipo || 'Objeto', peso: i.peso || 1, tamanho: i.tamanho || 1, quantity: i.quantity || 1, description: i.description || i.descricao || '', category: i.category || '', basePrice: i.basePrice || 0 }));
        S.setParsedJsonItems(items);
        const area = document.getElementById('jsonPreviewArea'); const list = document.getElementById('jsonPreviewList'); const cnt = document.getElementById('jsonPreviewCount');
        if (cnt) cnt.textContent = `${items.length} item(s)`;
        if (list) list.innerHTML = items.map((i, idx) => `<div style="background:var(--lr-bg-1);border:2px solid var(--border);border-radius:10px;padding:12px"><strong>${idx + 1}. ${escapeHtml(i.name)}</strong> <span style="color:var(--muted);font-size:.82rem">${i.tipo}</span></div>`).join('');
        if (area) area.style.display = 'block';
        showAlert(`✅ ${items.length} item(s) carregado(s)`, 'success');
    } catch (e) { showAlert('❌ JSON inválido: ' + e.message, 'danger'); }
};

window.importJsonItemsToAvulso = async function() {
    if (S.parsedJsonItems.length === 0) { window.previewJsonItems(); if (S.parsedJsonItems.length === 0) return; }
    if (!await LRDialogo.confirmar(`Importar ${S.parsedJsonItems.length} item(s)?`)) return;
    let ok = 0;
    for (const item of S.parsedJsonItems) {
        try { await addDoc(collection(db, 'items'), { ...item, characterId: null, createdAt: new Date().toISOString(), createdBy: S.currentUser?.email }); ok++; } catch (e) { /* skip */ }
    }
    window.clearJsonInput();
    await loadAvulsosItems();
    await addLog(S.currentUser?.email, `importou ${ok} recurso(s) via JSON`);
    showAlert(`✅ ${ok} recurso(s) importado(s)`, 'success');
};

window.clearJsonInput = function() {
    ['jsonTextInput'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    document.getElementById('selectedFileName').textContent = 'Nenhum arquivo';
    const fi = document.getElementById('jsonFileInput'); if (fi) fi.value = '';
    document.getElementById('jsonPreviewArea').style.display = 'none';
    S.setParsedJsonItems([]);
};

window.downloadItemTemplate = function() {
    const t = { itens: [{ name: 'Exemplo', tipo: 'Objeto', peso: 1, tamanho: 1, quantity: 1, description: 'Descrição' }] };
    const blob = new Blob([JSON.stringify(t, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `template_itens_${Date.now()}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    showAlert('✅ Template baixado', 'success');
};

// ===== ECONOMY ENGINE (stubs) =====
window.loadEconomyData = async function() { showAlert('⚠️ Motor econômico — em migração', 'warning'); };
window.openEconomyItemModal = function() { showAlert('⚠️ Em migração', 'warning'); };
window.openEconomyLocationModal = function() { showAlert('⚠️ Em migração', 'warning'); };
window.openEconomyEventModal = function() { showAlert('⚠️ Em migração', 'warning'); };
