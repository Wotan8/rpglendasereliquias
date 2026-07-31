// =============================================
// AREA MESAS — Frentes (ameaças com relógio)
// Frente = perigo + relógio de fatias + presságios por limiar + rostos (NPCs).
// Segredo de mestre: as rules bloqueiam até a leitura por jogadores.
// =============================================
import { db, collection, getDocs, getDoc, doc, addDoc, updateDoc, deleteDoc } from './firebase-config.js';
import * as S from './state.js';
import { showAlert, escapeHtml } from './ui-utils.js';

window._loadMesaFrentes = loadMesaFrentes;

let _frentes = [];
const _nomesNpcs = {};      // npcId -> nome (cache p/ chips de rostos)
let _npcsAll = null;        // catálogo p/ o seletor de rostos (carregado 1x por sessão)

const TIPOS = { ameaca: '⚔️ Ameaça', faccao: '🏳️ Facção', lugar: '🗺️ Lugar' };
const STATUS_LABEL = { ativa: 'Ativa', adormecida: '💤 Adormecida', resolvida: '✅ Resolvida' };

const refFrentes = () => collection(db, 'mesas', S.currentMesaId, 'frentes');

async function loadMesaFrentes() {
    if (!S.currentMesaId) return;
    const el = document.getElementById('mesaFrentesList'); if (!el) return;
    try {
        const snap = await getDocs(refFrentes());
        _frentes = []; snap.forEach(d => _frentes.push({ id: d.id, ...d.data() }));
        // Ativas primeiro, ordenadas por pressão (relógio mais cheio no topo)
        const peso = f => f.status === 'ativa' ? 0 : f.status === 'adormecida' ? 1 : 2;
        _frentes.sort((a, b) => peso(a) - peso(b) ||
            ((b.relogio?.cheias || 0) / (b.relogio?.fatias || 1)) - ((a.relogio?.cheias || 0) / (a.relogio?.fatias || 1)));
        // Nomes dos rostos: só os docs que ainda não estão no cache
        const ids = [...new Set(_frentes.flatMap(f => f.rostos || []))].filter(id => !_nomesNpcs[id]);
        await Promise.all(ids.map(async id => {
            try { const s = await getDoc(doc(db, 'npcs', id)); _nomesNpcs[id] = s.exists() ? (s.data().nome || '?') : '(removido)'; }
            catch { _nomesNpcs[id] = '?'; }
        }));
        renderFrentes();
    } catch (e) { console.error(e); showAlert('❌ Erro ao carregar frentes', 'danger'); }
}

function pips(relogio) {
    const fatias = relogio?.fatias || 6, cheias = Math.min(relogio?.cheias || 0, fatias);
    let h = '';
    for (let i = 0; i < fatias; i++)
        h += `<span style="width:16px;height:9px;border-radius:2px;display:inline-block;margin-right:3px;${i < cheias ? 'background:var(--danger)' : 'border:1px solid var(--border)'}"></span>`;
    return `${h}<span style="font-size:.78rem;color:var(--muted);margin-left:4px">${cheias}/${fatias}</span>`;
}

