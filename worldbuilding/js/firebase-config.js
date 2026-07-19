// =============================================
// WORLDBUILDING — Firebase Config + Exports
// Lendas e Relíquias
// (mesmo padrão de painel-mestre/js/firebase-config.js)
// =============================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
    getFirestore, collection, query, where, orderBy, limit,
    onSnapshot, doc, getDoc, getDocs, setDoc, deleteDoc,
    addDoc, updateDoc, runTransaction, writeBatch
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

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

// 💾 PERSISTÊNCIA OFFLINE (Firebase v10+): cache local em IndexedDB.
let db;
try {
    db = initializeFirestore(app, {
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
    });
    console.log('💾 Firestore: cache offline (IndexedDB) ativado.');
} catch (e) {
    console.warn('💾 Firestore: cache offline indisponível, usando memória.', e);
    db = getFirestore(app);
}

export {
    app, auth, db,
    onAuthStateChanged, signOut,
    collection, query, where, orderBy, limit, onSnapshot,
    doc, getDoc, getDocs, setDoc, deleteDoc, addDoc, updateDoc,
    runTransaction, writeBatch
};
