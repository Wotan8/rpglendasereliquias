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
import { db, collection, doc, getDoc, getDocs, setDoc } from '../../painel-mestre/js/firebase-config.js';
import { T, toast, esc, capsExibidos, focoExibido } from './tab-state.js';
import { refEstado } from './tab-main.js';
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
                return todos
                    ? `<button type="button" class="tb-btn tb-btn-small tb-btn-danger" onclick="tbPararLivroTodo('${ids.join(',')}')">⛔ Parar o livro inteiro</button>`
                    : `<button type="button" class="tb-btn tb-btn-small" onclick="tbExibirLivro('${ids.join(',')}')">📡 Exibir todos os capítulos</button>`;
            },
            acaoCapitulo: (cap) => exibidos().includes(cap.id)
                ? `<button type="button" class="tb-btn tb-btn-small tb-btn-danger" onclick="tbPararCap('${esc(cap.id)}')">⛔ Parar</button>`
                : `<button type="button" class="tb-btn tb-btn-small" onclick="tbExibirCap('${esc(cap.id)}')">📡 Exibir</button>`,
        });
        return;
    }
    abrirEstanteJogador();
}

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
    const fontes = [acha(races, f.raca), acha(classes, f.classe), acha(tribes, f.tribo)];
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
    const dados = { vinculos, regras };
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
    // Sem personagem na mesa não há estante — mas a leitura exibida continua valendo
    if (!meus.length) {
        if (exibidos().length) return abrirExibido();
        toast('⚠️ Você não tem personagem nesta mesa', 'warning'); return;
    }
    if (!meus.some(c => c.id === _charId)) _charId = meus[0].id;
    const charId = _charId;
    try {
        const { vinculos, regras } = await carregarAcesso(charId);
        if (charId !== _charId) return;   // trocou de personagem no meio
        const troca = meus.length > 1
            ? `<div style="margin-bottom:12px"><select onchange="tbEstanteDoChar(this.value)"
                   style="font:inherit;padding:6px 8px;border-radius:8px;background:var(--lr-surface-2,#262e3a);
                          color:inherit;border:1px solid var(--lr-border,#333)">
                   ${meus.map(c => `<option value="${esc(c.id)}" ${c.id === charId ? 'selected' : ''}>🎭 ${esc(c.nome)}</option>`).join('')}
               </select></div>`
            : '';
        // O que o mestre está exibindo entra no TOPO da estante: é o único jeito de
        // voltar para a leitura depois de fechar a janela, e o único de alcançar
        // capítulo fora do vínculo do personagem. Os títulos saem do acervo que a
        // própria estante já vai carregar (memoizado no leitor) — sem leitura extra.
        const noAr = exibidos();
        const acervo = noAr.length ? await window.lvCarregarLivros?.() : null;
        const exibindo = noAr.length
            ? `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px;padding:8px 10px;
                      border-radius:10px;background:rgba(52,211,153,.10);border:1px solid var(--lr-nature,#34d399);font-size:.85rem">
                   📡 <b>O mestre está exibindo</b>
                   ${noAr.map(id => {
                       const t = acervo?.caps.find(c => c.id === id)?.title || 'Capítulo';
                       return `<button type="button" class="tb-btn tb-btn-small" onclick="tbAbrirExibido('${esc(id)}')">📖 ${esc(t)}</button>`;
                   }).join('')}
               </div>`
            : '';
        window.lvBiblioteca({
            titulo: '📖 Meus Livros',
            cabecalho: exibindo + troca,
            filtro: (l) => {
                const p = pubDoLivro(l);
                return p.geral || p.conhGeral || (p.conhVinculo && vinculos.has(l.id));
            },
            capituloEstado: (cap, livro) => {
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
