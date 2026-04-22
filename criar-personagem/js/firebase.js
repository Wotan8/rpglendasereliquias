// ============= FIREBASE MODULE — Wizard de Criação =============
// Gerencia autenticação e carregamento de dados do sistema.
// NÃO gerencia char/{id} — o wizard cria personagens novos.

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, doc, setDoc, collection, getDocs, query, where, getDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

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

    await setDoc(docRef, saveData);
    console.log('✅ Personagem criado no Firebase:', charId);

    // Clean up wizard storage
    if (typeof clearWizardStorage === 'function') clearWizardStorage();

    return charId;
};
