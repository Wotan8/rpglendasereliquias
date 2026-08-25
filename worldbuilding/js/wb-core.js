/* ═══════════════════════════════════════════════════════════
   wb-core.js — Núcleo legado do Worldbuilding (extraído do
   monólito worldbuilding.html). Toda a lógica original está
   preservada. Mudanças cirúrgicas (3): init do Firebase movido
   para firebase-config.js; nav ignora itens data-tool; evento
   'wb:data-ready' + ponte window.WB no fim do arquivo.
   ═══════════════════════════════════════════════════════════ */
import {
    auth, db, onAuthStateChanged, signOut,
    collection, doc, getDocs, getDoc, setDoc, addDoc,
    updateDoc, deleteDoc, query, orderBy, where
} from './firebase-config.js';
import { confirmar, toast } from '../../shared/dialogo.js?v=2';

        let currentUser = null;
        let currentCategory = 'dashboard';
        let currentEditingEntry = null;
        let allData = { geography: [], npcs: [], factions: [], history: [], cultures: [], magic: [], religion: [], properties: [], rumors: [] };
        let linkedNpcs = []; // For Geography - NPCs/Creatures with titles
        let linkedTribos = []; // For Geography (Vila, Cidade, Região) - Tribes with titles
        let linkedCulturas = []; // For Factions/Tribes - Cultures with titles
        let linkedNpcsProperty = []; // For Properties - NPCs with titles
        let linkedItems = []; // For Properties - Items with titles (location/sale status)
        let allItems = []; // All available loose items from Firebase
        let linkedFactionsHistory = []; // For History - Factions involved
        let criadorTribes = []; // Tribos cadastradas no Painel do Criador (system/data/tribes)

        // Session Logs variables
        let allCampaigns = [];
        let allSessions = [];
        let allCharacters = []; // Characters for campaign player selection
        let currentCampaign = null;
        let currentSession = null;
        let currentViewMode = 'list'; // 'list', 'timeline', 'wiki', 'gallery'
        let favoriteCampaignId = null; // Favorite campaign ID
        let sessionSelectedItems = []; // Selected items for session (with IDs)
        let sessionGalleryImages = []; // Gallery images for session

        // Submundo variables
        let submundoFeiras = [];
        let submundoContatos = [];
        let submundoPrecos = {};
        let submundoReputacoes = [];
        let currentSubmundoTab = 'dashboard';
        let submundoFilters = { papel: '', especialidade: '', regiao: '' };

        const categoryConfig = {
            geography: { collection: 'worldbuilding-geography', icon: '📍', title: 'Geografia', types: ['Continente', 'Região', 'Cidade', 'Vila', 'Ponto de Interesse'] },
            properties: { collection: 'worldbuilding-properties', icon: '🏠', title: 'Propriedades', types: ['Castelo', 'Taverna', 'Choupana', 'Loja', 'Templo', 'Fortaleza', 'Mansão', 'Fazenda', 'Outro'] },
            npcs: { collection: 'npcs', icon: '👥', title: 'NPCs', types: ['NPC', 'Criatura'] },
            factions: { collection: 'worldbuilding-factions', icon: '⚔️', title: 'Tribos & Civilizações', types: ['Tribo', 'Civilização', 'Clã', 'Organização'] },
            history: { collection: 'worldbuilding-history', icon: '📜', title: 'História', types: ['Era', 'Evento', 'Período', 'Guerra', 'Fundação', 'Catástrofe', 'Descoberta', 'Político', 'Desastre Natural', 'Tratado'] },
            cultures: { collection: 'worldbuilding-cultures', icon: '🎭', title: 'Culturas', types: ['Cultura', 'Sociedade', 'Tradição'] },
            magic: { collection: 'worldbuilding-magic', icon: '✨', title: 'Magia/Tecnologia', types: ['Escola de Magia', 'Tecnologia', 'Artefato'] },
            religion: { collection: 'worldbuilding-religion', icon: '🏛️', title: 'Religião', types: ['Divindade', 'Culto', 'Templo', 'Mito'] },
            rumors: { collection: 'worldbuilding-rumors', icon: '💬', title: 'Rumores', types: ['Rumor', 'Gancho', 'Informação', 'Lenda'] }
        };

        async function checkRole() {
            let userDoc = null;
            let q = query(collection(db, 'users'), where('uid', '==', currentUser.uid));
            let snap = await getDocs(q);
            if (!snap.empty) userDoc = snap.docs[0];
            
            if (!userDoc) {
                q = query(collection(db, 'users'), where('email', '==', currentUser.email));
                snap = await getDocs(q);
                if (!snap.empty) userDoc = snap.docs[0];
            }
            
            if (!userDoc) {
                try {
                    const docRef = doc(db, 'users', currentUser.uid);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) userDoc = docSnap;
                } catch (e) { /* ignore */ }
            }

            if (userDoc) {
                const data = userDoc.data();
                if (data.role === 'criador') {
                    return true;
                }
            }
            return false;
        }

        onAuthStateChanged(auth, async (user) => {
            if (user) {
                currentUser = user;
                const isCriador = await checkRole();
                if (!isCriador) {
                    window.location.href = '/';
                    return;
                }
                const displayNameEl = document.getElementById('userDisplayName');
                displayNameEl.textContent = user.displayName || user.email;
                displayNameEl.title = user.email;
                await loadAllData();
                document.getElementById('loadingScreen').style.display = 'none';
                document.dispatchEvent(new CustomEvent('wb:data-ready')); // ponte p/ wb-*.js
                renderDashboard();
            } else {
                window.location.href = '../index.html';
            }
        });

        // Logout function
        window.logout = async function () {
            if (await confirmar('🚪 Tem certeza que deseja sair?')) {
                try {
                    await signOut(auth);
                    window.location.href = '../index.html';
                } catch (error) {
                    console.error('Erro ao fazer logout:', error);
                    showAlert('❌ Erro ao sair. Tente novamente.', 'danger');
                }
            }
        };

        // Funde Tribos do WB (worldbuilding-factions) com as do Painel do Criador
        // (system/data/tribes). Casamento por NOME (case-insensitive). Campos
        // compartilhados (descrição, imagem) preferem o Criador.
        function mergeFactionsWithCriador(wbFactions, criador) {
            const norm = (s) => (s || '').trim().toLowerCase();
            const usados = new Set();
            const merged = (wbFactions || []).map(f => {
                const t = (f.criadorTriboId && (criador || []).find(c => c.id === f.criadorTriboId))
                    || (criador || []).find(c => norm(c.nome) === norm(f.nome));
                if (!t) return f;
                usados.add(t.id);
                return {
                    ...f,
                    _criador: t,
                    _criadorId: t.id,
                    // Criador é a fonte preferida para os campos de mesmo nome:
                    descricao: t.descricao || f.descricao || '',
                    imagem: t.imagemUrl || f.imagem || '',
                    tipo: f.tipo || 'Tribo',
                };
            });
            // Tribos que existem SÓ no Criador entram na lista:
            for (const t of (criador || [])) {
                if (usados.has(t.id)) continue;
                merged.push({
                    id: t.id,
                    nome: t.nome || 'Sem nome',
                    tipo: 'Tribo',
                    descricao: t.descricao || '',
                    imagem: t.imagemUrl || '',
                    _criador: t,
                    _criadorId: t.id,
                    _criadorOnly: true,
                });
            }
            return merged;
        }

        async function loadAllData() {
            for (const [key, config] of Object.entries(categoryConfig)) {
                try {
                    const snapshot = await getDocs(collection(db, config.collection));
                    allData[key] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                } catch (e) { console.log(`Error loading ${key}:`, e); allData[key] = []; }
            }

            // ── Tribos do Painel do Criador (mesma entidade das Tribos & Civilizações).
            // Carrega system/data/tribes e funde na lista de factions: os campos de
            // mesmo nome (descrição, imagem) passam a vir do Criador (fonte preferida)
            // e as tribos que só existem no Criador também aparecem aqui.
            try {
                const tribesSnap = await getDocs(collection(db, 'system/data/tribes'));
                criadorTribes = tribesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            } catch (e) { console.log('Error loading criador tribes:', e); criadorTribes = []; }
            allData.factions = mergeFactionsWithCriador(allData.factions || [], criadorTribes);
            // Load items for property linking (only loose items - not assigned to characters)
            try {
                const itemsSnapshot = await getDocs(collection(db, 'items'));
                allItems = itemsSnapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() }))
                    .filter(item => !item.characterId); // Only loose items
                console.log(`Loaded ${allItems.length} loose items for property linking`);
            } catch (e) { console.log('Error loading items:', e); allItems = []; }

            // Load campaigns
            try {
                const campaignsSnapshot = await getDocs(collection(db, 'campaigns'));
                allCampaigns = campaignsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                console.log(`Loaded ${allCampaigns.length} campaigns`);
            } catch (e) { console.log('Error loading campaigns:', e); allCampaigns = []; }

            // Session Logs REMOVIDOS do Worldbuilding — agora vivem no Painel do Mestre.
            allSessions = [];

            // Load characters for campaign player selection
            try {
                const charactersSnapshot = await getDocs(query(collection(db, 'char'), where('ownerUid', '==', window.currentUser?.uid || '')));
                allCharacters = charactersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                console.log(`Loaded ${allCharacters.length} characters for campaigns`);
            } catch (e) { console.log('Error loading characters:', e); allCharacters = []; }

            // Load favorite campaign setting
            try {
                const settingsDoc = await getDoc(doc(db, 'worldbuilding-settings', 'session-logs'));
                if (settingsDoc.exists() && settingsDoc.data().favoriteCampaignId) {
                    favoriteCampaignId = settingsDoc.data().favoriteCampaignId;
                    // Auto-select favorite campaign
                    currentCampaign = allCampaigns.find(c => c.id === favoriteCampaignId) || null;
                    console.log(`Favorite campaign loaded: ${favoriteCampaignId}`);
                }
            } catch (e) { console.log('Error loading favorite campaign:', e); }

            // Load Submundo data
            try {
                const feirasSnapshot = await getDocs(collection(db, 'worldbuilding-submundo-feiras'));
                submundoFeiras = feirasSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                console.log(`Loaded ${submundoFeiras.length} feiras`);
            } catch (e) { console.log('Error loading feiras:', e); submundoFeiras = []; }

            try {
                const repSnapshot = await getDocs(collection(db, 'worldbuilding-submundo-reputacoes'));
                submundoReputacoes = repSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                console.log(`Loaded ${submundoReputacoes.length} reputações`);
            } catch (e) { console.log('Error loading reputações:', e); submundoReputacoes = []; }

            try {
                // submundoContatos is now derived from NPCs with submundo data
                submundoContatos = (allData.npcs || []).filter(n => n.submundo?.papelSubmundo);
                console.log(`Derived ${submundoContatos.length} contatos do submundo from NPCs`);
            } catch (e) { console.log('Error deriving contatos:', e); submundoContatos = []; }

            // Compute reverse references for bidirectional linking
            computeReverseReferences();

            // Initialize hover preview cards
            initHoverCards();
        }

        /* Casca: quem desenha e o toast da mesa (shared/dialogo.js). */
        function showAlert(message, type) { return toast(message, type); }

        // ==================== GEOGRAPHIC HIERARCHY FUNCTIONS ====================

        // Get icon for geography type
        function getGeographyIcon(tipo) {
            const icons = {
                'Continente': '🌍',
                'Região': '🗺️',
                'Cidade': '🏰',
                'Vila': '🏘️',
                'Ponto de Interesse': '📍'
            };
            return icons[tipo] || '📍';
        }
        window.getGeographyIcon = getGeographyIcon;

        // Get full path from root to a geography entry
        function getGeographyPath(geographyId) {
            const path = [];
            let current = allData.geography?.find(g => g.id === geographyId);

            while (current) {
                path.unshift(current);
                current = current.pertenceA?.id
                    ? allData.geography.find(g => g.id === current.pertenceA.id)
                    : null;
            }

            return path;
        }
        window.getGeographyPath = getGeographyPath;

        // Get breadcrumb HTML path for a geography
        function getGeographyBreadcrumbPath(geographyId) {
            const path = getGeographyPath(geographyId);
            if (path.length === 0) return '';

            return path.map((g, i) =>
                `${getGeographyIcon(g.tipo)} ${g.nome}`
            ).join(' › ');
        }
        window.getGeographyBreadcrumbPath = getGeographyBreadcrumbPath;

        // Build hierarchical tree structure from flat geography list
        function buildGeographyTree(geographies) {
            const tree = [];
            const map = new Map();

            // Create map of all geographies
            geographies.forEach(g => map.set(g.id, { ...g, children: [] }));

            // Build hierarchy
            geographies.forEach(g => {
                if (g.pertenceA?.id) {
                    const parent = map.get(g.pertenceA.id);
                    if (parent) parent.children.push(map.get(g.id));
                } else {
                    tree.push(map.get(g.id));
                }
            });

            // Sort tree nodes by type priority then name
            const typePriority = { 'Continente': 0, 'Região': 1, 'Cidade': 2, 'Vila': 3, 'Ponto de Interesse': 4 };
            const sortNodes = (nodes) => {
                nodes.sort((a, b) => {
                    const priorityDiff = (typePriority[a.tipo] || 5) - (typePriority[b.tipo] || 5);
                    return priorityDiff !== 0 ? priorityDiff : (a.nome || '').localeCompare(b.nome || '');
                });
                nodes.forEach(node => {
                    if (node.children?.length) sortNodes(node.children);
                });
            };
            sortNodes(tree);

            return tree;
        }
        window.buildGeographyTree = buildGeographyTree;

        // Count child entities for a geography
        function countChildEntities(geographyId) {
            const childGeographies = allData.geography?.filter(g => g.pertenceA?.id === geographyId) || [];

            // Count NPCs linked to this geography
            const geography = allData.geography?.find(g => g.id === geographyId);
            const linkedNpcsCount = geography?.linkedNpcs?.length || 0;

            // Count properties in this geography (if they have geographyId field)
            const linkedProperties = allData.properties?.filter(p =>
                p.geographyId === geographyId ||
                p.localizacao?.toLowerCase().includes(geography?.nome?.toLowerCase() || '')
            ) || [];

            return {
                geographies: childGeographies.length,
                npcs: linkedNpcsCount,
                properties: linkedProperties.length
            };
        }
        window.countChildEntities = countChildEntities;

        // Update parent preview when selection changes
        window.updateParentPreview = function () {
            const select = document.getElementById('entryPertenceA');
            const previewContainer = document.getElementById('parentPreviewContainer');
            const breadcrumb = document.getElementById('parentBreadcrumb');

            if (!select || !previewContainer || !breadcrumb) return;

            if (select.value) {
                const path = getGeographyBreadcrumbPath(select.value);
                breadcrumb.textContent = path;
                previewContainer.style.display = 'block';
            } else {
                previewContainer.style.display = 'none';
            }
        };


        // ==================== BIDIRECTIONAL REFERENCES SYSTEM ====================

        // Store for reverse references (computed, not saved to Firebase)
        let reverseReferences = {};

        // Compute all reverse references from the data
        function computeReverseReferences() {
            reverseReferences = {
                geography: {},
                npcs: {},
                factions: {},
                cultures: {},
                properties: {}
            };

            // Process Geography -> NPCs links (Geography references NPCs)
            (allData.geography || []).forEach(geo => {
                // NPCs linked to this geography
                (geo.linkedNpcs || []).forEach(npc => {
                    if (!reverseReferences.npcs[npc.id]) {
                        reverseReferences.npcs[npc.id] = { geography: [], properties: [], factions: [] };
                    }
                    reverseReferences.npcs[npc.id].geography.push({
                        id: geo.id,
                        nome: geo.nome,
                        tipo: geo.tipo,
                        titulo: npc.title || '',
                        icon: getGeographyIcon(geo.tipo)
                    });
                });

                // Tribos linked to this geography
                (geo.linkedTribos || []).forEach(tribo => {
                    if (!reverseReferences.factions[tribo.id]) {
                        reverseReferences.factions[tribo.id] = { geography: [], cultures: [] };
                    }
                    reverseReferences.factions[tribo.id].geography.push({
                        id: geo.id,
                        nome: geo.nome,
                        tipo: geo.tipo,
                        titulo: tribo.title || '',
                        icon: getGeographyIcon(geo.tipo)
                    });
                });
            });

            // Process Properties -> NPCs links
            (allData.properties || []).forEach(prop => {
                (prop.linkedNpcsProperty || []).forEach(npc => {
                    if (!reverseReferences.npcs[npc.id]) {
                        reverseReferences.npcs[npc.id] = { geography: [], properties: [], factions: [] };
                    }
                    reverseReferences.npcs[npc.id].properties.push({
                        id: prop.id,
                        nome: prop.nome,
                        tipo: prop.tipo,
                        titulo: npc.title || '',
                        icon: '🏠'
                    });
                });
            });

            // Process Factions -> Cultures links
            (allData.factions || []).forEach(faction => {
                (faction.linkedCulturas || []).forEach(cultura => {
                    if (!reverseReferences.cultures[cultura.id]) {
                        reverseReferences.cultures[cultura.id] = { factions: [] };
                    }
                    reverseReferences.cultures[cultura.id].factions.push({
                        id: faction.id,
                        nome: faction.nome,
                        tipo: faction.tipo,
                        titulo: cultura.title || '',
                        icon: '⚔️'
                    });
                });
            });

            // Process Geography hierarchy (children reference parents)
            (allData.geography || []).forEach(geo => {
                if (geo.pertenceA?.id) {
                    if (!reverseReferences.geography[geo.pertenceA.id]) {
                        reverseReferences.geography[geo.pertenceA.id] = { children: [] };
                    }
                    reverseReferences.geography[geo.pertenceA.id].children.push({
                        id: geo.id,
                        nome: geo.nome,
                        tipo: geo.tipo,
                        icon: getGeographyIcon(geo.tipo)
                    });
                }
            });

            console.log('Reverse references computed:', reverseReferences);
        }
        window.computeReverseReferences = computeReverseReferences;

        // Render "Referenced By" section for an entry
        function renderReferencedBySection(category, entryId) {
            const refs = reverseReferences[category]?.[entryId];
            if (!refs) return '';

            // Check if there are any references
            const hasRefs = Object.values(refs).some(arr => arr && arr.length > 0);
            if (!hasRefs) return '';

            let html = `
                <div class="referenced-by-section">
                    <h3 class="form-section-title">🔗 Referenciado Por</h3>
                    <div class="referenced-by-list">
            `;

            // Geography references
            if (refs.geography?.length) {
                html += `
                    <div class="ref-category">
                        <span class="ref-category-title">📍 Geografias</span>
                        <div class="ref-items-grid">
                            ${refs.geography.map(g => `
                                <div class="ref-item" data-hover-preview="geography:${g.id}" onclick="openEntry('geography', '${g.id}')">
                                    <span class="ref-item-icon">${g.icon}</span>
                                    <span class="ref-item-name">${g.nome}</span>
                                    ${g.titulo ? `<span class="ref-item-context">${g.titulo}</span>` : ''}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }

            // Properties references
            if (refs.properties?.length) {
                html += `
                    <div class="ref-category">
                        <span class="ref-category-title">🏠 Propriedades</span>
                        <div class="ref-items-grid">
                            ${refs.properties.map(p => `
                                <div class="ref-item" data-hover-preview="properties:${p.id}" onclick="openEntry('properties', '${p.id}')">
                                    <span class="ref-item-icon">${p.icon}</span>
                                    <span class="ref-item-name">${p.nome}</span>
                                    ${p.titulo ? `<span class="ref-item-context">${p.titulo}</span>` : ''}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }

            // Factions references
            if (refs.factions?.length) {
                html += `
                    <div class="ref-category">
                        <span class="ref-category-title">⚔️ Tribos &amp; Civilizações</span>
                        <div class="ref-items-grid">
                            ${refs.factions.map(f => `
                                <div class="ref-item" data-hover-preview="factions:${f.id}" onclick="openEntry('factions', '${f.id}')">
                                    <span class="ref-item-icon">${f.icon}</span>
                                    <span class="ref-item-name">${f.nome}</span>
                                    ${f.titulo ? `<span class="ref-item-context">${f.titulo}</span>` : ''}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }

            // Cultures references
            if (refs.cultures?.length) {
                html += `
                    <div class="ref-category">
                        <span class="ref-category-title">🎭 Culturas</span>
                        <div class="ref-items-grid">
                            ${refs.cultures.map(c => `
                                <div class="ref-item" data-hover-preview="cultures:${c.id}" onclick="openEntry('cultures', '${c.id}')">
                                    <span class="ref-item-icon">🎭</span>
                                    <span class="ref-item-name">${c.nome}</span>
                                    ${c.titulo ? `<span class="ref-item-context">${c.titulo}</span>` : ''}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }

            // Child geographies (for geographic hierarchy)
            if (refs.children?.length) {
                html += `
                    <div class="ref-category">
                        <span class="ref-category-title">📍 Locais Filhos</span>
                        <div class="ref-items-grid">
                            ${refs.children.map(c => `
                                <div class="ref-item" data-hover-preview="geography:${c.id}" onclick="openEntry('geography', '${c.id}')">
                                    <span class="ref-item-icon">${c.icon}</span>
                                    <span class="ref-item-name">${c.nome}</span>
                                    <span class="ref-item-context">${c.tipo}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }

            html += `</div></div>`;
            return html;
        }
        window.renderReferencedBySection = renderReferencedBySection;


        // ==================== HOVER PREVIEW CARDS (MINI-CARDS) ====================

        let hoverCardTimeout = null;
        let activeHoverCard = null;

        function initHoverCards() {
            document.addEventListener('mouseover', (e) => {
                const trigger = e.target.closest('[data-hover-preview]');
                if (!trigger) return;

                clearTimeout(hoverCardTimeout);
                hoverCardTimeout = setTimeout(() => {
                    const [category, id] = trigger.dataset.hoverPreview.split(':');
                    showHoverCard(trigger, category, id);
                }, 350);
            });

            document.addEventListener('mouseout', (e) => {
                const trigger = e.target.closest('[data-hover-preview]');
                if (!trigger) return;

                clearTimeout(hoverCardTimeout);
                setTimeout(() => {
                    if (!document.querySelector('.hover-preview-card:hover')) {
                        hideHoverCard();
                    }
                }, 100);
            });
        }

        function showHoverCard(trigger, category, id) {
            const entry = allData[category]?.find(e => e.id === id);
            if (!entry) return;

            hideHoverCard();

            const rect = trigger.getBoundingClientRect();
            const card = document.createElement('div');
            card.className = 'hover-preview-card';

            const config = categoryConfig[category];
            const desc = (entry.descricao || entry.historia || '').substring(0, 150);

            card.innerHTML = `
                ${entry.imagem ? `<img src="${entry.imagem}" class="hover-preview-image" onerror="this.style.display='none'">` : ''}
                <div class="hover-preview-header">
                    <span class="hover-preview-type">${config?.icon || '📄'} ${entry.tipo || category}</span>
                    <span class="hover-preview-name">${entry.nome || entry.titulo || 'Sem nome'}</span>
                </div>
                ${desc ? `<div class="hover-preview-desc">${desc}${desc.length >= 150 ? '...' : ''}</div>` : ''}
                ${entry.tags ? `<div class="hover-preview-tags">🏷️ ${entry.tags}</div>` : ''}
            `;

            // Position card - prefer below trigger, but adjust if near screen edge
            let top = rect.bottom + 10;
            let left = rect.left;

            // Ensure card stays on screen horizontally
            const cardWidth = 320;
            if (left + cardWidth > window.innerWidth - 20) {
                left = window.innerWidth - cardWidth - 20;
            }
            if (left < 20) left = 20;

            // If card would go below viewport, show above trigger
            if (top + 200 > window.innerHeight) {
                top = rect.top - 200 - 10;
            }

            card.style.top = `${top}px`;
            card.style.left = `${left}px`;

            document.body.appendChild(card);
            activeHoverCard = card;
        }

        function hideHoverCard() {
            if (activeHoverCard) {
                activeHoverCard.remove();
                activeHoverCard = null;
            }
        }

        window.initHoverCards = initHoverCards;
        window.showHoverCard = showHoverCard;
        window.hideHoverCard = hideHoverCard;


        // Navigation
        document.querySelectorAll('.nav-category').forEach(item => {
            item.addEventListener('click', () => {
                if (item.dataset.tool) return; // ferramentas novas: tratadas em wb-main.js
                document.querySelectorAll('.nav-category').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                currentCategory = item.dataset.category;
                if (currentCategory === 'dashboard') {
                    document.getElementById('contentTitle').textContent = 'Dashboard';
                    renderDashboard();
                } else if (currentCategory === 'session-logs') {
                    document.getElementById('contentTitle').textContent = 'Logs de Sessão';
                    // Auto-select favorite campaign when navigating to session logs
                    if (favoriteCampaignId) {
                        currentCampaign = allCampaigns.find(c => c.id === favoriteCampaignId) || currentCampaign;
                    }
                    renderSessionLogs();
                } else if (currentCategory === 'submundo') {
                    document.getElementById('contentTitle').textContent = '🌙 Submundo';
                    renderSubmundo();
                } else {
                    document.getElementById('contentTitle').textContent = categoryConfig[currentCategory].title;
                    renderCategoryList(currentCategory);
                }
            });
        });

        // Dashboard
        function renderDashboard() {
            const body = document.getElementById('contentBody');

            const allEntries = Object.entries(allData)
                .flatMap(([cat, entries]) => (entries || []).map(e => ({ ...e, category: cat })));
            const total = allEntries.length;

            const stats = Object.entries(categoryConfig).map(([key, config]) => `
                <div class="stat-card" onclick="navigateToCategory('${key}')" title="Abrir ${config.title}">
                    <div class="stat-icon">${config.icon}</div>
                    <div class="stat-value">${allData[key]?.length || 0}</div>
                    <div class="stat-label">${config.title}</div>
                </div>
            `).join('');

            // Saúde do mundo: o que ainda falta preencher.
            const semImagem = allEntries.filter(e => e.category !== 'rumors' && !e.imagem).length;
            const semDescricao = allEntries.filter(e => !e.descricao || e.descricao.length < 50).length;
            const rumoresAbertos = (allData.rumors || []).filter(r => r.status === 'ouvido' || r.status === 'investigado');
            const criadorCount = (criadorTribes || []).length;

            const recentEntries = allEntries
                .filter(e => e.lastUpdate)
                .sort((a, b) => new Date(b.lastUpdate || 0) - new Date(a.lastUpdate || 0))
                .slice(0, 8);

            const atalho = (icon, label, onclick) =>
                `<button class="wb-quickaction" onclick="${onclick}"><span>${icon}</span>${label}</button>`;

            body.innerHTML = `
                <div class="wb-dash-hero">
                    <div>
                        <div class="wb-dash-hero__total">${total}</div>
                        <div class="wb-dash-hero__label">entradas no seu mundo${criadorCount ? ` · ${criadorCount} tribos do Criador` : ''}</div>
                    </div>
                    <div class="wb-quickactions">
                        ${atalho('➕', 'Nova entrada', "document.getElementById('btnNewEntry').click()")}
                        ${atalho('🕸️', 'Grafos', "document.querySelector('[data-tool=\\'grafos\\']')?.click()")}
                        ${atalho('✒️', 'Escritório', "document.querySelector('[data-tool=\\'editor\\']')?.click()")}
                        ${atalho('📜', 'Linha do Tempo', "document.querySelector('[data-tool=\\'timeline\\']')?.click()")}
                    </div>
                </div>

                <div class="dashboard-grid">${stats}</div>

                <div class="wb-dash-health">
                    <div class="wb-health-card ${semImagem ? 'is-warn' : 'is-ok'}" onclick="navigateToCategory('geography')">
                        <div class="wb-health-card__v">${semImagem}</div>
                        <div class="wb-health-card__l">🖼️ sem imagem</div>
                    </div>
                    <div class="wb-health-card ${semDescricao ? 'is-warn' : 'is-ok'}" onclick="navigateToCategory('geography')">
                        <div class="wb-health-card__v">${semDescricao}</div>
                        <div class="wb-health-card__l">📝 descrição curta</div>
                    </div>
                    <div class="wb-health-card ${rumoresAbertos.length ? 'is-info' : 'is-ok'}" onclick="navigateToCategory('rumors')">
                        <div class="wb-health-card__v">${rumoresAbertos.length}</div>
                        <div class="wb-health-card__l">💬 rumores ativos</div>
                    </div>
                </div>

                ${rumoresAbertos.length > 0 ? `
                    <div class="entries-section">
                        <div class="section-header"><h2 class="section-title">💬 Rumores em Aberto</h2></div>
                        <div class="entries-grid">
                            ${rumoresAbertos.slice(0, 3).map(r => renderEntryCard(r, 'rumors')).join('')}
                        </div>
                    </div>
                ` : ''}

                <div class="entries-section">
                    <div class="section-header"><h2 class="section-title">🕒 Editados recentemente</h2></div>
                    <div class="entries-grid" id="recentEntries">
                        ${recentEntries.length ? recentEntries.map(e => renderEntryCard(e, e.category)).join('') :
                    '<div class="no-entries"><div class="no-entries-icon">📝</div><p>Nenhuma entrada ainda. Clique em "Nova Entrada" para começar!</p></div>'}
                    </div>
                </div>
            `;
        }
        window.navigateToCategory = (cat) => {
            document.querySelector(`[data-category="${cat}"]`).click();
        };

        // ==================== SUBMUNDO PANEL ====================

        function renderSubmundo() {
            const body = document.getElementById('contentBody');
            document.getElementById('btnNewEntry').style.display = 'none';

            const tabs = [
                { id: 'dashboard', icon: '📊', label: 'Dashboard' },
                { id: 'feiras', icon: '🏕️', label: 'Feiras Nômades' },
                { id: 'contatos', icon: '🔗', label: 'Rede de Contatos' },
                { id: 'precos', icon: '💰', label: 'Tabela de Preços' },
                { id: 'simbolos', icon: '🔣', label: 'Guia de Símbolos' },
                { id: 'reputacao', icon: '⭐', label: 'Reputação dos PCs' }
            ];

            const tabsHtml = tabs.map(t => `
                <button class="submundo-tab ${currentSubmundoTab === t.id ? 'active' : ''}" 
                        onclick="setSubmundoTab('${t.id}')">
                    ${t.icon} ${t.label}
                </button>
            `).join('');

            let contentHtml = '';

            if (currentSubmundoTab === 'dashboard') {
                contentHtml = renderSubmundoDashboard();
            } else if (currentSubmundoTab === 'feiras') {
                contentHtml = renderSubmundoFeiras();
            } else if (currentSubmundoTab === 'contatos') {
                contentHtml = renderSubmundoContatos();
            } else if (currentSubmundoTab === 'precos') {
                contentHtml = renderSubmundoPrecos();
            } else if (currentSubmundoTab === 'simbolos') {
                contentHtml = renderSubmundoSimbolos();
            } else if (currentSubmundoTab === 'reputacao') {
                contentHtml = renderSubmundoReputacao();
            }

            body.innerHTML = `
                <div class="submundo-container">
                    <div class="submundo-header">
                        <h2>🌙 Submundo de Vasteluna</h2>
                        <p class="submundo-motto">"Onde a luz das leis não alcança, outro código governa."</p>
                    </div>
                    <div class="submundo-tabs">${tabsHtml}</div>
                    <div class="submundo-content">${contentHtml}</div>
                </div>
            `;
        }

        window.setSubmundoTab = function (tab) {
            currentSubmundoTab = tab;
            renderSubmundo();
        };

        function renderSubmundoDashboard() {
            const contatosAtivos = submundoContatos.filter(c => !c.submundo?.marcas?.length);
            const mestres = submundoContatos.filter(c => c.submundo?.papelSubmundo === 'mestre');

            return `
                <div class="submundo-stats-grid">
                    <div class="submundo-stat-card" onclick="setSubmundoTab('feiras')">
                        <span class="stat-icon">🏕️</span>
                        <span class="stat-value">${submundoFeiras.length}</span>
                        <span class="stat-label">Feiras Conhecidas</span>
                    </div>
                    <div class="submundo-stat-card" onclick="setSubmundoTab('contatos')">
                        <span class="stat-icon">🔗</span>
                        <span class="stat-value">${contatosAtivos.length}</span>
                        <span class="stat-label">Contatos Ativos</span>
                    </div>
                    <div class="submundo-stat-card">
                        <span class="stat-icon">👑</span>
                        <span class="stat-value">${mestres.length}</span>
                        <span class="stat-label">Mestres de Feira</span>
                    </div>
                    <div class="submundo-stat-card" onclick="setSubmundoTab('precos')">
                        <span class="stat-icon">💰</span>
                        <span class="stat-value">${Object.keys(submundoPrecos).length}</span>
                        <span class="stat-label">Categorias de Preços</span>
                    </div>
                </div>
                
                <div class="submundo-section">
                    <h3 style="color: var(--light); margin-bottom: 15px;">📜 As Três Leis</h3>
                    <div class="leis-grid">
                        <div class="lei-card">
                            <span class="lei-nome">A Paz da Feira</span>
                            <span class="lei-texto">"Nenhuma violência dentro da Feira."</span>
                            <span class="lei-violacao" style="color: var(--lr-blood-2);">Violação: Quebrado</span>
                        </div>
                        <div class="lei-card">
                            <span class="lei-nome">A Palavra Dada</span>
                            <span class="lei-texto">"Todo acordo fechado é sagrado."</span>
                            <span class="lei-violacao" style="color: var(--lr-gold);">Violação: Sem Palavra</span>
                        </div>
                        <div class="lei-card">
                            <span class="lei-nome">O Silêncio</span>
                            <span class="lei-texto">"O que acontece no Submundo, permanece no Submundo."</span>
                            <span class="lei-violacao" style="color: #000;">Violação: Delator</span>
                        </div>
                    </div>
                </div>
                
                ${submundoFeiras.length > 0 ? `
                    <div class="submundo-section" style="margin-top: 30px;">
                        <h3 style="color: var(--light); margin-bottom: 15px;">📅 Feiras Recentes</h3>
                        <div class="feiras-grid">
                            ${submundoFeiras.slice(0, 3).map(f => renderFeiraCard(f)).join('')}
                        </div>
                    </div>
                ` : `
                    <div class="empty-state" style="margin-top: 30px;">
                        <div class="empty-state-icon">🏕️</div>
                        <p class="empty-state-title">Nenhuma Feira cadastrada</p>
                        <p>Clique em "Feiras Nômades" para adicionar feiras ao Submundo.</p>
                    </div>
                `}
            `;
        }

        function renderSubmundoFeiras() {
            return `
                <div class="feiras-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h3 style="color: var(--light);">🏕️ Feiras Nômades</h3>
                    <button class="btn btn-primary" onclick="openFeiraModal()" style="padding: 10px 20px; background: #6E5413; border: none; border-radius: 8px; color: white; cursor: pointer;">
                        ➕ Nova Feira
                    </button>
                </div>
                ${submundoFeiras.length > 0 ? `
                    <div class="feiras-grid">
                        ${submundoFeiras.map(f => renderFeiraCard(f)).join('')}
                    </div>
                ` : `
                    <div class="empty-state">
                        <div class="empty-state-icon">🏕️</div>
                        <p class="empty-state-title">Nenhuma Feira cadastrada</p>
                        <p>Crie a primeira Feira Nômade do Submundo!</p>
                    </div>
                `}
            `;
        }

        function renderFeiraCard(feira) {
            // A pilula .feira-escala tem texto branco fixo, entao a cor aqui
            // precisa ser escura o bastante para o branco ler: o ambar e o
            // vermelho antigos (#F59E0B, #EF4444) davam 2.15:1 e 3.76:1.
            const escalaColors = {
                pequena: '#6B7280',
                media: '#1D4ED8',
                grande: '#B45309',
                excepcional: '#B91C1C'
            };

            return `
                <div class="feira-card" onclick="openFeiraDetails('${feira.id}')">
                    ${feira.imagem ? `<img src="${feira.imagem}" class="feira-image" onerror="this.style.display='none'">` : ''}
                    <div class="feira-content">
                        <div class="feira-header">
                            <span class="feira-escala" style="background: ${escalaColors[feira.escala] || 'var(--lr-text-2)'}">
                                ${feira.escala || 'média'}
                            </span>
                            <span class="feira-frequencia">${feira.frequencia || 'irregular'}</span>
                        </div>
                        <div class="feira-nome">${feira.nome}</div>
                        <div class="feira-info">📍 ${feira.rotaRegiao?.nome || 'Região desconhecida'}</div>
                        ${feira.especialidades?.length ? `
                            <div class="feira-especialidades">
                                ${feira.especialidades.slice(0, 3).map(e => `<span class="especialidade-badge">${e}</span>`).join('')}
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }

        function renderSubmundoPrecos() {
            const categorias = [
                { id: 'informacoes', label: '🔍 Informações e Acesso' },
                { id: 'substancias', label: '🧪 Substâncias' },
                { id: 'equipamentos', label: '⚔️ Equipamentos e Relíquias' },
                { id: 'documentos', label: '📜 Documentos e Identidades' },
                { id: 'servicos', label: '🗡️ Serviços de Violência' },
                { id: 'outros', label: '📦 Outros' }
            ];

            // Default price data
            const defaultPrecos = {
                informacoes: [
                    { item: 'Acesso a Corredor (por viagem)', precoMin: 50, precoMax: 200 },
                    { item: 'Apresentação a um Contato', precoMin: 100, precoMax: 500 },
                    { item: 'Localização de uma pessoa', precoMin: 200, precoMax: 1000 },
                    { item: 'Informação sobre guarda/patrulha', precoMin: 50, precoMax: 300 }
                ],
                substancias: [
                    { item: 'Veneno comum', precoMin: 100, precoMax: 300 },
                    { item: 'Veneno raro', precoMin: 500, precoMax: 2000 },
                    { item: 'Antídoto', precoMin: 150, precoMax: 500 },
                    { item: 'Ópio ou similar', precoMin: 50, precoMax: 200 }
                ],
                equipamentos: [
                    { item: 'Arma sem origem', precoMin: 200, precoMax: 800 },
                    { item: 'Armadura encantada', precoMin: 1000, precoMax: 5000 },
                    { item: 'Relíquia menor', precoMin: 2000, precoMax: 10000 }
                ],
                documentos: [
                    { item: 'Identidade falsa simples', precoMin: 100, precoMax: 500 },
                    { item: 'Documentos nobiliárquicos', precoMin: 500, precoMax: 3000 },
                    { item: 'Selo real falsificado', precoMin: 2000, precoMax: 10000 }
                ],
                servicos: [
                    { item: 'Intimidação', precoMin: 100, precoMax: 500 },
                    { item: 'Surra/atentado não-letal', precoMin: 300, precoMax: 1000 },
                    { item: 'Assassinato (plebeu)', precoMin: 1000, precoMax: 3000 },
                    { item: 'Assassinato (nobre)', precoMin: 5000, precoMax: 20000 }
                ],
                outros: [
                    { item: 'Passagem clandestina', precoMin: 200, precoMax: 1000 },
                    { item: 'Esconderijo por semana', precoMin: 50, precoMax: 200 },
                    { item: 'Guarda-costas por dia', precoMin: 100, precoMax: 500 }
                ]
            };

            const precos = Object.keys(submundoPrecos).length > 0 ? submundoPrecos : defaultPrecos;

            return `
                <div class="precos-container">
                    <h3 style="color: var(--light); margin-bottom: 15px;">💰 Tabela de Preços do Submundo</h3>
                    <p style="color: var(--lr-text-2); margin-bottom: 20px; font-size: 0.9rem;">
                        Valores em moedas de prata (₲). Preços variam com disponibilidade, urgência e reputação.
                    </p>
                    ${categorias.map(cat => `
                        <div style="margin-bottom: 25px;">
                            <h4 style="color: var(--primary); margin-bottom: 10px;">${cat.label}</h4>
                            <table class="precos-table">
                                <thead>
                                    <tr>
                                        <th style="width: 50%;">Item/Serviço</th>
                                        <th>Preço Mín.</th>
                                        <th>Preço Máx.</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${(precos[cat.id] || []).map(item => `
                                        <tr>
                                            <td>${item.item}</td>
                                            <td>${item.precoMin} ₲</td>
                                            <td>${item.precoMax}+ ₲</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        function renderSubmundoSimbolos() {
            const simbolosLocalizacao = [
                { simbolo: '⊙', nome: 'Círculo com ponto', significado: 'Feira acontecerá aqui' },
                { simbolo: '↺', nome: 'Seta curva', significado: 'Siga esta direção para a Feira' },
                { simbolo: '⊗', nome: 'X em círculo', significado: 'Local comprometido, evite' },
                { simbolo: '≡', nome: 'Três traços', significado: 'Corredor disponível aqui' },
                { simbolo: '☽', nome: 'Lua crescente', significado: 'Hoje à noite' },
                { simbolo: '☾', nome: 'Lua minguante', significado: 'Amanhã à noite' }
            ];

            const simbolosMercadoria = [
                { simbolo: '🍃', categoria: 'Substâncias alquímicas' },
                { simbolo: '🌀', categoria: 'Itens do Abismo' },
                { simbolo: '👑', categoria: 'Relíquias e artefatos' },
                { simbolo: '💀', categoria: 'Materiais necromânticos' },
                { simbolo: '🗡️', categoria: 'Serviços de violência' },
                { simbolo: '👁️', categoria: 'Informações e segredos' },
                { simbolo: '📜', categoria: 'Documentos e falsificações' },
                { simbolo: '🔮', categoria: 'Itens mágicos' }
            ];

            return `
                <div style="margin-bottom: 30px;">
                    <h3 style="color: var(--light); margin-bottom: 15px;">📍 Símbolos de Localização</h3>
                    <p style="color: var(--lr-text-2); margin-bottom: 15px; font-size: 0.9rem;">
                        Marcas discretas deixadas em paredes, postes e portas para comunicação secreta.
                    </p>
                    <div class="simbolos-grid">
                        ${simbolosLocalizacao.map(s => `
                            <div class="simbolo-card">
                                <span class="simbolo-icon">${s.simbolo}</span>
                                <span class="simbolo-nome">${s.nome}</span>
                                <span class="simbolo-significado">${s.significado}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <div>
                    <h3 style="color: var(--light); margin-bottom: 15px;">📦 Símbolos de Mercadoria</h3>
                    <p style="color: var(--lr-text-2); margin-bottom: 15px; font-size: 0.9rem;">
                        Indicam o tipo de mercadoria ou serviço disponível em um local.
                    </p>
                    <div class="simbolos-grid">
                        ${simbolosMercadoria.map(s => `
                            <div class="simbolo-card">
                                <span class="simbolo-icon">${s.simbolo}</span>
                                <span class="simbolo-categoria">${s.categoria}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        function renderSubmundoContatos() {
            const papeis = [
                { value: 'corredor', label: 'Corredores' },
                { value: 'mercador', label: 'Mercadores' },
                { value: 'mestre', label: 'Mestres de Feira' },
                { value: 'vigia', label: 'Vigias' },
                { value: 'armador', label: 'Armadores' },
                { value: 'cliente', label: 'Clientes' },
                { value: 'informante', label: 'Informantes' }
            ];

            const especialidades = [
                { value: 'alquimistaSombrio', label: 'Alquimista Sombrio' },
                { value: 'traficantesReliquias', label: 'Traficante de Relíquias' },
                { value: 'negocianteVeu', label: 'Negociante do Véu' },
                { value: 'armeiroDiscreto', label: 'Armeiro Discreto' },
                { value: 'corretorCarne', label: 'Corretor de Carne' },
                { value: 'vendedorSegredos', label: 'Vendedor de Segredos' },
                { value: 'geral', label: 'Geral' }
            ];
            const regioes = [...new Set((allData.geography || []).map(g => g.nome))].sort();

            // Get all NPCs with submundo data
            let contatos = (allData.npcs || []).filter(n => n.submundo?.papelSubmundo);

            // Apply filters
            if (submundoFilters.papel) {
                contatos = contatos.filter(c => c.submundo.papelSubmundo === submundoFilters.papel);
            }
            if (submundoFilters.especialidade) {
                contatos = contatos.filter(c => c.submundo.especialidade === submundoFilters.especialidade);
            }
            if (submundoFilters.regiao) {
                contatos = contatos.filter(c => {
                    const geo = allData.geography?.find(g => g.id === c.locationId);
                    return geo?.nome === submundoFilters.regiao;
                });
            }

            return `
                <div class="contatos-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h3 style="color: var(--light);">🔗 Rede de Contatos</h3>
                </div>

                <div class="submundo-filters" style="margin-bottom: 25px;">
                    <div class="submundo-filter-group">
                        <label class="submundo-filter-label">Papel</label>
                        <select class="submundo-filter-select" id="filterPapel" onchange="applySubmundoFilters('papel', this.value)">
                            <option value="">Todos os Papéis</option>
                            ${papeis.map(p => `<option value="${p.value}" ${submundoFilters.papel === p.value ? 'selected' : ''}>${p.label}</option>`).join('')}
                        </select>
                    </div>
                    <div class="submundo-filter-group">
                        <label class="submundo-filter-label">Especialidade (Mercadores)</label>
                        <select class="submundo-filter-select" id="filterEspecialidade" onchange="applySubmundoFilters('especialidade', this.value)">
                            <option value="">Todas as Especialidades</option>
                            ${especialidades.map(e => `<option value="${e.value}" ${submundoFilters.especialidade === e.value ? 'selected' : ''}>${e.label}</option>`).join('')}
                        </select>
                    </div>
                    <div class="submundo-filter-group">
                        <label class="submundo-filter-label">Região</label>
                        <select class="submundo-filter-select" id="filterRegiao" onchange="applySubmundoFilters('regiao', this.value)">
                            <option value="">Todas as Regiões</option>
                            ${regioes.map(r => `<option value="${r}" ${submundoFilters.regiao === r ? 'selected' : ''}>${r}</option>`).join('')}
                        </select>
                    </div>
                </div>

                ${contatos.length > 0 ? `
                    <div class="contatos-grid">
                        ${contatos.map(c => renderContatoCard(c)).join('')}
                    </div>
                ` : `
                    <div class="empty-state">
                        <div class="empty-state-icon">🔗</div>
                        <p class="empty-state-title">${(submundoFilters.papel || submundoFilters.especialidade || submundoFilters.regiao) ? 'Nenhum contato com estes filtros' : 'Nenhum contato cadastrado'}</p>
                        <p>Vincule NPCs ao Submundo no formulário de edição de NPC.</p>
                    </div>
                `}
            `;
        }

        window.applySubmundoFilters = function (field, value) {
            submundoFilters[field] = value;
            renderSubmundo();
        };

        function renderContatoCard(npc) {
            const submundo = npc.submundo;
            const papelLabels = {
                corredor: '🚶 Corredor',
                mercador: '💼 Mercador',
                mestre: '👑 Mestre de Feira',
                vigia: '👁️ Vigia',
                armador: '⚙️ Armador',
                cliente: '🤝 Cliente',
                informante: '🔍 Informante'
            };

            const especialidadeLabels = {
                alquimistaSombrio: '🧪 Alquimista Sombrio',
                traficantesReliquias: '👑 Traficante de Relíquias',
                negocianteVeu: '🌀 Negociante do Véu',
                armeiroDiscreto: '⚔️ Armeiro Discreto',
                corretorCarne: '💀 Corretor de Carne',
                vendedorSegredos: '👁️ Vendedor de Segredos',
                geral: '📦 Geral'
            };

            const geo = allData.geography?.find(g => g.id === npc.locationId);

            return `
                <div class="contato-card" onclick="openEntry('npcs', '${npc.id}')">
                    <div class="contato-header">
                        <span class="contato-papel">${papelLabels[submundo.papelSubmundo] || submundo.papelSubmundo}</span>
                        <div style="display: flex; flex-direction: column; align-items: flex-end;">
                            <span class="contato-nivel">Nível ${submundo.nivelAcesso || 0}/5</span>
                            ${geo ? `<small style="font-size: 0.7rem; color: var(--lr-text-2);">📍 ${geo.nome}</small>` : ''}
                        </div>
                    </div>
                    <div class="contato-nome">${npc.nome || 'NPC Desconhecido'}</div>
                    ${submundo.nomeDeSombra ? `<div class="contato-sombra">"${submundo.nomeDeSombra}"</div>` : ''}
                    ${submundo.especialidade ? `<div style="font-size: 0.8rem; color: var(--primary); margin-top: 5px;">${especialidadeLabels[submundo.especialidade] || submundo.especialidade}</div>` : ''}
                    ${submundo.marcas?.length ? `
                        <div class="contato-marcas">
                            ${submundo.marcas.map(m => `
                                <span class="marca-badge marca-${m.toLowerCase()}">${m}</span>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            `;
        }

        function renderSubmundoReputacao() {
            const characters = currentCampaign?.personagens || [];

            return `
                <h3 style="color: var(--light); margin-bottom: 20px;">⭐ Reputação dos PCs no Submundo</h3>
                ${characters.length > 0 ? `
                    <div class="reputacao-container">
                        ${characters.map(char => {
                const rep = submundoReputacoes.find(r => r.id === char.id) || { nivelAcesso: 0, marcas: [] };
                return `
                                <div class="reputacao-card">
                                    <div class="reputacao-header">
                                        ${char.imagem ? `<img src="${char.imagem}" class="reputacao-avatar" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>👤</text></svg>'">` :
                        '<div class="reputacao-avatar" style="background: var(--primary); display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">👤</div>'}
                                            <div style="display: flex; justify-content: space-between; align-items: center; flex: 1;">
                                                <div>
                                                    <div style="font-weight: 700; color: var(--light);">${char.nome || char.name}</div>
                                                    <div style="font-size: 0.85rem; color: var(--lr-text-2);">${char.jogador || 'Jogador'}</div>
                                                </div>
                                                <button class="btn-edit-rep" onclick="openReputacaoModal('${char.id}')" title="Editar Reputação" style="background: rgba(91, 63, 184, 0.2); border: 1px solid var(--primary); color: var(--primary); border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s;">✏️</button>
                                            </div>
                                    </div>
                                    <div class="reputacao-nivel">
                                        <span style="font-size: 0.85rem; color: var(--lr-text-2);">Nível de Acesso:</span>
                                        <div class="nivel-bar">
                                            <div class="nivel-fill" style="width: ${(rep.nivelAcesso / 5) * 100}%"></div>
                                        </div>
                                        <span style="font-weight: 700; color: var(--primary);">${rep.nivelAcesso}/5</span>
                                    </div>
                                    ${rep.marcas?.length ? `
                                        <div class="contato-marcas" style="margin-bottom: 15px;">
                                            ${rep.marcas.map(m => `
                                                <span class="marca-badge marca-${m.toLowerCase().replace(/ /g, '-')}" style="margin-bottom: 4px;">${m}</span>
                                            `).join('')}
                                        </div>
                                    ` : '<p style="font-size: 0.85rem; color: var(--lr-text-2); margin-bottom: 15px;">Sem marcas</p>'}
                                    ${rep.notas ? `
                                        <div class="rep-notes" style="font-size: 0.8rem; color: var(--lr-text-2); padding: 10px; background: var(--lr-surface-2); border-radius: 8px; border-left: 3px solid var(--primary);">
                                            <strong>Notas:</strong> ${rep.notas}
                                        </div>
                                    ` : ''}
                                </div>
                            `;
            }).join('')}
                    </div>
                ` : `
                    <div class="empty-state">
                        <div class="empty-state-icon">⭐</div>
                        <p class="empty-state-title">Nenhum PC na campanha</p>
                        <p>Adicione personagens à campanha para gerenciar sua reputação no Submundo.</p>
                    </div>
                `}
            `;
        }

        // ==================== FEIRA CRUD ====================

        let currentEditingFeira = null;
        let feiraEspecialidades = [];
        let feiraMercadoresFixos = [];

        window.openFeiraModal = function (feiraId = null) {
            currentEditingFeira = feiraId ? submundoFeiras.find(f => f.id === feiraId) : null;
            feiraEspecialidades = currentEditingFeira?.especialidades || [];
            feiraMercadoresFixos = currentEditingFeira?.mercadoresFixos || [];

            const modal = document.getElementById('entryModal');
            const title = document.getElementById('entryModalTitle');
            const body = document.getElementById('entryModalBody');
            const footer = document.querySelector('#entryModal .modal-footer');
            const deleteBtn = document.getElementById('btnDeleteEntry');

            title.innerHTML = currentEditingFeira ? '✏️ Editar Feira' : '🏕️ Nova Feira';

            const geographyOptions = (allData.geography || [])
                .map(g => `<option value="${g.id}" ${currentEditingFeira?.rotaRegiao?.id === g.id ? 'selected' : ''}>${g.nome} (${g.tipo})</option>`)
                .join('');

            const npcOptions = (allData.npcs || [])
                .map(n => `<option value="${n.id}" ${currentEditingFeira?.mestreDeFeira?.id === n.id ? 'selected' : ''}>${n.nome}</option>`)
                .join('');

            const especialidadesAll = ['Venenos', 'Relíquias', 'Documentos', 'Informações', 'Armas', 'Magias', 'Itens do Abismo', 'Materiais Necromânticos', 'Contrabando'];

            body.innerHTML = `
                <form id="feiraForm" class="entry-form">
                    <div class="form-row">
                        <div class="form-group" style="flex: 2;">
                            <label class="form-label">Nome da Feira *</label>
                            <input type="text" id="feiraNome" class="form-input" value="${currentEditingFeira?.nome || ''}" required>
                        </div>
                        <div class="form-group" style="flex: 1;">
                            <label class="form-label">Frequência</label>
                            <select id="feiraFrequencia" class="form-input">
                                <option value="semanal" ${currentEditingFeira?.frequencia === 'semanal' ? 'selected' : ''}>Semanal</option>
                                <option value="quinzenal" ${currentEditingFeira?.frequencia === 'quinzenal' ? 'selected' : ''}>Quinzenal</option>
                                <option value="mensal" ${currentEditingFeira?.frequencia === 'mensal' ? 'selected' : ''}>Mensal</option>
                                <option value="irregular" ${currentEditingFeira?.frequencia === 'irregular' || !currentEditingFeira?.frequencia ? 'selected' : ''}>Irregular</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Escala</label>
                        <div class="escala-selector">
                            <div class="escala-option ${currentEditingFeira?.escala === 'pequena' ? 'selected' : ''}" onclick="selectEscala('pequena')">
                                <span class="escala-label">🏕️ Pequena</span>
                                <span class="escala-desc">5-15 pessoas</span>
                            </div>
                            <div class="escala-option ${(!currentEditingFeira?.escala || currentEditingFeira?.escala === 'media') ? 'selected' : ''}" onclick="selectEscala('media')">
                                <span class="escala-label">🏕️🏕️ Média</span>
                                <span class="escala-desc">15-50 pessoas</span>
                            </div>
                            <div class="escala-option ${currentEditingFeira?.escala === 'grande' ? 'selected' : ''}" onclick="selectEscala('grande')">
                                <span class="escala-label">🏕️🏕️🏕️ Grande</span>
                                <span class="escala-desc">50-200 pessoas</span>
                            </div>
                            <div class="escala-option ${currentEditingFeira?.escala === 'excepcional' ? 'selected' : ''}" onclick="selectEscala('excepcional')">
                                <span class="escala-label">⭐ Excepcional</span>
                                <span class="escala-desc">200+ pessoas</span>
                            </div>
                        </div>
                        <input type="hidden" id="feiraEscala" value="${currentEditingFeira?.escala || 'media'}">
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group" style="flex: 1;">
                            <label class="form-label">🏛️ Região de Operação</label>
                            <select id="feiraRegiao" class="form-input">
                                <option value="">Selecione uma região</option>
                                ${geographyOptions}
                            </select>
                        </div>
                        <div class="form-group" style="flex: 1;">
                            <label class="form-label">👑 Mestre de Feira</label>
                            <select id="feiraMestre" class="form-input">
                                <option value="">Selecione um NPC</option>
                                ${npcOptions}
                            </select>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">🏷️ Especialidades</label>
                        <div class="specialty-selector">
                            ${especialidadesAll.map(esp => `
                                <div class="specialty-chip ${feiraEspecialidades.includes(esp) ? 'selected' : ''}" 
                                     onclick="toggleEspecialidade('${esp}')">
                                    ${esp}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">📝 Descrição</label>
                        <textarea id="feiraDescricao" class="form-input" rows="3" placeholder="Descrição da feira...">${currentEditingFeira?.descricao || ''}</textarea>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">🖼️ Imagem</label>
                        ${CampoImagem.html({ id: 'feiraImagem', classe: 'form-input', valor: currentEditingFeira?.imagem || '', pasta: 'worldbuilding-images/feiras' })}
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">🏷️ Tags (separadas por vírgula)</label>
                        <input type="text" id="feiraTags" class="form-input" value="${currentEditingFeira?.tags || ''}" placeholder="submundo, secreto, noturno">
                    </div>
                </form>
            `;

            deleteBtn.style.display = currentEditingFeira ? 'block' : 'none';
            deleteBtn.onclick = deleteFeira;

            // Override footer save button
            const saveBtn = footer.querySelector('.btn-success');
            if (saveBtn) {
                saveBtn.onclick = saveFeira;
            }

            modal.classList.add('active');
        };

        window.selectEscala = function (escala) {
            document.querySelectorAll('.escala-option').forEach(el => el.classList.remove('selected'));
            document.querySelector(`.escala-option:nth-child(${['pequena', 'media', 'grande', 'excepcional'].indexOf(escala) + 1})`).classList.add('selected');
            document.getElementById('feiraEscala').value = escala;
        };

        window.toggleEspecialidade = function (esp) {
            const idx = feiraEspecialidades.indexOf(esp);
            if (idx > -1) {
                feiraEspecialidades.splice(idx, 1);
            } else {
                feiraEspecialidades.push(esp);
            }
            document.querySelectorAll('.specialty-chip').forEach(chip => {
                if (chip.textContent.trim() === esp) {
                    chip.classList.toggle('selected', feiraEspecialidades.includes(esp));
                }
            });
        };

        window.saveFeira = async function () {
            const nome = document.getElementById('feiraNome').value.trim();
            if (!nome) {
                showAlert('Nome da feira é obrigatório!', 'error');
                return;
            }

            const regiaoSelect = document.getElementById('feiraRegiao');
            const mestreSelect = document.getElementById('feiraMestre');

            const feira = {
                nome: nome,
                frequencia: document.getElementById('feiraFrequencia').value,
                escala: document.getElementById('feiraEscala').value,
                rotaRegiao: regiaoSelect.value ? {
                    id: regiaoSelect.value,
                    nome: regiaoSelect.options[regiaoSelect.selectedIndex].text.split(' (')[0]
                } : null,
                mestreDeFeira: mestreSelect.value ? {
                    id: mestreSelect.value,
                    nome: mestreSelect.options[mestreSelect.selectedIndex].text
                } : null,
                especialidades: feiraEspecialidades,
                mercadoresFixos: feiraMercadoresFixos,
                descricao: document.getElementById('feiraDescricao').value,
                imagem: document.getElementById('feiraImagem').value,
                tags: document.getElementById('feiraTags').value,
                lastUpdate: new Date().toISOString()
            };

            try {
                if (currentEditingFeira) {
                    await updateDoc(doc(db, 'worldbuilding-submundo-feiras', currentEditingFeira.id), feira);
                    const idx = submundoFeiras.findIndex(f => f.id === currentEditingFeira.id);
                    if (idx > -1) submundoFeiras[idx] = { ...feira, id: currentEditingFeira.id };
                    showAlert('Feira atualizada com sucesso!', 'success');
                } else {
                    const docRef = await addDoc(collection(db, 'worldbuilding-submundo-feiras'), feira);
                    submundoFeiras.push({ ...feira, id: docRef.id });
                    showAlert('Feira criada com sucesso!', 'success');
                }
                closeEntryModal();
                renderSubmundo();
            } catch (error) {
                console.error('Error saving feira:', error);
                showAlert('Erro ao salvar feira: ' + error.message, 'error');
            }
        };

        window.deleteFeira = async function () {
            if (!currentEditingFeira) return;

            if (!await confirmar(`Tem certeza que deseja excluir a feira "${currentEditingFeira.nome}"?`, { perigo: true })) return;

            try {
                await deleteDoc(doc(db, 'worldbuilding-submundo-feiras', currentEditingFeira.id));
                submundoFeiras = submundoFeiras.filter(f => f.id !== currentEditingFeira.id);
                showAlert('Feira excluída com sucesso!', 'success');
                closeEntryModal();
                renderSubmundo();
            } catch (error) {
                console.error('Error deleting feira:', error);
                showAlert('Erro ao excluir feira: ' + error.message, 'error');
            }
        };

        window.openFeiraDetails = function (feiraId) {
            openFeiraModal(feiraId);
        };

        let currentEditingRep = null;
        window.openReputacaoModal = function (charId) {
            const char = currentCampaign.personagens.find(p => p.id === charId);
            if (!char) return;

            currentEditingRep = submundoReputacoes.find(r => r.id === charId) || { id: charId, nivelAcesso: 0, marcas: [] };

            const modal = document.getElementById('entryModal');
            const title = document.getElementById('entryModalTitle');
            const body = document.getElementById('entryModalBody');
            const footer = document.querySelector('#entryModal .modal-footer');
            const deleteBtn = document.getElementById('btnDeleteEntry');

            title.innerHTML = `🌙 Reputação: ${char.nome}`;
            deleteBtn.style.display = 'none';

            body.innerHTML = `
                <div class="form-group">
                    <label class="form-label">Nível de Acesso (0-5)</label>
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <input type="range" id="repNivel" min="0" max="5" step="1" value="${currentEditingRep.nivelAcesso}" 
                               style="flex: 1; accent-color: var(--primary);" oninput="this.nextElementSibling.textContent = this.value">
                        <span style="font-size: 1.2rem; font-weight: 700; color: var(--primary); min-width: 20px; text-align: center;">${currentEditingRep.nivelAcesso}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--lr-text-2); margin-top: 5px;">
                        <span>0: Cego</span>
                        <span>1: Tocado</span>
                        <span>2: Iniciado</span>
                        <span>3: Conhecido</span>
                        <span>4: Influente</span>
                        <span>5: Lenda</span>
                    </div>
                </div>

                <div class="form-group" style="margin-top: 20px;">
                    <label class="form-label">Marcas do Submundo</label>
                    <div class="marcas-checklist" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <label class="checkbox-item" style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 8px; background: rgba(14, 17, 23, 0.4); border-radius: 8px;">
                            <input type="checkbox" name="repMarca" value="Quebrado" ${currentEditingRep.marcas?.includes('Quebrado') ? 'checked' : ''}>
                            <span>💔 Quebrado</span>
                        </label>
                        <label class="checkbox-item" style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 8px; background: rgba(14, 17, 23, 0.4); border-radius: 8px;">
                            <input type="checkbox" name="repMarca" value="Sem Palavra" ${currentEditingRep.marcas?.includes('Sem Palavra') ? 'checked' : ''}>
                            <span>🤐 Sem Palavra</span>
                        </label>
                        <label class="checkbox-item" style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 8px; background: rgba(14, 17, 23, 0.4); border-radius: 8px;">
                            <input type="checkbox" name="repMarca" value="Delator" ${currentEditingRep.marcas?.includes('Delator') ? 'checked' : ''}>
                            <span>🐀 Delator</span>
                        </label>
                        <label class="checkbox-item" style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 8px; background: rgba(14, 17, 23, 0.4); border-radius: 8px;">
                            <input type="checkbox" name="repMarca" value="Sombra de Confiança" ${currentEditingRep.marcas?.includes('Sombra de Confiança') ? 'checked' : ''}>
                            <span>👤 Sombra de Confiança</span>
                        </label>
                    </div>
                </div>

                <div class="form-group" style="margin-top: 20px;">
                    <label class="form-label">Notas Privadas (Repreensão, Dívidas...)</label>
                    <textarea id="repNotas" class="form-input" rows="3" placeholder="Ex: Deve 500 moedas para o Corretor de Carne...">${currentEditingRep.notas || ''}</textarea>
                </div>
            `;

            const saveBtn = footer.querySelector('.btn-success');
            saveBtn.onclick = saveReputacao;

            modal.classList.add('active');
        };

        window.saveReputacao = async function () {
            if (!currentEditingRep) return;

            const nivel = parseInt(document.getElementById('repNivel').value);
            const notas = document.getElementById('repNotas').value.trim();
            const marcas = Array.from(document.querySelectorAll('input[name="repMarca"]:checked')).map(cb => cb.value);

            const repData = {
                nivelAcesso: nivel,
                marcas: marcas,
                notas: notas,
                lastUpdate: new Date().toISOString()
            };

            try {
                await setDoc(doc(db, 'worldbuilding-submundo-reputacoes', currentEditingRep.id), repData, { merge: true });

                const idx = submundoReputacoes.findIndex(r => r.id === currentEditingRep.id);
                if (idx > -1) {
                    submundoReputacoes[idx] = { ...submundoReputacoes[idx], ...repData };
                } else {
                    submundoReputacoes.push({ ...repData, id: currentEditingRep.id });
                }

                showAlert('Reputação atualizada!', 'success');
                closeEntryModal();
                renderSubmundo();
            } catch (error) {
                console.error('Error saving reputation:', error);
                showAlert('Erro ao salvar reputação: ' + error.message, 'error');
            }
        };

        function renderEntryCard(entry, category, showHierarchy = false) {
            const config = categoryConfig[category];

            // Build child counts display for geography
            let childCountsHtml = '';
            let breadcrumbHtml = '';

            if (showHierarchy && category === 'geography') {
                const counts = countChildEntities(entry.id);
                const countsDisplay = [];
                if (counts.geographies > 0) countsDisplay.push(`<span class="child-count-item">📍 ${counts.geographies}</span>`);
                if (counts.npcs > 0) countsDisplay.push(`<span class="child-count-item">👥 ${counts.npcs}</span>`);
                if (counts.properties > 0) countsDisplay.push(`<span class="child-count-item">🏠 ${counts.properties}</span>`);

                if (countsDisplay.length > 0) {
                    childCountsHtml = `<div class="entry-children-count">${countsDisplay.join('')}</div>`;
                }

                // Show parent path if entry has a parent
                if (entry.pertenceA?.nome) {
                    const path = getGeographyBreadcrumbPath(entry.id);
                    // Don't show the current entry in the breadcrumb, only parents
                    const parentPath = path.split(' › ').slice(0, -1).join(' › ');
                    if (parentPath) {
                        breadcrumbHtml = `<div class="entry-breadcrumb" style="font-size: 0.7rem; color: var(--lr-text-2); margin-top: 4px;">${parentPath}</div>`;
                    }
                }
            }

            if (category === 'rumors') {
                return renderRumorCard(entry);
            }

            return `
                <div class="entry-card" onclick="openEntry('${category}', '${entry.id}')">
                    ${entry.imagem ? `<img src="${entry.imagem}" class="entry-image" onerror="this.style.display='none'">` : ''}
                    <span class="entry-type">${config.icon} ${entry.tipo || config.types[0]}</span>
                    <div class="entry-name">${entry.nome || entry.titulo || 'Sem nome'}</div>
                    ${breadcrumbHtml}
                    <div class="entry-desc">${entry.descricao || entry.historia || ''}</div>
                    ${childCountsHtml}
                </div>
            `;
        }

        function renderRumorCard(rumor) {
            const veracityIcons = {
                verdadeiro: '<span class="rumor-veracidade" title="Verdadeiro">🟢</span>',
                parcial: '<span class="rumor-veracidade" title="Parcialmente Verdadeiro">🟡</span>',
                falso: '<span class="rumor-veracidade" title="Falso">🔴</span>',
                desconhecido: '<span class="rumor-veracidade" title="Desconhecido">⚪</span>'
            };

            const statusLabels = {
                naoDescoberto: '<span class="rumor-status-badge status-naodescoberto">Não Descoberto</span>',
                ouvido: '<span class="rumor-status-badge status-ouvido">Ouvido</span>',
                investigado: '<span class="rumor-status-badge status-investigado">Investigado</span>',
                resolvido: '<span class="rumor-status-badge status-resolvido">Resolvido</span>'
            };

            const sourceHtml = rumor.fonte ? `
                <div class="rumor-source-link" onclick="event.stopPropagation(); navigateToEntity('${rumor.fonte.tipo}', '${rumor.fonte.id}')">
                    📍 Fonte: ${rumor.fonte.nome}
                </div>
            ` : '';

            const questHtml = rumor.questRelacionada ? `
                <div style="font-size: 0.75rem; color: var(--secondary); margin-top: 5px;">
                    📜 Quest: ${rumor.questRelacionada.nome}
                </div>
            ` : '';

            return `
                <div class="entry-card rumor-card ${rumor.status}" onclick="openEntry('rumors', '${rumor.id}')">
                    ${veracityIcons[rumor.veracidade || 'desconhecido']}
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                        <span class="entry-type">💬 ${rumor.tipo || 'Rumor'}</span>
                        ${statusLabels[rumor.status || 'naoDescoberto']}
                    </div>
                    <div class="entry-name">${rumor.nome}</div>
                    <div class="entry-desc">${rumor.descricao}</div>
                    
                    ${sourceHtml}
                    ${questHtml}

                    ${rumor.verdade ? `
                        <div class="rumor-truth-box">
                            <strong>👁️ A Verdade:</strong><br>
                            ${rumor.verdade}
                        </div>
                    ` : ''}
                    
                    ${rumor.recompensaInvestigar ? `
                        <div style="margin-top: 10px; font-size: 0.8rem; border-top: 1px solid var(--border); padding-top: 8px; color: var(--success);">
                            🎁 Recompensa: ${rumor.recompensaInvestigar}
                        </div>
                    ` : ''}
                </div>
            `;
        }

        window.navigateToEntity = function (cat, id) {
            currentCategory = cat;
            document.querySelectorAll('.nav-category').forEach(nc => nc.classList.remove('active'));
            const nav = document.querySelector(`[data-category="${cat}"]`);
            if (nav) nav.classList.add('active');

            if (cat === 'submundo') renderSubmundo();
            else renderCategoryList(cat);

            setTimeout(() => {
                openEntry(cat, id);
            }, 100);
        };

        let currentGeographyView = 'grid'; // 'grid' or 'tree'

        function renderCategoryList(category) {
            const config = categoryConfig[category];
            const entries = allData[category] || [];
            const body = document.getElementById('contentBody');

            // Special handling for geography - add view toggle
            const viewToggleHtml = category === 'geography' ? `
                <div class="view-toggle">
                    <button class="view-btn ${currentGeographyView === 'grid' ? 'active' : ''}" data-view="grid" onclick="setGeographyView('grid')">
                        📊 Grade
                    </button>
                    <button class="view-btn ${currentGeographyView === 'tree' ? 'active' : ''}" data-view="tree" onclick="setGeographyView('tree')">
                        🌳 Árvore
                    </button>
                </div>
            ` : '';

            if (category === 'geography' && currentGeographyView === 'tree') {
                // Render tree view
                body.innerHTML = `
                    ${viewToggleHtml}
                    <div class="geography-tree-container">
                        <div class="tree-controls">
                            <button onclick="expandAllTreeNodes()">➕ Expandir Tudo</button>
                            <button onclick="collapseAllTreeNodes()">➖ Recolher Tudo</button>
                        </div>
                        <div class="geography-tree" id="geographyTree">
                            ${renderGeographyTreeNodes(buildGeographyTree(entries), 0)}
                        </div>
                    </div>
                `;
            } else {
                // Calculate counts for quick filters
                const noImageCount = entries.filter(e => !e.imagem).length;
                const noDescCount = entries.filter(e => !e.descricao || e.descricao.length < 50).length;

                // Build location filter options (only for NPCs and properties)
                const showLocationFilter = ['npcs', 'properties'].includes(category);
                const locationOptions = showLocationFilter ?
                    (allData.geography || []).map(g =>
                        `<option value="${g.id}">${getGeographyIcon(g.tipo)} ${g.nome}</option>`
                    ).join('') : '';

                // Standard grid view with advanced filters
                body.innerHTML = `
                    ${viewToggleHtml}
                    <div class="advanced-filters">
                        <div class="filters-row">
                            <select class="filter-select" id="filterType" onchange="applyAdvancedFilters()">
                                <option value="">Todos os tipos</option>
                                ${config.types.map(t => `<option value="${t}">${t}</option>`).join('')}
                            </select>
                            <input type="text" class="filter-input" id="filterTags" 
                                   placeholder="🏷️ Filtrar por tags..." 
                                   oninput="applyAdvancedFilters()">
                            ${showLocationFilter ? `
                                <select class="filter-select" id="filterLocation" onchange="applyAdvancedFilters()">
                                    <option value="">📍 Todas as localizações</option>
                                    ${locationOptions}
                                </select>
                            ` : ''}
                        </div>
                        <div class="filters-row">
                            <div class="quick-filters">
                                <button class="quick-filter-btn" data-filter="recent" onclick="toggleQuickFilter('recent')">
                                    🕐 Recentes
                                </button>
                                <button class="quick-filter-btn" data-filter="noImage" onclick="toggleQuickFilter('noImage')">
                                    🖼️ Sem Imagem <span class="filter-count">${noImageCount}</span>
                                </button>
                                <button class="quick-filter-btn" data-filter="noDesc" onclick="toggleQuickFilter('noDesc')">
                                    📝 Sem Descrição <span class="filter-count">${noDescCount}</span>
                                </button>
                            </div>
                        </div>
                        <div id="activeFiltersSummary" style="display: none;"></div>
                    </div>
                    <div class="entries-grid" id="entriesGrid">
                        ${entries.length ? entries.map(e => renderEntryCard(e, category, category === 'geography')).join('') :
                        `<div class="no-entries"><div class="no-entries-icon">${config.icon}</div><p>Nenhuma entrada em ${config.title}. Clique em "Nova Entrada" para criar!</p></div>`}
                    </div>
                `;
            }
        }

        // Render tree nodes recursively
        function renderGeographyTreeNodes(nodes, level) {
            if (!nodes || nodes.length === 0) {
                return level === 0 ? '<p style="color: var(--lr-text-2); padding: 20px;">Nenhuma geografia cadastrada.</p>' : '';
            }

            return nodes.map(node => {
                const hasChildren = node.children?.length > 0;
                const counts = countChildEntities(node.id);
                const icon = getGeographyIcon(node.tipo);

                // Build counts display
                const countsDisplay = [];
                if (counts.geographies > 0) countsDisplay.push(`📍 ${counts.geographies}`);
                if (counts.npcs > 0) countsDisplay.push(`👥 ${counts.npcs}`);
                if (counts.properties > 0) countsDisplay.push(`🏠 ${counts.properties}`);

                return `
                    <div class="tree-node ${level === 0 ? 'root' : ''}" data-id="${node.id}" data-level="${level}">
                        <div class="tree-node-header" onclick="handleTreeNodeClick(event, '${node.id}', ${hasChildren})">
                            ${hasChildren ? `
                                <button class="tree-expand-btn" data-node="${node.id}" onclick="event.stopPropagation(); toggleTreeNode('${node.id}')">▶</button>
                            ` : '<span style="width: 24px;"></span>'}
                            <span class="tree-node-icon">${icon}</span>
                            <span class="tree-node-name">${node.nome}</span>
                            <span class="tree-node-type">${node.tipo}</span>
                            <span class="tree-children-count">${countsDisplay.join(' ')}</span>
                            <button class="tree-node-edit" onclick="event.stopPropagation(); openEntry('geography', '${node.id}')">✏️</button>
                        </div>
                        ${hasChildren ? `
                            <div class="tree-node-children" id="children-${node.id}" style="display: none;">
                                ${renderGeographyTreeNodes(node.children, level + 1)}
                            </div>
                        ` : ''}
                    </div>
                `;
            }).join('');
        }
        window.renderGeographyTreeNodes = renderGeographyTreeNodes;

        // Set geography view mode
        window.setGeographyView = function (view) {
            currentGeographyView = view;
            renderCategoryList('geography');
        };

        // Toggle tree node expand/collapse
        window.toggleTreeNode = function (nodeId) {
            const children = document.getElementById(`children-${nodeId}`);
            const btn = document.querySelector(`[data-node="${nodeId}"]`);

            if (children) {
                const isVisible = children.style.display !== 'none';
                children.style.display = isVisible ? 'none' : 'block';
                btn?.classList.toggle('expanded', !isVisible);
            }
        };

        // Handle tree node click (double click to expand, single click after delay to open)
        let treeNodeClickTimer = null;
        window.handleTreeNodeClick = function (event, nodeId, hasChildren) {
            if (treeNodeClickTimer) {
                // Double click - toggle children
                clearTimeout(treeNodeClickTimer);
                treeNodeClickTimer = null;
                if (hasChildren) {
                    toggleTreeNode(nodeId);
                }
            } else {
                // Single click - wait to see if it's a double click
                treeNodeClickTimer = setTimeout(() => {
                    treeNodeClickTimer = null;
                    openEntry('geography', nodeId);
                }, 250);
            }
        };

        // Expand all tree nodes
        window.expandAllTreeNodes = function () {
            document.querySelectorAll('.tree-node-children').forEach(el => {
                el.style.display = 'block';
            });
            document.querySelectorAll('.tree-expand-btn').forEach(btn => {
                btn.classList.add('expanded');
            });
        };

        // Collapse all tree nodes
        window.collapseAllTreeNodes = function () {
            document.querySelectorAll('.tree-node-children').forEach(el => {
                el.style.display = 'none';
            });
            document.querySelectorAll('.tree-expand-btn').forEach(btn => {
                btn.classList.remove('expanded');
            });
        };

        // Advanced Filter State
        let activeQuickFilter = null;

        // Apply all active filters
        window.applyAdvancedFilters = function () {
            let entries = allData[currentCategory] || [];
            const activeFilters = [];

            // Type filter
            const typeFilter = document.getElementById('filterType')?.value;
            if (typeFilter) {
                entries = entries.filter(e => (e.tipo || '').toLowerCase() === typeFilter.toLowerCase());
                activeFilters.push(`Tipo: ${typeFilter}`);
            }

            // Tag filter
            const tagFilter = document.getElementById('filterTags')?.value?.toLowerCase().trim();
            if (tagFilter) {
                entries = entries.filter(e =>
                    (e.tags || '').toLowerCase().includes(tagFilter) ||
                    (e.nome || '').toLowerCase().includes(tagFilter)
                );
                activeFilters.push(`Tags: "${tagFilter}"`);
            }

            // Location filter (for NPCs - check reverse references)
            const locationFilter = document.getElementById('filterLocation')?.value;
            if (locationFilter) {
                if (currentCategory === 'npcs') {
                    entries = entries.filter(e => {
                        const refs = reverseReferences.npcs?.[e.id];
                        return refs?.geography?.some(g => g.id === locationFilter) ||
                            refs?.properties?.some(p => {
                                const prop = allData.properties?.find(pr => pr.id === p.id);
                                return prop?.geographyId === locationFilter;
                            });
                    });
                } else if (currentCategory === 'properties') {
                    entries = entries.filter(e => e.geographyId === locationFilter);
                }
                const geo = allData.geography?.find(g => g.id === locationFilter);
                activeFilters.push(`Local: ${geo?.nome || locationFilter}`);
            }

            // Quick filters
            if (activeQuickFilter === 'recent') {
                entries = entries
                    .filter(e => e.lastUpdate)
                    .sort((a, b) => new Date(b.lastUpdate) - new Date(a.lastUpdate))
                    .slice(0, 20);
                activeFilters.push('🕐 20 mais recentes');
            } else if (activeQuickFilter === 'noImage') {
                entries = entries.filter(e => !e.imagem);
                activeFilters.push('🖼️ Sem imagem');
            } else if (activeQuickFilter === 'noDesc') {
                entries = entries.filter(e => !e.descricao || e.descricao.length < 50);
                activeFilters.push('📝 Sem descrição');
            }

            // Render results
            const grid = document.getElementById('entriesGrid');

            if (currentCategory === 'history') {
                renderHistoryTimeline(entries);
                return; // renderHistoryTimeline handles the grid innerHTML
            }

            grid.innerHTML = entries.length ?
                entries.map(e => renderEntryCard(e, currentCategory, currentCategory === 'geography')).join('') :
                '<div class="no-entries"><p>Nenhuma entrada encontrada com esses filtros.</p></div>';

            // Update filter summary
            const summary = document.getElementById('activeFiltersSummary');
            if (summary) {
                if (activeFilters.length > 0) {
                    summary.style.display = 'flex';
                    summary.className = 'active-filters-summary';
                    summary.innerHTML = `
                        <span>🔍 Filtros ativos: ${activeFilters.join(' • ')}</span>
                        <span style="margin-left: auto;">${entries.length} resultado${entries.length !== 1 ? 's' : ''}</span>
                        <button class="clear-filters-btn" onclick="clearAllFilters()">✕ Limpar</button>
                    `;
                } else {
                    summary.style.display = 'none';
                }
            }
        };

        // Toggle quick filter buttons
        window.toggleQuickFilter = function (filter) {
            const btn = document.querySelector(`[data-filter="${filter}"]`);
            const wasActive = btn?.classList.contains('active');

            // Remove active from all quick filter buttons
            document.querySelectorAll('.quick-filter-btn').forEach(b => b.classList.remove('active'));

            if (wasActive) {
                activeQuickFilter = null;
            } else {
                btn?.classList.add('active');
                activeQuickFilter = filter;
            }

            applyAdvancedFilters();
        };

        // Clear all filters
        window.clearAllFilters = function () {
            const typeSelect = document.getElementById('filterType');
            const tagsInput = document.getElementById('filterTags');
            const locationSelect = document.getElementById('filterLocation');

            if (typeSelect) typeSelect.value = '';
            if (tagsInput) tagsInput.value = '';
            if (locationSelect) locationSelect.value = '';

            activeQuickFilter = null;
            document.querySelectorAll('.quick-filter-btn').forEach(b => b.classList.remove('active'));

            applyAdvancedFilters();
        };

        // Legacy filterEntries for backward compatibility
        window.filterEntries = function () {
            applyAdvancedFilters();
        };

        // History Timeline Rendering
        function renderHistoryTimeline(entries) {
            const grid = document.getElementById('entriesGrid');
            if (!grid) return;

            if (!entries || entries.length === 0) {
                grid.innerHTML = '<div class="no-entries"><p>Nenhum evento histórico encontrado com esses filtros.</p></div>';
                return;
            }

            // Group by Era
            const eventsByEra = {};
            const ungroupedEvents = [];

            // Sort entries by ordemCronologica
            const sortedEntries = [...entries].sort((a, b) => (a.ordemCronologica || 0) - (b.ordemCronologica || 0));

            sortedEntries.forEach(entry => {
                if (entry.era && entry.tipo !== 'Era') {
                    if (!eventsByEra[entry.era]) eventsByEra[entry.era] = [];
                    eventsByEra[entry.era].push(entry);
                } else if (entry.tipo !== 'Era') {
                    ungroupedEvents.push(entry);
                }
            });

            // Get all eras (only those that actually have an 'Era' entry or are used)
            const eraEntries = (allData.history || []).filter(h => h.tipo === 'Era').sort((a, b) => (a.ordemCronologica || 0) - (b.ordemCronologica || 0));

            // Build groups
            let timelineHtml = '<div class="timeline-container">';

            // 1. Render Defined Eras (with their events)
            eraEntries.forEach(era => {
                const eraEvents = eventsByEra[era.nome] || [];

                timelineHtml += `
                    <div class="timeline-era-group" id="era-${era.id || era.nome.replace(/\s+/g, '-')}">
                        <div class="timeline-era-header" onclick="this.parentElement.classList.toggle('collapsed')">
                            <span class="era-icon">⏳</span>
                            <div class="era-info">
                                <h2 class="era-title">${era.nome}</h2>
                                <span class="era-dates">${era.dataInicio || ''} ${era.dataFim ? ' - ' + era.dataFim : ''}</span>
                            </div>
                            <span class="era-toggle-icon">▼</span>
                        </div>
                        <div class="timeline-items">
                            ${eraEvents.length > 0 ? eraEvents.map(event => renderTimelineEvent(event)).join('') : '<p style="color:var(--lr-text-2); padding:10px;">Nenhum evento nesta Era.</p>'}
                        </div>
                    </div>
                `;
            });

            // 2. Render Ungrouped/Unknown Era
            if (ungroupedEvents.length > 0) {
                timelineHtml += `
                    <div class="timeline-era-group">
                        <div class="timeline-era-header" onclick="this.parentElement.classList.toggle('collapsed')">
                            <span class="era-icon">❓</span>
                            <div class="era-info">
                                <h2 class="era-title">Eventos Diversos</h2>
                                <span class="era-dates">Sem Era definida</span>
                            </div>
                            <span class="era-toggle-icon">▼</span>
                        </div>
                        <div class="timeline-items">
                            ${ungroupedEvents.map(event => renderTimelineEvent(event)).join('')}
                        </div>
                    </div>
                `;
            }

            // 3. If no eras and no ungrouped, show all as simple list
            if (eraEntries.length === 0 && ungroupedEvents.length === 0) {
                timelineHtml += `
                    <div class="timeline-era-group">
                        <div class="timeline-era-header">
                            <span class="era-icon">📜</span>
                            <div class="era-info">
                                <h2 class="era-title">Todos os Eventos</h2>
                            </div>
                        </div>
                        <div class="timeline-items">
                            ${sortedEntries.map(event => renderTimelineEvent(event)).join('')}
                        </div>
                    </div>
                `;
            }

            timelineHtml += '</div>';
            grid.innerHTML = timelineHtml;
        }
        window.renderHistoryTimeline = renderHistoryTimeline;

        function renderTimelineEvent(event) {
            const importance = event.importancia || 'moderada';
            const icon = getHistoryIcon(event.tipo);
            const regions = event.regiaoEnvolvida ? `
                <div class="event-location" onclick="event.stopPropagation(); navigateToEntity('geography', '${event.regiaoEnvolvida.id}')">
                    📍 ${event.regiaoEnvolvida.nome}
                </div>
            ` : '';

            const factions = (event.faccoesEnvolvidas || []).map(f => `
                <span class="event-faction-tag" onclick="event.stopPropagation(); navigateToEntity('factions', '${f.id}')">${f.name || f.nome}</span>
            `).join('');

            return `
                <div class="timeline-item importance-${importance}" onclick="openEntry('history', '${event.id}')">
                    <div class="event-marker"></div>
                    <div class="event-card">
                        ${event.imagem && importance !== 'menor' ? `
                            <div class="event-image-container">
                                <img src="${event.imagem}" class="event-image" alt="${event.nome}">
                            </div>
                        ` : ''}
                        <div class="event-header">
                            <span class="event-icon">${icon}</span>
                            <div class="event-meta">
                                <span class="event-date">${event.dataInicio || 'Data desconhecida'}</span>
                                <h3 class="event-title">${event.nome}</h3>
                            </div>
                        </div>
                        ${event.descricao ? `<p class="event-desc">${event.descricao.substring(0, 150)}${event.descricao.length > 150 ? '...' : ''}</p>` : ''}
                        ${regions || (event.faccoesEnvolvidas && event.faccoesEnvolvidas.length) ? `
                            <div class="event-links">
                                ${regions}
                                <div class="event-factions">${factions}</div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }

        function getHistoryIcon(type) {
            const icons = {
                'Guerra': '⚔️',
                'Fundação': '🏰',
                'Catástrofe': '💀',
                'Descoberta': '✨',
                'Político': '👑',
                'Desastre Natural': '🌋',
                'Tratado': '📜',
                'Era': '⏳',
                'Período': '⌛',
                'Evento': '📅'
            };
            return icons[type] || '📜';
        }
        // Expose helper functions to global scope
        window.renderTimelineEvent = renderTimelineEvent;
        window.getHistoryIcon = getHistoryIcon;


        // Modal & CRUD
        document.getElementById('btnNewEntry').addEventListener('click', () => openEntryModal());

        // Ficha completa da Tribo tal como cadastrada no Painel do Criador.
        // Mostrada apenas para leitura (a edição mecânica/cultural vive no Criador).
        function renderCriadorTriboSection(entry) {
            const t = entry?._criador;
            const esc = (s) => (s == null ? '' : String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])));
            const linkBtn = `<button type="button" class="btn btn-secondary" style="margin-top:10px" onclick="window.open('../painel-criador/painel-criador.html#tribes${t?.id ? '/' + t.id : ''}', '_blank')">🛠️ ${t ? 'Editar no Painel do Criador' : 'Cadastrar no Painel do Criador'}</button>`;
            if (!t) {
                return `
                <div class="form-section">
                    <h3 class="form-section-title">⚙️ Dados do Painel do Criador</h3>
                    <p style="color: var(--lr-text-2); font-size: 0.9rem;">Esta tribo ainda não tem ficha no Painel do Criador. Lá você cadastra cultura, governo, economia, estrutura militar, unidades, peculiaridades e mais — e esses dados aparecem aqui automaticamente.</p>
                    ${linkBtn}
                </div>`;
            }
            const linha = (label, val) => val ? `<div class="form-group" style="grid-column:1/-1"><label class="form-label">${label}</label><div class="wb-readonly-field">${esc(val)}</div></div>` : '';
            const pericias = Array.isArray(t.pericias) && t.pericias.length
                ? `<div class="form-group" style="grid-column:1/-1"><label class="form-label">🎯 Perícias Tribais</label><div class="wb-readonly-field">${t.pericias.map(p => `• ${esc(p.nome)}${p.nivel ? ` (nível ${esc(p.nivel)})` : ''}${p.opcao ? ` — ${esc(p.opcao)}` : ''}`).join('<br>')}</div></div>`
                : '';
            const unidades = Array.isArray(t.unidadesMilitares) && t.unidadesMilitares.length
                ? `<div class="form-group" style="grid-column:1/-1"><label class="form-label">⚔️ Unidades Militares</label><div class="wb-readonly-field">${t.unidadesMilitares.map(u => `<b>${esc(u.nome)}</b>${u.funcao ? ` (${esc(u.funcao)})` : ''}${u.descricao ? `<br>${esc(u.descricao)}` : ''}`).join('<br><br>')}</div></div>`
                : '';
            return `
            <div class="form-section">
                <h3 class="form-section-title">⚙️ Ficha do Painel do Criador <span style="font-size:0.75rem;opacity:0.7;font-weight:400">(mesma tribo — somente leitura)</span></h3>
                <div class="form-grid">
                    ${linha('📜 Lema / Citação', t.lema)}
                    ${linha('🎭 Cultura e Costumes', t.cultura)}
                    ${linha('🏛️ Governo', t.governo)}
                    ${linha('💰 Economia', t.economia)}
                    ${linha('🛡️ Estrutura Militar', t.militar)}
                    ${pericias}
                    ${unidades}
                </div>
                ${linkBtn}
            </div>`;
        }

        // Ficha completa do NPC — os mesmos dados do Painel do Mestre > NPCs
        // (é a mesma coleção `npcs`). Exibida para leitura; a edição mecânica
        // completa (atributos, valores derivados, peculiaridades…) vive lá.
        function renderNpcFichaSection(entry) {
            const NPC_ATTRS = ['INT', 'RAC', 'PRS', 'FOR', 'DES', 'VIG', 'PRE', 'MAN', 'AUT'];
            const esc = (s) => (s == null ? '' : String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])));
            const abrir = `<button type="button" class="btn btn-secondary" style="margin-top:10px" onclick="window.open('../painel-mestre/painel-mestre.html#npcs${entry?.id ? '/' + entry.id : ''}', '_blank')">🛠️ ${entry?.id ? 'Abrir ficha completa no Painel do Mestre' : 'Criar ficha no Painel do Mestre'}</button>`;
            if (!entry) {
                return `
                <div class="form-section">
                    <h3 class="form-section-title">📋 Ficha completa do NPC</h3>
                    <p style="color: var(--lr-text-2); font-size: 0.9rem;">Salve o NPC e reabra para ver a ficha completa (atributos, valores derivados, roleplay, ataques…), ou crie a ficha detalhada no Painel do Mestre.</p>
                    ${abrir}
                </div>`;
            }
            const rp = entry.rolePlay || {};
            const personalidade = Array.isArray(rp.personalidade) ? rp.personalidade.filter(Boolean).join(' · ') : (rp.personalidade || '');
            const rel = rp.relacoes || {};
            const loot = entry.loot || {};
            const cri = entry.criatura || null;

            const chip = (label, val) => val ? `<span class="wb-chip"><b>${label}:</b> ${esc(val)}</span>` : '';
            const bloco = (label, val) => val ? `<div class="form-group" style="grid-column:1/-1"><label class="form-label">${label}</label><div class="wb-readonly-field">${esc(val)}</div></div>` : '';

            const attrs = entry.atributos || {};
            const temAttrs = NPC_ATTRS.some(a => attrs[a]);
            const attrsHtml = temAttrs ? `
                <div class="form-group" style="grid-column:1/-1">
                    <label class="form-label">🎲 Atributos</label>
                    <div class="wb-attr-grid">
                        ${NPC_ATTRS.map(a => `<div class="wb-attr"><span class="wb-attr__k">${a}</span><span class="wb-attr__v">${esc(attrs[a] ?? 0)}</span></div>`).join('')}
                    </div>
                </div>` : '';

            const vd = entry.valoresDer || {};
            const vitais = vd.atual && typeof vd.atual === 'object'
                ? Object.entries(vd.atual).filter(([, v]) => v !== '' && v != null) : [];
            const extras = Array.isArray(vd.extras) ? vd.extras.filter(x => x && (x.nome || x.valor)) : [];
            const vdHtml = (vitais.length || extras.length) ? `
                <div class="form-group" style="grid-column:1/-1">
                    <label class="form-label">❤️ Valores Derivados</label>
                    <div class="wb-chips-row">
                        ${vitais.map(([k, v]) => `<span class="wb-chip"><b>${esc(k)}:</b> ${esc(v)}</span>`).join('')}
                        ${extras.map(x => `<span class="wb-chip"><b>${esc(x.nome)}:</b> ${esc(x.valor)}</span>`).join('')}
                    </div>
                </div>` : '';

            const criHtml = cri ? `
                <div class="form-group" style="grid-column:1/-1">
                    <label class="form-label">🐾 Criatura</label>
                    <div class="wb-chips-row">
                        ${chip('Habitat', cri.habitat)}${chip('Comportamento', cri.comportamento)}${chip('Dieta', cri.dieta)}${chip('Nível de Ameaça', cri.nivelAmeaca)}
                    </div>
                </div>` : '';

            return `
            <div class="form-section">
                <h3 class="form-section-title">📋 Ficha completa do NPC <span style="font-size:0.75rem;opacity:0.7;font-weight:400">(Painel do Mestre — somente leitura)</span></h3>
                <div class="form-grid">
                    <div class="form-group" style="grid-column:1/-1">
                        <div class="wb-chips-row">
                            ${chip('Nível', entry.nivel)}${chip('Porte', entry.porte)}${chip('Papel', entry.papel)}${chip('Local', entry.local)}${chip('Tamanho', entry.tamanho)}
                            ${chip('Raça', entry.raca)}${chip('Classe', entry.classe)}${chip('Tribo', entry.tribo)}
                        </div>
                    </div>
                    ${attrsHtml}
                    ${vdHtml}
                    ${bloco('⚔️ Ataques', entry.ataques)}
                    ${bloco('📚 Perícias', entry.skills)}
                    ${bloco('🎭 Personalidade', personalidade)}
                    ${bloco('Trejeitos', rp.trejeitos)}
                    ${bloco('Motivação', rp.motivacao)}
                    ${bloco('Segredos', rp.segredos)}
                    ${(rel.aliado || rel.rival || rel.devedor) ? `<div class="form-group" style="grid-column:1/-1"><label class="form-label">🤝 Relações</label><div class="wb-chips-row">${chip('Aliado', rel.aliado)}${chip('Rival', rel.rival)}${chip('Devedor', rel.devedor)}</div></div>` : ''}
                    ${bloco('💬 Frases', rp.frases)}
                    ${bloco('📖 História', rp.historia)}
                    ${(loot.itens || loot.luns || loot.pistas || loot.complicacoes) ? `<div class="form-group" style="grid-column:1/-1"><label class="form-label">💰 Espólio</label><div class="wb-chips-row">${chip('Itens', loot.itens)}${chip('Luns', loot.luns)}${chip('Pistas', loot.pistas)}${chip('Complicações', loot.complicacoes)}</div></div>` : ''}
                    ${criHtml}
                </div>
                ${abrir}
            </div>`;
        }

        function openEntryModal(entry = null) {
            currentEditingEntry = entry;
            const modal = document.getElementById('entryModal');
            const title = document.getElementById('entryModalTitle');
            const body = document.getElementById('entryModalBody');
            const deleteBtn = document.getElementById('btnDeleteEntry');

            const cat = currentCategory === 'dashboard' ? 'geography' : currentCategory;
            const config = categoryConfig[cat];

            // Tribo cuja fonte de verdade é o Painel do Criador: descrição e imagem
            // são exibidas a partir de lá (somente leitura aqui).
            const criadorLocked = cat === 'factions' && !!entry?._criador;

            title.textContent = entry ? `Editar ${config.title}` : `Nova Entrada - ${config.title}`;
            deleteBtn.style.display = entry ? 'block' : 'none';
            // Não há o que excluir no WB para tribos que só existem no Criador.
            if (cat === 'factions' && entry?._criadorOnly) deleteBtn.style.display = 'none';

            // Initialize linked entities from entry
            linkedNpcs = entry?.linkedNpcs || [];
            linkedTribos = entry?.linkedTribos || [];
            linkedCulturas = entry?.linkedCulturas || [];
            linkedNpcsProperty = entry?.linkedNpcsProperty || [];
            linkedFactionsHistory = entry?.faccoesEnvolvidas || [];
            linkedItems = entry?.linkedItems || [];

            let extraFields = '';
            let geographySections = '';
            let factionsSections = '';

            if (cat === 'geography') {
                // Get available NPCs from data
                const availableNpcs = allData.npcs || [];
                // Get tribes from factions (type === 'Tribo')
                const availableTribos = (allData.factions || []).filter(f => f.tipo === 'Tribo');

                // Get available parent geographies (only types that can be parents)
                const currentEntryId = entry?.id;
                const currentType = entry?.tipo || config.types[0];

                // Define which types can be parents for each type
                const parentTypesMap = {
                    'Continente': [], // Continents have no parents
                    'Região': ['Continente'],
                    'Cidade': ['Continente', 'Região'],
                    'Vila': ['Continente', 'Região', 'Cidade'],
                    'Ponto de Interesse': ['Continente', 'Região', 'Cidade', 'Vila']
                };

                const allowedParentTypes = parentTypesMap[currentType] || [];
                const availableParents = (allData.geography || [])
                    .filter(g => g.id !== currentEntryId && allowedParentTypes.includes(g.tipo))
                    .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

                // Build parent selector HTML
                const currentParent = entry?.pertenceA;
                const parentSelectorHtml = allowedParentTypes.length > 0 ? `
                    <div class="form-section" id="parentSelectorSection">
                        <h3 class="form-section-title">🗺️ Hierarquia Geográfica</h3>
                        <div class="form-group">
                            <label class="form-label">Pertence a (Local pai)</label>
                            <select class="form-select" id="entryPertenceA" onchange="updateParentPreview()">
                                <option value="">Nenhum (Local raiz)</option>
                                ${availableParents.map(p => `<option value="${p.id}" 
                                    data-nome="${p.nome}" 
                                    data-tipo="${p.tipo}"
                                    ${currentParent?.id === p.id ? 'selected' : ''}>
                                    ${getGeographyIcon(p.tipo)} ${p.nome} (${p.tipo})
                                </option>`).join('')}
                            </select>
                            <div id="parentPreviewContainer" style="margin-top: 10px; display: ${currentParent ? 'block' : 'none'};">
                                <div class="parent-selector-current">
                                    <span class="parent-selector-current-path" id="parentBreadcrumb">
                                        ${currentParent ? getGeographyBreadcrumbPath(currentParent.id) : ''}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                ` : '';

                extraFields = `
                    <div class="form-group"><label class="form-label">Clima</label><input type="text" class="form-input" id="entryClima" value="${entry?.clima || ''}" placeholder="Ex: Tropical, Árido, Temperado..."></div>
                    <div class="form-group"><label class="form-label">População</label><input type="text" class="form-input" id="entryPopulacao" value="${entry?.populacao || ''}" placeholder="Ex: ~5.000 habitantes"></div>
                    <div class="form-group"><label class="form-label">Recursos</label><input type="text" class="form-input" id="entryRecursos" value="${entry?.recursos || ''}" placeholder="Ex: Minérios, Agricultura..."></div>
                    <div class="form-group"><label class="form-label">Governo</label><input type="text" class="form-input" id="entryGoverno" value="${entry?.governo || ''}" placeholder="Ex: Monarquia, Conselho de Anciões..."></div>
                    <div class="form-group" style="grid-column: 1/-1;"><label class="form-label">Pontos de Referência</label><textarea class="form-textarea" id="entryLandmarks" rows="2" placeholder="Locais notáveis, construções famosas...">${entry?.landmarks || ''}</textarea></div>
                    <div class="form-group" style="grid-column: 1/-1;"><label class="form-label">Perigos</label><textarea class="form-textarea" id="entryPerigos" rows="2" placeholder="Ameaças conhecidas, áreas perigosas...">${entry?.perigos || ''}</textarea></div>
                    <div class="form-group" style="grid-column: 1/-1;"><label class="form-label">História do Local</label><textarea class="form-textarea" id="entryHistoriaLocal" rows="3" placeholder="Eventos passados relevantes...">${entry?.historiaLocal || ''}</textarea></div>
                `;

                // Prepend parent selector to geography sections
                geographySections = parentSelectorHtml;

                // 🗺️ Mapa Tático — editor próprio (wb-mapa-local.js). Só para
                // Locais já salvos: o editor grava direto no doc do Local.
                const mtStatus = entry?.mapaTatico?.url
                    ? `<b>✅ Mapa configurado</b> — ${(entry.mapaTatico.objetos || []).length} elemento(s), ${entry.mapaTatico.larguraReal || '?'} ${entry.mapaTatico.unidade || 'm'} de largura`
                    : 'Nenhum mapa tático ainda.';
                geographySections += `
                <div class="form-section">
                    <h3 class="form-section-title">🗺️ Mapa Tático (Tabuleiro)</h3>
                    <div class="wbml-secao-status">${mtStatus}</div>
                    ${entry?.id
                        ? `<button type="button" class="btn btn-secondary" onclick="abrirMapaLocal('${entry.id}')">🗺️ Abrir editor de mapa</button>
                           <p class="wbml-secao-status" style="margin-top:.5rem">Suba o mapa do Local, defina a escala e desenhe paredes, portas, janelas e luzes. No Tabuleiro, o Local entra pronto com um clique.</p>`
                        : `<p class="wbml-secao-status">💾 Salve o Local primeiro — o editor de mapa grava direto na ficha dele.</p>`}
                </div>`;

                // NPC/Creature linking section (for all geography types)
                geographySections += `
                <div class="form-section">
                    <h3 class="form-section-title">👥 NPCs/Criaturas neste Local</h3>
                    <div class="linked-entities-list" id="linkedNpcsList"></div>
                    <div class="add-linked-entity">
                        <select class="form-select" id="selectNpcToLink">
                            <option value="">Selecionar NPC/Criatura...</option>
                            ${availableNpcs.map(n => `<option value="${n.id}" data-name="${n.nome}" data-type="${n.tipo || 'NPC'}">${n.nome} (${n.tipo || 'NPC'})</option>`).join('')}
                        </select>
                        <button type="button" onclick="addLinkedNpc()">+ Adicionar</button>
                    </div>
                </div>
                `;

                // Tribe linking section (only for Vila, Cidade, Região)
                const entryTipo = entry?.tipo || config.types[0];
                if (['Vila', 'Cidade', 'Região'].includes(entryTipo)) {
                    geographySections += `
                    <div class="form-section" id="tribosSectionContainer">
                        <h3 class="form-section-title">🏕️ Tribos Presentes</h3>
                        <div class="linked-entities-list" id="linkedTribosList"></div>
                        <div class="add-linked-entity">
                            <select class="form-select" id="selectTriboToLink">
                                <option value="">Selecionar Tribo...</option>
                                ${availableTribos.map(t => `<option value="${t.id}" data-name="${t.nome}">${t.nome}</option>`).join('')}
                            </select>
                            <button type="button" onclick="addLinkedTribo()">+ Adicionar</button>
                        </div>
                    </div>
                    `;
                }
            } else if (cat === 'factions') {
                // Get available cultures from data
                const availableCulturas = allData.cultures || [];

                extraFields = `
                    <div class="form-group"><label class="form-label">Liderança</label><input type="text" class="form-input" id="entryLideranca" value="${entry?.lideranca || ''}" placeholder="Ex: Chefe Guerreiro, Conselho de Anciões..."></div>
                    <div class="form-group"><label class="form-label">Ideologia</label><input type="text" class="form-input" id="entryIdeologia" value="${entry?.ideologia || ''}" placeholder="Ex: Honra em batalha, Proteção da natureza..."></div>
                    <div class="form-group"><label class="form-label">Territórios</label><input type="text" class="form-input" id="entryTerritorios" value="${entry?.territorios || ''}" placeholder="Ex: Montanhas do Norte, Floresta Sombria..."></div>
                    <div class="form-group"><label class="form-label">Aliados</label><input type="text" class="form-input" id="entryAliados" value="${entry?.aliados || ''}" placeholder="Ex: Tribo das Águias, Reino de Eldor..."></div>
                    <div class="form-group"><label class="form-label">Inimigos</label><input type="text" class="form-input" id="entryInimigos" value="${entry?.inimigos || ''}" placeholder="Ex: Tribo dos Lobos, Império Sombrio..."></div>
                `;

                // Culture linking section for factions
                factionsSections = `
                <div class="form-section">
                    <h3 class="form-section-title">🎭 Culturas da Tribo</h3>
                    <div class="linked-entities-list" id="linkedCulturasList"></div>
                    <div class="add-linked-entity">
                        <select class="form-select" id="selectCulturaToLink">
                            <option value="">Selecionar Cultura...</option>
                            ${availableCulturas.map(c => `<option value="${c.id}" data-name="${c.nome}" data-type="${c.tipo || 'Cultura'}">${c.nome} (${c.tipo || 'Cultura'})</option>`).join('')}
                        </select>
                        <button type="button" onclick="addLinkedCultura()">+ Adicionar</button>
                    </div>
                </div>
                ${renderCriadorTriboSection(entry)}
                `;
            } else if (cat === 'history') {
                const eras = (allData.history || []).filter(h => h.tipo === 'Era').sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
                const availableLocations = allData.geography || [];
                const availableFactions = allData.factions || [];

                extraFields = `
                    <div class="form-group">
                        <label class="form-label">⏳ Era Principal</label>
                        <select class="form-select" id="historyEra">
                            <option value="">Sem vínculo com Era</option>
                            ${eras.map(e => `<option value="${e.nome}" ${entry?.era === e.nome ? 'selected' : ''}>⏳ ${e.nome}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">🌟 Importância</label>
                        <select class="form-select" id="historyImportancia">
                            <option value="menor" ${entry?.importancia === 'menor' ? 'selected' : ''}>⚪ Menor</option>
                            <option value="moderada" ${(entry?.importancia || 'moderada') === 'moderada' ? 'selected' : ''}>🟡 Moderada</option>
                            <option value="grande" ${entry?.importancia === 'grande' ? 'selected' : ''}>🟠 Grande</option>
                            <option value="epica" ${entry?.importancia === 'epica' ? 'selected' : ''}>🔥 Épica</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">🔢 Ordem Cronológica (Absoluta)</label>
                        <input type="number" class="form-input" id="historyOrdem" value="${entry?.ordemCronologica || 0}" placeholder="Ex: 1000">
                    </div>
                    <div class="form-group">
                        <label class="form-label">📅 Data Início</label>
                        <input type="text" class="form-input" id="entryDataInicio" value="${entry?.dataInicio || ''}" placeholder="Ex: Ano 150 ED">
                    </div>
                    <div class="form-group">
                        <label class="form-label">📅 Data Fim (Opcional)</label>
                        <input type="text" class="form-input" id="entryDataFim" value="${entry?.dataFim || ''}" placeholder="Ex: Ano 200 ED">
                    </div>
                    <div class="form-group">
                        <label class="form-label">📍 Região Envolvida</label>
                        <select class="form-select" id="historyRegion">
                            <option value="">Nenhuma região vinculada</option>
                            ${availableLocations.map(l => `<option value="${l.id}|${l.nome}" ${entry?.regiaoEnvolvida?.id === l.id ? 'selected' : ''}>${getGeographyIcon(l.tipo)} ${l.nome}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group" style="grid-column: 1/-1;">
                        <label class="form-label">👥 Participantes / Figuras Chave</label>
                        <input type="text" class="form-input" id="entryParticipantes" value="${entry?.participantes || ''}" placeholder="Reis, generais, heróis...">
                    </div>
                    <div class="form-group" style="grid-column: 1/-1;">
                        <label class="form-label">💥 Consequências / O que mudou</label>
                        <textarea class="form-textarea" id="entryConsequencias" rows="3" placeholder="O fim da guerra trouxe 100 anos de paz...">${entry?.consequencias || ''}</textarea>
                    </div>
                `;

                factionsSections = `
                <div class="form-section">
                    <h3 class="form-section-title">⚔️ Tribos &amp; Civilizações Envolvidas</h3>
                    <div class="linked-entities-list" id="linkedFactionsHistoryList"></div>
                    <div class="add-linked-entity">
                        <select class="form-select" id="selectFactionToLinkHistory">
                            <option value="">Selecionar Tribo/Civilização...</option>
                            ${availableFactions.map(f => `<option value="${f.id}" data-name="${f.nome}">${f.nome}</option>`).join('')}
                        </select>
                        <button type="button" onclick="addLinkedFactionHistory()">+ Adicionar</button>
                    </div>
                </div>
                `;
            } else if (cat === 'cultures') {
                extraFields = `
                    <div class="form-group"><label class="form-label">Costumes</label><textarea class="form-textarea" id="entryCostumes">${entry?.costumes || ''}</textarea></div>
                    <div class="form-group"><label class="form-label">Tradições</label><textarea class="form-textarea" id="entryTradicoes">${entry?.tradicoes || ''}</textarea></div>
                    <div class="form-group"><label class="form-label">Estrutura Social</label><input type="text" class="form-input" id="entryEstruturaSocial" value="${entry?.estruturaSocial || ''}"></div>
                    <div class="form-group"><label class="form-label">Idiomas</label><input type="text" class="form-input" id="entryIdiomas" value="${entry?.idiomas || ''}"></div>
                `;
            } else if (cat === 'magic') {
                extraFields = `
                    <div class="form-group"><label class="form-label">Regras</label><textarea class="form-textarea" id="entryRegras">${entry?.regras || ''}</textarea></div>
                    <div class="form-group"><label class="form-label">Limitações</label><textarea class="form-textarea" id="entryLimitacoes">${entry?.limitacoes || ''}</textarea></div>
                `;
            } else if (cat === 'rumors') {
                const availableNpcs = allData.npcs || [];
                const availableLocations = allData.geography || [];
                const availableQuests = (allSessions.flatMap(s => s.quests || [])).filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);

                extraFields = `
                    <div class="form-group">
                        <label class="form-label">📊 Status do Rumor</label>
                        <select class="form-select" id="rumorStatus">
                            <option value="naoDescoberto" ${(entry?.status || 'naoDescoberto') === 'naoDescoberto' ? 'selected' : ''}>🤫 Não Descoberto</option>
                            <option value="ouvido" ${(entry?.status === 'ouvido') ? 'selected' : ''}>👂 Ouvido</option>
                            <option value="investigado" ${(entry?.status === 'investigado') ? 'selected' : ''}>🔍 Investigado</option>
                            <option value="resolvido" ${(entry?.status === 'resolvido') ? 'selected' : ''}>✅ Resolvido</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">⚖️ Veracidade (Mestre)</label>
                        <select class="form-select" id="rumorVeracidade">
                            <option value="desconhecido" ${(entry?.veracidade || 'desconhecido') === 'desconhecido' ? 'selected' : ''}>⚪ Desconhecido</option>
                            <option value="verdadeiro" ${(entry?.veracidade === 'verdadeiro') ? 'selected' : ''}>🟢 Verdadeiro</option>
                            <option value="parcial" ${(entry?.veracidade === 'parcial') ? 'selected' : ''}>🟡 Parcial</option>
                            <option value="falso" ${(entry?.veracidade === 'falso') ? 'selected' : ''}>🔴 Falso</option>
                        </select>
                    </div>
                    <div class="form-group" style="grid-column: 1/-1;">
                        <label class="form-label">💎 Recompensa por Investigar</label>
                        <input type="text" class="form-input" id="rumorRecompensa" value="${entry?.recompensaInvestigar || ''}" placeholder="XP, Itens, Reputação, Informações...">
                    </div>
                    <div class="form-group" style="grid-column: 1/-1;">
                        <label class="form-label">📍 Fonte / Origem</label>
                        <select class="form-select" id="rumorFonte">
                            <option value="">Nenhuma fonte vinculada</option>
                            <optgroup label="NPCs">
                                ${availableNpcs.map(n => `<option value="npc|${n.id}|${n.nome}" ${entry?.fonte?.id === n.id ? 'selected' : ''}>👤 ${n.nome}</option>`).join('')}
                            </optgroup>
                            <optgroup label="Locais">
                                ${availableLocations.map(l => `<option value="geography|${l.id}|${l.nome}" ${entry?.fonte?.id === l.id ? 'selected' : ''}>${getGeographyIcon(l.tipo)} ${l.nome}</option>`).join('')}
                            </optgroup>
                        </select>
                    </div>
                    <div class="form-group" style="grid-column: 1/-1;">
                        <label class="form-label">📜 Quest Relacionada</label>
                        <select class="form-select" id="rumorQuest">
                            <option value="">Nenhuma quest vinculada</option>
                            ${availableQuests.map(q => `<option value="${q.id}|${q.nome}" ${entry?.questRelacionada?.id === q.id ? 'selected' : ''}>⚔️ ${q.nome}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group" style="grid-column: 1/-1;">
                        <label class="form-label">👁️ A Verdade (Mestre)</label>
                        <textarea class="form-textarea" id="rumorVerdade" rows="4" placeholder="O que realmente está acontecendo...">${entry?.verdade || ''}</textarea>
                    </div>
                `;
            } else if (cat === 'religion') {
                extraFields = `
                    <div class="form-group"><label class="form-label">Domínios</label><input type="text" class="form-input" id="entryDominios" value="${entry?.dominios || ''}"></div>
                    <div class="form-group"><label class="form-label">Símbolos</label><input type="text" class="form-input" id="entrySimbolos" value="${entry?.simbolos || ''}"></div>
                    <div class="form-group"><label class="form-label">Rituais</label><textarea class="form-textarea" id="entryRituais">${entry?.rituais || ''}</textarea></div>
                `;
            } else if (cat === 'properties') {
                // Get available NPCs from data
                const availableNpcs = allData.npcs || [];

                extraFields = `
                    <div class="form-group"><label class="form-label">Título da Propriedade</label><input type="text" class="form-input" id="entryTitulo" value="${entry?.titulo || ''}" placeholder="Ex: Taverna do Dragão Bêbado, Castelo das Sombras..."></div>
                    <div class="form-group"><label class="form-label">Localização</label><input type="text" class="form-input" id="entryLocalizacao" value="${entry?.localizacao || ''}" placeholder="Ex: Centro da cidade, Floresta Negra..."></div>
                    <div class="form-group"><label class="form-label">Proprietário</label><input type="text" class="form-input" id="entryProprietario" value="${entry?.proprietario || ''}" placeholder="Ex: Lorde Aldric, Família Stoneheart..."></div>
                    <div class="form-group"><label class="form-label">Valor Estimado</label><input type="text" class="form-input" id="entryValor" value="${entry?.valor || ''}" placeholder="Ex: 5.000 moedas de ouro..."></div>
                    <div class="form-group">
                        <label class="form-label">Estado de Conservação</label>
                        <select class="form-select" id="entryEstado">
                            <option value="Conservada" ${(entry?.estado || '') === 'Conservada' ? 'selected' : ''}>Conservada</option>
                            <option value="Deteriorada" ${(entry?.estado || '') === 'Deteriorada' ? 'selected' : ''}>Deteriorada</option>
                            <option value="Abandonada" ${(entry?.estado || '') === 'Abandonada' ? 'selected' : ''}>Abandonada</option>
                            <option value="Em Ruínas" ${(entry?.estado || '') === 'Em Ruínas' ? 'selected' : ''}>Em Ruínas</option>
                        </select>
                    </div>
                    <div class="form-group"><label class="form-label">Tamanho</label><input type="text" class="form-input" id="entryTamanho" value="${entry?.tamanho || ''}" placeholder="Ex: Grande, 200m², 3 andares..."></div>
                    <div class="form-group" style="grid-column: 1/-1;"><label class="form-label">Cômodos/Áreas</label><textarea class="form-textarea" id="entryComodos" rows="3" placeholder="Descrição dos ambientes internos...">${entry?.comodos || ''}</textarea></div>
                    <div class="form-group" style="grid-column: 1/-1;"><label class="form-label">Segredos</label><textarea class="form-textarea" id="entrySegredos" rows="3" placeholder="Passagens secretas, tesouros escondidos...">${entry?.segredos || ''}</textarea></div>
                `;

                // NPC linking section for properties
                geographySections = `
                <div class="form-section">
                    <h3 class="form-section-title">👥 NPCs nesta Propriedade</h3>
                    <div class="linked-entities-list" id="linkedNpcsPropertyList"></div>
                    <div class="add-linked-entity">
                        <select class="form-select" id="selectNpcToLinkProperty">
                            <option value="">Selecionar NPC...</option>
                            ${availableNpcs.map(n => `<option value="${n.id}" data-name="${n.nome}" data-type="${n.tipo || 'NPC'}">${n.nome} (${n.tipo || 'NPC'})</option>`).join('')}
                        </select>
                        <button type="button" onclick="addLinkedNpcProperty()">+ Adicionar</button>
                    </div>
                </div>
                <div class="form-section">
                    <h3 class="form-section-title">📦 Itens Disponíveis</h3>
                    <div class="linked-entities-list" id="linkedItemsList"></div>
                    <div class="add-linked-entity">
                        <select class="form-select" id="selectItemToLink">
                            <option value="">Selecionar Item...</option>
                            ${allItems.map(item => `<option value="${item.id}" data-name="${item.name || 'Item'}">${item.name || 'Item'} (${item.type || 'Item'})</option>`).join('')}
                        </select>
                        <button type="button" onclick="addLinkedItem()">+ Adicionar</button>
                </div>
                `;
            } else if (cat === 'npcs') {
                // NPC Submundo section
                const niveisAcesso = [
                    { value: 0, label: '0: Cego' },
                    { value: 1, label: '1: Tocado' },
                    { value: 2, label: '2: Iniciado' },
                    { value: 3, label: '3: Reconhecido' },
                    { value: 4, label: '4: Influente' },
                    { value: 5, label: '5: Círculo Interno' }
                ];

                const papeisSubmundo = [
                    { value: '', label: 'Nenhum (NPC não participa do Submundo)' },
                    { value: 'corredor', label: '🚶 Corredor' },
                    { value: 'mercador', label: '💼 Mercador' },
                    { value: 'mestre', label: '👑 Mestre de Feira' },
                    { value: 'vigia', label: '👁️ Vigia' },
                    { value: 'armador', label: '⚙️ Armador' },
                    { value: 'cliente', label: '🤝 Cliente' },
                    { value: 'informante', label: '🔍 Informante' }
                ];

                const especialidades = [
                    { value: 'alquimistaSombrio', label: '🧪 Alquimista Sombrio' },
                    { value: 'traficantesReliquias', label: '👑 Traficante de Relíquias' },
                    { value: 'negocianteVeu', label: '🌀 Negociante do Véu' },
                    { value: 'armeiroDiscreto', label: '⚔️ Armeiro Discreto' },
                    { value: 'corretorCarne', label: '💀 Corretor de Carne' },
                    { value: 'vendedorSegredos', label: '👁️ Vendedor de Segredos' },
                    { value: 'geral', label: '📦 Geral' }
                ];

                const feirasOptions = submundoFeiras.map(f =>
                    `<option value="${f.id}" ${(entry?.submundo?.feirasQueFrequenta || []).includes(f.id) ? 'selected' : ''}>${f.nome}</option>`
                ).join('');

                const propertiesOptions = (allData.properties || []).map(p =>
                    `<option value="${p.id}" ${(entry?.submundo?.pontosDeContato || []).map(pc => pc.id).includes(p.id) ? 'selected' : ''}>${p.nome} (${p.tipo})</option>`
                ).join('');

                const currentPapel = entry?.submundo?.papelSubmundo || '';
                const showEspecialidade = currentPapel === 'mercador';

                geographySections = `
                <div class="form-section collapsible-section ${currentPapel ? 'active' : ''}" id="submundoSection">
                    <h3 class="form-section-title" onclick="toggleSubmundoSection()" style="cursor: pointer;">
                        🌙 Atividade no Submundo 
                        <span style="font-size: 0.8rem; opacity: 0.7;">(clique para ${currentPapel ? 'recolher' : 'expandir'})</span>
                    </h3>
                    <div class="submundo-fields" style="display: ${currentPapel ? 'block' : 'none'};">
                        <div class="form-grid">
                            <div class="form-group">
                                <label class="form-label">Papel no Submundo</label>
                                <select class="form-select" id="entryPapelSubmundo" onchange="onPapelSubmundoChange()">
                                    ${papeisSubmundo.map(p => `<option value="${p.value}" ${currentPapel === p.value ? 'selected' : ''}>${p.label}</option>`).join('')}
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Nome de Sombra</label>
                                <input type="text" class="form-input" id="entryNomeDeSombra" value="${entry?.submundo?.nomeDeSombra || ''}" placeholder="Apelido no Submundo...">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Nível de Acesso</label>
                                <select class="form-select" id="entryNivelAcesso">
                                    ${niveisAcesso.map(n => `<option value="${n.value}" ${(entry?.submundo?.nivelAcesso || 0) == n.value ? 'selected' : ''}>${n.label}</option>`).join('')}
                                </select>
                            </div>
                            <div class="form-group" id="especialidadeGroup" style="display: ${showEspecialidade ? 'block' : 'none'};">
                                <label class="form-label">Especialidade (Mercador)</label>
                                <select class="form-select" id="entryEspecialidade">
                                    ${especialidades.map(e => `<option value="${e.value}" ${(entry?.submundo?.especialidade || '') === e.value ? 'selected' : ''}>${e.label}</option>`).join('')}
                                </select>
                            </div>
                        </div>
                        <div class="form-group" style="margin-top: 15px;">
                            <label class="form-label">🏕️ Feiras que Frequenta</label>
                            <select class="form-select" id="entryFeirasQueFrequenta" multiple style="height: 100px;">
                                ${feirasOptions || '<option disabled>Nenhuma feira cadastrada</option>'}
                            </select>
                            <small style="color: var(--lr-text-2);">Segure Ctrl para selecionar múltiplas</small>
                        </div>
                        <div class="form-group" style="margin-top: 15px;">
                            <label class="form-label">📍 Pontos de Contato</label>
                            <select class="form-select" id="entryPontosDeContato" multiple style="height: 100px;">
                                ${propertiesOptions || '<option disabled>Nenhuma propriedade cadastrada</option>'}
                            </select>
                            <small style="color: var(--lr-text-2);">Locais onde este NPC pode ser encontrado</small>
                        </div>
                        <div class="form-group" style="margin-top: 15px;">
                            <label class="form-label">⚠️ Marcas (Violações)</label>
                            <div style="display: flex; gap: 15px; flex-wrap: wrap; margin-top: 8px;">
                                <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
                                    <input type="checkbox" id="marcaQuebrado" ${(entry?.submundo?.marcas || []).includes('Quebrado') ? 'checked' : ''}>
                                    <span class="marca-badge marca-quebrado" style="padding: 4px 8px;">Quebrado</span>
                                    <small style="color: var(--lr-text-2);">(violou Paz da Feira)</small>
                                </label>
                                <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
                                    <input type="checkbox" id="marcaSemPalavra" ${(entry?.submundo?.marcas || []).includes('SemPalavra') ? 'checked' : ''}>
                                    <span class="marca-badge marca-sempalavra" style="padding: 4px 8px;">Sem Palavra</span>
                                    <small style="color: var(--lr-text-2);">(quebrou acordo)</small>
                                </label>
                                <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
                                    <input type="checkbox" id="marcaDelator" ${(entry?.submundo?.marcas || []).includes('Delator') ? 'checked' : ''}>
                                    <span class="marca-badge marca-delator" style="padding: 4px 8px;">Delator</span>
                                    <small style="color: var(--lr-text-2);">(revelou segredos)</small>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
                ${renderNpcFichaSection(entry)}
                `;
            }

            body.innerHTML = `
                <div class="form-section">
                    <h3 class="form-section-title">📋 Informações Básicas</h3>
                    <div class="form-grid">
                        <div class="form-group">
                            <label class="form-label">Nome *</label>
                            <input type="text" class="form-input" id="entryNome" value="${entry?.nome || entry?.titulo || ''}" required>
                        </div>
                        ${cat === 'factions' ? '' : `
                        <div class="form-group">
                            <label class="form-label">Tipo</label>
                            <select class="form-select" id="entryTipo" ${cat === 'geography' ? 'onchange="onGeographyTypeChange()"' : ''}>
                                ${config.types.map(t => `<option value="${t}" ${(entry?.tipo || '') === t ? 'selected' : ''}>${t}</option>`).join('')}
                            </select>
                        </div>`}
                    </div>
                </div>
                <div class="form-section">
                    <h3 class="form-section-title">🖼️ Imagem${criadorLocked ? ' <span style="font-size:0.72rem;opacity:0.7;font-weight:400">(do Painel do Criador)</span>' : ''}</h3>
                    <div class="form-group">
                        <label class="form-label">Imagem</label>
                        ${criadorLocked
                            ? `<input type="url" class="form-input" id="entryImagem" value="${entry?.imagem || ''}" placeholder="https://..." oninput="updateImagePreview()" readonly title="Editável no Painel do Criador">`
                            : CampoImagem.html({ id: 'entryImagem', classe: 'form-input', valor: entry?.imagem || '', pasta: 'worldbuilding-images', preview: false, attrs: 'oninput="updateImagePreview()"' })}
                        <div class="image-preview-container">
                            <img src="${entry?.imagem || ''}" class="image-preview ${entry?.imagem ? 'visible' : ''}" id="imagePreview" onerror="this.classList.remove('visible')" onload="this.classList.add('visible')">
                        </div>
                    </div>
                </div>
                <div class="form-section">
                    <h3 class="form-section-title">📝 Descrição${criadorLocked ? ' <span style="font-size:0.72rem;opacity:0.7;font-weight:400">(do Painel do Criador)</span>' : ''}</h3>
                    <div class="form-group">
                        <textarea class="form-textarea" id="entryDescricao" rows="6" placeholder="Descreva esta entrada..." ${criadorLocked ? 'readonly title="Editável no Painel do Criador"' : ''}>${entry?.descricao || entry?.historia || ''}</textarea>
                    </div>
                </div>
                ${extraFields ? `<div class="form-section"><h3 class="form-section-title">🔧 Campos Específicos</h3><div class="form-grid">${extraFields}</div></div>` : ''}
                ${geographySections}
                ${factionsSections}
                <div class="form-section">
                    <h3 class="form-section-title">🏷️ Tags</h3>
                    <div class="form-group">
                        <input type="text" class="form-input" id="entryTags" value="${entry?.tags || ''}" placeholder="tag1, tag2, tag3">
                    </div>
                </div>
                <div class="form-section">
                    <h3 class="form-section-title">🔒 Notas Privadas</h3>
                    <div class="form-group">
                        <textarea class="form-textarea" id="entryNotas" rows="3" placeholder="Suas anotações secretas...">${entry?.notas || ''}</textarea>
                    </div>
                </div>
                ${entry ? renderReferencedBySection(cat, entry.id) : ''}
            `;
            modal.classList.add('active');

            // Render linked entities if Geography
            if (cat === 'geography') {
                renderLinkedNpcs();
                if (['Vila', 'Cidade', 'Região'].includes(entry?.tipo || config.types[0])) {
                    renderLinkedTribos();
                }
            }

            // Render linked cultures if Factions/Tribes
            if (cat === 'factions') {
                renderLinkedCulturas();
            }

            // Render linked NPCs and Items if Properties
            if (cat === 'properties') {
                renderLinkedNpcsProperty();
                renderLinkedItems();
            }
        }

        // Image preview function
        window.updateImagePreview = function () {
            const input = document.getElementById('entryImagem');
            const preview = document.getElementById('imagePreview');
            if (input && preview) {
                preview.src = input.value;
                if (input.value) {
                    preview.classList.add('visible');
                } else {
                    preview.classList.remove('visible');
                }
            }
        };

        // Linked NPCs management
        function renderLinkedNpcs() {
            const container = document.getElementById('linkedNpcsList');
            if (!container) return;
            container.innerHTML = linkedNpcs.length ? linkedNpcs.map((npc, idx) => `
                <div class="linked-entity-item">
                    <span class="entity-type-badge">${npc.type || 'NPC'}</span>
                    <span class="linked-entity-name">${npc.name}</span>
                    <input type="text" class="linked-entity-title" value="${npc.title || ''}" placeholder="Título (ex: Ferreiro, Mora aqui...)" onchange="updateLinkedNpcTitle(${idx}, this.value)">
                    <button class="linked-entity-remove" onclick="removeLinkedNpc(${idx})">✕</button>
                </div>
            `).join('') : '<p style="color: var(--lr-text-2); font-size: 0.85rem;">Nenhum NPC vinculado a este local.</p>';
        }
        window.renderLinkedNpcs = renderLinkedNpcs;

        window.addLinkedNpc = function () {
            const select = document.getElementById('selectNpcToLink');
            if (!select.value) return;
            const option = select.options[select.selectedIndex];
            const npcId = option.value;
            const npcName = option.dataset.name;
            const npcType = option.dataset.type;

            // Check if already linked
            if (linkedNpcs.find(n => n.id === npcId)) {
                showAlert('⚠️ Este NPC já está vinculado!', 'warning');
                return;
            }

            linkedNpcs.push({ id: npcId, name: npcName, type: npcType, title: '' });
            select.value = '';
            renderLinkedNpcs();
        };

        window.updateLinkedNpcTitle = function (idx, title) {
            if (linkedNpcs[idx]) linkedNpcs[idx].title = title;
        };

        window.removeLinkedNpc = function (idx) {
            linkedNpcs.splice(idx, 1);
            renderLinkedNpcs();
        };

        // Linked Tribes management
        function renderLinkedTribos() {
            const container = document.getElementById('linkedTribosList');
            if (!container) return;
            container.innerHTML = linkedTribos.length ? linkedTribos.map((tribo, idx) => `
                <div class="linked-entity-item">
                    <span class="entity-type-badge">Tribo</span>
                    <span class="linked-entity-name">${tribo.name}</span>
                    <input type="text" class="linked-entity-title" value="${tribo.title || ''}" placeholder="Título (ex: Dominante, Aliada...)" onchange="updateLinkedTriboTitle(${idx}, this.value)">
                    <button class="linked-entity-remove" onclick="removeLinkedTribo(${idx})">✕</button>
                </div>
            `).join('') : '<p style="color: var(--lr-text-2); font-size: 0.85rem;">Nenhuma tribo vinculada a este local.</p>';
        }
        window.renderLinkedTribos = renderLinkedTribos;

        window.addLinkedTribo = function () {
            const select = document.getElementById('selectTriboToLink');
            if (!select.value) return;
            const option = select.options[select.selectedIndex];
            const triboId = option.value;
            const triboName = option.dataset.name;

            if (linkedTribos.find(t => t.id === triboId)) {
                showAlert('⚠️ Esta tribo já está vinculada!', 'warning');
                return;
            }

            linkedTribos.push({ id: triboId, name: triboName, title: '' });
            select.value = '';
            renderLinkedTribos();
        };

        window.updateLinkedTriboTitle = function (idx, title) {
            if (linkedTribos[idx]) linkedTribos[idx].title = title;
        };

        window.removeLinkedTribo = function (idx) {
            linkedTribos.splice(idx, 1);
            renderLinkedTribos();
        };

        // Handle Geography type change to show/hide Tribes section
        window.onGeographyTypeChange = function () {
            const tipo = document.getElementById('entryTipo').value;
            const tribosSection = document.getElementById('tribosSectionContainer');

            // Get tribes for the select
            const availableTribos = (allData.factions || []).filter(f => f.tipo === 'Tribo');

            if (['Vila', 'Cidade', 'Região'].includes(tipo)) {
                // Add the section if it doesn't exist
                if (!tribosSection) {
                    const npcsSection = document.querySelector('.form-section:has(#linkedNpcsList)');
                    if (npcsSection) {
                        const newSection = document.createElement('div');
                        newSection.className = 'form-section';
                        newSection.id = 'tribosSectionContainer';
                        newSection.innerHTML = `
                            <h3 class="form-section-title">🏕️ Tribos Presentes</h3>
                            <div class="linked-entities-list" id="linkedTribosList"></div>
                            <div class="add-linked-entity">
                                <select class="form-select" id="selectTriboToLink">
                                    <option value="">Selecionar Tribo...</option>
                                    ${availableTribos.map(t => `<option value="${t.id}" data-name="${t.nome}">${t.nome}</option>`).join('')}
                                </select>
                                <button type="button" onclick="addLinkedTribo()">+ Adicionar</button>
                            </div>
                        `;
                        npcsSection.after(newSection);
                        renderLinkedTribos();
                    }
                }
            } else {
                // Remove the section if it exists
                if (tribosSection) {
                    tribosSection.remove();
                    linkedTribos = []; // Clear linked tribes
                }
            }
        };

        // Linked Cultures management (for Tribes/Factions)
        function renderLinkedCulturas() {
            const container = document.getElementById('linkedCulturasList');
            if (!container) return;
            container.innerHTML = linkedCulturas.length ? linkedCulturas.map((cultura, idx) => `
                <div class="linked-entity-item">
                    <span class="entity-type-badge">${cultura.type || 'Cultura'}</span>
                    <span class="linked-entity-name">${cultura.name}</span>
                    <input type="text" class="linked-entity-title" value="${cultura.title || ''}" placeholder="Título (ex: Predominante, Herdada...)" onchange="updateLinkedCulturaTitle(${idx}, this.value)">
                    <button class="linked-entity-remove" onclick="removeLinkedCultura(${idx})">✕</button>
                </div>
            `).join('') : '<p style="color: var(--lr-text-2); font-size: 0.85rem;">Nenhuma cultura vinculada a esta tribo.</p>';
        }
        window.renderLinkedCulturas = renderLinkedCulturas;

        window.addLinkedCultura = function () {
            const select = document.getElementById('selectCulturaToLink');
            if (!select.value) return;
            const option = select.options[select.selectedIndex];
            const culturaId = option.value;
            const culturaName = option.dataset.name;
            const culturaType = option.dataset.type;

            if (linkedCulturas.find(c => c.id === culturaId)) {
                showAlert('⚠️ Esta cultura já está vinculada!', 'warning');
                return;
            }

            linkedCulturas.push({ id: culturaId, name: culturaName, type: culturaType, title: '' });
            select.value = '';
            renderLinkedCulturas();
        };

        window.updateLinkedCulturaTitle = function (idx, title) {
            if (linkedCulturas[idx]) linkedCulturas[idx].title = title;
        };

        window.removeLinkedCultura = function (idx) {
            linkedCulturas.splice(idx, 1);
            renderLinkedCulturas();
        };

        // Linked NPCs management for Properties
        function renderLinkedNpcsProperty() {
            const container = document.getElementById('linkedNpcsPropertyList');
            if (!container) return;
            container.innerHTML = linkedNpcsProperty.length ? linkedNpcsProperty.map((npc, idx) => `
                <div class="linked-entity-item">
                    <span class="entity-type-badge">${npc.type || 'NPC'}</span>
                    <span class="linked-entity-name">${npc.name}</span>
                    <input type="text" class="linked-entity-title" value="${npc.title || ''}" placeholder="Título (ex: Proprietário, Empregado, Mora aqui...)" onchange="updateLinkedNpcPropertyTitle(${idx}, this.value)">
                    <button class="linked-entity-remove" onclick="removeLinkedNpcProperty(${idx})">✕</button>
                </div>
            `).join('') : '<p style="color: var(--lr-text-2); font-size: 0.85rem;">Nenhum NPC vinculado a esta propriedade.</p>';
        }
        window.renderLinkedNpcsProperty = renderLinkedNpcsProperty;

        window.addLinkedNpcProperty = function () {
            const select = document.getElementById('selectNpcToLinkProperty');
            if (!select.value) return;
            const option = select.options[select.selectedIndex];
            const npcId = option.value;
            const npcName = option.dataset.name;
            const npcType = option.dataset.type;

            // Check if already linked
            if (linkedNpcsProperty.find(n => n.id === npcId)) {
                showAlert('⚠️ Este NPC já está vinculado!', 'warning');
                return;
            }

            linkedNpcsProperty.push({ id: npcId, name: npcName, type: npcType, title: '' });
            select.value = '';
            renderLinkedNpcsProperty();
        };

        window.updateLinkedNpcPropertyTitle = function (idx, title) {
            if (linkedNpcsProperty[idx]) linkedNpcsProperty[idx].title = title;
        };

        window.removeLinkedNpcProperty = function (idx) {
            linkedNpcsProperty.splice(idx, 1);
            renderLinkedNpcsProperty();
        };

        // Linked Items management for Properties
        function renderLinkedItems() {
            const container = document.getElementById('linkedItemsList');
            if (!container) return;
            container.innerHTML = linkedItems.length ? linkedItems.map((item, idx) => `
                <div class="linked-entity-item">
                    <span class="entity-type-badge">📦 Item</span>
                    <span class="linked-entity-name">${item.name}</span>
                    <input type="text" class="linked-entity-title" value="${item.title || ''}" placeholder="Título (ex: À venda, No balcão, Escondido...)" onchange="updateLinkedItemTitle(${idx}, this.value)">
                    <button class="linked-entity-remove" onclick="removeLinkedItem(${idx})">✕</button>
                </div>
            `).join('') : '<p style="color: var(--lr-text-2); font-size: 0.85rem;">Nenhum item vinculado a esta propriedade.</p>';
        }
        window.renderLinkedItems = renderLinkedItems;

        window.addLinkedItem = function () {
            const select = document.getElementById('selectItemToLink');
            if (!select.value) return;
            const option = select.options[select.selectedIndex];
            const itemId = option.value;
            const itemName = option.dataset.name;

            // Check if already linked
            if (linkedItems.find(i => i.id === itemId)) {
                showAlert('⚠️ Este item já está vinculado!', 'warning');
                return;
            }

            linkedItems.push({ id: itemId, name: itemName, title: '' });
            select.value = '';
            renderLinkedItems();
        };

        window.updateLinkedItemTitle = function (idx, title) {
            if (linkedItems[idx]) linkedItems[idx].title = title;
        };

        window.removeLinkedItem = function (idx) {
            linkedItems.splice(idx, 1);
            renderLinkedItems();
        };

        // Linked Factions management for History
        function renderLinkedFactionsHistory() {
            const container = document.getElementById('linkedFactionsHistoryList');
            if (!container) return;
            container.innerHTML = linkedFactionsHistory.length ? linkedFactionsHistory.map((faction, idx) => `
                <div class="linked-entity-item">
                    <span class="entity-type-badge">Tribo</span>
                    <span class="linked-entity-name">${faction.name}</span>
                    <input type="text" class="linked-entity-title" value="${faction.title || ''}" placeholder="Papel (ex: Protagonista, Aliada...)" onchange="updateLinkedFactionHistoryTitle(${idx}, this.value)">
                    <button class="linked-entity-remove" onclick="removeLinkedFactionHistory(${idx})">✕</button>
                </div>
            `).join('') : '<p style="color: var(--lr-text-2); font-size: 0.85rem;">Nenhuma facção vinculada a este evento.</p>';
        }
        window.renderLinkedFactionsHistory = renderLinkedFactionsHistory;

        window.addLinkedFactionHistory = function () {
            const select = document.getElementById('selectFactionToLinkHistory');
            if (!select.value) return;
            const option = select.options[select.selectedIndex];
            const factionId = option.value;
            const factionName = option.dataset.name;

            if (linkedFactionsHistory.find(f => f.id === factionId)) {
                showAlert('⚠️ Esta facção já está vinculada!', 'warning');
                return;
            }

            linkedFactionsHistory.push({ id: factionId, name: factionName, title: '' });
            select.value = '';
            renderLinkedFactionsHistory();
        };

        window.updateLinkedFactionHistoryTitle = function (idx, title) {
            if (linkedFactionsHistory[idx]) linkedFactionsHistory[idx].title = title;
        };

        window.removeLinkedFactionHistory = function (idx) {
            linkedFactionsHistory.splice(idx, 1);
            renderLinkedFactionsHistory();
        };

        window.openEntry = (cat, id) => {
            currentCategory = cat;
            const entry = allData[cat].find(e => e.id === id);
            if (entry) openEntryModal(entry);
        };
        window.closeEntryModal = () => {
            const modal = document.getElementById('entryModal');
            modal.classList.remove('active');
            modal.querySelector('.modal-content').classList.remove('session-modal');
            currentEditingEntry = null;
        };

        // NPC Submundo helper functions
        window.toggleSubmundoSection = function () {
            const section = document.getElementById('submundoSection');
            const fields = section?.querySelector('.submundo-fields');
            if (fields) {
                const isVisible = fields.style.display !== 'none';
                fields.style.display = isVisible ? 'none' : 'block';
                const hint = section.querySelector('span');
                if (hint) hint.textContent = `(clique para ${isVisible ? 'expandir' : 'recolher'})`;
            }
        };

        window.onPapelSubmundoChange = function () {
            const papel = document.getElementById('entryPapelSubmundo')?.value || '';
            const especialidadeGroup = document.getElementById('especialidadeGroup');
            const submundoFields = document.querySelector('.submundo-fields');

            // Show/hide especialidade based on mercador role
            if (especialidadeGroup) {
                especialidadeGroup.style.display = papel === 'mercador' ? 'block' : 'none';
            }

            // Expand section if role is selected
            if (papel && submundoFields && submundoFields.style.display === 'none') {
                submundoFields.style.display = 'block';
            }
        };

        window.saveEntry = async function () {
            const cat = currentCategory === 'dashboard' ? 'geography' : currentCategory;
            const config = categoryConfig[cat];
            const nome = document.getElementById('entryNome').value.trim();
            if (!nome) { showAlert('⚠️ O nome é obrigatório!', 'warning'); return; }

            const data = {
                nome,
                tipo: document.getElementById('entryTipo')?.value || currentEditingEntry?.tipo || (cat === 'factions' ? 'Tribo' : ''),
                imagem: document.getElementById('entryImagem').value.trim(),
                descricao: document.getElementById('entryDescricao').value.trim(),
                tags: document.getElementById('entryTags').value.trim(),
                notas: document.getElementById('entryNotas').value.trim(),
                lastUpdate: new Date().toISOString(),
                lastUpdateBy: currentUser.email
            };

            // Category-specific fields
            if (cat === 'geography') {
                data.clima = document.getElementById('entryClima')?.value?.trim() || '';
                data.populacao = document.getElementById('entryPopulacao')?.value?.trim() || '';
                data.recursos = document.getElementById('entryRecursos')?.value?.trim() || '';
                data.governo = document.getElementById('entryGoverno')?.value?.trim() || '';
                data.landmarks = document.getElementById('entryLandmarks')?.value?.trim() || '';
                data.perigos = document.getElementById('entryPerigos')?.value?.trim() || '';
                data.historiaLocal = document.getElementById('entryHistoriaLocal')?.value?.trim() || '';

                // Save parent geography (pertenceA) for hierarchy
                const parentSelect = document.getElementById('entryPertenceA');
                if (parentSelect && parentSelect.value) {
                    const option = parentSelect.options[parentSelect.selectedIndex];
                    data.pertenceA = {
                        id: parentSelect.value,
                        nome: option.dataset.nome,
                        tipo: option.dataset.tipo
                    };
                } else {
                    data.pertenceA = null;
                }

                // Save linked NPCs and Tribos
                data.linkedNpcs = linkedNpcs;
                data.linkedTribos = linkedTribos;

                // O vínculo na ficha é a fonte da verdade: NPC desvinculado
                // aqui também sai do mapa tático, senão o token continuaria
                // sendo montado no Tabuleiro por um Local que não o conhece.
                const mt = currentEditingEntry?.mapaTatico;
                if (mt && Array.isArray(mt.objetos)) {
                    const vivos = new Set(linkedNpcs.map(n => n.id));
                    const objetos = mt.objetos.filter(o => o.tipo !== 'npc' || vivos.has(o.npcId));
                    if (objetos.length !== mt.objetos.length) {
                        data.mapaTatico = { ...mt, objetos };
                        showAlert(`🗺️ ${mt.objetos.length - objetos.length} token(s) de NPC removido(s) do mapa tático.`, 'warning');
                    }
                }
            } else if (cat === 'factions') {
                data.lideranca = document.getElementById('entryLideranca')?.value?.trim() || '';
                data.ideologia = document.getElementById('entryIdeologia')?.value?.trim() || '';
                data.territorios = document.getElementById('entryTerritorios')?.value?.trim() || '';
                data.aliados = document.getElementById('entryAliados')?.value?.trim() || '';
                data.inimigos = document.getElementById('entryInimigos')?.value?.trim() || '';
                // Save linked Cultures
                data.linkedCulturas = linkedCulturas;
                // Mantém o vínculo com a tribo do Painel do Criador (mesma entidade).
                if (currentEditingEntry?._criadorId) data.criadorTriboId = currentEditingEntry._criadorId;
            } else if (cat === 'history') {
                data.era = document.getElementById('historyEra')?.value || '';
                data.importancia = document.getElementById('historyImportancia')?.value || 'moderada';
                data.ordemCronologica = parseInt(document.getElementById('historyOrdem')?.value || '0');
                data.dataInicio = document.getElementById('entryDataInicio')?.value?.trim() || '';
                data.dataFim = document.getElementById('entryDataFim')?.value?.trim() || '';
                data.participantes = document.getElementById('entryParticipantes')?.value?.trim() || '';
                data.consequencias = document.getElementById('entryConsequencias')?.value?.trim() || '';

                const regionVal = document.getElementById('historyRegion')?.value;
                if (regionVal) {
                    const [id, nome] = regionVal.split('|');
                    data.regiaoEnvolvida = { id, nome };
                } else {
                    data.regiaoEnvolvida = null;
                }

                data.faccoesEnvolvidas = linkedFactionsHistory;
            } else if (cat === 'cultures') {
                data.costumes = document.getElementById('entryCostumes')?.value?.trim() || '';
                data.tradicoes = document.getElementById('entryTradicoes')?.value?.trim() || '';
                data.estruturaSocial = document.getElementById('entryEstruturaSocial')?.value?.trim() || '';
                data.idiomas = document.getElementById('entryIdiomas')?.value?.trim() || '';
            } else if (cat === 'magic') {
                data.regras = document.getElementById('entryRegras')?.value?.trim() || '';
                data.limitacoes = document.getElementById('entryLimitacoes')?.value?.trim() || '';
            } else if (cat === 'religion') {
                data.dominios = document.getElementById('entryDominios')?.value?.trim() || '';
                data.simbolos = document.getElementById('entrySimbolos')?.value?.trim() || '';
                data.rituais = document.getElementById('entryRituais')?.value?.trim() || '';
            } else if (cat === 'properties') {
                data.titulo = document.getElementById('entryTitulo')?.value?.trim() || '';
                data.localizacao = document.getElementById('entryLocalizacao')?.value?.trim() || '';
                data.proprietario = document.getElementById('entryProprietario')?.value?.trim() || '';
                data.valor = document.getElementById('entryValor')?.value?.trim() || '';
                data.estado = document.getElementById('entryEstado')?.value || 'Conservada';
                data.tamanho = document.getElementById('entryTamanho')?.value?.trim() || '';
                data.comodos = document.getElementById('entryComodos')?.value?.trim() || '';
                data.segredos = document.getElementById('entrySegredos')?.value?.trim() || '';
                // Save linked NPCs for Property
                data.linkedNpcsProperty = linkedNpcsProperty;
                // Save linked Items for Property
                data.linkedItems = linkedItems;
            } else if (cat === 'npcs') {
                // NPC Submundo data
                const papelSubmundo = document.getElementById('entryPapelSubmundo')?.value || '';
                if (papelSubmundo) {
                    const feirasSelect = document.getElementById('entryFeirasQueFrequenta');
                    const pontosSelect = document.getElementById('entryPontosDeContato');

                    const feirasQueFrequenta = feirasSelect ?
                        Array.from(feirasSelect.selectedOptions).map(opt => opt.value) : [];

                    const pontosDeContato = pontosSelect ?
                        Array.from(pontosSelect.selectedOptions).map(opt => ({
                            id: opt.value,
                            nome: opt.text.split(' (')[0]
                        })) : [];

                    const marcas = [];
                    if (document.getElementById('marcaQuebrado')?.checked) marcas.push('Quebrado');
                    if (document.getElementById('marcaSemPalavra')?.checked) marcas.push('SemPalavra');
                    if (document.getElementById('marcaDelator')?.checked) marcas.push('Delator');

                    data.submundo = {
                        papelSubmundo: papelSubmundo,
                        nomeDeSombra: document.getElementById('entryNomeDeSombra')?.value?.trim() || '',
                        nivelAcesso: parseInt(document.getElementById('entryNivelAcesso')?.value || '0'),
                        especialidade: papelSubmundo === 'mercador' ? (document.getElementById('entryEspecialidade')?.value || '') : '',
                        feirasQueFrequenta: feirasQueFrequenta,
                        pontosDeContato: pontosDeContato,
                        marcas: marcas
                    };
                } else {
                    data.submundo = null;
                }
            } else if (cat === 'rumors') {
                data.status = document.getElementById('rumorStatus').value;
                data.veracidade = document.getElementById('rumorVeracidade').value;
                data.recompensaInvestigar = document.getElementById('rumorRecompensa').value.trim();
                data.verdade = document.getElementById('rumorVerdade').value.trim();

                const fonteVal = document.getElementById('rumorFonte').value;
                if (fonteVal) {
                    const [tipo, id, nome] = fonteVal.split('|');
                    data.fonte = { tipo, id, nome };
                } else {
                    data.fonte = null;
                }

                const questVal = document.getElementById('rumorQuest').value;
                if (questVal) {
                    const [id, nome] = questVal.split('|');
                    data.questRelacionada = { id, nome };
                } else {
                    data.questRelacionada = null;
                }
            }

            try {
                const colRef = collection(db, config.collection);
                const docRef = currentEditingEntry ? doc(db, config.collection, currentEditingEntry.id) : doc(colRef);
                await setDoc(docRef, data, { merge: true });
                showAlert(currentEditingEntry ? '✅ Entrada atualizada!' : '✅ Entrada criada!', 'success');
                closeEntryModal();
                await loadAllData();
                if (currentCategory === 'dashboard') renderDashboard();
                else renderCategoryList(currentCategory);
            } catch (e) {
                console.error(e);
                showAlert('❌ Erro ao salvar entrada', 'danger');
            }
        };

        window.deleteCurrentEntry = async function () {
            if (!currentEditingEntry || !await confirmar('Tem certeza que deseja excluir esta entrada?', { perigo: true })) return;
            const cat = currentCategory === 'dashboard' ? 'geography' : currentCategory;
            try {
                await deleteDoc(doc(db, categoryConfig[cat].collection, currentEditingEntry.id));
                showAlert('✅ Entrada excluída!', 'success');
                closeEntryModal();
                await loadAllData();
                if (currentCategory === 'dashboard') renderDashboard();
                else renderCategoryList(currentCategory);
            } catch (e) {
                console.error(e);
                showAlert('❌ Erro ao excluir', 'danger');
            }
        };

        // Global Search
        document.getElementById('globalSearch').addEventListener('input', function () {
            const query = this.value.toLowerCase().trim();
            if (!query) { if (currentCategory === 'dashboard') renderDashboard(); else renderCategoryList(currentCategory); return; }
            const results = Object.entries(allData).flatMap(([cat, entries]) =>
                entries.filter(e =>
                    (e.nome || '').toLowerCase().includes(query) ||
                    (e.descricao || '').toLowerCase().includes(query) ||
                    (e.tags || '').toLowerCase().includes(query)
                ).map(e => ({ ...e, category: cat }))
            );
            document.getElementById('contentTitle').textContent = `Busca: "${this.value}"`;
            document.getElementById('contentBody').innerHTML = `
                <div class="entries-grid">
                    ${results.length ? results.map(e => renderEntryCard(e, e.category)).join('') :
                    '<div class="no-entries"><p>Nenhum resultado encontrado.</p></div>'}
                </div>
            `;
        });

        // ==================== SESSION LOGS FUNCTIONS ====================

        function renderSessionLogs() {
            const body = document.getElementById('contentBody');

            // Campaign selector
            const campaignOptions = allCampaigns.map(c =>
                `<option value="${c.id}" ${currentCampaign?.id === c.id ? 'selected' : ''}>${c.nome}</option>`
            ).join('');

            // Get sessions for current campaign
            const campaignSessions = currentCampaign
                ? allSessions.filter(s => s.campaignId === currentCampaign.id).sort((a, b) => new Date(b.date) - new Date(a.date))
                : [];

            body.innerHTML = `
                <div class="campaign-selector-container">
                    <div class="campaign-selector-header">
                        <span class="campaign-selector-title">🎲 Selecionar Campanha</span>
                        <div style="display: flex; gap: 10px; align-items: center;">
                            <select class="campaign-select" id="campaignSelect" onchange="selectCampaign(this.value)">
                                <option value="">Selecione uma campanha...</option>
                                ${campaignOptions}
                            </select>
                            <button class="btn-favorite ${currentCampaign && favoriteCampaignId === currentCampaign.id ? 'active' : ''}" 
                                    onclick="toggleFavoriteCampaign()" 
                                    title="${currentCampaign && favoriteCampaignId === currentCampaign.id ? 'Remover dos favoritos' : 'Marcar como favorita'}"
                                    ${!currentCampaign ? 'disabled' : ''}>
                                ${currentCampaign && favoriteCampaignId === currentCampaign.id ? '⭐' : '☆'}
                            </button>
                            <button class="btn btn-success" onclick="openCampaignModal()">➕ Nova Campanha</button>
                        </div>
                    </div>
                    ${currentCampaign ? `
                        <div class="campaign-info" id="campaignInfo">
                            <div class="campaign-info-item">
                                <span class="campaign-info-label">Sistema</span>
                                <span class="campaign-info-value">${currentCampaign.sistema || 'Não definido'}</span>
                            </div>
                            <div class="campaign-info-item">
                                <span class="campaign-info-label">Mestre</span>
                                <span class="campaign-info-value">${currentCampaign.mestre || 'Não definido'}</span>
                            </div>
                            <div class="campaign-info-item">
                                <span class="campaign-info-label">Personagens</span>
                                <span class="campaign-info-value">${(currentCampaign.personagens || []).map(p => p.nome).join(', ') || 'Nenhum'}</span>
                            </div>
                            <div class="campaign-info-item">
                                <span class="campaign-info-label">Total de Sessões</span>
                                <span class="campaign-info-value">${campaignSessions.length > 0 ? Math.max(...campaignSessions.map(s => s.sessionNumber || 0)) : 0}</span>
                            </div>
                        </div>
                        <div class="import-export-container">
                            <button class="btn-import" onclick="triggerImportSession()">📥 Importar JSON</button>
                            <button class="btn-export" onclick="downloadTemplate()">📄 Baixar Template</button>
                            <button class="btn btn-primary" onclick="editCurrentCampaign()">✏️ Editar Campanha</button>
                            <button class="btn btn-primary" onclick="openNotificationModal()">📬 Notificar Jogadores</button>
                            <input type="file" id="importSessionFile" accept=".json" style="display:none;" onchange="importSessionJSON(this)">
                        </div>
                    ` : ''}
                </div>
                
                ${currentCampaign ? `
                    <div class="sessions-list-container">
                        <div class="sessions-list-header">
                            <div class="sessions-search-bar">
                                <input type="text" class="sessions-search-input" id="sessionSearchInput" 
                                    placeholder="🔍 Buscar por NPC, localização, quest..." 
                                    oninput="filterSessions()">
                            </div>
                            <div class="view-mode-tabs">
                                <button class="view-mode-tab ${currentViewMode === 'list' ? 'active' : ''}" onclick="setViewMode('list')">📋 Lista</button>
                                <button class="view-mode-tab ${currentViewMode === 'chronology' ? 'active' : ''}" onclick="setViewMode('chronology')">📊 Cronologia</button>
                                <button class="view-mode-tab ${currentViewMode === 'timeline' ? 'active' : ''}" onclick="setViewMode('timeline')">📅 Timeline</button>
                                <button class="view-mode-tab ${currentViewMode === 'wiki' ? 'active' : ''}" onclick="setViewMode('wiki')">📖 Wiki</button>
                                <button class="view-mode-tab ${currentViewMode === 'gallery' ? 'active' : ''}" onclick="setViewMode('gallery')">🖼️ Galeria</button>
                            </div>
                            <button class="btn btn-success" onclick="openSessionModal()">➕ Nova Sessão</button>
                        </div>
                        <div id="sessionsContent">
                            ${renderSessionsContent(campaignSessions)}
                        </div>
                    </div>

                ` : `
                    <div class="empty-state">
                        <div class="empty-state-icon">📋</div>
                        <div class="empty-state-title">Nenhuma campanha selecionada</div>
                        <div class="empty-state-desc">Selecione uma campanha existente ou crie uma nova para começar a registrar suas sessões.</div>
                        <button class="btn btn-success" onclick="openCampaignModal()">➕ Criar Primeira Campanha</button>
                    </div>
                `}
            `;
        }

        function renderSessionsContent(sessions) {
            if (currentViewMode === 'list') {
                return renderSessionsList(sessions);
            } else if (currentViewMode === 'chronology') {
                return renderChronologyView(sessions);
            } else if (currentViewMode === 'timeline') {
                return renderTimelineView(sessions);
            } else if (currentViewMode === 'wiki') {
                return renderWikiView(sessions);
            } else if (currentViewMode === 'gallery') {
                return renderGalleryView(sessions);
            }
            return renderSessionsList(sessions);
        }

        function renderSessionsList(sessions) {
            if (!sessions.length) {
                return `
                    <div class="empty-state">
                        <div class="empty-state-icon">📝</div>
                        <div class="empty-state-title">Nenhuma sessão registrada</div>
                        <div class="empty-state-desc">Clique em "Nova Sessão" para documentar sua primeira aventura!</div>
                    </div>
                `;
            }

            return sessions.map(s => `
                <div class="session-card" onclick="openSessionModal(${JSON.stringify(s).replace(/"/g, '&quot;')})">
                    <div class="session-card-header">
                        <div>
                            <div class="session-number">Sessão ${s.sessionNumber || '?'}</div>
                            <div class="session-date">${formatDate(s.date)}</div>
                        </div>
                        <div class="session-meta">
                            ${s.duration ? `<span class="session-badge duration">⏱️ ${s.duration}</span>` : ''}
                            ${s.playersPresent ? `<span class="session-badge players">👥 ${s.playersPresent.length} presentes</span>` : ''}
                            ${s.lootAndRewards?.xp ? `<span class="session-badge xp">⭐ ${s.lootAndRewards.xp} XP</span>` : ''}
                        </div>
                    </div>
                    <div class="session-summary">${s.summary || 'Sem resumo'}</div>
                    <div class="session-highlights">
                        ${(s.importantNpcs || []).slice(0, 3).map(n => `<span class="highlight-tag npc">👤 ${n.name || n}</span>`).join('')}
                        ${(s.locationsVisited || []).slice(0, 2).map(l => `<span class="highlight-tag location">📍 ${l.name || l}</span>`).join('')}
                        ${(s.quests || []).slice(0, 2).map(q => `<span class="highlight-tag quest">📜 ${q.name || q}</span>`).join('')}
                    </div>
                </div>
            `).join('');
        }

        // Chronology view - displays all events from all sessions as visual timeline bars
        function renderChronologyView(sessions) {
            if (!sessions.length) {
                return `<div class="empty-state"><div class="empty-state-icon">📊</div><div class="empty-state-title">Cronologia vazia</div><div class="empty-state-desc">Adicione eventos com horários às suas sessões para visualizar aqui.</div></div>`;
            }

            // Collect all events from all sessions with their in-game dates
            const allEvents = [];
            const eventTypeConfig = {
                npc: { icon: '👤', label: 'NPC' },
                location: { icon: '📍', label: 'Local' },
                combat: { icon: '⚔️', label: 'Combate' },
                quest: { icon: '📜', label: 'Quest' },
                moment: { icon: '⭐', label: 'Momento' }
            };

            sessions.forEach(session => {
                const baseDay = parseInt(session.gameTime?.day) || 1;
                const month = session.gameTime?.month || '';
                const year = session.gameTime?.year || '';
                const era = session.gameTime?.era || '';

                // Helper to build full date object
                const buildDate = (dayOffset) => ({
                    day: Math.min(45, baseDay + dayOffset),
                    month,
                    year,
                    era,
                    sortKey: `${era}-${year}-${month}-${String(Math.min(45, baseDay + dayOffset)).padStart(2, '0')}`
                });

                // Collect NPCs
                (session.importantNpcs || []).forEach(n => {
                    if (n.startHour !== null && n.startHour !== undefined) {
                        allEvents.push({
                            type: 'npc', name: n.name || n,
                            startDate: buildDate(n.dayOffset || 0),
                            endDate: buildDate(n.endDayOffset ?? n.dayOffset ?? 0),
                            startHour: n.startHour, endHour: n.endHour,
                            sessionNumber: session.sessionNumber
                        });
                    }
                });

                // Collect Locations
                (session.locationsVisited || []).forEach(l => {
                    if (l.startHour !== null && l.startHour !== undefined) {
                        allEvents.push({
                            type: 'location', name: l.name || l,
                            startDate: buildDate(l.dayOffset || 0),
                            endDate: buildDate(l.endDayOffset ?? l.dayOffset ?? 0),
                            startHour: l.startHour, endHour: l.endHour,
                            sessionNumber: session.sessionNumber
                        });
                    }
                });

                // Collect Combats
                (session.combats || []).forEach(c => {
                    if (c.startHour !== null && c.startHour !== undefined) {
                        allEvents.push({
                            type: 'combat', name: c.enemies || 'Combate',
                            startDate: buildDate(c.dayOffset || 0),
                            endDate: buildDate(c.endDayOffset ?? c.dayOffset ?? 0),
                            startHour: c.startHour, endHour: c.endHour,
                            sessionNumber: session.sessionNumber
                        });
                    }
                });

                // Collect Quests
                (session.quests || []).forEach(q => {
                    if (q.startHour !== null && q.startHour !== undefined) {
                        allEvents.push({
                            type: 'quest', name: q.name || q,
                            startDate: buildDate(q.dayOffset || 0),
                            endDate: buildDate(q.endDayOffset ?? q.dayOffset ?? 0),
                            startHour: q.startHour, endHour: q.endHour,
                            sessionNumber: session.sessionNumber
                        });
                    }
                });

                // Collect Moments
                (session.memorableMoments || []).forEach(m => {
                    if (m.startHour !== null && m.startHour !== undefined) {
                        allEvents.push({
                            type: 'moment', name: m.description || m,
                            startDate: buildDate(m.dayOffset || 0),
                            endDate: buildDate(m.endDayOffset ?? m.dayOffset ?? 0),
                            startHour: m.startHour, endHour: m.endHour,
                            sessionNumber: session.sessionNumber
                        });
                    }
                });
            });

            if (allEvents.length === 0) {
                return `<div class="empty-state"><div class="empty-state-icon">📊</div><div class="empty-state-title">Sem eventos cronológicos</div><div class="empty-state-desc">Os eventos precisam ter horários definidos para aparecer na cronologia visual.</div></div>`;
            }

            // Group events by date
            const eventsByDate = {};
            allEvents.forEach(event => {
                const startKey = event.startDate.sortKey;
                const endKey = event.endDate.sortKey;

                if (startKey === endKey) {
                    if (!eventsByDate[startKey]) eventsByDate[startKey] = { date: event.startDate, events: [] };
                    eventsByDate[startKey].events.push({ ...event, isStart: true, isEnd: true });
                } else {
                    if (!eventsByDate[startKey]) eventsByDate[startKey] = { date: event.startDate, events: [] };
                    eventsByDate[startKey].events.push({ ...event, isStart: true, isEnd: false });

                    if (!eventsByDate[endKey]) eventsByDate[endKey] = { date: event.endDate, events: [] };
                    eventsByDate[endKey].events.push({ ...event, isStart: false, isEnd: true });
                }
            });

            const sortedDates = Object.keys(eventsByDate).sort();

            // Format time display
            const formatTime = (hour) => {
                const h = Math.floor(hour);
                const m = Math.round((hour - h) * 60);
                return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            };

            // Build time scale (0h to 23h)
            const timeScaleHtml = Array.from({ length: 24 }, (_, h) => `<div class="time-scale-hour">${h}h</div>`).join('');

            // Build HTML for each date with visual timeline
            let html = '<div class="chronology-visual-container">';

            sortedDates.forEach(dateKey => {
                const { date, events } = eventsByDate[dateKey];
                const dateLabel = date.month || date.year || date.era
                    ? `${date.day}-${date.month || '?'}${date.year ? '-' + date.year : ''}${date.era ? '-' + date.era : ''}`
                    : `Dia ${date.day}`;

                // Sort events by start hour
                events.sort((a, b) => {
                    const hourA = a.isStart ? a.startHour : 0;
                    const hourB = b.isStart ? b.startHour : 0;
                    return hourA - hourB;
                });

                html += `
                    <div class="chronology-visual-day">
                        <div class="chronology-visual-header" onclick="toggleChronologyDay(event, this)">
                            <span class="chronology-visual-date"><span class="toggle-icon">▼</span> 📅 ${dateLabel}</span>
                            <span class="chronology-visual-count">${events.length} evento${events.length !== 1 ? 's' : ''}</span>
                        </div>
                        <div class="chronology-visual-timeline">
                            <div class="time-scale">${timeScaleHtml}</div>
                            <div class="period-backgrounds">
                                <div class="period-bg madrugada">🌙 Madrugada</div>
                                <div class="period-bg manha">🌅 Manhã</div>
                                <div class="period-bg tarde">☀️ Tarde</div>
                                <div class="period-bg noite">🌃 Noite</div>
                            </div>
                            <div class="event-tracks">
                `;

                events.forEach(event => {
                    const config = eventTypeConfig[event.type];

                    // Calculate position and width based on time
                    const isStartDay = event.isStart;
                    const isEndDay = event.isEnd;

                    let displayStartHour, displayEndHour;
                    if (!isStartDay && !isEndDay) {
                        displayStartHour = 0;
                        displayEndHour = 24;
                    } else if (isStartDay && isEndDay) {
                        displayStartHour = event.startHour;
                        displayEndHour = event.endHour || event.startHour + 1;
                    } else if (isStartDay) {
                        displayStartHour = event.startHour;
                        displayEndHour = 24;
                    } else {
                        displayStartHour = 0;
                        displayEndHour = event.endHour || 12;
                    }

                    const duration = displayEndHour - displayStartHour || 1;
                    const leftPercent = (displayStartHour / 24) * 100;
                    const widthPercent = Math.max(2, (duration / 24) * 100);

                    const startDisplay = formatTime(displayStartHour);
                    const endDisplay = formatTime(displayEndHour);

                    const multiDayMarker = !(isStartDay && isEndDay)
                        ? (isStartDay ? ' ▶' : '◀ ')
                        : '';

                    html += `
                        <div class="event-track">
                            <div class="event-bar ${event.type}" 
                                 style="left: ${leftPercent}%; width: ${widthPercent}%;" 
                                 title="${event.name} - Sessão ${event.sessionNumber}">
                                <span class="event-bar-icon">${isStartDay ? config.icon : '◀'}</span>
                                <span class="event-bar-name">${multiDayMarker}${event.name}</span>
                                <span class="event-bar-time">${startDisplay}-${endDisplay}</span>
                                <div class="event-bar-tooltip">
                                    ${event.name}<br>
                                    ${startDisplay} → ${endDisplay}<br>
                                    <small>Sessão ${event.sessionNumber}</small>
                                </div>
                            </div>
                        </div>
                    `;
                });

                html += `
                            </div>
                        </div>
                    </div>
                `;
            });

            html += '</div>';
            return html;
        }

        // Toggle chronology day collapse - Ctrl+click toggles all days
        window.toggleChronologyDay = function (event, headerElement) {
            const dayElement = headerElement.closest('.chronology-visual-day');
            const allDays = document.querySelectorAll('.chronology-visual-day');

            if (event.ctrlKey) {
                // Ctrl+click: toggle all days to match the clicked day's target state
                const willCollapse = !dayElement.classList.contains('collapsed');
                allDays.forEach(day => {
                    if (willCollapse) {
                        day.classList.add('collapsed');
                    } else {
                        day.classList.remove('collapsed');
                    }
                });
            } else {
                // Normal click: toggle only this day
                dayElement.classList.toggle('collapsed');
            }
        };

        function renderTimelineView(sessions) {
            if (!sessions.length) {
                return `<div class="empty-state"><div class="empty-state-icon">📅</div><div class="empty-state-title">Timeline vazia</div></div>`;
            }

            return `
                <div class="campaign-timeline">
                    ${sessions.map(s => `
                        <div class="timeline-item" onclick="openSessionModal(${JSON.stringify(s).replace(/"/g, '&quot;')})">
                            <div class="timeline-date">${formatDate(s.date)}</div>
                            <div class="timeline-title">Sessão ${s.sessionNumber}: ${(s.summary || '').substring(0, 50)}...</div>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        function renderWikiView(sessions) {
            // Extract all NPCs and Locations from all sessions
            const allNpcs = {};
            const allLocations = {};

            sessions.forEach(s => {
                (s.importantNpcs || []).forEach(n => {
                    const name = n.name || n;
                    if (!allNpcs[name]) allNpcs[name] = { count: 0, sessions: [] };
                    allNpcs[name].count++;
                    allNpcs[name].sessions.push(s.sessionNumber);
                });
                (s.locationsVisited || []).forEach(l => {
                    const name = l.name || l;
                    if (!allLocations[name]) allLocations[name] = { count: 0, sessions: [] };
                    allLocations[name].count++;
                    allLocations[name].sessions.push(s.sessionNumber);
                });
            });

            return `
                <div class="wiki-section">
                    <div class="wiki-tabs">
                        <button class="wiki-tab active" onclick="switchWikiTab('npcs', this)">👥 NPCs (${Object.keys(allNpcs).length})</button>
                        <button class="wiki-tab" onclick="switchWikiTab('locations', this)">📍 Localizações (${Object.keys(allLocations).length})</button>
                    </div>
                    <div class="wiki-grid" id="wikiNpcsGrid">
                        ${Object.entries(allNpcs).map(([name, data]) => `
                            <div class="wiki-card" onclick="searchSessionsByTerm('${name}')">
                                <div class="wiki-card-name">${name}</div>
                                <div class="wiki-card-count">Mencionado em ${data.count} sessões</div>
                            </div>
                        `).join('') || '<p style="color:var(--lr-text-2);">Nenhum NPC registrado.</p>'}
                    </div>
                    <div class="wiki-grid" id="wikiLocationsGrid" style="display: none;">
                        ${Object.entries(allLocations).map(([name, data]) => `
                            <div class="wiki-card" onclick="searchSessionsByTerm('${name}')">
                                <div class="wiki-card-name">${name}</div>
                                <div class="wiki-card-count">Visitado em ${data.count} sessões</div>
                            </div>
                        `).join('') || '<p style="color:var(--lr-text-2);">Nenhuma localização registrada.</p>'}
                    </div>
                </div>
            `;
        }

        function renderGalleryView(sessions) {
            // Collect all images from sessions
            const allImages = [];
            sessions.forEach(s => {
                if (s.images && s.images.length) {
                    s.images.forEach(img => {
                        allImages.push({ ...img, sessionNumber: s.sessionNumber });
                    });
                }
            });

            if (!allImages.length) {
                return `
                    <div class="empty-state">
                        <div class="empty-state-icon">🖼️</div>
                        <div class="empty-state-title">Galeria vazia</div>
                        <div class="empty-state-desc">Adicione imagens às suas sessões para visualizá-las aqui.</div>
                    </div>
                `;
            }

            return `
                <div class="gallery-grid">
                    ${allImages.map(img => `
                        <div class="gallery-item-card" onclick="viewFullImage('${img.url}')">
                            <img src="${img.url}" alt="${img.label || 'Imagem'}" onerror="this.parentElement.style.display='none'">
                            <div class="gallery-label">${img.label || 'Sessão ' + img.sessionNumber}</div>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        window.setViewMode = function (mode) {
            currentViewMode = mode;
            const campaignSessions = currentCampaign
                ? allSessions.filter(s => s.campaignId === currentCampaign.id).sort((a, b) => new Date(b.date) - new Date(a.date))
                : [];
            document.getElementById('sessionsContent').innerHTML = renderSessionsContent(campaignSessions);
            document.querySelectorAll('.view-mode-tab').forEach(t => t.classList.remove('active'));
            document.querySelector(`.view-mode-tab:nth-child(${mode === 'list' ? 1 : mode === 'chronology' ? 2 : mode === 'timeline' ? 3 : mode === 'wiki' ? 4 : 5})`).classList.add('active');
        };

        window.switchWikiTab = function (tab, btn) {
            document.querySelectorAll('.wiki-tab').forEach(t => t.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('wikiNpcsGrid').style.display = tab === 'npcs' ? 'grid' : 'none';
            document.getElementById('wikiLocationsGrid').style.display = tab === 'locations' ? 'grid' : 'none';
        };

        window.filterSessions = function () {
            const query = document.getElementById('sessionSearchInput')?.value?.toLowerCase().trim() || '';
            const campaignSessions = currentCampaign
                ? allSessions.filter(s => s.campaignId === currentCampaign.id)
                : [];

            if (!query) {
                // No search query, show all sessions
                document.getElementById('sessionsContent').innerHTML = renderSessionsContent(
                    campaignSessions.sort((a, b) => new Date(b.date) - new Date(a.date))
                );
                return;
            }

            // Filter sessions by query
            const filteredSessions = campaignSessions.filter(s => {
                // Search in summary
                if ((s.summary || '').toLowerCase().includes(query)) return true;

                // Search in NPCs
                if ((s.importantNpcs || []).some(n =>
                    (n.name || n || '').toLowerCase().includes(query) ||
                    (n.role || '').toLowerCase().includes(query)
                )) return true;

                // Search in locations
                if ((s.locationsVisited || []).some(l =>
                    (l.name || l || '').toLowerCase().includes(query) ||
                    (l.type || '').toLowerCase().includes(query)
                )) return true;

                // Search in quests
                if ((s.quests || []).some(q =>
                    (q.name || q || '').toLowerCase().includes(query) ||
                    (q.status || '').toLowerCase().includes(query)
                )) return true;

                // Search in combats
                if ((s.combats || []).some(c =>
                    (c.enemies || '').toLowerCase().includes(query) ||
                    (c.outcome || '').toLowerCase().includes(query)
                )) return true;

                // Search in memorable moments
                if ((s.memorableMoments || []).some(m =>
                    (m.description || m || '').toLowerCase().includes(query)
                )) return true;

                // Search in session number
                if (String(s.sessionNumber || '').includes(query)) return true;

                return false;
            });

            document.getElementById('sessionsContent').innerHTML = renderSessionsContent(
                filteredSessions.sort((a, b) => new Date(b.date) - new Date(a.date))
            );
        };

        window.searchSessionsByTerm = function (term) {
            document.getElementById('sessionSearchInput').value = term;
            filterSessions();
            setViewMode('list');
        };

        window.viewFullImage = function (url) {
            window.open(url, '_blank');
        };

        window.selectCampaign = function (campaignId) {
            currentCampaign = allCampaigns.find(c => c.id === campaignId) || null;
            renderSessionLogs();
        };

        window.toggleFavoriteCampaign = async function () {
            if (!currentCampaign) return;

            try {
                if (favoriteCampaignId === currentCampaign.id) {
                    // Remove favorite
                    favoriteCampaignId = null;
                    await setDoc(doc(db, 'worldbuilding-settings', 'session-logs'), { favoriteCampaignId: null }, { merge: true });
                    showAlert('☆ Campanha removida dos favoritos', 'success');
                } else {
                    // Set as favorite
                    favoriteCampaignId = currentCampaign.id;
                    await setDoc(doc(db, 'worldbuilding-settings', 'session-logs'), { favoriteCampaignId: currentCampaign.id }, { merge: true });
                    showAlert('⭐ Campanha marcada como favorita!', 'success');
                }
                renderSessionLogs();
            } catch (e) {
                console.error('Error toggling favorite campaign:', e);
                showAlert('❌ Erro ao atualizar favorito', 'danger');
            }
        };

        window.filterSessions = function () {
            const query = document.getElementById('sessionSearchInput').value.toLowerCase().trim();
            let sessions = allSessions.filter(s => s.campaignId === currentCampaign?.id);

            if (query) {
                sessions = sessions.filter(s => {
                    const summary = (s.summary || '').toLowerCase();
                    const npcs = (s.importantNpcs || []).map(n => (n.name || n).toLowerCase()).join(' ');
                    const locations = (s.locationsVisited || []).map(l => (l.name || l).toLowerCase()).join(' ');
                    const quests = (s.quests || []).map(q => (q.name || q).toLowerCase()).join(' ');
                    return summary.includes(query) || npcs.includes(query) || locations.includes(query) || quests.includes(query);
                });
            }

            sessions.sort((a, b) => new Date(b.date) - new Date(a.date));
            document.getElementById('sessionsContent').innerHTML = renderSessionsContent(sessions);
        };

        function formatDate(dateStr) {
            if (!dateStr) return 'Data não informada';
            try {
                const date = new Date(dateStr);
                return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
            } catch {
                return dateStr;
            }
        }

        // Campaign Modal
        window.editCurrentCampaign = function () {
            if (currentCampaign) {
                openCampaignModal(currentCampaign);
            } else {
                showAlert('⚠️ Nenhuma campanha selecionada!', 'warning');
            }
        };

        window.openCampaignModal = function (campaign = null) {
            const modal = document.getElementById('entryModal');
            const title = document.getElementById('entryModalTitle');
            const body = document.getElementById('entryModalBody');
            const deleteBtn = document.getElementById('btnDeleteEntry');

            currentEditingEntry = campaign;
            title.textContent = campaign ? 'Editar Campanha' : 'Nova Campanha';
            deleteBtn.style.display = campaign ? 'block' : 'none';
            deleteBtn.onclick = () => deleteCampaign(campaign?.id);

            // Get selected character IDs from campaign (for editing)
            const selectedCharacterIds = (campaign?.personagens || []).map(p => p.id);

            body.innerHTML = `
                <div class="form-section">
                    <h3 class="form-section-title">🎲 Informações da Campanha</h3>
                    <div class="form-grid">
                        <div class="form-group">
                            <label class="form-label">Nome da Campanha *</label>
                            <input type="text" class="form-input" id="campaignNome" value="${campaign?.nome || ''}" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Sistema</label>
                            <select class="form-select" id="campaignSistema">
                                <option value="L&R" ${(campaign?.sistema || 'L&R') === 'L&R' ? 'selected' : ''}>L&R</option>
                                <option value="D&D 5e" ${(campaign?.sistema || '') === 'D&D 5e' ? 'selected' : ''}>D&D 5e</option>
                                <option value="D&D 3.5" ${(campaign?.sistema || '') === 'D&D 3.5' ? 'selected' : ''}>D&D 3.5</option>
                                <option value="Pathfinder 2e" ${(campaign?.sistema || '') === 'Pathfinder 2e' ? 'selected' : ''}>Pathfinder 2e</option>
                                <option value="Pathfinder 1e" ${(campaign?.sistema || '') === 'Pathfinder 1e' ? 'selected' : ''}>Pathfinder 1e</option>
                                <option value="Call of Cthulhu" ${(campaign?.sistema || '') === 'Call of Cthulhu' ? 'selected' : ''}>Call of Cthulhu</option>
                                <option value="Vampiro: A Máscara" ${(campaign?.sistema || '') === 'Vampiro: A Máscara' ? 'selected' : ''}>Vampiro: A Máscara</option>
                                <option value="Tormenta20" ${(campaign?.sistema || '') === 'Tormenta20' ? 'selected' : ''}>Tormenta20</option>
                                <option value="Outro" ${(campaign?.sistema || '') === 'Outro' ? 'selected' : ''}>Outro</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Mestre</label>
                            <input type="text" class="form-input" id="campaignMestre" value="${campaign?.mestre || ''}">
                        </div>
                    </div>
                </div>
                <div class="form-section">
                    <h3 class="form-section-title">👥 Personagens da Campanha</h3>
                    <p style="color: var(--lr-text-2); font-size: 0.85rem; margin-bottom: 15px;">Selecione os personagens que participam desta campanha:</p>
                    <div class="character-checkbox-grid" id="characterCheckboxGrid">
                        ${allCharacters.length ? allCharacters.map(char => `
                            <label class="character-checkbox-item ${selectedCharacterIds.includes(char.id) ? 'selected' : ''}">
                                <input type="checkbox" class="character-checkbox" 
                                       value="${char.id}" 
                                       data-nome="${char.nome || ''}"
                                       data-jogador="${char.jogador || ''}"
                                       data-owneruid="${char.ownerUid || ''}"
                                       ${selectedCharacterIds.includes(char.id) ? 'checked' : ''}
                                       onchange="this.parentElement.classList.toggle('selected', this.checked)">
                                <div class="character-checkbox-info">
                                    <span class="character-checkbox-name">${char.nome || 'Sem nome'}</span>
                                    <span class="character-checkbox-player">👤 ${char.jogador || 'Jogador desconhecido'}</span>
                                </div>
                            </label>
                        `).join('') : '<p style="color: var(--lr-text-2);">Nenhum personagem disponível.</p>'}
                    </div>
                </div>
                <div class="form-section">
                    <h3 class="form-section-title">📝 Descrição</h3>
                    <div class="form-group">
                        <textarea class="form-textarea" id="campaignDescricao" rows="4" placeholder="Descreva sua campanha...">${campaign?.descricao || ''}</textarea>
                    </div>
                </div>
            `;

            // Override save button for campaign
            document.querySelector('.modal-footer .btn-success').onclick = saveCampaign;
            modal.classList.add('active');
        };

        async function saveCampaign() {
            const nome = document.getElementById('campaignNome').value.trim();
            if (!nome) { showAlert('⚠️ O nome da campanha é obrigatório!', 'warning'); return; }

            // Collect selected characters with their data
            const personagens = Array.from(document.querySelectorAll('.character-checkbox:checked'))
                .map(cb => ({
                    id: cb.value,
                    nome: cb.dataset.nome,
                    jogador: cb.dataset.jogador,
                    ownerUid: cb.dataset.owneruid
                }));

            const data = {
                nome,
                sistema: document.getElementById('campaignSistema').value,
                mestre: document.getElementById('campaignMestre').value.trim(),
                personagens, // Store character objects instead of player names
                descricao: document.getElementById('campaignDescricao').value.trim(),
                lastUpdate: new Date().toISOString(),
                lastUpdateBy: currentUser.email
            };

            try {
                const colRef = collection(db, 'campaigns');
                const docRef = currentEditingEntry ? doc(db, 'campaigns', currentEditingEntry.id) : doc(colRef);
                await setDoc(docRef, data, { merge: true });
                showAlert(currentEditingEntry ? '✅ Campanha atualizada!' : '✅ Campanha criada!', 'success');
                closeEntryModal();
                await loadAllData();
                currentCampaign = allCampaigns.find(c => c.nome === nome) || currentCampaign;
                renderSessionLogs();
            } catch (e) {
                console.error(e);
                showAlert('❌ Erro ao salvar campanha', 'danger');
            }
        }

        async function deleteCampaign(campaignId) {
            if (!campaignId || !await confirmar('Tem certeza? Isso também excluirá todas as sessões desta campanha!', { perigo: true })) return;
            try {
                // Delete all sessions for this campaign
                const sessionsToDelete = allSessions.filter(s => s.campaignId === campaignId);
                for (const s of sessionsToDelete) {
                    await deleteDoc(doc(db, 'session-logs', s.id));
                }
                // Delete campaign
                await deleteDoc(doc(db, 'campaigns', campaignId));
                showAlert('✅ Campanha excluída!', 'success');
                closeEntryModal();
                currentCampaign = null;
                await loadAllData();
                renderSessionLogs();
            } catch (e) {
                console.error(e);
                showAlert('❌ Erro ao excluir campanha', 'danger');
            }
        }

        // Session Modal
        window.openSessionModal = function (session = null) {
            if (typeof session === 'string') {
                try { session = JSON.parse(session); } catch { session = null; }
            }

            const modal = document.getElementById('entryModal');
            const title = document.getElementById('entryModalTitle');
            const body = document.getElementById('entryModalBody');
            const deleteBtn = document.getElementById('btnDeleteEntry');

            currentSession = session;
            currentEditingEntry = session;
            title.textContent = session ? `Editando Sessão ${session.sessionNumber || ''}` : 'Nova Sessão';
            deleteBtn.style.display = session ? 'block' : 'none';
            deleteBtn.onclick = () => deleteSession(session?.id);

            // Add session-modal class for larger, more compact modal
            modal.querySelector('.modal-content').classList.add('session-modal');

            const nextSessionNumber = session?.sessionNumber || (
                allSessions.filter(s => s.campaignId === currentCampaign?.id).length + 1
            );

            // Initialize state from session data
            sessionSelectedItems = (session?.lootAndRewards?.selectedItems || []).slice();
            sessionGalleryImages = (session?.images || []).slice();

            // Get available NPCs, locations, and items
            const availableNpcs = allData.npcs || [];
            const availableLocations = allData.geography || [];

            // Get campaign personagens (characters) for player presence
            const campaignPersonagens = currentCampaign?.personagens || [];

            // Build player presence/EXP data from session or default
            const getPlayerExp = (charId) => {
                if (!session?.playersPresent) return 0;
                const player = session.playersPresent.find(p => p.characterId === charId);
                return player?.expGained || 0;
            };
            const isPlayerPresent = (charId) => {
                if (!session?.playersPresent) return true; // Default all present for new sessions
                return session.playersPresent.some(p => p.characterId === charId);
            };

            body.innerHTML = `
                <div class="form-section">
                    <h3 class="form-section-title">📋 Informações Básicas</h3>
                    <div class="form-grid">
                        <div class="form-group">
                            <label class="form-label">Número da Sessão</label>
                            <input type="number" class="form-input" id="sessionNumber" value="${nextSessionNumber}" min="1">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Data</label>
                            <input type="date" class="form-input" id="sessionDate" value="${session?.date || new Date().toISOString().split('T')[0]}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Duração</label>
                            <input type="text" class="form-input" id="sessionDuration" value="${session?.duration || ''}" placeholder="Ex: 4h30min">
                        </div>
                    </div>
                </div>
                
                <div class="game-time-section">
                    <div class="game-time-header">
                        <span>⏳</span>
                        <h3>Tempo no Jogo (Calendário do Cenário)</h3>
                    </div>
                    <div class="game-time-grid">
                        <div class="form-group">
                            <label class="form-label">Dia (1-45)</label>
                            <select class="form-select" id="gameDay">
                                <option value="">--</option>
                                ${Array.from({ length: 45 }, (_, i) => i + 1).map(d =>
                `<option value="${d}" ${session?.gameTime?.day == d ? 'selected' : ''}>${d}</option>`
            ).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Mês</label>
                            <select class="form-select" id="gameMonth">
                                <option value="">--</option>
                                <option value="Aura" ${session?.gameTime?.month === 'Aura' ? 'selected' : ''}>🌸 Aura (Primavera)</option>
                                <option value="Cresti" ${session?.gameTime?.month === 'Cresti' ? 'selected' : ''}>🌱 Cresti (Primavera)</option>
                                <option value="Lumi" ${session?.gameTime?.month === 'Lumi' ? 'selected' : ''}>☀️ Lumi (Verão)</option>
                                <option value="Fruti" ${session?.gameTime?.month === 'Fruti' ? 'selected' : ''}>🍇 Fruti (Verão)</option>
                                <option value="Declis" ${session?.gameTime?.month === 'Declis' ? 'selected' : ''}>🍂 Declis (Outono)</option>
                                <option value="Meti" ${session?.gameTime?.month === 'Meti' ? 'selected' : ''}>🌾 Meti (Outono)</option>
                                <option value="Dormi" ${session?.gameTime?.month === 'Dormi' ? 'selected' : ''}>❄️ Dormi (Inverno)</option>
                                <option value="Medi" ${session?.gameTime?.month === 'Medi' ? 'selected' : ''}>🔮 Medi (Inverno)</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Ano</label>
                            <input type="number" class="form-input" id="gameYear" value="${session?.gameTime?.year || ''}" placeholder="Ex: 10" min="1">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Era</label>
                            <select class="form-select" id="gameEra">
                                <option value="">--</option>
                                <option value="EDM" ${session?.gameTime?.era === 'EDM' ? 'selected' : ''}>EDM - Era Dourada (Maior)</option>
                                <option value="EPM" ${session?.gameTime?.era === 'EPM' ? 'selected' : ''}>EPM - Era Prateada (Maior)</option>
                                <option value="EBM" ${session?.gameTime?.era === 'EBM' ? 'selected' : ''}>EBM - Era Bronze (Maior)</option>
                                <option value="EME" ${session?.gameTime?.era === 'EME' ? 'selected' : ''}>EME - Média Era</option>
                                <option value="EBA" ${session?.gameTime?.era === 'EBA' ? 'selected' : ''}>EBA - Baixa Era</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Tempo Decorrido</label>
                            <input type="text" class="form-input" id="gameDuration" value="${session?.gameTime?.duration || ''}" placeholder="Ex: 2 dias, 4h">
                        </div>
                    </div>
                </div>
                
                <div class="collapsible-section open">
                    <div class="collapsible-header" onclick="toggleCollapsible(this)">
                        <span class="collapsible-title">👥 Presença dos Jogadores</span>
                        <span class="collapsible-toggle">▼</span>
                    </div>
                    <div class="collapsible-content">
                        <p style="color:var(--lr-text-2); font-size:0.85rem; margin-bottom:12px;">Marque os jogadores presentes e informe o EXP individual ganho:</p>
                        <div class="player-exp-grid">
                            ${campaignPersonagens.length ? campaignPersonagens.map(p => `
                                <div class="player-exp-card ${isPlayerPresent(p.id) ? 'present' : ''}" data-char-id="${p.id}">
                                    <input type="checkbox" class="player-presence-check" 
                                           data-char-id="${p.id}"
                                           data-char-nome="${p.nome || ''}"
                                           data-player-nome="${p.jogador || ''}"
                                           ${isPlayerPresent(p.id) ? 'checked' : ''}
                                           onchange="this.closest('.player-exp-card').classList.toggle('present', this.checked)">
                                    <div class="player-info">
                                        <div class="player-name">${p.nome || 'Personagem'}</div>
                                        <div class="player-character">👤 ${p.jogador || 'Jogador'}</div>
                                    </div>
                                    <div class="exp-input-group">
                                        <input type="number" class="exp-input player-exp-input" 
                                               data-char-id="${p.id}"
                                               value="${getPlayerExp(p.id)}" min="0" placeholder="0">
                                        <span class="exp-label">EXP</span>
                                    </div>
                                </div>
                            `).join('') : '<p style="color:var(--lr-text-2);">Nenhum personagem cadastrado na campanha.</p>'}
                        </div>
                    </div>
                </div>
                
                <div class="collapsible-section open">
                    <div class="collapsible-header" onclick="toggleCollapsible(this)">
                        <span class="collapsible-title">📝 Resumo da Sessão</span>
                        <span class="collapsible-toggle">▼</span>
                    </div>
                    <div class="collapsible-content">
                        <div class="summary-section">
                            <label class="form-label" style="font-size: 1rem; margin-bottom: 8px; display: block;">📖 Resumo Geral</label>
                            <textarea class="form-textarea" id="sessionSummary" rows="6" style="width: 100%;" placeholder="Descreva o que aconteceu nesta sessão...">${session?.summary || ''}</textarea>
                        </div>
                        
                        ${campaignPersonagens.length > 0 ? `
                        <div class="player-summaries-section" style="margin-top: 20px;">
                            <div class="player-summaries-header" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                                <label class="form-label" style="font-size: 1rem; margin: 0;">👥 Resumos por Jogador</label>
                                <button type="button" class="btn-add-array-item" onclick="toggleAllPlayerSummaries()" style="padding: 4px 12px; font-size: 0.8rem;">
                                    ↕️ Expandir/Recolher Todos
                                </button>
                            </div>
                            <p style="color: var(--lr-text-2); font-size: 0.85rem; margin-bottom: 12px;">Adicione resumos individuais da perspectiva de cada jogador:</p>
                            <div class="player-summaries-container" id="playerSummariesContainer">
                                ${campaignPersonagens.map(p => {
                const existingSummary = session?.playerSummaries?.find(ps => ps.characterId === p.id);
                const hasContent = existingSummary?.content ? true : false;
                return `
                                    <div class="player-summary-card ${hasContent ? 'expanded' : ''}" data-char-id="${p.id}">
                                        <div class="player-summary-header" onclick="togglePlayerSummary(this)">
                                            <div class="player-summary-info">
                                                <span class="player-summary-char-name">🎭 ${p.nome || 'Personagem'}</span>
                                                <span class="player-summary-player-name">👤 ${p.jogador || 'Jogador'}</span>
                                                ${hasContent ? '<span class="player-summary-has-content">✍️</span>' : ''}
                                            </div>
                                            <span class="player-summary-toggle">${hasContent ? '▲' : '▼'}</span>
                                        </div>
                                        <div class="player-summary-content" style="display: ${hasContent ? 'block' : 'none'};">
                                            <textarea class="form-textarea player-summary-textarea" 
                                                      data-char-id="${p.id}" 
                                                      data-char-name="${p.nome || ''}"
                                                      data-player-name="${p.jogador || ''}"
                                                      rows="4" 
                                                      placeholder="Resumo da sessão do ponto de vista de ${p.nome || 'este personagem'}...">${existingSummary?.content || ''}</textarea>
                                        </div>
                                    </div>
                                    `;
            }).join('')}
                            </div>
                        </div>
                        ` : ''}
                    </div>
                </div>
                
                <div class="collapsible-section">
                    <div class="collapsible-header" onclick="toggleCollapsible(this)">
                        <span class="collapsible-title">👤 NPCs Importantes</span>
                        <span class="collapsible-toggle">▼</span>
                    </div>
                    <div class="collapsible-content">
                        <div class="search-select-row">
                            <div class="autocomplete-container" id="npcAutocomplete">
                                <input type="text" class="autocomplete-input" id="searchNpcInput" placeholder="🔍 Buscar NPC cadastrado..." oninput="filterAutocomplete('npc')" onfocus="showAutocomplete('npc')">
                                <div class="autocomplete-dropdown" id="npcDropdown"></div>
                            </div>
                            <button type="button" class="btn-add-from-select" onclick="addSelectedNpc()">+ Adicionar</button>
                        </div>
                        <div class="array-input-container" id="npcsContainer">
                            ${(session?.importantNpcs || []).map((n, i) => {
                const isMultiDay = n.endDayOffset !== undefined && n.endDayOffset > (n.dayOffset || 0);
                const badgeText = n.startHour !== undefined
                    ? (isMultiDay
                        ? `${getGameDateLabel(n.dayOffset || 0)} ${formatTimeDisplay(n.startHour)} → ${getGameDateLabel(n.endDayOffset)} ${formatTimeDisplay(n.endHour)}`
                        : `${formatTimeDisplay(n.startHour)}-${formatTimeDisplay(n.endHour || n.startHour)}`)
                    : 'Definir';
                return `
                                <div class="array-item-row" data-npc-id="${n.id || ''}" data-event-type="npc" data-event-index="${i}">
                                    <span class="event-time-badge ${n.startHour !== undefined ? 'has-time' : ''}" onclick="openTimeEditor(this.closest('.array-item-row'))">
                                        🕐 ${badgeText}
                                    </span>
                                    <input type="hidden" class="event-day-input" value="${n.dayOffset || 0}">
                                    <input type="hidden" class="event-end-day-input" value="${n.endDayOffset ?? n.dayOffset ?? 0}">
                                    <input type="hidden" class="event-start-input" value="${n.startHour ?? ''}">
                                    <input type="hidden" class="event-end-input" value="${n.endHour ?? ''}">
                                    <input type="text" class="form-input npc-name-input" value="${n.name || n}" placeholder="Nome do NPC">
                                    <input type="text" class="form-input npc-role-input" value="${n.role || ''}" placeholder="Papel (ex: Antagonista)">
                                    <button type="button" class="btn-remove-array-item" onclick="this.closest('.array-item-row').remove()">✕</button>
                                </div>
                            `}).join('') || ''}
                        </div>
                        <button type="button" class="btn-add-array-item" onclick="addNpcRow()">+ Adicionar Manualmente</button>
                    </div>
                </div>
                
                <div class="collapsible-section">
                    <div class="collapsible-header" onclick="toggleCollapsible(this)">
                        <span class="collapsible-title">📍 Localizações Visitadas</span>
                        <span class="collapsible-toggle">▼</span>
                    </div>
                    <div class="collapsible-content">
                        <div class="search-select-row">
                            <div class="autocomplete-container" id="locationAutocomplete">
                                <input type="text" class="autocomplete-input" id="searchLocationInput" placeholder="🔍 Buscar local cadastrado..." oninput="filterAutocomplete('location')" onfocus="showAutocomplete('location')">
                                <div class="autocomplete-dropdown" id="locationDropdown"></div>
                            </div>
                            <button type="button" class="btn-add-from-select" onclick="addSelectedLocation()">+ Adicionar</button>
                        </div>
                        <div class="array-input-container" id="locationsContainer">
                            ${(session?.locationsVisited || []).map((l, i) => `
                                <div class="array-item-row" data-location-id="${l.id || ''}" data-event-type="location" data-event-index="${i}">
                                    <span class="event-time-badge ${l.startHour !== undefined ? 'has-time' : ''}" onclick="openTimeEditor(this.closest('.array-item-row'))">
                                        🕐 ${l.startHour !== undefined ? `${l.startHour}h-${l.endHour || l.startHour}h` : 'Definir'}
                                    </span>
                                    <input type="hidden" class="event-day-input" value="${l.dayOffset || 0}">
                                    <input type="hidden" class="event-end-day-input" value="${l.endDayOffset ?? l.dayOffset ?? 0}">
                                    <input type="hidden" class="event-start-input" value="${l.startHour ?? ''}">
                                    <input type="hidden" class="event-end-input" value="${l.endHour ?? ''}">
                                    <input type="text" class="form-input location-name-input" value="${l.name || l}" placeholder="Nome do local">
                                    <input type="text" class="form-input location-type-input" value="${l.type || ''}" placeholder="Tipo (ex: Cidade)">
                                    <button type="button" class="btn-remove-array-item" onclick="this.closest('.array-item-row').remove()">✕</button>
                                </div>
                            `).join('') || ''}
                        </div>
                        <button type="button" class="btn-add-array-item" onclick="addLocationRow()">+ Adicionar Manualmente</button>
                    </div>
                </div>
                
                <div class="collapsible-section">
                    <div class="collapsible-header" onclick="toggleCollapsible(this)">
                        <span class="collapsible-title">⚔️ Combates/Encontros</span>
                        <span class="collapsible-toggle">▼</span>
                    </div>
                    <div class="collapsible-content">
                        <div class="array-input-container" id="combatsContainer">
                            ${(session?.combats || []).map((c, i) => `
                                <div class="array-item-row" style="flex-wrap: wrap;" data-event-type="combat" data-event-index="${i}">
                                    <span class="event-time-badge ${c.startHour !== undefined ? 'has-time' : ''}" onclick="openTimeEditor(this.closest('.array-item-row'))">
                                        🕐 ${c.startHour !== undefined ? `${c.startHour}h-${c.endHour || c.startHour}h` : 'Definir'}
                                    </span>
                                    <input type="hidden" class="event-day-input" value="${c.dayOffset || 0}">
                                    <input type="hidden" class="event-end-day-input" value="${c.endDayOffset ?? c.dayOffset ?? 0}">
                                    <input type="hidden" class="event-start-input" value="${c.startHour ?? ''}">
                                    <input type="hidden" class="event-end-input" value="${c.endHour ?? ''}">
                                    <input type="text" class="form-input combat-enemies-input" value="${c.enemies || ''}" placeholder="Inimigos">
                                    <input type="text" class="form-input combat-outcome-input" value="${c.outcome || ''}" placeholder="Resultado">
                                    <button type="button" class="btn-remove-array-item" onclick="this.closest('.array-item-row').remove()">✕</button>
                                </div>
                            `).join('') || ''}
                        </div>
                        <button type="button" class="btn-add-array-item" onclick="addCombatRow()">+ Adicionar Combate</button>
                    </div>
                </div>
                
                <div class="collapsible-section">
                    <div class="collapsible-header" onclick="toggleCollapsible(this)">
                        <span class="collapsible-title">🎁 Itens/Recompensas</span>
                        <span class="collapsible-toggle">▼</span>
                    </div>
                    <div class="collapsible-content">
                        <div class="search-select-row">
                            <div class="autocomplete-container" id="itemAutocomplete">
                                <input type="text" class="autocomplete-input" id="searchItemInput" placeholder="🔍 Buscar item cadastrado..." oninput="filterAutocomplete('item')" onfocus="showAutocomplete('item')">
                                <div class="autocomplete-dropdown" id="itemDropdown"></div>
                            </div>
                            <button type="button" class="btn-add-from-select" onclick="addSelectedItem()">+ Adicionar</button>
                        </div>
                        <div class="session-item-list" id="sessionItemsList">
                            ${sessionSelectedItems.map((item, idx) => `
                                <span class="session-item-tag">
                                    📦 ${item.name}
                                    <button class="remove-tag" onclick="removeSessionItem(${idx})">✕</button>
                                </span>
                            `).join('')}
                        </div>
                        <div class="form-group">
                            <label class="form-label">Itens Obtidos (manual)</label>
                            <textarea class="form-textarea" id="lootItems" rows="3" placeholder="Liste os itens obtidos, um por linha...">${(session?.lootAndRewards?.items || []).filter(i => !i.id).map(i => i.name || i).join('\n')}</textarea>
                        </div>
                    </div>
                </div>
                
                <div class="collapsible-section">
                    <div class="collapsible-header" onclick="toggleCollapsible(this)">
                        <span class="collapsible-title">📜 Quests</span>
                        <span class="collapsible-toggle">▼</span>
                    </div>
                    <div class="collapsible-content">
                        <div class="array-input-container" id="questsContainer">
                            ${(session?.quests || []).map((q, i) => `
                                <div class="array-item-row" style="flex-wrap: wrap;" data-event-type="quest" data-event-index="${i}">
                                    <span class="event-time-badge ${q.startHour !== undefined ? 'has-time' : ''}" onclick="openTimeEditor(this.closest('.array-item-row'))">
                                        🕐 ${q.startHour !== undefined ? `${q.startHour}h-${q.endHour || q.startHour}h` : 'Definir'}
                                    </span>
                                    <input type="hidden" class="event-day-input" value="${q.dayOffset || 0}">
                                    <input type="hidden" class="event-end-day-input" value="${q.endDayOffset ?? q.dayOffset ?? 0}">
                                    <input type="hidden" class="event-start-input" value="${q.startHour ?? ''}">
                                    <input type="hidden" class="event-end-input" value="${q.endHour ?? ''}">
                                    <input type="text" class="form-input quest-name-input" value="${q.name || q}" placeholder="Nome da quest" style="flex: 2;">
                                    <select class="form-select quest-status-input" style="flex: 1;">
                                        <option value="Iniciada" ${q.status === 'Iniciada' ? 'selected' : ''}>Iniciada</option>
                                        <option value="Em Progresso" ${q.status === 'Em Progresso' ? 'selected' : ''}>Em Progresso</option>
                                        <option value="Completada" ${q.status === 'Completada' ? 'selected' : ''}>Completada</option>
                                        <option value="Fracassada" ${q.status === 'Fracassada' ? 'selected' : ''}>Fracassada</option>
                                    </select>
                                    <button type="button" class="btn-remove-array-item" onclick="this.closest('.array-item-row').remove()">✕</button>
                                </div>
                            `).join('') || ''}
                        </div>
                        <button type="button" class="btn-add-array-item" onclick="addQuestRow()">+ Adicionar Quest</button>
                    </div>
                </div>
                
                <div class="collapsible-section">
                    <div class="collapsible-header" onclick="toggleCollapsible(this)">
                        <span class="collapsible-title">⭐ Momentos Marcantes</span>
                        <span class="collapsible-toggle">▼</span>
                    </div>
                    <div class="collapsible-content">
                        <div class="array-input-container" id="momentsContainer">
                            ${(session?.memorableMoments || []).map((m, i) => `
                                <div class="array-item-row" style="flex-wrap: wrap;" data-event-type="moment" data-event-index="${i}">
                                    <span class="event-time-badge ${m.startHour !== undefined ? 'has-time' : ''}" onclick="openTimeEditor(this.closest('.array-item-row'))">
                                        🕐 ${m.startHour !== undefined ? `${m.startHour}h-${m.endHour || m.startHour}h` : 'Definir'}
                                    </span>
                                    <input type="hidden" class="event-day-input" value="${m.dayOffset || 0}">
                                    <input type="hidden" class="event-end-day-input" value="${m.endDayOffset ?? m.dayOffset ?? 0}">
                                    <input type="hidden" class="event-start-input" value="${m.startHour ?? ''}">
                                    <input type="hidden" class="event-end-input" value="${m.endHour ?? ''}">
                                    <select class="form-select moment-type-input" style="flex: 0 0 120px;">
                                        <option value="funny" ${m.type === 'funny' ? 'selected' : ''}>😂 Engraçado</option>
                                        <option value="epic" ${m.type === 'epic' ? 'selected' : ''}>⚡ Épico</option>
                                        <option value="dramatic" ${m.type === 'dramatic' ? 'selected' : ''}>🎭 Dramático</option>
                                    </select>
                                    <input type="text" class="form-input moment-desc-input" value="${m.description || m}" placeholder="Descrição do momento" style="flex: 2;">
                                    <button type="button" class="btn-remove-array-item" onclick="this.closest('.array-item-row').remove()">✕</button>
                                </div>
                            `).join('') || ''}
                        </div>
                        <button type="button" class="btn-add-array-item" onclick="addMomentRow()">+ Adicionar Momento</button>
                    </div>
                </div>
                
                <div class="collapsible-section">
                    <div class="collapsible-header" onclick="toggleCollapsible(this)">
                        <span class="collapsible-title">🖼️ Galeria de Imagens</span>
                        <span class="collapsible-toggle">▼</span>
                    </div>
                    <div class="collapsible-content">
                        <div class="session-gallery-container">
                            <div class="session-gallery-input-row">
                                ${CampoImagem.html({ id: 'galleryImageUrl', classe: 'form-input', pasta: 'worldbuilding-images/sessoes', preview: false, placeholder: 'URL da imagem ou envie um arquivo' })}
                                <input type="text" class="form-input" id="galleryImageLabel" placeholder="Legenda (opcional)" style="max-width: 200px;">
                                <button type="button" class="btn-add-from-select" onclick="addSessionImage()">+ Adicionar</button>
                            </div>
                            <div class="session-gallery-grid" id="sessionGalleryGrid">
                                ${sessionGalleryImages.map((img, idx) => `
                                    <div class="session-gallery-item">
                                        <img src="${img.url}" alt="${img.label || 'Imagem'}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22><rect fill=%22%23333%22 width=%22100%22 height=%22100%22/><text x=%2250%25%22 y=%2250%25%22 fill=%22%23999%22 text-anchor=%22middle%22 dy=%22.3em%22>Erro</text></svg>'">
                                        ${img.label ? `<div class="gallery-label">${img.label}</div>` : ''}
                                        <button class="remove-gallery-item" onclick="removeSessionImage(${idx})">✕</button>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="collapsible-section">
                    <div class="collapsible-header" onclick="toggleCollapsible(this)">
                        <span class="collapsible-title">🔮 Ganchos para Próxima Sessão</span>
                        <span class="collapsible-toggle">▼</span>
                    </div>
                    <div class="collapsible-content">
                        <textarea class="form-textarea" id="nextSessionHooks" rows="6" style="width: 100%;" placeholder="Liste os ganchos para a próxima sessão, um por linha...">${(session?.nextSessionHooks || []).join('\n')}</textarea>
                    </div>
                </div>
                
                <div class="collapsible-section">
                    <div class="collapsible-header" onclick="toggleCollapsible(this)">
                        <span class="collapsible-title">🔒 Notas do Mestre (Privadas)</span>
                        <span class="collapsible-toggle">▼</span>
                    </div>
                    <div class="collapsible-content">
                        <textarea class="form-textarea" id="dmNotes" rows="6" style="width: 100%;" placeholder="Notas secretas apenas para o mestre...">${session?.dmNotes?.content || ''}</textarea>
                    </div>
                </div>
                
                <div class="collapsible-section" id="timelineSection">
                    <div class="collapsible-header" onclick="toggleTimelineSection(this)">
                        <span class="collapsible-title">📊 Linha do Tempo Visual</span>
                        <span class="collapsible-toggle">▼</span>
                    </div>
                    <div class="collapsible-content">
                        <p style="color:var(--lr-text-2); font-size:0.85rem; margin-bottom:12px;">Visualização cronológica dos eventos. Clique em "🕐 Definir" nos eventos acima para configurar horários.</p>
                        <div style="display: flex; gap: 10px; margin-bottom: 15px; flex-wrap: wrap;">
                            <button type="button" class="btn-add-array-item" onclick="renderVisualTimeline()">🔄 Atualizar Timeline</button>
                            <button type="button" class="btn-add-array-item" onclick="showEventPicker()" style="background: linear-gradient(135deg, var(--lr-nature), var(--lr-nature));">📌 Inserir Evento</button>
                        </div>
                        <div id="eventPickerDropdown" class="event-picker-dropdown" style="display: none;">
                            <div class="event-picker-title">📋 Selecione um evento para definir horário:</div>
                            <div id="eventPickerList" class="event-picker-list"></div>
                            <button type="button" class="btn-time-cancel" onclick="hideEventPicker()" style="margin-top: 10px; width: 100%;">Cancelar</button>
                        </div>
                        <div id="visualTimelineWrapper" class="visual-timeline-wrapper">
                            <div class="visual-timeline-header">
                                <span class="visual-timeline-title">📊 Cronologia da Sessão</span>
                                <div class="day-navigation">
                                    <button class="day-nav-btn" onclick="changeTimelineDay(-1)" id="prevDayBtn">◀</button>
                                    <span class="current-day-label" id="currentDayLabel">Dia 1</span>
                                    <button class="day-nav-btn" onclick="changeTimelineDay(1)" id="nextDayBtn">▶</button>
                                </div>
                            </div>
                            <div class="time-scale" id="timeScale">
                                ${Array.from({ length: 24 }, (_, h) => `<div class="time-scale-hour">${h}h</div>`).join('')}
                            </div>
                            <div class="period-backgrounds">
                                <div class="period-bg madrugada">🌙 Madrugada</div>
                                <div class="period-bg manha">🌅 Manhã</div>
                                <div class="period-bg tarde">☀️ Tarde</div>
                                <div class="period-bg noite">🌃 Noite</div>
                            </div>
                            <div class="event-tracks" id="eventTracks">
                                <div class="timeline-empty">Adicione horários aos eventos e clique em "Atualizar" para visualizar.</div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Time Editor Overlay -->
                <div class="time-editor-overlay" id="timeEditorOverlay" onclick="if(event.target===this) closeTimeEditor()">
                    <div class="time-editor-modal">
                        <div class="time-editor-title">🕐 Definir Horário do Evento</div>
                        <input type="hidden" id="editingEventRow">
                        
                        <div class="time-editor-group">
                            <label class="time-editor-label">Dia de Início</label>
                            <select class="form-select" id="eventDaySelect" onchange="updateTimePreview()">
                                <!-- Populated dynamically by updateDaySelector() -->
                            </select>
                        </div>
                        
                        <div class="time-editor-group">
                            <label class="time-editor-label">Dia de Término</label>
                            <select class="form-select" id="eventEndDaySelect" onchange="updateTimePreview()">
                                <!-- Populated dynamically by updateDaySelector() -->
                            </select>
                            <small style="color: var(--lr-text-2); font-size: 0.75rem; margin-top: 4px; display: block;">Para eventos de um único dia, deixe igual ao dia de início</small>
                        </div>
                        
                        <div class="time-editor-group">
                            <label class="time-editor-label">Horário</label>
                            <div class="time-range-container">
                                <div class="time-input-group">
                                    <label>Início</label>
                                    <input type="time" class="time-input" id="startHourInput" value="08:00" onchange="updateTimePreview()">
                                </div>
                                <span class="time-range-arrow">→</span>
                                <div class="time-input-group">
                                    <label>Fim</label>
                                    <input type="time" class="time-input" id="endHourInput" value="12:00" onchange="updateTimePreview()">
                                </div>
                            </div>
                        </div>
                        
                        <div class="time-preview-bar">
                            <div class="time-preview-period madrugada">0-5h</div>
                            <div class="time-preview-period manha">6-11h</div>
                            <div class="time-preview-period tarde">12-17h</div>
                            <div class="time-preview-period noite">18-23h</div>
                            <div class="time-preview-selection" id="timePreviewSelection"></div>
                        </div>
                        
                        <div class="time-duration-display" id="timeDurationDisplay">Duração: 4 horas</div>
                        
                        <div class="time-editor-actions">
                            <button class="btn-time-cancel" onclick="closeTimeEditor()">Cancelar</button>
                            <button class="btn-time-save" onclick="saveEventTime()">✓ Salvar Horário</button>
                        </div>
                    </div>
                </div>
                
                <div style="margin-top: 20px; display: flex; gap: 10px;">
                    <button class="btn-export" onclick="exportCurrentSession()">📤 Exportar JSON</button>
                </div>
            `;

            // Override save button for session
            document.querySelector('.modal-footer .btn-success').onclick = saveSession;
            modal.classList.add('active');

            // Reorder sections: move timeline before NPCs
            setTimeout(reorderSessionSections, 50);
        };

        window.toggleCollapsible = function (header) {
            header.closest('.collapsible-section').classList.toggle('open');
        };

        // Toggle individual player summary card
        window.togglePlayerSummary = function (header) {
            const card = header.closest('.player-summary-card');
            const content = card.querySelector('.player-summary-content');
            const toggle = card.querySelector('.player-summary-toggle');

            if (content.style.display === 'none') {
                content.style.display = 'block';
                toggle.textContent = '▲';
                card.classList.add('expanded');
            } else {
                content.style.display = 'none';
                toggle.textContent = '▼';
                card.classList.remove('expanded');
            }
        };

        // Toggle all player summaries at once
        window.toggleAllPlayerSummaries = function () {
            const cards = document.querySelectorAll('.player-summary-card');
            const anyExpanded = Array.from(cards).some(card =>
                card.querySelector('.player-summary-content')?.style.display !== 'none'
            );

            cards.forEach(card => {
                const content = card.querySelector('.player-summary-content');
                const toggle = card.querySelector('.player-summary-toggle');

                if (anyExpanded) {
                    // Collapse all
                    content.style.display = 'none';
                    toggle.textContent = '▼';
                    card.classList.remove('expanded');
                } else {
                    // Expand all
                    content.style.display = 'block';
                    toggle.textContent = '▲';
                    card.classList.add('expanded');
                }
            });
        };

        // Row adders for session modal
        window.addNpcRow = function () {
            const container = document.getElementById('npcsContainer');
            container.insertAdjacentHTML('beforeend', `
                <div class="array-item-row" data-event-type="npc">
                    <span class="event-time-badge" onclick="openTimeEditor(this.closest('.array-item-row'))">🕐 Definir</span>
                    <input type="hidden" class="event-day-input" value="0">
                    <input type="hidden" class="event-start-input" value="">
                    <input type="hidden" class="event-end-input" value="">
                    <input type="text" class="form-input npc-name-input" placeholder="Nome do NPC">
                    <input type="text" class="form-input npc-role-input" placeholder="Papel (ex: Antagonista)">
                    <button type="button" class="btn-remove-array-item" onclick="this.closest('.array-item-row').remove()">✕</button>
                </div>
            `);
        };

        window.addLocationRow = function () {
            const container = document.getElementById('locationsContainer');
            container.insertAdjacentHTML('beforeend', `
                <div class="array-item-row" data-event-type="location">
                    <span class="event-time-badge" onclick="openTimeEditor(this.closest('.array-item-row'))">🕐 Definir</span>
                    <input type="hidden" class="event-day-input" value="0">
                    <input type="hidden" class="event-start-input" value="">
                    <input type="hidden" class="event-end-input" value="">
                    <input type="text" class="form-input location-name-input" placeholder="Nome do local">
                    <input type="text" class="form-input location-type-input" placeholder="Tipo (ex: Cidade)">
                    <button type="button" class="btn-remove-array-item" onclick="this.closest('.array-item-row').remove()">✕</button>
                </div>
            `);
        };

        window.addCombatRow = function () {
            const container = document.getElementById('combatsContainer');
            container.insertAdjacentHTML('beforeend', `
                <div class="array-item-row" style="flex-wrap: wrap;" data-event-type="combat">
                    <span class="event-time-badge" onclick="openTimeEditor(this.closest('.array-item-row'))">🕐 Definir</span>
                    <input type="hidden" class="event-day-input" value="0">
                    <input type="hidden" class="event-start-input" value="">
                    <input type="hidden" class="event-end-input" value="">
                    <input type="text" class="form-input combat-enemies-input" placeholder="Inimigos">
                    <input type="text" class="form-input combat-outcome-input" placeholder="Resultado">
                    <button type="button" class="btn-remove-array-item" onclick="this.closest('.array-item-row').remove()">✕</button>
                </div>
            `);
        };

        window.addQuestRow = function () {
            const container = document.getElementById('questsContainer');
            container.insertAdjacentHTML('beforeend', `
                <div class="array-item-row" style="flex-wrap: wrap;" data-event-type="quest">
                    <span class="event-time-badge" onclick="openTimeEditor(this.closest('.array-item-row'))">🕐 Definir</span>
                    <input type="hidden" class="event-day-input" value="0">
                    <input type="hidden" class="event-start-input" value="">
                    <input type="hidden" class="event-end-input" value="">
                    <input type="text" class="form-input quest-name-input" placeholder="Nome da quest" style="flex: 2;">
                    <select class="form-select quest-status-input" style="flex: 1;">
                        <option value="Iniciada">Iniciada</option>
                        <option value="Em Progresso">Em Progresso</option>
                        <option value="Completada">Completada</option>
                        <option value="Fracassada">Fracassada</option>
                    </select>
                    <button type="button" class="btn-remove-array-item" onclick="this.closest('.array-item-row').remove()">✕</button>
                </div>
            `);
        };

        window.addMomentRow = function () {
            const container = document.getElementById('momentsContainer');
            container.insertAdjacentHTML('beforeend', `
                <div class="array-item-row" style="flex-wrap: wrap;" data-event-type="moment">
                    <span class="event-time-badge" onclick="openTimeEditor(this.closest('.array-item-row'))">🕐 Definir</span>
                    <input type="hidden" class="event-day-input" value="0">
                    <input type="hidden" class="event-start-input" value="">
                    <input type="hidden" class="event-end-input" value="">
                    <select class="form-select moment-type-input" style="flex: 0 0 120px;">
                        <option value="funny">😂 Engraçado</option>
                        <option value="epic">⚡ Épico</option>
                        <option value="dramatic">🎭 Dramático</option>
                    </select>
                    <input type="text" class="form-input moment-desc-input" placeholder="Descrição do momento" style="flex: 2;">
                    <button type="button" class="btn-remove-array-item" onclick="this.closest('.array-item-row').remove()">✕</button>
                </div>
            `);
        };

        // ========== ADVANCED TIMELINE SYSTEM ==========

        let currentEditingRow = null;
        let currentTimelineDay = 0;
        let lastEventTime = { day: 0, start: '08:00', end: '12:00' }; // Remember last set time as HH:MM

        // Helper: Convert HH:MM to decimal hours (e.g., "11:30" -> 11.5)
        function timeToDecimal(timeStr) {
            if (!timeStr || timeStr === '') return null;
            const [h, m] = timeStr.split(':').map(Number);
            return h + (m || 0) / 60;
        }

        // Helper: Convert decimal hours to HH:MM (e.g., 11.5 -> "11:30")
        function decimalToTime(decimal) {
            if (decimal === null || decimal === undefined) return '';
            const h = Math.floor(decimal);
            const m = Math.round((decimal - h) * 60);
            return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        }

        // Helper: Format time for display (e.g., 11.5 -> "11:30")
        function formatTimeDisplay(decimal) {
            if (decimal === null || decimal === undefined) return '';
            const h = Math.floor(decimal);
            const m = Math.round((decimal - h) * 60);
            return m > 0 ? `${h}:${m.toString().padStart(2, '0')}` : `${h}h`;
        }

        // Update day selector with in-game dates
        function updateDaySelector() {
            const select = document.getElementById('eventDaySelect');
            const endSelect = document.getElementById('eventEndDaySelect');
            if (!select) return;

            const baseDay = parseInt(document.getElementById('gameDay')?.value) || 1;
            const month = document.getElementById('gameMonth')?.value || '';
            const year = document.getElementById('gameYear')?.value || '';
            const era = document.getElementById('gameEra')?.value || '';

            let options = '';
            for (let i = 0; i < 15; i++) {
                const actualDay = Math.min(45, baseDay + i);
                let label = '';
                if (month || year || era) {
                    label = `${actualDay}-${month || '?'}${year ? '-' + year : ''}${era ? '-' + era : ''}`;
                } else {
                    label = `Dia ${i + 1}`;
                }
                options += `<option value="${i}">${label}</option>`;
            }
            select.innerHTML = options;
            if (endSelect) endSelect.innerHTML = options;
        }

        // Open time editor for an event row
        window.openTimeEditor = function (row) {
            currentEditingRow = row;
            updateDaySelector();

            const dayInput = row.querySelector('.event-day-input');
            const endDayInput = row.querySelector('.event-end-day-input');
            const startInput = row.querySelector('.event-start-input');
            const endInput = row.querySelector('.event-end-input');

            // Use existing values or last event time as default
            const hasExistingTime = startInput?.value !== '';
            const startDay = dayInput?.value || (hasExistingTime ? '0' : lastEventTime.day);
            const endDay = endDayInput?.value || startDay;

            document.getElementById('eventDaySelect').value = startDay;
            document.getElementById('eventEndDaySelect').value = endDay;

            // Convert stored decimal to HH:MM for time inputs
            const startVal = hasExistingTime ? decimalToTime(parseFloat(startInput?.value)) : lastEventTime.start;
            const endVal = hasExistingTime ? decimalToTime(parseFloat(endInput?.value || startInput?.value)) : lastEventTime.end;
            document.getElementById('startHourInput').value = startVal || '08:00';
            document.getElementById('endHourInput').value = endVal || '12:00';

            updateTimePreview();
            document.getElementById('timeEditorOverlay').classList.add('active');
        };

        // Close time editor
        window.closeTimeEditor = function () {
            document.getElementById('timeEditorOverlay').classList.remove('active');
            currentEditingRow = null;
        };

        // Update time preview bar
        window.updateTimePreview = function () {
            const startDay = parseInt(document.getElementById('eventDaySelect').value) || 0;
            const endDay = parseInt(document.getElementById('eventEndDaySelect')?.value) || startDay;
            const startStr = document.getElementById('startHourInput').value || '08:00';
            const endStr = document.getElementById('endHourInput').value || '12:00';

            let start = timeToDecimal(startStr) || 0;
            let end = timeToDecimal(endStr) || start;

            // For same day events, end must be after start
            if (endDay === startDay && end < start) end = start;

            const leftPercent = (start / 24) * 100;

            // Calculate total duration including multiple days
            const daysDiff = endDay - startDay;
            let totalHours;
            if (daysDiff === 0) {
                totalHours = end - start || 0.25;
            } else {
                // Hours until midnight on start day + full days in between + hours on end day
                totalHours = (24 - start) + (daysDiff - 1) * 24 + end;
            }

            // For preview, only show the portion for the current day (start day)
            const widthPercent = daysDiff === 0
                ? Math.max(1, ((end - start) / 24) * 100)
                : Math.max(1, ((24 - start) / 24) * 100);

            const selection = document.getElementById('timePreviewSelection');
            selection.style.left = leftPercent + '%';
            selection.style.width = widthPercent + '%';

            // Format duration display
            const totalMins = Math.round(totalHours * 60);
            let durationStr;
            if (totalHours >= 24) {
                const days = Math.floor(totalHours / 24);
                const remainingHours = Math.floor(totalHours % 24);
                const remainingMins = totalMins % 60;
                durationStr = `${days}d ${remainingHours}h${remainingMins > 0 ? remainingMins + 'min' : ''}`;
            } else {
                const durationHours = Math.floor(totalHours);
                const durationRemMins = totalMins % 60;
                durationStr = durationRemMins > 0 ? `${durationHours}h${durationRemMins}min` : `${durationHours}h`;
            }

            const dayLabel = daysDiff > 0 ? ` (${daysDiff + 1} dias)` : '';
            document.getElementById('timeDurationDisplay').textContent =
                `Duração: ${durationStr}${dayLabel} (${startStr} → ${endStr})`;
        };

        // Save event time
        window.saveEventTime = function () {
            if (!currentEditingRow) return;

            const startDay = parseInt(document.getElementById('eventDaySelect').value) || 0;
            const endDay = parseInt(document.getElementById('eventEndDaySelect')?.value) || startDay;
            const startStr = document.getElementById('startHourInput').value || '08:00';
            const endStr = document.getElementById('endHourInput').value || '12:00';

            let start = timeToDecimal(startStr) || 0;
            let end = timeToDecimal(endStr) || start;

            // For same day events, ensure minimum duration
            if (endDay === startDay && end <= start) {
                end = start + 0.25;
            }

            // Update hidden inputs (store as decimal)
            const dayInput = currentEditingRow.querySelector('.event-day-input');
            let endDayInput = currentEditingRow.querySelector('.event-end-day-input');
            const startInput = currentEditingRow.querySelector('.event-start-input');
            const endInput = currentEditingRow.querySelector('.event-end-input');

            // Create end day input if it doesn't exist
            if (!endDayInput) {
                endDayInput = document.createElement('input');
                endDayInput.type = 'hidden';
                endDayInput.className = 'event-end-day-input';
                currentEditingRow.appendChild(endDayInput);
            }

            if (dayInput) dayInput.value = startDay;
            if (endDayInput) endDayInput.value = endDay;
            if (startInput) startInput.value = start;
            if (endInput) endInput.value = end;

            // Update badge with in-game date and time with minutes
            const badge = currentEditingRow.querySelector('.event-time-badge');
            if (badge) {
                badge.classList.add('has-time');
                const startDateLabel = getGameDateLabel(startDay);
                const endDateLabel = getGameDateLabel(endDay);
                if (endDay > startDay) {
                    badge.innerHTML = `🕐 ${startDateLabel} ${formatTimeDisplay(start)} → ${endDateLabel} ${formatTimeDisplay(end)}`;
                } else {
                    badge.innerHTML = `🕐 ${startDateLabel} ${formatTimeDisplay(start)}-${formatTimeDisplay(end)}`;
                }
            }

            // Remember this time for next event (as HH:MM strings)
            lastEventTime = { day: startDay, start: startStr, end: endStr };

            closeTimeEditor();
        };

        // Get in-game date label for timeline
        function getGameDateLabel(dayOffset) {
            const baseDay = parseInt(document.getElementById('gameDay')?.value) || 1;
            const month = document.getElementById('gameMonth')?.value || '';
            const year = document.getElementById('gameYear')?.value || '';
            const era = document.getElementById('gameEra')?.value || '';

            const actualDay = Math.min(45, baseDay + dayOffset);
            if (month || year || era) {
                return `${actualDay}-${month || '?'}${year ? '-' + year : ''}${era ? '-' + era : ''}`;
            }
            return `Dia ${dayOffset + 1} (${actualDay})`;
        }

        // Toggle timeline section with auto-update
        window.toggleTimelineSection = function (header) {
            toggleCollapsible(header);
            // Auto-render timeline when expanding (check 'open' class on parent section)
            const section = header.closest('.collapsible-section');
            if (section && section.classList.contains('open')) {
                setTimeout(() => renderVisualTimeline(), 100);
            }
        };

        // Reorder session modal sections: move timeline before NPCs
        function reorderSessionSections() {
            const timelineSection = document.getElementById('timelineSection');
            const npcsSection = document.getElementById('npcsContainer')?.closest('.collapsible-section');
            if (timelineSection && npcsSection && timelineSection.parentNode === npcsSection.parentNode) {
                npcsSection.parentNode.insertBefore(timelineSection, npcsSection);
            }
        }

        // Call reorder when page loads (modal is already in DOM)
        setTimeout(reorderSessionSections, 100);

        // Change timeline day
        window.changeTimelineDay = function (delta) {
            currentTimelineDay = Math.max(0, currentTimelineDay + delta);
            document.getElementById('currentDayLabel').textContent = getGameDateLabel(currentTimelineDay);
            renderVisualTimeline();
        };

        // Render visual timeline
        window.renderVisualTimeline = function () {
            const tracksContainer = document.getElementById('eventTracks');
            if (!tracksContainer) return;

            // Collect all events with time data
            const allEvents = [];
            const eventTypes = [
                { container: 'npcsContainer', type: 'npc', icon: '👤', nameClass: 'npc-name-input' },
                { container: 'locationsContainer', type: 'location', icon: '📍', nameClass: 'location-name-input' },
                { container: 'combatsContainer', type: 'combat', icon: '⚔️', nameClass: 'combat-enemies-input' },
                { container: 'questsContainer', type: 'quest', icon: '📜', nameClass: 'quest-name-input' },
                { container: 'momentsContainer', type: 'moment', icon: '⭐', nameClass: 'moment-desc-input' }
            ];

            eventTypes.forEach(({ container, type, icon, nameClass }) => {
                document.querySelectorAll(`#${container} .array-item-row`).forEach(row => {
                    const name = row.querySelector(`.${nameClass}`)?.value?.trim();
                    const dayOffset = parseInt(row.querySelector('.event-day-input')?.value) || 0;
                    const endDayOffset = parseInt(row.querySelector('.event-end-day-input')?.value) || dayOffset;
                    const startHour = row.querySelector('.event-start-input')?.value;
                    const endHour = row.querySelector('.event-end-input')?.value;

                    if (name && startHour !== '') {
                        allEvents.push({
                            type,
                            icon,
                            name,
                            dayOffset,
                            endDayOffset,
                            startHour: parseFloat(startHour),
                            endHour: parseFloat(endHour) || parseFloat(startHour) + 0.25,
                            row
                        });
                    }
                });
            });

            // Filter events that are visible on the current day (including multi-day events)
            const dayEvents = allEvents.filter(e =>
                currentTimelineDay >= e.dayOffset && currentTimelineDay <= e.endDayOffset
            );

            // Update day navigation - always allow navigation, just track max day
            const maxDay = Math.max(0, ...allEvents.map(e => e.endDayOffset), ...allEvents.map(e => e.dayOffset));
            document.getElementById('prevDayBtn').disabled = false;
            document.getElementById('nextDayBtn').disabled = false;
            document.getElementById('currentDayLabel').textContent = getGameDateLabel(currentTimelineDay);

            if (dayEvents.length === 0) {
                tracksContainer.innerHTML = '<div class="timeline-empty">Nenhum evento com horário definido para este dia.</div>';
                return;
            }

            // Sort by start time (for current day's portion)
            dayEvents.sort((a, b) => {
                // If event started before today, it starts at 0h
                const aStart = a.dayOffset < currentTimelineDay ? 0 : a.startHour;
                const bStart = b.dayOffset < currentTimelineDay ? 0 : b.startHour;
                return aStart - bStart;
            });

            // Build tracks HTML with interactive features
            let html = '';
            dayEvents.forEach((event, idx) => {
                // Calculate what portion of this event is visible today
                const isStartDay = event.dayOffset === currentTimelineDay;
                const isEndDay = event.endDayOffset === currentTimelineDay;
                const isMiddleDay = !isStartDay && !isEndDay;

                let displayStartHour, displayEndHour;

                if (isMiddleDay) {
                    // Full day - event spans entire day
                    displayStartHour = 0;
                    displayEndHour = 24;
                } else if (isStartDay && isEndDay) {
                    // Single day event
                    displayStartHour = event.startHour;
                    displayEndHour = event.endHour;
                } else if (isStartDay) {
                    // First day of multi-day event
                    displayStartHour = event.startHour;
                    displayEndHour = 24;
                } else {
                    // Last day of multi-day event
                    displayStartHour = 0;
                    displayEndHour = event.endHour;
                }

                const duration = displayEndHour - displayStartHour || 0.25;
                const leftPercent = (displayStartHour / 24) * 100;
                const widthPercent = Math.max(1, (duration / 24) * 100);

                const startDisplay = formatTimeDisplay(displayStartHour);
                const endDisplay = formatTimeDisplay(displayEndHour);
                const durationMins = Math.round(duration * 60);
                const durationDisplay = durationMins >= 60 ? `${Math.floor(durationMins / 60)}h${durationMins % 60 > 0 ? durationMins % 60 + 'min' : ''}` : `${durationMins}min`;

                // Add visual indicator for multi-day events
                let multiDayIndicator = '';
                if (event.endDayOffset > event.dayOffset) {
                    if (isStartDay) {
                        multiDayIndicator = ' ➡️';
                    } else if (isEndDay) {
                        multiDayIndicator = '⬅️ ';
                    } else {
                        multiDayIndicator = '↔️ ';
                    }
                }

                const tooltipText = event.endDayOffset > event.dayOffset
                    ? `${event.name}<br>${getGameDateLabel(event.dayOffset)} ${formatTimeDisplay(event.startHour)} → ${getGameDateLabel(event.endDayOffset)} ${formatTimeDisplay(event.endHour)}`
                    : `${event.name}<br>${startDisplay} → ${endDisplay} (${durationDisplay})`;

                html += `
                    <div class="event-track" data-event-idx="${idx}">
                        <div class="event-bar ${event.type} ${isMiddleDay ? 'middle-day' : ''} ${!isStartDay ? 'continues-from-prev' : ''} ${!isEndDay ? 'continues-to-next' : ''}" 
                             style="left: ${leftPercent}%; width: ${widthPercent}%;" 
                             title="${event.name} (${startDisplay}-${endDisplay})"
                             onmousedown="startDrag(event)"
                             onclick="handleEventClick(event, this)"
                             data-container="${eventTypes.find(t => t.type === event.type)?.container}"
                             data-row-idx="${Array.from(document.querySelectorAll('#' + eventTypes.find(t => t.type === event.type)?.container + ' .array-item-row')).indexOf(event.row)}">
                            <div class="resize-handle left" onmousedown="startResize(event, this, 'left')"></div>
                            <span class="event-bar-icon">${!isStartDay ? '◀' : event.icon}</span>
                            <span class="event-bar-name">${multiDayIndicator}${event.name}</span>
                            <span class="event-bar-time">${startDisplay}-${endDisplay}${!isEndDay ? ' ▶' : ''}</span>
                            <div class="resize-handle right" onmousedown="startResize(event, this, 'right')"></div>
                            <div class="event-bar-tooltip">${tooltipText}</div>
                        </div>
                    </div>
                `;
            });

            tracksContainer.innerHTML = html;
        };

        // Scroll to event row in form
        window.scrollToEventRow = function (bar) {
            const containerId = bar.dataset.container;
            const rowIdx = parseInt(bar.dataset.rowIdx);
            const container = document.getElementById(containerId);
            if (!container) return;

            const rows = container.querySelectorAll('.array-item-row');
            if (rows[rowIdx]) {
                rows[rowIdx].scrollIntoView({ behavior: 'smooth', block: 'center' });
                rows[rowIdx].style.boxShadow = '0 0 20px var(--primary)';
                setTimeout(() => { rows[rowIdx].style.boxShadow = ''; }, 2000);
            }
        };

        // Drag state
        let dragState = null;
        let wasDragging = false;

        // Handle event click - scroll to event if not dragging
        // Ctrl+click scrolls to section header instead of specific event
        window.handleEventClick = function (e, bar) {
            if (wasDragging) {
                wasDragging = false;
                return;
            }

            if (e.ctrlKey) {
                // Ctrl+click: scroll to section and expand it
                const containerId = bar.dataset.container;
                const container = document.getElementById(containerId);
                if (container) {
                    // Find parent collapsible section
                    const section = container.closest('.collapsible-section');
                    if (section) {
                        // Expand the section if collapsed
                        const content = section.querySelector('.collapsible-content');
                        if (content && !content.classList.contains('active')) {
                            const header = section.querySelector('.collapsible-header');
                            if (header) toggleCollapsible(header);
                        }
                        // Scroll to section
                        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        section.style.boxShadow = '0 0 25px var(--primary)';
                        setTimeout(() => { section.style.boxShadow = ''; }, 2000);
                    }
                }
            } else {
                // Normal click: scroll to specific event row
                scrollToEventRow(bar);
            }
        };

        // Start resize operation
        window.startResize = function (e, handle, side) {
            e.stopPropagation();
            e.preventDefault();

            const bar = handle.closest('.event-bar');
            const track = bar.closest('.event-track');
            const containerId = bar.dataset.container;
            const rowIdx = parseInt(bar.dataset.rowIdx);

            dragState = {
                type: 'resize',
                side,
                bar,
                containerId,
                rowIdx,
                startX: e.clientX,
                trackWidth: track.offsetWidth,
                initialLeft: parseFloat(bar.style.left) || 0,
                initialWidth: parseFloat(bar.style.width) || 4.17
            };

            document.addEventListener('mousemove', handleDrag);
            document.addEventListener('mouseup', endDrag);
        };

        // Start drag operation (moving the event)
        window.startDrag = function (e) {
            if (e.target.classList.contains('resize-handle')) return;
            if (e.ctrlKey) return; // Don't start drag on Ctrl+click

            const bar = e.currentTarget;
            const track = bar.closest('.event-track');
            const containerId = bar.dataset.container;
            const rowIdx = parseInt(bar.dataset.rowIdx);

            dragState = {
                type: 'move',
                bar,
                containerId,
                rowIdx,
                startX: e.clientX,
                trackWidth: track.offsetWidth,
                initialLeft: parseFloat(bar.style.left) || 0,
                initialWidth: parseFloat(bar.style.width) || 4.17
            };

            document.addEventListener('mousemove', handleDrag);
            document.addEventListener('mouseup', endDrag);
        };

        // Handle drag movement (15-minute increments)
        function handleDrag(e) {
            if (!dragState) return;

            const dx = e.clientX - dragState.startX;
            const percentDelta = (dx / dragState.trackWidth) * 100;
            // Use 15-minute increments (0.25 hours = 1.04%)
            const hourDelta = Math.round(percentDelta / 1.04) * 0.25;

            if (dragState.type === 'resize') {
                if (dragState.side === 'right') {
                    const newWidth = Math.max(1.04, dragState.initialWidth + (hourDelta / 24 * 100));
                    dragState.bar.style.width = newWidth + '%';
                } else if (dragState.side === 'left') {
                    const newLeft = Math.max(0, Math.min(dragState.initialLeft + (hourDelta / 24 * 100), 98.96));
                    const newWidth = Math.max(1.04, dragState.initialWidth - (hourDelta / 24 * 100));
                    dragState.bar.style.left = newLeft + '%';
                    dragState.bar.style.width = newWidth + '%';
                }
            } else if (dragState.type === 'move') {
                const newLeft = Math.max(0, Math.min(dragState.initialLeft + (hourDelta / 24 * 100), 100 - dragState.initialWidth));
                dragState.bar.style.left = newLeft + '%';
            }
        }

        // End drag and save changes
        function endDrag() {
            if (!dragState) return;

            document.removeEventListener('mousemove', handleDrag);
            document.removeEventListener('mouseup', endDrag);

            // Calculate new hours from position (as decimal)
            const leftPercent = parseFloat(dragState.bar.style.left) || 0;
            const widthPercent = parseFloat(dragState.bar.style.width) || 1.04;

            const newStartHour = Math.round((leftPercent / 100) * 24 * 4) / 4; // Round to 15 min
            const newEndHour = Math.min(24, Math.round(((leftPercent + widthPercent) / 100) * 24 * 4) / 4);

            // Update the form inputs
            const container = document.getElementById(dragState.containerId);
            if (container) {
                const rows = container.querySelectorAll('.array-item-row');
                const row = rows[dragState.rowIdx];
                if (row) {
                    row.querySelector('.event-start-input').value = newStartHour;
                    row.querySelector('.event-end-input').value = newEndHour;

                    // Update badge
                    const badge = row.querySelector('.event-time-badge');
                    if (badge) {
                        badge.classList.add('has-time');
                        const dayOffset = parseInt(row.querySelector('.event-day-input')?.value) || 0;
                        const dateLabel = getGameDateLabel(dayOffset);
                        badge.innerHTML = `🕐 ${dateLabel} ${formatTimeDisplay(newStartHour)}-${formatTimeDisplay(newEndHour)}`;
                    }
                }
            }

            // Set flag to prevent click from triggering scroll
            wasDragging = true;

            dragState = null;
            renderVisualTimeline(); // Refresh timeline
        }

        // Show event picker dropdown
        window.showEventPicker = function () {
            const list = document.getElementById('eventPickerList');
            const dropdown = document.getElementById('eventPickerDropdown');
            if (!list || !dropdown) return;

            // Collect all events without defined time
            const events = [];
            const eventTypes = [
                { container: 'npcsContainer', type: 'npc', icon: '👤', nameClass: 'npc-name-input' },
                { container: 'locationsContainer', type: 'location', icon: '📍', nameClass: 'location-name-input' },
                { container: 'combatsContainer', type: 'combat', icon: '⚔️', nameClass: 'combat-enemies-input' },
                { container: 'questsContainer', type: 'quest', icon: '📜', nameClass: 'quest-name-input' },
                { container: 'momentsContainer', type: 'moment', icon: '⭐', nameClass: 'moment-desc-input' }
            ];

            eventTypes.forEach(({ container, icon, nameClass }) => {
                document.querySelectorAll(`#${container} .array-item-row`).forEach((row, idx) => {
                    const name = row.querySelector(`.${nameClass}`)?.value?.trim();
                    const startHour = row.querySelector('.event-start-input')?.value;

                    if (name && startHour === '') {
                        events.push({ icon, name, container, rowIdx: idx });
                    }
                });
            });

            if (events.length === 0) {
                list.innerHTML = '<div style="color:var(--lr-text-2); padding:10px;">Todos os eventos já têm horário definido!</div>';
            } else {
                list.innerHTML = events.map(e => `
                    <div class="event-picker-item" onclick="selectEventFromPicker('${e.container}', ${e.rowIdx})">
                        <span class="event-picker-icon">${e.icon}</span>
                        <span class="event-picker-name">${e.name}</span>
                    </div>
                `).join('');
            }

            dropdown.style.display = 'block';
        };

        // Hide event picker
        window.hideEventPicker = function () {
            const dropdown = document.getElementById('eventPickerDropdown');
            if (dropdown) dropdown.style.display = 'none';
        };

        // Select event from picker and open time editor
        window.selectEventFromPicker = function (containerId, rowIdx) {
            hideEventPicker();
            const container = document.getElementById(containerId);
            if (!container) return;

            const rows = container.querySelectorAll('.array-item-row');
            if (rows[rowIdx]) {
                openTimeEditor(rows[rowIdx]);
            }
        };

        // Autocomplete state
        let selectedNpc = null;
        let selectedLocation = null;
        let selectedItem = null;

        // Show autocomplete dropdown
        window.showAutocomplete = function (type) {
            filterAutocomplete(type);
            const dropdown = document.getElementById(`${type}Dropdown`);
            if (dropdown) dropdown.classList.add('show');
        };

        // Hide all autocomplete dropdowns
        window.hideAllAutocomplete = function () {
            ['npc', 'location', 'item'].forEach(type => {
                const dropdown = document.getElementById(`${type}Dropdown`);
                if (dropdown) dropdown.classList.remove('show');
            });
        };

        // Filter autocomplete based on search input
        window.filterAutocomplete = function (type) {
            const inputId = type === 'npc' ? 'searchNpcInput' : type === 'location' ? 'searchLocationInput' : 'searchItemInput';
            const dropdownId = `${type}Dropdown`;
            const input = document.getElementById(inputId);
            const dropdown = document.getElementById(dropdownId);
            if (!input || !dropdown) return;

            const query = input.value.toLowerCase().trim();
            let items = [];

            if (type === 'npc') {
                items = (allData.npcs || []).filter(n =>
                    (n.nome || '').toLowerCase().includes(query) ||
                    (n.tipo || '').toLowerCase().includes(query)
                ).slice(0, 20);
            } else if (type === 'location') {
                items = (allData.geography || []).filter(l =>
                    (l.nome || '').toLowerCase().includes(query) ||
                    (l.tipo || '').toLowerCase().includes(query)
                ).slice(0, 20);
            } else if (type === 'item') {
                items = (allItems || []).filter(i =>
                    (i.name || '').toLowerCase().includes(query) ||
                    (i.type || '').toLowerCase().includes(query)
                ).slice(0, 20);
            }

            if (items.length === 0) {
                dropdown.innerHTML = '<div class="autocomplete-no-results">Nenhum resultado encontrado</div>';
            } else {
                dropdown.innerHTML = items.map(item => {
                    const name = type === 'item' ? (item.name || 'Item') : (item.nome || 'Sem nome');
                    const itemType = type === 'item' ? (item.type || 'Item') : (item.tipo || type.toUpperCase());
                    const escapedName = name.replace(/'/g, "\\'").replace(/"/g, '&quot;');
                    const escapedType = itemType.replace(/'/g, "\\'").replace(/"/g, '&quot;');
                    return `
                        <div class="autocomplete-item" data-id="${item.id}" onclick="selectAutocompleteItem('${type}', '${item.id}', '${escapedName}', '${escapedType}')">
                            <div class="item-name">${name}</div>
                            <div class="item-type">${itemType}</div>
                        </div>
                    `;
                }).join('');
            }
            dropdown.classList.add('show');
        };

        // Select item from autocomplete
        window.selectAutocompleteItem = function (type, id, name, itemType) {
            const inputId = type === 'npc' ? 'searchNpcInput' : type === 'location' ? 'searchLocationInput' : 'searchItemInput';
            const input = document.getElementById(inputId);
            if (input) input.value = name;

            if (type === 'npc') {
                selectedNpc = { id, name, type: itemType };
            } else if (type === 'location') {
                selectedLocation = { id, name, type: itemType };
            } else if (type === 'item') {
                selectedItem = { id, name };
            }

            hideAllAutocomplete();
        };

        // Add selected NPC
        window.addSelectedNpc = function () {
            if (!selectedNpc) {
                showAlert('⚠️ Selecione um NPC primeiro!', 'warning');
                return;
            }

            const container = document.getElementById('npcsContainer');
            container.insertAdjacentHTML('beforeend', `
                <div class="array-item-row" data-npc-id="${selectedNpc.id}" data-event-type="npc">
                    <span class="event-time-badge" onclick="openTimeEditor(this.closest('.array-item-row'))">🕐 Definir</span>
                    <input type="hidden" class="event-day-input" value="0">
                    <input type="hidden" class="event-start-input" value="">
                    <input type="hidden" class="event-end-input" value="">
                    <input type="text" class="form-input npc-name-input" value="${selectedNpc.name}" placeholder="Nome do NPC">
                    <input type="text" class="form-input npc-role-input" value="${selectedNpc.type}" placeholder="Papel (ex: Antagonista)">
                    <button type="button" class="btn-remove-array-item" onclick="this.closest('.array-item-row').remove()">✕</button>
                </div>
            `);

            selectedNpc = null;
            document.getElementById('searchNpcInput').value = '';
        };

        // Add selected Location
        window.addSelectedLocation = function () {
            if (!selectedLocation) {
                showAlert('⚠️ Selecione uma localização primeiro!', 'warning');
                return;
            }

            const container = document.getElementById('locationsContainer');
            container.insertAdjacentHTML('beforeend', `
                <div class="array-item-row" data-location-id="${selectedLocation.id}" data-event-type="location">
                    <span class="event-time-badge" onclick="openTimeEditor(this.closest('.array-item-row'))">🕐 Definir</span>
                    <input type="hidden" class="event-day-input" value="0">
                    <input type="hidden" class="event-start-input" value="">
                    <input type="hidden" class="event-end-input" value="">
                    <input type="text" class="form-input location-name-input" value="${selectedLocation.name}" placeholder="Nome do local">
                    <input type="text" class="form-input location-type-input" value="${selectedLocation.type}" placeholder="Tipo (ex: Cidade)">
                    <button type="button" class="btn-remove-array-item" onclick="this.closest('.array-item-row').remove()">✕</button>
                </div>
            `);

            selectedLocation = null;
            document.getElementById('searchLocationInput').value = '';
        };

        // Add selected Item
        window.addSelectedItem = function () {
            if (!selectedItem) {
                showAlert('⚠️ Selecione um item primeiro!', 'warning');
                return;
            }

            if (sessionSelectedItems.some(i => i.id === selectedItem.id)) {
                showAlert('⚠️ Este item já foi adicionado!', 'warning');
                selectedItem = null;
                document.getElementById('searchItemInput').value = '';
                return;
            }

            sessionSelectedItems.push({ id: selectedItem.id, name: selectedItem.name });
            renderSessionItems();

            selectedItem = null;
            document.getElementById('searchItemInput').value = '';
        };

        // Close autocomplete when clicking outside
        document.addEventListener('click', function (e) {
            if (!e.target.closest('.autocomplete-container')) {
                hideAllAutocomplete();
            }
        });

        // Remove session item
        window.removeSessionItem = function (idx) {
            sessionSelectedItems.splice(idx, 1);
            renderSessionItems();
        };

        // Render session items list
        function renderSessionItems() {
            const container = document.getElementById('sessionItemsList');
            if (!container) return;
            container.innerHTML = sessionSelectedItems.map((item, idx) => `
                <span class="session-item-tag">
                    📦 ${item.name}
                    <button class="remove-tag" onclick="removeSessionItem(${idx})">✕</button>
                </span>
            `).join('');
        }

        // Add session gallery image
        window.addSessionImage = function () {
            const urlInput = document.getElementById('galleryImageUrl');
            const labelInput = document.getElementById('galleryImageLabel');
            const url = urlInput.value.trim();
            const label = labelInput.value.trim();

            if (!url) { showAlert('⚠️ Insira uma URL de imagem!', 'warning'); return; }

            sessionGalleryImages.push({ url, label });
            renderSessionGallery();
            urlInput.value = '';
            labelInput.value = '';
        };

        // Remove session gallery image
        window.removeSessionImage = function (idx) {
            sessionGalleryImages.splice(idx, 1);
            renderSessionGallery();
        };

        // Render session gallery
        function renderSessionGallery() {
            const container = document.getElementById('sessionGalleryGrid');
            if (!container) return;
            container.innerHTML = sessionGalleryImages.map((img, idx) => `
                <div class="session-gallery-item">
                    <img src="${img.url}" alt="${img.label || 'Imagem'}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22><rect fill=%22%23333%22 width=%22100%22 height=%22100%22/><text x=%2250%25%22 y=%2250%25%22 fill=%22%23999%22 text-anchor=%22middle%22 dy=%22.3em%22>Erro</text></svg>'">
                    ${img.label ? `<div class="gallery-label">${img.label}</div>` : ''}
                    <button class="remove-gallery-item" onclick="removeSessionImage(${idx})">✕</button>
                </div>
            `).join('');
        }

        async function saveSession() {
            if (!currentCampaign) { showAlert('⚠️ Selecione uma campanha primeiro!', 'warning'); return; }

            // Collect player presence with EXP
            const playersPresent = Array.from(document.querySelectorAll('.player-presence-check:checked')).map(checkbox => {
                const charId = checkbox.dataset.charId;
                const charNome = checkbox.dataset.charNome;
                const playerNome = checkbox.dataset.playerNome;
                const expInput = document.querySelector(`.player-exp-input[data-char-id="${charId}"]`);
                const expGained = parseInt(expInput?.value) || 0;
                return { characterId: charId, characterName: charNome, playerName: playerNome, expGained };
            });

            // Get all personagens and find those absent
            const allPersonagens = currentCampaign?.personagens || [];
            const presentIds = playersPresent.map(p => p.characterId);
            const playersAbsent = allPersonagens.filter(p => !presentIds.includes(p.id)).map(p => ({
                characterId: p.id,
                characterName: p.nome,
                playerName: p.jogador
            }));

            // Collect events with time data (use null instead of undefined for Firebase)
            const npcs = Array.from(document.querySelectorAll('#npcsContainer .array-item-row')).map(row => {
                const startVal = row.querySelector('.event-start-input')?.value;
                const endVal = row.querySelector('.event-end-input')?.value;
                const dayOffset = parseInt(row.querySelector('.event-day-input')?.value) || 0;
                const endDayOffset = parseInt(row.querySelector('.event-end-day-input')?.value) || dayOffset;
                return {
                    id: row.dataset.npcId || null,
                    name: row.querySelector('.npc-name-input')?.value?.trim() || '',
                    role: row.querySelector('.npc-role-input')?.value?.trim() || '',
                    dayOffset,
                    endDayOffset,
                    startHour: startVal !== '' && startVal !== undefined ? parseFloat(startVal) : null,
                    endHour: endVal !== '' && endVal !== undefined ? parseFloat(endVal) : null
                };
            }).filter(n => n.name);

            const locations = Array.from(document.querySelectorAll('#locationsContainer .array-item-row')).map(row => {
                const startVal = row.querySelector('.event-start-input')?.value;
                const endVal = row.querySelector('.event-end-input')?.value;
                const dayOffset = parseInt(row.querySelector('.event-day-input')?.value) || 0;
                const endDayOffset = parseInt(row.querySelector('.event-end-day-input')?.value) || dayOffset;
                return {
                    id: row.dataset.locationId || null,
                    name: row.querySelector('.location-name-input')?.value?.trim() || '',
                    type: row.querySelector('.location-type-input')?.value?.trim() || '',
                    dayOffset,
                    endDayOffset,
                    startHour: startVal !== '' && startVal !== undefined ? parseFloat(startVal) : null,
                    endHour: endVal !== '' && endVal !== undefined ? parseFloat(endVal) : null
                };
            }).filter(l => l.name);

            const combats = Array.from(document.querySelectorAll('#combatsContainer .array-item-row')).map(row => {
                const startVal = row.querySelector('.event-start-input')?.value;
                const endVal = row.querySelector('.event-end-input')?.value;
                const dayOffset = parseInt(row.querySelector('.event-day-input')?.value) || 0;
                const endDayOffset = parseInt(row.querySelector('.event-end-day-input')?.value) || dayOffset;
                return {
                    enemies: row.querySelector('.combat-enemies-input')?.value?.trim() || '',
                    outcome: row.querySelector('.combat-outcome-input')?.value?.trim() || '',
                    dayOffset,
                    endDayOffset,
                    startHour: startVal !== '' && startVal !== undefined ? parseFloat(startVal) : null,
                    endHour: endVal !== '' && endVal !== undefined ? parseFloat(endVal) : null
                };
            }).filter(c => c.enemies);

            const quests = Array.from(document.querySelectorAll('#questsContainer .array-item-row')).map(row => {
                const startVal = row.querySelector('.event-start-input')?.value;
                const endVal = row.querySelector('.event-end-input')?.value;
                const dayOffset = parseInt(row.querySelector('.event-day-input')?.value) || 0;
                const endDayOffset = parseInt(row.querySelector('.event-end-day-input')?.value) || dayOffset;
                return {
                    name: row.querySelector('.quest-name-input')?.value?.trim() || '',
                    status: row.querySelector('.quest-status-input')?.value || 'Iniciada',
                    dayOffset,
                    endDayOffset,
                    startHour: startVal !== '' && startVal !== undefined ? parseFloat(startVal) : null,
                    endHour: endVal !== '' && endVal !== undefined ? parseFloat(endVal) : null
                };
            }).filter(q => q.name);

            const moments = Array.from(document.querySelectorAll('#momentsContainer .array-item-row')).map(row => {
                const startVal = row.querySelector('.event-start-input')?.value;
                const endVal = row.querySelector('.event-end-input')?.value;
                const dayOffset = parseInt(row.querySelector('.event-day-input')?.value) || 0;
                const endDayOffset = parseInt(row.querySelector('.event-end-day-input')?.value) || dayOffset;
                return {
                    type: row.querySelector('.moment-type-input')?.value || 'funny',
                    description: row.querySelector('.moment-desc-input')?.value?.trim() || '',
                    dayOffset,
                    endDayOffset,
                    startHour: startVal !== '' && startVal !== undefined ? parseFloat(startVal) : null,
                    endHour: endVal !== '' && endVal !== undefined ? parseFloat(endVal) : null
                };
            }).filter(m => m.description);

            // Manual items from textarea
            const manualItems = document.getElementById('lootItems').value.trim().split('\n').filter(i => i.trim()).map(i => ({ name: i.trim() }));
            const nextHooks = document.getElementById('nextSessionHooks').value.trim().split('\n').filter(h => h.trim());

            // Collect game time data
            const gameTime = {
                day: document.getElementById('gameDay')?.value || '',
                month: document.getElementById('gameMonth')?.value || '',
                year: document.getElementById('gameYear')?.value || '',
                era: document.getElementById('gameEra')?.value || '',
                duration: document.getElementById('gameDuration')?.value?.trim() || ''
            };

            const data = {
                campaignId: currentCampaign.id,
                sessionNumber: parseInt(document.getElementById('sessionNumber').value) || 1,
                date: document.getElementById('sessionDate').value,
                duration: document.getElementById('sessionDuration').value.trim(),
                gameTime,
                playersPresent,
                playersAbsent,
                summary: document.getElementById('sessionSummary').value.trim(),
                // Collect player summaries
                playerSummaries: Array.from(document.querySelectorAll('.player-summary-textarea')).map(textarea => ({
                    characterId: textarea.dataset.charId,
                    characterName: textarea.dataset.charName,
                    playerName: textarea.dataset.playerName,
                    content: textarea.value.trim()
                })).filter(ps => ps.content),
                importantNpcs: npcs,
                locationsVisited: locations,
                combats,
                lootAndRewards: {
                    items: manualItems,
                    selectedItems: sessionSelectedItems
                },
                images: sessionGalleryImages,
                quests,
                memorableMoments: moments,
                nextSessionHooks: nextHooks,
                dmNotes: {
                    private: true,
                    content: document.getElementById('dmNotes').value.trim()
                },
                lastUpdate: new Date().toISOString(),
                lastUpdateBy: currentUser.email
            };

            try {
                const colRef = collection(db, 'session-logs');
                const docRef = currentSession ? doc(db, 'session-logs', currentSession.id) : doc(colRef);
                await setDoc(docRef, data, { merge: true });
                showAlert(currentSession ? '✅ Sessão atualizada!' : '✅ Sessão criada!', 'success');
                closeEntryModal();
                await loadAllData();
                renderSessionLogs();
            } catch (e) {
                console.error(e);
                showAlert('❌ Erro ao salvar sessão', 'danger');
            }
        }

        async function deleteSession(sessionId) {
            if (!sessionId || !await confirmar('Tem certeza que deseja excluir esta sessão?', { perigo: true })) return;
            try {
                await deleteDoc(doc(db, 'session-logs', sessionId));
                showAlert('✅ Sessão excluída!', 'success');
                closeEntryModal();
                await loadAllData();
                renderSessionLogs();
            } catch (e) {
                console.error(e);
                showAlert('❌ Erro ao excluir sessão', 'danger');
            }
        }

        // Import/Export Functions
        window.triggerImportSession = function () {
            document.getElementById('importSessionFile').click();
        };

        window.importSessionJSON = async function (input) {
            const file = input.files[0];
            if (!file) return;

            try {
                const text = await file.text();
                const data = JSON.parse(text);

                // Validate basic structure
                if (!data.sessionNumber || !data.summary) {
                    showAlert('⚠️ JSON inválido! Faltam campos obrigatórios.', 'warning');
                    return;
                }

                // Add campaign reference
                data.campaignId = currentCampaign.id;
                data.lastUpdate = new Date().toISOString();
                data.lastUpdateBy = currentUser.email;
                data.metadata = {
                    importedAt: new Date().toISOString(),
                    lastModified: new Date().toISOString(),
                    createdBy: currentUser.email
                };

                // Save to Firebase
                const colRef = collection(db, 'session-logs');
                await setDoc(doc(colRef), data);

                showAlert('✅ Sessão importada com sucesso!', 'success');
                await loadAllData();
                renderSessionLogs();
            } catch (e) {
                console.error(e);
                showAlert('❌ Erro ao importar JSON. Verifique o formato.', 'danger');
            }

            input.value = ''; // Reset file input
        };

        window.exportCurrentSession = function () {
            const sessionData = buildCurrentSessionData();
            const dataStr = JSON.stringify(sessionData, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `sessao-${sessionData.sessionNumber || 'nova'}.json`;
            a.click();
            URL.revokeObjectURL(url);
            showAlert('✅ Sessão exportada!', 'success');
        };

        function buildCurrentSessionData() {
            // Collect player presence with EXP
            const playersPresent = Array.from(document.querySelectorAll('.player-presence-check:checked')).map(checkbox => ({
                characterId: checkbox.dataset.charId,
                characterName: checkbox.dataset.charNome,
                playerName: checkbox.dataset.playerNome,
                expGained: parseInt(document.querySelector(`.player-exp-input[data-char-id="${checkbox.dataset.charId}"]`)?.value) || 0
            }));

            // Get absent players
            const presentIds = playersPresent.map(p => p.characterId);
            const allPersonagens = currentCampaign?.personagens || [];
            const playersAbsent = allPersonagens.filter(p => !presentIds.includes(p.id)).map(p => ({
                characterId: p.id,
                characterName: p.nome,
                playerName: p.jogador
            }));

            // Collect player summaries
            const playerSummaries = Array.from(document.querySelectorAll('.player-summary-textarea')).map(textarea => ({
                characterId: textarea.dataset.charId,
                characterName: textarea.dataset.charName,
                playerName: textarea.dataset.playerName,
                content: textarea.value.trim()
            })).filter(ps => ps.content);

            // Collect game time
            const gameTime = {
                day: document.getElementById('gameDay')?.value || '',
                month: document.getElementById('gameMonth')?.value || '',
                year: document.getElementById('gameYear')?.value || '',
                era: document.getElementById('gameEra')?.value || '',
                duration: document.getElementById('gameDuration')?.value || ''
            };

            return {
                sessionNumber: parseInt(document.getElementById('sessionNumber')?.value) || 1,
                date: document.getElementById('sessionDate')?.value || '',
                duration: document.getElementById('sessionDuration')?.value || '',
                gameTime,
                playersPresent,
                playersAbsent,
                summary: document.getElementById('sessionSummary')?.value || '',
                playerSummaries,
                importantNpcs: Array.from(document.querySelectorAll('#npcsContainer .array-item-row')).map(row => {
                    const startVal = row.querySelector('.event-start-input')?.value;
                    const endVal = row.querySelector('.event-end-input')?.value;
                    return {
                        id: row.dataset.npcId || null,
                        name: row.querySelector('.npc-name-input')?.value || '',
                        role: row.querySelector('.npc-role-input')?.value || '',
                        dayOffset: parseInt(row.querySelector('.event-day-input')?.value) || 0,
                        endDayOffset: parseInt(row.querySelector('.event-end-day-input')?.value) || 0,
                        startHour: startVal !== '' ? parseFloat(startVal) : null,
                        endHour: endVal !== '' ? parseFloat(endVal) : null
                    };
                }).filter(n => n.name),
                locationsVisited: Array.from(document.querySelectorAll('#locationsContainer .array-item-row')).map(row => {
                    const startVal = row.querySelector('.event-start-input')?.value;
                    const endVal = row.querySelector('.event-end-input')?.value;
                    return {
                        id: row.dataset.locationId || null,
                        name: row.querySelector('.location-name-input')?.value || '',
                        type: row.querySelector('.location-type-input')?.value || '',
                        dayOffset: parseInt(row.querySelector('.event-day-input')?.value) || 0,
                        endDayOffset: parseInt(row.querySelector('.event-end-day-input')?.value) || 0,
                        startHour: startVal !== '' ? parseFloat(startVal) : null,
                        endHour: endVal !== '' ? parseFloat(endVal) : null
                    };
                }).filter(l => l.name),
                combats: Array.from(document.querySelectorAll('#combatsContainer .array-item-row')).map(row => {
                    const startVal = row.querySelector('.event-start-input')?.value;
                    const endVal = row.querySelector('.event-end-input')?.value;
                    return {
                        enemies: row.querySelector('.combat-enemies-input')?.value || '',
                        outcome: row.querySelector('.combat-outcome-input')?.value || '',
                        dayOffset: parseInt(row.querySelector('.event-day-input')?.value) || 0,
                        endDayOffset: parseInt(row.querySelector('.event-end-day-input')?.value) || 0,
                        startHour: startVal !== '' ? parseFloat(startVal) : null,
                        endHour: endVal !== '' ? parseFloat(endVal) : null
                    };
                }).filter(c => c.enemies),
                lootAndRewards: {
                    items: (document.getElementById('lootItems')?.value || '').split('\n').filter(i => i.trim()).map(i => ({ name: i.trim() })),
                    selectedItems: sessionSelectedItems || []
                },
                quests: Array.from(document.querySelectorAll('#questsContainer .array-item-row')).map(row => {
                    const startVal = row.querySelector('.event-start-input')?.value;
                    const endVal = row.querySelector('.event-end-input')?.value;
                    return {
                        name: row.querySelector('.quest-name-input')?.value || '',
                        status: row.querySelector('.quest-status-input')?.value || 'Iniciada',
                        dayOffset: parseInt(row.querySelector('.event-day-input')?.value) || 0,
                        endDayOffset: parseInt(row.querySelector('.event-end-day-input')?.value) || 0,
                        startHour: startVal !== '' ? parseFloat(startVal) : null,
                        endHour: endVal !== '' ? parseFloat(endVal) : null
                    };
                }).filter(q => q.name),
                memorableMoments: Array.from(document.querySelectorAll('#momentsContainer .array-item-row')).map(row => {
                    const startVal = row.querySelector('.event-start-input')?.value;
                    const endVal = row.querySelector('.event-end-input')?.value;
                    return {
                        type: row.querySelector('.moment-type-input')?.value || 'funny',
                        description: row.querySelector('.moment-desc-input')?.value || '',
                        dayOffset: parseInt(row.querySelector('.event-day-input')?.value) || 0,
                        endDayOffset: parseInt(row.querySelector('.event-end-day-input')?.value) || 0,
                        startHour: startVal !== '' ? parseFloat(startVal) : null,
                        endHour: endVal !== '' ? parseFloat(endVal) : null
                    };
                }).filter(m => m.description),
                images: sessionGalleryImages || [],
                nextSessionHooks: (document.getElementById('nextSessionHooks')?.value || '').split('\n').filter(h => h.trim()),
                dmNotes: {
                    private: true,
                    content: document.getElementById('dmNotes')?.value || ''
                }
            };
        }

        window.downloadTemplate = function () {
            fetch('session-log-template.json')
                .then(r => r.json())
                .then(data => {
                    const dataStr = JSON.stringify(data, null, 2);
                    const blob = new Blob([dataStr], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'session-log-template.json';
                    a.click();
                    URL.revokeObjectURL(url);
                    showAlert('✅ Template baixado!', 'success');
                })
                .catch(e => {
                    console.error(e);
                    showAlert('❌ Erro ao baixar template', 'danger');
                });
        };

        // Notification Modal
        window.openNotificationModal = function () {
            if (!currentCampaign) {
                showAlert('⚠️ Selecione uma campanha primeiro!', 'warning');
                return;
            }

            const modal = document.getElementById('entryModal');
            const title = document.getElementById('entryModalTitle');
            const body = document.getElementById('entryModalBody');
            const deleteBtn = document.getElementById('btnDeleteEntry');

            title.textContent = '📬 Notificar Jogadores';
            deleteBtn.style.display = 'none';

            body.innerHTML = `
                <div class="form-group">
                    <label class="form-label">Selecionar Jogadores</label>
                    <div class="player-select-grid" id="playerSelectGrid">
                        ${(currentCampaign.personagens || []).map(p => `
                            <label class="player-checkbox-item">
                                <input type="checkbox" class="notification-checkbox" 
                                       value="${p.ownerUid || ''}" 
                                       data-charname="${p.nome || ''}"
                                       data-playername="${p.jogador || ''}"
                                       checked>
                                <div class="player-checkbox-info">
                                    <span class="player-checkbox-char">${p.nome || 'Personagem'}</span>
                                    <span class="player-checkbox-name">👤 ${p.jogador || 'Jogador'}</span>
                                </div>
                            </label>
                        `).join('') || '<p style="color: var(--lr-text-2); font-size: 0.85rem;">Nenhum personagem na campanha. Edite a campanha para adicionar personagens.</p>'}
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Mensagem</label>
                    <textarea class="form-textarea" id="notificationMessage" rows="4" 
                        placeholder="Escreva sua mensagem para os jogadores..." style="width: 100%;"></textarea>
                </div>
            `;

            // Override save button for notification
            const saveBtn = document.querySelector('.modal-footer .btn-success');
            saveBtn.textContent = '📤 Enviar Notificação';
            saveBtn.onclick = sendPlayerNotification;
            modal.classList.add('active');
        };

        // Notification
        window.sendPlayerNotification = async function () {
            const message = document.getElementById('notificationMessage').value.trim();
            if (!message) {
                showAlert('⚠️ Digite uma mensagem!', 'warning');
                return;
            }

            // Get selected players with their ownerUid
            const selectedCheckboxes = Array.from(document.querySelectorAll('#playerSelectGrid .notification-checkbox:checked'));

            if (!selectedCheckboxes.length) {
                showAlert('⚠️ Selecione pelo menos um jogador!', 'warning');
                return;
            }

            // Filter out entries without valid ownerUid and group by ownerUid to avoid duplicate sends
            const uniqueOwnerUids = [...new Set(selectedCheckboxes
                .map(cb => cb.value)
                .filter(uid => uid && uid.trim() !== ''))];

            if (!uniqueOwnerUids.length) {
                showAlert('⚠️ Os personagens selecionados não possuem jogadores vinculados!', 'warning');
                return;
            }

            try {
                showAlert('📤 Enviando notificações...', 'success');

                // Create notification object
                const notification = {
                    id: `campaign_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    type: 'master_message',
                    message: `📋 [${currentCampaign.nome}] ${message}`,
                    timestamp: new Date().toISOString(),
                    isNew: true,
                    data: {
                        campaignId: currentCampaign.id,
                        campaignName: currentCampaign.nome,
                        highlight: 'normal',
                        sentBy: currentUser.email || 'Mestre'
                    }
                };

                let successCount = 0;

                // Send to each player's user account
                for (const ownerUid of uniqueOwnerUids) {
                    try {
                        const userDocRef = doc(db, 'users', ownerUid);
                        const userDoc = await getDoc(userDocRef);

                        if (userDoc.exists()) {
                            const userData = userDoc.data();
                            let notifications = userData.notifications || [];

                            // Add new notification at the beginning
                            notifications.unshift(notification);

                            // Limit to 100 notifications
                            if (notifications.length > 100) {
                                notifications = notifications.slice(0, 100);
                            }

                            await updateDoc(userDocRef, { notifications: notifications });
                            successCount++;
                        }
                    } catch (userError) {
                        console.error(`Erro ao enviar para ${ownerUid}:`, userError);
                    }
                }

                showAlert(`✅ Notificação enviada para ${successCount} jogador(es)!`, 'success');
                closeEntryModal();
            } catch (e) {
                console.error(e);
                showAlert('❌ Erro ao enviar notificação', 'danger');
            }
        };

        // ==================== END SESSION LOGS FUNCTIONS ====================

// ══ Ponte para os módulos de ferramentas (wb-*.js) ══
window.WB = {
    get user() { return currentUser; },
    get data() { return allData; },
    categoryConfig,
    reload: loadAllData,
    showAlert: (msg, type) => showAlert(msg, type),
};
