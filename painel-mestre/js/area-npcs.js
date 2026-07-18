// ÁREA NPCs — Full CRUD, Export/Import, Modal Form
import { db, collection, getDocs, setDoc, deleteDoc, doc, addDoc } from './firebase-config.js';
import * as S from './state.js';
import { showAlert, escapeHtml } from './ui-utils.js';
import { addLog } from './logs.js';
import { ensureNpcSystemData, pecsDaOrigem } from './npc-system-data.js?v=1.3';
import { calcularNpc, ATTR_SIGLAS } from './npc-calc-engine.js?v=1.3';
import './npc-inventario.js?v=1.0'; // Aba Inventário da Ficha de NPC (itens + partes do corpo)

let currentEditingNpc = null;
export async function onTabActivated() { await loadAllNpcs(); }

async function loadAllNpcs() {
    try {
        const snap = await getDocs(collection(db, 'npcs'));
        const npcs = []; 
        snap.forEach(d => {
            const data = d.data();
            npcs.push({ id: d.id, ...data });
        });
        S.setAllNpcs(npcs); window.restoreNpcFiltersState ? window.restoreNpcFiltersState() : window.filterNpcs();
    } catch (e) { console.error(e); showAlert('❌ Erro NPCs', 'danger'); }
}
window.loadAllNpcs = loadAllNpcs;

/* ===== TOOLTIP ENGINE PARA NPCS ===== */
let npcTooltipEl = null;
function ensureNpcTooltip() {
    if (!npcTooltipEl) {
        npcTooltipEl = document.createElement('div');
        npcTooltipEl.id = 'npcHoverTooltip';
        Object.assign(npcTooltipEl.style, {
            position: 'fixed', display: 'none', backgroundColor: 'var(--bg-panel, #1e1e2e)',
            color: 'var(--text, #e2e8f0)', border: '1px solid var(--primary, #8b5cf6)',
            borderRadius: '6px', padding: '10px 14px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            zIndex: '99999', maxWidth: '300px', pointerEvents: 'none', fontSize: '0.85rem',
            lineHeight: '1.4', transition: 'opacity 0.15s ease-in-out'
        });
        document.body.appendChild(npcTooltipEl);
    }
    return npcTooltipEl;
}
window.handleNpcTooltipEnter = function(event, el) {
    const title = el.getAttribute('data-tt-title');
    const desc = el.getAttribute('data-tt-desc');
    const extra = el.getAttribute('data-tt-extra');
    const tipEl = ensureNpcTooltip();
    let html = '';
    if (title) html += `<div style="font-weight:bold;margin-bottom:6px;color:var(--primary);font-size:0.95rem">${escapeHtml(title)}</div>`;
    if (desc) html += `<div style="margin-bottom:6px;color:var(--text-muted, #94a3b8)">${escapeHtml(desc)}</div>`;
    if (extra) html += `<div style="border-top:1px solid var(--line, #334155);padding-top:6px;margin-top:6px;font-size:0.8rem;white-space:pre-wrap;">${escapeHtml(extra)}</div>`;
    tipEl.innerHTML = html;
    tipEl.style.opacity = '0'; tipEl.style.display = 'block';
    window.moveNpcTooltip(event);
    void tipEl.offsetWidth; tipEl.style.opacity = '1';
};
window.hideNpcTooltip = function() {
    if (npcTooltipEl) {
        npcTooltipEl.style.opacity = '0';
        setTimeout(() => { if (npcTooltipEl.style.opacity === '0') npcTooltipEl.style.display = 'none'; }, 150);
    }
};
window.moveNpcTooltip = function(event) {
    if (!npcTooltipEl || npcTooltipEl.style.display === 'none') return;
    const rect = npcTooltipEl.getBoundingClientRect();
    let top = event.clientY + 15; let left = event.clientX + 15;
    if (left + rect.width > window.innerWidth) left = window.innerWidth - rect.width - 10;
    if (top + rect.height > window.innerHeight) top = event.clientY - rect.height - 10;
    npcTooltipEl.style.top = top + 'px'; npcTooltipEl.style.left = left + 'px';
};

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


// =====================================================================
// ===== FICHA DE NPC v2 — Modal =====
// Modo Rápido (manual) / Modo Mecânico (registros do Painel de Criador).
// Campos híbridos (registro OU personalizado), peculiaridades com nível,
// valores derivados calculados com override do mestre, e vínculos com
// mesas e personagens. Espelha campos legados (raca/classe/tribo strings
// e valoresDer.VIT/ENER/SAN...) para compatibilidade com combate/filtros.
// =====================================================================

// Estado do formulário aberto
// (exposto em window porque os handlers inline do modal rodam no escopo global)
const F = { npc: null, sys: null, calc: null };
window.F = F;

const PORTES = ['Minúsculo', 'Pequeno', 'Médio', 'Grande', 'Enorme', 'Colossal'];

/* ===== NORMALIZAÇÃO v1 → v2 ===== */
function hybFromLegacy(val, mapByNome, sys) {
    if (val && typeof val === 'object') return { refId: val.refId || null, custom: val.custom || '' };
    const s = String(val || '').trim();
    if (!s) return { refId: null, custom: '' };
    const match = mapByNome[sys.norm(s)];
    return match ? { refId: match.id, custom: '' } : { refId: null, custom: s };
}

function findDvKeyLike(sigla, sys) {
    const all = [...sys.vitalStats, ...sys.derivedValues];
    const s = sys.norm(sigla);
    let hit = all.find(d => sys.norm(d.key) === s || sys.norm(d.nome) === s);
    if (!hit) hit = all.find(d => sys.norm(d.key).startsWith(s) || sys.norm(d.nome).startsWith(s));
    return hit ? hit.key : null;
}

function normalizeNpc(raw, sys) {
    const n = JSON.parse(JSON.stringify(raw || {}));
    const v2 = n.schemaVersion >= 2;

    n.schemaVersion = 2;
    n.modoFicha = n.modoFicha || (v2 ? 'mecanico' : 'rapido');
    n.nivel = parseInt(n.nivel) || 1;
    n.atributos = n.atributos || {};
    n.peculiaridades = Array.isArray(n.peculiaridades) ? n.peculiaridades : [];
    n.periciasEstruturadas = Array.isArray(n.periciasEstruturadas) ? n.periciasEstruturadas : [];
    n.partesDoCorpo = Array.isArray(n.partesDoCorpo) ? n.partesDoCorpo : [];

    n.racaRef = n.racaRef || hybFromLegacy(n.raca, sys.racesByNome, sys);
    n.classeRef = n.classeRef || hybFromLegacy(n.classe, sys.classesByNome, sys);
    n.triboRef = n.triboRef || hybFromLegacy(n.tribo, sys.tribesByNome, sys);

    const vd = n.valoresDer || {};
    if (!vd.overrides) {
        // Migra números manuais legados para overrides nas keys do registro
        const overrides = {};
        const legacyMap = { VIT: 'VIT', ENER: 'ENER', SAN: 'SAN', PERC: 'PERC', INI: 'INI', REA: 'REA', BLD: 'BLD' };
        for (const [legacy] of Object.entries(legacyMap)) {
            const val = vd[legacy];
            if (val !== undefined && val !== null && val !== '' && Number(val) !== 0) {
                const key = findDvKeyLike(legacy, sys);
                if (key) overrides[key] = Number(val);
            }
        }
        n.valoresDer = { overrides, atual: {}, extras: [] };
        if (vd.DESLOCAMENTO) n.valoresDer.extras.push({ nome: 'Deslocamento', valor: String(vd.DESLOCAMENTO) });
    } else {
        n.valoresDer = { overrides: vd.overrides || {}, atual: vd.atual || {}, extras: vd.extras || [] };
    }

    if (!Array.isArray(n.vinculos)) {
        n.vinculos = n.mesaId ? [{ tipo: 'mesa', id: n.mesaId }] : [];
    }
    return n;
}

/* ===== HELPERS DE NOME ===== */
function hybNome(hyb, byId) {
    if (!hyb) return '';
    if (hyb.refId && byId[hyb.refId]) return byId[hyb.refId].nome || '';
    return hyb.custom || '';
}

