// =============================================
// AREA MESAS — Notas Geral (estilo Ficha v1.7)
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
                ? charNotes.map(n => {
                    const prev = (n.conteudo || '').replace(/<[^>]*>/g, '').substring(0, 120);
                    return `<div class="mesa-note-card">
                        <div class="mesa-note-title-row">
                            <span>📄 ${escapeHtml(n.titulo || 'Sem título')}</span>
                            <div class="mesa-note-actions">
                                <button onclick="editSingleNote('${c.id}','${n.id}');event.stopPropagation()" title="Editar nota">✏️</button>
                                <button class="mesa-note-del" onclick="deleteSingleNote('${c.id}','${n.id}');event.stopPropagation()" title="Excluir nota">🗑️</button>
                            </div>
                        </div>
                        <div class="mesa-note-preview">${prev || 'Nota vazia...'}</div>
                    </div>`;
                }).join('')
                : '<div style="color:var(--muted);font-size:.82rem;padding:8px 0;text-align:center">Nenhuma nota ainda.</div>';
            return `
            <div class="sessao-card" style="margin-bottom:14px">
                <div class="sessao-card-header">
                    <div class="sessao-titulo">🎭 ${escapeHtml(nome)}</div>
                    <button class="btn btn-success btn-small" onclick="addNewNote('${c.id}')" title="Adicionar nova nota">➕ Nova Nota</button>
                </div>
                <div id="note-display-${c.id}" style="padding:8px 0">
                    ${notesHtml}
                </div>
            </div>`;
        }).join('');
    } catch (e) { console.error(e); showAlert('❌ Erro ao carregar notas', 'danger'); }
}

// Re-render a single character's notes display
function rerenderCharNotes(charId) {
    const chars = S.mesaCharacters || [];
    const c = chars.find(x => x.id === charId);
    if (!c) return;
    const display = document.getElementById(`note-display-${charId}`);
    if (!display) return;
    const charNotes = c.notes || [];
    if (!charNotes.length) {
        display.innerHTML = '<div style="color:var(--muted);font-size:.82rem;padding:8px 0;text-align:center">Nenhuma nota ainda.</div>';
        return;
    }
    display.innerHTML = charNotes.map(n => {
        const prev = (n.conteudo || '').replace(/<[^>]*>/g, '').substring(0, 120);
        return `<div class="mesa-note-card">
            <div class="mesa-note-title-row">
                <span>📄 ${escapeHtml(n.titulo || 'Sem título')}</span>
                <div class="mesa-note-actions">
                    <button onclick="editSingleNote('${charId}','${n.id}');event.stopPropagation()" title="Editar nota">✏️</button>
                    <button class="mesa-note-del" onclick="deleteSingleNote('${charId}','${n.id}');event.stopPropagation()" title="Excluir nota">🗑️</button>
                </div>
            </div>
            <div class="mesa-note-preview">${prev || 'Nota vazia...'}</div>
        </div>`;
    }).join('');
}

// Add a new note to a character
window.addNewNote = function(charId) {
    const chars = S.mesaCharacters || [];
    const c = chars.find(x => x.id === charId);
    if (!c) return;
    const f = c.fields || {};
    const nome = f.nome || c.nome || '';
    const newNote = {
        id: 'note-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        titulo: '',
        conteudo: '',
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString()
    };
    // Open editor for this new note
    openNoteEditorModal(charId, newNote, true);
};

// Edit a specific note
window.editSingleNote = function(charId, noteId) {
    const chars = S.mesaCharacters || [];
    const c = chars.find(x => x.id === charId);
    if (!c) return;
    const note = (c.notes || []).find(n => n.id === noteId);
    if (!note) return;
    openNoteEditorModal(charId, { ...note }, false);
};

// Delete a specific note
window.deleteSingleNote = async function(charId, noteId) {
    if (!confirm('Excluir esta nota?')) return;
    const chars = S.mesaCharacters || [];
    const c = chars.find(x => x.id === charId);
    if (!c) return;
    const notes = (c.notes || []).filter(n => n.id !== noteId);
    try {
        await updateDoc(doc(db, 'char', charId), { notes });
        c.notes = notes;
        showAlert('✅ Nota excluída!', 'success');
        rerenderCharNotes(charId);
    } catch (e) { showAlert('❌ Erro: ' + e.message, 'danger'); }
};

