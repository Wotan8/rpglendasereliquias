// REPERTÓRIO — Inventário por Personagem
import { db, collection, getDocs, getDoc, setDoc, deleteDoc, doc, query, where, addDoc, updateDoc } from './firebase-config.js';
import * as S from './state.js';
import { showAlert, escapeHtml } from './ui-utils.js';
import { addLog } from './logs.js';

// ===== POPULATE SELECT =====
export async function populateCharacterSelect() {
    const sel = document.getElementById('selectInventarioPersonagem');
    if (!sel) return;
    sel.innerHTML = '<option value="">Selecione um personagem...</option>';
    const chars = S.allCharacters.length ? S.allCharacters : [];
    if (!chars.length) {
        try {
            const snap = await getDocs(collection(db, 'characters'));
            snap.forEach(d => { const c = { id: d.id, ...d.data() }; chars.push(c); });
            S.setAllCharacters(chars);
        } catch(e) { console.error(e); }
    }
    chars.sort((a,b) => (a.nome||'').localeCompare(b.nome||''));
    chars.forEach(c => {
        const o = document.createElement('option');
        o.value = c.id;
        o.textContent = `${c.nome||'Sem nome'} (${c.jogador||'Jogador'})`;
        sel.appendChild(o);
    });
}

// ===== FILTER =====
window.filterInventarioPersonagens = function() {
    const term = (document.getElementById('searchInventarioPersonagem')?.value||'').toLowerCase();
    if (!term) return;
    const match = S.allCharacters.find(c => (c.nome||'').toLowerCase().includes(term) || (c.jogador||'').toLowerCase().includes(term));
    if (match) { document.getElementById('selectInventarioPersonagem').value = match.id; window.loadPersonagemInventario(); }
};

// ===== LOAD INVENTARIO =====
window.loadPersonagemInventario = async function() {
    const id = document.getElementById('selectInventarioPersonagem')?.value;
    const container = document.getElementById('inventarioPersonagemContainer');
    const empty = document.getElementById('inventarioPersonagemEmpty');
    if (!id) { if(container) container.style.display='none'; if(empty) empty.style.display='block'; return; }

    S.setCurrentInventarioPersonagemId(id);
    const char = S.allCharacters.find(c => c.id === id);
    if (!char) { showAlert('❌ Personagem não encontrado','danger'); return; }

    const nomeEl = document.getElementById('invPersonagemNome');
    const infoEl = document.getElementById('invPersonagemInfo');
    if (nomeEl) nomeEl.textContent = char.nome || 'Sem nome';
    if (infoEl) infoEl.textContent = `${char.jogador||'Jogador'} • ${char.classe||'-'} • ${char.raca||'-'}`;
    if (container) container.style.display = 'block';
    if (empty) empty.style.display = 'none';

    await loadInventarioFromFirebase(id);
};

async function loadInventarioFromFirebase(charId) {
    try {
        // Containers
        const cSnap = await getDocs(query(collection(db,'containers'), where('characterId','==',charId)));
        const containers = []; cSnap.forEach(d => containers.push({id:d.id,...d.data()}));
        S.setCurrentInventarioContainers(containers);

        // Items
        const iSnap = await getDocs(query(collection(db,'items'), where('characterId','==',charId)));
        const items = []; iSnap.forEach(d => items.push({id:d.id,...d.data()}));
        S.setCurrentInventarioItems(items);

        await ensureEquipados(charId);
        renderInventario();
    } catch(e) { console.error('❌ Inventário:',e); showAlert('❌ Erro inventário','danger'); }
}

