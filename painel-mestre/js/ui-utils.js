// =============================================
// PAINEL DO MESTRE — UI Utilities
// =============================================

// ===== ALERT TOAST =====
export function showAlert(message, type = 'success') {
    const existing = document.querySelectorAll('.alert');
    existing.forEach(el => el.remove());

    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    document.body.appendChild(alert);

    setTimeout(() => {
        if (alert.parentNode) alert.remove();
    }, 3000);
}
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
