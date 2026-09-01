// =============================================
// MENU FIREBASE — Lendas e Relíquias (ficha-v1.7_1)
// Auth, character list (coleção 'char'), notifications, inventory
// =============================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, sendEmailVerification } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
    getFirestore,
    collection,
    query,
    where,
    getDocs,
    getDoc,
    updateDoc,
    addDoc,
    setDoc,
    doc,
    onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js';
import { somarApoiosDoJogador, somarMetaTotais, progressoDasEtapas, proximaEtapa, valorApoio, parseMetaIds, resolveMetaId } from '../../shared/apoios-calc.js';
import { confirmar, toast } from '../../shared/dialogo.js?v=2';

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

// Compartilha as instâncias com módulos irmãos (menu-wiki.js usa window.db,
// mesmo padrão do livro-vinculado.js no resto do site).
window.db = db;
window.auth = auth;
// A janela da Roleta (menu-roleta.js) chama a callable pela mesma instância,
// em vez de inicializar um segundo Firebase só para ela.
window.lrFunctions = functions;

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

// ===== SALDO DE GIROS DA ROLETA (exibição) =====
// Espelho do saldo de Fragmentos: o número vive em `users/{doc}.giros`, é
// escrito só pelo servidor, e aqui só aparece.
function updateGirosDisplay(valor) {
    const badge = document.getElementById('girosBadge');
    const n = Number(valor) || 0;
    if (badge) {
        badge.textContent = n;
        badge.style.display = n > 0 ? '' : 'none';
    }
    // A janela da roleta, se estiver aberta, mostra o mesmo saldo por dentro
    const dentro = document.getElementById('roletaSaldo');
    if (dentro) dentro.textContent = n;
}
window.updateGirosDisplay = updateGirosDisplay;

// ===== SALDO DE RE-ROLAGENS (exibição) =====
// Mesmo desenho dos giros: o número vive em `users/{doc}.rerolagens`, é escrito
// só pelo servidor, e é gasto no Tabuleiro — aqui é só a vitrine do saldo.
function updateRerolagensDisplay(valor) {
    const chip = document.getElementById('rerolagensWallet');
    const n = Number(valor) || 0;
    const el = document.getElementById('rerolagensValue');
    if (el) el.textContent = n.toLocaleString('pt-BR');
    if (chip) chip.style.display = n > 0 ? '' : 'none';
}
window.updateRerolagensDisplay = updateRerolagensDisplay;

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

        // loadNotifications acabou de resolver o userDocRef; daqui em diante
        // o doc do usuário é observado e a página se atualiza sozinha.
        iniciarTempoReal();

        // Check for mestre or criador role and show respective buttons
        try {
            const userDoc = await findUserDoc();
            if (userDoc) {
                const data = userDoc.data();
                const role = data.role;

                updateFragDisplay(data.fragmentos || 0);
                updateGirosDisplay(data.giros || 0);
                updateRerolagensDisplay(data.rerolagens || 0);

                const btnMestre = document.getElementById('btnPainelMestre');
                const btnCriador = document.getElementById('btnPainelCriador');
                const btnWorldbuilding = document.getElementById('btnWorldbuilding');

                if (role === 'mestre') {
                    if (btnMestre) btnMestre.style.display = '';
                } else if (role === 'criador') {
                    if (btnMestre) btnMestre.style.display = '';
                    if (btnCriador) btnCriador.style.display = '';
                    if (btnWorldbuilding) btnWorldbuilding.style.display = '';
                    // aba de configuração do Portal (upload do hero etc.)
                    const tabCfg = document.getElementById('tabPortalCfg');
                    if (tabCfg) tabCfg.style.display = '';
                    document.dispatchEvent(new CustomEvent('portal:criador'));
                }
                window.portalRole = role;
            }
        } catch (e) { /* ignore */ }

        // Esconder loading, mostrar conteúdo (e esconder o login embutido)
        if (loadingScreen) loadingScreen.style.display = 'none';
        if (toolbar) toolbar.style.display = '';
        if (wrap) wrap.style.display = '';
        const secaoLogin = document.getElementById('secaoLogin');
        if (secaoLogin) secaoLogin.hidden = true;
        const btnEntrar = document.getElementById('btnEntrarTop');
        if (btnEntrar) btnEntrar.hidden = true;
        document.body.classList.add('portal-logado');
        document.body.classList.remove('portal-deslogado');
        atalhosNoLugar();
        document.dispatchEvent(new CustomEvent('portal:logado'));
        avisarEmailNaoVerificado(user);
    } else {
        // Não autenticado → SEM redirect: a própria página vira o login.
        currentUser = null;
        // O observador do doc morre junto com a sessão, senão ele segue
        // tentando ler um doc que as rules não deixam mais.
        if (_pararTempoReal) { _pararTempoReal(); _pararTempoReal = null; }
        _idsNotifVistos = null;
        userDocRef = null;
        if (loadingScreen) loadingScreen.style.display = 'none';
        if (toolbar) toolbar.style.display = 'none';
        if (wrap) wrap.style.display = 'none';
        const secaoLogin = document.getElementById('secaoLogin');
        if (secaoLogin) secaoLogin.hidden = false;
        const btnEntrar = document.getElementById('btnEntrarTop');
        if (btnEntrar) btnEntrar.hidden = false;
        document.body.classList.add('portal-deslogado');
        document.body.classList.remove('portal-logado');
        document.dispatchEvent(new CustomEvent('portal:deslogado'));
    }
});

/* Os atalhos de cargo (Mapa, Mestre, Criador, Worldbuilding) não cabem na linha
   da conta num celular: com o alvo de toque de 40px que a folha garante, quatro
   deles mais a marca, a carteira, o tema e o sair passam de 375px — e o flex
   esmagava a MARCA até virar "Lend…". No estreito eles vão para o fim da faixa
   de navegação, que já rola por dentro. */
const _estreito = window.matchMedia('(max-width: 640px)');

function atalhosNoLugar() {
    const grupo = document.querySelector('.portal-atalhos');
    const abas = document.getElementById('tabBar');
    const barra = document.querySelector('.portal-topo .toolbar');
    if (!grupo || !abas || !barra) return;
    const destino = _estreito.matches ? abas : barra;
    // Na barra da conta ele volta para antes do nome, não para o fim.
    if (grupo.parentElement === destino) return;
    if (destino === barra) barra.insertBefore(grupo, document.getElementById('userDisplayName'));
    else destino.appendChild(grupo);
}

