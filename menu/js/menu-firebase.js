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
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js';
import { somarApoiosDoJogador, somarMetaTotais, progressoDasEtapas, proximaEtapa, valorApoio, parseMetaIds, resolveMetaId } from '../../shared/apoios-calc.js';

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
                const btnWorldbuilding = document.getElementById('btnWorldbuilding');

                if (role === 'mestre') {
                    if (btnMestre) btnMestre.style.display = '';
                } else if (role === 'criador') {
                    if (btnMestre) btnMestre.style.display = '';
                    if (btnCriador) btnCriador.style.display = '';
                    if (btnWorldbuilding) btnWorldbuilding.style.display = '';
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

window.selectMesaForCreation = function (mesaId) {
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
        const inventarioRaw = userData.inventario || [];

        // Frontend Stacking (Agrupa itens idênticos)
        const inventario = [];
        inventarioRaw.forEach(item => {
            const existing = inventario.find(i => i.nome === item.nome);
            if (existing) {
                existing.quantidade = (existing.quantidade || 1) + (item.quantidade || 1);
                if (!existing.imagem && item.imagem) {
                    existing.imagem = item.imagem;
                }
                if (!existing.descricao && item.descricao) {
                    existing.descricao = item.descricao;
                }
            } else {
                inventario.push({ ...item, quantidade: item.quantidade || 1 });
            }
        });

        // Contagem vem de shared/apoios-calc.js — a MESMA usada no painel do mestre
        document.getElementById('totalApoios').textContent = somarApoiosDoJogador(apoios);

        // Renderizar Inventário
        const grid = document.getElementById('inventoryGrid');
        const emptyState = document.getElementById('emptyInventory');

        if (inventario.length === 0) {
            grid.innerHTML = '';
            emptyState.style.display = 'block';
        } else {
            emptyState.style.display = 'none';
            grid.innerHTML = inventario.map(item => {
                const imgHtml = item.imagem
                    ? `<div class="loja-card-media">
                           <img src="${escapeHtml(item.imagem)}" alt="${escapeHtml(item.nome || 'Item')}" loading="lazy"
                                onerror="this.parentElement.classList.add('inventory-media-fallback');this.remove();">
                       </div>`
                    : `<div class="loja-card-media inventory-media-fallback"></div>`;

                let tagsHtml = '';
                if (item.isExp) tagsHtml += `<span class="loja-tag" style="background:var(--primary);">⭐ EXP: ${item.expAmount}${item.isExpVip ? ' (VIP)' : ''}</span>`;
                if (item.isRoleta) tagsHtml += `<span class="loja-tag" style="background:var(--secondary, #8b5cf6);">🎰 Roleta: ${item.roletaGiros}x</span>`;
                if (item.isRerolagem) tagsHtml += `<span class="loja-tag" style="background:#f59e0b;">🎲 Re-roll: ${item.rerolagensAmount}x</span>`;
                if (item.isNarrativo) tagsHtml += `<span class="loja-tag" style="background:#10b981;">📜 Benefício Narrativo</span>`;
                if (item.isItemPersonagem && item.personagemItensVinculados?.length) tagsHtml += `<span class="loja-tag" style="background:#8b5cf6;">🎒 Equipamentos Especiais</span>`;

                return `
                <div class="loja-card">
                    ${imgHtml}
                    <div class="loja-card-body">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                            <div class="loja-card-title" style="margin-bottom: 0;">${escapeHtml(item.nome || 'Item sem nome')}</div>
                            <div class="inventory-item-quantity" style="margin-left: 8px; flex-shrink: 0; background: var(--primary); color: #fff; padding: 2px 10px; border-radius: 20px; font-weight: 700; font-size: 0.8rem;">x${item.quantidade || 0}</div>
                        </div>
                        ${item.descricao || item['descrição'] ? `<div class="loja-card-desc" style="margin-bottom: 8px;">${escapeHtmlWithBreaks(item.descricao || item['descrição'])}</div>` : ''}
                        ${tagsHtml ? `<div class="loja-card-tags" style="margin-bottom: 12px;">${tagsHtml}</div>` : ''}
                        <div style="margin-top: auto; padding-top: 12px; border-top: 1px solid rgba(255, 255, 255, 0.08);">
                            <div style="font-size: 9px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.4px; font-weight: 800; margin-bottom: 2px;">Forma de Recebimento</div>
                            <div style="font-size: 0.82rem; font-weight: 600; color: var(--ink);">${escapeHtml(item.formaRecebimento || 'Não especificado')}</div>
                        </div>
                    </div>
                </div>
                `;
            }).join('');
        }

    } catch (error) {
        console.error('Erro ao carregar inventário:', error);
        document.getElementById('totalApoios').textContent = 'Erro';
        showAlert('❌ Erro ao carregar inventário: ' + error.message, 'danger');
    }
}

