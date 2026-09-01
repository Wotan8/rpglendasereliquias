import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore, collection, getDocs, doc, setDoc, getDoc, query, where } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js';
import { toast, confirmar } from '../../shared/dialogo.js?v=2';

const firebaseConfig = {
    apiKey: "AIzaSyA6r79XcsMr3KZUT1YZ8vQntIGspgULXcE",
    authDomain: "rpg-lendasereliquias.firebaseapp.com",
    projectId: "rpg-lendasereliquias",
    storageBucket: "rpg-lendasereliquias.firebasestorage.app",
    messagingSenderId: "546994339773",
    appId: "1:546994339773:web:0116cf7c8667f113075cd4"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const functions = getFunctions(app, 'southamerica-east1');

/* Cargo não é mais campo que o navegador escreve: `role` entrou na lista de
   protegidos das rules e só a Cloud Function o move. Aqui e na fila de pedidos
   abaixo, o botão só pede — quem decide de verdade é o servidor. */
const definirCargo = httpsCallable(functions, 'definirCargo');

const CARGO_ROTULO = { jogador: 'Jogador', mestre: 'Mestre', criador: 'Criador' };

/* Nome e e-mail são texto que o próprio usuário escolhe, e vão para innerHTML:
   sem escapar, um displayName com aspas e `onerror` roda dentro da sessão do
   Criador — que é justamente quem pode promover contas. */
function esc(t) {
    if (t == null) return '';
    return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const faviconsConfig = [
    { id: 'pwa-icon', name: 'Ícone do App (PWA - 512x512)' },
    { id: 'app-windows', name: 'Ícone do App (Windows)' },
    { id: 'index', name: 'Login (index.html)' },
    { id: 'menu', name: 'Menu Principal' },
    { id: 'criar-personagem', name: 'Criar Personagem' },
    { id: 'ficha', name: 'Ficha do Personagem' },
    { id: 'painel-mestre', name: 'Painel do Mestre' },
    { id: 'painel-criador', name: 'Painel de Criador' },
    { id: 'mapa', name: 'Mapa (World/Hex)' },
    { id: 'tabuleiro', name: 'Favicon do Tabuleiro' },
    { id: 'worldbuilding', name: 'Construção de Mundo' },
    { id: 'laboratorium', name: 'Laboratório de Runas' }
];

function initSettingsManager() {
    setupTabs();
    setupTheme();
    loadFavicons();
    marcarPedidosPendentes();

    // User search input
    document.getElementById('userSearchInput')?.addEventListener('input', filterUsers);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSettingsManager);
} else {
    initSettingsManager();
}

function setupTabs() {
    const tabs = document.querySelectorAll('.settings-tab');
    const sections = document.querySelectorAll('.settings-section');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active'));
            
            tab.classList.add('active');
            const targetId = tab.getAttribute('data-target');
            document.getElementById(targetId).classList.add('active');

            if (targetId === 'settings-permissions') {
                loadUsers();
                loadPedidosCargo();
            }
        });
    });
}

function setupTheme() {
    const btnTheme = document.getElementById('btnThemeToggleModal');
    
    // Initial check
    if (localStorage.getItem('creatorPanelTheme') === 'dark' || !localStorage.getItem('creatorPanelTheme')) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }

    btnTheme.addEventListener('click', () => {
        document.documentElement.classList.toggle('dark');
        if (document.documentElement.classList.contains('dark')) {
            localStorage.setItem('creatorPanelTheme', 'dark');
        } else {
            localStorage.setItem('creatorPanelTheme', 'light');
        }
    });
}

