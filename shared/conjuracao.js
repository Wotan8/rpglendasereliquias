// =============================================
// 🪄 FORMAS DE CONJURAÇÃO — decisão pura
// ---------------------------------------------
// Magia não sai de arma nem de perna: sai de uma voz, de um foco, de um
// instrumento. Quem declara isso é o módulo da classe — cada coluna marcada
// como "forma de conjurar" no Criador aponta o Valor Derivado que dá o Acerto.
// (No Bardo são quatro: Vocal, Corda, Percussão, Sopro. O "[V, S]" no nome da
// magia é só a legenda humana de quais colunas estão preenchidas.)
//
// O cadastro `castingForms` acrescenta o que a forma EXIGE (item com certa tag,
// parte do corpo inteira) e que CONDIÇÕES a impedem — é o que transforma o
// "não pode falar" do Afogando em regra executável.
//
// Este arquivo NÃO fala com o Firestore e não desenha nada: recebe o que já foi
// lido e decide. É por isso que dá para testar sem subir mesa nenhuma.
// =============================================

const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

/** A Forma cadastrada que cobre este Valor Derivado (ou null). */
export function formaDoVd(formas, vdId) {
    return (formas || []).find(f => (f.derivedValueIds || []).includes(vdId)) || null;
}

/**
 * Decide, para cada veículo declarado pela magia, se dá para conjurar por ele.
 *
 * @param veiculos [{ vdId, label, vdNome }] — as colunas marcadas do item
 * @param formas   registro `castingForms`
 * @param ctx {
 *   acertoDoVd: (vdNome) => number|null,   valor do VD na ficha
 *   condicoes: [nomes das condições ativas no conjurador],
 *   condicaoPorId: (id) => nome|null,      o registro guarda id, o token guarda nome
 *   itensEquipados: [{ nome, tags: [] }],
 *   partesInteiras: [nomes das partes do corpo utilizáveis],
 * }
 * @returns [{ nome, icone, acerto, indisponivel, comItem }] — `indisponivel`
 *          preenchido significa "aparece, mas dizendo por que não dá".
 */
export function avaliarFormas(veiculos, formas, ctx = {}) {
    const cond = (ctx.condicoes || []).map(norm);
    const itens = ctx.itensEquipados || [];
    const partes = (ctx.partesInteiras || []).map(norm);

    return (veiculos || []).map(v => {
        const forma = formaDoVd(formas, v.vdId);
        const nome = forma?.nome || v.label || 'Forma';
        const acerto = ctx.acertoDoVd ? ctx.acertoDoVd(v.vdNome || nome) : null;

        let indisponivel = '';
        let comItem = '';

        // 1) condição que impede — a voz calada pelo Afogando
        const bloqueiam = (forma?.condicoesBloqueiam || [])
            .map(id => (ctx.condicaoPorId ? ctx.condicaoPorId(id) : null))
            .filter(Boolean);
        const ativa = bloqueiam.find(n => cond.includes(norm(n)));
        if (ativa) indisponivel = `${ativa} impede`;

        // 2) item equipado com a tag certa — a Rabeca para Inst. Corda
        if (!indisponivel && forma?.requisito === 'item_tag') {
            const tags = (forma.itemTags || []).map(norm);
            const achado = itens.find(i => (i.tags || []).some(t => tags.includes(norm(t))));
            if (achado) comItem = achado.nome || '';
            else indisponivel = `sem ${(forma.itemTags || []).join(' / ') || 'item'} equipado`;
        }

        // 3) parte do corpo inteira — sem boca não há Vocal
        if (!indisponivel && forma?.requisito === 'parte_corpo') {
            const querem = (forma.partesDoCorpoNomes || []).map(norm);
            if (!querem.some(q => partes.includes(q))) {
                indisponivel = `sem ${(forma.partesDoCorpoNomes || []).join(' / ') || 'a parte do corpo'}`;
            }
        }

        return {
            nome, icone: forma?.icone || '🪄',
            acerto: acerto ?? null,
            indisponivel, comItem,
            formaId: forma?.id || null,
        };
    });
}
