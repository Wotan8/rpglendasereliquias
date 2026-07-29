/** Confere se o doc da mesa existe. Erro de rede nao vira "mesa apagada":
 *  nesse caso assume que existe, senao uma queda de conexao esconderia a aba. */
async function mesaExiste(mesaId) {
    try {
        const { getFirestore, doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const db = window.db || getFirestore();
        return (await getDoc(doc(db, 'mesas', mesaId))).exists();
    } catch (e) {
        console.warn('[mesa] nao deu para conferir se a mesa existe:', e);
        return true;
    }
}

window.initMesaTab = async function(mesaId) {
    if (!mesaId) return;

    // A mesa ainda existe? Excluir uma mesa apaga so o doc em 'mesas' — o
    // mesaId fica gravado no personagem. Sem esta checagem a ficha montava a
    // aba de uma mesa que nao existe mais, listando como "companheiros" outros
    // personagens igualmente orfaos e oferecendo um Tabuleiro morto.
    if (!(await mesaExiste(mesaId))) {
        console.info('[mesa] mesaId', mesaId, 'nao existe mais — aba nao sera criada.');
        return;
    }

    const tabBar = document.getElementById('tabBar');
    if (!tabBar) return;
    
    const notasTab = tabBar.querySelector('[data-tab="tabNotas"]');
    if (!notasTab) return;
    
    // Evita duplicar a aba
    if (document.querySelector('[data-tab="tabMesa"]')) return;

    // 1. Criar botão da Aba "Mesa"
    const mesaTabBtn = document.createElement('button');
    mesaTabBtn.className = 'tab';
    mesaTabBtn.dataset.tab = 'tabMesa';
    mesaTabBtn.textContent = 'Mesa';
    notasTab.after(mesaTabBtn); // Inserir obrigatoriamente logo após "Notas"

    // 2. Criar container de conteúdo da aba
    const sheet = document.querySelector('.sheet');
    const mesaTabContent = document.createElement('div');
    mesaTabContent.className = 'tab-content';
    mesaTabContent.id = 'tabMesa';
    
    // Atalho do Tabuleiro: fica na toolbar ao lado da impressora, só com o
    // ícone. Antes era uma aba larga escrita "Tabuleiro" depois de Mesa, que
    // confundia — abre outra página, não troca de aba.
    if (!document.getElementById('btnTabuleiroFicha')) {
        const btnTab = document.createElement('button');
        btnTab.id = 'btnTabuleiroFicha';
        btnTab.type = 'button';
        btnTab.textContent = '🗺️';
        btnTab.title = 'Abrir o Tabuleiro (VTT) da sua mesa';
        btnTab.addEventListener('click', (e) => {
            e.preventDefault();
            window.open(`../tabuleiro/tabuleiro.html?mesa=${encodeURIComponent(mesaId)}&mode=public`, '_blank');
        });
        const btnImprimir = document.querySelector('.toolbar button[onclick*="openPrintModal"]');
        if (btnImprimir) btnImprimir.before(btnTab);
        else mesaTabBtn.after(btnTab);
    }

    mesaTabContent.innerHTML = `
        <div class="section">
            <div class="section-title" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
                <span>Companheiros de Mesa</span>
                <button type="button" onclick="window.open('../tabuleiro/tabuleiro.html?mesa=${mesaId}&mode=public','_blank')" style="background:linear-gradient(135deg,#7c3aed,#8b5cf6);color:#fff;border:none;border-radius:8px;padding:7px 14px;font-weight:700;cursor:pointer;font-size:.85rem">🗺️ Abrir Tabuleiro da Mesa</button>
            </div>
            <div id="mesaCompanionsContainer" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap:16px; margin-top:10px;">
                <div style="color:var(--muted); font-style:italic;">Carregando companheiros...</div>
            </div>
        </div>
    `;
    
    // Inserir o conteúdo após o tabNotas se ele existir, ou apenas dentro de .sheet
    const notasContent = document.getElementById('tabNotas');
    if (notasContent) {
        notasContent.after(mesaTabContent);
    } else if (sheet) {
        sheet.appendChild(mesaTabContent);
    }

    // 3. Adicionar evento de clique (pois initTabs já pode ter rodado)
    mesaTabBtn.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        mesaTabBtn.classList.add('active');
        mesaTabContent.classList.add('active');
    });

    // 4. Buscar e renderizar companheiros da mesa
    fetchAndRenderCompanions(mesaId);
};

async function fetchAndRenderCompanions(mesaId) {
    // Importa dinamicamente funções do firebase para garantir que estejam disponíveis
    try {
        const { getFirestore, collection, getDocs, query, where } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const db = window.db || getFirestore();
        
        const q = query(collection(db, 'char'), where('mesaId', '==', mesaId));
        const snap = await getDocs(q);
        
        const companions = [];
        snap.forEach(doc => {
            if (doc.id !== window.currentCharacterId) {
                companions.push(doc.data());
            }
        });
        
        const container = document.getElementById('mesaCompanionsContainer');
        if (!container) return;
        
        if (companions.length === 0) {
            container.innerHTML = '<div style="color:var(--muted); font-style:italic; grid-column: 1 / -1;">Nenhum outro companheiro encontrado nesta mesa.</div>';
            return;
        }
        
        container.innerHTML = companions.map(char => {
            const f = char.fields || {};
            
            // Informações obrigatórias: Nome, Imagem, Raça, Classe, Tribo, EXP Totais e Aparência
            const nome = f.nome || 'Desconhecido';
            const imgUrl = char.charImg || 'https://via.placeholder.com/100?text=Sem+Foto';
            const raca = f.raca || '-';
            const classe = f.classe || '-';
            const tribo = f.tribo || '-';
            const exp = f.exptotais || '0';
            const aparencia = f.aparencia || 'Sem descrição.';
            
            return `
                <div style="background:var(--bg-panel, #1e293b); border:1px solid var(--border, #334155); border-radius:8px; padding:12px; display:flex; gap:12px;">
                    <img src="${imgUrl}" alt="${nome}" style="width:80px; height:80px; border-radius:8px; object-fit:cover; flex-shrink:0;">
                    <div style="flex-grow:1; display:flex; flex-direction:column; gap:4px; overflow:hidden;">
                        <div style="font-weight:bold; font-size:16px; color:var(--primary, #8b5cf6); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${nome}">${nome}</div>
                        <div style="font-size:12px; color:var(--text, #f8fafc);">
                            <strong>Raça:</strong> ${raca} | <strong>Classe:</strong> ${classe}
                        </div>
                        <div style="font-size:12px; color:var(--text, #f8fafc);">
                            <strong>Tribo:</strong> ${tribo}
                        </div>
                        <div style="font-size:12px; color:var(--text, #f8fafc);">
                            <strong>EXP Totais:</strong> ${exp}
                        </div>
                        <div style="font-size:11px; color:var(--muted, #94a3b8); margin-top:4px; max-height:40px; overflow-y:auto;">
                            <em>Aparência:</em> ${aparencia}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (e) {
        console.error('Erro ao buscar companheiros de mesa:', e);
        const container = document.getElementById('mesaCompanionsContainer');
        if (container) {
            container.innerHTML = '<div style="color:var(--danger, #ef4444); grid-column: 1 / -1;">Erro ao carregar companheiros.</div>';
        }
    }
}
