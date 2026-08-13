// =============================================
// CENAS DE COMBATE — o doc `mesas/{id}/tabuleiro-meta/combate`
// ---------------------------------------------
// Uma mesa pode ter várias cenas armadas ao mesmo tempo (a emboscada da estrada,
// a briga da taverna), cada uma com a própria lista de participantes, turno e
// rodada. Só UMA fica aberta por vez.
//
// Formato:
//   { cenas: [{ id, nome, participantes, turnoAtual, rodada }], cenaAtiva,
//     participantes, turnoAtual, rodada }   ← ESPELHO da cena ativa
//
// O espelho não é redundância à toa: o painel de combate da FICHA lê
// `participantes` direto do doc para mostrar a iniciativa do jogador, e o mesmo
// vale para o HUD do tabuleiro. Sem ele, cada leitor precisaria conhecer cenas.
// A regra que segura os dois lados iguais: NINGUÉM escreve o doc na mão —
// todo write sai de `docDeCenas` (ou de quem chama ele).
//
// Doc antigo (só `participantes`) vira uma cena única, sem migração.
// =============================================

export const CENA_PADRAO = { id: 'cena-1', nome: 'Combate' };

export function novaCena(id, nome) {
    return { id, nome: nome || 'Nova cena', participantes: [], turnoAtual: 0, rodada: 1 };
}

/** Cenas do doc. Doc antigo (participantes soltos) = uma cena só. */
export function cenasDoDoc(c) {
    if (Array.isArray(c?.cenas) && c.cenas.length) return c.cenas;
    return [{
        ...CENA_PADRAO,
        participantes: c?.participantes || [],
        turnoAtual: c?.turnoAtual || 0,
        rodada: c?.rodada || 1,
    }];
}

/** A cena aberta agora. Cai na primeira quando o id salvo não existe mais. */
export function cenaAtiva(c) {
    const cs = cenasDoDoc(c);
    return cs.find(x => x.id === c?.cenaAtiva) || cs[0];
}

export function idCenaAtiva(c) { return cenaAtiva(c).id; }

/**
 * Doc completo a partir da lista de cenas — inclui o espelho da ativa.
 * É a ÚNICA porta de escrita: quem monta o doc por fora quebra o espelho.
 */
export function docDeCenas(cenas, ativaId) {
    const cs = (cenas || []).length ? cenas : [novaCena(CENA_PADRAO.id, CENA_PADRAO.nome)];
    const ativa = cs.find(x => x.id === ativaId) || cs[0];
    return {
        cenas: cs,
        cenaAtiva: ativa.id,
        participantes: ativa.participantes || [],
        turnoAtual: ativa.turnoAtual || 0,
        rodada: ativa.rodada || 1,
    };
}

/** Doc com a cena `id` alterada. */
export function comCena(c, id, patch) {
    return docDeCenas(cenasDoDoc(c).map(x => x.id === id ? { ...x, ...patch } : x), idCenaAtiva(c));
}

/** Doc com a cena ATIVA alterada — o caminho de todo dia. */
export function comCenaAtivaPatch(c, patch) {
    return comCena(c, idCenaAtiva(c), patch);
}

/** Doc com uma cena a mais, já aberta. */
export function comCenaNova(c, id, nome) {
    return docDeCenas([...cenasDoDoc(c), novaCena(id, nome)], id);
}

/** Doc sem a cena `id`. Tirar a última deixa uma cena vazia no lugar. */
export function semCena(c, id) {
    const cs = cenasDoDoc(c).filter(x => x.id !== id);
    return docDeCenas(cs, idCenaAtiva(c) === id ? cs[0]?.id : idCenaAtiva(c));
}

/** Doc com outra cena aberta. */
export function comTrocaDeCena(c, id) {
    return docDeCenas(cenasDoDoc(c), id);
}

// =============================================
// TURNO MECÂNICO (Livro §6.2)
// O turno tem 1 Ação Padrão + 1 Ação de Movimento; a Livre é incidental
// (não tem contador). "Ação Completa" consome as duas. A cena guarda:
//   iniciado: bool            — o mestre deu start (turno 1 só existe depois)
//   acoesTurno: {padrao, movimento} — o que o participante da vez ainda tem
// e cada participante ganha `faccao` (aliados|inimigos|neutros).
// =============================================

