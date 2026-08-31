// =============================================
// CAMPO DE IMAGEM — um jeito só de pôr imagem no sistema
//
// Antes cada tela tinha o seu: umas só aceitavam URL colada (inventários,
// NPCs, worldbuilding), outras só aceitavam arquivo (loja, tabuleiro, mapa,
// retrato da ficha). Quem estava no celular não conseguia colar URL; quem
// tinha o arquivo no PC não conseguia usar onde só havia campo de texto.
//
// Aqui vira um controle só: campo de texto com a URL + botão que abre o
// seletor do aparelho (no celular o próprio Android/iOS oferece câmera e
// galeria, é o accept="image/*" nativo fazendo o trabalho). O arquivo sobe
// para o Firebase Storage e a URL final cai no MESMO campo de texto — então
// tudo que já lia aquele input continua lendo, sem saber que mudou nada.
//
// Script CLÁSSICO de propósito: metade dos consumidores (ficha, criação,
// painel do mestre) não são módulos, e script clássico sempre executa antes
// de módulo — a ordem fica garantida. O Firebase entra por import() dinâmico
// só na hora do upload, então a página não paga nada por ter o campo na tela.
//
// Uso em formulário (devolve HTML):
//   ${CampoImagem.html({ id:'npcImagem', valor: npc.imagem, pasta:'imagens/npcs' })}
// Uso em botão/caixa de foto (devolve Promise<url|null>):
//   const url = await CampoImagem.escolher({ pasta:'char-images' });
//
// A pasta precisa estar liberada no storage.rules — o padrão `imagens/` está.
// =============================================
(function (raiz) {
    'use strict';

    var MAX_BYTES = 8 * 1024 * 1024;
    var CDN = 'https://www.gstatic.com/firebasejs/10.7.1/';
    var seq = 0;

    function esc(t) {
        return String(t == null ? '' : t)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    /** Recusa o que não é imagem ou não cabe. Devolve null quando está tudo bem.
     *  O tipo vem vazio em alguns seletores (Android, .ico no Windows), então a
     *  extensão vale como segunda chance — senão o arquivo certo é recusado. */
    var EXT_IMG = /\.(png|jpe?g|jfif|pjpe?g?|gif|webp|svg|ico|bmp|avif|heic|heif)$/i;

    /* O Storage grava o contentType que o NAVEGADOR pos no File, e ele vem
       vazio ou 'application/octet-stream' em varios casos reais: .jfif no
       Windows (a extensao que o Chrome dá ao salvar um JPEG), arquivo vindo
       de app de terceiro, seletor de alguns Android. Quando a regra do
       Storage exige `contentType.matches('image/.*')`, esse upload e negado
       por um motivo que nao tem nada a ver com o arquivo. Carimbamos pela
       extensao quando o navegador nao soube dizer. */
    var TIPO_POR_EXT = {
        png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', jfif: 'image/jpeg',
        pjp: 'image/jpeg', pjpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
        svg: 'image/svg+xml', ico: 'image/x-icon', bmp: 'image/bmp', avif: 'image/avif',
        heic: 'image/heic', heif: 'image/heif',
    };
    function tipoDe(file) {
        if (/^image\//.test(file.type || '')) return file.type;
        var ext = String(file.name || '').split('.').pop().toLowerCase();
        return TIPO_POR_EXT[ext] || '';
    }
    function validar(file) {
        if (!file) return 'Nenhum arquivo escolhido.';
        if (!/^image\//.test(file.type || '') && !EXT_IMG.test(file.name || '')) return 'Isso não é uma imagem.';
        if (file.size > MAX_BYTES) return 'Imagem acima de 8 MB. Reduza antes de enviar.';
        return null;
    }

    /** Caminho no Storage: pasta + carimbo de tempo + nome higienizado. */
    function caminho(pasta, nome) {
        var limpa = String(pasta || 'imagens').replace(/^\/+|\/+$/g, '') || 'imagens';
        var seguro = String(nome || 'imagem').replace(/[^\w.-]/g, '_').slice(-80);
        return limpa + '/' + Date.now() + '_' + seguro;
    }

    /** Sobe o arquivo e devolve a URL pública. Lança com mensagem legível. */
    async function subir(file, pasta) {
        var erro = validar(file);
        if (erro) throw new Error(erro);
        var mods = await Promise.all([
            import(CDN + 'firebase-app.js'),
            import(CDN + 'firebase-storage.js'),
        ]);
        var app = mods[0], st = mods[1];
        var alvo = st.ref(st.getStorage(app.getApp()), caminho(pasta, file.name));
        var tipo = tipoDe(file);
        try {
            await st.uploadBytes(alvo, file, tipo ? { contentType: tipo } : undefined);
        } catch (e) {
            /* 'storage/unauthorized' e a regra do Storage dizendo nao, e a
               mensagem crua do Firebase so mostra o caminho — quem le nao tem
               como saber se e a pasta, o papel ou o tipo do arquivo. */
            if (e && e.code === 'storage/unauthorized') {
                throw new Error('Sem permissao para gravar em "' + String(pasta || 'imagens') +
                    '". Ou a pasta nao esta liberada no storage.rules, ou a regra pede um papel ' +
                    '(mestre/criador) que esta conta nao tem. A URL colada continua funcionando.');
            }
            throw e;
        }
        return await st.getDownloadURL(alvo);
    }

    /**
     * HTML do campo. O input de texto mantém o id/classe/atributos que a tela
     * já usava, então nenhum `getElementById` de quem chama precisa mudar.
     *
     * opts: { id, valor, pasta, classe, placeholder, attrs, preview:false }
     */
    function html(opts) {
        var o = opts || {};
        var id = o.id || ('campoImg' + (++seq));
        var prev = o.preview === false ? '' :
            '<img class="ci-prev' + (o.valor ? ' on' : '') + '" data-ci-prev' +
            (o.valor ? ' src="' + esc(o.valor) + '"' : '') + ' alt="">';
        return '' +
            '<div class="ci-wrap" data-ci data-ci-pasta="' + esc(o.pasta || 'imagens') + '">' +
                '<div class="ci-row">' +
                    '<input type="text" id="' + esc(id) + '"' +
                        (o.classe ? ' class="' + esc(o.classe) + '"' : '') +
                        ' value="' + esc(o.valor || '') + '"' +
                        ' placeholder="' + esc(o.placeholder || 'Cole uma URL ou envie um arquivo') + '"' +
                        ' ' + (o.attrs || '') + '>' +
                    '<button type="button" class="ci-btn" data-ci-btn ' +
                        'title="Enviar imagem do aparelho (câmera, galeria ou arquivo)">📁 Arquivo</button>' +
                    '<input type="file" accept="image/*" data-ci-file hidden>' +
                '</div>' +
                '<div class="ci-msg" data-ci-msg></div>' +
                prev +
            '</div>';
    }

    /** Mesmo campo, já como elemento — para telas que montam o formulário no DOM. */
    function el(opts) {
        var d = document.createElement('div');
        d.innerHTML = html(opts);
        return d.firstElementChild;
    }

    /** Diálogo para as telas em que a imagem não mora num formulário (caixa de foto,
     *  token do tabuleiro, mapa). Devolve a URL escolhida ou null.
     *
     *  Com `comArquivo: true` devolve `{ url, file }` — o Tabuleiro precisa do File
     *  original para ler a grade nos pixels locais (o Storage devolve imagem
     *  "tainted"). `file` vem null quando a pessoa colou uma URL. */
    function escolher(opts) {
        var o = opts || {};
        return new Promise(function (resolve) {
            var dlg = document.createElement('dialog');
            var feito = false;
            dlg.className = 'ci-dlg';
            dlg.innerHTML =
                '<h3 class="ci-dlg-tit">' + esc(o.titulo || '🖼️ Imagem') + '</h3>' +
                html({ valor: o.valor, pasta: o.pasta, placeholder: o.placeholder }) +
                '<div class="ci-dlg-acoes">' +
                    '<button type="button" class="ci-btn" data-ci-cancel>Cancelar</button>' +
                    '<button type="button" class="ci-btn ci-btn-ok" data-ci-ok>Usar imagem</button>' +
                '</div>';
            document.body.appendChild(dlg);
            var campo = dlg.querySelector('input[type="text"]');
            var fim = function (v) {
                if (feito) return;
                feito = true;
                if (dlg.open) dlg.close();
                dlg.remove();
                var url = v || null;
                resolve(o.comArquivo ? { url: url, file: url ? (dlg.__ciFile || null) : null } : url);
            };
            dlg.querySelector('[data-ci-cancel]').onclick = function () { fim(null); };
            dlg.querySelector('[data-ci-ok]').onclick = function () { fim(campo.value.trim()); };
            dlg.addEventListener('cancel', function () { fim(null); });   // Esc
            dlg.showModal();
            campo.focus();
        });
    }

    // ── Ligação (uma vez só, delegada — serve para campo criado depois) ──
    function partes(el) {
        var wrap = el.closest('[data-ci]');
        return wrap && {
            wrap: wrap,
            campo: wrap.querySelector('input[type="text"], input[type="url"]'),
            msg: wrap.querySelector('[data-ci-msg]'),
            prev: wrap.querySelector('[data-ci-prev]'),
        };
    }

    function pintarPreview(p, url) {
        if (!p.prev) return;
        if (url) { p.prev.src = url; p.prev.classList.add('on'); }
        else { p.prev.removeAttribute('src'); p.prev.classList.remove('on'); }
    }

    function ligar() {
        if (raiz.__ciLigado) return;
        raiz.__ciLigado = true;

        var css = document.createElement('style');
        css.textContent =
            // flex/min-width no wrap: em telas que já põem o campo numa linha
            // flex (galeria da sessão), ele precisa se comportar como o input
            // que substituiu. Fora de flex container isso não faz nada.
            '.ci-wrap{flex:1;min-width:0}' +
            '.ci-row{display:flex;gap:6px;align-items:center}' +
            '.ci-row>input{flex:1;min-width:0}' +
            '.ci-btn{flex:0 0 auto;cursor:pointer;white-space:nowrap;font:inherit;font-size:.78rem;' +
                'padding:7px 10px;border-radius:8px;border:1px solid var(--soft,#3a3a4a);' +
                'background:var(--lr-bg-1,#1b1b28);color:var(--text,#e8e8f0)}' +
            '.ci-btn:hover{filter:brightness(1.25)}' +
            '.ci-btn[disabled]{opacity:.6;cursor:progress}' +
            '.ci-msg{font-size:.72rem;color:var(--muted,#9aa0b0);margin-top:4px}' +
            '.ci-msg:empty{display:none}' +
            '.ci-prev{display:none;margin-top:8px;max-width:100%;max-height:180px;' +
                'border-radius:8px;object-fit:contain}' +
            '.ci-prev.on{display:block}' +
            /* `margin:auto` e o que centraliza um <dialog> modal, e vem do
               navegador — mas a pagina do Worldbuilding (e boa parte do site)
               abre com `* { margin: 0 }`, que apaga justamente esse auto e
               joga a janela no canto superior esquerdo. O componente se
               defende sozinho: e mais barato do que caçar todo reset. */
            'dialog.ci-dlg{margin:auto;border:1px solid var(--soft,#3a3a4a);border-radius:12px;padding:18px;' +
                'width:min(460px,92vw);font:inherit;color:var(--text,#e8e8f0);' +
                'background:var(--lr-bg-1,#15151f)}' +
            'dialog.ci-dlg::backdrop{background:rgba(0,0,0,.62)}' +
            '.ci-dlg-tit{margin:0 0 12px;font-size:1rem}' +
            '.ci-dlg-acoes{display:flex;gap:8px;justify-content:flex-end;margin-top:16px}' +
            '.ci-btn-ok{border-color:var(--gold,#d4af37);color:var(--gold,#d4af37)}';
        document.head.appendChild(css);

        document.addEventListener('click', function (e) {
            var b = e.target.closest && e.target.closest('[data-ci-btn]');
            if (!b) return;
            e.preventDefault();
            var p = partes(b);
            if (p) p.wrap.querySelector('[data-ci-file]').click();
        });

        document.addEventListener('change', async function (e) {
            var inp = e.target.closest && e.target.closest('[data-ci-file]');
            if (!inp) return;
            var p = partes(inp);
            var file = inp.files && inp.files[0];
            inp.value = '';
            if (!p || !file) return;
            var btn = p.wrap.querySelector('[data-ci-btn]');
            btn.disabled = true;
            p.msg.textContent = '⏳ Enviando…';
            try {
                var url = await subir(file, p.wrap.dataset.ciPasta);
                p.campo.value = url;
                // Guarda o arquivo local para quem pediu `comArquivo` (ver escolher).
                var dl = p.wrap.closest('dialog');
                if (dl) dl.__ciFile = file;
                pintarPreview(p, url);
                p.msg.textContent = '✅ Imagem enviada.';
                // Quem já ouvia esse input (preview próprio, autosave, estado do
                // wizard) continua sendo avisado — por isso os dois eventos.
                p.campo.dispatchEvent(new Event('input', { bubbles: true }));
                p.campo.dispatchEvent(new Event('change', { bubbles: true }));
            } catch (err) {
                console.error('[campo-imagem]', err);
                p.msg.textContent = '❌ ' + (err && err.message ? err.message : 'Falha no upload.');
            } finally {
                btn.disabled = false;
            }
        });

        document.addEventListener('input', function (e) {
            var t = e.target;
            if (!t.closest || !t.matches || !t.matches('[data-ci] input[type="text"], [data-ci] input[type="url"]')) return;
            var p = partes(t);
            if (!p) return;
            pintarPreview(p, t.value.trim());
            p.msg.textContent = '';
            // Digitação de gente (isTrusted) desfaz o par URL↔arquivo local;
            // o evento que nós mesmos disparamos após o upload não desfaz.
            var dl = e.isTrusted && p.wrap.closest('dialog');
            if (dl) dl.__ciFile = null;
        });
    }

    if (typeof document !== 'undefined') {
        if (document.head) ligar();
        else document.addEventListener('DOMContentLoaded', ligar);
    }

    raiz.CampoImagem = { html: html, el: el, escolher: escolher, subir: subir, validar: validar, caminho: caminho };
})(typeof window !== 'undefined' ? window : globalThis);
