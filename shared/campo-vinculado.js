/* =====================================================================
   🔗 CAMPO VINCULADO — o livro cita o cadastro, e o cadastro manda
   ---------------------------------------------------------------------
   Um campo vinculado é um pedaço de texto que não é texto: é o valor de
   um campo de uma entidade cadastrada (Raça, Classe, Tribo, Local, NPC…).
   Mudou no cadastro, muda no livro, sem ninguém reescrever capítulo.

   No HTML gravado ele é isto:

       <span class="tm-campo" data-cat="races" data-entity="r_elorin"
             data-campo="expectativaVida" contenteditable="false">180 anos</span>

   E o TEXTO DENTRO DELE É A RESERVA — o último valor conhecido. Não é
   enfeite: é o que sustenta os três estados abaixo.

   OS TRÊS ESTADOS
     1. achou          → escreve o valor fresco e atualiza a reserva
     2. não achou      → mantém a reserva e marca `data-sumiu`, que o CSS
                         pinta como “objeto não encontrado” em vermelho
     3. não deu para ver (offline, leitura negada, rede caída)
                       → mantém a reserva e NÃO marca nada

   O 3 existe por causa do PWA. Offline, “não achei no banco” não significa
   “foi apagado” — significa que não dá para saber. Gritar “objeto não
   encontrado” no metrô seria mentir para o leitor sobre o próprio cânone.
   Por isso este arquivo separa `null` (falhou) de `Map vazio` (leu e não
   tem), e só o segundo acende o aviso.

   `data-sumiu` NÃO sobrevive à gravação: o sanitizador do editor
   (wb-rich-sanitize.js) só deixa passar `data-cat`, `data-entity`,
   `data-campo` e `contenteditable`. O aviso é sempre recalculado, nunca
   herdado — um livro não carrega para sempre a lápide de uma entidade que
   voltou a existir.
   ===================================================================== */

/** Onde cada categoria mora. Mesmo mapa do wb-core (categoryConfig) e do
 *  ecossistema — repetido aqui porque este arquivo é lido por telas que
 *  não carregam nenhum dos dois. */