function renderFrentes() {
    const el = document.getElementById('mesaFrentesList'); if (!el) return;
    if (!_frentes.length) {
        el.innerHTML = '<div style="text-align:center;padding:50px;color:var(--muted)"><div style="font-size:2.5rem;margin-bottom:12px">🕰️</div>Nenhuma frente criada.<br>Frentes são as ameaças que avançam quando os jogadores olham para o outro lado.</div>';
        return;
    }
    const ativas = _frentes.filter(f => f.status === 'ativa').length;
    const aviso = ativas > 5 ? '<div style="font-size:.78rem;color:var(--warning,#f59e0b);margin-bottom:10px">⚠️ Mais de 5 frentes ativas — considere adormecer algumas: cada uma é uma promessa de atenção por sessão.</div>' : '';
    el.innerHTML = aviso + _frentes.map(f => {
        const r = f.relogio || {};
        const cheias = Math.min(r.cheias || 0, r.fatias || 6);
        const press = (f.pressagios || []).slice().sort((a, b) => (a.quando || 0) - (b.quando || 0)).map(p => {
            const prox = !p.ocorrido && (p.quando || 0) === Math.min(...(f.pressagios || []).filter(x => !x.ocorrido).map(x => x.quando || 0));
            return `<div style="font-size:.82rem;padding:2px 0;color:${p.ocorrido ? 'var(--muted)' : 'var(--ink,var(--light))'}">
                ${p.ocorrido ? '✔️' : prox ? '➡️' : '·'} <span style="${p.ocorrido ? 'text-decoration:line-through' : ''}">${p.quando || 0} · ${escapeHtml(p.texto || '')}</span></div>`;
        }).join('');
        const rostos = (f.rostos || []).map(id =>
            `<span style="font-size:.75rem;padding:2px 10px;border:1px solid var(--border);border-radius:12px;cursor:pointer" onclick="_openMesaNpcEdit('${id}')">${escapeHtml(_nomesNpcs[id] || '?')}</span>`).join(' ');
        const inativa = f.status !== 'ativa';
        return `<div class="sessao-card" style="${inativa ? 'opacity:.6;' : ''}margin-bottom:12px">
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
                <span style="font-weight:800;color:var(--light);font-size:1.02rem">${escapeHtml(f.nome || 'Sem nome')}</span>
                <span style="font-size:.72rem;padding:2px 8px;border-radius:6px;background:rgba(139,92,246,.15);color:var(--primary);font-weight:700">${TIPOS[f.tipo] || TIPOS.ameaca}</span>
                ${inativa ? `<span style="font-size:.72rem;color:var(--muted)">${STATUS_LABEL[f.status] || ''}</span>` : ''}
                <span style="margin-left:auto">${pips(r)}</span>
            </div>
            ${f.perigo ? `<div style="font-size:.82rem;color:var(--muted);margin:6px 0">Se ninguém agir: ${escapeHtml(f.perigo)}</div>` : ''}
            ${press ? `<div style="border-top:1px solid var(--border);margin-top:6px;padding-top:6px">${press}</div>` : ''}
            <div style="display:flex;align-items:center;gap:6px;margin-top:8px;flex-wrap:wrap">
                ${rostos ? `<span style="font-size:.72rem;color:var(--muted)">Rostos:</span> ${rostos}` : ''}
                <span style="margin-left:auto;display:flex;gap:6px">
                    ${f.status === 'ativa' ? `
                        <button class="btn btn-secondary btn-small" onclick="frenteAvancar('${f.id}',-1)" ${cheias <= 0 ? 'disabled style="opacity:.4"' : ''} title="Recuar relógio">↩️</button>
                        <button class="btn btn-danger btn-small" onclick="frenteAvancar('${f.id}',1)" ${cheias >= (r.fatias || 6) ? 'disabled style="opacity:.4"' : ''} title="Avançar relógio">⏭️ Avançar</button>` : ''}
                    <button class="btn btn-secondary btn-small" onclick="frenteHistorico('${f.id}')" title="Histórico do relógio">📜</button>
                    <button class="btn btn-secondary btn-small" onclick="openFrenteModal('${f.id}')" title="Editar">✏️</button>
                </span>
            </div>
        </div>`;
    }).join('');
}

// ===== AVANÇO / RECUO =====
// Núcleo puro do movimento do relógio — usado aqui e pela colheita da página
// de Sessão. Presságios cruzados pelo avanço disparam. Recuo NÃO desfaz
// presságio: o mundo não desacontece — o relógio volta, o fato ocorrido fica.
export function computeAvanco(f, delta, motivo) {
    const fatias = f.relogio?.fatias || 6;
    const de = Math.min(f.relogio?.cheias || 0, fatias);
    const para = Math.max(0, Math.min(de + delta, fatias));
    if (para === de) return null;
    const pressagios = (f.pressagios || []).map(p => ({ ...p }));
    const disparados = [];
    if (delta > 0) for (const p of pressagios) {
        if (!p.ocorrido && (p.quando || 0) <= para) { p.ocorrido = true; disparados.push(p.texto); }
    }
    const historico = [...(f.historico || []), { de, para, motivo: (motivo || '').trim(), t: Date.now() }];
    return { patch: { 'relogio.cheias': para, pressagios, historico }, disparados, de, para };
}

window.frenteAvancar = async function(id, delta) {
    const f = _frentes.find(x => x.id === id); if (!f) return;
    const motivo = prompt(delta > 0 ? 'Motivo do avanço (uma linha):' : 'Motivo do recuo (uma linha):');
    if (motivo === null) return;
    const mov = computeAvanco(f, delta, motivo);
    if (!mov) return;
    const { disparados } = mov;
    try {
        await updateDoc(doc(refFrentes(), id), mov.patch);
        if (disparados.length) showAlert('🔔 Presságio disparado: ' + disparados.join(' · '), 'warning');
        else showAlert(delta > 0 ? '⏭️ Relógio avançou' : '↩️ Relógio recuou', 'success');
        await loadMesaFrentes();
    } catch (e) { showAlert('❌ Erro: ' + e.message, 'danger'); }
};

