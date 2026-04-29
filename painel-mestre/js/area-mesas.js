// =============================================
// ÁREA MESAS — Personagens, Aliados, Combate, Sessões, Produção
// =============================================
import { db, collection, getDocs, getDoc, setDoc, deleteDoc, doc, addDoc, updateDoc, query, where } from './firebase-config.js';
import * as S from './state.js';
import { showAlert, escapeHtml } from './ui-utils.js';
import { addLog } from './logs.js';
import { renderCombatList } from './combat.js';

export async function onTabActivated() { await loadAllCharacters(); }

// ===== LOAD ALL CHARACTERS =====
async function loadAllCharacters() {
    try {
        const snap = await getDocs(collection(db, 'characters'));
        const chars = []; snap.forEach(d => chars.push({ id: d.id, ...d.data() }));
        const itemsSnap = await getDocs(collection(db, 'items'));
        const loadByChar = {};
        itemsSnap.forEach(d => { const it = d.data(); if (it.containerId === 'está com alguém' && it.characterId && !it.parentItemId) { loadByChar[it.characterId] = (loadByChar[it.characterId]||0) + (it.totalWeight||0); } });
        chars.forEach(c => { c.currentLoad = loadByChar[c.id] || 0; });
        S.setAllCharacters(chars);
        displayCharacters();
    } catch (e) { console.error('❌ Erro personagens:', e); showAlert('❌ Erro ao carregar personagens', 'danger'); }
}
window.loadAllCharacters = loadAllCharacters;

function displayCharacters() {
    const grid = document.getElementById('charactersGrid'); if (!grid) return;
    if (!S.allCharacters.length) { grid.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted);grid-column:1/-1">Nenhum personagem</div>'; return; }
    grid.innerHTML = S.allCharacters.map(c => {
        const vitMax = (c.vig||1) + (c.tamanho||5), enerMax = c.aut||1;
        let maxLoad = (c.for||1) + (c.vig||1); if (c.raca === 'Yotun') maxLoad *= 2; maxLoad += (c.modMestre?.mod_cargamax||0);
        const cur = c.currentLoad||0, over = cur > maxLoad;
        const hasImg = c.characterImage?.length > 0;
        const imgH = hasImg ? `<div style="width:100%;height:140px;background-image:url('${c.characterImage}');background-size:cover;background-position:center;border-radius:10px 10px 0 0;border-bottom:1px solid var(--border)"></div>` : '';
        return `<div class="player-card" onclick="openCharacter('${c.id}')" style="display:block;padding:0;overflow:hidden;cursor:pointer;${over ? 'border-color:#ef4444;box-shadow:0 0 15px rgba(239,68,68,.5)' : ''}">
            ${imgH}<div style="padding:14px">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
                <div style="display:flex;align-items:center;gap:8px"><input type="checkbox" class="exp-checkbox" data-char-id="${c.id}" data-char-name="${escapeHtml(c.nome||'')}" onclick="event.stopPropagation()" style="width:18px;height:18px;accent-color:var(--primary)"><span style="font-weight:800;color:var(--light);font-size:1.05rem">${escapeHtml(c.nome||'Sem nome')}</span></div>
                <span style="background:var(--primary-glow);color:var(--primary);padding:3px 10px;border-radius:8px;font-weight:800;font-size:.85rem">${c.auraImortalidade||1}</span>
            </div>
            <div style="font-size:.82rem;color:var(--muted);margin-bottom:8px">👤 ${escapeHtml(c.jogador||'-')} | ⚔️ ${c.classe||'-'} | 🎭 ${c.raca||'-'}</div>
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:6px">
                <div class="stat-box"><div class="stat-label">❤️ VIT</div><div class="stat-value" style="font-size:.88rem">${c.hpCurrent||vitMax}/${vitMax}</div></div>
                <div class="stat-box"><div class="stat-label">⚡ ENER</div><div class="stat-value" style="font-size:.88rem">${c.enerCurrent||enerMax}/${enerMax}</div></div>
                <div class="stat-box"><div class="stat-label">🧠 SAN</div><div class="stat-value" style="font-size:.88rem">${c.sanCurrent||80}/100</div></div>
                <div class="stat-box"><div class="stat-label">⭐ EXP</div><div class="stat-value" style="font-size:.88rem">${c.exp||0}</div></div>
            </div>
            <div style="font-size:.82rem;text-align:right;padding:6px 10px;border-radius:8px;${over ? 'background:rgba(239,68,68,.2);color:#ef4444;font-weight:600' : 'color:#10b981'}">⚖️ ${cur.toFixed(1)}/${maxLoad} ${over ? '⚠️' : ''}</div>
        </div></div>`;
    }).join('');
}

