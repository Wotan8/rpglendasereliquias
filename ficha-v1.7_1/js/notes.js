/* ===== NOTAS E IMAGEM DO PERSONAGEM ===== */

if (typeof state !== 'undefined') {
    state.sharedNotes = state.sharedNotes || [];
}

function renderNotes() {
    const c = document.getElementById('notesContainer');
    const allNotes = [...(state.notes || []), ...(state.sharedNotes || [])];
    
    if (!allNotes.length) {
        c.innerHTML = '<p style="font-size:12px;color:var(--muted);text-align:center;padding:20px 0;">Nenhuma nota ainda.</p>';
        return;
    }
    
    // Sort logic: pinned first, then by sortIndex (or order of creation)
    allNotes.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        const idxA = a.sortIndex !== undefined ? a.sortIndex : 9999;
        const idxB = b.sortIndex !== undefined ? b.sortIndex : 9999;
        if (idxA !== idxB) return idxA - idxB;
        return (a.criadoEm > b.criadoEm) ? 1 : -1;
    });

    c.innerHTML = '';
    
    allNotes.forEach((n, index) => {
        const isOwner = (state.notes || []).some(x => x.id === n.id);
        const card = document.createElement('div');
        card.className = 'note-card' + (n.pinned ? ' pinned' : '') + (!isOwner ? ' shared' : '');
        const prev = (n.conteudo || '').replace(/<[^>]*>/g, '').substring(0, 100);
        
        let actionsHtml = '';
        if (isOwner) {
            // Owner actions
            actionsHtml = `
                <button onclick="moveNoteUp('${n.id}');event.stopPropagation()" title="Mover para Cima" ${index === 0 ? 'disabled style="opacity:0.3"' : ''}>🔼</button>
                <button onclick="moveNoteDown('${n.id}');event.stopPropagation()" title="Mover para Baixo" ${index === allNotes.length - 1 ? 'disabled style="opacity:0.3"' : ''}>🔽</button>
                <button onclick="togglePinNote('${n.id}');event.stopPropagation()" title="${n.pinned ? 'Desfixar' : 'Fixar no Topo'}">${n.pinned ? '📌' : '📍'}</button>
                <button onclick="openShareModal('${n.id}');event.stopPropagation()" title="Compartilhar">👥</button>
                <button onclick="editNote('${n.id}');event.stopPropagation()" title="Editar">✏️</button>
                <button class="del-note" onclick="deleteNote('${n.id}');event.stopPropagation()" title="Excluir">🗑️</button>
            `;
        } else {
            // Shared note actions
            const myPermission = n.sharedWith && n.sharedWith[window.currentCharacterId];
            const canEdit = myPermission === 'edit';
            
            actionsHtml = `
                <span style="font-size:10px; color:var(--primary); margin-right:5px; background:rgba(var(--primary-rgb), 0.1); padding:2px 4px; border-radius:4px;">De: ${n.ownerName || 'Aliado'}</span>
                ${canEdit ? `<button onclick="editNote('${n.id}');event.stopPropagation()" title="Editar">✏️</button>` : `<button onclick="editNote('${n.id}');event.stopPropagation()" title="Visualizar">👁️</button>`}
            `;
        }

        card.innerHTML = `
            <div class="note-title-row">
                <span>${n.pinned ? '📌 ' : '📄 '} ${n.titulo || 'Sem título'}</span>
                <div class="note-actions">${actionsHtml}</div>
            </div>
            <div class="note-preview">${prev || 'Nota vazia...'}</div>
        `;
        card.addEventListener('click', () => editNote(n.id));
        c.appendChild(card);
    });
}

function createNote() {
    const n = {
        id: 'note-' + Date.now(),
        titulo: '',
        conteudo: '',
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
        sortIndex: (state.notes || []).length,
        pinned: false,
        sharedWith: {},
        ownerId: window.currentCharacterId,
        ownerName: (state.fields && state.fields.nome) ? state.fields.nome : 'Desconhecido'
    };
    if (!state.notes) state.notes = [];
    state.notes.push(n);
    editNote(n.id);
    scheduleAutosave();
}

