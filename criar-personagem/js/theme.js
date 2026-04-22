/* ===== THEME TOGGLE — Criação de Personagem ===== */
function toggleTheme() {
    const html = document.documentElement;
    const btn = document.getElementById('btnThemeToggle');
    html.classList.toggle('dark');
    const isDark = html.classList.contains('dark');
    if (btn) btn.textContent = isDark ? '☀️' : '🌙';
    localStorage.setItem('lr_wizard_theme', isDark ? 'dark' : 'light');
}

(function loadTheme() {
    const saved = localStorage.getItem('lr_wizard_theme') || localStorage.getItem('lr_theme');
    if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
        const btn = document.getElementById('btnThemeToggle');
        if (btn) btn.textContent = '☀️';
    }
})();
