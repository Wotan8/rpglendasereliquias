// ÁREA NPCs — Full CRUD, Export/Import, Modal Form
import { db, collection, getDocs, setDoc, deleteDoc, doc, addDoc } from './firebase-config.js';
import * as S from './state.js';
import { showAlert, escapeHtml } from './ui-utils.js';
import { addLog } from './logs.js';

let currentEditingNpc = null;
export async function onTabActivated() { await loadAllNpcs(); }

async function loadAllNpcs() {
    try {
        const snap = await getDocs(collection(db, 'npcs'));
        const npcs = []; snap.forEach(d => npcs.push({ id: d.id, ...d.data() }));
        S.setAllNpcs(npcs); window.restoreNpcFiltersState ? window.restoreNpcFiltersState() : window.filterNpcs();
    } catch (e) { console.error(e); showAlert('❌ Erro NPCs', 'danger'); }
}
window.loadAllNpcs = loadAllNpcs;

function renderNpcs(npcs) {
    const el = document.getElementById('npcsList'); if (!el) return;
    if (!npcs.length) { el.innerHTML = '<div class="no-npcs">Nenhum NPC encontrado</div>'; return; }
    el.innerHTML = npcs.map(n => {
        const tags = (n.tags||'').split(',').filter(t=>t.trim()).map(t=>`<span class="npc-tag">${escapeHtml(t.trim())}</span>`).join('');
        return `<div class="npc-card" onclick="if(!event.target.classList.contains('npc-checkbox'))openNpcModal('${n.id}')">
            <div class="npc-card-header"><input type="checkbox" class="npc-checkbox" data-npc-id="${n.id}" onclick="event.stopPropagation()"><div class="npc-card-info"><div class="npc-name">${escapeHtml(n.nome||'Sem nome')}</div><span class="npc-type-badge">${n.tipo==='criatura'?'🐉 Criatura':'👤 NPC'}</span></div></div>
            ${n.imagem?`<div class="npc-image-container"><img src="${n.imagem}" class="npc-card-image"></div>`:''}
            ${n.rolePlay?.personalidade?.[0]?`<div style="font-size:.82rem;color:var(--muted);margin-top:6px">- ${escapeHtml(n.rolePlay.personalidade[0])}</div>`:''}
            ${n.rolePlay?.trejeitos?`<div style="font-size:.82rem;color:var(--muted)">🎭 ${escapeHtml(n.rolePlay.trejeitos)}</div>`:''}
            ${tags?`<div class="npc-tags">${tags}</div>`:''}
        </div>`;
    }).join('');
}

// ===== ADVANCED FILTERS =====
let npcFilterDebounce;
window.debounceFilterNpcs = function() { clearTimeout(npcFilterDebounce); npcFilterDebounce = setTimeout(window.filterNpcs, 250); };

window.toggleAdvancedNpcFilters = function() {
    const panel = document.getElementById('npcAdvancedPanel');
    if (!panel) return;
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
};

window.clearAllNpcFilters = function() {
    document.getElementById('npcSearchInput').value = '';
    document.getElementById('npcSortSelect').value = 'recente';
    document.querySelectorAll('.adv-filter').forEach(el => {
        if (el.tagName === 'SELECT') el.value = '';
        else el.value = '';
    });
    localStorage.removeItem('npc_advanced_filter_v1');
    window.filterNpcs();
};

window.onVinculoChange = function() {
    const v = document.getElementById('advF_vinculo').value;
    const cont = document.getElementById('advF_mesaEspecificaContainer');
    const sel = document.getElementById('advF_mesaEsp');
    if (v === 'especifica') {
        cont.style.display = 'block';
        if (S.allMesas && S.allMesas.length > 0 && sel.options.length <= 1) {
            sel.innerHTML = '<option value="">Selecione...</option>' + S.allMesas.map(m => `<option value="${m.id}">${escapeHtml(m.nome||'Sem nome')}</option>`).join('');
        }
    } else { cont.style.display = 'none'; sel.value = ''; }
    window.filterNpcs();
};

