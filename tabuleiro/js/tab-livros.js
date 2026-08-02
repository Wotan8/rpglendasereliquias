// =============================================
// TABULEIRO — 📖 Livros do Cronista
// ---------------------------------------------
// Mestre: estante dos livros publicados para ele ("Mestre" ou "Geral"), e de
// lá exibe um capítulo para a mesa inteira.
// Jogador: estante do que o personagem dele alcança — "Geral" e "Conhecimento
// Geral" para qualquer um, "Conhecimento Vínculo" só com vínculo de raça,
// classe, tribo ou peculiaridade.
//
// CUSTO: a exibição é UM campo (`livroExibido`) no doc que todo mundo já
// escuta — tabuleiro-meta/estado. Nada de listener novo, nada de objeto no
// canvas, nada de HTML de capítulo trafegando no doc: vão só os ids, e cada
// aparelho busca o capítulo (2 leituras) apenas quando o FOCO muda. Exibir o
// livro inteiro é um write só, com a lista de ids. O leitor em si
// é o shared/livro-vinculado.js, o mesmo da ficha. A estante do jogador só
// busca ficha e dados de sistema no PRIMEIRO clique, e guarda para a sessão.
//
// LIMITE CONHECIDO: capítulo com regra de Conhecimento (system/data/knowledge)
// aparece trancado aqui. Avaliar "Perícia: Briga >= 3" exige o motor da ficha,
// que não roda no tabuleiro — e chutar liberaria leitura que o jogador não tem.
// Falha fechado e manda para a ficha, onde a conta é a de verdade.
// =============================================
import { db, collection, doc, getDoc, getDocs, setDoc, updateDoc } from '../../painel-mestre/js/firebase-config.js';
import { T, toast, esc, capsExibidos, focoExibido } from './tab-state.js';
import { refEstado, abrirModal, fecharModal } from './tab-main.js';
import { livroDoMestre, pubDoLivro } from '../../shared/livros-pub.js';

export function initLivros() {
    window.db = window.db || db;             // o leitor compartilhado lê daqui
    window.tbAbrirLivros = abrirEstante;
    window.tbExibirCap = (id) => mudarExibicao([...exibidos(), id], id);
    window.tbPararCap = (id) => mudarExibicao(exibidos().filter(x => x !== id), null, id);
    window.tbExibirLivro = (ids) => { const l = ids.split(','); mudarExibicao([...exibidos(), ...l], l[0]); };
    window.tbPararLivroTodo = (ids) => {
        const l = ids.split(',');
        mudarExibicao(exibidos().filter(x => !l.includes(x)), null, ...l);
    };
    window.tbPararTudo = () => mudarExibicao([], null);
    window.tbEstanteDoChar = estanteDoChar;
    window.tbAbrirExibido = abrirExibido;
}

const exibidos = () => capsExibidos(T.estado?.livroExibido);

function abrirEstante() {
    if (!window.lvBiblioteca) { toast('❌ Leitor de livros não carregou', 'danger'); return; }
    if (T.mode === 'secret' && T.isMaster) {
        const noAr = exibidos().length;
        window.lvBiblioteca({
            titulo: '📖 Livros do Cronista',
            filtro: livroDoMestre,
            // "Parar tudo" mora aqui porque o que está no ar pode vir de livros diferentes
            cabecalho: noAr
                ? `<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px;padding:8px 10px;
                          border-radius:10px;background:rgba(52,211,153,.10);border:1px solid var(--lr-nature,#34d399);font-size:.85rem">
                       📡 ${noAr} ${noAr === 1 ? 'capítulo exibido' : 'capítulos exibidos'} para a mesa
                       <button type="button" class="tb-btn tb-btn-small tb-btn-danger" onclick="tbPararTudo()">⛔ Parar tudo</button>
                   </div>`
                : '',
            acaoLivro: (livro, caps) => {
                const ids = caps.map(c => c.id);
                if (!ids.length) return '';
                const todos = ids.every(id => exibidos().includes(id));
                const exibir = todos
                    ? `<button type="button" class="tb-btn tb-btn-small tb-btn-danger" onclick="tbPararLivroTodo('${ids.join(',')}')">⛔ Parar o livro inteiro</button>`
                    : `<button type="button" class="tb-btn tb-btn-small" onclick="tbExibirLivro('${ids.join(',')}')">📡 Exibir todos os capítulos</button>`;
                return `<div style="display:flex;gap:8px;flex-wrap:wrap">${exibir}
                    <button type="button" class="tb-btn tb-btn-small" onclick="tbVincularLivro('${esc(livro.id)}')">🎭 Vincular a personagem</button></div>`;
            },
            acaoCapitulo: (cap) => exibidos().includes(cap.id)
                ? `<button type="button" class="tb-btn tb-btn-small tb-btn-danger" onclick="tbPararCap('${esc(cap.id)}')">⛔ Parar</button>`
                : `<button type="button" class="tb-btn tb-btn-small" onclick="tbExibirCap('${esc(cap.id)}')">📡 Exibir</button>`,
        });
        return;
    }
    abrirEstanteJogador();
}

