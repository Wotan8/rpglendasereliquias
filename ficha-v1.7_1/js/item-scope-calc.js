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

/** Rótulos do tipo de golpe físico. É o que diz qual das três Blindagens
 *  tipadas do alvo (Cortante, Perfurante, Contundente) barra este dano. */
const TIPOS_GOLPE = {
    cortante: { nome: 'Cortante', icone: '🗡️' },
    perfurante: { nome: 'Perfurante', icone: '🏹' },
    contundente: { nome: 'Contundente', icone: '🔨' },
};

/** Tipos de golpe do item (1 OU MAIS — machado de guerra corta E esmaga):
 *  instância vence modelo. O cadastro novo grava lista; docs antigos guardam
 *  string única — os dois entram, na ordem cadastrada, sem repetição. */
function getItemTiposGolpe(item, catalog) {
    if (!item) return [];
    let t = item.tipoGolpe;
    if ((t == null || t === '' || (Array.isArray(t) && !t.length)) && item.modeloId && Array.isArray(catalog)) {
        const tpl = catalog.find(x => x.id === item.modeloId);
        if (tpl) t = tpl.tipoGolpe;
    }
    const lista = Array.isArray(t) ? t : (t ? [t] : []);
    const vistos = new Set();
    const out = [];
    for (const x of lista) {
        const chave = String(x || '').toLowerCase().trim();
        if (!TIPOS_GOLPE[chave] || vistos.has(chave)) continue;
        vistos.add(chave);
        out.push({ chave, ...TIPOS_GOLPE[chave] });
    }
    return out;
}

/** Compat: quem ainda espera UM tipo recebe o primeiro da lista. */
function getItemTipoGolpe(item, catalog) {
    return getItemTiposGolpe(item, catalog)[0] || null;
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

    // Sem dado não há golpe: o tipo só significa algo grudado numa fórmula.
    const tiposGolpe = formula ? getItemTiposGolpe(item, ctx.catalog) : [];

    return { dano, tiposGolpe, tipoGolpe: tiposGolpe[0] || null, canais, colunas, temAlgo };
}

/**
 * Linhas de golpe desarmado — uma por parte do corpo que golpeia e está com as
 * mãos livres. Mesmo formato das linhas de item, para a tabela de Ataques
 * desenhar os dois do mesmo jeito.
 *
 * NADA de regra cravada aqui: o dado (`formulaDano`), os tipos (`tipoGolpe`)
 * e os vínculos de VD do golpe vêm do CADASTRO de Partes do Corpo, que os
 * hosts entregam em cada slot. Parte sem dado e sem vínculo não vira linha —
 * mesma regra do item sem fórmula.
 *
 * A parte pode vincular Valores Derivados com equação, igual a um equipamento:
 * o bag dela entra por cima da base do personagem, então a Perna sobe o Dano do
 * chute sem mexer no soco. Sem vínculo, a coluna é a base pura (bonus 0).
 *
 * Duas partes de mesmo nome e mesmos números viram UMA linha com `qtd`: mão
 * esquerda e direita socam igual, listar as duas é ruído. Basta um vínculo ou
 * um item numa delas para os números divergirem e as linhas se separarem.
 *
 * @param {object} ctx
 * @param {Array}  ctx.derivedValues  window.DERIVED_VALUES
 * @param {object} ctx.derived        state.derived (bases globais)
 * @param {object} ctx.bodySlots      slotKey → {label, parte, icon, partId, podeGolpear,
 *                                    formulaDano, tiposGolpe} — os três últimos do cadastro
 * @param {Iterable} ctx.slotsOcupados slotKeys tomados por item equipado
 * @param {object} ctx.parteBonuses   partId → bag, no formato de state.itemBonuses
 * @returns {Array} { desarmado, slotKey, qtd, nome, icone, dano, tipoGolpe, tiposGolpe, canais, colunas }
 */
