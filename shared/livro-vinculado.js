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

   Um botão só ("Abrir livro X"). Livro de um capítulo abre direto no
   texto; livro de vários abre no sumário, e cada capítulo tem volta.

   Formato salvo no doc: livroVinculado = { bookId, capituloIds: [] }
   ===================================================================== */
(function () {
    let _p = null;        // promise do carregamento (uma vez por página)
    let _seq = 0;
    const _vinculos = []; // vínculos já renderizados — o onclick usa o índice

    const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    function carregar() {
        if (!_p) _p = (async () => {
            const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
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
        const vinc = entidade?.livroVinculado;
        if (!vinc || !vinc.bookId) return '';
        const slot = 'lvSec' + (++_seq);
        const idx = _vinculos.push(vinc) - 1;

        carregar().then(({ livros, caps }) => {
            const el = document.getElementById(slot);
            if (!el) return;
            const livro = livros.find(l => l.id === vinc.bookId);
            const lista = livro ? capitulosDo(vinc, caps) : [];
            if (!lista.length) { el.remove(); return; }

            el.innerHTML = `
                <div class="detail-section">
                    <div class="detail-section-title">📖 Livro vinculado</div>
                    ${livro.description ? `<div class="detail-section-text">${esc(livro.description)}</div>` : ''}
                    <button type="button" class="btn" style="margin-top:10px;font-weight:700"
                        onclick="window.lvAbrirLivro(${idx})">
                        📖 Abrir livro “${esc(livro.title || 'Sem título')}”
                    </button>
                    <div style="font-size:.78rem;opacity:.7;margin-top:6px">
                        ${lista.length} ${lista.length === 1 ? 'capítulo disponível' : 'capítulos disponíveis'} para leitura
                    </div>
                </div>`;
        }).catch(e => console.error('📖 Livro vinculado:', e));

        return `<div id="${slot}"></div>`;
    }

    /* ===== Leitor (por cima de qualquer modal já aberto) ===== */

    function _caixa() {
        let ov = document.getElementById('lvLeitor');
        if (ov) return ov.querySelector('.lv-box');
        ov = document.createElement('div');
        ov.id = 'lvLeitor';
        ov.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.78);display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow:auto';
        ov.innerHTML = `<div class="lv-box" style="background:var(--bg-card,#161616);color:var(--text,#eee);border:1px solid var(--soft,#333);border-radius:12px;max-width:820px;width:100%;padding:28px 24px;position:relative"></div>`;
        ov.addEventListener('click', (e) => { if (e.target === ov) ov.remove(); });
        document.body.appendChild(ov);
        return ov.querySelector('.lv-box');
    }

    function _pintar(html) {
        const box = _caixa();
        box.innerHTML = `
            <button type="button" style="position:absolute;top:10px;right:12px;background:none;border:none;color:var(--muted,#999);font-size:1.3rem;cursor:pointer;line-height:1"
                onclick="document.getElementById('lvLeitor').remove()" title="Fechar">✕</button>
            ${html}`;
        document.getElementById('lvLeitor').scrollTop = 0;
    }

    /** Abre o livro: um capítulo vai direto ao texto, vários abrem o sumário. */
    function abrirLivro(idx) {
        const vinc = _vinculos[idx];
        if (!vinc) return;
        carregar().then(({ livros, caps }) => {
            const livro = livros.find(l => l.id === vinc.bookId);
            const lista = livro ? capitulosDo(vinc, caps) : [];
            if (!lista.length) return;
            if (lista.length === 1) return lerCapitulo(lista[0].id);

            _pintar(`
                <div style="font-size:.8rem;opacity:.7;margin-bottom:4px">📖 Livro</div>
                <h2 style="margin:0 0 8px">${esc(livro.title || 'Sem título')}</h2>
                ${livro.description ? `<p style="opacity:.8;font-style:italic;margin:0 0 18px">${esc(livro.description)}</p>` : ''}
                <div style="font-size:.8rem;text-transform:uppercase;letter-spacing:.06em;opacity:.7;margin-bottom:8px">Sumário</div>
                <div style="display:flex;flex-direction:column;gap:6px">
                    ${lista.map((c, i) => `
                        <button type="button" onclick="window.lvLerCapitulo('${esc(c.id)}', ${idx})"
                            style="display:flex;align-items:baseline;gap:10px;width:100%;text-align:left;cursor:pointer;
                                   background:var(--bg,rgba(255,255,255,.03));color:inherit;font:inherit;
                                   border:1px solid var(--soft,#333);border-radius:8px;padding:10px 12px">
                            <span style="opacity:.6;min-width:1.6em">${i + 1}.</span>
                            <span style="flex:1">${esc(c.title || 'Sem título')}</span>
                            <span style="opacity:.6">›</span>
                        </button>`).join('')}
                </div>`);
        }).catch(e => console.error('📖 Livro vinculado:', e));
    }

    /** Abre um capítulo. Com `voltarIdx`, ganha o botão de volta ao sumário. */
    function lerCapitulo(capId, voltarIdx) {
        carregar().then(({ livros, caps }) => {
            const cap = caps.find(c => c.id === capId);
            if (!cap) return;
            const livro = livros.find(l => l.id === cap.bookId);

            _pintar(`
                ${voltarIdx !== undefined ? `
                    <button type="button" onclick="window.lvAbrirLivro(${voltarIdx})"
                        style="background:none;border:none;color:inherit;opacity:.75;font:inherit;cursor:pointer;padding:0;margin-bottom:10px">
                        ← Sumário
                    </button>` : ''}
                ${livro ? `<div style="font-size:.8rem;opacity:.7;margin-bottom:4px">📗 ${esc(livro.title || '')}</div>` : ''}
                <h2 style="margin:0 0 8px">${esc(cap.title || 'Sem título')}</h2>
                ${cap.synopsis ? `<p style="opacity:.8;font-style:italic;margin:0 0 16px">${esc(cap.synopsis)}</p>` : ''}
                <div class="texto-mundo">${cap.contentHTML || '<p><em>Capítulo ainda sem conteúdo.</em></p>'}</div>`);
        }).catch(e => console.error('📖 Leitura do capítulo:', e));
    }

    // ESC fecha só a leitura — na captura, para o modal de detalhes que está
    // atrás não fechar junto com ela.
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        const ov = document.getElementById('lvLeitor');
        if (!ov) return;
        ov.remove();
        e.stopPropagation();
    }, true);

    window.lvSecaoHTML = secaoHTML;
    window.lvAbrirLivro = abrirLivro;
    window.lvLerCapitulo = lerCapitulo;
    window.lvCarregarLivros = carregar;
    // Injeta o acervo pronto no lugar da ida ao Firestore — usado pelo
    // harness __check-livro-vinculado.html (rodar sem login).
    window.lvSeedLivros = (dados) => { _p = Promise.resolve(dados); };
})();