/* ===== VÍNCULO DE LIVRO COM PERSONAGEM (mestre) ===== */
// Grava `livrosVinculados` no doc do personagem — o MESMO formato que raça,
// classe e tribo já usam. Com isso o livro aparece sozinho em "Meus Livros" do
// tabuleiro e na aba Conhecimento da ficha, sem código novo dos dois lados.
// A ficha salva com merge, então o vínculo do mestre não é apagado por lá.
const temLivro = (c, bookId) => (c.livrosVinculados || []).some(v => v?.bookId === bookId);

window.tbVincularLivro = function(bookId) {
    if (!T.isMaster) return;
    const linhas = (T.chars || []).map(c =>
        `<label class="tb-check" style="flex-direction:row;align-items:center;gap:8px">
            <input type="checkbox" data-vinc-char="${esc(c.id)}" ${temLivro(c, bookId) ? 'checked' : ''}>
            🎭 ${esc(c.nome)}
         </label>`).join('');
    abrirModal('🎭 Vincular livro a personagem', `
        <div class="tb-muted" style="font-size:.8rem;margin-bottom:10px">
            O livro passa a aparecer em <b>📖 Meus Livros</b> do Tabuleiro e na aba
            <b>Conhecimento</b> da ficha de quem for marcado.
        </div>
        <div style="display:flex;flex-direction:column;gap:6px">${linhas || '<span class="tb-muted">Nenhum personagem nesta mesa.</span>'}</div>
        <div class="tb-modal-actions"><button class="tb-btn tb-btn-success" onclick="tbSalvarVinculoLivro('${esc(bookId)}')">💾 Salvar</button></div>`);
};

window.tbSalvarVinculoLivro = async function(bookId) {
    const marcados = new Set([...document.querySelectorAll('[data-vinc-char]')]
        .filter(i => i.checked).map(i => i.dataset.vincChar));
    try {
        // um write só por personagem QUE MUDOU — marcar todo mundo de novo não grava nada
        for (const c of (T.chars || [])) {
            const tem = temLivro(c, bookId), quer = marcados.has(c.id);
            if (tem === quer) continue;
            const lista = quer
                ? [...(c.livrosVinculados || []), { bookId, capituloIds: [] }]
                : (c.livrosVinculados || []).filter(v => v?.bookId !== bookId);
            await updateDoc(doc(db, 'char', c.id), { livrosVinculados: lista });
            c.livrosVinculados = lista;          // espelho local: sem reler a mesa
            _acesso.delete(c.id);                // a estante desse personagem recarrega
        }
        fecharModal();
        toast(`🎭 Vínculo salvo para ${marcados.size} ${marcados.size === 1 ? 'personagem' : 'personagens'}`);
    } catch (e) { console.error(e); toast('❌ Erro ao vincular o livro', 'danger'); }
};

/* ===== ESTANTE DO JOGADOR ===== */

const meusChars = () => (T.chars || []).filter(c => c.ownerUid === T.user?.uid);
let _charId = null;                 // personagem escolhido na estante
const _acesso = new Map();          // charId -> { vinculos: Map, regras: Set }

