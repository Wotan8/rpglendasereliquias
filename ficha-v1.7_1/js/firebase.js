// ============= FIREBASE MODULE — Ficha v1.7 =============
// Este script é carregado como type="module" no HTML.
// Gerencia autenticação, loading screen, e save/load do Firestore (coleção 'char').

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, query, where } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getStorage, ref, uploadString, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';

// ===== CONFIG (mesma do projeto rpg-lendasereliquias) =====
const firebaseConfig = {
    apiKey: "AIzaSyA6r79XcsMr3KZUT1YZ8vQntIGspgULXcE",
    authDomain: "rpg-lendasereliquias.firebaseapp.com",
    projectId: "rpg-lendasereliquias",
    storageBucket: "rpg-lendasereliquias.firebasestorage.app",
    messagingSenderId: "546994339773",
    appId: "1:546994339773:web:0116cf7c8667f113075cd4"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

window.db = db;
window.storage = storage;
window.currentUser = null;
window.currentCharacterId = null;
window.isCreator = false;
window.isMestre = false;

// ===== VERIFICAR ROLE DO USUÁRIO =====
/**
 * Verifica a role do usuário no Firestore.
 * Retorna a string da role ('criador', 'mestre') ou null.
 */
async function checkUserRole(user) {
    try {
        const PRIVILEGED_ROLES = ['criador', 'mestre'];
        // Método 1: por UID field
        let q = query(collection(db, 'users'), where('uid', '==', user.uid));
        let snap = await getDocs(q);
        if (!snap.empty) {
            const role = snap.docs[0].data().role;
            if (PRIVILEGED_ROLES.includes(role)) return role;
        }

        // Método 2: por email
        q = query(collection(db, 'users'), where('email', '==', user.email));
        snap = await getDocs(q);
        if (!snap.empty) {
            const role = snap.docs[0].data().role;
            if (PRIVILEGED_ROLES.includes(role)) return role;
        }

        // Método 3: doc ID = UID
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const role = docSnap.data().role;
            if (PRIVILEGED_ROLES.includes(role)) return role;
        }
    } catch (e) { console.warn('Erro ao verificar role:', e); }
    return null;
}

/** Legacy compat wrapper */
async function checkCreatorRole(user) {
    const role = await checkUserRole(user);
    return role === 'criador';
}

function enableCreatorExpEditing() {
    const expEl = document.querySelector('[data-key="exp"]');
    const expTotalEl = document.querySelector('[data-key="exp_total"]');
    [expEl, expTotalEl].forEach(el => {
        if (!el) return;
        el.style.border = '2px solid #f59e0b';
        el.title = '🛡️ Modo Criador: edição livre de EXP';
    });
    console.log('🛡️ Modo Criador: edição livre de EXP habilitada');
}

// ===== INDICADOR DE SAVE =====
function showSaveIndicator(text, type) {
    const ind = document.getElementById('firebaseSaveIndicator');
    if (!ind) return;
    ind.textContent = text;
    ind.className = 'firebase-save-indicator show ' + (type || '');
    clearTimeout(ind._timer);
    ind._timer = setTimeout(() => ind.classList.remove('show'), 2500);
}

// ===== CARREGAR DO FIRESTORE =====
async function loadFromFirebase(charId) {
    try {
        const docRef = doc(db, 'char', charId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            const data = snap.data();
            console.log('✅ Ficha v1.7 carregada do Firebase (char/' + charId + ')');
            // Marcar que Firebase carregou (impede loadFromStorage no initApp)
            window._firebaseLoaded = true;
            // Inicializar UI antes de carregar dados
            window.initApp();
            // Agora carregar dados sobre a UI inicializada
            if (typeof loadFromData === 'function') {
                loadFromData(data);
            }
            if (typeof state !== 'undefined') {
                state.mesaId = data.mesaId;
            }
            if (window.initMesaTab && data.mesaId) {
                window.initMesaTab(data.mesaId);
            }
            // 📜 CharLogger: registrar snapshot inicial (após a UI assentar)
            if (window.CharLogger) {
                setTimeout(() => window.CharLogger.primeFromGather(), 700);
            }
            return true;
        } else {
            console.log('📝 Nenhuma ficha v1.7 encontrada no Firebase. Criando nova...');
            return false;
        }
    } catch (err) {
        console.error('❌ Erro ao carregar do Firebase:', err);
        return false;
    }
}

