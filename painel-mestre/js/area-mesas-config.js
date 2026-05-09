// =============================================
// AREA MESAS — Configurações da Campanha
// =============================================
import { db, doc, updateDoc } from './firebase-config.js';
import * as S from './state.js';
import { showAlert, escapeHtml } from './ui-utils.js';

window._loadMesaConfig = loadMesaConfig;

function loadMesaConfig() {
    const el = document.getElementById('mesaConfigContent'); if (!el || !S.currentMesaData) return;
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
            <button class="btn btn-success" onclick="saveMesaConfig()">💾 Salvar Configurações</button>
        </div>`;
}

window.saveMesaConfig = async function() {
    if (!S.currentMesaId) return;
    const config = {
        textoIntroducao: document.getElementById('cfg_intro')?.value?.trim() || '',
        expInicial: parseInt(document.getElementById('cfg_expInicial')?.value) || 100,
        limitePadraoPersonagens: parseInt(document.getElementById('cfg_limitePadrao')?.value) || 1
    };
    try {
        await updateDoc(doc(db, 'mesas', S.currentMesaId), { config });
        S.currentMesaData.config = config;
        showAlert('✅ Configurações salvas!', 'success');
    } catch (e) { showAlert('❌ Erro: ' + e.message, 'danger'); }
};

