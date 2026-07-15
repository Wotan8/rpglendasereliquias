// =============================================
// AREA MESAS — Notas Geral (estilo Ficha v1.7)
// =============================================
import { db, collection, getDocs, doc, updateDoc } from './firebase-config.js';
import * as S from './state.js';
import { showAlert, escapeHtml } from './ui-utils.js';

window._loadMesaNotas = loadMesaNotas;

window.toggleNotasAccordion = function(elId) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
};

async function loadMesaNotas() {
    if (!S.currentMesaId) return;
    const el = document.getElementById('mesaNotasContent'); if (!el) return;
    
    el.innerHTML = '<div style="text-align:center;padding:50px;color:var(--muted)">Carregando notas...</div>';
    
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
            let charNotes = [...(c.notes || [])];
            
            charNotes.sort((a, b) => {
                if (a.pinned && !b.pinned) return -1;
                if (!a.pinned && b.pinned) return 1;
                const idxA = a.sortIndex !== undefined ? a.sortIndex : 9999;
                const idxB = b.sortIndex !== undefined ? b.sortIndex : 9999;
                if (idxA !== idxB) return idxA - idxB;
                return (a.criadoEm > b.criadoEm) ? 1 : -1;
            });
            
            const notesHtml = charNotes.length
                ? charNotes.map((n, index) => {
                    const prev = (n.conteudo || '').replace(/<[^>]*>/g, '').substring(0, 120);
                    return `<div class="mesa-note-card ${n.pinned ? 'pinned' : ''}">
                        <div class="mesa-note-title-row">
                            <span>${n.pinned ? '📌' : '📄'} ${escapeHtml(n.titulo || 'Sem título')}</span>
                            <div class="mesa-note-actions">
                                <button onclick="moveNoteUpMesa('${c.id}','${n.id}');event.stopPropagation()" title="Mover para Cima" ${index === 0 ? 'disabled style="opacity:0.3"' : ''}>🔼</button>
                                <button onclick="moveNoteDownMesa('${c.id}','${n.id}');event.stopPropagation()" title="Mover para Baixo" ${index === charNotes.length - 1 ? 'disabled style="opacity:0.3"' : ''}>🔽</button>
                                <button onclick="togglePinNoteMesa('${c.id}','${n.id}');event.stopPropagation()" title="Fixar/Desfixar">${n.pinned ? '📌' : '📍'}</button>
                                <button onclick="openShareModalMesa('${c.id}','${n.id}');event.stopPropagation()" title="Compartilhar">👥</button>
                                <button onclick="editSingleNote('${c.id}','${n.id}');event.stopPropagation()" title="Editar nota">✏️</button>
                                <button class="mesa-note-del" onclick="deleteSingleNote('${c.id}','${n.id}');event.stopPropagation()" title="Excluir nota">🗑️</button>
                            </div>
                        </div>
                        <div class="mesa-note-preview">${prev || 'Nota vazia...'}</div>
                    </div>`;
                }).join('')
                : '<div style="color:var(--muted);font-size:.82rem;padding:8px 0;text-align:center">Nenhuma nota ainda.</div>';
            const bodyId = `notas_body_${c.id}`;
            return `
            <div class="accordion-item" style="margin-bottom:8px; background:rgba(0,0,0,0.2); border:1px solid var(--border); border-radius:8px;">
                <div class="accordion-header" style="padding:12px 16px; display:flex; justify-content:space-between; align-items:center; cursor:pointer;" onclick="toggleNotasAccordion('${bodyId}')">
                    <div style="font-weight:bold; color:var(--light);">🎭 ${escapeHtml(nome)}</div>
                    <div style="font-size:0.8rem; color:var(--muted);">${charNotes.length} nota(s)</div>
                </div>
                <div class="accordion-body" id="${bodyId}" style="display:none; padding:12px 16px; border-top:1px solid var(--border);">
                    <div style="margin-bottom:12px; display:flex; justify-content:flex-end;">
                        <button class="btn btn-success btn-small" onclick="addNewNote('${c.id}')" title="Adicionar nova nota">➕ Nova Nota</button>
                    </div>
                    <div id="note-display-${c.id}">
                        ${notesHtml}
                    </div>
                </div>
            </div>`;
        }).join('');
    } catch (e) {
        console.error(e);
        showAlert('❌ Erro ao carregar notas', 'danger');
        el.innerHTML = '<div style="text-align:center;padding:50px;color:var(--danger)">Erro ao carregar as notas. Verifique a conexão ou tente novamente.</div>';
    }
}

