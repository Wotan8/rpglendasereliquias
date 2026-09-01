/* ═══════════════════════════════════════════════════════════
   wb-editor.js — Escritório do Cronista
   ─────────────────────────────────────
   Área do ESCRITOR. Duas telas:

   • 📚 BIBLIOTECA — estantes com LIVROS (cada um com seus
     capítulos/contos) + uma prateleira de TEXTOS AVULSOS.
     Mostra status público/privado, nº de capítulos e palavras.

   • ✒️ ESCRITA — editor rich-text com:
       – título, sinopse, livro/ordem, público, status;
       – painel de consulta com as fichas REAIS do ecossistema;
       – @menções que linkam NPCs, Tribos, Locais, eventos…;
       – autosave + modo foco.

   Coleções:
     worldbuilding-books      → livros (agrupam capítulos)
     worldbuilding-articles   → capítulos/contos/textos
     worldbuilding-settings/estantes → lista de estantes (um doc só)
   ═══════════════════════════════════════════════════════════ */

import { db, collection, getDocs, doc, getDoc, setDoc, deleteDoc, updateDoc } from './firebase-config.js';
import { WB, esc, uid, ToolModal, setTitle, contentBody, searchables, KIND, poolOf } from './wb-utils.js';
import { dossieHTML } from './wb-dossie.js';
import { TOOLBAR_HTML, bindRich } from './wb-rich.js';
import { PUBLICACOES, pubDoLivro, versaoDoLivro } from '../../shared/livros-pub.js';
import { ESTILO_CAMPOS, FONTES, estiloDoLivro, estiloInline, estiloDoLivro_obj } from '../../shared/livro-estilo.js';
import { proximaVersao, mesmaVersao } from '../../shared/versao-canone.js';
import { alvos, avisoDeVersao, enviarAviso } from '../../shared/avisar-livro.js';
import { camposDe, resolverCampos, carregadorPadrao, FONTES_CAMPO } from '../../shared/campo-vinculado.js';
import { confirmar, toast } from '../../shared/dialogo.js?v=2';