_estreito.addEventListener('change', atalhosNoLugar);
// exposto para a conferência de layout (__check-portal-raiz.html)
window.atalhosNoLugar = atalhosNoLugar;

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

        /* O RETRATO manda no cartão, e o nome vive por cima dele, num véu —
           é a mesma leitura da capa de livro na estante do Cânone: a arte é o
           que se reconhece, o texto só confirma. Sem retrato, a inicial no
           lugar; nada de cartão meio vazio. */
        const inicial = escapeHtml(nome.trim().charAt(0).toUpperCase() || '?');
        const retrato = imgSrc
            ? `<img class="pj-retrato" src="${imgSrc}" alt="" loading="lazy">`
            : `<div class="pj-retrato pj-retrato--sem"><span>${inicial}</span></div>`;

        return `
            <article class="character-card" onclick="selectCharacter('${char.id}')"
                title="Abrir a ficha de ${escapeHtml(nome)}">
                <div class="pj-arte">
                    ${retrato}
                    <div class="pj-veu"></div>
                    <div class="pj-identidade">
                        <div class="character-name">${escapeHtml(nome)}</div>
                        <div class="character-class">${escapeHtml(raca)} · ${escapeHtml(classe)}</div>
                    </div>
                    <button class="pj-apagar" title="Apagar personagem"
                        onclick="event.stopPropagation(); openDeleteModal('${char.id}', '${escapeHtml(nome).replace(/'/g, "\'")}')">
                        <svg class="lr-ico"><use href="#i-lixeira" /></svg></button>
                </div>

                <div class="pj-pe">
                    <div class="pj-numeros">
                        <span title="Experiência total"><b>${expTotal}</b> EXP</span>
                        <span title="Sessões jogadas"><b>${sessoes}</b> ${sessoes === 1 ? 'sessão' : 'sessões'}</span>
                    </div>
                    <button class="btn-play" onclick="event.stopPropagation(); selectCharacter('${char.id}')">Jogar</button>
                    <div class="character-footer">Última atualização: ${lastUpdate}</div>
                </div>
            </article>
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
        window.location.href = '/criar-personagem/criacao.html';
    }
};

window.selectMesaForCreation = function (mesaId) {
    const modal = document.getElementById('createCharModal');
    if (modal) modal.remove();

    if (mesaId) {
        window.location.href = `/criar-personagem/criacao.html?mesaId=${mesaId}`;
    } else {
        window.location.href = '/criar-personagem/criacao.html';
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
        window.location.href = `/ficha-v1.7_1/ficha-v1.7_1.html?id=${docRef.id}`;
    } catch (error) {
        console.error('❌ Erro ao criar ficha em branco:', error);
        showAlert('❌ Erro ao criar ficha: ' + error.message, 'danger');
    }
};

// ===== SELECIONAR PERSONAGEM =====
window.selectCharacter = function (characterId) {
    window.location.href = `/ficha-v1.7_1/ficha-v1.7_1.html?id=${characterId}`;
};

// ===== CARREGAR INVENTÁRIO =====
// `dadosProntos` vem do observador de tempo real: quando o snapshot já está na
// mão, buscar o documento de novo seria pagar duas leituras pela mesma coisa.
async function loadInventory(dadosProntos) {
    try {
        let userData = dadosProntos;
        if (!userData) {
            const userSnapshot = await findUserDoc();
            if (!userSnapshot) {
                document.getElementById('totalApoios').textContent = '0';
                document.getElementById('inventoryGrid').innerHTML = '';
                document.getElementById('emptyInventory').style.display = 'block';
                return;
            }
            userData = userSnapshot.data();
        }
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
            _repDetalhes = [];
            _repExp = [];
            _repMesa = [];
            grid.innerHTML = inventario.map(item => {
                const imgHtml = item.imagem
                    ? `<div class="loja-card-media">
                           <img src="${escapeHtml(item.imagem)}" alt="${escapeHtml(item.nome || 'Item')}" loading="lazy"
                                onerror="this.parentElement.classList.add('inventory-media-fallback');this.remove();">
                       </div>`
                    : `<div class="loja-card-media inventory-media-fallback"></div>`;

                const tagsHtml = etiquetasDoItem(item);

                /* A quantidade vai NA ARTE, como o número numa etiqueta de
                   prateleira: no título ela disputava a linha e empurrava o
                   nome do item. Só aparece a partir de 2 — "x1" é ruído. */
                const qtd = Number(item.quantidade) || 0;
                const desc = String(item.descricao || item['descrição'] || '');
                /* A ficha completa de um amuleto tem trinta linhas — tipo, peso,
                   dureza, integridade, propriedades. Num cartão de grade isso
                   estica a coluna inteira e afunda os vizinhos. O cartão mostra
                   o começo; o resto abre numa janela, que é onde texto longo
                   cabe. `_repDetalhes` guarda o descritor e o clique só carrega
                   o índice. */
                const i = _repDetalhes.push({
                    nome: item.nome || 'Item sem nome',
                    icone: '🎒',
                    descricao: desc,
                    nota: item.formaRecebimento ? `Recebimento: ${item.formaRecebimento}` : '',
                }) - 1;
                const longa = desc.length > 180;

                /* Item de EXP deixa de ser enfeite: daqui sai o botão que
                   aplica o EXP numa ficha. `_repExp` guarda o que o botão
                   precisa, porque nome de item tem apóstrofo (Ka'Lunis) e não
                   sobrevive dentro de um onclick. */
                const porUnidade = item.isExp ? (parseInt(item.expAmount, 10) || 0) : 0;
                const eExp = porUnidade > 0 && qtd > 0;
                if (eExp) _repExp[i] = { nome: item.nome, porUnidade, quantidade: qtd, vip: !!item.isExpVip };

                /* Qualquer peça com unidade pode ir para uma mesa — é o mestre
                   quem decide o que ela vira em jogo. Giro de roleta fica de
                   fora: ele já virou saldo, não é peça. */
                const podeIrParaMesa = qtd > 0 && !item.isRoleta;
                if (podeIrParaMesa) _repMesa[i] = { nome: item.nome, quantidade: qtd };

                return `
                <div class="loja-card${longa ? ' rep-abrivel' : ''}"
                    ${longa ? `onclick="abrirDetalheItem(${i})" title="Ver a ficha completa"` : ''}>
                    <div class="loja-card-arte">
                        ${imgHtml}
                        ${qtd > 1 ? `<span class="rep-qtd" title="Você tem ${qtd}">×${qtd}</span>` : ''}
                    </div>
                    <div class="loja-card-body">
                        <div class="loja-card-title">${escapeHtml(item.nome || 'Item sem nome')}</div>
                        ${desc ? `<div class="loja-card-desc${longa ? ' rep-desc-curta' : ''}">${escapeHtmlWithBreaks(desc)}</div>` : ''}
                        ${longa ? '<div class="rep-mais">🔎 Clique para ver a ficha completa</div>' : ''}
                        ${tagsHtml ? `<div class="loja-card-tags">${tagsHtml}</div>` : ''}
                        ${eExp || podeIrParaMesa ? `<div class="rep-acoes">
                            ${eExp ? `
                            <button class="loja-btn loja-btn-real rep-usar"
                                onclick="event.stopPropagation();abrirAplicarExp(${i})"
                                title="Somar este EXP na ficha de um personagem seu">
                                ⭐ Aplicar ${porUnidade} EXP</button>` : ''}
                            ${podeIrParaMesa ? `
                            <button class="loja-btn loja-btn-frag rep-usar"
                                onclick="event.stopPropagation();abrirEnviarParaMesa(${i})"
                                title="Mandar para o mestre colocar na mesa">
                                🎁 Mandar para a mesa</button>` : ''}
                        </div>` : ''}
                        <div class="rep-recebimento">
                            <span>Recebimento</span>
                            <strong>${escapeHtml(item.formaRecebimento || 'a combinar')}</strong>
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
// A Roleta chama isto para o prêmio aparecer no Repertório sem recarregar a página
window.loadInventory = loadInventory;

