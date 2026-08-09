// =============================================
// AMPLIAR IMAGEM — clicou na capa, vê a capa inteira
//
// Capa de livro na estante tem 44x60px: dá para reconhecer o livro, não para
// ver a arte. Aqui qualquer elemento com `data-zoom="<url>"` abre a imagem
// grande num <dialog> nativo (Esc e clique fora fecham de graça).
//
// Delegado no document: serve para capa montada depois, dentro de modal, de
// <summary> ou de card clicável. Nesses dois últimos o clique é interrompido
// de propósito — clicar na capa amplia a capa, não abre/fecha o livro.
//
// Script clássico pelo mesmo motivo do campo de imagem: metade das telas que
// mostram livro não são módulos.
// =============================================
(function (raiz) {
    'use strict';

    function abrir(url, legenda) {
        if (!url) return;
        var dlg = document.createElement('dialog');
        dlg.className = 'iz-dlg';
        var img = document.createElement('img');
        img.className = 'iz-img';
        img.src = url;
        img.alt = legenda || '';
        dlg.appendChild(img);
        // Fecha E tira do DOM no mesmo passo: o evento 'close' não é confiável
        // em todo navegador, e sem isto cada ampliação deixava um <dialog>
        // morto no body — abre a capa dez vezes, dez sobras.
        var fechar = function () {
            if (dlg.open) dlg.close();
            dlg.remove();
        };
        // Clicar em qualquer lugar (inclusive no ::backdrop, que reporta o
        // próprio dialog como alvo) fecha; Esc chega como 'cancel'.
        dlg.addEventListener('click', fechar);
        dlg.addEventListener('cancel', fechar);
        document.body.appendChild(dlg);
        dlg.showModal();
    }

    function ligar() {
        if (raiz.__izLigado) return;
        raiz.__izLigado = true;

        var css = document.createElement('style');
        css.textContent =
            '[data-zoom]{cursor:zoom-in}' +
            'dialog.iz-dlg{border:0;padding:0;background:none;max-width:96vw;max-height:96vh;overflow:visible}' +
            'dialog.iz-dlg::backdrop{background:rgba(0,0,0,.82)}' +
            '.iz-img{display:block;max-width:96vw;max-height:96vh;width:auto;height:auto;' +
                'border-radius:10px;box-shadow:0 18px 60px rgba(0,0,0,.6);cursor:zoom-out}';
        document.head.appendChild(css);

        document.addEventListener('click', function (e) {
            var alvo = e.target.closest && e.target.closest('[data-zoom]');
            if (!alvo) return;
            // Antes de tudo: este clique é da capa, não do card nem do <details>.
            e.preventDefault();
            e.stopPropagation();
            abrir(alvo.dataset.zoom, alvo.getAttribute('data-zoom-alt') || alvo.title);
        }, true);   // captura: chega antes do onclick do card que envolve a capa
    }

    if (typeof document !== 'undefined') {
        if (document.head) ligar();
        else document.addEventListener('DOMContentLoaded', ligar);
    }

    raiz.ampliarImagem = abrir;
})(typeof window !== 'undefined' ? window : globalThis);
