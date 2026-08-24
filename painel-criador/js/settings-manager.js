import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore, collection, getDocs, doc, updateDoc, setDoc, getDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
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
                    <div style="font-weight:700">${user.displayName || 'Sem nome'}</div>
                    <div style="font-size:0.75rem; color:var(--muted)">${user.email}</div>
                </td>
                <td>${dateStr}</td>
                <td>
                    <select class="role-select" onchange="window.updateUserRole('${user.id}', this.value)" ${user.role === 'criador' ? 'disabled title="Você não pode alterar a role de outro criador"' : ''}>
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
        await updateDoc(doc(db, "users", userId), { role: newRole });
        toast("Cargo atualizado com sucesso!", 'sucesso');
    } catch(e) {
        console.error("Error updating role:", e);
        toast("Erro ao atualizar cargo. Verifique se você tem permissão.", 'erro');
        loadUsers();
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
