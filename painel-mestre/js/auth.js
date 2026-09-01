// =============================================
// PAINEL DO MESTRE — Auth + Initialization
// =============================================

import { auth, db, onAuthStateChanged, signOut, getDoc, doc } from './firebase-config.js';
import { setCurrentUser } from './state.js';
import { showAlert } from './ui-utils.js';
import { confirmar } from '../../shared/dialogo.js?v=2';

// ===== FIND USER DOC =====
// `users/{uid}` e nada mais. A busca antiga pelos campos `uid` e `email` lia
// campos que o dono do documento escreve — e aqui o que se lê é o `role`, que
// decide quem entra neste painel.
async function findUserDoc(user) {
    if (!user) return null;
    try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        return snap.exists() ? snap : null;
    } catch (e) { return null; }
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
            window.location.href = '/';
            return;
        }

        const role = userDoc.data().role;
        if (role !== 'mestre' && role !== 'criador') {
            window.location.href = '/';
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
window.goToMenu = () => { window.location.href = '/'; };
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
