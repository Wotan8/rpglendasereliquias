/* ===== DÁDIVA — o que o Receptor ganha de quem o habita =====
 *
 * Serve à Transcendência (Receptor) do Xamã e à Fusão Selvagem (Receptor) do
 * Druida: a conta é a mesma, muda quem entra — um Eco da Alma ou um Aliado
 * Animal. Canon: Compêndio de Totemancia, "A Comunhão do Receptáculo" —
 * "Um Eco não concede poder. Concede o que ele foi."
 *
 * A REGRA (decisão de mesa, 2026-08-17): o Receptor não ganha um número fixo.
 * Ganha a SOBRA do que o hóspede tem de melhor, e só quando o hóspede é mesmo
 * melhor naquilo:
 *
 *      sobra = valor do hóspede − valor do personagem   (só se > 0)
 *
 * Uma coisa por Dádiva, a de maior sobra — com duas exceções: Braço leva o
 * melhor Dano E o melhor Acerto, e Boca leva um atributo social, uma perícia
 * social e uma perícia de bardo.
 *
 * Onde duas categorias DIFERENTES concorrem (Pele: Vitalidade contra
 * Blindagem), quem decide é a régua: a sobra que valer mais unidades ganha.
 * As taxas vêm do Livro Régua de Balanceamento §1.1 — não são chutadas aqui.
 *
 * Tudo é temporário: sai quando a incorporação acaba e o token perde a
 * condição "Em Transe".
 *
 * Este arquivo é PURO: recebe o hóspede, o personagem e o catálogo de Valores
 * Derivados por parâmetro, e não sabe de Firestore nem de DOM.
 */

/** Taxas do Livro Régua de Balanceamento §1.1 — unidades por ponto. */
export const TAXA = {
    vitalidade: 0.290,   // 1 ponto de Vitalidade (reserva, uma vez)
    energia: 0.290,      // §4: Energia é reserva que se esgota, como a Vitalidade
    blindagem: 0.154,    // +1 Blindagem POR RODADA
    alvo: 0.170,         // ±1 no Alvo POR RODADA
    dano: 0.290,         // 1 ponto de dano POR RODADA
};

/** Uma cena = 5 rodadas (§0.1). O que rende por rodada multiplica por isto. */
export const RODADAS_POR_CENA = 5;

/**
 * As sete Dádivas e onde cada uma procura.
 *
 * `bloco` casa com o blocoNome do cadastro de Valores Derivados — é o registro
 * que diz o que é Sentido e o que é Deslocamento, não este arquivo.
 * `escolheUma: true` = as categorias COMPETEM e só a melhor entra (Pele).
 */
export const DADIVAS = {
    braco: {
        nome: 'Braço', icone: '🦾',
        canon: 'de quem lutou, caçou, matou — o golpe ganha o peso de mão alheia',
        categorias: [
            { nome: 'Dano', bloco: 'Modificadores de Ataque', prefixo: 'Dano', taxa: 'dano', porRodada: true },
            { nome: 'Acerto', bloco: 'Modificadores de Ataque', prefixo: 'Acerto', taxa: 'alvo', porRodada: true },
        ],
    },
    pele: {
        nome: 'Pele', icone: '🛡️',
        canon: 'de quem aguentou, ou da fera de couro grosso — o corpo endurece por dentro',
        escolheUma: true,
        categorias: [
            { nome: 'Vitalidade', vital: 'VIT', taxa: 'vitalidade', porRodada: false, subeAtual: true },
            { nome: 'Blindagem', prefixo: 'Blindagem', taxa: 'blindagem', porRodada: true },
        ],
    },
    olho: {
        nome: 'Olho', icone: '👁️',
        canon: 'de batedor, de vigia, de ave — enxerga-se longe, e o que estava escondido',
        categorias: [{ nome: 'Sentidos', bloco: 'Sentidos', taxa: 'alvo', porRodada: true }],
    },
    passo: {
        nome: 'Passo', icone: '🦶',
        canon: 'de quem corria, ou da fera veloz — o chão fica mais curto',
        categorias: [{ nome: 'Deslocamento', bloco: 'Deslocamento', taxa: null, porRodada: false }],
    },
    boca: {
        nome: 'Boca', icone: '🗣️',
        canon: 'de orador, de líder, de sacerdote — as palavras saem com autoridade emprestada',
        categorias: [
            { nome: 'Atributo social', atributos: ['PRE', 'MAN', 'AUT'], taxa: 'alvo', porRodada: true },
            { nome: 'Perícia social', periciaCategoria: 'social', taxa: 'alvo', porRodada: true, estreita: true },
            { nome: 'Perícia de bardo', bloco: 'Sonoromancia', taxa: 'alvo', porRodada: true, estreita: true },
        ],
    },
    habilidade: {
        nome: 'Habilidade', icone: '✨',
        canon: 'o que a vida dele treinou até virar segunda natureza',
        // Não é número: libera os módulos de classe do hóspede para quem recebe.
        modulos: true, categorias: [],
    },
    energia: {
        nome: 'Energia', icone: '⚡',
        canon: 'o fôlego de quem entra',
        categorias: [{ nome: 'Energia', vital: 'ENER', taxa: 'energia', porRodada: false, subeAtual: true }],
    },
};

/** Cláusula estreita (§1.4): efeito preso a uma perícia só vale um quarto. */
const ESTREITA = 0.25;

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

/** O VD pertence a esta categoria? Bloco do cadastro e/ou prefixo do nome. */
function vdNaCategoria(dv, cat) {
    if (cat.bloco && norm(dv.blocoNome) !== norm(cat.bloco)) return false;
    if (cat.prefixo && !norm(dv.nome).startsWith(norm(cat.prefixo))) return false;
    return !!(cat.bloco || cat.prefixo);
}

