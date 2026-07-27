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
 * Regra de mesa: apoio do tipo "roleta" com montante múltiplo de 3 conta 1 a cada 3.
 * Montante ausente vale 1.
 */
export function valorApoio(apoio) {
    const montante = parseInt(apoio?.montante) || 1;
    const tipo = (apoio?.tipo || '').toLowerCase().trim();
    if (tipo === 'roleta' && montante % 3 === 0) return montante / 3;
    return montante;
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

/** Identidade de um apoio pelo conteúdo — usada para reencontrá-lo no array do servidor. */
export function chaveApoio(a) {
    return JSON.stringify([
        a?.nome || '', a?.tipo || '', parseInt(a?.montante) || 1,
        a?.meta || '', a?.valor || '', a?.dataInicio || '', !!a?.recebido
    ]);
}
