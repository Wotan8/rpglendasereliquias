// =============================================
// TABULEIRO — 📖 Livros do Cronista
// ---------------------------------------------
// Mestre abre a estante (livros com publicação "Mestre" ou "Geral") e exibe um
// capítulo para a mesa inteira.
//
// CUSTO: a exibição é UM campo (`livroExibido`) no doc que todo mundo já
// escuta — tabuleiro-meta/estado. Nada de listener novo, nada de objeto no
// canvas, nada de HTML de capítulo trafegando no doc: vai só o id, e cada
// aparelho busca o capítulo (2 leituras) apenas quando ele muda. O leitor em si
// é o shared/livro-vinculado.js, o mesmo da ficha.
// =============================================
import { db, setDoc } from '../../painel-mestre/js/firebase-config.js';
import { T, toast, esc } from './tab-state.js';
import { refEstado } from './tab-main.js';
import { livroDoMestre } from '../../shared/livros-pub.js';

export function initLivros() {
    window.db = window.db || db;             // o leitor compartilhado lê daqui
    window.tbAbrirLivros = abrirEstante;
    window.tbExibirCapitulo = exibirCapitulo;
    window.tbPararLivro = pararExibicao;
}

function abrirEstante() {
    if (T.mode !== 'secret' || !T.isMaster) return;
    if (!window.lvBiblioteca) { toast('❌ Leitor de livros não carregou', 'danger'); return; }
    window.lvBiblioteca({
        titulo: '📖 Livros do Cronista',
        filtro: livroDoMestre,
        acaoCapitulo: (cap) => cap.id === T.estado?.livroExibido?.capId
            ? `<button type="button" class="tb-btn tb-btn-small tb-btn-danger" onclick="tbPararLivro()">⛔ Parar</button>`
            : `<button type="button" class="tb-btn tb-btn-small" onclick="tbExibirCapitulo('${esc(cap.id)}')">📡 Exibir</button>`,
    });
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
