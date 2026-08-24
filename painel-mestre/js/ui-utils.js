// =============================================
// PAINEL DO MESTRE — UI Utilities
// =============================================
import { toast } from '../../shared/dialogo.js?v=2';

// ===== ALERT TOAST =====
/* Casca: quem desenha é o toast da mesa (shared/dialogo.js), o mesmo da Ficha,
   do Tabuleiro e do Criador. As 286 chamadas daqui não mudaram — nem o nome,
   nem o vocabulário inglês do tipo ('success', 'danger'), que o toast traduz.

   Uma diferença de propósito: o aviso antigo apagava o anterior, este empilha.
   Duas mensagens seguidas passaram a ser legíveis em vez de uma comer a outra.

   `function` e não `const` porque a declaração é içada: chamada que aconteça
   antes desta linha continua valendo, como valia com o corpo antigo. */
export function showAlert(message, type = 'success') { return toast(message, type); }
window.showAlert = showAlert;

// ===== ESCAPE HTML =====
export function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===== TAB SWITCHING =====
export function switchTab(tabName) {
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    const btn = document.querySelector(`[data-tab="${tabName}"]`);
    const content = document.getElementById(`tab-${tabName}`);
    if (btn) btn.classList.add('active');
    if (content) content.classList.add('active');
}
window.switchTab = switchTab;

// ===== SUB-TAB SWITCHING =====
export function switchSubTab(parentTab, subTabName) {
    const parent = document.getElementById(`tab-${parentTab}`);
    if (!parent) return;

    parent.querySelectorAll('.sub-tab-btn').forEach(btn => btn.classList.remove('active'));
    parent.querySelectorAll('.sub-tab-content').forEach(content => content.classList.remove('active'));

    const btn = parent.querySelector(`[data-subtab="${subTabName}"]`);
    const content = parent.querySelector(`#subtab-${subTabName}`);
    if (btn) btn.classList.add('active');
    if (content) content.classList.add('active');
}
window.switchSubTab = switchSubTab;