/* As cinco etiquetas do item da Loja e do Repertório.
   Eram cinco `background:` em hexadecimal INLINE, um por tipo — cinco cores
   saturadas fora da paleta, repetidas em dois lugares do arquivo. Agora é uma
   classe por tipo, tingida com o token do próprio significado (ouro para EXP,
   abissal para a roleta, sangue para o re-roll, natureza para o narrativo). */
const ETIQUETAS = [
    { quando: (i) => i.isExp, classe: 'exp', texto: (i) => `⭐ ${i.expAmount} EXP${i.isExpVip ? ' · VIP' : ''}` },
    { quando: (i) => i.isRoleta, classe: 'roleta', texto: (i) => `🎰 +${i.roletaGiros} giro${i.roletaGiros > 1 ? 's' : ''}` },
    { quando: (i) => i.isRerolagem, classe: 'reroll', texto: (i) => `🎲 Re-roll ${i.rerolagensAmount}×` },
    { quando: (i) => i.isNarrativo, classe: 'narrativo', texto: () => '📜 Benefício narrativo' },
    {
        quando: (i) => i.isItemPersonagem && i.personagemItensVinculados?.length,
        classe: 'equip', texto: () => '🎒 Equipamentos especiais',
    },
];

function etiquetasDoItem(item) {
    return ETIQUETAS.filter(e => e.quando(item))
        .map(e => `<span class="loja-tag loja-tag--${e.classe}">${escapeHtml(e.texto(item))}</span>`)
        .join('');
}

/* Fichas completas dos itens do Repertório — o clique carrega só o índice.
   Reaproveita a janela de shared/detalhe.js, a mesma que abre a fórmula de um
   Valor Derivado: `<dialog>` nativo, altura limitada e rolagem por dentro, que
   é o que uma ficha de trinta linhas precisa. */
let _repDetalhes = [];
let _repExp = [];
let _repMesa = [];

window.abrirDetalheItem = function (i) {
    const o = _repDetalhes[i];
    if (o && window.LRDetalhe) window.LRDetalhe.abrirDetalhe(o);
};

/* ===== MANDAR ITEM PARA UMA MESA =====
   A peça sai do Repertório e cai na Caixa do Mestre da mesa escolhida, com um
   aviso: o mestre precisa dar um lugar a ela no mundo. Quem move é o servidor
   — `inventario` é campo protegido, e a peça só pode sair de um lado se
   entrar no outro. */
window.abrirEnviarParaMesa = async function (i) {
    const alvo = _repMesa[i];
    if (!alvo) return;

    // As mesas do jogador vêm de `mesas.jogadores`, que é o vínculo confiável.
    // A mesa gravada na ficha aponta para mesas que já não existem.
    let minhasMesas = [];
    try {
        const snap = await getDocs(collection(db, 'mesas'));
        snap.forEach(d => {
            if ((d.data().jogadores || []).includes(currentUser.uid)) {
                minhasMesas.push({ id: d.id, nome: d.data().nome || 'Mesa sem nome' });
            }
        });
    } catch (e) {
        showAlert('❌ Não foi possível carregar suas mesas.', 'danger');
        return;
    }

    if (minhasMesas.length === 0) {
        showAlert('❌ Você não participa de nenhuma mesa ainda.', 'warning');
        return;
    }

    const janela = document.createElement('dialog');
    janela.className = 'lr-dialogo';
    janela.innerHTML = `
        <form class="lr-dialogo-form" method="dialog">
            <div class="lr-dialogo-titulo">🎁 Mandar ${escapeHtml(alvo.nome)} para a mesa</div>
            <p class="lr-dialogo-msg">
                A peça sai do seu Repertório e vai para o mestre, que decide como ela
                entra na história. Você tem ${alvo.quantidade}.
            </p>
            <label for="mesaAlvo" style="font-size:.8rem;font-weight:700;">Para qual mesa?</label>
            <select id="mesaAlvo" class="lr-dialogo-input">
                ${minhasMesas.map(m => `<option value="${escapeHtml(m.id)}">${escapeHtml(m.nome)}</option>`).join('')}
            </select>
            <label for="mesaQtd" style="font-size:.8rem;font-weight:700;">Quantas unidades?</label>
            <input id="mesaQtd" class="lr-dialogo-input" type="number" min="1"
                max="${alvo.quantidade}" value="1" inputmode="numeric">
            <div class="lr-dialogo-botoes">
                <button type="submit" value="ok" class="lr-dialogo-ok">Mandar</button>
                <button type="button" class="lr-dialogo-cancel">Cancelar</button>
            </div>
        </form>`;
    document.body.appendChild(janela);

    const escolha = await esperarDecisao(janela);

    const mesaId = janela.querySelector('#mesaAlvo').value;
    const quantidade = Math.max(1, Math.min(alvo.quantidade,
        parseInt(janela.querySelector('#mesaQtd').value, 10) || 1));
    janela.remove();
    if (escolha !== 'ok') return;

    try {
        const enviar = httpsCallable(functions, 'enviarItemParaMesa');
        const r = (await enviar({ itemNome: alvo.nome, mesaId, quantidade })).data;
        showAlert(
            `🎁 ${r.quantidade}x ${alvo.nome} foi para a mesa ${r.mesa}. ` +
            'O mestre foi avisado e vai colocar a peça no mundo.', 'success', 9000);
        await loadInventory();
    } catch (e) {
        console.error('Erro ao mandar item para a mesa:', e);
        showAlert(`❌ ${e.message}`, 'danger', 7000);
    }
};

/* ===== APLICAR EXP NUMA FICHA =====
   O item de EXP ficava parado no Repertório e o número era somado na ficha à
   mão. Aqui o jogador escolhe o personagem e a quantidade; quem soma e quem
   baixa a unidade é o servidor, porque `inventario` é campo protegido. */
