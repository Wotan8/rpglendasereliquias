// =============================================
// MENU FIREBASE — Lendas e Relíquias (ficha-v1.7_1)
// Auth, character list (coleção 'char'), notifications, inventory
// =============================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
    getFirestore,
    collection,
    query,
    where,
    getDocs,
    getDoc,
    deleteDoc,
    updateDoc,
    addDoc,
    doc
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js';

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
const functions = getFunctions(app, 'southamerica-east1');

let currentUser = null;
let characters = [];
let characterToDelete = null;

// Notificações
let userDocRef = null;
let userNotifications = [];
let currentNotificationPage = 1;
const NOTIFICATIONS_PER_PAGE = 10;
const MAX_NOTIFICATIONS = 100;

// ===== SALDO DE FRAGMENTOS (exibição) =====
function updateFragDisplay(valor) {
    const fragEl = document.getElementById('fragmentosValue');
    if (!fragEl) return;
    const n = Number(valor) || 0;
    fragEl.textContent = n.toLocaleString('pt-BR');
    const chip = fragEl.closest('.frag-wallet');
    if (chip) {
        chip.classList.remove('frag-pulse');
        void chip.offsetWidth; // reinicia a animação
        chip.classList.add('frag-pulse');
    }
}
window.updateFragDisplay = updateFragDisplay;

// ===== DARK THEME =====
// A lógica de tema agora é compartilhada por todo o site: /shared/theme.js
// (chave única 'lr_theme'; window.toggleTheme é definido lá).

// ===== AUTH STATE =====
onAuthStateChanged(auth, async (user) => {
    const loadingScreen = document.getElementById('loadingScreen');
    const toolbar = document.querySelector('.toolbar');
    const wrap = document.querySelector('.wrap');

    if (user) {
        currentUser = user;

        // Mostrar nome
        const nameEl = document.getElementById('userDisplayName');
        if (nameEl) {
            nameEl.textContent = user.displayName || user.email;
            nameEl.title = user.email;
        }

        // Carregar dados
        await loadCharacters();
        await loadNotifications();
        await loadInventory();
        await loadLojaItens();

        // Check for mestre or criador role and show respective buttons
        try {
            const userDoc = await findUserDoc();
            if (userDoc) {
                const data = userDoc.data();
                const role = data.role;
                
                updateFragDisplay(data.fragmentos || 0);

                const btnMestre = document.getElementById('btnPainelMestre');
                const btnCriador = document.getElementById('btnPainelCriador');
                
                if (role === 'mestre') {
                    if (btnMestre) btnMestre.style.display = '';
                } else if (role === 'criador') {
                    if (btnMestre) btnMestre.style.display = '';
                    if (btnCriador) btnCriador.style.display = '';
                }
            }
        } catch (e) { /* ignore */ }

        // Esconder loading, mostrar conteúdo
        if (loadingScreen) loadingScreen.style.display = 'none';
        if (toolbar) toolbar.style.display = '';
        if (wrap) wrap.style.display = '';
    } else {
        // Não autenticado → redirecionar
        window.location.href = '../index.html';
    }
});

// ===== CARREGAR PERSONAGENS (coleção 'char') =====
async function loadCharacters() {
    try {
        const q = query(
            collection(db, 'char'),
            where('ownerUid', '==', currentUser.uid)
        );

        const snapshot = await getDocs(q);
        characters = [];

        snapshot.forEach((docSnap) => {
            characters.push({
                id: docSnap.id,
                ...docSnap.data()
            });
        });

        renderCharacters();
    } catch (error) {
        console.error('Erro ao carregar personagens:', error);
        showAlert('❌ Erro ao carregar personagens: ' + error.message, 'danger');
    }
}

