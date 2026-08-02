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
                        ${lista.length} ${lista.length === 1 ? 'capítulo disponível' : 'capítulos disponíveis'} para leitura
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

    /* ===== Leitor (por cima de qualquer modal já aberto) ===== */

    function _caixa() {
        let ov = document.getElementById('lvLeitor');
        if (ov) return ov.querySelector('.lv-box');
        ov = document.createElement('div');
        ov.id = 'lvLeitor';
        ov.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.78);display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow:auto';
        ov.innerHTML = `<div class="lv-box" style="background:var(--lr-surface,#161616);color:var(--lr-text-1,#eee);border:1px solid var(--lr-border,#333);border-radius:12px;max-width:820px;width:100%;padding:28px 24px;position:relative"></div>`;
        ov.addEventListener('click', (e) => { if (e.target === ov) fechar(); });
        document.body.appendChild(ov);
        return ov.querySelector('.lv-box');
    }

    /* Fechar limpa a trilha de volta: senão o "← Biblioteca" de uma leitura
       futura apontaria para a estante da vez anterior. */
    function fechar() {
        const ov = document.getElementById('lvLeitor');
        if (ov) ov.remove();
        _bib = null; _sum = null; _repintar = null;
    }

    function _pintar(html) {
        const box = _caixa();
        box.innerHTML = `
            <button type="button" style="position:absolute;top:10px;right:12px;background:none;border:none;color:var(--lr-text-2,#999);font-size:1.3rem;cursor:pointer;line-height:1"
                onclick="window.lvFechar()" title="Fechar">✕</button>
            ${html}`;
        document.getElementById('lvLeitor').scrollTop = 0;
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

    /** Sumário do livro. Livro de um capítulo só pula direto para o texto. */
    function abrirSumario(vinc) {
        if (!vinc) return;
        _repintar = () => abrirSumario(vinc);
        carregar().then(({ livros, caps }) => {
            const livro = livros.find(l => l.id === vinc.bookId);
            const lista = livro ? capitulosDo(vinc, caps) : [];
            if (!lista.length) return;
            // um capítulo só: sem sumário, e o "voltar" (se houver) é a estante
            if (lista.length === 1) { _sum = null; return lerCapitulo(lista[0].id); }
            _sum = vinc;

            _pintar(`
                ${_bib ? _btnVoltar(_bib.titulo || 'Biblioteca', 'bib') : ''}
                <div style="font-size:.8rem;opacity:.7;margin-bottom:4px">📖 Livro</div>
                <h2 style="margin:0 0 8px">${esc(livro.title || 'Sem título')}</h2>
                ${livro.description ? `<p style="opacity:.8;font-style:italic;margin:0 0 18px">${esc(livro.description)}</p>` : ''}
                <div style="font-size:.8rem;text-transform:uppercase;letter-spacing:.06em;opacity:.7;margin-bottom:8px">Sumário</div>
                <div style="display:flex;flex-direction:column;gap:6px">
                    ${lista.map((c, i) => `
                        <div style="display:flex;align-items:center;gap:6px">
                            <button type="button" class="lv-cap" onclick="window.lvLerCapitulo('${esc(c.id)}')"
                                style="display:flex;align-items:baseline;gap:10px;flex:1;min-width:0;text-align:left;cursor:pointer;
                                       background:var(--lr-surface-2,rgba(255,255,255,.06));color:inherit;font:inherit;
                                       border:1px solid var(--lr-border,#333);border-radius:8px;padding:10px 12px">
                                <span style="opacity:.6;min-width:1.6em">${i + 1}.</span>
                                <span style="flex:1">${esc(c.title || 'Sem título')}</span>
                                <span style="opacity:.6">›</span>
                            </button>
                            ${(_bib && _bib.acaoCapitulo) ? _bib.acaoCapitulo(c) : ''}
                        </div>`).join('')}
                </div>`);
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
                ${livro ? `<div style="font-size:.8rem;opacity:.7;margin-bottom:4px">📗 ${esc(livro.title || '')}</div>` : ''}
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
     * Estante de livros. `filtro(livro)` escolhe quais entram (publicação —
     * ver shared/livros-pub.js) e `acaoCapitulo(cap)` pendura um botão extra
     * em cada capítulo (o "Exibir na mesa" do tabuleiro).
     */
    function biblioteca(opts) {
        _bib = opts || {};
        _sum = null;
        _repintar = () => biblioteca(_bib);
        _pintar('<div style="opacity:.7;padding:10px 0">Carregando a estante…</div>');
        carregar().then(({ livros, caps }) => {
            const lista = livros
                .filter(l => !_bib.filtro || _bib.filtro(l))
                .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.title || '').localeCompare(b.title || ''));
            const cards = lista.map(l => {
                const n = caps.filter(c => c.bookId === l.id).length;
                return `
                <button type="button" class="lv-livro" onclick="window.lvAbrirLivroId('${esc(l.id)}')"
                    style="display:flex;align-items:center;gap:12px;width:100%;text-align:left;cursor:pointer;
                           background:var(--lr-surface-2,rgba(255,255,255,.06));color:inherit;font:inherit;
                           border:1px solid var(--lr-border,#333);border-radius:10px;padding:10px 12px">
                    <span style="width:44px;height:60px;flex:none;border-radius:6px;display:flex;align-items:center;justify-content:center;
                        background:${l.cover ? `url('${esc(l.cover)}') center/cover` : 'var(--lr-bg-1,rgba(255,255,255,.06))'}">${l.cover ? '' : '📖'}</span>
                    <span style="flex:1;min-width:0">
                        <span style="display:block;font-weight:700">${esc(l.title || 'Livro sem título')}</span>
                        ${l.description ? `<span style="display:block;opacity:.75;font-size:.85rem">${esc(l.description)}</span>` : ''}
                        <span style="display:block;opacity:.6;font-size:.78rem">${n} ${n === 1 ? 'capítulo' : 'capítulos'}</span>
                    </span>
                    <span style="opacity:.6">›</span>
                </button>`;
            }).join('');
            _pintar(`
                <h2 style="margin:0 0 14px">${esc(_bib.titulo || '📚 Biblioteca')}</h2>
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
