/* =====================================================================
   📖 LIVRO VINCULADO — Raça / Classe / Tribo
   ---------------------------------------------------------------------
   O criador vincula um livro do Escritório do Cronista a uma raça, classe
   ou tribo (Painel do Criador → campo "Livro Vinculado") e escolhe quais
   capítulos ficam visíveis — nenhum marcado = todos.

   Este arquivo é a leitura desse vínculo, igual nos dois lugares onde o
   jogador vê os detalhes:
     • criar-personagem → "Ver detalhes" da Raça / Classe / Tribo
     • ficha-v1.7_1     → ícone ℹ️ ao lado dos selects

   Um botão por livro ("Abrir livro X"). Livro de um capítulo abre direto
   no texto; livro de vários abre no sumário, e cada capítulo tem volta.

   Dois formatos convivem no doc, sem migração:
     livroVinculado  = { bookId, capituloIds: [] }    ← legado, um livro
     livrosVinculados = [{ bookId, capituloIds: [] }] ← atual, vários
   Quem lê passa pelo normalizar() (window.lvNormalizar).

   O mesmo leitor serve o Painel do Mestre e o Tabuleiro, por outras portas:
     lvBiblioteca({ filtro, acaoCapitulo })  → estante de livros
     lvAbrirLivroId(bookId)                  → sumário de um livro
     lvLerCapitulo(capId)                    → o capítulo direto
   ATENÇÃO: a biblioteca NÃO avalia trava de capítulo (system/data/knowledge).
   Ela é do mestre; a leitura do jogador com requisitos é a aba Conhecimento
   da ficha, que roda o motor da ficha inteiro.
   ===================================================================== */