window.restoreNpcFiltersState = function() {
    try {
        const saved = localStorage.getItem('npc_advanced_filter_v1');
        if (saved) {
            const st = JSON.parse(saved);
            if (st.search) document.getElementById('npcSearchInput').value = st.search;
            if (st.sort) document.getElementById('npcSortSelect').value = st.sort;
            if (st.adv) {
                Object.keys(st.adv).forEach(k => {
                    const el = document.getElementById(k);
                    if (el) el.value = st.adv[k];
                });
            }
            if (st.adv && st.adv.advF_vinculo === 'especifica') window.onVinculoChange(); // ensure dropdown is visible
        }
    } catch(e) { console.error('Erro ao restaurar filtros NPCs', e); }
    window.filterNpcs();
};

window.filterNpcs = function() {
    const searchStr = (document.getElementById('npcSearchInput')?.value||'').toLowerCase().trim();
    const sortVal = document.getElementById('npcSortSelect')?.value || 'recente';
    
    // Coletar adv filters
    const adv = {};
    document.querySelectorAll('.adv-filter').forEach(el => {
        if (el.value.trim() !== '') adv[el.id] = el.value.trim();
    });
    
    // Save state
    localStorage.setItem('npc_advanced_filter_v1', JSON.stringify({ search: searchStr, sort: sortVal, adv }));

    let filtered = S.allNpcs.filter(n => {
        // Global search
        if (searchStr) {
            const rpPers = Array.isArray(n.rolePlay?.personalidade) ? n.rolePlay.personalidade.join(' ') : (n.rolePlay?.personalidade || '');
            const combined = [n.nome, n.papel, n.local, n.tribo, n.raca, n.tags, rpPers, n.rolePlay?.motivacao, n.rolePlay?.historia].filter(Boolean).join(' ').toLowerCase();
            if (!combined.includes(searchStr)) return false;
        }

        // Tipo
        if (adv.advF_tipo && n.tipo !== adv.advF_tipo) return false;
        if (adv.advF_porte && (n.porte||'') !== adv.advF_porte) return false;
        if (adv.advF_papel && !(n.papel||'').toLowerCase().includes(adv.advF_papel.toLowerCase())) return false;
        if (adv.advF_local && !(n.local||'').toLowerCase().includes(adv.advF_local.toLowerCase())) return false;
        if (adv.advF_raca && !(n.raca||'').toLowerCase().includes(adv.advF_raca.toLowerCase())) return false;
        if (adv.advF_tribo && !(n.tribo||'').toLowerCase().includes(adv.advF_tribo.toLowerCase())) return false;
        if (adv.advF_classe && !(n.classe||'').toLowerCase().includes(adv.advF_classe.toLowerCase())) return false;
        
        if (adv.advF_tags) {
            const reqTags = adv.advF_tags.toLowerCase().split(',').map(t=>t.trim()).filter(Boolean);
            const nTags = (n.tags||'').toLowerCase();
            if (!reqTags.every(rt => nTags.includes(rt))) return false;
        }
        
        if (adv.advF_imagem === 'sim' && !n.imagem) return false;
        if (adv.advF_imagem === 'nao' && n.imagem) return false;

        // Atributos (Ranges)
        const checkRange = (val, min, max) => {
            const v = Number(val||0);
            if (min && v < Number(min)) return false;
            if (max && v > Number(max)) return false;
            return true;
        };
        const attrs = ['int','rac','prs','for','des','vig','pre','man','aut'];
        for (let a of attrs) {
            if (!checkRange(n.atributos?.[a.toUpperCase()], adv[`advF_${a}_min`], adv[`advF_${a}_max`])) return false;
        }
        if (!checkRange(n.ai, adv.advF_ai_min, adv.advF_ai_max)) return false;

        // Derivados
        const ders = ['vit','ener','san'];
        for (let d of ders) {
            if (!checkRange(n.valoresDer?.[d.toUpperCase()], adv[`advF_${d}_min`], adv[`advF_${d}_max`])) return false;
        }

        // Role-Play
        const rp = n.rolePlay || {};
        if (adv.advF_mot === 'sim' && !rp.motivacao) return false;
        if (adv.advF_mot === 'nao' && rp.motivacao) return false;
        if (adv.advF_seg === 'sim' && !rp.segredos) return false;
        if (adv.advF_seg === 'nao' && rp.segredos) return false;
        if (adv.advF_ali === 'sim' && !rp.relacoes?.aliado) return false;
        if (adv.advF_ali === 'nao' && rp.relacoes?.aliado) return false;
        if (adv.advF_riv === 'sim' && !rp.relacoes?.rival) return false;
        if (adv.advF_riv === 'nao' && rp.relacoes?.rival) return false;
        if (adv.advF_dev === 'sim' && !rp.relacoes?.devedor) return false;
        if (adv.advF_dev === 'nao' && rp.relacoes?.devedor) return false;

        if (adv.advF_rpBusca) {
            const rpPers = Array.isArray(rp.personalidade) ? rp.personalidade.join(' ') : (rp.personalidade || '');
            const rpStr = [rpPers, rp.trejeitos, rp.motivacao, rp.segredos, rp.frases, rp.historia].filter(Boolean).join(' ').toLowerCase();
            if (!rpStr.includes(adv.advF_rpBusca.toLowerCase())) return false;
        }

        // Loot
        const l = n.loot || {};
        if (adv.advF_lootItens === 'sim' && (!l.itens || !l.itens.length)) return false;
        if (adv.advF_lootItens === 'nao' && (l.itens && l.itens.length > 0)) return false;
        if (adv.advF_lootPistas === 'sim' && (!l.pistas || !l.pistas.length)) return false;
        if (adv.advF_lootPistas === 'nao' && (l.pistas && l.pistas.length > 0)) return false;
        if (adv.advF_lootComp === 'sim' && (!l.complicacoes || !l.complicacoes.length)) return false;
        if (adv.advF_lootComp === 'nao' && (l.complicacoes && l.complicacoes.length > 0)) return false;
        
        // Luns extraction
        if (adv.advF_luns_min || adv.advF_luns_max) {
            const lunStr = l.luns || '';
            const num = Number(String(lunStr).replace(/\D/g, '')) || 0;
            if (!checkRange(num, adv.advF_luns_min, adv.advF_luns_max)) return false;
        }

        // Criatura
        if (n.tipo === 'criatura') {
            const c = n.criatura || {};
            if (adv.advF_ameaca && c.nivelAmeaca !== adv.advF_ameaca) return false;
            if (adv.advF_habitat && !(c.habitat||'').toLowerCase().includes(adv.advF_habitat.toLowerCase())) return false;
            if (adv.advF_dieta && !(c.dieta||'').toLowerCase().includes(adv.advF_dieta.toLowerCase())) return false;
        }

        // Vínculo
        if (adv.advF_vinculo) {
            if (adv.advF_vinculo === 'com_mesa' && !n.mesaId) return false;
            if (adv.advF_vinculo === 'sem_mesa' && n.mesaId) return false;
            if (adv.advF_vinculo === 'especifica' && adv.advF_mesaEsp && n.mesaId !== adv.advF_mesaEsp) return false;
        }

        return true;
    });

    // Ordenação
    if (sortVal === 'nome-asc') filtered.sort((a,b) => (a.nome||'').localeCompare(b.nome||''));
    else if (sortVal === 'nome-desc') filtered.sort((a,b) => (b.nome||'').localeCompare(a.nome||''));
    else if (sortVal === 'ai-desc') filtered.sort((a,b) => (b.ai||0) - (a.ai||0));
    else if (sortVal === 'ai-asc') filtered.sort((a,b) => (a.ai||0) - (b.ai||0));
    else if (sortVal === 'vit-desc') filtered.sort((a,b) => (b.valoresDer?.VIT||0) - (a.valoresDer?.VIT||0));
    else if (sortVal === 'vit-asc') filtered.sort((a,b) => (a.valoresDer?.VIT||0) - (b.valoresDer?.VIT||0));
    else if (sortVal === 'antigo') filtered.sort((a,b) => (a.lastUpdate||0) - (b.lastUpdate||0));
    else if (sortVal === 'recente') filtered.sort((a,b) => (b.lastUpdate||0) - (a.lastUpdate||0));
    else if (sortVal === 'random') filtered.sort(() => Math.random() - 0.5);

    renderNpcs(filtered);
    updateFilterUI(searchStr, adv, filtered.length);
};

