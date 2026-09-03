/**
 * Regras do sistema como cadastro.
 *
 * Os números que antes viveriam no código (crítico, defesas grátis, faixas de
 * ferimento, multiplicadores de EXP, Patamar…) moram no documento `config/regras`
 * do Firestore e são editáveis pelo Criador na aba Regras. Este módulo guarda o
 * PADRÃO (o que vale se o documento não existir ou não tiver a chave) e a função
 * que mescla o documento por cima do padrão.
 *
 * Regra de projeto: nenhum arquivo do site lê um número de regra fixo — lê
 * `REGRAS.<grupo>.<chave>`. Se precisar de número novo, acrescente aqui (com
 * `rotulo` em ROTULOS para aparecer no Criador) e migre o doc.
 *
 * ES module (import) e global (`globalThis.LR_REGRAS`) para os scripts clássicos.
 * Auto-teste: `node shared/regras-padrao.js`.
 */
export const REGRAS_PADRAO = {
    versao: '1.00',
    teste: {
        tetoAlvo: 9,               // acima disso vira Transbordo
        criticoGrausExtra: 2,      // dado 1: Graus = Alvo + isto
        semPericia: -2,            // tarefa que exige treino, sem a perícia
        botaoFacil: 2, botaoDificil: -2, botaoMuitoDificil: -4,
    },
    combate: {
        defesasGratis: 1,          // por rodada
        defesaExtraComEscudo: 1,   // Bloquear com escudo: mais uma grátis
        custoDefesaExtra: 1,       // Energia
        evadirMetros: 2,           // Esquiva que segura o golpe desloca isto
        contraAtaqueEnergia: 1,    // Aparar: custo do golpe de resposta
        duasArmasPenalidade: -3,   // sem o Dom Ambidestria; cada nível do Dom tira 1
        recuperarFolego: 1,        // Energia por turno inteiro parado
        danoMinimo: 1,             // piso do golpe que passa
        coberturaParcial: 1, coberturaTresQuartos: 2,
        alcanceMedio: -2, alcanceLongo: -4, arcoColado: -2,
    },
    exp: {
        atributoPorNivel: 5,       // novo nível × isto
        periciaPorNivel: 4,
        habilidadePorQualidade: 4, // habilidade de ramo: Qualidade × isto
        domSemNivel: 10,
        pecExtraPositiva: 10, pecExtraNegativa: 10,
        bonusMemorias: 4, bonusPorNpc: 1, maxNpcs: 3,
        segundoRamo: 10, segundoRamoPericiaMinima: 2,
    },
    criacao: {
        atributosPorGrupo: [5, 4, 3], atributoBase: 1, atributoMaxExtra: 2,
        periciasPorGrupo: [6, 4, 3, 2], periciaMax: 3,
        pecsPositivasGratis: 2, pecsNegativasGratis: 2,
    },
    ferimento: {
        faixas: [75, 50, 25],      // % da Vitalidade: Ferido, Grave, Beira da Morte
        energiaTesteBeira: 2,      // 1 Energia dá +isto no teste de Beira
    },
    trilhas: { nivel1: -1, nivel2: -2, nivel3: 'desvantagem' },
    sobrecarga: { faixas: [25, 50] },   // % acima da Carga: nível 1 até 25, nível 2 até 50, nível 3 acima
    sanidade: {
        traumasEnlouquecendo: 3,
        energiaIgnorarTrauma: 1,   // por turno
        traumaPermanenteIntensidade: 5,
    },
    contadores: {
        vitPorCarga: 3,
        cargaTeto: 'Perícia: Hemomancia + VIG',
        harmoniaTeto: 'Perícia: Sonoromancia',
        sangueChaoMorre: 'fim da cena',
        sangueFrascoMorre: 'próximo Descanso Longo',
    },
    item: {
        blindagemLeve: 1, blindagemMedia: 2, blindagemPesada: 3,
        encantamentosPorPeca: 1, encantamentosGraal: 2,
        qualidadeMaxForja: 5, auraMax: 5,
    },
    poder: {
        itemPorPonto: 5, encantamento: 10, auraPorPonto: 25, aliadoFracao: 0.5,
        patamares: [
            { nome: 'Inicial', ate: 500 }, { nome: 'Veterano', ate: 850 }, { nome: 'Especialista', ate: 1300 },
            { nome: 'Mestre', ate: 1800 }, { nome: 'Obra-Prima', ate: 2500 }, { nome: 'Graal', ate: null },
        ],
    },
    descanso: { rapidoMinutos: 30, rapidoPontos: 1, rapidoPorCena: 1 },
    lealdade: { max: 10, limiarBase: 6, limiarFormula: 'máx(6, 10 − Perícia da Escola)', porSessao: 1 },
};