/* ===== ABERTURA DO MODAL ===== */
window.openNpcModal = async function(npcId = null) {
    const modal = document.getElementById('npcModal'); if (!modal) return;
    const title = document.getElementById('npcModalTitle');
    const body = document.getElementById('npcModalBody');

    body.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted)">⏳ Carregando registros do sistema...</div>';
    modal.classList.add('active');

    try { F.sys = await ensureNpcSystemData(); }
    catch (e) { console.error(e); body.innerHTML = '<div style="color:var(--danger);padding:20px">❌ Erro ao carregar registros do sistema.</div>'; return; }

    if (npcId) {
        const raw = S.allNpcs.find(n => n.id === npcId);
        if (!raw) return;
        currentEditingNpc = raw;
        F.npc = normalizeNpc(raw, F.sys);
        title.textContent = 'Editar NPC / Criatura';
    } else {
        currentEditingNpc = null;
        F.npc = normalizeNpc({ tipo: 'npc', modoFicha: 'rapido' }, F.sys);
        title.textContent = 'Criar NPC / Criatura';
    }

    body.innerHTML = buildNpcForm();
    fillNpcForm(F.npc);
    recalcStats();
    npcSwitchSection('identidade');
};
window.openNpcEditModal = window.openNpcModal;

/* ===== CONSTRUÇÃO DO FORMULÁRIO ===== */
function buildNpcForm() {
    return `
    <div class="npcv2-toolbar">
        <div class="npcv2-mode-toggle" title="Rápido: preenchimento manual. Mecânico: usa raças, classes, tribos e peculiaridades dos registros, com cálculo automático.">
            <button type="button" id="modoRapidoBtn" class="npcv2-mode-btn" onclick="setNpcModo('rapido')">📝 Rápido</button>
            <button type="button" id="modoMecanicoBtn" class="npcv2-mode-btn" onclick="setNpcModo('mecanico')">⚙️ Mecânico</button>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-secondary btn-small" onclick="exportNpcFromForm()">📤 Exportar</button>
            <button class="btn btn-danger btn-small" onclick="deleteCurrentNpc()">🗑️ Excluir</button>
            <button class="btn btn-success btn-small" onclick="saveNpc()">💾 Salvar</button>
        </div>
    </div>

    <div class="npcv2-sections">
        <button type="button" class="npcv2-section-btn" data-sec="identidade" onclick="npcSwitchSection('identidade')">📋 Identidade</button>
        <button type="button" class="npcv2-section-btn" data-sec="mecanica" onclick="npcSwitchSection('mecanica')">⚙️ Mecânica</button>
        <button type="button" class="npcv2-section-btn" data-sec="inventario" onclick="npcSwitchSection('inventario')">🎒 Inventário</button>
        <button type="button" class="npcv2-section-btn" data-sec="roleplay" onclick="npcSwitchSection('roleplay')">🎭 Role Play</button>
        <button type="button" class="npcv2-section-btn" data-sec="loot" onclick="npcSwitchSection('loot')">🎁 Loot</button>
        <button type="button" class="npcv2-section-btn" data-sec="vinculos" onclick="npcSwitchSection('vinculos')">🔗 Vínculos</button>
    </div>

    <!-- ============ SEÇÃO: IDENTIDADE ============ -->
    <div class="npcv2-section" id="npcSec_identidade">
        <div class="form-group"><label class="form-label">🖼️ Imagem URL</label><input type="text" class="form-input" id="npcImagem" placeholder="https://..."><div id="npcImgPreview" style="display:none;margin-top:8px;text-align:center"><img id="npcImgTag" style="max-height:200px;border-radius:10px"></div></div>
        <div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:10px">
            <div class="form-group"><label class="form-label">Nome *</label><input type="text" class="form-input" id="npcNome" placeholder="Nome do NPC"></div>
            <div class="form-group"><label class="form-label">Tipo *</label><select class="form-select" id="npcTipo"><option value="npc">👤 NPC</option><option value="criatura">🐉 Criatura</option></select></div>
            <div class="form-group"><label class="form-label">Nível</label><input type="number" class="form-input" id="npcNivel" value="1" min="1" oninput="F_set('nivel',parseInt(this.value)||1);recalcStats()"></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
            ${hybridFieldHtml('raca', '🧬 Raça', 'races')}
            ${hybridFieldHtml('classe', '⚔️ Classe', 'classes')}
            ${hybridFieldHtml('tribo', '🏕️ Tribo', 'tribes')}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
            <div class="form-group"><label class="form-label">Porte</label><select class="form-select" id="npcPorte"><option value="">Selecione</option>${PORTES.map(p => `<option>${p}</option>`).join('')}</select></div>
            <div class="form-group"><label class="form-label">Papel</label><input type="text" class="form-input" id="npcPapel" placeholder="Comerciante, Guarda..."></div>
            <div class="form-group"><label class="form-label">Local</label><input type="text" class="form-input" id="npcLocal"></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div class="form-group"><label class="form-label">Tamanho</label><input type="text" class="form-input" id="npcTamanho"></div>
            <div class="form-group"><label class="form-label">🏷️ Tags (separadas por vírgula)</label><input type="text" class="form-input" id="npcTags" placeholder="tag1, tag2"></div>
        </div>
        <div class="form-group npcv2-funcoes npcv2-only-mecanico"><label class="form-label">Funções</label>
            <label class="npcv2-check"><input type="checkbox" id="npcFuncAliado" onchange="document.getElementById('npcAliadoProprioWrap').style.display = this.checked ? 'block' : 'none'"> 🤝 Aliado (poderá ser vinculado à ficha de personagens)</label>
            <div id="npcAliadoProprioWrap" style="display:none; margin-left: 24px; margin-top: 8px;">
                <label class="npcv2-check"><input type="checkbox" id="npcAliadoProprio"> É o próprio? <span class="npcv2-hint">(se OFF, a vinculação gera um clone independente)</span></label>
            </div>
        </div>
        <div id="creatureFieldsSection" style="display:none"><hr style="border-color:var(--line);margin:16px 0"><div style="font-weight:800;color:var(--warning);margin-bottom:10px">🐉 Campos de Criatura</div>
            <div class="form-group"><label class="form-label">Habitat</label><input type="text" class="form-input" id="npcHabitat"></div>
            <div class="form-group"><label class="form-label">Comportamento</label><textarea class="form-textarea" id="npcComportamento" rows="2"></textarea></div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
                <div class="form-group"><label class="form-label">Dieta</label><input type="text" class="form-input" id="npcDieta"></div>
                <div class="form-group"><label class="form-label">Nível de Ameaça</label><select class="form-select" id="npcNivelAmeaca"><option value="">Selecione</option><option value="inofensivo">Inofensivo</option><option value="baixo">Baixo</option><option value="medio">Médio</option><option value="alto">Alto</option><option value="letal">Letal</option></select></div>
            </div>
        </div>
    </div>

    <!-- ============ SEÇÃO: MECÂNICA ============ -->
    <div class="npcv2-section" id="npcSec_mecanica">
        <div id="npcPecsWrap" class="npcv2-only-mecanico">
            <div class="npcv2-block-title">🧬 Peculiaridades</div>
            <div id="npcPecsList"></div>
            <div class="npcv2-pec-add">
                <input type="text" class="form-input" id="pecSearch" placeholder="🔍 Buscar no registro..." oninput="renderPecPicker()">
                <select class="form-select" id="pecPicker"></select>
                <button class="btn btn-secondary btn-small" onclick="addPecFromRegistry()">➕ Do registro</button>
                <button class="btn btn-secondary btn-small" onclick="addPecCustom()">✏️ Personalizada</button>
            </div>
        </div>

        <div class="npcv2-block-title" style="margin-top:14px">💪 Atributos <span class="npcv2-hint" id="attrHint"></span></div>
        <div class="npcv2-attrs-grid" id="npcAttrsGrid">
            ${ATTR_SIGLAS.map(a => `
                <div class="npcv2-attr-cell">
                    <div class="npcv2-attr-label">${a}</div>
                    <input type="number" class="form-input npcv2-attr-input" id="npcAttr_${a}" value="0"
                        oninput="F.npc.atributos['${a}']=parseInt(this.value)||0;recalcStats()">
                    <div class="npcv2-attr-eff" id="npcAttrEff_${a}"></div>
                </div>`).join('')}
        </div>

        <div class="npcv2-block-title" style="margin-top:14px">❤️ Status Vitais
            <span class="npcv2-hint npcv2-only-mecanico">calculados pelas mecânicas — clique em um valor para travar um override 🔒</span>
        </div>
        <div class="npcv2-dv-grid" id="npcVitalStatsGrid"></div>

        <div class="npcv2-block-title" style="margin-top:14px">📊 Valores Derivados
            <span class="npcv2-hint npcv2-only-mecanico">calculados pelas mecânicas — clique em um valor para travar um override 🔒</span>
        </div>
        <div class="npcv2-dv-grid" id="npcDvGrid"></div>

        <div class="npcv2-block-title" style="margin-top:14px">➕ Valores extras <span class="npcv2-hint">informações fora dos registros</span></div>
        <div id="npcExtrasList"></div>
        <button class="btn btn-secondary btn-small" onclick="addExtraDv()">➕ Adicionar valor extra</button>

        <div id="npcInfosWrap" style="display:none">
            <div class="npcv2-block-title" style="margin-top:14px">📜 Efeitos e capacidades (das peculiaridades)</div>
            <div id="npcInfosList"></div>
        </div>
        <div id="npcAvisosWrap" style="display:none"><div id="npcAvisosList" class="npcv2-avisos"></div></div>

        <div class="form-group" style="margin-top:14px"><label class="form-label">⚔️ Ataques</label><textarea class="form-textarea" id="npcAtaques" rows="3" placeholder="Ataques e danos..."></textarea></div>
        <div class="form-group"><label class="form-label">📚 Perícias</label><textarea class="form-textarea" id="npcSkills" rows="2" placeholder="Perícias relevantes... (Texto Livre)"></textarea></div>

        <!-- ============ SEÇÃO: PERÍCIAS ESTRUTURADAS ============ -->
        <div id="npcStructuredSkillsWrap" style="margin-top: 14px;">
            <div class="npcv2-block-title" style="margin-bottom:8px">🎯 Perícias Estruturadas</div>
            
            <div class="npcv2-only-mecanico" style="margin-bottom:12px">
                <label class="npcv2-check">
                    <input type="checkbox" id="npcHasDefaultSkills" onchange="toggleDefaultSkills(this.checked)"> Tem todas as Perícias Padrões?
                </label>
            </div>
            
            <div class="npcv2-pec-add npcv2-only-mecanico" style="margin-bottom:12px; display:flex; gap:10px;">
                <select class="form-select" id="npcSkillPicker" style="flex:1"></select>
                <button class="btn btn-secondary btn-small" onclick="addSkillIndividual()">➕ Adicionar</button>
                
                <select class="form-select" id="npcSkillCategoryPicker" style="flex:1;">
                    <option value="">-- Adicionar por Categoria --</option>
                    <option value="físico">Físico</option>
                    <option value="mental">Mental</option>
                    <option value="social">Social</option>
                    <option value="exclusivo">Exclusivo</option>
                    <option value="combate">Combate</option>
                </select>
                <button class="btn btn-secondary btn-small" onclick="addSkillByCategory()">➕ Categoria</button>
            </div>
            
            <div class="npcv2-attrs-grid" id="npcStructuredSkillsGrid" style="grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));"></div>
        </div>
    </div>

    <!-- ============ SEÇÃO: INVENTÁRIO ============ -->
    <div class="npcv2-section" id="npcSec_inventario">
        <div class="npcv2-block-title">🦴 Partes do Corpo & Slots
            <span class="npcv2-hint">NPCs comuns usam a anatomia padrão (humanoide); criaturas podem ter anatomias personalizadas</span>
        </div>
        <div class="npcv2-pec-add" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">
            <button class="btn btn-secondary btn-small" onclick="npcApplyDefaultBodyParts()" title="Aplica as partes marcadas como padrão no Painel de Criador (mesmas de Humano)">🧍 Aplicar Padrão Humanoide</button>
            <select class="form-select" id="npcBodyPartPicker" style="max-width:220px"></select>
            <button class="btn btn-secondary btn-small" onclick="npcAddBodyPartFromRegistry()">➕ Do registro</button>
            <button class="btn btn-secondary btn-small" onclick="npcAddBodyPartCustom()">✏️ Parte personalizada</button>
        </div>
        <div id="npcBodyPartsList"></div>

        <hr style="border-color:var(--line);margin:16px 0">

        <div class="npcv2-block-title">🎒 Itens do NPC
            <span class="npcv2-hint">criação e gerenciamento completo — os itens ficam na coleção de itens e podem ser transferidos</span>
        </div>
        <div id="npcInventoryList"></div>
    </div>

    <!-- ============ SEÇÃO: ROLE PLAY ============ -->
    <div class="npcv2-section" id="npcSec_roleplay">
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
    </div>

    <!-- ============ SEÇÃO: LOOT ============ -->
    <div class="npcv2-section" id="npcSec_loot">
        <div class="form-group"><label class="form-label">Itens</label><textarea class="form-textarea" id="npcItens" rows="2"></textarea></div>
        <div class="form-group"><label class="form-label">Luns</label><input type="text" class="form-input" id="npcLuns"></div>
        <div class="form-group"><label class="form-label">Pistas</label><textarea class="form-textarea" id="npcPistas" rows="2"></textarea></div>
        <div class="form-group"><label class="form-label">Complicações</label><textarea class="form-textarea" id="npcComplicacoes" rows="2"></textarea></div>
    </div>

    <!-- ============ SEÇÃO: VÍNCULOS ============ -->
    <div class="npcv2-section" id="npcSec_vinculos">
        <div class="npcv2-block-title">🗺️ Mesas</div>
        <div id="npcVincMesas" class="npcv2-vinc-list"><div style="color:var(--muted);font-size:.85rem">Carregando mesas...</div></div>
        
        <div class="npcv2-block-title" style="margin-top:14px; color: var(--primary);">🤝 Aliados (Personagens)</div>
        <div id="npcVincAliados"></div>
        <div class="npcv2-pec-add" style="margin-top:8px; display:flex; gap:10px;">
            <select class="form-select" id="vincAliadoMesaPicker" style="max-width:180px" onchange="filterVincAliadoChars(this.value)"><option value="">Filtrar Mesa...</option></select>
            <select class="form-select" id="vincAliadoCharPicker" style="flex:1"><option value="">Selecione a Mesa primeiro...</option></select>
            <button class="btn btn-primary btn-small" onclick="addVincAliado()">➕ Vincular como Aliado</button>
        </div>
        <div class="npcv2-hint" style="margin-top:4px">O sistema respeitará a configuração "É o próprio?" da aba Identidade (Mecânico).</div>

        <div class="npcv2-block-title" style="margin-top:14px">👥 Vínculos Gerais (Não Aliados)</div>
        <div id="npcVincChars"></div>
        <div class="npcv2-pec-add" style="margin-top:8px; display:flex; gap:10px;">
            <select class="form-select" id="vincCharPicker" style="flex:1"><option value="">Carregando personagens...</option></select>
            <input type="text" class="form-input" id="vincCharRelacao" style="flex:1" placeholder="Relação (Mentor, Irmã...)">
            <button class="btn btn-secondary btn-small" onclick="addVincChar()">➕ Vincular</button>
        </div>
        <div class="npcv2-hint" style="margin-top:4px">Vínculos criados na criação de personagem aparecerão aqui com a origem "criação".</div>
    </div>

    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:20px"><button class="btn btn-secondary" onclick="closeNpcModal()">Cancelar</button><button class="btn btn-success" onclick="saveNpc()">💾 Salvar</button></div>`;
}