function updateFilterUI(searchStr, adv, count) {
    const display = document.getElementById('npcCountDisplay');
    if (display) display.textContent = `${count} de ${S.allNpcs.length} NPCs`;

    const activeKeys = Object.keys(adv);
    const badge = document.getElementById('advFilterBadge');
    if (badge) {
        badge.textContent = activeKeys.length;
        badge.style.display = activeKeys.length > 0 ? 'inline-block' : 'none';
    }

    const clearBtn = document.getElementById('clearAdvFiltersBtn');
    if (clearBtn) clearBtn.style.display = (searchStr || activeKeys.length > 0) ? 'inline-block' : 'none';

    // Chips
    const chipsCont = document.getElementById('npcActiveFilterChips');
    if (!chipsCont) return;
    
    let chipsHtml = '';
    const addChip = (id, label) => {
        chipsHtml += `<span class="filter-chip">${escapeHtml(label)} <span class="filter-chip-close" onclick="document.getElementById('${id}').value=''; window.filterNpcs();">×</span></span>`;
    };

    if (searchStr) addChip('npcSearchInput', `Busca: ${searchStr}`);
    activeKeys.forEach(k => {
        const el = document.getElementById(k);
        if (!el) return;
        let lbl = el.options ? (el.options[el.selectedIndex]?.text || el.value) : el.value;
        const parentLabel = el.closest('.form-group')?.querySelector('label')?.textContent || k.replace('advF_','');
        addChip(k, `${parentLabel}: ${lbl}`);
    });

    chipsCont.innerHTML = chipsHtml;
    chipsCont.style.display = chipsHtml ? 'flex' : 'none';
    
    const cs = document.getElementById('advF_criaturaSection');
    if (cs) cs.style.display = adv.advF_tipo === 'npc' ? 'none' : 'block';
}

