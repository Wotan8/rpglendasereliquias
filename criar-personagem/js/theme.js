/* ===== THEME TOGGLE — Criação de Personagem =====
   DESATIVADO: a lógica de tema foi unificada em /shared/theme.js
   (chave única 'lr_theme' para todo o site). Este arquivo permanece
   apenas para compatibilidade caso alguma página antiga ainda o carregue. */
(function () {
    if (typeof window.toggleTheme === 'function') return; // shared/theme.js já cuidou de tudo
    var s = document.createElement('script');
    s.src = '../shared/theme.js';
    document.head.appendChild(s);
})();