function editNote(id) {
    let isShared = false;
    let n = (state.notes || []).find(x => x.id === id);
    if (!n) {
        n = (state.sharedNotes || []).find(x => x.id === id);
        if (n) isShared = true;
    }
    if (!n) return;
    
    editingNoteId = id;
    window.editingNoteIsShared = isShared;
    
    const isOwner = !isShared;
    const myPermission = isOwner ? 'edit' : (n.sharedWith && n.sharedWith[window.currentCharacterId]);
    const canEdit = isOwner || myPermission === 'edit';
    
    document.getElementById('noteEditorTitle').value = n.titulo;
    document.getElementById('noteEditorBody').innerHTML = n.conteudo;
    
    const titleInput = document.getElementById('noteEditorTitle');
    const bodyInput = document.getElementById('noteEditorBody');
    const toolbar = document.querySelector('.note-editor-toolbar');
    const saveBtn = document.getElementById('noteSaveBtn');
    
    if (!canEdit) {
        titleInput.readOnly = true;
        bodyInput.contentEditable = "false";
        bodyInput.style.background = "rgba(0,0,0,0.2)";
        if(toolbar) toolbar.style.display = 'none';
        if(saveBtn) saveBtn.style.display = 'none';
    } else {
        titleInput.readOnly = false;
        bodyInput.contentEditable = "true";
        bodyInput.style.background = "";
        if(toolbar) toolbar.style.display = '';
        if(saveBtn) saveBtn.style.display = '';
    }

    document.getElementById('noteModal').classList.remove('hidden');
}

async function saveNote() {
    if (!editingNoteId) return;
    
    let n = (state.notes || []).find(x => x.id === editingNoteId);
    let isShared = false;
    if (!n) {
        n = (state.sharedNotes || []).find(x => x.id === editingNoteId);
        isShared = true;
    }
    if (!n) return;

    n.titulo = document.getElementById('noteEditorTitle').value;
    n.conteudo = document.getElementById('noteEditorBody').innerHTML;
    n.atualizadoEm = new Date().toISOString();
    
    if (isShared) {
        const myPermission = n.sharedWith && n.sharedWith[window.currentCharacterId];
        const canEdit = myPermission === 'edit';
        if (!canEdit) {
            alert('Você não tem permissão para editar esta nota.');
            return;
        }
        
        try {
            if (window.updateSharedNoteInFirebase) {
                await window.updateSharedNoteInFirebase(n.ownerId, n);
            } else {
                alert('Função de salvar nota compartilhada não implementada no Firebase.');
            }
        } catch (e) {
            console.error(e);
            alert('Erro ao salvar nota compartilhada.');
        }
    } else {
        scheduleAutosave();
    }
    
    closeNoteEditor();
    renderNotes();
}

function deleteNote(id) {
    if (!confirm('Excluir esta nota?')) return;
    state.notes = (state.notes || []).filter(x => x.id !== id);
    renderNotes();
    scheduleAutosave();
}

function closeNoteEditor() {
    document.getElementById('noteModal').classList.add('hidden');
    editingNoteId = null;
    window.editingNoteIsShared = false;
}

function execCmd(cmd) {
    document.execCommand(cmd, false, null);
    document.getElementById('noteEditorBody').focus();
}

function initCharImg() {
    document.getElementById('charImgInput').addEventListener('change', function (e) {
        const f = e.target.files[0];
        if (!f) return;
        const r = new FileReader();
        r.onload = function (ev) {
            state.charImg = ev.target.result;
            const img = document.getElementById('charImgPreview');
            img.src = state.charImg;
            img.style.display = 'block';
            document.getElementById('charImgPlaceholder').style.display = 'none';
            scheduleAutosave();
        };
        r.readAsDataURL(f);
    });
}

// === ORDENAÇÃO E FIXAÇÃO ===
function moveNoteUp(id) {
    const idx = (state.notes || []).findIndex(x => x.id === id);
    if (idx > 0) {
        const temp = state.notes[idx - 1];
        state.notes[idx - 1] = state.notes[idx];
        state.notes[idx] = temp;
        state.notes.forEach((n, i) => n.sortIndex = i);
        renderNotes();
        scheduleAutosave();
    }
}

function moveNoteDown(id) {
    const idx = (state.notes || []).findIndex(x => x.id === id);
    if (idx !== -1 && idx < (state.notes || []).length - 1) {
        const temp = state.notes[idx + 1];
        state.notes[idx + 1] = state.notes[idx];
        state.notes[idx] = temp;
        state.notes.forEach((n, i) => n.sortIndex = i);
        renderNotes();
        scheduleAutosave();
    }
}

