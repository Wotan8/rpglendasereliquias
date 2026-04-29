// =============================================
// PAINEL DO MESTRE — Firebase Config + Exports
// Lendas e Relíquias
// =============================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
    getFirestore, collection, query, where, orderBy, limit,
    onSnapshot, doc, getDoc, getDocs, setDoc, deleteDoc,
    addDoc, updateDoc
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

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

// ===== RE-EXPORT =====
export {
    app, auth, db,
    onAuthStateChanged, signOut,
    collection, query, where, orderBy, limit,
    onSnapshot, doc, getDoc, getDocs, setDoc,
    deleteDoc, addDoc, updateDoc
};