// Re-render a single character's notes display
function rerenderCharNotes(charId) {
    const chars = S.mesaCharacters || [];
    const c = chars.find(x => x.id === charId);
    if (!c) return;
    const display = document.getElementById(`note-display-${charId}`);
    if (!display) return;
    
    let charNotes = c.notes || [];
    charNotes.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        const idxA = a.sortIndex !== undefined ? a.sortIndex : 9999;
        const idxB = b.sortIndex !== undefined ? b.sortIndex : 9999;
        if (idxA !== idxB) return idxA - idxB;
        return (a.criadoEm > b.criadoEm) ? 1 : -1;
    });
    
    if (!charNotes.length) {
        display.innerHTML = '<div style="color:var(--muted);font-size:.82rem;padding:8px 0;text-align:center">Nenhuma nota ainda.</div>';
        return;
    }
    display.innerHTML = charNotes.map((n, index) => {
        const prev = (n.conteudo || '').replace(/<[^>]*>/g, '').substring(0, 120);
        return `<div class="mesa-note-card ${n.pinned ? 'pinned' : ''}">
            <div class="mesa-note-title-row">
                <span>${n.pinned ? '📌' : '📄'} ${escapeHtml(n.titulo || 'Sem título')}</span>
                <div class="mesa-note-actions">
                    <button onclick="moveNoteUpMesa('${charId}','${n.id}');event.stopPropagation()" title="Mover para Cima" ${index === 0 ? 'disabled style="opacity:0.3"' : ''}>🔼</button>
                    <button onclick="moveNoteDownMesa('${charId}','${n.id}');event.stopPropagation()" title="Mover para Baixo" ${index === charNotes.length - 1 ? 'disabled style="opacity:0.3"' : ''}>🔽</button>
                    <button onclick="togglePinNoteMesa('${charId}','${n.id}');event.stopPropagation()" title="Fixar/Desfixar">${n.pinned ? '📌' : '📍'}</button>
                    <button onclick="openShareModalMesa('${charId}','${n.id}');event.stopPropagation()" title="Compartilhar">👥</button>
                    <button onclick="editSingleNote('${charId}','${n.id}');event.stopPropagation()" title="Editar nota">✏️</button>
                    <button class="mesa-note-del" onclick="deleteSingleNote('${charId}','${n.id}');event.stopPropagation()" title="Excluir nota">🗑️</button>
                </div>
            </div>
            <div class="mesa-note-preview">${prev || 'Nota vazia...'}</div>
        </div>`;
    }).join('');
}

// === AÇÕES DE ORDENAÇÃO E FIXAÇÃO (MESTRE) ===
window.moveNoteUpMesa = async function(charId, noteId) {
    const chars = S.mesaCharacters || [];
    const c = chars.find(x => x.id === charId);
    if (!c || !c.notes) return;
    const idx = c.notes.findIndex(x => x.id === noteId);
    if (idx > 0) {
        const temp = c.notes[idx - 1];
        c.notes[idx - 1] = c.notes[idx];
        c.notes[idx] = temp;
        c.notes.forEach((n, i) => n.sortIndex = i);
        try {
            await updateDoc(doc(db, 'char', charId), { notes: c.notes });
            rerenderCharNotes(charId);
        } catch(e) { showAlert('Erro ao mover nota', 'danger'); }
    }
};

window.moveNoteDownMesa = async function(charId, noteId) {
    const chars = S.mesaCharacters || [];
    const c = chars.find(x => x.id === charId);
    if (!c || !c.notes) return;
    const idx = c.notes.findIndex(x => x.id === noteId);
    if (idx !== -1 && idx < c.notes.length - 1) {
        const temp = c.notes[idx + 1];
        c.notes[idx + 1] = c.notes[idx];
        c.notes[idx] = temp;
        c.notes.forEach((n, i) => n.sortIndex = i);
        try {
            await updateDoc(doc(db, 'char', charId), { notes: c.notes });
            rerenderCharNotes(charId);
        } catch(e) { showAlert('Erro ao mover nota', 'danger'); }
    }
};

