/* =============================================
   EXP VIP na ficha — só exibição
   O número não entra em conta nenhuma da ficha: ele existe porque 60% do EXP
   VIP volta ao Repertório quando o personagem é encerrado, e o jogador precisa
   ver isso ANTES de decidir entregar ou apagar.
   Reusa o tooltip flutuante dos Valores Derivados — no celular não há hover,
   e é o toque que abre, exatamente como nos chips do painel de combate.
   ============================================= */
(function () {
    'use strict';

    window.mostrarExpVip = function (valor) {
        const selo = document.getElementById('expVipDica');
        if (!selo) return;

        const vip = parseInt(valor, 10) || 0;
        if (vip <= 0) {
            selo.hidden = true;
            return;
        }

        const devolve = Math.round(vip * 0.6);
        selo.hidden = false;
        selo.textContent = `VIP ${vip}`;
        selo.dataset.tooltipText =
            `${vip} EXP deste personagem vieram de itens EXP VIP.\n\n` +
            `Se você encerrar o personagem — entregando ao mestre ou apagando —, ` +
            `${devolve} EXP (60%) voltam para o seu Repertório, prontos para outro personagem.`;
        // Fallback de desktop: o title aparece mesmo se o tooltip não carregar.
        selo.title = `${vip} EXP VIP · devolve ${devolve} ao encerrar`;

        if (selo.dataset.ligado === '1') return;
        if (typeof showDvTooltip !== 'function') return;
        selo.dataset.ligado = '1';
        selo.addEventListener('mouseenter', showDvTooltip);
        selo.addEventListener('mouseleave', hideDvTooltip);
        selo.addEventListener('touchstart', showDvTooltip, { passive: true });
        selo.addEventListener('touchend', hideDvTooltip);
    };
})();