// ===== SALVAR NO FIRESTORE e STORAGE =====
let _saving = false;
window.saveToFirebase = async function () {
    if (!window.currentUser || !window.currentCharacterId) return;
    if (_saving) return;

    // === GUARD LAYER 2: Nunca salvar se dados não estão prontos ===
    if (!window._dataReady) {
        console.warn('⛔ saveToFirebase BLOQUEADO — _dataReady é false. Dados ainda não carregados.');
        return;
    }

    _saving = true;

    showSaveIndicator('💾 Salvando...', 'saving');

    try {
        const data = gatherData();

        // === VALIDAÇÃO DE SEGURANÇA: impedir save de ficha vazia ===
        const fieldsWithContent = data.fields
            ? Object.values(data.fields).filter(v => v && String(v).trim() !== '').length
            : 0;
        const dotsWithContent = data.dots
            ? Object.values(data.dots).filter(v => v && v > 0).length
            : 0;
        const hasMinimumData = fieldsWithContent >= 1 || dotsWithContent >= 1 || (data.notes && data.notes.length > 0);

        if (!hasMinimumData) {
            console.error('⛔ SAVE BLOQUEADO: gatherData() retornou ficha essencialmente vazia!',
                `Fields com conteúdo: ${fieldsWithContent}, Dots com valor: ${dotsWithContent}`);
            _saving = false;
            return;
        }

        data.lastUpdate = new Date().toISOString();

        // === PRESERVAR OWNERSHIP ORIGINAL ===
        // Ler o documento existente UMA VEZ para:
        // 1) Manter o dono original da ficha (mesmo quando o mestre edita)
        // 2) Reutilizar no read-before-write check abaixo
        const docRef = doc(db, 'char', window.currentCharacterId);
        let existingSnap = null;
        try {
            existingSnap = await getDoc(docRef);
            if (existingSnap.exists()) {
                const existingData = existingSnap.data();
                data.ownerUid = existingData.ownerUid || window.currentUser.uid;
                data.ownerEmail = existingData.ownerEmail || window.currentUser.email;
                data.userEmail = existingData.ownerEmail || existingData.userEmail || window.currentUser.email;
            } else {
                // Ficha nova — o usuário atual é o dono
                data.ownerUid = window.currentUser.uid;
                data.ownerEmail = window.currentUser.email;
                data.userEmail = window.currentUser.email;
            }
        } catch (ownerErr) {
            console.warn('⚠️ Erro ao preservar ownership, usando usuário atual:', ownerErr);
            if (!data.ownerUid) {
                data.ownerUid = window.currentUser.uid;
            }
            data.userEmail = window.currentUser.email;
        }

        // --- LÓGICA DE UPLOAD DE IMAGEM ---
        // Se a imagem for Base64 (novo upload), enviar pro Storage
        if (data.charImg && data.charImg.startsWith('data:image')) {
            console.log(`📤 Detectada imagem nova (Tamanho: ${data.charImg.length} bytes). Iniciando upload para Storage...`);

            try {
                const storageRef = ref(storage, `char-images/${window.currentUser.uid}/${window.currentCharacterId}.jpg`);

                // Upload da string base64
                await uploadString(storageRef, data.charImg, 'data_url');

                // Obter URL pública
                const downloadURL = await getDownloadURL(storageRef);
                console.log('✅ Imagem enviada com sucesso. URL:', downloadURL);

                // Atualizar o objeto data e o state global com a URL
                data.charImg = downloadURL;
                if (window.state) window.state.charImg = downloadURL;

                // Atualizar a visualização imediatamente
                const img = document.getElementById('charImgPreview');
                if (img) img.src = downloadURL;

            } catch (uploadErr) {
                console.error("❌ Falha no upload da imagem:", uploadErr);
                alert("Falha ao enviar imagem. Tente uma imagem menor ou verifique sua conexão.");
                // Se falhar o upload, NÃO salvar a string gigante no Firestore
                throw new Error("Upload de imagem falhou. Abortando salvamento para evitar sobrecarga.");
            }
        }

        // GUARD: Verificação final de tamanho antes de enviar ao Firestore
        const payloadSize = JSON.stringify(data).length;
        if (payloadSize > 800000) { // Limite de ~800KB (Firestore aceita até 1MB, margem de segurança)
            console.error(`❌ OCORREU UM ERRO: O tamanho dos dados (${payloadSize} bytes) excede o limite de segurança.`);

            // Tentar identificar o culpado
            if (data.charImg && data.charImg.length > 100000) {
                console.error("⚠️ Culpado provável: charImg ainda é gigante (" + data.charImg.length + " bytes).");
                alert("Erro: A imagem não foi processada corretamente. Tente recarregar a página.");
                throw new Error("Dados muito grandes. Abortando.");
            }

            alert("Não foi possível salvar: Muitos dados na ficha. Reduza o conteúdo ou remova a imagem.");
            throw new Error("Payload size too large: " + payloadSize);
        }

        // === READ-BEFORE-WRITE: proteger contra sobrescrita com dados vazios ===
        // Reutiliza o snapshot já lido acima para evitar leitura duplicada
        try {
            if (existingSnap && existingSnap.exists()) {
                const existingData = existingSnap.data();
                const existingFields = existingData.fields
                    ? Object.values(existingData.fields).filter(v => v && String(v).trim() !== '').length
                    : 0;
                if (existingFields >= 5 && fieldsWithContent < 3) {
                    console.error('⛔ SAVE BLOQUEADO (read-before-write): Firebase tem', existingFields,
                        'campos preenchidos, mas dados novos têm apenas', fieldsWithContent);
                    showSaveIndicator('⛔ Save bloqueado — dados insuficientes', 'error');
                    _saving = false;
                    return;
                }
            }
        } catch (rbwErr) {
            console.warn('⚠️ Read-before-write check falhou (continuando save):', rbwErr);
        }

        await setDoc(docRef, data, { merge: true });

        // 📜 CharLogger: registrar TODAS as alterações desta gravação (diff vs snapshot)
        if (window.CharLogger) {
            try { window.CharLogger.afterSave(data); } catch (logErr) { console.warn('CharLogger:', logErr); }
        }

        showSaveIndicator('✅ Salvo na nuvem!', 'saved');
        console.log('✅ Ficha v1.7 salva no Firebase (Tamanho payload: ' + payloadSize + ' bytes)');
    } catch (err) {
        console.error('❌ Erro ao salvar no Firebase:', err);
        showSaveIndicator('❌ Erro ao salvar!', 'error');
        _saving = false; // Garantir que libera o lock
    } finally {
        _saving = false;
    }
};