window.openCharacter = function(id) { window.open(`../ficha-v1.7_1/ficha.html?id=${id}`, '_blank'); };

// ===== EXP =====
window.addCustomExpToSelected = async function() {
    const v = parseInt(document.getElementById('expValue')?.value)||0;
    if (v <= 0) { showAlert('⚠️ Valor inválido', 'warning'); return; }
    const cbs = document.querySelectorAll('.exp-checkbox:checked');
    if (!cbs.length) { showAlert('⚠️ Selecione personagens', 'warning'); return; }
    for (const cb of cbs) { const c = S.allCharacters.find(x => x.id === cb.dataset.charId); if (!c) continue; await updateDoc(doc(db, 'characters', c.id), { exp: (c.exp||0) + v }); await addLog(S.currentUser?.email, `+${v} EXP`, c.nome, 'characters'); }
    showAlert(`✅ +${v} EXP para ${cbs.length}`, 'success'); await loadAllCharacters();
};
window.subtractCustomExpFromSelected = async function() {
    const v = parseInt(document.getElementById('expValue')?.value)||0;
    if (v <= 0) { showAlert('⚠️ Valor inválido', 'warning'); return; }
    const cbs = document.querySelectorAll('.exp-checkbox:checked');
    if (!cbs.length) { showAlert('⚠️ Selecione personagens', 'warning'); return; }
    for (const cb of cbs) { const c = S.allCharacters.find(x => x.id === cb.dataset.charId); if (!c) continue; await updateDoc(doc(db, 'characters', c.id), { exp: Math.max(0, (c.exp||0) - v) }); await addLog(S.currentUser?.email, `-${v} EXP`, c.nome, 'characters'); }
    showAlert(`✅ -${v} EXP de ${cbs.length}`, 'success'); await loadAllCharacters();
};

// ===== CREATE CHARACTER =====
window.openCreateCharacterModal = async function() {
    try {
        const snap = await getDocs(collection(db, 'users'));
        const users = []; snap.forEach(d => users.push({ id: d.id, ...d.data() }));
        const opts = users.map(u => `<option value="${u.uid||u.id}" data-email="${u.email||''}" data-name="${u.displayName||u.email||''}">${u.displayName||u.email||u.id}</option>`).join('');
        const m = document.createElement('div'); m.className = 'modal active'; m.id = 'createCharModal';
        m.innerHTML = `<div class="modal-content" style="max-width:600px"><div class="modal-header"><span class="modal-title">➕ Criar Personagem</span><button class="modal-close" onclick="this.closest('.modal').remove()">✕</button></div><div class="modal-body">
            <div class="form-group"><label class="form-label">Jogador (Dono) *</label><select class="form-select" id="cc_owner"><option value="">Selecione...</option>${opts}</select></div>
            <div class="form-group"><label class="form-label">Nome</label><input type="text" class="form-input" id="cc_nome" placeholder="Deixe vazio para o jogador preencher"></div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
                <div class="form-group"><label class="form-label">Classe</label><select class="form-select" id="cc_classe"><option value="">Selecione...</option><option>Caçador</option><option>Druida</option><option>Guerreiro</option><option>Adepto</option><option>Ladino</option><option>Pallacerdote</option><option>Ritualista</option></select></div>
                <div class="form-group"><label class="form-label">Raça</label><select class="form-select" id="cc_raca"><option value="">Selecione...</option><option>Humano</option><option>Elorin</option><option>Karu-Selvagem</option><option>Picxi</option><option>Yotun</option><option>Dragau</option></select></div>
            </div>
            <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px"><button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancelar</button><button class="btn btn-success" onclick="createCharForPlayer()">✅ Criar</button></div>
        </div></div>`;
        document.body.appendChild(m);
    } catch (e) { showAlert('❌ Erro', 'danger'); }
};