// ===== HISTÓRICO =====
window.frenteHistorico = function(id) {
    const f = _frentes.find(x => x.id === id); if (!f) return;
    const linhas = (f.historico || []).slice().reverse().map(h =>
        `<div style="padding:8px 0;border-bottom:1px solid var(--border);font-size:.85rem">
            <span style="font-weight:700;color:var(--light)">${h.de} → ${h.para}</span>
            <span style="color:var(--muted);margin-left:8px">${h.t ? new Date(h.t).toLocaleDateString('pt-BR') : ''}</span>
            ${h.motivo ? `<div style="color:var(--ink,var(--muted))">${escapeHtml(h.motivo)}</div>` : ''}
        </div>`).join('') || '<div style="color:var(--muted);text-align:center;padding:20px">Relógio nunca foi movido</div>';
    const m = document.createElement('div'); m.className = 'modal active';
    m.innerHTML = `<div class="modal-content" style="max-width:500px"><div class="modal-header"><span class="modal-title">📜 ${escapeHtml(f.nome || '')} — Histórico</span><button class="modal-close" onclick="this.closest('.modal').remove()">✕</button></div><div class="modal-body" style="max-height:60vh;overflow-y:auto">${linhas}</div></div>`;
    document.body.appendChild(m);
    m.addEventListener('click', e => { if (e.target === m) m.remove(); });
};