// ===== NOTAS COMPARTILHADAS =====
window.loadSharedNotes = async function() {
    if (!window.currentCharacterId || typeof state === 'undefined' || !state.mesaId) return;
    try {
        const mesaId = state.mesaId;
        const q = query(collection(db, 'char'), where('mesaId', '==', mesaId));
        const snap = await getDocs(q);
        const sharedNotes = [];
        snap.forEach(d => {
            if (d.id === window.currentCharacterId) return;
            const data = d.data();
            if (data.notes && Array.isArray(data.notes)) {
                data.notes.forEach(n => {
                    if (n.sharedWith && n.sharedWith[window.currentCharacterId]) {
                        sharedNotes.push(n);
                    }
                });
            }
        });
        state.sharedNotes = sharedNotes;
        if (typeof renderNotes === 'function') renderNotes();
    } catch (e) {
        console.error('Erro ao carregar notas compartilhadas:', e);
    }
};

window.updateSharedNoteInFirebase = async function(ownerId, noteData) {
    if (!ownerId) return;
    try {
        const docRef = doc(db, 'char', ownerId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            const data = snap.data();
            const notes = data.notes || [];
            const idx = notes.findIndex(n => n.id === noteData.id);
            if (idx !== -1) {
                notes[idx] = noteData;
                await setDoc(docRef, { notes }, { merge: true });
                console.log('✅ Nota compartilhada atualizada no documento do dono.');
            }
        }
    } catch (e) {
        console.error('Erro ao atualizar nota compartilhada:', e);
        throw e;
    }
};

// ===== LOGOUT =====
window.logout = async function () {
    if (confirm('🚪 Tem certeza que deseja sair?')) {
        try {
            await signOut(auth);
            window.location.href = '../index.html';
        } catch (err) {
            console.error('Erro ao fazer logout:', err);
        }
    }
};