window.abrirAplicarExp = async function (i) {
    const alvo = _repExp[i];
    if (!alvo) return;

    if (characters.length === 0) {
        showAlert('❌ Você não tem nenhum personagem para receber o EXP.', 'warning');
        return;
    }

    const opcoes = characters.map(c => {
        const f = c.fields || {};
        const nome = f.nome || c.nome || 'Sem nome';
        const total = parseInt(f.exp_total, 10) || 0;
        const livre = parseInt(f.exp, 10) || 0;
        return `<option value="${escapeHtml(c.id)}">${escapeHtml(nome)} — ${livre} livres / ${total} total</option>`;
    }).join('');

    /* Mesmas classes do diálogo compartilhado (shared/dialogo.css): a janela
       nasce com a identidade do site sem CSS novo. O <select> e o rótulo não
       existem lá, então levam o estilo do próprio input. */
    const janela = document.createElement('dialog');
    janela.className = 'lr-dialogo';
    janela.innerHTML = `
        <form class="lr-dialogo-form" method="dialog">
            <div class="lr-dialogo-titulo">⭐ Aplicar ${escapeHtml(alvo.nome)}</div>
            <p class="lr-dialogo-msg">
                Cada unidade vale <strong>${alvo.porUnidade} EXP</strong>${alvo.vip ? ' (VIP)' : ''}.
                Você tem ${alvo.quantidade}.
            </p>
            <label for="expChar" style="font-size:.8rem;font-weight:700;">Em qual personagem?</label>
            <select id="expChar" class="lr-dialogo-input">${opcoes}</select>
            <label for="expQtd" style="font-size:.8rem;font-weight:700;">Quantas unidades?</label>
            <input id="expQtd" class="lr-dialogo-input" type="number" min="1"
                max="${alvo.quantidade}" value="1" inputmode="numeric">
            <div id="expTotalPrevia" style="font-weight:700;color:var(--lr-gold);">
                Vai somar ${alvo.porUnidade} EXP</div>
            <div class="lr-dialogo-botoes">
                <button type="submit" value="ok" class="lr-dialogo-ok">Aplicar</button>
                <button type="button" class="lr-dialogo-cancel">Cancelar</button>
            </div>
        </form>`;
    document.body.appendChild(janela);

    const campoQtd = janela.querySelector('#expQtd');
    const previa = janela.querySelector('#expTotalPrevia');
    const atualizarPrevia = () => {
        const n = Math.max(1, Math.min(alvo.quantidade, parseInt(campoQtd.value, 10) || 1));
        previa.textContent = `Vai somar ${n * alvo.porUnidade} EXP`;
    };
    campoQtd.addEventListener('input', atualizarPrevia);

    const escolha = await esperarDecisao(janela);

    const charId = janela.querySelector('#expChar').value;
    const quantidade = Math.max(1, Math.min(alvo.quantidade, parseInt(campoQtd.value, 10) || 1));
    janela.remove();
    if (escolha !== 'ok') return;

    try {
        const aplicar = httpsCallable(functions, 'aplicarExpDoItem');
        const r = await aplicar({ itemNome: alvo.nome, charId, quantidade });
        showAlert(
            `⭐ ${r.data.ganho} EXP aplicados! O personagem ficou com ${r.data.exp} livres ` +
            `de ${r.data.expTotal} no total.`, 'success', 8000);
        await loadInventory();
        await loadCharacters();
    } catch (e) {
        console.error('Erro ao aplicar EXP:', e);
        showAlert(`❌ ${e.message}`, 'danger', 7000);
    }
};

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

/* ===== TEMPO REAL =====
   O doc do usuário é UMA coisa: saldo de Frag$, giros, Repertório e
   notificações moram juntos. Um observador só cobre tudo — a compra aprovada
   pelo webhook, o prêmio da roleta, a devolução do mestre: aparecem na tela na
   hora, sem recarregar a página. */
let _pararTempoReal = null;
let _idsNotifVistos = null;

function iniciarTempoReal() {
    if (_pararTempoReal || !userDocRef) return;
    _pararTempoReal = onSnapshot(userDocRef, (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();

        updateFragDisplay(data.fragmentos || 0);
        updateGirosDisplay(data.giros || 0);
        updateRerolagensDisplay(data.rerolagens || 0);

        userNotifications = (data.notifications || [])
            .map(normalizeNotification)
            .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        /* Notificação que CHEGOU com a página aberta vira toast — o sino
           acender sozinho ninguém vê; o toast é o "em tempo real" de verdade.
           No primeiro quadro não: seria repetir tudo que já estava lá. */
        if (_idsNotifVistos) {
            for (const n of userNotifications) {
                if (n.isNew && !_idsNotifVistos.has(n.id)) showAlert(n.message, 'success', 8000);
            }
        }
        _idsNotifVistos = new Set(userNotifications.map(n => n.id));

        updateNotificationBadge();
        renderNotifications();
        // O Repertório redesenha do MESMO snapshot: zero leitura extra.
        loadInventory(data);
    }, (e) => {
        console.warn('tempo real indisponível, a página segue no modo de recarga:', e);
    });
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

        /* Varre `users_public`, não `users`: a soma é coletiva e precisa do
           apoio de todo mundo, mas ninguém precisa do e-mail, do saldo nem do
           histórico de compras dos outros para somar. O espelho traz os apoios
           no mesmo formato, então `somarMetaTotais` é a mesma de sempre.
           ponytail: soma no cliente varrendo a coleção. Serve para uma mesa de
           dezenas de jogadores; virando centenas, trocar por um contador
           agregado mantido por Cloud Function. */
        const snapUsers = await getDocs(collection(db, 'users_public'));
        const users = snapUsers.docs.map(d => ({ id: d.id, ...d.data() }));
        const totais = somarMetaTotais(users, metasData);

        // Contribuição pessoal: o espelho é indexado por uid, então é o meu doc.
        const meuDoc = users.find(u => u.id === currentUser.uid);
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

    /* A animação de entrada é o topo do Cânone, mas mora FORA do container da
       mesa — é o que a deixa ir de ponta a ponta sem truque de largura. Some
       nas outras abas, que não são apresentação. */
    const hero = document.getElementById('heroTrilho');
    if (hero) hero.hidden = tabName !== 'home';

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

    /* Quanto de EXP VIP o personagem carrega, e quanto disso volta. O número
       vem do próprio doc da ficha (`expVip`), que o assistente de criação já
       gravava e a aplicação de EXP passou a somar. */
    const ficha = characters.find(c => c.id === characterId) || {};
    const vip = Number(ficha.expVip) || 0;
    const devolve = Math.round(vip * 0.6);
    const caixa = document.getElementById('encerrarExpVip');
    if (caixa) {
        caixa.innerHTML = vip > 0
            ? `⭐ Este personagem recebeu <strong>${vip} EXP VIP</strong>.
               Encerrando, <strong>${devolve} EXP</strong> voltam para o seu Repertório,
               prontos para outro personagem.`
            : `<span class="encerrar-vip-nada">⭐ Nenhum EXP VIP foi aplicado neste personagem,
               então não há EXP para devolver.</span>`;
    }

    // A opção segura é a que vem marcada — apagar tem de ser escolha, não inércia.
    const padrao = document.querySelector('input[name="encerrarDestino"][value="mestre"]');
    if (padrao) padrao.checked = true;
    sincronizarEscolhaEncerrar();

    document.getElementById('deleteModal').classList.add('active');
};

/* Espera a decisão de um <dialog> SEM depender do evento `close`: há navegador
   em que o submit de um form method="dialog" fecha a janela e o `close` nunca
   dispara — a promessa ficava pendurada e o clique no OK não fazia nada. O
   mesmo padrão do shared/dialogo.js: submit + clique no Cancelar + Esc. */
function esperarDecisao(janela) {
    return new Promise(resolve => {
        let respondido = false;
        const terminar = (v) => {
            if (respondido) return;
            respondido = true;
            try { if (janela.open) janela.close(); } catch (e) { /* já fechada */ }
            resolve(v);
        };
        janela.querySelector('form').addEventListener('submit', (e) => {
            e.preventDefault();
            terminar('ok');
        });
        janela.querySelector('.lr-dialogo-cancel')?.addEventListener('click', (e) => {
            e.preventDefault();
            terminar('');
        });
        janela.addEventListener('cancel', () => terminar(''));   // Esc
        janela.addEventListener('close', () => terminar(''));    // reforço onde funciona
        janela.showModal();
    });
}

/* A moldura da opção escolhida é uma CLASSE, não `:has(input:checked)`. O
   seletor é mais bonito, mas em teste ele casava e não repintava — e uma janela
   que não mostra o que está selecionado, numa decisão irreversível, é pior do
   que uma linha de JS a mais. */
