// =============================================
// APOIOS — Lógica pura de leitura (painel do mestre + menu do jogador)
// Fica em shared/ porque as duas telas precisam contar apoio do MESMO jeito:
// enquanto cada uma tinha a sua conta, os números divergiam em silêncio.
// Sem Firebase de propósito — testável fora do navegador (apoios-calc.test.mjs).
//
// Formato do campo `apoio.meta`: STRING com referências separadas por vírgula.
// As compras gravam IDs de documento ("abc123,def456"); apoios antigos podem
// ter slug ("classe") ou nome legado ("Raça"). Nada disso é normalizado no
// banco — a tradução acontece só na leitura.
// =============================================

/**
 * Quanto um apoio VALE na contagem (≠ do `montante` gravado, que é exibido cru no card).
 *
 * Duas regras se somam aqui:
 *  - Legado de mesa: apoio do tipo "roleta" com montante múltiplo de 3 conta 1 a cada 3.
 *  - `peso`: quanto UMA unidade do item rende na meta. Vem do cadastro da Loja
 *    (`pesoProducao`) e é o que faz a "Roleta 3x" valer 3 de Lore numa compra só.
 *    Ausente vale 1, então nada do que já está gravado muda de valor.
 *
 * Montante ausente vale 1.
 */
export function valorApoio(apoio) {
    const montante = parseInt(apoio?.montante) || 1;
    const tipo = (apoio?.tipo || '').toLowerCase().trim();
    if (tipo === 'roleta' && montante % 3 === 0) return montante / 3;

    const peso = Number(apoio?.peso);
    return montante * (Number.isFinite(peso) && peso >= 0 ? peso : 1);
}

export function parseMetaIds(metaVal) {
    if (!metaVal) return [];
    return String(metaVal).split(',').map(s => s.trim()).filter(Boolean);
}

/**
 * Traduz uma referência (id | slug | nome, em qualquer caixa) para o ID do documento.
 * Sem correspondência, devolve o valor original — nunca descarta.
 */
export function resolveMetaId(ref, metas = []) {
    const alvo = String(ref || '').trim();
    if (!alvo) return '';
    const norm = alvo.toLowerCase();
    const m = metas.find(x =>
        x.id === alvo ||
        (x.slug || '').toLowerCase().trim() === norm ||
        (x.nome || '').toLowerCase().trim() === norm ||
        // "Raça" foi historicamente gravada com o slug "raca"
        ((x.slug || '').toLowerCase().trim() === 'raca' && norm === 'raça')
    );
    return m ? m.id : alvo;
}

/**
 * Soma os montantes de todos os apoios por meta.
 * @param {Array<{apoios?: Array}>} users
 * @param {Array<{id: string, slug?: string, nome?: string}>} metas
 * @returns {Object<string, number>} { [metaId]: total }
 */
export function somarMetaTotais(users = [], metas = []) {
    const totais = {};
    users.forEach(u => {
        (u.apoios || []).forEach(a => {
            const valor = valorApoio(a);
            // Um apoio atrelado a N metas conta o valor integral em cada uma.
            parseMetaIds(a.meta).forEach(ref => {
                const id = resolveMetaId(ref, metas);
                if (id) totais[id] = (totais[id] || 0) + valor;
            });
        });
    });
    return totais;
}

/** Total de apoios de um jogador (o número grande do menu). */
export function somarApoiosDoJogador(apoios = []) {
    return apoios.reduce((s, a) => s + valorApoio(a), 0);
}

/**
 * Distribui o total acumulado entre as etapas, em cascata: a etapa 1 consome os
 * primeiros N apoios, o que sobra escorre para a etapa 2, e assim por diante.
 * Usado pelo painel do mestre E pela aba de Metas do jogador — a conta precisa
 * bater nos dois, senão o jogador vê um progresso e o mestre outro.
 * @returns {Array<{indice, necessarios, descricao, progresso, faltam, concluida, pct}>}
 */
export function progressoDasEtapas(total = 0, etapas = []) {
    let saldo = Math.max(0, total);
    return etapas.map((etapa, i) => {
        const necessarios = parseInt(etapa.necessarios) || 1;
        const progresso = Math.min(saldo, necessarios);
        saldo = Math.max(0, saldo - necessarios);
        return {
            indice: i,
            necessarios,
            descricao: etapa.descricao || '',
            progresso,
            faltam: Math.max(0, necessarios - progresso),
            concluida: progresso >= necessarios,
            pct: Math.min(100, Math.round((progresso / necessarios) * 100))
        };
    });
}

/** A primeira etapa ainda não concluída — o "próximo desbloqueio". null se tudo concluído. */
export function proximaEtapa(etapasComProgresso = []) {
    return etapasComProgresso.find(e => !e.concluida) || null;
}

/* Identidade de um apoio pelo conteúdo — usada para reencontrá-lo no array do
   servidor. `peso` entra na conta porque duas compras do mesmo item, no mesmo
   dia, feitas antes e depois de o mestre mudar o peso, são apoios DIFERENTES:
   sem ele, editar um mexeria no outro. */
export function chaveApoio(a) {
    const peso = Number(a?.peso);
    return JSON.stringify([
        a?.nome || '', a?.tipo || '', parseInt(a?.montante) || 1,
        a?.meta || '', a?.valor || '', a?.dataInicio || '', !!a?.recebido,
        Number.isFinite(peso) && peso >= 0 ? peso : 1
    ]);
}