// Open the note editor modal (rich text style like Ficha v1.7)
function openNoteEditorModal(charId, note, isNew) {
    const chars = S.mesaCharacters || [];
    const c = chars.find(x => x.id === charId);
    if (!c) return;
    const f = c.fields || {};
    const nome = f.nome || c.nome || '';
    const m = document.createElement('div');
    m.className = 'modal active';
    m.id = 'editNoteModal';
    m.innerHTML = `<div class="modal-content" style="max-width:700px">
        <div class="modal-header">
            <span class="modal-title">${isNew ? '➕ Nova Nota' : '✏️ Editar Nota'} — ${escapeHtml(nome)}</span>
            <button class="modal-close" onclick="this.closest('.modal').remove()">✕</button>
        </div>
        <div class="modal-body">
            <div class="form-group">
                <label class="form-label">Título</label>
                <input type="text" class="form-input" id="en_titulo" placeholder="Título da nota..." value="${escapeHtml(note.titulo || '')}">
            </div>
            <div class="form-group">
                <label class="form-label">Conteúdo</label>
                <div class="mesa-note-editor-toolbar">
                    <button type="button" onclick="document.execCommand('bold',false,null);document.getElementById('en_conteudo').focus()" title="Negrito"><b>B</b></button>
                    <button type="button" onclick="document.execCommand('italic',false,null);document.getElementById('en_conteudo').focus()" title="Itálico"><i>I</i></button>
                    <button type="button" onclick="document.execCommand('underline',false,null);document.getElementById('en_conteudo').focus()" title="Sublinhado"><u>U</u></button>
                    <button type="button" onclick="document.execCommand('insertUnorderedList',false,null);document.getElementById('en_conteudo').focus()" title="Lista">☰</button>
                </div>
                <div contenteditable="true" class="form-textarea mesa-note-editor-body" id="en_conteudo" style="min-height:180px;max-height:400px;overflow-y:auto;padding:12px">${note.conteudo || ''}</div>
            </div>
            <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px">
                <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancelar</button>
                <button class="btn btn-success" onclick="saveNoteFromEditor('${charId}','${note.id}',${isNew})">💾 Salvar</button>
            </div>
        </div>
    </div>`;
    document.body.appendChild(m);
}

window.saveNoteFromEditor = async function(charId, noteId, isNew) {
    const titulo = document.getElementById('en_titulo')?.value?.trim() || 'Sem título';
    const conteudo = document.getElementById('en_conteudo')?.innerHTML || '';
    const chars = S.mesaCharacters || [];
    const c = chars.find(x => x.id === charId);
    if (!c) return;
    let notes = c.notes || [];
    if (isNew) {
        notes.push({
            id: noteId,
            titulo,
            conteudo,
            criadoEm: new Date().toISOString(),
            atualizadoEm: new Date().toISOString()
        });
    } else {
        const n = notes.find(x => x.id === noteId);
        if (n) {
            n.titulo = titulo;
            n.conteudo = conteudo;
            n.atualizadoEm = new Date().toISOString();
        }
    }
    try {
        await updateDoc(doc(db, 'char', charId), { notes });
        c.notes = notes;
        showAlert('✅ Nota salva!', 'success');
        document.getElementById('editNoteModal')?.remove();
        rerenderCharNotes(charId);
    } catch (e) { showAlert('❌ Erro: ' + e.message, 'danger'); }
};

// Legacy: keep old function for backward compat
window.editCharNote = function(charId) {
    const chars = S.mesaCharacters || [];
    const c = chars.find(x => x.id === charId);
    if (!c) return;
    // If has notes, edit the first one; otherwise create new
    if (c.notes && c.notes.length) {
        editSingleNote(charId, c.notes[0].id);
    } else {
        addNewNote(charId);
    }
};