function sincronizarEscolhaEncerrar() {
    document.querySelectorAll('input[name="encerrarDestino"]').forEach(radio => {
        const caixa = radio.closest('.encerrar-op');
        if (caixa) caixa.classList.toggle('sel', radio.checked);
    });
}

document.addEventListener('change', (e) => {
    if (e.target && e.target.name === 'encerrarDestino') sincronizarEscolhaEncerrar();
});

window.closeDeleteModal = function () {
    characterToDelete = null;
    document.getElementById('deleteModal').classList.remove('active');
};

window.confirmDelete = async function () {
    if (!characterToDelete) return;
    const destino = document.querySelector('input[name="encerrarDestino"]:checked')?.value || 'mestre';

    if (destino === 'apagar' && !await confirmar(
        'Apagar de vez é definitivo: a ficha e os itens dela somem para sempre. Confirma?',
        { perigo: true, ok: 'Apagar mesmo assim' })) return;

    const btn = document.getElementById('btnEncerrar');
    if (btn) { btn.disabled = true; btn.textContent = 'Encerrando...'; }

    try {
        const encerrar = httpsCallable(functions, 'encerrarPersonagem');
        const r = (await encerrar({ charId: characterToDelete, destino })).data;

        try { localStorage.removeItem('lr_ficha_v17_' + characterToDelete); } catch (e) { }

        const sobreExp = r.devolvido > 0
            ? ` ${r.devolvido} EXP VIP voltaram ao seu Repertório.`
            : '';
        showAlert(destino === 'mestre'
            ? `📜 ${r.nome} foi entregue ao mestre e virou NPC.${sobreExp}`
            : `🗑️ ${r.nome} foi apagado.${sobreExp}`, 'success', 9000);

        closeDeleteModal();
        await loadCharacters();
        await loadInventory();
    } catch (error) {
        console.error('Erro ao encerrar personagem:', error);
        showAlert('❌ ' + error.message, 'danger', 7000);
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Confirmar'; }
    }
};

// ===== LOGOUT =====
window.logout = async function () {
    if (await confirmar('🚪 Tem certeza que deseja sair?')) {
        try {
            await signOut(auth);
            // Sem redirect: o onAuthStateChanged mostra o login nesta página.
            window.scrollTo({ top: 0, behavior: 'auto' });
        } catch (error) {
            console.error('Erro ao fazer logout:', error);
            showAlert('❌ Erro ao sair: ' + error.message, 'danger');
        }
    }
};

// ===== HELPERS =====

// Buscar documento do usuário na coleção 'users'
/* O documento do jogador é `users/{uid}`. Ponto.

   Havia uma cascata aqui: procurava pelo campo `uid`, depois pelo campo
   `email`, e só então pelo ID. Os dois primeiros são campos graváveis pelo
   dono do documento — quem escrevesse `uid: <uid de outra pessoa>` no próprio
   doc passava a receber tudo que fosse resolvido para ela, inclusive a entrega
   de uma compra em dinheiro real. E o fallback por e-mail já errava sozinho:
   três contas do Auth dividem o mesmo endereço, e a consulta devolvia
   qualquer uma delas.

   Se o documento não existe (conta criada fora do cadastro), ele nasce aqui —
   vazio, que é exatamente o que uma conta nova é. */
async function findUserDoc() {
    const ref = doc(db, 'users', currentUser.uid);
    const snap = await getDoc(ref);
    if (snap.exists()) return snap;

    try {
        await setDoc(ref, {
            email: currentUser.email,
            displayName: currentUser.displayName || '',
            createdAt: new Date().toISOString()
        });
        return await getDoc(ref);
    } catch (e) {
        console.warn('Não foi possível criar o documento do usuário:', e);
        return null;
    }
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

/* Casca: quem desenha e o toast da mesa (shared/dialogo.js). O terceiro
   argumento (duracao) casa com o do toast, entao as chamadas com tempo
   proprio continuam valendo. */
function showAlert(message, type, duration = 3000) { return toast(message, type, duration); }

/* Escapa TAMBÉM as aspas. O caminho `textContent → innerHTML` que estava aqui
   escapa `<`, `>` e `&`, mas deixa `"` passar inteiro — e este helper é usado
   DENTRO de atributos: `<img src="${escapeHtml(item.imagem)}">`,
   `data-loja-item="${escapeHtml(item.id)}"`. Um valor com aspas fecha o
   atributo e o que vem depois vira marcação. É a mesma versão que
   painel-criador e a ficha já usavam, com a mesma razão anotada lá. */
function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
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
        const tagsHtml = etiquetasDoItem(item);

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
                            <button class="loja-btn loja-btn-frag" onclick="openCheckoutFrag('${item.id}')"
                                title="Comprar com Fragmentos">💎 ${item.valorFrag} Frag$</button>` : ''}
                        ${precoReal ? `
                            <button class="loja-btn loja-btn-real" onclick="openCheckoutReal('${item.id}')"
                                title="PIX · Cartão · Boleto">🛒 R$ ${precoReal}</button>` : ''}
                    </div>
                    ${precoReal ? `<div class="loja-card-secure">🔒 PIX, Cartão ou Boleto — a taxa do meio escolhido entra no carrinho</div>` : ''}
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

let currentCheckoutMode = 'frag'; // 'frag' | 'mercadopago'

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

function rotuloBotaoCompra(mode) {
    if (mode === 'mercadopago') return '🛒 Adicionar ao Carrinho';
    return '✔️ Confirmar Compra';
}

// Abre o modal de confirmação de compra (usado pelos dois meios de pagamento)
function openCheckoutModal(item, mode) {
    currentCheckoutItem = item;
    currentCheckoutMode = mode;

    const isReal = mode !== 'frag';
    const valorCentavos = getItemValorCentavos(item);
    const precoLabel = isReal
        ? `<span style="color:var(--lr-nature);font-weight:700;">R$ ${(valorCentavos / 100).toFixed(2).replace('.', ',')}</span>`
        : `<span style="color:#6366f1;font-weight:700;">${item.valorFrag} Frag$</span>`;

    const infoDiv = document.getElementById('lojaCheckoutItemInfo');
    infoDiv.innerHTML = `
        <div style="display:flex;gap:12px;align-items:center;">
            ${item.imagem ? `<img src="${escapeHtml(item.imagem)}" alt="" style="width:64px;height:64px;object-fit:cover;border-radius:8px;flex-shrink:0;background:var(--lr-bg-1);" onerror="this.remove();">` : ''}
            <div style="flex:1;">
                <div style="font-weight:700;color:var(--primary);font-size:1.1rem;margin-bottom:4px;">${escapeHtml(item.nome)}</div>
                <div style="font-size:0.9rem;color:var(--muted);">Custo: <span id="lojaCheckoutPriceDisplay">${precoLabel}</span></div>
            </div>
            <div style="display:flex;flex-direction:column;align-items:center;">
                <label for="lojaCheckoutQuantity" style="font-size:0.75rem;color:var(--muted);margin-bottom:2px;font-weight:700;">Quantidade</label>
                <input type="number" id="lojaCheckoutQuantity" value="1" min="1" max="99" oninput="updateCheckoutTotal()" style="width:60px;text-align:center;background:var(--lr-bg-1);border:1px solid rgba(255,255,255,0.1);color:var(--lr-text-1);border-radius:6px;padding:4px;font-family:var(--font);font-size:0.9rem;font-weight:600;">
            </div>
        </div>
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
    btn.innerHTML = rotuloBotaoCompra(mode);

    document.getElementById('lojaCheckoutModal').style.display = 'flex';
}