/** Rótulos para o formulário do Criador (chave "grupo.campo" → texto). Sem rótulo, mostra a chave. */
export const ROTULOS = {
    'teste.tetoAlvo': 'Teto do Alvo (acima vira Transbordo)',
    'teste.criticoGrausExtra': 'Crítico: Graus extras além do Alvo',
    'teste.semPericia': 'Redutor sem a perícia (tarefa que exige treino)',
    'teste.botaoFacil': 'Botão Fácil', 'teste.botaoDificil': 'Botão Difícil', 'teste.botaoMuitoDificil': 'Botão Muito difícil',
    'combate.defesasGratis': 'Defesas grátis por rodada',
    'combate.defesaExtraComEscudo': 'Defesas grátis a mais com escudo (Bloquear)',
    'combate.custoDefesaExtra': 'Energia por defesa extra',
    'combate.evadirMetros': 'Evadir: metros que a Esquiva desloca',
    'combate.contraAtaqueEnergia': 'Energia do contra-ataque (Aparar)',
    'combate.duasArmasPenalidade': 'Penalidade de duas armas sem o Dom',
    'combate.recuperarFolego': 'Recuperar Fôlego: Energia por turno parado',
    'combate.danoMinimo': 'Dano mínimo do golpe que passa',
    'exp.atributoPorNivel': 'EXP: atributo (novo nível ×)', 'exp.periciaPorNivel': 'EXP: perícia (novo nível ×)',
    'exp.habilidadePorQualidade': 'EXP: habilidade de ramo (Qualidade ×)', 'exp.domSemNivel': 'EXP: Dom sem nível',
    'exp.segundoRamo': 'EXP: segundo ramo', 'exp.segundoRamoPericiaMinima': 'Perícia mínima para o segundo ramo',
    'ferimento.faixas': 'Faixas de Ferimento (% da Vitalidade)',
    'sanidade.traumasEnlouquecendo': 'Traumas abertos para Enlouquecendo',
    'contadores.vitPorCarga': 'Vitalidade por Carga (Hemomancia)',
    'item.blindagemLeve': 'Blindagem base: Leve', 'item.blindagemMedia': 'Blindagem base: Média', 'item.blindagemPesada': 'Blindagem base: Pesada',
    'poder.patamares': 'Patamares de Poder (nome e teto)',
};

const ehObjeto = v => v && typeof v === 'object' && !Array.isArray(v);

/** Mescla o documento do banco por cima do padrão. Chaves desconhecidas do doc são mantidas. */
export function mesclarRegras(doc, padrao = REGRAS_PADRAO) {
    const out = Array.isArray(padrao) ? [...padrao] : { ...padrao };
    if (!ehObjeto(doc)) return out;
    for (const [k, v] of Object.entries(doc)) {
        out[k] = (ehObjeto(v) && ehObjeto(out[k])) ? mesclarRegras(v, out[k]) : v;
    }
    return out;
}

/** Achata em [{caminho, valor, rotulo, tipo}] para o formulário do Criador. */
export function listarRegras(regras = REGRAS_PADRAO, prefixo = '') {
    const lista = [];
    for (const [k, v] of Object.entries(regras)) {
        const caminho = prefixo ? `${prefixo}.${k}` : k;
        if (ehObjeto(v)) { lista.push(...listarRegras(v, caminho)); continue; }
        const tipo = Array.isArray(v) ? 'lista' : typeof v === 'number' ? 'numero' : 'texto';
        lista.push({ caminho, valor: v, rotulo: ROTULOS[caminho] || caminho, tipo });
    }
    return lista;
}

/** Lê "grupo.campo" com fallback no padrão. */
export function regra(regras, caminho) {
    const pega = (o, p) => p.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
    const v = pega(regras, caminho);
    return v === undefined ? pega(REGRAS_PADRAO, caminho) : v;
}

/** Patamar pelo Poder, com a tabela cadastrada. */
export function patamarDoPoder(poder, regras = REGRAS_PADRAO) {
    const tabela = regra(regras, 'poder.patamares') || [];
    for (let i = 0; i < tabela.length; i++) { const p = tabela[i]; if (p.ate == null || poder <= p.ate) return { indice: i, nome: p.nome }; }
    return { indice: tabela.length - 1, nome: tabela[tabela.length - 1]?.nome || '' };
}

if (typeof globalThis !== 'undefined') {
    globalThis.LR_REGRAS = { REGRAS_PADRAO, ROTULOS, mesclarRegras, listarRegras, regra, patamarDoPoder };
}

// ---- auto-teste: node shared/regras-padrao.js ----
const ehMain = typeof process !== 'undefined' && process.argv && process.argv[1] && /regras-padrao\.js$/.test(process.argv[1].replace(/\\/g, '/'));
if (ehMain) {
    const assert = (c, m) => { if (!c) { console.error('FALHOU:', m); process.exit(1); } };
    const m = mesclarRegras({ teste: { criticoGrausExtra: 3 }, novo: { x: 1 } });
    assert(m.teste.criticoGrausExtra === 3, 'override');
    assert(m.teste.tetoAlvo === 9, 'padrão preservado');
    assert(m.combate.defesasGratis === 1, 'grupo intocado');
    assert(m.novo.x === 1, 'chave nova mantida');
    assert(REGRAS_PADRAO.teste.criticoGrausExtra === 2, 'padrão não mutado');
    assert(regra(m, 'poder.auraPorPonto') === 25, 'regra() fallback');
    assert(patamarDoPoder(0).nome === 'Inicial' && patamarDoPoder(500).nome === 'Inicial' && patamarDoPoder(501).nome === 'Veterano' && patamarDoPoder(9999).nome === 'Graal', 'patamar');
    assert(listarRegras().some(r => r.caminho === 'ferimento.faixas' && r.tipo === 'lista'), 'listar');
    console.log('regras-padrao: ok');
}