/** Vínculos do personagem + capítulos travados. Uma busca por personagem, por sessão. */
async function carregarAcesso(charId) {
    if (_acesso.has(charId)) return _acesso.get(charId);
    const [chSnap, ...snaps] = await Promise.all([
        getDoc(doc(db, 'char', charId)),
        ...['races', 'classes', 'tribes', 'peculiarities'].map(c => getDocs(collection(db, `system/data/${c}`))),
        getDocs(collection(db, 'system/data/knowledge')),
    ]);
    const listas = snaps.map(s => s.docs.map(d => ({ id: d.id, ...d.data() })));
    const [races, classes, tribes, pecs, knowledge] = listas;

    const raw = chSnap.exists() ? chSnap.data() : {};
    const f = raw.fields || {};
    const acha = (lista, nome) => nome && lista.find(d => d.nome === nome || d.id === nome);
    // `raw` entra como fonte: é onde mora o livro que o mestre amarrou direto
    // NESTE personagem (mesmo formato `livrosVinculados` de raça/classe/tribo).
    const fontes = [raw, acha(races, f.raca), acha(classes, f.classe), acha(tribes, f.tribo)];
    // mesma leitura da ficha: peculiaridade individual também carrega livro
    for (const p of (raw.peculiaridadesIndividuais || raw.peculiarities || [])) {
        fontes.push(acha(pecs, p && (p.nome || p.key || p)));
    }

    // bookId -> Set(capituloIds) | null (livro inteiro)
    const vinculos = new Map();
    for (const fonte of fontes) {
        for (const lv of (window.lvNormalizar?.(fonte) || [])) {
            const ids = Array.isArray(lv.capituloIds) ? lv.capituloIds.filter(Boolean) : [];
            if (!vinculos.has(lv.bookId)) vinculos.set(lv.bookId, ids.length ? new Set(ids) : null);
            else if (vinculos.get(lv.bookId) && ids.length) ids.forEach(i => vinculos.get(lv.bookId).add(i));
            else vinculos.set(lv.bookId, null);
        }
    }
    const regras = new Set(knowledge.map(r => r.capituloId).filter(Boolean));
    // Livro amarrado DIRETO no personagem passa por cima da regra de publicação:
    // o mestre escolheu a dedo quem lê (mesma regra da aba Conhecimento da ficha).
    const diretos = new Set((window.lvNormalizar?.(raw) || []).map(v => v.bookId));
    const dados = { vinculos, regras, diretos };
    _acesso.set(charId, dados);
    return dados;
}

function estanteDoChar(charId) {
    _charId = charId;
    abrirEstanteJogador();
}

/**
 * Reabre o capítulo que o mestre está exibindo AGORA.
 * O `sincLivroExibido` só age quando o carimbo muda, então quem fechou a janela
 * ficava sem volta até o mestre reexibir. Entra pelo id direto, sem passar pelo
 * filtro da estante: o mestre pode exibir capítulo fora do alcance do personagem
 * — foi ele quem escolheu mostrar.
 */
function abrirExibido(capId) {
    const alvo = capId || focoExibido(T.estado?.livroExibido) || exibidos()[0];
    if (!alvo) { toast('ℹ️ O mestre não está exibindo nenhum capítulo agora'); return; }
    window.lvLerCapitulo?.(alvo);
}