// ===== NPC MODAL =====
window.openNpcModal = function(npcId = null) {
    const modal = document.getElementById('npcModal'); if (!modal) return;
    const title = document.getElementById('npcModalTitle');
    const body = document.getElementById('npcModalBody');
    body.innerHTML = buildNpcForm();
    if (npcId) {
        const npc = S.allNpcs.find(n => n.id === npcId); if (!npc) return;
        currentEditingNpc = npc; title.textContent = 'Editar NPC / Criatura';
        fillNpcForm(npc);
    } else { currentEditingNpc = null; title.textContent = 'Criar NPC / Criatura'; document.getElementById('npcTipo').value = 'npc'; }
    modal.classList.add('active');
    document.getElementById('npcTipo')?.addEventListener('change', function() { const cs = document.getElementById('creatureFieldsSection'); if (cs) cs.style.display = this.value === 'criatura' ? 'block' : 'none'; });
    document.getElementById('npcImagem')?.addEventListener('input', function() { const u = this.value.trim(), p = document.getElementById('npcImgPreview'); if (p) p.style.display = (u.startsWith('http')?'block':'none'); const img = document.getElementById('npcImgTag'); if (img) { img.src = u; img.onerror = () => { if(p) p.style.display='none'; }; } });
};
window.openNpcEditModal = window.openNpcModal;

