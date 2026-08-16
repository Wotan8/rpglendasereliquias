// =============================================
// TABULEIRO — Conta do CONFLITO (combate v3, Livro §6.1–6.8)
//
// Módulo puro (nenhum import, nenhum DOM, nenhuma escrita): só a matemática da
// troca de golpes, para poder ser testada sem Firestore nem canvas.
//
//   1. ATAQUE  — o atacante rola 1d10. Graus = Alvo − dado.
//   2. DEFESA  — o alvo escolhe uma Defesa (número pronto na ficha).
//                Passa quando Graus >= Defesa.
//   3. DANO    — rola a fórmula da arma e subtrai a Blindagem do alvo.
//
// Só o atacante rola. 1 no d10 é acerto automático com Graus máximos e DADO
// CHEIO no dano (1d8 vira 8, sem rolar). 10 é erro automático.
// =============================================

/** Graus de Sucesso de um d10 contra o Alvo (mesma régua dos testes da cena). */
export function grausDoAtaque(alvo, dado) {
    if (dado === 1) return Math.max(alvo, 0);        // crítico: Graus máximos = Alvo
    if (dado === 10) return Math.min(alvo - 10, -1); // falha automática
    return alvo - dado;
}

/**
 * O golpe passa? `defesa` é o número da Defesa declarada (0 = não defendeu).
 * Crítico passa por qualquer Defesa; 10 nunca passa.
 */
export function golpePassa(graus, defesa, dado) {
    if (dado === 1) return true;
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
 * (mesma régua do contra-ataque no §6.8).
 * @param bruto      resultado da fórmula
 * @param blindagem  Blindagem do alvo (do tipo do golpe, quando houver)
 * @param meia       true = Absorver (recebe no corpo: metade, não letal)
 * @param critico    true = 1 no d10 — o Absorver não vale (ver abaixo)
 * @returns número >= 1, com meio ponto preservado (a ficha aceita 21,5)
 */
export function danoFinal(bruto, blindagem, meia, critico) {
    const base = (Number(bruto) || 0) - (Number(blindagem) || 0);
    // ✨ Crítico atravessa o Absorver: encaixar o golpe no corpo ampara uma
    // estocada comum, não uma perfeita. A Blindagem continua aparando — ela é
    // a peça de armadura, não a postura de quem se defende.
    const partiu = !!meia && !critico;
    const v = Math.round((partiu ? base / 2 : base) * 100) / 100;
    return Math.max(1, v);
}

/**
 * Defesas GRÁTIS por rodada (§6.2): Reflexo − 1, mínimo 1. Cada defesa além
 * dessas custa 1 Energia — e o contra-ataque custa 1 Energia sempre.
 */
export function defesasLivres(reflexo) {
    return Math.max(1, Math.floor(Number(reflexo) || 0) - 1);
}

/** Custo em Energia da PRÓXIMA defesa: 0 enquanto sobra defesa grátis. */
export function custoDaDefesa(usadas, livres) {
    return (Number(usadas) || 0) < (Number(livres) || 1) ? 0 : 1;
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
 * 🔁 Este defensor pode contra-atacar? (§6.8) — regra pura, sem canvas.
 *
 * O contra-ataque é uma estocada na abertura da guarda: é CORPO A CORPO. Não
 * existe contra-atacar quem atirou de longe, nem quem está fora do alcance do
 * seu braço — por isso a conta é "algum golpe físico meu alcança o agressor?".
 *
 * @param pericia        nível da perícia Contra-Ataque
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
    if (!(Number(pericia) >= 1)) return nao('não tem a perícia Contra-Ataque (nível 1+)', 'sem a perícia');
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
