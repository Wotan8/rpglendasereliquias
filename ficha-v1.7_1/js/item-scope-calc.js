/* ===== ITEM SCOPE CALC — Totais de Valores Derivados por item equipado =====
 *
 * Funções PURAS: recebem tudo por parâmetro, não tocam DOM nem `state`.
 * Isso é o que permite o autoteste em __check-item-scope.js rodar no node.
 *
 * Um Valor Derivado marcado no Painel do Criador com `escopoItem`:
 *   'coluna'      → ganha coluna própria em "Ataques e Efeitos Ativos"
 *   'dano'        → concatena na Fórmula de Dano do item (ex: 1d10 → 1d10+5)
 *   'dano-canal'  → parcela de uma Essência, devolvida SEPARADA em `canais`
 *
 * Canal NÃO entra na fórmula física. Cada Essência é um golpe paralelo que o
 * alvo reduz com a Blindagem daquela cor, não com a Blindagem física — somar
 * tudo num número só faria a Blindagem comum absorver dano elemental. A ficha
 * só sabe a parcela do atacante; a subtração acontece do lado do alvo.
 *
 * Total por item = base global + delta daquele item.
 *   base  = state.derived[key], que já reúne raça/classe/peculiaridade/condição
 *   delta = state.itemBonuses[item.id], preenchido com o escopo ligado
 */

/**
 * Aplica os modificadores do bag de um item sobre um valor base.
 * Mesma ordem de _applyMechanicModifiers (derived-values.js): SET, soma, ×, ÷.
 */
function applyItemBag(base, dvKey, bag) {
    let v = Number(base) || 0;
    if (!bag) return v;

    const t = `DERIVED:${dvKey}`;
    if (bag[`SET:${t}`] !== undefined) v = Number(bag[`SET:${t}`]) || 0;
    v += (Number(bag[t]) || 0);
    if (bag[`MULT:${t}`]) v = Math.floor(v * Number(bag[`MULT:${t}`]));
    if (bag[`DIV:${t}`]) v = Math.floor(v / Number(bag[`DIV:${t}`]));
    return v;
}

/** Fórmula de dano do item: a da instância vence a do modelo do catálogo. */
function getItemFormulaDano(item, catalog) {
    if (!item) return '';
    if (item.formulaDano) return String(item.formulaDano).trim();
    if (item.modeloId && Array.isArray(catalog)) {
        const tpl = catalog.find(t => t.id === item.modeloId);
        if (tpl && tpl.formulaDano) return String(tpl.formulaDano).trim();
    }
    return '';
}

/** Formata um número para exibição: inteiro puro, senão até 2 casas decimais. */
function _fmtNum(v) {
    return Number.isInteger(v) ? v : parseFloat(Number(v).toFixed(2));
}

/**
 * Calcula os valores escopados de UM item.
 *
 * @param {object} item          instância do item
 * @param {object} ctx
 * @param {Array}  ctx.derivedValues  window.DERIVED_VALUES
 * @param {object} ctx.derived        state.derived (bases globais)
 * @param {object} ctx.itemBonuses    state.itemBonuses
 * @param {Array}  ctx.catalog        window._inventoryState.catalog
 * @returns {{ dano: string, canais: Array, colunas: Array, temAlgo: boolean }}
 */
function computeItemScopedTotals(item, ctx) {
    ctx = ctx || {};
    const dvs = Array.isArray(ctx.derivedValues) ? ctx.derivedValues : [];
    const derived = ctx.derived || {};
    const bag = (ctx.itemBonuses || {})[item && item.id] || {};

    const colunas = [];
    let canais = [];
    let somaDano = 0;
    let temBonusDano = false;

    for (const dv of dvs) {
        if (!dv || !dv.escopoItem) continue;

        const base = Number(derived[dv.key]) || 0;
        const total = applyItemBag(base, dv.key, bag);
        const bonus = total - base;

        if (dv.escopoItem === 'dano') {
            somaDano += total;
            if (bonus !== 0) temBonusDano = true;
            continue;
        }

        if (dv.escopoItem === 'dano-canal') {
            // Canal zerado não é canal: só polui o golpe.
            if (total !== 0) {
                canais.push({
                    key: dv.key, nome: dv.nome, icone: dv.icone || '💥',
                    total: _fmtNum(total),
                });
            }
            if (bonus !== 0) temBonusDano = true;
            continue;
        }

        colunas.push({
            key: dv.key,
            nome: dv.nome,
            icone: dv.icone || '📊',
            prefixo: dv.prefixo || '',
            sufixo: dv.sufixo || '',
            base: _fmtNum(base),
            bonus: _fmtNum(bonus),
            total: _fmtNum(total),
        });
    }

    // Fórmula de dano: dado do item + soma dos DVs marcados como 'dano'.
    // SEM fórmula não há dano: um escudo não causa dano só porque o personagem
    // tem bônus global de dano. O bônus só significa algo grudado num dado.
    const formula = getItemFormulaDano(item, ctx.catalog);
    const somaFmt = _fmtNum(somaDano);
    let dano = '';
    if (formula) dano = somaFmt !== 0 ? `${formula}${somaFmt > 0 ? '+' : ''}${somaFmt}` : formula;

    // Mesma regra dos canais: sem dado não há golpe onde pendurar a parcela.
    if (!formula) canais = [];

    // Armadilha comum: item que concede bônus de dano mas não tem fórmula — o
    // bônus fica preso a ele e não aparece em lugar nenhum. Para somar no dano
    // de TODAS as armas, use um Valor Derivado global, ou uma mecânica com
    // "Escopo de Aplicação: nos itens equipados" filtrando as armas.
    if (!formula && temBonusDano && typeof console !== 'undefined') {
        console.warn(
            `⚠️ "${item && item.nome || item && item.id}" concede bônus de Dano mas não tem ` +
            `Fórmula de Dano — o bônus não será exibido. Preencha a Fórmula de Dano do item, ` +
            `ou aplique o bônus via mecânica com Escopo de Aplicação "nos itens equipados".`
        );
    }

    // Item só entra na tabela se contribuir com algo próprio: uma fórmula de
    // dano ou algum delta numa coluna. Armadura neutra fica fora.
    const temAlgo = !!formula || colunas.some(c => c.bonus !== 0);

    return { dano, canais, colunas, temAlgo };
}

// Exposto para o browser (script tag) e para o node (autoteste)
if (typeof window !== 'undefined') {
    window.computeItemScopedTotals = computeItemScopedTotals;
    window.getItemFormulaDano = getItemFormulaDano;
    window.applyItemBag = applyItemBag;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { computeItemScopedTotals, getItemFormulaDano, applyItemBag };
}