function buildNpcForm() {
    const attrs = ['INT','RAC','PRS','FOR','DES','VIG','PRE','MAN','AUT'];
    const attrInputs = attrs.map(a => `<div style="text-align:center"><div style="font-size:.72rem;font-weight:800;color:var(--muted);margin-bottom:4px">${a}</div><input type="number" class="form-input" id="npc${a}" value="0" style="text-align:center;font-weight:800;color:var(--primary)"></div>`).join('');
    return `
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-bottom:16px;flex-wrap:wrap"><button class="btn btn-secondary btn-small" onclick="exportNpcFromForm()">📤 Exportar</button><button class="btn btn-danger btn-small" onclick="deleteCurrentNpc()">🗑️ Excluir</button><button class="btn btn-success" onclick="saveNpc()">💾 Salvar</button></div>
    <div class="form-group"><label class="form-label">🖼️ Imagem URL</label><input type="text" class="form-input" id="npcImagem" placeholder="https://..."><div id="npcImgPreview" style="display:none;margin-top:8px;text-align:center"><img id="npcImgTag" style="max-height:200px;border-radius:10px"></div></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="form-group"><label class="form-label">Nome *</label><input type="text" class="form-input" id="npcNome" placeholder="Nome do NPC"></div>
        <div class="form-group"><label class="form-label">Tipo *</label><select class="form-select" id="npcTipo"><option value="npc">👤 NPC</option><option value="criatura">🐉 Criatura</option></select></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
        <div class="form-group"><label class="form-label">Raça</label><input type="text" class="form-input" id="npcRaca"></div>
        <div class="form-group"><label class="form-label">Porte</label><select class="form-select" id="npcPorte"><option value="">Selecione</option><option>Minúsculo</option><option>Pequeno</option><option>Médio</option><option>Grande</option><option>Enorme</option><option>Colossal</option></select></div>
        <div class="form-group"><label class="form-label">Papel</label><input type="text" class="form-input" id="npcPapel" placeholder="Comerciante, Guarda..."></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
        <div class="form-group"><label class="form-label">Local</label><input type="text" class="form-input" id="npcLocal"></div>
        <div class="form-group"><label class="form-label">Tribo</label><input type="text" class="form-input" id="npcTribo"></div>
        <div class="form-group"><label class="form-label">AI</label><input type="number" class="form-input" id="npcAI" value="0"></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="form-group"><label class="form-label">Classe</label><input type="text" class="form-input" id="npcClasse"></div>
        <div class="form-group"><label class="form-label">Tamanho</label><input type="text" class="form-input" id="npcTamanho"></div>
    </div>
    <div class="form-group"><label class="form-label">🏷️ Tags (separadas por vírgula)</label><input type="text" class="form-input" id="npcTags" placeholder="tag1, tag2"></div>
    <hr style="border-color:var(--line);margin:16px 0">
    <div style="font-weight:800;color:var(--primary);margin-bottom:10px">💪 Atributos</div>
    <div style="display:grid;grid-template-columns:repeat(9,1fr);gap:6px;margin-bottom:16px">${attrInputs}</div>
    <div style="font-weight:800;color:var(--primary);margin-bottom:10px">📊 Valores Derivados</div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:16px">
        ${['VIT','PERC','INI','ENER','REA','BLD','SAN'].map(v=>`<div style="text-align:center"><div style="font-size:.72rem;font-weight:800;color:var(--muted);margin-bottom:4px">${v}</div><input type="number" class="form-input" id="npc${v}" value="0" style="text-align:center;font-weight:800"></div>`).join('')}
        <div style="text-align:center"><div style="font-size:.72rem;font-weight:800;color:var(--muted);margin-bottom:4px">DESLOC</div><input type="text" class="form-input" id="npcDESLOCAMENTO" style="text-align:center"></div>
    </div>
    <div class="form-group"><label class="form-label">⚔️ Ataques</label><textarea class="form-textarea" id="npcAtaques" rows="3" placeholder="Ataques e danos..."></textarea></div>
    <div class="form-group"><label class="form-label">📚 Perícias</label><textarea class="form-textarea" id="npcSkills" rows="2" placeholder="Perícias relevantes..."></textarea></div>
    <hr style="border-color:var(--line);margin:16px 0">
    <div style="font-weight:800;color:var(--primary);margin-bottom:10px">🎭 Role Play</div>
    <div class="form-group"><label class="form-label">Personalidade 1</label><input type="text" class="form-input" id="npcPersonalidade1"></div>
    <div class="form-group"><label class="form-label">Personalidade 2</label><input type="text" class="form-input" id="npcPersonalidade2"></div>
    <div class="form-group"><label class="form-label">Personalidade 3</label><input type="text" class="form-input" id="npcPersonalidade3"></div>
    <div class="form-group"><label class="form-label">Trejeitos</label><input type="text" class="form-input" id="npcTrejeitos"></div>
    <div class="form-group"><label class="form-label">Motivação</label><textarea class="form-textarea" id="npcMotivacao" rows="2"></textarea></div>
    <div class="form-group"><label class="form-label">Segredos</label><textarea class="form-textarea" id="npcSegredos" rows="2"></textarea></div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
        <div class="form-group"><label class="form-label">Aliado</label><input type="text" class="form-input" id="npcAliado"></div>
        <div class="form-group"><label class="form-label">Rival</label><input type="text" class="form-input" id="npcRival"></div>
        <div class="form-group"><label class="form-label">Devedor</label><input type="text" class="form-input" id="npcDevedor"></div>
    </div>
    <div class="form-group"><label class="form-label">💬 Frases</label><textarea class="form-textarea" id="npcFrases" rows="2"></textarea></div>
    <div class="form-group"><label class="form-label">📖 História</label><textarea class="form-textarea" id="npcHistoria" rows="3"></textarea></div>
    <hr style="border-color:var(--line);margin:16px 0">
    <div style="font-weight:800;color:var(--primary);margin-bottom:10px">🎁 Loot / Informações</div>
    <div class="form-group"><label class="form-label">Itens</label><textarea class="form-textarea" id="npcItens" rows="2"></textarea></div>
    <div class="form-group"><label class="form-label">Luns</label><input type="text" class="form-input" id="npcLuns"></div>
    <div class="form-group"><label class="form-label">Pistas</label><textarea class="form-textarea" id="npcPistas" rows="2"></textarea></div>
    <div class="form-group"><label class="form-label">Complicações</label><textarea class="form-textarea" id="npcComplicacoes" rows="2"></textarea></div>
    <div id="creatureFieldsSection" style="display:none"><hr style="border-color:var(--line);margin:16px 0"><div style="font-weight:800;color:var(--warning);margin-bottom:10px">🐉 Campos de Criatura</div>
        <div class="form-group"><label class="form-label">Habitat</label><input type="text" class="form-input" id="npcHabitat"></div>
        <div class="form-group"><label class="form-label">Comportamento</label><textarea class="form-textarea" id="npcComportamento" rows="2"></textarea></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div class="form-group"><label class="form-label">Dieta</label><input type="text" class="form-input" id="npcDieta"></div>
            <div class="form-group"><label class="form-label">Nível de Ameaça</label><select class="form-select" id="npcNivelAmeaca"><option value="">Selecione</option><option value="inofensivo">Inofensivo</option><option value="baixo">Baixo</option><option value="medio">Médio</option><option value="alto">Alto</option><option value="letal">Letal</option></select></div>
        </div>
    </div>
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:20px"><button class="btn btn-secondary" onclick="closeNpcModal()">Cancelar</button><button class="btn btn-success" onclick="saveNpc()">💾 Salvar</button></div>`;
}

