/* =====================================================================
   📖 PUBLICAÇÃO DE LIVRO — quem enxerga cada livro do Cronista
   ---------------------------------------------------------------------
   Um livro tem QUATRO publicações independentes, marcadas no Escritório
   do Cronista (⚙️ Editar livro):

     geral       → todo lugar que lista livros (inclusive a ficha)
     conhGeral   → aba Conhecimento de TODOS os personagens
     conhVinculo → aba Conhecimento de quem tem vínculo com o livro
     mestre      → Painel do Mestre e Tabuleiro

   Livro antigo tinha só `public: true`, e isso significava exatamente
   "aparece na ficha de quem tem vínculo" (o mestre sempre enxergou tudo).
   É esse o mapeamento do legado — sem migração, toda leitura passa aqui.

   Publicação é sobre o LIVRO. O que trava capítulo a capítulo continua
   sendo a aba Conhecimento do Painel do Criador (system/data/knowledge),
   avaliada em conhecimento-calc.js.
   ===================================================================== */

/** [chave, rótulo, explicação] — a ordem é a que aparece no formulário. */
export const PUBLICACOES = [
    ['geral',       '🌐 Publicar Geral',                'Visível em todo lugar que exibe livros'],
    ['conhGeral',   '📚 Publicar Conhecimento Geral',   'Aparece na ficha de TODOS os personagens'],
    ['conhVinculo', '🔗 Publicar Conhecimento Vínculo', 'Aparece na ficha de quem está vinculado ao livro'],
    ['mestre',      '🎲 Publicar Mestre',               'Aparece para o mestre no Painel e no Tabuleiro'],
];

/** As quatro marcações do livro, sempre completas (legado incluído). */
export function pubDoLivro(livro) {
    const p = livro && livro.pub;
    if (p && typeof p === 'object') {
        return { geral: !!p.geral, conhGeral: !!p.conhGeral, conhVinculo: !!p.conhVinculo, mestre: !!p.mestre };
    }
    const legado = !!(livro && livro.public);
    return { geral: false, conhGeral: false, conhVinculo: legado, mestre: true };
}

/**
 * O livro entra na aba Conhecimento deste personagem?
 * `vinculado` = raça / classe / tribo / peculiaridade dele aponta para o livro.
 */
export function livroNaFicha(livro, vinculado) {
    const p = pubDoLivro(livro);
    return p.geral || p.conhGeral || (p.conhVinculo && !!vinculado);
}

/** O livro entra nas listas do mestre (Painel do Mestre e Tabuleiro)? */
export function livroDoMestre(livro) {
    const p = pubDoLivro(livro);
    return p.mestre || p.geral;
}

/**
 * 🔖 VERSÃO DO LIVRO — o selo que o leitor vê ANTES de abrir.
 *
 * O campo é texto livre (`versao`), escrito pelo autor no Escritório do
 * Cronista a cada revisão: cabe "2", "2.1", "3 — revisão de combate" ou
 * "Ed. revista". Quem manda no formato é o autor; aqui só normalizamos a
 * exibição, para que as sete telas que listam livro mostrem a MESMA coisa.
 *
 * Um "v" é prefixado quando o autor não escreveu letra nenhuma na frente
 * ("2.1" → "v2.1"), e respeitado quando escreveu ("Ed. revista" fica como
 * está). Livro sem versão devolve '' — e aí nenhuma tela desenha selo, que
 * é o certo: os 13 livros que já existem não nascem com selo mentiroso.
 */
export function versaoDoLivro(livro) {
    const v = String(livro?.versao ?? '').trim();
    if (!v) return '';
    return /^[a-zà-ú]/i.test(v) ? v : 'v' + v;
}
