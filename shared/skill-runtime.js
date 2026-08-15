/* ===== INTERPRETADOR DE HABILIDADE — um só, para o Tabuleiro e para o Criador
 *
 * O problema que este arquivo existe para matar: uma habilidade cadastrada
 * caía no diálogo "Como aplicar" porque o Tabuleiro não conseguia LIGAR o item
 * da ficha ao pré-definido do registro. Quando essa ligação falha, tudo falha
 * junto — custo, mira, veículos — e a tela não diz por quê.
 *
 * Duas decisões de projeto:
 *
 *  1. A ligação tem CADEIA DE RECURSO. Id exato, nome normalizado, nome sem o
 *     sufixo "[V, S]", e por fim o próprio item da ficha, que muitas vezes já
 *     carrega o que interessa. Um elo falhar não derruba os outros.
 *
 *  2. Toda leitura devolve um DIAGNÓSTICO junto: o que foi achado, por qual
 *     caminho, e o que falta preencher. É o mesmo objeto que o painel do
 *     Criador mostra — o painel não pode discordar do Tabuleiro porque os dois
 *     leem daqui.
 *
 * Regra de ouro: "não tem cadastro" e "o registro não carregou" são estados
 * DIFERENTES. O primeiro pede o diálogo manual; o segundo é falha de infra e
 * tem de dizer isso, não fingir que a habilidade está vazia.
 */

/** Nome comparável: sem acento, sem caixa, sem pontuação. */
export const normNome = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]/g, '');

/** Nome sem o sufixo de veículos: "GRITO DISSONANTE [V, S]" → "gritodissonante". */
export const normSemSufixo = (s) => normNome(String(s || '').replace(/\[[^\]]*\]\s*$/, ''));

/** Nome legível de um item da ficha, na ordem em que os cadastros gravam. */
export function nomeDoItem(it) {
    return it?._predefNome || it?.nome || it?.Nome || it?.['1'] || 'Habilidade';
}

/**
 * Índice de pré-definidos com TODAS as chaves por onde dá para achar.
 * @param {object[]} modulos  definições de módulo de classe do registro
 */
export function indexarPredefs(modulos) {
    const porId = new Map(), porNome = new Map(), porNomeBase = new Map();
    for (const mod of modulos || []) {
        for (const pd of mod?.itensPredefinidos || []) {
            const ref = { pd, modulo: mod };
            if (pd?.id) porId.set(pd.id, ref);
            const n = normNome(pd?.nome);
            if (n && !porNome.has(n)) porNome.set(n, ref);
            const b = normSemSufixo(pd?.nome);
            if (b && !porNomeBase.has(b)) porNomeBase.set(b, ref);
        }
    }
    return { porId, porNome, porNomeBase, total: porId.size };
}

/**
 * Acha o pré-definido de um item da ficha, pela cadeia de recurso.
 * @returns {{ pd, modulo, como }} · `como` diz por qual elo veio, ou null
 */
export function acharPredef(it, idx) {
    if (!idx) return null;
    const nome = nomeDoItem(it);
    const tentativas = [
        ['id', () => it?._predefId && idx.porId.get(it._predefId)],
        ['nome', () => idx.porNome.get(normNome(nome))],
        ['nome sem [veículos]', () => idx.porNomeBase.get(normSemSufixo(nome))],
    ];
    for (const [como, fn] of tentativas) {
        const r = fn();
        if (r) return { ...r, como };
    }
    return null;
}

/* ===================== MIRA ===================== */