function fillNpcForm(n) {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ?? ''; };
    set('npcImagem', n.imagem); set('npcNome', n.nome); set('npcTipo', n.tipo||'npc'); set('npcRaca', n.raca); set('npcPorte', n.porte); set('npcPapel', n.papel); set('npcLocal', n.local); set('npcTribo', n.tribo); set('npcAI', n.ai||0); set('npcClasse', n.classe); set('npcTamanho', n.tamanho); set('npcTags', n.tags);
    ['INT','RAC','PRS','FOR','DES','VIG','PRE','MAN','AUT'].forEach(a => set('npc'+a, n.atributos?.[a]||0));
    ['VIT','PERC','INI','ENER','REA','BLD','SAN'].forEach(v => set('npc'+v, n.valoresDer?.[v]||0));
    set('npcDESLOCAMENTO', n.valoresDer?.DESLOCAMENTO); set('npcAtaques', n.ataques); set('npcSkills', n.skills);
    set('npcPersonalidade1', n.rolePlay?.personalidade?.[0]); set('npcPersonalidade2', n.rolePlay?.personalidade?.[1]); set('npcPersonalidade3', n.rolePlay?.personalidade?.[2]);
    set('npcTrejeitos', n.rolePlay?.trejeitos); set('npcMotivacao', n.rolePlay?.motivacao); set('npcSegredos', n.rolePlay?.segredos);
    set('npcAliado', n.rolePlay?.relacoes?.aliado); set('npcRival', n.rolePlay?.relacoes?.rival); set('npcDevedor', n.rolePlay?.relacoes?.devedor);
    set('npcFrases', n.rolePlay?.frases); set('npcHistoria', n.rolePlay?.historia);
    set('npcItens', n.loot?.itens); set('npcLuns', n.loot?.luns); set('npcPistas', n.loot?.pistas); set('npcComplicacoes', n.loot?.complicacoes);
    set('npcHabitat', n.criatura?.habitat); set('npcComportamento', n.criatura?.comportamento); set('npcDieta', n.criatura?.dieta); set('npcNivelAmeaca', n.criatura?.nivelAmeaca);
    const cs = document.getElementById('creatureFieldsSection'); if (cs) cs.style.display = n.tipo === 'criatura' ? 'block' : 'none';
    if (n.imagem?.startsWith('http')) { const p = document.getElementById('npcImgPreview'); const img = document.getElementById('npcImgTag'); if (p && img) { img.src = n.imagem; p.style.display = 'block'; img.onerror = () => { p.style.display = 'none'; }; } }
}