window.createCharForPlayer = async function() {
    const sel = document.getElementById('cc_owner'); const uid = sel.value; if (!uid) { showAlert('⚠️ Selecione jogador', 'warning'); return; }
    const opt = sel.options[sel.selectedIndex], email = opt.dataset.email||'', name = opt.dataset.name||email;
    const nome = document.getElementById('cc_nome').value.trim(), classe = document.getElementById('cc_classe').value, raca = document.getElementById('cc_raca').value;
    try {
        await addDoc(collection(db, 'characters'), { ownerUid: uid, nome, jogador: email||name, idade: 0, raca, classe, virtude: '', vicio: '', tamanho: 5, luns: 0, int:1,'for':1,pre:1,rac:1,des:1,man:1,prs:1,vig:1,aut:1, skills:{}, skillInputs:{}, classAbilities:{}, classResources:{}, hpCurrent:6, enerCurrent:1, sanCurrent:100, blindagem:0, containers:[{id:Date.now(),name:'Mochila',maxCapacity:6,items:[]}], notas:'', exp:0, auraImortalidade:1, createdAt:new Date().toISOString(), createdBy:S.currentUser?.email, lastUpdate:new Date().toISOString() });
        await addLog(S.currentUser?.email, `Criou personagem "${nome||'Novo'}" para`, email||name, 'characters');
        showAlert(`✅ Personagem criado para ${name}!`, 'success');
        document.getElementById('createCharModal')?.remove(); await loadAllCharacters();
    } catch (e) { showAlert('❌ Erro: ' + e.message, 'danger'); }
};

// ===== DELETE CHARACTERS =====
window.openDeleteCharactersModal = function() {
    const cbs = document.querySelectorAll('.exp-checkbox:checked');
    if (!cbs.length) { showAlert('⚠️ Selecione personagens', 'warning'); return; }
    const list = Array.from(cbs).map(cb => { const c = S.allCharacters.find(x => x.id === cb.dataset.charId); return c ? { id: c.id, name: c.nome||'Sem nome', jogador: c.jogador, classe: c.classe, raca: c.raca } : null; }).filter(Boolean);
    if (!list.length) return;
    const m = document.createElement('div'); m.className = 'modal active'; m.id = 'delCharModal';
    m.innerHTML = `<div class="modal-content" style="max-width:600px;border:3px solid var(--danger)"><div class="modal-header" style="background:linear-gradient(135deg,var(--danger),#dc2626)"><span class="modal-title" style="color:#fff">⚠️ Deletar ${list.length} Personagem(s)</span><button class="modal-close" onclick="this.closest('.modal').remove()">✕</button></div><div class="modal-body">
        <div style="color:#f87171;font-weight:700;margin-bottom:14px;text-align:center">Esta ação é IRREVERSÍVEL!</div>
        ${list.map(c => `<div style="display:flex;align-items:center;gap:12px;padding:10px;border:1px solid var(--danger);border-radius:8px;margin-bottom:8px"><span style="font-size:1.5rem">💀</span><div><div style="font-weight:700;color:#fff">${escapeHtml(c.name)}</div><div style="font-size:.82rem;color:#f87171">👤 ${escapeHtml(c.jogador||'-')} | ⚔️ ${c.classe||'-'} | 🎭 ${c.raca||'-'}</div></div></div>`).join('')}
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:20px"><button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancelar</button><button class="btn btn-danger" onclick="confirmDeleteChars()">🗑️ DELETAR</button></div>
    </div></div>`;
    document.body.appendChild(m); window._charsToDelete = list;
};

