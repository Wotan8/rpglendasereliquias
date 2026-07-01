import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const firebaseConfig = {
    apiKey: "AIzaSyA6r79XcsMr3KZUT1YZ8vQntIGspgULXcE",
    authDomain: "rpg-lendasereliquias.firebaseapp.com",
    projectId: "rpg-lendasereliquias",
    storageBucket: "rpg-lendasereliquias.firebasestorage.app",
    messagingSenderId: "546994339773",
    appId: "1:546994339773:web:0116cf7c8667f113075cd4"
};

let app, db;
try {
    app = initializeApp(firebaseConfig, "GlobalFaviconApp");
    db = getFirestore(app);
} catch (e) {
    // App might already be initialized by another script on the page
    // We can try to use the default app if we don't have modules collision
    console.warn("GlobalFavicon: Could not init custom app, relying on defaults if available", e);
}

// Determine current page ID
let pageId = 'index'; // default
const path = window.location.pathname;

if (path.includes('menu.html')) pageId = 'menu';
else if (path.includes('wizard.html')) pageId = 'criar-personagem';
else if (path.includes('ficha-v1.7_1.html')) pageId = 'ficha';
else if (path.includes('painel-mestre.html')) pageId = 'painel-mestre';
else if (path.includes('painel-criador.html')) pageId = 'painel-criador';
else if (path.includes('mapa') || path.includes('hexmap') || path.includes('viewmap')) pageId = 'mapa';

async function updateFavicon() {
    if(!db) return;
    try {
        const configDoc = await getDoc(doc(db, 'app-config', 'favicons'));
        if (configDoc.exists()) {
            const urls = configDoc.data();
            const faviconUrl = urls[pageId];
            
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
        console.error("Error loading favicon:", e);
    }
}

// Execute
updateFavicon();