function collectNpcData() {
    const g = id => document.getElementById(id)?.value?.trim() || '';
    const gi = id => parseInt(document.getElementById(id)?.value) || 0;
    const tipo = g('npcTipo') || 'npc';
    return { nome: g('npcNome'), tipo, imagem: g('npcImagem'), raca: g('npcRaca'), porte: g('npcPorte'), papel: g('npcPapel'), local: g('npcLocal'), tribo: g('npcTribo'), ai: gi('npcAI'), classe: g('npcClasse'), tamanho: g('npcTamanho'), tags: g('npcTags'),
        atributos: { INT:gi('npcINT'), RAC:gi('npcRAC'), PRS:gi('npcPRS'), FOR:gi('npcFOR'), DES:gi('npcDES'), VIG:gi('npcVIG'), PRE:gi('npcPRE'), MAN:gi('npcMAN'), AUT:gi('npcAUT') },
        valoresDer: { VIT:gi('npcVIT'), PERC:gi('npcPERC'), INI:gi('npcINI'), ENER:gi('npcENER'), REA:gi('npcREA'), BLD:gi('npcBLD'), DESLOCAMENTO:g('npcDESLOCAMENTO'), SAN:gi('npcSAN') },
        ataques: g('npcAtaques'), skills: g('npcSkills'),
        rolePlay: { personalidade: [g('npcPersonalidade1'), g('npcPersonalidade2'), g('npcPersonalidade3')], trejeitos: g('npcTrejeitos'), motivacao: g('npcMotivacao'), segredos: g('npcSegredos'), relacoes: { aliado: g('npcAliado'), rival: g('npcRival'), devedor: g('npcDevedor') }, frases: g('npcFrases'), historia: g('npcHistoria') },
        loot: { itens: g('npcItens'), luns: g('npcLuns'), pistas: g('npcPistas'), complicacoes: g('npcComplicacoes') },
        criatura: tipo === 'criatura' ? { habitat: g('npcHabitat'), comportamento: g('npcComportamento'), dieta: g('npcDieta'), nivelAmeaca: g('npcNivelAmeaca') } : null,
        lastUpdate: new Date().toISOString(), lastUpdateBy: S.currentUser?.email };
}

window.saveNpc = async function() {
    const data = collectNpcData(); if (!data.nome) { showAlert('⚠️ Nome obrigatório', 'warning'); return; }
    try {
        if (currentEditingNpc) { await setDoc(doc(db, 'npcs', currentEditingNpc.id), data, { merge: true }); await addLog(S.currentUser?.email, 'Editou NPC', data.nome, 'npcs'); showAlert('✅ NPC atualizado!', 'success'); }
        else { await setDoc(doc(collection(db, 'npcs')), data); await addLog(S.currentUser?.email, 'Criou NPC', data.nome, 'npcs'); showAlert('✅ NPC criado!', 'success'); }
        closeNpcModal(); await loadAllNpcs(); if (window._loadMesaNpcs) await window._loadMesaNpcs();
    } catch (e) { console.error(e); showAlert('❌ Erro ao salvar', 'danger'); }
};

window.closeNpcModal = function() { document.getElementById('npcModal')?.classList.remove('active'); currentEditingNpc = null; };

window.deleteCurrentNpc = async function() {
    if (!currentEditingNpc || !confirm(`Deletar "${currentEditingNpc.nome}"?`)) return;
    try { await deleteDoc(doc(db, 'npcs', currentEditingNpc.id)); await addLog(S.currentUser?.email, 'Deletou NPC', currentEditingNpc.nome, 'npcs'); showAlert('✅ Deletado', 'success'); closeNpcModal(); await loadAllNpcs(); if (window._loadMesaNpcs) await window._loadMesaNpcs(); } catch (e) { showAlert('❌ Erro', 'danger'); }
};

// ===== BATCH =====
window.selectAllFilteredNpcs = function() { const cbs = document.querySelectorAll('.npc-checkbox'); const all = Array.from(cbs).every(c=>c.checked); cbs.forEach(c=>{c.checked=!all}); showAlert(`☑️ ${cbs.length} ${all?'desselecionados':'selecionados'}`, 'success'); };