/** Uma medida existe? Número positivo ou fórmula (ver shared/medida-formula.js). */
const temMedida = (v) => {
    if (v == null || v === '') return false;
    const n = Number(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n > 0 : String(v).trim() !== '';
};

/**
 * A mira que um CADASTRO (pré-definido ou item da ficha) descreve.
 * Devolve null quando aquele cadastro não descreve mira nenhuma.
 * O formato de saída é o do runtime do Tabuleiro.
 */
export function miraDeCadastro(pd) {
    if (!pd) return null;
    if (pd.mira && pd.mira.tipo) return { ...pd.mira, _origem: 'mira explícita' };

    const temArea = !!pd.formaArea && temMedida(pd.tamanhoArea);
    const temAlvos = Number(pd.alvosMax) > 0;
    const ehLocais = /local|locais|chao|chão/i.test(String(pd.formaArea || ''));
    if (!temArea && !temAlvos && !ehLocais) return null;

    const afeta = pd.faccao === 'inimigo' ? 'inimigos' : pd.faccao === 'aliado' ? 'aliados' : 'todos';
    const condicoes = (pd.condicoesAplicadas || []).filter(c => c?.condicao)
        .map(c => ({ nome: c.condicao, rodadas: Number(c.rodadas) || 0, maxAlvos: Number(c.alvos) || 0 }));
    const cond = (pd.condicoesAplicadas || [])[0] || null;
    const base = {
        afeta, condicoes,
        condicaoNome: cond?.condicao || null,
        condicaoRodadas: Number(cond?.rodadas) || 0,
        condicaoMaxAlvos: Number(cond?.alvos) || 0,
        condicaoPortao: cond?.portao || null,
        exigeVinculo: pd.exigeVinculo || null,
        incorporacao: pd.incorporacao || null,
        alcanceVisao: !!pd.alcanceVisao,
        alcanceDoDisparo: !!pd.alcanceDoDisparo,
    };

    if (ehLocais) {
        return { ...base, tipo: 'locais', _origem: 'Régua v2',
            alcanceM: temMedida(pd.alcance) ? pd.alcance : (pd.tamanhoArea ?? 0),
            maxAlvos: Number(pd.alvosMax) || 1, alvosPorGraus: !!pd.alvosPorGraus };
    }

    const soEmSi = !temArea && temAlvos && !temMedida(pd.alcance) && !pd.alcanceVisao
        && /proprio|próprio|nenhuma|unico|único|ponto/i.test(String(pd.formaArea || ''));
    if (soEmSi) {
        return { ...base, afeta: 'aliados', tipo: 'geometria', forma: 'circulo', origem: 'token',
            alcanceM: 0, raioM: 0, comprimentoM: 0, larguraM: 1, angGraus: 60, maxAlvos: 1,
            _origem: 'Régua v2 (só em si)' };
    }

    if (temArea) {
        const forma = /cone/i.test(pd.formaArea) ? 'cone' : /linha/i.test(pd.formaArea) ? 'linha' : 'circulo';
        const tam = pd.tamanhoArea;
        const ehFormula = !Number.isFinite(Number(String(tam).replace(',', '.')));
        return { ...base, tipo: 'geometria', forma, _origem: 'Régua v2',
            origem: (forma === 'circulo' && temMedida(pd.alcance)) ? 'livre' : 'token',
            alcanceM: pd.alcance ?? 0, raioM: tam, comprimentoM: tam,
            larguraM: ehFormula ? `(${String(tam).trim()}) / 3` : Math.max(1, (Number(tam) || 0) / 3),
            angGraus: Number(pd.anguloCone) || 60, maxAlvos: 99 };
    }

    return { ...base, tipo: 'alvos', _origem: 'Régua v2',
        alcanceM: temMedida(pd.alcance) ? pd.alcance : (pd.tamanhoArea ?? 0),
        maxAlvos: Number(pd.alvosMax) || 1 };
}

/**
 * A mira da habilidade, tentando o pré-definido E o item da ficha.
 * O item vence: é a cópia que o Mestre pode ter ajustado para aquela ficha.
 */
export function resolverMira(it, pd) {
    return miraDeCadastro(it) || miraDeCadastro(pd) || null;
}

/* ===================== DIAGNÓSTICO ===================== */

/** A habilidade acontece FORA do turno? Ritual não mira nem gasta ação. */
export function ehForaDeCombate(it, pd) {
    const r = String(it?.custoAcao || pd?.custoAcao || it?.acao || pd?.valores?.acao || '').toLowerCase();
    return /fora de combate|prolongad/.test(r);
}

/**
 * O que falta para o Tabuleiro interpretar esta habilidade sozinho.
 *
 * O diagnóstico só acusa o que É falta. Três coisas que PARECIAM falta e não
 * são, e que enchiam a lista de ruído:
 *   · ritual "Fora de combate" não é ação de turno — não precisa de mira nem
 *     de custo de rodada;
 *   · módulo sem nenhum campo de custo (Receita de Loções) é gratuito por
 *     desenho: a loção já foi preparada, usar é beber;
 *   · "—", "Gatilho", "0" no campo de custo são gratuidade DECLARADA, não
 *     campo esquecido.
 */
export function diagnosticarSkill({ it, pd, modulo, como, mira, custos, registroOk = true, semCusto = false }) {
    const faltas = [];
    if (!registroOk) {
        return {
            ok: false, registroIndisponivel: true, achouPredef: false, como: null, faltas: [
                { campo: '(registro)', porque: 'O registro do sistema não carregou — não é falta de cadastro, é falha de leitura.' },
            ],
        };
    }
    if (!pd) {
        faltas.push({
            campo: '_predefId',
            porque: `Nenhum pré-definido bate com "${nomeDoItem(it)}". A ficha guarda `
                + `_predefId=${it?._predefId || '(vazio)'} e o nome não achou par no registro.`,
        });
    }

    const foraDeCombate = ehForaDeCombate(it, pd);

    if (!foraDeCombate) {
        if (!mira) {
            faltas.push({
                campo: 'formaArea / tamanhoArea / alvosMax',
                porque: 'Sem forma+tamanho de área e sem número de alvos, não há como mirar. '
                    + 'Preencha a Mira no pré-definido, marque "Locais no mapa", ou — se for rito — '
                    + 'ponha a Ação como "Fora de combate".',
            });
        } else if (mira.tipo === 'alvos' && !(Number(mira.alcanceM) > 0) && !mira.alcanceVisao && !mira.alcanceDoDisparo) {
            faltas.push({
                campo: 'alcance',
                porque: 'Mira de alvos com alcance 0: só dá para mirar em si mesmo. '
                    + 'Preencha o alcance, ou marque "alcance da visão" / "alcance do disparo".',
            });
        }
        if (!custos?.length && !semCusto) {
            faltas.push({
                campo: 'custo',
                porque: 'Nenhuma forma de pagar encontrada: sem mecânica de custo, sem campo com '
                    + '"Custo" no rótulo e sem degrau no título do módulo. Se for de graça mesmo, '
                    + 'escreva "—" no campo de custo.',
            });
        }
    }

    return {
        ok: faltas.length === 0, registroIndisponivel: false,
        achouPredef: !!pd, como: como || null, foraDeCombate, gratuita: semCusto,
        modulo: modulo?.titulo || null, faltas,
    };
}

/**
 * Interpreta UMA habilidade da ficha. É o ponto único: o Tabuleiro usa para
 * jogar, o Criador usa para listar o que está incompleto.
 *
 * @param {object} it        item da ficha (classModuleData / modulosClasse)
 * @param {object} ctx
 * @param {object} ctx.idx           saída de indexarPredefs()
 * @param {Function} ctx.custosDaSkill  leitor de custo (shared/skill-custo.js)
 * @param {Function} ctx.mechPorId
 * @param {Function} ctx.custoDaMecanica
 * @param {boolean} ctx.registroOk
 */
export function interpretarSkill(it, ctx) {
    const achado = ctx.registroOk === false ? null : acharPredef(it, ctx.idx);
    const pd = achado?.pd || null;
    const modulo = achado?.modulo || null;

    const custos = ctx.custosDaSkill
        ? ctx.custosDaSkill({ modulo, predef: pd, item: it, mechPorId: ctx.mechPorId, custoDaMecanica: ctx.custoDaMecanica })
        : [];
    const mira = resolverMira(it, pd);

    // Gratuidade de DESENHO (módulo sem campo de custo) ou DECLARADA ("—").
    const semCusto = !custos.length && (
        (ctx.moduloDeclaraCusto ? !ctx.moduloDeclaraCusto(modulo) : false)
        || (ctx.custoDeclaradoZero ? ctx.custoDeclaradoZero(modulo, pd, it) : false)
    );

    return {
        nome: nomeDoItem(it),
        efeito: it?.efeito || it?.Efeito || it?.descricao || pd?.descricao || '',
        pd, modulo, custos, mira, semCusto,
        diagnostico: diagnosticarSkill({
            it, pd, modulo, como: achado?.como, mira, custos, semCusto,
            registroOk: ctx.registroOk !== false,
        }),
    };
}
