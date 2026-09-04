// =============================================================
// ᛟ RUNA EM JOGO — o circuito auditado vira uma coisa jogável
//
// O Laboratorium sabe dizer se um circuito FUNCIONA (rune-engine.js: CT,
// natureza, Alvo de Construção, gravação, sobrecarga). Este módulo responde a
// outra pergunta: quando essa runa for usada numa cena de combate, o que
// exatamente acontece?
//
// A LEI DO RELÓGIO governa tudo aqui: o mecanismo da runa sempre funciona como
// foi projetado. Ela só erra se o alvo declarar Defesa — sem Defesa, acerta
// sempre, sem rolagem nenhuma. A Runomancia é a única coisa em Vasteluna que
// não pode ser azarada, e é por isso que `rolaAcerto` sai false por padrão.
//
// Nada de regra mora aqui como número: o canal de dano, o repertório de
// condições, a mira de cada Emissor e as travas de cada Aspectus vêm todos do
// registro (system/data/runicElements). Este arquivo só sabe COMBINAR.
//
// Sem Firestore, sem DOM: testável fora do navegador.
// =============================================================

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const temFlag = (el, f) => Array.isArray(el?.flags) && el.flags.map(norm).includes(f);
const ehTipo = (el, t) => norm(el?.tipoElemento) === t;
const ehCat = (el, c) => norm(el?.categoria) === c;

/** Os nós do circuito com o elemento do catálogo já junto. */
export function nosComElemento(nodes, elementsById) {
    return (nodes || []).map(n => ({ ...n, el: elementsById?.[n.elementId] })).filter(n => n.el);
}

/** O de maior nível entre os que casam com o teste (ou null). */
function maiorNivel(nos, teste) {
    let melhor = null;
    for (const n of nos) {
        if (!teste(n.el)) continue;
        if (!melhor || Number(n.nivel) > Number(melhor.nivel)) melhor = n;
    }
    return melhor;
}

/** Dados do nível escolhido de um elemento (mesma régua do rune-engine). */
function nivelData(el, nv) {
    const ns = Array.isArray(el?.niveis) ? el.niveis : [];
    return ns.find(x => Number(x.nivel) === Number(nv)) || ns[ns.length - 1] || null;
}

/**
 * Condições que uma runa PASSIVA nunca pode aplicar no próprio portador: o
 * cânone só admite Regime Contínuo para efeito estático e NÃO-ADVERSO (§2.7).
 * Uma tatuagem que queima o dono o tempo todo não é runa, é ferida.
 */
const ADVERSAS = new Set(['queimadura', 'hemorragia', 'definhado', 'afogando', 'erosao',
    'chaga', 'fratura', 'corrompido', 'delirio', 'amedrontado', 'atordoado', 'cego', 'surdo',
    'imobilizado', 'prostrado', 'lento', 'estagnado', 'abalado', 'exaustao', 'drenado',
    'entorpecido', 'desorientado', 'ofuscado', 'exposto', 'envelhecido', 'congelamento',
    'inflamado', 'eletrocutado', 'sobrecarregado', 'agarrado', 'ancorado', 'opaco']);

/* ===================== ativação ===================== */

/**
 * Como esta runa é acionada. É o que decide se o Infusor funciona e o que a
 * ficha mostra no painel do turno.
 */
export function ativacaoDoCircuito(nos) {
    const tem = (re) => nos.some(n => re.test(norm(n.el.nome)));
    const contato = tem(/^toque$/) || tem(/sensor de presenca/);
    if (tem(/reconhecedor/)) return { modo: 'restrita', contato, rotulo: 'Reconhecedor — só quem está gravado na Memória' };
    if (tem(/selector/))     return { modo: 'restrita', contato, rotulo: 'Selector — só quem foi selecionado' };
    if (tem(/^gatilho$/) || tem(/^sensor/)) return { modo: 'automatica', contato, rotulo: 'Dispara sozinha (Gatilho/Sensor)' };
    if (tem(/^toque$/))      return { modo: 'toque', contato: true, rotulo: 'Toque — qualquer um ativa' };
    return { modo: 'manual', contato, rotulo: 'Ativação manual — 1 Ação Padrão, qualquer um' };
}

/* ===================== usos ===================== */

/**
 * Quantos usos a peça nasce tendo (Parte XIV).
 *   Escripta: perícia + qualidade da tinta − ⌈CT÷20⌉, mínimo 1
 *   Talha:    a mesma conta × 10, mínimo 10
 *   Tatuagem: permanente enquanto a pele for do portador
 * Sem o Domínio do ofício grava-se rascunho: usos travados em 1.
 */