async function ensureEquipados(charId) {
    const eq = S.currentInventarioContainers.find(c => c.name === 'Equipados');
    if (eq) return;
    const char = S.allCharacters.find(c => c.id === charId) || {};
    const maxSize = (char.for||1) * (char.vig||1) * ((char.skills?.atletismo||0)+1);
    let maxCap = (char.for||1) + (char.vig||1);
    if (char.raca === 'Yotun') maxCap *= 2;

    let ownerId = S.currentUser?.uid || '';
    try { const cd = await getDoc(doc(db,'characters',charId)); if(cd.exists()) ownerId = cd.data().ownerUid || ownerId; } catch(e){}

    const newEq = { id:'equipados-'+Date.now(), name:'Equipados', ownerId, characterId:charId, maxCapacity:maxCap, maxSize, itemIds:[] };
    await setDoc(doc(db,'containers',newEq.id), newEq);
    S.currentInventarioContainers.push(newEq);
}

// ===== RENDER =====
function renderInventario() {
    const el = document.getElementById('inventarioContainersList');
    if (!el) return;
    const eqCont = S.currentInventarioContainers.find(c => c.name === 'Equipados');
    const eqItems = S.currentInventarioItems.filter(i => !i.parentItemId && i.containerId === 'está com alguém');
    const peso = eqItems.reduce((s,i) => s + (i.totalWeight||0), 0);

    el.innerHTML = `
        <div style="background:rgba(30,27,75,.6);border:2px solid var(--border);border-radius:15px;padding:20px;margin-bottom:20px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;padding-bottom:15px;border-bottom:2px solid var(--line)">
                <div>
                    <div style="font-size:1.3rem;font-weight:700;color:var(--primary)">🎒 Equipados</div>
                    <div style="font-size:.85rem;color:var(--muted);margin-top:5px">Capacidade: ${peso.toFixed(1)} / ${eqCont?.maxCapacity||0} | Tam. Máx: ${eqCont?.maxSize||0}</div>
                </div>
                <button class="btn btn-success btn-small" onclick="addItemToContainerMestre('está com alguém')">➕ Adicionar</button>
            </div>
            <div style="display:grid;gap:10px">
                ${eqItems.length === 0 ? '<div style="text-align:center;padding:30px;color:var(--muted);background:rgba(15,23,42,.4);border-radius:10px">Nenhum item equipado</div>' :
                eqItems.map(item => renderItemCard(item, eqCont)).join('')}
            </div>
        </div>
        ${renderPersonagemContainerViewer()}`;
}

function renderItemCard(item, eqCont) {
    const isCont = item.tipo === 'Container';
    const isOpen = S.currentOpenPersonagemContainerId === item.id;
    const img = item.imagem ? `<img src="${item.imagem}" style="width:50px;height:50px;object-fit:contain;border-radius:8px;background:rgba(15,23,42,.8);padding:5px;border:2px solid ${isOpen?'rgba(16,185,129,.6)':'var(--border)'}">` :
        (isCont ? `<div style="width:50px;height:50px;background:rgba(16,185,129,.2);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:1.3rem;border:2px solid ${isOpen?'rgba(16,185,129,.6)':'rgba(16,185,129,.4)'}">📦</div>` : '');

    let badges = '', openBtn = '';
    if (isCont) {
        const linked = S.currentInventarioContainers.find(c => c.id === item.linkedContainerId);
        const cap = linked?.maxCapacity || item.maxCapacity || 10;
        const inside = S.currentInventarioItems.filter(i => i.parentItemId === item.id || (item.linkedContainerId && i.containerId === item.linkedContainerId)).length;
        badges = `<span style="background:rgba(16,185,129,.2);color:#10b981;padding:3px 8px;border-radius:6px;font-size:.75rem;font-weight:600;margin-left:8px">📦 Cap: ${cap}</span><span style="background:rgba(139,92,246,.2);color:var(--primary);padding:3px 8px;border-radius:6px;font-size:.75rem;font-weight:600;margin-left:5px">${inside} item(s)</span>`;
        openBtn = `<button class="btn ${isOpen?'btn-success':'btn-warning'} btn-small" onclick="event.stopPropagation();openPersonagemContainer('${item.id}')">${isOpen?'📂':'📁'}</button>`;
    }

    return `<div onclick="editItemMestre('está com alguém','${item.id}')" style="background:rgba(15,23,42,.6);border:2px solid ${isOpen?'rgba(16,185,129,.6)':'var(--border)'};border-radius:10px;padding:15px;display:flex;align-items:center;gap:15px;cursor:pointer">
        ${img}
        <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;flex-wrap:wrap"><div style="font-size:1.1rem;font-weight:600;color:var(--light)">${item.equipado?'⚔️ ':''}${escapeHtml(item.name||'Sem nome')}</div>${badges}</div>
            <div style="font-size:.85rem;color:var(--muted);margin-top:5px">${item.tipo||'-'} | Peso: ${item.totalWeight||0} | Tam: ${item.tamanho||0} | Qtd: ${item.quantity||1}${item.dureza!=null?' | Dur: '+item.dureza:''}${item.integridade!=null?' | Int: '+item.integridade:''}</div>
            ${item.description?`<div style="font-size:.8rem;color:#64748b;margin-top:5px;font-style:italic">${escapeHtml((item.description||'').substring(0,100))}${(item.description||'').length>100?'...':''}</div>`:''}
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap" onclick="event.stopPropagation()">
            ${openBtn}
            <button class="btn btn-primary btn-small" onclick="openTransferItemModal('${item.id}',false)">🔄</button>
            <button class="btn btn-danger btn-small" onclick="deleteItemMestre('${eqCont?.id||''}','${item.id}')">🗑️</button>
        </div>
    </div>`;
}