/* ===== CAMPO HÍBRIDO (registro OU personalizado) ===== */
function hybridFieldHtml(campo, label, colName) {
    const opts = (F.sys[colName] || [])
        .slice().sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
        .map(r => `<option value="${r.id}">${escapeHtml(r.nome || 'Sem nome')}</option>`).join('');
    return `
    <div class="form-group">
        <label class="form-label">${label}</label>
        <select class="form-select npcv2-only-mecanico" id="npcHybSel_${campo}" onchange="onHybSelChange('${campo}')">
            <option value="">— Nenhuma —</option>
            ${opts}
            <option value="__custom__">✏️ Outra (personalizada)...</option>
        </select>
        <input type="text" class="form-input" id="npcHybCustom_${campo}" placeholder="Digite o nome..." style="display:none;margin-top:6px"
            oninput="onHybCustomInput('${campo}',this.value)">
    </div>`;
}

window.onHybCustomInput = function(campo, valor) {
    const ref = F.npc[campo + 'Ref'];
    ref.custom = valor;
    // No modo rápido o texto livre substitui a referência do registro
    if (F.npc.modoFicha === 'rapido' && ref.refId) {
        const prev = ref.refId;
        ref.refId = null;
        syncInheritedPecs(campo, prev, null);
        renderPecs();
        recalcStats();
    }
};

