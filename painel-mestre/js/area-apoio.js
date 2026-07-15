// ÁREA APOIO — Apoios, Metas, Notificações (Full Migration)
import { db, collection, getDocs, getDoc, setDoc, doc, updateDoc, addDoc, deleteDoc, storage, ref, uploadBytes, getDownloadURL, runTransaction } from './firebase-config.js';
import * as S from './state.js';
import { showAlert, escapeHtml } from './ui-utils.js';
import { addLog } from './logs.js';

let dynamicMetas = [];
let legacyTotais = {};

export async function onTabActivated() { 
    await checkCriadorRole();
    await loadApoioUsers(); 
    await carregarSistemaMetas(); 
    await carregarSistemaLoja(); 
}

async function checkCriadorRole() {
    if (!S.currentUser) return;
    try {
        const docRef = doc(db, 'users', S.currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().role === 'criador') {
            const btn = document.getElementById('btnManageFrag');
            if (btn) btn.style.display = 'inline-block';
        }
    } catch (e) {
        console.error('Error checking role:', e);
    }
}

// ===== USERS =====
async function loadApoioUsers() {
    try {
        const snap = await getDocs(collection(db, 'users'));
        const sel = document.getElementById('apoioUserSelect'); if (!sel) return;
        sel.innerHTML = '<option value="">Selecione um jogador...</option>';
        const users = []; snap.forEach(d => users.push({ id: d.id, ...d.data() }));
        users.sort((a, b) => (a.displayName||a.email||'').localeCompare(b.displayName||b.email||''));
        users.forEach(u => { const o = document.createElement('option'); o.value = u.id; o.textContent = `${u.displayName||'Sem Nome'} (${u.email||u.id})`; sel.appendChild(o); });
        S.setNotificationUsersCache(users);
    } catch (e) { console.error(e); }
}

// ===== APOIOS =====
window.switchInnerApoioTab = function(tabName) {
    document.getElementById('btn-inner-compras')?.classList.remove('active');
    document.getElementById('btn-inner-apoios')?.classList.remove('active');
    document.getElementById('btn-inner-repertorio')?.classList.remove('active');
    document.getElementById('btn-inner-' + tabName)?.classList.add('active');

    document.getElementById('inner-tab-compras').style.display = 'none';
    document.getElementById('inner-tab-apoios').style.display = 'none';
    document.getElementById('inner-tab-repertorio').style.display = 'none';

    document.getElementById('inner-tab-' + tabName).style.display = 'block';
};

window.loadUserApoios = async function() {
    const uid = document.getElementById('apoioUserSelect')?.value;
    const el = document.getElementById('apoiosList');
    const menu = document.getElementById('apoiosStatusMenu');
    const tabCompras = document.getElementById('inner-tab-compras');
    const tabApoios = document.getElementById('inner-tab-apoios');
    const tabRepertorio = document.getElementById('inner-tab-repertorio');
    
    if (!uid || !el) { 
        if (el) el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted)">Selecione um jogador</div>';
        const comprasEl = document.getElementById('comprasList');
        if (comprasEl) comprasEl.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted)">Selecione um jogador</div>';
        if (menu) menu.style.display = 'none';
        
        document.getElementById('inner-tab-compras').style.display = 'none';
        document.getElementById('inner-tab-apoios').style.display = 'none';
        document.getElementById('inner-tab-repertorio').style.display = 'none';
        
        S.setCurrentSelectedUserId(null);
        if (window.loadUserRepertorio) window.loadUserRepertorio();
        return; 
    }
    
    S.setCurrentSelectedUserId(uid);
    if (menu) menu.style.display = 'flex';
    
    // Default to apoios if none active
    if (tabCompras && tabApoios && tabRepertorio) {
        if (tabCompras.style.display === 'none' && tabApoios.style.display === 'none' && tabRepertorio.style.display === 'none') {
            window.switchInnerApoioTab('apoios');
        }
    }

    // Carregar repertório junto com os apoios (SEMPRE, independente se tem ou não apoios)
    if (window.loadUserRepertorio) window.loadUserRepertorio();

    try {
        const d = await getDoc(doc(db, 'users', uid));
        if (!d.exists()) { el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted)">Usuário não encontrado</div>'; return; }
        
        const apoios = d.data().apoios || [];
        const logsCompra = d.data().logsCompra || [];
        
        S.setTodosApoiosCarregados(apoios); 
        
        // Render apoios
        if (apoios.length === 0) {
            el.innerHTML = '<div style="text-align: center; padding: 40px; color: #64748b;">Este jogador ainda não possui apoios</div>';
        } else {
            renderApoios(apoios);
        }

        // Render logsCompra
        renderLogsCompra(logsCompra);

    } catch (e) { showAlert('❌ Erro', 'danger'); }
};

function renderLogsCompra(logs) {
    const el = document.getElementById('comprasList'); 
    if (!el) return;
    if (!logs || !logs.length) { 
        el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted)">Nenhuma compra realizada</div>'; 
        return; 
    }
    
    el.innerHTML = logs.map(l => {
        const dateStr = l.data ? new Date(l.data).toLocaleString('pt-BR') : '-';
        return `
        <div style="background:rgba(15,23,42,.6);border:2px solid var(--border);border-radius:12px;padding:16px;margin-bottom:10px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
                <div style="font-weight:800;color:var(--light)">${escapeHtml(l.nome || 'Item Desconhecido')}</div>
                <div style="color:var(--primary);font-weight:800;background:rgba(99,102,241,0.2);padding:4px 8px;border-radius:6px;">${l.valorPago} ${l.moeda}</div>
            </div>
            <div style="font-size:.85rem;color:var(--muted);">
                Data: ${dateStr}
            </div>
        </div>`;
    }).join('');
}

function renderApoios(apoios) {
    const el = document.getElementById('apoiosList'); if (!el) return;
    if (!apoios.length) { el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted)">Nenhum apoio</div>'; return; }
    el.innerHTML = apoios.map((a, i) => `
        <div style="background:rgba(15,23,42,.6);border:2px solid var(--border);border-radius:12px;padding:16px;margin-bottom:10px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
                <div style="font-weight:800;color:var(--light)">${escapeHtml(a.nome||'Sem nome')} <span style="background:rgba(139,92,246,.2);color:var(--primary);padding:2px 8px;border-radius:8px;font-size:.78rem">x${a.montante||1}</span></div>
                <div style="display:flex;gap:6px"><button class="btn btn-primary btn-small" onclick="editApoio(${i})">✏️</button><button class="btn btn-danger btn-small" onclick="deleteApoio(${i})">🗑️</button></div>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;font-size:.85rem">
                <div><span style="color:var(--muted)">Tipo:</span> ${escapeHtml(a.tipo||'-')}</div>
                <div><span style="color:var(--muted)">Valor:</span> ${a.valor||'-'}</div>
                <div><span style="color:var(--muted)">Meta:</span> ${escapeHtml(a.meta||'-')}</div>
                <div><span style="color:var(--muted)">Data:</span> ${a.dataInicio||'-'}</div>
                <div><span style="color:var(--muted)">Recebido:</span> ${a.recebido?'✅':'❌'}</div>
            </div>
        </div>`).join('');
}

