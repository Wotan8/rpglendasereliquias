// =============================================
// TABULEIRO — Conta do CONFLITO (Núcleo v2, Livro de 12 Páginas, p. 5)
//
// Módulo puro (nenhum import, nenhum DOM, nenhuma escrita): só a matemática da
// troca de golpes, para poder ser testada sem Firestore nem canvas.
//
//   1. ATAQUE  — o atacante rola 1d10. Graus = Alvo − dado.
//   2. DEFESA  — o alvo escolhe UMA das três Defesas da ficha (Esquiva, Aparar,
//                Bloquear — o número é o nível da perícia). Passa quando Graus >= Defesa.
//   3. DANO    — rola a fórmula da arma e subtrai a Blindagem do alvo.
//
// Só o atacante rola. 1 no d10 é crítico: Graus = Alvo + 2 e DADO CHEIO no dano
// (1d8 vira 8, sem rolar) — mas uma Defesa maior que isso ainda segura. 10 é
// desastre: erro automático.
// =============================================

/**
 * Graus de Sucesso de um d10 contra o Alvo (mesma régua dos testes da cena).
 * @param extraCritico  Graus além do Alvo no 1 (config/regras: teste.criticoGrausExtra)
 */
export function grausDoAtaque(alvo, dado, extraCritico = 2) {
    if (dado === 1) return Math.max(alvo, 0) + (Number(extraCritico) || 0);   // crítico: Alvo + 2
    if (dado === 10) return Math.min(alvo - 10, -1); // desastre
    return alvo - dado;
}

/**
 * O golpe passa? `defesa` é o número da Defesa declarada (0 = não defendeu).
 * O crítico já chega com Graus = Alvo + 2; se a Defesa ainda for maior, não
 * passa (Livro, p. 5). 10 nunca passa.
 */
export function golpePassa(graus, defesa, dado) {
    if (dado === 10) return false;
    return graus >= (Number(defesa) || 0);
}

/**
 * 6.8: errar feio abre a guarda — Graus 0 ou menos, ou um 10 no dado.
 * Quem foi atacado PODE contra-atacar (custa 1 Energia e uma defesa da rodada);
 * aqui só sinalizamos a abertura, quem decide é a mesa.
 */
export function abriuGuarda(graus, dado) {
    return dado === 10 || graus <= 0;
}

const rngPadrao = (faces) => 1 + Math.floor(Math.random() * faces);

/**
 * 🎲 O d10 do teste, com Vantagem/Desvantagem (Livro, p. 9–10): rola dois e fica
 * com o melhor (Vantagem: o menor, que é roll-under) ou com o pior (Desvantagem:
 * o maior). As duas juntas se anulam. `dados` traz os dois para a mesa ver.
 */
export function rolarD10({ desvantagem = false, vantagem = false, rng = rngPadrao } = {}) {
    const a = rng(10);
    if (!!desvantagem === !!vantagem) return { dado: a, dados: [a] };
    const b = rng(10);
    return { dado: desvantagem ? Math.max(a, b) : Math.min(a, b), dados: [a, b] };
}

/**
 * Rola uma fórmula de dano da ficha: "1d8+3", "2d6 - 1", "1d10", "4".
 * @param formula  texto da linha de ataque
 * @param opts.critico  true = dado CHEIO (valor máximo), sem rolar (§6.6)
 * @param opts.rng      (faces) => valor — injetável para teste
 * @returns { total, dados, faces, qtd, mod, detalhe } — total nunca negativo
 */
export function rolarFormula(formula, opts = {}) {
    const rng = opts.rng || rngPadrao;
    const txt = String(formula || '').replace(/\s+/g, '');
    const m = txt.match(/^(\d*)d(\d+)/i);
    let mod = 0;
    for (const s of (m ? txt.slice(m[0].length) : txt).matchAll(/([+-])(\d+(?:[.,]\d+)?)/g)) {
        mod += (s[1] === '-' ? -1 : 1) * parseFloat(s[2].replace(',', '.'));
    }
    if (!m) {
        // fórmula sem dado ("4", "+2"): o número é o dano inteiro
        const fixo = parseFloat(txt.replace(',', '.'));
        const total = isNaN(fixo) ? mod : fixo;
        return { total: Math.max(0, total), dados: [], faces: 0, qtd: 0, mod, detalhe: String(total) };
    }
    const qtd = Math.max(1, parseInt(m[1] || '1', 10));
    const faces = Math.max(1, parseInt(m[2], 10));
    const dados = Array.from({ length: qtd }, () => (opts.critico ? faces : rng(faces)));
    const soma = dados.reduce((a, b) => a + b, 0);
    const total = Math.max(0, soma + mod);
    const detalhe = `${qtd}d${faces}[${dados.join(', ')}]${mod ? (mod > 0 ? ` +${mod}` : ` −${Math.abs(mod)}`) : ''}${opts.critico ? ' ✨ dado cheio' : ''}`;
    return { total, dados, faces, qtd, mod, detalhe };
}