export const FONTES_CAMPO = {
    // ── Mundo (Escritório do Cronista / Worldbuilding) ──
    npcs:       { col: 'npcs',                     icone: '👥', rotulo: 'NPC', grupo: 'Mundo' },
    factions:   { col: 'worldbuilding-factions',   icone: '⚔️', rotulo: 'Tribo (lore)', grupo: 'Mundo' },
    geography:  { col: 'worldbuilding-geography',  icone: '📍', rotulo: 'Local', grupo: 'Mundo' },
    history:    { col: 'worldbuilding-history',    icone: '📜', rotulo: 'História', grupo: 'Mundo' },
    cultures:   { col: 'worldbuilding-cultures',   icone: '🎭', rotulo: 'Cultura', grupo: 'Mundo' },
    religion:   { col: 'worldbuilding-religion',   icone: '🏛️', rotulo: 'Religião', grupo: 'Mundo' },
    magic:      { col: 'worldbuilding-magic',      icone: '✨', rotulo: 'Escola de Magia', grupo: 'Mundo' },
    properties: { col: 'worldbuilding-properties', icone: '🏠', rotulo: 'Propriedade', grupo: 'Mundo' },
    rumors:     { col: 'worldbuilding-rumors',     icone: '💬', rotulo: 'Rumor', grupo: 'Mundo' },
    lineages:   { col: 'worldbuilding-lineages',   icone: '🌳', rotulo: 'Linhagem', grupo: 'Mundo' },
    feiras:     { col: 'worldbuilding-submundo-feiras', icone: '🕯️', rotulo: 'Feira do Submundo', grupo: 'Mundo' },

    // ── Sistema (Painel do Criador) ──
    races:      { col: 'system/data/races',        icone: '🧬', rotulo: 'Raça', grupo: 'Sistema' },
    classes:    { col: 'system/data/classes',      icone: '⚔️', rotulo: 'Classe', grupo: 'Sistema' },
    /* Tribo MECÂNICA, separada da de lore. Sem categoria própria ela entrava
       na busca pelo pool fundido de `allData.factions` e o resolvedor ia
       procurá-la em `worldbuilding-factions` — não achava, e o token acendia
       "objeto não encontrado" numa tribo que existe. */
    tribesMec:  { col: 'system/data/tribes',       icone: '🏕️', rotulo: 'Tribo (mecânica)', grupo: 'Sistema' },
    peculiarities: { col: 'system/data/peculiarities', icone: '🎲', rotulo: 'Peculiaridade', grupo: 'Sistema' },
    skills:     { col: 'system/data/skills',       icone: '🎯', rotulo: 'Perícia', grupo: 'Sistema' },
    derivedValues: { col: 'system/data/derivedValues', icone: '📐', rotulo: 'Valor Derivado', grupo: 'Sistema' },
    vitalStats: { col: 'system/data/vitalStats',   icone: '❤️', rotulo: 'Status Vital', grupo: 'Sistema' },
    mechanics:  { col: 'system/data/mechanics',    icone: '⚙️', rotulo: 'Mecânica', grupo: 'Sistema' },
    bodyParts:  { col: 'system/data/bodyParts',    icone: '🦴', rotulo: 'Parte do Corpo', grupo: 'Sistema' },
    conditions: { col: 'system/data/conditions',   icone: '🌀', rotulo: 'Condição', grupo: 'Sistema' },
    equipment:  { col: 'system/data/equipment',    icone: '🗡️', rotulo: 'Equipamento', grupo: 'Sistema' },
    itemRules:  { col: 'system/data/itemRules',    icone: '📏', rotulo: 'Regra de Item', grupo: 'Sistema' },
    spells:     { col: 'system/data/spells',       icone: '🔮', rotulo: 'Magia', grupo: 'Sistema' },
    /* Entra mesmo com a coleção vazia hoje: coleção vazia não é coleção
       inexistente, e deixá-la de fora obrigaria a mexer aqui de novo no dia
       em que a primeira manobra for cadastrada. Vazia, ela só não devolve
       resultado — nada quebra. */
    auras:      { col: 'system/data/auras',        icone: '🌟', rotulo: 'Aura', grupo: 'Sistema' },
    castingForms: { col: 'system/data/castingForms', icone: '🗣️', rotulo: 'Forma de Conjuração', grupo: 'Sistema' },
    runicElements: { col: 'system/data/runicElements', icone: '🔯', rotulo: 'Elemento Rúnico', grupo: 'Sistema' },
    /* `titulo`, não `nome` — foi verificado no cadastro. Sem o campo certo o
       seletor listaria uma coluna de "(sem nome)". */
    classModules: { col: 'system/data/classModules', icone: '📦', rotulo: 'Módulo de Classe', grupo: 'Sistema', nomeCampo: 'titulo' },

    // ── Cânone (o próprio Cronista, citando a si mesmo) ──
    /* `title` em inglês, herança do editor. Um livro citar a versão de outro é
       o caso que o versionamento de cânone existe para sustentar. */
    books:      { col: 'worldbuilding-books',      icone: '📗', rotulo: 'Livro', grupo: 'Cânone', nomeCampo: 'title' },
    articles:   { col: 'worldbuilding-articles',   icone: '📄', rotulo: 'Capítulo', grupo: 'Cânone', nomeCampo: 'title' },
};

/* Fora de propósito, com o motivo — para o próximo que for "completar a
   lista" não reabrir a discussão:
     worldbuilding-relations   → aresta de grafo, não tem nome para citar
     submundo-reputacoes       → estado de jogo (o id É o charId)
     containers / items        → instância de mochila, não catálogo
     loja_itens / metas        → comércio do site, não cânone do mundo
     mesas / campaigns         → organização de mesa
     economy-*                 → coleções mortas (regra viva, nenhum leitor)
     knowledge                 → trava de capítulo, não entidade de mundo
     char                      → guarda tudo em `fields.*`; entra quando o
                                 seletor souber achatar (ver ACHATA abaixo)
*/

/** O campo que guarda o nome de exibição desta categoria. */
export const nomeCampoDe = (cat) => FONTES_CAMPO[cat]?.nomeCampo || 'nome';

/** O nome de exibição de uma entidade, seja qual for a categoria. */
export function nomeDe(cat, ent) {
    return String(ent?.[nomeCampoDe(cat)] || ent?.nome || ent?.titulo || ent?.title || '').trim()
        || '(sem nome)';
}

export const SELETOR_CAMPO = '.tm-campo[data-cat][data-entity][data-campo]';

/** O HTML do token, para quem insere (o editor) e para os testes. */
export function tokenHTML({ cat, id, campo, valor }) {
    const at = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    return `<span class="tm-campo" data-cat="${at(cat)}" data-entity="${at(id)}" data-campo="${at(campo)}"`
        + ` contenteditable="false">${at(valor || '—')}</span>`;
}