export const Editor = (() => {
    let books = [], artigos = [], estantes = [], lixeira = [], atual = null;
    let rich = null;   // mesa de diagramação (wb-rich.js) do editor aberto
    let mentionRange = null, mentionIdx = 0, saveTimer = null, refType = 'all';
    let view = 'library';   // 'library' | 'editor'
    let modo = 'escrita';   // 'escrita' | 'leitura' — vale para toda a sessão
    let busca = '', fstatus = '';   // filtros da Biblioteca
    let sujo = false;               // há texto digitado que ainda não foi gravado
    /* Ligado por padrão: perder texto e pior que gravar demais, e quem
       desliga fez isso de propósito. A escolha vale para as proximas
       sessoes — reativar sozinho seria desfazer a decisao do autor.
       O valor vem do localStorage logo abaixo, quando `guardado()` existe. */
    const CHAVE_AUTO = 'wb-cronista-autosave';
    let autoSalva = true;

    const $ = (s) => document.querySelector(s);
    const now = () => Date.now();
    const wordCount = (html) => {
        const txt = (html || '').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ');
        const m = txt.trim().match(/\S+/g);
        return m ? m.length : 0;
    };
    /* `words` é gravado a cada save(). Recontar o HTML de todos os artigos a
       cada render da Biblioteca custava caro à toa — só o doc antigo, que
       nunca passou por um save novo, ainda paga a conta. */
    const palavrasDe = (a) => a.words ?? wordCount(a.contentHTML);
    const fmtDate = (ts) => ts ? new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

    /* localStorage some em aba anônima e estoura com site data bloqueado —
       lembrar estante aberta é conforto, não pode derrubar o Escritório. */
    const guardado = (chave, alt) => { try { return JSON.parse(localStorage.getItem(chave)) ?? alt; } catch { return alt; } };
    const guardar = (chave, v) => { try { localStorage.setItem(chave, JSON.stringify(v)); } catch { /* sem memória, paciência */ } };
    autoSalva = guardado(CHAVE_AUTO, true) !== false;

    /* ── Arquivos de apoio (histórico e lixeira) ───────────────
       Os dois moram em `worldbuilding-settings`, um doc cada, porque a regra
       do Firestore para essa coleção já é curinga (`{settingId}`, escrita só
       do mestre). Subcoleção nova exigiria mexer em firestore.rules, e o
       texto de um capítulo não vale uma regra nova.

       Documento do Firestore tem teto de 1 MB, e capítulo longo passa de
       100 KB. Toda lista guardada aqui é aparada por TAMANHO, não só por
       contagem: guarda do mais novo para o mais velho até estourar o teto.
       Isso é um teto real e não um palpite — passar dele, o write falha. */
    const TETO_DOC = 700_000;   // ~70% de 1 MB, folga para o resto do doc
    const aparar = (lista, maxItens) => {
        const out = []; let bytes = 0;
        for (const it of lista.slice(0, maxItens)) {
            bytes += JSON.stringify(it).length;
            if (bytes > TETO_DOC && out.length) break;
            out.push(it);
        }
        return out;
    };
    const lerApoio = async (docId, campo) => {
        try {
            const s = await getDoc(doc(db, 'worldbuilding-settings', docId));
            return s.exists() ? (s.data()[campo] || []) : [];
        } catch (e) { console.warn('[editor] apoio', docId, e); return []; }
    };
    const gravarApoio = (docId, campo, lista) =>
        setDoc(doc(db, 'worldbuilding-settings', docId), { [campo]: lista });

    async function loadAll() {
        try {
            const [bSnap, aSnap, eSnap, lix] = await Promise.all([
                getDocs(collection(db, 'worldbuilding-books')),
                getDocs(collection(db, 'worldbuilding-articles')),
                getDoc(doc(db, 'worldbuilding-settings', 'estantes')),
                lerApoio('lixeira', 'itens'),
            ]);
            books = bSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            artigos = aSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            estantes = eSnap.exists() ? (eSnap.data().lista || []) : [];
            lixeira = lix;
        } catch (e) { console.warn('[editor] load', e); books = books || []; artigos = artigos || []; estantes = estantes || []; }
    }

    /* ── Estantes ──────────────────────────────────────────────
       Todas num doc só (como o mural). A estante padrão é virtual:
       lista TODOS os livros, e é onde o livro sem estante aparece. */
    const ESTANTE_TODAS = '__todas';
    const CHAVE_ABERTAS = 'wb-cronista-estantes-abertas';
    let abertas = new Set(guardado(CHAVE_ABERTAS, []));
    const salvarEstantes = () => setDoc(doc(db, 'worldbuilding-settings', 'estantes'), { lista: estantes });
    /* Um livro pode estar em várias estantes. `estanteId` (uma só) é o
       formato legado — quando `estanteIds` existe, é ele que manda. */
    const estantesDoLivro = (b) => b.estanteIds || (b.estanteId ? [b.estanteId] : []);
    const livrosDaEstante = (id) => ordenados(id === ESTANTE_TODAS ? books : books.filter(b => estantesDoLivro(b).includes(id)));
    const ordenados = (arr) => arr.slice()
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (b.updatedAt ?? 0) - (a.updatedAt ?? 0));

    /* Capítulos de um livro, na ordem definida. */
    const chaptersOf = (bookId) =>
        artigos.filter(a => a.bookId === bookId)
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.createdAt ?? 0) - (b.createdAt ?? 0));
    const loose = () => artigos.filter(a => !a.bookId)
        .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));

    /* ── Filtros da Biblioteca ─────────────────────────────────
       Uma busca de texto e um status. A regra é uma só: o LIVRO aparece se
       ele mesmo casar com a busca, ou se sobrar algum capítulo dele depois
       do filtro. Quando o livro casa pelo próprio título, os capítulos dele
       não precisam casar de novo — quem procurou o livro quer o livro. */
    const filtrando = () => !!(busca || fstatus);
    const bate = (...campos) => !busca || campos.some(c => String(c || '').toLowerCase().includes(busca));
    const statusPassa = (a) => !fstatus
        || (fstatus === 'privado' ? !a.public : (a.status || 'rascunho') === fstatus);
    const capsVisiveis = (b) => chaptersOf(b.id)
        .filter(a => statusPassa(a) && (bate(b.title, b.description) || bate(a.title, a.synopsis)));
    const livrosVisiveis = (id) => livrosDaEstante(id).filter(b =>
        !filtrando() || capsVisiveis(b).length > 0 || (!fstatus && bate(b.title, b.description)));
    const avulsosVisiveis = () => loose().filter(a => statusPassa(a) && bate(a.title, a.synopsis));

    const pubBadge = (isPub) => isPub
        ? '<span class="wb-badge wb-badge--pub">🌐 Público</span>'
        : '<span class="wb-badge wb-badge--priv">🔒 Privado</span>';
    /* Livro tem quatro publicações (shared/livros-pub.js) — o selo mostra as marcadas. */
    const pubBadgesLivro = (b) => {
        const p = pubDoLivro(b);
        const selos = PUBLICACOES.filter(([k]) => p[k])
            .map(([, label]) => `<span class="wb-badge wb-badge--pub">${label.replace('Publicar ', '')}</span>`);
        return selos.join(' ') || '<span class="wb-badge wb-badge--priv">🔒 Não publicado</span>';
    };
    /* Selo de versão — vem primeiro na fila de badges, e some se o autor
       não escreveu versão nenhuma (ver shared/livros-pub.js). */
    const seloVersao = (b) => {
        const v = versaoDoLivro(b);
        return v ? `<span class="wb-badge wb-badge--ver" title="Versão do livro">🔖 ${esc(v)}</span> ` : '';
    };
    const statusBadge = (st) => {
        const map = { rascunho: ['✏️ Rascunho', 'draft'], revisao: ['🔍 Em revisão', 'rev'], publicado: ['✅ Publicado', 'done'] };
        const [label, cls] = map[st] || map.rascunho;
        return `<span class="wb-badge wb-badge--${cls}">${label}</span>`;
    };

    /* ══════════════ BIBLIOTECA ══════════════ */
    function renderLibrary() {
        view = 'library';
        setTitle('📚 Escritório do Cronista');
        document.body.classList.remove('wbt-focus');

        const totalPalavras = artigos.reduce((s, a) => s + palavrasDe(a), 0);
        const avulsos = avulsosVisiveis();
        const ativo = filtrando();
        /* Com filtro ligado, a estante vazia só ocuparia espaço dizendo nada. */
        const comLivros = (id) => { const l = livrosVisiveis(id); return ativo && !l.length ? null : l; };
        const achados = ativo
            ? new Set([...livrosVisiveis(ESTANTE_TODAS).flatMap(b => capsVisiveis(b).map(a => a.id)), ...avulsos.map(a => a.id)]).size
            : 0;

        contentBody().innerHTML = `
        <div class="wb-library">
            <div class="wb-lib-toolbar">
                <div class="wb-lib-stats">
                    <span><b>${books.length}</b> livros</span>
                    <span><b>${artigos.length}</b> textos</span>
                    <span><b>${totalPalavras.toLocaleString('pt-BR')}</b> palavras</span>
                </div>
                <span style="flex:1"></span>
                <button class="btn btn-secondary btn-sm" id="newEstante">🗂️ Nova estante</button>
                <button class="btn btn-secondary btn-sm" id="newLoose">📄 Novo texto avulso</button>
                <button class="btn btn-success btn-sm" id="newBook">📗 Novo livro</button>
            </div>

            <div class="wb-lib-filtros">
                <input id="libBusca" class="form-input wb-lib-busca" type="search" autocomplete="off"
                       placeholder="🔎 Buscar livro ou capítulo…" value="${esc(busca)}">
                <div class="wbt-chips" id="libStatus">
                    ${[['', 'Tudo'], ['rascunho', '✏️ Rascunho'], ['revisao', '🔍 Revisão'],
                       ['publicado', '✅ Publicado'], ['privado', '🔒 Privado']].map(([v, l]) =>
                        `<button type="button" class="wbt-chip ${fstatus === v ? 'is-active' : ''}" data-fst="${v}">${l}</button>`).join('')}
                </div>
                ${ativo ? `<button class="btn btn-secondary btn-sm" id="libLimpar" title="Limpar busca e filtro">✕ Limpar</button>
                    <span class="wbt-muted">${achados} ${achados === 1 ? 'texto' : 'textos'}</span>` : ''}
            </div>

            <h3 class="wb-lib-section">📚 Biblioteca</h3>
            <div class="wb-estantes">
                ${estanteHTML({ id: ESTANTE_TODAS, nome: 'Todos os livros', icone: '📚' },
                    comLivros(ESTANTE_TODAS),
                    'Nenhum livro ainda. Crie um livro para agrupar capítulos e contos.')}
                ${estantes.map(e => estanteHTML(e, comLivros(e.id),
                    'Estante vazia. Escolha esta estante no ⚙️ do livro.')).join('')}
                ${(ativo && !avulsos.length) ? '' : estanteHTML({ id: '__avulsos', nome: 'Textos avulsos', icone: '📄' }, avulsos,
                    'Nenhum texto avulso. Bons textos avulsos podem virar capítulos depois.',
                    (lista) => `<div class="wb-loose-list">${lista.map(a => articleRow(a)).join('')}</div>`)}
                ${(ativo || !lixeira.length) ? '' : estanteHTML({ id: '__lixeira', nome: 'Lixeira', icone: '🗑️' }, lixeira, '',
                    (lista) => `<div class="wb-loose-list">${lista.map(lixoRow).join('')}</div>
                        <p class="wbt-muted wb-bkhint">Guarda os ${LIXO_MAX} últimos, ou o que couber no doc. Textos mais antigos caem sozinhos.
                        <button class="btn btn-danger btn-sm" id="libEsvaziar">Esvaziar lixeira</button></p>`)}
            </div>
            ${ativo && !achados ? '<p class="wbt-empty">Nada casou com a busca. Tente outra palavra ou limpe o filtro.</p>' : ''}
        </div>`;

        bindLibrary();
    }

    /* Bloco compacto de estante: fechada ocupa um tijolinho na grade,
       aberta toma a largura toda e mostra os livros. Puro <details>.
       O ⚙️ fica FORA do <summary> — dentro dele, todo clique abria a
       estante junto. Ele flutua no canto do cabeçalho (CSS).

       `lista` null = estante que o filtro esvaziou, nem desenha. Aberta se o
       autor a deixou aberta da última vez, ou sempre que há filtro ligado —
       buscar e receber uma fileira de estantes fechadas não seria busca. */
    function estanteHTML(e, lista, vazioMsg, render = (l) => l.map(bookCard).join('')) {
        if (!lista) return '';
        const fixa = [ESTANTE_TODAS, '__avulsos', '__lixeira'].includes(e.id);   // sem ⚙️: nao se renomeia nem se exclui
        const corpo = lista.length ? render(lista) : `<p class="wbt-muted">${vazioMsg}</p>`;
        return `
        <div class="wb-estante" data-estante="${esc(e.id)}">
            <details class="wb-estante__det" ${abertas.has(e.id) || filtrando() ? 'open' : ''}>
                <summary class="wb-estante__head">
                    <span class="wb-estante__caret">▸</span>
                    <span class="wb-estante__icon">${esc(e.icone || '🗂️')}</span>
                    <span class="wb-estante__name">${esc(e.nome || 'Estante sem nome')}</span>
                    <span class="wb-badge wb-badge--soft">${lista.length}</span>
                </summary>
                <div class="wb-estante__body">${corpo}</div>
            </details>
            ${fixa ? '' : `<button class="btn btn-secondary btn-sm wb-estante__cog" data-editestante="${esc(e.id)}" title="Renomear ou excluir a estante">⚙️</button>`}
        </div>`;
    }

    /* ══════════════ ESTANTE (modal) ══════════════ */
    function openEstanteModal(est = null) {
        const e = est || { id: uid('est'), nome: '', icone: '🗂️' };
        ToolModal.open(`
            <h2>${est ? '⚙️ Editar estante' : '🗂️ Nova estante'}</h2>
            <div class="wbt-form">
                <label>Nome da estante <input id="esNome" class="form-input" value="${esc(e.nome || '')}" placeholder="Ex: Regras do sistema"></label>
                <label>Ícone <input id="esIcone" class="form-input" value="${esc(e.icone || '')}" maxlength="4" placeholder="🗂️" style="width:90px"></label>
                <div class="wbt-muted" style="font-size:.8rem">
                    O livro entra na estante pelas configurações dele (⚙️ no livro), e pode
                    estar em várias ao mesmo tempo. Livro sem estante aparece só em “Todos os livros”.
                </div>
                <div class="wbt-actions">
                    ${est ? '<button class="btn btn-danger" id="esDel">🗑️ Excluir estante</button>' : ''}
                    <button class="btn btn-success" id="esSave">💾 Salvar estante</button>
                </div>
            </div>`);
        $('#esSave').onclick = async () => {
            e.nome = $('#esNome').value.trim() || 'Estante sem nome';
            e.icone = $('#esIcone').value.trim() || '🗂️';
            if (!estantes.find(x => x.id === e.id)) estantes.push(e);
            await salvarEstantes();
            ToolModal.close(); renderLibrary();
        };
        const del = $('#esDel');
        if (del) del.onclick = async () => {
            const n = livrosDaEstante(e.id).length;
            if (!await confirmar(`Excluir a estante "${e.nome}"?${n ? `\nOs ${n} livros NÃO serão apagados — continuam nas outras estantes em que estejam, e em "Todos os livros".` : ''}`, { perigo: true })) return;
            estantes = estantes.filter(x => x.id !== e.id);
            await salvarEstantes();
            ToolModal.close(); renderLibrary();
        };
    }

    function bookCard(b) {
        const todos = chaptersOf(b.id);
        const caps = filtrando() ? capsVisiveis(b) : todos;
        const palavras = todos.reduce((s, a) => s + palavrasDe(a), 0);
        /* O número do capítulo é o do SUMÁRIO, não o da lista filtrada: achar
           "cap. 1" quando na verdade é o sétimo do livro seria mentira. */
        const capsHtml = caps.length
            ? caps.map(a => articleRow(a, todos.indexOf(a) + 1)).join('')
            : '<p class="wbt-muted" style="margin:.4rem .2rem">Sem capítulos ainda.</p>';
        return `
        <details class="wb-book" data-book="${b.id}" ${filtrando() ? 'open' : ''}>
            <summary class="wb-book__head">
                <span class="wb-book__caret">▸</span>
                <div class="wb-book__cover" style="${b.cover ? `background-image:url('${esc(b.cover)}')` : ''}"
                     ${b.cover ? `data-zoom="${esc(b.cover)}" data-zoom-alt="${esc(b.title || '')}" title="Ver a capa maior"` : ''}>${b.cover ? '' : '📖'}</div>
                <div class="wb-book__meta">
                    <div class="wb-book__title">${esc(b.title || 'Livro sem título')}</div>
                    <div class="wb-book__badges">${seloVersao(b)}${pubBadgesLivro(b)} <span class="wb-badge wb-badge--soft">${filtrando() && caps.length !== todos.length ? caps.length + ' de ' + todos.length : todos.length} cap.</span> <span class="wb-badge wb-badge--soft">${palavras.toLocaleString('pt-BR')} palavras</span></div>
                    ${b.description ? `<p class="wb-book__desc">${esc(b.description)}</p>` : ''}
                </div>
                <div class="wb-book__actions">
                    <button class="btn btn-secondary btn-sm" data-editbook="${b.id}" title="Editar livro">⚙️</button>
                    <button class="btn btn-secondary btn-sm" data-dupbook="${b.id}" title="Duplicar o livro e os capítulos dele">⧉</button>
                    <button class="btn btn-secondary btn-sm" data-addchap="${b.id}" title="Novo capítulo">＋ cap.</button>
                </div>
            </summary>
            <div class="wb-book__chapters">${capsHtml}</div>
        </details>`;
    }

    function articleRow(a, num) {
        const palavras = palavrasDe(a);
        return `
        <div class="wb-chapter" data-openart="${a.id}">
            <span class="wb-chapter__num">${num ? num : '—'}</span>
            <div class="wb-chapter__body">
                <div class="wb-chapter__title">${esc(a.title || 'Sem título')}</div>
                ${a.synopsis ? `<div class="wb-chapter__syn">${esc(a.synopsis)}</div>` : ''}
                <div class="wb-chapter__meta">${statusBadge(a.status)} ${pubBadge(a.public)} <span class="wbt-muted">${palavras} palavras · ${fmtDate(a.updatedAt)}</span></div>
            </div>
            <button class="btn btn-secondary btn-sm" data-dupart="${a.id}" title="Duplicar este texto">⧉</button>
            <button class="btn btn-secondary btn-sm" data-delart="${a.id}" title="Mandar para a lixeira">🗑️</button>
        </div>`;
    }

    /* Linha da lixeira: sem clique para abrir — o texto não existe mais em
       `worldbuilding-articles`, e abrir o editor em cima de um fantasma
       gravaria o doc de volta pela porta dos fundos. Resgate primeiro. */
    function lixoRow(it) {
        const livro = books.find(b => b.id === it.bookId);
        return `
        <div class="wb-chapter is-lixo">
            <span class="wb-chapter__num">🗑️</span>
            <div class="wb-chapter__body">
                <div class="wb-chapter__title">${esc(it.title || 'Sem título')}</div>
                <div class="wb-chapter__meta">
                    <span class="wb-badge wb-badge--soft">${livro ? '📗 ' + esc(livro.title || '') : '📄 avulso'}</span>
                    <span class="wbt-muted">${palavrasDe(it)} palavras · apagado em ${fmtDate(it.apagadoEm)}</span>
                </div>
            </div>
            <button class="btn btn-secondary btn-sm" data-restlix="${it.id}" title="Devolver para a Biblioteca">↩ Resgatar</button>
            <button class="btn btn-secondary btn-sm" data-dellix="${it.id}" title="Apagar de vez">✕</button>
        </div>`;
    }

    /* ── Lixeira ───────────────────────────────────────────────
       O texto SAI mesmo de `worldbuilding-articles` — a cópia de segurança
       fica no doc de apoio. Marcar `arquivado: true` e deixar o doc onde
       está seria menos código aqui e uma armadilha lá fora: são SEIS telas
       que leem essa coleção por conta própria (ficha, Tabuleiro, Painel do
       Criador, Laboratorium, Cronista público, leitor compartilhado), e
       esquecer uma faria um capítulo "excluído" continuar na ficha de um
       jogador. Excluído é excluído para todo mundo; o resgate é aqui. */
    const LIXO_MAX = 40;
    async function paraLixeira(a) {
        lixeira = aparar([{ ...a, apagadoEm: now(), apagadoPor: WB().user?.email || '' }, ...lixeira], LIXO_MAX);
        await gravarApoio('lixeira', 'itens', lixeira);
        await deleteDoc(doc(db, 'worldbuilding-articles', a.id));
        artigos = artigos.filter(x => x.id !== a.id);
    }
    async function restaurarDaLixeira(id) {
        const it = lixeira.find(x => x.id === id); if (!it) return;
        const { apagadoEm, apagadoPor, ...a } = it;
        // O livro pode ter sido excluído nesse meio-tempo: volta como avulso.
        if (a.bookId && !books.some(b => b.id === a.bookId)) a.bookId = null;
        await gravarArtigo(a);
        lixeira = lixeira.filter(x => x.id !== id);
        await gravarApoio('lixeira', 'itens', lixeira);
        renderLibrary();
    }

    /* ── Duplicar ──────────────────────────────────────────────
       A cópia nasce SEMPRE despublicada. Duplicar é para rascunhar em
       cima de algo pronto; herdar 🌐 do original colocaria no ar um texto
       que ninguém escreveu ainda. */
    const nomeCopia = (t) => `${t || 'Sem título'} (cópia)`;
    async function gravarArtigo(a) {
        const { id, ...data } = a;
        await setDoc(doc(db, 'worldbuilding-articles', id), data);
        artigos.push(a);
    }
    async function duplicarArtigo(orig, bookId = orig.bookId) {
        const copia = {
            ...orig, id: uid('art'), title: nomeCopia(orig.title),
            bookId, order: chaptersOf(bookId).length,
            status: 'rascunho', public: false,
            createdAt: now(), updatedAt: now(), updatedBy: WB().user?.email || '',
        };
        await gravarArtigo(copia);
        return copia;
    }
    async function duplicarLivro(orig) {
        const caps = chaptersOf(orig.id);
        if (!await confirmar(`Duplicar "${orig.title}"?${caps.length ? `\nOs ${caps.length} capítulos vêm junto.` : ''}\nA cópia nasce como rascunho, sem publicação nenhuma.`)) return;
        const novo = {
            ...orig, id: uid('book'), title: nomeCopia(orig.title),
            order: books.length, versao: '', public: false,
            pub: Object.fromEntries(PUBLICACOES.map(([k]) => [k, false])),
            createdAt: now(), updatedAt: now(), updatedBy: WB().user?.email || '',
        };
        const { id, ...data } = novo;
        await setDoc(doc(db, 'worldbuilding-books', id), data);
        books.push(novo);
        for (const a of caps) await duplicarArtigo(a, novo.id);
        renderLibrary();
    }

    function bindLibrary() {
        $('#newBook').onclick = () => openBookModal(null);
        $('#newLoose').onclick = () => openArticle(null, null);
        $('#newEstante').onclick = () => openEstanteModal(null);
        contentBody().querySelectorAll('[data-editestante]').forEach(b =>
            b.onclick = () => openEstanteModal(estantes.find(x => x.id === b.dataset.editestante)));
        // preventDefault: dentro do <summary>, qualquer clique abre/fecha o livro.
        contentBody().querySelectorAll('[data-editbook]').forEach(b =>
            b.onclick = (e) => { e.preventDefault(); e.stopPropagation(); openBookModal(books.find(x => x.id === b.dataset.editbook)); });
        contentBody().querySelectorAll('[data-addchap]').forEach(b =>
            b.onclick = (e) => { e.preventDefault(); e.stopPropagation(); openArticle(null, b.dataset.addchap); });
        contentBody().querySelectorAll('[data-dupbook]').forEach(b =>
            b.onclick = (e) => { e.preventDefault(); e.stopPropagation(); duplicarLivro(books.find(x => x.id === b.dataset.dupbook)); });
        contentBody().querySelectorAll('[data-openart]').forEach(el =>
            el.onclick = (e) => {
                if (e.target.closest('[data-delart]') || e.target.closest('[data-dupart]')) return;
                openArticle(artigos.find(x => x.id === el.dataset.openart), null);
            });
        contentBody().querySelectorAll('[data-dupart]').forEach(b =>
            b.onclick = async (e) => {
                e.stopPropagation();
                await duplicarArtigo(artigos.find(x => x.id === b.dataset.dupart));
                renderLibrary();
            });
        contentBody().querySelectorAll('[data-delart]').forEach(b =>
            b.onclick = async (e) => {
                e.stopPropagation();
                if (!await confirmar('Mandar este texto para a lixeira?\nEle sai da Biblioteca e de toda tela que mostra livros — dá para resgatar pela estante 🗑️ Lixeira.', { perigo: true })) return;
                await paraLixeira(artigos.find(x => x.id === b.dataset.delart));
                renderLibrary();
            });
        contentBody().querySelectorAll('[data-restlix]').forEach(b =>
            b.onclick = (e) => { e.stopPropagation(); restaurarDaLixeira(b.dataset.restlix); });
        contentBody().querySelectorAll('[data-dellix]').forEach(b =>
            b.onclick = async (e) => {
                e.stopPropagation();
                const it = lixeira.find(x => x.id === b.dataset.dellix);
                if (!await confirmar(`Apagar "${it?.title || 'este texto'}" de vez?\nEsta é a que não tem volta.`, { perigo: true })) return;
                lixeira = lixeira.filter(x => x.id !== b.dataset.dellix);
                await gravarApoio('lixeira', 'itens', lixeira);
                renderLibrary();
            });
        const esvaziar = $('#libEsvaziar');
        if (esvaziar) esvaziar.onclick = async () => {
            if (!await confirmar(`Esvaziar a lixeira?\nOs ${lixeira.length} textos somem de vez.`, { perigo: true })) return;
            lixeira = [];
            await gravarApoio('lixeira', 'itens', lixeira);
            renderLibrary();
        };

        /* Busca: re-renderiza a cada tecla e devolve o cursor onde estava —
           sem isso, digitar a segunda letra já é em outro campo. */
        const cx = $('#libBusca');
        cx.oninput = () => {
            const pos = cx.selectionStart;
            busca = cx.value.trim().toLowerCase();
            renderLibrary();
            const novo = $('#libBusca');
            novo.focus(); novo.setSelectionRange(pos, pos);
        };
        $('#libStatus').onclick = (e) => {
            const c = e.target.closest('[data-fst]'); if (!c) return;
            fstatus = c.dataset.fst === fstatus ? '' : c.dataset.fst;   // reclicar desliga
            renderLibrary();
        };
        const limpar = $('#libLimpar');
        if (limpar) limpar.onclick = () => { busca = ''; fstatus = ''; renderLibrary(); };

        /* Estante aberta/fechada sobrevive à próxima visita. Com filtro
           ligado tudo nasce aberto, e aí a marcação não vale como escolha. */
        contentBody().querySelectorAll('.wb-estante__det').forEach(d =>
            d.ontoggle = () => {
                if (filtrando()) return;
                const id = d.closest('[data-estante]').dataset.estante;
                d.open ? abertas.add(id) : abertas.delete(id);
                guardar(CHAVE_ABERTAS, [...abertas]);
            });
    }

    /* ══════════════ LIVRO (modal) ══════════════
       Três abas em vez de um rolo só: o formulário inteiro cabia em ~14
       blocos empilhados e o autor rolava para achar as publicações. As abas
       reusam o .wbt-chip que o painel de consulta já usa. */
    const STATUS_OPCOES = [['rascunho', '✏️ Rascunho'], ['revisao', '🔍 Em revisão'], ['publicado', '✅ Publicado']];
    const statusOptions = (sel) => STATUS_OPCOES
        .map(([v, l]) => `<option value="${v}" ${(sel || 'rascunho') === v ? 'selected' : ''}>${l}</option>`).join('');

    /* Uma linha da aba 📑 Capítulos. A ordem do sumário é a ordem das linhas
       no DOM — reordenar é mover o nó, não redesenhar a lista, senão cada
       arraste apagaria o status e o 🌐 que o autor acabou de mexer. */
    function linhaCapHTML(a, i) {
        return `
        <div class="wb-capedit__row" data-caprow="${a.id}" draggable="true">
            <span class="wb-capedit__pega" title="Arraste para reordenar">⠿</span>
            <input type="checkbox" class="wb-capedit__sel" data-capsel="${a.id}" aria-label="Selecionar ${esc(a.title || 'capítulo')}">
            <span class="wb-chapter__num">${i + 1}</span>
            <span class="wb-capedit__nome" title="${esc(a.title || 'Sem título')}">${esc(a.title || 'Sem título')}</span>
            <span class="wb-capedit__mudou" hidden></span>
            <span class="wb-capedit__setas">
                <button type="button" class="wbt-microbtn" data-capsobe aria-label="Subir capítulo">↑</button>
                <button type="button" class="wbt-microbtn" data-capdesce aria-label="Descer capítulo">↓</button>
            </span>
            <select class="form-select wb-capedit__st" data-capst="${a.id}">${statusOptions(a.status)}</select>
            <label class="wb-capedit__pub" title="Capítulo visível para quem já enxerga o livro">
                <input type="checkbox" data-cappub="${a.id}" ${a.public ? 'checked' : ''}> 🌐</label>
        </div>`;
    }

    /* Um controle por campo de aparência. `est` é preenchido pelo
       openBookModal antes de montar o HTML — a lista de campos mora em
       shared/livro-estilo.js, junto de quem sabe virar CSS. */
    let est = {};
    function campoEstiloHTML(c) {
        const v = String(est[c.k] ?? '');
        const dica = c.dica ? `<span class="wbt-muted wb-bkhint">${esc(c.dica)}</span>` : '';
        if (c.tipo === 'fonte') return `
            <label>${c.label}
                <select class="form-select" data-est="${c.k}">
                    ${FONTES.map(([val, nome]) => `<option value="${esc(val)}" ${val === v ? 'selected' : ''} style="font-family:${esc(val) || 'inherit'}">${esc(nome)}</option>`).join('')}
                </select>${dica}</label>`;
        if (c.tipo === 'medida') return `
            <label>${c.label} <output data-estout="${c.k}">${v ? esc(v) + (c.sufixo || '') : 'padrão'}</output>
                <input type="range" data-est="${c.k}" min="${c.min}" max="${c.max}" step="${c.passo}" value="${v || (c.min + c.max) / 2}" ${v ? '' : 'data-vazio="1"'}>
                ${dica}</label>`;
        if (c.tipo === 'cor') return `
            <label>${c.label}
                <span class="wb-estilo__cor">
                    <input type="color" data-est="${c.k}" value="${/^#[0-9a-f]{6}$/i.test(v) ? v : '#d4af37'}" ${v ? '' : 'data-vazio="1"'}>
                    <button type="button" class="wbt-microbtn" data-estlimpa="${c.k}" title="Voltar ao padrão do site">padrão</button>
                </span>${dica}</label>`;
        return `
            <label>${c.label}
                ${CampoImagem.html({ id: 'bkEst_' + c.k, classe: 'form-input', valor: v, pasta: 'worldbuilding-images/papel' })}
                ${dica}</label>`;
    }

    function openBookModal(book = null) {
        const b = book || { id: uid('book'), title: '', description: '', cover: '', public: false, order: books.length };
        est = { ...estiloDoLivro_obj(b) };
        const pub = pubDoLivro(book);   // livro novo nasce sem publicação nenhuma
        if (!book) Object.keys(pub).forEach(k => pub[k] = false);
        const caps = book ? chaptersOf(b.id) : [];
        ToolModal.open(`
            <h2>${book ? '⚙️ Editar livro' : '📗 Novo livro'}</h2>
            <div class="wbt-chips wb-bktabs" id="bkTabs">
                <button type="button" class="wbt-chip is-active" data-bktab="geral">📖 Livro</button>
                <button type="button" class="wbt-chip" data-bktab="pub">🌐 Publicação</button>
                <button type="button" class="wbt-chip" data-bktab="estilo">🎨 Aparência</button>
                ${caps.length ? `<button type="button" class="wbt-chip" data-bktab="caps">📑 Capítulos <b>${caps.length}</b></button>` : ''}
            </div>
            <div class="wbt-form wb-bkform">
                <section data-bkpanel="geral">
                    <div class="wbt-row2">
                        <label>Título do livro <input id="bkTitle" class="form-input" value="${esc(b.title)}" placeholder="Ex: Crônicas de Eldoria — Vol. I"></label>
                        <label>Versão
                            <span class="wb-versao-campo">
                                <input id="bkVersao" class="form-input" value="${esc(b.versao || '')}" placeholder="Ex: 1.02">
                                <button type="button" class="btn btn-secondary btn-sm" id="bkVersaoSobe"
                                        title="Escada do cânone: sobe um centésimo; a casa inteira só vira em .99">↑</button>
                            </span>
                            <span class="wbt-muted wb-bkhint" id="bkVersaoAviso"></span></label>
                    </div>
                    <p class="wbt-muted wb-bkhint">A versão vira selo em toda tela que lista o livro, antes de abrir.
                        Escada do cânone: <b>1.02 → 1.03 → … → 1.99 → 2.00</b>. Ao salvar com a versão mudada, dá para avisar quem tem acesso.
                        Texto livre — dá para escrever “Ed. revista”, mas aí o ↑ não sabe qual é a próxima.</p>
                    <label>Sinopse / descrição <textarea id="bkDesc" class="form-textarea" rows="3" placeholder="Do que trata este livro?">${esc(b.description || '')}</textarea></label>
                    <label>Capa do livro ${CampoImagem.html({ id: 'bkCover', classe: 'form-input', valor: b.cover || '', pasta: 'worldbuilding-images/capas' })}</label>
                    <div class="wb-bkgroup">
                        <span class="wb-bkgroup__tit">🗂️ Estantes</span>
                        ${estantes.length
                            ? `<div class="wb-bkchips">${estantes.map(e => `
                                <label class="wb-bkchip"><input type="checkbox" data-bkest="${esc(e.id)}" ${estantesDoLivro(b).includes(e.id) ? 'checked' : ''}>
                                    ${esc(e.icone || '🗂️')} ${esc(e.nome || '')}</label>`).join('')}</div>
                               <p class="wbt-muted wb-bkhint">Marque quantas quiser. Sem nenhuma, o livro fica só em “Todos os livros”.</p>`
                            : '<p class="wbt-muted wb-bkhint">Nenhuma estante criada ainda — crie uma pelo botão 🗂️ da Biblioteca.</p>'}
                    </div>
                </section>

                <section data-bkpanel="pub" hidden>
                    <div class="wb-pubgrid">
                        ${PUBLICACOES.map(([k, label, dica]) => `
                            <label class="wb-pubopt"><input type="checkbox" data-bkpub="${k}" ${pub[k] ? 'checked' : ''}>
                                <span><b>${label}</b><small>${esc(dica)}</small></span></label>`).join('')}
                    </div>
                    <p class="wbt-muted wb-bkhint">Isto vale para o LIVRO inteiro. Capítulo a capítulo, quem libera é a aba 📑 Capítulos — e quem tranca por requisito é a aba Conhecimento do Painel do Criador.</p>
                </section>

                <section data-bkpanel="estilo" hidden>
                    <div class="wb-estilo">
                        <div class="wb-estilo__campos">${ESTILO_CAMPOS.map(campoEstiloHTML).join('')}</div>
                        <div class="wb-estilo__amostra">
                            <span class="wb-bkgroup__tit">Amostra ao vivo</span>
                            <div class="texto-mundo" id="bkAmostra">
                                <h2>O Vale de Korr</h2>
                                <p class="tm-capitular">A fornalha ainda guardava brasa quando Brida empurrou a porta. O frio de fora entrou junto com ela e assentou no chão de terra batida, como um cão que conhece o lugar.</p>
                                <blockquote>Ferro não mente. Gente mente.</blockquote>
                                <hr>
                                <p>Três gerações trocaram a lança pelo malho, e ninguém de fora entrou sem convite — até o Consórcio comprar a mina.</p>
                            </div>
                        </div>
                    </div>
                    <p class="wbt-muted wb-bkhint">Vale para o livro inteiro e aparece IGUAL em toda tela que lê capítulo: ficha do jogador, Tabuleiro, Cronista público e aqui. Campo vazio = o padrão do site.
                        <button type="button" class="btn btn-secondary btn-sm" id="bkEstiloZerar">↩ Voltar ao padrão</button></p>
                </section>

                ${caps.length ? `
                <section data-bkpanel="caps" hidden>
                    <div class="wb-capbulk">
                        <label class="wbt-check"><input type="checkbox" id="capAll"> Todos</label>
                        <span class="wbt-muted" id="capSelN">nenhum selecionado</span>
                        <span style="flex:1"></span>
                        <select id="capBulkSt" class="form-select" disabled>
                            <option value="">Status…</option>
                            ${STATUS_OPCOES.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
                        </select>
                        <button type="button" class="btn btn-secondary btn-sm" data-bulkpub="1" disabled>🌐 Público</button>
                        <button type="button" class="btn btn-secondary btn-sm" data-bulkpub="0" disabled>🔒 Privado</button>
                        <select id="capBulkLivro" class="form-select" disabled title="Mover os capítulos marcados para outro livro">
                            <option value="">Mover para…</option>
                            <option value="${b.id}">↩ Continuar aqui</option>
                            ${books.filter(x => x.id !== b.id).map(x => `<option value="${x.id}">📗 ${esc(x.title || 'Sem título')}</option>`).join('')}
                            <option value="__avulso">📄 Textos avulsos</option>
                        </select>
                    </div>
                    <div class="wb-capedit">
                        ${caps.map((a, i) => linhaCapHTML(a, i)).join('')}
                    </div>
                    <p class="wbt-muted wb-bkhint" id="capAviso" hidden></p>
                    <p class="wbt-muted wb-bkhint">Arraste pelo ⠿ (ou use ↑↓) para mudar a ordem do sumário. 🌐 é o que libera o capítulo na ficha e no Tabuleiro; o status ✅ Publicado é o que solta o capítulo no Cronista público.</p>
                </section>` : ''}
            </div>
            <div class="wbt-actions">
                ${book ? '<button class="btn btn-danger" id="bkDel">🗑️ Excluir livro</button>' : ''}
                <button class="btn btn-secondary" data-close>Cancelar</button>
                <button class="btn btn-success" id="bkSave">💾 Salvar livro</button>
            </div>`);

        /* Abas */
        $('#bkTabs').onclick = (e) => {
            const t = e.target.closest('[data-bktab]'); if (!t) return;
            $('#bkTabs').querySelectorAll('.wbt-chip').forEach(c => c.classList.toggle('is-active', c === t));
            document.querySelectorAll('.wb-bkform > section')
                .forEach(s => s.hidden = s.dataset.bkpanel !== t.dataset.bktab);
        };

        /* ↑ Versão: preenche com a próxima da escada. Versão que não está na
           escada ("Ed. revista") não tem próxima — o botão diz isso em vez
           de inventar um número. */
        $('#bkVersaoSobe').onclick = () => {
            const campo = $('#bkVersao');
            const prox = proximaVersao(campo.value);
            if (!prox) {
                $('#bkVersaoAviso').textContent = '“' + campo.value.trim() + '” não está na escada 1.02 → 1.03. Escreva a próxima à mão.';
                campo.focus(); campo.select();
                return;
            }
            campo.value = prox;
            $('#bkVersaoAviso').textContent = '';
        };

        /* ── Aparência: o controle mexe em `est`, e `est` pinta a amostra ──
           A amostra é um `.texto-mundo` de verdade com o mesmo atributo que
           vai para a tela do jogador — então o que o autor vê aqui é o que
           o jogador vê lá, e não uma imitação que envelhece à parte. */
        const pintarAmostra = () => {
            const alvo = $('#bkAmostra'); if (!alvo) return;
            alvo.setAttribute('style', estiloInline({ estilo: est }));
        };
        document.querySelector('[data-bkpanel="estilo"]').addEventListener('input', (e) => {
            const el = e.target.closest('[data-est]'); if (!el) return;
            el.removeAttribute('data-vazio');
            est[el.dataset.est] = el.value;
            const campo = ESTILO_CAMPOS.find(c => c.k === el.dataset.est);
            const out = document.querySelector(`[data-estout="${el.dataset.est}"]`);
            if (out) out.textContent = el.value + (campo?.sufixo || '');
            pintarAmostra();
        });
        document.querySelectorAll('[data-estlimpa]').forEach(btn => btn.onclick = () => {
            const k = btn.dataset.estlimpa;
            delete est[k];
            document.querySelector(`[data-est="${k}"]`)?.setAttribute('data-vazio', '1');
            pintarAmostra();
        });
        $('#bkEstiloZerar').onclick = () => {
            est = {};
            document.querySelectorAll('[data-est]').forEach(el => {
                el.setAttribute('data-vazio', '1');
                if (el.tagName === 'SELECT') el.value = '';
                if (el.type === 'text' || el.type === 'url') el.value = '';
            });
            document.querySelectorAll('[data-estout]').forEach(o => o.textContent = 'padrão');
            pintarAmostra();
        };
        pintarAmostra();

        /* Ações em massa dos capítulos — valem só para o que está marcado. */
        if (caps.length) {
            const selecionados = () => [...document.querySelectorAll('[data-capsel]:checked')].map(c => c.dataset.capsel);
            const refresh = () => {
                const n = selecionados().length;
                $('#capSelN').textContent = n ? `${n} selecionado${n > 1 ? 's' : ''}` : 'nenhum selecionado';
                document.querySelectorAll('#capBulkSt, [data-bulkpub]').forEach(el => el.disabled = !n);
                $('#capAll').checked = n === caps.length;
                $('#capAll').indeterminate = n > 0 && n < caps.length;
            };
            $('#capAll').onchange = (e) => {
                document.querySelectorAll('[data-capsel]').forEach(c => c.checked = e.target.checked);
                refresh();
            };
            document.querySelector('.wb-capedit').addEventListener('change', (e) => {
                if (e.target.matches('[data-capsel]')) refresh();
            });
            $('#capBulkSt').onchange = (e) => {
                const v = e.target.value; if (!v) return;
                selecionados().forEach(id => { document.querySelector(`[data-capst="${id}"]`).value = v; });
                e.target.value = '';
            };
            document.querySelectorAll('[data-bulkpub]').forEach(btn => btn.onclick = () => {
                const on = btn.dataset.bulkpub === '1';
                selecionados().forEach(id => { document.querySelector(`[data-cappub="${id}"]`).checked = on; });
                aviso();
            });

            /* ── Mover para outro livro ────────────────────────────
               Marca a linha e só efetiva no Salvar. Sumir com a linha na
               hora tiraria do autor a chance de desistir — e ele ainda pode
               estar mexendo no status dela. */
            const lista = document.querySelector('.wb-capedit');
            const linha = (id) => document.querySelector(`[data-caprow="${id}"]`);
            $('#capBulkLivro').onchange = (e) => {
                const destino = e.target.value; if (!destino) return;
                selecionados().forEach(id => {
                    const r = linha(id), tag = r.querySelector('.wb-capedit__mudou');
                    const fica = destino === b.id;
                    r.dataset.capmove = fica ? '' : destino;
                    tag.hidden = fica;
                    tag.textContent = fica ? '' : '→ ' + (destino === '__avulso'
                        ? '📄 avulsos' : '📗 ' + (books.find(x => x.id === destino)?.title || ''));
                });
                e.target.value = '';
            };

            /* ── Ordem do sumário ──────────────────────────────────
               Arrastar (nativo, sem biblioteca) e ↑↓. As setas não são
               enfeite de acessibilidade: drag-and-drop HTML5 não existe no
               celular, e metade da mesa edita do celular. */
            const renumerar = () => [...lista.children].forEach((r, i) => {
                r.querySelector('.wb-chapter__num').textContent = i + 1;
                r.querySelector('[data-capsobe]').disabled = i === 0;
                r.querySelector('[data-capdesce]').disabled = i === lista.children.length - 1;
            });
            lista.addEventListener('click', (e) => {
                const btn = e.target.closest('[data-capsobe], [data-capdesce]'); if (!btn) return;
                const r = btn.closest('[data-caprow]');
                const vizinho = btn.hasAttribute('data-capsobe') ? r.previousElementSibling : r.nextElementSibling;
                if (!vizinho) return;
                btn.hasAttribute('data-capsobe') ? vizinho.before(r) : vizinho.after(r);
                renumerar(); btn.focus();
            });
            let arrastando = null;
            lista.addEventListener('dragstart', (e) => {
                arrastando = e.target.closest('[data-caprow]');
                arrastando.classList.add('is-arrastando');
                e.dataTransfer.effectAllowed = 'move';
            });
            lista.addEventListener('dragend', () => {
                arrastando?.classList.remove('is-arrastando'); arrastando = null; renumerar();
            });
            lista.addEventListener('dragover', (e) => {
                e.preventDefault();
                const alvo = e.target.closest('[data-caprow]');
                if (!alvo || !arrastando || alvo === arrastando) return;
                // Metade de cima do alvo = entra antes dele; metade de baixo = depois.
                const meio = alvo.getBoundingClientRect().top + alvo.offsetHeight / 2;
                e.clientY < meio ? alvo.before(arrastando) : alvo.after(arrastando);
            });
            renumerar();

            /* ── Aviso de publicação órfã ──────────────────────────
               Capítulo com 🌐 dentro de livro que ninguém publicou é
               invisível, e nada na tela dizia isso. */
            const aviso = () => {
                const semPub = ![...document.querySelectorAll('[data-bkpub]')].some(c => c.checked);
                const abertos = document.querySelectorAll('[data-cappub]:checked').length;
                const el = $('#capAviso');
                el.hidden = !(semPub && abertos);
                el.innerHTML = el.hidden ? '' :
                    `⚠️ <b>${abertos} capítulo${abertos > 1 ? 's' : ''} com 🌐, mas o livro não está publicado em lugar nenhum.</b>
                     Ninguém vai enxergar — marque uma publicação na aba 🌐 Publicação.`;
                document.querySelector('[data-bktab="caps"]').classList.toggle('is-alerta', !el.hidden);
            };
            document.querySelector('[data-bkpanel="pub"]').addEventListener('change', aviso);
            lista.addEventListener('change', (e) => { if (e.target.matches('[data-cappub]')) aviso(); });
            aviso();
        }

        const versaoAntes = String(b.versao || '').trim();
        $('#bkSave').onclick = async () => {
            b.title = $('#bkTitle').value.trim() || 'Livro sem título';
            b.versao = $('#bkVersao').value.trim();
            b.estanteIds = [...document.querySelectorAll('[data-bkest]:checked')].map(c => c.dataset.bkest);
            b.estanteId = null;   // legado, ver estantesDoLivro()
            b.description = $('#bkDesc').value.trim();
            b.cover = $('#bkCover').value.trim();
            b.pub = Object.fromEntries(PUBLICACOES.map(([k]) => [k, document.querySelector(`[data-bkpub="${k}"]`).checked]));
            /* Campo com `data-vazio` nunca foi tocado: um <input type=color>
               não tem estado "vazio", ele sempre devolve uma cor. Sem essa
               marca, abrir a aba e sair já carimbaria preto em tudo. */
            b.estilo = {};
            for (const c of ESTILO_CAMPOS) {
                const el = c.tipo === 'imagem'
                    ? document.getElementById('bkEst_' + c.k)
                    : document.querySelector(`[data-est="${c.k}"]`);
                const v = String(el?.value ?? '').trim();
                if (v && !el.hasAttribute('data-vazio')) b.estilo[c.k] = v;
            }
            // `public` continua gravado só para o legado: uma vez que `pub` existe no
            // doc, é ele que manda em toda leitura (shared/livros-pub.js).
            b.public = !!(b.pub.geral || b.pub.conhGeral || b.pub.conhVinculo);
            b.updatedAt = now();
            b.updatedBy = WB().user?.email || '';
            if (!b.createdAt) b.createdAt = now();
            const { id, ...data } = b;
            await setDoc(doc(db, 'worldbuilding-books', id), data);
            if (!books.find(x => x.id === b.id)) books.push(b);
            else books = books.map(x => x.id === b.id ? b : x);
            /* Capítulos: status, 🌐, ordem do sumário (= ordem das linhas) e
               destino. Só grava o que realmente mudou — o livro cheio são
               dezenas de docs e o autor costuma mexer em dois. */
            const linhas = [...document.querySelectorAll('.wb-capedit [data-caprow]')];
            const ficam = linhas.filter(r => !r.dataset.capmove);
            const fimDe = {};   // capítulo que sai entra no FIM do livro de destino
            for (const r of linhas) {
                const a = caps.find(x => x.id === r.dataset.caprow);
                const destino = r.dataset.capmove || '';
                const bookId = destino === '__avulso' ? null : (destino || b.id);
                if (destino && fimDe[destino] === undefined) fimDe[destino] = bookId ? chaptersOf(bookId).length : 0;
                const ordem = destino ? fimDe[destino]++ : ficam.indexOf(r);
                const st = r.querySelector('[data-capst]').value;
                const pb = r.querySelector('[data-cappub]').checked;
                if (st === (a.status || 'rascunho') && pb === !!a.public
                    && bookId === (a.bookId ?? null) && ordem === (a.order ?? 0)) continue;
                Object.assign(a, { status: st, public: pb, bookId, order: ordem, updatedAt: now(), updatedBy: WB().user?.email || '' });
                await setDoc(doc(db, 'worldbuilding-articles', a.id),
                    { status: st, public: pb, bookId, order: ordem, updatedAt: a.updatedAt, updatedBy: a.updatedBy }, { merge: true });
            }
            ToolModal.close(); renderLibrary();
            // Depois de gravar: o aviso é sobre o que JÁ está no ar.
            if (book && !mesmaVersao(versaoAntes, b.versao)) await ofertarAviso(b, versaoAntes);
        };
        const del = $('#bkDel');
        if (del) del.onclick = async () => {
            const caps = chaptersOf(b.id);
            if (!await confirmar(`Excluir o livro "${b.title}"?${caps.length ? `\nOs ${caps.length} capítulos NÃO serão apagados — voltarão para "Textos avulsos".` : ''}`, { perigo: true })) return;
            // Desvincula capítulos (viram avulsos) antes de excluir o livro.
            for (const a of caps) {
                a.bookId = null;
                const { id, ...data } = a;
                await setDoc(doc(db, 'worldbuilding-articles', id), data, { merge: true });
            }
            await deleteDoc(doc(db, 'worldbuilding-books', b.id));
            books = books.filter(x => x.id !== b.id);
            ToolModal.close(); renderLibrary();
        };
    }

    /* ── Aviso de versão ───────────────────────────────────────
       Subir a versão e não avisar ninguém é o jogador citando a regra da
       semana passada no meio da sessão. Pergunta sempre — mandar aviso é
       mexer na caixa dos outros, e isso não se faz por conta própria. */
    async function ofertarAviso(livro, versaoAntes) {
        let usuarios = [];
        try {
            const snap = await getDocs(collection(db, 'users'));
            usuarios = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) {
            console.warn('[aviso-livro] não deu para ler os usuários', e);
            toast('🔖 Versão salva. Não deu para montar a lista de quem avisar — veja o console.');
            return;
        }
        const alvo = alvos(livro, usuarios);
        if (!alvo.ids.length) {
            toast(`🔖 Versão ${livro.versao}. Ninguém avisado — ${alvo.motivo}.`);
            return;
        }
        const quantos = `${alvo.ids.length} pessoa${alvo.ids.length > 1 ? 's' : ''}`;
        const ressalva = alvo.exato ? '' : `

⚠️ ${alvo.motivo}.`;
        if (!await confirmar(`Avisar ${quantos} de que “${livro.title}” está na versão ${livro.versao}?

(${alvo.motivo})${ressalva}`)) return;
        const { enviados, falhas } = await enviarAviso({ db, doc, getDoc, updateDoc }, alvo.ids, avisoDeVersao(livro, versaoAntes));
        toast(falhas.length
            ? `🔔 ${enviados} avisado(s), ${falhas.length} não deu — veja o console.`
            : `🔔 ${enviados} avisado(s). O sino acende no Portal, inclusive no app instalado.`);
    }

    /* ══════════════ EDITOR (escrita) ══════════════ */
    function bookOptions(sel) {
        return `<option value="">— texto avulso —</option>` +
            books.map(b => `<option value="${b.id}" ${b.id === sel ? 'selected' : ''}>📗 ${esc(b.title || 'Sem título')}${versaoDoLivro(b) ? ' · ' + esc(versaoDoLivro(b)) : ''}</option>`).join('');
    }

    function openArticle(article, bookId) {
        atual = article || {
            id: uid('art'), title: '', synopsis: '', contentHTML: '',
            bookId: bookId || null, order: bookId ? chaptersOf(bookId).length : 0,
            public: false, status: 'rascunho', mentions: [], createdAt: now(),
        };
        renderEditor();
    }

    /* Capítulo anterior/seguinte, pelo sumário do livro. Texto avulso não
       tem ordem de leitura, então não ganha a navegação. */
    function navCapsHTML() {
        if (!atual.bookId) return '';
        const irmaos = chaptersOf(atual.bookId);
        const i = irmaos.findIndex(x => x.id === atual.id);
        const ant = i > 0 ? irmaos[i - 1] : null;
        const prox = i > -1 && i < irmaos.length - 1 ? irmaos[i + 1] : null;
        if (!ant && !prox) return '';
        const botao = (cap, dir, cls) => cap
            ? `<button type="button" class="wb-capnav__btn ${cls}" data-gocap="${cap.id}">
                   <span class="wb-capnav__dir">${dir}</span>
                   <span class="wb-capnav__nome">${esc(cap.title || 'Sem título')}</span>
               </button>`
            : '<span class="wb-capnav__vazio"></span>';
        return `<nav class="wb-capnav">
            ${botao(ant, '← Capítulo anterior', '')}
            ${botao(prox, 'Próximo capítulo →', 'wb-capnav__btn--next')}
        </nav>`;
    }

    function renderEditor() {
        view = 'editor';
        const a = atual;
        const lendo = modo === 'leitura';
        setTitle('✒️ Escritório do Cronista');
        contentBody().innerHTML = `
        <div class="wbt-editor-layout${lendo ? ' is-reading' : ''}" id="editorLayout">
            <div class="wbt-editor-main" id="editorMain">
                <!-- Onde o capítulo MORA (livro, ordem, status, 🌐). É a
                     ficha catalográfica: consultada de vez em quando, mexida
                     quase nunca. Ficava num painel do tamanho do texto, entre
                     a sinopse e a barra de formatação — bem no caminho de
                     quem só queria escrever. Vira uma tarja fina no topo. -->
                <div class="wb-editor-props" id="editorProps">
                    <label>📗 <select id="artBook" class="form-select">${bookOptions(a.bookId)}</select></label>
                    <label title="Posição no sumário do livro">🔢 <input id="artOrder" type="number" class="form-input" value="${a.order ?? 0}" min="0"></label>
                    <label>📊 <select id="artStatus" class="form-select">
                        <option value="rascunho" ${a.status === 'rascunho' ? 'selected' : ''}>✏️ Rascunho</option>
                        <option value="revisao" ${a.status === 'revisao' ? 'selected' : ''}>🔍 Em revisão</option>
                        <option value="publicado" ${a.status === 'publicado' ? 'selected' : ''}>✅ Publicado</option>
                    </select></label>
                    <label class="wbt-check" title="Libera o capítulo na ficha e no Tabuleiro"><input type="checkbox" id="artPublic" ${a.public ? 'checked' : ''}> 🌐</label>
                </div>

                <div class="wbt-toolbar wbt-etoolbar">
                    <button class="btn btn-secondary btn-sm" id="backLib">← Biblioteca</button>
                    <span style="flex:1"></span>
                    <button class="btn btn-secondary btn-sm" id="toggleModo"
                            title="${lendo ? 'Voltar a editar o texto' : 'Ler sem as ferramentas de edição'}">${lendo ? '✒️ Modo escrita' : '📖 Modo leitura'}</button>
                    <button class="btn btn-secondary btn-sm" id="toggleRefs" title="Painel de consulta">Consulta ⇄</button>
                    <button class="btn btn-secondary btn-sm" id="focusMode" title="Modo foco">Foco ⛶</button>
                    <button class="btn btn-secondary btn-sm" id="verVersoes" title="Versões guardadas deste texto">🕐 Versões</button>
                    <label class="wb-auto" title="Salvar sozinho enquanto você escreve. Desligado, só o 💾 (ou Ctrl+S) grava.">
                        <input type="checkbox" id="autoSave" ${autoSalva ? 'checked' : ''}> auto
                    </label>
                    <button class="btn btn-success btn-sm" id="saveArticle" title="Salvar e guardar uma versão (Ctrl+S)">💾 Salvar</button>
                </div>
                ${navCapsHTML()}
                <input id="articleTitle" class="wbt-article-title" placeholder="Título do conto, capítulo ou cena…" value="${esc(a.title || '')}" ${lendo ? 'readonly' : ''}>
                <input id="articleSyn" class="wb-article-syn" placeholder="Sinopse curta (opcional)…" value="${esc(a.synopsis || '')}" ${lendo ? 'readonly' : ''}>

                <!-- Colada no texto e grudada no topo quando a página rola. -->
                <div class="wbt-toolbar wb-richbar" id="richToolbar">${TOOLBAR_HTML}</div>

                <div id="richEditor" class="wbt-rich texto-mundo"${estiloDoLivro(books.find(x => x.id === a.bookId))} contenteditable="${lendo ? 'false' : 'true'}"
                     data-placeholder="Escreva aqui. Digite @ para vincular NPCs, Tribos, Locais ou eventos…">${a.contentHTML || ''}</div>
                <p class="wbt-muted" id="editorStatus"></p>
                ${navCapsHTML()}
                <div id="mentionBox" class="wbt-mentionbox" hidden></div>
            </div>
            <aside class="wbt-refs" id="refsPanel">
                <input id="refsSearch" class="form-input" placeholder="Buscar no ecossistema…">
                <div class="wbt-chips" id="refsTabs">
                    <button class="wbt-chip is-active" data-rt="all">Tudo</button>
                    <button class="wbt-chip" data-rt="npcs">👥 NPCs</button>
                    <button class="wbt-chip" data-rt="factions">⚔️ Tribos</button>
                    <button class="wbt-chip" data-rt="geography">📍 Locais</button>
                    <button class="wbt-chip" data-rt="history">📜 História</button>
                    <button class="wbt-chip" data-rt="races">🧬 Raças</button>
                    <button class="wbt-chip" data-rt="classes">⚔️ Classes</button>
                </div>
                <div id="refsList" class="wbt-refs__list"></div>
            </aside>
        </div>`;
        renderRefs(); bindEditor();
    }

    /* ── 🔗 Campo vinculado: escolher entidade e campo ─────
       Duas etapas na MESMA janela: a lista de entidades vira a lista de
       campos daquela entidade. Duas janelas em sequência fariam o autor
       perder o cursor no texto — e é onde ele quer voltar. */
    function pedirCampoVinculado() {
        return new Promise((resolve) => {
            const itens = searchables();
            let escolhido = null;
            const pintar = (q = '') => {
                const lista = itens.filter(x => !q || x.nome.toLowerCase().includes(q)).slice(0, 60);
                $('#cvLista').innerHTML = lista.length
                    ? lista.map(x => `<button type="button" class="wbt-pick" data-cvent="${esc(x.id)}" data-cvcat="${esc(x.cat)}">
                           ${KIND[x.cat]?.icon || '📄'} ${esc(x.nome)} <span class="wbt-tag">${esc(KIND[x.cat]?.label || x.cat)}</span></button>`).join('')
                    : '<p class="wbt-muted">Nada encontrado.</p>';
            };
            ToolModal.open(`
                <h2>🔗 Campo vinculado</h2>
                <p class="wbt-muted wb-bkhint">O valor sai do cadastro e se atualiza sozinho no livro. Mudou lá, mudou aqui — sem reescrever capítulo.</p>
                <input id="cvBusca" class="form-input" placeholder="Buscar entidade cadastrada…" autocomplete="off">
                <div class="wbt-picklist" id="cvLista"></div>
                <div class="wbt-actions"><button class="btn btn-secondary" data-close>Cancelar</button></div>`);
            pintar();
            $('#cvBusca').oninput = (e) => pintar(e.target.value.trim().toLowerCase());
            $('#cvLista').onclick = (e) => {
                const b = e.target.closest('[data-cvent]'); if (!b) return;
                if (!escolhido) {
                    const ent = poolOf(b.dataset.cvcat).find(x => x.id === b.dataset.cvent);
                    escolhido = { cat: b.dataset.cvcat, id: b.dataset.cvent, ent };
                    const campos = camposDe(ent);
                    $('#cvBusca').hidden = true;
                    $('#cvLista').innerHTML = campos.length
                        ? campos.map(c => `<button type="button" class="wbt-pick" data-cvcampo="${esc(c.campo)}">
                               <b>${esc(c.campo)}</b><br><span class="wbt-muted">${esc(c.valor.slice(0, 120))}</span></button>`).join('')
                        : '<p class="wbt-muted">Esta entidade não tem campo de texto para vincular.</p>';
                }
            };
            $('#cvLista').addEventListener('click', (e) => {
                const b = e.target.closest('[data-cvcampo]'); if (!b || !escolhido) return;
                const campo = b.dataset.cvcampo;
                ToolModal.close();
                resolve({ cat: escolhido.cat, id: escolhido.id, campo, valor: String(escolhido.ent?.[campo] ?? '') });
            });
            // Fechar sem escolher devolve null — quem chama já trata.
            const raiz = document.getElementById('wbToolModal');
            const aoFechar = () => { if (!raiz.classList.contains('active')) { obs.disconnect(); resolve(null); } };
            const obs = new MutationObserver(aoFechar);
            obs.observe(raiz, { attributes: true, attributeFilter: ['class'] });
        });
    }

    /* Resolve os campos vinculados do texto aberto. No editor o pool JÁ está
       em memória (o painel de consulta usa o mesmo), então não custa leitura
       nenhuma — e o autor vê o mesmo que o jogador vai ver. */
    const carregarDoPool = async (cat) => new Map(poolOf(cat).map(e => [e.id, e]));

    /* ── Painel de consulta lateral ─────────────────────── */
    function renderRefs() {
        const q = ($('#refsSearch')?.value || '').trim().toLowerCase();
        const kinds = refType === 'all' ? Object.keys(KIND) : [refType];
        const list = searchables(kinds).filter(x =>
            !q || x.nome.toLowerCase().includes(q) || x.descricao.toLowerCase().includes(q));
        $('#refsList').innerHTML = list.length ? list.map(x => {
            const k = KIND[x.cat];
            return `<div class="wbt-refcard" data-ref="${x.id}" data-refcat="${x.cat}">
                <div class="wbt-refcard__name">${k.icon} ${esc(x.nome)} <span class="wbt-tag">${k.label}</span></div>
                <p class="wbt-refcard__sum">${esc((x.descricao || 'Sem descrição.').slice(0, 200))}</p>
                <div class="wbt-refcard__acoes">
                    <button type="button" class="wbt-microbtn" data-detalhes
                            aria-expanded="false">Detalhes ▾</button>
                </div>
                <div class="wbt-refcard__full" hidden></div>
            </div>`;
        }).join('') : `<p class="wbt-muted">Nada encontrado no ecossistema.</p>`;
    }

    /* Dossiê completo, montado só quando pedido (a lista tem centenas de
       fichas — renderizar todas de véspera travava o painel). */
    function toggleDossie(card) {
        const btn = card.querySelector('[data-detalhes]');
        const box = card.querySelector('.wbt-refcard__full');
        const abrir = box.hidden;
        if (abrir && !box.dataset.pronto) {
            const cat = card.dataset.refcat;
            // `doc` aqui sombrearia o doc() do Firestore importado no topo.
            const entidade = poolOf(cat).find(x => x.id === card.dataset.ref);
            box.innerHTML = dossieHTML(entidade, KIND[cat]);
            box.dataset.pronto = '1';
        }
        box.hidden = !abrir;
        card.classList.toggle('is-detailed', abrir);
        btn.setAttribute('aria-expanded', String(abrir));
        btn.textContent = abrir ? 'Detalhes ▴' : 'Detalhes ▾';
    }

    /* ── @Mentions ──────────────────────────────────────── */
    function detect() {
        const sel = window.getSelection();
        if (!sel.rangeCount || !$('#richEditor').contains(sel.anchorNode)) return hide();
        const node = sel.anchorNode;
        if (node.nodeType !== Node.TEXT_NODE) return hide();
        const upTo = node.textContent.slice(0, sel.anchorOffset);
        const m = upTo.match(/@([\p{L}\p{N} ]{0,30})$/u);
        if (!m) return hide();
        mentionRange = document.createRange();
        mentionRange.setStart(node, sel.anchorOffset - m[0].length);
        mentionRange.setEnd(node, sel.anchorOffset);
        show(m[1].trim().toLowerCase());
    }
    function show(query) {
        const box = $('#mentionBox');
        const items = searchables().filter(x => !query || x.nome.toLowerCase().includes(query)).slice(0, 8);
        if (!items.length) return hide();
        mentionIdx = 0;
        box.innerHTML = items.map((x, i) => {
            const k = KIND[x.cat];
            return `<button data-mid="${x.id}" data-mcat="${x.cat}" class="${i === 0 ? 'is-hover' : ''}"><span class="wbt-tag">${k.icon}</span> ${esc(x.nome)}</button>`;
        }).join('');
        box.hidden = false;
        const rect = mentionRange.getBoundingClientRect();
        const host = $('#editorMain').getBoundingClientRect();
        box.style.left = `${rect.left - host.left}px`;
        box.style.top = `${rect.bottom - host.top + 6}px`;
    }
    function hide() { const b = $('#mentionBox'); if (b) b.hidden = true; mentionRange = null; }
    function insert(id, cat) {
        const item = searchables().find(x => x.id === id && x.cat === cat);
        if (!item || !mentionRange) return;
        const a = document.createElement('a');
        a.className = 'wbt-mention'; a.dataset.entity = id; a.dataset.cat = cat;
        a.textContent = item.nome; a.contentEditable = 'false';
        mentionRange.deleteContents(); mentionRange.insertNode(a);
        const space = document.createTextNode('\u00A0'); a.after(space);
        const sel = window.getSelection(), r = document.createRange();
        r.setStartAfter(space); r.collapse(true);
        sel.removeAllRanges(); sel.addRange(r);
        hide(); autosaveHint();
    }
    function keyNav(e) {
        const box = $('#mentionBox'); if (box.hidden) return;
        const btns = [...box.querySelectorAll('button')];
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            mentionIdx = (mentionIdx + (e.key === 'ArrowDown' ? 1 : -1) + btns.length) % btns.length;
            btns.forEach((b, i) => b.classList.toggle('is-hover', i === mentionIdx));
        } else if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            const b = btns[mentionIdx]; if (b) insert(b.dataset.mid, b.dataset.mcat);
        } else if (e.key === 'Escape') hide();
    }

    /* ── Histórico de versão ───────────────────────────────────
       Só o salvamento DELIBERADO (💾 ou Ctrl+S) guarda versão. O autosave
       de 4s dispara a cada frase — encher o histórico com ele daria um
       carretel de rascunho onde deveria haver marcos, e o autor não
       acharia nada. É por isso que o botão diz "Salvar e guardar versão". */
    const HIST_MAX = 15;
    const histDoc = (artId) => `hist_${artId}`;
    async function guardarVersao(a) {
        const versoes = await lerApoio(histDoc(a.id), 'versoes');
        if (versoes[0]?.html === a.contentHTML) return;   // nada mudou desde a última
        const nova = { t: now(), by: WB().user?.email || '', title: a.title, words: a.words, html: a.contentHTML };
        await gravarApoio(histDoc(a.id), 'versoes', aparar([nova, ...versoes], HIST_MAX));
    }

    async function abrirVersoes() {
        const a = atual;
        const versoes = await lerApoio(histDoc(a.id), 'versoes');
        ToolModal.open(`
            <h2>🕐 Versões de “${esc(a.title || 'Sem título')}”</h2>
            ${versoes.length ? `<div class="wb-versoes">${versoes.map((v, i) => `
                <div class="wb-versao" data-versao="${i}">
                    <div class="wb-versao__cab">
                        <div class="wb-versao__quando">
                            <b>${new Date(v.t).toLocaleString('pt-BR')}</b>
                            ${i === 0 ? '<span class="wb-badge wb-badge--ver">mais recente</span>' : ''}
                            <span class="wbt-muted">${v.words ?? 0} palavras${v.by ? ' · ' + esc(v.by) : ''}</span>
                        </div>
                        <div class="wb-versao__acoes">
                            <button type="button" class="wbt-microbtn" data-vver>Ver ▾</button>
                            <button type="button" class="btn btn-secondary btn-sm" data-vrest>↩ Restaurar</button>
                        </div>
                    </div>
                    <div class="wb-versao__corpo texto-mundo" hidden></div>
                </div>`).join('')}</div>`
                : '<p class="wbt-muted">Nenhuma versão guardada ainda. Cada 💾 Salvar (ou Ctrl+S) guarda uma.</p>'}
            <p class="wbt-muted wb-bkhint">Guarda as ${HIST_MAX} últimas, ou o que couber no documento. Restaurar joga o texto de volta no editor — e guarda o texto de agora como versão antes, então dá para voltar atrás do voltar atrás.</p>`);

        document.querySelectorAll('[data-versao]').forEach(card => {
            const i = +card.dataset.versao;
            card.querySelector('[data-vver]').onclick = () => {
                const box = card.querySelector('.wb-versao__corpo');
                const abrir = box.hidden;
                if (abrir && !box.dataset.pronto) { box.innerHTML = versoes[i].html || ''; box.dataset.pronto = '1'; }
                box.hidden = !abrir;
                card.querySelector('[data-vver]').textContent = abrir ? 'Ver ▴' : 'Ver ▾';
            };
            card.querySelector('[data-vrest]').onclick = async () => {
                if (!await confirmar('Trazer esta versão de volta para o editor?\nO texto de agora vira uma versão antes de ser substituído, e nada é gravado até você salvar.')) return;
                clearTimeout(saveTimer);
                await save(true);                       // o texto de agora vira versão
                $('#richEditor').innerHTML = versoes[i].html || '';
                ToolModal.close();
                autosaveHint();
                $('#editorStatus').textContent = 'Versão trazida de volta — salve para valer.';
            };
        });
    }

    /* ── Salvar ─────────────────────────────────────────── */
    async function save(manual = false) {
        const ed = $('#richEditor');
        if (!ed) return;   // saiu do editor antes do autosave disparar
        const mentions = [...ed.querySelectorAll('a.wbt-mention')].map(a => ({ id: a.dataset.entity, cat: a.dataset.cat }));
        const a = atual;
        a.title = $('#articleTitle').value.trim() || 'Sem título';
        a.synopsis = $('#articleSyn').value.trim();
        // Grava já higienizado: é este HTML que a ficha do jogador e o
        // Laboratorium vão renderizar, então a faxina vale na gravação.
        a.contentHTML = rich ? rich.limpar() : ed.innerHTML;
        a.bookId = $('#artBook').value || null;
        a.order = parseInt($('#artOrder').value || '0') || 0;
        a.status = $('#artStatus').value || 'rascunho';
        a.public = $('#artPublic').checked;
        a.mentions = mentions;
        a.words = wordCount(a.contentHTML);
        a.updatedAt = now();
        a.updatedBy = WB().user?.email || '';
        if (!a.createdAt) a.createdAt = now();
        const { id, ...data } = a;
        await setDoc(doc(db, 'worldbuilding-articles', id), data);
        if (!artigos.find(x => x.id === a.id)) artigos.push(a);
        else artigos = artigos.map(x => x.id === a.id ? a : x);
        sujo = false;
        if (manual) await guardarVersao(a);
        $('#editorStatus').textContent = `✓ Salvo às ${new Date().toLocaleTimeString('pt-BR')}${manual ? ' · versão guardada' : ''}`;
    }
    function autosaveHint() {
        clearTimeout(saveTimer);
        sujo = true;
        const st = $('#editorStatus');
        if (st) st.textContent = autoSalva ? 'Alterações não salvas…' : 'Alterações não salvas — o auto está desligado.';
        if (!autoSalva) return;
        saveTimer = setTimeout(() => { if (view === 'editor') save(); }, 4000);
    }

    /* O autosave é de 4s. Fechar a aba dentro dessa janela levava o
       parágrafo junto, calado — o navegador é quem sabe perguntar. */
    window.addEventListener('beforeunload', (e) => {
        if (view === 'editor' && sujo) { e.preventDefault(); e.returnValue = ''; }
    });
    /* Ctrl+S. Registrado uma vez no documento (renderEditor roda de novo a
       cada capítulo, e listener por render vira pilha de listeners). */
    document.addEventListener('keydown', (e) => {
        if (!(e.key === 's' && (e.ctrlKey || e.metaKey)) || view !== 'editor') return;
        e.preventDefault();
        clearTimeout(saveTimer); save(true);   // Ctrl+S é deliberado: guarda versão
    });

    function bindEditor() {
        $('#backLib').onclick = async () => { clearTimeout(saveTimer); await save(); renderLibrary(); };
        rich = bindRich($('#richEditor'), $('#richToolbar'), autosaveHint, { pedirCampo: pedirCampoVinculado });
        resolverCampos($('#richEditor'), carregarDoPool);
        $('#saveArticle').onclick = () => { clearTimeout(saveTimer); save(true); };
        $('#verVersoes').onclick = abrirVersoes;
        $('#autoSave').onchange = (e) => {
            autoSalva = e.target.checked;
            guardar(CHAVE_AUTO, autoSalva);
            // Ligar com texto pendente grava agora; desligar cancela o relogio
            // que ja estava correndo, senao ele salvaria depois de desligado.
            clearTimeout(saveTimer);
            if (autoSalva && sujo) autosaveHint();
            else if (!autoSalva) $('#editorStatus').textContent = sujo
                ? 'Alterações não salvas — o auto está desligado.'
                : 'Auto desligado. Só o 💾 (ou Ctrl+S) grava.';
        };
        // Salva antes de trocar de modo/capítulo: o texto vivo mora no DOM.
        $('#toggleModo').onclick = async () => {
            clearTimeout(saveTimer); await save();
            modo = modo === 'escrita' ? 'leitura' : 'escrita';
            renderEditor();
        };
        contentBody().querySelectorAll('[data-gocap]').forEach(b =>
            b.onclick = async () => {
                clearTimeout(saveTimer); await save();
                openArticle(artigos.find(x => x.id === b.dataset.gocap), null);
                contentBody().scrollTop = 0; window.scrollTo(0, 0);
            });
        $('#toggleRefs').onclick = () => $('#editorLayout').classList.toggle('refs-closed');
        $('#focusMode').onclick = () => document.body.classList.toggle('wbt-focus');
        $('#refsSearch').oninput = renderRefs;
        ['articleTitle', 'articleSyn', 'artBook', 'artOrder', 'artStatus', 'artPublic'].forEach(id => {
            const el = document.getElementById(id); if (el) el.addEventListener('change', autosaveHint);
        });
        $('#refsTabs').onclick = (e) => {
            const b = e.target.closest('[data-rt]'); if (!b) return;
            refType = b.dataset.rt;
            document.querySelectorAll('#refsTabs .wbt-chip').forEach(c => c.classList.toggle('is-active', c === b));
            renderRefs();
        };
        $('#refsList').onclick = (e) => {
            const c = e.target.closest('[data-ref]'); if (!c) return;
            if (e.target.closest('[data-detalhes]')) { toggleDossie(c); return; }
            if (e.target.closest('.wbt-refcard__full')) return;   // clicar dentro do dossiê não fecha
            if (e.detail === 2) ToolModal.openEntry(c.dataset.refcat, c.dataset.ref);
            else c.classList.toggle('is-open');
        };
        const ed = $('#richEditor');
        ed.addEventListener('keyup', (e) => { if (!['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(e.key)) detect(); });
        ed.addEventListener('keydown', keyNav);
        ed.addEventListener('input', autosaveHint);
        ed.addEventListener('click', (e) => {
            const a = e.target.closest('a.wbt-mention'); if (!a) return;
            e.preventDefault(); ToolModal.openEntry(a.dataset.cat, a.dataset.entity);
        });
        $('#mentionBox').addEventListener('mousedown', (e) => {
            const b = e.target.closest('[data-mid]');
            if (b) { e.preventDefault(); insert(b.dataset.mid, b.dataset.mcat); }
        });
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#mentionBox') && !e.target.closest('#richEditor')) hide();
        });
    }

    return {
        async render() { await loadAll(); renderLibrary(); },
    };
})();
