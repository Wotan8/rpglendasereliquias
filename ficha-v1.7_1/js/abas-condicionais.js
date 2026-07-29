/* ===== ABAS CONDICIONAIS — Aura, Aliados e Conhecimento =====
   Essas três abas são preenchidas pelo Mestre / pelas Peculiaridades. Quando
   o personagem não tem nada nelas, a aba só ocupa espaço e leva o jogador a
   uma tela vazia. Aqui elas somem enquanto estiverem sem conteúdo.

   Conhecimento carrega sob demanda ("abra esta aba para carregar"), então
   pedimos a carga uma vez no início — senão não dá pra saber se tem livro.

   Reavaliar depois de qualquer render: o Mestre pode conceder uma aura ou um
   aliado com a ficha aberta. */

/** Um container "tem conteúdo" se ganhou elemento além do texto de vazio. */
function _temConteudo(id) {
    const el = document.getElementById(id);
    if (!el) return false;
    // Placeholders do HTML são <div>/<p> só com texto; conteúdo real traz
    // cartão, linha ou lista. Contar elementos com classe resolve os dois.
    return [...el.children].some(f => f.className || f.children.length);
}

function atualizarAbasCondicionais() {
    const dica = document.getElementById('auraEmptyHint');
    const regras = {
        tabAura: (dica && dica.offsetParent !== null)
            ? false
            : _temConteudo('auraMortalidadeContainer') || _temConteudo('aurasPropriedadeContainer'),
        tabAliados: _temConteudo('aliadosGrid'),
        tabConhecimento: _temConteudo('conhecimentoContainer'),
    };

    for (const [alvo, mostrar] of Object.entries(regras)) {
        const btn = document.querySelector(`.tab[data-tab="${alvo}"]`);
        if (!btn) continue;
        // Nunca esconder a aba aberta: o jogador ficaria olhando para o nada.
        if (btn.classList.contains('active')) continue;
        btn.style.display = mostrar ? '' : 'none';
    }
}
window.atualizarAbasCondicionais = atualizarAbasCondicionais;

document.addEventListener('DOMContentLoaded', () => {
    // Carrega a biblioteca uma vez para saber se existe algo a mostrar.
    if (typeof window.carregarConhecimento === 'function') {
        Promise.resolve(window.carregarConhecimento()).catch(() => { }).finally(atualizarAbasCondicionais);
    }
    // Aura e Aliados chegam do Firebase quando chegarem — observar o DOM em
    // vez de reavaliar por tempo. Com prazo fixo, uma resposta lenta deixava a
    // aba escondida tendo conteudo, que e o pior erro possivel aqui.
    const alvos = ['auraMortalidadeContainer', 'aurasPropriedadeContainer',
        'aliadosGrid', 'conhecimentoContainer', 'auraEmptyHint'];
    const obs = new MutationObserver(atualizarAbasCondicionais);
    for (const id of alvos) {
        const el = document.getElementById(id);
        if (el) obs.observe(el, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
    }
    atualizarAbasCondicionais();
});