function renderPersonagemContainerViewer() {
    const cid = S.currentOpenPersonagemContainerId;
    if (!cid) return '';
    const contItem = S.currentInventarioItems.find(i => i.id === cid);
    if (!contItem) return '';
    const linked = S.currentInventarioContainers.find(c => c.id === contItem.linkedContainerId);
    const maxCap = linked?.maxCapacity || contItem.maxCapacity || 10;
    const maxSize = linked?.maxSize || contItem.maxSize || 5;
    const inside = S.currentInventarioItems.filter(i => i.parentItemId === cid || (contItem.linkedContainerId && i.containerId === contItem.linkedContainerId));
    const used = inside.reduce((s,i) => s+(i.tamanho||1), 0);

    const itemsHtml = inside.length === 0 ? '<div style="text-align:center;padding:30px;color:var(--muted)"><div style="font-size:2rem;margin-bottom:10px">📭</div>Container vazio</div>' :
        inside.map(i => {
            const img2 = i.imagem ? `<img src="${i.imagem}" style="width:50px;height:50px;object-fit:contain;border-radius:8px;background:rgba(15,23,42,.8);padding:3px;border:1px solid var(--border)">` :
                `<div style="width:50px;height:50px;background:rgba(16,185,129,.2);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:1.2rem;border:1px solid rgba(16,185,129,.4)">📄</div>`;
            return `<div style="background:rgba(15,23,42,.6);border:2px solid var(--border);border-radius:10px;padding:12px;display:flex;align-items:center;gap:12px;cursor:pointer" onclick="editItemMestre('${cid}','${i.id}')">
                ${img2}
                <div style="flex:1;min-width:0">
                    <div style="font-weight:700;color:var(--light)">${escapeHtml(i.name||'Sem nome')} <span style="background:rgba(16,185,129,.2);color:#10b981;padding:2px 8px;border-radius:6px;font-size:.75rem">${i.tipo||'-'}</span></div>
                    <div style="font-size:.82rem;color:var(--muted);margin-top:4px">Peso: ${i.totalWeight||i.peso||0} | Tam: ${i.tamanho||0} | Qtd: ${i.quantity||1}</div>
                </div>
                <div style="display:flex;gap:6px" onclick="event.stopPropagation()">
                    <button class="btn btn-warning btn-small" onclick="removeItemFromPersonagemContainer('${i.id}')">📤</button>
                    <button class="btn btn-danger btn-small" onclick="deleteItemMestre('${cid}','${i.id}')">🗑️</button>
                </div>
            </div>`;
        }).join('');

    return `<div id="personagemContainerViewer" style="background:rgba(16,185,129,.05);border:2px solid rgba(16,185,129,.3);border-radius:15px;padding:20px;margin-top:15px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px">
            <div><span style="font-size:1.2rem;font-weight:700;color:#10b981">📂 ${escapeHtml(contItem.name||'Container')}</span></div>
            <button class="btn btn-danger btn-small" onclick="closePersonagemContainerViewer()">✕ Fechar</button>
        </div>
        <div style="display:flex;gap:20px;margin-bottom:15px;font-size:.85rem;color:var(--muted)">
            <span>Capacidade: ${used} / ${maxCap}</span><span>Tam. Máx Item: ${maxSize}</span><span>Itens: ${inside.length}</span>
        </div>
        <div style="display:grid;gap:10px">${itemsHtml}</div>
        <div style="margin-top:12px"><button class="btn btn-success btn-small" onclick="addItemToOpenContainerMestre()">➕ Adicionar Item</button></div>
    </div>`;
}

