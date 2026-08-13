/* =====================================================================
   LENDAS & RELÍQUIAS — SPRITE DE ÍCONES (compartilhado)
   ---------------------------------------------------------------------
   Traço fino, geométrico, grade 24×24. Os <symbol> NÃO trazem stroke nem
   fill: herdam de `.tb-ico` / `.lr-ico` (currentColor). É isso que faz o
   ícone acender junto com o estado do botão — emoji nunca seguiu cor, nem
   tema, nem estado.

   Como usar:
     1. <script src="../shared/lr-icones.js"></script> como PRIMEIRA coisa
        dentro de <body>. É script clássico (sem `defer`, sem `type=module`),
        então roda durante o parse e injeta o sprite ANTES do resto do body
        ser lido — os botões estáticos já nascem com ícone, sem piscar.
     2. No HTML:  <svg class="lr-ico"><use href="#i-engrenagem"/></svg>
     3. No JS:    lrIco('engrenagem')

   Nasceu inline no tabuleiro.html. Virou arquivo quando o Painel do Mestre
   precisou dos MESMOS ícones: duas cópias dos traços iam divergir na
   primeira vez que alguém corrigisse um desenho só de um lado.
   ===================================================================== */
(function () {
    'use strict';

    var SPRITE = '<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>' +
        // ---- Ferramentas e ações de mapa (Tabuleiro) ----
        '<symbol id="i-cursor" viewBox="0 0 24 24"><path d="M5.5 3v16.5l4-3.9 2.4 5.2 2.6-1.2-2.3-5 5.8-.4z"/></symbol>' +
        '<symbol id="i-mover" viewBox="0 0 24 24"><path d="M12 2.5v19M2.5 12h19M9 5.5L12 2.5l3 3M9 18.5l3 3 3-3M5.5 9l-3 3 3 3M18.5 9l3 3-3 3"/></symbol>' +
        '<symbol id="i-desenho" viewBox="0 0 24 24"><path d="M12 20.5h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></symbol>' +
        '<symbol id="i-texto" viewBox="0 0 24 24"><path d="M5 6.5v-2h14v2M12 4.5v15M8.5 19.5h7"/></symbol>' +
        '<symbol id="i-regua" viewBox="0 0 24 24"><path d="M15.5 2.5l6 6-13 13-6-6z"/><path d="M8 10l2 2M11 7l2 2M5 13l2 2"/></symbol>' +
        '<symbol id="i-alfinete" viewBox="0 0 24 24"><path d="M9 3.5h6M12 3.5v6M7.5 9.5h9l1.5 5.5h-12zM12 15v6.5"/></symbol>' +
        '<symbol id="i-local" viewBox="0 0 24 24"><path d="M12 21.5s7.5-6.9 7.5-11.5a7.5 7.5 0 10-15 0c0 4.6 7.5 11.5 7.5 11.5z"/><path d="M14.5 10a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0"/></symbol>' +
        '<symbol id="i-foco" viewBox="0 0 24 24"><path d="M12 2.5V6M12 18v3.5M2.5 12H6M18 12h3.5"/><path d="M18 12a6 6 0 11-12 0 6 6 0 0112 0"/><path d="M13 12a1 1 0 11-2 0 1 1 0 012 0"/></symbol>' +
        '<symbol id="i-luz" viewBox="0 0 24 24"><path d="M9.5 18.5h5M10.5 21.5h3"/><path d="M12 2.5A6.5 6.5 0 008.4 14.4c.6.4 1 1.1 1 1.9v.2h5.2v-.2c0-.8.4-1.5 1-1.9A6.5 6.5 0 0012 2.5z"/></symbol>' +
        '<symbol id="i-luz-off" viewBox="0 0 24 24"><path d="M9.5 18.5h5M10.5 21.5h3"/><path d="M12 2.5A6.5 6.5 0 008.4 14.4c.6.4 1 1.1 1 1.9v.2h5.2v-.2c0-.8.4-1.5 1-1.9A6.5 6.5 0 0012 2.5z"/><path d="M3 3l18 18"/></symbol>' +
        '<symbol id="i-template" viewBox="0 0 24 24"><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0"/><path d="M12 12l7.8-4.5M12 12l7.8 4.5"/></symbol>' +
        '<symbol id="i-centralizar" viewBox="0 0 24 24"><path d="M4 8.5V4h4.5M15.5 4H20v4.5M20 15.5V20h-4.5M8.5 20H4v-4.5"/><path d="M13.5 12a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0"/></symbol>' +
        '<symbol id="i-terreno" viewBox="0 0 24 24"><path d="M4.5 10L9 4.5l8 1.5 2.5 7.5-5 5.5-8-1.5z"/><path d="M7.5 12l3 3M10 8.5l6 6M14 7.5l3.5 3.5"/></symbol>' +
        '<symbol id="i-imagem" viewBox="0 0 24 24"><path d="M3.5 4.5h17v15h-17z"/><path d="M3.5 16l5-5 3.5 3.5 3-3 5 5"/><path d="M10 9.5a1.7 1.7 0 11-3.4 0 1.7 1.7 0 013.4 0"/></symbol>' +
        '<symbol id="i-token" viewBox="0 0 24 24"><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0"/><path d="M15 10a3 3 0 11-6 0 3 3 0 016 0"/><path d="M6.3 18.7a6.4 6.4 0 0111.4 0"/></symbol>' +
        '<symbol id="i-mochila" viewBox="0 0 24 24"><path d="M6 21.5V9.5a6 6 0 0112 0v12z"/><path d="M9 9.5v-3a3 3 0 016 0v3M9 14.5h6"/></symbol>' +
        '<symbol id="i-pessoas" viewBox="0 0 24 24"><path d="M16 20.5V19a4 4 0 00-4-4H6.5a4 4 0 00-4 4v1.5"/><path d="M13 7.5a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0"/><path d="M21.5 20.5V19a4 4 0 00-3-3.87M15.5 3.9a4 4 0 010 7.25"/></symbol>' +
        '<symbol id="i-relogio" viewBox="0 0 24 24"><path d="M21 13.5a9 9 0 11-18 0 9 9 0 0118 0"/><path d="M12 9v4.5l3 1.8M9.5 2.5h5M12 2.5v2"/></symbol>' +
        '<symbol id="i-legenda" viewBox="0 0 24 24"><path d="M3.5 5.5h17v13h-17z"/><path d="M6.5 14.5h5M14 14.5h3.5"/></symbol>' +
        '<symbol id="i-prancheta" viewBox="0 0 24 24"><path d="M9 4.5H7.5A1.5 1.5 0 006 6v13.5A1.5 1.5 0 007.5 21h9a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H15"/><path d="M9 2.5h6v4H9z"/><path d="M9 11.5h6M9 15.5h4"/></symbol>' +
        '<symbol id="i-espadas" viewBox="0 0 24 24"><path d="M20 4v3.5M20 4h-3.5M20 4L9 15M4 4v3.5M4 4h3.5M4 4l11 11"/><path d="M14.5 15.5l4.5 4.5M9.5 15.5L5 20"/></symbol>' +
        '<symbol id="i-mostrar" viewBox="0 0 24 24"><path d="M7.5 8.5h9v12h-9z"/><path d="M14 13.5a2 2 0 11-4 0 2 2 0 014 0"/><path d="M9 19a3.5 3.5 0 016 0"/><path d="M12 5.5V2.5M7.2 7.2L5.2 5.2M16.8 7.2l2-2"/></symbol>' +
        '<symbol id="i-livro" viewBox="0 0 24 24"><path d="M12 6.8C10.4 5.3 7.8 4.5 4 4.5v13c3.8 0 6.4.8 8 2.3 1.6-1.5 4.2-2.3 8-2.3v-13c-3.8 0-6.4.8-8 2.3z"/><path d="M12 6.8v13"/></symbol>' +
        '<symbol id="i-pastas" viewBox="0 0 24 24"><path d="M2.5 8.5a1 1 0 011-1h5l2 2.5h10a1 1 0 011 1v9a1 1 0 01-1 1h-17a1 1 0 01-1-1z"/><path d="M5.5 7.5v-2a1 1 0 011-1h4l1.8 2.3"/></symbol>' +
        '<symbol id="i-camadas" viewBox="0 0 24 24"><path d="M12 2.5l9.5 5-9.5 5-9.5-5z"/><path d="M2.5 12.5l9.5 5 9.5-5M2.5 16.5l9.5 5 9.5-5"/></symbol>' +
        '<symbol id="i-chave" viewBox="0 0 24 24"><path d="M10.5 13.5a4.5 4.5 0 11-6.4 6.4 4.5 4.5 0 016.4-6.4z"/><path d="M10.6 13.4L20.5 3.5M16 8l2.5 2.5M18.5 5.5L21 8"/></symbol>' +
        '<symbol id="i-engrenagem" viewBox="0 0 24 24"><path d="M18 12a6 6 0 11-12 0 6 6 0 0112 0"/><path d="M15.5 12a3.5 3.5 0 11-7 0 3.5 3.5 0 017 0"/><path d="M12 6V3.5M12 20.5V18M18 12h2.5M3.5 12H6M16.2 7.8L18 6M6 18l1.8-1.8M16.2 16.2L18 18M6 6l1.8 1.8"/></symbol>' +
        '<symbol id="i-olho" viewBox="0 0 24 24"><path d="M2 12s3.6-6.8 10-6.8S22 12 22 12s-3.6 6.8-10 6.8S2 12 2 12z"/><path d="M14.5 12a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0"/></symbol>' +
        '<symbol id="i-olho-off" viewBox="0 0 24 24"><path d="M9.9 5.4A10.5 10.5 0 0112 5.2c6.4 0 10 6.8 10 6.8a18 18 0 01-3.1 4.1M6.6 6.6A18 18 0 002 12s3.6 6.8 10 6.8a10 10 0 004.2-.9"/><path d="M9.9 9.9a3 3 0 004.2 4.2"/><path d="M3 3l18 18"/></symbol>' +
        '<symbol id="i-linha-reta" viewBox="0 0 24 24"><path d="M6.5 17.5l11-11"/><path d="M6.5 19.3a1.8 1.8 0 100-3.6 1.8 1.8 0 000 3.6z"/><path d="M17.5 8.3a1.8 1.8 0 100-3.6 1.8 1.8 0 000 3.6z"/></symbol>' +
        '<symbol id="i-quadrado" viewBox="0 0 24 24"><path d="M4.5 4.5h15v15h-15z"/></symbol>' +
        '<symbol id="i-circulo" viewBox="0 0 24 24"><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0"/></symbol>' +
        '<symbol id="i-cone" viewBox="0 0 24 24"><path d="M12 3L4 20.5h16z"/></symbol>' +
        '<symbol id="i-linha" viewBox="0 0 24 24"><path d="M4.5 12h15"/></symbol>' +
        '<symbol id="i-mais" viewBox="0 0 24 24"><path d="M12 4.5v15M4.5 12h15"/></symbol>' +
        '<symbol id="i-porta" viewBox="0 0 24 24"><path d="M6.5 3.5h11v17h-11z"/><path d="M14.6 12.2a.9.9 0 11-1.8 0 .9.9 0 011.8 0"/><path d="M3.5 20.5h17"/></symbol>' +
        '<symbol id="i-janela" viewBox="0 0 24 24"><path d="M4.5 4.5h15v15h-15z"/><path d="M12 4.5v15M4.5 12h15"/></symbol>' +
        '<symbol id="i-fechar" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></symbol>' +
        '<symbol id="i-cadeado" viewBox="0 0 24 24"><path d="M5.5 10.5h13v10h-13z"/><path d="M8.5 10.5V7a3.5 3.5 0 017 0v3.5"/></symbol>' +
        '<symbol id="i-cadeado-aberto" viewBox="0 0 24 24"><path d="M5.5 10.5h13v10h-13z"/><path d="M8.5 10.5V7a3.5 3.5 0 016.9-.9"/></symbol>' +
        '<symbol id="i-dado" viewBox="0 0 24 24"><path d="M4.5 4.5h15v15h-15z"/><path d="M8.5 8.5h.01M15.5 8.5h.01M12 12h.01M8.5 15.5h.01M15.5 15.5h.01"/></symbol>' +
        '<symbol id="i-balao" viewBox="0 0 24 24"><path d="M20.5 11a7 7 0 01-7 7H9l-5.5 3.5V11a7 7 0 017-7h3a7 7 0 017 7z"/><path d="M8.5 11h.01M12 11h.01M15.5 11h.01"/></symbol>' +
        '<symbol id="i-fantasma" viewBox="0 0 24 24"><path d="M12 2.5A7.5 7.5 0 004.5 10v11.5l2.5-2 2.5 2 2.5-2 2.5 2 2.5-2 2.5 2V10A7.5 7.5 0 0012 2.5z"/><path d="M9.7 10h.01M14.3 10h.01"/></symbol>' +
        '<symbol id="i-brilho" viewBox="0 0 24 24"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/></symbol>' +
        '<symbol id="i-caveira" viewBox="0 0 24 24"><path d="M12 2.5a8 8 0 00-4.5 14.6v2.4a1.5 1.5 0 001.5 1.5h6a1.5 1.5 0 001.5-1.5v-2.4A8 8 0 0012 2.5z"/><path d="M9.3 10.5h.01M14.7 10.5h.01M10.5 17h3"/></symbol>' +
        '<symbol id="i-redimensionar" viewBox="0 0 24 24"><path d="M14.5 3.5h6v6M9.5 20.5h-6v-6"/><path d="M20.5 3.5l-7 7M3.5 20.5l7-7"/></symbol>' +
        '<symbol id="i-elevacao" viewBox="0 0 24 24"><path d="M12 3v18M8.5 6.5L12 3l3.5 3.5M8.5 17.5L12 21l3.5-3.5"/></symbol>' +
        '<symbol id="i-lixeira" viewBox="0 0 24 24"><path d="M3.5 6.5h17M9 6.5v-2h6v2"/><path d="M6 6.5l1 14.5h10l1-14.5"/><path d="M10 10.5v7M14 10.5v7"/></symbol>' +

        // ---- Navegação e ações do Painel do Mestre ----
        '<symbol id="i-sair" viewBox="0 0 24 24"><path d="M9.5 20.5h-4a2 2 0 01-2-2v-13a2 2 0 012-2h4"/><path d="M16 16.5l4.5-4.5L16 7.5M20.5 12h-11"/></symbol>' +
        '<symbol id="i-casa" viewBox="0 0 24 24"><path d="M3.5 10L12 3l8.5 7"/><path d="M5.5 8.7v11.8h13V8.7"/><path d="M9.5 20.5v-7h5v7"/></symbol>' +
        '<symbol id="i-globo" viewBox="0 0 24 24"><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0"/><path d="M3.2 9.5h17.6M3.2 14.5h17.6"/><path d="M12 3a13 13 0 010 18A13 13 0 0112 3z"/></symbol>' +
        '<symbol id="i-mapa" viewBox="0 0 24 24"><path d="M9 4.5L3.5 6.8v12.7L9 17.2l6 2.3 5.5-2.3V4.5L15 6.8z"/><path d="M9 4.5v12.7M15 6.8v12.7"/></symbol>' +
        '<symbol id="i-lua" viewBox="0 0 24 24"><path d="M20.5 14.3A8.5 8.5 0 019.7 3.5a8.5 8.5 0 1010.8 10.8z"/></symbol>' +
        '<symbol id="i-menu" viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></symbol>' +
        '<symbol id="i-moeda" viewBox="0 0 24 24"><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0"/><path d="M12 6.5v11M14.8 9.2c-.6-.8-1.6-1.2-2.8-1.2-1.7 0-2.8.8-2.8 2s1.1 1.9 2.8 1.9 2.9.7 2.9 2-1.2 2.1-2.9 2.1c-1.3 0-2.3-.5-2.9-1.3"/></symbol>' +
        '<symbol id="i-apoio" viewBox="0 0 24 24"><path d="M11 15.5l-2.5 2.5-5-5 3-3h4l2 2"/><path d="M13 8.5l2.5-2.5 5 5-3 3h-4l-2-2"/></symbol>' +
        '<symbol id="i-megafone" viewBox="0 0 24 24"><path d="M3.5 9.5h4L14 5v14l-6.5-4.5h-4z"/><path d="M17.5 9a4 4 0 010 6"/></symbol>' +
        '<symbol id="i-entrada" viewBox="0 0 24 24"><path d="M12 3.5v11M8 10.5l4 4 4-4"/><path d="M3.5 16v3a1.5 1.5 0 001.5 1.5h14a1.5 1.5 0 001.5-1.5v-3"/></symbol>' +
        '<symbol id="i-saida" viewBox="0 0 24 24"><path d="M12 14.5v-11M8 7.5l4-4 4 4"/><path d="M3.5 16v3a1.5 1.5 0 001.5 1.5h14a1.5 1.5 0 001.5-1.5v-3"/></symbol>' +
        '<symbol id="i-elo" viewBox="0 0 24 24"><path d="M10 13.5a4 4 0 006 .5l2.5-2.5a4 4 0 00-5.7-5.7L11.5 7"/><path d="M14 10.5a4 4 0 00-6-.5L5.5 12.5a4 4 0 005.7 5.7L12.5 17"/></symbol>' +
        '<symbol id="i-recarregar" viewBox="0 0 24 24"><path d="M20.5 12a8.5 8.5 0 11-2.5-6"/><path d="M20.5 3.5V10h-6.5"/></symbol>' +
        '<symbol id="i-check" viewBox="0 0 24 24"><path d="M4.5 12.5l5 5 10-11"/></symbol>' +
        '<symbol id="i-caixa-marcada" viewBox="0 0 24 24"><path d="M4.5 4.5h15v15h-15z"/><path d="M8 12l3 3 5.5-6"/></symbol>' +
        '<symbol id="i-duplicar" viewBox="0 0 24 24"><path d="M9 9h11v11.5H9z"/><path d="M15 9V4.5H4v11h4.5"/></symbol>' +
        '<symbol id="i-salvar" viewBox="0 0 24 24"><path d="M4.5 4.5h12L19.5 8v11.5h-15z"/><path d="M8 4.5v5h7v-5M8 19.5v-6h8v6"/></symbol>' +
        '<symbol id="i-caixa" viewBox="0 0 24 24"><path d="M3.5 7.5L12 3.5l8.5 4v9L12 20.5l-8.5-4z"/><path d="M3.5 7.5L12 11.5l8.5-4M12 11.5v9"/></symbol>' +
        '<symbol id="i-grafico" viewBox="0 0 24 24"><path d="M3.5 20.5h17"/><path d="M6.5 20.5v-6M11 20.5V6.5M15.5 20.5v-9M20 20.5v-13"/></symbol>' +
        '<symbol id="i-alta" viewBox="0 0 24 24"><path d="M3.5 17l6-6 4 4 7-8"/><path d="M15.5 7h5v5"/></symbol>' +
        '<symbol id="i-carrinho" viewBox="0 0 24 24"><path d="M2.5 4h2.5l2.4 11.5h10.6"/><path d="M6.5 7h14l-1.6 6.5H7.9"/><path d="M9.5 19.5h.01M17 19.5h.01"/></symbol>' +
        '<symbol id="i-gema" viewBox="0 0 24 24"><path d="M7 3.5h10l4 6-9 11.5L3 9.5z"/><path d="M3 9.5h18M7 3.5l5 6 5-6M12 9.5V21"/></symbol>' +
        '<symbol id="i-fabrica" viewBox="0 0 24 24"><path d="M3.5 20.5v-11l5 3.5v-3.5l5 3.5v-3.5l5 3.5v7.5z"/><path d="M3.5 9.5L4 4h3l.5 5.5"/></symbol>' +
        '<symbol id="i-ferramentas" viewBox="0 0 24 24"><path d="M14 6.5a3.5 3.5 0 004.8 4.8l2 2-4.5 4.5-2-2A3.5 3.5 0 009.5 10L6 6.5 8.5 4z"/></symbol>' +
        '<symbol id="i-arquivo" viewBox="0 0 24 24"><path d="M13.5 3.5H6.5A1.5 1.5 0 005 5v14a1.5 1.5 0 001.5 1.5h11A1.5 1.5 0 0019 19V9z"/><path d="M13.5 3.5V9H19"/></symbol>' +
        '<symbol id="i-estrela" viewBox="0 0 24 24"><path d="M12 3l2.8 6 6.2.7-4.6 4.3 1.3 6.1L12 17l-5.7 3.1 1.3-6.1L3 9.7 9.2 9z"/></symbol>' +
        '<symbol id="i-pessoa" viewBox="0 0 24 24"><path d="M15.5 8a3.5 3.5 0 11-7 0 3.5 3.5 0 017 0"/><path d="M4.5 20.5a7.5 7.5 0 0115 0"/></symbol>' +
        '<symbol id="i-dragao" viewBox="0 0 24 24"><path d="M3 8.5l4-3 3 3h6l5 3-3.5 3 1.5 5-6-3-5 3 1-5z"/><path d="M9.5 9.5h.01"/></symbol>' +
        '<symbol id="i-forca" viewBox="0 0 24 24"><path d="M6.5 10.5V8a2 2 0 014 0v2.5"/><path d="M10.5 10.5V7a2 2 0 014 0v3.5"/><path d="M14.5 10.5v-2a2 2 0 014 0V15a6 6 0 01-6 6h-1.5a6 6 0 01-6-6v-2a2 2 0 014 0"/></symbol>' +
        '<symbol id="i-limpar" viewBox="0 0 24 24"><path d="M15.5 3.5l5 5-9 9h-5l-2-2z"/><path d="M11 8l5 5M3.5 20.5h17"/></symbol>' +
        '<symbol id="i-seta-cima" viewBox="0 0 24 24"><path d="M12 20V4M5.5 10.5L12 4l6.5 6.5"/></symbol>' +
        '<symbol id="i-seta-baixo" viewBox="0 0 24 24"><path d="M12 4v16M5.5 13.5L12 20l6.5-6.5"/></symbol>' +
        '<symbol id="i-seta-esq" viewBox="0 0 24 24"><path d="M19.5 12h-15M10.5 6l-6 6 6 6"/></symbol>' +
        '<symbol id="i-seta-dir" viewBox="0 0 24 24"><path d="M4.5 12h15M13.5 6l6 6-6 6"/></symbol>' +
        '<symbol id="i-menos" viewBox="0 0 24 24"><path d="M4.5 12h15"/></symbol>' +
        '<symbol id="i-densidade" viewBox="0 0 24 24"><path d="M3.5 5.5h17M3.5 12h17M3.5 18.5h17"/></symbol>' +
        '</defs></svg>';

    /** Marcação de um ícone do sprite. `lrIco('dado')` → <svg…><use href="#i-dado"/></svg> */
    window.lrIco = function (nome, classe) {
        return '<svg class="' + (classe || 'lr-ico') + '"><use href="#i-' + nome + '"/></svg>';
    };

    // Script clássico no topo do <body>: `document.body` já existe e o resto
    // do body ainda não foi lido, então o sprite entra antes de qualquer
    // <use> ser resolvido. Sem flash de botão vazio, sem esperar módulo.
    function injetar() {
        if (document.getElementById('lr-sprite')) return;
        var host = document.createElement('div');
        host.id = 'lr-sprite';
        host.style.display = 'contents';
        host.innerHTML = SPRITE;
        document.body.insertBefore(host, document.body.firstChild);
    }

    if (document.body) injetar();
    else document.addEventListener('DOMContentLoaded', injetar);
})();
