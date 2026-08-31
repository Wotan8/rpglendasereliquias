/* ===== DÁDIVA — o que o Receptor ganha de quem o habita =====
 *
 * Serve à Transcendência (Receptor) do Xamã e à Fusão Selvagem (Receptor) do
 * Druida: a conta é a mesma, muda quem entra — um Eco da Alma ou um Aliado
 * Animal. Canon: Compêndio de Totemancia, "A Comunhão do Receptáculo" —
 * "Um Eco não concede poder. Concede o que ele foi."
 *
 * A REGRA (reforma de 2026-08-18, uniformizada em 24/08): toda Dádiva SORTEIA.
 * O Eco não entrega o melhor que tem — entrega o que calhou, e o valor sorteado
 * é SOMADO ao do personagem, maior ou menor:
 *
 *      resultado = min(valor do personagem + valor do hóspede, TETO)
 *
 * Não há comparação e não há sobra. Quem segura é o teto: 5 sem Aura, o que a
 * Aura permitir com ela, e o teto racial vence tudo. O excedente descarta.
 *
 * Consequência de projeto: com teto 5 e valores típicos, o sorteado quase
 * sempre ATERRISSA NO TETO. A incorporação empurra o Receptor para o próprio
 * limite naquilo que saiu — previsível de propósito. E um Eco fraco continua
 * valendo alguma coisa, o que na regra da sobra não acontecia.
 *
 * Braço/Mente/Boca sorteiam um atributo do seu grupo; Perícia sorteia UMA DE
 * CADA TIPO; Pele sorteia entre Vitalidade, Blindagem e Blindagem Arcana;
 * Olho um Sentido; Passo um Deslocamento.
 *
 * As taxas vêm do Livro Régua de Balanceamento §1.1 — não são chutadas aqui.
 *
 * Tudo é temporário: sai quando a incorporação acaba e o token perde a
 * condição "Em Transe".
 *
 * Este arquivo é PURO: recebe o hóspede, o personagem e o catálogo de Valores
 * Derivados por parâmetro, e não sabe de Firestore nem de DOM.
 */

/** Taxas do Livro Régua de Balanceamento §1.1 — unidades por ponto.
 *  Base da unidade: 3,90 (§0.2, combate v3 — só o atacante rola). */
export const TAXA = {
    vitalidade: 0.256,   // 1 ponto de Vitalidade (reserva, uma vez) = 1 ÷ 3,90
    energia: 0.256,      // §4: Energia é reserva que se esgota, como a Vitalidade
    blindagem: 0.154,    // +1 Blindagem POR RODADA = 1 ÷ 6,5 — o P cancela, não mudou com a base
    alvo: 0.167,         // ±1 no Alvo POR RODADA = 0,10 × 6,5 ÷ 3,90
    dano: 0.154,         // +N de dano num golpe que precisa acertar (§1.1)
};

/** Uma cena = 5 rodadas (§1.3). O que rende por rodada multiplica por isto. */
export const RODADAS_POR_CENA = 5;

/** Os nove atributos, nos três grupos que as Dádivas sorteiam. */
export const ATRIBUTOS = {
    fisico: ['FOR', 'DES', 'VIG'],
    mental: ['INT', 'RAC', 'PRS'],
    social: ['PRE', 'MAN', 'AUT'],
};

/** Teto do herdado quando o personagem não tem Aura no atributo (decisão de mesa 18/08). */
export const TETO_SEM_AURA = 5;

/**
 * Até onde ESTE personagem pode chegar NESTE atributo.
 *
 * Sem Aura, 5 — o teto do sistema. Com Aura ligada ao atributo, o teto é o que
 * ela permite: o Yotun com Aura de Força I chega a 6. Teto racial declarado
 * (o Pogo, que não passa de 3) vence tudo, para baixo ou para cima.
 *
 * ⚠️ O teto por grau (5 + grau) é DERIVADO, não lido: os docs de Aura em
 * `system/data/auras` não têm campo de teto, só `graus[]`. Se um dia tiverem,
 * o campo do cadastro passa a mandar e esta conta sai.
 *
 * @param sigla 'FOR' | 'DES' | ...
 * @param o.auras          { [auraId]: { grauDesbloqueado } } — as do personagem
 * @param o.catalogoAuras  [{ id, propriedadeTipo, propriedadeVinculada }]
 * @param o.tetoRacial     { [sigla]: teto } — sobrepõe o cálculo
 */
