// ÁREA NPCs — Full CRUD, Export/Import, Modal Form
import { db, collection, getDocs, setDoc, deleteDoc, doc, addDoc, updateDoc, onSnapshot, query, where } from './firebase-config.js';
import * as S from './state.js';
import { showAlert, escapeHtml } from './ui-utils.js';
import { addLog } from './logs.js';
import { ensureNpcSystemData, pecsDaOrigem, modulosDaClasseNpc, resolveNpcClassModule } from './npc-system-data.js?v=1.5';
import { calcularNpc, ATTR_SIGLAS } from './npc-calc-engine.js?v=1.9';
import './npc-inventario.js?v=9'; // Aba Inventário da Ficha de NPC (itens + partes do corpo)
import { npcNaMesa, mesasDoNpc, espelhoMesaId } from '../../shared/npc-mesas.js';
import { melhorDisparo, bracoDeArremesso, METROS_POR_FOR } from '../../shared/alcance-disparo.js';
import { linhasDeDisparoNpc } from './npc-inventario.js?v=9';
import { confirmar, perguntar } from '../../shared/dialogo.js?v=1';

let currentEditingNpc = null;
let _npcModalUnsubscribe = null;
export async function onTabActivated() { await loadAllNpcs(); }

async function loadAllNpcs() {
    try {
        const snap = await getDocs(collection(db, 'npcs'));
        const npcs = []; 
        snap.forEach(d => {
            const data = d.data();
            npcs.push({ id: d.id, ...data });
        });
        S.setAllNpcs(npcs); window.restoreNpcFiltersState ? window.restoreNpcFiltersState() : (window.filterNpcs && window.filterNpcs());
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
            <div class="npc-card-header"><input type="checkbox" class="npc-checkbox" data-npc-id="${n.id}" onclick="event.stopPropagation()"><div class="npc-card-info"><div class="npc-name">${escapeHtml(n.nome||'Sem nome')}</div><span class="npc-type-badge">${n.tipo==='criatura'?'🐉 Criatura':n.tipo==='eco'?'ᛉ Eco':'👤 NPC'}</span></div></div>
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
            const mesasN = mesasDoNpc(n);
            if (adv.advF_vinculo === 'com_mesa' && !mesasN.length) return false;
            if (adv.advF_vinculo === 'sem_mesa' && mesasN.length) return false;
            if (adv.advF_vinculo === 'especifica' && adv.advF_mesaEsp && !npcNaMesa(n, adv.advF_mesaEsp)) return false;
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

/** Blocos de Valor Derivado com blocoOrdem abaixo disto nascem abertos.
 *  Mesmo número da ficha de personagem (ficha-v1.7_1/js/combat-panel.js) —
 *  as duas fichas têm de dobrar os mesmos blocos. */
const NPC_BLOCO_ABERTO_ATE = 30;

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
        // ⚠️ `vinculados` TEM de sobreviver à normalização: sem ele aqui, todo
        // reopen descartava a lista salva e a migração lá embaixo refazia só com
        // universais + overrides — VD vinculado sem override (ex.: Desloc. Aéreo
        // recém-adicionado) sumia do formulário a cada salvar/abrir.
        n.valoresDer = {
            overrides: vd.overrides || {}, atual: vd.atual || {}, extras: vd.extras || [],
            ...(Array.isArray(vd.vinculados) ? { vinculados: vd.vinculados } : {}),
        };
    }

    // Espelhar chaves legacy (VIT/ENER/SAN) → chaves do sistema no atual.
    // O combate escreve apenas chaves legacy; o formulário lê chaves do sistema.
    // Este espelho garante que ao abrir a ficha, os valores do combate apareçam.
    for (const legacy of ['VIT', 'ENER', 'SAN']) {
        const key = findDvKeyLike(legacy, sys);
        if (key && key !== legacy && n.valoresDer.atual[legacy] !== undefined && n.valoresDer.atual[legacy] !== null) {
            n.valoresDer.atual[key] = n.valoresDer.atual[legacy];
        }
    }

    // `vinculos` é a lista canônica. Docs antigos (ou gravados por script) podem
    // ter só o espelho `mesaId` — sem promover para vínculo, o editor abriria com
    // a mesa desmarcada e o save seguinte desvincularia o NPC sem ninguém pedir.
    if (!Array.isArray(n.vinculos)) n.vinculos = [];
    if (n.mesaId && !n.vinculos.some(v => v?.tipo === 'mesa' && v.id === n.mesaId)) {
        n.vinculos.push({ tipo: 'mesa', id: n.mesaId });
    }

    // Visibilidade da ficha no Tabuleiro (Secreto = componente do Painel do
    // Mestre; Público = componente de Aliados em Modo Rápido)
    n.visibilidade = n.visibilidade === 'publico' ? 'publico' : 'secreto';

    // Módulos de Classe vinculados ao NPC
    n.modulosClasse = (Array.isArray(n.modulosClasse) ? n.modulosClasse : []).map(m => ({
        refId: m.refId || null,
        snapshot: m.snapshot || null,
        fonte: m.fonte === 'classe' ? 'classe' : 'manual',
        itens: Array.isArray(m.itens) ? m.itens : []
    })).filter(m => m.refId || m.snapshot);

    // Valores Derivados vinculados — a ficha não lista mais TODOS os VDs do
    // sistema: apenas os vinculados. Estado inicial (criação ou migração de
    // fichas antigas): VDs com "Todo personagem tem este valor?" = true, mais
    // quaisquer VDs que já possuam override/atual salvos (migração segura).
    if (!Array.isArray(n.valoresDer.vinculados)) {
        const dvKeys = new Set(sys.derivedValues.map(d => d.key));
        const keys = new Set(sys.derivedValues.filter(d => d.todoPersonagem).map(d => d.key));
        Object.keys(n.valoresDer.overrides || {}).forEach(k => { if (dvKeys.has(k)) keys.add(k); });
        Object.keys(n.valoresDer.atual || {}).forEach(k => { if (dvKeys.has(k)) keys.add(k); });
        n.valoresDer.vinculados = [...keys];
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

    if (_npcModalUnsubscribe) {
        _npcModalUnsubscribe();
        _npcModalUnsubscribe = null;
    }
    if (npcId) {
        _npcModalUnsubscribe = onSnapshot(doc(db, 'npcs', npcId), (snap) => {
            if (!snap.exists()) return;
            const data = snap.data();
            
            // Verifica mudanças apenas de fora (ex: vindas do painel de combate)
            const vd = data.valoresDer || {};
            const atual = vd.atual || {};
            let mudou = false;
            
            const legacyKeys = ['VIT', 'ENER', 'SAN'];
            legacyKeys.forEach(leg => {
                if (atual[leg] !== undefined) {
                    if (F.npc.valoresDer.atual?.[leg] !== atual[leg]) {
                        if (!F.npc.valoresDer.atual) F.npc.valoresDer.atual = {};
                        F.npc.valoresDer.atual[leg] = atual[leg];
                        mudou = true;
                    }
                    const dk = findDvKeyLike(leg, F.sys);
                    if (dk && F.npc.valoresDer.atual?.[dk] !== atual[leg]) {
                        if (!F.npc.valoresDer.atual) F.npc.valoresDer.atual = {};
                        F.npc.valoresDer.atual[dk] = atual[leg];
                        mudou = true;
                    }
                }
            });
            
            if (mudou) {
                // Ao invés de re-renderizar todo o grid, podemos apenas atualizar os inputs atuais,
                // mas `renderDvGrid` é mais seguro e redesenha o grid corretamente se algo mais mudou.
                renderDvGrid();
            }
        });
    }
};
window.openNpcEditModal = window.openNpcModal;

/* ===== CONSTRUÇÃO DO FORMULÁRIO ===== */
/* ===== FORMULÁRIO DA FICHA DE NPC =====
 * Uma função por seção da ficha, na mesma ordem dos botões da barra de cima.
 * Mexer numa aba não obriga a rolar as outras seiscentas linhas.
 */

/** Barra de cima: alternador Rápido/Mecânico, ações e os botões das seções. */
function _npcTopo() {
    return `
    <div class="npcv2-topbar">
        <div class="npcv2-toolbar">
            <div class="npcv2-mode-toggle" title="Rápido: preenchimento manual. Mecânico: usa raças, classes, tribos e peculiaridades dos registros, com cálculo automático.">
                <button type="button" id="modoRapidoBtn" class="npcv2-mode-btn" onclick="setNpcModo('rapido')">📝 Rápido</button>
                <button type="button" id="modoMecanicoBtn" class="npcv2-mode-btn" onclick="setNpcModo('mecanico')">⚙️ Mecânico</button>
            </div>
            <div class="npcv2-toolbar-actions">
                <button class="btn btn-secondary btn-small npcv2-only-mecanico" onclick="sincronizarRegistrosNpc()"
                    title="Confere raça, classe, tribo e peculiaridades e vincula o que estiver faltando (peculiaridades e Valores Derivados)">🔄 Sincronizar registros</button>
                <button class="btn btn-secondary btn-small npcv2-only-mecanico" onclick="exportNpcFromForm()">📤 Exportar</button>
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
    </div>
`;
}

/** Quem é o NPC, como ele aparece no Tabuleiro e os blocos que só valem para Criatura e para Eco da Alma. */
function _npcSecaoIdentidade() {
    return `
    <!-- ============ SEÇÃO: IDENTIDADE ============ -->
    <div class="npcv2-section" id="npcSec_identidade">
      <div class="npcv2-card">
        <div class="npcv2-block-title">📋 Quem é</div>
        <div class="form-group"><label class="form-label">🖼️ Imagem</label>${CampoImagem.html({ id: 'npcImagem', classe: 'form-input', pasta: 'imagens/npcs', preview: false })}<div id="npcImgPreview" style="display:none;margin-top:8px;text-align:center"><img id="npcImgTag" style="max-height:200px;border-radius:10px"></div></div>
        <div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:10px">
            <div class="form-group"><label class="form-label">Nome *</label><input type="text" class="form-input" id="npcNome" placeholder="Nome do NPC"></div>
            <div class="form-group"><label class="form-label">Tipo *</label><select class="form-select" id="npcTipo"><option value="npc">👤 NPC</option><option value="criatura">🐉 Criatura</option><option value="eco">ᛉ Eco da Alma</option></select></div>
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
      </div>

      <div class="npcv2-card">
        <div class="npcv2-block-title">👁️ Exibição e funções</div>
        <div class="form-group">
            <label class="form-label">Visibilidade da ficha no Tabuleiro</label>
            <select class="form-select" id="npcVisibilidade" onchange="F_set('visibilidade', this.value)">
                <option value="secreto">🕵️ Secreto — abre a ficha completa do Painel do Mestre</option>
                <option value="publico">📢 Público — abre a ficha de Aliado (Modo Rápido)</option>
            </select>
        </div>
        <div class="form-group npcv2-funcoes npcv2-only-mecanico"><label class="form-label">Funções</label>
            <label class="npcv2-check"><input type="checkbox" id="npcFuncAliado" onchange="document.getElementById('npcAliadoProprioWrap').style.display = this.checked ? 'block' : 'none'"> 🤝 Aliado (poderá ser vinculado à ficha de personagens)</label>
            <div id="npcAliadoProprioWrap" style="display:none; margin-left: 24px; margin-top: 8px;">
                <label class="npcv2-check"><input type="checkbox" id="npcAliadoProprio"> É o próprio? <span class="npcv2-hint">(se OFF, a vinculação gera um clone independente)</span></label>
            </div>
        </div>
      </div>

        <div id="creatureFieldsSection" class="npcv2-card" style="display:none"><div class="npcv2-block-title">🐉 Campos de Criatura</div>
            <div class="form-group"><label class="form-label">Habitat</label><input type="text" class="form-input" id="npcHabitat"></div>
            <div class="form-group"><label class="form-label">Comportamento</label><textarea class="form-textarea" id="npcComportamento" rows="2"></textarea></div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
                <div class="form-group"><label class="form-label">Dieta</label><input type="text" class="form-input" id="npcDieta"></div>
                <div class="form-group"><label class="form-label">Nível de Ameaça</label><select class="form-select" id="npcNivelAmeaca"><option value="">Selecione</option><option value="inofensivo">Inofensivo</option><option value="baixo">Baixo</option><option value="medio">Médio</option><option value="alto">Alto</option><option value="letal">Letal</option></select></div>
            </div>
        </div>

        <!-- ᛉ ECO DA ALMA — o vestígio com que o Xamã comunga (Totemancia).
             Bloco irmão do de Criatura: aparece só quando tipo === 'eco'.
             Disposição e Máscara são do MESTRE — é o que o Eco esconde. -->
        <div id="ecoFieldsSection" class="npcv2-card" style="display:none"><div class="npcv2-block-title">ᛉ Campos de Eco da Alma</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
                <div class="form-group"><label class="form-label">Dádiva</label><select class="form-select" id="ecoDadiva"><option value="">Selecione</option><option value="braco">Braço — lutou, caçou, matou</option><option value="pele">Pele — aguentou; fera de couro</option><option value="olho">Olho — batedor, vigia, ave</option><option value="passo">Passo — corria; fera veloz</option><option value="boca">Boca — orador, líder, sacerdote</option></select></div>
                <div class="form-group"><label class="form-label">Estado</label><select class="form-select" id="ecoEstado"><option value="">Selecione</option><option value="sereno">Sereno</option><option value="inquieto">Inquieto</option><option value="furioso">Furioso</option><option value="corrompido">Corrompido</option><option value="ancestral">Ancestral</option></select></div>
            </div>
            <div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:10px">
                <div class="form-group"><label class="form-label">Personalidade</label><select class="form-select" id="ecoPersonalidade"><option value="">Role 1d10</option><option value="1">1 · Sereno</option><option value="2">2 · Zeloso</option><option value="3">3 · Curioso</option><option value="4">4 · Saudoso</option><option value="5">5 · Orgulhoso</option><option value="6">6 · Silente</option><option value="7">7 · Sofrido</option><option value="8">8 · Malicioso</option><option value="9">9 · Faminto</option><option value="10">10 · Rancoroso</option></select></div>
                <div class="form-group"><label class="form-label" title="0–10. O que o Eco realmente sente. Segredo do Mestre.">Disposição 🔒</label><input type="number" class="form-input" id="ecoDisposicao" min="0" max="10"></div>
                <div class="form-group"><label class="form-label" title="Redutor do teste de Supressão do Xamã">PRS do Eco</label><input type="number" class="form-input" id="ecoPRS" min="0"></div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
                <div class="form-group"><label class="form-label">Perícia emprestada</label><input type="text" class="form-input" id="ecoPericia" placeholder="Nome · valor 3 (Comum) ou 5 (Ancestral)"></div>
                <div class="form-group"><label class="form-label">Onde vive</label><input type="text" class="form-input" id="ecoTerritorio" placeholder="Território, Andarilho ou Totem de Antiqua"></div>
            </div>
            <div class="form-group"><label class="form-label">Preço / oferenda <span style="font-weight:400;opacity:.7">(Lei da Reciprocidade)</span></label><input type="text" class="form-input" id="ecoPreco" placeholder="O que ele cobra por comungar"></div>
            <label style="display:flex;align-items:center;gap:8px;font-size:.85rem;cursor:pointer;margin-top:4px">
                <input type="checkbox" id="ecoMascara"> 🎭 Usa máscara — esconde a Disposição real do Xamã
            </label>
        </div>
    </div>
`;
}

/** O que o motor calcula: peculiaridades, status vitais, atributos, perícias e valores derivados. */
function _npcSecaoMecanica() {
    return `
    <!-- ============ SEÇÃO: MECÂNICA ============ -->
    <!-- Todo bloco é <details class="npcv2-dobra">: a ficha de NPC é longa e o
         Mestre consulta um bloco por vez. Nascem FECHADOS os que se preenchem
         uma vez e depois só se conferem (Peculiaridades, Atributos) e o de
         avisos, que é diagnóstico e não conteúdo de mesa. -->
    <div class="npcv2-section" id="npcSec_mecanica">
        <details id="npcPecsWrap" class="npcv2-card npcv2-dobra">
            <summary class="npcv2-block-title">🧬 Peculiaridades <span class="npcv2-hint" id="npcPecsCount"></span></summary>
            <div id="npcPecsList"></div>
            <div class="npcv2-pec-add npcv2-only-mecanico">
                <input type="text" class="form-input" id="pecSearch" placeholder="🔍 Buscar no registro..." oninput="renderPecPicker()">
                <select class="form-select" id="pecPicker"></select>
                <button class="btn btn-secondary btn-small" onclick="addPecFromRegistry()">➕ Do registro</button>
                <button class="btn btn-secondary btn-small" onclick="addPecCustom()">✏️ Personalizada</button>
            </div>
        </details>

        <details class="npcv2-card npcv2-dobra" open>
            <summary class="npcv2-block-title">⚔️ Status de Combate
                <span class="npcv2-hint npcv2-only-mecanico">calculados pelas mecânicas — clique em um valor para travar um override 🔒</span>
            </summary>
            <div class="npcv2-dv-grid" id="npcVitalStatsGrid"></div>
        </details>

        <details class="npcv2-card npcv2-dobra">
            <summary class="npcv2-block-title">💪 Atributos <span class="npcv2-hint" id="attrHint"></span></summary>
            <div class="npcv2-attrs-grid" id="npcAttrsGrid">
                ${ATTR_SIGLAS.map(a => `
                    <div class="npcv2-attr-cell">
                        <div class="npcv2-attr-label">${a}</div>
                        <input type="number" class="form-input npcv2-attr-input" id="npcAttr_${a}" value="0"
                            oninput="F.npc.atributos['${a}']=parseInt(this.value)||0;recalcStats()">
                        <div class="npcv2-attr-eff" id="npcAttrEff_${a}"></div>
                    </div>`).join('')}
            </div>
        </details>

        <details class="npcv2-card npcv2-dobra" open>
            <summary class="npcv2-block-title">📊 Valores Derivados
                <span class="npcv2-hint npcv2-only-mecanico">calculados pelas mecânicas — clique em um valor para travar um override 🔒</span>
            </summary>
            <div class="npcv2-hint" style="margin-bottom:8px">A ficha lista apenas os VDs vinculados a este NPC (VDs marcados como "Todo personagem tem este valor?" entram automaticamente). Use ✕ para desvincular.</div>
            <div id="npcDvGrid"></div>
            <div class="npcv2-pec-add npcv2-only-mecanico">
                <select class="form-select" id="npcDvPicker" style="flex:1"></select>
                <button class="btn btn-secondary btn-small" onclick="addNpcDv()">➕ Vincular VD</button>
            </div>
        </details>

        <details id="npcAtaquesWrap" class="npcv2-card npcv2-dobra npcv2-only-mecanico" style="display:none" open>
            <summary class="npcv2-block-title">⚔️ Ataques e Efeitos Ativos
                <span class="npcv2-hint">totais por item equipado (base do NPC + o que o item acrescenta)</span>
            </summary>
            <div class="atk-table-wrap"><table class="atk-table" id="npcAtaquesTable"></table></div>
        </details>

        <details id="npcClassModulesWrap" class="npcv2-card npcv2-dobra npcv2-only-mecanico" open>
            <summary class="npcv2-block-title">🧩 Módulos de Classe
                <span class="npcv2-hint">herdados da classe selecionada ou vinculados manualmente</span>
            </summary>
            <div id="npcClassModulesList"></div>
            <div class="npcv2-pec-add">
                <select class="form-select" id="npcModPicker" style="flex:1"></select>
                <button class="btn btn-secondary btn-small" onclick="addNpcClassModule()">➕ Vincular módulo</button>
            </div>
        </details>

        <details class="npcv2-card npcv2-dobra" open>
            <summary class="npcv2-block-title">➕ Valores extras <span class="npcv2-hint">informações fora dos registros</span></summary>
            <div id="npcExtrasList"></div>
            <button class="btn btn-secondary btn-small" onclick="addExtraDv()">➕ Adicionar valor extra</button>
        </details>

        <details id="npcInfosWrap" class="npcv2-card npcv2-dobra" style="display:none" open>
            <summary class="npcv2-block-title">📜 Efeitos e capacidades (das peculiaridades)</summary>
            <div id="npcInfosList"></div>
        </details>

        <details id="npcAvisosWrap" class="npcv2-card npcv2-dobra" style="display:none">
            <summary class="npcv2-block-title">⚠️ Avisos do cálculo <span class="npcv2-hint" id="npcAvisosCount"></span></summary>
            <div id="npcAvisosList" class="npcv2-avisos"></div>
        </details>

        <details class="npcv2-card npcv2-dobra" open>
            <summary class="npcv2-block-title">⚔️ Combate e perícias em texto livre</summary>
            <div class="form-group"><label class="form-label">Ataques</label><textarea class="form-textarea" id="npcAtaques" rows="3" placeholder="Ataques e danos..."></textarea></div>
            <div class="form-group"><label class="form-label">📚 Perícias</label><textarea class="form-textarea" id="npcSkills" rows="2" placeholder="Perícias relevantes... (Texto Livre)"></textarea></div>
        </details>

        <!-- ============ SEÇÃO: PERÍCIAS ESTRUTURADAS ============ -->
        <details id="npcStructuredSkillsWrap" class="npcv2-card npcv2-dobra" open>
            <summary class="npcv2-block-title">🎯 Perícias Estruturadas</summary>

            <div class="npcv2-only-mecanico" style="margin-bottom:12px">
                <label class="npcv2-check">
                    <input type="checkbox" id="npcHasDefaultSkills" onchange="toggleDefaultSkills(this.checked)"> Tem todas as Perícias Padrões?
                </label>
            </div>

            <div class="npcv2-pec-add npcv2-only-mecanico" style="margin-bottom:12px">
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
        </details>
    </div>
`;
}

/** Itens do NPC — a lista roda pelo motor compartilhado (shared/inventario-motor.js). */
function _npcSecaoInventario() {
    return `
    <!-- ============ SEÇÃO: INVENTÁRIO ============ -->
    <div class="npcv2-section" id="npcSec_inventario">
        <!-- Anatomia: mexe-se nela uma vez e pronto — fica recolhida para o
             inventário, que é o trabalho do dia a dia, ficar em primeiro. -->
        <details class="npcv2-card npcv2-dobra">
            <summary class="npcv2-block-title">🦴 Partes do Corpo &amp; Slots
                <span class="npcv2-hint">NPCs comuns usam a anatomia padrão (humanoide); criaturas podem ter anatomias personalizadas</span>
            </summary>
            <div class="npcv2-pec-add" style="margin-top:0;margin-bottom:8px">
                <button class="btn btn-secondary btn-small" onclick="npcApplyDefaultBodyParts()" title="Aplica as partes marcadas como padrão no Painel de Criador (mesmas de Humano)">🧍 Aplicar Padrão Humanoide</button>
                <select class="form-select" id="npcBodyPartPicker" style="max-width:220px"></select>
                <button class="btn btn-secondary btn-small" onclick="npcAddBodyPartFromRegistry()">➕ Do registro</button>
                <button class="btn btn-secondary btn-small" onclick="npcAddBodyPartCustom()">✏️ Parte personalizada</button>
            </div>
            <div id="npcBodyPartsList"></div>
        </details>

        <div class="npcv2-card">
            <div class="npcv2-block-title">🎒 Itens do NPC
                <span class="npcv2-hint">clique na linha para abrir · arraste ⠿ para equipar, guardar ou juntar</span>
                <button class="btn btn-success btn-small" style="margin-left:auto" onclick="window.openNpcItemForm(null)">➕ Criar Item</button>
            </div>
            <div id="npcInventoryList"></div>
        </div>
    </div>
`;
}

/** Como interpretar: personalidade, motivação, segredos e relações. */
function _npcSecaoRoleplay() {
    return `
    <!-- ============ SEÇÃO: ROLE PLAY ============ -->
    <div class="npcv2-section" id="npcSec_roleplay">
        <div class="npcv2-card">
            <div class="npcv2-block-title">🎭 Presença em cena</div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
                <div class="form-group"><label class="form-label">Personalidade 1</label><input type="text" class="form-input" id="npcPersonalidade1"></div>
                <div class="form-group"><label class="form-label">Personalidade 2</label><input type="text" class="form-input" id="npcPersonalidade2"></div>
                <div class="form-group"><label class="form-label">Personalidade 3</label><input type="text" class="form-input" id="npcPersonalidade3"></div>
            </div>
            <div class="form-group"><label class="form-label">Trejeitos</label><input type="text" class="form-input" id="npcTrejeitos"></div>
            <div class="form-group"><label class="form-label">💬 Frases</label><textarea class="form-textarea" id="npcFrases" rows="2"></textarea></div>
        </div>

        <div class="npcv2-card">
            <div class="npcv2-block-title">🎯 O que move e o que esconde</div>
            <div class="form-group"><label class="form-label">Motivação</label><textarea class="form-textarea" id="npcMotivacao" rows="2"></textarea></div>
            <div class="form-group"><label class="form-label">Segredos</label><textarea class="form-textarea" id="npcSegredos" rows="2"></textarea></div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
                <div class="form-group"><label class="form-label">Aliado</label><input type="text" class="form-input" id="npcAliado"></div>
                <div class="form-group"><label class="form-label">Rival</label><input type="text" class="form-input" id="npcRival"></div>
                <div class="form-group"><label class="form-label">Devedor</label><input type="text" class="form-input" id="npcDevedor"></div>
            </div>
        </div>

        <div class="npcv2-card">
            <div class="npcv2-block-title">📖 História</div>
            <div class="form-group" style="margin-bottom:0"><textarea class="form-textarea" id="npcHistoria" rows="4"></textarea></div>
        </div>
    </div>
`;
}

/** O que sobra dele: itens, luns, pistas e complicações. */
function _npcSecaoLoot() {
    return `
    <!-- ============ SEÇÃO: LOOT ============ -->
    <div class="npcv2-section" id="npcSec_loot">
        <div class="npcv2-card">
            <div class="npcv2-block-title">🎁 O que fica para trás</div>
            <div class="form-group"><label class="form-label">Itens</label><textarea class="form-textarea" id="npcItens" rows="2"></textarea></div>
            <div class="form-group"><label class="form-label">Luns</label><input type="text" class="form-input" id="npcLuns"></div>
            <div class="form-group"><label class="form-label">Pistas</label><textarea class="form-textarea" id="npcPistas" rows="2"></textarea></div>
            <div class="form-group"><label class="form-label">Complicações</label><textarea class="form-textarea" id="npcComplicacoes" rows="2"></textarea></div>
        </div>
    </div>
`;
}

/** A que mesas, locais e personagens este NPC está preso. */
function _npcSecaoVinculos() {
    return `
    <!-- ============ SEÇÃO: VÍNCULOS ============ -->
    <div class="npcv2-section" id="npcSec_vinculos">
        <div class="npcv2-card">
            <div class="npcv2-block-title">🗺️ Mesas</div>
            <div id="npcVincMesas" class="npcv2-vinc-list"><div class="npcv2-empty">Carregando mesas...</div></div>
        </div>

        <div class="npcv2-card">
            <div class="npcv2-block-title">🤝 Aliados (Personagens)</div>
            <div id="npcVincAliados"></div>
            <div class="npcv2-pec-add">
                <select class="form-select" id="vincAliadoMesaPicker" style="max-width:180px" onchange="filterVincAliadoChars(this.value)"><option value="">Filtrar Mesa...</option></select>
                <select class="form-select" id="vincAliadoCharPicker" style="flex:1"><option value="">Selecione a Mesa primeiro...</option></select>
                <button class="btn btn-primary btn-small" onclick="addVincAliado()">➕ Vincular como Aliado</button>
            </div>
            <div class="npcv2-hint" style="margin-top:6px">O sistema respeitará a configuração "É o próprio?" da aba Identidade (Mecânico).</div>
        </div>

        <div class="npcv2-card">
            <div class="npcv2-block-title">👥 Vínculos Gerais (Não Aliados)</div>
            <div id="npcVincChars"></div>
            <div class="npcv2-pec-add">
                <select class="form-select" id="vincCharPicker" style="flex:1"><option value="">Carregando personagens...</option></select>
                <input type="text" class="form-input" id="vincCharRelacao" style="flex:1" placeholder="Relação (Mentor, Irmã...)">
                <button class="btn btn-secondary btn-small" onclick="addVincChar()">➕ Vincular</button>
            </div>
            <div class="npcv2-hint" style="margin-top:6px">Vínculos criados na criação de personagem aparecerão aqui com a origem "criação".</div>
        </div>

        <div class="npcv2-card">
            <div class="npcv2-block-title">🤝 Moral com os Personagens</div>
            <div id="npcMoralLista"><div class="npcv2-hint">Carregando…</div></div>
            <div class="npcv2-hint" style="margin-top:6px">Memória de mesa: o que este NPC sente por cada um. O motivo é opcional — no meio da cena, clique e siga.</div>
        </div>
    </div>
`;
}

/* =====================================================================
   🤝 MORAL — memória de mesa, por personagem
   ---------------------------------------------------------------------
   A régua mora em shared/moral.js (pura, testada). Aqui é só tela e escrita.
   O Mestre precisa disto NO MEIO da cena, então cada linha tem os botões na
   mão e o motivo é um campo que ele preenche se quiser — nunca obrigatório.
   ===================================================================== */

async function _moralMod() { return import('../../shared/moral.js?v=1'); }

/** Redesenha a lista de moral do NPC aberto. */
window.renderNpcMoral = async function () {
    const el = document.getElementById('npcMoralLista');
    if (!el) return;
    const npc = window.F?.npc;
    if (!npc?.id) { el.innerHTML = '<div class="npcv2-hint">Salve o NPC para registrar moral.</div>'; return; }
    const { linhasDeMoral } = await _moralMod();
    // ⚠️ Não depende da aba de Vínculos ter sido aberta: a moral é usada no
    // meio da cena, e "Carregando…" para sempre porque o Mestre não clicou
    // noutra aba seria um bug invisível. Se a lista não estiver pronta, busca.
    let chars = window._npcVincChars || [];
    if (!chars.length) {
        try {
            const q = S.currentMesaId
                ? query(collection(db, 'char'), where('mesaId', '==', S.currentMesaId))
                : query(collection(db, 'char'), where('ownerUid', '==', S.currentUser?.uid || ''));
            const snap = await getDocs(q);
            chars = [];
            snap.forEach(d => { const r = d.data(); chars.push({ id: d.id, nome: r.fields?.nome || r.nome || 'Sem nome' }); });
            window._npcVincChars = chars;
        } catch (e) { console.warn('personagens para a moral', e); }
    }
    if (!chars.length) { el.innerHTML = '<div class="npcv2-hint">Nenhum personagem na mesa ainda.</div>'; return; }

    const linhas = linhasDeMoral(npc, chars);
    el.innerHTML = linhas.map(l => `
        <div class="npc-moral-linha" data-char="${escapeHtml(l.charId)}">
            <div class="npc-moral-quem">
                <b>${escapeHtml(l.nome)}</b>
                <span class="npc-moral-faixa" title="${escapeHtml(l.faixa.desc)}">${l.faixa.icone} ${escapeHtml(l.faixa.nome)}</span>
            </div>
            <div class="npc-moral-ctrl">
                <button class="btn btn-small" onclick="npcMoralDelta('${l.charId}',-3)" title="−3">−−</button>
                <button class="btn btn-small" onclick="npcMoralDelta('${l.charId}',-1)" title="−1">−</button>
                <b class="npc-moral-val ${l.valor < 0 ? 'ruim' : l.valor > 0 ? 'bom' : ''}">${l.valor > 0 ? '+' : ''}${l.valor}</b>
                <button class="btn btn-small" onclick="npcMoralDelta('${l.charId}',1)" title="+1">+</button>
                <button class="btn btn-small" onclick="npcMoralDelta('${l.charId}',3)" title="+3">++</button>
            </div>
            <input type="text" class="form-input npc-moral-motivo" id="npcMoralMotivo_${escapeHtml(l.charId)}"
                placeholder="Motivo (opcional) — some depois de registrar">
            ${l.historico.length ? `<details class="npc-moral-hist"><summary>${l.historico.length} registro(s)</summary>${
                l.historico.map(h => `<div class="npc-moral-h">
                    <b>${h.delta > 0 ? '+' : ''}${h.delta}</b>
                    <span>${escapeHtml(h.motivo || '— sem motivo anotado')}</span>
                    <i>${new Date(h.em).toLocaleDateString('pt-BR')}</i>
                </div>`).join('')}</details>` : ''}
        </div>`).join('');
};

/** Soma/subtrai e grava. O motivo do campo vai junto e o campo se limpa. */
window.npcMoralDelta = async function (charId, delta) {
    const npc = window.F?.npc;
    if (!npc?.id) return;
    const { aplicarMoral } = await _moralMod();
    const campo = document.getElementById('npcMoralMotivo_' + charId);
    const motivo = campo?.value?.trim() || '';
    const r = aplicarMoral(npc, charId, delta, motivo, S.currentUser?.email || null);
    if (!r.mudou) {
        showAlert(`⚠️ A moral já está no ${delta > 0 ? 'máximo' : 'mínimo'} — nada a registrar.`, 'warning');
        return;
    }
    npc.moral = r.moral;              // otimista: a tela responde na hora
    if (campo) campo.value = '';
    await renderNpcMoral();
    try {
        await updateDoc(doc(db, 'npcs', npc.id), { moral: r.moral, lastUpdate: new Date().toISOString() });
        const nome = (window._npcVincChars || []).find(c => c.id === charId)?.nome || 'personagem';
        addLog(S.currentUser?.email,
            `🤝 Moral de "${npc.nome || 'NPC'}" com ${nome}: ${r.antes} → ${r.depois}${motivo ? ` (${motivo})` : ''}`,
            npc.nome || '', 'npcs', {
                charId, mesaId: S.currentMesaId || null, category: 'Moral',
                changes: [{ label: nome, from: String(r.antes), to: String(r.depois) },
                          ...(motivo ? [{ label: 'Motivo', from: '', to: motivo }] : [])],
            });
    } catch (e) {
        console.error('gravar moral', e);
        showAlert('❌ Não consegui gravar a moral — veja o console.', 'danger');
    }
};

function buildNpcForm() {
    return _npcTopo()
        + _npcSecaoIdentidade()
        + _npcSecaoMecanica()
        + _npcSecaoInventario()
        + _npcSecaoRoleplay()
        + _npcSecaoLoot()
        + _npcSecaoVinculos();
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
        if (campo === 'classe') syncClassModules(prev, null);
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
    if (campo === 'classe') syncClassModules(prevRefId, ref.refId);
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

/* ===== SINCRONIZAR COM OS REGISTROS =====
 * Raça, classe, tribo e peculiaridades vinculam peculiaridades e Valores
 * Derivados no Painel do Criador. A ficha do NPC só herda isso no momento em
 * que a origem é ESCOLHIDA — quem mexeu no registro depois, ou importou um
 * NPC pronto, fica com a ficha defasada e não tem como saber.
 * Este botão passa o pente fino e vincula o que falta. Só ADICIONA: nada que
 * o Mestre pôs à mão é removido. */

/** Coleta os IDs de Valor Derivado que um cadastro (raça/classe/tribo/pec)
 *  concede. Mesma leitura da ficha de personagem: `derivedValueIds` aceita
 *  id cru ou objeto `{ id, valorInicial }`. */
function _npcDvIdsDoCadastro(cadastro, destino) {
    for (const entrada of (cadastro?.derivedValueIds || [])) {
        const id = (typeof entrada === 'object' && entrada !== null) ? entrada.id : entrada;
        if (id) destino.add(id);
    }
}

window.sincronizarRegistrosNpc = function() {
    if (!F.npc || !F.sys) return;

    // --- 1) Peculiaridades das três origens ---
    const pecsNovas = [];
    for (const [fonte, campo] of [['raca', 'racaRef'], ['classe', 'classeRef'], ['tribo', 'triboRef']]) {
        const refId = F.npc[campo]?.refId;
        if (!refId) continue;
        for (const h of pecsDaOrigem(fonte, refId, F.sys)) {
            if (F.npc.peculiaridades.some(p => p.refId === h.refId)) continue;
            F.npc.peculiaridades.push(h);
            pecsNovas.push(F.sys.pecsById[h.refId]?.nome || h.refId);
        }
    }

    // --- 2) Valores Derivados vinculados pelas origens e pelas peculiaridades ---
    const dvIds = new Set();
    for (const [campo, indice] of [['racaRef', F.sys.racesById], ['classeRef', F.sys.classesById], ['triboRef', F.sys.tribesById]]) {
        const refId = F.npc[campo]?.refId;
        if (refId) _npcDvIdsDoCadastro(indice[refId], dvIds);
    }
    for (const p of F.npc.peculiaridades) {
        if (p.refId) _npcDvIdsDoCadastro(F.sys.pecsById[p.refId], dvIds);
    }
    // "Todo personagem tem este valor" também é vínculo — e ele pode ter sido
    // marcado no registro depois que este NPC nasceu.
    const dvsUniversais = (F.sys.derivedValues || []).filter(d => d.todoPersonagem);

    const vinc = F.npc.valoresDer.vinculados = F.npc.valoresDer.vinculados || [];
    const jaTem = new Set(vinc);
    const dvsNovos = [];
    const vincular = (dv) => {
        if (!dv || jaTem.has(dv.key)) return;
        jaTem.add(dv.key);
        vinc.push(dv.key);
        dvsNovos.push(dv.nome);
    };
    dvsUniversais.forEach(vincular);
    (F.sys.derivedValues || []).forEach(dv => { if (dvIds.has(dv.id)) vincular(dv); });

    // --- 3) Módulos de classe (mesma defasagem, mesma cura) ---
    const modsAntes = F.npc.modulosClasse.length;
    const classeRefId = F.npc.classeRef?.refId;
    if (classeRefId) {
        for (const def of modulosDaClasseNpc(classeRefId, F.sys)) {
            if (F.npc.modulosClasse.some(m => m.refId === def.id)) continue;
            F.npc.modulosClasse.push({ refId: def.id, snapshot: null, fonte: 'classe', itens: [] });
        }
    }
    const modsNovos = F.npc.modulosClasse.length - modsAntes;

    renderPecs(); renderPecPicker(); renderNpcClassModules(); recalcStats();

    const partes = [];
    if (pecsNovas.length) partes.push(`${pecsNovas.length} peculiaridade(s): ${pecsNovas.join(', ')}`);
    if (dvsNovos.length) partes.push(`${dvsNovos.length} valor(es) derivado(s): ${dvsNovos.join(', ')}`);
    if (modsNovos) partes.push(`${modsNovos} módulo(s) de classe`);

    showAlert(partes.length
        ? `🔄 Vinculado — ${partes.join(' · ')}. Salve para gravar.`
        : '✅ Nada faltando: a ficha já bate com os registros.',
        partes.length ? 'success' : 'warning');
};

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
    renderPecs();   // o bloco muda de editável para leitura conforme o modo
    recalcStats();
};

/* ===== PECULIARIDADES ===== */
function renderPecs() {
    const el = document.getElementById('npcPecsList'); if (!el) return;

    // Contagem no título: o bloco nasce fechado, então o cabeçalho precisa
    // dizer o que tem dentro sem obrigar a abrir.
    const contador = document.getElementById('npcPecsCount');
    if (contador) contador.textContent = F.npc.peculiaridades.length
        ? `${F.npc.peculiaridades.length} vinculada(s)` : 'nenhuma';

    if (!F.npc.peculiaridades.length) {
        el.innerHTML = '<div class="npcv2-empty">Nenhuma peculiaridade. Selecione uma raça/classe/tribo do registro ou adicione abaixo.</div>';
        return;
    }

    // No Modo Rápido as peculiaridades aparecem, mas só para leitura: o Mestre
    // que preenche à mão precisa VER o que a origem deu sem poder desfazer o
    // vínculo por engano. Editar continua sendo trabalho do Modo Mecânico.
    const soLeitura = F.npc.modoFicha === 'rapido';

    el.innerHTML = F.npc.peculiaridades.map((p, idx) => {
        const reg = p.refId ? F.sys.pecsById[p.refId] : null;
        const nome = reg ? reg.nome : (p.nomeCustom || 'Sem nome');
        const icone = reg ? (reg.icone || '📋') : '✏️';
        const fonte = p.fonte ? `<span class="npcv2-pec-fonte">${escapeHtml(p.fonte)}</span>` : (reg ? '' : '<span class="npcv2-pec-fonte">custom</span>');
        const desc = reg ? (reg.descricao || '') : [p.efeitoManual, p.descricao].filter(Boolean).join(' — ');
        // Nível editável quando a peculiaridade tem mecânica evoluível (ou é custom com nível)
        const evoluivel = reg ? (reg.mecanicaIds || []).some(id => F.sys.mechsById[id]?.evoluivel) : false;
        const nivelHtml = !evoluivel ? ''
            : soLeitura
                ? `<span class="npcv2-pec-nivel">Nv ${p.nivel || 1}</span>`
                : `<span class="npcv2-pec-nivel">Nv <input type="number" min="1" value="${p.nivel || 1}" onchange="F.npc.peculiaridades[${idx}].nivel=parseInt(this.value)||1;recalcStats()"></span>`;
        const delHtml = soLeitura ? ''
            : `<button class="npcv2-pec-del" onclick="F.npc.peculiaridades.splice(${idx},1);renderPecs();recalcStats()" title="Remover">✕</button>`;
        return `<div class="npcv2-pec-row" title="${escapeHtml(desc)}">
            <span class="npcv2-pec-nome">${icone} ${escapeHtml(nome)}</span>${fonte}${nivelHtml}${delHtml}
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
    const nome = await perguntar('Nome da peculiaridade personalizada:');
    if (!nome || !nome.trim()) return;
    const efeito = await perguntar('Efeito (texto livre, opcional):') || '';
    F.npc.peculiaridades.push({ refId: null, nomeCustom: nome.trim(), efeitoManual: efeito.trim(), nivel: 1 });
    renderPecs(); recalcStats();
};

/* ===== MÓDULOS DE CLASSE (Ficha de NPC) =====
   Vínculos armazenados em npc.modulosClasse:
   [{ refId, snapshot, fonte: 'classe'|'manual', itens: [{...valores do schema}] }]
   - fonte 'classe': populado automaticamente ao selecionar uma classe do registro
   - fonte 'manual': vinculado pelo Mestre via picker */

function _npcModDef(vinc) {
    return resolveNpcClassModule(vinc, F.sys);
}

function _npcModItemVazio(def) {
    const item = {};
    (def.schema || []).forEach(f => {
        if (f.tipo === 'progress') { item[f.key + '_atual'] = ''; item[f.key + '_total'] = ''; }
        else if (f.tipo === 'steps' || f.tipo === 'tags') item[f.key] = [];
        else if (f.tipo === 'checkbox') item[f.key] = false;
        else if (f.tipo === 'avaliacao' || f.tipo === 'contador') item[f.key] = 0;
        else if (f.tipo === 'botao' || f.tipo === 'separador') { /* sem valor */ }
        else item[f.key] = '';
    });
    return item;
}

function _npcModFieldHtml(mi, ii, field, item) {
    const key = field.key;
    const label = escapeHtml(field.label || key || '');
    const set = (prop, expr) => `setNpcModItemField(${mi},${ii},'${prop}',${expr})`;
    if (field.tipo === 'separador') {
        return `<div class="npcv2-mod-sep">${label}</div>`;
    }
    if (field.tipo === 'botao') return '';
    let input = '';
    const val = item[key];
    if (field.tipo === 'textarea') {
        input = `<textarea class="form-textarea" rows="2" placeholder="${escapeHtml(field.placeholder || '')}" oninput="${set(key, 'this.value')}">${escapeHtml(String(val ?? ''))}</textarea>`;
    } else if (field.tipo === 'select') {
        const opts = (field.opcoes || []).map(o => `<option value="${escapeHtml(o)}" ${val === o ? 'selected' : ''}>${escapeHtml(o)}</option>`).join('');
        input = `<select class="form-select" onchange="${set(key, 'this.value')}"><option value="">— Selecionar —</option>${opts}</select>`;
    } else if (field.tipo === 'checkbox') {
        input = `<label class="npcv2-check"><input type="checkbox" ${val === true || val === 'true' ? 'checked' : ''} onchange="${set(key, 'this.checked')}"> ${label}</label>`;
        return `<div class="npcv2-mod-field">${input}</div>`;
    } else if (field.tipo === 'number' || field.tipo === 'contador' || field.tipo === 'avaliacao') {
        input = `<input type="number" class="form-input" value="${escapeHtml(String(val ?? ''))}" placeholder="${escapeHtml(field.placeholder || '')}" oninput="${set(key, "this.value===''?'':parseFloat(this.value)||0")}">`;
    } else if (field.tipo === 'progress') {
        input = `<div style="display:flex;gap:6px;align-items:center">
            <input type="text" class="form-input" style="text-align:center" placeholder="0" value="${escapeHtml(String(item[key + '_atual'] ?? ''))}" oninput="${set(key + '_atual', 'this.value')}">
            <span style="color:var(--muted)">/</span>
            <input type="text" class="form-input" style="text-align:center" placeholder="0" value="${escapeHtml(String(item[key + '_total'] ?? ''))}" oninput="${set(key + '_total', 'this.value')}">
        </div>`;
    } else if (field.tipo === 'data') {
        input = `<input type="date" class="form-input" value="${escapeHtml(String(val ?? ''))}" oninput="${set(key, 'this.value')}">`;
    } else if (field.tipo === 'select_botao') {
        // 🔘 O valor guardado é o ID de uma MECÂNICA — sem isto o campo mostrava
        // "c71FVX70xj1mDzqNt3tc" no lugar do nome dela.
        const mechs = (F.sys.mechanics || []).slice().sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
        const opts = mechs.map(m => `<option value="${escapeHtml(m.id)}" ${val === m.id ? 'selected' : ''}>${escapeHtml(m.nome || m.id)}</option>`).join('');
        const orfa = val && !mechs.some(m => m.id === val);
        input = `<select class="form-select" onchange="${set(key, 'this.value')}">
            <option value="">— Nenhuma mecânica —</option>${opts}
            ${orfa ? `<option value="${escapeHtml(String(val))}" selected>⚠️ mecânica fora do registro (${escapeHtml(String(val))})</option>` : ''}
        </select>`;
    } else if (field.tipo === 'select_vd') {
        // 📊 Idem, mas o ID é de um Valor Derivado
        const dvs = (F.sys.derivedValues || []).slice().sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
        const opts = dvs.map(d => `<option value="${escapeHtml(d.id)}" ${val === d.id ? 'selected' : ''}>${escapeHtml((d.icone || '📊') + ' ' + (d.nome || d.id))}</option>`).join('');
        const orfa = val && !dvs.some(d => d.id === val);
        input = `<select class="form-select" onchange="${set(key, 'this.value')}">
            <option value="">— Nenhum Valor Derivado —</option>${opts}
            ${orfa ? `<option value="${escapeHtml(String(val))}" selected>⚠️ VD fora do registro (${escapeHtml(String(val))})</option>` : ''}
        </select>`;
    } else if (field.tipo === 'valor_derivado') {
        // 📊 O VD é fixo no schema; o que se digita aqui é o VALOR dele
        const dv = (F.sys.derivedValues || []).find(d => d.id === field.derivedValueId);
        const nome = dv ? `${dv.icone || '📊'} ${dv.nome}` : '📊 VD não encontrado no registro';
        input = `<input type="number" class="form-input" value="${escapeHtml(String(val ?? ''))}" title="${escapeHtml(nome)}"
            placeholder="${escapeHtml(nome)}" oninput="${set(key, "this.value===''?'':parseFloat(this.value)||0")}">`;
        return `<div class="npcv2-mod-field"><label class="form-label">${label} <span class="npcv2-pec-fonte">${escapeHtml(nome)}</span></label>${input}</div>`;
    } else {
        // text e demais tipos → texto livre
        input = `<input type="text" class="form-input" value="${escapeHtml(String(val ?? ''))}" placeholder="${escapeHtml(field.placeholder || '')}" oninput="${set(key, 'this.value')}">`;
    }
    return `<div class="npcv2-mod-field"><label class="form-label">${label}</label>${input}</div>`;
}

function renderNpcClassModules() {
    const list = document.getElementById('npcClassModulesList'); if (!list) return;
    const mods = F.npc.modulosClasse || [];
    if (!mods.length) {
        list.innerHTML = '<div class="npcv2-empty">Nenhum módulo vinculado. Selecione uma classe do registro (os módulos dela entram automaticamente) ou vincule manualmente abaixo.</div>';
    } else {
        list.innerHTML = mods.map((vinc, mi) => {
            const def = _npcModDef(vinc);
            if (!def) {
                return `<div class="npcv2-mod-box"><div class="npcv2-mod-head">
                    <span>⚠️ Módulo não encontrado no registro</span>
                    <button class="npcv2-pec-del" onclick="removeNpcClassModule(${mi})" title="Desvincular">✕</button>
                </div></div>`;
            }
            const fonte = vinc.fonte === 'classe' ? '<span class="npcv2-pec-fonte">classe</span>' : '<span class="npcv2-pec-fonte">manual</span>';
            const itens = (vinc.itens || []).map((item, ii) => `
                <div class="npcv2-mod-item">
                    <div class="npcv2-mod-item-head">
                        <span>${escapeHtml(item._predefNome || `${def.titulo} #${ii + 1}`)}</span>
                        <button class="npcv2-pec-del" onclick="removeNpcModuleItem(${mi},${ii})" title="Remover item">✕</button>
                    </div>
                    <div class="npcv2-mod-fields">
                        ${(def.schema || []).map(f => _npcModFieldHtml(mi, ii, f, item)).join('')}
                    </div>
                </div>`).join('');
            const predefs = def.itensPredefinidos || [];
            const predefSel = predefs.length ? `
                <select class="form-select btn-small" id="npcModPredef_${mi}" style="max-width:220px">
                    ${predefs.map((p, pi) => `<option value="${pi}">${escapeHtml(p.nome || 'Item')}</option>`).join('')}
                </select>
                <button class="btn btn-secondary btn-small" onclick="addNpcModuleItem(${mi}, parseInt(document.getElementById('npcModPredef_${mi}').value))">➕ Pré-cadastrado</button>` : '';
            return `<div class="npcv2-mod-box">
                <div class="npcv2-mod-head">
                    <span>${def.icone || '📦'} ${escapeHtml(def.titulo)} ${fonte}</span>
                    <button class="npcv2-pec-del" onclick="removeNpcClassModule(${mi})" title="Desvincular módulo">✕</button>
                </div>
                <div class="npcv2-mod-items">${itens || '<div class="npcv2-empty">Nenhum item.</div>'}</div>
                <div class="npcv2-mod-actions">
                    <button class="btn btn-secondary btn-small" onclick="addNpcModuleItem(${mi})">➕ Novo item</button>
                    ${predefSel}
                </div>
            </div>`;
        }).join('');
    }
    renderNpcModPicker();
}
window.renderNpcClassModules = renderNpcClassModules;

function renderNpcModPicker() {
    const sel = document.getElementById('npcModPicker'); if (!sel) return;
    const usados = new Set((F.npc.modulosClasse || []).map(v => v.refId || (v.snapshot && v.snapshot.id)).filter(Boolean));
    const disponiveis = (F.sys.classModules || [])
        .filter(m => !usados.has(m.id))
        .slice().sort((a, b) => (a.titulo || '').localeCompare(b.titulo || ''));
    sel.innerHTML = disponiveis.length
        ? disponiveis.map(m => `<option value="${m.id}">${m.icone || '📦'} ${escapeHtml(m.titulo)}</option>`).join('')
        : '<option value="">Nenhum módulo disponível no registro</option>';
}

window.addNpcClassModule = function() {
    const id = document.getElementById('npcModPicker')?.value;
    if (!id || !F.sys.classModulesById[id]) return;
    F.npc.modulosClasse = F.npc.modulosClasse || [];
    if (F.npc.modulosClasse.some(v => v.refId === id)) return;
    F.npc.modulosClasse.push({ refId: id, snapshot: null, fonte: 'manual', itens: [] });
    renderNpcClassModules();
};

window.removeNpcClassModule = function(mi) {
    const vinc = F.npc.modulosClasse?.[mi]; if (!vinc) return;
    if ((vinc.itens || []).length && !await confirmar('Este módulo possui itens preenchidos. Desvincular mesmo assim?')) return;
    F.npc.modulosClasse.splice(mi, 1);
    renderNpcClassModules();
};

window.addNpcModuleItem = function(mi, predefIdx) {
    const vinc = F.npc.modulosClasse?.[mi]; if (!vinc) return;
    const def = _npcModDef(vinc); if (!def) return;
    const item = _npcModItemVazio(def);
    if (predefIdx !== undefined && predefIdx !== null && !isNaN(predefIdx)) {
        const predef = (def.itensPredefinidos || [])[predefIdx];
        if (predef) {
            item._predefId = predef.id || '';
            item._predefNome = predef.nome || '';
            if (predef.valores && typeof predef.valores === 'object') {
                Object.keys(predef.valores).forEach(k => { item[k] = predef.valores[k]; });
            }
        }
    }
    vinc.itens = vinc.itens || [];
    vinc.itens.push(item);
    renderNpcClassModules();
};

window.removeNpcModuleItem = function(mi, ii) {
    const vinc = F.npc.modulosClasse?.[mi]; if (!vinc) return;
    vinc.itens.splice(ii, 1);
    renderNpcClassModules();
};

window.setNpcModItemField = function(mi, ii, key, val) {
    const item = F.npc.modulosClasse?.[mi]?.itens?.[ii]; if (!item) return;
    item[key] = val;
};

/* Escuta de estado: ao trocar a Classe do NPC, popula automaticamente a lista
   de módulos com os Módulos de Classe atrelados à classe selecionada.
   - Módulos herdados (fonte 'classe') SEM itens são removidos junto com a classe antiga.
   - Módulos herdados COM itens preenchidos são preservados como 'manual'. */
function syncClassModules(prevRefId, newRefId) {
    if (prevRefId === newRefId) return;
    F.npc.modulosClasse = (F.npc.modulosClasse || []).filter(v => {
        if (v.fonte !== 'classe') return true;
        if ((v.itens || []).length) { v.fonte = 'manual'; return true; }
        return false;
    });
    if (newRefId) {
        const mods = modulosDaClasseNpc(newRefId, F.sys);
        const usados = new Set(F.npc.modulosClasse.map(v => v.refId || (v.snapshot && v.snapshot.id)).filter(Boolean));
        for (const def of mods) {
            if (usados.has(def.id)) continue;
            const noRegistro = !!F.sys.classModulesById[def.id];
            F.npc.modulosClasse.push({
                refId: noRegistro ? def.id : null,
                snapshot: noRegistro ? null : def, // módulo inline legado: guarda snapshot
                fonte: 'classe',
                itens: []
            });
        }
    }
    renderNpcClassModules();
}

/* Itens do inventário do NPC (para mecânicas com Verificação de Equipamento) */
function _npcCalcOpts(npcId) {
    const NI = window._npcInv;
    return { items: (NI && npcId && NI.loadedFor === npcId) ? NI.items : [] };
}

/* ===== RECÁLCULO E RENDER DE STATS ===== */
window.recalcStats = function() {
    if (!F.npc || !F.sys) return;
    F.calc = calcularNpc(F.npc, F.sys, _npcCalcOpts(F.npc.id));
    renderAttrEffects();
    renderDvGrid();
    renderNpcAtaques();
    renderInfos();
};

/* ===== ATAQUES E EFEITOS ATIVOS =====
 * Uma linha por item equipado com Efeitos Ativos que contribua com algo próprio.
 * Os totais vêm de calc.porItem (npc-calc-engine): base do NPC + delta do item. */
function renderNpcAtaques() {
    const wrap = document.getElementById('npcAtaquesWrap');
    const table = document.getElementById('npcAtaquesTable');
    if (!wrap || !table) return;

    const linhas = F.calc?.porItem || [];
    if (!linhas.length) { wrap.style.display = 'none'; return; }

    // Só as colunas que algum item realmente usa
    const colDefs = [];
    for (const l of linhas) {
        for (const c of l.colunas) {
            if (c.bonus === 0 && c.total === 0) continue;
            if (!colDefs.some(x => x.key === c.key)) colDefs.push({ key: c.key, nome: c.nome, icone: c.icone });
        }
    }
    const temDano = linhas.some(l => l.dano);

    let html = '<thead><tr><th class="atk-col-item">Item</th>';
    if (temDano) html += '<th>💥 Dano</th>';
    for (const c of colDefs) html += `<th>${c.icone} ${escapeHtml(c.nome)}</th>`;
    html += '</tr></thead><tbody>';

    for (const l of linhas) {
        html += `<tr><td class="atk-col-item">
            <span class="atk-item-name">${escapeHtml(l.nome)}</span>
            ${l.estadoEquip ? `<small class="atk-item-state">${escapeHtml(l.estadoEquip)}</small>` : ''}
        </td>`;
        if (temDano) html += `<td class="atk-dano">${l.dano ? escapeHtml(l.dano) : '—'}${
            (l.tiposGolpe || []).map(tg => `<small class="atk-tipo-golpe" title="Barrado pela Blindagem ${escapeHtml(tg.nome)} do alvo">${tg.icone} ${escapeHtml(tg.nome)}</small>`).join('')
        }</td>`;
        for (const cd of colDefs) {
            const c = l.colunas.find(x => x.key === cd.key);
            if (!c) { html += '<td class="atk-val">—</td>'; continue; }
            const tip = `Base ${c.base} ${c.bonus >= 0 ? '+' : '−'} ${Math.abs(c.bonus)} (item) = ${c.total}`;
            html += `<td class="atk-val" title="${escapeHtml(tip)}">
                ${escapeHtml(c.prefixo)}<strong>${c.total}</strong>${escapeHtml(c.sufixo)}
                ${c.bonus !== 0 ? `<small class="atk-delta">${c.bonus > 0 ? '+' : ''}${c.bonus}</small>` : ''}
            </td>`;
        }
        html += '</tr>';
    }
    html += '</tbody>';

    table.innerHTML = html;
    wrap.style.display = '';
}

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

    // ⚔️ Status de Combate: os Status Vitais MAIS todo VD que o Painel do
    // Criador marcou com "exibir em status de combate". É o que o Mestre olha
    // durante a rodada, junto num lugar só — e sai da grid 📊 abaixo para não
    // aparecer duas vezes. Os com campo Atual ganham a caixinha atual/máx,
    // igual a Vitalidade, Energia e Sanidade.
    const combateKeys = new Set((F.sys.derivedValues || []).filter(d => d.statusCombate).map(d => d.key));
    // 📊 VDs: apenas os vinculados ao NPC (não lista mais todos os VDs do sistema)
    const vinc = F.npc.valoresDer.vinculados || [];
    // ⚔️ "Status de Combate" é um jeito de EXIBIR, não um vínculo: um VD de
    // classe (Graça de Palla, Bolha de Sangue) só aparece em quem realmente o
    // tem. Antes a grade mostrava todo VD marcado no registro, e um bardo
    // ficava com a Graça do Pallacerdote na ficha.
    const vitals = allDvs.filter(dv => dv.isVital || (combateKeys.has(dv.key) && vinc.includes(dv.key)));
    const dvs = allDvs.filter(dv => !dv.isVital && !combateKeys.has(dv.key) && vinc.includes(dv.key));

    const cellHtml = (dv, removable) => {
            const locked = dv.override !== null;
            const sysRef = (F.sys.vitalStats || []).find(x => x.key === dv.key) || (F.sys.derivedValues || []).find(x => x.key === dv.key) || {};
            // 🎒 VD de escopo "coluna" é calculado POR ITEM equipado: o valor
            // global é 0 de propósito, e o número que vale sai na linha de cada
            // arma. Sem dizer isso, "Acerto à Distância 0" parece defeito na
            // ficha — a de personagem já avisava, esta não.
            const porItem = sysRef.escopoItem === 'coluna';
            const AVISO_ITEM = ' — 🎒 calculado POR ITEM equipado: o total sai na linha de cada arma (aba Inventário). Aqui é a base, e 0 é o esperado.';
            const desc = (sysRef.descricao || 'Sem descrição cadastrada.') + (porItem ? AVISO_ITEM : '');
            const tip = dv.fontes.length ? dv.fontes.map(f => `${f.fonte}: ${f.texto}`).join('\n') : 'Sem mecânicas aplicáveis (base 0)';
            const editable = rapido || locked;
            const atual = dv.campoAtual
                ? `<input type="number" class="npcv2-dv-atual" title="Valor atual" placeholder="atual"
                     value="${F.npc.valoresDer.atual?.[dv.key] ?? ''}"
                     oninput="F.npc.valoresDer.atual['${dv.key}']=this.value===''?null:parseFloat(this.value)">`
                : '';
            const removeBtn = removable
                ? `<button class="npcv2-dv-unlink" title="Desvincular este Valor Derivado do NPC" onclick="removeNpcDv('${dv.key}')">✕</button>`
                : '';
            return `<div class="npcv2-dv-cell ${locked ? 'locked' : ''}" data-dvkey="${dv.key}">
                ${removeBtn}
                <div class="npcv2-dv-label" 
                     data-tt-title="${escapeHtml(dv.nome)}" 
                     data-tt-desc="${escapeHtml(desc)}" 
                     data-tt-extra="${escapeHtml(tip)}"
                     onmouseenter="handleNpcTooltipEnter(event, this)" 
                     onmouseleave="hideNpcTooltip()" 
                     onmousemove="moveNpcTooltip(event)">
                     ${dv.icone ? dv.icone + ' ' : ''}${escapeHtml(dv.nome)}${porItem ? ' 🎒' : ''}${locked ? ' 🔒' : ''}
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
    };

    /**
     * 🏹 Célula CALCULADA do alcance do disparo — mesma régua da ficha de
     * personagem (shared/alcance-disparo.js): vale o MENOR entre o alcance da
     * arma e FOR × 10 m, e a besta escapa do limite porque é armada por
     * manivela. Não é Valor Derivado, então não tem input nem ✕ de desvincular.
     * Devolve '' quando o NPC não tem arma de tiro equipada — célula vazia
     * seria pior que célula nenhuma.
     */
    const disparoCellHtml = () => {
        let linhas = [];
        try { linhas = linhasDeDisparoNpc(); } catch (e) { return ''; }
        if (!linhas.length) return '';

        const forca = Number(F.npc.atributos?.FOR) || 0;
        // 🤾 O braço que lança (ver shared/alcance-disparo.js): peça de
        // arremesso não tem alcance próprio, quem alcança é quem joga.
        const nivelDaPericia = nome => {
            const s = (F.sys.skills || []).find(x => (x.nome || '') === nome);
            if (!s) return 0;
            return Number(F.npc.periciasEstruturadas?.find(p => p.refId === s.id)?.nivel) || 0;
        };
        const braco = bracoDeArremesso(forca, nivelDaPericia('Atletismo'), nivelDaPericia('Arremessar'));
        const d = melhorDisparo(linhas, forca, braco);
        const cap = Math.max(...linhas.map(l => l.alcanceM));
        const arremesso = linhas.find(l => l.nome === d.arma && Number(l.alcanceFator) > 0);
        const valor = d.metros ? `${d.metros} m` : '—';
        const dica = !d.metros
            ? `${linhas[0].nome}: alcance não cadastrado no Painel do Criador`
            : arremesso
                ? `${d.arma} arremessada: (FOR + Atletismo + Arremessar) × ${arremesso.alcanceFator} `
                  + `= ${braco} × ${arremesso.alcanceFator}. Quem alcança é o braço, não a peça.`
                : d.limitadoPorFor
                    ? `${d.arma} alcança ${cap} m, mas FOR ${forca} sustenta ${forca * METROS_POR_FOR} m `
                      + `(${METROS_POR_FOR} m por ponto de FOR). Vale o menor dos dois.`
                    : `${d.arma} — o alcance da arma, que a FOR sustenta inteiro.`;

        return `<div class="npcv2-dv-cell npcv2-dv-calc${d.limitadoPorFor ? ' is-limitado' : ''}">
                <div class="npcv2-dv-label"
                     data-tt-title="Alcance do Disparo"
                     data-tt-desc="${escapeHtml(dica)}"
                     data-tt-extra="Sai da arma equipada e da FOR — não é Valor Derivado."
                     onmouseenter="handleNpcTooltipEnter(event, this)"
                     onmouseleave="hideNpcTooltip()"
                     onmousemove="moveNpcTooltip(event)">
                     🏹 Alcance do Disparo${d.limitadoPorFor ? ' ⚠️' : ''}
                </div>
                <div class="npcv2-dv-value"><b class="npcv2-dv-calc-val">${escapeHtml(valor)}</b></div>
            </div>`;
    };

    const vazio = msg => `<div class="npcv2-empty">${msg}</div>`;

    // Status Vital é do sistema (não se desvincula); VD de combate veio de um
    // vínculo e sai pelo mesmo ✕ da grade 📊 lá embaixo.
    vGrid.innerHTML = vitals.length
        ? vitals.map(dv => cellHtml(dv, !dv.isVital)).join('')
        : vazio('Nenhum status vital cadastrado no Painel de Criador.');

    // VDs agrupados pelo bloco do cadastro; a ordem já vem de F.sys.derivedValues
    // (ordenado por blocoOrdem → ordem), que é a ordem de inserção de F.calc.derived.
    if (!dvs.length) {
        dGrid.innerHTML = vazio('Nenhum Valor Derivado vinculado a este NPC. Use "➕ Vincular VD" abaixo.');
    } else {
        const blocoPorKey = new Map((F.sys.derivedValues || []).map(d => [d.key, d]));
        const blocos = new Map();
        for (const dv of dvs) {
            const ref = blocoPorKey.get(dv.key) || {};
            const id = ref.blocoId || 'geral';
            if (!blocos.has(id)) blocos.set(id, { nome: ref.blocoNome || 'Geral', ordem: ref.blocoOrdem ?? 999, dvs: [] });
            blocos.get(id).dvs.push(dv);
        }
        // Mesma régua da ficha de personagem (combat-panel.js): bloco com
        // blocoOrdem abaixo de BLOCO_ABERTO_ATE nasce aberto — os primeiros da
        // escala, que são os de consulta na rodada. O resto fica dobrado.
        // 🏹 O alcance do disparo entra no bloco de Combate, no fim — igual à
        // ficha de personagem. Se o NPC não tiver bloco de Combate vinculado,
        // ele não aparece: sem contexto, o número não diz nada.
        const disparo = disparoCellHtml();
        dGrid.innerHTML = [...blocos.values()].map(b => {
            const extra = (disparo && /^combate$/i.test(b.nome)) ? disparo : '';
            return `
            <details class="npcv2-dv-bloco npcv2-dobra"${Number(b.ordem) < NPC_BLOCO_ABERTO_ATE ? ' open' : ''}>
                <summary class="npcv2-dv-bloco-title">${escapeHtml(b.nome)} <span class="npcv2-hint">${b.dvs.length + (extra ? 1 : 0)}</span></summary>
                <div class="npcv2-dv-grid">${b.dvs.map(dv => cellHtml(dv, true)).join('')}${extra}</div>
            </details>`;
        }).join('');
    }

    renderDvPicker();
    renderExtras();
}

/* ===== VINCULAÇÃO DE VALORES DERIVADOS ===== */
function renderDvPicker() {
    const sel = document.getElementById('npcDvPicker'); if (!sel) return;
    const vinc = new Set(F.npc.valoresDer.vinculados || []);
    const disponiveis = (F.sys.derivedValues || []).filter(dv => !vinc.has(dv.key));
    sel.innerHTML = disponiveis.length
        ? disponiveis.map(dv => `<option value="${dv.key}">${escapeHtml(dv.nome)}${dv.todoPersonagem ? ' ⭐' : ''}</option>`).join('')
        : '<option value="">Todos os VDs do sistema já estão vinculados</option>';
}

window.addNpcDv = function() {
    const key = document.getElementById('npcDvPicker')?.value;
    if (!key) return;
    F.npc.valoresDer.vinculados = F.npc.valoresDer.vinculados || [];
    if (!F.npc.valoresDer.vinculados.includes(key)) F.npc.valoresDer.vinculados.push(key);
    recalcStats();
};

window.removeNpcDv = function(key) {
    const vd = F.npc.valoresDer;
    vd.vinculados = (vd.vinculados || []).filter(k => k !== key);
    vd.overrides[key] = null;
    if (vd.atual) vd.atual[key] = null;
    recalcStats();
};

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
    if (val === '') F.npc.valoresDer.overrides[key] = null;
    else F.npc.valoresDer.overrides[key] = parseFloat(val) || 0;
    // Não re-renderiza a grid inteira durante a digitação; só marca lock
    const cell = document.querySelector(`.npcv2-dv-cell[data-dvkey="${key}"]`);
    if (cell) cell.classList.add('locked');
};

window.clearDvOverride = function(key) {
    F.npc.valoresDer.overrides[key] = null;
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
    // Avisos: bloco de diagnóstico, nasce dobrado. A contagem vai no título
    // para o Mestre saber se vale abrir sem ter de abrir.
    const aw = document.getElementById('npcAvisosWrap'), al = document.getElementById('npcAvisosList');
    if (aw && al) {
        const n = F.calc.avisos.length;
        if (n) {
            aw.style.display = 'block';
            al.innerHTML = F.calc.avisos.map(a => `<div>⚠️ ${escapeHtml(a)}</div>`).join('');
            const cont = document.getElementById('npcAvisosCount');
            if (cont) cont.textContent = `${n} ⚠️`;
        } else aw.style.display = 'none';
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
            }).join('') : '<div class="npcv2-empty">Nenhuma mesa cadastrada.</div>';
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
        // 🤝 A moral só sabe listar depois que os personagens da mesa chegam.
        window.renderNpcMoral?.();
        if (picker) picker.innerHTML = '<option value="">Selecione um personagem...</option>' +
            chars.sort((a, b) => (a.nome || '').localeCompare(b.nome || '')).map(c => `<option value="${c.id}">${escapeHtml(c.nome || 'Sem nome')}${c.jogador ? ` (${escapeHtml(c.jogador)})` : ''}</option>`).join('');
    } catch (e) { if (picker) picker.innerHTML = '<option value="">Erro ao carregar personagens</option>'; }

    renderVincChars();
}