window.updateCheckoutTotal = function () {
    if (!currentCheckoutItem) return;
    const qtyInput = document.getElementById('lojaCheckoutQuantity');
    if (!qtyInput) return;

    let qty = parseInt(qtyInput.value) || 1;
    if (qty < 1) qty = 1;
    if (qty > 99) qty = 99;

    const isReal = currentCheckoutMode !== 'frag';
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

window.openCheckoutReal = function (itemId) {
    const item = lojaItensData.find(i => i.id === itemId);
    if (!item) return;
    openCheckoutModal(item, 'mercadopago');
};

// =============================================
// CARRINHO (dinheiro real → Mercado Pago)
// Vive no localStorage do aparelho; preço e metas são revalidados
// pelo servidor na hora do checkout — aqui é só exibição.
// =============================================
let carrinho = [];
try { carrinho = JSON.parse(localStorage.getItem('lr_carrinho') || '[]'); } catch (e) { carrinho = []; }
if (!Array.isArray(carrinho)) carrinho = [];

function salvarCarrinho() {
    localStorage.setItem('lr_carrinho', JSON.stringify(carrinho));
    atualizarBadgeCarrinho();
}

function atualizarBadgeCarrinho() {
    const badge = document.getElementById('carrinhoBadge');
    if (!badge) return;
    const total = carrinho.reduce((s, l) => s + (l.quantidade || 1), 0);
    badge.textContent = total;
    badge.style.display = total > 0 ? '' : 'none';
}
atualizarBadgeCarrinho();

function addAoCarrinho(item, quantidade, selectedMetas) {
    // Mesmo item com as mesmas metas → soma a quantidade em vez de duplicar
    const chaveMetas = [...selectedMetas].sort().join(',');
    const igual = carrinho.find(l =>
        l.itemId === item.id &&
        [...(l.selectedMetas || [])].sort().join(',') === chaveMetas);
    if (igual) {
        igual.quantidade = Math.min(99, (igual.quantidade || 1) + quantidade);
    } else {
        carrinho.push({
            itemId: item.id,
            nome: item.nome,
            valorCentavos: getItemValorCentavos(item),
            quantidade,
            selectedMetas,
        });
    }
    salvarCarrinho();
}

// ---- Taxa do gateway: quem paga é o jogador ----
// As taxas vivem em `config/pagamento` (o mestre ajusta pelo banco). O valor
// que vale é SEMPRE o recalculado no servidor; aqui é só para o jogador ver
// antes de escolher.
const TAXAS_FALLBACK = {
    pix: { pct: 0.0099, fixo: 0, rotulo: 'PIX' },
    credito: { pct: 0.0498, fixo: 0, rotulo: 'Cartão' },
    boleto: { pct: 0, fixo: 349, rotulo: 'Boleto', minimoCentavos: 2000 },
};
let taxasPagamento = TAXAS_FALLBACK;
let meioEscolhido = 'pix';
let taxasBuscadas = false;

// Só busca com o jogador logado: `config` exige login nas rules, e chamar
// isso na carga da página enchia o console de todo visitante com um 400.
// Devolve true quando os valores mudaram, para redesenhar o carrinho.
async function garantirTaxas() {
    if (taxasBuscadas || !auth.currentUser) return false;
    taxasBuscadas = true;
    try {
        const snap = await getDoc(doc(db, 'config', 'pagamento'));
        const d = snap.exists() ? snap.data() : null;
        if (d && d.pix && d.credito && d.boleto) {
            taxasPagamento = d;
            return true;
        }
    } catch (e) { /* fallback já serve */ }
    return false;
}

// Mesma conta do servidor (functions/taxa-gateway.js): a taxa incide sobre o
// valor cobrado, então é divisão, não acréscimo.
function cobrancaComTaxa(subtotalCentavos, taxa) {
    const pct = Number(taxa?.pct) || 0;
    const fixo = Number(taxa?.fixo) || 0;
    return Math.ceil((subtotalCentavos + fixo) / (1 - pct));
}

const emReais = c => 'R$ ' + (c / 100).toFixed(2).replace('.', ',');

window.escolherMeioPagamento = function (meio) {
    meioEscolhido = meio;
    renderCarrinho();
};

window.abrirCarrinho = function () {
    renderCarrinho();
    document.getElementById('carrinhoModal').style.display = 'flex';
    // Se o banco tiver taxa diferente do padrão, redesenha com o valor certo
    garantirTaxas().then(mudou => { if (mudou) renderCarrinho(); });
};

function renderCarrinho() {
    const lista = document.getElementById('carrinhoLista');
    const totalEl = document.getElementById('carrinhoTotal');
    const btn = document.getElementById('btnPagarCarrinho');
    if (!lista || !totalEl || !btn) return;

    const meios = document.getElementById('carrinhoMeios');
    const resumo = document.getElementById('carrinhoResumo');

    if (carrinho.length === 0) {
        lista.innerHTML = '<div style="text-align:center;padding:24px;color:var(--muted);">Seu carrinho está vazio.<br>Adicione itens da Loja para pagar com PIX, Cartão ou Boleto.</div>';
        totalEl.textContent = 'R$ 0,00';
        if (meios) meios.innerHTML = '';
        if (resumo) resumo.innerHTML = '';
        btn.disabled = true;
        return;
    }
    btn.disabled = false;

    let total = 0;
    lista.innerHTML = carrinho.map((l, i) => {
        const sub = (l.valorCentavos || 0) * (l.quantidade || 1);
        total += sub;
        const metasTxt = (l.selectedMetas || [])
            .map(id => (metasData.find(m => m.id === id) || {}).nome)
            .filter(Boolean).join(', ');
        return `
            <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.08);flex-wrap:wrap;">
                <div style="flex:1;min-width:140px;">
                    <div style="font-weight:600;color:var(--lr-text-1);">${escapeHtml(l.nome)}</div>
                    ${metasTxt ? `<div style="font-size:0.75rem;color:var(--muted);">🎯 ${escapeHtml(metasTxt)}</div>` : ''}
                </div>
                <div style="display:flex;align-items:center;gap:6px;">
                    <button class="qtd-btn" onclick="carrinhoQtd(${i},-1)" title="Diminuir" aria-label="Diminuir quantidade">−</button>
                    <span style="min-width:20px;text-align:center;font-weight:600;">${l.quantidade || 1}</span>
                    <button class="qtd-btn" onclick="carrinhoQtd(${i},1)" title="Aumentar" aria-label="Aumentar quantidade">+</button>
                </div>
                <div style="min-width:80px;text-align:right;font-weight:700;color:var(--lr-nature);">${emReais(sub)}</div>
                <button onclick="carrinhoRemover(${i})" title="Remover do carrinho" style="background:transparent;border:none;color:var(--muted);cursor:pointer;font-size:1rem;">🗑️</button>
            </div>`;
    }).join('');

    // Botões de meio de pagamento: o meio precisa ser escolhido AQUI porque
    // cada um tem uma taxa diferente, e é ela que define o total.
    const ICONE = { pix: '💠', credito: '💳', boleto: '🧾' };
    const taxaDe = m => taxasPagamento[m] || TAXAS_FALLBACK[m];
    // Meio com valor mínimo (boleto) some nas compras pequenas: os R$ 3,49
    // fixos dele encareceriam um item de R$ 5,00 em 70%.
    const disponiveis = ['pix', 'credito', 'boleto']
        .filter(m => total >= (Number(taxaDe(m).minimoCentavos) || 0));
    if (!disponiveis.includes(meioEscolhido)) meioEscolhido = disponiveis[0] || 'pix';

    if (meios) {
        meios.innerHTML = disponiveis.map(m => {
            const t = taxaDe(m);
            const cobrado = cobrancaComTaxa(total, t);
            const ativo = m === meioEscolhido;
            return `
                <button onclick="escolherMeioPagamento('${m}')"
                    style="flex:1 1 0;min-width:0;padding:8px 4px;border-radius:8px;cursor:pointer;text-align:center;
                           background:${ativo ? 'rgba(16,185,129,0.12)' : 'transparent'};
                           border:1px solid ${ativo ? 'var(--lr-nature)' : 'rgba(255,255,255,0.15)'};
                           color:var(--lr-text-1);font-family:var(--font);">
                    <div style="font-size:0.9rem;white-space:nowrap;">${ICONE[m]} ${escapeHtml(t.rotulo || m)}</div>
                    <div style="font-size:0.8rem;color:${ativo ? 'var(--lr-nature)' : 'var(--muted)'};font-weight:700;white-space:nowrap;">${emReais(cobrado)}</div>
                </button>`;
        }).join('');
    }

    const taxa = taxasPagamento[meioEscolhido] || TAXAS_FALLBACK[meioEscolhido];
    const cobrado = cobrancaComTaxa(total, taxa);
    if (resumo) {
        resumo.innerHTML = `
            <div style="display:flex;justify-content:space-between;font-size:0.85rem;color:var(--muted);">
                <span>Itens</span><span>${emReais(total)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:0.85rem;color:var(--muted);margin-top:2px;">
                <span>Taxa do Mercado Pago</span><span>${emReais(cobrado - total)}</span>
            </div>`;
    }
    totalEl.textContent = emReais(cobrado);
}

window.carrinhoQtd = function (i, delta) {
    const l = carrinho[i];
    if (!l) return;
    l.quantidade = Math.max(1, Math.min(99, (l.quantidade || 1) + delta));
    salvarCarrinho();
    renderCarrinho();
};

window.carrinhoRemover = function (i) {
    carrinho.splice(i, 1);
    salvarCarrinho();
    renderCarrinho();
};

// Fecha o carrinho no servidor e vai para o Checkout Pro do Mercado Pago
window.confirmPurchaseCarrinho = async function () {
    if (carrinho.length === 0) return;
    const btn = document.getElementById('btnPagarCarrinho');
    btn.disabled = true;
    btn.innerHTML = '⏳ Gerando pagamento...';
    try {
        const recaptchaToken = await getRecaptchaToken('comprar_loja');
        const criarCheckout = httpsCallable(functions, 'criarCheckoutMercadoPago');
        const result = await criarCheckout({
            itens: carrinho.map(l => ({
                itemId: l.itemId,
                quantidade: l.quantidade || 1,
                selectedMetas: l.selectedMetas || [],
            })),
            meio: meioEscolhido,
            recaptchaToken,
        });
        // Esvazia AQUI, e não no retorno: no PIX o jogador fecha a aba do
        // Mercado Pago em vez de voltar, e o carrinho ficaria cheio para sempre.
        carrinho = [];
        salvarCarrinho();
        window.location.href = result.data.paymentUrl; // ambiente seguro do Mercado Pago
    } catch (error) {
        console.error('Erro ao criar checkout:', error);
        showAlert(`❌ Não foi possível iniciar o pagamento: ${error.message}`, 'danger');
        btn.disabled = false;
        btn.innerHTML = '💳 Pagar com Mercado Pago';
    }
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

    // ---- Fluxo Mercado Pago: entra no carrinho; o pagamento é no carrinho ----
    if (currentCheckoutMode === 'mercadopago') {
        addAoCarrinho(item, quantidade, selectedMetas);
        document.getElementById('lojaCheckoutModal').style.display = 'none';
        btn.disabled = false;
        btn.innerHTML = rotuloBotaoCompra('mercadopago');
        currentCheckoutItem = null;
        abrirCarrinho();
        return;
    }

    // ---- Fluxo Frag$ (inalterado no geral, mas envia quantidade) ----
    try {
        const comprar = httpsCallable(functions, 'comprarComFragmentos');
        const result = await comprar({ itemId: item.id, selectedMetas, quantidade });

        showAlert('✅ Compra realizada com sucesso! Item enviado ao seu Repertório.', 'success');
        document.getElementById('lojaCheckoutModal').style.display = 'none';

        updateFragDisplay(result.data.novoSaldo);
        updateGirosDisplay(result.data.novosGiros);
        updateRerolagensDisplay(result.data.novasRerolagens);

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

/* Faixa de "confirme seu e-mail". Em 31/08/2026 nenhuma das 19 contas tinha
   e-mail confirmado, porque o cadastro nunca mandou a mensagem. Contas antigas
   não são bloqueadas de comprar (seria trancar a mesa inteira de uma vez), mas
   precisam de um caminho para confirmar — este aqui. Conta nova, criada depois
   do corte, o servidor cobra na hora da compra. */
function avisarEmailNaoVerificado(user) {
    document.getElementById('avisoEmail')?.remove();
    if (!user || user.emailVerified) return;

    const faixa = document.createElement('div');
    faixa.id = 'avisoEmail';
    faixa.className = 'aviso-email';
    faixa.innerHTML = `
        <span>✉️ Confirme seu e-mail (<strong>${escapeHtml(user.email || '')}</strong>)
        para manter o acesso à sua conta.</span>
        <button type="button" id="btnReenviarEmail">Reenviar</button>`;
    document.body.insertBefore(faixa, document.body.firstChild);

    document.getElementById('btnReenviarEmail').addEventListener('click', async (ev) => {
        const b = ev.currentTarget;
        b.disabled = true; b.textContent = 'Enviando…';
        try {
            await sendEmailVerification(user);
            showAlert('✅ Mensagem enviada. Procure na caixa de entrada (e no spam).', 'success');
            b.textContent = 'Enviado';
        } catch (e) {
            // O Firebase limita reenvios seguidos; dizer isso é melhor que "erro".
            showAlert(e?.code === 'auth/too-many-requests'
                ? '⏳ Já enviamos há pouco. Espere alguns minutos e tente de novo.'
                : '❌ Não foi possível enviar agora.', 'danger');
            b.disabled = false; b.textContent = 'Reenviar';
        }
    });
}

// =============================================
// RETORNO DO MERCADO PAGO (?compra=...)
// Nenhum benefício é aplicado aqui — a entrega é exclusiva
// do webhook no servidor (PIX confirma em segundos; boleto pode levar dias).
// =============================================
(function verificarRetornoCompra() {
    const params = new URLSearchParams(window.location.search);
    if (!params.get('compra')) return;
    showAlert(
        '✅ Pagamento em processamento! Assim que o Mercado Pago confirmar, o item aparecerá ' +
        'automaticamente no seu Repertório e você receberá uma notificação.',
        'success',
        10000
    );
    // O pagamento saiu do carrinho — esvazia para não cobrar duas vezes sem querer
    carrinho = [];
    salvarCarrinho();
    const url = new URL(window.location.href);
    url.searchParams.delete('compra');
    window.history.replaceState({}, '', url);
})();

// =============================================
// 🔐 AUTH DO PORTAL — login + cadastro embutidos
// Portado do index.html antigo (mesmos ids, mesmo fluxo). Diferenças: NÃO
// redireciona — o onAuthStateChanged acima troca o estado da própria página —
// e o cadastro não concede mais cargo nenhum (ver toggleAvisoCargo).
// =============================================

function authAlert(message, type) {
    const mapa = { success: 'alertSuccess', danger: 'alertError', warning: 'alertWarning' };
    ['alertSuccess', 'alertError', 'alertWarning'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
    const el = document.getElementById(mapa[type] || 'alertWarning');
    if (!el) return;
    el.textContent = message;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 6000);
}

function showAuthLoading(mostrar) {
    const el = document.getElementById('loading');
    if (el) el.style.display = mostrar ? 'block' : 'none';
}

window.toggleForm = function () {
    const loginForm = document.getElementById('loginForm');
    const cadastroForm = document.getElementById('cadastroForm');
    ['alertSuccess', 'alertError', 'alertWarning'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
    if (loginForm.style.display === 'none') {
        loginForm.style.display = 'block';
        cadastroForm.style.display = 'none';
    } else {
        loginForm.style.display = 'none';
        cadastroForm.style.display = 'block';
    }
};

/* Mestre e Criador no cadastro são PEDIDO, não escolha: a conta nasce Jogador
   e o cargo só muda quando um Criador aprova (definirCargo). O que aparece
   aqui é o aviso de que é assim — no lugar do antigo campo de código secreto,
   que era teatro: a senha estava no bundle e as rules nunca a conferiam. */
const CARGO_ROTULO = { jogador: 'Jogador', mestre: 'Mestre', criador: 'Criador' };

window.toggleAvisoCargo = function () {
    const escolhido = document.querySelector('input[name="role"]:checked')?.value || 'jogador';
    document.querySelectorAll('.role-option').forEach(o => o.classList.remove('selected'));
    document.querySelector(`input[name="role"][value="${escolhido}"]`)
        ?.closest('.role-option')?.classList.add('selected');

    const aviso = document.getElementById('cargoAviso');
    const nome = document.getElementById('cargoAvisoNome');
    if (!aviso) return;
    aviso.classList.toggle('show', escolhido !== 'jogador');
    if (nome && escolhido !== 'jogador') nome.textContent = CARGO_ROTULO[escolhido];
};

document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    showAuthLoading(true);
    try {
        await signInWithEmailAndPassword(auth, email, password);
        authAlert('✅ Login realizado com sucesso!', 'success');
        // onAuthStateChanged assume daqui: esconde o login, mostra a mesa.
    } catch (error) {
        console.error('Erro no login:', error);
        let errorMsg = '❌ Erro ao fazer login. ';
        if (error.code === 'auth/user-not-found') errorMsg += 'Usuário não encontrado.';
        else if (error.code === 'auth/wrong-password') errorMsg += 'Senha incorreta.';
        else if (error.code === 'auth/invalid-email') errorMsg += 'Email inválido.';
        else if (error.code === 'auth/invalid-credential') errorMsg += 'Email ou senha incorretos.';
        else errorMsg += error.message;
        authAlert(errorMsg, 'danger');
    } finally {
        showAuthLoading(false);
    }
});

document.getElementById('cadastroForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nome = document.getElementById('cadastroNome').value;
    const email = document.getElementById('cadastroEmail').value;
    const password = document.getElementById('cadastroPassword').value;
    const passwordConfirm = document.getElementById('cadastroPasswordConfirm').value;
    const roleInput = document.querySelector('input[name="role"]:checked');
    const pedido = roleInput ? roleInput.value : 'jogador';

    if (password !== passwordConfirm) {
        authAlert('❌ As senhas não coincidem!', 'danger');
        return;
    }
    if (password.length < 6) {
        authAlert('❌ A senha deve ter pelo menos 6 caracteres!', 'danger');
        return;
    }

    showAuthLoading(true);
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: nome });
        /* Confirmação de e-mail. Faltava desde sempre: dava para se cadastrar
           com o endereço de outra pessoa, e é sobre esse endereço que qualquer
           recuperação de conta vai se apoiar depois.
           Falhar aqui não pode derrubar o cadastro — a conta já existe, e o
           aviso no topo do Portal deixa reenviar. */
        try { await sendEmailVerification(userCredential.user); }
        catch (e) { console.warn('Não foi possível enviar a verificação:', e); }
        /* Sem `role` de propósito: a rule de create recusa o campo, e ausente
           já significa Jogador em todo o site. O pedido vai em
           `cargoSolicitado`, que é livre justamente porque não vale nada
           sozinho — quem o transforma em cargo é um Criador. */
        await setDoc(doc(db, 'users', userCredential.user.uid), {
            email: userCredential.user.email,
            displayName: nome,
            createdAt: new Date().toISOString(),
            ...(pedido !== 'jogador' ? {
                cargoSolicitado: pedido,
                cargoSolicitadoEm: new Date().toISOString()
            } : {})
        });
        authAlert(pedido !== 'jogador'
            ? `✅ Conta criada! Seu pedido de acesso como ${CARGO_ROTULO[pedido]} foi enviado — ` +
              'até um Criador aprovar, sua conta funciona como Jogador.'
            : '✅ Conta criada com sucesso!', 'success');
    } catch (error) {
        console.error('Erro no cadastro:', error);
        let errorMsg = '❌ Erro ao criar conta. ';
        if (error.code === 'auth/email-already-in-use') errorMsg += 'Este email já está cadastrado.';
        else if (error.code === 'auth/invalid-email') errorMsg += 'Email inválido.';
        else if (error.code === 'auth/weak-password') errorMsg += 'Senha muito fraca.';
        else errorMsg += error.message;
        authAlert(errorMsg, 'danger');
        showAuthLoading(false);
    }
});

// ===== NAVEGAÇÃO DO PORTAL =====
window.portalIrLogin = function () {
    const secao = document.getElementById('secaoLogin');
    if (secao && !secao.hidden) {
        secao.scrollIntoView({ behavior: 'smooth' });
        setTimeout(() => document.getElementById('loginEmail')?.focus(), 400);
    }
};

window.portalIrBusca = function () {
    if (!document.body.classList.contains('portal-logado')) { window.portalIrLogin(); return; }
    document.querySelector('.tab[onclick*="home"]')?.click();
    document.querySelector('.wrap')?.scrollIntoView({ behavior: 'smooth' });
    setTimeout(() => document.getElementById('wikiBusca')?.focus(), 400);
};

// CTA do hero: visitante vai ao login; logado vai à Home (o Cânone)
window.portalIrCanone = function () {
    if (!document.body.classList.contains('portal-logado')) { window.portalIrLogin(); return; }
    document.querySelector('.tab[onclick*="home"]')?.click();
    document.querySelector('.wrap')?.scrollIntoView({ behavior: 'smooth' });
};
