/* =====================================================================
   📚 ALCANCE DE LIVROS DO PERSONAGEM — a conta, fora da ficha
   ---------------------------------------------------------------------
   Quais livros um personagem enxerga por VÍNCULO: raça, classe, tribo,
   peculiaridade, ou amarração direta feita pelo mestre.

   POR QUE ISTO SAIU DE DENTRO DA FICHA. A conta morava em
   `_livrosDoPersonagem()` (ficha-v1.7_1/js/conhecimento.js) e lia o DOM —
   `document.querySelector('[data-key="raca"]').value`. Isso a prendia à
   ficha aberta: nenhuma outra tela conseguia responder "quem enxerga este
   livro?", e por isso o aviso de versão do Cronista não alcançava os
   jogadores de livro só-de-vínculo (ver shared/avisar-livro.js).

   Aqui a conta é PURA: entra dado, sai `Map`. A ficha continua chamando
   com o que está no DOM (é o valor vivo, e é o certo para ela); o Cronista
   chama com o que está no doc do personagem.

   O ESPELHO. `idsDoAlcance()` devolve a lista achatada que o doc `char`
   guarda em `livrosAlcance`. É ESPELHO, não verdade: a verdade continua
   sendo `livrosVinculados` na raça/classe/tribo/peculiaridade. Quem lê o
   espelho precisa tratar "sem campo" como DESCONHECIDO — ficha que ainda
   não foi salva desde esta mudança não tem o campo, e concluir "não
   alcança nada" dela seria inventar uma resposta.
   ===================================================================== */

/**
 * Vínculos da entidade, sempre como array. O array novo manda quando
 * existe (mesmo vazio); sem ele, cai no objeto único do formato legado.
 *
 * ⚠️ Existe uma segunda cópia disto em shared/livro-vinculado.js
 * (`normalizar`). É deliberado: aquele arquivo é script CLÁSSICO e usa a
 * função de forma síncrona ao montar HTML, então não pode importar daqui.
 * São quatro linhas sobre um FORMATO de dado, que muda quase nunca — mas
 * se mudar, mudam as duas.
 */
export function normalizarVinculos(entidade) {
    const lista = Array.isArray(entidade?.livrosVinculados)
        ? entidade.livrosVinculados
        : (entidade?.livroVinculado ? [entidade.livroVinculado] : []);
    return lista.filter(v => v && v.bookId);
}

/**
 * O alcance do personagem.
 *
 * `p`  → { raca, classe, tribo, peculiaridades: [], livrosVinculados }
 *        (nomes ou ids em raca/classe/tribo — as duas formas são aceitas,
 *        porque a ficha grava o NOME e o cadastro conhece o id)
 * `sd` → { races, classes, tribes, peculiarities } do Painel do Criador
 *
 * Devolve `Map(bookId → Set(capituloIds) | null)`, onde `null` significa
 * "o livro inteiro". O `Map` carrega ainda `.diretos`, o conjunto dos
 * livros amarrados DIRETO no personagem pelo mestre — esses passam por
 * cima da regra de publicação, porque ele escolheu a dedo quem lê.
 */
export function alcanceDoPersonagem(p, sd) {
    const dados = sd || {};
    const acha = (lista, nome) => nome && (lista || []).find(d => d.nome === nome || d.id === nome);

    const raca = acha(dados.races, p?.raca);
    const classe = acha(dados.classes, p?.classe);
    const tribo = acha(dados.tribes, p?.tribo);
    const fontes = [p || null, raca, classe, tribo];   // o próprio personagem entra: é onde o mestre amarra livro a dedo

    /* Peculiaridade também carrega livro — e chega por DOIS caminhos.
       Cobrir só um seria repetir o meio-caminho que existia aqui: a conta
       listava peculiaridade como fonte, mas lia um campo que a ficha nunca
       grava, então livro amarrado a peculiaridade não chegava em ninguém. */
    const idsPec = new Set();
    // 1. avulsa, escolhida na criação — `{id, nivelInicial}` ou o id cru.
    for (const it of (p?.peculiaridades || [])) {
        const id = (it && typeof it === 'object') ? (it.id || it.nome || it.key) : it;
        if (id) idsPec.add(id);
    }
    // 2. concedida por raça, classe ou tribo.
    for (const fonte of [raca, classe, tribo]) {
        for (const id of (fonte?.peculiaridadeIds || [])) if (id) idsPec.add(id);
    }
    for (const id of idsPec) fontes.push(acha(dados.peculiarities, id));

    const mapa = new Map();
    mapa.diretos = new Set(normalizarVinculos(p).map(v => v.bookId));
    for (const f of fontes) {
        for (const lv of normalizarVinculos(f)) {
            const caps = Array.isArray(lv.capituloIds) ? lv.capituloIds.filter(Boolean) : [];
            if (!mapa.has(lv.bookId)) mapa.set(lv.bookId, caps.length ? new Set(caps) : null);
            else if (mapa.get(lv.bookId) && caps.length) caps.forEach(c => mapa.get(lv.bookId).add(c));
            else mapa.set(lv.bookId, null);   // outra fonte libera o livro inteiro
        }
    }
    return mapa;
}

/** A lista achatada e ORDENADA que vira o espelho. Ordenada para poder ser
 *  comparada com a anterior sem falso positivo de ordem. */
export function idsDoAlcance(mapa) {
    return [...mapa.keys()].sort();
}

/** Extrai o formato que `alcanceDoPersonagem` espera de um doc `char`. */
export function personagemDoDoc(doc) {
    const f = doc?.fields || {};
    return {
        raca: f.raca || '',
        classe: f.classe || '',
        tribo: f.tribo || '',
        /* `peculiaridadesIndividuais` é o campo que a ficha REALMENTE grava
           (ficha-v1.7_1/js/storage.js, gatherData). A conta lia
           `peculiarities`, que nunca foi escrito em lugar nenhum — o array
           vinha sempre vazio e a fonte era código morto. */
        peculiaridades: doc?.peculiaridadesIndividuais || [],
        livrosVinculados: doc?.livrosVinculados,
        livroVinculado: doc?.livroVinculado,
    };
}

/**
 * O espelho gravado neste doc, ou `null` quando ele não tem espelho.
 *
 * `null` NÃO é "não alcança nada": é "não dá para saber daqui". Ficha que
 * não foi salva desde que o espelho passou a existir cai aqui, e tratar
 * isso como zero deixaria o jogador de fora do aviso justamente por não
 * ter aberto a ficha.
 */
export function alcanceGravado(doc) {
    return Array.isArray(doc?.livrosAlcance) ? doc.livrosAlcance : null;
}