function renderVincChars() {
    const el = document.getElementById('npcVincChars'); if (!el) return;
    const vincs = F.npc.vinculos.filter(v => v.tipo === 'personagem' && String(v.relacao).toLowerCase() !== 'aliado');
    if (!vincs.length) { el.innerHTML = '<div class="npcv2-empty">Nenhum personagem vinculado.</div>'; } else {
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
    if (!vincs.length) { el.innerHTML = '<div class="npcv2-empty">Nenhum aliado vinculado.</div>'; return; }
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
        if (!await confirmar('Isto criará um CLONE INDEPENDENTE deste NPC para vincular a este personagem. Deseja prosseguir?')) return;
        
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

    set('ecoDadiva', n.eco?.dadiva); set('ecoEstado', n.eco?.estado); set('ecoPersonalidade', n.eco?.personalidade);
    set('ecoDisposicao', n.eco?.disposicao); set('ecoPRS', n.eco?.prs); set('ecoPericia', n.eco?.pericia);
    set('ecoTerritorio', n.eco?.territorio); set('ecoPreco', n.eco?.preco);
    const mk = document.getElementById('ecoMascara'); if (mk) mk.checked = !!n.eco?.mascara;

    /* Um bloco por tipo: Criatura e Eco nunca aparecem juntos. */
    const _npcTipoSecoes = () => {
        const t = document.getElementById('npcTipo')?.value || n.tipo || 'npc';
        const c = document.getElementById('creatureFieldsSection'); if (c) c.style.display = t === 'criatura' ? 'block' : 'none';
        const e = document.getElementById('ecoFieldsSection'); if (e) e.style.display = t === 'eco' ? 'block' : 'none';
    };
    _npcTipoSecoes();
    document.getElementById('npcTipo')?.addEventListener('change', _npcTipoSecoes);
    document.getElementById('npcImagem')?.addEventListener('input', function() { const u = this.value.trim(), p = document.getElementById('npcImgPreview'); if (p) p.style.display = (u.startsWith('http') ? 'block' : 'none'); const img = document.getElementById('npcImgTag'); if (img) { img.src = u; img.onerror = () => { if (p) p.style.display = 'none'; }; } });
    if (n.imagem?.startsWith('http')) { const p = document.getElementById('npcImgPreview'); const img = document.getElementById('npcImgTag'); if (p && img) { img.src = n.imagem; p.style.display = 'block'; img.onerror = () => { p.style.display = 'none'; }; } }

    setNpcModo(n.modoFicha || 'rapido');
    set('npcVisibilidade', n.visibilidade || 'secreto');
    renderPecs();
    renderPecPicker();
    renderNpcClassModules();
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
        grid.innerHTML = '<div class="npcv2-empty">Nenhuma perícia adicionada.</div>';
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
        if (!await confirmar('Desmarcar esta opção irá desvincular TODAS as perícias padrões deste NPC. Quaisquer níveis aplicados a elas serão perdidos. Deseja continuar?', { perigo: true })) {
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
    if (!await confirmar('Remover esta perícia? Os níveis aplicados a ela serão perdidos.', { perigo: true })) return;
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
    const calc = calcularNpc(n, F.sys, _npcCalcOpts(n.id || F.npc?.id));
    const legacyDv = {};
    const atualEspelho = { ...(n.valoresDer.atual || {}) };
    for (const legacy of ['VIT', 'ENER', 'SAN', 'PERC', 'INI', 'REA', 'BLD']) {
        const key = findDvKeyLike(legacy, F.sys);
        if (key && calc.derived[key]) {
            legacyDv[legacy] = calc.derived[key].final;
            if (atualEspelho[key] !== undefined) atualEspelho[legacy] = atualEspelho[key];
        }
    }
    const desloc = (n.valoresDer.extras || []).find(x => F.sys.norm(x.nome).startsWith('desloc'));
    if (desloc) legacyDv.DESLOCAMENTO = String(desloc.valor ?? '');

    // Espelho dos VDs VINCULADOS pelo nome normalizado ("Desloc. Aéreo" →
    // DESLOC_AEREO). É o formato que o Tabuleiro resolve (valorComponente):
    // sem isto o doc só guardava overrides/atual por id e os VDs de Status de
    // Combate, deslocamentos e Tamanho do NPC não existiam fora do editor.
    const normEspelho = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
        .trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    for (const key of (n.valoresDer.vinculados || [])) {
        const d = calc.derived[key];
        if (!d || d.isVital) continue;
        const nk = normEspelho(d.nome);
        if (nk && legacyDv[nk] === undefined) legacyDv[nk] = d.final;
    }

    const funcao = [];
    if (document.getElementById('npcFuncAliado')?.checked) funcao.push('aliado');

    // `vinculos` aceita várias mesas; `mesaId` guarda só a primeira, como espelho
    // legado para telas antigas — quem lê pertencimento usa npcNaMesa().
    const mesaEspelho = espelhoMesaId(n.vinculos);

    return {
        schemaVersion: 2,
        modoFicha: n.modoFicha || 'rapido',
        nome: g('npcNome'), tipo, imagem: g('npcImagem'),
        nivel: gi('npcNivel') || 1,
        porte: g('npcPorte'), papel: g('npcPapel'), local: g('npcLocal'),
        tamanho: g('npcTamanho'), tags: g('npcTags'),
        funcao,
        aliadoProprio: document.getElementById('npcAliadoProprio')?.checked || false,
        visibilidade: g('npcVisibilidade') || n.visibilidade || 'secreto',

        // v2: referências híbridas + espelho legado em string
        racaRef: n.racaRef, classeRef: n.classeRef, triboRef: n.triboRef,
        raca: racaNome, classe: classeNome, tribo: triboNome,

        peculiaridades: n.peculiaridades,
        modulosClasse: n.modulosClasse || [],
        periciasEstruturadas: n.periciasEstruturadas,
        partesDoCorpo: Array.isArray(n.partesDoCorpo) ? n.partesDoCorpo : [],
        atributos: { ...Object.fromEntries(ATTR_SIGLAS.map(a => [a, parseInt(n.atributos?.[a]) || 0])) },
        valoresDer: {
            overrides: n.valoresDer.overrides || {},
            atual: atualEspelho,
            extras: n.valoresDer.extras || [],
            vinculados: n.valoresDer.vinculados || [],
            ...legacyDv
        },
        ai: gi('npcNivel') || n.ai || 0, // AI legado ≈ nível

        ataques: g('npcAtaques'), skills: g('npcSkills'),
        rolePlay: { personalidade: [g('npcPersonalidade1'), g('npcPersonalidade2'), g('npcPersonalidade3')], trejeitos: g('npcTrejeitos'), motivacao: g('npcMotivacao'), segredos: g('npcSegredos'), relacoes: { aliado: g('npcAliado'), rival: g('npcRival'), devedor: g('npcDevedor') }, frases: g('npcFrases'), historia: g('npcHistoria') },
        loot: { itens: g('npcItens'), luns: g('npcLuns'), pistas: g('npcPistas'), complicacoes: g('npcComplicacoes') },
        criatura: tipo === 'criatura' ? { habitat: g('npcHabitat'), comportamento: g('npcComportamento'), dieta: g('npcDieta'), nivelAmeaca: g('npcNivelAmeaca') } : null,
        /* ᛉ Eco da Alma — Disposição e Máscara são segredo do Mestre. */
        eco: tipo === 'eco' ? { dadiva: g('ecoDadiva'), estado: g('ecoEstado'), personalidade: g('ecoPersonalidade'),
            disposicao: parseInt(g('ecoDisposicao')) || 0, prs: parseInt(g('ecoPRS')) || 0,
            pericia: g('ecoPericia'), territorio: g('ecoTerritorio'), preco: g('ecoPreco'),
            mascara: !!document.getElementById('ecoMascara')?.checked } : null,

        vinculos: n.vinculos,
        mesaId: mesaEspelho, // espelho legado da 1ª mesa (ver comentário acima)

        lastUpdate: new Date().toISOString(), lastUpdateBy: S.currentUser?.email
    };
}

window.saveNpc = async function() {
    const data = collectNpcData(); if (!data.nome) { showAlert('⚠️ Nome obrigatório', 'warning'); return; }
    try {
        if (!currentEditingNpc) {
            // ✅ Garantia: ao CRIAR um NPC, os Status Vitais ATUAIS nascem iguais ao MÁXIMO
            const calcNovo = calcularNpc(F.npc, F.sys, _npcCalcOpts(F.npc?.id));
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
        if (currentEditingNpc) { 
            await setDoc(doc(db, 'npcs', currentEditingNpc.id), data, { merge: true }); 
            await addLog(S.currentUser?.email, 'Editou NPC', data.nome, 'npcs'); 
            
            // Sincroniza alterações de MAX HP/SAN/ENER com o Combat Tracker caso o NPC esteja lá
            if (window.S && S.combatParticipants && window.persistCombat) {
                let updatedComb = false;
                S.combatParticipants.forEach(p => {
                    if (p.npcId === currentEditingNpc.id) {
                        const vd = data.valoresDer || {};
                        if (vd.VIT !== undefined) { p.hpMax = vd.VIT; p.hpCurrent = Math.min(p.hpCurrent, vd.VIT); }
                        if (vd.ENER !== undefined) { p.enerMax = vd.ENER; p.enerCurrent = Math.min(p.enerCurrent, vd.ENER); }
                        if (vd.SAN !== undefined) { p.sanMax = vd.SAN; p.sanCurrent = Math.min(p.sanCurrent, vd.SAN); }
                        
                        // Atualiza também os vitais ATUAIS se foram modificados explicitamente na ficha
                        if (vd.atual?.VIT !== undefined) p.hpCurrent = Math.min(vd.atual.VIT, p.hpMax);
                        if (vd.atual?.ENER !== undefined) p.enerCurrent = Math.min(vd.atual.ENER, p.enerMax);
                        if (vd.atual?.SAN !== undefined) p.sanCurrent = Math.min(vd.atual.SAN, p.sanMax);
                        
                        updatedComb = true;
                    }
                });
                if (updatedComb) {
                    S.setCombatParticipants([...S.combatParticipants]);
                    if (window.renderCombatList) window.renderCombatList();
                    persistCombat();
                }
            }
            showAlert('✅ NPC atualizado!', 'success'); 
        } else { 
            await setDoc(doc(collection(db, 'npcs')), data); 
            await addLog(S.currentUser?.email, 'Criou NPC', data.nome, 'npcs'); 
            showAlert('✅ NPC criado!', 'success'); 
        }
        closeNpcModal(); await loadAllNpcs(); if (window._loadMesaNpcs) await window._loadMesaNpcs();
    } catch (e) { console.error(e); showAlert('❌ Erro ao salvar', 'danger'); }
};

window.closeNpcModal = function() { 
    document.getElementById('npcModal')?.classList.remove('active'); 
    currentEditingNpc = null; 
    F.npc = null; 
    if (_npcModalUnsubscribe) { _npcModalUnsubscribe(); _npcModalUnsubscribe = null; }
};

window.deleteCurrentNpc = async function() {
    if (!currentEditingNpc || !await confirmar(`Deletar "${currentEditingNpc.nome}"?`, { perigo: true })) return;
    try { await deleteDoc(doc(db, 'npcs', currentEditingNpc.id)); await addLog(S.currentUser?.email, 'Deletou NPC', currentEditingNpc.nome, 'npcs'); showAlert('✅ Deletado', 'success'); closeNpcModal(); await loadAllNpcs(); if (window._loadMesaNpcs) await window._loadMesaNpcs(); } catch (e) { showAlert('❌ Erro', 'danger'); }
};

// ===== BATCH =====
window.selectAllFilteredNpcs = function() { const cbs = document.querySelectorAll('.npc-checkbox'); const all = Array.from(cbs).every(c=>c.checked); cbs.forEach(c=>{c.checked=!all}); showAlert(`☑️ ${cbs.length} ${all?'desselecionados':'selecionados'}`, 'success'); };

window.deleteSelectedNpcs = async function() {
    const cbs = document.querySelectorAll('.npc-checkbox:checked'); if (!cbs.length) { showAlert('⚠️ Selecione NPCs', 'warning'); return; }
    const names = Array.from(cbs).map(cb => S.allNpcs.find(n=>n.id===cb.dataset.npcId)?.nome||'-');
    if (!await confirmar(`Deletar ${cbs.length} NPC(s)?\n${names.join('\n')}`, { perigo: true })) return;
    try { for (const cb of cbs) { await deleteDoc(doc(db, 'npcs', cb.dataset.npcId)); await addLog(S.currentUser?.email, 'Deletou NPC', names.shift(), 'npcs'); } showAlert(`✅ ${cbs.length} deletado(s)`, 'success'); await loadAllNpcs(); } catch (e) { showAlert('❌ Erro', 'danger'); }
};

window.duplicateSelectedNpcs = async function() {
    const cbs = document.querySelectorAll('.npc-checkbox:checked'); if (!cbs.length) { showAlert('⚠️ Selecione NPCs', 'warning'); return; }
    if (!await confirmar(`Duplicar ${cbs.length} NPC(s)?`)) return;
    let c = 0;
    try { for (const cb of cbs) { const n = S.allNpcs.find(x=>x.id===cb.dataset.npcId); if (!n) continue; const copy = {...n, nome: n.nome+' (Cópia)', lastUpdate: new Date().toISOString(), lastUpdateBy: S.currentUser?.email}; delete copy.id; await setDoc(doc(collection(db, 'npcs')), copy); await addLog(S.currentUser?.email, 'Duplicou NPC', `${n.nome} → ${copy.nome}`, 'npcs'); c++; } showAlert(`✅ ${c} duplicado(s)`, 'success'); await loadAllNpcs(); } catch (e) { showAlert('❌ Erro', 'danger'); }
};

window.exportSelectedNpcs = async function() {
    const cbs = document.querySelectorAll('.npc-checkbox:checked');
    
    // Nenhum NPC selecionado → baixar JSON modelo com instruções
    if (!cbs.length) {
        const template = _buildNpcTemplate();
        const blob = new Blob([JSON.stringify(template, null, 2)], {type:'application/json'});
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `modelo_npc_${Date.now()}.json`; document.body.appendChild(a); a.click(); document.body.removeChild(a);
        showAlert('📄 Modelo de NPC exportado! Preencha e use "📥 Importar" para criar NPCs.', 'success');
        return;
    }

    const rawData = Array.from(cbs).map(cb => { const n = S.allNpcs.find(x=>x.id===cb.dataset.npcId); return n ? {...n, exportDate: new Date().toISOString(), exportedBy: S.currentUser?.email} : null; }).filter(Boolean);
    
    for (const n of rawData) {
        let inventoryItems = [];
        try {
            const snap = await getDocs(query(collection(db, 'items'), where('characterId', '==', n.id)));
            snap.forEach(d => inventoryItems.push({ id: d.id, ...d.data() }));
        } catch(e) { console.error('Erro ao exportar itens', e); }
        n.inventoryItems = inventoryItems;
    }

    const blob = new Blob([JSON.stringify(rawData, null, 2)], {type:'application/json'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `npcs_${Date.now()}.json`; document.body.appendChild(a); a.click(); document.body.removeChild(a);
    showAlert(`✅ ${rawData.length} exportado(s)`, 'success');
};

function _buildNpcTemplate() {
    return [
        {
            "_instrucoes": [
                "=== MODELO DE NPC — Lendas & Relíquias ===",
                "Este é um modelo para criar NPCs via importação JSON.",
                "Campos que começam com '_' (como este) são IGNORADOS na importação.",
                "Duplique este objeto dentro do array para criar múltiplos NPCs.",
                "",
                "CAMPO 'modoFicha':",
                "  'mecanico' → usa referências dos registros (racaRef.refId, peculiaridades com refId, etc.)",
                "  'rapido'   → usa texto livre (raca, classe, tribo como strings simples)",
                "",
                "CAMPO 'tipo': 'npc' ou 'criatura'",
                "  Se 'criatura', preencha o objeto 'criatura' com habitat, comportamento, dieta, nivelAmeaca.",
                "",
                "REFERÊNCIAS HÍBRIDAS (racaRef, classeRef, triboRef):",
                "  Para usar um registro existente: { 'refId': 'ID_DO_REGISTRO', 'custom': '' }",
                "  Para texto livre:               { 'refId': null, 'custom': 'Nome personalizado' }",
                "  Sempre preencha também os espelhos legados: raca, classe, tribo (strings com o nome).",
                "",
                "PECULIARIDADES:",
                "  Do registro: { 'refId': 'ID_DA_PECULIARIDADE', 'nivel': 1, 'fonte': 'raca'|'classe'|'tribo'|null }",
                "  Personalizada: { 'refId': null, 'nomeCustom': 'Nome', 'efeitoManual': 'Efeito', 'nivel': 1 }",
                "",
                "PERÍCIAS ESTRUTURADAS:",
                "  { 'refId': 'ID_DA_PERICIA', 'nivel': 2 }",
                "",
                "VALORES DERIVADOS:",
                "  'vinculados' → array de keys dos VDs que o NPC possui (ex: ['VIT_MAX','ENER_MAX'])",
                "  'overrides'  → { 'KEY': valor } para travar manualmente",
                "  'atual'      → { 'KEY': valor } para valor atual durante o jogo",
                "  'extras'     → [{ 'nome': 'Deslocamento', 'valor': '9m' }]",
                "",
                "MÓDULOS DE CLASSE:",
                "  { 'refId': 'ID_DO_MODULO', 'snapshot': null, 'fonte': 'classe'|'manual', 'itens': [] }",
                "",
                "PARTES DO CORPO:",
                "  Copie do registro de bodyParts: { 'id': 'bp_xxx', 'nome': 'Mão', 'icone': '✋', 'slots': 2, ... }",
                "",
                "ITENS DE INVENTÁRIO (inventoryItems):",
                "  Array de objetos com: nome, tipo, peso, tamanho, quantidade, equipado, etc.",
                "  Tipos: 'Arma','Vestimenta','Acessório','Projétil','Container','Objeto','Consumível','Relíquia'",
                "",
                "Use o botão '📦 Ex.Especial' para exportar todos os registros de uma biblioteca",
                "(raças, classes, peculiaridades, etc.) com IDs reais do seu sistema.",
                "Alimente esse JSON a uma IA para que ela gere NPCs com referências corretas."
            ],
            "schemaVersion": 2,
            "modoFicha": "mecanico",
            "nome": "Nome do NPC",
            "tipo": "npc",
            "imagem": "",
            "nivel": 1,
            "porte": "Médio",
            "papel": "",
            "local": "",
            "tamanho": "",
            "tags": "",
            "funcao": [],
            "aliadoProprio": false,
            "visibilidade": "secreto",

            "racaRef": { "refId": null, "custom": "" },
            "classeRef": { "refId": null, "custom": "" },
            "triboRef": { "refId": null, "custom": "" },
            "raca": "",
            "classe": "",
            "tribo": "",

            "atributos": {
                "INT": 0, "RAC": 0, "PRS": 0,
                "FOR": 0, "DES": 0, "VIG": 0,
                "PRE": 0, "MAN": 0, "AUT": 0
            },

            "peculiaridades": [],
            "periciasEstruturadas": [],
            "modulosClasse": [],
            "partesDoCorpo": [],

            "valoresDer": {
                "overrides": {},
                "atual": {},
                "extras": [],
                "vinculados": []
            },

            "ataques": "",
            "skills": "",

            "rolePlay": {
                "personalidade": ["", "", ""],
                "trejeitos": "",
                "motivacao": "",
                "segredos": "",
                "relacoes": { "aliado": "", "rival": "", "devedor": "" },
                "frases": "",
                "historia": ""
            },

            "loot": {
                "itens": "",
                "luns": "",
                "pistas": "",
                "complicacoes": ""
            },

            "criatura": null,

            "inventoryItems": [],

            "vinculos": [],
            "mesaId": ""
        }
    ];
}

window.exportNpcFromForm = async function() {
    const data = collectNpcData(); data.exportDate = new Date().toISOString(); data.exportedBy = S.currentUser?.email;
    const currentId = currentEditingNpc?.id;
    let inventoryItems = [];
    if (currentId) {
        try {
            const snap = await getDocs(query(collection(db, 'items'), where('characterId', '==', currentId)));
            snap.forEach(d => inventoryItems.push({ id: d.id, ...d.data() }));
        } catch(e) { console.error('Erro ao exportar itens', e); }
    }
    data.inventoryItems = inventoryItems;
    
    const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `npc_${(data.nome||'sem_nome').replace(/\s+/g,'_')}_${Date.now()}.json`; document.body.appendChild(a); a.click(); document.body.removeChild(a);
    showAlert('✅ Exportado!', 'success');
};

window.bulkImportNpcs = function() {
    let fi = document.getElementById('npcBulkFile');
    if (!fi) { fi = document.createElement('input'); fi.type='file'; fi.id='npcBulkFile'; fi.accept='.json'; fi.multiple=true; fi.style.display='none'; document.body.appendChild(fi);
        fi.addEventListener('change', async e => { const files = Array.from(e.target.files); if (!files.length) return; if (!await confirmar(`Importar ${files.length} arquivo(s)?`)) { fi.value=''; return; }
            let cr=0,up=0,er=0;
            for (const f of files) { try { const list = JSON.parse(await f.text()); const arr = Array.isArray(list)?list:[list];
                for (const d of arr) { try { 
                    const inventoryItems = d.inventoryItems;
                    // Limpa campos de instrução/meta (chaves com _ no início) e campos internos
                    Object.keys(d).forEach(k => { if (k.startsWith('_')) delete d[k]; });
                    delete d.id; delete d.firestoreId; delete d.exportDate; delete d.exportedBy; delete d.inventoryItems;
                    d.lastUpdate = new Date().toISOString(); d.lastUpdateBy = S.currentUser?.email;
                    if (!d.nome || !d.nome.trim()) { er++; continue; } // pula NPCs sem nome
                    const ex = S.allNpcs.find(n=>n.nome&&d.nome&&n.nome.toLowerCase().trim()===d.nome.toLowerCase().trim());
                    let finalId = null;
                    if (ex) { await setDoc(doc(db,'npcs',ex.id), d, {merge:true}); up++; finalId = ex.id; } 
                    else { const docRef = await addDoc(collection(db,'npcs'), d); cr++; finalId = docRef.id; }
                    
                    if (finalId && Array.isArray(inventoryItems) && inventoryItems.length > 0) {
                        const oldItemsSnap = await getDocs(query(collection(db, 'items'), where('characterId', '==', finalId)));
                        for (const oi of oldItemsSnap.docs) { await deleteDoc(oi.ref); }
                        
                        let idMap = {};
                        inventoryItems.forEach(item => { idMap[item.id] = 'item-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6); });
                        for (const item of inventoryItems) {
                            const newId = idMap[item.id];
                            if (!newId) continue;
                            item.characterId = finalId;
                            if (item.parentItemId && idMap[item.parentItemId]) item.parentItemId = idMap[item.parentItemId];
                            delete item.id;
                            await setDoc(doc(db, 'items', newId), item);
                        }
                    }
                } catch(ie) { er++; } }
            } catch(fe) { er++; } }
            await loadAllNpcs(); showAlert(`✅ ${cr} criado(s), ${up} atualizado(s), ${er} erro(s)`, cr+up>0?'success':'danger'); fi.value='';
        });
    } fi.click();
};

// =====================================================================
// ===== EXPORTAÇÃO ESPECIAL — Registros do Sistema para IAs =====
// Exporta TODOS os registros de uma biblioteca (raças, classes, etc.)
// em formato JSON, acompanhado de instruções claras sobre como
// referenciar esses registros ao gerar o JSON de um NPC para importação.
// =====================================================================

const SPECIAL_EXPORT_OPTIONS = [
    { value: 'races',          label: '🧬 Raças',             collection: 'system/data/races' },
    { value: 'classes',        label: '⚔️ Classes',           collection: 'system/data/classes' },
    { value: 'tribes',         label: '🏕️ Tribos',            collection: 'system/data/tribes' },
    { value: 'derivedValues',  label: '📊 Valores Derivados', collection: 'system/data/derivedValues' },
    { value: 'vitalStats',     label: '❤️ Status Vitais',     collection: 'system/data/vitalStats' },
    { value: 'peculiarities',  label: '✨ Peculiaridades',    collection: 'system/data/peculiarities' },
    { value: 'skills',         label: '📚 Perícias',          collection: 'system/data/skills' },
    { value: 'equipment',      label: '🗡️ Equipamentos',     collection: 'system/data/equipment' },
    { value: 'conditions',     label: '💀 Condições',         collection: 'system/data/conditions' },
    { value: 'auras',          label: '🌟 Auras',             collection: 'system/data/auras' },
    { value: 'bodyParts',      label: '🦴 Partes do Corpo',   collection: 'system/data/bodyParts' },
];

window.openSpecialExportModal = function() {
    document.getElementById('specialExportModal')?.remove();
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'specialExportModal';
    modal.innerHTML = `<div class="modal-content" style="max-width:550px">
        <div class="modal-header">
            <span class="modal-title">📦 Exportação Especial — Registros do Sistema</span>
            <button class="modal-close" onclick="this.closest('.modal').remove()">✕</button>
        </div>
        <div class="modal-body">
            <p style="color:var(--muted);font-size:.88rem;margin-bottom:14px">
                Selecione a biblioteca do sistema que deseja exportar. O JSON gerado incluirá <strong>todos os registros cadastrados</strong> e um bloco de <strong>instruções para IA</strong> explicando como usar esses registros ao gerar fichas de NPC para importação.
            </p>
            <div class="form-group">
                <label class="form-label">Biblioteca</label>
                <select class="form-select" id="specialExportSelect" size="11" style="height:auto">
                    ${SPECIAL_EXPORT_OPTIONS.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
                </select>
            </div>
            <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end">
                <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancelar</button>
                <button class="btn btn-success" onclick="executeSpecialExport()">📦 Exportar</button>
            </div>
        </div>
    </div>`;
    document.body.appendChild(modal);
};

window.executeSpecialExport = async function() {
    const sel = document.getElementById('specialExportSelect');
    const chosen = sel?.value;
    if (!chosen) { showAlert('⚠️ Selecione uma biblioteca', 'warning'); return; }

    const opt = SPECIAL_EXPORT_OPTIONS.find(o => o.value === chosen);
    if (!opt) return;

    showAlert('⏳ Carregando registros...', 'info');

    try {
        const snap = await getDocs(collection(db, opt.collection));
        const registros = [];
        snap.forEach(d => {
            const data = d.data();
            if (data.publicado !== false) registros.push({ id: d.id, ...data });
        });

        const instructions = buildSpecialExportInstructions(chosen, registros);

        const output = {
            _meta: {
                tipo: 'exportacao_especial_registro',
                biblioteca: opt.label,
                codigoInterno: chosen,
                totalRegistros: registros.length,
                exportadoEm: new Date().toISOString(),
                exportadoPor: S.currentUser?.email || 'mestre'
            },
            _instrucoes_para_ia: instructions,
            registros
        };

        const blob = new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `registro_${chosen}_${Date.now()}.json`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);

        showAlert(`✅ ${registros.length} registro(s) de "${opt.label}" exportados!`, 'success');
        document.getElementById('specialExportModal')?.remove();
    } catch (e) {
        console.error(e);
        showAlert('❌ Erro ao carregar registros: ' + e.message, 'danger');
    }
};

function buildSpecialExportInstructions(tipo, registros) {
    const npcSchemaBase = `
SCHEMA DO NPC PARA IMPORTAÇÃO (schemaVersion: 2):
O JSON de cada NPC deve ser um objeto (ou um array de objetos) com os seguintes campos:
{
  "schemaVersion": 2,
  "modoFicha": "mecanico",           // "mecanico" usa referências dos registros | "rapido" usa texto livre
  "nome": "Nome do NPC",             // OBRIGATÓRIO
  "tipo": "npc",                     // "npc" ou "criatura"
  "imagem": "",                      // URL da imagem (opcional)
  "nivel": 1,                        // nível numérico do NPC
  "porte": "Médio",                  // "Minúsculo","Pequeno","Médio","Grande","Enorme","Colossal"
  "papel": "",                       // papel narrativo: Ferreiro, Guarda, etc.
  "local": "",                       // localização no mundo
  "tamanho": "",                     // tamanho descritivo (texto livre)
  "tags": "",                        // tags separadas por vírgula

  // ===== REFERÊNCIAS HÍBRIDAS (modo mecânico) =====
  // Use o campo "refId" com o ID do registro. Se a raça/classe/tribo não existir
  // no registro, use "custom" com o nome em texto livre.
  "racaRef":   { "refId": "ID_DA_RACA_DO_REGISTRO", "custom": "" },
  "classeRef": { "refId": "ID_DA_CLASSE_DO_REGISTRO", "custom": "" },
  "triboRef":  { "refId": "ID_DA_TRIBO_DO_REGISTRO", "custom": "" },

  // Espelhos legados (texto) — o sistema os preenche automaticamente,
  // mas inclua-os para compatibilidade:
  "raca": "Nome da Raça",
  "classe": "Nome da Classe",
  "tribo": "Nome da Tribo",

  // ===== ATRIBUTOS =====
  // 9 atributos base do sistema, valores numéricos inteiros
  "atributos": {
    "INT": 0, "RAC": 0, "PRS": 0,
    "FOR": 0, "DES": 0, "VIG": 0,
    "PRE": 0, "MAN": 0, "AUT": 0
  },

  // ===== PECULIARIDADES =====
  // Array de objetos. Para vincular do registro use "refId" com o ID.
  // Para peculiaridades personalizadas, use "nomeCustom" e "efeitoManual".
  // "fonte" indica a origem: "raca", "classe", "tribo" ou null (manual).
  "peculiaridades": [
    { "refId": "ID_DA_PECULIARIDADE", "nivel": 1, "fonte": "raca" },
    { "refId": null, "nomeCustom": "Personalizada", "efeitoManual": "Efeito livre", "nivel": 1 }
  ],

  // ===== PERÍCIAS ESTRUTURADAS =====
  // Array de objetos com "refId" (ID da perícia do registro) e "nivel" numérico.
  "periciasEstruturadas": [
    { "refId": "ID_DA_PERICIA", "nivel": 2 }
  ],

  // ===== VALORES DERIVADOS =====
  "valoresDer": {
    "overrides": {},              // { "KEY_DO_VD": valorNumerico } para travar manualmente
    "atual": {},                  // valores atuais (VIT atual, ENER atual, etc.)
    "extras": [],                 // [{ "nome": "Deslocamento", "valor": "9m" }]
    "vinculados": []              // array de keys dos VDs vinculados a este NPC
  },

  // ===== MÓDULOS DE CLASSE =====
  // Módulos vinculados — use "refId" com o ID do módulo do registro.
  "modulosClasse": [
    {
      "refId": "ID_DO_MODULO",
      "snapshot": null,
      "fonte": "classe",           // "classe" = herança automática | "manual" = vinculado pelo mestre
      "itens": []                  // array de objetos com campos conforme o schema do módulo
    }
  ],

  // ===== PARTES DO CORPO =====
  // Defina a anatomia do NPC. Use IDs do registro de bodyParts ou custom.
  "partesDoCorpo": [
    { "id": "ID_DA_PARTE", "nome": "Mão", "icone": "✋", "slots": 2,
      "podeSegurar": true, "podeEmpunhar": true, "podeVestir": false, "podeFixar": false }
  ],

  // ===== COMBATE =====
  "ataques": "",                  // texto livre de ataques e danos
  "skills": "",                   // texto livre de perícias (legado)

  // ===== ROLE PLAY =====
  "rolePlay": {
    "personalidade": ["traço 1", "traço 2", "traço 3"],
    "trejeitos": "",
    "motivacao": "",
    "segredos": "",
    "relacoes": { "aliado": "", "rival": "", "devedor": "" },
    "frases": "",
    "historia": ""
  },

  // ===== LOOT =====
  "loot": {
    "itens": "",                  // texto livre
    "luns": "",                   // quantidade de moedas
    "pistas": "",
    "complicacoes": ""
  },

  // ===== CRIATURA (só se tipo === "criatura") =====
  "criatura": {
    "habitat": "",
    "comportamento": "",
    "dieta": "",
    "nivelAmeaca": ""             // "inofensivo","baixo","medio","alto","letal"
  },

  // ===== ITENS DE INVENTÁRIO (opcional — importados junto com o NPC) =====
  // Array de objetos representando itens da mochila/equipamento do NPC.
  "inventoryItems": [
    {
      "nome": "Espada Longa",
      "tipo": "Arma",              // "Arma","Vestimenta","Acessório","Projétil","Container","Objeto","Consumível","Relíquia"
      "categoriaArma": "uma_mao",  // só se tipo=Arma: "uma_mao","duas_maos","versatil","escudo","distancia"
      "peso": 1.5,
      "tamanho": 1,
      "quantidade": 1,
      "descricao": "",
      "imagem": "",
      "equipavelEm": ["ID_PARTE_DO_CORPO"],
      "formaEquipar": "empunhar",  // "segurar","empunhar","vestir","fixar" ou null
      "equipado": false,
      "slotAnatomico": null,
      "estadoEquip": null,
      "parentItemId": null,        // se dentro de container, ID do container
      "ehContainer": false,
      "pesoMaximoContainer": null,
      "multiplicadorPressao": null,
      "mecanicaIdsProprias": []
    }
  ],

  "visibilidade": "secreto",      // "secreto" ou "publico"
  "vinculos": [],                  // vínculos com mesas e personagens
  "mesaId": ""                     // ID da mesa (legado)
}`;

    const specific = {
        races: `
COMO USAR ESTES REGISTROS DE RAÇAS:
- Cada registro tem um "id" (ex: "abc123"). Use este ID no campo "racaRef.refId" do NPC.
- As peculiaridades raciais estão em "peculiaridadeIds" — ao criar o NPC, adicione cada uma ao array "peculiaridades" com { "refId": "<ID>", "nivel": 1, "fonte": "raca" }.
- O campo "partesDoCorpo" da raça define a anatomia padrão — copie-o para o campo "partesDoCorpo" do NPC se quiser manter a anatomia racial.
- Use o campo "nome" da raça no campo "raca" (string) do NPC para compatibilidade legada.

EXEMPLO:
Se a raça "Humano" tem id "raca_humano" e peculiaridades ["pec_001", "pec_002"], o NPC ficaria:
  "racaRef": { "refId": "raca_humano", "custom": "" },
  "raca": "Humano",
  "peculiaridades": [
    { "refId": "pec_001", "nivel": 1, "fonte": "raca" },
    { "refId": "pec_002", "nivel": 1, "fonte": "raca" }
  ]`,

        classes: `
COMO USAR ESTES REGISTROS DE CLASSES:
- Use o "id" da classe no campo "classeRef.refId" do NPC.
- Peculiaridades de classe estão em "bonusIniciais" — adicione ao array "peculiaridades" com fonte "classe".
- Perícias de classe estão em "pericClasse" — adicione ao array "periciasEstruturadas" com { "refId": "<ID>", "nivel": 0 }.
- Módulos de classe estão em "modulosDaClasse" (array de IDs) — adicione ao array "modulosClasse" com { "refId": "<ID>", "snapshot": null, "fonte": "classe", "itens": [] }.
- Use "nome" da classe no campo "classe" (string) do NPC.

EXEMPLO:
Se a classe "Guerreiro" tem id "cls_guerreiro", bonusIniciais ["pec_x"] e modulosDaClasse ["mod_y"]:
  "classeRef": { "refId": "cls_guerreiro", "custom": "" },
  "classe": "Guerreiro",
  "peculiaridades": [{ "refId": "pec_x", "nivel": 1, "fonte": "classe" }],
  "modulosClasse": [{ "refId": "mod_y", "snapshot": null, "fonte": "classe", "itens": [] }]`,

        tribes: `
COMO USAR ESTES REGISTROS DE TRIBOS:
- Use o "id" da tribo no campo "triboRef.refId" do NPC.
- Peculiaridades tribais estão em "peculiaridadeIds" — adicione ao array "peculiaridades" com fonte "tribo".
- Use "nome" da tribo no campo "tribo" (string) do NPC.

EXEMPLO:
Se a tribo "Comuno" tem id "trb_comuno" e peculiaridades ["pec_a"]:
  "triboRef": { "refId": "trb_comuno", "custom": "" },
  "tribo": "Comuno",
  "peculiaridades": [{ "refId": "pec_a", "nivel": 1, "fonte": "tribo" }]`,

        derivedValues: `
COMO USAR ESTES REGISTROS DE VALORES DERIVADOS:
- Cada registro tem um "key" — use este key para referenciá-lo no NPC.
- Adicione as keys dos VDs que o NPC possui em "valoresDer.vinculados": ["key1", "key2"].
- Para travar um valor manualmente, defina em "valoresDer.overrides": { "key1": 10 }.
- Se o registro tem "campoAtual": true, pode definir o atual em "valoresDer.atual": { "key1": 8 }.
- VDs com "todoPersonagem": true são vinculados automaticamente ao abrir a ficha.

EXEMPLO:
  "valoresDer": {
    "overrides": {},
    "atual": { "VIT_MAX": 20 },
    "extras": [],
    "vinculados": ["VIT_MAX", "ENER_MAX", "SAN_MAX", "PERC", "INI"]
  }`,

        vitalStats: `
COMO USAR ESTES REGISTROS DE STATUS VITAIS:
- Status vitais (VIT, ENER, SAN) são calculados automaticamente pelas mecânicas vinculadas.
- Cada registro tem um "key" — use-o em "valoresDer.vinculados" e "valoresDer.atual".
- Para sobrescrever manualmente, adicione em "valoresDer.overrides": { "VIT_MAX": 25 }.
- O campo "atual" armazena o valor corrente durante o jogo: "valoresDer.atual": { "VIT_MAX": 18 }.
- O sistema também espelha esses valores nas chaves legadas VIT, ENER, SAN automaticamente.`,

        peculiarities: `
COMO USAR ESTES REGISTROS DE PECULIARIDADES:
- Cada registro tem um "id" — use no campo "refId" dentro do array "peculiaridades" do NPC.
- O campo "fonte" indica de onde a peculiaridade vem: "raca", "classe", "tribo", ou null para manual.
- O campo "nivel" é numérico (padrão 1). Peculiaridades com mecânicas evoluíveis podem ter nível maior.
- Para peculiaridades personalizadas (sem registro): { "refId": null, "nomeCustom": "Nome", "efeitoManual": "Texto", "nivel": 1 }.

EXEMPLO:
  "peculiaridades": [
    { "refId": "pec_001", "nivel": 1, "fonte": "raca" },
    { "refId": "pec_002", "nivel": 3, "fonte": "classe" },
    { "refId": null, "nomeCustom": "Visão Noturna", "efeitoManual": "+2 em percepção no escuro", "nivel": 1 }
  ]`,

        skills: `
COMO USAR ESTES REGISTROS DE PERÍCIAS:
- Cada registro tem um "id" — use no campo "refId" dentro do array "periciasEstruturadas" do NPC.
- O campo "nivel" é numérico (0 a 10), indica o grau de proficiência naquela perícia.
- Perícias com "todoPersonagem": true entram por padrão ao ativar "Tem todas as Perícias Padrões?".
- O campo "categoria" indica o tipo: "fisico", "mental", "social", "combate", "exclusivo".

EXEMPLO:
  "periciasEstruturadas": [
    { "refId": "skill_furtividade", "nivel": 3 },
    { "refId": "skill_diplomacia", "nivel": 2 },
    { "refId": "skill_arco", "nivel": 4 }
  ]`,

        equipment: `
COMO USAR ESTES REGISTROS DE EQUIPAMENTOS:
- Equipamentos do registro servem como TEMPLATE. Para dar um item ao NPC, crie uma entrada
  no array "inventoryItems" copiando os dados do template (nome, tipo, peso, etc.).
- Campos relevantes do template: nome, tipo, categoriaArma, peso, tamanho, equipavelEm (array de IDs
  de bodyParts), formaEquipar, ehContainer, pesoMaximoContainer, multiplicadorPressao, mecanicaIds.
- No inventoryItems do NPC, adicione campos extras: equipado (bool), slotAnatomico (string/null),
  estadoEquip ("empunhado"/"segurar"/"vestido"/"fixado"/null), quantidade, characterId (deixe vazio).

EXEMPLO:
  "inventoryItems": [
    {
      "nome": "Espada Longa",
      "tipo": "Arma",
      "categoriaArma": "uma_mao",
      "peso": 1.5,
      "tamanho": 1,
      "quantidade": 1,
      "descricao": "Uma espada de aço comum.",
      "equipavelEm": ["ID_da_mao"],
      "formaEquipar": "empunhar",
      "equipado": false,
      "slotAnatomico": null,
      "estadoEquip": null,
      "parentItemId": null,
      "ehContainer": false,
      "mecanicaIdsProprias": []
    }
  ]`,

        conditions: `
COMO USAR ESTES REGISTROS DE CONDIÇÕES:
- Condições são aplicadas a personagens/NPCs durante o jogo (atordoado, cego, etc.).
- Elas NÃO são campos diretos do JSON de NPC — são gerenciadas pelo sistema de combate/mesa.
- Use os IDs e nomes destes registros para referência nas descrições, mecânicas ou loot dos NPCs.
- Cada condição tem: nome, descricao, duracao, removivel, icone, e efeitoMecanicaIds.`,

        auras: `
COMO USAR ESTES REGISTROS DE AURAS:
- Auras são concedidas por peculiaridades (campo "concedeAura" + "auraVinculadaId" da peculiaridade).
- Elas NÃO são campos diretos do JSON de NPC — são resolvidas automaticamente pelas peculiaridades.
- Se uma peculiaridade do NPC concede uma aura, basta vincular a peculiaridade correta.
- Cada aura tem: nome, tipo ("propriedade"/"mortalidade"), propriedadeTipo, propriedadeVinculada, graus.`,

        bodyParts: `
COMO USAR ESTES REGISTROS DE PARTES DO CORPO:
- Cada registro tem um "id" — use no array "partesDoCorpo" do NPC.
- Copie os campos relevantes: id, nome, icone, slots, podeSegurar, podeEmpunhar, podeVestir, podeFixar.
- Partes com "ehPadrao": true compõem a anatomia humanoide padrão.
- Para criaturas, monte anatomias customizadas adicionando partes não-padrão (Cauda, Asa, etc.).

EXEMPLO:
  "partesDoCorpo": [
    { "id": "bp_cabeca", "nome": "Cabeça", "icone": "🗣️", "slots": 1, "podeSegurar": false, "podeEmpunhar": false, "podeVestir": true, "podeFixar": true },
    { "id": "bp_mao", "nome": "Mão", "icone": "✋", "slots": 2, "podeSegurar": true, "podeEmpunhar": true, "podeVestir": false, "podeFixar": false }
  ]`
    };

    return `
=== INSTRUÇÕES PARA GERAÇÃO DE NPCs VIA IA ===

Este arquivo contém todos os registros da biblioteca "${tipo}" do sistema Lendas & Relíquias.
Use os IDs dos registros abaixo para gerar fichas de NPC em formato JSON que possam ser
importadas diretamente no Painel do Mestre (botão "📥 Importar" na aba NPCs).

O JSON de importação aceita um único NPC (objeto) ou múltiplos NPCs (array de objetos).

${npcSchemaBase}

${specific[tipo] || 'Use os IDs dos registros listados em "registros" para referenciar nas fichas de NPC.'}

=== REGISTROS DISPONÍVEIS ===
Total: ${registros.length} registro(s) do tipo "${tipo}".
Todos os registros estão listados no campo "registros" deste JSON.
Use o campo "id" de cada registro para fazer referências nos NPCs.
`;
}