window.onHybSelChange = function(campo) {
    const sel = document.getElementById(`npcHybSel_${campo}`);
    const custom = document.getElementById(`npcHybCustom_${campo}`);
    const ref = F.npc[campo + 'Ref'];
    const prevRefId = ref.refId;

    if (sel.value === '__custom__') {
        ref.refId = null;
        custom.style.display = 'block';
        custom.value = ref.custom || '';
    } else {
        ref.refId = sel.value || null;
        ref.custom = '';
        custom.style.display = 'none';
        custom.value = '';
    }
    if (campo !== 'porte') syncInheritedPecs(campo, prevRefId, ref.refId);
    renderPecs();
    recalcStats();
};

/* Sincroniza peculiaridades herdadas quando a origem muda */
function syncInheritedPecs(fonte, prevRefId, newRefId) {
    if (prevRefId === newRefId) return;
    F.npc.peculiaridades = F.npc.peculiaridades.filter(p => p.fonte !== fonte);
    if (newRefId) {
        const herdadas = pecsDaOrigem(fonte, newRefId, F.sys);
        for (const h of herdadas) {
            if (!F.npc.peculiaridades.some(p => p.refId === h.refId)) F.npc.peculiaridades.push(h);
        }
    }
}

/* ===== MODO RÁPIDO / MECÂNICO ===== */
window.setNpcModo = function(modo) {
    F.npc.modoFicha = modo;
    const body = document.getElementById('npcModalBody');
    body.classList.toggle('npcv2-modo-rapido', modo === 'rapido');
    document.getElementById('modoRapidoBtn')?.classList.toggle('active', modo === 'rapido');
    document.getElementById('modoMecanicoBtn')?.classList.toggle('active', modo === 'mecanico');

    // No modo rápido, os híbridos viram texto livre
    ['raca', 'classe', 'tribo'].forEach(campo => {
        const custom = document.getElementById(`npcHybCustom_${campo}`);
        const sel = document.getElementById(`npcHybSel_${campo}`);
        if (!custom || !sel) return;
        if (modo === 'rapido') {
            custom.style.display = 'block';
            custom.value = hybNome(F.npc[campo + 'Ref'], campo === 'raca' ? F.sys.racesById : campo === 'classe' ? F.sys.classesById : F.sys.tribesById);
        } else {
            const isCustom = !F.npc[campo + 'Ref'].refId && F.npc[campo + 'Ref'].custom;
            sel.value = F.npc[campo + 'Ref'].refId || (isCustom ? '__custom__' : '');
            custom.style.display = isCustom ? 'block' : 'none';
            custom.value = F.npc[campo + 'Ref'].custom || '';
        }
    });
    renderStructuredSkills();
    recalcStats();
};

/* ===== PECULIARIDADES ===== */
function renderPecs() {
    const el = document.getElementById('npcPecsList'); if (!el) return;
    if (!F.npc.peculiaridades.length) {
        el.innerHTML = '<div style="color:var(--muted);font-size:.85rem;padding:6px 0">Nenhuma peculiaridade. Selecione uma raça/classe/tribo do registro ou adicione abaixo.</div>';
        return;
    }
    el.innerHTML = F.npc.peculiaridades.map((p, idx) => {
        const reg = p.refId ? F.sys.pecsById[p.refId] : null;
        const nome = reg ? reg.nome : (p.nomeCustom || 'Sem nome');
        const icone = reg ? (reg.icone || '📋') : '✏️';
        const fonte = p.fonte ? `<span class="npcv2-pec-fonte">${escapeHtml(p.fonte)}</span>` : (reg ? '' : '<span class="npcv2-pec-fonte">custom</span>');
        const desc = reg ? (reg.descricao || '') : [p.efeitoManual, p.descricao].filter(Boolean).join(' — ');
        // Nível editável quando a peculiaridade tem mecânica evoluível (ou é custom com nível)
        const evoluivel = reg ? (reg.mecanicaIds || []).some(id => F.sys.mechsById[id]?.evoluivel) : false;
        const nivelHtml = evoluivel
            ? `<span class="npcv2-pec-nivel">Nv <input type="number" min="1" value="${p.nivel || 1}" onchange="F.npc.peculiaridades[${idx}].nivel=parseInt(this.value)||1;recalcStats()"></span>`
            : '';
        return `<div class="npcv2-pec-row" title="${escapeHtml(desc)}">
            <span class="npcv2-pec-nome">${icone} ${escapeHtml(nome)}</span>${fonte}${nivelHtml}
            <button class="npcv2-pec-del" onclick="F.npc.peculiaridades.splice(${idx},1);renderPecs();recalcStats()" title="Remover">✕</button>
        </div>`;
    }).join('');
}

window.renderPecs = renderPecs;

window.renderPecPicker = function() {
    const sel = document.getElementById('pecPicker'); if (!sel) return;
    const q = F.sys.norm(document.getElementById('pecSearch')?.value || '');
    const used = new Set(F.npc.peculiaridades.map(p => p.refId).filter(Boolean));
    const list = F.sys.peculiarities
        .filter(p => !used.has(p.id) && (!q || F.sys.norm(p.nome).includes(q) || F.sys.norm(p.fonte || '').includes(q)))
        .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
        .slice(0, 200);
    sel.innerHTML = list.length
        ? list.map(p => `<option value="${p.id}">${escapeHtml(p.nome)}${p.fonte ? ` — ${escapeHtml(p.fonte)}` : ''}</option>`).join('')
        : '<option value="">Nenhum resultado</option>';
};

window.addPecFromRegistry = function() {
    const id = document.getElementById('pecPicker')?.value;
    if (!id || !F.sys.pecsById[id]) return;
    F.npc.peculiaridades.push({ refId: id, nivel: 1, fonte: null });
    renderPecs(); renderPecPicker(); recalcStats();
};

window.addPecCustom = function() {
    const nome = prompt('Nome da peculiaridade personalizada:');
    if (!nome || !nome.trim()) return;
    const efeito = prompt('Efeito (texto livre, opcional):') || '';
    F.npc.peculiaridades.push({ refId: null, nomeCustom: nome.trim(), efeitoManual: efeito.trim(), nivel: 1 });
    renderPecs(); recalcStats();
};

/* ===== RECÁLCULO E RENDER DE STATS ===== */
window.recalcStats = function() {
    if (!F.npc || !F.sys) return;
    F.calc = calcularNpc(F.npc, F.sys);
    renderAttrEffects();
    renderDvGrid();
    renderInfos();
};

function renderAttrEffects() {
    let anyBonus = false;
    for (const a of ATTR_SIGLAS) {
        const eff = document.getElementById('npcAttrEff_' + a); if (!eff) continue;
        const r = F.calc.attrs[a];
        if (r && r.bonus !== 0) {
            anyBonus = true;
            const tip = r.fontes.map(f => `${f.fonte}: ${f.texto}`).join('\n');
            eff.innerHTML = `<span title="${escapeHtml(tip)}">→ <strong>${r.final}</strong> (${r.bonus > 0 ? '+' : ''}${r.bonus})</span>`;
        } else eff.innerHTML = '';
    }
    const hint = document.getElementById('attrHint');
    if (hint) hint.textContent = anyBonus ? 'base → efetivo (com bônus de mecânicas)' : '';
}