window.aplicarFiltrosApoios = function() {
    const st = document.getElementById('filtroStatus')?.value||'todos', tp = document.getElementById('filtroTipo')?.value||'todos';
    let f = [...S.todosApoiosCarregados];
    if (st === 'recebidos') f = f.filter(a => a.recebido);
    if (st === 'nao-recebidos') f = f.filter(a => !a.recebido);
    if (tp !== 'todos') f = f.filter(a => a.tipo === tp);
    renderApoios(f);
};
window.limparFiltrosApoios = function() { ['filtroStatus','filtroTipo','filtroDataInicio','filtroDataFim'].forEach(id => { const el = document.getElementById(id); if (el) el.value = el.options?el.options[0].value:''; }); renderApoios(S.todosApoiosCarregados); };

window.openAddApoioModal = function() {
    const m = document.createElement('div'); m.className = 'modal active'; m.id = 'addApoioModal';
    m.innerHTML = `<div class="modal-content" style="max-width:500px"><div class="modal-header"><span class="modal-title">➕ Novo Apoio</span><button class="modal-close" onclick="this.closest('.modal').remove()">✕</button></div><div class="modal-body">
        <div class="form-group"><label class="form-label">Nome *</label><input type="text" class="form-input" id="apoio_nome" placeholder="Nome do apoio"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div class="form-group"><label class="form-label">Tipo</label><input type="text" class="form-input" id="apoio_tipo" placeholder="Tipo"></div>
            <div class="form-group"><label class="form-label">Montante</label><input type="number" class="form-input" id="apoio_montante" value="1" min="1"></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div class="form-group"><label class="form-label">Meta</label><select class="form-select" id="apoio_meta"><option value="">Nenhuma</option><option value="Classe">Classe</option><option value="Raça">Raça</option><option value="Lore">Lore</option></select></div>
            <div class="form-group"><label class="form-label">Valor</label><input type="text" class="form-input" id="apoio_valor"></div>
        </div>
        <div class="form-group"><label class="form-label">Data Início</label><input type="date" class="form-input" id="apoio_data"></div>
        <div class="form-group"><label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" id="apoio_recebido" style="width:18px;height:18px"> Recebido</label></div>
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px"><button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancelar</button><button class="btn btn-success" onclick="saveNewApoio()">💾 Salvar</button></div>
    </div></div>`;
    document.body.appendChild(m);
};

window.saveNewApoio = async function() {
    const nome = document.getElementById('apoio_nome')?.value?.trim(); if (!nome) { showAlert('⚠️ Nome obrigatório', 'warning'); return; }
    if (!S.currentSelectedUserId) { showAlert('⚠️ Selecione um jogador', 'warning'); return; }
    const apoio = { nome, tipo: document.getElementById('apoio_tipo')?.value?.trim()||'', montante: parseInt(document.getElementById('apoio_montante')?.value)||1, meta: document.getElementById('apoio_meta')?.value||'', valor: document.getElementById('apoio_valor')?.value?.trim()||'', dataInicio: document.getElementById('apoio_data')?.value||'', recebido: document.getElementById('apoio_recebido')?.checked||false };
    try {
        S.todosApoiosCarregados.push(apoio);
        await updateDoc(doc(db, 'users', S.currentSelectedUserId), { apoios: S.todosApoiosCarregados });
        await addLog(S.currentUser?.email, `Adicionou apoio "${nome}"`, '', 'apoios');
        showAlert('✅ Apoio adicionado!', 'success'); document.getElementById('addApoioModal')?.remove(); renderApoios(S.todosApoiosCarregados);
    } catch (e) { showAlert('❌ Erro', 'danger'); }
};

window.editApoio = function(i) {
    const a = S.todosApoiosCarregados[i]; if (!a) return;
    const m = document.createElement('div'); m.className = 'modal active'; m.id = 'editApoioModal';
    m.innerHTML = `<div class="modal-content" style="max-width:500px"><div class="modal-header"><span class="modal-title">✏️ Editar Apoio</span><button class="modal-close" onclick="this.closest('.modal').remove()">✕</button></div><div class="modal-body">
        <div class="form-group"><label class="form-label">Nome</label><input type="text" class="form-input" id="ea_nome" value="${escapeHtml(a.nome||'')}"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div class="form-group"><label class="form-label">Tipo</label><input type="text" class="form-input" id="ea_tipo" value="${escapeHtml(a.tipo||'')}"></div>
            <div class="form-group"><label class="form-label">Montante</label><input type="number" class="form-input" id="ea_montante" value="${a.montante||1}" min="1"></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div class="form-group"><label class="form-label">Meta</label><select class="form-select" id="ea_meta"><option value="">Nenhuma</option><option value="Classe" ${a.meta==='Classe'?'selected':''}>Classe</option><option value="Raça" ${a.meta==='Raça'?'selected':''}>Raça</option><option value="Lore" ${a.meta==='Lore'?'selected':''}>Lore</option></select></div>
            <div class="form-group"><label class="form-label">Valor</label><input type="text" class="form-input" id="ea_valor" value="${escapeHtml(a.valor||'')}"></div>
        </div>
        <div class="form-group"><label class="form-label">Data</label><input type="date" class="form-input" id="ea_data" value="${a.dataInicio||''}"></div>
        <div class="form-group"><label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" id="ea_recebido" ${a.recebido?'checked':''} style="width:18px;height:18px"> Recebido</label></div>
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px"><button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancelar</button><button class="btn btn-success" onclick="saveEditApoio(${i})">💾 Salvar</button></div>
    </div></div>`;
    document.body.appendChild(m);
};

window.saveEditApoio = async function(i) {
    if (!S.currentSelectedUserId) return;
    S.todosApoiosCarregados[i] = { nome: document.getElementById('ea_nome')?.value?.trim()||'', tipo: document.getElementById('ea_tipo')?.value?.trim()||'', montante: parseInt(document.getElementById('ea_montante')?.value)||1, meta: document.getElementById('ea_meta')?.value||'', valor: document.getElementById('ea_valor')?.value?.trim()||'', dataInicio: document.getElementById('ea_data')?.value||'', recebido: document.getElementById('ea_recebido')?.checked||false };
    try { await updateDoc(doc(db, 'users', S.currentSelectedUserId), { apoios: S.todosApoiosCarregados }); showAlert('✅ Apoio atualizado!', 'success'); document.getElementById('editApoioModal')?.remove(); renderApoios(S.todosApoiosCarregados); } catch (e) { showAlert('❌ Erro', 'danger'); }
};

window.deleteApoio = async function(i) {
    if (!S.currentSelectedUserId || !confirm('Excluir este apoio?')) return;
    try { S.todosApoiosCarregados.splice(i, 1); await updateDoc(doc(db, 'users', S.currentSelectedUserId), { apoios: S.todosApoiosCarregados }); showAlert('✅ Removido', 'success'); renderApoios(S.todosApoiosCarregados); } catch (e) { showAlert('❌ Erro', 'danger'); }
};

// ===== METAS DINÂMICAS =====
async function carregarSistemaMetas() {
    try {
        await calcularLegadoTotais();
        const snap = await getDocs(collection(db, 'metas'));
        dynamicMetas = [];
        snap.forEach(doc => {
            dynamicMetas.push({ id: doc.id, ...doc.data() });
        });
        
        // Ordenar as metas alfabeticamente
        dynamicMetas.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
        
        renderMetasUI();
    } catch (error) {
        console.error('❌ Erro ao carregar metas:', error);
        showAlert('❌ Erro ao carregar metas', 'danger');
    }
}
window.carregarSistemaMetas = carregarSistemaMetas;

