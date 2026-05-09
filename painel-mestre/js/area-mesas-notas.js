// =============================================
// AREA MESAS — Notas Geral
// =============================================
import { db, collection, getDocs, doc, updateDoc } from './firebase-config.js';
import * as S from './state.js';
import { showAlert, escapeHtml } from './ui-utils.js';

window._loadMesaNotas = loadMesaNotas;

async function loadMesaNotas() {
    if (!S.currentMesaId) return;
    const el = document.getElementById('mesaNotasContent'); if (!el) return;
    try {
        let chars = S.mesaCharacters || [];
        if (!chars.length) {
            const snap = await getDocs(collection(db, 'char'));
            snap.forEach(d => { const data = d.data(); if (data.mesaId === S.currentMesaId) chars.push({ id: d.id, ...data }); });
        }
        if (!chars.length) { el.innerHTML = '<div style="text-align:center;padding:50px;color:var(--muted)">Nenhum personagem nesta mesa</div>'; return; }
        el.innerHTML = chars.map(c => {
            const f = c.fields || {};
            const nome = f.nome || c.nome || 'Sem nome';
            const charNotes = c.notes || [];
            const notesHtml = charNotes.length
                ? charNotes.map(n => `<div style="margin-bottom:8px;"><strong>${escapeHtml(n.titulo || 'Sem título')}</strong><br><span style="font-size:.82rem">${n.conteudo || ''}</span></div>`).join('')
                : '<span style="color:var(--muted)">Sem notas</span>';
            return `
            <div class="sessao-card" style="margin-bottom:14px">
                <div class="sessao-card-header">
                    <div class="sessao-titulo">🎭 ${escapeHtml(nome)}</div>
                    <button class="btn btn-primary btn-small" onclick="editCharNote('${c.id}')">✏️ Editar</button>
                </div>
                <div style="color:var(--ink);font-size:.88rem;line-height:1.6;padding:8px 0" id="note-display-${c.id}">${notesHtml}</div>
            </div>`;
        }).join('');
    } catch (e) { console.error(e); showAlert('❌ Erro ao carregar notas', 'danger'); }
}

window.editCharNote = function(charId) {
    const chars = S.mesaCharacters || [];
    const c = chars.find(x => x.id === charId);
    if (!c) return;
    const f = c.fields || {};
    const nome = f.nome || c.nome || '';
    // Build editable text from notes array
    const charNotes = c.notes || [];
    const notesText = charNotes.map(n => `[${n.titulo || 'Sem título'}]\n${(n.conteudo || '').replace(/<br>/g, '\n').replace(/<[^>]*>/g, '')}`).join('\n\n');
    const m = document.createElement('div'); m.className = 'modal active'; m.id = 'editNoteModal';
    m.innerHTML = `<div class="modal-content" style="max-width:700px"><div class="modal-header"><span class="modal-title">✏️ Notas — ${escapeHtml(nome)}</span><button class="modal-close" onclick="this.closest('.modal').remove()">✕</button></div><div class="modal-body">
        <p style="font-size:.8rem;color:var(--muted);margin:0 0 10px">Edite as notas livremente. Formato: [Título] seguido do conteúdo.</p>
        <textarea class="form-textarea" id="en_notas" rows="12" style="min-height:200px">${escapeHtml(notesText)}</textarea>
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px"><button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancelar</button><button class="btn btn-success" onclick="saveCharNote('${charId}')">💾 Salvar</button></div>
    </div></div>`;
    document.body.appendChild(m);
};

window.saveCharNote = async function(charId) {
    const raw = document.getElementById('en_notas')?.value || '';
    // Parse textarea back into notes array
    const blocks = raw.split(/\n\n+/).filter(b => b.trim());
    const notes = blocks.map((block, i) => {
        const lines = block.split('\n');
        let titulo = 'Nota ' + (i + 1);
        let conteudo = block;
        // Check if first line is a [Title]
        const titleMatch = lines[0].match(/^\[(.+)\]$/);
        if (titleMatch) {
            titulo = titleMatch[1];
            conteudo = lines.slice(1).join('\n');
        }
        return {
            id: 'note-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
            titulo,
            conteudo: conteudo.replace(/\n/g, '<br>'),
            criadoEm: new Date().toISOString(),
            atualizadoEm: new Date().toISOString()
        };
    });
    try {
        await updateDoc(doc(db, 'char', charId), { notes });
        // Update local state
        const c = (S.mesaCharacters || []).find(x => x.id === charId);
        if (c) c.notes = notes;
        showAlert('✅ Notas salvas!', 'success');
        document.getElementById('editNoteModal')?.remove();
        // Re-render notes display
        const display = document.getElementById(`note-display-${charId}`);
        if (display) {
            display.innerHTML = notes.length
                ? notes.map(n => `<div style="margin-bottom:8px;"><strong>${escapeHtml(n.titulo)}</strong><br><span style="font-size:.82rem">${n.conteudo}</span></div>`).join('')
                : '<span style="color:var(--muted)">Sem notas</span>';
        }
    } catch (e) { showAlert('❌ Erro: ' + e.message, 'danger'); }
};
