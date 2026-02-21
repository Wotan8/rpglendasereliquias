/* ===== NOTAS E IMAGEM DO PERSONAGEM ===== */

function renderNotes() { const c = document.getElementById('notesContainer'); if (!state.notes.length) { c.innerHTML = '<p style="font-size:12px;color:var(--muted);text-align:center;padding:20px 0;">Nenhuma nota ainda.</p>'; return; } c.innerHTML = ''; state.notes.forEach(n => { const card = document.createElement('div'); card.className = 'note-card'; const prev = n.conteudo.replace(/<[^>]*>/g, '').substring(0, 100); card.innerHTML = `<div class="note-title-row"><span>📄 ${n.titulo || 'Sem título'}</span><div class="note-actions"><button onclick="editNote('${n.id}');event.stopPropagation()">✏️</button><button class="del-note" onclick="deleteNote('${n.id}');event.stopPropagation()">🗑️</button></div></div><div class="note-preview">${prev || 'Nota vazia...'}</div>`; card.addEventListener('click', () => editNote(n.id)); c.appendChild(card); }); }

function createNote() { const n = { id: 'note-' + Date.now(), titulo: '', conteudo: '', criadoEm: new Date().toISOString(), atualizadoEm: new Date().toISOString() }; state.notes.push(n); editNote(n.id); scheduleAutosave(); }

function editNote(id) { const n = state.notes.find(x => x.id === id); if (!n) return; editingNoteId = id; document.getElementById('noteEditorTitle').value = n.titulo; document.getElementById('noteEditorBody').innerHTML = n.conteudo; document.getElementById('noteModal').classList.remove('hidden'); }

function saveNote() { const n = state.notes.find(x => x.id === editingNoteId); if (!n) return; n.titulo = document.getElementById('noteEditorTitle').value; n.conteudo = document.getElementById('noteEditorBody').innerHTML; n.atualizadoEm = new Date().toISOString(); closeNoteEditor(); renderNotes(); scheduleAutosave(); }

function deleteNote(id) { if (!confirm('Excluir esta nota?')) return; state.notes = state.notes.filter(x => x.id !== id); renderNotes(); scheduleAutosave(); }

function closeNoteEditor() { document.getElementById('noteModal').classList.add('hidden'); editingNoteId = null; }

function execCmd(cmd) { document.execCommand(cmd, false, null); document.getElementById('noteEditorBody').focus(); }

function initCharImg() { document.getElementById('charImgInput').addEventListener('change', function (e) { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = function (ev) { state.charImg = ev.target.result; const img = document.getElementById('charImgPreview'); img.src = state.charImg; img.style.display = 'block'; document.getElementById('charImgPlaceholder').style.display = 'none'; scheduleAutosave(); }; r.readAsDataURL(f); }); }