export function usosDaRuna({ ramo, ct, pericia = 0, qualidadeTinta = 0, temDominio = true }) {
    const r = norm(ramo);
    if (r === 'tatuagem') return { usos: null, permanente: true, rascunho: !temDominio };
    if (!temDominio) return { usos: 1, permanente: false, rascunho: true };
    const base = Math.max(1, Number(pericia || 0) + Number(qualidadeTinta || 0) - Math.ceil(Number(ct || 0) / 20));
    if (r === 'talha') return { usos: Math.max(10, base * 10), permanente: false, rascunho: false };
    return { usos: base, permanente: false, rascunho: false };
}

/* ===================== o bloco de combate ===================== */

/**
 * Traduz um circuito auditado na runa que a mesa vai usar.
 *
 * @param nodes         [{ id, elementId, nivel }] — o desenho
 * @param elementsById  catálogo de system/data/runicElements
 * @param opts.runomancia   perícia de quem gravou
 * @param opts.tetoOficio   Teto de Ofício: Runomancia (corta a perícia)
 * @param opts.ct           CT da auditoria
 * @param opts.ramo         escripta | talha | tatuagem
 * @param opts.pericia      perícia do ramo, para os usos
 * @param opts.qualidadeTinta / opts.temDominio
 * @param opts.condicoesEscolhidas  nomes marcados no Impressor
 * @param opts.manifestacao chave escolhida quando há Manifestador
 *
 * @returns bloco pronto para virar item/peculiaridade, com `problemas[]`
 *          quando o circuito não fecha como runa de combate.
 */