function computeGolpesDesarmados(ctx) {
    ctx = ctx || {};
    const dvs = Array.isArray(ctx.derivedValues) ? ctx.derivedValues : [];
    const derived = ctx.derived || {};
    const bodySlots = ctx.bodySlots || {};
    const ocupados = new Set(ctx.slotsOcupados || []);
    const parteBonuses = ctx.parteBonuses || {};

    const livres = Object.keys(bodySlots)
        .filter(k => bodySlots[k] && bodySlots[k].podeGolpear && !ocupados.has(k));
    if (livres.length === 0) return [];

    // Mão 1 e Mão 2 são a mesma parte: resolve o bag dela uma vez só.
    const porParte = {};
    const golpeDaParte = slot => {
        if (porParte[slot.partId]) return porParte[slot.partId];
        const bag = parteBonuses[slot.partId] || null;
        const colunas = [];
        let somaDano = 0;
        for (const dv of dvs) {
            if (!dv || !dv.escopoItem) continue;
            const base = _fmtNum(Number(derived[dv.key]) || 0);
            const total = _fmtNum(applyItemBag(base, dv.key, bag));
            if (dv.escopoItem === 'dano') { somaDano += total; continue; }
            if (dv.escopoItem === 'dano-canal') continue;  // canal é da arma, não do punho
            colunas.push({
                key: dv.key, nome: dv.nome, icone: dv.icone || '📊',
                prefixo: dv.prefixo || '', sufixo: dv.sufixo || '',
                base, bonus: _fmtNum(total - base), total,
            });
        }
        // O dado vem do cadastro da parte. Sem dado não há dano — o bônus
        // global de Dano só significa algo grudado num dado, como no item.
        const formula = String(slot.formulaDano || '').trim();
        const soma = _fmtNum(somaDano);
        let dano = '';
        if (formula) dano = soma !== 0 ? `${formula}${soma > 0 ? '+' : ''}${soma}` : formula;
        porParte[slot.partId] = {
            colunas, dano,
            tiposGolpe: formula ? getItemTiposGolpe({ tipoGolpe: slot.tiposGolpe }) : [],
        };
        return porParte[slot.partId];
    };

    const linhas = [];
    const porAssinatura = {};
    for (const slotKey of livres) {
        const slot = bodySlots[slotKey];
        const golpe = golpeDaParte(slot);
        // Parte sem dado e sem delta próprio não é golpe: nada a exibir.
        if (!golpe.dano && !golpe.colunas.some(c => c.bonus !== 0)) continue;
        const parte = slot.parte || slot.label || slotKey;
        // Nome fora da assinatura de propósito: "Mão 1" e "Mão 2" só juntam
        // porque a PARTE é a mesma; parte diferente com número igual não junta.
        const assinatura = JSON.stringify([parte, golpe.dano, golpe.colunas.map(c => c.total)]);

        const igual = porAssinatura[assinatura];
        if (igual) { igual.qtd++; continue; }

        const linha = {
            desarmado: true,
            slotKey,
            qtd: 1,
            parte,
            nome: slot.label || slotKey,
            icone: slot.icon || '👊',
            dano: golpe.dano,
            tipoGolpe: golpe.tiposGolpe[0] || null,
            tiposGolpe: golpe.tiposGolpe,
            canais: [],
            colunas: golpe.colunas,
        };
        porAssinatura[assinatura] = linha;
        linhas.push(linha);
    }

    // Linha que juntou perde o número do slot: "Mão 1" viraria mentira com ×2.
    for (const l of linhas) if (l.qtd > 1) l.nome = l.parte;
    return linhas;
}

// Exposto para o browser (script tag) e para o node (autoteste)
if (typeof window !== 'undefined') {
    window.computeItemScopedTotals = computeItemScopedTotals;
    window.computeGolpesDesarmados = computeGolpesDesarmados;
    window.getItemFormulaDano = getItemFormulaDano;
    window.getItemTipoGolpe = getItemTipoGolpe;
    window.getItemTiposGolpe = getItemTiposGolpe;
    window.applyItemBag = applyItemBag;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { computeItemScopedTotals, computeGolpesDesarmados, getItemFormulaDano, getItemTipoGolpe, getItemTiposGolpe, applyItemBag };
}