export function tetoDoAtributo(sigla, o = {}) {
    if (o.tetoRacial && o.tetoRacial[sigla] != null) return Number(o.tetoRacial[sigla]) || 0;
    const graus = (o.catalogoAuras || [])
        .filter(a => a.propriedadeTipo === 'atributo'
            && a.propriedadeVinculada === sigla
            && o.auras && o.auras[a.id])
        .map(a => Number(o.auras[a.id].grauDesbloqueado) || 0);
    return TETO_SEM_AURA + (graus.length ? Math.max(...graus) : 0);
}

/**
 * As sete Dádivas e onde cada uma procura.
 *
 * `bloco` casa com o blocoNome do cadastro de Valores Derivados — é o registro
 * que diz o que é Sentido e o que é Deslocamento, não este arquivo.
 *
 * TODAS sorteiam (uniformizado em 18/08/2026): o Eco entrega o que calhou, não
 * o melhor dele, e o valor sorteado é somado ao do personagem — maior ou menor.
 * Quem segura é o teto. `itens` declara candidatos explícitos, cada um com a
 * sua taxa (a Pele sorteia entre carne, couro e couro arcano).
 */
export const DADIVAS = {
    braco: {
        nome: 'Braço', icone: '🦾',
        canon: 'de quem lutou, caçou, matou — o corpo lembra o que a mão alheia sabia',
        categorias: [
            { nome: 'Atributo físico', atributos: ATRIBUTOS.fisico, sorteia: true, taxa: 'alvo', porRodada: true },
        ],
    },
    mente: {
        nome: 'Mente', icone: '🧠',
        canon: 'de erudito, de artífice, de quem passou a vida decifrando — o pensamento vem com método emprestado',
        categorias: [
            { nome: 'Atributo mental', atributos: ATRIBUTOS.mental, sorteia: true, taxa: 'alvo', porRodada: true },
        ],
    },
    pele: {
        nome: 'Pele', icone: '🛡️',
        canon: 'de quem aguentou, ou da fera de couro grosso — o corpo endurece por dentro',
        categorias: [{
            nome: 'Corpo', sorteia: true,
            // Três candidatos declarados: carne, couro e o que barra magia. Cada
            // um com a sua taxa, porque não valem a mesma coisa na régua.
            itens: [
                { chave: 'VIT', nome: 'Vitalidade Máxima', vital: true, taxa: 'vitalidade', porRodada: false, subeAtual: true },
                { chave: 'Blindagem', nome: 'Blindagem', taxa: 'blindagem', porRodada: true },
                { chave: 'Blindagem Arcana', nome: 'Blindagem Arcana', taxa: 'blindagem', porRodada: true },
            ],
        }],
    },
    olho: {
        nome: 'Olho', icone: '👁️',
        canon: 'de batedor, de vigia, de ave — enxerga-se longe, e o que estava escondido',
        categorias: [{ nome: 'Sentidos', bloco: 'Sentidos', sorteia: true, taxa: 'alvo', porRodada: true }],
    },
    passo: {
        nome: 'Passo', icone: '🦶',
        canon: 'de quem corria, ou da fera veloz — o chão fica mais curto',
        categorias: [{ nome: 'Deslocamento', bloco: 'Deslocamento', sorteia: true, taxa: null, porRodada: false }],
    },
    boca: {
        nome: 'Boca', icone: '🗣️',
        canon: 'de orador, de líder, de sacerdote — as palavras saem com autoridade emprestada',
        categorias: [
            { nome: 'Atributo social', atributos: ATRIBUTOS.social, sorteia: true, taxa: 'alvo', porRodada: true },
        ],
    },
    pericia: {
        nome: 'Perícia', icone: '🎓',
        canon: 'os ofícios que a vida dele martelou até virarem reflexo',
        // UMA DE CADA TIPO (decisão de 18/08, fechada em 24/08): o Eco entrega
        // um sorteio por categoria de perícia em que ele tenha alguma coisa.
        // Um Eco especialista dá poucas e boas; um Eco vivido dá uma de cada.
        // As categorias saem do CADASTRO, não daqui — por isso a expansão é
        // feita na hora, contra o catálogo recebido.
        porCategoriaDePericia: true,
        categorias: [],
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
        // ⚠️ §11.3 — recurso de combate GERADO ≤ recurso GASTO. Com a regra da
        // soma, esta Dádiva devolvia o pool inteiro do Eco (custo 2, devolvia 7):
        // motor perpétuo, o mesmo defeito do §4.7. O teto é o que a habilidade
        // custou, e o canon dela já dizia isso — "o fôlego de quem entra".
        categorias: [{ nome: 'Energia', vital: 'ENER', sorteia: true, limitadoPeloCusto: true,
            taxa: 'energia', porRodada: false, subeAtual: true }],
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
/**
 * Os candidatos de UMA categoria, na ordem em que o dado os numera.
 * A ordem é o contrato com a mesa: face 1 = primeiro da lista. Não reordene.
 */
export function candidatosDaCategoria(cat, hospede, catalogo = {}) {
    const candidatos = [];

    if (cat.itens) {
        candidatos.push(...cat.itens);                    // candidatos declarados, cada um com a sua taxa
    } else if (cat.vital) {
        candidatos.push({ chave: cat.vital, nome: cat.vital === 'VIT' ? 'Vitalidade Máxima' : 'Energia Máxima' });
    } else if (cat.atributos) {
        for (const a of cat.atributos) candidatos.push({ chave: a, nome: a, atributo: true });
    } else if (cat.periciaCategoria) {
        // 🎲 O sorteio é entre as perícias que o ECO TEM, não entre todas as do
        // catálogo. Sortear no catálogo inteiro fazia um Eco com 1 perícia
        // física ter 1 chance em 11 de entregá-la — o Velho de Muitas Vidas,
        // desenhado para dar as cinco, entregava zero.
        for (const s of catalogo.pericias || []) {
            if (norm(s.categoria) !== norm(cat.periciaCategoria)) continue;
            if (!(Number(valorDe(hospede, { chave: s.nome, nome: s.nome, pericia: true })) > 0)) continue;
            candidatos.push({ chave: s.nome, nome: s.nome, pericia: true });
        }
    } else {
        // 🎲 Mesma regra do bloco de perícia acima, e pelo mesmo motivo: sorteia-se
        // entre o que o HÓSPEDE TEM, não entre o bloco inteiro do catálogo. Sem
        // isto, um urso terrestre era sorteado contra os seis Deslocamentos —
        // Flutuação, Desloc. Aéreo, Desloc. Aquático inclusive — e tinha 1 chance
        // em 7 de emprestar a única coisa que possui. O conserto das perícias
        // (o caso do Velho de Muitas Vidas) nunca tinha chegado neste ramo.
        for (const dv of catalogo.derivedValues || []) {
            if (!vdNaCategoria(dv, cat)) continue;
            const c = { chave: dv.key || dv.nome, nome: dv.nome };
            if (!(Number(valorDe(hospede, c)) > 0)) continue;
            candidatos.push(c);
        }
    }
    return candidatos;
}

function melhorDaCategoria(cat, hospede, personagem, catalogo, o = {}) {
    const candidatos = candidatosDaCategoria(cat, hospede, catalogo);

    // 🎲 SORTEIO (decisão de mesa 18/08/2026): o Eco não entrega o seu melhor,
    // entrega o que calhou. A cada incorporação sorteia-se UM candidato do
    // grupo; se ele não for melhor que o personagem naquilo, a Dádiva vem
    // vazia. É o que faz duas incorporações do mesmo Eco não serem iguais.
    if (cat.sorteia && candidatos.length) {
        const escolhido = (o.sorteio || padraoSorteio)(candidatos, cat);
        // null = o dado caiu numa face de nenhum. É resultado, não falha: a
        // Dádiva veio vazia e o Xamã não ganha nada por ela nesta cena.
        if (!escolhido) return null;
        return linhaDoGanho(escolhido, cat, hospede, personagem, o);
    }

    let melhor = null;
    for (const c of candidatos) {
        const linha = linhaDoGanho(c, cat, hospede, personagem, o);
        if (!linha) continue;                             // só entra o que é MELHOR
        // Dentro da categoria os candidatos são da mesma espécie: maior sobra ganha
        if (!melhor || linha.sobra > melhor.sobra) melhor = linha;
    }
    return melhor;
}

/** Dados que existem na mesa. */
const DADOS = [4, 6, 8, 10, 12, 20];

/**
 * O dado que se rola para sortear entre `n` candidatos.
 *
 * REGRA DA MESA (25/08/2026): o sorteio tem SEMPRE uma saída de NENHUM, e uma
 * só. Receber uma Dádiva não garante vantagem — a sorte pode anular. São `n+1`
 * resultados possíveis: os `n` candidatos e o nenhum, que é sempre a última
 * face válida. Com 3 atributos, 1d4 e o 4 não é nenhum dos três.
 *
 * Quando `n+1` não é dado que existe, sobe para o próximo padrão e **rerrola**
 * o que passar de `n+1` — assim o nenhum continua valendo uma saída só, em vez
 * de virar 25% por acidente do catálogo. Com 6 Sentidos: 1d8, o 7 é nenhum e
 * o 8 rerrola.
 *
 * @returns {{ faces, rotulo, candidatos, nenhumEm, rerrolaAcimaDe }}
 */
export function dadoSugerido(n) {
    const k = Math.max(0, Number(n) || 0);
    const faces = DADOS.find(f => f >= k + 1) || DADOS[DADOS.length - 1];
    return {
        faces, rotulo: `1d${faces}`, candidatos: k, nenhumEm: k + 1,
        rerrolaAcimaDe: faces > k + 1 ? k + 1 : null,
    };
}

/**
 * Traduz o resultado do dado em candidato. `n+1` é NENHUM — a sorte anulou a
 * Dádiva, e `null` aqui é resultado, não erro. Acima disso o dado se rerrola,
 * então também não vira candidato.
 */
export function candidatoDoDado(candidatos, valor) {
    const v = Number(valor);
    if (!(v >= 1) || v > candidatos.length) return null;
    return candidatos[v - 1];
}

/**
 * Rola o dado de uma categoria com `n` candidatos e devolve a FACE (1..n+1).
 * `n+1` é o nenhum. O rerrolar já está embutido: sorteia direto entre as
 * saídas válidas, então nunca sai um número que a mesa mandaria rerrolar.
 * A janela do Mestre e o sorteio automático usam esta mesma função — se elas
 * divergirem, o dado do sistema deixa de ser o dado da mesa.
 */
export function rolarSorteio(n) {
    return 1 + Math.floor(Math.random() * (Math.max(0, Number(n) || 0) + 1));
}

/** Sorteio padrão: uniforme entre os candidatos E o nenhum. */
const padraoSorteio = (arr) => candidatoDoDado(arr, rolarSorteio(arr.length));

/**
 * O que UM candidato entrega, já cortado pelo teto.
 *
 * DUAS REGRAS DIFERENTES, e confundi-las é o erro fácil:
 *
 * · SORTEADO (Braço, Mente, Boca, Perícia) — o valor do hóspede é SOMADO ao do
 *   personagem, inteiro, seja ele maior ou menor. Não há comparação: o Eco não
 *   empresta o excedente, ele empresta o que é. Quem segura é só o teto.
 *
 * · ESCOLHIDO (Pele, Olho, Passo, Energia) — vale a SOBRA, e só quando o
 *   hóspede é mesmo melhor naquilo. Aqui a comparação continua valendo.
 *
 * ⚠️ TETO (decisão de mesa 18/08/2026): o resultado não passa do teto do
 * personagem naquele atributo — 5 sem Aura, o que a Aura permitir com ela
 * (Yotun 6 de FOR), e o teto racial vence tudo (Pogo 3). O excedente NÃO
 * transborda para outro atributo nem fica guardado: descarta.
 *
 * Consequência de projeto: com teto 5 e valores típicos, o atributo sorteado
 * quase sempre ATERRISSA NO TETO. A incorporação empurra o Xamã para o próprio
 * limite naquilo que saiu no sorteio — é previsível de propósito.
 */
function linhaDoGanho(c, cat, hospede, personagem, o = {}) {
    const doHospede = Number(valorDe(hospede, c)) || 0;
    const doPersonagem = Number(valorDe(personagem, c)) || 0;

    let ganho;
    if (cat.sorteia) {
        ganho = doHospede;                                // soma o valor cheio
        if (!(ganho > 0)) return null;                    // Eco com 0 naquilo não dá nada
    } else {
        ganho = doHospede - doPersonagem;                 // só a sobra
        if (!(ganho > 0)) return null;
    }

    let cortadoPeloTeto = false;
    if (c.atributo || c.pericia) {
        const teto = Number(o.teto?.(c.chave)) || TETO_SEM_AURA;
        const cabe = Math.max(0, teto - doPersonagem);
        if (ganho > cabe) { ganho = cabe; cortadoPeloTeto = true; }
        if (!(ganho > 0)) return null;                    // já estava no teto
    } else if (cat.limitadoPeloCusto) {
        // §11.3: recurso devolvido ≤ recurso gasto. FALHA FECHADA de propósito —
        // sem `custoRecurso` informado o teto é 0 e nada é devolvido. Devolver
        // por omissão seria reabrir o motor perpétuo em silêncio.
        const teto = Math.max(0, Number(o.custoRecurso) || 0);
        if (ganho > teto) { ganho = teto; cortadoPeloTeto = true; }
        if (!(ganho > 0)) return null;
    }
    // Candidato declarado pode trazer taxa própria (a Pele sorteia entre carne
    // e couro, e os dois não valem o mesmo na régua).
    const taxa = { taxa: c.taxa ?? cat.taxa, porRodada: c.porRodada ?? cat.porRodada, estreita: cat.estreita };
    return {
        ...c, doHospede, doPersonagem, sobra: ganho, cortadoPeloTeto,
        unidades: unidadesDaSobra(ganho, taxa),
        categoria: cat.nome, subeAtual: !!(c.subeAtual ?? cat.subeAtual),
    };
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
 * @param {boolean}  [o.ancestral] Eco Ancestral dobra a entrega (§9.2)
 * @param {Function} [o.sorteio]   (candidatos[]) => escolhido — injetável para teste
 * @param {Function} [o.teto]      (sigla) => teto do atributo no personagem (Aura); padrão 5
 * @param {number}   [o.custoRecurso] quanto a habilidade custou em recurso — é o
 *                   teto do que a Dádiva Energia pode devolver (§11.3). Ausente = 0.
 * @returns { chave, nome, icone, canon, ganhos[], modulos[], unidades }
 */
/**
 * As categorias que ESTA Dádiva sorteia. A Perícia se abre em uma por TIPO de
 * perícia do cadastro — as categorias saem do banco, não daqui.
 */
export function categoriasDaDadiva(chave, catalogo = {}) {
    const d = DADIVAS[chave];
    if (!d) return [];
    if (!d.porCategoriaDePericia) return d.categorias;
    const tipos = [...new Set((catalogo.pericias || []).map(s => s.categoria).filter(Boolean))];
    return tipos.map(t => ({
        nome: `Perícia ${t}`, periciaCategoria: t, sorteia: true,
        taxa: 'alvo', porRodada: true, estreita: true,
    }));
}

/**
 * A MESA DE SORTEIO da incorporação: tudo que o Mestre precisa ver na janela.
 *
 * Uma linha por categoria sorteável, com os candidatos NUMERADOS (face 1 = o
 * primeiro) e o dado sugerido. Categoria sem candidato não vira linha — não há
 * o que rolar. O Mestre digita o dado físico ou deixa o sistema rolar; em
 * ambos os casos a face acima do último candidato anula a Dádiva.
 *
 * @returns [{ dadiva, nome, icone, categoria, candidatos: [{n, nome}], dado }]
 */
export function mesaDeSorteio(chaves, hospede, catalogo = {}) {
    const linhas = [];
    for (const chave of chaves) {
        const d = DADIVAS[chave];
        if (!d || d.modulos) continue;                     // Habilidade não rola: vem inteira
        for (const cat of categoriasDaDadiva(chave, catalogo)) {
            if (!cat.sorteia) continue;
            const cands = candidatosDaCategoria(cat, hospede, catalogo);
            if (!cands.length) continue;
            linhas.push({
                dadiva: chave, nome: d.nome, icone: d.icone, categoria: cat.nome,
                candidatos: cands.map((c, i) => ({ n: i + 1, nome: c.nome, chave: c.chave })),
                dado: dadoSugerido(cands.length),
            });
        }
    }
    return linhas;
}

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

    // 🎓 A Perícia expande em uma categoria por TIPO de perícia do cadastro,
    // e cada uma sorteia sozinha. Categoria em que o Eco não tem nada some
    // naturalmente — `melhorDaCategoria` devolve null.
    const categorias = categoriasDaDadiva(chave, catalogo);

    const achados = categorias.map(cat => melhorDaCategoria(cat, hospede, personagem, catalogo, o)).filter(Boolean);

    // Desde a uniformização de 18/08/2026 toda Dádiva sorteia, então não há
    // mais categoria competindo com categoria — o dado já decidiu. A Pele, que
    // era o único caso (Vitalidade contra Blindagem), virou um sorteio de três
    // candidatos declarados.
    let ganhos = achados;

    // ✨ Ancestral dobra (§9.2) — mas o teto vem DEPOIS, senão o dobro fura o
    // corte de Aura que acabou de ser aplicado. O Ancestral empurra mais longe
    // dentro do teto; não passa por cima dele.
    if (o.ancestral) {
        ganhos = ganhos.map(g => {
            let sobra = g.sobra * 2, cortado = g.cortadoPeloTeto;
            if (g.atributo) {
                const teto = Number(o.teto?.(g.chave)) || TETO_SEM_AURA;
                const cabe = Math.max(0, teto - g.doPersonagem);
                if (sobra > cabe) { sobra = cabe; cortado = true; }
            }
            const cat = categorias.find(c => c.nome === g.categoria) || {};
            return { ...g, sobra, ancestral: true, cortadoPeloTeto: cortado, unidades: unidadesDaSobra(sobra, cat) };
        }).filter(g => g.sobra > 0);
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