function togglePinNote(id) {
    const n = (state.notes || []).find(x => x.id === id);
    if (n) {
        n.pinned = !n.pinned;
        renderNotes();
        scheduleAutosave();
    }
}

// === COMPARTILHAMENTO ===
window.openShareModal = async function(noteId) {
    const n = (state.notes || []).find(x => x.id === noteId);
    if (!n) return;
    
    const m = document.createElement('div');
    m.className = 'note-editor-modal';
    m.id = 'shareNoteModal';
    
    let charsHtml = '<div style="text-align:center;padding:20px;color:var(--muted)">Carregando membros da mesa...</div>';
    
    m.innerHTML = `<div class="note-editor" style="max-width:500px">
        <div class="note-editor-header">
            <span style="font-weight:bold;font-size:16px;">👥 Compartilhar Nota</span>
            <button onclick="this.closest('.note-editor-modal').remove()" style="background:none;border:none;color:white;cursor:pointer;font-size:18px;">✕</button>
        </div>
        <div style="padding:15px;">
            <p style="font-size:12px;color:var(--muted);margin-bottom:15px;">Selecione quem pode visualizar ou editar esta nota.</p>
            <div id="shareCharsList">${charsHtml}</div>
            <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px">
                <button class="btn btn-secondary" onclick="this.closest('.note-editor-modal').remove()" style="padding:6px 12px;font-size:12px;">Cancelar</button>
                <button class="btn btn-success" onclick="saveShareSettings('${noteId}')" style="padding:6px 12px;font-size:12px;">💾 Salvar Permissões</button>
            </div>
        </div>
    </div>`;
    document.body.appendChild(m);
    
    try {
        if (!state.mesaId) {
            document.getElementById('shareCharsList').innerHTML = '<div style="color:var(--danger)">Personagem não vinculado a nenhuma mesa.</div>';
            return;
        }
        
        const { getFirestore, collection, getDocs, query, where } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const db = getFirestore();
        const snap = await getDocs(query(collection(db, 'char'), where('mesaId', '==', state.mesaId)));
        const chars = [];
        snap.forEach(doc => {
            const data = doc.data();
            if (doc.id !== window.currentCharacterId) {
                chars.push({ id: doc.id, nome: (data.fields && data.fields.nome) || 'Sem Nome' });
            }
        });
        
        if (chars.length === 0) {
            document.getElementById('shareCharsList').innerHTML = '<div style="color:var(--muted)">Nenhum outro jogador encontrado nesta mesa.</div>';
            return;
        }
        
        const listHtml = chars.map(c => {
            const currentPerm = (n.sharedWith && n.sharedWith[c.id]) || 'none';
            return `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:8px; border-bottom:1px solid var(--border)">
                    <span style="font-weight:bold">${c.nome}</span>
                    <select class="form-input share-perm-select" data-charid="${c.id}" style="width:auto; padding:4px 8px; margin-bottom:0;">
                        <option value="none" ${currentPerm === 'none' ? 'selected' : ''}>Nenhum</option>
                        <option value="view" ${currentPerm === 'view' ? 'selected' : ''}>Visualizar</option>
                        <option value="edit" ${currentPerm === 'edit' ? 'selected' : ''}>Editar</option>
                    </select>
                </div>
            `;
        }).join('');
        
        document.getElementById('shareCharsList').innerHTML = listHtml;
    } catch (e) {
        console.error(e);
        document.getElementById('shareCharsList').innerHTML = '<div style="color:var(--danger)">Erro ao carregar membros.</div>';
    }
};

window.saveShareSettings = function(noteId) {
    const n = (state.notes || []).find(x => x.id === noteId);
    if (!n) return;
    
    if (!n.sharedWith) n.sharedWith = {};
    
    const selects = document.querySelectorAll('.share-perm-select');
    selects.forEach(sel => {
        const charId = sel.dataset.charid;
        const val = sel.value;
        if (val === 'none') {
            delete n.sharedWith[charId];
        } else {
            n.sharedWith[charId] = val;
        }
    });
    
    document.getElementById('shareNoteModal')?.remove();
    scheduleAutosave();
    alert('✅ Permissões de compartilhamento salvas!');
};