// ===== EDITOR (criar / editar) =====
window.openFrenteModal = async function(id) {
    const f = id ? _frentes.find(x => x.id === id) : null;
    if (!_npcsAll) {
        try {
            const snap = await getDocs(collection(db, 'npcs'));
            _npcsAll = []; snap.forEach(d => { const n = d.data(); _npcsAll.push({ id: d.id, nome: n.nome || 'Sem nome' }); _nomesNpcs[d.id] = n.nome || 'Sem nome'; });
            _npcsAll.sort((a, b) => a.nome.localeCompare(b.nome));
        } catch { _npcsAll = []; }
    }
    const r = f?.relogio || {};
    const pressRows = (f?.pressagios || []).map(p => pressRowHtml(p)).join('');
    const rostosSel = new Set(f?.rostos || []);
    const rostosHtml = _npcsAll.map(n =>
        `<label class="fr-rosto" data-nome="${escapeHtml(n.nome.toLowerCase())}" style="display:flex;align-items:center;gap:8px;padding:4px 6px;cursor:pointer;font-size:.85rem">
            <input type="checkbox" class="fr-rosto-cb" value="${n.id}" ${rostosSel.has(n.id) ? 'checked' : ''}> ${escapeHtml(n.nome)}</label>`).join('');
    const m = document.createElement('div'); m.className = 'modal active'; m.id = 'frenteModal';
    m.innerHTML = `<div class="modal-content" style="max-width:640px"><div class="modal-header"><span class="modal-title">${f ? '✏️ Editar Frente' : '➕ Nova Frente'}</span><button class="modal-close" onclick="this.closest('.modal').remove()">✕</button></div><div class="modal-body" style="max-height:75vh;overflow-y:auto">
        <div class="form-group"><label class="form-label">Nome *</label><input type="text" class="form-input" id="fr_nome" value="${escapeHtml(f?.nome || '')}" placeholder="Nome da ameaça, facção ou lugar"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
            <div class="form-group"><label class="form-label">Tipo</label><select class="form-select" id="fr_tipo">${Object.entries(TIPOS).map(([k, v]) => `<option value="${k}" ${f?.tipo === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
            <div class="form-group"><label class="form-label">Fatias do relógio</label><select class="form-select" id="fr_fatias">${[4, 6, 8, 12].map(n => `<option ${(r.fatias || 6) === n ? 'selected' : ''}>${n}</option>`).join('')}</select>
                <div style="font-size:.7rem;color:var(--muted);margin-top:2px">≈ nº de sessões até o desastre</div></div>
            <div class="form-group"><label class="form-label">Status</label><select class="form-select" id="fr_status">${['ativa', 'adormecida', 'resolvida'].map(s => `<option value="${s}" ${(f?.status || 'ativa') === s ? 'selected' : ''}>${STATUS_LABEL[s]}</option>`).join('')}</select></div>
        </div>
        <div class="form-group"><label class="form-label">Perigo</label><textarea class="form-textarea" id="fr_perigo" rows="2" placeholder="Se ninguém agir: o que acontece?">${escapeHtml(f?.perigo || '')}</textarea></div>
        <div class="form-group"><label class="form-label">Presságios (limiar de fatias · o que o mundo mostra)</label>
            <div id="fr_pressagios">${pressRows}</div>
            <button class="btn btn-secondary btn-small" onclick="frAddPressagio()" style="margin-top:6px">➕ Presságio</button></div>
        <div class="form-group"><label class="form-label">Rostos (NPCs que encarnam a frente)</label>
            <input type="text" class="form-input" placeholder="🔍 Filtrar NPCs..." oninput="frFiltraRostos(this.value)" style="margin-bottom:6px">
            <div id="fr_rostos" style="max-height:160px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;padding:4px">${rostosHtml || '<div style="color:var(--muted);padding:10px;text-align:center">Nenhum NPC cadastrado</div>'}</div></div>
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px">
            ${f ? `<button class="btn btn-danger" style="margin-right:auto" onclick="deleteFrente('${f.id}')">🗑️ Excluir</button>` : ''}
            <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancelar</button>
            <button class="btn btn-success" onclick="saveFrente('${f?.id || ''}')">💾 Salvar</button></div>
    </div></div>`;
    document.body.appendChild(m);
};

function pressRowHtml(p) {
    return `<div class="fr-press-row" style="display:flex;gap:6px;align-items:center;margin-bottom:6px">
        <input type="number" class="form-input fr-press-quando" value="${p?.quando || ''}" min="1" max="12" placeholder="nº" style="width:64px;text-align:center" title="Dispara quando o relógio chega nesta fatia">
        <input type="text" class="form-input fr-press-texto" value="${escapeHtml(p?.texto || '')}" placeholder="O que os jogadores percebem no mundo" style="flex:1">
        <label style="font-size:.72rem;color:var(--muted);display:flex;align-items:center;gap:4px;white-space:nowrap"><input type="checkbox" class="fr-press-ocorrido" ${p?.ocorrido ? 'checked' : ''}> ocorrido</label>
        <button class="btn btn-danger btn-small" onclick="this.closest('.fr-press-row').remove()">✕</button></div>`;
}
window.frAddPressagio = function() {
    document.getElementById('fr_pressagios')?.insertAdjacentHTML('beforeend', pressRowHtml(null));
};
window.frFiltraRostos = function(v) {
    const s = (v || '').toLowerCase();
    document.querySelectorAll('#fr_rostos .fr-rosto').forEach(l => {
        l.style.display = (l.dataset.nome || '').includes(s) || l.querySelector('input').checked ? 'flex' : 'none';
    });
};

window.saveFrente = async function(id) {
    const nome = document.getElementById('fr_nome')?.value?.trim();
    if (!nome) { showAlert('⚠️ Nome obrigatório', 'warning'); return; }
    const fatias = parseInt(document.getElementById('fr_fatias')?.value) || 6;
    const pressagios = [];
    document.querySelectorAll('#frenteModal .fr-press-row').forEach(row => {
        const texto = row.querySelector('.fr-press-texto')?.value?.trim();
        if (!texto) return;
        pressagios.push({
            texto,
            quando: parseInt(row.querySelector('.fr-press-quando')?.value) || fatias,
            ocorrido: row.querySelector('.fr-press-ocorrido')?.checked || false,
        });
    });
    const rostos = Array.from(document.querySelectorAll('#frenteModal .fr-rosto-cb:checked')).map(c => c.value);
    const antiga = id ? _frentes.find(x => x.id === id) : null;
    const dados = {
        nome,
        tipo: document.getElementById('fr_tipo')?.value || 'ameaca',
        perigo: document.getElementById('fr_perigo')?.value?.trim() || '',
        status: document.getElementById('fr_status')?.value || 'ativa',
        relogio: { fatias, cheias: Math.min(antiga?.relogio?.cheias || 0, fatias) },
        pressagios, rostos,
    };
    try {
        if (id) await updateDoc(doc(refFrentes(), id), dados);
        else await addDoc(refFrentes(), { ...dados, historico: [], createdAt: Date.now() });
        showAlert('✅ Frente salva!', 'success');
        document.getElementById('frenteModal')?.remove();
        await loadMesaFrentes();
    } catch (e) { showAlert('❌ Erro: ' + e.message, 'danger'); }
};

window.deleteFrente = async function(id) {
    if (!confirm('Excluir esta frente e todo o histórico do relógio?')) return;
    try {
        await deleteDoc(doc(refFrentes(), id));
        showAlert('🗑️ Frente excluída', 'success');
        document.getElementById('frenteModal')?.remove();
        await loadMesaFrentes();
    } catch (e) { showAlert('❌ Erro: ' + e.message, 'danger'); }
};