export const FACCOES = [
    ['aliados', '🟢 Aliados'],
    ['inimigos', '🔴 Inimigos'],
    ['neutros', '⚪ Neutros'],
];

/** Facção efetiva: a gravada, ou o palpite pelo tipo (jogador↔aliado, resto inimigo). */
export function faccaoDoParticipante(p) {
    if (p?.faccao) return p.faccao;
    return (p?.characterId || p?.type === 'Jogador') ? 'aliados' : 'inimigos';
}

/** Ações cheias de um turno recém-começado. */
export function acoesNovas() { return { padrao: true, movimento: true }; }

/** custoAcao: 'padrao' | 'movimento' | 'livre' | 'completa' (default padrao). */
export function podeGastar(acoes, custo) {
    const a = acoes || acoesNovas();
    if (custo === 'livre') return true;                    // incidental — não consome
    if (custo === 'movimento') return !!a.movimento;
    if (custo === 'completa') return !!a.padrao && !!a.movimento;
    return !!a.padrao;                                     // padrao (default)
}

/** Devolve o novo estado de ações após pagar `custo` (não muta o recebido). */
export function gastarAcao(acoes, custo) {
    const a = { ...(acoes || acoesNovas()) };
    if (custo === 'movimento') a.movimento = false;
    else if (custo === 'completa') { a.padrao = false; a.movimento = false; }
    else if (custo !== 'livre') a.padrao = false;
    return a;
}

/**
 * A skill com `afeta` pode atingir alguém da `faccaoAlvo`?
 * 'aliados' = mesma facção do agente (inclui ele mesmo);
 * 'inimigos' = facção diferente; 'todos'/ausente = qualquer um.
 */
export function alvoValido(afeta, minhaFaccao, faccaoAlvo) {
    if (!afeta || afeta === 'todos') return true;
    if (afeta === 'aliados') return minhaFaccao === faccaoAlvo;
    return minhaFaccao !== faccaoAlvo;
}

/**
 * Alcance do golpe corpo a corpo, em metros:
 * alcance da arma (cadastro; 0 quando não houver) + 5% do VD Tamanho,
 * nunca menor que 1 m. O raio conta a partir da BORDA do token.
 */
export function alcanceGolpe(alcanceArmaM, tamanhoVD) {
    const arma = Number(alcanceArmaM) || 0;
    const tam = Number(tamanhoVD) || 0;
    return Math.max(1, arma + tam * 0.05);
}

/** Participante da vez, na MESMA ordenação da janela (iniciativa desc). */
export function participanteDaVez(cena) {
    const parts = (cena?.participantes || []).slice().sort((a, b) => (b.initiative || 0) - (a.initiative || 0));
    if (!parts.length) return null;
    const turno = ((cena?.turnoAtual || 0) % parts.length + parts.length) % parts.length;
    return parts[turno];
}

// =============================================
// CONDIÇÕES DO PARTICIPANTE (`p.condicoes`)
// Duas gerações no mesmo array: string solta (legado) e objeto
// { nome, icone, descricao, expiraNaRodada } — sempre leia por aqui.
// `expiraNaRodada` null/ausente = dura até alguém remover.
// =============================================

export function condDoParticipante(c) {
    if (typeof c === 'string') return { nome: c, icone: '☠️', descricao: '', expiraNaRodada: null };
    return {
        nome: c?.nome || '',
        icone: c?.icone || '☠️',
        descricao: c?.descricao || '',
        expiraNaRodada: c?.expiraNaRodada ?? null,
    };
}

/**
 * Tira dos participantes as condições cujo tempo acabou (mesma régua dos
 * templates: expira quando `rodada >= expiraNaRodada`).
 * Pura: devolve cópias, não mexe na lista recebida.
 * @returns { participantes, expiradas: [{ pid, pNome, cond }] }
 */
export function tirarCondicoesExpiradas(participantes, rodada) {
    const expiradas = [];
    const parts = (participantes || []).map(p => {
        if (!(p.condicoes || []).length) return { ...p };
        const ficam = [];
        for (const cd of p.condicoes) {
            const c = condDoParticipante(cd);
            if (c.expiraNaRodada != null && rodada >= c.expiraNaRodada) {
                expiradas.push({ pid: p.id, pNome: p.name || '?', cond: c });
            } else ficam.push(cd);
        }
        return { ...p, condicoes: ficam };
    });
    return { participantes: parts, expiradas };
}