window.confirmDeleteChars = async function() {
    if (!window._charsToDelete?.length) return;
    try {
        for (const c of window._charsToDelete) { await deleteDoc(doc(db, 'characters', c.id)); await addLog(S.currentUser?.email, 'Deletou personagem', c.name, 'characters'); }
        showAlert(`✅ ${window._charsToDelete.length} deletado(s)`, 'success');
        document.getElementById('delCharModal')?.remove();
        document.querySelectorAll('.exp-checkbox:checked').forEach(cb => cb.checked = false);
        await loadAllCharacters();
    } catch (e) { showAlert('❌ Erro: ' + e.message, 'danger'); }
};

// ===== ALLIES =====
window.filterAllies = function() {
    const t = (document.getElementById('searchAllies')?.value||'').toLowerCase();
    const f = t ? S.allAllies.filter(a => (a.nome||'').toLowerCase().includes(t) || (a.characterName||'').toLowerCase().includes(t)) : [...S.allAllies];
    S.setFilteredAllies(f); renderAllies();
};
function renderAllies() {
    const el = document.getElementById('alliesList'); if (!el) return;
    if (!S.filteredAllies.length) { el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted);grid-column:1/-1">Nenhum aliado</div>'; return; }
    el.innerHTML = S.filteredAllies.map(a => `<div class="npc-card">${a.imagem ? `<div class="npc-image-container"><img src="${a.imagem}" class="npc-card-image"></div>` : ''}<div class="npc-card-info"><div class="npc-name">${escapeHtml(a.nome||'Sem nome')}</div><div style="color:var(--muted);font-size:.85rem">👤 ${escapeHtml(a.characterName)}</div></div></div>`).join('');
}

// ===== PRODUÇÃO =====
async function carregarListaProducao() {
    try { const d = await getDoc(doc(db, 'mestre-config', 'listaProducao')); if (d.exists()) S.setListaProducao(d.data().items||[]); renderProd(); } catch (e) { console.error(e); }
}
async function salvarProd() { try { await setDoc(doc(db, 'mestre-config', 'listaProducao'), { items: S.listaProducao }); } catch (e) { showAlert('❌ Erro', 'danger'); } }
function renderProd() {
    const tb = document.getElementById('listaProducaoBody'); if (!tb) return;
    if (!S.listaProducao.length) { tb.innerHTML = '<tr><td colspan="4" style="padding:20px;text-align:center;color:var(--muted)">Lista vazia</td></tr>'; return; }
    tb.innerHTML = S.listaProducao.map((it, i) => `<tr style="border-bottom:1px solid var(--line)"><td style="padding:12px;text-align:center;color:var(--muted)">☰</td><td style="padding:12px;cursor:pointer" onclick="editProd(${i},'nome')">${it.nome||'-'}</td><td style="padding:12px;cursor:pointer" onclick="editProd(${i},'progresso')">${it.progresso||'-'}</td><td style="padding:12px;text-align:center"><button class="btn btn-danger btn-small" onclick="remProd(${i})">🗑️</button></td></tr>`).join('');
}
window.adicionarItemProducao = async function() { S.listaProducao.push({ nome: 'Novo Item', progresso: '' }); await salvarProd(); renderProd(); };
window.remProd = async function(i) { if (confirm('Remover?')) { S.listaProducao.splice(i, 1); await salvarProd(); renderProd(); } };
window.editProd = async function(i, f) { const v = prompt(`Editar ${f}:`, S.listaProducao[i][f]||''); if (v !== null) { S.listaProducao[i][f] = v; await salvarProd(); renderProd(); } };
setTimeout(carregarListaProducao, 500);
