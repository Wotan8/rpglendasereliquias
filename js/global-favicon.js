// =============================================
// GLOBAL: PWA (manifest + Service Worker + auto-update) e Favicon dinâmico
// Incluído em todas as páginas do projeto.
// =============================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// ---------------------------------------------
// 1) MANIFEST — garante o link para o manifest.json estático
//    (display_override cuida do modo de exibição por plataforma)
// ---------------------------------------------
(function ensureManifestLink() {
    if (!document.querySelector("link[rel~='manifest']")) {
        const link = document.createElement('link');
        link.rel = 'manifest';
        link.href = '/manifest.json';
        document.head.appendChild(link);
    }
    if (!document.querySelector("meta[name='theme-color']")) {
        const meta = document.createElement('meta');
        meta.name = 'theme-color';
        meta.content = '#8b5cf6';
        document.head.appendChild(meta);
    }
})();

// ---------------------------------------------
// 2) SERVICE WORKER — registro + ATUALIZAÇÃO FORÇADA
//    O sw.js executa skipWaiting() no install e clients.claim() no
//    activate. Aqui, quando o novo SW assume o controle
//    ('controllerchange'), a página recarrega UMA ÚNICA vez.
// ---------------------------------------------
if ('serviceWorker' in navigator) {

    // 🔒 SEGURANÇA CRÍTICA: flag de estado que impede loop infinito de reload.
    // 'controllerchange' pode disparar mais de uma vez; só recarregamos na primeira.
    let refreshing = false;

    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
    });

    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('✅ SW registrado:', registration.scope);
                // Procura ativamente por nova versão a cada carga e a cada 30 min
                registration.update().catch(() => {});
                setInterval(() => registration.update().catch(() => {}), 30 * 60 * 1000);
            })
            .catch(err => console.error('❌ Falha no registro do Service Worker', err));
    });
}

// ---------------------------------------------
// 3) FAVICON DINÂMICO (configurado pelo mestre em app-config/favicons)
//    Falha silenciosamente offline — o SW já serve os ícones do cache.
// ---------------------------------------------
const firebaseConfig = {
    apiKey: "AIzaSyA6r79XcsMr3KZUT1YZ8vQntIGspgULXcE",
    authDomain: "rpg-lendasereliquias.firebaseapp.com",
    projectId: "rpg-lendasereliquias",
    storageBucket: "rpg-lendasereliquias.firebasestorage.app",
    messagingSenderId: "546994339773",
    appId: "1:546994339773:web:0116cf7c8667f113075cd4"
};

let db;
try {
    const app = initializeApp(firebaseConfig, "GlobalFaviconApp");
    db = getFirestore(app);
} catch (e) {
    console.warn("GlobalFavicon: não foi possível iniciar app auxiliar", e);
}

// Determine current page ID
let pageId = 'index'; // default
const path = window.location.pathname;

if (path.includes('menu.html')) pageId = 'menu';
else if (path.includes('wizard.html') || path.includes('criacao.html')) pageId = 'criar-personagem';
else if (path.includes('ficha-v1.7_1.html')) pageId = 'ficha';
else if (path.includes('painel-mestre.html')) pageId = 'painel-mestre';
else if (path.includes('painel-criador.html')) pageId = 'painel-criador';
else if (path.includes('mapa') || path.includes('hexmap') || path.includes('viewmap')) pageId = 'mapa';

async function updateFavicon() {
    if (!db) return;
    try {
        const configDoc = await getDoc(doc(db, 'app-config', 'favicons'));
        if (configDoc.exists()) {
            const faviconUrl = configDoc.data()[pageId];
            if (faviconUrl) {
                let link = document.querySelector("link[rel~='icon']");
                if (!link) {
                    link = document.createElement('link');
                    link.rel = 'icon';
                    document.head.appendChild(link);
                }
                link.href = faviconUrl;
            }
        }
    } catch (e) {
        // Offline ou sem config — mantém o ícone padrão em cache
        console.warn("Favicon dinâmico indisponível:", e.message || e);
    }
}

updateFavicon();
