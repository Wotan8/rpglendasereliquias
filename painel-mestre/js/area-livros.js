// =============================================
// PAINEL DO MESTRE — 📖 Livros
// ---------------------------------------------
// Estante do que o Escritório do Cronista publicou para o mestre (publicação
// "Mestre" ou "Geral", ver shared/livros-pub.js). Clicar abre o leitor
// compartilhado — o mesmo da ficha e do tabuleiro.
// =============================================
import { db } from './firebase-config.js';
import { livroDoMestre, versaoDoLivro } from '../../shared/livros-pub.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let _pintado = false;

export async function onTabActivated() {
    window.db = window.db || db;      // o leitor compartilhado lê daqui
    if (_pintado) return;             // acervo não muda durante a sessão do mestre
    const el = document.getElementById('livrosLista');
    if (!el || !window.lvCarregarLivros) return;
    try {
        const { livros, caps } = await window.lvCarregarLivros();
        const lista = livros.filter(livroDoMestre)
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.title || '').localeCompare(b.title || ''));
        el.innerHTML = lista.length ? lista.map(l => {
            const n = caps.filter(c => c.bookId === l.id).length;
            return `
            <div class="card" style="display:flex;gap:14px;align-items:center;cursor:pointer;margin-bottom:10px;padding:12px"
                onclick="window.lvAbrirLivroId('${esc(l.id)}')">
                <div style="width:52px;height:70px;flex:none;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:1.6rem;
                    background:${l.cover ? `url('${esc(l.cover)}') center/cover` : 'var(--lr-surface-2,rgba(255,255,255,.06))'}"
                    ${l.cover ? `data-zoom="${esc(l.cover)}" data-zoom-alt="${esc(l.title || '')}" title="Ver a capa maior"` : ''}>${l.cover ? '' : '📖'}</div>
                <div style="flex:1;min-width:0">
                    <div style="font-weight:700">${esc(l.title || 'Livro sem título')}</div>
                    ${l.description ? `<div style="color:var(--muted);font-size:.88rem">${esc(l.description)}</div>` : ''}
                    <div style="color:var(--muted);font-size:.8rem">${versaoDoLivro(l) ? `<b style="color:var(--lr-gold,#D4AF37)">🔖 ${esc(versaoDoLivro(l))}</b> · ` : ''}${n} ${n === 1 ? 'capítulo' : 'capítulos'}</div>
                </div>
                <div style="color:var(--muted)">›</div>
            </div>`;
        }).join('') : `<div style="text-align:center;padding:40px;color:var(--muted)">
            Nenhum livro publicado para o mestre. Marque 🎲 Publicar Mestre no Escritório do Cronista.</div>`;
        _pintado = true;
    } catch (e) {
        console.error('❌ Erro ao carregar a estante:', e);
        el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--danger)">Erro ao carregar os livros.</div>';
    }
}