function renderDvGrid() {
    const vGrid = document.getElementById('npcVitalStatsGrid');
    const dGrid = document.getElementById('npcDvGrid');
    if (!vGrid || !dGrid) return;
    
    const rapido = F.npc.modoFicha === 'rapido';
    const allDvs = Object.values(F.calc.derived);
    const vitals = allDvs.filter(dv => dv.isVital);
    const dvs = allDvs.filter(dv => !dv.isVital);

    const renderFn = (list, container, emptyMsg) => {
        if (!list.length) { container.innerHTML = `<div style="color:var(--muted);font-size:.85rem">${emptyMsg}</div>`; return; }
        container.innerHTML = list.map(dv => {
            const locked = dv.override !== null;
            const sysRef = (F.sys.vitalStats || []).find(x => x.key === dv.key) || (F.sys.derivedValues || []).find(x => x.key === dv.key) || {};
            const desc = sysRef.descricao || 'Sem descrição cadastrada.';
            const tip = dv.fontes.length ? dv.fontes.map(f => `${f.fonte}: ${f.texto}`).join('\n') : 'Sem mecânicas aplicáveis (base 0)';
            const editable = rapido || locked;
            const atual = dv.campoAtual
                ? `<input type="number" class="npcv2-dv-atual" title="Valor atual" placeholder="atual"
                     value="${F.npc.valoresDer.atual?.[dv.key] ?? ''}"
                     oninput="F.npc.valoresDer.atual['${dv.key}']=this.value===''?null:parseFloat(this.value)">`
                : '';
            return `<div class="npcv2-dv-cell ${locked ? 'locked' : ''}" data-dvkey="${dv.key}">
                <div class="npcv2-dv-label" 
                     data-tt-title="${escapeHtml(dv.nome)}" 
                     data-tt-desc="${escapeHtml(desc)}" 
                     data-tt-extra="${escapeHtml(tip)}"
                     onmouseenter="handleNpcTooltipEnter(event, this)" 
                     onmouseleave="hideNpcTooltip()" 
                     onmousemove="moveNpcTooltip(event)">
                     ${dv.icone ? dv.icone + ' ' : ''}${escapeHtml(dv.nome)}${locked ? ' 🔒' : ''}
                </div>
                <div class="npcv2-dv-value">
                    <input type="number" class="form-input npcv2-dv-input" value="${dv.final}" ${editable ? '' : 'readonly'}
                        onfocus="if(!${rapido}&&!${locked})startDvOverride('${dv.key}',this)"
                        oninput="setDvOverride('${dv.key}',this.value)"
                        onchange="recalcStats()">
                    ${locked ? `<button class="npcv2-dv-reset" title="Voltar ao cálculo automático (${dv.auto})" onclick="clearDvOverride('${dv.key}')">↺</button>` : ''}
                </div>
                ${atual}
            </div>`;
        }).join('');
    };

    renderFn(vitals, vGrid, 'Nenhum status vital cadastrado no Painel de Criador.');
    renderFn(dvs, dGrid, 'Nenhum valor derivado cadastrado no Painel de Criador.');

    renderExtras();
}

window.startDvOverride = function(key, input) {
    // Primeiro clique em um valor automático (modo mecânico) trava o override
    F.npc.valoresDer.overrides[key] = F.calc.derived[key]?.auto ?? 0;
    recalcStats();
    // devolve o foco ao input recém-renderizado
    setTimeout(() => {
        const cell = document.querySelector(`.npcv2-dv-cell[data-dvkey="${key}"] .npcv2-dv-input`);
        if (cell) { cell.focus(); cell.select(); }
    }, 0);
};

window.setDvOverride = function(key, val) {
    if (val === '') delete F.npc.valoresDer.overrides[key];
    else F.npc.valoresDer.overrides[key] = parseFloat(val) || 0;
    // Não re-renderiza a grid inteira durante a digitação; só marca lock
    const cell = document.querySelector(`.npcv2-dv-cell[data-dvkey="${key}"]`);
    if (cell) cell.classList.add('locked');
};

window.clearDvOverride = function(key) {
    delete F.npc.valoresDer.overrides[key];
    recalcStats();
};

/* ===== VALORES EXTRAS ===== */
function renderExtras() {
    const el = document.getElementById('npcExtrasList'); if (!el) return;
    el.innerHTML = (F.npc.valoresDer.extras || []).map((x, idx) => `
        <div class="npcv2-extra-row">
            <input type="text" class="form-input" placeholder="Nome (ex: Deslocamento)" value="${escapeHtml(x.nome || '')}"
                oninput="F.npc.valoresDer.extras[${idx}].nome=this.value">
            <input type="text" class="form-input" placeholder="Valor" value="${escapeHtml(String(x.valor ?? ''))}"
                oninput="F.npc.valoresDer.extras[${idx}].valor=this.value">
            <button class="npcv2-pec-del" onclick="F.npc.valoresDer.extras.splice(${idx},1);renderExtras()">✕</button>
        </div>`).join('');
}

window.renderExtras = renderExtras;

window.addExtraDv = function() {
    F.npc.valoresDer.extras = F.npc.valoresDer.extras || [];
    F.npc.valoresDer.extras.push({ nome: '', valor: '' });
    renderExtras();
};

/* ===== INFOS E AVISOS ===== */
function renderInfos() {
    const wrap = document.getElementById('npcInfosWrap'), list = document.getElementById('npcInfosList');
    if (wrap && list) {
        if (F.calc.infos.length) {
            wrap.style.display = 'block';
            list.innerHTML = F.calc.infos.map(i => `<div class="npcv2-info-row">${i.icone || '📋'} <strong>${escapeHtml(i.fonte)}:</strong> ${escapeHtml(i.texto)}</div>`).join('');
        } else wrap.style.display = 'none';
    }
    const aw = document.getElementById('npcAvisosWrap'), al = document.getElementById('npcAvisosList');
    if (aw && al) {
        if (F.calc.avisos.length) { aw.style.display = 'block'; al.innerHTML = F.calc.avisos.map(a => `<div>⚠️ ${escapeHtml(a)}</div>`).join(''); }
        else aw.style.display = 'none';
    }
}

/* ===== VÍNCULOS ===== */
async function loadVinculosUI() {
    // Mesas
    const mesasEl = document.getElementById('npcVincMesas');
    try {
        let mesas = S.allMesas && S.allMesas.length ? S.allMesas : null;
        if (!mesas) {
            const snap = await getDocs(collection(db, 'mesas'));
            mesas = []; snap.forEach(d => mesas.push({ id: d.id, ...d.data() }));
        }
        if (mesasEl) {
            mesasEl.innerHTML = mesas.length ? mesas.map(m => {
                const checked = F.npc.vinculos.some(v => v.tipo === 'mesa' && v.id === m.id);
                return `<label class="npcv2-check"><input type="checkbox" ${checked ? 'checked' : ''} onchange="toggleVincMesa('${m.id}',this.checked)"> 🗺️ ${escapeHtml(m.nome || 'Sem nome')}</label>`;
            }).join('') : '<div style="color:var(--muted);font-size:.85rem">Nenhuma mesa cadastrada.</div>';
        }
        
        const aliadoMesaPicker = document.getElementById('vincAliadoMesaPicker');
        if (aliadoMesaPicker) {
            aliadoMesaPicker.innerHTML = '<option value="">Filtrar Mesa...</option>' + 
                mesas.sort((a,b)=>(a.nome||'').localeCompare(b.nome||'')).map(m => `<option value="${m.id}">${escapeHtml(m.nome || 'Sem nome')}</option>`).join('');
        }
    } catch (e) { if (mesasEl) mesasEl.innerHTML = '<div style="color:var(--danger)">Erro ao carregar mesas.</div>'; }

    // Personagens
    const picker = document.getElementById('vincCharPicker');
    try {
        let chars = S.allCharacters && S.allCharacters.length ? S.allCharacters : null;
        if (!chars) {
            const q = S.currentMesaId 
                ? query(collection(db, 'char'), where('mesaId', '==', S.currentMesaId)) 
                : query(collection(db, 'char'), where('ownerUid', '==', S.currentUser?.uid || ''));
            const snap = await getDocs(q);
            chars = []; snap.forEach(d => { const raw = d.data(); const f = raw.fields || {}; chars.push({ id: d.id, nome: f.nome || raw.nome || 'Sem nome', jogador: raw.ownerEmail || f.jogador || '', mesaId: raw.mesaId || f.mesaId || '' }); });
        }
        window._npcVincChars = chars;
        if (picker) picker.innerHTML = '<option value="">Selecione um personagem...</option>' +
            chars.sort((a, b) => (a.nome || '').localeCompare(b.nome || '')).map(c => `<option value="${c.id}">${escapeHtml(c.nome || 'Sem nome')}${c.jogador ? ` (${escapeHtml(c.jogador)})` : ''}</option>`).join('');
    } catch (e) { if (picker) picker.innerHTML = '<option value="">Erro ao carregar personagens</option>'; }

    renderVincChars();
}

