/* =====================================================================
   LENDAS & RELÍQUIAS — TEMA COMPARTILHADO (claro/escuro)
   Uma única chave de armazenamento ('lr_theme') para TODO o site,
   para que a escolha do usuário acompanhe todas as páginas.
   Migra automaticamente as chaves antigas ('menu-theme', 'lr_wizard_theme').
   ===================================================================== */
(function () {
    'use strict';
    var KEY = 'lr_theme';

    function readSaved() {
        var v = null;
        try {
            v = localStorage.getItem(KEY);
            if (!v) {
                // Migração das chaves antigas usadas por páginas individuais
                v = localStorage.getItem('menu-theme') || localStorage.getItem('lr_wizard_theme');
                if (v) localStorage.setItem(KEY, v);
            }
        } catch (e) { /* armazenamento indisponível — segue preferência do sistema */ }
        return v;
    }

    function updateButtons(isDark) {
        var btns = document.querySelectorAll('#btnThemeToggle, .theme-toggle');
        for (var i = 0; i < btns.length; i++) btns[i].textContent = isDark ? '☀️' : '🌙';
    }

    function apply(isDark) {
        document.documentElement.classList.toggle('dark', isDark);
        updateButtons(isDark);
    }

    var saved = readSaved();
    var isDark = saved
        ? saved === 'dark'
        : (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    apply(isDark);

    // Botões podem ainda não existir quando este script roda no <head>/topo do body
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            updateButtons(document.documentElement.classList.contains('dark'));
        });
    }

    window.toggleTheme = function () {
        var d = !document.documentElement.classList.contains('dark');
        try { localStorage.setItem(KEY, d ? 'dark' : 'light'); } catch (e) { }
        apply(d);
    };
})();
