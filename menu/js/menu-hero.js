/* =====================================================================
   ✨ HERO DO PORTAL — selo rúnico guiado pelo scroll
   ---------------------------------------------------------------------
   Desenho procedural no canvas (zero assets): anéis, 24 runas que
   acendem e a gema central, todos progredindo com o scroll do trilho.
   O quadro desenhado persegue o alvo com lerp — sem salto visível, e o
   rAF pausa sozinho quando não há movimento (zero custo parado).

   Logado (body.portal-logado) ou prefers-reduced-motion: sem trilho,
   quadro final estático.

   Fase futura: o Criador configura uma sequência de imagens; este selo
   permanece como fallback quando não houver nenhuma.
   ===================================================================== */
(function () {
    'use strict';

    var canvas = document.getElementById('heroCanvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var trilho = document.getElementById('heroTrilho');
    var dica = document.getElementById('heroDica');
    var reduzMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var alvo = 0, atual = -1;
    var rodando = false;
    var frames = [];          // imagens configuradas pelo Criador (vazio = selo)
    var configTentada = false;

    function medidas() {
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        var r = canvas.getBoundingClientRect();
        var w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
        if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    }

    function cores() {
        var s = getComputedStyle(document.documentElement);
        return {
            fundo0: s.getPropertyValue('--lr-bg-0').trim(),
            fundo1: s.getPropertyValue('--lr-bg-1').trim(),
            ouro: s.getPropertyValue('--lr-gold').trim(),
            arcano: s.getPropertyValue('--lr-arcane').trim(),
            abissal: s.getPropertyValue('--lr-abyssal').trim(),
            traco: s.getPropertyValue('--lr-border').trim()
        };
    }

    function desenhar(t) {
        medidas();
        var w = canvas.width, h = canvas.height;
        if (!w || !h) return;
        var c = cores();
        var cx = w / 2, cy = h / 2;
        var R = Math.min(w, h) * 0.30;

        ctx.clearRect(0, 0, w, h);

        var g = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, Math.max(w, h) * 0.7);
        g.addColorStop(0, c.fundo1);
        g.addColorStop(1, c.fundo0);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);

        var rot = t * Math.PI * 0.9;
        var acesa = Math.floor(t * 24 + 0.001);

        ctx.save();
        ctx.translate(cx, cy);

        [1, 0.78, 0.55].forEach(function (k) {
            ctx.beginPath();
            ctx.arc(0, 0, R * k, 0, Math.PI * 2);
            ctx.strokeStyle = c.traco;
            ctx.globalAlpha = 0.55;
            ctx.lineWidth = Math.max(1, R * 0.008);
            ctx.stroke();
        });

        for (var i = 0; i < 24; i++) {
            var a = rot + (i / 24) * Math.PI * 2;
            var x = Math.cos(a) * R * 0.89, y = Math.sin(a) * R * 0.89;
            var lig = i < acesa;
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(a + Math.PI / 2);
            ctx.globalAlpha = lig ? 0.95 : 0.35;
            ctx.strokeStyle = lig ? c.ouro : c.traco;
            ctx.lineWidth = Math.max(1, R * 0.012);
            ctx.lineCap = 'round';
            var s = R * 0.055;
            ctx.beginPath();
            ctx.moveTo(0, -s); ctx.lineTo(0, s);
            if (i % 3 === 0) { ctx.moveTo(0, -s * 0.4); ctx.lineTo(s * 0.7, 0); }
            if (i % 3 === 1) { ctx.moveTo(0, 0); ctx.lineTo(-s * 0.7, s * 0.5); }
            if (i % 4 === 0) { ctx.moveTo(-s * 0.5, -s * 0.6); ctx.lineTo(s * 0.5, -s * 0.6); }
            ctx.stroke();
            if (lig) {
                ctx.globalAlpha = 0.28;
                ctx.shadowColor = c.ouro;
                ctx.shadowBlur = R * 0.06;
                ctx.stroke();
            }
            ctx.restore();
        }

        ctx.save();
        ctx.rotate(-rot * 0.6);
        ctx.beginPath();
        for (var v = 0; v < 3; v++) {
            var av = (v / 3) * Math.PI * 2 - Math.PI / 2;
            var xv = Math.cos(av) * R * 0.5, yv = Math.sin(av) * R * 0.5;
            v ? ctx.lineTo(xv, yv) : ctx.moveTo(xv, yv);
        }
        ctx.closePath();
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = c.arcano;
        ctx.lineWidth = Math.max(1, R * 0.008);
        ctx.stroke();
        ctx.restore();

        var brilho = Math.max(0, (t - 0.65) / 0.35);
        ctx.beginPath();
        ctx.moveTo(0, -R * 0.16);
        ctx.lineTo(R * 0.11, 0);
        ctx.lineTo(0, R * 0.16);
        ctx.lineTo(-R * 0.11, 0);
        ctx.closePath();
        ctx.globalAlpha = 0.45 + brilho * 0.5;
        ctx.strokeStyle = c.abissal;
        ctx.lineWidth = Math.max(1, R * 0.01);
        ctx.stroke();
        if (brilho > 0) {
            ctx.globalAlpha = brilho * 0.5;
            ctx.fillStyle = c.abissal;
            ctx.shadowColor = c.abissal;
            ctx.shadowBlur = R * 0.12 * brilho;
            ctx.fill();
        }

        ctx.restore();
        ctx.globalAlpha = 1;
    }

    /* Com imagens do Criador: quadro = t × (N−1), desenhado em cover. */
    function desenharFrames(t) {
        medidas();
        var w = canvas.width, h = canvas.height;
        var img = frames[Math.round(t * (frames.length - 1))];
        if (!img || !w || !h) return;
        var escc = Math.max(w / img.naturalWidth, h / img.naturalHeight);
        var dw = img.naturalWidth * escc, dh = img.naturalHeight * escc;
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    }

    var desenharSelo = desenhar;
    desenhar = function (t) { frames.length ? desenharFrames(t) : desenharSelo(t); };

    /* Título e botão por cima da arte: quem manda é o Criador, na aba Portal.
       Vira atributo no palco e o CSS posiciona — sem estilo inline, para o
       tema e o celular continuarem tendo a palavra. */
    /* ⚠️ ESTE OBJETO TEM UM GÊMEO em menu/js/menu-portal-config.js, e os dois
       precisam bater. Não dá para importar um do outro: este arquivo é script
       clássico (roda antes dos módulos, de propósito, para o selo já estar
       pintado no primeiro quadro) e aquele é módulo. Quem cobra a igualdade é
       __check-portal-raiz.html — foi para isso que o teste entrou. */
    var TEXTO_PADRAO = {
        titulo: true, cta: true,
        vertical: 'centro', horizontal: 'centro',
        ctaV: 'igual', ctaH: 'igual', ctaTam: 'medio',
        veu: 'medio', ritmo: 'normal',
    };

    /* POSICIONA UM PALCO — o de verdade ou a prévia da aba Portal.
       Recebe o palco como argumento justamente para servir aos dois: a prévia
       não pode ter uma cópia desta lógica, senão ela mostra uma coisa e a
       animação faz outra, que é o pior tipo de prévia. */
    window.portalHeroPosicionar = function (palco, t) {
        var v = Object.assign({}, TEXTO_PADRAO, t || {});
        var texto = palco && palco.querySelector('.portal-hero-texto');
        // Procura no PALCO, não no texto: o botão pode já ter saído de lá.
        var cta = palco && palco.querySelector('.portal-hero-cta');
        if (!palco || !texto) return;

        palco.dataset.v = v.vertical;
        palco.dataset.h = v.horizontal;
        palco.dataset.veu = v.veu;

        texto.hidden = !v.titulo && !v.cta;
        // Esconder o título mas manter o botão: o h1 e o lema saem, o CTA fica.
        texto.classList.toggle('sem-titulo', !v.titulo);
        if (!cta) return;
        cta.hidden = !v.cta;
        cta.dataset.tam = v.ctaTam;

        /* CANTO PRÓPRIO PARA O BOTÃO.
           Com 'igual' nos dois eixos ele volta para DENTRO do bloco de texto e
           empilha embaixo do lema, que é como sempre foi. Com um canto seu, ele
           sai para o palco e se posiciona sozinho.
           Mover o nó é o que evita a alternativa ruim: deixar os dois soltos na
           mesma célula do grid e vê-los se sobrepondo quando o Criador escolhe
           o mesmo canto para ambos. */
        /* Resolve os dois cantos ANTES de comparar. Comparar com 'igual' não
           bastava: escolher "Topo" para o botão com o título já no topo dava
           `proprio = true`, o botão saía para o palco e ia parar EM CIMA do
           título — mesma célula do grid, mesmo canto, um cobrindo o outro.
           Canto resolvido igual ao do título é o mesmo que "junto dele". */
        var cv = v.ctaV === 'igual' ? v.vertical : v.ctaV;
        var ch = v.ctaH === 'igual' ? v.horizontal : v.ctaH;
        /* Só a LINHA decide se o botão ganha lugar próprio.
           Dividir a mesma faixa com o título, cada um numa coluna, não cabe:
           medido em 375px, doze arranjos punham o botão em cima do texto do
           título. E não é questão de apertar mais — numa tela de mão não há
           largura para um título grande e um botão lado a lado.
           Linha diferente (topo × rodapé, que é o caso de sempre) não tem esse
           problema em tamanho nenhum. Na mesma linha, ele volta a empilhar
           embaixo do lema, e a coluna dele passa a ser a do título. */
        var proprio = cv !== v.vertical;
        if (proprio) {
            if (cta.parentElement !== palco) palco.appendChild(cta);
            cta.dataset.cv = cv;
            cta.dataset.ch = ch;
        } else {
            if (cta.parentElement !== texto) texto.appendChild(cta);
            delete cta.dataset.cv;
            delete cta.dataset.ch;
        }
    };

    window.portalHeroAplicarTexto = function (t) {
        var v = Object.assign({}, TEXTO_PADRAO, t || {});
        /* Ritmo da animação = altura do trilho (ver menu.css). Rolar mais para
           trocar de quadro é a mesma coisa que animar mais devagar. Só o palco
           de verdade tem trilho; a prévia não anima. */
        if (trilho) {
            if (v.ritmo && v.ritmo !== 'normal') trilho.dataset.ritmo = v.ritmo;
            else delete trilho.dataset.ritmo;
        }
        window.portalHeroPosicionar(canvas.parentElement, v);
    };

    /* Sequência configurada pelo Criador (portal-config/hero — leitura
       pública). Sem doc ou sem imagens: o selo continua. */
    function carregarConfig() {
        if (configTentada || !window.db) return;
        configTentada = true;
        import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js')
            .then(function (m) { return m.getDoc(m.doc(window.db, 'portal-config', 'hero')); })
            .then(function (snap) {
                var d = snap.exists() ? snap.data() : {};
                window.portalHeroAplicarTexto(d.texto);
                var urls = d.imagens || [];
                if (!urls.length) return;
                /* ⚠️ SEM `crossOrigin`. O Storage do Firebase não manda
                   `Access-Control-Allow-Origin` (conferido no cabeçalho da
                   resposta), então `crossOrigin = 'anonymous'` fazia TODA
                   imagem falhar — e a falha era muda: o `allSettled` filtrava
                   as rejeitadas e o hero voltava para o selo desenhado, como
                   se ninguém tivesse configurado nada.
                   Pedir CORS aqui não comprava nada: este canvas só faz
                   `drawImage` e nunca lê pixel de volta (`getImageData`,
                   `toDataURL`), que é a única coisa que o `tainted` proíbe. */
                return Promise.allSettled(urls.map(function (u) {
                    return new Promise(function (ok, erro) {
                        var img = new Image();
                        img.onload = function () { ok(img); };
                        img.onerror = function () { erro(new Error('não carregou: ' + u)); };
                        img.src = u;
                    });
                })).then(function (rs) {
                    var ok = rs.filter(function (r) { return r.status === 'fulfilled'; })
                        .map(function (r) { return r.value; });
                    var caiu = rs.length - ok.length;
                    // Silêncio aqui já custou uma investigação: se alguma
                    // imagem não entrar, o Criador merece saber no console.
                    if (caiu) console.warn('Hero: ' + caiu + ' de ' + rs.length
                        + ' imagens não carregaram; o restante segue.');
                    if (ok.length) { frames = ok; redesenhar(); }
                });
            })
            .catch(function (e) { console.warn('Hero: sem config de imagens, usando o selo.', e); });
    }

    function progresso() {
        if (reduzMovimento) return 1;
        var alt = trilho.offsetHeight - window.innerHeight;
        if (alt <= 0) return 1;
        return Math.min(1, Math.max(0, (window.scrollY - trilho.offsetTop) / alt));
    }

    function laco() {
        alvo = progresso();
        atual = atual < 0 ? alvo : atual + (alvo - atual) * 0.18;
        if (Math.abs(alvo - atual) < 0.0015) atual = alvo;
        desenhar(atual);
        if (dica) dica.classList.toggle('some', alvo > 0.04);
        if (atual !== alvo) requestAnimationFrame(laco);
        else rodando = false;
    }

    function acordar() {
        if (!rodando) { rodando = true; requestAnimationFrame(laco); }
    }

    /* laco() direto pinta o 1º quadro de forma síncrona (aba em segundo
       plano não tem rAF); dali em diante o rAF assume */
    function redesenhar() { atual = -1; laco(); }

    if (reduzMovimento) {
        desenhar(1);
    } else {
        window.addEventListener('scroll', acordar, { passive: true });
        window.addEventListener('resize', redesenhar);
        laco();
    }

    // tema trocou (html.dark) → cores do canvas trocam
    new MutationObserver(redesenhar)
        .observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    // logar/deslogar muda a altura do palco → repinta no novo tamanho
    document.addEventListener('portal:logado', redesenhar);
    document.addEventListener('portal:deslogado', redesenhar);

    /* ⚠️ ISTO AQUI FALTAVA. `carregarConfig()` estava escrita e ninguém a
       chamava: o hero nunca tentou ler `portal-config/hero`, então as imagens
       do Criador jamais entravam e o selo desenhado ficava para sempre — sem
       erro nenhum no console, porque nada chegava a rodar.

       Por que nos EVENTOS e não só aqui: menu-hero.js é script clássico e roda
       ANTES dos módulos, então `window.db` ainda não existe neste ponto. A
       tentativa no boot cobre quem já tem o db pronto; `portal:logado` e
       `portal:deslogado` cobrem o resto — o `onAuthStateChanged` dispara um
       dos dois em toda visita, com ou sem login. `configTentada` só é marcada
       quando a leitura de fato começa, então a tentativa que sai cedo demais
       não queima a vez. */
    /* Altura do cabeçalho -> CSS, para o palco descontar (ver menu.css).
       Medida, e não somada dos tokens: quanto as faixas ocupam depende da
       largura, de estar logado e de o rótulo quebrar em duas linhas. */
    function medirCabecalho() {
        var cab = document.querySelector('.portal-topo');
        var h = cab ? Math.round(cab.getBoundingClientRect().height) : 0;
        document.documentElement.style.setProperty('--portal-cabecalho-h', h + 'px');
    }
    medirCabecalho();
    window.addEventListener('resize', medirCabecalho);
    document.addEventListener('portal:logado', medirCabecalho);
    document.addEventListener('portal:deslogado', medirCabecalho);

    carregarConfig();
    document.addEventListener('portal:logado', carregarConfig);
    document.addEventListener('portal:deslogado', carregarConfig);
})();