// ===== SINCRONIZAR SESSÕES COM A MESA VINCULADA =====
/**
 * Busca o mesaId do personagem e, se vinculado a uma mesa,
 * consulta a coleção 'session-logs' para encontrar o maior Nº de Sessão
 * e atualizar o campo 'Sessões' na aba Principal.
 */
async function syncSessionCount(charId) {
    try {
        const charRef = doc(db, 'char', charId);
        const charSnap = await getDoc(charRef);
        if (!charSnap.exists()) return;

        const charData = charSnap.data();
        const mesaId = charData.mesaId;
        if (!mesaId) {
            console.log('📅 Personagem sem mesa vinculada — sessões não sincronizadas.');
            return;
        }

        // Buscar todos os session-logs da mesa
        const logsSnap = await getDocs(collection(db, 'session-logs'));
        let maxSession = 0;
        logsSnap.forEach(d => {
            const data = d.data();
            if (data.mesaId === mesaId) {
                const num = data.sessionNumber || 0;
                if (num > maxSession) maxSession = num;
            }
        });

        // Atualizar o campo sessões na ficha
        const sessoesEl = document.querySelector('[data-key="sessoes"]');
        if (sessoesEl && maxSession > 0) {
            const currentVal = parseInt(sessoesEl.value || '0', 10) || 0;
            if (maxSession !== currentVal) {
                sessoesEl.value = maxSession;
                // Disparar evento 'change' para que o listener de EXP por sessão detecte a mudança
                sessoesEl.dispatchEvent(new Event('change', { bubbles: true }));
                console.log(`📅 Sessões sincronizadas com a mesa: ${currentVal} → ${maxSession}`);
            } else {
                console.log(`📅 Sessões já sincronizadas: ${maxSession}`);
            }
        }
    } catch (err) {
        console.warn('⚠️ Erro ao sincronizar sessões:', err);
    }
}