function renderVincChars() {
    const el = document.getElementById('npcVincChars'); if (!el) return;
    const vincs = F.npc.vinculos.filter(v => v.tipo === 'personagem' && String(v.relacao).toLowerCase() !== 'aliado');
    if (!vincs.length) { el.innerHTML = '<div style="color:var(--muted);font-size:.85rem;padding:6px 0">Nenhum personagem vinculado.</div>'; } else {
        el.innerHTML = vincs.map(v => {
            const c = (window._npcVincChars || []).find(x => x.id === v.id);
            const idx = F.npc.vinculos.indexOf(v);
            return `<div class="npcv2-pec-row">
                <span class="npcv2-pec-nome">👤 ${escapeHtml(c?.nome || v.id)}</span>
                ${v.origem ? `<span class="npcv2-pec-fonte">${escapeHtml(v.origem)}</span>` : ''}
                <input type="text" class="form-input npcv2-vinc-rel" placeholder="Relação" value="${escapeHtml(v.relacao || '')}"
                    oninput="F.npc.vinculos[${idx}].relacao=this.value">
                <button class="npcv2-pec-del" onclick="F.npc.vinculos.splice(${idx},1);window._renderVincChars()">✕</button>
            </div>`;
        }).join('');
    }
    window.renderVincAliados();
}
window._renderVincChars = renderVincChars;

window.renderVincAliados = function() {
    const el = document.getElementById('npcVincAliados'); if (!el) return;
    const vincs = F.npc.vinculos.filter(v => v.tipo === 'personagem' && String(v.relacao).toLowerCase() === 'aliado');
    if (!vincs.length) { el.innerHTML = '<div style="color:var(--muted);font-size:.85rem;padding:6px 0">Nenhum aliado vinculado.</div>'; return; }
    el.innerHTML = vincs.map(v => {
        const c = (window._npcVincChars || []).find(x => x.id === v.id);
        const idx = F.npc.vinculos.indexOf(v);
        return `<div class="npcv2-pec-row" style="background: rgba(var(--primary-rgb), 0.1); border: 1px solid var(--primary); padding-left: 10px;">
            <span class="npcv2-pec-nome" style="color: var(--primary);">🤝 ${escapeHtml(c?.nome || v.id)}</span>
            ${v.origem ? `<span class="npcv2-pec-fonte">${escapeHtml(v.origem)}</span>` : ''}
            <span style="font-size: 0.8rem; margin-left: auto; margin-right: 10px; color: var(--primary);">Aliado</span>
            <button class="npcv2-pec-del" onclick="F.npc.vinculos.splice(${idx},1);window._renderVincChars()">✕</button>
        </div>`;
    }).join('');
};

window.filterVincAliadoChars = function(mesaId) {
    const picker = document.getElementById('vincAliadoCharPicker');
    if (!picker || !window._npcVincChars) return;
    if (!mesaId) {
        picker.innerHTML = '<option value="">Selecione a Mesa primeiro...</option>';
        return;
    }
    const filtered = window._npcVincChars.filter(c => c.mesaId === mesaId);
    if (!filtered.length) {
        picker.innerHTML = '<option value="">Nenhum personagem nesta mesa.</option>';
        return;
    }
    picker.innerHTML = '<option value="">Selecione um personagem...</option>' +
        filtered.sort((a,b) => (a.nome||'').localeCompare(b.nome||'')).map(c => `<option value="${c.id}">${escapeHtml(c.nome||'Sem nome')}${c.jogador ? ` (${escapeHtml(c.jogador)})` : ''}</option>`).join('');
};

window.addVincAliado = async function() {
    const charId = document.getElementById('vincAliadoCharPicker')?.value;
    if (!charId) { showAlert('⚠️ Selecione um personagem', 'warning'); return; }

    const isProprio = document.getElementById('npcAliadoProprio')?.checked || false;
    
    // Se não for o próprio, gerar clone:
    if (!isProprio) {
        if (!confirm('Isto criará um CLONE INDEPENDENTE deste NPC para vincular a este personagem. Deseja prosseguir?')) return;
        
        try {
            const cloneData = JSON.parse(JSON.stringify(collectNpcData()));
            cloneData.isClone = true;
            cloneData.cloneOf = F.npc.id || null;
            
            // Adicionar vínculo de aliado ao clone
            cloneData.vinculos = cloneData.vinculos || [];
            cloneData.vinculos.push({ tipo: 'personagem', id: charId, relacao: 'Aliado', origem: 'manual' });
            
            const docRef = await addDoc(collection(db, 'npcs'), cloneData);
            showAlert('✅ Aliado vinculado com sucesso! (Cópia Independente Gerada)', 'success');
            document.getElementById('vincAliadoCharPicker').value = '';
        } catch (e) {
            console.error(e);
            showAlert('❌ Erro ao criar cópia do NPC', 'danger');
        }
    } else {
        // Vínculo no próprio NPC original
        if (F.npc.vinculos.some(v => v.tipo === 'personagem' && v.id === charId && String(v.relacao).toLowerCase() === 'aliado')) { 
            showAlert('⚠️ Personagem já é Aliado', 'warning'); return; 
        }
        F.npc.vinculos.push({ tipo: 'personagem', id: charId, relacao: 'Aliado', origem: 'manual' });
        showAlert('✅ Aliado vinculado à ficha original do NPC', 'success');
        document.getElementById('vincAliadoCharPicker').value = '';
        window._renderVincChars();
    }
};

window.toggleVincMesa = function(mesaId, checked) {
    F.npc.vinculos = F.npc.vinculos.filter(v => !(v.tipo === 'mesa' && v.id === mesaId));
    if (checked) F.npc.vinculos.push({ tipo: 'mesa', id: mesaId });
};

window.addVincChar = function() {
    const id = document.getElementById('vincCharPicker')?.value;
    if (!id) { showAlert('⚠️ Selecione um personagem', 'warning'); return; }
    if (F.npc.vinculos.some(v => v.tipo === 'personagem' && v.id === id)) { showAlert('⚠️ Já vinculado', 'warning'); return; }
    const relacao = document.getElementById('vincCharRelacao')?.value?.trim() || '';
    F.npc.vinculos.push({ tipo: 'personagem', id, relacao, origem: 'manual' });
    document.getElementById('vincCharRelacao').value = '';
    renderVincChars();
};

/* ===== NAVEGAÇÃO ENTRE SEÇÕES ===== */
window.npcSwitchSection = function(sec) {
    document.querySelectorAll('.npcv2-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.npcv2-section-btn').forEach(b => b.classList.toggle('active', b.dataset.sec === sec));
    document.getElementById('npcSec_' + sec)?.classList.add('active');
    if (sec === 'vinculos' && !window._npcVincLoaded) { window._npcVincLoaded = true; loadVinculosUI(); }
    if (sec === 'inventario' && typeof window._npcInvOnSectionOpen === 'function') { window._npcInvOnSectionOpen(); }
};

