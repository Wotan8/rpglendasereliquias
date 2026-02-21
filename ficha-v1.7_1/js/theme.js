/* ===== THEME TOGGLE ===== */
function toggleTheme() {
    const html = document.documentElement;
    const btn = document.getElementById('btnThemeToggle');
    html.classList.toggle('dark');
    const isDark = html.classList.contains('dark');
    btn.textContent = isDark ? '☀️' : '🌙';
    localStorage.setItem('lr_theme', isDark ? 'dark' : 'light');
}

(function loadTheme() {
    const saved = localStorage.getItem('lr_theme');
    if (saved === 'dark') {
        document.documentElement.classList.add('dark');
        const btn = document.getElementById('btnThemeToggle');
        if (btn) btn.textContent = '☀️';
    }
})();