// ===== AUTH STATE =====
onAuthStateChanged(auth, async (user) => {
    const loadingScreen = document.getElementById('loadingScreen');
    const mainWrap = document.querySelector('.wrap');
    const toolbar = document.querySelector('.toolbar');
    const userInfo = document.getElementById('userInfo');

    if (user) {
        window.currentUser = user;
        console.log('✅ Usuário logado:', user.email);

        // Determinar ID do personagem
        const urlParams = new URLSearchParams(window.location.search);
        let charId = urlParams.get('id');
        if (!charId) {
            // New character — generate unique ID
            charId = crypto.randomUUID
                ? crypto.randomUUID()
                : 'char_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            // Update URL so refresh keeps this character
            const newUrl = new URL(window.location);
            newUrl.searchParams.set('id', charId);
            history.replaceState(null, '', newUrl);
        }
        window.currentCharacterId = charId;

        // Verificar ownership (permitir acesso ao dono OU ao mestre da mesa vinculada)
        try {
            const docRef = doc(db, 'char', charId);
            const snap = await getDoc(docRef);
            if (snap.exists()) {
                const data = snap.data();
                if (data.ownerUid && data.ownerUid !== user.uid) {
                    // Não é o dono — verificar se é o mestre da mesa vinculada
                    let isMestreOfMesa = false;
                    if (data.mesaId) {
                        try {
                            const userRole = await checkUserRole(user);
                            if (userRole === 'mestre' || userRole === 'criador') {
                                const mesaRef = doc(db, 'mesas', data.mesaId);
                                const mesaSnap = await getDoc(mesaRef);
                                if (mesaSnap.exists() && mesaSnap.data().createdBy === user.email) {
                                    isMestreOfMesa = true;
                                    console.log('✅ Acesso concedido: Mestre da mesa vinculada ao personagem.');
                                }
                            }
                        } catch (mesaErr) {
                            console.warn('⚠️ Erro ao verificar mesa:', mesaErr);
                        }
                    }
                    if (!isMestreOfMesa) {
                        alert('🚫 ACESSO NEGADO! Esta ficha não pertence a você.');
                        window.location.href = '../menu/menu.html';
                        return;
                    }
                }
            }
        } catch (err) {
            console.error('Erro ao verificar ownership:', err);
        }

        // Mostrar nome do usuário
        const nameEl = document.getElementById('userDisplayName');
        if (nameEl) {
            nameEl.textContent = user.displayName || user.email;
            nameEl.title = user.email;
        }
        if (userInfo) userInfo.style.display = 'flex';

        // === CARREGAR DADOS DO SISTEMA (system/data/*) ===
        const loadingText = loadingScreen?.querySelector('span');
        if (loadingText) loadingText.textContent = '🔧 Carregando regras do sistema...';

        try {
            await loadSystemData(db, collection, getDocs);

            // Construir dados dinâmicos
            buildSkillsFromFirebase();
            if (typeof populateTargetMapFromSkills === 'function') populateTargetMapFromSkills();
            window.RACES = buildRacesFromFirebase();
            buildDerivedValuesFromFirebase();
            if (typeof populateTargetMapFromDerivedValues === 'function') populateTargetMapFromDerivedValues();
            buildVitalStatsFromFirebase();
            if (typeof populateTargetMapFromVitalStats === 'function') populateTargetMapFromVitalStats();
            if (typeof populateTargetMapFromBodyParts === 'function') populateTargetMapFromBodyParts();
            if (typeof populateDistribuirPools === 'function') populateDistribuirPools();
            populateRaceSelect();
            populateClassSelect();
            buildTribesFromFirebase();
            if (typeof populateTribesSelect === 'function') populateTribesSelect();

            console.log('✅ RACES construído do Firebase:', Object.keys(window.RACES));
            console.log('✅ TRIBES construído do Firebase:', Object.keys(window.TRIBES || {}));
            console.log('✅ CLASS_PECULIARITIES construído do Firebase:', Object.keys(window.CLASS_PECULIARITIES || {}));

            // Build auras
            if (typeof buildAurasFromFirebase === 'function') buildAurasFromFirebase();
            
            window._systemDataLoaded = true;
            document.dispatchEvent(new CustomEvent('systemDataReady'));
        } catch (err) {
            console.error('❌ Falha ao carregar dados do sistema:', err);
            if (loadingText) {
                loadingText.innerHTML = '❌ Erro ao carregar regras do sistema.<br><small style="color:#94a3b8">Verifique sua conexão e recarregue a página.</small>';
            }
            return; // Não prosseguir sem dados do sistema
        }

        // === CARREGAR DADOS DO PERSONAGEM ===
        if (loadingText) loadingText.textContent = '🔧 Carregando ficha...';

        const loaded = await loadFromFirebase(charId);

        // Se não carregou do Firebase, inicializar normalmente (com localStorage)
        if (!loaded) {
            window.initApp();
        }

        // === SINCRONIZAR SESSÕES COM A MESA VINCULADA ===
        syncSessionCount(charId);
        
        // === CARREGAR NOTAS COMPARTILHADAS ===
        if (typeof window.loadSharedNotes === 'function') {
            await window.loadSharedNotes();
        }

        // === CARREGAR INVENTÁRIO DO PERSONAGEM ===
        try {
            if (typeof loadInventoryCatalog === 'function') await loadInventoryCatalog();
            if (typeof loadCharacterItems === 'function') await loadCharacterItems(charId);
        } catch (invErr) {
            console.warn('⚠️ Erro ao carregar inventário:', invErr);
        }

        // Esconder loading, mostrar conteúdo
        if (loadingScreen) loadingScreen.style.display = 'none';
        if (mainWrap) mainWrap.style.display = '';
        if (toolbar) toolbar.style.display = '';

        // Verificar se é criador (após tudo carregado)
        try {
            const userRole = await checkUserRole(user);
            window.isCreator = (userRole === 'criador');
            window.isMestre = (userRole === 'criador' || userRole === 'mestre');
            if (window.isCreator) {
                enableCreatorExpEditing();
                // Re-render derived values grid para liberar edição de campos
                if (typeof renderDerivedValuesGrid === 'function') renderDerivedValuesGrid();
                if (typeof recalcAll === 'function') recalcAll();
            }
            // Bloquear selects para usuários sem privilégio
            if (typeof lockSelectsIfNeeded === 'function') lockSelectsIfNeeded();
        } catch (e) { /* ignore */ }
    } else {
        // Não logado → redirecionar
        console.log('❌ Não autenticado. Redirecionando...');
        window.location.href = '../index.html';
    }
});