window.togglePinNoteMesa = async function(charId, noteId) {
    const chars = S.mesaCharacters || [];
    const c = chars.find(x => x.id === charId);
    if (!c || !c.notes) return;
    const n = c.notes.find(x => x.id === noteId);
    if (n) {
        n.pinned = !n.pinned;
        try {
            await updateDoc(doc(db, 'char', charId), { notes: c.notes });
            rerenderCharNotes(charId);
        } catch(e) { showAlert('Erro ao fixar nota', 'danger'); }
    }
};

// Add a new note to a character
window.addNewNote = function(charId) {
    const chars = S.mesaCharacters || [];
    const c = chars.find(x => x.id === charId);
    if (!c) return;
    const f = c.fields || {};
    const newNote = {
        id: 'note-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        titulo: '',
        conteudo: '',
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
        sortIndex: (c.notes || []).length,
        pinned: false,
        sharedWith: {},
        ownerId: charId,
        ownerName: f.nome || c.nome || 'Desconhecido'
    };
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
            atualizadoEm: new Date().toISOString(),
            sortIndex: notes.length,
            pinned: false,
            sharedWith: {},
            ownerId: charId,
            ownerName: c.fields?.nome || c.nome || 'Desconhecido'
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

// === COMPARTILHAMENTO DE NOTAS (MESTRE) ===
window.openShareModalMesa = function(charId, noteId) {
    const chars = S.mesaCharacters || [];
    const c = chars.find(x => x.id === charId);
    if (!c || !c.notes) return;
    const n = c.notes.find(x => x.id === noteId);
    if (!n) return;
    
    const m = document.createElement('div');
    m.className = 'modal active';
    m.id = 'shareNoteModalMesa';
    
    const listHtml = chars.filter(x => x.id !== charId).map(otherChar => {
        const currentPerm = (n.sharedWith && n.sharedWith[otherChar.id]) || 'none';
        const nome = (otherChar.fields && otherChar.fields.nome) || otherChar.nome || 'Desconhecido';
        return `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:8px; border-bottom:1px solid var(--border)">
                <span style="font-weight:bold">${escapeHtml(nome)}</span>
                <select class="form-input share-perm-select-mesa" data-charid="${otherChar.id}" style="width:auto; padding:4px 8px; margin-bottom:0;">
                    <option value="none" ${currentPerm === 'none' ? 'selected' : ''}>Nenhum</option>
                    <option value="view" ${currentPerm === 'view' ? 'selected' : ''}>Visualizar</option>
                    <option value="edit" ${currentPerm === 'edit' ? 'selected' : ''}>Editar</option>
                </select>
            </div>
        `;
    }).join('');
    
    m.innerHTML = `<div class="modal-content" style="max-width:500px">
        <div class="modal-header">
            <span class="modal-title">👥 Compartilhar Nota</span>
            <button class="modal-close" onclick="this.closest('.modal').remove()">✕</button>
        </div>
        <div class="modal-body">
            <p style="font-size:12px;color:var(--muted);margin-bottom:15px;">Mestre, defina as permissões de acesso para os outros jogadores da mesa.</p>
            <div id="shareCharsListMesa">
                ${listHtml || '<div style="color:var(--muted)">Nenhum outro jogador na mesa.</div>'}
            </div>
            <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px">
                <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancelar</button>
                <button class="btn btn-success" onclick="saveShareSettingsMesa('${charId}','${noteId}')">💾 Salvar Permissões</button>
            </div>
        </div>
    </div>`;
    document.body.appendChild(m);
};

window.saveShareSettingsMesa = async function(charId, noteId) {
    const chars = S.mesaCharacters || [];
    const c = chars.find(x => x.id === charId);
    if (!c || !c.notes) return;
    const n = c.notes.find(x => x.id === noteId);
    if (!n) return;
    
    if (!n.sharedWith) n.sharedWith = {};
    
    const selects = document.querySelectorAll('.share-perm-select-mesa');
    selects.forEach(sel => {
        const otherId = sel.dataset.charid;
        const val = sel.value;
        if (val === 'none') {
            delete n.sharedWith[otherId];
        } else {
            n.sharedWith[otherId] = val;
        }
    });
    
    try {
        await updateDoc(doc(db, 'char', charId), { notes: c.notes });
        document.getElementById('shareNoteModalMesa')?.remove();
        showAlert('✅ Permissões de compartilhamento salvas!', 'success');
        rerenderCharNotes(charId);
    } catch(e) {
        showAlert('❌ Erro ao salvar permissões.', 'danger');
    }
};
