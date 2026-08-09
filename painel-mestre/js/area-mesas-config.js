// =============================================
// AREA MESAS — Configurações da Campanha
// =============================================
import { db, collection, getDocs, doc, updateDoc } from './firebase-config.js';
import * as S from './state.js';
import { showAlert, escapeHtml } from './ui-utils.js';
import { buildMechanicSelectorHTML } from '../../painel-criador/js/painel-mechanics.js';

window._loadMesaConfig = loadMesaConfig;

async function loadMesaConfig() {
    const el = document.getElementById('mesaConfigContent'); if (!el || !S.currentMesaData) return;
    
    if (!window._systemData) window._systemData = {};
    if (!window._systemData.mechanics || window._systemData.mechanics.length === 0) {
        try {
            const snap = await getDocs(collection(db, 'system/data/mechanics'));
            window._systemData.mechanics = [];
            snap.forEach(d => {
                const data = d.data();
                if (data.publicado !== false) window._systemData.mechanics.push({ id: d.id, ...data });
            });
        } catch(e) {
            console.error("Erro ao carregar mecânicas do sistema:", e);
            window._systemData.mechanics = [];
        }
    }
    window._mechCache = window._systemData.mechanics || [];

    const cfg = S.currentMesaData.config || {};
    el.innerHTML = `
        <div style="max-width:600px">
            <h3 style="font-size:1rem;font-weight:800;color:var(--primary);margin-bottom:16px">⚙️ Configurações da Campanha</h3>
            <div class="form-group">
                <label class="form-label">Texto de Introdução</label>
                <textarea class="form-textarea" id="cfg_intro" rows="6" placeholder="Texto que aparecerá na Etapa 0 da criação de personagem...">${escapeHtml(cfg.textoIntroducao || '')}</textarea>
            </div>
            <div class="form-group">
                <label class="form-label">EXP Inicial</label>
                <input type="number" class="form-input" id="cfg_expInicial" value="${cfg.expInicial || 100}" min="0" style="max-width:200px">
                <div style="font-size:.78rem;color:var(--muted);margin-top:4px">EXP que jogadores recebem ao criar personagem nesta mesa</div>
            </div>
            <div class="form-group">
                <label class="form-label">Limite Padrão de Personagens por Jogador</label>
                <input type="number" class="form-input" id="cfg_limitePadrao" value="${cfg.limitePadraoPersonagens ?? 1}" min="1" max="99" style="max-width:200px">
                <div style="font-size:.78rem;color:var(--muted);margin-top:4px">Quantidade máxima de personagens que cada jogador pode criar nesta mesa (pode ser sobrescrito individualmente na aba Jogadores)</div>
            </div>
            <div class="form-group">
                <label class="form-label">Peculiaridades Avulsas na Criação</label>
                <div style="display:flex;gap:16px;flex-wrap:wrap">
                    <div>
                        <input type="number" class="form-input" id="cfg_maxPecVantagens" value="${cfg.maxPecVantagens ?? 3}" min="0" max="99" style="max-width:110px">
                        <div style="font-size:.78rem;color:var(--muted);margin-top:4px">🟢 Vantagens</div>
                    </div>
                    <div>
                        <input type="number" class="form-input" id="cfg_maxPecDesvantagens" value="${cfg.maxPecDesvantagens ?? 3}" min="0" max="99" style="max-width:110px">
                        <div style="font-size:.78rem;color:var(--muted);margin-top:4px">🔴 Desvantagens</div>
                    </div>
                </div>
                <div style="font-size:.78rem;color:var(--muted);margin-top:6px">Quantas de cada tipo o jogador pode escolher na criação. O teto de EXP das desvantagens continua valendo por cima: limitar a quantidade não libera o orçamento.</div>
            </div>

            <div style="margin-top: 32px; margin-bottom: 24px; border-top: 1px solid var(--border); padding-top: 16px;">
                <h4 style="font-size:.95rem;font-weight:700;color:var(--light);margin-bottom:8px">🎒 Objeto Pessoal (Personagens Novos)</h4>
                <div style="font-size:.78rem;color:var(--muted);margin-bottom:12px">Configure as mecânicas que serão vinculadas automaticamente ao Objeto Pessoal criado pelos jogadores nesta mesa.</div>
                
                <div class="form-group">
                    ${buildMechanicSelectorHTML('cfg_mecanicasObjetoPessoal', 'Mecânicas Vinculadas (Automáticas)', cfg.mecanicasObjetoPessoal || [], window._mechCache, 'mesa_config')}
                </div>
            </div>

            <button class="btn btn-success" onclick="saveMesaConfig()">💾 Salvar Configurações</button>
        </div>`;
}

window.saveMesaConfig = async function() {
    if (!S.currentMesaId) return;
    let mecanicasObjeto = [];
    const mecanicasObjetoEl = document.getElementById('field_cfg_mecanicasObjetoPessoal');
    if (mecanicasObjetoEl) {
        try { mecanicasObjeto = JSON.parse(mecanicasObjetoEl.value || '[]'); }
        catch { mecanicasObjeto = []; }
    }

    // `|| padrão` transformaria 0 em padrão, e 0 avulsas é uma escolha válida do Mestre.
    const inteiro = (id, padrao) => {
        const n = parseInt(document.getElementById(id)?.value, 10);
        return Number.isFinite(n) && n >= 0 ? n : padrao;
    };

    const config = {
        textoIntroducao: document.getElementById('cfg_intro')?.value?.trim() || '',
        expInicial: parseInt(document.getElementById('cfg_expInicial')?.value) || 100,
        limitePadraoPersonagens: parseInt(document.getElementById('cfg_limitePadrao')?.value) || 1,
        maxPecVantagens: inteiro('cfg_maxPecVantagens', 3),
        maxPecDesvantagens: inteiro('cfg_maxPecDesvantagens', 3),
        mecanicasObjetoPessoal: mecanicasObjeto
    };
    try {
        await updateDoc(doc(db, 'mesas', S.currentMesaId), { config });
        S.currentMesaData.config = config;
        showAlert('✅ Configurações salvas!', 'success');
    } catch (e) { showAlert('❌ Erro: ' + e.message, 'danger'); }
};