async function calcularLegadoTotais() {
    legacyTotais = {};
    try {
        const snap = await getDocs(collection(db, 'users'));
        snap.forEach(d => {
            const apoios = d.data().apoios || [];
            apoios.forEach(a => {
                const montante = parseInt(a.montante) || 1;
                const metaLegado = (a.meta || '').toLowerCase().trim();
                
                // Mapeia os slugs legados para manter o tracking
                let slug = metaLegado;
                if (metaLegado === 'raça') slug = 'raca';
                
                if (slug) {
                    if (!legacyTotais[slug]) legacyTotais[slug] = 0;
                    legacyTotais[slug] += montante;
                }
            });
        });
    } catch (error) {
        console.error('❌ Erro ao calcular legado:', error);
    }
}

function renderMetasUI() {
    const container = document.getElementById('metasContainer');
    if (!container) return;

    if (dynamicMetas.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:50px;color:var(--muted);grid-column:1/-1">Nenhuma meta cadastrada.</div>';
        return;
    }

    let html = '';
    
    dynamicMetas.forEach(meta => {
        // Cálculo de progresso
        const slugStr = (meta.slug || '').toLowerCase().trim();
        const totalApoios = legacyTotais[slugStr] || 0;
        
        let saldo = totalApoios;
        let etapasHtml = '';
        
        const etapas = meta.etapas || [];
        
        etapas.forEach((etapa, idx) => {
            const necessarios = parseInt(etapa.necessarios) || 1;
            let progressoEtapa = 0;
            let concluida = false;
            
            if (saldo >= necessarios) {
                concluida = true;
                progressoEtapa = necessarios;
                saldo -= necessarios;
            } else {
                progressoEtapa = saldo;
                saldo = 0;
            }
            
            const pct = Math.min(100, Math.round((progressoEtapa / necessarios) * 100));
            const barColor = concluida ? '#22c55e' : (progressoEtapa > 0 ? '#eab308' : 'rgba(255,255,255,0.1)');
            
            etapasHtml += `
                <div style="margin-bottom:8px;font-size:0.85rem;">
                    <div style="display:flex;justify-content:space-between;margin-bottom:4px;color:var(--light);">
                        <span><strong style="color:${concluida ? '#22c55e' : 'inherit'}">Etapa ${idx + 1}</strong>: ${escapeHtml(etapa.descricao || '...')}</span>
                        <span style="color:var(--muted)">${progressoEtapa} / ${necessarios}</span>
                    </div>
                    <div style="background:rgba(0,0,0,0.3);height:6px;border-radius:3px;overflow:hidden;border:1px solid rgba(255,255,255,0.05)">
                        <div style="width:${pct}%;height:100%;background:${barColor};transition:width 0.3s"></div>
                    </div>
                </div>
            `;
        });
        
        html += `
            <div style="background:rgba(15,23,42,0.6);border:2px solid var(--border);border-radius:12px;padding:16px;display:flex;flex-direction:column;">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
                    <div>
                        <div style="font-weight:800;color:var(--primary);font-size:1.1rem">${escapeHtml(meta.nome || 'Sem Nome')}</div>
                        ${meta.slug ? `<div style="font-size:0.75rem;color:var(--muted);margin-top:2px">Slug: ${escapeHtml(meta.slug)}</div>` : ''}
                    </div>
                    <div style="display:flex;gap:6px">
                        <button class="btn btn-primary btn-small" onclick="openMetaModal('${meta.id}')">✏️</button>
                        <button class="btn btn-danger btn-small" onclick="deleteMeta('${meta.id}')">🗑️</button>
                    </div>
                </div>
                
                <div style="font-size:0.85rem;color:var(--muted);margin-bottom:16px;background:rgba(0,0,0,0.2);padding:8px;border-radius:6px;">
                    Total de Apoios Históricos: <strong style="color:var(--light)">${totalApoios}</strong>
                </div>
                
                <div style="flex-grow:1;display:flex;flex-direction:column;gap:4px;">
                    ${etapas.length > 0 ? etapasHtml : '<div style="color:var(--muted);font-size:0.85rem;text-align:center;">Nenhuma etapa definida</div>'}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

window.openMetaModal = function(metaId = null) {
    const modal = document.getElementById('metaModal');
    if (!modal) return;
    
    document.getElementById('metaEtapasContainer').innerHTML = '';
    
    if (metaId) {
        const meta = dynamicMetas.find(m => m.id === metaId);
        if (meta) {
            document.getElementById('metaModalTitle').textContent = '✏️ Editar Meta';
            document.getElementById('meta_id').value = meta.id;
            document.getElementById('meta_nome').value = meta.nome || '';
            document.getElementById('meta_slug').value = meta.slug || '';
            
            if (meta.etapas && meta.etapas.length > 0) {
                meta.etapas.forEach(etapa => window.addMetaEtapa(etapa.necessarios, etapa.descricao));
            } else {
                window.addMetaEtapa();
            }
        }
    } else {
        document.getElementById('metaModalTitle').textContent = '➕ Nova Meta';
        document.getElementById('meta_id').value = '';
        document.getElementById('meta_nome').value = '';
        document.getElementById('meta_slug').value = '';
        window.addMetaEtapa();
    }
    
    modal.classList.add('active');
};

window.closeMetaModal = function() {
    const modal = document.getElementById('metaModal');
    if (modal) modal.classList.remove('active');
};

window.addMetaEtapa = function(necessarios = 10, descricao = '') {
    const container = document.getElementById('metaEtapasContainer');
    const div = document.createElement('div');
    div.style.cssText = "display:flex;gap:8px;align-items:flex-start;background:rgba(0,0,0,0.2);padding:10px;border-radius:8px;border:1px solid rgba(255,255,255,0.05);margin-bottom:8px;";
    
    div.innerHTML = `
        <div style="flex:0 0 80px">
            <label class="form-label" style="font-size:0.75rem">Apoios</label>
            <input type="number" class="form-input meta-etapa-necessarios" value="${necessarios}" min="1">
        </div>
        <div style="flex:1">
            <label class="form-label" style="font-size:0.75rem">Descrição / Benefício</label>
            <input type="text" class="form-input meta-etapa-descricao" value="${escapeHtml(descricao)}" placeholder="O que desbloqueia?">
        </div>
        <button class="btn btn-danger btn-small" style="margin-top:22px;padding:8px" onclick="this.closest('div').remove()">🗑️</button>
    `;
    
    container.appendChild(div);
};

window.saveMeta = async function() {
    const id = document.getElementById('meta_id').value;
    const nome = document.getElementById('meta_nome').value.trim();
    const slug = document.getElementById('meta_slug').value.trim().toLowerCase();
    
    if (!nome) {
        showAlert('⚠️ Nome da meta é obrigatório!', 'warning');
        return;
    }
    
    const etapasElements = document.getElementById('metaEtapasContainer').children;
    const etapas = [];
    
    for (let el of etapasElements) {
        const necessarios = parseInt(el.querySelector('.meta-etapa-necessarios').value) || 1;
        const descricao = el.querySelector('.meta-etapa-descricao').value.trim();
        etapas.push({ necessarios, descricao });
    }
    
    const metaData = {
        nome,
        slug,
        etapas,
        updatedAt: new Date().toISOString()
    };
    
    try {
        if (id) {
            await updateDoc(doc(db, 'metas', id), metaData);
            showAlert('✅ Meta atualizada!', 'success');
        } else {
            metaData.createdAt = new Date().toISOString();
            await addDoc(collection(db, 'metas'), metaData);
            showAlert('✅ Meta criada!', 'success');
        }
        
        window.closeMetaModal();
        await carregarSistemaMetas();
    } catch (error) {
        console.error('❌ Erro ao salvar meta:', error);
        showAlert('❌ Erro ao salvar meta', 'danger');
    }
};

window.deleteMeta = async function(id) {
    if (!confirm('Tem certeza que deseja excluir esta meta? Todas as configurações de etapas serão perdidas!')) return;
    
    try {
        await deleteDoc(doc(db, 'metas', id));
        showAlert('✅ Meta excluída!', 'success');
        await carregarSistemaMetas();
    } catch (error) {
        console.error('❌ Erro ao excluir meta:', error);
        showAlert('❌ Erro ao excluir meta', 'danger');
    }
};

// ===== NOTIFICATIONS =====
window.openSendNotificationModal = function() {
    const modal = document.getElementById('sendNotificationModal'); if (!modal) return;
    modal.classList.add('active');
    const list = document.getElementById('playerCheckboxList');
    if (list) list.innerHTML = S.notificationUsersCache.map(u => `<label style="display:flex;align-items:center;gap:8px;padding:8px;border-radius:8px;cursor:pointer;border:1px solid var(--border)"><input type="checkbox" class="notification-player-cb" value="${u.id}" style="width:16px;height:16px"><span style="font-size:.88rem;color:var(--light)">${escapeHtml(u.nome||u.email||u.id)}</span></label>`).join('');
};
window.closeSendNotificationModal = function() { document.getElementById('sendNotificationModal')?.classList.remove('active'); };
window.toggleAllPlayersSelection = function() { const all = document.getElementById('selectAllPlayers')?.checked; document.querySelectorAll('.notification-player-cb').forEach(cb => { cb.checked = all; }); };

window.sendMasterNotification = async function() {
    const msg = document.getElementById('notificationMessage')?.value?.trim();
    if (!msg) { showAlert('⚠️ Mensagem vazia', 'warning'); return; }
    const hl = document.querySelector('input[name="notificationHighlight"]:checked')?.value||'normal';
    const sel = Array.from(document.querySelectorAll('.notification-player-cb:checked')).map(c => c.value);
    if (!sel.length) { showAlert('⚠️ Selecione destinatários', 'warning'); return; }
    try {
        for (const uid of sel) { const r = doc(db, 'users', uid); const d = await getDoc(r); if (!d.exists()) continue; const n = d.data().notifications||[]; n.push({ message: msg, highlight: hl, from: S.currentUser?.email||'Mestre', date: new Date().toISOString(), read: false }); await updateDoc(r, { notifications: n }); }
        showAlert(`✅ Enviada a ${sel.length} jogador(es)`, 'success');
        await addLog(S.currentUser?.email, `Notificação: "${msg.substring(0,40)}..."`, `${sel.length} jogador(es)`, 'notifications');
        window.closeSendNotificationModal(); document.getElementById('notificationMessage').value = '';
    } catch (e) { showAlert('❌ Erro', 'danger'); }
};

// ===== PRODUÇÃO (migrado de area-mesas) =====
async function carregarListaProducao() {
    try { 
        const d = await getDoc(doc(db, 'mestre-config', 'listaProducao')); 
        if (d.exists()) S.setListaProducao(d.data().items||[]); 
        renderProd(); 
    } catch (e) { 
        if (e.message && e.message.includes('permission')) {
            console.warn('⚠️ Aviso: Sem permissão para carregar listaProducao. Ignorando...');
        } else {
            console.error(e); 
        }
    }
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

// ============= REPERTÓRIO =============


window.loadUserRepertorio = async function () {
    const userId = S.currentSelectedUserId;
    const repertorioSection = document.getElementById('repertorioSection');
    const repertorioList = document.getElementById('repertorioList');

    if (!repertorioSection || !repertorioList) return;

    if (!userId) {
        repertorioSection.style.display = 'none';
        return;
    }

    repertorioSection.style.display = 'block';

    try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (!userDoc.exists()) return;

        const userData = userDoc.data();
        let inventario = userData.inventario || [];

        // ON-THE-FLY MIGRATION: If legacy 'repertorio' exists, merge it into 'inventario' and delete 'repertorio'
        if (userData.repertorio && userData.repertorio.length > 0) {
            let hasChanges = false;
            userData.repertorio.forEach(repItem => {
                let repNome = repItem.nome || repItem.name || repItem.titulo || repItem.item || (typeof repItem === 'string' ? repItem : 'Item sem nome');
                if (!inventario.find(i => {
                    let iNome = i.nome || i.name || i.titulo || i.item || (typeof i === 'string' ? i : 'Item sem nome');
                    return iNome === repNome;
                })) {
                    inventario.push(repItem);
                    hasChanges = true;
                }
            });

            if (hasChanges) {
                await updateDoc(doc(db, 'users', userId), {
                    inventario: inventario,
                    repertorio: []
                });
            }
        }

        if (inventario.length === 0) {
            repertorioList.innerHTML = '<div style="text-align: center; padding: 40px; color: #64748b;">O repertório está vazio</div>';
            return;
        }

        let html = '';
        inventario.forEach((rawItem, index) => {
            // Normalize item
            let item = {};
            if (typeof rawItem === 'string') {
                item = { nome: rawItem, quantidade: 1 };
            } else if (typeof rawItem === 'object' && rawItem !== null) {
                item = {
                    nome: rawItem.nome || rawItem.name || rawItem.titulo || rawItem.item || 'Item sem nome',
                    descricao: rawItem.descricao || rawItem.description || rawItem.desc || '',
                    quantidade: parseInt(rawItem.quantidade || rawItem.qtd || rawItem.amount) || 1,
                    formaRecebimento: rawItem.formaRecebimento || rawItem.forma || rawItem.origem || ''
                };
            } else {
                item = { nome: 'Item inválido', quantidade: 1 };
            }

            html += `
                <div class="repertorio-item-card" style="background: rgba(15, 23, 42, 0.6); border: 2px solid var(--border); border-radius: 12px; padding: 16px; margin-bottom: 10px;">
                    <div class="repertorio-item-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <div class="repertorio-item-nome" style="font-weight: 800; color: var(--light);">${escapeHtml(item.nome || 'Item sem nome')}</div>
                        <div class="repertorio-item-actions">
                            <button class="btn btn-danger" onclick="deleteItemRepertorio('${userId}', ${index})" style="padding: 5px 12px; font-size: 0.85rem;">
                                🗑️
                            </button>
                        </div>
                    </div>
                    
                    ${item.descricao ? `
                        <div class="repertorio-item-field" style="margin-bottom: 8px;">
                            <div class="repertorio-item-field-label" style="color: var(--muted); font-size: 0.85rem;">Descrição</div>
                            <div class="repertorio-item-field-value" style="font-size: 0.9rem;">${escapeHtml(item.descricao)}</div>
                        </div>
                    ` : ''}
                    
                    <div class="repertorio-item-field" style="margin-bottom: 8px;">
                        <div class="repertorio-item-field-label" style="color: var(--muted); font-size: 0.85rem;">Quantidade</div>
                        <div class="repertorio-item-quantidade">
                            <input 
                                type="number" 
                                class="repertorio-quantidade-input form-input" 
                                value="${item.quantidade || 1}" 
                                min="1"
                                style="width: 80px; padding: 4px 8px;"
                                onchange="updateQuantidadeRepertorio('${userId}', ${index}, this.value)"
                            >
                        </div>
                    </div>
                    
                    ${item.formaRecebimento ? `
                        <div class="repertorio-item-field">
                            <div class="repertorio-item-field-label" style="color: var(--muted); font-size: 0.85rem;">Forma de Recebimento/Uso</div>
                            <div class="repertorio-item-field-value" style="font-size: 0.9rem;">${escapeHtml(item.formaRecebimento)}</div>
                        </div>
                    ` : ''}
                </div>
            `;
        });

        repertorioList.innerHTML = html;

    } catch (error) {
        console.error('❌ Erro ao carregar repertório:', error);
        showAlert('❌ Erro ao carregar repertório', 'danger');
    }
};

window.openAddItemRepertorioModal = function () {
    if (!S.currentSelectedUserId) {
        showAlert('⚠️ Selecione um jogador primeiro', 'warning');
        return;
    }

    const modalHTML = `
        <div id="itemRepertorioModal" class="modal active">
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <div class="modal-title">➕ Adicionar Item ao Repertório</div>
                    <button class="modal-close" onclick="closeItemRepertorioModal()">✕</button>
                </div>
                
                <div class="modal-body">
                    <div class="form-group">
                        <label class="form-label">Nome do Item *</label>
                        <input type="text" class="form-input" id="item_nome" placeholder="Ex: Espada Lendária, Poção de Cura...">
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Descrição</label>
                        <textarea class="form-input" id="item_descricao" placeholder="Descreva o item..." rows="3"></textarea>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Quantidade *</label>
                        <input type="number" class="form-input" id="item_quantidade" placeholder="1" value="1" min="1">
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Forma de Recebimento/Uso</label>
                        <input type="text" class="form-input" id="item_formaRecebimento" placeholder="Ex: Recompensa da Quest X, Usado em combate...">
                    </div>
                    
                    <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;">
                        <button class="btn btn-secondary" onclick="closeItemRepertorioModal()">Cancelar</button>
                        <button class="btn btn-success" onclick="saveItemRepertorio()">💾 Salvar Item</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    const existingModal = document.getElementById('itemRepertorioModal');
    if (existingModal) existingModal.remove();

    document.body.insertAdjacentHTML('beforeend', modalHTML);
};

window.saveItemRepertorio = async function () {
    const nome = document.getElementById('item_nome').value.trim();
    const quantidade = parseInt(document.getElementById('item_quantidade').value) || 1;

    if (!nome) {
        showAlert('⚠️ O nome do item é obrigatório', 'warning');
        return;
    }

    const novoItem = {
        nome: nome,
        descricao: document.getElementById('item_descricao').value.trim(),
        quantidade: quantidade,
        formaRecebimento: document.getElementById('item_formaRecebimento').value.trim()
    };

    try {
        const userDoc = await getDoc(doc(db, 'users', S.currentSelectedUserId));
        if (!userDoc.exists()) {
            showAlert('❌ Usuário não encontrado', 'danger');
            return;
        }

        const userData = userDoc.data();
        let inventario = userData.inventario || [];
        inventario.push(novoItem);

        await setDoc(doc(db, 'users', S.currentSelectedUserId), {
            inventario: inventario
        }, { merge: true });

        showAlert('✅ Item adicionado ao repertório!', 'success');
        closeItemRepertorioModal();
        loadUserRepertorio();

        // Log da ação
        await addLog(S.currentUser?.email, `adicionou item "${nome}" ao repertório do jogador`, '', 'apoios');

        // 📬 Enviar notificação ao jogador
        try {
            const notificationUserDoc = await getDoc(doc(db, 'users', S.currentSelectedUserId));
            if (notificationUserDoc.exists()) {
                const notifUserData = notificationUserDoc.data();
                let notifications = notifUserData.notifications || [];

                // Criar mensagem da notificação
                let message = quantidade > 1
                    ? `🎒 Você recebeu ${quantidade}x "${nome}" no seu Repertório do Jogador!`
                    : `🎒 Você recebeu "${nome}" no seu Repertório do Jogador!`;

                if (novoItem.formaRecebimento) {
                    message += ` (${novoItem.formaRecebimento})`;
                }

                // Criar objeto de notificação
                const notification = {
                    id: `repertoire_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    type: 'repertoire_item_received',
                    message: message,
                    date: new Date().toISOString(), // Keeping format consistent with area-apoio
                    read: false,
                    data: {
                        itemName: nome,
                        quantity: quantidade,
                        description: novoItem.descricao || '',
                        formaRecebimento: novoItem.formaRecebimento || '',
                        highlight: 'normal',
                        sentBy: S.currentUser?.email || 'Mestre'
                    }
                };

                // Adicionar nova notificação no início
                notifications.unshift(notification);

                // Limitar a 100 notificações
                if (notifications.length > 100) {
                    notifications = notifications.slice(0, 100);
                }

                await updateDoc(doc(db, 'users', S.currentSelectedUserId), { notifications: notifications });
                console.log(`📬 Notificação de item enviada para o jogador: ${message}`);
            }
        } catch (notifError) {
            console.error('❌ Erro ao enviar notificação (não afeta o salvamento):', notifError);
        }

    } catch (error) {
        console.error('❌ Erro ao salvar item:', error);
        showAlert('❌ Erro ao salvar item: ' + error.message, 'danger');
    }
};

window.updateQuantidadeRepertorio = async function (userId, itemIndex, novaQuantidade) {
    try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (!userDoc.exists()) return;

        const userData = userDoc.data();
        let inventario = userData.inventario || [];

        if (itemIndex >= 0 && itemIndex < inventario.length) {
            const item = inventario[itemIndex];
            const quantidadeAnterior = item.quantidade || 1;
            const quantidadeNova = parseInt(novaQuantidade) || 1;
            const diferenca = quantidadeNova - quantidadeAnterior;

            inventario[itemIndex].quantidade = quantidadeNova;

            await setDoc(doc(db, 'users', userId), {
                inventario: inventario
            }, { merge: true });

            showAlert('✅ Quantidade atualizada!', 'success');

            // 📬 Enviar notificação se a quantidade aumentou
            if (diferenca > 0) {
                try {
                    let notifications = userData.notifications || [];

                    const message = diferenca > 1
                        ? `🎒 Foram adicionados +${diferenca} "${item.nome}" ao seu Repertório do Jogador!`
                        : `🎒 Foi adicionado +1 "${item.nome}" ao seu Repertório do Jogador!`;

                    const notification = {
                        id: `repertoire_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        type: 'repertoire_item_received',
                        message: message,
                        date: new Date().toISOString(),
                        read: false,
                        data: {
                            itemName: item.nome,
                            quantityAdded: diferenca,
                            newTotal: quantidadeNova,
                            highlight: 'normal',
                            sentBy: S.currentUser?.email || 'Mestre'
                        }
                    };

                    notifications.unshift(notification);
                    if (notifications.length > 100) {
                        notifications = notifications.slice(0, 100);
                    }

                    await updateDoc(doc(db, 'users', userId), { notifications: notifications });
                    console.log(`📬 Notificação de quantidade enviada: ${message}`);
                } catch (notifError) {
                    console.error('❌ Erro ao enviar notificação:', notifError);
                }
            }
        }

    } catch (error) {
        console.error('❌ Erro ao atualizar quantidade:', error);
        showAlert('❌ Erro ao atualizar quantidade', 'danger');
    }
};

window.deleteItemRepertorio = async function (userId, itemIndex) {
    if (!confirm('Tem certeza que deseja deletar este item do repertório?')) return;

    try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (!userDoc.exists()) return;

        const userData = userDoc.data();
        let inventario = userData.inventario || [];

        if (itemIndex >= 0 && itemIndex < inventario.length) {
            const itemNome = inventario[itemIndex].nome;
            inventario.splice(itemIndex, 1);

            await setDoc(doc(db, 'users', userId), {
                inventario: inventario
            }, { merge: true });

            showAlert('✅ Item deletado do repertório!', 'success');
            loadUserRepertorio();

            // Log da ação
            await addLog(S.currentUser?.email, `removeu item "${itemNome}" do repertório do jogador`, '', 'apoios');
        }

    } catch (error) {
        console.error('❌ Erro ao deletar item:', error);
        showAlert('❌ Erro ao deletar item', 'danger');
    }
};

