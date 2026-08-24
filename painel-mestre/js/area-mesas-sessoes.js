// =============================================
// AREA MESAS — Logs de Sessão
// =============================================
import { db, collection, getDocs, getDoc, doc, addDoc, updateDoc, deleteDoc, query, where, orderBy } from './firebase-config.js';
import * as S from './state.js';
import { showAlert, escapeHtml } from './ui-utils.js';
import { addLog } from './logs.js';
import { notifyUsers } from './notify.js';
import { expDeltas } from '../../shared/exp-deltas.js';
import { confirmar } from '../../shared/dialogo.js?v=2';

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
                    <button class="btn btn-secondary btn-small" onclick="event.stopPropagation();editSessionLog('${log.id}')" style="padding:4px 8px" title="Editar log">✏️</button>
                    <button class="btn btn-danger btn-small" onclick="event.stopPropagation();deleteSessionLog('${log.id}')" style="padding:4px 8px">🗑️</button>
                </div>
            </div>
            ${log.gameDate ? `<div style="font-size:.78rem;color:var(--primary);margin-bottom:6px">🎮 Data no jogo: ${escapeHtml(log.gameDate)}</div>` : ''}
            <div class="sessao-resumo">${escapeHtml((log.summary || '').substring(0, 200))}${(log.summary || '').length > 200 ? '...' : ''}</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
                ${(log.participants || []).map(p => `<span style="background:rgba(139,92,246,.15);color:var(--primary);padding:2px 8px;border-radius:6px;font-size:.75rem;font-weight:700">${escapeHtml(p.characterName || '?')}</span>`).join('')}
                ${(log.notasVinculadas || []).length ? `<span style="background:rgba(255,255,255,.06);color:var(--muted);padding:2px 8px;border-radius:6px;font-size:.75rem">🔗 ${log.notasVinculadas.length} nota(s)</span>` : ''}
            </div>
        </div>`).join('');
}

// ===== CAMPOS DO LOG (compartilhados com a Colheita da Sessão) =====
// O formulário e a gravação vivem aqui e são reusados pela colheita
// (area-mesas-sessao.js) — fechar a sessão já grava o log completo.
export async function carregarCharsMesa() {
    if ((S.mesaCharacters || []).length) return S.mesaCharacters;
    const chars = [];
    try {
        const snap = await getDocs(query(collection(db, 'char'), where('mesaId', '==', S.currentMesaId)));
        snap.forEach(d => chars.push({ ...d.data(), id: d.id }));
    } catch (e) { /* segue sem personagens */ }
    return chars;
}
const nomeChar = (c) => c.fields?.charName || c.fields?.nome || c.nome || 'Sem nome';

export function proximoNumeroSessao() {
    return S.mesaSessionLogs.length ? Math.max(...S.mesaSessionLogs.map(l => l.sessionNumber || 0)) + 1 : 1;
}

/**
 * Notas dos personagens da mesa. O log guarda só a REFERÊNCIA (char + nota):
 * o jogador escreve na ficha, o mestre marca a caixa, e o texto continua vivo
 * na ficha — editar a nota depois muda o que o log mostra.
 */
function notasPickerHtml(log, chars) {
    const sel = new Set((log.notasVinculadas || []).map(n => n.charId + '/' + n.noteId));
    const blocos = chars.map(c => {
        const notas = (c.notes || []).filter(n => n && n.id);
        if (!notas.length) return '';
        return `<div style="margin-bottom:8px">
            <div style="font-size:.78rem;font-weight:700;color:var(--primary);margin-bottom:4px">${escapeHtml(nomeChar(c))}</div>
            ${notas.map(n => `<label style="display:flex;align-items:center;gap:8px;padding:4px 6px;cursor:pointer;font-size:.85rem">
                <input type="checkbox" class="sl-nota" data-char="${c.id}" data-note="${escapeHtml(n.id)}" data-charname="${escapeHtml(nomeChar(c))}" data-titulo="${escapeHtml(n.titulo || 'Sem título')}" ${sel.has(c.id + '/' + n.id) ? 'checked' : ''} style="width:16px;height:16px">
                <span style="color:var(--ink,var(--light))">📄 ${escapeHtml(n.titulo || 'Sem título')}</span>
                <span style="flex:1;color:var(--muted);font-size:.72rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml((n.conteudo || '').replace(/<[^>]*>/g, ' ').trim().substring(0, 70))}</span>
            </label>`).join('')}
        </div>`;
    }).join('');
    return `<div class="form-group"><label class="form-label">🔗 Notas dos personagens <span style="font-weight:400;color:var(--muted);font-size:.75rem">— vincula, não copia: o texto segue vivo na ficha</span></label>
        ${blocos || '<div style="font-size:.8rem;color:var(--muted)">Nenhum personagem da mesa escreveu nota ainda.</div>'}</div>`;
}

/** @param log valores iniciais (log existente, ou prefill vindo da sessão). */
export function logCamposHtml(log, chars) {
    const sel = new Map((log.participants || []).map(p => [p.characterId, p]));
    const linhas = chars.map(c => {
        const p = sel.get(c.id);
        return `<div style="display:flex;align-items:center;gap:8px;padding:8px;border:1px solid var(--border);border-radius:8px;margin-bottom:6px">
            <input type="checkbox" class="sl-char-cb" value="${c.id}" data-name="${escapeHtml(nomeChar(c))}" data-owner="${c.ownerUid || ''}" ${p ? 'checked' : ''} style="width:18px;height:18px">
            <span style="flex:1;color:var(--light);font-weight:600">${escapeHtml(nomeChar(c))}</span>
            <input type="number" class="form-input sl-char-exp" data-char-id="${c.id}" placeholder="EXP" value="${Math.abs(parseInt(p?.expAmount, 10) || 0)}" oninput="if(+this.value)this.closest('div').querySelector('.sl-char-cb').checked=true" style="width:80px;text-align:center;padding:6px">
            <select class="form-select sl-char-exp-type" data-char-id="${c.id}" style="width:60px;padding:6px"><option value="add">+</option><option value="sub" ${p?.expType === 'sub' ? 'selected' : ''}>−</option></select>
        </div>`;
    }).join('');
    const ta = (id, rot, ph, rows) => `<div class="form-group"><label class="form-label">${rot}</label><textarea class="form-textarea" id="sl_${id}" rows="${rows}" placeholder="${ph}">${escapeHtml(log[id] || '')}</textarea></div>`;
    return `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group"><label class="form-label">Nº da Sessão</label><input type="number" class="form-input" id="sl_num" value="${log.sessionNumber || 1}" min="1"></div>
            <div class="form-group"><label class="form-label">Data Real</label><input type="date" class="form-input" id="sl_dateReal" value="${escapeHtml(log.dateReal || '')}"></div>
        </div>
        <div class="form-group"><label class="form-label">Data no Jogo</label><input type="text" class="form-input" id="sl_gameDate" value="${escapeHtml(log.gameDate || '')}" placeholder="Ex: 15 de Aura, Ano 10 EBA"></div>
        ${ta('summary', 'Resumo Geral *', 'O que aconteceu nesta sessão...', 8)}
        ${ta('playerSummaries', 'Resumo por Jogador', 'Jogador 1: fez X. Jogador 2: fez Y.', 3)}
        ${notasPickerHtml(log, chars)}
        <div class="form-group"><label class="form-label">Personagens Participantes &amp; EXP</label>${linhas || '<div style="color:var(--muted)">Nenhum personagem na mesa</div>'}</div>
        ${ta('npcs', 'NPCs Importantes', 'NPCs envolvidos...', 2)}
        ${ta('locations', 'Locais Visitados', 'Locais...', 2)}
        ${ta('combats', 'Combates', 'Descrição dos combates...', 2)}
        ${ta('loot', 'Loot / Recompensas', 'Itens encontrados...', 2)}
        ${ta('hooks', 'Ganchos para Próxima Sessão', 'O que vem a seguir...', 2)}
        ${ta('moments', 'Momentos Memoráveis', 'Momentos épicos, engraçados...', 2)}
        ${ta('dmNotes', 'Notas do Mestre (privado)', 'Anotações privadas...', 3)}`;
}

const val = (id) => document.getElementById('sl_' + id)?.value?.trim() || '';
/** Lê o formulário. `null` se o resumo estiver vazio (avisa o mestre). */
export function coletarLogCampos() {
    const summary = val('summary');
    if (!summary) { showAlert('⚠️ Resumo é obrigatório', 'warning'); return null; }
    // EXP digitado JÁ conta como presença: esquecer de marcar a caixinha fazia
    // o log salvar sem participante nenhum e o EXP sumir em silêncio.
    const participants = [];
    document.querySelectorAll('.sl-char-cb').forEach(cb => {
        const id = cb.value;
        const expAmount = parseInt(document.querySelector(`.sl-char-exp[data-char-id="${id}"]`)?.value) || 0;
        if (!cb.checked && !expAmount) return;
        participants.push({
            characterId: id,
            characterName: cb.dataset.name || '',
            ownerUid: cb.dataset.owner || '',
            expAmount,
            expType: document.querySelector(`.sl-char-exp-type[data-char-id="${id}"]`)?.value || 'add',
        });
    });
    return {
        sessionNumber: parseInt(document.getElementById('sl_num')?.value) || 1,
        dateReal: document.getElementById('sl_dateReal')?.value || '',
        gameDate: val('gameDate'), summary, playerSummaries: val('playerSummaries'), participants,
        notasVinculadas: [...document.querySelectorAll('.sl-nota:checked')].map(cb => ({
            charId: cb.dataset.char, charName: cb.dataset.charname, noteId: cb.dataset.note, titulo: cb.dataset.titulo,
        })),
        npcs: val('npcs'), locations: val('locations'), combats: val('combats'), loot: val('loot'),
        hooks: val('hooks'), moments: val('moments'), dmNotes: val('dmNotes'),
    };
}

/** Grava o log (novo ou edição) e move na ficha só o DELTA de EXP. */
export async function gravarSessionLog(dados, anterior) {
    if (anterior?.id) await updateDoc(doc(db, 'session-logs', anterior.id), dados);
    else await addDoc(collection(db, 'session-logs'), {
        ...dados, mesaId: S.currentMesaId,
        createdAt: new Date().toISOString(), createdBy: S.currentUser?.email,
    });
    for (const { p, delta } of expDeltas(anterior?.participants, dados.participants)) {
        try {
            const charRef = doc(db, 'char', p.characterId);
            const snap = await getDoc(charRef);
            if (!snap.exists()) continue;
            const f = snap.data().fields || {};
            await updateDoc(charRef, {
                'fields.exp': Math.max(0, (parseInt(f.exp || 0, 10) || 0) + delta),
                'fields.exp_total': Math.max(0, (parseInt(f.exp_total || 0, 10) || 0) + delta),
            });
            if (p.ownerUid) await notifyUsers([p.ownerUid], {
                type: 'exp_received', highlight: 'importante',
                message: `Sessão #${dados.sessionNumber}: ${delta > 0 ? 'Ganhou' : 'Perdeu'} ${Math.abs(delta)} EXP em ${p.characterName}!`,
                data: { direction: delta > 0 ? 'up' : 'down', amount: Math.abs(delta), characterName: p.characterName },
            });
        } catch (e) { console.warn('exp/log-sessao', p.characterId, e); }
    }
}