async function abrirEstanteJogador() {
    const meus = meusChars();
    // 🔴 Sem personagem NÃO é motivo para pular a estante. Era: o mestre olhando
    // o próprio Modo Público (a conta dele não tem personagem) clicava em
    // 📖 Livros e caía direto no último capítulo exibido, sem ver estante
    // nenhuma. Agora a estante abre do mesmo jeito — só sem a parte pessoal.
    if (!meus.some(c => c.id === _charId)) _charId = meus[0]?.id || null;
    const charId = _charId;
    try {
        const { vinculos, regras, diretos } = charId
            ? await carregarAcesso(charId)
            : { vinculos: new Map(), regras: new Set(), diretos: new Set() };
        if (charId !== _charId) return;   // trocou de personagem no meio
        const troca = meus.length > 1
            ? `<div style="margin-bottom:12px"><select onchange="tbEstanteDoChar(this.value)"
                   style="font:inherit;padding:6px 8px;border-radius:8px;background:var(--lr-surface-2,#262e3a);
                          color:inherit;border:1px solid var(--lr-border,#333)">
                   ${meus.map(c => `<option value="${esc(c.id)}" ${c.id === charId ? 'selected' : ''}>🎭 ${esc(c.nome)}</option>`).join('')}
               </select></div>`
            : '';
        // O que o mestre exibiu vira a PRIMEIRA seção, em cards de livro iguais aos
        // da estante: clicar abre o sumário só com os capítulos exibidos — ou o
        // texto direto, quando é um capítulo só (o leitor já faz esse atalho).
        // O acervo sai do cache do leitor, que a estante ia carregar de qualquer
        // jeito: nenhuma leitura a mais.
        const noAr = exibidos();
        const acervo = noAr.length ? await window.lvCarregarLivros?.() : null;
        const porLivro = new Map();
        for (const id of noAr) {
            const cap = acervo?.caps.find(c => c.id === id);
            if (!cap?.bookId) continue;
            if (!porLivro.has(cap.bookId)) porLivro.set(cap.bookId, []);
            porLivro.get(cap.bookId).push(id);
        }
        const cardsCronista = [...porLivro.entries()].map(([bookId, ids]) => {
            const livro = acervo.livros.find(l => l.id === bookId) || { id: bookId, title: 'Livro' };
            const args = `{bookId:'${esc(bookId)}',capituloIds:['${ids.map(esc).join("','")}']}`;
            return window.lvCardLivro?.(livro, ids.length, `window.lvAbrirVinculo(${args})`) || '';
        }).join('');

        // Sem personagem (espectador, ou o mestre olhando o próprio Público) a
        // segunda seção não é "Meus Livros": é o que a mesa toda pode ler.
        const nomeSecao2 = charId ? '📖 Meus Livros' : '📚 Livros da mesa';
        window.lvBiblioteca({
            // Com o mestre exibindo algo, o título passa a ser da PRIMEIRA seção e
            // a segunda vira subtítulo — sem opção nova no leitor.
            titulo: cardsCronista ? '📖 Livros do Cronista' : nomeSecao2,
            cabecalho: cardsCronista
                ? `<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px">${cardsCronista}</div>
                   <h2 style="margin:0 0 14px">${nomeSecao2}</h2>${troca}`
                : troca,
            filtro: (l) => {
                if (diretos.has(l.id)) return true;      // vínculo direto do mestre
                const p = pubDoLivro(l);
                return p.geral || p.conhGeral || (p.conhVinculo && vinculos.has(l.id));
            },
            capituloEstado: (cap, livro) => {
                if (noAr.includes(cap.id)) return 'liberado';               // o mestre mandou exibir
                const p = pubDoLivro(livro);
                const soEsses = (p.geral || p.conhGeral) ? null : vinculos.get(cap.bookId);
                if (soEsses && !soEsses.has(cap.id)) return 'oculto';      // fora do recorte do vínculo
                if (regras.has(cap.id)) return 'bloqueado';                // trava só a ficha resolve
                return cap.public ? 'liberado' : 'oculto';
            },
            notaBloqueio: 'Capítulo com requisitos — abra a aba Conhecimento da sua ficha para ver o que falta.',
        });
    } catch (e) { console.error(e); toast('❌ Erro ao abrir seus livros', 'danger'); }
}

/**
 * Grava a lista de capítulos exibidos. `foco` é o que abre sozinho na tela de
 * todo mundo; `saindo` são ids que deixaram de ser exibidos.
 *
 * O carimbo `t` só anda quando o FOCO muda: tirar ou somar um capítulo lateral
 * não pode arrancar a mesa do que ela está lendo. Continua sendo UM campo no
 * doc que todos já escutam — nenhum listener novo, um write por clique.
 */
async function mudarExibicao(caps, foco, ...saindo) {
    const antes = T.estado?.livroExibido;
    const focoAntes = focoExibido(antes);
    // tirei do ar justamente o que estava aberto? então ninguém fica com foco
    const alvo = foco || (saindo.includes(focoAntes) ? null : focoAntes);
    const lista = [...new Set(caps)].filter(Boolean);
    const livroExibido = lista.length
        ? { caps: lista, foco: alvo, t: alvo === focoAntes ? (antes?.t || Date.now()) : Date.now() }
        : null;
    try {
        await setDoc(refEstado(), { livroExibido }, { merge: true });
        toast(!lista.length ? '⛔ Exibição encerrada'
            : `📡 ${lista.length} ${lista.length === 1 ? 'capítulo exibido' : 'capítulos exibidos'} para a mesa`);
        window.lvRepintar?.();   // os botões viram "parar" onde o mestre está
    } catch (e) { console.error(e); toast('❌ Erro ao mudar a exibição', 'danger'); }
}

// Chamado a cada snapshot do doc `estado` (tab-main). Só age quando o carimbo
// muda — o doc também carrega canvas ativo e combate, que mudam por outros
// motivos, e reabrir a leitura a cada um deles arrancaria o jogador da página.
let _visto = null;
export function sincLivroExibido(exib) {
    if (T.mode !== 'public') return;        // no secreto quem navega é o mestre, pela estante
    const foco = focoExibido(exib);
    const t = foco ? (exib.t || 0) : 0;
    if (t === _visto) return;
    const primeira = _visto === null;
    _visto = t;
    if (!t) { if (!primeira && window.lvLeitorAberto?.()) window.lvFechar(); return; }
    window.lvLerCapitulo?.(foco);           // quem chega no meio já abre no capítulo
}
