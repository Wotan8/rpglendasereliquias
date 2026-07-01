import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore, collection, getDocs, doc, updateDoc, setDoc, getDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';

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
const storage = getStorage(app);

const faviconsConfig = [
    { id: 'index', name: 'Login (index.html)' },
    { id: 'menu', name: 'Menu Principal' },
    { id: 'criar-personagem', name: 'Criar Personagem' },
    { id: 'ficha', name: 'Ficha do Personagem' },
    { id: 'painel-mestre', name: 'Painel do Mestre' },
    { id: 'painel-criador', name: 'Painel de Criador' },
    { id: 'mapa', name: 'Mapa (World/Hex)' }
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
    if(!confirm(`Tem certeza que deseja alterar o cargo deste usuário para ${newRole}?`)) {
        loadUsers(); // reload to reset dropdown
        return;
    }
    
    try {
        await updateDoc(doc(db, "users", userId), { role: newRole });
        alert("Cargo atualizado com sucesso!");
    } catch(e) {
        console.error("Error updating role:", e);
        alert("Erro ao atualizar cargo. Verifique se você tem permissão.");
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
                <label class="btn-upload" style="cursor:pointer">
                    Selecionar Imagem
                    <input type="file" id="fav-input-${fav.id}" accept=".png,.ico,.svg">
                </label>
                <button class="btn-upload" id="fav-save-${fav.id}" disabled style="margin-top:5px; background:var(--success)">Salvar Alteração</button>
            `;
            
            container.appendChild(card);

            const input = document.getElementById(`fav-input-${fav.id}`);
            const saveBtn = document.getElementById(`fav-save-${fav.id}`);
            const preview = document.getElementById(`fav-preview-${fav.id}`);
            
            let selectedFile = null;

            input.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    if (file.size > 2 * 1024 * 1024) {
                        alert("A imagem não pode ter mais de 2MB.");
                        return;
                    }
                    selectedFile = file;
                    preview.src = URL.createObjectURL(file);
                    preview.style.display = 'block';
                    saveBtn.disabled = false;
                }
            });

            saveBtn.addEventListener('click', async () => {
                if(!selectedFile) return;
                
                saveBtn.innerText = 'Salvando...';
                saveBtn.disabled = true;
                
                try {
                    const ext = selectedFile.name.split('.').pop();
                    const storageRef = ref(storage, `app-assets/favicons/${fav.id}-${Date.now()}.${ext}`);
                    
                    await uploadBytes(storageRef, selectedFile);
                    const downloadURL = await getDownloadURL(storageRef);
                    
                    await setDoc(doc(db, 'app-config', 'favicons'), {
                        [fav.id]: downloadURL
                    }, { merge: true });
                    
                    alert('Favicon atualizado com sucesso!');
                    saveBtn.innerText = 'Salvo';
                } catch (err) {
                    console.error("Error saving favicon:", err);
                    alert("Erro ao salvar favicon.");
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