/**
 * Dano que realmente entra na Vitalidade.
 * PISO 1: golpe que passou sempre machuca — a Blindagem apara, não anula
 * (mesma régua do contra-ataque).
 * @param bruto      resultado da fórmula (dado + atributo + Qualidade + Afiação)
 * @param blindagem  Blindagem do alvo (a comum, ou a Arcana para dano de Essência)
 * @returns número >= 1
 */
export function danoFinal(bruto, blindagem) {
    const base = (Number(bruto) || 0) - (Number(blindagem) || 0);
    return Math.max(1, Math.round(base * 100) / 100);
}

/* ===================== 📏 TAMANHO ===================== */

/**
 * O VD Tamanho é o TRIPLO da Altura, então dois pontos ≈ 66 cm de altura.
 * Humano de 1,75 m ≈ 5,25 · ogro de 3 m ≈ 9 · dragão de 6 m ≈ 18.
 *
 * Na prática: humano contra ogro dá 2 · humano contra dragão dá 6.
 */
export const TAMANHO_POR_PONTO = 2;
/**
 * Teto para os dois lados. Alto de propósito: acertar um dragão TEM de ser
 * fácil, e a patada dele tem de ser mortal — o teto existe só para o
 * colossal absurdo (acima de ~8 m de diferença) não virar aritmética infinita.
 */
export const TAMANHO_TETO = 10;

/**
 * 📏 O que a diferença de tamanho faz na troca de golpes.
 *
 * Alvo MAIOR é mais fácil de acertar — mais área, menos onde se esconder. Alvo
 * MENOR é mais difícil. E no corpo a corpo o peso entra junto: quem é maior
 * bate mais forte, quem é menor bate mais fraco.
 *
 * O mesmo número, com sinais opostos — não é coincidência, é a mesma diferença
 * física lida de dois jeitos. Por isso um ogro é fácil de acertar E machuca
 * mais quando acerta você.
 *
 * @returns { pontos, acerto, danoCaC } — `pontos` é a diferença já em degraus
 */
export function ajusteDeTamanho(tamAtacante, tamAlvo) {
    const dif = (Number(tamAlvo) || 0) - (Number(tamAtacante) || 0);
    // ⚠️ Arredonda a MAGNITUDE e devolve o sinal depois. `Math.round` empurra
    // para +Infinito nos meios exatos: round(1,5)=2 mas round(−1,5)=−1, e a
    // mesma diferença física renderia números diferentes conforme quem ataca
    // quem. Um ogro contra um halfling tem de ser o espelho exato do contrário.
    const bruto = Math.sign(dif) * Math.round(Math.abs(dif) / TAMANHO_POR_PONTO);
    const pontos = Math.max(-TAMANHO_TETO, Math.min(TAMANHO_TETO, bruto));
    return {
        pontos,
        acerto: pontos,      // alvo maior: soma no Alvo da rolagem
        // `|| 0` mata o -0 que `-pontos` produz quando pontos é 0: JavaScript
        // distingue -0 de 0, e um deepEqual (ou um `Object.is`) acusaria.
        danoCaC: -pontos || 0,   // atacante maior: soma no dano de corpo a corpo
    };
}

/**
 * Tem dano a rolar? Precisa de fórmula E de alguém que tenha levado o golpe.
 * Ataque que todo mundo defendeu não pede dado: a janela ia parar num
 * "💥 Rolar 1d12+4" que não tinha em quem cair.
 */
export function precisaRolarDano(formulaDano, alvos) {
    return !!String(formulaDano || '').trim() && (alvos || []).some(a => a?.passou);
}

/**
 * Defesas GRÁTIS por rodada (Livro, p. 5): a primeira é grátis; com escudo, a
 * segunda também, se for Bloquear. Cada defesa além dessas custa Energia — e o
 * contra-ataque custa 1 Energia sempre. Os números vêm de config/regras.
 */
