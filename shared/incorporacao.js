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
import { DADIVAS } from './dadiva.js';

/** Orçamento que a incorporação já cobre com o custo fixo (Livro §9.2: 2). */
export const ORCAMENTO_BASE = 2;
/** Unidades entregues acima do orçamento que valem 1 de Sanidade. */
export const UNIDADES_POR_SANIDADE = 2;

/* ── Sanidade do PROJETOR ──────────────────────────────────────────────────
 * O Receptor paga pelo que entrou nele, e a Dádiva mede isso. O Projetor não
 * recebe Dádiva nenhuma — ele sai do corpo e passa a controlar um espírito
 * intangível, que atravessa o que é sólido. A mente mortal não tem onde
 * encaixar isso, e é aí que dói.
 *
 * ⚠️ Não volte a cobrar o Projetor por unidades de Dádiva. Aquela conta é
 * cortada pelo TETO de quem recebe, então media o espaço que sobrava na ficha
 * do Xamã — não a força do hóspede. Efeito prático: o veterano no teto pagava
 * ZERO e o iniciante pagava caro, pelo mesmo Eco e pelo mesmo benefício.
 *
 * Aqui a conta é do que ele veste e de onde ele vai:
 *      Sanidade = piso + ⌊Poder do Eco ÷ 3⌋ + degrau do Véu
 */
export const SANIDADE_PROJETOR_PISO = 1;
export const PODER_POR_SANIDADE = 3;
/** Camadas da realidade, do Compêndio de Totemancia. Quanto mais fundo, pior. */
export const VEUS = { material: 0, eterico: 1, astral: 2 };

/**
 * O Redutor que cada Véu põe no teste de Transcendência (Projetor).
 *
 * Isto é regra ANTIGA — o Efeito do predef já dizia "Véu Etérico (Redutor 2) ou
 * Astral (Redutor 4)" — mas ninguém a aplicava: era prosa. Aqui ela vira número
 * que a janela mostra e o log registra.
 *
 * Redutor NÃO tem sinal: `Alvo = Atributo + Perícia + Bônus − Redutor`, então o
 * número já é a subtração. Redutor 4 é quatro mais difícil.
 */
export const REDUTOR_DO_VEU = { material: 0, eterico: 2, astral: 4 };

/**
 * O Poder do hóspede: a PRS da ficha. Uma fonte só, de propósito.
 *
 * Resolvido em 25/08/2026. A PRS vinha sendo pedida para ser DUAS coisas com
 * ordenações opostas: a tabela de geração do §9.9 a usava como RESISTÊNCIA
 * (Furioso 4, Corrompido 5, Sereno 1 — o hostil briga mais) e as fichas a usam
 * como PODER (Servo 2, Mestre de Armas 8). Um Sereno poderoso ficava fraco numa
 * leitura e forte na outra.
 *
 * Ficou sendo PODER, e a resistência continua modelada onde já estava: no termo
 * `(5 − Disposição)` do redutor da Supressão, que a tabela de Estado alimenta.
 * Estado e Poder são ORTOGONAIS — um Eco calmo pode ser poderoso.
 *
 * ⚠️ Havia um segundo campo, `eco.prs`, gravado pelo Painel e lido aqui com
 * prioridade sobre a ficha. Duas entradas para um número só é fábrica de
 * divergência: bastava o Mestre preencher lá com a escala do §9.9 para a
 * projeção cobrar pela resistência em vez de pelo poder. O campo saiu.
 */
export function poderDoHospede(hospede) {
    return Number(hospede?.atributos?.PRS) || 0;
}

/**
 * O que a projeção cobra: Sanidade (nunca zero — sair do corpo custa sempre) e
 * o Redutor que o Véu põe no teste de Transcendência (Projetor).
 *
 * @returns {{ poder, veu, degrau, sanidade, redutor }}
 */
export function custoDaProjecao(hospede, veu = 'material', o = {}) {
    const piso = o.piso ?? SANIDADE_PROJETOR_PISO;
    const por = o.poderPorSanidade ?? PODER_POR_SANIDADE;
    const poder = poderDoHospede(hospede);
    const chave = norm(veu);
    const degrau = VEUS[chave] ?? 0;
    return {
        poder, veu: chave, degrau,
        sanidade: piso + Math.floor(poder / por) + degrau,
        redutor: REDUTOR_DO_VEU[chave] ?? 0,
    };
}

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
 * As Dádivas que este hóspede tem para dar: TODAS.
 *
 * REGRA DA MESA (25/08/2026, corrigindo o que estava aqui): quem incorpora
 * recebe as NOVE Dádivas, e cada uma sorteia UMA coisa dentro do grupo dela.
 * Receber a Dádiva não é receber vantagem — o dado tem face de nenhum, e o
 * que sai pode não servir para nada. É o sorteio que faz duas incorporações do
 * mesmo Eco não serem iguais, não uma escolha no cadastro.
 *
 * ⚠️ Não volte a devolver lista fixa aqui. A versão anterior devolvia sete
 * (sem Mente e sem Perícia) e ainda tentava ler `hospede.ecoDadiva`, um campo
 * que o Painel nunca gravou nesse nome — ele grava `eco.dadiva`. O resultado
 * era que duas Dádivas nunca saíam e o cadastro do Mestre não chegava a lugar
 * nenhum. O catálogo é a fonte: mexeu em DADIVAS, mexeu aqui junto.
 */
export function dadivasDoHospede(hospede, modo) {
    return Object.keys(DADIVAS);
}

/** Eco Ancestral dobra a entrega e o custo (Livro §9.2). */
export function ehAncestral(hospede) {
    // O Painel grava ANINHADO (`eco.estado`); código antigo lia raso
    // (`ecoEstado`). Aceita os dois — ler só o raso é por que o dobro do
    // Ancestral nunca disparou em mesa nenhuma.
    return norm(hospede?.eco?.estado ?? hospede?.ecoEstado) === 'ancestral';
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
