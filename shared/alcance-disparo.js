// =============================================
// 🏹 ALCANCE DO DISPARO — decisão pura
// ---------------------------------------------
// Duas coisas diferentes limitam um tiro, e o sistema precisava das duas:
//
//   · a ARMA tem uma capacidade — até onde a peça consegue lançar (`alcanceM`);
//   · o ATIRADOR tem um braço — quem não tem Força não arma o arco inteiro.
//
// O alcance real é o MENOR dos dois. Um Arco Longo de 60 m na mão de FOR 1
// atira 10 m: a arma consegue, o sujeito não.
//
// METROS_POR_FOR = 10 não é número solto: é o Deslocamento Terrestre da linha
// de base (o mesmo 10 m que uma Ação de Movimento inteira percorre). Um ponto
// de Força vale um Deslocamento de alcance.
//
// BESTA é a exceção, e por isso o cadastro tem `ignoraLimiteForDisparo`: ela é
// armada com manivela ou estribo ANTES do tiro, então a força do braço no
// momento do disparo não entra. É o que dá à besta a identidade de "a arma de
// tiro de quem não tem Força".
//
// Sem Firestore e sem tela.
// =============================================

/** Metros de alcance que cada ponto de FOR sustenta. */
export const METROS_POR_FOR = 10;

/**
 * Até onde ESTA arma, nas mãos DESTE atirador, chega.
 *
 * @param arma { alcanceM, ignoraLimiteForDisparo }
 * @param forca valor de FOR na ficha
 * @returns { metros, limitadoPorFor, capacidadeDaArma, limiteDoBraco }
 */
export function alcanceDeDisparo(arma, forca) {
    const capacidade = Math.max(0, Number(arma?.alcanceM) || 0);
    if (!capacidade) return { metros: 0, limitadoPorFor: false, capacidadeDaArma: 0, limiteDoBraco: 0 };

    // Besta: armada por manivela antes do tiro, o braço não entra na conta.
    if (arma?.ignoraLimiteForDisparo) {
        return { metros: capacidade, limitadoPorFor: false, capacidadeDaArma: capacidade, limiteDoBraco: Infinity };
    }

    const limite = Math.max(0, Number(forca) || 0) * METROS_POR_FOR;
    return {
        metros: Math.min(capacidade, limite),
        limitadoPorFor: limite < capacidade,
        capacidadeDaArma: capacidade,
        limiteDoBraco: limite,
    };
}

/**
 * O disparo mais longo que este atirador tem em mãos.
 * Recebe as LINHAS DE ATAQUE já prontas (que trazem `distancia` e `alcanceM`).
 *
 * @returns { metros, arma, limitadoPorFor } — `arma` é a que rendeu o maior
 *          alcance, para a tela poder dizer de onde saiu o número.
 */
export function melhorDisparo(linhas, forca) {
    let melhor = { metros: 0, arma: null, limitadoPorFor: false };
    for (const l of linhas || []) {
        if (!l?.distancia) continue;
        const a = alcanceDeDisparo(l, forca);
        if (a.metros > melhor.metros) {
            melhor = { metros: a.metros, arma: l.nome || null, limitadoPorFor: a.limitadoPorFor };
        }
    }
    return melhor;
}

/**
 * Transforma inventário cru em linhas de disparo — o formato que
 * `melhorDisparo` lê. Serve à ficha de personagem E à de NPC: as duas guardam
 * item e modelo do mesmo jeito, e antes cada uma resolvia isso por conta.
 *
 * Item LEGADO guarda o modelo em `origemTemplateId` em vez de `modeloId`; sem
 * cobrir os dois, uma besta antiga perderia o alcance em silêncio.
 *
 * @param itens   [{ nome, equipado, modeloId|origemTemplateId, ...campos }]
 * @param catalog [{ id, categoriaArma, alcanceM, ignoraLimiteForDisparo }]
 */
export function linhasDeDisparo(itens, catalog) {
    const cat = catalog || [];
    const tplDe = i => cat.find(t => t.id === (i.modeloId || i.origemTemplateId));
    // Instância vence modelo, mas só quando ela REALMENTE tem valor: 0 e ''
    // são "não preenchido" aqui, não "zero de propósito".
    const campo = (i, k) => {
        const v = i[k];
        if (v !== undefined && v !== null && v !== '') return v;
        return tplDe(i)?.[k];
    };
    return (itens || [])
        .filter(i => i && i.equipado && campo(i, 'categoriaArma') === 'distancia')
        .map(i => ({
            nome: i.nome || 'Arma',
            distancia: true,
            alcanceM: Number(campo(i, 'alcanceM')) || 0,
            ignoraLimiteForDisparo: !!campo(i, 'ignoraLimiteForDisparo'),
        }));
}