// ===== CONTAINER VIEWER =====
window.openPersonagemContainer = function(itemId) {
    if (S.currentOpenPersonagemContainerId === itemId) { window.closePersonagemContainerViewer(); return; }
    S.setCurrentOpenPersonagemContainerId(itemId);
    renderInventario();
    setTimeout(() => { document.getElementById('personagemContainerViewer')?.scrollIntoView({behavior:'smooth',block:'start'}); }, 100);
};
window.closePersonagemContainerViewer = function() { S.setCurrentOpenPersonagemContainerId(null); renderInventario(); };

window.removeItemFromPersonagemContainer = async function(itemId) {
    try {
        await setDoc(doc(db,'items',itemId), { parentItemId: null, containerId: 'está com alguém' }, { merge: true });
        showAlert('✅ Item removido do container','success');
        await loadInventarioFromFirebase(S.currentInventarioPersonagemId);
    } catch(e) { showAlert('❌ Erro','danger'); }
};

// ===== ADD ITEM =====
window.addItemToContainerMestre = function(containerId) {
    if (!S.currentInventarioPersonagemId) { showAlert('⚠️ Selecione um personagem','warning'); return; }
    S.setIsAvulsoMode(false);
    S.setCurrentEditingContainerIdMestre(containerId);
    S.setCurrentEditingItemIdMestre(null);
    openItemFormModal('Criar Novo Item', null);
};

window.addItemToOpenContainerMestre = function() {
    if (!S.currentOpenPersonagemContainerId) { showAlert('⚠️ Nenhum container aberto','warning'); return; }
    const contItem = S.currentInventarioItems.find(i => i.id === S.currentOpenPersonagemContainerId);
    const linkedId = contItem?.linkedContainerId;
    S.setIsAvulsoMode(false);
    S.setCurrentEditingContainerIdMestre(linkedId || S.currentOpenPersonagemContainerId);
    S.setCurrentEditingItemIdMestre(null);
    openItemFormModal('Criar Item no Container', null);
};

// ===== EDIT ITEM =====
window.editItemMestre = function(containerId, itemId) {
    const item = S.currentInventarioItems.find(i => i.id === itemId);
    if (!item) { showAlert('❌ Item não encontrado','danger'); return; }
    S.setIsAvulsoMode(false);
    S.setCurrentEditingContainerIdMestre(containerId);
    S.setCurrentEditingItemIdMestre(itemId);
    openItemFormModal(item.isContainerItem ? '📦 Editar Container' : 'Editar Item', item);
};

