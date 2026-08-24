// =============================================
// PAINEL DO MESTRE — Auth + Initialization
// =============================================

import { auth, db, onAuthStateChanged, signOut, collection, query, where, getDocs, getDoc, doc } from './firebase-config.js';
import { setCurrentUser } from './state.js';
import { showAlert } from './ui-utils.js';
import { confirmar } from '../../shared/dialogo.js?v=1';

// ===== FIND USER DOC =====
async function findUserDoc(user) {
    if (!user) return null;

    // Try by uid first
    let q = query(collection(db, 'users'), where('uid', '==', user.uid));
    let snap = await getDocs(q);
    if (!snap.empty) return snap.docs[0];

    // Try by email
    q = query(collection(db, 'users'), where('email', '==', user.email));
    snap = await getDocs(q);
    if (!snap.empty) return snap.docs[0];

    // Try by doc id
    try {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) return docSnap;
    } catch (e) { /* ignore */ }

    return null;
}

// ===== AUTH STATE LISTENER =====
export function initAuth(onReady) {
    onAuthStateChanged(auth, async (user) => {
        const loadingScreen = document.getElementById('loadingScreen');
        const toolbar = document.querySelector('.toolbar');
        const wrap = document.querySelector('.wrap');

        if (!user) {
            window.location.href = '../index.html';
            return;
        }

        setCurrentUser(user);

        // Check role — must be "mestre" or "criador"
        const userDoc = await findUserDoc(user);
        if (!userDoc) {
            window.location.href = '../menu/menu.html';
            return;
        }

        const role = userDoc.data().role;
        if (role !== 'mestre' && role !== 'criador') {
            window.location.href = '../menu/menu.html';
            return;
        }
        /* Quem é criador publica direto no catálogo; quem é só mestre grava
           rascunho (ver firestore.rules e _publicarNoCatalogo). */
        window._papelUsuario = role;

        // Display user info
        const nameEl = document.getElementById('userDisplayName');
        if (nameEl) {
            nameEl.textContent = user.displayName || user.email;
            nameEl.title = user.email;
        }

        const userInfoEl = document.querySelector('.user-info');
        if (userInfoEl) userInfoEl.style.display = 'flex';

        // Call the ready callback
        if (onReady) await onReady(user);

        // Hide loading, show UI
        if (loadingScreen) loadingScreen.style.display = 'none';
        if (toolbar) toolbar.style.display = '';
        if (wrap) wrap.style.display = '';
    });
}

// ===== NAVIGATION =====
window.goToMenu = () => { window.location.href = '../menu/menu.html'; };
window.goToWorldbuilding = () => { window.location.href = '../worldbuilding/worldbuilding.html'; };
window.goToHexmap = () => { window.location.href = '../hexmap.html'; };

window.logout = async function () {
    if (await confirmar('🚪 Tem certeza que deseja sair?')) {
        try {
            try { localStorage.removeItem('pm-mesa-lembrada'); } catch (e) { /* ver MESA_LEMBRADA em area-mesas.js */ }
            await signOut(auth);
            window.location.href = '../index.html';
        } catch (e) {
            showAlert('❌ Erro ao sair: ' + e.message, 'danger');
        }
    }
};