export function blocoDeCombate({ nodes, elementsById, ...opts } = {}) {
    const nos = nosComElemento(nodes, elementsById);
    const problemas = [];

    const artus = maiorNivel(nos, el => ehTipo(el, 'artus'));
    const aspectus = maiorNivel(nos, el => ehTipo(el, 'aspectus'));
    const emissor = maiorNivel(nos, el => ehCat(el, 'emissor'));
    const sublimador = maiorNivel(nos, el => temFlag(el, 'sublimador'));
    const impressor = maiorNivel(nos, el => temFlag(el, 'impressor'));
    const erosor = maiorNivel(nos, el => temFlag(el, 'erosor'));

    const nvArtus = Number(artus?.nivel) || 0;
    // ⚖️ Dois Aspectus na mesma runa: vale O MAIOR, nunca a soma. O `grau` de
    // cada receita de Confluência já declara qual dos dois manda, e o de maior
    // nível é sempre o dominante — então isto não é regra nova, é ler a tabela.
    const nvAsp = Number(aspectus?.nivel) || 0;
    const nvEmissor = Number(emissor?.nivel) || 0;
    const asp = aspectus?.el || null;

    if (!artus || !aspectus) problemas.push('Sem Núcleo (Artus + Aspectus) não há efeito de combate — é Runa Auxiliar.');
    if (asp?.bloqueadoAprendizado) problemas.push(`${asp.nome} é bloqueado para aprendizado: nenhuma runa pode carregá-lo.`);

    /* ---- forma física × forma de essência ---- */
    const coringa = !!asp?.formaFisicaCoringa;
    const sublimou = !!sublimador;
    if (asp?.sublimadorObrigatorio && !sublimou && !coringa) {
        problemas.push(`${asp.nome} não tem forma física: exige um Sublimador para ser emitido.`);
    }
    // ⚠️ `!!` de propósito: `asp.sublimadorObrigatorio` é undefined na maioria
    // dos Aspectus, e `false || undefined` é undefined — o bloco sairia com
    // formaEssencia indefinida e o canal decidido por acaso lá na frente.
    const formaEssencia = !!(sublimou || (asp?.sublimadorObrigatorio && coringa));

    /* ---- dano ---- */
    const nvErosor = Number(erosor?.nivel) || 0;
    let dano, canal, tipoAtaque, danoVerdadeiro = false;
    if (erosor) {
        if (!asp?.aceitaErosor) problemas.push(`${asp?.nome || 'Este Aspectus'} não aceita Erosor — ele só serve às naturezas que sabem desfazer.`);
        // Nv3 é o único que volta a ter dado
        dano = nvErosor >= 3 ? '3+1d4' : String(nvErosor);
        danoVerdadeiro = true;
        canal = 'verdadeiro';
        tipoAtaque = 'verdadeiro';
    } else {
        dano = nvArtus > 0 ? `${nvArtus}d6${nvAsp ? '+' + nvAsp : ''}` : '';
        canal = formaEssencia ? (asp?.canalDano || null) : 'Dano';
        tipoAtaque = formaEssencia ? (asp?.canalDano || null) : null;   // físico: declarado no projeto
    }

    /* ---- condições ---- */
    const repertorio = formaEssencia ? (asp?.condicoesEssencia || []) : (asp?.condicoesFisicas || []);
    const criticas = asp?.condicaoCritica || [];
    const escolhidas = (opts.condicoesEscolhidas || []).map(norm);
    let condicoes;
    if (!impressor) {
        // Sem Impressor a runa marca com o que a natureza faz sozinha — a
        // PRIMEIRA do repertório. O cânone garante que ela marca de algum jeito.
        condicoes = repertorio.slice(0, 1);
        if (escolhidas.length) problemas.push('Escolher condição exige um Impressor gravado no circuito.');
    } else {
        const teto = Number(impressor.nivel) || 1;
        const disponiveis = [...repertorio, ...(teto >= 3 ? criticas : [])];
        const marcadas = disponiveis.filter(c => escolhidas.includes(norm(c.condicao)));
        condicoes = marcadas.length ? marcadas.slice(0, teto) : repertorio.slice(0, 1);
        if (marcadas.length > teto) problemas.push(`Impressor Nv${teto} escolhe até ${teto} condição(ões); as demais foram descartadas.`);
        const foraDoRepertorio = escolhidas.filter(e => !disponiveis.some(c => norm(c.condicao) === e));
        if (foraDoRepertorio.length) problemas.push(`Fora do repertório de ${asp?.nome}: ${foraDoRepertorio.join(', ')}.`);
    }
    const ehCritica = (c) => criticas.some(k => norm(k.condicao) === norm(c.condicao));
    const condicoesAplicadas = condicoes.map(c => ({
        condicao: c.condicao,
        nivel: Math.max(1, nvAsp),
        // Núcleo v2: o portão é da CONDIÇÃO (Livro, p. 9). A runa entrega sem rolar,
        // então os Graus são o Alvo gravado nela; a marca de crítico ignora o portão.
        chance: null,
        portao: ehCritica(c) ? 'automatico' : null,
        rodadas: 5,
    }));

    // 🕳️ A perda de Vitalidade MÁXIMA viaja como condição, não como escrita
    // direta no campo da ficha: assim ela fica à vista no token, acumula
    // sozinha e o Mestre consegue desfazer um engano de mesa. `nivel` é
    // quanto de VIT máxima sai — o mesmo número do dano verdadeiro.
    if (erosor && asp?.aceitaErosor) {
        condicoesAplicadas.push({
            condicao: 'Erosão', nivel: nvErosor, chance: null,
            portao: 'automatico', rodadas: 0, permanente: true,
        });
    }

    /* ---- mira ---- */
    const ativacao = ativacaoDoCircuito(nos);
    let mira = null;
    if (emissor) {
        const nd = nivelData(emissor.el, emissor.nivel);
        mira = nd?.mira ? { ...nd.mira } : null;
        if (!mira) problemas.push(`O Emissor "${emissor.el.nome}" ainda não tem mira estruturada no cadastro.`);
        if (emissor.el.exigeContato && !ativacao.contato) {
            problemas.push(`${emissor.el.nome} só injeta com ativação por toque ou proximidade — sem Toque nem Sensor de Presença ele fica inerte.`);
        }
    } else if (artus && aspectus) {
        problemas.push('Sem Emissor o efeito não sai da runa: acontece nela mesma.');
    }

    /* ---- Alvo da Runa ---- */
    const per = Math.min(Number(opts.runomancia || 0),
        opts.tetoOficio != null ? Number(opts.tetoOficio) : Number(opts.runomancia || 0));
    const alvo = (artus && aspectus) ? nvArtus + nvAsp + nvEmissor + per : 0;

    /* ---- pedágios do Aspectus ---- */
    const sanidadeGravar = Number(asp?.sanidadePorNivelGravar || 0) * nvAsp;
    const periciaExigida = asp?.periciaExigida || null;

    // 🪡 PASSIVA: runa sem lógica de gatilho nenhuma está sempre ligada. Numa
    // tatuagem isso quer dizer que ela não é ação de turno — o que ela aplica,
    // aplica no portador, o tempo todo, desde que entra na cena.
    const passiva = ativacao.modo === 'manual' && !nos.some(n => ehCat(n.el, 'logico'));

    return {
        alvo,
        passiva,
        // O que uma passiva entrega ao portador só faz sentido se não for
        // adversa: o cânone só admite Regime Contínuo para efeito estático e
        // não-adverso (§2.7). Condição de dano contínuo não entra.
        condicoesPermanentes: passiva
            ? condicoesAplicadas.filter(c => !ADVERSAS.has(norm(c.condicao)))
            : [],
        // 🕰️ Lei do Relógio: só há rolagem quando alguém declara Defesa.
        rolaAcerto: false,
        dano, canal, tipoAtaque, danoVerdadeiro,
        erosor: erosor ? { nivel: nvErosor, usosPorCena: nvErosor, reduzVitMaxima: true } : null,
        formaEssencia,
        condicoesAplicadas,
        mira,
        manifestacao: opts.manifestacao || null,
        ativacao,
        ...usosDaRuna({ ramo: opts.ramo, ct: opts.ct, pericia: opts.pericia,
                        qualidadeTinta: opts.qualidadeTinta, temDominio: opts.temDominio }),
        nucleo: {
            artus: artus?.el?.nome || null, nvArtus,
            aspectus: asp?.nome || null, nvAspectus: nvAsp,
            emissor: emissor?.el?.nome || null, nvEmissor,
            sublimador: sublimador ? Number(sublimador.nivel) : 0,
            impressor: impressor ? Number(impressor.nivel) : 0,
        },
        sanidadeGravar, periciaExigida,
        problemas,
        jogavel: problemas.length === 0 && !!artus && !!aspectus && !!emissor,
    };
}

