/* =============================================
   Tooltip da Experiência — só exibição
   Hover (ou toque, no celular) no rótulo "⭐ Experiência" abre a janelinha
   flutuante dos Valores Derivados com as três linhas: Restante, Total e VIPS.
   O EXP VIP não entra em conta nenhuma da ficha: ele existe porque 60% dele
   volta ao Repertório quando o personagem é encerrado, e o jogador precisa
   ver isso ANTES de decidir entregar ou apagar.
   ============================================= */
(function () {
    'use strict';

    let expVip = 0;

    /* O texto é montado NA HORA do hover: os campos Restante/Total são
       editáveis e o tooltip tem de mostrar o que está na tela agora,
       não o que estava quando o doc carregou. */
    function atualizarTexto(rotulo) {
        const num = (sel) => {
            const el = document.querySelector(`input[data-key="${sel}"]`);
            return parseInt(el && el.value, 10) || 0;
        };
        rotulo.dataset.tooltipText =
            `EXP Restante: ${num('exp')}\n` +
            `EXP Total: ${num('exp_total')}\n` +
            `EXP VIPS: ${expVip}` +
            (expVip > 0
                ? `\n\nAo encerrar o personagem — entregando ao mestre ou apagando —, ` +
                  `${Math.round(expVip * 0.6)} EXP (60% do VIP) voltam para o seu Repertório.`
                : '');
    }

    function ligar() {
        const rotulo = document.getElementById('expRotulo');
        if (!rotulo || rotulo.dataset.ligado === '1') return;
        if (typeof showDvTooltip !== 'function') return;
        rotulo.dataset.ligado = '1';

        const abrir = (e) => { atualizarTexto(rotulo); showDvTooltip(e); };
        rotulo.addEventListener('mouseenter', abrir);
        rotulo.addEventListener('mouseleave', hideDvTooltip);
        rotulo.addEventListener('touchstart', abrir, { passive: true });
        rotulo.addEventListener('touchend', hideDvTooltip);
    }

    /* Chamada pelo firebase.js quando o doc chega; também liga o tooltip. */
    window.mostrarExpVip = function (valor) {
        expVip = parseInt(valor, 10) || 0;
        ligar();
    };

    document.addEventListener('DOMContentLoaded', ligar);
})();