window.closeItemRepertorioModal = function () {
    const modal = document.getElementById('itemRepertorioModal');
    if (modal) modal.remove();
};

// ==========================================
// ABA LOJA (ITENS DE REPERTÓRIO)
// ==========================================

let lojaItens = [];
let cachedEquipamentos = null;

window.addLojaItemPersonagemRow = function(itemId = '', qtd = 1) {
    const list = document.getElementById('loja_item_personagem_list');
    const select = document.getElementById('loja_item_personagem_select');
    
    let selectedId = itemId;
    let selectedName = '';
    
    if (!selectedId) {
        if (!select.value) return;
        selectedId = select.value;
        selectedName = select.options[select.selectedIndex].text;
    } else {
        const item = cachedEquipamentos.find(i => i.id === selectedId);
        selectedName = item ? escapeHtml(item.nome) : 'Item Desconhecido';
    }

    const rowId = 'loja-item-row-' + Date.now() + '-' + Math.random().toString(36).substr(2,5);
    
    const row = document.createElement('div');
    row.id = rowId;
    row.className = 'loja-item-personagem-row';
    row.dataset.itemId = selectedId;
    row.style = 'display:flex;align-items:center;gap:8px;background:rgba(0,0,0,0.3);padding:6px 10px;border-radius:4px;';
    
    row.innerHTML = `
        <div style="flex:1;font-size:0.85rem;color:var(--light);">${selectedName}</div>
        <div style="display:flex;align-items:center;gap:6px;">
            <label style="font-size:0.75rem;color:var(--muted);">Qtd:</label>
            <input type="number" class="form-input loja-item-personagem-qtd" value="${qtd}" min="1" style="width:60px;padding:2px 6px;height:28px;">
        </div>
        <button class="btn btn-danger btn-small" onclick="document.getElementById('${rowId}').remove()" style="padding:2px 8px;height:28px;">✕</button>
    `;
    
    list.appendChild(row);
    if(!itemId) select.value = '';
};

