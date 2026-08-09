import { collection, getDocs, doc, getDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

let _aliadosLoaded = false;
let currentAliadoNpc = null;
let currentAliadoOpts = {};
let _charIdAtual = null;

/* ---------------------------------------------------------------------
   🤝 LEALDADE — 0 a 10, por vínculo (não por NPC): o mesmo aliado pode
   andar com dois personagens e confiar em cada um de um jeito.
   Mora em npcs/{id}.vinculos[n].lealdade, ao lado do id do personagem.
   Sobe e desce por decisão narrativa do Mestre (±1 por sessão; ±2/±3 em
   eventos marcantes). Abaixo de 3 o vínculo se desfaz e o aliado volta a
   exigir consentimento.
   --------------------------------------------------------------------- */
const LEALDADE_MIN = 0, LEALDADE_MAX = 10;

/** Lealdade deste NPC com este personagem. Vínculo sem o campo = 0. */
function lealdadeDe(npc, charId) {
    const v = (npc?.vinculos || []).find(v => v.tipo === 'personagem' && v.id === charId);
    const n = Number(v?.lealdade);
    return Number.isFinite(n) ? Math.min(LEALDADE_MAX, Math.max(LEALDADE_MIN, n)) : 0;
}

window.lealdadeDe = lealdadeDe;   // usado pelo harness __check-lealdade.html

/* Faixa da escala → classe de SIGNIFICADO (perigo / atenção / sucesso /
   místico). A cor mora em styles_v2.css, em token, e vira com o tema. */
function faixaDaLealdade(n) {
    if (n <= 2) return 'leal-perigo';    // desconfiança — vínculo não se sustenta
    if (n <= 5) return 'leal-atencao';   // convivência
    if (n <= 8) return 'leal-sucesso';   // confiança — faixa de vínculo
    return 'leal-mistico';               // devoção
}

// Escutar clique na aba
document.addEventListener('DOMContentLoaded', () => {
    // Usar mutation observer caso a aba não exista no carregamento ou bind imediato
    const bindTab = () => {
        const tabAliados = document.querySelector('.tab[data-tab="tabAliados"]');
        if (tabAliados) {
            tabAliados.addEventListener('click', () => {
                if (!_aliadosLoaded && window.currentCharacterId) {
                    loadAliados(window.currentCharacterId);
                }
            });
            return true;
        }
        return false;
    };
    
    if (!bindTab()) {
        setTimeout(bindTab, 1000);
    }
});

// Listener global caso a aba não precise ser clicada mas queiramos recarregar
document.addEventListener('systemDataReady', () => {
    _aliadosLoaded = false;
});

async function loadAliados(charId) {
    const grid = document.getElementById('aliadosGrid');
    if (!grid) return;
    grid.innerHTML = '<div style="font-size:12px;color:var(--muted);text-align:center;grid-column: 1/-1;padding:20px;">Carregando aliados...</div>';

    try {
        const snap = await getDocs(collection(window.db, 'npcs'));
        const npcs = [];
        snap.forEach(d => {
            const data = d.data();
            npcs.push({ id: d.id, ...data });
        });
        
        // Filtra NPCs que possuem vinculo com este charId e tipo 'personagem'
        const vinculados = npcs.filter(n => {
            if (!n.vinculos || !Array.isArray(n.vinculos)) return false;
            return n.vinculos.some(v => v.tipo === 'personagem' && v.id === charId);
        });

        _charIdAtual = charId;
        renderAliados(vinculados);
        _aliadosLoaded = true;
    } catch (e) {
        console.error("Erro ao buscar aliados", e);
        grid.innerHTML = '<div style="color:var(--danger);grid-column:1/-1;text-align:center;">❌ Erro ao carregar aliados.</div>';
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function renderAliados(aliados) {
    const grid = document.getElementById('aliadosGrid');
    if (!grid) return;

    if (!aliados.length) {
        grid.innerHTML = '<div style="font-size:12px;color:var(--muted);text-align:center;grid-column: 1/-1;padding:20px;">Nenhum aliado vinculado.</div>';
        return;
    }

    grid.innerHTML = aliados.map(n => {
        const hasImg = !!n.imagem;
        const leal = lealdadeDe(n, _charIdAtual);
        return `
        <div class="npc-card"
             onclick="window.openAliadoModal('${n.id}')"
             onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
            <div class="aliado-card-head">
                <div class="aliado-card-nome">${escapeHtml(n.nome || 'Sem Nome')}</div>
                <div class="aliado-card-nivel">Nível ${n.nivel || 1}</div>
            </div>
            ${hasImg ? `<img class="aliado-card-img" src="${escapeHtml(n.imagem)}" alt="">` : ''}
            <div class="aliado-card-tipo">
                ${n.tipo === 'criatura' ? '🐉 Criatura' : '👤 NPC'} ${n.classe?.custom ? ' - ' + escapeHtml(n.classe.custom) : ''}
            </div>
            <div class="aliado-card-leal"
                 title="Lealdade: quanto este aliado confia em você. Sobe e desce por decisão do Mestre.">
                <span>🤝 Lealdade</span>
                <button type="button" class="aliado-card-leal-btn" onclick="event.stopPropagation(); window.ajustarLealdade('${n.id}', -1)"
                    ${leal <= LEALDADE_MIN ? 'disabled' : ''}>−</button>
                <strong class="aliado-card-leal-num ${faixaDaLealdade(leal)}">${leal}</strong>
                <button type="button" class="aliado-card-leal-btn" onclick="event.stopPropagation(); window.ajustarLealdade('${n.id}', 1)"
                    ${leal >= LEALDADE_MAX ? 'disabled' : ''}>+</button>
                <span>/ ${LEALDADE_MAX}</span>
            </div>
            <div class="aliado-card-hint">
                <em>Clique para visualizar a ficha</em>
            </div>
        </div>`;
    }).join('');
}

/**
 * Ajusta a Lealdade deste aliado com o personagem aberto.
 * Relê o doc antes de gravar: `vinculos` é o campo canônico do NPC e pode ter
 * mudado noutra mesa desde que a aba carregou — só o item deste personagem é tocado.
 */
window.ajustarLealdade = async function (npcId, delta) {
    if (!_charIdAtual) return;
    try {
        const ref = doc(window.db, 'npcs', npcId);
        const snap = await getDoc(ref);
        if (!snap.exists()) return;

        const vinculos = (snap.data().vinculos || []).map(v => {
            if (v.tipo !== 'personagem' || v.id !== _charIdAtual) return v;
            const atual = Number.isFinite(Number(v.lealdade)) ? Number(v.lealdade) : 0;
            return { ...v, lealdade: Math.min(LEALDADE_MAX, Math.max(LEALDADE_MIN, atual + delta)) };
        });

        await updateDoc(ref, { vinculos });
        _aliadosLoaded = false;
        await loadAliados(_charIdAtual);
    } catch (e) {
        console.error('Erro ao ajustar Lealdade', e);
    }
};

window.openAliadoModal = async function(npcId, opts) {
    const modal = document.getElementById('aliadoNpcModal');
    const body = document.getElementById('aliadoNpcModalBody');
    if (!modal || !body) return;

    currentAliadoOpts = opts || {};

    body.innerHTML = '<div class="al-loading">⏳ Carregando dados do aliado...</div>';
    modal.classList.remove('hidden');

    try {
        // Busca o documento atualizado
        const snap = await getDocs(collection(window.db, 'npcs'));
        const npcs = [];
        snap.forEach(d => {
            const data = d.data();
            npcs.push({ id: d.id, ...data });
        });
        
        currentAliadoNpc = npcs.find(n => n.id === npcId);
        if (!currentAliadoNpc) throw new Error("NPC não encontrado");

        body.innerHTML = buildAliadoForm();
        fillAliadoForm(currentAliadoNpc);
        await renderAliadoDerivedValues(currentAliadoNpc);
        await renderAliadoClassModules(currentAliadoNpc);
        if (currentAliadoOpts.readonly) _applyAliadoReadonly(body);
    } catch (e) {
        console.error(e);
        body.innerHTML = '<div class="al-error">❌ Erro ao carregar dados do aliado.</div>';
    }
};

/* Modo somente leitura (usado pelo Tabuleiro para NPCs Públicos abertos por jogadores):
   restringe a exibição à view de Modo Rápido, sem edição/salvamento. */
function _applyAliadoReadonly(body) {
    body.querySelectorAll('input, textarea, select').forEach(el => {
        el.disabled = true;
        el.readOnly = true;
    });
    body.querySelectorAll('button').forEach(btn => {
        const oc = btn.getAttribute('onclick') || '';
        if (!oc.includes('aliadoSwitchSection')) btn.style.display = 'none';
    });
}

window.closeAliadoModal = function() {
    const modal = document.getElementById('aliadoNpcModal');
    if (modal) modal.classList.add('hidden');
    currentAliadoNpc = null;
};

window.aliadoSwitchSection = function(secId) {
    const modal = document.getElementById('aliadoNpcModal');
    if (!modal) return;
    
    // As abas usam a classe .tab do styles_v2.css
    modal.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    // Os conteúdos usam .tab-content
    modal.querySelectorAll('.tab-content').forEach(s => s.classList.remove('active'));
    
    const btn = modal.querySelector(`.tab[data-sec="${secId}"]`);
    const sec = document.getElementById(`alSec_${secId}`);
    
    if (btn) btn.classList.add('active');
    if (sec) sec.classList.add('active');

    // Carrega o inventário do aliado sob demanda
    if (secId === 'inventario' && currentAliadoNpc && window.renderAliadoInventario) {
        const p = window.renderAliadoInventario(currentAliadoNpc);
        if (currentAliadoOpts.readonly) {
            const body = document.getElementById('aliadoNpcModalBody');
            const reapply = () => body && _applyAliadoReadonly(body);
            (p && typeof p.then === 'function') ? p.then(reapply).catch(() => {}) : setTimeout(reapply, 400);
        }
    }
};

function buildAliadoForm() {
    return `
    <div class="al-topbar">
        <div class="al-head">
            <div class="al-portrait" id="al_portrait">
                <span class="al-portrait-rune" aria-hidden="true">🜲</span>
                <img id="al_portrait_img" alt="">
            </div>
            <div class="al-head-main">
                <div class="al-head-kicker">Ficha do Aliado</div>
                <h3 class="al-head-name" id="al_head_name">—</h3>
            </div>
            <button class="al-save" onclick="window.saveAliadoNpc()">💾 Salvar</button>
        </div>

        <div class="tabs">
            <button type="button" class="tab active" data-sec="identidade" onclick="aliadoSwitchSection('identidade')">Identidade</button>
            <button type="button" class="tab" data-sec="mecanica" onclick="aliadoSwitchSection('mecanica')">Mecânica</button>
            <button type="button" class="tab" data-sec="inventario" onclick="aliadoSwitchSection('inventario')">Inventário</button>
            <button type="button" class="tab" data-sec="roleplay" onclick="aliadoSwitchSection('roleplay')">Role Play</button>
            <button type="button" class="tab" data-sec="loot" onclick="aliadoSwitchSection('loot')">Loot</button>
        </div>
    </div>

    <!-- ============ SEÇÃO: IDENTIDADE ============ -->
    <div class="tab-content active" id="alSec_identidade">
        <div class="section">
            <div class="section-title">Informações Básicas</div>
            <div class="row">
                <div class="field"><label>🖼️ Imagem</label>${CampoImagem.html({ id: 'al_imagem', pasta: 'imagens/aliados', preview: false, attrs: 'oninput="alRefreshPortrait()"' })}</div>
            </div>
            <div class="row" style="grid-template-columns: 2fr 1fr 1fr;">
                <div class="field"><label>Nome *</label><input type="text" id="al_nome" placeholder="Nome do NPC" oninput="alRefreshHeadName()"></div>
                <div class="field">
                    <label>Tipo *</label>
                    <select id="al_tipo">
                        <option value="npc">👤 NPC</option>
                        <option value="criatura">🐉 Criatura</option>
                    </select>
                </div>
                <div class="field"><label>Nível</label><input type="number" id="al_nivel" value="1" min="1" style="text-align: center;"></div>
            </div>
            
            <div class="row" style="grid-template-columns: 1fr 1fr 1fr;">
                <div class="field"><label>Raça</label><input type="text" id="al_raca"></div>
                <div class="field"><label>Classe</label><input type="text" id="al_classe"></div>
                <div class="field"><label>Tribo</label><input type="text" id="al_tribo"></div>
            </div>
            
            <div class="row" style="grid-template-columns: 1fr 1fr 1fr;">
                <div class="field">
                    <label>Porte</label>
                    <select id="al_porte">
                        <option value="">Selecione</option>
                        <option>Minúsculo</option><option>Pequeno</option><option>Médio</option>
                        <option>Grande</option><option>Enorme</option><option>Colossal</option>
                    </select>
                </div>
                <div class="field"><label>Papel</label><input type="text" id="al_papel" placeholder="Comerciante, Guarda..."></div>
                <div class="field"><label>Local</label><input type="text" id="al_local"></div>
            </div>
            
            <div class="row" style="grid-template-columns: 1fr 1fr;">
                <div class="field"><label>Tamanho</label><input type="text" id="al_tamanho"></div>
                <div class="field"><label>Tags (separadas por vírgula)</label><input type="text" id="al_tags" placeholder="tag1, tag2"></div>
            </div>
        </div>
    </div>

    <!-- ============ SEÇÃO: MECÂNICA ============ -->
    <div class="tab-content" id="alSec_mecanica">
        <div class="section">
            <div class="section-title">Status Vitais</div>
            <div class="al-vitals">
                ${[
                    ['❤️ Vitalidade', 'al_vit_atual', 'al_vit'],
                    ['⚡ Energia',    'al_ener_atual', 'al_ener'],
                    ['🧠 Sanidade',   'al_san_atual', 'al_san']
                ].map(([label, idAtual, idMax]) => `
                <div class="al-vital">
                    <span class="al-vital-label">${label}</span>
                    <div class="al-vital-pair">
                        <input type="number" id="${idAtual}" value="0" title="Atual" placeholder="Atual">
                        <span class="al-vital-sep">/</span>
                        <input type="number" id="${idMax}" value="0" title="Máximo" placeholder="Máx.">
                    </div>
                    <small class="al-vital-hint">Atual / Máx.</small>
                </div>`).join('')}
            </div>
            <!-- Lealdade: eixo do companheiro (Bestiário, "Como se lê uma fera").
                 0–10; melhorias a partir de 6, uma por ponto, teto 5. -->
            <div class="al-vital" style="margin-top:8px;">
                <span class="al-vital-label">🐾 Lealdade</span>
                <div class="al-vital-pair">
                    <input type="number" id="al_lealdade" value="0" min="0" max="10" title="Lealdade (0–10)">
                    <span class="al-vital-sep">/ 10</span>
                </div>
                <small class="al-vital-hint">melhorias a partir de 6 — uma por ponto (teto 5)</small>
            </div>
        </div>

        <div class="section">
            <div class="section-title">Atributos</div>
            <div class="al-attrs" id="al_attr_grid">
                ${['FOR','DES','VIG','INT','RAC','PRS','PRE','MAN','AUT'].map(a => `
                    <div class="al-attr">
                        <label for="al_attr_${a}">${a}</label>
                        <input type="number" id="al_attr_${a}" value="0">
                    </div>`).join('')}
            </div>
        </div>

        <div class="section">
            <div class="section-title">Combate e Perícias Livres</div>
            <div class="row">
                <div class="field"><label>⚔️ Ataques</label><textarea id="al_ataques" rows="3" placeholder="Ataques e danos..."></textarea></div>
            </div>
            <div class="row">
                <div class="field"><label>📚 Perícias</label><textarea id="al_skills" rows="2" placeholder="Perícias relevantes (Texto Livre)..."></textarea></div>
            </div>
        </div>

        <div class="section">
            <div class="section-title">📊 Valores Derivados</div>
            <div id="al_dv_grid">
                <div class="al-empty">Calculando...</div>
            </div>
        </div>

        <div class="section">
            <div class="section-title">🎯 Perícias Estruturadas</div>
            <div id="al_structured_skills_grid"></div>
        </div>

        <div class="section" id="al_class_modules_section">
            <div class="section-title">🧩 Módulos de Classe</div>
            <div id="al_class_modules">
                <div class="al-empty">Carregando módulos...</div>
            </div>
        </div>
    </div>

    <!-- ============ SEÇÃO: INVENTÁRIO ============ -->
    <div class="tab-content" id="alSec_inventario">
        <div class="section">
            <div class="section-title">Inventário do Aliado</div>
            <div id="aliadoInvRoot">
                <div class="al-empty">Abra esta aba para carregar o inventário.</div>
            </div>
        </div>
    </div>

    <!-- ============ SEÇÃO: ROLE PLAY ============ -->
    <div class="tab-content" id="alSec_roleplay">
        <div class="section">
            <div class="section-title">Role Play</div>
            
            <div class="row" style="grid-template-columns: 1fr 1fr 1fr;">
                <div class="field"><label>Personalidade 1</label><input type="text" id="al_personalidade1"></div>
                <div class="field"><label>Personalidade 2</label><input type="text" id="al_personalidade2"></div>
                <div class="field"><label>Personalidade 3</label><input type="text" id="al_personalidade3"></div>
            </div>
            
            <div class="row">
                <div class="field"><label>Trejeitos</label><input type="text" id="al_trejeitos"></div>
            </div>
            
            <div class="row">
                <div class="field"><label>Motivação</label><textarea id="al_motivacao" rows="2"></textarea></div>
            </div>
            
            <div class="row">
                <div class="field"><label>Segredos</label><textarea id="al_segredos" rows="2"></textarea></div>
            </div>
            
            <div class="row" style="grid-template-columns: 1fr 1fr 1fr;">
                <div class="field"><label>Aliado</label><input type="text" id="al_aliado"></div>
                <div class="field"><label>Rival</label><input type="text" id="al_rival"></div>
                <div class="field"><label>Devedor</label><input type="text" id="al_devedor"></div>
            </div>
            
            <div class="row">
                <div class="field"><label>💬 Frases</label><textarea id="al_frases" rows="2"></textarea></div>
            </div>
            
            <div class="row">
                <div class="field"><label>📖 História</label><textarea id="al_historia" rows="3"></textarea></div>
            </div>
        </div>
    </div>

    <!-- ============ SEÇÃO: LOOT ============ -->
    <div class="tab-content" id="alSec_loot">
        <div class="section">
            <div class="section-title">Loot</div>
            <div class="row">
                <div class="field"><label>Itens</label><textarea id="al_itens" rows="2"></textarea></div>
            </div>
            <div class="row">
                <div class="field"><label>Luns</label><input type="text" id="al_luns"></div>
            </div>
            <div class="row">
                <div class="field"><label>Pistas</label><textarea id="al_pistas" rows="2"></textarea></div>
            </div>
            <div class="row">
                <div class="field"><label>Complicações</label><textarea id="al_complicacoes" rows="2"></textarea></div>
            </div>
        </div>
    </div>
    
    <div class="al-foot">
        <strong>Nota:</strong> Mecânicas complexas, peculiaridades e vínculos estendidos devem ser gerenciados pelo Mestre no painel dedicado.
    </div>
    `;
}

/* =====================================================================
   MÓDULOS DE CLASSE — Ficha do Aliado
   Renderiza os módulos vinculados ao NPC (npc.modulosClasse), permitindo
   editar os itens. A vinculação/desvinculação de módulos e a herança pela
   classe são gerenciadas pelo Mestre na Ficha de NPC (Painel do Mestre).
===================================================================== */
function _alNormalizeModDef(mod) {
    if (!mod || typeof mod !== 'object') return null;
    return {
        ...mod,
        id: mod.id || ('mod_' + String(mod.titulo || '').toLowerCase().replace(/[^a-z0-9]/g, '_')),
        titulo: mod.titulo || 'Módulo',
        icone: mod.icone || '📦',
        schema: Array.isArray(mod.schema) ? mod.schema : [],
        itensPredefinidos: Array.isArray(mod.itensPredefinidos) ? mod.itensPredefinidos : [],
        permitirCriacaoJogador: mod.permitirCriacaoJogador !== false
    };
}

async function _alEnsureClassModuleDefs() {
    if (!window._systemData) window._systemData = {};
    if (Array.isArray(window._systemData.classModules) && window._systemData.classModules.length) {
        return window._systemData.classModules;
    }
    // Fallback (ex.: Tabuleiro, onde o system-data-loader da ficha não roda)
    try {
        const snap = await getDocs(collection(window.db, 'system/data/classModules'));
        const arr = [];
        snap.forEach(d => {
            const data = d.data();
            if (data.publicado !== false) arr.push({ id: d.id, ...data });
        });
        window._systemData.classModules = arr;
        return arr;
    } catch (e) {
        console.warn('⚠️ [Aliados] Não foi possível carregar classModules:', e);
        return [];
    }
}

function _alResolveModDef(vinc, defs) {
    if (!vinc) return null;
    if (vinc.refId) {
        const hit = defs.find(m => m.id === vinc.refId);
        if (hit) return _alNormalizeModDef(hit);
    }
    return vinc.snapshot ? _alNormalizeModDef(vinc.snapshot) : null;
}

function _alModFieldHtml(mi, ii, field, item) {
    const key = field.key;
    const label = escapeHtml(field.label || key || '');
    const set = (prop, expr) => `alSetModField(${mi},${ii},'${prop}',${expr})`;
    if (field.tipo === 'separador') {
        return `<div class="al-mod-sep">${label}</div>`;
    }
    if (field.tipo === 'botao') return '';
    const val = item[key];
    let input = '';
    if (field.tipo === 'textarea') {
        input = `<textarea rows="2" oninput="${set(key, 'this.value')}">${escapeHtml(String(val ?? ''))}</textarea>`;
    } else if (field.tipo === 'select') {
        const opts = (field.opcoes || []).map(o => `<option value="${escapeHtml(o)}" ${val === o ? 'selected' : ''}>${escapeHtml(o)}</option>`).join('');
        input = `<select onchange="${set(key, 'this.value')}"><option value="">— Selecionar —</option>${opts}</select>`;
    } else if (field.tipo === 'checkbox') {
        return `<div class="field" style="flex-direction:row;align-items:center;gap:8px;">
            <input type="checkbox" style="width:auto;" ${val === true || val === 'true' ? 'checked' : ''} onchange="${set(key, 'this.checked')}">
            <label style="margin:0;">${label}</label>
        </div>`;
    } else if (field.tipo === 'number' || field.tipo === 'contador' || field.tipo === 'avaliacao') {
        input = `<input type="number" value="${escapeHtml(String(val ?? ''))}" oninput="${set(key, "this.value===''?'':parseFloat(this.value)||0")}">`;
    } else if (field.tipo === 'progress') {
        input = `<div class="al-vital-pair">
            <input type="text" placeholder="0" value="${escapeHtml(String(item[key + '_atual'] ?? ''))}" oninput="${set(key + '_atual', 'this.value')}">
            <span class="al-vital-sep">/</span>
            <input type="text" placeholder="0" value="${escapeHtml(String(item[key + '_total'] ?? ''))}" oninput="${set(key + '_total', 'this.value')}">
        </div>`;
    } else if (field.tipo === 'data') {
        input = `<input type="date" value="${escapeHtml(String(val ?? ''))}" oninput="${set(key, 'this.value')}">`;
    } else {
        input = `<input type="text" value="${escapeHtml(String(val ?? ''))}" placeholder="${escapeHtml(field.placeholder || '')}" oninput="${set(key, 'this.value')}">`;
    }
    return `<div class="field"><label>${label}</label>${input}</div>`;
}

async function renderAliadoClassModules(npc) {
    const wrap = document.getElementById('al_class_modules');
    if (!wrap) return;

    const vincs = Array.isArray(npc.modulosClasse) ? npc.modulosClasse : [];
    if (!vincs.length) {
        wrap.innerHTML = '<div class="al-empty">Nenhum Módulo de Classe vinculado a este aliado. O Mestre pode vincular módulos na Ficha de NPC do Painel do Mestre.</div>';
        return;
    }

    const defs = (await _alEnsureClassModuleDefs()).map(_alNormalizeModDef).filter(Boolean);

    wrap.innerHTML = vincs.map((vinc, mi) => {
        const def = _alResolveModDef(vinc, defs);
        if (!def) return `<div class="al-empty">⚠️ Módulo não encontrado no registro.</div>`;
        const itens = (vinc.itens || []).map((item, ii) => `
            <div class="al-mod-item">
                <div class="al-mod-item-head">
                    <span>${escapeHtml(item._predefNome || `${def.titulo} #${ii + 1}`)}</span>
                    <button type="button" class="al-mod-btn al-mod-del" onclick="alRemoveModItem(${mi},${ii})" title="Remover item">✕</button>
                </div>
                <div class="al-mod-fields">
                    ${def.schema.map(f => _alModFieldHtml(mi, ii, f, item)).join('')}
                </div>
            </div>`).join('');
        const addBtn = def.permitirCriacaoJogador
            ? `<button type="button" class="al-mod-btn al-mod-add" onclick="alAddModItem(${mi})">➕ Novo item</button>`
            : '';
        return `<div class="al-mod">
            <div class="al-mod-head">
                <span>${def.icone} ${escapeHtml(def.titulo)}</span>
            </div>
            <div class="al-mod-body">
                ${itens || '<div class="al-empty">Nenhum item.</div>'}
                ${addBtn}
            </div>
        </div>`;
    }).join('');
}

window.alSetModField = function(mi, ii, key, val) {
    const item = currentAliadoNpc?.modulosClasse?.[mi]?.itens?.[ii];
    if (item) item[key] = val;
};

window.alAddModItem = async function(mi) {
    const vinc = currentAliadoNpc?.modulosClasse?.[mi]; if (!vinc) return;
    const defs = (await _alEnsureClassModuleDefs()).map(_alNormalizeModDef).filter(Boolean);
    const def = _alResolveModDef(vinc, defs); if (!def) return;
    const item = {};
    def.schema.forEach(f => {
        if (f.tipo === 'progress') { item[f.key + '_atual'] = ''; item[f.key + '_total'] = ''; }
        else if (f.tipo === 'steps' || f.tipo === 'tags') item[f.key] = [];
        else if (f.tipo === 'checkbox') item[f.key] = false;
        else if (f.tipo === 'avaliacao' || f.tipo === 'contador') item[f.key] = 0;
        else if (f.tipo === 'botao' || f.tipo === 'separador') { /* sem valor */ }
        else item[f.key] = '';
    });
    vinc.itens = vinc.itens || [];
    vinc.itens.push(item);
    await renderAliadoClassModules(currentAliadoNpc);
    if (currentAliadoOpts.readonly) _applyAliadoReadonly(document.getElementById('aliadoNpcModalBody'));
};

window.alRemoveModItem = async function(mi, ii) {
    const vinc = currentAliadoNpc?.modulosClasse?.[mi]; if (!vinc) return;
    vinc.itens.splice(ii, 1);
    await renderAliadoClassModules(currentAliadoNpc);
};

// Resolve a chave do registro (Painel de Criador) correspondente a uma sigla
// legada (VIT/ENER/SAN), para ler/gravar overrides e valores atuais no mesmo
// formato usado pelo Painel do Mestre.
function _vitalKeyFor(sigla) {
    const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
    const vs = (window._systemData?.vitalStats || []);
    const s = norm(sigla);
    let hit = vs.find(d => norm(d.key || d.id) === s || norm(d.nome) === s);
    if (!hit) hit = vs.find(d => norm(d.key || d.id).startsWith(s) || norm(d.nome).startsWith(s));
    return hit ? (hit.key || hit.id) : null;
}

function _vitalMax(npc, sigla) {
    const vd = npc.valoresDer || {};
    const ov = vd.overrides || {};
    if (ov[sigla] != null && ov[sigla] !== '') return ov[sigla];
    const k = _vitalKeyFor(sigla);
    if (k && ov[k] != null && ov[k] !== '') return ov[k];
    if (vd[sigla] != null && vd[sigla] !== '') return vd[sigla];
    return 0;
}

function _vitalAtual(npc, sigla) {
    const at = (npc.valoresDer || {}).atual || {};
    if (at[sigla] != null && at[sigla] !== '') return at[sigla];
    const k = _vitalKeyFor(sigla);
    if (k && at[k] != null && at[k] !== '') return at[k];
    return '';
}

/* 📊 Valores Derivados do NPC — mesmos números da Ficha do Mestre (o cálculo vem
   do npc-calc-engine), agrupados pelo bloco do cadastro e na ordem cadastrada.
   Só leitura: quem edita VD de NPC é o Mestre, no Painel. */
async function renderAliadoDerivedValues(npc) {
    const box = document.getElementById('al_dv_grid');
    if (!box) return;
    try {
        const [{ ensureNpcSystemData }, { calcularNpc }] = await Promise.all([
            import('../../painel-mestre/js/npc-system-data.js'),
            import('../../painel-mestre/js/npc-calc-engine.js')
        ]);
        const sys = await ensureNpcSystemData();
        const calc = calcularNpc(npc, sys);

        // sys.derivedValues já vem ordenado por blocoOrdem → ordem
        const vinc = new Set(npc.valoresDer?.vinculados || []);
        const lista = (sys.derivedValues || []).filter(dv => vinc.has(dv.key));
        if (!lista.length) {
            box.innerHTML = '<div class="al-empty">Nenhum Valor Derivado vinculado a este NPC.</div>';
            return;
        }

        let html = '', blocoAtual = null;
        for (const dv of lista) {
            if (dv.blocoId !== blocoAtual) {
                if (blocoAtual !== null) html += '</div>';
                blocoAtual = dv.blocoId;
                html += `<div class="al-group-title">${escapeHtml(dv.blocoNome || 'Geral')}</div>`
                     + `<div class="al-stat-grid">`;
            }
            const val = calc.derived[dv.key]?.final ?? 0;
            html += `<div class="al-stat" title="${escapeHtml(dv.descricao || '')}">
                <label>${dv.icone || '📊'} ${escapeHtml(dv.nome)}</label>
                <strong>${escapeHtml(dv.prefixo)}${val}${escapeHtml(dv.sufixo)}</strong>
            </div>`;
        }
        box.innerHTML = html + '</div>';
    } catch (e) {
        console.warn('⚠️ Não foi possível calcular os Valores Derivados do aliado:', e);
        box.innerHTML = '<div class="al-empty">Valores Derivados indisponíveis.</div>';
    }
}

/* Cabeçalho da ficha — espelha nome e retrato enquanto o campo é editado.
   Só apresentação: nada aqui é lido no salvamento. */
window.alRefreshHeadName = function() {
    const el = document.getElementById('al_head_name');
    if (el) el.textContent = document.getElementById('al_nome')?.value.trim() || '—';
};

window.alRefreshPortrait = function() {
    const box = document.getElementById('al_portrait');
    const img = document.getElementById('al_portrait_img');
    const url = document.getElementById('al_imagem')?.value.trim() || '';
    if (!box || !img) return;
    img.onerror = () => box.classList.remove('has-img');
    img.src = url;
    box.classList.toggle('has-img', !!url);
};

function fillAliadoForm(npc) {
    document.getElementById('al_imagem').value = npc.imagem || '';
    document.getElementById('al_nome').value = npc.nome || '';
    document.getElementById('al_tipo').value = npc.tipo || 'npc';
    document.getElementById('al_nivel').value = npc.nivel || 1;
    
    document.getElementById('al_raca').value = (npc.racaRef && npc.racaRef.custom) ? npc.racaRef.custom : (npc.raca || '');
    document.getElementById('al_classe').value = (npc.classeRef && npc.classeRef.custom) ? npc.classeRef.custom : (npc.classe || '');
    document.getElementById('al_tribo').value = (npc.triboRef && npc.triboRef.custom) ? npc.triboRef.custom : (npc.tribo || '');
    
    document.getElementById('al_porte').value = npc.porte || '';
    document.getElementById('al_papel').value = npc.papel || '';
    document.getElementById('al_local').value = npc.local || '';
    document.getElementById('al_tamanho').value = npc.tamanho || '';
    document.getElementById('al_tags').value = npc.tags || '';

    window.alRefreshHeadName();
    window.alRefreshPortrait();

    ['FOR','DES','VIG','INT','RAC','PRS','PRE','MAN','AUT'].forEach(a => {
        document.getElementById('al_attr_' + a).value = (npc.atributos && npc.atributos[a]) || 0;
    });

    const vd = npc.valoresDer || { overrides: {} };
    document.getElementById('al_vit').value = _vitalMax(npc, 'VIT');
    document.getElementById('al_ener').value = _vitalMax(npc, 'ENER');
    document.getElementById('al_san').value = _vitalMax(npc, 'SAN');

    // ✅ Status Vitais ATUAIS (antes, a ficha só exibia o Máx.)
    const vitAt = _vitalAtual(npc, 'VIT');
    const enerAt = _vitalAtual(npc, 'ENER');
    const sanAt = _vitalAtual(npc, 'SAN');
    document.getElementById('al_vit_atual').value = vitAt !== '' ? vitAt : _vitalMax(npc, 'VIT');
    document.getElementById('al_ener_atual').value = enerAt !== '' ? enerAt : _vitalMax(npc, 'ENER');
    document.getElementById('al_san_atual').value = sanAt !== '' ? sanAt : _vitalMax(npc, 'SAN');

    document.getElementById('al_lealdade').value = npc.lealdade ?? 0;

    document.getElementById('al_ataques').value = npc.ataques || '';
    document.getElementById('al_skills').value = npc.skillsTexto || '';

    // Perícias Estruturadas
    const skillsGrid = document.getElementById('al_structured_skills_grid');
    const psList = npc.periciasEstruturadas || [];
    if (!psList.length) {
        skillsGrid.innerHTML = '<div class="al-empty">Nenhuma perícia adicionada (Acesse o Painel do Mestre para vincular perícias do sistema).</div>';
    } else {
        const sysSkills = window._systemData?.skills || [];
        const grouped = {};
        psList.forEach((ps, idx) => {
            const s = sysSkills.find(x => x.id === ps.refId) || { nome: 'Desconhecida', categoria: 'Outros' };
            const cat = s.categoria ? s.categoria.trim() : 'Outros';
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push({ ps, s, idx });
        });

        const catKeys = Object.keys(grouped).sort((a,b) => a.localeCompare(b));
        let html = '';
        for (const cat of catKeys) {
            html += `<div class="al-group-title">${escapeHtml(cat)}</div>`;
            html += `<div class="al-stat-grid">`;

            grouped[cat].sort((a,b) => (a.s.nome||'').localeCompare(b.s.nome||'')).forEach(item => {
                const { ps, s, idx } = item;
                html += `
                <div class="al-stat">
                    <label>${escapeHtml(s.nome)}</label>
                    <input type="number" class="al_skill_input" data-idx="${idx}" value="${ps.nivel}" min="0" max="10">
                </div>`;
            });
            html += `</div>`;
        }
        skillsGrid.innerHTML = html;
    }

    if (npc.rolePlay) {
        document.getElementById('al_personalidade1').value = npc.rolePlay.personalidade?.[0] || '';
        document.getElementById('al_personalidade2').value = npc.rolePlay.personalidade?.[1] || '';
        document.getElementById('al_personalidade3').value = npc.rolePlay.personalidade?.[2] || '';
        document.getElementById('al_trejeitos').value = npc.rolePlay.trejeitos || '';
        document.getElementById('al_motivacao').value = npc.rolePlay.motivacao || '';
        document.getElementById('al_segredos').value = npc.rolePlay.segredos || '';
        document.getElementById('al_aliado').value = npc.rolePlay.aliado || '';
        document.getElementById('al_rival').value = npc.rolePlay.rival || '';
        document.getElementById('al_devedor').value = npc.rolePlay.devedor || '';
        document.getElementById('al_frases').value = npc.rolePlay.frases || '';
        document.getElementById('al_historia').value = npc.rolePlay.historia || '';
    }

    if (npc.loot) {
        document.getElementById('al_itens').value = npc.loot.itens || '';
        document.getElementById('al_luns').value = npc.loot.luns || '';
        document.getElementById('al_pistas').value = npc.loot.pistas || '';
        document.getElementById('al_complicacoes').value = npc.loot.complicacoes || '';
    }
}

window.saveAliadoNpc = async function() {
    if (!currentAliadoNpc) return;

    const btn = event.currentTarget;
    btn.textContent = '⏳ Salvando...';
    btn.disabled = true;

    try {
        const updateData = {
            imagem: document.getElementById('al_imagem').value.trim(),
            nome: document.getElementById('al_nome').value.trim(),
            tipo: document.getElementById('al_tipo').value,
            nivel: parseInt(document.getElementById('al_nivel').value) || 1,
            'racaRef.custom': document.getElementById('al_raca').value.trim(),
            'classeRef.custom': document.getElementById('al_classe').value.trim(),
            'triboRef.custom': document.getElementById('al_tribo').value.trim(),
            porte: document.getElementById('al_porte').value,
            papel: document.getElementById('al_papel').value.trim(),
            local: document.getElementById('al_local').value.trim(),
            tamanho: document.getElementById('al_tamanho').value.trim(),
            tags: document.getElementById('al_tags').value.trim(),
            atributos: {}
        };

        ['FOR','DES','VIG','INT','RAC','PRS','PRE','MAN','AUT'].forEach(a => {
            updateData.atributos[a] = parseInt(document.getElementById('al_attr_' + a).value) || 0;
        });

        updateData['valoresDer.overrides.VIT'] = parseInt(document.getElementById('al_vit').value) || 0;
        updateData['valoresDer.overrides.ENER'] = parseInt(document.getElementById('al_ener').value) || 0;
        updateData['valoresDer.overrides.SAN'] = parseInt(document.getElementById('al_san').value) || 0;
        
        updateData['valoresDer.VIT'] = parseInt(document.getElementById('al_vit').value) || 0;
        updateData['valoresDer.ENER'] = parseInt(document.getElementById('al_ener').value) || 0;
        updateData['valoresDer.SAN'] = parseInt(document.getElementById('al_san').value) || 0;

        // ✅ Status Vitais ATUAIS — grava na sigla legada E na chave do registro
        // (mesmo formato que o Painel do Mestre usa em valoresDer.atual)
        [['VIT', 'al_vit_atual'], ['ENER', 'al_ener_atual'], ['SAN', 'al_san_atual']].forEach(([sigla, inputId]) => {
            const val = parseInt(document.getElementById(inputId)?.value);
            const atual = isNaN(val) ? 0 : val;
            updateData[`valoresDer.atual.${sigla}`] = atual;
            const regKey = _vitalKeyFor(sigla);
            if (regKey && regKey !== sigla) {
                updateData[`valoresDer.atual.${regKey}`] = atual;
            }
        });

        updateData.ataques = document.getElementById('al_ataques').value.trim();
        updateData.skillsTexto = document.getElementById('al_skills').value.trim();

        /* Lealdade 0–10 (clampada): eixo do companheiro — Regua §3.1 lê daqui. */
        updateData.lealdade = Math.max(0, Math.min(10, parseInt(document.getElementById('al_lealdade')?.value) || 0));

        if (currentAliadoNpc.periciasEstruturadas) {
            const newPs = JSON.parse(JSON.stringify(currentAliadoNpc.periciasEstruturadas));
            document.querySelectorAll('.al_skill_input').forEach(input => {
                const idx = parseInt(input.getAttribute('data-idx'));
                if (newPs[idx]) {
                    newPs[idx].nivel = parseInt(input.value) || 0;
                }
            });
            updateData.periciasEstruturadas = newPs;
        }

        updateData['rolePlay.personalidade'] = [
            document.getElementById('al_personalidade1').value.trim(),
            document.getElementById('al_personalidade2').value.trim(),
            document.getElementById('al_personalidade3').value.trim()
        ].filter(p => p);
        updateData['rolePlay.trejeitos'] = document.getElementById('al_trejeitos').value.trim();
        updateData['rolePlay.motivacao'] = document.getElementById('al_motivacao').value.trim();
        updateData['rolePlay.segredos'] = document.getElementById('al_segredos').value.trim();
        updateData['rolePlay.aliado'] = document.getElementById('al_aliado').value.trim();
        updateData['rolePlay.rival'] = document.getElementById('al_rival').value.trim();
        updateData['rolePlay.devedor'] = document.getElementById('al_devedor').value.trim();
        updateData['rolePlay.frases'] = document.getElementById('al_frases').value.trim();
        updateData['rolePlay.historia'] = document.getElementById('al_historia').value.trim();

        updateData['loot.itens'] = document.getElementById('al_itens').value.trim();
        updateData['loot.luns'] = document.getElementById('al_luns').value.trim();
        updateData['loot.pistas'] = document.getElementById('al_pistas').value.trim();
        updateData['loot.complicacoes'] = document.getElementById('al_complicacoes').value.trim();

        // 🧩 Módulos de Classe (itens editados na ficha do aliado)
        if (Array.isArray(currentAliadoNpc.modulosClasse)) {
            updateData.modulosClasse = JSON.parse(JSON.stringify(currentAliadoNpc.modulosClasse));
        }

        const npcRef = doc(window.db, 'npcs', currentAliadoNpc.id);
        await updateDoc(npcRef, updateData);

        btn.textContent = '✅ Salvo!';
        setTimeout(() => {
            btn.textContent = '💾 Salvar';
            btn.disabled = false;
        }, 2000);
        
        if (window.currentCharacterId) loadAliados(window.currentCharacterId);

    } catch (e) {
        console.error("Erro ao salvar Aliado:", e);
        btn.textContent = '❌ Erro';
        setTimeout(() => {
            btn.textContent = '💾 Salvar';
            btn.disabled = false;
        }, 2000);
    }
};
