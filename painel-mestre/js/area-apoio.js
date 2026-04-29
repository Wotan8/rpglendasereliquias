// ÁREA APOIO — Apoios, Metas, Notificações (Full Migration)
import { db, collection, getDocs, getDoc, setDoc, doc, updateDoc } from './firebase-config.js';
import * as S from './state.js';
import { showAlert, escapeHtml } from './ui-utils.js';
import { addLog } from './logs.js';

let metasData = { classe: [5,11,22,30,40,50,60], raca: [5,10,20,30,40,50,60,70,80,90,100], lore: [10,20,30,40,50,60,70,80,90,100,110] };
let desbloquearMetas = { classe: 'Monge', raca: '', lore: 'Conto Canônico: referente a algo da Campanha atual' };
let totaisApoios = { classe: 0, raca: 0, lore: 0 };

export async function onTabActivated() { await loadApoioUsers(); await carregarSistemaMetas(); }

// ===== USERS =====
async function loadApoioUsers() {
    try {
        const snap = await getDocs(collection(db, 'users'));
        const sel = document.getElementById('apoioUserSelect'); if (!sel) return;
        sel.innerHTML = '<option value="">Selecione um jogador...</option>';
        const users = []; snap.forEach(d => users.push({ id: d.id, ...d.data() }));
        users.sort((a, b) => (a.nome||a.email||'').localeCompare(b.nome||b.email||''));
        users.forEach(u => { const o = document.createElement('option'); o.value = u.id; o.textContent = `${u.nome||u.email||u.id} ${u.role?`(${u.role})`:''}`; sel.appendChild(o); });
        S.setNotificationUsersCache(users);
    } catch (e) { console.error(e); }
}

// ===== APOIOS =====
window.loadUserApoios = async function() {
    const uid = document.getElementById('apoioUserSelect')?.value;
    const el = document.getElementById('apoiosList');
    if (!uid || !el) { if (el) el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted)">Selecione um jogador</div>'; return; }
    S.setCurrentSelectedUserId(uid);
    try {
        const d = await getDoc(doc(db, 'users', uid));
        if (!d.exists()) { el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted)">Usuário não encontrado</div>'; return; }
        const apoios = d.data().apoios || [];
        S.setTodosApoiosCarregados(apoios); renderApoios(apoios);
    } catch (e) { showAlert('❌ Erro', 'danger'); }
};

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

// ===== METAS =====
async function carregarSistemaMetas() {
    try { await calcularTotaisApoios(); } catch (e) { console.error(e); }
    try { const d = await getDoc(doc(db, 'config', 'metas')); if (d.exists()) { const data = d.data(); if (data.classe) metasData.classe = data.classe; if (data.raca) metasData.raca = data.raca; if (data.lore) metasData.lore = data.lore; if (data.desbloquear) desbloquearMetas = data.desbloquear; } } catch (e) { console.warn('⚠️ Metas padrão'); }
    renderMetasUI(); renderizarTabelaMetas(); atualizarResumoMetas();
}
window.carregarSistemaMetas = carregarSistemaMetas;

async function calcularTotaisApoios() {
    totaisApoios = { classe: 0, raca: 0, lore: 0 };
    const snap = await getDocs(collection(db, 'users'));
    snap.forEach(d => { (d.data().apoios||[]).forEach(a => { const m = parseInt(a.montante)||1, mt = a.meta||''; if (mt==='Classe') totaisApoios.classe += m; else if (mt==='Raça') totaisApoios.raca += m; else if (mt==='Lore') totaisApoios.lore += m; }); });
}