// ===== DELETE ITEM =====
window.deleteItemMestre = async function(containerId, itemId) {
    const item = S.currentInventarioItems.find(i => i.id === itemId);
    if (!item || !confirm(`Excluir "${item.name||'item'}"?`)) return;
    try {
        await deleteDoc(doc(db,'items',itemId));
        showAlert('✅ Item excluído','success');
        await addLog(S.currentUser?.email, `excluiu item "${item.name}"`, '', 'items');
        if (S.currentInventarioPersonagemId) await loadInventarioFromFirebase(S.currentInventarioPersonagemId);
    } catch(e) { showAlert('❌ Erro','danger'); }
};

// ===== ITEM FORM MODAL =====
function openItemFormModal(title, item) {
    let existing = document.getElementById('itemModalMestre');
    if (existing) existing.remove();

    const isEdit = !!item;
    const m = document.createElement('div');
    m.className = 'modal active'; m.id = 'itemModalMestre';
    m.innerHTML = `<div class="modal-content" style="max-width:700px"><div class="modal-header"><span class="modal-title">${title}</span><button class="modal-close" onclick="closeItemModalMestre()">✕</button></div><div class="modal-body" style="max-height:70vh;overflow-y:auto">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group"><label class="form-label">Nome *</label><input type="text" class="form-input" id="itemNameMestre" value="${escapeHtml(item?.name||'')}"></div>
            <div class="form-group"><label class="form-label">Tipo</label><select class="form-select" id="itemTipoMestre" ${isEdit?'disabled':''}><option value="Objeto" ${item?.tipo==='Objeto'?'selected':''}>📦 Objeto</option><option value="Arma" ${item?.tipo==='Arma'?'selected':''}>⚔️ Arma</option><option value="Vestimenta" ${item?.tipo==='Vestimenta'?'selected':''}>🧥 Vestimenta</option><option value="Projétil" ${item?.tipo==='Projétil'?'selected':''}>🎯 Projétil</option><option value="Container" ${item?.tipo==='Container'?'selected':''}>🗃️ Container</option><option value="Lunis" ${item?.tipo==='Lunis'?'selected':''}>💰 Lunis</option></select></div>
        </div>
        <div class="form-group"><label class="form-label">Descrição</label><textarea class="form-textarea" id="itemDescriptionMestre" rows="3">${escapeHtml(item?.description||'')}</textarea></div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px">
            <div class="form-group"><label class="form-label">Peso</label><input type="number" class="form-input" id="itemPesoMestre" value="${item?.peso||1}" min="0" step="0.1"></div>
            <div class="form-group"><label class="form-label">Tamanho</label><input type="number" class="form-input" id="itemTamanhoMestre" value="${item?.tamanho||1}" min="0"></div>
            <div class="form-group"><label class="form-label">Dureza</label><input type="number" class="form-input" id="itemDurezaMestre" value="${item?.dureza||0}" min="0"></div>
            <div class="form-group"><label class="form-label">Integridade</label><input type="number" class="form-input" id="itemIntegridadeMestre" value="${item?.integridade||10}" min="0"></div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">
            <div class="form-group"><label class="form-label">Quantidade</label><input type="number" class="form-input" id="itemQuantidadeMestre" value="${item?.quantity||1}" min="1"></div>
            <div class="form-group"><label class="form-label">Pack Size</label><input type="number" class="form-input" id="itemPackSizeMestre" value="${item?.packSize||1}" min="1"></div>
            <div class="form-group"><label class="form-label">Reforço</label><input type="number" class="form-input" id="itemReforcoMestre" value="${item?.reforco||0}" min="0"></div>
        </div>
        <div id="conditionalFieldsMestre"></div>
        <div class="form-group"><label class="form-label">Imagem (URL ou Base64)</label><input type="text" class="form-input" id="itemImagemMestre" value="${escapeHtml(item?.imagem||'')}"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group"><label class="form-label">Categoria</label><input type="text" class="form-input" id="itemCategoriaMestre" value="${escapeHtml(item?.category||'')}"></div>
            <div class="form-group"><label class="form-label">Preço Base</label><input type="number" class="form-input" id="itemPrecoBaseMestre" value="${item?.basePrice||0}" min="0"></div>
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:20px">
            <button class="btn btn-secondary" onclick="closeItemModalMestre()">Cancelar</button>
            <button class="btn btn-success" onclick="saveItemMestre()">💾 Salvar</button>
        </div>
    </div></div>`;
    document.body.appendChild(m);
}