// ===== CREATE / EDIT SESSION LOG =====
window.openCreateSessionLogModal = async function(logId) {
    if (!S.currentMesaId) return;
    const chars = await carregarCharsMesa();
    const log = logId ? S.mesaSessionLogs.find(l => l.id === logId) : null;
    const inicial = log || { sessionNumber: proximoNumeroSessao(), dateReal: new Date().toISOString().split('T')[0] };
    const m = document.createElement('div'); m.className = 'modal active'; m.id = 'createSessionModal';
    m._log = log;
    m.innerHTML = `<div class="modal-content" style="max-width:800px"><div class="modal-header"><span class="modal-title">📝 ${log ? 'Editar' : 'Novo'} Log de Sessão</span><button class="modal-close" onclick="this.closest('.modal').remove()">✕</button></div><div class="modal-body" style="max-height:75vh;overflow-y:auto">
        ${logCamposHtml(inicial, chars)}
        ${log ? '<div style="font-size:.75rem;color:var(--muted);margin-bottom:10px">⭐ Mudar o EXP aqui move na ficha só a diferença — não reaplica o que já foi dado.</div>' : ''}
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px"><button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancelar</button><button class="btn btn-success" onclick="saveSessionLog()">💾 Salvar</button></div>
    </div></div>`;
    document.body.appendChild(m);
};
window.editSessionLog = (logId) => window.openCreateSessionLogModal(logId);