function renderMetasUI() {
    const el = document.getElementById('metasContent'); if (!el) return;
    el.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:20px">
            <div style="background:rgba(234,179,8,.1);border:2px solid #eab308;border-radius:12px;padding:16px;text-align:center"><div style="font-weight:800;color:#eab308;font-size:1.1rem">🏰 Classe</div><div style="font-size:.85rem;color:var(--muted);margin-top:6px">Apoios: <span id="totalApoiosClasse">0</span> / Meta: <span id="metaAtualClasse">0</span></div><div style="font-size:.85rem;color:var(--muted)">Progresso: <span id="progressoClasse">0%</span></div><div style="font-size:.82rem;color:#eab308;margin-top:6px">🔓 <span id="desbloquearClasse">-</span></div></div>
            <div style="background:rgba(34,197,94,.1);border:2px solid #22c55e;border-radius:12px;padding:16px;text-align:center"><div style="font-weight:800;color:#22c55e;font-size:1.1rem">🎭 Raça</div><div style="font-size:.85rem;color:var(--muted);margin-top:6px">Apoios: <span id="totalApoiosRaca">0</span> / Meta: <span id="metaAtualRaca">0</span></div><div style="font-size:.85rem;color:var(--muted)">Progresso: <span id="progressoRaca">0%</span></div><div style="font-size:.82rem;color:#22c55e;margin-top:6px">🔓 <span id="desbloquearRaca">-</span></div></div>
            <div style="background:rgba(59,130,246,.1);border:2px solid #3b82f6;border-radius:12px;padding:16px;text-align:center"><div style="font-weight:800;color:#3b82f6;font-size:1.1rem">📖 Lore</div><div style="font-size:.85rem;color:var(--muted);margin-top:6px">Apoios: <span id="totalApoiosLore">0</span> / Meta: <span id="metaAtualLore">0</span></div><div style="font-size:.85rem;color:var(--muted)">Progresso: <span id="progressoLore">0%</span></div><div style="font-size:.82rem;color:#3b82f6;margin-top:6px">🔓 <span id="desbloquearLore">-</span></div></div>
        </div>
        <div style="overflow-x:auto;margin-bottom:16px"><table style="width:100%;border-collapse:collapse"><thead><tr style="border-bottom:2px solid var(--line)"><th style="padding:8px;text-align:left;color:var(--muted);font-size:.78rem">TIPO</th><th style="padding:8px;text-align:left;color:var(--muted);font-size:.78rem" colspan="20">METAS (clique para editar)</th></tr></thead><tbody>
            <tr style="border-bottom:1px solid var(--line)"><td style="padding:10px;font-weight:700;color:#eab308">🏰 Classe</td><td colspan="20"><div style="display:flex;gap:2px;flex-wrap:wrap" id="linhaMetaClasse"></div></td></tr>
            <tr style="border-bottom:1px solid var(--line)"><td style="padding:10px;font-weight:700;color:#22c55e">🎭 Raça</td><td colspan="20"><div style="display:flex;gap:2px;flex-wrap:wrap" id="linhaMetaRaca"></div></td></tr>
            <tr><td style="padding:10px;font-weight:700;color:#3b82f6">📖 Lore</td><td colspan="20"><div style="display:flex;gap:2px;flex-wrap:wrap" id="linhaMetaLore"></div></td></tr>
        </tbody></table></div>
        <button class="btn btn-primary btn-small" onclick="adicionarColunaMeta()">➕ Nova Meta</button>`;
}

function renderizarTabelaMetas() {
    const render = (id, arr, total, colors) => {
        const el = document.getElementById(id); if (!el) return;
        el.innerHTML = arr.map((v, i) => { const hit = total >= v; return `<span onclick="editarCelulaMeta('${id.replace('linhaMeta','').toLowerCase()}',${i})" style="padding:8px 14px;text-align:center;cursor:pointer;background:${hit?colors[1]:colors[0]};border:1px solid rgba(0,0,0,.3);border-radius:6px;font-weight:700;color:${hit&&colors[2]?colors[2]:'#fff'};font-size:.85rem;min-width:40px;display:inline-block">${v}</span>`; }).join('');
    };
    render('linhaMetaClasse', metasData.classe, totaisApoios.classe, ['#7c2d12','#eab308','#000']);
    render('linhaMetaRaca', metasData.raca, totaisApoios.raca, ['#991b1b','#22c55e','#fff']);
    render('linhaMetaLore', metasData.lore, totaisApoios.lore, ['#064e3b','#3b82f6','#fff']);
}

function atualizarResumoMetas() {
    const calc = (arr, total) => { const last = arr.filter(m => m <= total).pop()||0; const next = arr.find(m => m > total)||arr[arr.length-1]; const rel = total-last, meta = next-last; return { rel, meta, pct: meta > 0 ? Math.min(100, Math.round((rel/meta)*100)) : 100 }; };
    const c = calc(metasData.classe, totaisApoios.classe), r = calc(metasData.raca, totaisApoios.raca), l = calc(metasData.lore, totaisApoios.lore);
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('totalApoiosClasse', c.rel); set('metaAtualClasse', c.meta); set('progressoClasse', c.pct+'%');
    set('totalApoiosRaca', r.rel); set('metaAtualRaca', r.meta); set('progressoRaca', r.pct+'%');
    set('totalApoiosLore', l.rel); set('metaAtualLore', l.meta); set('progressoLore', l.pct+'%');
    set('desbloquearClasse', desbloquearMetas.classe||'-'); set('desbloquearRaca', desbloquearMetas.raca||'-'); set('desbloquearLore', desbloquearMetas.lore||'-');
}

window.editarCelulaMeta = function(tipo, i) {
    const map = { classe: 'classe', raca: 'raca', lore: 'lore' };
    const t = map[tipo]; if (!t) return;
    const v = prompt(`Editar meta de ${t}:`, metasData[t][i]);
    if (v !== null && !isNaN(parseInt(v))) { metasData[t][i] = parseInt(v); metasData[t].sort((a,b) => a-b); renderizarTabelaMetas(); atualizarResumoMetas(); salvarMetas(); }
};

window.adicionarColunaMeta = async function() {
    const tipo = prompt('Tipo (classe, raca, lore):', 'classe');
    if (!tipo || !['classe','raca','lore'].includes(tipo.toLowerCase())) { showAlert('⚠️ Tipo inválido', 'warning'); return; }
    const v = prompt('Valor:', '100');
    if (v !== null && !isNaN(parseInt(v))) { metasData[tipo.toLowerCase()].push(parseInt(v)); metasData[tipo.toLowerCase()].sort((a,b)=>a-b); renderizarTabelaMetas(); atualizarResumoMetas(); await salvarMetas(); showAlert('✅ Meta adicionada', 'success'); }
};

async function salvarMetas() {
    try { await setDoc(doc(db, 'config', 'metas'), { classe: metasData.classe, raca: metasData.raca, lore: metasData.lore, desbloquear: desbloquearMetas }); } catch (e) { showAlert('❌ Erro salvar metas', 'danger'); }
}

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