/* ===== PREENCHIMENTO DO FORMULÁRIO ===== */
function fillNpcForm(n) {
    window._npcVincLoaded = false;
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ?? ''; };

    set('npcImagem', n.imagem); set('npcNome', n.nome); set('npcTipo', n.tipo || 'npc');
    set('npcNivel', n.nivel || 1);
    set('npcPorte', n.porte); set('npcPapel', n.papel); set('npcLocal', n.local);
    set('npcTamanho', n.tamanho); set('npcTags', n.tags);
    const fa = document.getElementById('npcFuncAliado'); 
    if (fa) {
        fa.checked = (n.funcao || []).includes('aliado');
        const wrap = document.getElementById('npcAliadoProprioWrap');
        if (wrap) wrap.style.display = fa.checked ? 'block' : 'none';
    }
    const fap = document.getElementById('npcAliadoProprio');
    if (fap) fap.checked = !!n.aliadoProprio;

    ATTR_SIGLAS.forEach(a => set('npcAttr_' + a, n.atributos?.[a] || 0));
    set('npcAtaques', n.ataques); set('npcSkills', n.skills);

    set('npcPersonalidade1', n.rolePlay?.personalidade?.[0]); set('npcPersonalidade2', n.rolePlay?.personalidade?.[1]); set('npcPersonalidade3', n.rolePlay?.personalidade?.[2]);
    set('npcTrejeitos', n.rolePlay?.trejeitos); set('npcMotivacao', n.rolePlay?.motivacao); set('npcSegredos', n.rolePlay?.segredos);
    set('npcAliado', n.rolePlay?.relacoes?.aliado); set('npcRival', n.rolePlay?.relacoes?.rival); set('npcDevedor', n.rolePlay?.relacoes?.devedor);
    set('npcFrases', n.rolePlay?.frases); set('npcHistoria', n.rolePlay?.historia);

    set('npcItens', n.loot?.itens); set('npcLuns', n.loot?.luns); set('npcPistas', n.loot?.pistas); set('npcComplicacoes', n.loot?.complicacoes);
    set('npcHabitat', n.criatura?.habitat); set('npcComportamento', n.criatura?.comportamento); set('npcDieta', n.criatura?.dieta); set('npcNivelAmeaca', n.criatura?.nivelAmeaca);

    const cs = document.getElementById('creatureFieldsSection'); if (cs) cs.style.display = n.tipo === 'criatura' ? 'block' : 'none';
    document.getElementById('npcTipo')?.addEventListener('change', function() { const c = document.getElementById('creatureFieldsSection'); if (c) c.style.display = this.value === 'criatura' ? 'block' : 'none'; });
    document.getElementById('npcImagem')?.addEventListener('input', function() { const u = this.value.trim(), p = document.getElementById('npcImgPreview'); if (p) p.style.display = (u.startsWith('http') ? 'block' : 'none'); const img = document.getElementById('npcImgTag'); if (img) { img.src = u; img.onerror = () => { if (p) p.style.display = 'none'; }; } });
    if (n.imagem?.startsWith('http')) { const p = document.getElementById('npcImgPreview'); const img = document.getElementById('npcImgTag'); if (p && img) { img.src = n.imagem; p.style.display = 'block'; img.onerror = () => { p.style.display = 'none'; }; } }

    setNpcModo(n.modoFicha || 'rapido');
    renderPecs();
    renderPecPicker();
    renderSkillPickers();
    renderStructuredSkills();
}

/* ===== PERÍCIAS ESTRUTURADAS ===== */
window.renderSkillPickers = function() {
    const picker = document.getElementById('npcSkillPicker');
    if (!picker || !F.sys || !F.sys.skills) return;
    const skills = F.sys.skills.slice().sort((a,b) => (a.nome||'').localeCompare(b.nome||''));
    picker.innerHTML = '<option value="">-- Selecione uma Perícia --</option>' + 
        skills.map(s => `<option value="${s.id}">${escapeHtml(s.nome)} (${escapeHtml(s.categoria || '')})</option>`).join('');
};

window.renderStructuredSkills = function() {
    const grid = document.getElementById('npcStructuredSkillsGrid');
    if (!grid || !F.npc || !F.sys) return;
    const rapido = F.npc.modoFicha === 'rapido';
    
    // Atualiza checkbox de defaults
    const checkDefaults = document.getElementById('npcHasDefaultSkills');
    if (checkDefaults) {
        const defaultSkills = F.sys.skills.filter(s => s.todoPersonagem);
        const hasAllDefaults = defaultSkills.length > 0 && defaultSkills.every(ds => F.npc.periciasEstruturadas.some(ps => ps.refId === ds.id));
        checkDefaults.checked = hasAllDefaults;
    }

    if (!F.npc.periciasEstruturadas.length) {
        grid.innerHTML = '<div style="color:var(--muted);font-size:.85rem;">Nenhuma perícia adicionada.</div>';
        grid.style.display = 'block';
        return;
    }

    grid.style.display = 'block';

    const grouped = {};
    F.npc.periciasEstruturadas.forEach((ps, idx) => {
        const s = F.sys.skills.find(x => x.id === ps.refId);
        if (!s) return;
        const cat = s.categoria ? s.categoria.trim() : 'Outros';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push({ ps, s, idx });
    });

    const catKeys = Object.keys(grouped).sort((a,b) => a.localeCompare(b));

    let html = '';
    for (const cat of catKeys) {
        html += `<div style="margin-top:10px; margin-bottom: 5px; font-weight: bold; color: var(--primary); text-transform: uppercase; font-size: 0.8rem; border-bottom: 1px solid var(--line); padding-bottom: 3px;">${escapeHtml(cat)}</div>`;
        html += `<div class="npcv2-attrs-grid" style="grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); margin-bottom: 12px;">`;
        
        grouped[cat].sort((a,b) => (a.s.nome||'').localeCompare(b.s.nome||'')).forEach(item => {
            const { ps, s, idx } = item;
            html += `<div class="npcv2-attr-cell" style="flex-direction: row; align-items: center; justify-content: space-between; padding: 4px 8px;">
                <div class="npcv2-attr-label" style="text-align:left; flex:1; font-size: 0.85rem;" 
                     data-tt-title="${escapeHtml(s.nome)}"
                     data-tt-desc="${escapeHtml(s.descricao || 'Sem descrição.')}"
                     onmouseenter="handleNpcTooltipEnter(event, this)" 
                     onmouseleave="hideNpcTooltip()" 
                     onmousemove="moveNpcTooltip(event)">
                     ${escapeHtml(s.nome)}
                </div>
                <div style="display:flex; align-items:center; gap:5px;">
                    <input type="number" class="form-input npcv2-attr-input" value="${ps.nivel}" min="0" max="10" style="width:40px; height:24px; padding:2px;"
                        oninput="F.npc.periciasEstruturadas[${idx}].nivel=parseInt(this.value)||0;recalcStats()">
                    ${!rapido ? `<button type="button" class="npcv2-pec-del" onclick="removeSkill(${idx})" style="width:24px;height:24px;font-size:12px;margin:0;padding:0;">✕</button>` : ''}
                </div>
            </div>`;
        });
        
        html += `</div>`;
    }
    grid.innerHTML = html;
};

window.toggleDefaultSkills = function(checked) {
    const defaultSkills = F.sys.skills.filter(s => s.todoPersonagem);
    if (!defaultSkills.length) return;

    if (checked) {
        defaultSkills.forEach(ds => {
            if (!F.npc.periciasEstruturadas.some(ps => ps.refId === ds.id)) {
                F.npc.periciasEstruturadas.push({ refId: ds.id, nivel: 0 });
            }
        });
        renderStructuredSkills();
        recalcStats();
    } else {
        if (!confirm('Desmarcar esta opção irá desvincular TODAS as perícias padrões deste NPC. Quaisquer níveis aplicados a elas serão perdidos. Deseja continuar?')) {
            document.getElementById('npcHasDefaultSkills').checked = true;
            return;
        }
        F.npc.periciasEstruturadas = F.npc.periciasEstruturadas.filter(ps => {
            return !defaultSkills.some(ds => ds.id === ps.refId);
        });
        renderStructuredSkills();
        recalcStats();
    }
};

window.addSkillIndividual = function() {
    const picker = document.getElementById('npcSkillPicker');
    const id = picker?.value;
    if (!id) return;
    if (F.npc.periciasEstruturadas.some(ps => ps.refId === id)) {
        showAlert('⚠️ Perícia já adicionada.', 'warning');
        return;
    }
    F.npc.periciasEstruturadas.push({ refId: id, nivel: 1 });
    picker.value = '';
    renderStructuredSkills();
    recalcStats();
};

