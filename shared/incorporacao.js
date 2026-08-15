/* ===== INCORPORAÇÃO — Receptor e Projetor =====
 *
 * Duas classes, um motor: a Fusão Selvagem do Druida (com um Aliado Animal) e
 * a Transcendência do Xamã (com um Eco da Alma) fazem a mesma coisa mecânica.
 * Muda quem entra e como se chama.
 *
 *   RECEPTOR  o hóspede entra no personagem. O personagem ganha as sobras da
 *             Dádiva (shared/dadiva.js) e o TOKEN DO HÓSPEDE fica Em Transe.
 *   PROJETOR  o personagem sai de si e vai para o hóspede. Quem controla o
 *             token do hóspede passa a ser o dono do personagem — na
 *             iniciativa do PRÓPRIO hóspede, que já está na cena — e o TOKEN
 *             DO PERSONAGEM fica Em Transe.
 *
 * O custo é ESCALONADO pelo que a Dádiva entregou. A entrega é dinâmica (um
 * lobo empresta pouco, um urso ancião empresta muito) e nenhum preço fixo
 * acompanha isso: quem tira mais paga mais, em Sanidade. É o que o Livro §9.4
 * chama de "risco mora do lado do custo".
 *
 * Puro: nada de Firestore, nada de DOM.
 */

/** Orçamento que a incorporação já cobre com o custo fixo (Livro §9.2: 2). */
export const ORCAMENTO_BASE = 2;
/** Unidades entregues acima do orçamento que valem 1 de Sanidade. */
export const UNIDADES_POR_SANIDADE = 2;

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

/**
 * O alvo clicado serve de hóspede para esta incorporação?
 *
 * Não existe seletor de aliado: quem conjura MIRA um token no mapa, e a
 * validação acontece aqui. Se o token não for um hóspede válido, a mira recusa
 * com o motivo — e "só funde com quem está na cena" sai de graça, porque fora
 * da cena não há token para clicar.
 *
 * @param {object} o
 * @param {object} o.hospede   doc do NPC do token clicado
 * @param {string} o.charId    id do personagem de quem conjura
 * @param {string} o.exige     'aliado-animal' | 'eco'
 * @returns {string} '' quando vale, ou o motivo da recusa
 */
export function porqueNaoPodeIncorporar({ hospede, charId, exige }) {
    if (!hospede) return 'não é uma ficha que dê para incorporar';

    const vinculado = (hospede.vinculos || []).some(v =>
        v?.tipo === 'personagem' && v.id === charId);
    if (!vinculado) return 'não está vinculado à sua ficha';

    if (exige === 'aliado-animal') {
        // O Ferinismo funde com BICHO. Um aliado humano é aliado, não manada.
        if (norm(hospede.tipo) !== 'criatura') return 'não é um Aliado Animal (a ficha tem de ser de Criatura)';
    } else if (exige === 'eco') {
        if (norm(hospede.tipo) !== 'eco') return 'não é um Eco da Alma';
    }
    return '';
}

/**
 * O que a incorporação cobra ALÉM do custo fixo da habilidade.
 *
 * @param {number} unidades  soma das unidades entregues pelas Dádivas
 * @param {object} [o]
 * @returns {{ sanidade: number, excedente: number }}
 */
export function custoEscalonado(unidades, o = {}) {
    const orcamento = o.orcamento ?? ORCAMENTO_BASE;
    const porSan = o.porSanidade ?? UNIDADES_POR_SANIDADE;
    const excedente = Math.max(0, (Number(unidades) || 0) - orcamento);
    return {
        excedente: Math.round(excedente * 1000) / 1000,
        sanidade: Math.floor(excedente / porSan),
    };
}

/**
 * As Dádivas que este hóspede tem para dar.
 * O Eco declara UMA no cadastro (`ecoDadiva`); o Aliado Animal não declara —
 * um bicho empresta o que ele é, então valem todas as que rendem sobra.
 */
export function dadivasDoHospede(hospede, modo) {
    if (modo === 'eco' && hospede?.ecoDadiva) {
        // O Eco também empresta fôlego e o que sabe fazer, além da Dádiva dele
        return [norm(hospede.ecoDadiva), 'habilidade', 'energia'];
    }
    return ['braco', 'pele', 'olho', 'passo', 'boca', 'habilidade', 'energia'];
}

/** Eco Ancestral dobra a entrega e o custo (Livro §9.2). */
export function ehAncestral(hospede) {
    return norm(hospede?.ecoEstado) === 'ancestral';
}

/**
 * Quem fica Em Transe e quem age, por modo.
 * @returns {{ inerte: 'hospede'|'personagem', age: 'hospede'|'personagem' }}
 */
export function quemFicaInerte(modo) {
    return modo === 'projetor'
        ? { inerte: 'personagem', age: 'hospede' }
        : { inerte: 'hospede', age: 'personagem' };
}

/** Nome da condição que marca o corpo deixado para trás. */
export const CONDICAO_TRANSE = 'Em Transe';