window.deleteSelectedNpcs = async function() {
    const cbs = document.querySelectorAll('.npc-checkbox:checked'); if (!cbs.length) { showAlert('⚠️ Selecione NPCs', 'warning'); return; }
    const names = Array.from(cbs).map(cb => S.allNpcs.find(n=>n.id===cb.dataset.npcId)?.nome||'-');
    if (!confirm(`Deletar ${cbs.length} NPC(s)?\n${names.join('\n')}`)) return;
    try { for (const cb of cbs) { await deleteDoc(doc(db, 'npcs', cb.dataset.npcId)); await addLog(S.currentUser?.email, 'Deletou NPC', names.shift(), 'npcs'); } showAlert(`✅ ${cbs.length} deletado(s)`, 'success'); await loadAllNpcs(); } catch (e) { showAlert('❌ Erro', 'danger'); }
};

window.duplicateSelectedNpcs = async function() {
    const cbs = document.querySelectorAll('.npc-checkbox:checked'); if (!cbs.length) { showAlert('⚠️ Selecione NPCs', 'warning'); return; }
    if (!confirm(`Duplicar ${cbs.length} NPC(s)?`)) return;
    let c = 0;
    try { for (const cb of cbs) { const n = S.allNpcs.find(x=>x.id===cb.dataset.npcId); if (!n) continue; const copy = {...n, nome: n.nome+' (Cópia)', lastUpdate: new Date().toISOString(), lastUpdateBy: S.currentUser?.email}; delete copy.id; await setDoc(doc(collection(db, 'npcs')), copy); await addLog(S.currentUser?.email, 'Duplicou NPC', `${n.nome} → ${copy.nome}`, 'npcs'); c++; } showAlert(`✅ ${c} duplicado(s)`, 'success'); await loadAllNpcs(); } catch (e) { showAlert('❌ Erro', 'danger'); }
};

window.exportSelectedNpcs = async function() {
    const cbs = document.querySelectorAll('.npc-checkbox:checked'); if (!cbs.length) { showAlert('⚠️ Selecione NPCs', 'warning'); return; }
    const data = Array.from(cbs).map(cb => { const n = S.allNpcs.find(x=>x.id===cb.dataset.npcId); return n ? {...n, exportDate: new Date().toISOString(), exportedBy: S.currentUser?.email} : null; }).filter(Boolean);
    const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `npcs_${Date.now()}.json`; document.body.appendChild(a); a.click(); document.body.removeChild(a);
    showAlert(`✅ ${data.length} exportado(s)`, 'success');
};

window.exportNpcFromForm = function() {
    const data = collectNpcData(); data.exportDate = new Date().toISOString(); data.exportedBy = S.currentUser?.email;
    const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `npc_${(data.nome||'sem_nome').replace(/\s+/g,'_')}_${Date.now()}.json`; document.body.appendChild(a); a.click(); document.body.removeChild(a);
    showAlert('✅ Exportado!', 'success');
};

window.bulkImportNpcs = function() {
    let fi = document.getElementById('npcBulkFile');
    if (!fi) { fi = document.createElement('input'); fi.type='file'; fi.id='npcBulkFile'; fi.accept='.json'; fi.multiple=true; fi.style.display='none'; document.body.appendChild(fi);
        fi.addEventListener('change', async e => { const files = Array.from(e.target.files); if (!files.length) return; if (!confirm(`Importar ${files.length} arquivo(s)?`)) { fi.value=''; return; }
            let cr=0,up=0,er=0;
            for (const f of files) { try { const list = JSON.parse(await f.text()); const arr = Array.isArray(list)?list:[list];
                for (const d of arr) { try { delete d.id; delete d.firestoreId; delete d.exportDate; delete d.exportedBy; d.lastUpdate = new Date().toISOString(); d.lastUpdateBy = S.currentUser?.email;
                    const ex = S.allNpcs.find(n=>n.nome&&d.nome&&n.nome.toLowerCase().trim()===d.nome.toLowerCase().trim());
                    if (ex) { await setDoc(doc(db,'npcs',ex.id), d, {merge:true}); up++; } else { await addDoc(collection(db,'npcs'), d); cr++; }
                } catch(ie) { er++; } }
            } catch(fe) { er++; } }
            await loadAllNpcs(); showAlert(`✅ ${cr} criado(s), ${up} atualizado(s), ${er} erro(s)`, cr+up>0?'success':'danger'); fi.value='';
        });
    } fi.click();
};