window.closeItemModalMestre = function() { document.getElementById('itemModalMestre')?.remove(); };

window.saveItemMestre = async function() {
    const name = document.getElementById('itemNameMestre')?.value?.trim();
    if (!name) { showAlert('⚠️ Nome obrigatório','warning'); return; }

    const tipo = document.getElementById('itemTipoMestre')?.value || 'Objeto';
    const peso = parseFloat(document.getElementById('itemPesoMestre')?.value) || 1;
    const qty = parseInt(document.getElementById('itemQuantidadeMestre')?.value) || 1;
    const packSize = parseInt(document.getElementById('itemPackSizeMestre')?.value) || 1;
    const totalWeight = Math.ceil((qty / packSize) * peso);

    const charId = S.currentInventarioPersonagemId;
    let ownerId = S.currentUser?.uid || '';
    try { const cd = await getDoc(doc(db,'characters',charId)); if(cd.exists()) ownerId = cd.data().ownerUid || ownerId; } catch(e){}

    const itemData = {
        name, tipo,
        description: document.getElementById('itemDescriptionMestre')?.value?.trim() || '',
        peso, tamanho: parseInt(document.getElementById('itemTamanhoMestre')?.value) || 1,
        dureza: parseInt(document.getElementById('itemDurezaMestre')?.value) || 0,
        integridade: parseInt(document.getElementById('itemIntegridadeMestre')?.value) || 10,
        reforco: parseInt(document.getElementById('itemReforcoMestre')?.value) || 0,
        quantity: qty, packSize, totalWeight,
        imagem: document.getElementById('itemImagemMestre')?.value?.trim() || '',
        category: document.getElementById('itemCategoriaMestre')?.value?.trim() || '',
        basePrice: parseInt(document.getElementById('itemPrecoBaseMestre')?.value) || 0,
        characterId: charId, ownerId,
        containerId: S.currentEditingContainerIdMestre || 'está com alguém',
        equipado: false, parentItemId: null,
        lastModified: new Date().toISOString()
    };

    // Container in open viewer => parentItemId
    if (S.currentOpenPersonagemContainerId && S.currentEditingContainerIdMestre !== 'está com alguém') {
        itemData.parentItemId = S.currentOpenPersonagemContainerId;
    }

    try {
        const editId = S.currentEditingItemIdMestre;
        if (editId) {
            await setDoc(doc(db,'items',editId), itemData, { merge: true });
            showAlert('✅ Item atualizado','success');
            await addLog(S.currentUser?.email, `editou item "${name}"`, '', 'items');
        } else {
            const newId = 'item-'+Date.now();
            itemData.id = newId;
            await setDoc(doc(db,'items',newId), itemData);
            showAlert('✅ Item criado','success');
            await addLog(S.currentUser?.email, `criou item "${name}"`, '', 'items');

            if (tipo === 'Container') {
                const cId = 'container-'+Date.now();
                await setDoc(doc(db,'containers',cId), { id:cId, name, ownerId, characterId:charId, maxCapacity:10, maxSize:5, itemIds:[], description: itemData.description });
                await setDoc(doc(db,'items',newId), { isContainerItem:true, linkedContainerId:cId }, { merge:true });
            }
        }
        window.closeItemModalMestre();
        await loadInventarioFromFirebase(charId);
    } catch(e) { console.error(e); showAlert('❌ Erro ao salvar','danger'); }
};

// ===== TRANSFER STUBS =====
window.openTransferItemModal = function(itemId, isAvulso) { showAlert('⚠️ Transferência — em migração','warning'); };