window.saveSessionLog = async function() {
    const modal = document.getElementById('createSessionModal');
    const dados = coletarLogCampos();
    if (!dados) return;
    try {
        await gravarSessionLog(dados, modal?._log);
        showAlert('✅ Log de sessão salvo!', 'success');
        modal?.remove();
        await loadSessionLogs();
    } catch (e) { showAlert('❌ Erro: ' + e.message, 'danger'); }
};

/* ===== LEITURA DO LOG =====
   O que o mestre digitou no <textarea> tem parágrafo: linha em branco separa
   bloco, quebra simples é quebra dentro do parágrafo. Aqui isso vira <p>/<br>
   de verdade — antes o texto era jogado num <div> e virava um amontoado só. */
const prosa = (t) => (t || '').split(/\n{2,}/).map(b => b.trim()).filter(Boolean)
    .map(b => `<p>${escapeHtml(b).replace(/\n/g, '<br>')}</p>`).join('');

const blocoLog = (rotulo, html, extra) => html
    ? `<section class="log-sec"><span class="log-rotulo">${rotulo}</span>
        <div class="log-prosa${extra ? ' ' + extra : ''}">${html}</div></section>`
    : '';

/** Notas referenciadas pelo log, com o conteudo lido da ficha na hora. */
async function notasVinculadasHtml(log) {
    const refs = log.notasVinculadas || [];
    if (!refs.length) return '';
    const chars = await carregarCharsMesa();
    const itens = refs.map(ref => {
        const c = chars.find(x => x.id === ref.charId);
        const n = (c?.notes || []).find(x => x.id === ref.noteId);
        const corpo = n ? (n.conteudo || '<i>Nota vazia</i>')
            : '<i>Nota apagada da ficha — sobrou só o título.</i>';
        return `<details class="log-nota">
            <summary>📄 ${escapeHtml(n?.titulo || ref.titulo || 'Sem título')}
                <span class="log-nota-dono">— ${escapeHtml(ref.charName || '')}</span></summary>
            <div class="log-prosa log-nota-corpo">${corpo}</div>
        </details>`;
    }).join('');
    return `<section class="log-sec"><span class="log-rotulo">🔗 Notas dos personagens</span>${itens}</section>`;
}