/** Unidades que uma sobra vale na régua. `null` de taxa = fora da régua (§3.3). */
export function unidadesDaSobra(sobra, cat) {
    if (!cat.taxa || !TAXA[cat.taxa]) return null;
    let u = sobra * TAXA[cat.taxa];
    if (cat.porRodada) u *= RODADAS_POR_CENA;
    if (cat.estreita) u *= ESTREITA;
    return Math.round(u * 1000) / 1000;
}

/**
 * A maior sobra dentro de UMA categoria.
 * @returns { chave, nome, doHospede, doPersonagem, sobra, unidades, cat } ou null
 */
function melhorDaCategoria(cat, hospede, personagem, catalogo) {
    const candidatos = [];

    if (cat.vital) {
        candidatos.push({ chave: cat.vital, nome: cat.vital === 'VIT' ? 'Vitalidade Máxima' : 'Energia Máxima' });
    } else if (cat.atributos) {
        for (const a of cat.atributos) candidatos.push({ chave: a, nome: a, atributo: true });
    } else if (cat.periciaCategoria) {
        for (const s of catalogo.pericias || []) {
            if (norm(s.categoria) === norm(cat.periciaCategoria)) candidatos.push({ chave: s.nome, nome: s.nome, pericia: true });
        }
    } else {
        for (const dv of catalogo.derivedValues || []) {
            if (vdNaCategoria(dv, cat)) candidatos.push({ chave: dv.key || dv.nome, nome: dv.nome });
        }
    }

    let melhor = null;
    for (const c of candidatos) {
        const doHospede = Number(valorDe(hospede, c)) || 0;
        const doPersonagem = Number(valorDe(personagem, c)) || 0;
        const sobra = doHospede - doPersonagem;
        if (!(sobra > 0)) continue;                       // só entra o que é MELHOR
        const unidades = unidadesDaSobra(sobra, cat);
        const linha = { ...c, doHospede, doPersonagem, sobra, unidades, categoria: cat.nome, subeAtual: !!cat.subeAtual };
        // Dentro da categoria os candidatos são da mesma espécie: maior sobra ganha
        if (!melhor || sobra > melhor.sobra) melhor = linha;
    }
    return melhor;
}

/** Valor de um componente numa ficha achatada. */
function valorDe(ficha, c) {
    if (!ficha) return 0;
    if (c.atributo) return ficha.atributos?.[c.chave] ?? 0;
    if (c.pericia) return ficha.pericias?.[c.chave] ?? 0;
    if (c.chave === 'VIT') return ficha.vitais?.vitMax ?? 0;
    if (c.chave === 'ENER') return ficha.vitais?.enerMax ?? 0;
    return ficha.vds?.[c.chave] ?? ficha.vds?.[c.nome] ?? 0;
}

/**
 * O que o Receptor ganha de UMA Dádiva.
 *
 * @param {string} chave      'braco' | 'pele' | 'olho' | 'passo' | 'boca' | 'habilidade' | 'energia'
 * @param {object} hospede    { vds, atributos, pericias, vitais, modulos }
 * @param {object} personagem idem
 * @param {object} catalogo   { derivedValues, pericias }
 * @param {object} [o]
 * @param {boolean} [o.ancestral] Eco Ancestral dobra a entrega (§9.2)
 * @returns { chave, nome, icone, canon, ganhos[], modulos[], unidades }
 */
export function calcularDadiva(chave, hospede, personagem, catalogo, o = {}) {
    const d = DADIVAS[chave];
    if (!d) return null;
    catalogo = catalogo || {};

    // ✨ Habilidade não é número: são os módulos de classe do hóspede ficando
    // disponíveis para quem recebe, enquanto durar a incorporação.
    if (d.modulos) {
        return {
            chave, nome: d.nome, icone: d.icone, canon: d.canon,
            ganhos: [], modulos: hospede?.modulos || [], unidades: null,
        };
    }

    const achados = d.categorias.map(cat => melhorDaCategoria(cat, hospede, personagem, catalogo)).filter(Boolean);

    // 🛡️ Categorias que COMPETEM (Pele: Vitalidade contra Blindagem): entra só
    // a sobra que valer mais na régua. É o desempate que o Livro permite fazer,
    // porque as duas taxas estão em §1.1 — Blindagem rende por rodada e a
    // Vitalidade é reserva de uma vez, então 1 de Blindagem vale mais que 1
    // de Vitalidade numa cena inteira.
    let ganhos = achados;
    if (d.escolheUma && achados.length > 1) {
        ganhos = [achados.reduce((a, b) => ((b.unidades ?? -1) > (a.unidades ?? -1) ? b : a))];
    }

    if (o.ancestral) {
        ganhos = ganhos.map(g => ({
            ...g, sobra: g.sobra * 2, ancestral: true,
            unidades: g.unidades == null ? null : Math.round(g.unidades * 2 * 1000) / 1000,
        }));
    }

    const unidades = ganhos.some(g => g.unidades != null)
        ? Math.round(ganhos.reduce((t, g) => t + (g.unidades || 0), 0) * 1000) / 1000
        : null;

    return { chave, nome: d.nome, icone: d.icone, canon: d.canon, ganhos, modulos: [], unidades };
}

/** Texto curto de um ganho, para o chat e para o painel. */
export function rotuloDoGanho(g) {
    return `${g.nome} +${g.sobra} (${g.doPersonagem} → ${g.doPersonagem + g.sobra})`;
}