// ===== RENDERIZAR PERSONAGENS =====
function renderCharacters() {
    const grid = document.getElementById('charactersGrid');
    const emptyState = document.getElementById('emptyState');

    if (characters.length === 0) {
        grid.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';

    const html = characters.map(char => {
        // Data can be in char level or inside char.fields
        const f = char.fields || {};
        const nome = f.nome || char.nome || 'Sem nome';
        const classe = f.classe || char.classe || '—';
        const raca = f.raca || char.raca || '—';
        const expTotal = f.exp_total || char.exp || 0;
        const sessoes = f.sessoes || char.sessoes || 0;

        const lastUpdate = char.lastUpdate
            ? new Date(char.lastUpdate).toLocaleDateString('pt-BR')
            : 'Nunca';

        // Imagem: campo characterImage ou charImg (base64)
        const imgSrc = char.characterImage || char.charImg || '';

        return `
            <div class="character-card" onclick="selectCharacter('${char.id}')">
                ${imgSrc ? `<img class="card-img" src="${imgSrc}" alt="${escapeHtml(nome)}">` : ''}
                <div class="card-body">
                    <div class="character-header">
                        <div>
                            <div class="character-name">${escapeHtml(nome)}</div>
                            <div class="character-class">${escapeHtml(raca)} - ${escapeHtml(classe)}</div>
                        </div>
                        <button class="btn-delete" onclick="event.stopPropagation(); openDeleteModal('${char.id}', '${escapeHtml(nome).replace(/'/g, "\\'")}')" title="Apagar personagem">
                            🗑️
                        </button>
                    </div>

                    <div class="character-info">
                        <div class="info-item">
                            <div class="info-label">Experiência Total</div>
                            <div class="info-value">${expTotal}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Sessões</div>
                            <div class="info-value">${sessoes}</div>
                        </div>
                    </div>

                    <button class="btn-play" onclick="event.stopPropagation(); selectCharacter('${char.id}')">
                        ▶️ JOGAR
                    </button>

                    <div class="character-footer">
                        <span>Última atualização: ${lastUpdate}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    grid.innerHTML = html;
}

// ===== CRIAR NOVO PERSONAGEM =====
window.createNewCharacter = async function () {
    if (!currentUser) {
        showAlert('❌ Você precisa estar logado.', 'danger');
        return;
    }

    // Show loading state
    showAlert('🔍 Buscando suas mesas...', 'success');

    try {
        // 1. Find user's mesas
        const mesasSnap = await getDocs(collection(db, 'mesas'));
        const playerMesas = [];
        mesasSnap.forEach(d => {
            const data = d.data();
            const jogadores = data.jogadores || [];
            if (jogadores.includes(currentUser.uid)) {
                playerMesas.push({ id: d.id, ...data });
            }
        });

        // 2. Count player's chars per mesa
        const charSnap = await getDocs(query(
            collection(db, 'char'),
            where('ownerUid', '==', currentUser.uid)
        ));
        const charCountByMesa = {};
        charSnap.forEach(d => {
            const mesaId = d.data().mesaId;
            if (mesaId) {
                charCountByMesa[mesaId] = (charCountByMesa[mesaId] || 0) + 1;
            }
        });

        // 3. Build mesa options with limit check
        let mesaOptionsHtml = '';
        if (playerMesas.length > 0) {
            mesaOptionsHtml = playerMesas.map(m => {
                const limites = m.limitePersonagens || {};
                const cfgDefault = m.config?.limitePadraoPersonagens ?? 1;
                const limit = limites[currentUser.uid] ?? cfgDefault;
                const count = charCountByMesa[m.id] || 0;
                const isFull = count >= limit;

                if (isFull) {
                    return `<div class="mesa-option disabled" title="Limite atingido">
                        <div class="mesa-option-icon">🎲</div>
                        <div class="mesa-option-info">
                            <div class="mesa-option-name">${escapeHtml(m.nome || 'Sem nome')}</div>
                            <div class="mesa-option-detail">🎭 ${count}/${limit} personagem(ns) — <span style="color:var(--danger);font-weight:700">Limite atingido</span></div>
                        </div>
                    </div>`;
                } else {
                    return `<div class="mesa-option" onclick="selectMesaForCreation('${m.id}')">
                        <div class="mesa-option-icon">🎲</div>
                        <div class="mesa-option-info">
                            <div class="mesa-option-name">${escapeHtml(m.nome || 'Sem nome')}</div>
                            <div class="mesa-option-detail">🎭 ${count}/${limit} personagem(ns)</div>
                        </div>
                        <div class="mesa-option-arrow">→</div>
                    </div>`;
                }
            }).join('');
        }

        // 4. Build and show modal
        const existingModal = document.getElementById('createCharModal');
        if (existingModal) existingModal.remove();

        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.id = 'createCharModal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:520px">
                <div class="modal-header-create">
                    <div class="modal-title-create">✨ Criar Novo Personagem</div>
                    <button class="modal-close-btn" onclick="this.closest('.modal').remove()">✕</button>
                </div>
                <div class="modal-body-create">
                    <p class="modal-desc">Escolha como deseja criar seu personagem:</p>

                    <div class="mesa-option avulso" onclick="selectMesaForCreation(null)">
                        <div class="mesa-option-icon">📜</div>
                        <div class="mesa-option-info">
                            <div class="mesa-option-name">Personagem Avulso</div>
                            <div class="mesa-option-detail">Não vinculado a nenhuma mesa</div>
                        </div>
                        <div class="mesa-option-arrow">→</div>
                    </div>

                    ${playerMesas.length > 0 ? `
                        <div class="mesa-divider">
                            <span>ou vincular a uma mesa</span>
                        </div>
                        <div class="mesa-options-list">
                            ${mesaOptionsHtml}
                        </div>
                    ` : `
                        <div class="mesa-divider">
                            <span>Nenhuma mesa disponível</span>
                        </div>
                        <p style="text-align:center;font-size:.82rem;color:var(--muted);padding:8px 0">Você não está vinculado a nenhuma mesa. Peça ao Mestre para te vincular.</p>
                    `}
                </div>
            </div>
        `;
        document.body.appendChild(modal);

    } catch (error) {
        console.error('Erro ao buscar mesas:', error);
        // Fallback: redirect directly
        window.location.href = '../criar-personagem/criacao.html';
    }
};

window.selectMesaForCreation = function(mesaId) {
    const modal = document.getElementById('createCharModal');
    if (modal) modal.remove();

    if (mesaId) {
        window.location.href = `../criar-personagem/criacao.html?mesaId=${mesaId}`;
    } else {
        window.location.href = '../criar-personagem/criacao.html';
    }
};

// ===== CRIAR FICHA EM BRANCO =====
window.createBlankCharacter = async function () {
    if (!currentUser) {
        showAlert('❌ Você precisa estar logado para criar uma ficha.', 'danger');
        return;
    }

    try {
        showAlert('📄 Criando ficha em branco...', 'success');

        const blankChar = {
            ownerUid: currentUser.uid,
            userEmail: currentUser.email,
            fields: {},
            dots: {},
            notes: '',
            createdAt: new Date().toISOString(),
            lastUpdate: new Date().toISOString()
        };

        const docRef = await addDoc(collection(db, 'char'), blankChar);
        console.log('✅ Ficha em branco criada:', docRef.id);

        // Redirecionar diretamente para a ficha v1.7
        window.location.href = `../ficha-v1.7_1/ficha-v1.7_1.html?id=${docRef.id}`;
    } catch (error) {
        console.error('❌ Erro ao criar ficha em branco:', error);
        showAlert('❌ Erro ao criar ficha: ' + error.message, 'danger');
    }
};

// ===== SELECIONAR PERSONAGEM =====
window.selectCharacter = function (characterId) {
    window.location.href = `../ficha-v1.7_1/ficha-v1.7_1.html?id=${characterId}`;
};

// ===== CARREGAR INVENTÁRIO =====
async function loadInventory() {
    try {
        // Buscar documento do usuário
        let userSnapshot = await findUserDoc();

        if (!userSnapshot) {
            document.getElementById('totalApoios').textContent = '0';
            document.getElementById('inventoryGrid').innerHTML = '';
            document.getElementById('emptyInventory').style.display = 'block';
            return;
        }

        const userData = userSnapshot.data();
        const apoios = userData.apoios || [];
        const inventario = userData.inventario || [];

        // Calcular Total de Apoios
        let totalApoios = 0;
        apoios.forEach(apoio => {
            const montante = apoio.montante || 0;
            const tipo = (apoio.tipo || '').toLowerCase();
            if (tipo === 'roleta') {
                totalApoios += (montante % 3 === 0) ? montante / 3 : montante;
            } else {
                totalApoios += montante;
            }
        });

        document.getElementById('totalApoios').textContent = totalApoios;

        // Renderizar Inventário
        const grid = document.getElementById('inventoryGrid');
        const emptyState = document.getElementById('emptyInventory');

        if (inventario.length === 0) {
            grid.innerHTML = '';
            emptyState.style.display = 'block';
        } else {
            emptyState.style.display = 'none';
            grid.innerHTML = inventario.map(item => `
                <div class="inventory-item">
                    <div class="inventory-item-header">
                        <div class="inventory-item-name">${escapeHtml(item.nome || 'Item sem nome')}</div>
                        <div class="inventory-item-quantity">x${item.quantidade || 0}</div>
                    </div>
                    <div class="inventory-item-desc">
                        ${escapeHtmlWithBreaks(item.descricao || item['descrição'] || 'Sem descrição')}
                    </div>
                    <div class="inventory-item-footer">
                        <div class="inventory-item-label">Forma de Recebimento/Uso</div>
                        <div class="inventory-item-value">${escapeHtml(item.formaRecebimento || 'Não especificado')}</div>
                    </div>
                </div>
            `).join('');
        }

    } catch (error) {
        console.error('Erro ao carregar inventário:', error);
        document.getElementById('totalApoios').textContent = 'Erro';
        showAlert('❌ Erro ao carregar inventário: ' + error.message, 'danger');
    }
}

// ===== NOTIFICAÇÕES =====
async function loadNotifications() {
    try {
        const userDoc = await findUserDoc();

        if (userDoc) {
            if (!userDocRef) {
                userDocRef = doc(db, 'users', userDoc.id);
            }
            const userData = userDoc.data();
            userNotifications = userData.notifications || [];
        }

        updateNotificationBadge();
        renderNotifications();
    } catch (error) {
        console.error('Erro ao carregar notificações:', error);
    }
}

async function saveNotifications() {
    if (!userDocRef) return;
    try {
        if (userNotifications.length > MAX_NOTIFICATIONS) {
            userNotifications = userNotifications.slice(0, MAX_NOTIFICATIONS);
        }
        await updateDoc(userDocRef, { notifications: userNotifications });
    } catch (error) {
        console.error('Erro ao salvar notificações:', error);
    }
}

async function markNotificationsAsRead() {
    const hasNew = userNotifications.some(n => n.isNew);
    if (hasNew) {
        userNotifications = userNotifications.map(n => ({ ...n, isNew: false }));
        await saveNotifications();
        updateNotificationBadge();
    }
}

function updateNotificationBadge() {
    const badge = document.getElementById('notificationBadge');
    if (!badge) return;

    const newCount = userNotifications.filter(n => n.isNew).length;
    if (newCount > 0) {
        badge.textContent = newCount > 99 ? '99+' : newCount;
        badge.style.display = '';
    } else {
        badge.style.display = 'none';
    }
}

function renderNotifications() {
    const container = document.getElementById('notificationsList');
    const emptyState = document.getElementById('emptyNotifications');
    const paginationContainer = document.getElementById('paginationContainer');

    if (!container) return;

    if (userNotifications.length === 0) {
        container.innerHTML = '';
        emptyState.style.display = 'block';
        paginationContainer.style.display = 'none';
        return;
    }

    emptyState.style.display = 'none';

    // Paginação
    const totalPages = Math.ceil(userNotifications.length / NOTIFICATIONS_PER_PAGE);
    const startIndex = (currentNotificationPage - 1) * NOTIFICATIONS_PER_PAGE;
    const pageNotifications = userNotifications.slice(startIndex, startIndex + NOTIFICATIONS_PER_PAGE);

    container.innerHTML = pageNotifications.map(notification => {
        let icon = '📬', iconClass = 'master', highlightClass = '';

        if (notification.type === 'inventory_item_received') {
            icon = '🎒'; iconClass = 'inventory'; highlightClass = 'inventory';
        } else if (notification.type === 'exp_received') {
            icon = '⭐'; iconClass = 'exp'; highlightClass = 'exp';
        } else if (notification.type === 'master_message') {
            const highlight = notification.data?.highlight || 'normal';
            highlightClass = highlight !== 'normal' ? highlight : '';
            if (highlight === 'urgente') { icon = '🚨'; iconClass = 'urgente'; }
            else if (highlight === 'importante') { icon = '⚠️'; iconClass = 'importante'; }
            else { icon = '📬'; iconClass = 'master'; }
        } else {
            const isUp = notification.data?.direction === 'up';
            iconClass = isUp ? 'up' : 'down';
            icon = isUp ? '📈' : '📉';
        }

        const dateStr = new Date(notification.timestamp).toLocaleString('pt-BR');
        const classes = ['notification-item'];
        if (notification.isNew) classes.push('new');
        if (highlightClass) classes.push(highlightClass);

        return `
            <div class="${classes.join(' ')}">
                <div class="notification-icon ${iconClass}">${icon}</div>
                <div class="notification-content">
                    <div class="notification-message">${escapeHtml(notification.message)}</div>
                    <div class="notification-time">${dateStr}</div>
                </div>
                <button class="notification-delete" onclick="deleteNotification('${notification.id}')" title="Excluir">🗑️</button>
            </div>
        `;
    }).join('');

    // Paginação
    if (totalPages > 1) {
        paginationContainer.style.display = 'flex';
        let pHtml = `<button class="pagination-btn" onclick="goToNotificationPage(${currentNotificationPage - 1})" ${currentNotificationPage === 1 ? 'disabled' : ''}>◀️</button>`;
        for (let i = 1; i <= totalPages; i++) {
            pHtml += `<button class="pagination-btn ${i === currentNotificationPage ? 'active' : ''}" onclick="goToNotificationPage(${i})">${i}</button>`;
        }
        pHtml += `<button class="pagination-btn" onclick="goToNotificationPage(${currentNotificationPage + 1})" ${currentNotificationPage === totalPages ? 'disabled' : ''}>▶️</button>`;
        paginationContainer.innerHTML = pHtml;
    } else {
        paginationContainer.style.display = 'none';
    }
}

window.deleteNotification = async function (notificationId) {
    userNotifications = userNotifications.filter(n => n.id !== notificationId);
    await saveNotifications();
    renderNotifications();
    updateNotificationBadge();
};

window.goToNotificationPage = function (page) {
    const totalPages = Math.ceil(userNotifications.length / NOTIFICATIONS_PER_PAGE);
    if (page >= 1 && page <= totalPages) {
        currentNotificationPage = page;
        renderNotifications();
    }
};

// ===== TABS =====
window.switchTab = function (tabName) {
    document.querySelectorAll('.tab').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

    event.currentTarget.classList.add('active');
    document.getElementById(`tab-${tabName}`).classList.add('active');

    if (tabName === 'notificacoes') {
        markNotificationsAsRead();
    }
};

// ===== DELETE MODAL =====
window.openDeleteModal = function (characterId, characterName) {
    characterToDelete = characterId;
    document.getElementById('deleteCharacterName').textContent = characterName;
    document.getElementById('deleteModal').classList.add('active');
};

window.closeDeleteModal = function () {
    characterToDelete = null;
    document.getElementById('deleteModal').classList.remove('active');
};

window.confirmDelete = async function () {
    if (!characterToDelete) return;

    try {
        showAlert('🗑️ Apagando personagem...', 'success');
        await deleteDoc(doc(db, 'char', characterToDelete));
        // Clean up localStorage for deleted character
        try { localStorage.removeItem('lr_ficha_v17_' + characterToDelete); } catch (e) { }
        showAlert('✅ Personagem apagado com sucesso!', 'success');
        closeDeleteModal();
        await loadCharacters();
    } catch (error) {
        console.error('Erro ao apagar personagem:', error);
        showAlert('❌ Erro ao apagar: ' + error.message, 'danger');
    }
};

// ===== LOGOUT =====
window.logout = async function () {
    if (confirm('🚪 Tem certeza que deseja sair?')) {
        try {
            await signOut(auth);
            window.location.href = '../index.html';
        } catch (error) {
            console.error('Erro ao fazer logout:', error);
            showAlert('❌ Erro ao sair: ' + error.message, 'danger');
        }
    }
};

// ===== HELPERS =====

// Buscar documento do usuário na coleção 'users'
async function findUserDoc() {
    // Método 1: por UID field
    let q = query(collection(db, 'users'), where('uid', '==', currentUser.uid));
    let snap = await getDocs(q);
    if (!snap.empty) return snap.docs[0];

    // Método 2: por email
    q = query(collection(db, 'users'), where('email', '==', currentUser.email));
    snap = await getDocs(q);
    if (!snap.empty) return snap.docs[0];

    // Método 3: doc ID = UID
    try {
        const docRef = doc(db, 'users', currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) return docSnap;
    } catch (e) { /* ignore */ }

    return null;
}

function getCpColor(letra) {
    const cores = {
        'ULTRA': '#ff00ff', 'OP+': '#ff0080', 'OP': '#ff0000',
        'M+': '#ff6600', 'M': '#ff9900', 'SS': '#ffcc00',
        'S+': '#ffff00', 'S': '#00ff00', 'A': '#00ffff',
        'B': '#0099ff', 'C': '#0066ff', 'D': '#6666ff', 'E': '#94a3b8'
    };
    return cores[letra] || '#94a3b8';
}

function showAlert(message, type) {
    const alertArea = document.getElementById('alertArea');
    if (!alertArea) return;
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    alertArea.appendChild(alert);
    setTimeout(() => {
        if (alert.parentNode === alertArea) alertArea.removeChild(alert);
    }, 3000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function escapeHtmlWithBreaks(text) {
    if (!text) return '';
    return escapeHtml(text).replace(/\n/g, '<br>');
}

// =============================================
// LOJA (JOGADOR)
// =============================================

let lojaItensData = [];
let metasData = [];
let currentCheckoutItem = null;

async function loadLojaItens() {
    try {
        // Load active items from loja_itens
        const qItems = query(collection(db, 'loja_itens'), where('isVendaAtiva', '==', true));
        const snapItems = await getDocs(qItems);
        lojaItensData = [];
        snapItems.forEach(docSnap => {
            lojaItensData.push({ id: docSnap.id, ...docSnap.data() });
        });

        // Load metas for checkout options
        const snapMetas = await getDocs(collection(db, 'metas'));
        metasData = [];
        snapMetas.forEach(docSnap => {
            metasData.push({ id: docSnap.id, ...docSnap.data() });
        });

        renderLojaItens();
    } catch (e) {
        console.error('Erro ao carregar loja:', e);
        showAlert('❌ Erro ao carregar itens da loja.', 'danger');
    }
}
window.loadLojaItens = loadLojaItens;

function renderLojaItens() {
    const grid = document.getElementById('lojaGrid');
    const emptyState = document.getElementById('emptyLoja');
    if (!grid) return;

    if (lojaItensData.length === 0) {
        grid.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';
    let html = '';

    lojaItensData.forEach(item => {
        let tagsHtml = '';
        if (item.isExp) tagsHtml += `<span style="background:var(--primary);color:#fff;padding:4px 8px;border-radius:6px;font-size:0.75rem;font-weight:600;">⭐ EXP: ${item.expAmount}${item.isExpVip ? ' (VIP)' : ''}</span>`;
        if (item.isRoleta) tagsHtml += `<span style="background:var(--secondary);color:#fff;padding:4px 8px;border-radius:6px;font-size:0.75rem;font-weight:600;">🎰 Roleta: ${item.roletaGiros}x</span>`;
        if (item.isRerolagem) tagsHtml += `<span style="background:#f59e0b;color:#fff;padding:4px 8px;border-radius:6px;font-size:0.75rem;font-weight:600;">🎲 Re-roll: ${item.rerolagensAmount}x</span>`;
        if (item.isNarrativo) tagsHtml += `<span style="background:#10b981;color:#fff;padding:4px 8px;border-radius:6px;font-size:0.75rem;font-weight:600;">📜 Benefício Narrativo</span>`;
        if (item.isItemPersonagem && item.personagemItensVinculados?.length) tagsHtml += `<span style="background:#8b5cf6;color:#fff;padding:4px 8px;border-radius:6px;font-size:0.75rem;font-weight:600;">🎒 Equipamentos Especiais</span>`;

        let metasLabel = 'Nenhuma meta vinculada';
        if (item.modoSelecaoMeta) {
            metasLabel = `Pode ser atrelado a até ${item.qtdSelecaoMeta || 1} Meta(s)`;
        } else if (item.metasVinculadas && item.metasVinculadas.length > 0) {
            const mNames = item.metasVinculadas.map(mId => {
                const f = metasData.find(m => m.id === mId);
                return f ? f.nome : 'Meta desconhecida';
            });
            metasLabel = `Ajuda automaticamente: ${mNames.join(', ')}`;
        }

        const imgHtml = item.imagem ? `<div style="height:140px;width:100%;background-image:url('${escapeHtml(item.imagem)}');background-size:contain;background-repeat:no-repeat;background-position:center;border-radius:8px;background-color:rgba(0,0,0,0.4);margin-bottom:12px;"></div>` : '';

        html += `
            <div class="inventory-card" style="display:flex;flex-direction:column;">
                ${imgHtml}
                <div class="item-name" style="font-size:1.1rem;margin-bottom:8px;">${escapeHtml(item.nome)}</div>
                ${item.descricao ? `<div class="item-desc" style="font-size:0.85rem;margin-bottom:12px;color:var(--muted);">${escapeHtml(item.descricao)}</div>` : ''}
                
                <div style="font-size:0.8rem;color:var(--muted);background:rgba(255,255,255,0.05);padding:6px;border-radius:4px;margin-bottom:12px;">
                    🎯 ${escapeHtml(metasLabel)}
                </div>

                <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px;">
                    ${tagsHtml}
                </div>
                
                <div style="margin-top:auto;display:flex;flex-direction:column;gap:8px;">
                    ${item.valorFrag > 0 ? `
                        <button class="btn btn-primary" style="width:100%;font-weight:700;display:flex;justify-content:center;gap:6px;" onclick="openCheckoutFrag('${item.id}')">
                            💎 Comprar por ${item.valorFrag} Frag$
                        </button>
                    ` : ''}
                    ${item.valorRs > 0 ? `
                        <button class="btn btn-success" style="width:100%;font-weight:700;" onclick="buyItemWithRS('${item.id}')">
                            💳 Comprar por R$ ${Number(item.valorRs).toFixed(2)}
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    });

    grid.innerHTML = html;
}

window.buyItemWithRS = function(id) {
    showAlert('💳 Esta modalidade de pagamento em Dinheiro Real ainda não está disponível!', 'warning');
};

window.openCheckoutFrag = async function(itemId) {
    const item = lojaItensData.find(i => i.id === itemId);
    if (!item) return;

    // Check frontend balance first
    try {
        const userDoc = await findUserDoc();
        const currentFrag = userDoc ? (userDoc.data().fragmentos || 0) : 0;
        if (currentFrag < item.valorFrag) {
            showAlert(`❌ Você não tem Fragmentos suficientes. Custo: ${item.valorFrag} Frag$.`, 'danger');
            return;
        }
    } catch (e) {}

    currentCheckoutItem = item;

    const infoDiv = document.getElementById('lojaCheckoutItemInfo');
    infoDiv.innerHTML = `
        <div style="font-weight:700;color:var(--primary);font-size:1.1rem;margin-bottom:4px;">${escapeHtml(item.nome)}</div>
        <div style="font-size:0.9rem;color:var(--muted);margin-bottom:8px;">Custo: <span style="color:#6366f1;font-weight:700;">${item.valorFrag} Frag$</span></div>
    `;

    const metaSelector = document.getElementById('lojaCheckoutMetaSelector');
    const metaList = document.getElementById('lojaCheckoutMetaList');
    
    if (item.modoSelecaoMeta) {
        metaSelector.style.display = 'block';
        metaList.innerHTML = '';
        const limit = item.qtdSelecaoMeta || 1;
        document.getElementById('lojaCheckoutMetaSelector').firstElementChild.textContent = `Escolha até ${limit} Meta(s) para atrelar o apoio:`;
        const allowedMetasIds = item.metasVinculadas || [];
        const allowedMetas = metasData.filter(m => allowedMetasIds.includes(m.id));

        if (allowedMetas.length === 0) {
             metaList.innerHTML = '<div style="color:var(--muted);font-size:0.9rem;">Nenhuma meta vinculada configurada pelo mestre.</div>';
        } else {
            allowedMetas.forEach(meta => {
                const idCheckbox = 'chk_meta_' + meta.id;
                metaList.innerHTML += `
                    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
                        <input type="checkbox" value="${meta.id}" class="loja-checkout-meta-chk" style="width:16px;height:16px;accent-color:var(--primary);">
                        <span>${escapeHtml(meta.nome)}</span>
                    </label>
                `;
            });
        }
    } else {
        metaSelector.style.display = 'none';
    }

    document.getElementById('lojaCheckoutModal').style.display = 'flex';
};

window.confirmPurchaseFrag = async function() {
    if (!currentCheckoutItem) return;
    const item = currentCheckoutItem;

    // Pré-checagem de UX — a validação de verdade acontece no servidor
    let selectedMetas = [];
    if (item.modoSelecaoMeta) {
        const limit = item.qtdSelecaoMeta || 1;
        const checkboxes = document.querySelectorAll('.loja-checkout-meta-chk:checked');
        if (checkboxes.length > limit) {
            showAlert(`❌ Você pode escolher no máximo ${limit} meta(s).`, 'warning');
            return;
        }
        selectedMetas = [...checkboxes].map(c => c.value);
    }

    const btn = document.getElementById('btnConfirmPurchase');
    btn.disabled = true;
    btn.innerHTML = 'Processando...';

    try {
        const comprar = httpsCallable(functions, 'comprarComFragmentos');
        const result = await comprar({ itemId: item.id, selectedMetas });

        showAlert('✅ Compra realizada com sucesso! Item enviado ao seu Repertório.', 'success');
        document.getElementById('lojaCheckoutModal').style.display = 'none';

        updateFragDisplay(result.data.novoSaldo);

        await loadInventory();
    } catch (error) {
        console.error('Compra falhou:', error);
        showAlert(`❌ Erro na compra: ${error.message}`, 'danger');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '✔️ Confirmar Compra';
        currentCheckoutItem = null;
    }
};