// ===== NOTIFICAÇÕES =====

// Notificações antigas do painel vieram com {date, read, highlight} na raiz e sem `id`.
// Aqui elas são convertidas para o formato canônico {id, type, timestamp, isNew, data.highlight}.
// É ADITIVO: nenhum campo é removido, nada é perdido — só passa a ser legível.
function normalizeNotification(n, i) {
    if (n && n.id && n.timestamp != null && n.isNew != null) return n;
    const ts = n.timestamp ?? (n.date ? Date.parse(n.date) : NaN);
    return {
        ...n,
        id: n.id || `legacy_${Number.isFinite(ts) ? ts : 0}_${i}`,
        type: n.type || 'master_message',
        timestamp: Number.isFinite(ts) ? ts : Date.now(),
        isNew: n.isNew ?? (n.read === false),
        data: { ...(n.data || {}), highlight: n.data?.highlight || n.highlight || 'normal' }
    };
}

async function loadNotifications() {
    try {
        const userDoc = await findUserDoc();

        if (userDoc) {
            if (!userDocRef) {
                userDocRef = doc(db, 'users', userDoc.id);
            }
            const raw = userDoc.data().notifications || [];
            const normalizadas = raw.map(normalizeNotification);
            const precisouMigrar = normalizadas.some((n, i) => n !== raw[i]);

            // Ordem de exibição vem do timestamp, não da posição no array —
            // por isso o painel pode acrescentar com arrayUnion (no fim) sem corrida.
            userNotifications = normalizadas.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

            if (precisouMigrar) await saveNotifications();
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

        if (notification.type === 'inventory_item_received' || notification.type === 'repertoire_item_received') {
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

// =============================================
// METAS (JOGADOR)
// Objetivo da aba: mostrar o que falta para o próximo desbloqueio e o caminho
// direto para o item da Loja que empurra aquela meta.
// =============================================

let metasCarregadas = false;

async function loadMetasJogador() {
    const grid = document.getElementById('metasGrid');
    const vazio = document.getElementById('emptyMetas');
    const loading = document.getElementById('metasLoading');
    if (!grid) return;

    // Recarrega a cada abertura: o total é coletivo e muda com a compra dos outros.
    loading.style.display = metasCarregadas ? 'none' : 'block';
    vazio.style.display = 'none';

    try {
        // metasData e lojaItensData já vêm de loadLojaItens() no login
        if (!metasData.length) await loadLojaItens();

        // ponytail: soma no cliente varrendo a coleção `users`. Serve para uma mesa
        // de dezenas de jogadores; virando centenas, trocar por um contador agregado
        // mantido por Cloud Function (FieldValue.increment em metas_totais/global).
        const snapUsers = await getDocs(collection(db, 'users'));
        const users = snapUsers.docs.map(d => ({ id: d.id, ...d.data() }));
        const totais = somarMetaTotais(users, metasData);

        // Contribuição pessoal — sai da mesma leitura, sem custo extra
        const meuDoc = users.find(u => u.uid === currentUser.uid || u.email === currentUser.email);
        const meusTotais = somarMetaTotais(meuDoc ? [meuDoc] : [], metasData);

        loading.style.display = 'none';

        if (!metasData.length) {
            grid.innerHTML = '';
            vazio.style.display = 'block';
            return;
        }

        const ordenadas = [...metasData].sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
        grid.innerHTML = ordenadas.map(meta => renderMetaCard(meta, totais[meta.id] || 0, meusTotais[meta.id] || 0)).join('');
        metasCarregadas = true;

    } catch (e) {
        console.error('Erro ao carregar metas:', e);
        loading.style.display = 'none';
        showAlert('❌ Erro ao carregar as metas.', 'danger');
    }
}
window.loadMetasJogador = loadMetasJogador;

// Itens da Loja que empurram esta meta — o gancho de conversão da aba
function itensQueApoiam(metaId) {
    return lojaItensData.filter(item => {
        const vinculadas = item.metasVinculadas || [];
        // modoSelecaoMeta = o jogador escolhe a meta no checkout, entre as vinculadas
        return vinculadas.includes(metaId);
    });
}

function renderMetaCard(meta, total, meuTotal) {
    const etapas = progressoDasEtapas(total, meta.etapas || []);
    const proxima = proximaEtapa(etapas);
    const concluidas = etapas.filter(e => e.concluida).length;
    const tudoConcluido = etapas.length > 0 && !proxima;

    // Faixa de destaque: o que falta agora
    let chamada;
    if (!etapas.length) {
        chamada = `<div class="meta-callout meta-callout-neutro">Meta sem etapas definidas — acompanhe o total acumulado.</div>`;
    } else if (tudoConcluido) {
        chamada = `<div class="meta-callout meta-callout-ok">🏆 Todas as etapas foram desbloqueadas. Obrigado!</div>`;
    } else {
        chamada = `
            <div class="meta-callout">
                <div class="meta-callout-num">${proxima.faltam}</div>
                <div class="meta-callout-txt">
                    <strong>${proxima.faltam === 1 ? 'apoio restante' : 'apoios restantes'}</strong>
                    para desbloquear<br>
                    <span class="meta-callout-alvo">${escapeHtml(proxima.descricao || `Etapa ${proxima.indice + 1}`)}</span>
                </div>
            </div>`;
    }

    const etapasHtml = etapas.map(e => `
        <li class="meta-etapa ${e.concluida ? 'is-done' : (e.progresso > 0 ? 'is-current' : '')}">
            <span class="meta-etapa-check">${e.concluida ? '✓' : e.indice + 1}</span>
            <div class="meta-etapa-body">
                <div class="meta-etapa-desc">${escapeHtml(e.descricao || `Etapa ${e.indice + 1}`)}</div>
                <div class="meta-etapa-bar"><div style="width:${e.pct}%"></div></div>
            </div>
            <span class="meta-etapa-num">${e.progresso}/${e.necessarios}</span>
        </li>`).join('');

    const itens = itensQueApoiam(meta.id);
    const itensHtml = itens.length ? `
        <div class="meta-itens">
            <div class="meta-itens-titulo">Itens que empurram esta meta</div>
            ${itens.slice(0, 4).map(item => {
                const centavos = getItemValorCentavos(item);
                const precos = [
                    item.valorFrag > 0 ? `${item.valorFrag} Frag$` : null,
                    centavos > 0 ? `R$ ${(centavos / 100).toFixed(2).replace('.', ',')}` : null
                ].filter(Boolean).join(' · ');
                return `
                    <button class="meta-item-chip" onclick="irParaItemDaLoja('${item.id}')" title="Ver na Loja">
                        <span class="meta-item-nome">${escapeHtml(item.nome)}</span>
                        <span class="meta-item-preco">${precos || 'Ver na Loja'}</span>
                    </button>`;
            }).join('')}
            ${itens.length > 4 ? `<div class="meta-itens-mais">+${itens.length - 4} outro(s) na Loja</div>` : ''}
        </div>` : '';

    return `
        <article class="meta-card ${tudoConcluido ? 'is-complete' : ''}">
            <header class="meta-card-head">
                <h2 class="meta-card-titulo">${escapeHtml(meta.nome || 'Meta')}</h2>
                <span class="meta-card-etapas">${concluidas}/${etapas.length || 0} etapas</span>
            </header>

            ${meta.descricao ? `<p class="meta-card-desc">${escapeHtmlWithBreaks(meta.descricao)}</p>` : ''}

            ${chamada}

            ${etapas.length ? `<ul class="meta-etapas">${etapasHtml}</ul>` : ''}

            <footer class="meta-card-foot">
                <div class="meta-stat">
                    <span class="meta-stat-num">${total}</span>
                    <span class="meta-stat-lbl">apoios da mesa</span>
                </div>
                <div class="meta-stat ${meuTotal > 0 ? 'is-mine' : ''}">
                    <span class="meta-stat-num">${meuTotal}</span>
                    <span class="meta-stat-lbl">${meuTotal === 1 ? 'seu apoio' : 'seus apoios'}</span>
                </div>
            </footer>

            ${itensHtml}
        </article>`;
}

// Leva o jogador da meta direto ao item na Loja
window.irParaItemDaLoja = function (itemId) {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector('.tab[onclick*="loja"]')?.classList.add('active');
    document.getElementById('tab-loja').classList.add('active');

    const card = document.querySelector(`[data-loja-item="${itemId}"]`);
    if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.classList.add('loja-card-destaque');
        setTimeout(() => card.classList.remove('loja-card-destaque'), 2200);
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
    if (tabName === 'metas') {
        loadMetasJogador();
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

function showAlert(message, type, duration = 3000) {
    const alertArea = document.getElementById('alertArea');
    if (!alertArea) return;
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    alertArea.appendChild(alert);
    setTimeout(() => {
        if (alert.parentNode === alertArea) alertArea.removeChild(alert);
    }, duration);
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
        // Itens à venda. O filtro é feito aqui, e não com where('isVendaAtiva','==',true),
        // porque itens criados antes desse campo existir não têm a propriedade e sumiriam
        // da loja — painel e Cloud Functions tratam ausente como ATIVO.
        const snapItems = await getDocs(collection(db, 'loja_itens'));
        lojaItensData = [];
        snapItems.forEach(docSnap => {
            const data = docSnap.data();
            if (data.isVendaAtiva !== false) lojaItensData.push({ id: docSnap.id, ...data });
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
        if (item.isExp) tagsHtml += `<span class="loja-tag" style="background:var(--primary);">⭐ EXP: ${item.expAmount}${item.isExpVip ? ' (VIP)' : ''}</span>`;
        if (item.isRoleta) tagsHtml += `<span class="loja-tag" style="background:var(--secondary, #8b5cf6);">🎰 Roleta: ${item.roletaGiros}x</span>`;
        if (item.isRerolagem) tagsHtml += `<span class="loja-tag" style="background:#f59e0b;">🎲 Re-roll: ${item.rerolagensAmount}x</span>`;
        if (item.isNarrativo) tagsHtml += `<span class="loja-tag" style="background:#10b981;">📜 Benefício Narrativo</span>`;
        if (item.isItemPersonagem && item.personagemItensVinculados?.length) tagsHtml += `<span class="loja-tag" style="background:#8b5cf6;">🎒 Equipamentos Especiais</span>`;

        let metasLabel = 'Nenhuma meta vinculada';
        if (item.modoSelecaoMeta) {
            metasLabel = `Pode ser atrelado a até ${item.qtdSelecaoMeta || item.quantidadeMetasSelecionaveis || 1} Meta(s)`;
        } else if (item.metasVinculadas && item.metasVinculadas.length > 0) {
            const mNames = item.metasVinculadas.map(mId => {
                const f = metasData.find(m => m.id === mId);
                return f ? f.nome : 'Meta desconhecida';
            });
            metasLabel = `Ajuda automaticamente: ${mNames.join(', ')}`;
        }

        const valorCentavos = getItemValorCentavos(item);
        const precoReal = valorCentavos > 0 ? (valorCentavos / 100).toFixed(2).replace('.', ',') : null;

        const imgHtml = item.imagem
            ? `<div class="loja-card-media">
                   <img src="${escapeHtml(item.imagem)}" alt="${escapeHtml(item.nome)}" loading="lazy"
                        onerror="this.parentElement.classList.add('loja-media-fallback');this.remove();">
               </div>`
            : `<div class="loja-card-media loja-media-fallback"></div>`;

        html += `
            <div class="loja-card" data-loja-item="${escapeHtml(item.id)}">
                ${imgHtml}
                <div class="loja-card-body">
                    <div class="loja-card-title">${escapeHtml(item.nome)}</div>
                    ${item.descricao ? `<div class="loja-card-desc">${escapeHtml(item.descricao)}</div>` : ''}
                    <div class="loja-card-meta">🎯 ${escapeHtml(metasLabel)}</div>
                    ${tagsHtml ? `<div class="loja-card-tags">${tagsHtml}</div>` : ''}
                    <div class="loja-card-actions">
                        ${item.valorFrag > 0 ? `
                            <button class="loja-btn loja-btn-frag" onclick="openCheckoutFrag('${item.id}')">
                                <span>💎 ${item.valorFrag} Frag$</span>
                                <small>Comprar com Fragmentos</small>
                            </button>` : ''}
                        ${precoReal ? `
                            <button class="loja-btn loja-btn-real" onclick="openCheckoutPagBank('${item.id}')">
                                <span>💳 R$ ${precoReal}</span>
                                <small>PIX · Cartão · Boleto</small>
                            </button>` : ''}
                    </div>
                    ${precoReal ? `<div class="loja-card-secure">🔒 Pagamento processado no ambiente seguro do PagBank</div>` : ''}
                </div>
            </div>
        `;
    });

    grid.innerHTML = html;
}

// Valor em centavos do item: canônico `valorReal` (inteiro), fallback `valorRs` (legado)
function getItemValorCentavos(item) {
    if (Number.isInteger(item.valorReal) && item.valorReal > 0) return item.valorReal;
    const rs = Number(item.valorRs);
    if (Number.isFinite(rs) && rs > 0) return Math.round(rs * 100);
    return 0;
}

let currentCheckoutMode = 'frag'; // 'frag' | 'dinheiro' | 'pagbank'

// Meio de pagamento em dinheiro real da Loja:
//   'dinheiro' → jogador faz o pedido e o mestre confirma o recebimento no painel
//   'pagbank'  → checkout online (só volta a valer depois da homologação do PagBank)
const MODO_PAGAMENTO_REAL = 'dinheiro';

// Dados mostrados no checkout em dinheiro
const PIX_CHAVE = '62991156283';
const PIX_TITULAR = 'Igor Estevam Alves de Souza';

function cartaoPixHtml() {
    return `
        <div style="margin-top:12px;padding:12px 14px;background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.25);border-radius:10px;">
            <div style="display:flex;align-items:center;gap:6px;font-weight:700;color:var(--lr-nature);font-size:0.8rem;letter-spacing:.02em;text-transform:uppercase;margin-bottom:8px;">
                <span>💠</span> Pagamento por PIX
            </div>
            <div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;">
                <span style="font-size:0.8rem;color:var(--muted);">Chave (telefone)</span>
                <strong style="font-family:monospace;font-size:0.95rem;color:#fff;letter-spacing:.02em;">${escapeHtml(PIX_CHAVE)}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-top:4px;">
                <span style="font-size:0.8rem;color:var(--muted);">Titular</span>
                <strong style="font-size:0.9rem;color:#fff;">${escapeHtml(PIX_TITULAR)}</strong>
            </div>
            <div style="font-size:0.78rem;color:var(--muted);margin-top:10px;border-top:1px solid rgba(255,255,255,0.1);padding-top:8px;">
                Também aceito em dinheiro na mesa. Assim que o pagamento for confirmado, o item cai automaticamente no seu Repertório.
            </div>
        </div>
    `;
}

// ⚠️ Substitua pela sua Site Key do reCAPTCHA v3 (a MESMA usada no menu.html).
const RECAPTCHA_SITE_KEY = '6Lc3_lUtAAAAAFhlPCUXgJSdL3zLnzFUwx_ZbIzT';

// Gera um token reCAPTCHA v3 para a ação informada. Retorna '' se o
// reCAPTCHA não carregou (rede/offline) — o servidor decide se aceita.
async function getRecaptchaToken(action) {
    try {
        if (typeof grecaptcha === 'undefined' || !grecaptcha.execute) return '';
        await new Promise(resolve => grecaptcha.ready(resolve));
        return await grecaptcha.execute(RECAPTCHA_SITE_KEY, { action });
    } catch (e) {
        console.warn('reCAPTCHA indisponível:', e);
        return '';
    }
}

// Abre o modal de confirmação de compra (usado pelos dois meios de pagamento)
function openCheckoutModal(item, mode) {
    currentCheckoutItem = item;
    currentCheckoutMode = mode;

    const isPagBank = mode === 'pagbank';
    const valorCentavos = getItemValorCentavos(item);
    const precoLabel = isReal
        ? `<span style="color:var(--lr-nature);font-weight:700;">R$ ${(valorCentavos / 100).toFixed(2).replace('.', ',')}</span>`
        : `<span style="color:#6366f1;font-weight:700;">${item.valorFrag} Frag$</span>`;

    const infoDiv = document.getElementById('lojaCheckoutItemInfo');
    infoDiv.innerHTML = `
        <div style="display:flex;gap:12px;align-items:center;">
            ${item.imagem ? `<img src="${escapeHtml(item.imagem)}" alt="" style="width:64px;height:64px;object-fit:cover;border-radius:8px;flex-shrink:0;background:rgba(0,0,0,0.3);" onerror="this.remove();">` : ''}
            <div style="flex:1;">
                <div style="font-weight:700;color:var(--primary);font-size:1.1rem;margin-bottom:4px;">${escapeHtml(item.nome)}</div>
                <div style="font-size:0.9rem;color:var(--muted);">Custo: <span id="lojaCheckoutPriceDisplay">${precoLabel}</span></div>
            </div>
            <div style="display:flex;flex-direction:column;align-items:center;">
                <label for="lojaCheckoutQuantity" style="font-size:0.75rem;color:var(--muted);margin-bottom:2px;font-weight:700;">Quantidade</label>
                <input type="number" id="lojaCheckoutQuantity" value="1" min="1" max="99" oninput="updateCheckoutTotal()" style="width:60px;text-align:center;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);color:#fff;border-radius:6px;padding:4px;font-family:var(--font);font-size:0.9rem;font-weight:600;">
            </div>
        </div>
        ${isPagBank ? `<div style="font-size:0.8rem;color:var(--muted);margin-top:10px;border-top:1px solid rgba(255,255,255,0.08);padding-top:8px;">🔒 Você será redirecionado ao ambiente <strong>seguro do PagBank</strong> para pagar com PIX, Cartão ou Boleto. O item é entregue automaticamente após a confirmação do pagamento.</div>` : ''}
    `;

    const metaSelector = document.getElementById('lojaCheckoutMetaSelector');
    const metaList = document.getElementById('lojaCheckoutMetaList');

    if (item.modoSelecaoMeta) {
        metaSelector.style.display = 'block';
        metaList.innerHTML = '';
        const limit = item.qtdSelecaoMeta || item.quantidadeMetasSelecionaveis || 1;
        metaSelector.firstElementChild.textContent = `Escolha até ${limit} Meta(s) para atrelar o apoio:`;
        const allowedMetasIds = item.metasVinculadas || [];
        const allowedMetas = metasData.filter(m => allowedMetasIds.includes(m.id));

        if (allowedMetas.length === 0) {
            metaList.innerHTML = '<div style="color:var(--muted);font-size:0.9rem;">Nenhuma meta vinculada configurada pelo mestre.</div>';
        } else {
            allowedMetas.forEach(meta => {
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

    const btn = document.getElementById('btnConfirmPurchase');
    btn.innerHTML = isPagBank ? '💳 Ir para o Pagamento' : '✔️ Confirmar Compra';

    document.getElementById('lojaCheckoutModal').style.display = 'flex';
}

window.updateCheckoutTotal = function () {
    if (!currentCheckoutItem) return;
    const qtyInput = document.getElementById('lojaCheckoutQuantity');
    if (!qtyInput) return;

    let qty = parseInt(qtyInput.value) || 1;
    if (qty < 1) qty = 1;
    if (qty > 99) qty = 99;

    const isPagBank = currentCheckoutMode === 'pagbank';
    const valorCentavos = getItemValorCentavos(currentCheckoutItem);
    const totalCentavos = valorCentavos * qty;

    const priceDisplay = document.getElementById('lojaCheckoutPriceDisplay');
    if (priceDisplay) {
        if (isReal) {
            priceDisplay.innerHTML = `<span style="color:var(--lr-nature);font-weight:700;">R$ ${(totalCentavos / 100).toFixed(2).replace('.', ',')}</span>`;
        } else {
            priceDisplay.innerHTML = `<span style="color:#6366f1;font-weight:700;">${currentCheckoutItem.valorFrag * qty} Frag$</span>`;
        }
    }
};

// Coleta as metas marcadas no modal; retorna null se exceder o limite
function collectSelectedMetas(item) {
    if (!item.modoSelecaoMeta) return [];
    const limit = item.qtdSelecaoMeta || item.quantidadeMetasSelecionaveis || 1;
    const checkboxes = document.querySelectorAll('.loja-checkout-meta-chk:checked');
    if (checkboxes.length > limit) {
        showAlert(`❌ Você pode escolher no máximo ${limit} meta(s).`, 'warning');
        return null;
    }
    return [...checkboxes].map(c => c.value);
}

window.openCheckoutFrag = async function (itemId) {
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
    } catch (e) { }

    openCheckoutModal(item, 'frag');
};

window.openCheckoutPagBank = function (itemId) {
    const item = lojaItensData.find(i => i.id === itemId);
    if (!item) return;
    openCheckoutModal(item, 'pagbank');
};

window.confirmPurchaseFrag = async function () {
    if (!currentCheckoutItem) return;
    const item = currentCheckoutItem;

    const qtyInput = document.getElementById('lojaCheckoutQuantity');
    let quantidade = qtyInput ? parseInt(qtyInput.value) : 1;
    if (isNaN(quantidade) || quantidade < 1) quantidade = 1;
    if (quantidade > 99) quantidade = 99;

    // Pré-checagem de UX — a validação de verdade acontece no servidor
    const selectedMetas = collectSelectedMetas(item);
    if (selectedMetas === null) return;

    const btn = document.getElementById('btnConfirmPurchase');
    btn.disabled = true;
    btn.innerHTML = 'Processando...';

    // ---- Fluxo PagBank: cria o checkout no servidor e redireciona ----
    if (currentCheckoutMode === 'pagbank') {
        try {
            showAlert('⏳ Gerando pagamento seguro no PagBank...', 'info');
            const recaptchaToken = await getRecaptchaToken('comprar_loja');
            const criarCheckout = httpsCallable(functions, 'criarCheckoutPagBank');
            const result = await criarCheckout({ itemId: item.id, selectedMetas, quantidade, recaptchaToken });
            window.location.href = result.data.paymentUrl; // ambiente seguro do PagBank
            return; // a página vai navegar; não reabilita o botão
        } catch (error) {
            console.error('Erro ao criar checkout:', error);
            showAlert(`❌ Não foi possível iniciar o pagamento: ${error.message}`, 'danger');
            btn.disabled = false;
            btn.innerHTML = '💳 Ir para o Pagamento';
            return;
        }
    }

    // ---- Fluxo Frag$ (inalterado no geral, mas envia quantidade) ----
    try {
        const comprar = httpsCallable(functions, 'comprarComFragmentos');
        const result = await comprar({ itemId: item.id, selectedMetas, quantidade });

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

// =============================================
// RETORNO DO PAGBANK (?compra=...)
// Nenhum benefício é aplicado aqui — a entrega é exclusiva
// do webhook no servidor (PIX confirma em segundos; boleto pode levar dias).
// =============================================
(function verificarRetornoCompra() {
    const params = new URLSearchParams(window.location.search);
    if (!params.get('compra')) return;
    showAlert(
        '✅ Pagamento em processamento! Assim que o PagBank confirmar, o item aparecerá ' +
        'automaticamente no seu Repertório e você receberá uma notificação.',
        'success',
        10000
    );
    const url = new URL(window.location.href);
    url.searchParams.delete('compra');
    window.history.replaceState({}, '', url);
})();