window.carregarSistemaLoja = async function() {
    try {
        const snap = await getDocs(collection(db, 'loja_itens'));
        lojaItens = [];
        snap.forEach(doc => {
            lojaItens.push({ id: doc.id, ...doc.data() });
        });
        renderLojaUI();
    } catch (e) {
        console.error('❌ Erro ao carregar itens da loja:', e);
        showAlert('Erro ao carregar Loja', 'danger');
    }
};

function renderLojaUI() {
    const container = document.getElementById('lojaContainer');
    if (!container) return;
    
    if (lojaItens.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:50px;color:var(--muted);grid-column:1/-1;">Nenhum item cadastrado na loja.</div>';
        return;
    }

    container.innerHTML = '';
    lojaItens.forEach(item => {
        const card = document.createElement('div');
        card.className = 'apoio-card';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.gap = '12px';
        
        let tagsHtml = '';
        if (item.isExp) tagsHtml += `<span style="background:var(--primary);color:#fff;padding:2px 6px;border-radius:4px;font-size:0.7rem;">EXP: ${item.expAmount}${item.isExpVip ? ' (VIP)' : ''}</span>`;
        if (item.isRoleta) tagsHtml += `<span style="background:var(--secondary);color:#fff;padding:2px 6px;border-radius:4px;font-size:0.7rem;">Roleta: ${item.roletaGiros}x</span>`;
        if (item.isRerolagem) tagsHtml += `<span style="background:#f59e0b;color:#fff;padding:2px 6px;border-radius:4px;font-size:0.7rem;">Re-roll: ${item.rerolagensAmount}x</span>`;
        if (item.isNarrativo) tagsHtml += `<span style="background:#10b981;color:#fff;padding:2px 6px;border-radius:4px;font-size:0.7rem;">Narrativo</span>`;
        if (item.isItemPersonagem && item.personagemItensVinculados?.length) tagsHtml += `<span style="background:#8b5cf6;color:#fff;padding:2px 6px;border-radius:4px;font-size:0.7rem;">🎒 Itens: ${item.personagemItensVinculados.length}</span>`;
        
        const imgHtml = item.imagem ? `<div style="height:120px;width:100%;background-image:url('${escapeHtml(item.imagem)}');background-size:contain;background-repeat:no-repeat;background-position:center;border-radius:8px;background-color:rgba(0,0,0,0.2);"></div>` : '';

        const isVendaAtiva = item.isVendaAtiva !== false; // Default true if undefined
        
        card.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                <div style="font-weight:700;font-size:1.1rem;color:var(--primary);">${escapeHtml(item.nome)}</div>
                <label style="display:flex;align-items:center;gap:6px;font-size:0.8rem;cursor:pointer;background:rgba(0,0,0,0.3);padding:4px 8px;border-radius:12px;">
                    <input type="checkbox" onchange="toggleLojaVendaAtiva('${item.id}', this.checked)" ${isVendaAtiva ? 'checked' : ''} style="width:14px;height:14px;accent-color:var(--primary);"> À Venda
                </label>
            </div>
            ${imgHtml}
            ${item.descricao ? `<div style="font-size:0.85rem;color:var(--muted);">${escapeHtml(item.descricao)}</div>` : ''}
            <div style="display:flex;gap:10px;font-size:0.9rem;font-weight:600;">
                ${(item.valorReal > 0 || item.valorRs > 0) ? `<span style="color:#10b981;">R$ ${(item.valorReal > 0 ? (item.valorReal / 100) : Number(item.valorRs)).toFixed(2).replace('.', ',')}</span>` : ''}
                ${item.valorFrag > 0 ? `<span style="color:#6366f1;">${item.valorFrag} Frag$</span>` : ''}
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">${tagsHtml}</div>
            
            <div style="margin-top:auto;display:flex;gap:8px;border-top:1px solid var(--border);padding-top:12px;">
                <button class="btn btn-secondary btn-small" onclick="openLojaModal('${item.id}')" style="flex:1;">✏️ Editar</button>
                <button class="btn btn-danger btn-small" onclick="deleteLojaItem('${item.id}')">🗑️</button>
            </div>
        `;
        container.appendChild(card);
    });
}

window.toggleLojaFields = function() {
    const isExp = document.getElementById('loja_is_exp').checked;
    document.getElementById('loja_exp_fields').style.display = isExp ? 'grid' : 'none';
    
    const isRoleta = document.getElementById('loja_is_roleta').checked;
    document.getElementById('loja_roleta_fields').style.display = isRoleta ? 'block' : 'none';
    
    const isRerolagem = document.getElementById('loja_is_rerolagem').checked;
    document.getElementById('loja_rerolagem_fields').style.display = isRerolagem ? 'block' : 'none';
    
    const isNarrativo = document.getElementById('loja_is_narrativo').checked;
    document.getElementById('loja_narrativo_fields').style.display = isNarrativo ? 'grid' : 'none';

    const isItemPersonagem = document.getElementById('loja_is_item_personagem').checked;
    document.getElementById('loja_item_personagem_fields').style.display = isItemPersonagem ? 'block' : 'none';

    const modoSelecao = document.getElementById('loja_modo_meta_selecao').checked;
    document.getElementById('loja_modo_meta_fields').style.display = modoSelecao ? 'block' : 'none';
};

window.openLojaModal = async function(itemId = null) {
    document.getElementById('lojaModal').style.display = 'flex';
    
    // Buscar equipamentos se não estiver no cache
    if (cachedEquipamentos === null) {
        try {
            const snap = await getDocs(collection(db, 'system/data/equipment'));
            cachedEquipamentos = [];
            snap.forEach(doc => {
                const data = doc.data();
                if (data.publicado !== false) {
                    cachedEquipamentos.push({ id: doc.id, nome: data.nome || 'Sem nome' });
                }
            });
            cachedEquipamentos.sort((a,b) => a.nome.localeCompare(b.nome));
            
            const select = document.getElementById('loja_item_personagem_select');
            select.innerHTML = '<option value="">-- Escolha um Equipamento --</option>';
            cachedEquipamentos.forEach(eq => {
                select.innerHTML += `<option value="${eq.id}">${escapeHtml(eq.nome)}</option>`;
            });
        } catch (e) {
            console.error("Erro ao carregar equipamentos:", e);
            cachedEquipamentos = [];
            document.getElementById('loja_item_personagem_select').innerHTML = '<option value="">Erro ao carregar</option>';
        }
    }
    
    // Limpar campos
    document.getElementById('loja_id').value = '';
    document.getElementById('loja_nome').value = '';
    document.getElementById('loja_imagem').value = '';
    document.getElementById('loja_imagem_preview').style.display = 'none';
    document.getElementById('loja_descricao').value = '';
    document.getElementById('loja_valor_rs').value = '';
    document.getElementById('loja_valor_frag').value = '';
    
    document.getElementById('loja_is_exp').checked = false;
    document.getElementById('loja_exp_amount').value = '';
    document.getElementById('loja_exp_vip').checked = false;
    
    document.getElementById('loja_is_roleta').checked = false;
    document.getElementById('loja_roleta_giros').value = '';
    
    document.getElementById('loja_is_rerolagem').checked = false;
    document.getElementById('loja_rerolagem_amount').value = '';
    
    document.getElementById('loja_is_venda_ativa').checked = true;

    document.getElementById('loja_is_narrativo').checked = false;
    document.getElementById('loja_narrativo_aplicacoes').value = '';
    document.getElementById('loja_narrativo_beneficio').value = '';
    document.getElementById('loja_narrativo_quando').value = '';

    document.getElementById('loja_is_item_personagem').checked = false;
    document.getElementById('loja_item_personagem_list').innerHTML = '';

    document.getElementById('loja_modo_meta_selecao').checked = true;
    document.getElementById('loja_meta_selecionaveis').value = '1';

    // Popular Metas Checkboxes
    const metasList = document.getElementById('loja_metas_list');
    metasList.innerHTML = '';
    if (dynamicMetas.length === 0) {
        metasList.innerHTML = '<div style="color:var(--muted);font-size:0.8rem;grid-column:1/-1;">Nenhuma meta cadastrada no sistema.</div>';
    } else {
        dynamicMetas.forEach(meta => {
            metasList.innerHTML += `
                <label style="display:flex;align-items:center;gap:6px;font-size:0.85rem;cursor:pointer;">
                    <input type="checkbox" class="loja-meta-cb" value="${meta.id}"> ${escapeHtml(meta.nome)}
                </label>
            `;
        });
    }
    
    // Se for edição, preencher dados
    if (itemId) {
        const item = lojaItens.find(i => i.id === itemId);
        if (item) {
            document.getElementById('lojaModalTitle').innerText = 'Editar Item da Loja';
            document.getElementById('loja_id').value = item.id;
            document.getElementById('loja_nome').value = item.nome || '';
            document.getElementById('loja_descricao').value = item.descricao || '';
            document.getElementById('loja_valor_rs').value = item.valorRs || (item.valorReal ? (item.valorReal / 100).toFixed(2) : '');
            document.getElementById('loja_valor_frag').value = item.valorFrag || '';
            document.getElementById('loja_is_venda_ativa').checked = item.isVendaAtiva !== false;
            
            if (item.imagem) {
                const preview = document.getElementById('loja_imagem_preview');
                preview.innerHTML = `<img src="${escapeHtml(item.imagem)}" style="max-height:80px;border-radius:4px;">`;
                preview.style.display = 'block';
                // Armazena URL original no dataset para caso não mude a imagem
                preview.dataset.url = item.imagem;
            } else {
                document.getElementById('loja_imagem_preview').dataset.url = '';
            }

            document.getElementById('loja_is_exp').checked = !!item.isExp;
            document.getElementById('loja_exp_amount').value = item.expAmount || '';
            document.getElementById('loja_exp_vip').checked = !!item.isExpVip;
            
            document.getElementById('loja_is_roleta').checked = !!item.isRoleta;
            document.getElementById('loja_roleta_giros').value = item.roletaGiros || '';
            
            document.getElementById('loja_is_rerolagem').checked = !!item.isRerolagem;
            document.getElementById('loja_rerolagem_amount').value = item.rerolagensAmount || '';
            
            document.getElementById('loja_is_narrativo').checked = !!item.isNarrativo;
            document.getElementById('loja_narrativo_aplicacoes').value = item.narrativoAplicacoes || '';
            document.getElementById('loja_narrativo_beneficio').value = item.narrativoBeneficio || '';
            document.getElementById('loja_narrativo_quando').value = item.narrativoQuando || '';

            document.getElementById('loja_is_item_personagem').checked = !!item.isItemPersonagem;
            if (item.personagemItensVinculados && Array.isArray(item.personagemItensVinculados)) {
                item.personagemItensVinculados.forEach(v => {
                    addLojaItemPersonagemRow(v.itemId, v.quantidade);
                });
            }

            document.getElementById('loja_modo_meta_selecao').checked = item.modoSelecaoMeta !== false;
            document.getElementById('loja_meta_selecionaveis').value = item.quantidadeMetasSelecionaveis || '1';

            // Check metas vinculadas
            if (item.metasVinculadas && Array.isArray(item.metasVinculadas)) {
                const cbs = document.querySelectorAll('.loja-meta-cb');
                cbs.forEach(cb => {
                    if (item.metasVinculadas.includes(cb.value)) cb.checked = true;
                });
            }
        }
    } else {
        document.getElementById('lojaModalTitle').innerText = 'Novo Item da Loja';
        document.getElementById('loja_imagem_preview').dataset.url = '';
    }
    
    toggleLojaFields();
};

window.closeLojaModal = function() {
    document.getElementById('lojaModal').style.display = 'none';
};

window.saveLojaItem = async function() {
    const btn = document.querySelector('#lojaModal .btn-success');
    btn.disabled = true;
    btn.innerText = '⏳ Salvando...';

    try {
        const id = document.getElementById('loja_id').value;
        const nome = document.getElementById('loja_nome').value.trim();
        if (!nome) throw new Error("O nome do item é obrigatório.");

        const fileInput = document.getElementById('loja_imagem');
        let imageUrl = document.getElementById('loja_imagem_preview').dataset.url || '';

        // Se houver arquivo selecionado, fazer upload
        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            const fileName = `loja-itens/${Date.now()}_${file.name}`;
            const storageRef = ref(storage, fileName);
            await uploadBytes(storageRef, file);
            imageUrl = await getDownloadURL(storageRef);
        }

        const data = {
            nome,
            imagem: imageUrl,
            descricao: document.getElementById('loja_descricao').value.trim(),
            valorRs: parseFloat(document.getElementById('loja_valor_rs').value) || 0,
            // Formato canônico para o pagamento via PagBank: centavos como inteiro (R$ 15,00 → 1500)
            valorReal: Math.round((parseFloat(document.getElementById('loja_valor_rs').value) || 0) * 100),
            valorFrag: parseFloat(document.getElementById('loja_valor_frag').value) || 0,
            
            isExp: document.getElementById('loja_is_exp').checked,
            isRoleta: document.getElementById('loja_is_roleta').checked,
            isRerolagem: document.getElementById('loja_is_rerolagem').checked,
            isNarrativo: document.getElementById('loja_is_narrativo').checked,
            isItemPersonagem: document.getElementById('loja_is_item_personagem').checked,
            isVendaAtiva: document.getElementById('loja_is_venda_ativa').checked,
            
            modoSelecaoMeta: document.getElementById('loja_modo_meta_selecao').checked,
            metasVinculadas: []
        };

        // Campos Condicionais
        if (data.isExp) {
            data.expAmount = parseFloat(document.getElementById('loja_exp_amount').value) || 0;
            data.isExpVip = document.getElementById('loja_exp_vip').checked;
        }
        if (data.isRoleta) {
            data.roletaGiros = parseFloat(document.getElementById('loja_roleta_giros').value) || 0;
        }
        if (data.isRerolagem) {
            data.rerolagensAmount = parseFloat(document.getElementById('loja_rerolagem_amount').value) || 0;
        }
        if (data.isNarrativo) {
            data.narrativoAplicacoes = parseFloat(document.getElementById('loja_narrativo_aplicacoes').value) || 0;
            data.narrativoBeneficio = document.getElementById('loja_narrativo_beneficio').value.trim();
            data.narrativoQuando = document.getElementById('loja_narrativo_quando').value.trim();
        }
        
        data.personagemItensVinculados = [];
        if (data.isItemPersonagem) {
            const rows = document.querySelectorAll('.loja-item-personagem-row');
            rows.forEach(r => {
                const itemId = r.dataset.itemId;
                const qtd = parseInt(r.querySelector('.loja-item-personagem-qtd').value) || 1;
                data.personagemItensVinculados.push({ itemId, quantidade: Math.max(1, qtd) });
            });
        }
        if (data.modoSelecaoMeta) {
            data.quantidadeMetasSelecionaveis = parseFloat(document.getElementById('loja_meta_selecionaveis').value) || 1;
        }

        const cbs = document.querySelectorAll('.loja-meta-cb');
        cbs.forEach(cb => {
            if (cb.checked) data.metasVinculadas.push(cb.value);
        });

        if (id) {
            await updateDoc(doc(db, 'loja_itens', id), data);
            showAlert('Item atualizado com sucesso!', 'success');
        } else {
            await addDoc(collection(db, 'loja_itens'), data);
            showAlert('Item criado com sucesso!', 'success');
        }
        
        closeLojaModal();
        await carregarSistemaLoja();

    } catch (e) {
        console.error('❌ Erro ao salvar item da loja:', e);
        showAlert(e.message || 'Erro ao salvar item', 'danger');
    } finally {
        btn.disabled = false;
        btn.innerText = '💾 Salvar Item';
    }
};

window.toggleLojaVendaAtiva = async function(id, isAtiva) {
    try {
        await updateDoc(doc(db, 'loja_itens', id), { isVendaAtiva: isAtiva });
        // Update local state to prevent re-fetching unnecessarily, though a fetch wouldn't hurt
        const item = lojaItens.find(i => i.id === id);
        if(item) item.isVendaAtiva = isAtiva;
    } catch (e) {
        console.error('❌ Erro ao alterar status de venda:', e);
        showAlert('Erro ao salvar disponibilidade.', 'danger');
        // Revert toggle visually
        await carregarSistemaLoja();
    }
};

window.deleteLojaItem = async function(id) {
    if (!confirm('Tem certeza que deseja excluir este item? Essa ação não pode ser desfeita.')) return;
    try {
        await deleteDoc(doc(db, 'loja_itens', id));
        showAlert('✅ Item excluído.', 'success');
        await carregarSistemaLoja();
    } catch(e) {
        showAlert('❌ Erro ao excluir', 'danger');
    }
};

window.openManageFragModal = async function() {
    if (!S.currentSelectedUserId) {
        showAlert('Selecione um jogador primeiro!', 'warning');
        return;
    }
    try {
        const userDoc = await getDoc(doc(db, 'users', S.currentSelectedUserId));
        if(userDoc.exists()){
            document.getElementById('fragCurrentBalance').textContent = userDoc.data().fragmentos || 0;
            document.getElementById('fragAmount').value = '';
            document.getElementById('manageFragModal').classList.add('active');
        }
    } catch(e) {
        showAlert('Erro ao buscar saldo', 'danger');
    }
};

window.closeManageFragModal = function() {
    document.getElementById('manageFragModal').classList.remove('active');
};

window.updatePlayerFrag = async function(action) {
    if (!S.currentSelectedUserId) return;
    const amount = parseInt(document.getElementById('fragAmount').value);
    if (!amount || amount <= 0) {
        showAlert('Insira uma quantidade válida', 'warning');
        return;
    }
    
    try {
        const userRef = doc(db, 'users', S.currentSelectedUserId);
        let newBalance = 0;
        await runTransaction(db, async (t) => {
            const sfDoc = await t.get(userRef);
            if (!sfDoc.exists()) throw "User not found";
            const data = sfDoc.data();
            let current = data.fragmentos || 0;
            
            if (action === 'add') {
                newBalance = current + amount;
            } else {
                newBalance = current - amount;
                if (newBalance < 0) newBalance = 0;
            }
            
            t.update(userRef, {
                fragmentos: newBalance,
                // Marcador lido pela Cloud Function de auditoria (frag_logs)
                fragLastOp: {
                    origem: 'Painel do Mestre',
                    detalhe: action === 'add'
                        ? `Concessão de ${amount} Frag$`
                        : `Remoção de ${amount} Frag$`,
                    autor: S.currentUser?.email || 'Mestre',
                    ts: Date.now()
                }
            });
        });
        
        // Push notification
        const notification = {
            id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substr(2,9),
            type: 'master_message',
            message: action === 'add' ? `💎 Você recebeu ${amount} Fragmentos da administração!` : `💎 Foram removidos ${amount} Fragmentos da sua conta.`,
            timestamp: Date.now(),
            isNew: true,
            data: { highlight: 'importante' }
        };
        
        const userDoc = await getDoc(userRef);
        let notifs = userDoc.data().notifications || [];
        notifs.unshift(notification);
        if (notifs.length > 100) notifs = notifs.slice(0, 100);
        await updateDoc(userRef, { notifications: notifs });
        
        document.getElementById('fragCurrentBalance').textContent = newBalance;
        document.getElementById('fragAmount').value = '';
        showAlert('✅ Saldo atualizado e jogador notificado!', 'success');
        
    } catch(e) {
        showAlert('❌ Erro na transação: ' + e, 'danger');
    }
};