async function loadUsers() {
    const tbody = document.getElementById('usersTableBody');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center">Carregando usuários...</td></tr>';
    
    try {
        const querySnapshot = await getDocs(collection(db, "users"));
        tbody.innerHTML = '';
        
        const users = [];
        querySnapshot.forEach((docSnap) => {
            users.push({ id: docSnap.id, ...docSnap.data() });
        });

        // Sort by date (newest first)
        users.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

        users.forEach(user => {
            const tr = document.createElement('tr');
            tr.className = 'user-row';
            tr.dataset.search = `${user.displayName || ''} ${user.email || ''}`.toLowerCase();
            
            const role = user.role || 'jogador';
            
            const dateStr = user.createdAt ? new Date(user.createdAt).toLocaleDateString('pt-BR') : '-';
            
            tr.innerHTML = `
                <td>
                    <div style="font-weight:700">${esc(user.displayName || 'Sem nome')}</div>
                    <div style="font-size:0.75rem; color:var(--muted)">${esc(user.email)}</div>
                </td>
                <td>${dateStr}</td>
                <td>
                    <select class="role-select" onchange="window.updateUserRole('${esc(user.id)}', this.value)" ${user.role === 'criador' ? 'disabled title="Você não pode alterar a role de outro criador"' : ''}>
                        <option value="jogador" ${role === 'jogador' ? 'selected' : ''}>Jogador</option>
                        <option value="mestre" ${role === 'mestre' ? 'selected' : ''}>Mestre</option>
                        <option value="criador" ${role === 'criador' ? 'selected' : ''}>Criador</option>
                    </select>
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (e) {
        console.error("Error loading users:", e);
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:var(--danger)">Erro ao carregar usuários.</td></tr>';
    }
}

function filterUsers(e) {
    const term = e.target.value.toLowerCase();
    const rows = document.querySelectorAll('.user-row');
    rows.forEach(row => {
        if (row.dataset.search.includes(term)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

window.updateUserRole = async function(userId, newRole) {
    if(!await confirmar(`Tem certeza que deseja alterar o cargo deste usuário para ${newRole}?`)) {
        loadUsers(); // reload to reset dropdown
        return;
    }

    try {
        await definirCargo({ uid: userId, cargo: newRole });
        toast("Cargo atualizado com sucesso!", 'sucesso');
        loadPedidosCargo();
    } catch(e) {
        console.error("Error updating role:", e);
        toast(e.message || "Erro ao atualizar cargo.", 'erro');
        loadUsers();
    }
}

// ===== PEDIDOS DE CARGO =====
// Quem se cadastra como Mestre ou Criador entra como Jogador com um pedido
// gravado em `cargoSolicitado`. Esta é a fila onde o pedido vira cargo — ou
// não. Recusar não rebaixa ninguém: só apaga o pedido.

async function pedidosPendentes() {
    const snap = await getDocs(query(
        collection(db, 'users'),
        where('cargoSolicitado', 'in', ['mestre', 'criador'])
    ));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/* A bolinha no ⚙️ existe porque o pedido, sem ela, só aparece para quem já
   abriu Configurações → Permissões — ou seja, para ninguém. */
async function marcarPedidosPendentes() {
    try {
        const quantos = (await pedidosPendentes()).length;
        document.getElementById('btnSettings')
            ?.classList.toggle('tem-pedido', quantos > 0);
        document.querySelector('.settings-tab[data-target="settings-permissions"]')
            ?.classList.toggle('tem-pedido', quantos > 0);
    } catch (e) { /* sem permissão de leitura: a fila simplesmente não aparece */ }
}

async function loadPedidosCargo() {
    const caixa = document.getElementById('cargoPedidos');
    if (!caixa) return;

    let pedidos = [];
    try {
        pedidos = await pedidosPendentes();
    } catch (e) {
        console.error('Erro ao carregar pedidos de cargo:', e);
        caixa.hidden = true;
        return;
    }

    caixa.hidden = pedidos.length === 0;
    marcarPedidosPendentes();
    if (pedidos.length === 0) return;

    caixa.innerHTML = `
        <h4>🔐 ${pedidos.length} pedido${pedidos.length > 1 ? 's' : ''} de cargo esperando aprovação</h4>
        ${pedidos.map(p => `
            <div class="cargo-pedido">
                <div class="cargo-quem">
                    <div class="cargo-nome">${esc(p.displayName || 'Sem nome')}</div>
                    <div class="cargo-email">${esc(p.email || '')}</div>
                </div>
                <div class="cargo-quer">quer ser <strong>${esc(CARGO_ROTULO[p.cargoSolicitado] || p.cargoSolicitado)}</strong></div>
                <button class="cargo-ok" onclick="window.decidirPedidoCargo('${esc(p.id)}', true)">✔️ Aprovar</button>
                <button class="cargo-nao" onclick="window.decidirPedidoCargo('${esc(p.id)}', false)">✖️ Recusar</button>
            </div>
        `).join('')}
    `;
}

window.decidirPedidoCargo = async function(userId, aprovar) {
    const pedido = (await pedidosPendentes()).find(p => p.id === userId);
    if (!pedido) { loadPedidosCargo(); return; }

    const quem = pedido.displayName || pedido.email || 'esta conta';
    const cargo = CARGO_ROTULO[pedido.cargoSolicitado] || pedido.cargoSolicitado;
    const pergunta = aprovar
        ? `Dar o cargo de ${cargo} para ${quem}?`
        : `Recusar o pedido de ${quem}? A conta continua como Jogador.`;
    if (!await confirmar(pergunta)) return;

    try {
        // Sem `cargo` = recusa: o servidor só apaga o pedido e avisa a pessoa.
        await definirCargo(aprovar ? { uid: userId, cargo: pedido.cargoSolicitado } : { uid: userId });
        toast(aprovar ? `${quem} agora é ${cargo}.` : 'Pedido recusado.', 'sucesso');
        loadPedidosCargo();
        loadUsers();
    } catch (e) {
        console.error('Erro ao decidir cargo:', e);
        toast(e.message || 'Erro ao decidir o cargo.', 'erro');
    }
}

async function loadFavicons() {
    const container = document.getElementById('faviconUploadsContainer');
    if(!container) return;
    container.innerHTML = 'Carregando...';

    try {
        let savedUrls = {};
        const configDoc = await getDoc(doc(db, 'app-config', 'favicons'));
        if (configDoc.exists()) {
            savedUrls = configDoc.data();
        }

        container.innerHTML = '';
        
        faviconsConfig.forEach(fav => {
            const card = document.createElement('div');
            card.className = 'favicon-card';
            
            const currentUrl = savedUrls[fav.id] || '../favicon.ico'; // default fallback
            
            card.innerHTML = `
                <div class="favicon-preview">
                    <img id="fav-preview-${fav.id}" src="${currentUrl}" alt="Preview" onerror="this.style.display='none'">
                </div>
                <h4>${fav.name}</h4>
                ${CampoImagem.html({ id: `fav-input-${fav.id}`, pasta: 'app-assets/favicons', preview: false, placeholder: 'Cole uma URL ou envie um arquivo' })}
                <button class="btn-upload" id="fav-save-${fav.id}" disabled style="margin-top:5px; background:var(--success)">Salvar Alteração</button>
            `;

            container.appendChild(card);

            const input = document.getElementById(`fav-input-${fav.id}`);
            const saveBtn = document.getElementById(`fav-save-${fav.id}`);
            const preview = document.getElementById(`fav-preview-${fav.id}`);

            // A imagem só é aceita depois de carregar — e, no ícone do app, só se
            // for quadrada. Vale igual para arquivo enviado e para URL colada.
            input.addEventListener('input', () => {
                const url = input.value.trim();
                saveBtn.disabled = true;
                if (!url) return;
                const img = new Image();
                img.onload = () => {
                    if ((fav.id === 'app-windows' || fav.id === 'pwa-icon') && img.width !== img.height) {
                        toast("O Ícone do App deve ser uma imagem quadrada (ex: 256x256, 512x512).", 'aviso');
                        return;
                    }
                    preview.src = url;
                    preview.style.display = 'block';
                    saveBtn.disabled = false;
                };
                img.onerror = () => { toast("Não consegui carregar essa imagem.", 'aviso'); };
                img.src = url;
            });

            saveBtn.addEventListener('click', async () => {
                const downloadURL = input.value.trim();
                if (!downloadURL) return;

                saveBtn.innerText = 'Salvando...';
                saveBtn.disabled = true;

                try {
                    await setDoc(doc(db, 'app-config', 'favicons'), {
                        [fav.id]: downloadURL
                    }, { merge: true });

                    toast('Favicon atualizado com sucesso!', 'sucesso');
                    saveBtn.innerText = 'Salvo';
                } catch (err) {
                    console.error("Error saving favicon:", err);
                    toast("Erro ao salvar favicon.", 'erro');
                    saveBtn.innerText = 'Salvar Alteração';
                    saveBtn.disabled = false;
                }
            });
        });
        
    } catch(e) {
        console.error("Error loading favicons config:", e);
        container.innerHTML = '<div style="color:var(--danger)">Erro ao carregar configurações de favicons.</div>';
    }
}