/* ===================== a runa vira ação do turno ===================== */

/**
 * O bloco vira a mira que o Painel do Turno consome — o MESMO formato das
 * habilidades de classe (ver miraDeCadastro em skill-runtime.js). É o que
 * permite a runa entrar em combate sem nenhum motor novo do lado do Tabuleiro.
 *
 * `afeta` sai do Emissor, não de um campo: Dispersor e Foco varrem o que
 * estiver na área ('todos'), Projetor e Vinculador escolhem alvo, e o
 * Manifestador não fere ninguém — constrói.
 */
export function miraDaRuna(bloco) {
    const m = bloco?.mira;
    if (!m) return null;
    const constroi = m.tipo === 'locais';
    return {
        tipo: m.tipo,
        forma: m.forma || 'circulo',
        origem: m.tipo === 'geometria' ? 'token' : 'livre',
        alcanceM: m.alcanceM ?? 0,
        raioM: m.raioM ?? 0,
        comprimentoM: m.comprimentoM ?? 0,
        larguraM: m.larguraM ?? Math.max(1, (Number(m.comprimentoM) || 0) / 3),
        angGraus: Number(m.angGraus) || 60,
        maxAlvos: Number(m.maxAlvos) || 1,
        afeta: constroi ? 'todos' : 'inimigos',
        condicoes: bloco.condicoesAplicadas || [],
        condicoesExclusivas: false,
        condicaoNome: bloco.condicoesAplicadas?.[0]?.condicao || null,
        condicaoRodadas: bloco.condicoesAplicadas?.[0]?.rodadas || 0,
        condicaoMaxAlvos: 0,
        condicaoPortao: bloco.condicoesAplicadas?.[0]?.portao || null,
        // 🕰️ Lei do Relógio: a runa não rola para acertar. Quem lê isto é a
        // janela de conflito, que pula a fase de acerto e vai direto à Defesa.
        semRolagem: true,
        alvoFixo: bloco.alvo || 0,
        _origem: 'runa',
    };
}

/**
 * O que sobra de uma runa depois de um uso. Não grava nada — devolve a
 * decisão. `acabou` significa que a INSTÂNCIA some da ficha; o modelo fica no
 * catálogo, e é dele que sai a próxima cópia.
 */
export function gastarUso(item) {
    if (item?.runa?.permanente) return { permanente: true, acabou: false, restante: null };
    const antes = Number(item?.usosRestantes);
    const atual = Number.isFinite(antes) ? antes : Number(item?.runa?.usos) || 0;
    const restante = Math.max(0, atual - 1);
    return { permanente: false, acabou: restante === 0, restante };
}
