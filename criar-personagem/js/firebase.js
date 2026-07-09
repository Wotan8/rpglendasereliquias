// ============= FIREBASE MODULE — Wizard de Criação =============
// Gerencia autenticação e carregamento de dados do sistema.
// NÃO gerencia char/{id} — o wizard cria personagens novos.

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, doc, setDoc, collection, getDocs, query, where, getDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getStorage, ref, uploadString, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';

// ===== CONFIG =====
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
window.currentUser = null;

// ===== AUTH STATE =====
onAuthStateChanged(auth, async (user) => {
    if (user) {
        window.currentUser = user;
        console.log('✅ Usuário autenticado:', user.email);

        // Show user info
        const nameEl = document.getElementById('userDisplayName');
        if (nameEl) {
            nameEl.textContent = user.displayName || user.email;
            nameEl.title = user.email;
        }

        // Load system data, then initialize wizard
        try {
            if (typeof window.loadSystemData === 'function') {
                await window.loadSystemData();
            }
        } catch (e) {
            console.error('❌ Erro ao carregar dados do sistema:', e);
        }

        // Check for mesaId in URL params → load mesa config before wizard init
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const mesaId = urlParams.get('mesaId');
            if (mesaId) {
                console.log('🎲 Mesa vinculada detectada:', mesaId);
                const mesaRef = doc(db, 'mesas', mesaId);
                const mesaSnap = await getDoc(mesaRef);
                if (mesaSnap.exists()) {
                    const mesaData = mesaSnap.data();
                    const cfg = mesaData.config || {};
                    window.wizardState.mesaVinculada = {
                        id: mesaId,
                        nome: mesaData.nome || 'Mesa',
                        mestreNome: mesaData.createdBy || 'Mestre',
                        expInicial: cfg.expInicial ?? 100,
                        introducao: cfg.textoIntroducao || '',
                        mecanicasObjetoPessoal: cfg.mecanicasObjetoPessoal || []
                    };
                    // Pre-set EXP from mesa config
                    window.wizardState.expInicial = cfg.expInicial ?? 100;
                    // Register EXP source (will be picked up by ExpTracker on init)
                    if (typeof ExpTracker !== 'undefined' && ExpTracker.addSource) {
                        ExpTracker.addSource('exp_inicial', cfg.expInicial ?? 100, 'EXP Inicial (Mesa)');
                    }
                    console.log('✅ Config da mesa carregada:', window.wizardState.mesaVinculada);
                } else {
                    console.warn('⚠️ Mesa não encontrada:', mesaId);
                }
            }
        } catch (e) {
            console.error('⚠️ Erro ao carregar mesa vinculada:', e);
        }

        // Initialize wizard
        if (typeof window.initWizard === 'function') {
            window.initWizard();
        }
    } else {
        // Not authenticated → redirect to login
        window.location.href = '../index.html';
    }
});

// ===== LOGOUT =====
window.logout = async function () {
    if (confirm('🚪 Tem certeza que deseja sair? Seu progresso será salvo.')) {
        try {
            await signOut(auth);
            window.location.href = '../index.html';
        } catch (e) {
            console.error('Erro ao fazer logout:', e);
        }
    }
};

// ===== CRIAR PERSONAGEM NO FIREBASE =====
/**
 * Cria um novo documento char/{id} no Firestore com os dados do wizard.
 * @param {object} charData - Dados completos do personagem (formato gatherData da ficha v1.7)
 * @returns {string} ID do personagem criado
 */
window.createCharacterInFirebase = async function (charData) {
    if (!window.currentUser) throw new Error('Usuário não autenticado');

    const charId = 'char_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    const docRef = doc(db, 'char', charId);

    const saveData = {
        ...charData,
        ownerUid: window.currentUser.uid,
        ownerEmail: window.currentUser.email,
        createdAt: new Date().toISOString(),
        lastUpdate: new Date().toISOString(),
        createdVia: 'wizard-v1'
    };

    // Upload charImg to Firebase Storage if it's a base64 string (too large for Firestore)
    if (saveData.charImg && saveData.charImg.startsWith('data:image')) {
        console.log(`📤 Imagem detectada (${saveData.charImg.length} bytes). Enviando para Storage...`);
        try {
            const storageRef = ref(storage, `char-images/${window.currentUser.uid}/${charId}.jpg`);
            await uploadString(storageRef, saveData.charImg, 'data_url');
            const downloadURL = await getDownloadURL(storageRef);
            console.log('✅ Imagem enviada com sucesso. URL:', downloadURL);
            saveData.charImg = downloadURL;
        } catch (uploadErr) {
            console.error('❌ Falha no upload da imagem:', uploadErr);
            // Remove the image to prevent Firestore size limit error
            delete saveData.charImg;
            console.warn('⚠️ Imagem removida dos dados para evitar erro de tamanho.');
        }
    }

    await setDoc(docRef, saveData);
    console.log('✅ Personagem criado no Firebase:', charId);

    // Clean up wizard storage
    if (typeof clearWizardStorage === 'function') clearWizardStorage();

    return charId;
};