(function () {
    let _p = null;        // promise do carregamento (uma vez por página)
    let _seq = 0;
    const _vinculos = []; // vínculos já renderizados — o onclick usa o índice
    let _bib = null;      // opções da biblioteca aberta (para o "voltar")
    let _sum = null;      // vínculo do sumário aberto (idem)
    let _repintar = null; // redesenha a tela atual sem mudar de lugar (lvRepintar)

    const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    /* Versão do livro. Este arquivo é script CLÁSSICO, então não dá para
       `import` no topo — vem junto do acervo, em carregar(), e todo caminho
       que desenha livro já espera essa promise. Até lá, sem selo.
       Caminho ABSOLUTO de propósito: em script clássico o especificador de
       import() resolve contra a URL da PÁGINA, e este arquivo é carregado de
       cinco pastas diferentes. */
    let versaoDoLivro = () => '';
    const seloVersao = (l, estilo) => {
        const v = versaoDoLivro(l);
        return v ? `<span style="${estilo}">🔖 ${esc(v)}</span>` : '';
    };

    function carregar() {
        if (!_p) _p = (async () => {
            const [{ collection, getDocs }, pub] = await Promise.all([
                import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js'),
                import('/shared/livros-pub.js'),
            ]);
            versaoDoLivro = pub.versaoDoLivro;
            const [bSnap, aSnap] = await Promise.all([
                getDocs(collection(window.db, 'worldbuilding-books')),
                getDocs(collection(window.db, 'worldbuilding-articles')),
            ]);
            const livros = [], caps = [];
            bSnap.forEach(d => livros.push({ id: d.id, ...d.data() }));
            aSnap.forEach(d => caps.push({ id: d.id, ...d.data() }));
            caps.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.createdAt ?? 0) - (b.createdAt ?? 0));
            return { livros, caps };
        })();
        return _p;
    }

    /**
     * Vínculos da entidade, sempre como array. O array novo manda quando
     * existe (mesmo vazio); sem ele, cai no objeto único do formato legado.
     */
    function normalizar(entidade) {
        const lista = Array.isArray(entidade?.livrosVinculados)
            ? entidade.livrosVinculados
            : (entidade?.livroVinculado ? [entidade.livroVinculado] : []);
        return lista.filter(v => v && v.bookId);
    }

    /** Capítulos que o vínculo libera. Lista vazia de IDs = o livro inteiro. */
    function capitulosDo(vinc, caps) {
        const ids = Array.isArray(vinc.capituloIds) ? vinc.capituloIds : [];
        return caps.filter(c => c.bookId === vinc.bookId && (!ids.length || ids.includes(c.id)));
    }

    /**
     * Devolve NA HORA um container vazio (os modais montam HTML de forma
     * síncrona) e preenche quando os livros chegarem. Sem livro vinculado,
     * devolve string vazia e nada é carregado.
     */
    function secaoHTML(entidade) {
        const vincs = normalizar(entidade);
        if (!vincs.length) return '';
        const slot = 'lvSec' + (++_seq);
        const base = _vinculos.length;
        _vinculos.push(...vincs);

        carregar().then(({ livros, caps }) => {
            const el = document.getElementById(slot);
            if (!el) return;

            const blocos = vincs.map((vinc, i) => {
                const livro = livros.find(l => l.id === vinc.bookId);
                const lista = livro ? capitulosDo(vinc, caps) : [];
                if (!lista.length) return '';
                return `
                    ${livro.description ? `<div class="detail-section-text">${esc(livro.description)}</div>` : ''}
                    <button type="button" class="btn" style="margin-top:10px;font-weight:700"
                        onclick="window.lvAbrirLivro(${base + i})">
                        📖 Abrir livro “${esc(livro.title || 'Sem título')}”
                    </button>
                    <div style="font-size:.78rem;opacity:.7;margin-top:6px">
                        ${seloVersao(livro, 'font-weight:700;color:var(--lr-gold,#D4AF37)') ? seloVersao(livro, 'font-weight:700;color:var(--lr-gold,#D4AF37)') + ' · ' : ''}${lista.length} ${lista.length === 1 ? 'capítulo disponível' : 'capítulos disponíveis'} para leitura
                    </div>`;
            }).filter(Boolean);
            if (!blocos.length) { el.remove(); return; }

            el.innerHTML = `
                <div class="detail-section">
                    <div class="detail-section-title">📖 ${blocos.length === 1 ? 'Livro vinculado' : 'Livros vinculados'}</div>
                    ${blocos.join('<div style="height:1px;background:var(--lr-border,#333);margin:14px 0"></div>')}
                </div>`;
        }).catch(e => console.error('📖 Livro vinculado:', e));

        return `<div id="${slot}"></div>`;
    }

    /* ===== Leitor — JANELA flutuante, por cima de qualquer modal já aberto =====
       Sem fundo escuro bloqueando a tela: no Tabuleiro o jogador continua
       mexendo no mapa com o livro aberto onde ele largou. Arrasta pela barra
       de cima; o tamanho é o `resize` nativo do CSS (canto inferior direito).
       A geometria escolhida sobrevive à navegação E ao fechar/reabrir. */

    let _geo = null;   // { left, top, w, h } da última posição/tamanho escolhidos

    function _caixa() {
        let ov = document.getElementById('lvLeitor');
        if (ov) return ov.querySelector('.lv-box');

        const w = Math.min(820, window.innerWidth - 24);
        const h = Math.min(700, window.innerHeight - 80);
        const g = _geo || { left: Math.max(12, (window.innerWidth - w) / 2), top: 56, w, h };

        ov = document.createElement('div');
        ov.id = 'lvLeitor';
        ov.style.cssText = `position:fixed;left:${g.left}px;top:${g.top}px;width:${g.w}px;height:${g.h}px;
            z-index:100000;resize:both;overflow:hidden;min-width:280px;min-height:180px;
            max-width:100vw;max-height:100vh;border-radius:12px;
            box-shadow:0 18px 50px rgba(0,0,0,.55);display:flex;flex-direction:column`;
        ov.innerHTML = `
            <div class="lv-barra" style="display:flex;align-items:center;gap:8px;flex:none;cursor:grab;user-select:none;
                background:var(--lr-bg-1,#12161d);color:var(--lr-text-2,#999);
                border:1px solid var(--lr-border,#333);border-bottom:none;border-radius:12px 12px 0 0;padding:6px 10px">
                <span style="letter-spacing:.25em;opacity:.6">⠿</span>
                <span style="flex:1;font-size:.78rem">📖 Leitura — arraste para mover, canto inferior para redimensionar</span>
                <button type="button" onclick="window.lvFechar()" title="Fechar"
                    style="background:none;border:none;color:inherit;font-size:1.2rem;cursor:pointer;line-height:1">✕</button>
            </div>
            <div class="lv-box" style="flex:1;min-height:0;overflow:auto;
                background:var(--lr-surface,#161616);color:var(--lr-text-1,#eee);
                border:1px solid var(--lr-border,#333);border-top:none;border-radius:0 0 12px 12px;
                padding:22px 24px 26px;position:relative"></div>`;
        document.body.appendChild(ov);
        _arrastar(ov);
        // O resize nativo não avisa ninguém — o observer só guarda o tamanho final.
        if (window.ResizeObserver) new ResizeObserver(() => _guardarGeo(ov)).observe(ov);
        return ov.querySelector('.lv-box');
    }

    function _guardarGeo(ov) {
        _geo = { left: ov.offsetLeft, top: ov.offsetTop, w: ov.offsetWidth, h: ov.offsetHeight };
    }

    /** Arrasto pela barra. Ponteiro capturado: não escapa nem se passar por cima
     *  do canvas do tabuleiro, que come eventos de mouse. */
    function _arrastar(ov) {
        const barra = ov.querySelector('.lv-barra');
        let dx = 0, dy = 0;
        barra.addEventListener('pointerdown', (e) => {
            if (e.target.closest('button')) return;
            dx = e.clientX - ov.offsetLeft;
            dy = e.clientY - ov.offsetTop;
            barra.setPointerCapture(e.pointerId);
            barra.style.cursor = 'grabbing';
            e.preventDefault();
        });
        barra.addEventListener('pointermove', (e) => {
            if (!barra.hasPointerCapture(e.pointerId)) return;
            // sempre sobra um pedaço na tela — janela perdida fora da borda não volta
            ov.style.left = Math.min(Math.max(-ov.offsetWidth + 80, e.clientX - dx), window.innerWidth - 80) + 'px';
            ov.style.top = Math.min(Math.max(0, e.clientY - dy), window.innerHeight - 40) + 'px';
        });
        const soltar = (e) => {
            if (!barra.hasPointerCapture(e.pointerId)) return;
            barra.releasePointerCapture(e.pointerId);
            barra.style.cursor = 'grab';
            _guardarGeo(ov);
        };
        barra.addEventListener('pointerup', soltar);
        barra.addEventListener('pointercancel', soltar);
    }

    /* Fechar limpa a trilha de volta: senão o "← Biblioteca" de uma leitura
       futura apontaria para a estante da vez anterior. */
    function fechar() {
        const ov = document.getElementById('lvLeitor');
        if (ov) { _guardarGeo(ov); ov.remove(); }
        _bib = null; _sum = null; _repintar = null;
    }

    function _pintar(html) {
        const box = _caixa();
        box.innerHTML = html;
        box.scrollTop = 0;
    }

    const _btnVoltar = (rotulo, destino) =>
        `<button type="button" onclick="window.lvVoltar('${destino}')"
            style="background:none;border:none;color:inherit;opacity:.75;font:inherit;cursor:pointer;padding:0;margin-bottom:10px">
            ← ${esc(rotulo)}
        </button>`;

    /** Abre o livro do vínculo `idx` (botão montado por secaoHTML). */
    function abrirLivro(idx) {
        _bib = null;
        abrirSumario(_vinculos[idx]);
    }

    /** Abre um livro inteiro pelo id — porta da biblioteca e de quem sabe o id. */
    function abrirLivroId(bookId) {
        if (bookId) abrirSumario({ bookId, capituloIds: [] });
    }

    /**
     * Card de livro da estante. `acao` é o JS do clique — sem ele, abre o livro
     * inteiro. Quem monta seção própria (a estante do jogador tem a do Cronista
     * em cima da dela) reaproveita o mesmo card por aqui, via lvCardLivro.
     */
    function cardLivro(l, n, acao) {
        return `
        <button type="button" class="lv-livro" onclick="${acao || `window.lvAbrirLivroId('${esc(l.id)}')`}"
            style="display:flex;align-items:center;gap:12px;width:100%;text-align:left;cursor:pointer;
                   background:var(--lr-surface-2,rgba(255,255,255,.06));color:inherit;font:inherit;
                   border:1px solid var(--lr-border,#333);border-radius:10px;padding:10px 12px">
            <span style="width:44px;height:60px;flex:none;border-radius:6px;display:flex;align-items:center;justify-content:center;
                background:${l.cover ? `url('${esc(l.cover)}') center/cover` : 'var(--lr-bg-1,rgba(255,255,255,.06))'}"
                ${l.cover ? `data-zoom="${esc(l.cover)}" data-zoom-alt="${esc(l.title || '')}" title="Ver a capa maior"` : ''}>${l.cover ? '' : '📖'}</span>
            <span style="flex:1;min-width:0">
                <span style="display:block;font-weight:700">${esc(l.title || 'Livro sem título')}</span>
                ${l.description ? `<span style="display:block;opacity:.75;font-size:.85rem">${esc(l.description)}</span>` : ''}
                <span style="display:block;opacity:.6;font-size:.78rem">${seloVersao(l, 'font-weight:700;color:var(--lr-gold,#D4AF37)') ? seloVersao(l, 'font-weight:700;color:var(--lr-gold,#D4AF37)') + ' · ' : ''}${n} ${n === 1 ? 'capítulo' : 'capítulos'}</span>
            </span>
            <span style="opacity:.6">›</span>
        </button>`;
    }

    /** Sumário do livro. Livro de um capítulo só pula direto para o texto. */
    function abrirSumario(vinc) {
        if (!vinc) return;
        _repintar = () => abrirSumario(vinc);
        carregar().then(({ livros, caps }) => {
            const livro = livros.find(l => l.id === vinc.bookId);
            // `capituloEstado` é do chamador (a estante do jogador tranca o que
            // ele ainda não desbloqueou); sem ele, tudo liberado.
            const estado = (c) => (_bib && _bib.capituloEstado) ? _bib.capituloEstado(c, livro) : 'liberado';
            const lista = (livro ? capitulosDo(vinc, caps) : []).filter(c => estado(c) !== 'oculto');
            if (!lista.length) return;
            // um capítulo só e liberado: sem sumário, e o "voltar" (se houver) é a estante
            if (lista.length === 1 && estado(lista[0]) === 'liberado') { _sum = null; return lerCapitulo(lista[0].id); }
            _sum = vinc;

            _pintar(`
                ${_bib ? _btnVoltar(_bib.titulo || 'Biblioteca', 'bib') : ''}
                <div style="font-size:.8rem;opacity:.7;margin-bottom:4px">📖 Livro ${seloVersao(livro, 'font-weight:700;color:var(--lr-gold,#D4AF37)')}</div>
                <h2 style="margin:0 0 8px">${esc(livro.title || 'Sem título')}</h2>
                ${livro.description ? `<p style="opacity:.8;font-style:italic;margin:0 0 18px">${esc(livro.description)}</p>` : ''}
                ${(_bib && _bib.acaoLivro) ? `<div style="margin:0 0 16px">${_bib.acaoLivro(livro, lista)}</div>` : ''}
                <div style="font-size:.8rem;text-transform:uppercase;letter-spacing:.06em;opacity:.7;margin-bottom:8px">Sumário</div>
                <div style="display:flex;flex-direction:column;gap:6px">
                    ${lista.map((c, i) => {
                        const linha = `<span style="opacity:.6;min-width:1.6em">${i + 1}.</span>
                                       <span style="flex:1">${esc(c.title || 'Sem título')}</span>`;
                        const caixa = `display:flex;align-items:baseline;gap:10px;flex:1;min-width:0;text-align:left;
                                       background:var(--lr-surface-2,rgba(255,255,255,.06));color:inherit;font:inherit;
                                       border:1px solid var(--lr-border,#333);border-radius:8px;padding:10px 12px`;
                        const corpo = estado(c) === 'bloqueado'
                            ? `<div class="lv-cap-lock" style="${caixa};opacity:.6" title="${esc(_bib.notaBloqueio || 'Requisitos não cumpridos')}">
                                   ${linha}<span>🔒</span></div>`
                            : `<button type="button" class="lv-cap" onclick="window.lvLerCapitulo('${esc(c.id)}')"
                                   style="${caixa};cursor:pointer">${linha}<span style="opacity:.6">›</span></button>`;
                        return `<div style="display:flex;align-items:center;gap:6px">
                            ${corpo}
                            ${(_bib && _bib.acaoCapitulo) ? _bib.acaoCapitulo(c) : ''}
                        </div>`;
                    }).join('')}
                </div>
                ${(_bib && _bib.notaBloqueio && lista.some(c => estado(c) === 'bloqueado'))
                    ? `<div style="font-size:.78rem;opacity:.7;margin-top:10px">🔒 ${esc(_bib.notaBloqueio)}</div>` : ''}`);
        }).catch(e => console.error('📖 Livro vinculado:', e));
    }

    /**
     * Capítulo + livro dele. Se o acervo já veio, sai do cache; senão busca só
     * esses dois docs. É o caminho do jogador quando o mestre exibe um capítulo
     * no tabuleiro: 2 leituras por aparelho em vez da coleção de textos inteira.
     */
    async function _buscarCapitulo(capId) {
        if (_p) {
            const { livros, caps } = await _p;
            const cap = caps.find(c => c.id === capId);
            if (cap) return { cap, livro: livros.find(l => l.id === cap.bookId) || null };
        }
        const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const s = await getDoc(doc(window.db, 'worldbuilding-articles', capId));
        if (!s.exists()) return null;
        const cap = { id: s.id, ...s.data() };
        let livro = null;
        if (cap.bookId) {
            const b = await getDoc(doc(window.db, 'worldbuilding-books', cap.bookId));
            if (b.exists()) livro = { id: b.id, ...b.data() };
        }
        return { cap, livro };
    }

    /** Abre um capítulo. O botão de volta aparece se houver sumário ou estante. */
    function lerCapitulo(capId) {
        _repintar = () => lerCapitulo(capId);
        _buscarCapitulo(capId).then((achado) => {
            if (!achado) return;
            const { cap, livro } = achado;
            _pintar(`
                ${_sum ? _btnVoltar('Sumário', 'sum') : (_bib ? _btnVoltar(_bib.titulo || 'Biblioteca', 'bib') : '')}
                ${livro ? `<div style="font-size:.8rem;opacity:.7;margin-bottom:4px">📗 ${esc(livro.title || '')} ${seloVersao(livro, 'font-weight:700;color:var(--lr-gold,#D4AF37)')}</div>` : ''}
                <h2 style="margin:0 0 8px">${esc(cap.title || 'Sem título')}</h2>
                ${cap.synopsis ? `<p style="opacity:.8;font-style:italic;margin:0 0 16px">${esc(cap.synopsis)}</p>` : ''}
                ${(_bib && _bib.acaoCapitulo) ? `<div style="margin:0 0 14px">${_bib.acaoCapitulo(cap)}</div>` : ''}
                <div class="texto-mundo">${cap.contentHTML || '<p><em>Capítulo ainda sem conteúdo.</em></p>'}</div>`);
        }).catch(e => console.error('📖 Leitura do capítulo:', e));
    }

    /** Volta um passo. O destino vem do botão: do capítulo para o sumário, do
     *  sumário para a estante — quem decide é quem desenhou a seta. */
    function voltar(destino) {
        if (destino === 'sum' && _sum) { const v = _sum; _sum = null; return abrirSumario(v); }
        if (_bib) return biblioteca(_bib);
        fechar();
    }

    /**
     * Estante de livros. Opções, todas do chamador:
     *   filtro(livro)              → quais livros entram (publicação, ver livros-pub.js)
     *   acaoCapitulo(cap)          → botão extra por capítulo ("Exibir na mesa")
     *   acaoLivro(livro, caps)     → botão extra no topo do sumário ("Exibir o livro
     *                                inteiro"); `caps` são os capítulos à vista
     *   capituloEstado(cap, livro) → 'liberado' | 'bloqueado' | 'oculto'
     *   notaBloqueio               → explicação do cadeado
     *   cabecalho                  → HTML entre o título e os livros
     */
    function biblioteca(opts) {
        _bib = opts || {};
        _sum = null;
        _repintar = () => biblioteca(_bib);
        _pintar('<div style="opacity:.7;padding:10px 0">Carregando a estante…</div>');
        carregar().then(({ livros, caps }) => {
            const estado = (c, l) => _bib.capituloEstado ? _bib.capituloEstado(c, l) : 'liberado';
            const lista = livros
                .filter(l => !_bib.filtro || _bib.filtro(l))
                // livro sem nenhum capítulo à vista não vira card — só frustraria
                .map(l => ({ l, n: caps.filter(c => c.bookId === l.id && estado(c, l) !== 'oculto').length }))
                .filter(x => x.n > 0)
                .sort((a, b) => (a.l.order ?? 0) - (b.l.order ?? 0) || (a.l.title || '').localeCompare(b.l.title || ''));
            const cards = lista.map(({ l, n }) => cardLivro(l, n)).join('');
            _pintar(`
                <h2 style="margin:0 0 14px">${esc(_bib.titulo || '📚 Biblioteca')}</h2>
                ${_bib.cabecalho || ''}
                ${cards ? `<div style="display:flex;flex-direction:column;gap:8px">${cards}</div>`
                        : '<p style="opacity:.75">Nenhum livro publicado para esta lista.</p>'}`);
        }).catch(e => console.error('📖 Biblioteca:', e));
    }

    // ESC fecha só a leitura — na captura, para o modal de detalhes que está
    // atrás não fechar junto com ela.
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (!document.getElementById('lvLeitor')) return;
        fechar();
        e.stopPropagation();
    }, true);

    window.lvNormalizar = normalizar;
    window.lvSecaoHTML = secaoHTML;
    window.lvAbrirLivro = abrirLivro;
    window.lvAbrirLivroId = abrirLivroId;
    // Sumário de um RECORTE do livro ({bookId, capituloIds}) — é como a estante
    // do jogador abre só os capítulos que o mestre exibiu.
    window.lvAbrirVinculo = abrirSumario;
    window.lvCardLivro = cardLivro;
    window.lvLerCapitulo = lerCapitulo;
    window.lvBiblioteca = biblioteca;
    window.lvVoltar = voltar;
    // Redesenha a tela atual sem mudar de lugar — o mestre exibe um capítulo e
    // o botão vira "parar" ali mesmo, sem voltar para a estante.
    window.lvRepintar = () => { if (_repintar) _repintar(); };
    window.lvFechar = fechar;
    window.lvLeitorAberto = () => !!document.getElementById('lvLeitor');
    window.lvCarregarLivros = carregar;
    // Injeta o acervo pronto no lugar da ida ao Firestore — usado pelo
    // harness __check-livro-vinculado.html (rodar sem login).
    window.lvSeedLivros = (dados) => { _p = Promise.resolve(dados); };
})();
