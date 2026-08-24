// ============= FIREBASE MODULE — Wizard de Criação =============
// Gerencia autenticação e carregamento de dados do sistema.
// NÃO gerencia char/{id} — o wizard cria personagens novos.

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, doc, setDoc, collection, getDocs, query, where, getDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
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
// 💾 PERSISTÊNCIA OFFLINE (Firebase v10+): cache local em IndexedDB.
// Leituras funcionam offline e escritas ficam na fila e sincronizam
// automaticamente quando a conexão voltar. Multi-tab habilitado.
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
                        maxPecVantagens: cfg.maxPecVantagens ?? 3,
                        maxPecDesvantagens: cfg.maxPecDesvantagens ?? 3,
                        introducao: cfg.textoIntroducao || '',
                        mecanicasObjetoPessoal: cfg.mecanicasObjetoPessoal || []
                    };
                    // As fontes de EXP são registradas no initWizard (app.js), depois
                    // do restore do localStorage — registrar aqui seria sobrescrito.

                    // A mesa só guarda o e-mail do mestre (createdBy); o nome de
                    // exibição vive em users/. Sem achar, fica o e-mail mesmo.
                    try {
                        const uSnap = await getDocs(query(collection(db, 'users'), where('email', '==', mesaData.createdBy || '')));
                        const u = uSnap.docs[0]?.data();
                        if (u) window.wizardState.mesaVinculada.mestreNome = u.nome || u.displayName || u.email;
                    } catch (err) {
                        console.warn('⚠️ Erro ao buscar o nome do mestre:', err);
                    }

                    // Recuperar o nível da sessão atual da mesa (maior número de sessão)
                    try {
                        const logsQuery = query(collection(db, 'session-logs'), where('mesaId', '==', mesaId));
                        const logsSnap = await getDocs(logsQuery);
                        let maxSession = 0;
                        logsSnap.forEach(d => {
                            const data = d.data();
                            const num = data.sessionNumber || 0;
                            if (num > maxSession) maxSession = num;
                        });
                        
                        if (maxSession > 0) {
                            window.wizardState.mesaVinculada.sessaoAtual = maxSession;
                        }
                    } catch (err) {
                        console.warn('⚠️ Erro ao recuperar sessões da mesa:', err);
                    }

                    // Nome da mesa no topo — reaproveita o hint da toolbar
                    const hint = document.querySelector('.hint-toolbar');
                    if (hint) {
                        hint.innerHTML = '<span style="color:var(--accent);font-weight:800;letter-spacing:.3px"></span> · Criação de Personagem';
                        hint.firstChild.textContent = '🎭 ' + window.wizardState.mesaVinculada.nome;
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
    if (await LRDialogo.confirmar('Seu progresso fica salvo.',
        { titulo: '🚪 Sair da conta?', ok: 'Sair' })) {
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
 * Retorna o inventário do usuário atual (Itens de Repertório).
 */
window.getUserInventory = async function (uid) {
    if (!uid) return [];
    try {
        const userRef = doc(db, 'users', uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            return userSnap.data().inventario || [];
        }
    } catch (e) {
        console.error('Erro ao carregar inventário:', e);
    }
    return [];
};

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

    // Processar dedução de Itens de Repertório da conta do jogador
    if (charData.itensRepertorioSelecionados && charData.itensRepertorioSelecionados.length > 0) {
        try {
            console.log('🔄 Processando dedução de Itens de Repertório...');
            const userRef = doc(db, 'users', window.currentUser.uid);
            const userSnap = await getDoc(userRef);
            
            if (userSnap.exists()) {
                const userData = userSnap.data();
                let inventarioGeral = userData.inventario || [];
                let hasChanges = false;
                
                // Deduzir os itens selecionados baseados no originalIndex
                // Fazer isso na ordem inversa ou mapear diretamente para evitar erros de índice, 
                // mas como sabemos os índices, precisamos apenas abater a quantidade.
                charData.itensRepertorioSelecionados.forEach(itemUsado => {
                    const idx = itemUsado.originalIndex;
                    if (inventarioGeral[idx]) {
                        inventarioGeral[idx].quantidade -= itemUsado.quantidadeConsumida;
                        hasChanges = true;
                    }
                });
                
                // Limpar itens cuja quantidade chegou a zero ou menor
                inventarioGeral = inventarioGeral.filter(item => item.quantidade > 0);
                
                if (hasChanges) {
                    await setDoc(userRef, { inventario: inventarioGeral }, { merge: true });
                    console.log('✅ Itens de Repertório deduzidos da conta com sucesso.');
                }
            }
        } catch (repErr) {
            console.error('❌ Erro ao deduzir Itens de Repertório da conta:', repErr);
            // Non-blocking error. Ideally should be an atomic transaction, but for this context a try/catch prevents blocking char creation.
        }
    }

    const finalSaveData = JSON.parse(JSON.stringify(saveData)); // Remove any undefined fields to prevent Firebase errors
    await setDoc(docRef, finalSaveData);
    console.log('✅ Personagem criado no Firebase:', charId);

    // Clean up wizard storage
    if (typeof clearWizardStorage === 'function') clearWizardStorage();

    return charId;
};
