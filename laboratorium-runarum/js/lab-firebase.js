// ============= FIREBASE MODULE — Laboratorium Runarum =============
// Autentica, carrega o catálogo dinâmico de Elementos Rúnicos
// (system/data/runicElements — cadastrado no Painel do Criador),
// carrega o personagem (atributos, perícias, estado de Runomancia)
// e salva o Grimório de volta em char/{id}.runomancia.

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, doc, getDoc, updateDoc, setDoc, collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

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

const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
// Chaves de perícia da ficha: 'sk_classe_' + lower + [^a-z0-9]→'_'  (acentos viram '_')
const squash = k => norm(k).replace(/[^a-z0-9]/g, '');

function extractCharContext(data) {
    const dots = data?.dots || {};
    const findDot = (frag) => {
        let best = 0;
        Object.keys(dots).forEach(k => {
            if (squash(k).includes(frag)) best = Math.max(best, Number(dots[k] || 0));
        });
        return best;
    };
    const intV = Number(dots.attr_int || 0), racV = Number(dots.attr_rac || 0);
    return {
        nome: data?.fields?.charName || data?.fields?.nome || '',
        classe: data?.fields?.classe || '',
        baseAttr: Math.max(intV, racV),          // INT ou RAC (§6.2)
        int: intV, rac: racV,
        runomancia: findDot('runomancia'),
        gravacao: findDot('grava'),              // Gravação Rúnica ("ç/ã" viram '_')
        mentalizacao: findDot('mentaliza'),
        erudicao: findDot('erudi'),
        diagnostico: findDot('diagn'),
        eficiencia: findDot('efici'),
        vig: Number(dots.attr_vig || 0), prs: Number(dots.attr_prs || 0),
    };
}

async function loadCatalog() {
    const snap = await getDocs(collection(db, 'system', 'data', 'runicElements'));
    const byId = {};
    snap.forEach(d => { byId[d.id] = { id: d.id, ...d.data() }; });
    return byId;
}

const LabFB = {
    db, auth,
    charId: null,
    charData: null,
    ctx: null,           // atributos/perícias extraídos
    elementsById: {},    // catálogo dinâmico
    runomancia: { estudos: [], aprendidos: {}, grimorio: [] },

    async saveRunomancia() {
        if (!this.charId) return false;
        try {
            const ref = doc(db, 'char', this.charId);
            await updateDoc(ref, { runomancia: this.runomancia, lastUpdate: new Date().toISOString() });
            return true;
        } catch (e) {
            // Doc pode não existir ainda (ficha nunca salva) — cria preservando nada além do necessário
            try {
                await setDoc(doc(db, 'char', this.charId), {
                    runomancia: this.runomancia, lastUpdate: new Date().toISOString(),
                    ownerUid: auth.currentUser?.uid || null,
                }, { merge: true });
                return true;
            } catch (e2) { console.error('❌ Falha ao salvar Grimório:', e2); return false; }
        }
    },
};
window.LabFB = LabFB;

onAuthStateChanged(auth, async (user) => {
    const loading = document.getElementById('labLoading');
    const setMsg = (t) => { const el = loading?.querySelector('span'); if (el) el.innerHTML = t; };

    if (!user) { window.location.href = '../index.html'; return; }
    window.currentUser = user;

    const params = new URLSearchParams(location.search);
    LabFB.charId = params.get('id');

    try {
        setMsg('ᛟ Consultando o Compêndio (elementos rúnicos)…');
        LabFB.elementsById = await loadCatalog();

        if (LabFB.charId) {
            setMsg('📜 Carregando o personagem…');
            const snap = await getDoc(doc(db, 'char', LabFB.charId));
            if (snap.exists()) {
                const data = snap.data();
                if (data.ownerUid && data.ownerUid !== user.uid) {
                    alert('🚫 Esta ficha não pertence a você.');
                    window.location.href = '../menu/menu.html';
                    return;
                }
                LabFB.charData = data;
                LabFB.ctx = extractCharContext(data);
                const r = data.runomancia || {};
                LabFB.runomancia = {
                    estudos: Array.isArray(r.estudos) ? r.estudos : [],
                    aprendidos: r.aprendidos || {},
                    grimorio: Array.isArray(r.grimorio) ? r.grimorio : [],
                };
            }
        }
        if (!LabFB.ctx) {
            // Sem ficha vinculada: modo simulação livre
            LabFB.ctx = { nome: '', classe: '', baseAttr: 0, int: 0, rac: 0, runomancia: 0, gravacao: 0, mentalizacao: 0, erudicao: 0, diagnostico: 0, eficiencia: 0, vig: 0, prs: 0 };
        }

        loading.style.display = 'none';
        document.getElementById('labWrap').style.display = '';
        window.labBoot?.();   // lab-app.js
    } catch (e) {
        console.error(e);
        setMsg('❌ Erro ao carregar o Laboratorium.<br><small>Verifique a conexão e recarregue.</small>');
    }
});


// ===== 🚪 Sair (cabeçalho padronizado) =====
window.labLogout = async function () {
    try { await signOut(auth); } catch (e) { console.warn('logout', e); }
    window.location.href = '../index.html';
};
