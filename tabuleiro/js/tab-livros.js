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
// canvas, nada de HTML de capítulo trafegando no doc: vai só o id, e cada
// aparelho busca o capítulo (2 leituras) apenas quando ele muda. O leitor em si
// é o shared/livro-vinculado.js, o mesmo da ficha. A estante do jogador só
// busca ficha e dados de sistema no PRIMEIRO clique, e guarda para a sessão.
//
// LIMITE CONHECIDO: capítulo com regra de Conhecimento (system/data/knowledge)
// aparece trancado aqui. Avaliar "Perícia: Briga >= 3" exige o motor da ficha,
// que não roda no tabuleiro — e chutar liberaria leitura que o jogador não tem.
// Falha fechado e manda para a ficha, onde a conta é a de verdade.
// =============================================
import { db, collection, doc, getDoc, getDocs, setDoc } from '../../painel-mestre/js/firebase-config.js';
import { T, toast, esc } from './tab-state.js';
import { refEstado } from './tab-main.js';
import { livroDoMestre, pubDoLivro } from '../../shared/livros-pub.js';

export function initLivros() {
    window.db = window.db || db;             // o leitor compartilhado lê daqui
    window.tbAbrirLivros = abrirEstante;
    window.tbExibirCapitulo = exibirCapitulo;
    window.tbPararLivro = pararExibicao;
    window.tbEstanteDoChar = estanteDoChar;
}

function abrirEstante() {
    if (!window.lvBiblioteca) { toast('❌ Leitor de livros não carregou', 'danger'); return; }
    if (T.mode === 'secret' && T.isMaster) {
        window.lvBiblioteca({
            titulo: '📖 Livros do Cronista',
            filtro: livroDoMestre,
            acaoCapitulo: (cap) => cap.id === T.estado?.livroExibido?.capId
                ? `<button type="button" class="tb-btn tb-btn-small tb-btn-danger" onclick="tbPararLivro()">⛔ Parar</button>`
                : `<button type="button" class="tb-btn tb-btn-small" onclick="tbExibirCapitulo('${esc(cap.id)}')">📡 Exibir</button>`,
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

async function abrirEstanteJogador() {
    const meus = meusChars();
    if (!meus.length) { toast('⚠️ Você não tem personagem nesta mesa', 'warning'); return; }
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
        window.lvBiblioteca({
            titulo: '📖 Meus Livros',
            cabecalho: troca,
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

async function exibirCapitulo(capId) {
    try {
        // `t` é o que faz o outro lado perceber a troca — inclusive reexibir o
        // mesmo capítulo depois de o jogador ter fechado a janela.
        await setDoc(refEstado(), { livroExibido: { capId, t: Date.now() } }, { merge: true });
        toast('📡 Capítulo exibido para a mesa');
        window.lvRepintar?.();   // o botão vira "parar" onde o mestre está
    } catch (e) { console.error(e); toast('❌ Erro ao exibir o capítulo', 'danger'); }
}

async function pararExibicao() {
    try {
        await setDoc(refEstado(), { livroExibido: null }, { merge: true });
        toast('⛔ Exibição encerrada');
        window.lvRepintar?.();
    } catch (e) { console.error(e); toast('❌ Erro ao encerrar a exibição', 'danger'); }
}

// Chamado a cada snapshot do doc `estado` (tab-main). Só age quando o carimbo
// muda — o doc também carrega canvas ativo e combate, que mudam por outros
// motivos, e reabrir a leitura a cada um deles arrancaria o jogador da página.
let _visto = null;
export function sincLivroExibido(exib) {
    if (T.mode !== 'public') return;        // no secreto quem navega é o mestre, pela estante
    const t = exib?.capId ? (exib.t || 0) : 0;
    if (t === _visto) return;
    const primeira = _visto === null;
    _visto = t;
    if (!t) { if (!primeira && window.lvLeitorAberto?.()) window.lvFechar(); return; }
    window.lvLerCapitulo?.(exib.capId);     // quem chega no meio já abre no capítulo
}