// ===== VIEW SESSION LOG =====
window.viewSessionLog = async function(logId) {
    const log = S.mesaSessionLogs.find(l => l.id === logId);
    if (!log) return;
    // Notas vinculadas: o texto sai da ficha AGORA, nao de uma copia velha.
    const notasHtml = await notasVinculadasHtml(log);
    const participantes = (log.participants || []).map(p => {
        const neg = p.expType === 'sub';
        return `<span class="log-part-item">${escapeHtml(p.characterName || '?')}
            <span class="log-exp${neg ? ' log-exp--neg' : ''}">${neg ? '−' : '+'}${p.expAmount || 0} EXP</span></span>`;
    }).join('');
    // Campos curtos vão para a grade; os longos ficam em coluna única, na
    // largura de leitura, para o olho não perder a linha.
    const curtos = [
        ['NPCs', log.npcs], ['Locais', log.locations], ['Combates', log.combats],
        ['Loot', log.loot], ['Ganchos', log.hooks], ['Momentos', log.moments],
    ].map(([rot, txt]) => blocoLog(rot, prosa(txt))).filter(Boolean).join('');

    const m = document.createElement('div'); m.className = 'modal active';
    m.innerHTML = `<div class="modal-content" style="max-width:800px"><div class="modal-header"><span class="modal-title">📝 Sessão #${log.sessionNumber || '?'} — ${log.dateReal || ''}</span>
        <button class="btn btn-secondary btn-small" style="margin-left:auto;padding:4px 10px" onclick="this.closest('.modal').remove();editSessionLog('${log.id}')">✏️ Editar</button>
        <button class="modal-close" onclick="this.closest('.modal').remove()">✕</button></div><div class="modal-body" style="max-height:75vh;overflow-y:auto">
        ${log.gameDate ? `<div style="font-size:var(--lr-fs-sm);color:var(--lr-arcane);margin-bottom:var(--lr-space-5)">🎮 Data no jogo: ${escapeHtml(log.gameDate)}</div>` : ''}
        ${blocoLog('Resumo Geral', prosa(log.summary))}
        ${blocoLog('Resumo por Jogador', prosa(log.playerSummaries))}
        ${notasHtml}
        ${participantes ? `<section class="log-sec"><span class="log-rotulo">Participantes</span><div class="log-part">${participantes}</div></section>` : ''}
        ${curtos ? `<div class="log-grid">${curtos}</div>` : ''}
        ${blocoLog('Notas do Mestre', prosa(log.dmNotes), 'log-prosa--privado')}
    </div></div>`;
    document.body.appendChild(m);
    m.addEventListener('click', e => { if (e.target === m) m.remove(); });
};

// ===== DELETE SESSION LOG =====
window.deleteSessionLog = async function(logId) {
    if (!await confirmar('Deletar este log de sessão?', { perigo: true })) return;
    try {
        await deleteDoc(doc(db, 'session-logs', logId));
        showAlert('✅ Log deletado', 'success');
        await loadSessionLogs();
    } catch (e) { showAlert('❌ Erro', 'danger'); }
};