/**
 * Campos que dá para vincular numa entidade: os escalares de topo com
 * conteúdo. Objeto e lista ficam de fora — vinculado é um pedaço de FRASE,
 * e um array no meio do parágrafo não tem forma boa.
 *
 * Sem esquema por categoria de propósito: cada cadastro tem os campos que
 * tem, e uma lista fixa aqui envelheceria a cada campo novo lá.
 */
export function camposDe(entidade) {
    const fora = new Set(['id', 'ownerUid', 'lastUpdate', 'lastUpdateBy', 'createdAt', 'updatedAt', 'updatedBy', 'imagem', 'imagemUrl']);
    return Object.entries(entidade || {})
        .filter(([k, v]) => !fora.has(k) && !k.startsWith('_')
            && (typeof v === 'string' || typeof v === 'number')
            && String(v).trim() !== '')
        .map(([k, v]) => ({ campo: k, valor: String(v) }));
}

/** O valor de um campo, já em texto. `null` quando a entidade não tem. */
export function valorDe(entidade, campo) {
    const v = entidade?.[campo];
    if (v == null || typeof v === 'object') return null;
    const s = String(v).trim();
    return s === '' ? null : s;
}

/**
 * Resolve todos os campos vinculados dentro de `raiz`.
 *
 * `carregar(cat)` deve devolver `Map(id → entidade)` quando conseguiu ler,
 * e `null` quando NÃO conseguiu. Essa diferença é o estado 2 contra o 3 —
 * devolver um Map vazio numa falha de rede acenderia “objeto não
 * encontrado” em livro nenhum problema.
 *
 * Devolve o que aconteceu, para quem chamou poder contar.
 */
export async function resolverCampos(raiz, carregar, opts = {}) {
    const nos = [...(raiz?.querySelectorAll?.(SELETOR_CAMPO) || [])];
    const conta = { total: nos.length, frescos: 0, sumidos: 0, semRede: 0 };
    if (!nos.length) return conta;

    /* Offline conhecido: nem tenta. A reserva já está na tela e o leitor no
       metrô vê o livro inteiro, sem uma lápide vermelha por parágrafo.

       LIMPA os avisos antes de sair. Sair cedo sem limpar deixaria de pé o
       "objeto não encontrado" de uma leitura anterior — e aí a lápide que
       não devia aparecer offline aparecia mesmo assim, herdada. */
    const online = opts.online ?? (typeof navigator === 'undefined' || navigator.onLine !== false);
    if (!online) {
        nos.forEach(limparAviso);
        conta.semRede = nos.length;
        return conta;
    }

    const porCat = new Map();
    for (const n of nos) {
        const c = n.dataset.cat;
        if (!porCat.has(c)) porCat.set(c, []);
        porCat.get(c).push(n);
    }

    for (const [cat, lista] of porCat) {
        let mapa = null;
        try { mapa = await carregar(cat); } catch (e) { console.warn('[campo-vinculado]', cat, e); mapa = null; }
        for (const n of lista) {
            if (!mapa) { limparAviso(n); conta.semRede++; continue; }
            const ent = mapa.get(n.dataset.entity);
            const v = ent ? valorDe(ent, n.dataset.campo) : null;
            if (v == null) { n.dataset.sumiu = ent ? 'campo' : 'entidade'; conta.sumidos++; continue; }
            limparAviso(n);
            n.textContent = v;   // a reserva vira o valor fresco
            conta.frescos++;
        }
    }
    return conta;
}

function limparAviso(n) { delete n.dataset.sumiu; }

/**
 * Carregador padrão: lê a coleção inteira uma vez por categoria e guarda em
 * memória. Uma leitura por categoria CITADA — capítulo que não cita Raça
 * não paga por Raça.
 *
 * `deps` = { db, collection, getDocs } de quem chama, porque cada tela
 * carrega o SDK do Firebase do seu jeito.
 */
export function carregadorPadrao(deps, cache = new Map()) {
    return async (cat) => {
        if (cache.has(cat)) return cache.get(cat);
        const fonte = FONTES_CAMPO[cat];
        if (!fonte) { cache.set(cat, new Map()); return cache.get(cat); }
        try {
            const snap = await deps.getDocs(deps.collection(deps.db, fonte.col));
            const m = new Map(snap.docs.map(d => [d.id, { id: d.id, ...d.data() }]));
            cache.set(cat, m);
            return m;
        } catch (e) {
            /* NÃO cacheia a falha: a próxima tentativa pode ter rede. Cachear
               `null` transformaria uma queda de segundo em livro quebrado
               pelo resto da sessão. */
            console.warn('[campo-vinculado] falha ao ler', fonte.col, e);
            return null;
        }
    };
}
