// ============= FIREBASE MODULE — Ficha v1.7 =============
// Este script é carregado como type="module" no HTML.
// Gerencia autenticação, loading screen, e save/load do Firestore (coleção 'char').

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
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
    _saving = true;

    showSaveIndicator('💾 Salvando...', 'saving');

    try {
        const data = gatherData();
        data.lastUpdate = new Date().toISOString();
        data.userEmail = window.currentUser.email;
        if (!data.ownerUid) {
            data.ownerUid = window.currentUser.uid;
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

        const docRef = doc(db, 'char', window.currentCharacterId);
        await setDoc(docRef, data, { merge: true });

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

        // Verificar ownership
        try {
            const docRef = doc(db, 'char', charId);
            const snap = await getDoc(docRef);
            if (snap.exists()) {
                const data = snap.data();
                if (data.ownerUid && data.ownerUid !== user.uid) {
                    alert('🚫 ACESSO NEGADO! Esta ficha não pertence a você.');
                    window.location.href = '../personagens.html';
                    return;
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
            window.RACES = buildRacesFromFirebase();
            populateRaceSelect();
            populateClassSelect();

            console.log('✅ RACES construído do Firebase:', Object.keys(window.RACES));
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

        // Esconder loading, mostrar conteúdo
        if (loadingScreen) loadingScreen.style.display = 'none';
        if (mainWrap) mainWrap.style.display = '';
        if (toolbar) toolbar.style.display = '';
    } else {
        // Não logado → redirecionar
        console.log('❌ Não autenticado. Redirecionando...');
        window.location.href = '../index.html';
    }
});
