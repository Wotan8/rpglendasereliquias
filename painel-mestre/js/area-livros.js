// =============================================
// PAINEL DO MESTRE — 📖 Livros
// ---------------------------------------------
// Estante do que o Escritório do Cronista publicou para o mestre (publicação
// "Mestre" ou "Geral", ver shared/livros-pub.js). Clicar abre o leitor
// compartilhado — o mesmo da ficha e do tabuleiro.
//
// Esta tela desenhava a própria lista de cards, achatada, e por isso divergia
// do Escritório: sem estante, sem selo padronizado. Agora usa o renderizador
// compartilhado (shared/livro-vinculado.js → lvEstantesHTML) com o desenho de
// shared/acervo.css. Livro em várias estantes aparece nas várias, e o que não
// tem estante fica em "Todos os livros" — igualzinho ao Escritório.
// =============================================
import { db } from './firebase-config.js';
import { livroDoMestre } from '../../shared/livros-pub.js';

let _pintado = false;

export async function onTabActivated() {
    window.db = window.db || db;      // o leitor compartilhado lê daqui
    if (_pintado) return;             // acervo não muda durante a sessão do mestre
    const el = document.getElementById('livrosLista');
    if (!el || !window.lvCarregarLivros) return;
    try {
        const { livros, caps, estantes } = await window.lvCarregarLivros();
        const itens = livros.filter(livroDoMestre)
            .map(l => ({ l, n: caps.filter(c => c.bookId === l.id).length }))
            .sort((a, b) => (a.l.order ?? 0) - (b.l.order ?? 0)
                || (a.l.title || '').localeCompare(b.l.title || ''));

        el.innerHTML = itens.length
            ? window.lvEstantesHTML(itens, estantes)
            : `<div style="text-align:center;padding:40px;color:var(--muted)">
                Nenhum livro publicado para o mestre. Marque 🎲 Publicar Mestre no Escritório do Cronista.</div>`;
        _pintado = true;
    } catch (e) {
        console.error('❌ Erro ao carregar a estante:', e);
        el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--danger)">Erro ao carregar os livros.</div>';
    }
}