export function defesasLivres({ gratis = 1, comEscudo = false, extraEscudo = 1 } = {}) {
    return Math.max(1, (Number(gratis) || 0) + (comEscudo ? (Number(extraEscudo) || 0) : 0));
}

/** Custo em Energia da PRÓXIMA defesa: 0 enquanto sobra defesa grátis. */
export function custoDaDefesa(usadas, livres, custo = 1) {
    return (Number(usadas) || 0) < (Number(livres) || 1) ? 0 : (Number(custo) || 1);
}

/**
 * 🤹 Duas armas (Livro, p. 5): −3 no Alvo dos dois golpes, e cada nível do Dom
 * Ambidestria (1 a 3) tira 1. Nunca vira bônus.
 */
export function penalidadeDuasArmas(nivelDom, base = -3) {
    return Math.min(0, (Number(base) || 0) + Math.max(0, Number(nivelDom) || 0));
}

/**
 * Só o DADO de uma fórmula ("1d8+3" → "1d8"). O contra-ataque usa o dado cru
 * da arma: nem o Dano do personagem nem os bônus da peça entram nele (§6.8).
 * Sem dado nenhum devolve '' (quem chama cai no desarmado, 1d4).
 */
export function soODado(formula) {
    const m = String(formula || '').replace(/\s+/g, '').match(/^(\d*)d(\d+)/i);
    return m ? `${m[1] || 1}d${m[2]}` : '';
}

/**
 * 🔁 Este defensor pode contra-atacar? — regra pura, sem canvas.
 *
 * É o trunfo do Aparar (Livro, p. 5): quem tira acima do Alvo contra você leva
 * golpe automático por 1 Energia. O contra-ataque é uma estocada na abertura
 * da guarda: é CORPO A CORPO. Não
 * existe contra-atacar quem atirou de longe, nem quem está fora do alcance do
 * seu braço — por isso a conta é "algum golpe físico meu alcança o agressor?".
 *
 * ⚠️ O QUE O AGRESSOR USOU NÃO ENTRA NA CONTA. Magia lançada de perto abre a
 * guarda igual a uma espada: quem errou feio se expôs, e o conjurador que
 * escolheu conjurar coladinho aceitou esse risco. Quem decide é só a distância
 * até ele e o que o defensor tem para revidar — arma OU parte do corpo, que
 * entram na lista `golpes` do mesmo jeito (parte do corpo alcança 1 m no
 * mínimo, ver alcanceGolpe).
 *
 * @param pericia        nível da perícia Aparar (arma na mão)
 * @param energia        Energia atual (null = desconhecida, não bloqueia)
 * @param jaContraAtacou já respondeu neste conflito
 * @param distanciaM     distância BORDA a BORDA até o agressor
 * @param golpes         [{ nome, alcanceM, distancia }] — alcanceM já efetivo
 * `curto` é o motivo em duas ou três palavras: vai NA TELA, ao lado do botão
 * apagado. Escondê-lo no `title` fazia a mesa achar que o contra-ataque estava
 * quebrado quando ele só estava, corretamente, indisponível.
 * @returns { ok, motivo, curto, linhas }
 */
export function podeContraAtacar({ pericia, energia, jaContraAtacou, distanciaM, golpes }) {
    const nao = (motivo, curto) => ({ ok: false, motivo, curto, linhas: [] });
    if (jaContraAtacou) return nao('já contra-atacou neste golpe', 'já contra-atacou');
    if (!(Number(pericia) >= 1)) return nao('não tem Aparar (nível 1+) — o contra-ataque é o trunfo dele', 'sem Aparar');
    if (energia != null && Number(energia) < 1) return nao('sem Energia (custa 1)', 'sem Energia');
    if (distanciaM == null) return nao('não dá para medir a distância até o agressor', 'sem token no mapa');
    const cac = (golpes || []).filter(g => !g.distancia && (Number(g.alcanceM) || 0) >= distanciaM - 1e-6);
    if (!cac.length) {
        const d = Math.round(distanciaM * 100) / 100;
        const bracoMaior = Math.max(0, ...(golpes || []).filter(g => !g.distancia).map(g => Number(g.alcanceM) || 0));
        return nao(
            `nenhum golpe corpo a corpo alcança o agressor (${d} m; o maior alcance é ${bracoMaior} m)`,
            golpes?.some(g => !g.distancia) ? `fora de alcance (${d} m)` : 'sem golpe corpo a corpo');
    }
    return { ok: true, motivo: '', curto: '', linhas: cac };
}