window.addSkillByCategory = function() {
    const catPicker = document.getElementById('npcSkillCategoryPicker');
    if (!catPicker || !catPicker.value) return;
    
    const normStr = str => String(str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
    const cat = normStr(catPicker.value);
    
    const catSkills = F.sys.skills.filter(s => normStr(s.categoria) === cat);
    if (!catSkills.length) {
        showAlert('⚠️ Nenhuma perícia encontrada nesta categoria.', 'warning');
        return;
    }
    
    let added = 0;
    catSkills.forEach(s => {
        if (!F.npc.periciasEstruturadas.some(ps => ps.refId === s.id)) {
            F.npc.periciasEstruturadas.push({ refId: s.id, nivel: 0 });
            added++;
        }
    });
    
    catPicker.value = '';
    if (added > 0) {
        showAlert(`✅ ${added} perícia(s) de '${cat}' adicionada(s).`, 'success');
        renderStructuredSkills();
        recalcStats();
    } else {
        showAlert('⚠️ Todas as perícias dessa categoria já estão no NPC.', 'warning');
    }
};

window.removeSkill = function(idx) {
    if (!confirm('Remover esta perícia? Os níveis aplicados a ela serão perdidos.')) return;
    F.npc.periciasEstruturadas.splice(idx, 1);
    renderStructuredSkills();
    recalcStats();
};

window.F_set = function(campo, valor) { if (F.npc) F.npc[campo] = valor; };

/* ===== COLETA E SALVAMENTO ===== */
function collectNpcData() {
    const g = id => document.getElementById(id)?.value?.trim() || '';
    const gi = id => parseInt(document.getElementById(id)?.value) || 0;
    const tipo = g('npcTipo') || 'npc';
    const n = F.npc;

    // Nomes resolvidos (denormalizados p/ filtros, combate e módulos legados)
    const racaNome = hybNome(n.racaRef, F.sys.racesById);
    const classeNome = hybNome(n.classeRef, F.sys.classesById);
    const triboNome = hybNome(n.triboRef, F.sys.tribesById);

    // Espelho legado de valores derivados (VIT/ENER/SAN/... = valor final)
    const calc = calcularNpc(n, F.sys);
    const legacyDv = {};
    for (const legacy of ['VIT', 'ENER', 'SAN', 'PERC', 'INI', 'REA', 'BLD']) {
        const key = findDvKeyLike(legacy, F.sys);
        if (key && calc.derived[key]) legacyDv[legacy] = calc.derived[key].final;
    }
    const desloc = (n.valoresDer.extras || []).find(x => F.sys.norm(x.nome).startsWith('desloc'));
    if (desloc) legacyDv.DESLOCAMENTO = String(desloc.valor ?? '');

    const funcao = [];
    if (document.getElementById('npcFuncAliado')?.checked) funcao.push('aliado');

    const mesaVinc = n.vinculos.find(v => v.tipo === 'mesa');

    return {
        schemaVersion: 2,
        modoFicha: n.modoFicha || 'rapido',
        nome: g('npcNome'), tipo, imagem: g('npcImagem'),
        nivel: gi('npcNivel') || 1,
        porte: g('npcPorte'), papel: g('npcPapel'), local: g('npcLocal'),
        tamanho: g('npcTamanho'), tags: g('npcTags'),
        funcao,
        aliadoProprio: document.getElementById('npcAliadoProprio')?.checked || false,

        // v2: referências híbridas + espelho legado em string
        racaRef: n.racaRef, classeRef: n.classeRef, triboRef: n.triboRef,
        raca: racaNome, classe: classeNome, tribo: triboNome,

        peculiaridades: n.peculiaridades,
        periciasEstruturadas: n.periciasEstruturadas,
        partesDoCorpo: Array.isArray(n.partesDoCorpo) ? n.partesDoCorpo : [],
        atributos: { ...Object.fromEntries(ATTR_SIGLAS.map(a => [a, parseInt(n.atributos?.[a]) || 0])) },
        valoresDer: {
            overrides: n.valoresDer.overrides || {},
            atual: n.valoresDer.atual || {},
            extras: n.valoresDer.extras || [],
            ...legacyDv
        },
        ai: gi('npcNivel') || n.ai || 0, // AI legado ≈ nível

        ataques: g('npcAtaques'), skills: g('npcSkills'),
        rolePlay: { personalidade: [g('npcPersonalidade1'), g('npcPersonalidade2'), g('npcPersonalidade3')], trejeitos: g('npcTrejeitos'), motivacao: g('npcMotivacao'), segredos: g('npcSegredos'), relacoes: { aliado: g('npcAliado'), rival: g('npcRival'), devedor: g('npcDevedor') }, frases: g('npcFrases'), historia: g('npcHistoria') },
        loot: { itens: g('npcItens'), luns: g('npcLuns'), pistas: g('npcPistas'), complicacoes: g('npcComplicacoes') },
        criatura: tipo === 'criatura' ? { habitat: g('npcHabitat'), comportamento: g('npcComportamento'), dieta: g('npcDieta'), nivelAmeaca: g('npcNivelAmeaca') } : null,

        vinculos: n.vinculos,
        mesaId: mesaVinc ? mesaVinc.id : '', // espelho legado (área de mesas usa mesaId)

        lastUpdate: new Date().toISOString(), lastUpdateBy: S.currentUser?.email
    };
}

window.saveNpc = async function() {
    const data = collectNpcData(); if (!data.nome) { showAlert('⚠️ Nome obrigatório', 'warning'); return; }
    try {
        if (!currentEditingNpc) {
            // ✅ Garantia: ao CRIAR um NPC, os Status Vitais ATUAIS nascem iguais ao MÁXIMO
            const calcNovo = calcularNpc(F.npc, F.sys);
            data.valoresDer.atual = data.valoresDer.atual || {};
            for (const dv of Object.values(calcNovo.derived)) {
                if (dv.isVital && (data.valoresDer.atual[dv.key] === undefined || data.valoresDer.atual[dv.key] === null || data.valoresDer.atual[dv.key] === '')) {
                    data.valoresDer.atual[dv.key] = dv.final;
                }
            }
            // Espelho legado (VIT/ENER/SAN...) para módulos que leem siglas fixas
            for (const legacy of ['VIT', 'ENER', 'SAN']) {
                const key = findDvKeyLike(legacy, F.sys);
                if (key && data.valoresDer.atual[legacy] === undefined && data.valoresDer.atual[key] !== undefined) {
                    data.valoresDer.atual[legacy] = data.valoresDer.atual[key];
                }
            }
            // ✅ NPCs "comuns" (bípedes) nascem com anatomia padrão (mesma de Humano)
            if ((!data.partesDoCorpo || !data.partesDoCorpo.length) && data.tipo === 'npc') {
                try {
                    if (window._npcEnsureBodyPartsRegistry) await window._npcEnsureBodyPartsRegistry();
                    if (window._npcDefaultHumanoidParts) data.partesDoCorpo = window._npcDefaultHumanoidParts();
                } catch (e) { /* segue sem partes; mestre pode aplicar depois */ }
            }
        }
        if (currentEditingNpc) { await setDoc(doc(db, 'npcs', currentEditingNpc.id), data, { merge: true }); await addLog(S.currentUser?.email, 'Editou NPC', data.nome, 'npcs'); showAlert('✅ NPC atualizado!', 'success'); }
        else { await setDoc(doc(collection(db, 'npcs')), data); await addLog(S.currentUser?.email, 'Criou NPC', data.nome, 'npcs'); showAlert('✅ NPC criado!', 'success'); }
        closeNpcModal(); await loadAllNpcs(); if (window._loadMesaNpcs) await window._loadMesaNpcs();
    } catch (e) { console.error(e); showAlert('❌ Erro ao salvar', 'danger'); }
};

window.closeNpcModal = function() { document.getElementById('npcModal')?.classList.remove('active'); currentEditingNpc = null; F.npc = null; };

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
